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
        # Track which source has best price for each token
        self._price_source: dict[str, str] = {}

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

        source_names = ["jupiter", "raydium", "pump_fun"]
        source_counts = {}

        all_tokens: dict[str, TokenInfo] = {}
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error("discover_error",
                             source=source_names[i], error=str(result))
                source_counts[source_names[i]] = 0
                continue
            source_counts[source_names[i]] = len(result)
            for token in result:
                if not token.mint_address:
                    continue
                # Keep token with most metadata
                existing = all_tokens.get(token.mint_address)
                if existing is None or token.liquidity_usd > existing.liquidity_usd:
                    all_tokens[token.mint_address] = token

        # Filter based on config
        strategy = self.config.get("strategy", {})
        min_liquidity = strategy.get("min_liquidity_usd", 5000)
        max_age = strategy.get("max_token_age_hours", 48)
        min_holders = strategy.get("min_holder_count", 50)
        min_volume = strategy.get("min_volume_24h_usd", 1000)

        filtered = []
        for token in all_tokens.values():
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

        logger.info("tokens_discovered",
                     total=len(all_tokens),
                     filtered=len(filtered),
                     sources=source_counts)
        return filtered

    async def update_prices(self, mint_addresses: list[str]) -> dict[str, float]:
        """Update prices for tracked tokens with smart source routing."""
        prices: dict[str, float] = {}

        # Batch price fetching with concurrency limit
        semaphore = asyncio.Semaphore(15)

        async def fetch_price(mint: str) -> tuple[str, float | None]:
            async with semaphore:
                return mint, await self._get_best_price(mint)

        tasks = [fetch_price(mint) for mint in mint_addresses]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        now = datetime.utcnow()
        for result in results:
            if isinstance(result, Exception):
                continue
            mint, price = result
            if price is None or price <= 0:
                continue

            prices[mint] = price

            # Update price cache
            if mint not in self._price_cache:
                self._price_cache[mint] = []
            self._price_cache[mint].append((now, price))

            # Keep only last 1000 prices per token
            if len(self._price_cache[mint]) > 1000:
                self._price_cache[mint] = self._price_cache[mint][-1000:]

        # Prune stale tokens from cache (no price update in 1 hour)
        stale_mints = []
        for mint, history in self._price_cache.items():
            if history and (now - history[-1][0]).total_seconds() > 3600:
                stale_mints.append(mint)
        for mint in stale_mints:
            del self._price_cache[mint]
            self._price_source.pop(mint, None)

        return prices

    async def _get_best_price(self, mint_address: str) -> float | None:
        """Get best price, preferring the last successful source."""
        # Try last known good source first
        preferred = self._price_source.get(mint_address)

        sources = [
            ("jupiter", self.jupiter),
            ("raydium", self.raydium),
            ("pump_fun", self.pump_fun),
        ]

        # Reorder to try preferred source first
        if preferred:
            sources.sort(key=lambda s: 0 if s[0] == preferred else 1)

        for name, collector in sources:
            price = await collector.get_token_price(mint_address)
            if price and price > 0:
                self._price_source[mint_address] = name
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
            log_prices = np.log(np.array(prices[-30:]))
            returns = np.diff(log_prices)
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

        # Volume profile approximation (volatility ratio)
        if len(prices) >= 10:
            recent_vol = np.std(prices[-5:])
            older_vol = np.std(prices[-10:-5])
            if older_vol > 0:
                features["volume_profile"] = recent_vol / older_vol

        # Additional features for better ML performance
        if len(prices) >= 30:
            # Bollinger Band position
            sma20 = np.mean(prices[-20:])
            std20 = np.std(prices[-20:])
            if std20 > 0:
                features["bb_position"] = (current_price - sma20) / (2 * std20)

            # Rate of change
            if prices[-10] > 0:
                features["roc_10"] = (current_price - prices[-10]) / prices[-10]

            # Average True Range proxy (using close prices)
            price_arr = np.array(prices[-20:])
            tr_proxy = np.abs(np.diff(price_arr))
            features["atr_ratio"] = float(np.mean(tr_proxy) / current_price) if current_price > 0 else 0

        # Price acceleration (is momentum increasing?)
        if len(prices) >= 15:
            mom_recent = np.mean(prices[-3:]) - np.mean(prices[-6:-3])
            mom_older = np.mean(prices[-6:-3]) - np.mean(prices[-9:-6])
            if abs(mom_older) > 0:
                features["momentum_acceleration"] = mom_recent / abs(mom_older)

        return features

    @staticmethod
    def _calculate_rsi(prices: list[float], period: int = 14) -> float:
        """Calculate RSI using exponential moving average (more accurate)."""
        if len(prices) < period + 1:
            return 50.0

        deltas = np.diff(prices)
        gains = np.where(deltas > 0, deltas, 0)
        losses = np.where(deltas < 0, -deltas, 0)

        # Use EMA instead of SMA for smoother RSI
        alpha = 1.0 / period
        avg_gain = gains[0]
        avg_loss = losses[0]
        for i in range(1, len(gains)):
            avg_gain = alpha * gains[i] + (1 - alpha) * avg_gain
            avg_loss = alpha * losses[i] + (1 - alpha) * avg_loss

        if avg_loss == 0:
            return 100.0

        rs = avg_gain / avg_loss
        return float(100 - (100 / (1 + rs)))

    @staticmethod
    def _calculate_macd(prices: list[float]) -> tuple[float, float]:
        """Calculate MACD and signal line."""
        prices_arr = np.array(prices)

        ema12 = DataAggregator._ema(prices_arr, 12)
        ema26 = DataAggregator._ema(prices_arr, 26)

        macd_line = ema12 - ema26

        # For proper signal line, we'd need MACD history
        # Use simple approximation with shorter EMA
        if len(prices_arr) >= 35:
            # Compute MACD line for last 9 periods
            macd_values = []
            for i in range(9):
                idx = len(prices_arr) - 9 + i
                if idx >= 26:
                    e12 = DataAggregator._ema(prices_arr[:idx+1], 12)
                    e26 = DataAggregator._ema(prices_arr[:idx+1], 26)
                    macd_values.append(e12 - e26)
            if macd_values:
                signal = DataAggregator._ema(np.array(macd_values), min(9, len(macd_values)))
                return float(macd_line), float(signal)

        return float(macd_line), float(macd_line * 0.9)

    @staticmethod
    def _ema(data: np.ndarray, period: int) -> float:
        """Calculate Exponential Moving Average."""
        if len(data) == 0:
            return 0.0
        weights = np.exp(np.linspace(-1., 0., min(period, len(data))))
        weights /= weights.sum()
        return float(np.dot(data[-len(weights):], weights))
