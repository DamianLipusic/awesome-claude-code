"""Feature engineering for ML model."""

from __future__ import annotations

import numpy as np
import pandas as pd
import structlog

logger = structlog.get_logger()

# All features the model expects
FEATURE_COLUMNS = [
    "price_change_5m",
    "price_change_15m",
    "price_change_30m",
    "price_change_60m",
    "price_volatility",
    "momentum_score",
    "rsi",
    "macd_signal",
    "buy_sell_ratio",
    "liquidity_depth",
    "volume_24h",
    "holder_count",
    "market_cap",
    "token_age_hours",
    "price_position",
    "volume_profile",
]


class FeatureEngineer:
    """Prepares and normalizes features for the ML model."""

    def __init__(self):
        self._feature_stats: dict[str, dict[str, float]] = {}

    def raw_features_to_vector(self, raw_features: dict[str, float]) -> np.ndarray:
        """Convert raw feature dict to a normalized feature vector."""
        vector = []
        for col in FEATURE_COLUMNS:
            val = raw_features.get(col, 0.0)
            # Handle NaN/inf
            if not np.isfinite(val):
                val = 0.0
            vector.append(val)

        arr = np.array(vector, dtype=np.float64)

        # Update running stats for normalization
        self._update_stats(arr)

        # Normalize
        return self._normalize(arr)

    def features_dict_to_df(self, samples: list[dict]) -> tuple[pd.DataFrame, np.ndarray]:
        """Convert list of training samples to DataFrame + labels."""
        rows = []
        labels = []
        for sample in samples:
            features = sample["features"]
            row = {}
            for col in FEATURE_COLUMNS:
                val = features.get(col, 0.0)
                row[col] = val if np.isfinite(val) else 0.0
            rows.append(row)
            labels.append(sample["label"])

        df = pd.DataFrame(rows, columns=FEATURE_COLUMNS)
        df = df.fillna(0.0)

        # Store stats for normalization
        for col in FEATURE_COLUMNS:
            self._feature_stats[col] = {
                "mean": float(df[col].mean()),
                "std": float(df[col].std()) if df[col].std() > 0 else 1.0,
            }

        # Normalize the dataframe
        for col in FEATURE_COLUMNS:
            stats = self._feature_stats[col]
            df[col] = (df[col] - stats["mean"]) / stats["std"]

        return df, np.array(labels, dtype=np.float64)

    def _update_stats(self, vector: np.ndarray) -> None:
        """Update running mean/std for normalization."""
        for i, col in enumerate(FEATURE_COLUMNS):
            if col not in self._feature_stats:
                self._feature_stats[col] = {"mean": 0.0, "std": 1.0, "n": 0}
            stats = self._feature_stats[col]
            n = stats.get("n", 0) + 1
            old_mean = stats["mean"]
            new_mean = old_mean + (vector[i] - old_mean) / n
            stats["mean"] = new_mean
            stats["n"] = n

    def _normalize(self, vector: np.ndarray) -> np.ndarray:
        """Normalize a feature vector using stored stats."""
        result = np.zeros_like(vector)
        for i, col in enumerate(FEATURE_COLUMNS):
            stats = self._feature_stats.get(col, {"mean": 0.0, "std": 1.0})
            std = stats["std"] if stats["std"] > 0 else 1.0
            result[i] = (vector[i] - stats["mean"]) / std
        return result

    def get_feature_importance_names(self) -> list[str]:
        """Return feature column names for importance analysis."""
        return FEATURE_COLUMNS.copy()
