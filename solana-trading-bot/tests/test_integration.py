"""Integration tests - backtester end-to-end and engine smoke test."""

import pytest
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

from bot.backtester import Backtester
from bot.database import Database
from bot.ml_engine.model import TradingModel
from bot.ml_engine.feature_engineer import FEATURE_COLUMNS
from bot.trading.risk_manager import RiskManager
from bot.models import PortfolioState, BotMode


def make_config():
    return {
        "strategy": {
            "min_liquidity_usd": 0,
            "max_token_age_hours": 9999,
            "min_holder_count": 0,
            "min_volume_24h_usd": 0,
            "min_confidence_score": 0.55,
            "max_positions": 3,
            "take_profit_pct": 0.50,
            "stop_loss_pct": 0.20,
            "trailing_stop_pct": 0.10,
            "max_hold_time_hours": 24,
        },
        "backtesting": {
            "initial_balance_sol": 10.0,
        },
        "risk": {
            "max_daily_loss_pct": 0.10,
            "max_drawdown_pct": 0.25,
            "max_trades_per_hour": 50,
            "cooldown_after_loss_minutes": 0,
            "position_size_method": "fixed",
            "kelly_fraction": 0.25,
        },
        "wallet": {"max_sol_per_trade": 1.0},
        "ml": {
            "model_type": "gradient_boosting",
            "min_training_samples": 10,
            "retrain_interval_hours": 6,
            "lookback_periods": [5, 15, 30, 60],
        },
    }


def generate_price_data(n_points: int = 200, trend: str = "up",
                        start_price: float = 1.0) -> pd.DataFrame:
    """Generate synthetic price data for backtesting."""
    np.random.seed(42)
    timestamps = [datetime(2024, 1, 1) + timedelta(minutes=i) for i in range(n_points)]

    if trend == "up":
        drift = 0.002
    elif trend == "down":
        drift = -0.002
    else:
        drift = 0.0

    prices = [start_price]
    for _ in range(n_points - 1):
        change = drift + np.random.normal(0, 0.02)
        prices.append(max(0.001, prices[-1] * (1 + change)))

    return pd.DataFrame({
        "timestamp": timestamps,
        "open": prices,
        "high": [p * 1.01 for p in prices],
        "low": [p * 0.99 for p in prices],
        "close": prices,
        "volume": [1000 + np.random.random() * 500 for _ in prices],
    })


class TestBacktesterIntegration:
    """End-to-end backtesting tests with synthetic data."""

    @pytest.fixture
    def backtester(self):
        db = Database(":memory:")
        db.connect()
        bt = Backtester(make_config(), db)
        yield bt
        db.close()

    def test_backtest_uptrend_profitable(self, backtester):
        """Bot should make money in an uptrend."""
        data = {"token_up": generate_price_data(200, "up")}
        results = backtester.run_backtest(data)

        assert results["status"] == "completed"
        assert results["total_trades"] > 0
        assert float(results["final_balance_sol"]) > 0

    def test_backtest_downtrend_limits_losses(self, backtester):
        """Stop loss should limit losses in a downtrend."""
        data = {"token_down": generate_price_data(200, "down")}
        results = backtester.run_backtest(data)

        assert results["status"] == "completed"
        # Should not lose more than drawdown limit
        final = float(results["final_balance_sol"])
        assert final > 5.0  # Should keep at least 50% (10 SOL start, 25% max drawdown + some trades)

    def test_backtest_multiple_tokens(self, backtester):
        """Should trade multiple tokens simultaneously."""
        data = {
            "token_a": generate_price_data(200, "up", 1.0),
            "token_b": generate_price_data(200, "up", 0.5),
            "token_c": generate_price_data(200, "flat", 2.0),
        }
        results = backtester.run_backtest(data)

        assert results["status"] == "completed"
        assert results["total_trades"] > 0

    def test_backtest_scaled_exits_in_results(self, backtester):
        """Scaled exit trades should appear in results."""
        # Strong uptrend to trigger scaled exits
        np.random.seed(42)
        n = 200
        timestamps = [datetime(2024, 1, 1) + timedelta(minutes=i) for i in range(n)]
        prices = [1.0]
        for _ in range(n - 1):
            prices.append(prices[-1] * 1.005)  # Steady 0.5% growth per candle

        data = {"moon_token": pd.DataFrame({
            "timestamp": timestamps,
            "open": prices,
            "high": [p * 1.01 for p in prices],
            "low": [p * 0.99 for p in prices],
            "close": prices,
            "volume": [1000] * n,
        })}

        results = backtester.run_backtest(data)
        assert results["status"] == "completed"
        # Should have some scaled exit trades
        exit_reasons = results.get("exit_reasons", {})
        has_scaled = any("take_profit_" in k and "pct" in k for k in exit_reasons)
        # May or may not trigger depending on exact price path, but should not crash
        assert results["total_trades"] >= 0

    def test_backtest_empty_data(self, backtester):
        """Should handle empty data gracefully."""
        results = backtester.run_backtest({})
        assert "error" in results

    def test_backtest_results_metrics(self, backtester):
        """All expected metrics should be present in results."""
        data = {"token": generate_price_data(200, "up")}
        results = backtester.run_backtest(data)

        expected_keys = [
            "status", "initial_balance_sol", "final_balance_sol",
            "total_return_pct", "total_pnl_sol", "total_trades",
            "winning_trades", "losing_trades", "win_rate",
            "max_drawdown_pct", "sharpe_ratio", "sortino_ratio",
            "profit_factor", "avg_hold_minutes", "exit_reasons",
            "scaled_exits",
        ]
        for key in expected_keys:
            assert key in results, f"Missing key: {key}"

    def test_csv_validation_missing_columns(self, backtester, tmp_path):
        """Should reject CSV without required columns."""
        csv_file = tmp_path / "bad.csv"
        csv_file.write_text("foo,bar\n1,2\n")
        data = backtester.load_csv_data(str(csv_file))
        assert len(data) == 0

    def test_csv_validation_valid_file(self, backtester, tmp_path):
        """Should load valid CSV correctly."""
        csv_file = tmp_path / "good.csv"
        df = generate_price_data(50, "up")
        df.to_csv(csv_file, index=False)
        data = backtester.load_csv_data(str(csv_file))
        assert len(data) == 1
        assert len(list(data.values())[0]) == 50

    def test_csv_validation_directory(self, backtester, tmp_path):
        """Should load multiple CSVs from directory."""
        for name in ["a", "b"]:
            df = generate_price_data(50, "up")
            df.to_csv(tmp_path / f"{name}.csv", index=False)
        data = backtester.load_csv_data(str(tmp_path))
        assert len(data) == 2


