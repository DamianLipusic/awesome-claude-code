"""Risk management system with streak tracking and volatility-adjusted sizing."""

from __future__ import annotations

import math
from datetime import datetime, timedelta

import structlog

from bot.models import PortfolioState, TradeSignal

logger = structlog.get_logger()


class RiskManager:
    """Manages trading risk, position sizing, and trading limits."""

    def __init__(self, config: dict):
        risk_config = config.get("risk", {})
        self.max_daily_loss_pct = risk_config.get("max_daily_loss_pct", 0.10)
        self.max_drawdown_pct = risk_config.get("max_drawdown_pct", 0.25)
        self.max_trades_per_hour = risk_config.get("max_trades_per_hour", 10)
        self.cooldown_minutes = risk_config.get("cooldown_after_loss_minutes", 15)
        self.position_size_method = risk_config.get("position_size_method", "kelly")
        self.kelly_fraction = risk_config.get("kelly_fraction", 0.25)

        wallet_config = config.get("wallet", {})
        self.max_sol_per_trade = wallet_config.get("max_sol_per_trade", 0.1)

        # Tracking
        self._trade_timestamps: list[datetime] = []
        self._last_loss_time: datetime | None = None
        self._daily_pnl: float = 0.0
        self._daily_start: datetime = datetime.utcnow()
        self._is_halted: bool = False
        self._halt_reason: str = ""

        # Streak tracking
        self._win_streak: int = 0
        self._loss_streak: int = 0
        self._max_loss_streak: int = 0
        self._recent_pnls: list[float] = []  # Last 20 trade PnLs

        # Trade history for sizing adjustments
        self._total_wins: int = 0
        self._total_losses: int = 0

    def can_trade(self, portfolio: PortfolioState) -> tuple[bool, str]:
        """Check if trading is allowed based on risk rules."""
        if self._is_halted:
            return False, f"Trading halted: {self._halt_reason}"

        # Reset daily tracking
        if (datetime.utcnow() - self._daily_start).total_seconds() > 86400:
            self._daily_pnl = 0.0
            self._daily_start = datetime.utcnow()

        # Check daily loss limit
        if portfolio.peak_balance_sol > 0:
            daily_loss_pct = abs(min(0, self._daily_pnl)) / portfolio.peak_balance_sol
            if daily_loss_pct >= self.max_daily_loss_pct:
                return False, f"Daily loss limit reached ({daily_loss_pct:.1%})"

        # Check max drawdown
        if portfolio.current_drawdown_pct >= self.max_drawdown_pct:
            return False, f"Max drawdown reached ({portfolio.current_drawdown_pct:.1%})"

        # Check trade rate limit
        now = datetime.utcnow()
        recent = [t for t in self._trade_timestamps
                  if (now - t).total_seconds() < 3600]
        self._trade_timestamps = recent
        if len(recent) >= self.max_trades_per_hour:
            return False, f"Trade rate limit ({self.max_trades_per_hour}/hour)"

        # Check cooldown after loss
        if self._last_loss_time:
            # Extend cooldown during losing streaks
            cooldown = self.cooldown_minutes * (1 + min(self._loss_streak, 3) * 0.5)
            cooldown_end = self._last_loss_time + timedelta(minutes=cooldown)
            if now < cooldown_end:
                remaining = (cooldown_end - now).total_seconds() / 60
                return False, f"Loss cooldown ({remaining:.0f}min, streak: {self._loss_streak})"

        # Emergency brake: 5+ consecutive losses
        if self._loss_streak >= 5:
            return False, f"Loss streak halt ({self._loss_streak} losses, waiting for manual review)"

        return True, "OK"

    def calculate_position_size(self, signal: TradeSignal,
                                 portfolio: PortfolioState) -> float:
        """Calculate optimal position size with streak and volatility adjustments."""
        available = portfolio.balance_sol
        if available <= 0:
            return 0.0

        if self.position_size_method == "kelly":
            size = self._kelly_size(signal, available)
        elif self.position_size_method == "risk_parity":
            size = self._risk_parity_size(signal, portfolio)
        else:  # fixed
            size = self.max_sol_per_trade

        # Apply hard limits
        size = min(size, self.max_sol_per_trade)
        size = min(size, available * 0.3)  # Never more than 30% of balance

        # Streak-based adjustment
        size = self._adjust_for_streak(size)

        # Volatility adjustment from features
        volatility = signal.features.get("price_volatility", 0)
        if volatility > 0.1:
            # Reduce size for high-volatility tokens
            vol_factor = max(0.3, 1.0 - (volatility - 0.05) * 2)
            size *= vol_factor

        size = max(size, 0.0)
        return round(size, 4)

    def _kelly_size(self, signal: TradeSignal, available: float) -> float:
        """Kelly criterion position sizing with historical win rate."""
        p = signal.confidence
        if p <= 0.5:
            return 0.0

        # Use historical win rate if available
        total = self._total_wins + self._total_losses
        if total >= 20:
            historical_wr = self._total_wins / total
            # Blend ML confidence with historical performance
            p = 0.6 * p + 0.4 * historical_wr

        # Win/loss ratio from predicted return
        b = abs(signal.predicted_return) / 0.20 if signal.predicted_return > 0 else 1.0
        b = max(b, 0.5)

        # Kelly formula
        q = 1 - p
        kelly = (b * p - q) / b

        # Apply fractional Kelly
        kelly *= self.kelly_fraction

        return max(0, kelly * available)

    def _risk_parity_size(self, signal: TradeSignal,
                           portfolio: PortfolioState) -> float:
        """Risk parity position sizing."""
        n_positions = len(portfolio.open_positions) + 1
        equal_share = portfolio.balance_sol / max(n_positions, 1)

        confidence_adj = signal.confidence / 0.7
        return equal_share * min(confidence_adj, 1.5)

    def _adjust_for_streak(self, size: float) -> float:
        """Reduce position size during losing streaks, increase during winning."""
        if self._loss_streak >= 3:
            # Reduce by 20% per loss after 3rd
            reduction = 0.2 * (self._loss_streak - 2)
            size *= max(0.2, 1.0 - reduction)
        elif self._win_streak >= 3:
            # Slight increase during winning streak (max 30% boost)
            boost = min(0.3, 0.1 * (self._win_streak - 2))
            size *= (1.0 + boost)
        return size

    def record_trade_result(self, pnl_sol: float) -> None:
        """Record a trade result for risk tracking."""
        self._trade_timestamps.append(datetime.utcnow())
        self._daily_pnl += pnl_sol

        # Update recent PnLs
        self._recent_pnls.append(pnl_sol)
        if len(self._recent_pnls) > 20:
            self._recent_pnls = self._recent_pnls[-20:]

        if pnl_sol < 0:
            self._last_loss_time = datetime.utcnow()
            self._loss_streak += 1
            self._win_streak = 0
            self._total_losses += 1
            self._max_loss_streak = max(self._max_loss_streak, self._loss_streak)
        else:
            self._win_streak += 1
            self._loss_streak = 0
            self._total_wins += 1

        logger.debug("risk_update",
                      daily_pnl=f"{self._daily_pnl:+.4f}",
                      win_streak=self._win_streak,
                      loss_streak=self._loss_streak)

    def halt_trading(self, reason: str) -> None:
        """Emergency halt all trading."""
        self._is_halted = True
        self._halt_reason = reason
        logger.warning("trading_halted", reason=reason)

    def resume_trading(self) -> None:
        """Resume trading after halt."""
        self._is_halted = False
        self._halt_reason = ""
        self._loss_streak = 0  # Reset streak on manual resume
        logger.info("trading_resumed")

    def get_risk_status(self, portfolio: PortfolioState) -> dict:
        """Get current risk status."""
        can, reason = self.can_trade(portfolio)

        avg_pnl = sum(self._recent_pnls) / len(self._recent_pnls) if self._recent_pnls else 0
        total = self._total_wins + self._total_losses
        win_rate = self._total_wins / total if total > 0 else 0

        return {
            "can_trade": can,
            "reason": reason,
            "daily_pnl_sol": round(self._daily_pnl, 4),
            "trades_this_hour": len(self._trade_timestamps),
            "max_trades_per_hour": self.max_trades_per_hour,
            "current_drawdown": f"{portfolio.current_drawdown_pct:.1%}",
            "max_drawdown_limit": f"{self.max_drawdown_pct:.0%}",
            "win_streak": self._win_streak,
            "loss_streak": self._loss_streak,
            "max_loss_streak": self._max_loss_streak,
            "historical_win_rate": f"{win_rate:.1%}",
            "avg_recent_pnl": f"{avg_pnl:+.4f} SOL",
            "is_halted": self._is_halted,
        }
