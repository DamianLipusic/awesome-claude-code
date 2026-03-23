"""Base class for data collectors."""

from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod

import httpx
import structlog

from bot.models import TokenInfo, PriceCandle

logger = structlog.get_logger()


class BaseCollector(ABC):
    """Base data collector with HTTP client and retry logic."""

    def __init__(self, base_url: str, rate_limit: float = 0.5):
        self.base_url = base_url.rstrip("/")
        self.rate_limit = rate_limit  # seconds between requests
        self._last_request_time = 0.0
        self.client: httpx.AsyncClient | None = None

    async def start(self) -> None:
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=30.0,
            headers={"User-Agent": "SolanaTradeBot/1.0"},
        )

    async def stop(self) -> None:
        if self.client:
            await self.client.aclose()

    async def _get(self, path: str, params: dict | None = None,
                   retries: int = 3) -> dict | list | None:
        """HTTP GET with rate limiting and retries."""
        if not self.client:
            await self.start()

        # Rate limiting
        now = asyncio.get_event_loop().time()
        wait = self.rate_limit - (now - self._last_request_time)
        if wait > 0:
            await asyncio.sleep(wait)

        for attempt in range(retries):
            try:
                assert self.client is not None
                resp = await self.client.get(path, params=params)
                self._last_request_time = asyncio.get_event_loop().time()

                if resp.status_code == 429:  # Rate limited
                    wait_time = 2 ** (attempt + 1)
                    logger.warning("rate_limited", source=self.__class__.__name__,
                                   wait=wait_time)
                    await asyncio.sleep(wait_time)
                    continue

                resp.raise_for_status()
                return resp.json()

            except httpx.HTTPStatusError as e:
                logger.error("http_error", source=self.__class__.__name__,
                             status=e.response.status_code, path=path)
                if attempt < retries - 1:
                    await asyncio.sleep(2 ** attempt)
            except (httpx.ConnectError, httpx.ReadTimeout) as e:
                logger.error("connection_error", source=self.__class__.__name__,
                             error=str(e), path=path)
                if attempt < retries - 1:
                    await asyncio.sleep(2 ** attempt)

        return None

    @abstractmethod
    async def get_trending_tokens(self, limit: int = 50) -> list[TokenInfo]:
        """Get trending/new tokens."""
        ...

    @abstractmethod
    async def get_token_price(self, mint_address: str) -> float | None:
        """Get current price in SOL."""
        ...

    @abstractmethod
    async def get_token_info(self, mint_address: str) -> TokenInfo | None:
        """Get detailed token information."""
        ...
