"""Base class for data collectors."""

from __future__ import annotations

import asyncio
import time
from abc import ABC, abstractmethod

import httpx
import structlog

from bot.models import TokenInfo, PriceCandle

logger = structlog.get_logger()


class BaseCollector(ABC):
    """Base data collector with HTTP client, retry logic, and circuit breaker."""

    def __init__(self, base_url: str, rate_limit: float = 0.5):
        self.base_url = base_url.rstrip("/")
        self.rate_limit = rate_limit
        self._last_request_time = 0.0
        self.client: httpx.AsyncClient | None = None

        # Circuit breaker state
        self._consecutive_failures = 0
        self._circuit_open_until: float = 0.0
        self._circuit_threshold = 5  # Open circuit after 5 failures
        self._circuit_reset_time = 60.0  # Reset after 60s

        # Stats
        self._request_count = 0
        self._error_count = 0

    async def start(self) -> None:
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=20.0,
            headers={"User-Agent": "SolanaTradeBot/2.0"},
            limits=httpx.Limits(
                max_connections=20,
                max_keepalive_connections=10,
                keepalive_expiry=30,
            ),
            http2=True,
        )

    async def stop(self) -> None:
        if self.client:
            await self.client.aclose()
            self.client = None

    async def _get(self, path: str, params: dict | None = None,
                   retries: int = 3) -> dict | list | None:
        """HTTP GET with rate limiting, retries, and circuit breaker."""
        # Circuit breaker check
        if self._is_circuit_open():
            logger.debug("circuit_open", source=self.__class__.__name__)
            return None

        if not self.client:
            await self.start()

        # Rate limiting
        now = time.monotonic()
        wait = self.rate_limit - (now - self._last_request_time)
        if wait > 0:
            await asyncio.sleep(wait)

        for attempt in range(retries):
            try:
                assert self.client is not None
                self._request_count += 1
                resp = await self.client.get(path, params=params)
                self._last_request_time = time.monotonic()

                if resp.status_code == 429:
                    wait_time = min(2 ** (attempt + 1), 30)
                    logger.warning("rate_limited", source=self.__class__.__name__,
                                   wait=wait_time)
                    await asyncio.sleep(wait_time)
                    continue

                resp.raise_for_status()
                self._on_success()
                return resp.json()

            except httpx.HTTPStatusError as e:
                self._error_count += 1
                logger.error("http_error", source=self.__class__.__name__,
                             status=e.response.status_code, path=path)
                if e.response.status_code >= 500 and attempt < retries - 1:
                    await asyncio.sleep(2 ** attempt)
                elif e.response.status_code < 500:
                    # Client error, don't retry
                    self._on_failure()
                    return None
            except (httpx.ConnectError, httpx.ReadTimeout, httpx.PoolTimeout) as e:
                self._error_count += 1
                logger.error("connection_error", source=self.__class__.__name__,
                             error=str(e), path=path, attempt=attempt + 1)
                if attempt < retries - 1:
                    await asyncio.sleep(2 ** attempt)
            except Exception as e:
                self._error_count += 1
                logger.error("unexpected_error", source=self.__class__.__name__,
                             error=str(e), path=path)
                break

        self._on_failure()
        return None

    def _is_circuit_open(self) -> bool:
        if self._consecutive_failures >= self._circuit_threshold:
            if time.monotonic() < self._circuit_open_until:
                return True
            # Half-open: allow one attempt
            self._consecutive_failures = self._circuit_threshold - 1
        return False

    def _on_success(self) -> None:
        self._consecutive_failures = 0

    def _on_failure(self) -> None:
        self._consecutive_failures += 1
        if self._consecutive_failures >= self._circuit_threshold:
            self._circuit_open_until = time.monotonic() + self._circuit_reset_time
            logger.warning("circuit_breaker_open",
                           source=self.__class__.__name__,
                           reset_in=f"{self._circuit_reset_time}s")

    def get_stats(self) -> dict:
        return {
            "source": self.__class__.__name__,
            "requests": self._request_count,
            "errors": self._error_count,
            "error_rate": f"{self._error_count / max(1, self._request_count):.1%}",
            "circuit_open": self._is_circuit_open(),
        }

    @abstractmethod
    async def get_trending_tokens(self, limit: int = 50) -> list[TokenInfo]:
        ...

    @abstractmethod
    async def get_token_price(self, mint_address: str) -> float | None:
        ...

    @abstractmethod
    async def get_token_info(self, mint_address: str) -> TokenInfo | None:
        ...
