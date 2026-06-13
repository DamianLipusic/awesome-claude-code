"""Tests for data models."""

import pytest
from datetime import datetime, timedelta

from bot.models import (
    TokenInfo, PriceCandle, TradeSignal, Position, TradeRecord,
    PortfolioState, BotMode, TradeSide, TradeStatus,
)


class TestTokenInfo:
    def test_age_hours_with_created_at(self):
        token = TokenInfo(
            mint_address="abc", symbol="TEST", name="Test",
            created_at=datetime.utcnow() - timedelta(hours=5),
        )
        assert 4.9 < token.age_hours < 5.1

    def test_age_hours_without_created_at(self):
        token = TokenInfo(mint_address="abc", symbol="TEST", name="Test")
        assert token.age_hours == float("inf")


class TestPosition:
    def test_unrealized_pnl_positive(self):
        pos = Position(
            id="1", mint_address="abc", symbol="TEST",
            entry_price_sol=1.0, amount_tokens=100,
            sol_invested=1.0, entry_time=datetime.utcnow(),
            current_price_sol=1.5,
        )
        assert pos.unrealized_pnl_pct == pytest.approx(0.5, rel=0.01)
        assert pos.unrealized_pnl_sol == pytest.approx(0.5, rel=0.01)

    def test_unrealized_pnl_negative(self):
        pos = Position(
            id="1", mint_address="abc", symbol="TEST",
            entry_price_sol=1.0, amount_tokens=100,
            sol_invested=1.0, entry_time=datetime.utcnow(),
            current_price_sol=0.8,
        )
        assert pos.unrealized_pnl_pct == pytest.approx(-0.2, rel=0.01)

    def test_unrealized_pnl_zero_price(self):
        pos = Position(
            id="1", mint_address="abc", symbol="TEST",
            entry_price_sol=0, amount_tokens=100,
            sol_invested=1.0, entry_time=datetime.utcnow(),
        )
        assert pos.unrealized_pnl_pct == 0.0
        assert pos.unrealized_pnl_sol == 0.0


class TestPortfolioState:
    def test_win_rate(self):
        portfolio = PortfolioState(
            mode=BotMode.PAPER, balance_sol=10.0,
            total_trades=10, winning_trades=7,
        )
        assert portfolio.win_rate == pytest.approx(0.7)

    def test_win_rate_no_trades(self):
        portfolio = PortfolioState(mode=BotMode.PAPER, balance_sol=10.0)
        assert portfolio.win_rate == 0.0

    def test_current_drawdown(self):
        portfolio = PortfolioState(
            mode=BotMode.PAPER, balance_sol=8.0,
            peak_balance_sol=10.0,
        )
        assert portfolio.current_drawdown_pct == pytest.approx(0.2)

    def test_no_drawdown(self):
        portfolio = PortfolioState(
            mode=BotMode.PAPER, balance_sol=10.0,
            peak_balance_sol=10.0,
        )
        assert portfolio.current_drawdown_pct == 0.0
