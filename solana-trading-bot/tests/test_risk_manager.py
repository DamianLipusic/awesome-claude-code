"""Tests for risk management system."""

import pytest
from datetime import datetime, timedelta

from bot.trading.risk_manager import RiskManager
from bot.models import PortfolioState, TradeSignal, BotMode, TradeSide


def make_config(**overrides):
    config = {
        "risk": {
            "max_daily_loss_pct": 0.10,
            "max_drawdown_pct": 0.25,
            "max_trades_per_hour": 10,
            "cooldown_after_loss_minutes": 15,
            "position_size_method": "kelly",
            "kelly_fraction": 0.25,
        },
        "wallet": {"max_sol_per_trade": 0.5},
    }
    config["risk"].update(overrides)
    return config


def make_portfolio(**kwargs):
    defaults = {
        "mode": BotMode.PAPER,
        "balance_sol": 10.0,
        "peak_balance_sol": 10.0,
    }
    defaults.update(kwargs)
    return PortfolioState(**defaults)


def make_signal(confidence=0.7, predicted_return=0.1):
    return TradeSignal(
        mint_address="abc", symbol="TEST",
        side=TradeSide.BUY, confidence=confidence,
        predicted_return=predicted_return, features={},
    )


class TestCanTrade:
    def test_allows_trading_normally(self):
        rm = RiskManager(make_config())
        can, reason = rm.can_trade(make_portfolio())
        assert can is True
        assert reason == "OK"

    def test_blocks_when_halted(self):
        rm = RiskManager(make_config())
        rm.halt_trading("test halt")
        can, reason = rm.can_trade(make_portfolio())
        assert can is False
        assert "halted" in reason.lower()

    def test_blocks_on_max_drawdown(self):
        rm = RiskManager(make_config())
        portfolio = make_portfolio(balance_sol=7.0, peak_balance_sol=10.0)
        can, reason = rm.can_trade(portfolio)
        assert can is False
        assert "drawdown" in reason.lower()

    def test_blocks_on_daily_loss(self):
        rm = RiskManager(make_config())
        # Simulate losses
        for _ in range(10):
            rm.record_trade_result(-0.15)
        can, reason = rm.can_trade(make_portfolio())
        assert can is False

    def test_blocks_on_trade_rate_limit(self):
        rm = RiskManager(make_config(max_trades_per_hour=3))
        for _ in range(3):
            rm.record_trade_result(0.01)
        can, reason = rm.can_trade(make_portfolio())
        assert can is False
        assert "rate limit" in reason.lower()

    def test_cooldown_after_loss(self):
        rm = RiskManager(make_config())
        rm.record_trade_result(-0.05)
        can, reason = rm.can_trade(make_portfolio())
        assert can is False
        assert "cooldown" in reason.lower()

    def test_loss_streak_halt(self):
        rm = RiskManager(make_config())
        rm._loss_streak = 5
        rm._last_loss_time = None  # Clear cooldown to test streak
        can, reason = rm.can_trade(make_portfolio())
        assert can is False
        assert "streak" in reason.lower()

    def test_resume_trading(self):
        rm = RiskManager(make_config())
        rm.halt_trading("test")
        rm.resume_trading()
        can, _ = rm.can_trade(make_portfolio())
        assert can is True


class TestPositionSizing:
    def test_kelly_sizing(self):
        rm = RiskManager(make_config())
        signal = make_signal(confidence=0.7, predicted_return=0.15)
        size = rm.calculate_position_size(signal, make_portfolio())
        assert 0 < size <= 0.5  # Within max_sol_per_trade

    def test_kelly_low_confidence_returns_zero(self):
        rm = RiskManager(make_config())
        signal = make_signal(confidence=0.4)
        size = rm.calculate_position_size(signal, make_portfolio())
        assert size == 0.0

    def test_fixed_sizing(self):
        rm = RiskManager(make_config(position_size_method="fixed"))
        signal = make_signal()
        size = rm.calculate_position_size(signal, make_portfolio())
        assert size == 0.5  # max_sol_per_trade

    def test_risk_parity_sizing(self):
        rm = RiskManager(make_config(position_size_method="risk_parity"))
        signal = make_signal()
        size = rm.calculate_position_size(signal, make_portfolio())
        assert 0 < size <= 0.5

    def test_size_capped_at_30_pct_balance(self):
        rm = RiskManager(make_config())
        rm.max_sol_per_trade = 100  # Very high limit
        signal = make_signal(confidence=0.95)
        size = rm.calculate_position_size(signal, make_portfolio(balance_sol=1.0))
        assert size <= 0.3  # 30% of 1.0

    def test_no_size_when_no_balance(self):
        rm = RiskManager(make_config())
        signal = make_signal()
        size = rm.calculate_position_size(signal, make_portfolio(balance_sol=0))
        assert size == 0.0

    def test_loss_streak_reduces_size(self):
        rm = RiskManager(make_config())
        signal = make_signal(confidence=0.7, predicted_return=0.15)
        normal_size = rm.calculate_position_size(signal, make_portfolio())

        rm._loss_streak = 4
        reduced_size = rm.calculate_position_size(signal, make_portfolio())
        assert reduced_size < normal_size


class TestStreakTracking:
    def test_win_streak(self):
        rm = RiskManager(make_config())
        for _ in range(3):
            rm.record_trade_result(0.1)
        assert rm._win_streak == 3
        assert rm._loss_streak == 0

    def test_loss_streak_resets_on_win(self):
        rm = RiskManager(make_config())
        rm.record_trade_result(-0.1)
        rm.record_trade_result(-0.1)
        assert rm._loss_streak == 2
        rm._last_loss_time = None  # bypass cooldown for test
        rm.record_trade_result(0.1)
        assert rm._loss_streak == 0
        assert rm._win_streak == 1

    def test_max_loss_streak_tracked(self):
        rm = RiskManager(make_config())
        for _ in range(4):
            rm.record_trade_result(-0.01)
        rm._last_loss_time = None
        rm.record_trade_result(0.1)
        for _ in range(2):
            rm.record_trade_result(-0.01)
        assert rm._max_loss_streak == 4

    def test_risk_status(self):
        rm = RiskManager(make_config())
        status = rm.get_risk_status(make_portfolio())
        assert "can_trade" in status
        assert "loss_streak" in status
        assert "historical_win_rate" in status
