"""Aggregates data from all collectors and computes features."""

from __future__ import annotations

import asyncio
from datetime import datetime

import numpy as np
import structlog

from bot.data_collector.jupiter import JupiterCollector
from bot.data_collector.raydium import RaydiumCollector
from bot.data_collector.pump_fun import PumpFunCollector
from bot.database import Database
from bot.models import TokenInfo, PriceCandle

logger = structlog.get_logger()


class DataAggregator:
    """Aggregates data from multiple sources and computes ML features."""

    def __init__(self, db: Database, config: dict):
        self.db = db
        self.config = config
        self.jupiter = JupiterCollector()
        self.raydium = RaydiumCollector()
        self.pump_fun = PumpFunCollector()

        # Price cache: mint_address -> list of (timestamp, price)
        self._price_cache: dict[str, list[tuple[datetime, float]]] = {}
        # Token cache
        self._token_cache: dict[str, TokenInfo] = {}

    async def start(self) -> None:
        await asyncio.gather(
            self.jupiter.start(),
            self.raydium.start(),
            self.pump_fun.start(),
        )

    async def stop(self) -> None:
        await asyncio.gather(
            self.jupiter.stop(),
            self.raydium.stop(),
            self.pump_fun.stop(),
        )

    async def discover_tokens(self) -> list[TokenInfo]:
        """Discover new tokens from all sources."""
        results = await asyncio.gather(
            self.jupiter.get_trending_tokens(30),
            self.raydium.get_trending_tokens(30),
            self.pump_fun.get_trending_tokens(30),
            return_exceptions=True,
        )

        all_tokens: dict[str, TokenInfo] = {}
        for result in results:
            if isinstance(result, Exception):
                logger.error("discover_error", error=str(result))
                continue
            for token in result:
                if token.mint_address and token.mint_address not in all_tokens:
                    all_tokens[token.mint_address] = token

        # Filter based on config
        strategy = self.config.get("strategy", {})
        min_liquidity = strategy.get("min_liquidity_usd", 5000)
        max_age = strategy.get("max_token_age_hours", 48)
        min_holders = strategy.get("min_holder_count", 50)
        min_volume = strategy.get("min_volume_24h_usd", 1000)

        filtered = []
        for token in all_tokens.values():
            # Skip tokens that don't meet criteria
            if token.liquidity_usd > 0 and token.liquidity_usd < min_liquidity:
                continue
            if token.age_hours > max_age:
                continue
            if token.holder_count > 0 and token.holder_count < min_holders:
                continue
            if token.volume_24h_usd > 0 and token.volume_24h_usd < min_volume:
                continue
            filtered.append(token)

        # Update cache
        for token in filtered:
            self._token_cache[token.mint_address] = token

        logger.info("tokens_discovered", total=len(all_tokens),
                     filtered=len(filtered))
        return filtered

    async def update_prices(self, mint_addresses: list[str]) -> dict[str, float]:
        """Update prices for tracked tokens."""
        prices: dict[str, float] = {}

        # Batch price fetching
        tasks = []
        for mint in mint_addresses:
            tasks.append(self._get_best_price(mint))

        results = await asyncio.gather(*tasks, return_exceptions=True)

        for mint, result in zip(mint_addresses, results):
            if isinstance(result, Exception) or result is None:
                continue
            prices[mint] = result

            # Update price cache
            if mint not in self._price_cache:
                self._price_cache[mint] = []
            self._price_cache[mint].append((datetime.utcnow(), result))

            # Keep only last 1000 prices per token
            if len(self._price_cache[mint]) > 1000:
                self._price_cache[mint] = self._price_cache[mint][-1000:]

        return prices

    async def _get_best_price(self, mint_address: str) -> float | None:
        """Get best price from available sources."""
        # Try Jupiter first (most reliable)
        price = await self.jupiter.get_token_price(mint_address)
        if price and price > 0:
            return price

        # Try Raydium
        price = await self.raydium.get_token_price(mint_address)
        if price and price > 0:
            return price

        # Try pump.fun
        price = await self.pump_fun.get_token_price(mint_address)
        if price and price > 0:
            return price

        return None

    def compute_features(self, mint_address: str) -> dict[str, float]:
        """Compute ML features for a token."""
        features: dict[str, float] = {}
        price_history = self._price_cache.get(mint_address, [])
        token = self._token_cache.get(mint_address)

        if len(price_history) < 3:
            return features

        prices = [p[1] for p in price_history]
        timestamps = [p[0] for p in price_history]

        current_price = prices[-1]
        if current_price <= 0:
            return features

        # Price change percentages over different periods
        lookbacks = self.config.get("ml", {}).get("lookback_periods", [5, 15, 30, 60])
        for period in lookbacks:
            n_samples = min(period, len(prices))
            if n_samples > 1:
                old_price = prices[-n_samples]
                if old_price > 0:
                    features[f"price_change_{period}m"] = (
                        (current_price - old_price) / old_price
                    )

        # Volatility
        if len(prices) >= 5:
            returns = np.diff(np.log(np.array(prices[-30:])))
            features["price_volatility"] = float(np.std(returns)) if len(returns) > 0 else 0

        # Momentum (rate of price change)
        if len(prices) >= 10:
            recent = np.mean(prices[-5:])
            older = np.mean(prices[-10:-5])
            if older > 0:
                features["momentum_score"] = (recent - older) / older

        # RSI (Relative Strength Index)
        if len(prices) >= 15:
            features["rsi"] = self._calculate_rsi(prices[-15:])

        # MACD signal
        if len(prices) >= 26:
            macd, signal = self._calculate_macd(prices)
            features["macd_signal"] = macd - signal

        # Volume surge (if we have volume data)
        if token:
            features["liquidity_depth"] = token.liquidity_usd
            features["volume_24h"] = token.volume_24h_usd
            features["holder_count"] = float(token.holder_count)
            features["market_cap"] = token.market_cap_usd

            if token.age_hours < float("inf"):
                features["token_age_hours"] = token.age_hours

        # Buy/sell pressure from price action
        if len(prices) >= 10:
            up_moves = sum(1 for i in range(1, min(10, len(prices)))
                          if prices[-i] > prices[-i-1])
            features["buy_sell_ratio"] = up_moves / 10.0

        # Price relative to recent high/low
        if len(prices) >= 20:
            recent_high = max(prices[-20:])
            recent_low = min(prices[-20:])
            if recent_high > recent_low:
                features["price_position"] = (
                    (current_price - recent_low) / (recent_high - recent_low)
                )

        # Volume profile approximation
        if len(prices) >= 10:
            recent_vol = np.std(prices[-5:])
            older_vol = np.std(prices[-10:-5])
            if older_vol > 0:
                features["volume_profile"] = recent_vol / older_vol

        return features

    @staticmethod
    def _calculate_rsi(prices: list[float], period: int = 14) -> float:
        """Calculate RSI."""
        if len(prices) < period + 1:
            return 50.0

        deltas = np.diff(prices)
        gains = np.where(deltas > 0, deltas, 0)
        losses = np.where(deltas < 0, -deltas, 0)

        avg_gain = np.mean(gains[-period:])
        avg_loss = np.mean(losses[-period:])

        if avg_loss == 0:
            return 100.0

        rs = avg_gain / avg_loss
        return float(100 - (100 / (1 + rs)))

    @staticmethod
    def _calculate_macd(prices: list[float]) -> tuple[float, float]:
        """Calculate MACD and signal line."""
        prices_arr = np.array(prices)

        # EMA 12
        ema12 = DataAggregator._ema(prices_arr, 12)
        # EMA 26
        ema26 = DataAggregator._ema(prices_arr, 26)

        macd_line = ema12 - ema26
        # Signal line is EMA 9 of MACD
        signal = DataAggregator._ema(np.array([macd_line]), 1)

        return float(macd_line), float(signal)

    @staticmethod
    def _ema(data: np.ndarray, period: int) -> float:
        """Calculate Exponential Moving Average."""
        if len(data) == 0:
            return 0.0
        weights = np.exp(np.linspace(-1., 0., min(period, len(data))))
        weights /= weights.sum()
        return float(np.dot(data[-len(weights):], weights))
