"""Speed optimization utilities for latency tracking."""

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
                if elapsed_ms > 5000:
                    logger.warning("slow_operation",
                                   op=operation, ms=round(elapsed_ms))
        return wrapper
    return decorator


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
