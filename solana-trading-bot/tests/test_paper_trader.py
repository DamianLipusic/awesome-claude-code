"""Tests for paper trading engine."""

import pytest
from datetime import datetime, timedelta

from bot.trading.paper_trader import PaperTrader
from bot.database import Database
from bot.models import TradeSignal, TradeSide


def make_config():
    return {
        "paper_trading": {
            "initial_balance_sol": 10.0,
            "slippage_simulation": 0.02,
            "fee_simulation": 0.003,
            "save_interval_seconds": 9999,
        },
        "strategy": {
            "take_profit_pct": 0.50,
            "stop_loss_pct": 0.20,
            "trailing_stop_pct": 0.10,
            "max_hold_time_hours": 24,
            "max_positions": 5,
        },
    }


def make_signal(mint="abc", symbol="TEST", price=0.001, confidence=0.7):
    return TradeSignal(
        mint_address=mint, symbol=symbol,
        side=TradeSide.BUY, confidence=confidence,
        predicted_return=0.1,
        features={"current_price": price},
    )


@pytest.fixture
def trader():
    db = Database(":memory:")
    db.connect()
    t = PaperTrader(make_config(), db)
    t._state_path = t._state_path.parent / "test_state.json"  # Avoid conflicts
    yield t
    db.close()


class TestBuy:
    def test_successful_buy(self, trader):
        pos = trader.execute_buy(make_signal(), 1.0)
        assert pos is not None
        assert pos.symbol == "TEST"
        assert pos.sol_invested == 1.0
        assert trader.portfolio.balance_sol < 10.0

    def test_buy_reduces_balance(self, trader):
        trader.execute_buy(make_signal(), 2.0)
        assert trader.portfolio.balance_sol == pytest.approx(8.0, rel=0.01)

    def test_buy_with_insufficient_balance(self, trader):
        trader.portfolio.balance_sol = 0.0005
        pos = trader.execute_buy(make_signal(), 1.0)
        assert pos is None

    def test_max_positions_enforced(self, trader):
        for i in range(5):
            trader.execute_buy(make_signal(mint=f"token_{i}", price=0.001), 0.5)
        pos = trader.execute_buy(make_signal(mint="token_6"), 0.5)
        assert pos is None

    def test_buy_with_zero_price_fails(self, trader):
        signal = make_signal(price=0)
        pos = trader.execute_buy(signal, 1.0)
        assert pos is None


class TestSell:
    def test_successful_sell(self, trader):
        pos = trader.execute_buy(make_signal(price=0.001), 1.0)
        trade = trader.execute_sell(pos, 0.0015, reason="take_profit")
        assert trade is not None
        assert trade.was_profitable is True
        assert trade.exit_reason == "take_profit"

    def test_losing_sell(self, trader):
        pos = trader.execute_buy(make_signal(price=0.001), 1.0)
        trade = trader.execute_sell(pos, 0.0005, reason="stop_loss")
        assert trade is not None
        assert trade.was_profitable is False

    def test_partial_sell(self, trader):
        pos = trader.execute_buy(make_signal(price=0.001), 1.0)
        original_tokens = pos.amount_tokens
        trade = trader.execute_sell(pos, 0.0015, reason="partial", sell_fraction=0.5)
        assert trade is not None
        assert pos.amount_tokens == pytest.approx(original_tokens * 0.5, rel=0.01)
        assert len(trader.portfolio.open_positions) == 1  # Still open

    def test_sell_zero_price_fails(self, trader):
        pos = trader.execute_buy(make_signal(price=0.001), 1.0)
        trade = trader.execute_sell(pos, 0)
        assert trade is None


class TestExits:
    def test_stop_loss_triggered(self, trader):
        pos = trader.execute_buy(make_signal(price=0.001), 1.0)
        prices = {pos.mint_address: 0.0007}  # -30% drop
        closed = trader.check_exits(prices)
        assert len(closed) == 1
        assert closed[0].exit_reason == "stop_loss"

    def test_max_hold_time_triggered(self, trader):
        pos = trader.execute_buy(make_signal(price=0.001), 1.0)
        pos.entry_time = datetime.utcnow() - timedelta(hours=25)
        prices = {pos.mint_address: 0.001}
        closed = trader.check_exits(prices)
        assert len(closed) == 1
        assert closed[0].exit_reason == "max_hold_time"

    def test_trailing_stop_triggered(self, trader):
        pos = trader.execute_buy(make_signal(price=0.001), 1.0)
        # Simulate price going up then down
        pos.highest_price_sol = 0.0015  # 50% up from entry
        prices = {pos.mint_address: 0.00125}  # 17% drop from high
        closed = trader.check_exits(prices)
        assert len(closed) >= 1
        reasons = [t.exit_reason for t in closed]
        assert any("trailing_stop" in r for r in reasons)

    def test_no_exit_when_price_stable(self, trader):
        pos = trader.execute_buy(make_signal(price=0.001), 1.0)
        prices = {pos.mint_address: 0.001}
        closed = trader.check_exits(prices)
        assert len(closed) == 0


class TestPortfolio:
    def test_portfolio_summary(self, trader):
        summary = trader.get_portfolio_summary()
        assert summary["mode"] == "PAPER"
        assert summary["balance_sol"] == 10.0
        assert summary["open_positions"] == 0

    def test_win_rate_tracking(self, trader):
        # Make a winning trade
        pos = trader.execute_buy(make_signal(price=0.001), 1.0)
        trader.execute_sell(pos, 0.002, "tp")
        # Make a losing trade
        pos2 = trader.execute_buy(make_signal(mint="xyz", price=0.001), 1.0)
        trader.execute_sell(pos2, 0.0005, "sl")
        assert trader.portfolio.total_trades == 2
        assert trader.portfolio.win_rate == 0.5
