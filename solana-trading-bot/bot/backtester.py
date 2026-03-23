"""Backtesting engine - test strategies on historical data."""

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


class Backtester:
    """Backtests trading strategies on historical price data."""

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

        self.risk_manager = RiskManager(config)
        self.feature_engineer = FeatureEngineer()

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

                pnl_pct = (price - pos.entry_price_sol) / pos.entry_price_sol
                reason = None

                if pnl_pct >= self.take_profit:
                    reason = "take_profit"
                elif pnl_pct <= -self.stop_loss:
                    reason = "stop_loss"
                elif pos.highest_price_sol > pos.entry_price_sol * 1.1:
                    drawdown = (pos.highest_price_sol - price) / pos.highest_price_sol
                    if drawdown >= self.trailing_stop:
                        reason = "trailing_stop"

                hold_hours = (ts - pos.entry_time).total_seconds() / 3600
                if hold_hours >= self.max_hold_hours:
                    reason = "max_hold_time"

                if reason:
                    trade = self._close_position(pos, price, ts, reason, portfolio)
                    trades.append(trade)
                    positions = [p for p in positions if p.id != pos.id]

            # Look for new entries
            if len(positions) < self.max_positions:
                for mint, price in current_prices.items():
                    if any(p.mint_address == mint for p in positions):
                        continue

                    # Compute features from price history
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

        # Calculate results
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
            id=f"bt_{len(portfolio.open_positions)}_{ts.strftime('%H%M%S')}",
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
        """Close a backtest position."""
        exit_price = price * (1 - self.slippage)
        gross_sol = pos.amount_tokens * exit_price
        fee = gross_sol * self.fee_rate
        net_sol = gross_sol - fee

        pnl_sol = net_sol - pos.sol_invested
        pnl_pct = pnl_sol / pos.sol_invested if pos.sol_invested > 0 else 0

        portfolio.balance_sol += net_sol
        portfolio.total_pnl_sol += pnl_sol
        portfolio.total_trades += 1
        if pnl_sol > 0:
            portfolio.winning_trades += 1
        else:
            portfolio.losing_trades += 1

        self.risk_manager.record_trade_result(pnl_sol)

        hold_min = (ts - pos.entry_time).total_seconds() / 60

        return TradeRecord(
            id=pos.id,
            mint_address=pos.mint_address,
            symbol=pos.symbol,
            side=TradeSide.SELL,
            entry_price=pos.entry_price_sol,
            exit_price=exit_price,
            amount=pos.amount_tokens,
            sol_invested=pos.sol_invested,
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
        """Compute features from a price history list."""
        features: dict[str, float] = {}
        if len(prices) < 5:
            return features

        current = prices[-1]
        if current <= 0:
            return features

        for period in [5, 15, 30, 60]:
            n = min(period, len(prices))
            if n > 1 and prices[-n] > 0:
                features[f"price_change_{period}m"] = (
                    (current - prices[-n]) / prices[-n]
                )

        if len(prices) >= 5:
            returns = np.diff(np.log(np.array(prices[-30:])))
            features["price_volatility"] = float(np.std(returns)) if len(returns) > 0 else 0

        if len(prices) >= 10:
            recent = np.mean(prices[-5:])
            older = np.mean(prices[-10:-5])
            if older > 0:
                features["momentum_score"] = (recent - older) / older

        if len(prices) >= 15:
            features["rsi"] = self._calculate_rsi(prices[-15:])

        if len(prices) >= 10:
            up_moves = sum(1 for i in range(1, min(10, len(prices)))
                          if prices[-i] > prices[-i-1])
            features["buy_sell_ratio"] = up_moves / 10.0

        if len(prices) >= 20:
            recent_high = max(prices[-20:])
            recent_low = min(prices[-20:])
            if recent_high > recent_low:
                features["price_position"] = (
                    (current - recent_low) / (recent_high - recent_low)
                )

        return features

    def _heuristic_check(self, features: dict, mint: str) -> TradeSignal | None:
        """Simple heuristic signal for backtesting."""
        score = 0.0
        momentum = features.get("momentum_score", 0)
        if momentum > 0.03:
            score += 0.25
        rsi = features.get("rsi", 50)
        if 30 < rsi < 65:
            score += 0.15
        elif rsi <= 30:
            score += 0.2
        bs = features.get("buy_sell_ratio", 0.5)
        if bs > 0.6:
            score += 0.15

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
        if len(prices) < period + 1:
            return 50.0
        deltas = np.diff(prices)
        gains = np.where(deltas > 0, deltas, 0)
        losses = np.where(deltas < 0, -deltas, 0)
        avg_gain = np.mean(gains[-period:])
        avg_loss = np.mean(losses[-period:])
        if avg_loss == 0:
            return 100.0
        rs = avg_gain / avg_loss
        return float(100 - (100 / (1 + rs)))

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
            dd = (peak - bal) / peak
            if dd > max_dd:
                max_dd = dd

        # Sharpe ratio (simplified)
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

        final_balance = portfolio.balance_sol
        total_return = (final_balance - self.initial_balance) / self.initial_balance

        results = {
            "status": "completed",
            "initial_balance_sol": self.initial_balance,
            "final_balance_sol": round(final_balance, 4),
            "total_return_pct": f"{total_return:.2%}",
            "total_pnl_sol": round(portfolio.total_pnl_sol, 4),
            "total_trades": len(trades),
            "winning_trades": len(winning),
            "losing_trades": len(losing),
            "win_rate": f"{len(winning)/len(trades):.1%}" if trades else "0%",
            "avg_win_pct": f"{np.mean([t.pnl_pct for t in winning]):.2%}" if winning else "0%",
            "avg_loss_pct": f"{np.mean([t.pnl_pct for t in losing]):.2%}" if losing else "0%",
            "max_drawdown_pct": f"{max_dd:.2%}",
            "sharpe_ratio": round(sharpe, 2),
            "profit_factor": round(profit_factor, 2),
            "avg_hold_minutes": round(np.mean([t.hold_duration_minutes for t in trades]), 1),
            "exit_reasons": {},
        }

        # Count exit reasons
        for trade in trades:
            r = trade.exit_reason
            results["exit_reasons"][r] = results["exit_reasons"].get(r, 0) + 1

        logger.info("backtest_completed", **{k: v for k, v in results.items()
                                              if k != "exit_reasons"})
        return results

    def load_csv_data(self, csv_path: str) -> dict[str, pd.DataFrame]:
        """Load historical price data from CSV files."""
        path = Path(csv_path)
        data: dict[str, pd.DataFrame] = {}

        if path.is_file():
            df = pd.read_csv(path)
            df["timestamp"] = pd.to_datetime(df["timestamp"])
            mint = df["mint_address"].iloc[0] if "mint_address" in df.columns else path.stem
            data[mint] = df
        elif path.is_dir():
            for csv_file in path.glob("*.csv"):
                try:
                    df = pd.read_csv(csv_file)
                    df["timestamp"] = pd.to_datetime(df["timestamp"])
                    mint = df["mint_address"].iloc[0] if "mint_address" in df.columns else csv_file.stem
                    data[mint] = df
                except Exception as e:
                    logger.error("csv_load_error", file=str(csv_file), error=str(e))

        logger.info("csv_data_loaded", tokens=len(data))
        return data
