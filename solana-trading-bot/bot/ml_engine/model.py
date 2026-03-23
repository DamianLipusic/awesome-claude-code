"""Self-learning ML model for trade signal prediction."""

from __future__ import annotations

import json
import pickle
from datetime import datetime
from pathlib import Path

import numpy as np
import structlog
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.model_selection import cross_val_score

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
    """Self-learning trading model that improves from paper/live trading results."""

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

        # Try to load existing model
        self._load_model()

    def _create_model(self):
        """Create a fresh ML model based on config."""
        if self.model_type == "xgboost" and HAS_XGBOOST:
            return xgb.XGBClassifier(
                n_estimators=200,
                max_depth=6,
                learning_rate=0.05,
                subsample=0.8,
                colsample_bytree=0.8,
                min_child_weight=3,
                reg_alpha=0.1,
                reg_lambda=1.0,
                use_label_encoder=False,
                eval_metric="logloss",
                random_state=42,
            )
        elif self.model_type == "random_forest":
            return RandomForestClassifier(
                n_estimators=200,
                max_depth=8,
                min_samples_split=10,
                min_samples_leaf=5,
                random_state=42,
                n_jobs=-1,
            )
        else:
            return GradientBoostingClassifier(
                n_estimators=200,
                max_depth=5,
                learning_rate=0.05,
                subsample=0.8,
                min_samples_split=10,
                min_samples_leaf=5,
                random_state=42,
            )

    def train(self) -> dict:
        """Train/retrain the model using completed trade data."""
        # Get training data from database
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

        # Convert continuous labels to binary (profitable = 1, not = 0)
        y_binary = (y > 0).astype(int)

        # Check class balance
        pos_ratio = y_binary.mean()
        logger.info("training_data_stats",
                     samples=len(y),
                     positive_ratio=f"{pos_ratio:.2%}")

        # Create and train model
        self.model = self._create_model()

        # Cross-validation
        try:
            cv_scores = cross_val_score(
                self.model, X, y_binary, cv=min(5, len(y) // 10 + 1),
                scoring="accuracy",
            )
            cv_accuracy = cv_scores.mean()
        except Exception:
            cv_accuracy = 0.0

        # Full training
        self.model.fit(X, y_binary)
        self._is_trained = True
        self._train_count += 1
        self._last_train_time = datetime.utcnow()

        # Feature importance
        importance = {}
        if hasattr(self.model, "feature_importances_"):
            for name, imp in zip(FEATURE_COLUMNS, self.model.feature_importances_):
                importance[name] = float(imp)

        # Save model
        self._save_model()

        stats = {
            "status": "trained",
            "samples": len(y),
            "cv_accuracy": float(cv_accuracy),
            "positive_ratio": float(pos_ratio),
            "train_count": self._train_count,
            "top_features": dict(
                sorted(importance.items(), key=lambda x: x[1], reverse=True)[:5]
            ),
        }

        logger.info("model_trained", **stats)
        return stats

    def predict(self, raw_features: dict[str, float],
                mint_address: str, symbol: str) -> TradeSignal | None:
        """Generate a trade signal from features."""
        if not self._is_trained or self.model is None:
            # Before training, use a simple heuristic
            return self._heuristic_signal(raw_features, mint_address, symbol)

        try:
            feature_vector = self.feature_engineer.raw_features_to_vector(raw_features)
            feature_vector_2d = feature_vector.reshape(1, -1)

            # Get probability of profitable trade
            proba = self.model.predict_proba(feature_vector_2d)[0]
            confidence = float(proba[1]) if len(proba) > 1 else float(proba[0])

            # Estimate return based on historical data
            predicted_return = self._estimate_return(confidence, raw_features)

            signal = TradeSignal(
                mint_address=mint_address,
                symbol=symbol,
                side=TradeSide.BUY if confidence > 0.5 else TradeSide.SELL,
                confidence=confidence,
                predicted_return=predicted_return,
                features=raw_features,
            )

            # Track prediction
            self._predictions.append({
                "timestamp": datetime.utcnow().isoformat(),
                "mint": mint_address,
                "confidence": confidence,
                "features": raw_features,
            })

            return signal

        except Exception as e:
            logger.error("prediction_error", error=str(e))
            return None

    def _heuristic_signal(self, features: dict, mint: str,
                          symbol: str) -> TradeSignal | None:
        """Simple heuristic for trading before ML model is trained."""
        score = 0.0
        factors = 0

        # Momentum
        momentum = features.get("momentum_score", 0)
        if momentum > 0.05:
            score += 0.3
        elif momentum < -0.05:
            score -= 0.3
        factors += 1

        # RSI
        rsi = features.get("rsi", 50)
        if 30 < rsi < 70:
            score += 0.1
        elif rsi <= 30:
            score += 0.2  # Oversold = potential buy
        factors += 1

        # Volume surge
        vol_profile = features.get("volume_profile", 1.0)
        if vol_profile > 1.5:
            score += 0.2
        factors += 1

        # Price momentum (short term)
        pc_5m = features.get("price_change_5m", 0)
        if 0.01 < pc_5m < 0.15:  # Moderate positive = good
            score += 0.2
        elif pc_5m > 0.30:  # Too fast = risky
            score -= 0.2
        factors += 1

        # Buy/sell ratio
        bs_ratio = features.get("buy_sell_ratio", 0.5)
        if bs_ratio > 0.6:
            score += 0.15
        factors += 1

        # Normalize
        if factors > 0:
            confidence = max(0.0, min(1.0, 0.5 + score))
        else:
            confidence = 0.3

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
        base_return = (confidence - 0.5) * 0.4  # -20% to +20%
        momentum_adj = features.get("momentum_score", 0) * 0.1
        return base_return + momentum_adj

    def record_outcome(self, mint_address: str, features: dict,
                       pnl_pct: float) -> None:
        """Record a trade outcome for future training."""
        # Save as training data
        self.db.save_training_sample(
            mint_address=mint_address,
            features=features,
            label=pnl_pct,
            label_type="return",
        )
        # Also save as binary classification
        self.db.save_training_sample(
            mint_address=mint_address,
            features=features,
            label=1.0 if pnl_pct > 0 else 0.0,
            label_type="profitable",
        )

    def should_retrain(self) -> bool:
        """Check if model should be retrained."""
        interval = self.config.get("retrain_interval_hours", 6)
        if self._last_train_time is None:
            return True
        hours_since = (datetime.utcnow() - self._last_train_time).total_seconds() / 3600
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
            self._is_trained = True
            logger.info("model_loaded", train_count=self._train_count)
        except Exception as e:
            logger.error("model_load_error", error=str(e))

    def get_stats(self) -> dict:
        """Get model statistics."""
        return {
            "is_trained": self._is_trained,
            "model_type": self.model_type,
            "train_count": self._train_count,
            "last_train_time": self._last_train_time.isoformat()
            if self._last_train_time else None,
            "total_predictions": len(self._predictions),
        }
