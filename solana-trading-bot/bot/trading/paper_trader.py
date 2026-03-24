"""Paper trading engine - simulates trades without real money."""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from pathlib import Path

import structlog

from bot.database import Database
from bot.models import (
    BotMode, Position, PortfolioState, TradeRecord,
    TradeSignal, TradeSide, TradeStatus,
)

logger = structlog.get_logger()


class PaperTrader:
    """Simulates trading with virtual balance and scaled exit strategy."""

    def __init__(self, config: dict, db: Database):
        self.config = config
        self.db = db

        paper_config = config.get("paper_trading", {})
        self.slippage = paper_config.get("slippage_simulation", 0.02)
        self.fee_rate = paper_config.get("fee_simulation", 0.003)

        strategy = config.get("strategy", {})
        self.take_profit = strategy.get("take_profit_pct", 0.50)
        self.stop_loss = strategy.get("stop_loss_pct", 0.20)
        self.trailing_stop = strategy.get("trailing_stop_pct", 0.10)
        self.max_hold_hours = strategy.get("max_hold_time_hours", 24)
        self.max_positions = strategy.get("max_positions", 5)

        # Scaled exit levels (sell portions at different profit levels)
        self.scaled_exits = [
            (0.25, 0.30),  # Sell 30% at 25% profit
            (0.50, 0.30),  # Sell 30% at 50% profit
            (1.00, 0.40),  # Sell remaining 40% at 100% profit (or trailing stop)
        ]

        # Portfolio state
        initial = paper_config.get("initial_balance_sol", 10.0)
        self.portfolio = PortfolioState(
            mode=BotMode.PAPER,
            balance_sol=initial,
            peak_balance_sol=initial,
        )

        # Track partial exits per position
        self._exit_levels_hit: dict[str, set[int]] = {}

        # State file for persistence
        self._state_path = Path("data/paper_state.json")
        self._save_interval = paper_config.get("save_interval_seconds", 300)
        self._last_save = datetime.utcnow()
        self._load_state()

    def execute_buy(self, signal: TradeSignal, sol_amount: float) -> Position | None:
        """Execute a paper buy order."""
        if len(self.portfolio.open_positions) >= self.max_positions:
            logger.info("max_positions_reached",
                        current=len(self.portfolio.open_positions))
            return None

        if sol_amount > self.portfolio.balance_sol:
            sol_amount = self.portfolio.balance_sol * 0.95

        if sol_amount <= 0.001:
            logger.info("insufficient_balance", balance=self.portfolio.balance_sol)
            return None

        # Simulate slippage and fees
        effective_price = signal.features.get("current_price", 0)
        if effective_price <= 0:
            return None

        slippage_adj = effective_price * (1 + self.slippage)
        fee = sol_amount * self.fee_rate
        net_sol = sol_amount - fee
        tokens_received = net_sol / slippage_adj

        position = Position(
            id=str(uuid.uuid4())[:8],
            mint_address=signal.mint_address,
            symbol=signal.symbol,
            entry_price_sol=slippage_adj,
            amount_tokens=tokens_received,
            sol_invested=sol_amount,
            entry_time=datetime.utcnow(),
            current_price_sol=effective_price,
            highest_price_sol=effective_price,
            confidence_at_entry=signal.confidence,
        )

        # Update portfolio
        self.portfolio.balance_sol -= sol_amount
        self.portfolio.total_invested_sol += sol_amount
        self.portfolio.open_positions.append(position)

        # Initialize exit tracking
        self._exit_levels_hit[position.id] = set()

        # Save to DB
        self.db.save_open_position(position)

        logger.info("paper_buy",
                     symbol=signal.symbol,
                     sol=f"{sol_amount:.4f}",
                     price=f"{slippage_adj:.10f}",
                     tokens=f"{tokens_received:.2f}",
                     confidence=f"{signal.confidence:.2%}")

        self._save_state()
        return position

    def execute_sell(self, position: Position, current_price: float,
                     reason: str = "manual",
                     sell_fraction: float = 1.0) -> TradeRecord | None:
        """Execute a paper sell order, optionally partial."""
        if current_price <= 0:
            return None

        # Calculate tokens to sell
        tokens_to_sell = position.amount_tokens * sell_fraction
        sol_invested_portion = position.sol_invested * sell_fraction

        # Simulate slippage and fees
        slippage_adj = current_price * (1 - self.slippage)
        gross_sol = tokens_to_sell * slippage_adj
        fee = gross_sol * self.fee_rate
        net_sol = gross_sol - fee

        pnl_sol = net_sol - sol_invested_portion
        pnl_pct = pnl_sol / sol_invested_portion if sol_invested_portion > 0 else 0

        now = datetime.utcnow()
        hold_minutes = (now - position.entry_time).total_seconds() / 60

        # Create trade record
        trade = TradeRecord(
            id=position.id + (f"_p{int(sell_fraction*100)}" if sell_fraction < 1.0 else ""),
            mint_address=position.mint_address,
            symbol=position.symbol,
            side=TradeSide.SELL,
            entry_price=position.entry_price_sol,
            exit_price=slippage_adj,
            amount=tokens_to_sell,
            sol_invested=sol_invested_portion,
            pnl_sol=pnl_sol,
            pnl_pct=pnl_pct,
            entry_time=position.entry_time,
            exit_time=now,
            hold_duration_minutes=hold_minutes,
            exit_reason=reason,
            confidence_at_entry=position.confidence_at_entry,
            features_at_entry=getattr(position, '_features', {}),
            was_profitable=pnl_sol > 0,
        )

        # Update portfolio
        self.portfolio.balance_sol += net_sol
        self.portfolio.total_pnl_sol += pnl_sol

        if sell_fraction >= 1.0:
            # Full exit
            self.portfolio.total_trades += 1
            if pnl_sol > 0:
                self.portfolio.winning_trades += 1
            else:
                self.portfolio.losing_trades += 1

            # Remove from open positions
            self.portfolio.open_positions = [
                p for p in self.portfolio.open_positions if p.id != position.id
            ]
            self._exit_levels_hit.pop(position.id, None)
        else:
            # Partial exit - reduce position size
            position.amount_tokens -= tokens_to_sell
            position.sol_invested -= sol_invested_portion

        # Update peak/drawdown
        total_value = self.portfolio.balance_sol + sum(
            p.sol_invested for p in self.portfolio.open_positions
        )
        if total_value > self.portfolio.peak_balance_sol:
            self.portfolio.peak_balance_sol = total_value
        self.portfolio.max_drawdown_pct = max(
            self.portfolio.max_drawdown_pct,
            self.portfolio.current_drawdown_pct,
        )

        # Save to DB
        self.db.save_trade(trade)

        prefix = "partial_" if sell_fraction < 1.0 else ""
        sign = "+" if pnl_sol > 0 else ""
        logger.info(f"paper_{prefix}sell",
                     symbol=position.symbol,
                     fraction=f"{sell_fraction:.0%}",
                     pnl_sol=f"{sign}{pnl_sol:.4f}",
                     pnl_pct=f"{sign}{pnl_pct:.2%}",
                     reason=reason,
                     hold_min=f"{hold_minutes:.0f}")

        self._save_state()
        return trade

    def check_exits(self, prices: dict[str, float]) -> list[TradeRecord]:
        """Check all positions for exit conditions including scaled exits."""
        closed_trades = []

        for position in list(self.portfolio.open_positions):
            price = prices.get(position.mint_address)
            if price is None or price <= 0:
                continue

            # Update current and highest price
            position.current_price_sol = price
            if price > position.highest_price_sol:
                position.highest_price_sol = price

            if position.entry_price_sol <= 0:
                continue

            pnl_pct = (price - position.entry_price_sol) / position.entry_price_sol

            # 1. Stop loss - exit everything immediately
            if pnl_pct <= -self.stop_loss:
                trade = self.execute_sell(position, price, "stop_loss")
                if trade:
                    closed_trades.append(trade)
                continue

            # 2. Max hold time - exit everything
            hold_hours = (datetime.utcnow() - position.entry_time).total_seconds() / 3600
            if hold_hours >= self.max_hold_hours:
                trade = self.execute_sell(position, price, "max_hold_time")
                if trade:
                    closed_trades.append(trade)
                continue

            # 3. Scaled profit taking
            levels_hit = self._exit_levels_hit.get(position.id, set())
            for level_idx, (profit_level, sell_pct) in enumerate(self.scaled_exits):
                if level_idx in levels_hit:
                    continue
                if pnl_pct >= profit_level:
                    # Calculate actual fraction of remaining position
                    trade = self.execute_sell(
                        position, price,
                        f"take_profit_{int(profit_level*100)}pct",
                        sell_fraction=sell_pct,
                    )
                    if trade:
                        closed_trades.append(trade)
                        levels_hit.add(level_idx)
                    self._exit_levels_hit[position.id] = levels_hit

            # 4. Trailing stop (only after some profit)
            if position.highest_price_sol > position.entry_price_sol * 1.1:
                drawdown = (position.highest_price_sol - price) / position.highest_price_sol
                if drawdown >= self.trailing_stop:
                    trade = self.execute_sell(position, price, "trailing_stop")
                    if trade:
                        closed_trades.append(trade)

        # Periodic save
        if (datetime.utcnow() - self._last_save).total_seconds() > self._save_interval:
            self._save_state()

        return closed_trades

    def get_portfolio_summary(self) -> dict:
        """Get current portfolio summary."""
        total_value = self.portfolio.balance_sol + sum(
            p.sol_invested * (1 + p.unrealized_pnl_pct)
            for p in self.portfolio.open_positions
        )

        initial = self.config.get("paper_trading", {}).get("initial_balance_sol", 10.0)
        total_return = (total_value - initial) / initial if initial > 0 else 0

        return {
            "mode": "PAPER",
            "balance_sol": round(self.portfolio.balance_sol, 4),
            "total_value_sol": round(total_value, 4),
            "total_pnl_sol": round(self.portfolio.total_pnl_sol, 4),
            "total_return": f"{total_return:.2%}",
            "open_positions": len(self.portfolio.open_positions),
            "total_trades": self.portfolio.total_trades,
            "win_rate": f"{self.portfolio.win_rate:.1%}",
            "max_drawdown": f"{self.portfolio.max_drawdown_pct:.1%}",
            "positions": [
                {
                    "symbol": p.symbol,
                    "invested": round(p.sol_invested, 4),
                    "pnl_pct": f"{p.unrealized_pnl_pct:.2%}",
                    "hold_hours": round(
                        (datetime.utcnow() - p.entry_time).total_seconds() / 3600, 1
                    ),
                }
                for p in self.portfolio.open_positions
            ],
        }

    def _save_state(self) -> None:
        """Save paper trading state to disk."""
        self._state_path.parent.mkdir(parents=True, exist_ok=True)
        state = {
            "balance_sol": self.portfolio.balance_sol,
            "total_pnl_sol": self.portfolio.total_pnl_sol,
            "total_invested_sol": self.portfolio.total_invested_sol,
            "total_trades": self.portfolio.total_trades,
            "winning_trades": self.portfolio.winning_trades,
            "losing_trades": self.portfolio.losing_trades,
            "peak_balance_sol": self.portfolio.peak_balance_sol,
            "max_drawdown_pct": self.portfolio.max_drawdown_pct,
            "exit_levels_hit": {
                k: list(v) for k, v in self._exit_levels_hit.items()
            },
            "open_positions": [
                {
                    "id": p.id,
                    "mint_address": p.mint_address,
                    "symbol": p.symbol,
                    "entry_price_sol": p.entry_price_sol,
                    "amount_tokens": p.amount_tokens,
                    "sol_invested": p.sol_invested,
                    "entry_time": p.entry_time.isoformat(),
                    "highest_price_sol": p.highest_price_sol,
                    "confidence_at_entry": p.confidence_at_entry,
                }
                for p in self.portfolio.open_positions
            ],
        }
        try:
            with open(self._state_path, "w") as f:
                json.dump(state, f, indent=2)
            self._last_save = datetime.utcnow()
        except Exception as e:
            logger.error("paper_state_save_error", error=str(e))

    def _load_state(self) -> None:
        """Load paper trading state from disk."""
        if not self._state_path.exists():
            return
        try:
            with open(self._state_path) as f:
                state = json.load(f)

            self.portfolio.balance_sol = state.get("balance_sol", self.portfolio.balance_sol)
            self.portfolio.total_pnl_sol = state.get("total_pnl_sol", 0)
            self.portfolio.total_invested_sol = state.get("total_invested_sol", 0)
            self.portfolio.total_trades = state.get("total_trades", 0)
            self.portfolio.winning_trades = state.get("winning_trades", 0)
            self.portfolio.losing_trades = state.get("losing_trades", 0)
            self.portfolio.peak_balance_sol = state.get("peak_balance_sol",
                                                         self.portfolio.balance_sol)
            self.portfolio.max_drawdown_pct = state.get("max_drawdown_pct", 0)

            # Restore exit levels
            for k, v in state.get("exit_levels_hit", {}).items():
                self._exit_levels_hit[k] = set(v)

            for p_data in state.get("open_positions", []):
                pos = Position(
                    id=p_data["id"],
                    mint_address=p_data["mint_address"],
                    symbol=p_data["symbol"],
                    entry_price_sol=p_data["entry_price_sol"],
                    amount_tokens=p_data["amount_tokens"],
                    sol_invested=p_data["sol_invested"],
                    entry_time=datetime.fromisoformat(p_data["entry_time"]),
                    highest_price_sol=p_data.get("highest_price_sol", p_data["entry_price_sol"]),
                    confidence_at_entry=p_data.get("confidence_at_entry", 0),
                )
                self.portfolio.open_positions.append(pos)

            logger.info("paper_state_loaded",
                        balance=self.portfolio.balance_sol,
                        positions=len(self.portfolio.open_positions),
                        trades=self.portfolio.total_trades)
        except Exception as e:
            logger.error("paper_state_load_error", error=str(e))
