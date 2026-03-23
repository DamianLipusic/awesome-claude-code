"""Main trading engine - orchestrates all components."""

from __future__ import annotations

import asyncio
from datetime import datetime

import structlog
import yaml

from bot.database import Database
from bot.data_collector.aggregator import DataAggregator
from bot.ml_engine.model import TradingModel
from bot.trading.paper_trader import PaperTrader
from bot.trading.live_trader import LiveTrader
from bot.trading.risk_manager import RiskManager
from bot.models import BotMode

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
        self._holder_interval = data_config.get("holder_check_interval", 300)

    async def start(self) -> None:
        """Start the trading engine."""
        logger.info("engine_starting", mode=self.mode.value)

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
            )
        except asyncio.CancelledError:
            logger.info("engine_stopped")
        finally:
            await self.stop()

    async def stop(self) -> None:
        """Stop the trading engine."""
        self.running = False
        await self.data.stop()
        self.db.close()
        logger.info("engine_shutdown_complete")

    async def _token_discovery_loop(self) -> None:
        """Periodically discover new tokens."""
        while self.running:
            try:
                tokens = await self.data.discover_tokens()
                for token in tokens:
                    self._tracked_mints.add(token.mint_address)

                logger.info("tracking_tokens", count=len(self._tracked_mints))
            except Exception as e:
                logger.error("discovery_error", error=str(e))

            await asyncio.sleep(self._scan_interval)

    async def _price_tracking_loop(self) -> None:
        """Continuously track prices of discovered tokens."""
        while self.running:
            if not self._tracked_mints:
                await asyncio.sleep(5)
                continue

            try:
                prices = await self.data.update_prices(list(self._tracked_mints))
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

            except Exception as e:
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
                for mint in list(self._tracked_mints):
                    # Skip if already have position
                    if any(p.mint_address == mint for p in portfolio.open_positions):
                        continue

                    # Compute features
                    features = self.data.compute_features(mint)
                    if not features:
                        continue

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
                                size=f"{size:.4f} SOL")

                    if self.mode == BotMode.PAPER:
                        self.trader.execute_buy(signal, size)
                    else:
                        await self.trader.execute_buy(signal, size)

            except Exception as e:
                logger.error("trading_loop_error", error=str(e))

            await asyncio.sleep(self._price_interval * 3)

    async def _ml_training_loop(self) -> None:
        """Periodically retrain the ML model."""
        # Wait for some initial data
        await asyncio.sleep(300)

        while self.running:
            try:
                if self.model.should_retrain():
                    logger.info("ml_retraining_started")
                    stats = self.model.train()
                    logger.info("ml_retraining_done", **stats)
            except Exception as e:
                logger.error("ml_training_error", error=str(e))

            # Check every hour
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

                logger.info("=== STATUS REPORT ===")
                logger.info("portfolio", **summary)
                logger.info("risk", **risk)
                logger.info("ml_model", **ml_stats)

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
                logger.error("reporting_error", error=str(e))
