"""Backtesting engine - test strategies on historical data with scaled exits."""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import structlog

from bot.database import Database
from bot.ml_engine.model import TradingModel
from bot.ml_engine.feature_engineer import FeatureEngineer
from bot.models import (
    BotMode, PortfolioState, Position, TradeRecord,
    TradeSignal, TradeSide, TradeStatus,
)
from bot.trading.risk_manager import RiskManager

logger = structlog.get_logger()

REQUIRED_CSV_COLUMNS = {"timestamp", "close"}


class Backtester:
    """Backtests trading strategies on historical price data with scaled exits."""

    def __init__(self, config: dict, db: Database):
        self.config = config
        self.db = db

        bt_config = config.get("backtesting", {})
        self.initial_balance = bt_config.get("initial_balance_sol", 10.0)

        strategy = config.get("strategy", {})
        self.take_profit = strategy.get("take_profit_pct", 0.50)
        self.stop_loss = strategy.get("stop_loss_pct", 0.20)
        self.trailing_stop = strategy.get("trailing_stop_pct", 0.10)
        self.max_hold_hours = strategy.get("max_hold_time_hours", 24)
        self.max_positions = strategy.get("max_positions", 5)
        self.min_confidence = strategy.get("min_confidence_score", 0.65)

        self.slippage = 0.02
        self.fee_rate = 0.003

        # Scaled exit levels (matching paper/live trader)
        self.scaled_exits = [
            (0.25, 0.30),  # Sell 30% at 25% profit
            (0.50, 0.30),  # Sell 30% at 50% profit
            (1.00, 0.40),  # Sell remaining at 100% profit
        ]

        self.risk_manager = RiskManager(config)
        self.feature_engineer = FeatureEngineer()

        # Track partial exit levels per position
        self._exit_levels_hit: dict[str, set[int]] = {}

    def run_backtest(self, price_data: dict[str, pd.DataFrame],
                     model: TradingModel | None = None) -> dict:
        """Run backtest on historical price data.

        Args:
            price_data: dict of mint_address -> DataFrame with columns:
                        [timestamp, open, high, low, close, volume]
            model: Optional trained ML model, uses heuristic if None
        """
        logger.info("backtest_starting",
                     tokens=len(price_data),
                     initial_balance=self.initial_balance)

        portfolio = PortfolioState(
            mode=BotMode.BACKTEST,
            balance_sol=self.initial_balance,
            peak_balance_sol=self.initial_balance,
        )

        trades: list[TradeRecord] = []
        balance_history: list[tuple[datetime, float]] = []
        positions: list[Position] = []

        # Get all timestamps across all tokens
        all_timestamps = set()
        for df in price_data.values():
            all_timestamps.update(df["timestamp"].tolist())
        all_timestamps = sorted(all_timestamps)

        if not all_timestamps:
            return {"error": "No price data provided"}

        # Simulate trading at each timestamp
        price_cache: dict[str, list[float]] = {mint: [] for mint in price_data}

        for ts in all_timestamps:
            # Update prices
            current_prices: dict[str, float] = {}
            for mint, df in price_data.items():
                row = df[df["timestamp"] == ts]
                if not row.empty:
                    price = float(row.iloc[0]["close"])
                    if price > 0:
                        current_prices[mint] = price
                        price_cache[mint].append(price)

            # Check exits for open positions
            for pos in list(positions):
                price = current_prices.get(pos.mint_address)
                if price is None:
                    continue

                pos.current_price_sol = price
                if price > pos.highest_price_sol:
                    pos.highest_price_sol = price

                if pos.entry_price_sol <= 0:
                    continue

                pnl_pct = (price - pos.entry_price_sol) / pos.entry_price_sol

                # 1. Stop loss - exit everything
                if pnl_pct <= -self.stop_loss:
                    trade = self._close_position(pos, price, ts, "stop_loss", portfolio)
                    trades.append(trade)
                    positions = [p for p in positions if p.id != pos.id]
                    self._exit_levels_hit.pop(pos.id, None)
                    continue

                # 2. Max hold time - exit everything
                hold_hours = (ts - pos.entry_time).total_seconds() / 3600
                if hold_hours >= self.max_hold_hours:
                    trade = self._close_position(pos, price, ts, "max_hold_time", portfolio)
                    trades.append(trade)
                    positions = [p for p in positions if p.id != pos.id]
                    self._exit_levels_hit.pop(pos.id, None)
                    continue

                # 3. Scaled profit taking
                levels_hit = self._exit_levels_hit.get(pos.id, set())
                for level_idx, (profit_level, sell_pct) in enumerate(self.scaled_exits):
                    if level_idx in levels_hit:
                        continue
                    if pnl_pct >= profit_level:
                        trade = self._close_position_partial(
                            pos, price, ts,
                            f"take_profit_{int(profit_level*100)}pct",
                            portfolio, sell_pct,
                        )
                        trades.append(trade)
                        levels_hit.add(level_idx)
                        self._exit_levels_hit[pos.id] = levels_hit

                # 4. Trailing stop (after 10% profit)
                if pos.highest_price_sol > pos.entry_price_sol * 1.1:
                    drawdown = (pos.highest_price_sol - price) / pos.highest_price_sol
                    if drawdown >= self.trailing_stop:
                        trade = self._close_position(pos, price, ts, "trailing_stop", portfolio)
                        trades.append(trade)
                        positions = [p for p in positions if p.id != pos.id]
                        self._exit_levels_hit.pop(pos.id, None)

            # Remove fully closed positions (0 tokens remaining)
            positions = [p for p in positions if p.amount_tokens > 0.001]

            # Look for new entries
            if len(positions) < self.max_positions:
                for mint, price in current_prices.items():
                    if any(p.mint_address == mint for p in positions):
                        continue

                    history = price_cache.get(mint, [])
                    if len(history) < 10:
                        continue

                    features = self._compute_backtest_features(history)

                    if model and model._is_trained:
                        signal = model.predict(features, mint, mint[:6])
                    else:
                        signal = self._heuristic_check(features, mint)

                    if signal and signal.confidence >= self.min_confidence:
                        can_trade, _ = self.risk_manager.can_trade(portfolio)
                        if not can_trade:
                            continue

                        sol_amount = self.risk_manager.calculate_position_size(
                            signal, portfolio
                        )
                        if sol_amount < 0.001:
                            continue

                        pos = self._open_position(
                            mint, signal, price, sol_amount, ts, portfolio
                        )
                        if pos:
                            positions.append(pos)
                            self._exit_levels_hit[pos.id] = set()

            # Record balance
            total_value = portfolio.balance_sol + sum(
                p.sol_invested * (1 + p.unrealized_pnl_pct) for p in positions
            )
            if total_value > portfolio.peak_balance_sol:
                portfolio.peak_balance_sol = total_value
            balance_history.append((ts, total_value))

        # Close remaining positions at last known price
        for pos in positions:
            last_price = current_prices.get(pos.mint_address, pos.entry_price_sol)
            trade = self._close_position(
                pos, last_price, all_timestamps[-1], "backtest_end", portfolio
            )
            trades.append(trade)

        return self._calculate_results(
            trades, balance_history, portfolio, all_timestamps
        )

    def _open_position(self, mint: str, signal: TradeSignal, price: float,
                       sol_amount: float, ts: datetime,
                       portfolio: PortfolioState) -> Position | None:
        """Open a backtest position."""
        effective_price = price * (1 + self.slippage)
        fee = sol_amount * self.fee_rate
        net_sol = sol_amount - fee
        tokens = net_sol / effective_price if effective_price > 0 else 0

        if tokens <= 0:
            return None

        portfolio.balance_sol -= sol_amount

        return Position(
            id=f"bt_{portfolio.total_trades}_{ts.strftime('%H%M%S')}",
            mint_address=mint,
            symbol=signal.symbol,
            entry_price_sol=effective_price,
            amount_tokens=tokens,
            sol_invested=sol_amount,
            entry_time=ts,
            current_price_sol=price,
            highest_price_sol=price,
            confidence_at_entry=signal.confidence,
        )

    def _close_position(self, pos: Position, price: float, ts: datetime,
                        reason: str, portfolio: PortfolioState) -> TradeRecord:
        """Close a backtest position fully."""
        return self._close_position_partial(pos, price, ts, reason, portfolio, 1.0)

    def _close_position_partial(self, pos: Position, price: float, ts: datetime,
                                reason: str, portfolio: PortfolioState,
                                sell_fraction: float = 1.0) -> TradeRecord:
        """Close a backtest position (fully or partially)."""
        tokens_to_sell = pos.amount_tokens * sell_fraction
        sol_portion = pos.sol_invested * sell_fraction

        exit_price = price * (1 - self.slippage)
        gross_sol = tokens_to_sell * exit_price
        fee = gross_sol * self.fee_rate
        net_sol = gross_sol - fee

        pnl_sol = net_sol - sol_portion
        pnl_pct = pnl_sol / sol_portion if sol_portion > 0 else 0

        portfolio.balance_sol += net_sol
        portfolio.total_pnl_sol += pnl_sol

        if sell_fraction >= 1.0:
            portfolio.total_trades += 1
            if pnl_sol > 0:
                portfolio.winning_trades += 1
            else:
                portfolio.losing_trades += 1
            self.risk_manager.record_trade_result(pnl_sol)
        else:
            # Reduce position size
            pos.amount_tokens -= tokens_to_sell
            pos.sol_invested -= sol_portion

        hold_min = (ts - pos.entry_time).total_seconds() / 60

        return TradeRecord(
            id=pos.id + (f"_p{int(sell_fraction*100)}" if sell_fraction < 1.0 else ""),
            mint_address=pos.mint_address,
            symbol=pos.symbol,
            side=TradeSide.SELL,
            entry_price=pos.entry_price_sol,
            exit_price=exit_price,
            amount=tokens_to_sell,
            sol_invested=sol_portion,
            pnl_sol=pnl_sol,
            pnl_pct=pnl_pct,
            entry_time=pos.entry_time,
            exit_time=ts,
            hold_duration_minutes=hold_min,
            exit_reason=reason,
            confidence_at_entry=pos.confidence_at_entry,
            was_profitable=pnl_sol > 0,
        )

    def _compute_backtest_features(self, prices: list[float]) -> dict[str, float]:
        """Compute full ML feature set from price history (matches aggregator)."""
        features: dict[str, float] = {}
        if len(prices) < 5:
            return features

        current = prices[-1]
        if current <= 0:
            return features

        # Price change percentages
        for period in [5, 15, 30, 60]:
            n = min(period, len(prices))
            if n > 1 and prices[-n] > 0:
                features[f"price_change_{period}m"] = (
                    (current - prices[-n]) / prices[-n]
                )

        # Volatility
        if len(prices) >= 5:
            log_prices = np.log(np.array(prices[-30:]))
            returns = np.diff(log_prices)
            features["price_volatility"] = float(np.std(returns)) if len(returns) > 0 else 0

        # Momentum
        if len(prices) >= 10:
            recent = np.mean(prices[-5:])
            older = np.mean(prices[-10:-5])
            if older > 0:
                features["momentum_score"] = (recent - older) / older

        # RSI
        if len(prices) >= 15:
            features["rsi"] = self._calculate_rsi(prices[-15:])

        # MACD signal
        if len(prices) >= 26:
            macd, signal = self._calculate_macd(prices)
            features["macd_signal"] = macd - signal

        # Buy/sell ratio
        if len(prices) >= 10:
            up_moves = sum(1 for i in range(1, min(10, len(prices)))
                          if prices[-i] > prices[-i-1])
            features["buy_sell_ratio"] = up_moves / 10.0

        # Defaults for token-specific features (not available in backtest)
        features["liquidity_depth"] = 0.0
        features["volume_24h"] = 0.0
        features["holder_count"] = 0.0
        features["market_cap"] = 0.0
        features["token_age_hours"] = 0.0

        # Price position
        if len(prices) >= 20:
            recent_high = max(prices[-20:])
            recent_low = min(prices[-20:])
            if recent_high > recent_low:
                features["price_position"] = (
                    (current - recent_low) / (recent_high - recent_low)
                )

        # Volume profile (volatility ratio)
        if len(prices) >= 10:
            recent_vol = np.std(prices[-5:])
            older_vol = np.std(prices[-10:-5])
            if older_vol > 0:
                features["volume_profile"] = recent_vol / older_vol

        # Bollinger Band position
        if len(prices) >= 20:
            sma20 = np.mean(prices[-20:])
            std20 = np.std(prices[-20:])
            if std20 > 0:
                features["bb_position"] = (current - sma20) / (2 * std20)

        # Rate of change
        if len(prices) >= 10 and prices[-10] > 0:
            features["roc_10"] = (current - prices[-10]) / prices[-10]

        # ATR ratio
        if len(prices) >= 20:
            price_arr = np.array(prices[-20:])
            tr_proxy = np.abs(np.diff(price_arr))
            features["atr_ratio"] = float(np.mean(tr_proxy) / current) if current > 0 else 0

        # Momentum acceleration
        if len(prices) >= 15:
            mom_recent = np.mean(prices[-3:]) - np.mean(prices[-6:-3])
            mom_older = np.mean(prices[-6:-3]) - np.mean(prices[-9:-6])
            if abs(mom_older) > 0:
                features["momentum_acceleration"] = mom_recent / abs(mom_older)

        return features

    def _heuristic_check(self, features: dict, mint: str) -> TradeSignal | None:
        """Improved heuristic signal for backtesting."""
        score = 0.0

        momentum = features.get("momentum_score", 0)
        if momentum > 0.05:
            score += 0.3
        elif momentum > 0.02:
            score += 0.15

        rsi = features.get("rsi", 50)
        if 30 < rsi < 60:
            score += 0.15
        elif rsi <= 30:
            score += 0.2
        elif rsi > 75:
            score -= 0.2

        bs = features.get("buy_sell_ratio", 0.5)
        if bs > 0.6:
            score += 0.15

        vol_profile = features.get("volume_profile", 1.0)
        if vol_profile > 1.5:
            score += 0.1

        bb_pos = features.get("bb_position", 0)
        if bb_pos < -1.0:
            score += 0.15
        elif bb_pos > 1.5:
            score -= 0.1

        confidence = max(0.0, min(1.0, 0.45 + score))

        return TradeSignal(
            mint_address=mint,
            symbol=mint[:6],
            side=TradeSide.BUY,
            confidence=confidence,
            predicted_return=score * 0.1,
            features=features,
        )

    @staticmethod
    def _calculate_rsi(prices: list[float], period: int = 14) -> float:
        """Calculate RSI using EMA (matching aggregator)."""
        if len(prices) < period + 1:
            return 50.0
        deltas = np.diff(prices)
        gains = np.where(deltas > 0, deltas, 0)
        losses = np.where(deltas < 0, -deltas, 0)

        alpha = 1.0 / period
        avg_gain = gains[0]
        avg_loss = losses[0]
        for i in range(1, len(gains)):
            avg_gain = alpha * gains[i] + (1 - alpha) * avg_gain
            avg_loss = alpha * losses[i] + (1 - alpha) * avg_loss

        if avg_loss == 0:
            return 100.0
        rs = avg_gain / avg_loss
        return float(100 - (100 / (1 + rs)))

    @staticmethod
    def _calculate_macd(prices: list[float]) -> tuple[float, float]:
        """Calculate MACD and signal line."""
        prices_arr = np.array(prices)
        weights12 = np.exp(np.linspace(-1., 0., min(12, len(prices_arr))))
        weights12 /= weights12.sum()
        ema12 = float(np.dot(prices_arr[-len(weights12):], weights12))

        weights26 = np.exp(np.linspace(-1., 0., min(26, len(prices_arr))))
        weights26 /= weights26.sum()
        ema26 = float(np.dot(prices_arr[-len(weights26):], weights26))

        macd_line = ema12 - ema26
        signal = macd_line * 0.9  # Approximation
        return macd_line, signal

    def _calculate_results(self, trades: list[TradeRecord],
                           balance_history: list[tuple[datetime, float]],
                           portfolio: PortfolioState,
                           timestamps: list) -> dict:
        """Calculate comprehensive backtest results."""
        if not trades:
            return {
                "status": "no_trades",
                "initial_balance": self.initial_balance,
                "final_balance": portfolio.balance_sol,
            }

        pnls = [t.pnl_pct for t in trades]
        winning = [t for t in trades if t.was_profitable]
        losing = [t for t in trades if not t.was_profitable]

        # Max drawdown from balance history
        max_dd = 0.0
        peak = self.initial_balance
        for _, bal in balance_history:
            if bal > peak:
                peak = bal
            if peak > 0:
                dd = (peak - bal) / peak
                if dd > max_dd:
                    max_dd = dd

        # Sharpe ratio
        if len(pnls) > 1:
            mean_return = np.mean(pnls)
            std_return = np.std(pnls)
            sharpe = (mean_return / std_return * np.sqrt(252)) if std_return > 0 else 0
        else:
            sharpe = 0

        # Profit factor
        total_wins = sum(t.pnl_sol for t in winning)
        total_losses = abs(sum(t.pnl_sol for t in losing))
        profit_factor = total_wins / total_losses if total_losses > 0 else float("inf")

        # Sortino ratio (downside deviation only)
        negative_pnls = [p for p in pnls if p < 0]
        if negative_pnls and len(pnls) > 1:
            downside_std = np.std(negative_pnls)
            sortino = (np.mean(pnls) / downside_std * np.sqrt(252)) if downside_std > 0 else 0
        else:
            sortino = 0

        final_balance = portfolio.balance_sol
        total_return = (final_balance - self.initial_balance) / self.initial_balance

        # Count scaled exits
        scaled_exit_count = sum(1 for t in trades if "take_profit_" in t.exit_reason and "pct" in t.exit_reason)

        results = {
            "status": "completed",
            "initial_balance_sol": self.initial_balance,
            "final_balance_sol": round(final_balance, 4),
            "total_return_pct": f"{total_return:.2%}",
            "total_pnl_sol": round(portfolio.total_pnl_sol, 4),
            "total_trades": len(trades),
            "winning_trades": len(winning),
            "losing_trades": len(losing),
            "scaled_exits": scaled_exit_count,
            "win_rate": f"{len(winning)/len(trades):.1%}" if trades else "0%",
            "avg_win_pct": f"{np.mean([t.pnl_pct for t in winning]):.2%}" if winning else "0%",
            "avg_loss_pct": f"{np.mean([t.pnl_pct for t in losing]):.2%}" if losing else "0%",
            "max_drawdown_pct": f"{max_dd:.2%}",
            "sharpe_ratio": round(float(sharpe), 2),
            "sortino_ratio": round(float(sortino), 2),
            "profit_factor": round(float(profit_factor), 2),
            "avg_hold_minutes": round(float(np.mean([t.hold_duration_minutes for t in trades])), 1),
            "exit_reasons": {},
        }

        for trade in trades:
            r = trade.exit_reason
            results["exit_reasons"][r] = results["exit_reasons"].get(r, 0) + 1

        logger.info("backtest_completed", **{k: v for k, v in results.items()
                                              if k != "exit_reasons"})
        return results

    def load_csv_data(self, csv_path: str) -> dict[str, pd.DataFrame]:
        """Load historical price data from CSV files with validation."""
        path = Path(csv_path)
        data: dict[str, pd.DataFrame] = {}

        if path.is_file():
            df = self._load_and_validate_csv(path)
            if df is not None:
                mint = df["mint_address"].iloc[0] if "mint_address" in df.columns else path.stem
                data[mint] = df
        elif path.is_dir():
            for csv_file in sorted(path.glob("*.csv")):
                df = self._load_and_validate_csv(csv_file)
                if df is not None:
                    mint = df["mint_address"].iloc[0] if "mint_address" in df.columns else csv_file.stem
                    data[mint] = df
        else:
            logger.error("csv_path_not_found", path=csv_path)

        logger.info("csv_data_loaded", tokens=len(data))
        return data

    def _load_and_validate_csv(self, path: Path) -> pd.DataFrame | None:
        """Load and validate a single CSV file."""
        try:
            df = pd.read_csv(path)

            # Check required columns
            missing = REQUIRED_CSV_COLUMNS - set(df.columns)
            if missing:
                logger.error("csv_missing_columns",
                             file=str(path), missing=list(missing))
                return None

            # Parse timestamps
            df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
            invalid_ts = df["timestamp"].isna().sum()
            if invalid_ts > 0:
                logger.warning("csv_invalid_timestamps",
                               file=str(path), count=invalid_ts)
                df = df.dropna(subset=["timestamp"])

            # Validate close prices
            df["close"] = pd.to_numeric(df["close"], errors="coerce")
            df = df.dropna(subset=["close"])
            df = df[df["close"] > 0]

            if df.empty:
                logger.warning("csv_empty_after_validation", file=str(path))
                return None

            # Sort by timestamp
            df = df.sort_values("timestamp").reset_index(drop=True)

            # Fill missing OHLV columns with close price
            for col in ["open", "high", "low"]:
                if col not in df.columns:
                    df[col] = df["close"]
            if "volume" not in df.columns:
                df["volume"] = 0.0

            logger.info("csv_loaded", file=path.name, rows=len(df))
            return df

        except Exception as e:
            logger.error("csv_load_error", file=str(path), error=str(e))
            return None
