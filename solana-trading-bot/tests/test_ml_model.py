"""Tests for ML model and feature engineering."""

import pytest
import numpy as np

from bot.ml_engine.feature_engineer import FeatureEngineer, FEATURE_COLUMNS
from bot.ml_engine.model import TradingModel
from bot.database import Database


class TestFeatureEngineer:
    def test_raw_features_to_vector(self):
        fe = FeatureEngineer()
        features = {col: 0.5 for col in FEATURE_COLUMNS}
        vector = fe.raw_features_to_vector(features)
        assert len(vector) == len(FEATURE_COLUMNS)
        assert all(np.isfinite(vector))

    def test_missing_features_default_to_zero(self):
        fe = FeatureEngineer()
        vector = fe.raw_features_to_vector({"rsi": 50})
        assert len(vector) == len(FEATURE_COLUMNS)

    def test_nan_inf_handled(self):
        fe = FeatureEngineer()
        features = {"rsi": float("nan"), "macd_signal": float("inf")}
        vector = fe.raw_features_to_vector(features)
        assert all(np.isfinite(vector))

    def test_features_dict_to_df(self):
        fe = FeatureEngineer()
        samples = [
            {"features": {col: np.random.random() for col in FEATURE_COLUMNS}, "label": 1.0}
            for _ in range(20)
        ]
        df, labels = fe.features_dict_to_df(samples)
        assert df.shape == (20, len(FEATURE_COLUMNS))
        assert len(labels) == 20
        assert all(np.isfinite(df.values.flatten()))

    def test_normalization_stats_stored(self):
        fe = FeatureEngineer()
        samples = [
            {"features": {col: np.random.random() for col in FEATURE_COLUMNS}, "label": 1.0}
            for _ in range(10)
        ]
        fe.features_dict_to_df(samples)
        assert len(fe._feature_stats) == len(FEATURE_COLUMNS)
        for col, stats in fe._feature_stats.items():
            assert "mean" in stats
            assert "std" in stats

    def test_values_clipped(self):
        fe = FeatureEngineer()
        features = {col: 1000.0 for col in FEATURE_COLUMNS}  # Extreme values
        # First set some stats
        fe._feature_stats = {col: {"mean": 0.0, "std": 1.0} for col in FEATURE_COLUMNS}
        vector = fe._normalize(np.array([1000.0] * len(FEATURE_COLUMNS)))
        assert all(v <= 5.0 for v in vector)


class TestTradingModel:
    @pytest.fixture
    def model(self, tmp_path):
        db = Database(":memory:")
        db.connect()
        config = {
            "ml": {
                "model_type": "gradient_boosting",
                "min_training_samples": 10,
                "retrain_interval_hours": 6,
            }
        }
        m = TradingModel(config, db)
        # Use temp paths to avoid cross-test contamination
        m._model_path = tmp_path / "model.pkl"
        m._stats_path = tmp_path / "model_stats.json"
        m._is_trained = False
        m.model = None
        m._last_train_time = None
        m._train_count = 0
        yield m
        db.close()

    def test_heuristic_signal_positive_momentum(self, model):
        features = {"momentum_score": 0.1, "rsi": 45, "buy_sell_ratio": 0.7}
        signal = model._heuristic_signal(features, "abc", "TEST")
        assert signal is not None
        assert signal.confidence > 0.5

    def test_heuristic_signal_overbought(self, model):
        features = {"momentum_score": -0.1, "rsi": 80}
        signal = model._heuristic_signal(features, "abc", "TEST")
        assert signal is not None
        assert signal.confidence < 0.5

    def test_should_retrain_initially(self, model):
        assert model.should_retrain() is True

    def test_train_insufficient_data(self, model):
        result = model.train()
        assert result["status"] == "insufficient_data"

    def test_train_with_data(self, model):
        # Insert enough training data
        for i in range(20):
            features = {col: np.random.random() for col in FEATURE_COLUMNS}
            model.db.save_training_sample("abc", features, float(i % 2), "profitable")

        result = model.train()
        assert result["status"] == "trained"
        assert model._is_trained is True

    def test_predict_after_training(self, model):
        # Train
        for i in range(20):
            features = {col: np.random.random() for col in FEATURE_COLUMNS}
            model.db.save_training_sample("abc", features, float(i % 2), "profitable")
        model.train()

        # Predict
        features = {col: np.random.random() for col in FEATURE_COLUMNS}
        signal = model.predict(features, "xyz", "TEST")
        assert signal is not None
        assert 0 <= signal.confidence <= 1

    def test_record_outcome(self, model):
        features = {"rsi": 50}
        model.record_outcome("abc", features, 0.1)
        data = model.db.get_training_data("profitable")
        assert len(data) == 1

    def test_get_stats(self, model):
        stats = model.get_stats()
        assert "is_trained" in stats
        assert "model_type" in stats
        assert "training_samples" in stats

    def test_estimate_return(self, model):
        ret = model._estimate_return(0.8, {"momentum_score": 0.1, "price_volatility": 0.05})
        assert isinstance(ret, float)