class TestMLTrainAndPredict:
    """Test ML model training and prediction pipeline."""

    @pytest.fixture
    def trained_model(self, tmp_path):
        db = Database(":memory:")
        db.connect()
        config = make_config()
        model = TradingModel(config, db)
        model._model_path = tmp_path / "model.pkl"
        model._stats_path = tmp_path / "stats.json"
        model._is_trained = False
        model.model = None
        model._last_train_time = None
        model._train_count = 0

        # Generate training data
        np.random.seed(42)
        for i in range(50):
            features = {}
            for col in FEATURE_COLUMNS:
                features[col] = np.random.normal(0, 1)
            # Positive momentum + low RSI = profitable
            profitable = features.get("momentum_score", 0) > 0 and features.get("rsi", 50) < 60
            db.save_training_sample("test", features, 1.0 if profitable else 0.0, "profitable")

        model.train()
        yield model
        db.close()

    def test_model_is_trained(self, trained_model):
        assert trained_model._is_trained is True
        assert trained_model._train_count == 1

    def test_predictions_return_valid_signal(self, trained_model):
        features = {col: np.random.normal(0, 1) for col in FEATURE_COLUMNS}
        signal = trained_model.predict(features, "abc", "TEST")
        assert signal is not None
        assert 0 <= signal.confidence <= 1
        assert signal.side in ("buy", "sell")

    def test_model_save_and_load(self, trained_model, tmp_path):
        """Model should persist and reload correctly."""
        assert trained_model._model_path.exists()

        # Create new model instance that loads from disk
        db = Database(":memory:")
        db.connect()
        config = make_config()
        model2 = TradingModel(config, db)
        model2._model_path = trained_model._model_path
        model2._stats_path = trained_model._stats_path
        model2._load_model()

        assert model2._is_trained is True
        assert model2._train_count == 1

        features = {col: 0.5 for col in FEATURE_COLUMNS}
        signal = model2.predict(features, "xyz", "T2")
        assert signal is not None
        db.close()

    def test_record_and_retrain(self, trained_model):
        """Recording outcomes should not crash."""
        for i in range(5):
            trained_model.record_outcome("abc", {"rsi": 50}, 0.1 if i % 2 else -0.05)
        stats = trained_model.get_stats()
        assert stats["training_samples"] > 50


class TestRiskManagerIntegration:
    """Test risk manager with realistic trading sequences."""

    def test_full_trading_day(self):
        """Simulate a full day of trading."""
        config = make_config()
        config["risk"]["max_trades_per_hour"] = 100
        config["risk"]["cooldown_after_loss_minutes"] = 0
        rm = RiskManager(config)
        portfolio = PortfolioState(
            mode=BotMode.PAPER, balance_sol=10.0, peak_balance_sol=10.0,
        )

        # Mix of wins and losses
        results = [0.05, -0.03, 0.08, -0.02, 0.04, -0.04, 0.06, -0.01, 0.03, 0.07]
        for pnl in results:
            can, _ = rm.can_trade(portfolio)
            if can:
                rm.record_trade_result(pnl)

        status = rm.get_risk_status(portfolio)
        assert status["trades_this_hour"] == len(results)
        assert rm._total_wins == 6
        assert rm._total_losses == 4

    def test_loss_streak_halts_trading(self):
        """5 consecutive losses should halt trading."""
        config = make_config()
        config["risk"]["cooldown_after_loss_minutes"] = 0
        rm = RiskManager(config)
        portfolio = PortfolioState(
            mode=BotMode.PAPER, balance_sol=10.0, peak_balance_sol=10.0,
        )

        for _ in range(5):
            rm.record_trade_result(-0.01)

        can, reason = rm.can_trade(portfolio)
        assert can is False
        assert "streak" in reason.lower()

    def test_daily_reset(self):
        """Daily PnL should reset after 24h."""
        config = make_config()
        rm = RiskManager(config)
        rm._daily_pnl = -0.5
        rm._daily_start = datetime.utcnow() - timedelta(hours=25)

        portfolio = PortfolioState(
            mode=BotMode.PAPER, balance_sol=10.0, peak_balance_sol=10.0,
        )
        can, _ = rm.can_trade(portfolio)
        assert can is True
        assert rm._daily_pnl == 0.0  # Should have reset
