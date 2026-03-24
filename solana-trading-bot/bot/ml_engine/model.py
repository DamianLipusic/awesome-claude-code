"""Self-learning ML model for trade signal prediction with ensemble support."""

from __future__ import annotations

import json
import pickle
from datetime import datetime
from pathlib import Path

import numpy as np
import structlog
from sklearn.ensemble import (
    GradientBoostingClassifier,
    RandomForestClassifier,
    VotingClassifier,
)
from sklearn.model_selection import cross_val_score, StratifiedKFold

try:
    import xgboost as xgb
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False

from bot.database import Database
from bot.ml_engine.feature_engineer import FeatureEngineer, FEATURE_COLUMNS
from bot.models import TradeSignal, TradeSide

logger = structlog.get_logger()


class TradingModel:
    """Self-learning trading model with ensemble voting and confidence calibration."""

    def __init__(self, config: dict, db: Database):
        self.config = config.get("ml", {})
        self.db = db
        self.feature_engineer = FeatureEngineer()

        self.model_type = self.config.get("model_type", "xgboost")
        self.min_samples = self.config.get("min_training_samples", 100)

        self.model = None
        self._is_trained = False
        self._train_count = 0
        self._last_train_time: datetime | None = None
        self._model_path = Path("data/model.pkl")
        self._stats_path = Path("data/model_stats.json")

        # Performance tracking
        self._predictions: list[dict] = []
        self._prediction_accuracy: list[bool] = []
        self._cv_accuracy = 0.0

        # Confidence calibration
        self._confidence_offset = 0.0

        # Try to load existing model
        self._load_model()

    def _create_model(self):
        """Create ML model - uses ensemble for better accuracy."""
        estimators = []

        if HAS_XGBOOST:
            xgb_model = xgb.XGBClassifier(
                n_estimators=300,
                max_depth=5,
                learning_rate=0.03,
                subsample=0.8,
                colsample_bytree=0.8,
                min_child_weight=5,
                reg_alpha=0.1,
                reg_lambda=1.0,
                gamma=0.1,
                use_label_encoder=False,
                eval_metric="logloss",
                random_state=42,
            )
            estimators.append(("xgb", xgb_model))

        rf_model = RandomForestClassifier(
            n_estimators=200,
            max_depth=7,
            min_samples_split=10,
            min_samples_leaf=5,
            max_features="sqrt",
            random_state=42,
            n_jobs=-1,
        )
        estimators.append(("rf", rf_model))

        gb_model = GradientBoostingClassifier(
            n_estimators=200,
            max_depth=4,
            learning_rate=0.05,
            subsample=0.8,
            min_samples_split=10,
            min_samples_leaf=5,
            random_state=42,
        )
        estimators.append(("gb", gb_model))

        # Use single model if only one type requested, otherwise ensemble
        if self.model_type != "ensemble" and len(estimators) > 1:
            model_map = {e[0]: e[1] for e in estimators}
            type_map = {"xgboost": "xgb", "random_forest": "rf", "gradient_boosting": "gb"}
            key = type_map.get(self.model_type, "xgb" if HAS_XGBOOST else "rf")
            return model_map.get(key, estimators[0][1])

        if len(estimators) >= 2:
            return VotingClassifier(
                estimators=estimators,
                voting="soft",
                n_jobs=-1,
            )

        return estimators[0][1]

    def train(self) -> dict:
        """Train/retrain the model using completed trade data."""
        training_data = self.db.get_training_data(label_type="profitable")

        if len(training_data) < self.min_samples:
            logger.info("insufficient_training_data",
                        samples=len(training_data),
                        required=self.min_samples)
            return {
                "status": "insufficient_data",
                "samples": len(training_data),
                "required": self.min_samples,
            }

        # Prepare features
        X, y = self.feature_engineer.features_dict_to_df(training_data)

        # Convert continuous labels to binary
        y_binary = (y > 0).astype(int)

        # Check class balance
        pos_ratio = y_binary.mean()
        logger.info("training_data_stats",
                     samples=len(y),
                     positive_ratio=f"{pos_ratio:.2%}")

        # Handle class imbalance with sample weights
        sample_weights = np.ones(len(y_binary))
        if pos_ratio < 0.3 or pos_ratio > 0.7:
            # Weight minority class more
            minority_class = 1 if pos_ratio < 0.5 else 0
            minority_mask = y_binary == minority_class
            weight_ratio = (1 - pos_ratio) / pos_ratio if minority_class == 1 else pos_ratio / (1 - pos_ratio)
            sample_weights[minority_mask] = min(weight_ratio, 3.0)
            logger.info("class_rebalancing", weight_ratio=f"{weight_ratio:.2f}")

        # Create and train model
        self.model = self._create_model()

        # Cross-validation with stratification
        try:
            n_splits = min(5, max(2, len(y) // 20))
            cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
            cv_scores = cross_val_score(
                self.model, X, y_binary, cv=cv,
                scoring="accuracy",
            )
            self._cv_accuracy = float(cv_scores.mean())
            cv_std = float(cv_scores.std())
        except Exception as e:
            logger.warning("cv_failed", error=str(e))
            self._cv_accuracy = 0.0
            cv_std = 0.0

        # Full training with sample weights
        try:
            self.model.fit(X, y_binary, sample_weight=sample_weights)
        except TypeError:
            # Some models don't support sample_weight in fit
            self.model.fit(X, y_binary)

        self._is_trained = True
        self._train_count += 1
        self._last_train_time = datetime.utcnow()

        # Feature importance
        importance = self._get_feature_importance()

        # Calibrate confidence based on CV accuracy
        if self._cv_accuracy > 0:
            self._confidence_offset = max(0, 0.5 - self._cv_accuracy) * 0.5

        # Save model
        self._save_model()

        stats = {
            "status": "trained",
            "samples": len(y),
            "cv_accuracy": round(self._cv_accuracy, 4),
            "cv_std": round(cv_std, 4),
            "positive_ratio": round(float(pos_ratio), 4),
            "train_count": self._train_count,
            "model_type": type(self.model).__name__,
            "top_features": dict(
                sorted(importance.items(), key=lambda x: x[1], reverse=True)[:5]
            ),
        }

        logger.info("model_trained", **stats)

        # Save stats to file
        self._save_stats(stats)

        return stats

    def _get_feature_importance(self) -> dict[str, float]:
        """Extract feature importance from model or ensemble."""
        importance = {}
        if hasattr(self.model, "feature_importances_"):
            for name, imp in zip(FEATURE_COLUMNS, self.model.feature_importances_):
                importance[name] = round(float(imp), 4)
        elif hasattr(self.model, "estimators_"):
            # Ensemble: average importance across sub-models
            all_importances = np.zeros(len(FEATURE_COLUMNS))
            count = 0
            for name, est in self.model.estimators_:
                if hasattr(est, "feature_importances_"):
                    all_importances += est.feature_importances_
                    count += 1
            if count > 0:
                all_importances /= count
                for name, imp in zip(FEATURE_COLUMNS, all_importances):
                    importance[name] = round(float(imp), 4)
        return importance

    def predict(self, raw_features: dict[str, float],
                mint_address: str, symbol: str) -> TradeSignal | None:
        """Generate a trade signal from features."""
        if not self._is_trained or self.model is None:
            return self._heuristic_signal(raw_features, mint_address, symbol)

        try:
            feature_vector = self.feature_engineer.raw_features_to_vector(raw_features)
            feature_vector_2d = feature_vector.reshape(1, -1)

            # Get probability of profitable trade
            proba = self.model.predict_proba(feature_vector_2d)[0]
            confidence = float(proba[1]) if len(proba) > 1 else float(proba[0])

            # Apply confidence calibration
            confidence = max(0.0, min(1.0, confidence - self._confidence_offset))

            # Estimate return based on confidence and features
            predicted_return = self._estimate_return(confidence, raw_features)

            signal = TradeSignal(
                mint_address=mint_address,
                symbol=symbol,
                side=TradeSide.BUY if confidence > 0.5 else TradeSide.SELL,
                confidence=confidence,
                predicted_return=predicted_return,
                features=raw_features,
            )

            # Track prediction (keep last 500)
            self._predictions.append({
                "timestamp": datetime.utcnow().isoformat(),
                "mint": mint_address,
                "confidence": confidence,
            })
            if len(self._predictions) > 500:
                self._predictions = self._predictions[-500:]

            return signal

        except Exception as e:
            logger.error("prediction_error", error=str(e))
            return None

    def _heuristic_signal(self, features: dict, mint: str,
                          symbol: str) -> TradeSignal | None:
        """Improved heuristic for trading before ML model is trained."""
        score = 0.0

        # Momentum (strongest signal)
        momentum = features.get("momentum_score", 0)
        if momentum > 0.05:
            score += 0.3
        elif momentum > 0.02:
            score += 0.15
        elif momentum < -0.05:
            score -= 0.3

        # RSI - avoid overbought
        rsi = features.get("rsi", 50)
        if 30 < rsi < 60:
            score += 0.15
        elif rsi <= 30:
            score += 0.2  # Oversold = potential buy
        elif rsi > 75:
            score -= 0.3  # Overbought = avoid

        # Volume surge
        vol_profile = features.get("volume_profile", 1.0)
        if vol_profile > 1.5:
            score += 0.2
        elif vol_profile > 2.5:
            score += 0.1  # Extreme volume can be risky

        # Price momentum (short term)
        pc_5m = features.get("price_change_5m", 0)
        if 0.01 < pc_5m < 0.15:
            score += 0.2
        elif pc_5m > 0.30:
            score -= 0.2  # Too fast

        # Buy/sell ratio
        bs_ratio = features.get("buy_sell_ratio", 0.5)
        if bs_ratio > 0.6:
            score += 0.15
        elif bs_ratio < 0.3:
            score -= 0.15

        # Bollinger band position
        bb_pos = features.get("bb_position", 0)
        if bb_pos < -1.0:
            score += 0.15  # Below lower band = potential bounce
        elif bb_pos > 1.5:
            score -= 0.15  # Above upper band = overextended

        # Momentum acceleration
        mom_accel = features.get("momentum_acceleration", 0)
        if mom_accel > 1.0:
            score += 0.1  # Accelerating momentum

        confidence = max(0.0, min(1.0, 0.5 + score))

        return TradeSignal(
            mint_address=mint,
            symbol=symbol,
            side=TradeSide.BUY if confidence > 0.5 else TradeSide.SELL,
            confidence=confidence,
            predicted_return=score * 0.1,
            features=features,
        )

    def _estimate_return(self, confidence: float,
                         features: dict) -> float:
        """Estimate expected return based on confidence and features."""
        base_return = (confidence - 0.5) * 0.4
        momentum_adj = features.get("momentum_score", 0) * 0.1
        vol_adj = -features.get("price_volatility", 0) * 0.05  # Higher vol = lower expected
        return base_return + momentum_adj + vol_adj

    def record_outcome(self, mint_address: str, features: dict,
                       pnl_pct: float) -> None:
        """Record a trade outcome for future training."""
        self.db.save_training_sample(
            mint_address=mint_address,
            features=features,
            label=pnl_pct,
            label_type="return",
        )
        self.db.save_training_sample(
            mint_address=mint_address,
            features=features,
            label=1.0 if pnl_pct > 0 else 0.0,
            label_type="profitable",
        )

        # Track prediction accuracy
        for pred in reversed(self._predictions):
            if pred["mint"] == mint_address:
                was_correct = (pred["confidence"] > 0.5 and pnl_pct > 0) or \
                              (pred["confidence"] <= 0.5 and pnl_pct <= 0)
                self._prediction_accuracy.append(was_correct)
                if len(self._prediction_accuracy) > 200:
                    self._prediction_accuracy = self._prediction_accuracy[-200:]
                break

    def should_retrain(self) -> bool:
        """Check if model should be retrained."""
        interval = self.config.get("retrain_interval_hours", 6)
        if self._last_train_time is None:
            return True
        hours_since = (datetime.utcnow() - self._last_train_time).total_seconds() / 3600

        # Also retrain if accuracy is dropping
        if len(self._prediction_accuracy) >= 20:
            recent_acc = sum(self._prediction_accuracy[-20:]) / 20
            if recent_acc < 0.4:
                logger.info("accuracy_drop_retrain", recent_accuracy=f"{recent_acc:.1%}")
                return True

        return hours_since >= interval

    def _save_model(self) -> None:
        """Save model to disk."""
        self._model_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            with open(self._model_path, "wb") as f:
                pickle.dump({
                    "model": self.model,
                    "feature_stats": self.feature_engineer._feature_stats,
                    "train_count": self._train_count,
                    "last_train": self._last_train_time.isoformat()
                    if self._last_train_time else None,
                    "cv_accuracy": self._cv_accuracy,
                    "confidence_offset": self._confidence_offset,
                    "prediction_accuracy": self._prediction_accuracy[-100:],
                }, f)
            logger.info("model_saved", path=str(self._model_path))
        except Exception as e:
            logger.error("model_save_error", error=str(e))

    def _load_model(self) -> None:
        """Load model from disk."""
        if not self._model_path.exists():
            return
        try:
            with open(self._model_path, "rb") as f:
                data = pickle.load(f)
            self.model = data["model"]
            self.feature_engineer._feature_stats = data.get("feature_stats", {})
            self._train_count = data.get("train_count", 0)
            last_train = data.get("last_train")
            if last_train:
                self._last_train_time = datetime.fromisoformat(last_train)
            self._cv_accuracy = data.get("cv_accuracy", 0.0)
            self._confidence_offset = data.get("confidence_offset", 0.0)
            self._prediction_accuracy = data.get("prediction_accuracy", [])
            self._is_trained = True
            logger.info("model_loaded",
                        train_count=self._train_count,
                        cv_accuracy=f"{self._cv_accuracy:.1%}")
        except Exception as e:
            logger.error("model_load_error", error=str(e))

    def _save_stats(self, stats: dict) -> None:
        """Save training stats to JSON file."""
        try:
            self._stats_path.parent.mkdir(parents=True, exist_ok=True)
            existing = []
            if self._stats_path.exists():
                with open(self._stats_path) as f:
                    existing = json.load(f)
            stats["timestamp"] = datetime.utcnow().isoformat()
            existing.append(stats)
            # Keep last 50 training runs
            existing = existing[-50:]
            with open(self._stats_path, "w") as f:
                json.dump(existing, f, indent=2, default=str)
        except Exception as e:
            logger.error("stats_save_error", error=str(e))

    def get_stats(self) -> dict:
        """Get model statistics."""
        recent_accuracy = None
        if len(self._prediction_accuracy) >= 10:
            recent_accuracy = f"{sum(self._prediction_accuracy[-20:]) / len(self._prediction_accuracy[-20:]):.1%}"

        return {
            "is_trained": self._is_trained,
            "model_type": self.model_type,
            "train_count": self._train_count,
            "cv_accuracy": f"{self._cv_accuracy:.1%}" if self._cv_accuracy > 0 else "N/A",
            "recent_accuracy": recent_accuracy or "N/A",
            "last_train_time": self._last_train_time.isoformat()
            if self._last_train_time else None,
            "total_predictions": len(self._predictions),
            "training_samples": self.db.get_training_data_count("profitable"),
        }
