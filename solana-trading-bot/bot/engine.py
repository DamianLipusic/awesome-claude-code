"""Main trading engine - orchestrates all components."""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timedelta

import structlog

from bot.database import Database
from bot.data_collector.aggregator import DataAggregator
from bot.ml_engine.model import TradingModel
from bot.trading.paper_trader import PaperTrader
from bot.trading.live_trader import LiveTrader
from bot.trading.risk_manager import RiskManager
from bot.models import BotMode
from bot.utils.speed import latency_tracker

logger = structlog.get_logger()


class TradingEngine:
    """Main engine that orchestrates data collection, ML, and trading."""

    def __init__(self, config: dict):
        self.config = config
        self.mode = BotMode(config.get("mode", "paper"))
        self.running = False

        # Initialize components
        self.db = Database(config.get("data", {}).get("db_path", "data/trading_bot.db"))
        self.db.connect()

        self.data = DataAggregator(self.db, config)
        self.model = TradingModel(config, self.db)
        self.risk_manager = RiskManager(config)

        # Trader (paper or live)
        if self.mode == BotMode.PAPER:
            self.trader = PaperTrader(config, self.db)
        else:
            self.trader = LiveTrader(config, self.db)

        # Tracked tokens
        self._tracked_mints: set[str] = set()

        # Timing
        data_config = config.get("data", {})
        self._price_interval = data_config.get("price_poll_interval", 10)
        self._scan_interval = data_config.get("token_scan_interval", 60)

        # Health tracking
        self._start_time: datetime | None = None
        self._loop_errors: dict[str, int] = {
            "discovery": 0, "price": 0, "trading": 0, "ml": 0, "reporting": 0,
        }
        self._consecutive_errors: dict[str, int] = {
            "discovery": 0, "price": 0, "trading": 0, "ml": 0,
        }
        self._max_consecutive_errors = 10
        self._last_successful: dict[str, datetime] = {}

    async def start(self) -> None:
        """Start the trading engine."""
        logger.info("engine_starting", mode=self.mode.value)
        self._start_time = datetime.utcnow()

        await self.data.start()

        if self.mode == BotMode.LIVE:
            success = await self.trader.initialize()
            if not success:
                logger.error("live_trader_init_failed")
                return

        self.running = True

        # Print initial status
        summary = self.trader.get_portfolio_summary()
        logger.info("portfolio_status", **summary)

        # Run main loops concurrently
        try:
            await asyncio.gather(
                self._token_discovery_loop(),
                self._price_tracking_loop(),
                self._trading_loop(),
                self._ml_training_loop(),
                self._reporting_loop(),
                self._health_check_loop(),
                self._db_maintenance_loop(),
            )
        except asyncio.CancelledError:
            logger.info("engine_stopped")
        finally:
            await self.stop()

    async def stop(self) -> None:
        """Stop the trading engine gracefully."""
        self.running = False

        # Save state before stopping
        if self.mode == BotMode.PAPER and hasattr(self.trader, '_save_state'):
            self.trader._save_state()

        await self.data.stop()
        self.db.close()

        uptime = ""
        if self._start_time:
            uptime = str(datetime.utcnow() - self._start_time)

        logger.info("engine_shutdown_complete",
                     uptime=uptime,
                     total_errors=sum(self._loop_errors.values()))

    async def _token_discovery_loop(self) -> None:
        """Periodically discover new tokens."""
        while self.running:
            try:
                start = time.perf_counter()
                tokens = await self.data.discover_tokens()

                new_count = 0
                for token in tokens:
                    if token.mint_address not in self._tracked_mints:
                        new_count += 1
                    self._tracked_mints.add(token.mint_address)

                elapsed = (time.perf_counter() - start) * 1000
                latency_tracker.record("token_discovery", elapsed)

                logger.info("tracking_tokens",
                            total=len(self._tracked_mints),
                            new=new_count)

                self._consecutive_errors["discovery"] = 0
                self._last_successful["discovery"] = datetime.utcnow()

            except Exception as e:
                self._loop_errors["discovery"] += 1
                self._consecutive_errors["discovery"] += 1
                logger.error("discovery_error", error=str(e),
                             consecutive=self._consecutive_errors["discovery"])

                if self._consecutive_errors["discovery"] >= self._max_consecutive_errors:
                    logger.critical("discovery_loop_failing",
                                     msg="Too many consecutive errors, backing off")
                    await asyncio.sleep(self._scan_interval * 5)

            await asyncio.sleep(self._scan_interval)

    async def _price_tracking_loop(self) -> None:
        """Continuously track prices of discovered tokens."""
        while self.running:
            if not self._tracked_mints:
                await asyncio.sleep(5)
                continue

            try:
                start = time.perf_counter()
                prices = await self.data.update_prices(list(self._tracked_mints))
                elapsed = (time.perf_counter() - start) * 1000
                latency_tracker.record("price_update", elapsed)

                if prices:
                    # Check exits
                    if self.mode == BotMode.PAPER:
                        closed = self.trader.check_exits(prices)
                    else:
                        closed = await self.trader.check_exits(prices)

                    # Record outcomes for ML
                    for trade in closed:
                        self.model.record_outcome(
                            trade.mint_address,
                            trade.features_at_entry,
                            trade.pnl_pct,
                        )
                        self.risk_manager.record_trade_result(trade.pnl_sol)

                self._consecutive_errors["price"] = 0
                self._last_successful["price"] = datetime.utcnow()

            except Exception as e:
                self._loop_errors["price"] += 1
                self._consecutive_errors["price"] += 1
                logger.error("price_tracking_error", error=str(e))

            await asyncio.sleep(self._price_interval)

    async def _trading_loop(self) -> None:
        """Main trading decision loop."""
        min_confidence = self.config.get("strategy", {}).get(
            "min_confidence_score", 0.65
        )

        while self.running:
            try:
                portfolio = self.trader.portfolio

                # Check if we can trade
                can_trade, reason = self.risk_manager.can_trade(portfolio)
                if not can_trade:
                    logger.debug("trading_paused", reason=reason)
                    await asyncio.sleep(30)
                    continue

                # Evaluate each tracked token
                signals_evaluated = 0
                for mint in list(self._tracked_mints):
                    # Skip if already have position
                    if any(p.mint_address == mint for p in portfolio.open_positions):
                        continue

                    # Compute features
                    features = self.data.compute_features(mint)
                    if not features:
                        continue

                    signals_evaluated += 1

                    # Get ML prediction
                    token = self.data._token_cache.get(mint)
                    symbol = token.symbol if token else mint[:6]
                    signal = self.model.predict(features, mint, symbol)

                    if signal is None or signal.confidence < min_confidence:
                        continue

                    if signal.side != "buy":
                        continue

                    # Calculate position size
                    size = self.risk_manager.calculate_position_size(signal, portfolio)
                    if size < 0.001:
                        continue

                    # Add current price to features for the trader
                    prices = self.data._price_cache.get(mint, [])
                    if prices:
                        signal.features["current_price"] = prices[-1][1]

                    # Execute trade
                    logger.info("trade_signal",
                                symbol=symbol,
                                confidence=f"{signal.confidence:.2%}",
                                size=f"{size:.4f} SOL",
                                predicted_return=f"{signal.predicted_return:.2%}")

                    if self.mode == BotMode.PAPER:
                        self.trader.execute_buy(signal, size)
                    else:
                        await self.trader.execute_buy(signal, size)

                self._consecutive_errors["trading"] = 0
                self._last_successful["trading"] = datetime.utcnow()

            except Exception as e:
                self._loop_errors["trading"] += 1
                self._consecutive_errors["trading"] += 1
                logger.error("trading_loop_error", error=str(e))

            await asyncio.sleep(self._price_interval * 3)

    async def _ml_training_loop(self) -> None:
        """Periodically retrain the ML model."""
        # Wait for initial data collection
        await asyncio.sleep(300)

        while self.running:
            try:
                if self.model.should_retrain():
                    logger.info("ml_retraining_started")
                    start = time.perf_counter()
                    stats = self.model.train()
                    elapsed = (time.perf_counter() - start) * 1000
                    latency_tracker.record("ml_training", elapsed)
                    logger.info("ml_retraining_done",
                                duration_s=f"{elapsed/1000:.1f}",
                                **stats)
                self._consecutive_errors["ml"] = 0
            except Exception as e:
                self._loop_errors["ml"] += 1
                self._consecutive_errors["ml"] += 1
                logger.error("ml_training_error", error=str(e))

            await asyncio.sleep(3600)

    async def _reporting_loop(self) -> None:
        """Periodic status reporting."""
        report_hours = self.config.get("monitoring", {}).get(
            "report_interval_hours", 1
        )

        while self.running:
            await asyncio.sleep(report_hours * 3600)

            try:
                summary = self.trader.get_portfolio_summary()
                risk = self.risk_manager.get_risk_status(self.trader.portfolio)
                ml_stats = self.model.get_stats()
                latencies = latency_tracker.report()

                logger.info("=== STATUS REPORT ===")
                logger.info("portfolio", **summary)
                logger.info("risk", **risk)
                logger.info("ml_model", **ml_stats)
                if latencies:
                    logger.info("latencies", **{
                        k: f"{v['avg_ms']:.0f}ms (p99: {v['p99_ms']:.0f}ms)"
                        for k, v in latencies.items()
                    })

                # Save portfolio snapshot
                self.db.save_portfolio_snapshot(
                    balance=self.trader.portfolio.balance_sol,
                    invested=self.trader.portfolio.total_invested_sol,
                    pnl=self.trader.portfolio.total_pnl_sol,
                    positions=len(self.trader.portfolio.open_positions),
                    trades=self.trader.portfolio.total_trades,
                    win_rate=self.trader.portfolio.win_rate,
                )
            except Exception as e:
                self._loop_errors["reporting"] += 1
                logger.error("reporting_error", error=str(e))

    async def _health_check_loop(self) -> None:
        """Monitor bot health and restart components if needed."""
        check_interval = self.config.get("deployment", {}).get(
            "health_check_interval", 60
        )

        while self.running:
            await asyncio.sleep(check_interval)

            try:
                now = datetime.utcnow()
                health = {
                    "uptime_hours": round(
                        (now - self._start_time).total_seconds() / 3600, 1
                    ) if self._start_time else 0,
                    "tracked_tokens": len(self._tracked_mints),
                    "open_positions": len(self.trader.portfolio.open_positions),
                    "total_errors": sum(self._loop_errors.values()),
                    "errors_by_loop": {k: v for k, v in self._loop_errors.items() if v > 0},
                }

                # Check if any loop hasn't run successfully in a while
                stale_threshold = timedelta(minutes=10)
                for loop_name, last_time in self._last_successful.items():
                    if now - last_time > stale_threshold:
                        health[f"{loop_name}_stale"] = True
                        logger.warning("loop_stale",
                                        loop=loop_name,
                                        last_success=last_time.isoformat())

                # Check if data collector connections are alive
                if not self.data.jupiter.client or not self.data.raydium.client:
                    logger.warning("collector_client_down", msg="Restarting collectors")
                    await self.data.stop()
                    await self.data.start()

                logger.debug("health_check", **health)

            except Exception as e:
                logger.error("health_check_error", error=str(e))

    async def _db_maintenance_loop(self) -> None:
        """Periodic database maintenance."""
        while self.running:
            # Run every 6 hours
            await asyncio.sleep(21600)

            try:
                self.db.cleanup_old_data(days=30)
                self.db.optimize()
                logger.info("db_maintenance_done")
            except Exception as e:
                logger.error("db_maintenance_error", error=str(e))
