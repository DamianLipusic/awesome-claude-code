"""Speed optimization utilities for minimal latency trading."""

from __future__ import annotations

import asyncio
import time
from collections import defaultdict
from functools import wraps
from typing import Any, Callable

import structlog

logger = structlog.get_logger()


class LatencyTracker:
    """Track and report latencies for all bot operations."""

    def __init__(self):
        self._latencies: dict[str, list[float]] = defaultdict(list)
        self._max_samples = 1000

    def record(self, operation: str, latency_ms: float) -> None:
        samples = self._latencies[operation]
        samples.append(latency_ms)
        if len(samples) > self._max_samples:
            self._latencies[operation] = samples[-self._max_samples:]

    def get_stats(self, operation: str) -> dict:
        samples = self._latencies.get(operation, [])
        if not samples:
            return {"avg_ms": 0, "p50_ms": 0, "p99_ms": 0, "count": 0}
        sorted_s = sorted(samples)
        n = len(sorted_s)
        return {
            "avg_ms": round(sum(sorted_s) / n, 2),
            "p50_ms": round(sorted_s[n // 2], 2),
            "p99_ms": round(sorted_s[int(n * 0.99)], 2),
            "min_ms": round(sorted_s[0], 2),
            "max_ms": round(sorted_s[-1], 2),
            "count": n,
        }

    def report(self) -> dict[str, dict]:
        return {op: self.get_stats(op) for op in self._latencies}


# Global tracker
latency_tracker = LatencyTracker()


def timed_async(operation: str):
    """Decorator to track async function latency."""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start = time.perf_counter()
            try:
                return await func(*args, **kwargs)
            finally:
                elapsed_ms = (time.perf_counter() - start) * 1000
                latency_tracker.record(operation, elapsed_ms)
                if elapsed_ms > 5000:  # Warn if >5s
                    logger.warning("slow_operation",
                                   op=operation, ms=round(elapsed_ms))
        return wrapper
    return decorator


def timed_sync(operation: str):
    """Decorator to track sync function latency."""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            start = time.perf_counter()
            try:
                return func(*args, **kwargs)
            finally:
                elapsed_ms = (time.perf_counter() - start) * 1000
                latency_tracker.record(operation, elapsed_ms)
        return wrapper
    return decorator


class ConnectionPool:
    """Manage persistent HTTP connections for speed."""

    _instances: dict[str, Any] = {}

    @classmethod
    async def get_client(cls, base_url: str):
        """Get or create a persistent httpx client."""
        import httpx

        if base_url not in cls._instances:
            cls._instances[base_url] = httpx.AsyncClient(
                base_url=base_url,
                timeout=10.0,
                limits=httpx.Limits(
                    max_connections=20,
                    max_keepalive_connections=10,
                    keepalive_expiry=30,
                ),
                http2=True,  # Use HTTP/2 for speed
            )
        return cls._instances[base_url]

    @classmethod
    async def close_all(cls):
        for client in cls._instances.values():
            await client.aclose()
        cls._instances.clear()


class PriceCache:
    """Ultra-fast in-memory price cache with TTL."""

    def __init__(self, ttl_seconds: float = 5.0):
        self.ttl = ttl_seconds
        self._cache: dict[str, tuple[float, float]] = {}  # mint -> (price, timestamp)

    def get(self, mint: str) -> float | None:
        entry = self._cache.get(mint)
        if entry is None:
            return None
        price, ts = entry
        if time.time() - ts > self.ttl:
            return None  # Expired
        return price

    def set(self, mint: str, price: float) -> None:
        self._cache[mint] = (price, time.time())

    def bulk_set(self, prices: dict[str, float]) -> None:
        now = time.time()
        for mint, price in prices.items():
            self._cache[mint] = (price, now)

    def clear_expired(self) -> None:
        now = time.time()
        self._cache = {
            k: v for k, v in self._cache.items()
            if now - v[1] <= self.ttl
        }


async def parallel_fetch(coros: list, max_concurrent: int = 10) -> list:
    """Execute coroutines in parallel with concurrency limit."""
    semaphore = asyncio.Semaphore(max_concurrent)

    async def limited(coro):
        async with semaphore:
            return await coro

    return await asyncio.gather(
        *(limited(c) for c in coros),
        return_exceptions=True,
    )
