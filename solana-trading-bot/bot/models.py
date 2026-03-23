"""Data models for the trading bot."""

from __future__ import annotations

import enum
from dataclasses import dataclass, field
from datetime import datetime


class TradeSide(str, enum.Enum):
    BUY = "buy"
    SELL = "sell"


class TradeStatus(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class BotMode(str, enum.Enum):
    PAPER = "paper"
    LIVE = "live"
    BACKTEST = "backtest"


@dataclass
class TokenInfo:
    """Information about a Solana token."""
    mint_address: str
    symbol: str
    name: str
    decimals: int = 9
    liquidity_usd: float = 0.0
    volume_24h_usd: float = 0.0
    holder_count: int = 0
    price_usd: float = 0.0
    price_sol: float = 0.0
    market_cap_usd: float = 0.0
    created_at: datetime | None = None
    pool_address: str = ""
    source: str = ""  # jupiter, raydium, pump_fun

    @property
    def age_hours(self) -> float:
        if self.created_at is None:
            return float("inf")
        return (datetime.utcnow() - self.created_at).total_seconds() / 3600


@dataclass
class PriceCandle:
    """OHLCV price candle."""
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float
    mint_address: str = ""


@dataclass
class TradeSignal:
    """ML model output - trade signal."""
    mint_address: str
    symbol: str
    side: TradeSide
    confidence: float  # 0.0 to 1.0
    predicted_return: float
    features: dict = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Position:
    """An open trading position."""
    id: str
    mint_address: str
    symbol: str
    entry_price_sol: float
    amount_tokens: float
    sol_invested: float
    entry_time: datetime
    status: TradeStatus = TradeStatus.OPEN
    current_price_sol: float = 0.0
    highest_price_sol: float = 0.0
    exit_price_sol: float = 0.0
    exit_time: datetime | None = None
    pnl_sol: float = 0.0
    pnl_pct: float = 0.0
    exit_reason: str = ""
    confidence_at_entry: float = 0.0

    @property
    def unrealized_pnl_sol(self) -> float:
        if self.current_price_sol <= 0 or self.entry_price_sol <= 0:
            return 0.0
        return (self.current_price_sol - self.entry_price_sol) / self.entry_price_sol * self.sol_invested

    @property
    def unrealized_pnl_pct(self) -> float:
        if self.entry_price_sol <= 0:
            return 0.0
        return (self.current_price_sol - self.entry_price_sol) / self.entry_price_sol


@dataclass
class TradeRecord:
    """Completed trade record for ML training."""
    id: str
    mint_address: str
    symbol: str
    side: TradeSide
    entry_price: float
    exit_price: float
    amount: float
    sol_invested: float
    pnl_sol: float
    pnl_pct: float
    entry_time: datetime
    exit_time: datetime
    hold_duration_minutes: float
    exit_reason: str
    confidence_at_entry: float
    features_at_entry: dict = field(default_factory=dict)
    was_profitable: bool = False


@dataclass
class PortfolioState:
    """Current portfolio state."""
    mode: BotMode
    balance_sol: float
    total_invested_sol: float = 0.0
    total_pnl_sol: float = 0.0
    open_positions: list[Position] = field(default_factory=list)
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    max_drawdown_pct: float = 0.0
    peak_balance_sol: float = 0.0
    daily_pnl_sol: float = 0.0

    @property
    def win_rate(self) -> float:
        if self.total_trades == 0:
            return 0.0
        return self.winning_trades / self.total_trades

    @property
    def current_drawdown_pct(self) -> float:
        if self.peak_balance_sol <= 0:
            return 0.0
        return (self.peak_balance_sol - self.balance_sol) / self.peak_balance_sol
