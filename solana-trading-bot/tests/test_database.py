"""Tests for database operations."""

import pytest
from datetime import datetime

from bot.database import Database
from bot.models import PriceCandle, Position, TradeRecord, TradeSide


@pytest.fixture
def db():
    database = Database(":memory:")
    database.connect()
    yield database
    database.close()


class TestPriceCandles:
    def test_save_and_get_candle(self, db):
        candle = PriceCandle(
            timestamp=datetime(2024, 1, 1, 12, 0),
            open=1.0, high=1.5, low=0.9, close=1.2,
            volume=1000, mint_address="abc",
        )
        db.save_candle(candle)
        candles = db.get_candles("abc")
        assert len(candles) == 1
        assert candles[0].close == 1.2

    def test_batch_save_candles(self, db):
        candles = [
            PriceCandle(
                timestamp=datetime(2024, 1, 1, i, 0),
                open=1.0, high=1.5, low=0.9, close=1.0 + i * 0.1,
                volume=1000, mint_address="abc",
            )
            for i in range(10)
        ]
        db.save_candles_batch(candles)
        result = db.get_candles("abc")
        assert len(result) == 10

    def test_candle_dedup(self, db):
        candle = PriceCandle(
            timestamp=datetime(2024, 1, 1, 12, 0),
            open=1.0, high=1.5, low=0.9, close=1.2,
            volume=1000, mint_address="abc",
        )
        db.save_candle(candle)
        candle.close = 1.5  # Updated value
        db.save_candle(candle)
        candles = db.get_candles("abc")
        assert len(candles) == 1
        assert candles[0].close == 1.5


class TestTrades:
    def test_save_and_get_trade(self, db):
        trade = TradeRecord(
            id="t1", mint_address="abc", symbol="TEST",
            side=TradeSide.SELL, entry_price=1.0, exit_price=1.5,
            amount=100, sol_invested=1.0, pnl_sol=0.5, pnl_pct=0.5,
            entry_time=datetime(2024, 1, 1, 10, 0),
            exit_time=datetime(2024, 1, 1, 12, 0),
            hold_duration_minutes=120, exit_reason="take_profit",
            confidence_at_entry=0.7, was_profitable=True,
        )
        db.save_trade(trade)
        trades = db.get_completed_trades()
        assert len(trades) == 1
        assert trades[0].pnl_sol == 0.5

    def test_save_open_position(self, db):
        pos = Position(
            id="p1", mint_address="abc", symbol="TEST",
            entry_price_sol=1.0, amount_tokens=100,
            sol_invested=1.0, entry_time=datetime(2024, 1, 1),
        )
        db.save_open_position(pos)
        # Open positions shouldn't appear in completed trades
        trades = db.get_completed_trades()
        assert len(trades) == 0

    def test_trade_stats(self, db):
        for i in range(5):
            trade = TradeRecord(
                id=f"t{i}", mint_address="abc", symbol="TEST",
                side=TradeSide.SELL, entry_price=1.0,
                exit_price=1.1 if i < 3 else 0.9,
                amount=100, sol_invested=1.0,
                pnl_sol=0.1 if i < 3 else -0.1,
                pnl_pct=0.1 if i < 3 else -0.1,
                entry_time=datetime(2024, 1, 1, i, 0),
                exit_time=datetime(2024, 1, 1, i + 1, 0),
                hold_duration_minutes=60, exit_reason="tp",
                confidence_at_entry=0.7,
                was_profitable=i < 3,
            )
            db.save_trade(trade)
        stats = db.get_trade_stats()
        assert stats["total"] == 5
        assert stats["wins"] == 3


class TestTrainingData:
    def test_save_and_get_training(self, db):
        db.save_training_sample("abc", {"rsi": 45}, 1.0, "profitable")
        data = db.get_training_data("profitable")
        assert len(data) == 1
        assert data[0]["features"]["rsi"] == 45

    def test_training_data_count(self, db):
        for i in range(10):
            db.save_training_sample("abc", {"rsi": i}, 1.0, "profitable")
        assert db.get_training_data_count("profitable") == 10


class TestMaintenance:
    def test_cleanup_old_data(self, db):
        # Add old and new candles
        db.save_candle(PriceCandle(
            timestamp=datetime(2020, 1, 1), open=1, high=1, low=1,
            close=1, volume=1, mint_address="old",
        ))
        db.save_candle(PriceCandle(
            timestamp=datetime.utcnow(), open=1, high=1, low=1,
            close=1, volume=1, mint_address="new",
        ))
        db.cleanup_old_data(days=30)
        candles = db.get_candles("old")
        assert len(candles) == 0
        candles = db.get_candles("new")
        assert len(candles) == 1

    def test_db_stats(self, db):
        stats = db.get_db_stats()
        assert "price_candles" in stats
        assert "trades" in stats

    def test_portfolio_history(self, db):
        db.save_portfolio_snapshot(10.0, 2.0, 0.5, 2, 5, 0.6)
        history = db.get_portfolio_history(days=1)
        assert len(history) == 1
