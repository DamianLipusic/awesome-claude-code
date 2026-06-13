"""Raydium DEX data collector."""

from __future__ import annotations

from datetime import datetime

import structlog

from bot.data_collector.base import BaseCollector
from bot.models import TokenInfo

logger = structlog.get_logger()


class RaydiumCollector(BaseCollector):
    """Collect token and pool data from Raydium."""

    def __init__(self):
        super().__init__(
            base_url="https://api-v3.raydium.io",
            rate_limit=0.5,
        )

    async def get_trending_tokens(self, limit: int = 50) -> list[TokenInfo]:
        """Get new/trending pools on Raydium."""
        data = await self._get(
            "/pools/info/list",
            params={
                "poolSortField": "volume24h",
                "sortType": "desc",
                "pageSize": str(limit),
                "page": "1",
            },
        )
        if not data or "data" not in data:
            return []

        pool_list = data["data"].get("data", [])
        tokens = []
        for pool in pool_list:
            try:
                mint_a = pool.get("mintA", {})
                mint_b = pool.get("mintB", {})

                # We want the non-SOL token
                sol_mint = "So11111111111111111111111111111111111111112"
                if mint_a.get("address") == sol_mint:
                    target = mint_b
                elif mint_b.get("address") == sol_mint:
                    target = mint_a
                else:
                    continue

                token = TokenInfo(
                    mint_address=target.get("address", ""),
                    symbol=target.get("symbol", "UNKNOWN"),
                    name=target.get("name", ""),
                    decimals=target.get("decimals", 9),
                    liquidity_usd=float(pool.get("tvl", 0)),
                    volume_24h_usd=float(pool.get("volume24h", 0)),
                    pool_address=pool.get("id", ""),
                    source="raydium",
                )
                tokens.append(token)
            except (KeyError, TypeError, ValueError):
                continue

        logger.info("raydium_tokens_fetched", count=len(tokens))
        return tokens

    async def get_token_price(self, mint_address: str) -> float | None:
        """Get token price from Raydium pools."""
        data = await self._get(
            "/pools/info/mint",
            params={"mint1": mint_address, "poolSortField": "liquidity",
                     "sortType": "desc", "pageSize": "1"},
        )
        if not data or "data" not in data:
            return None

        pools = data["data"].get("data", [])
        if not pools:
            return None

        pool = pools[0]
        try:
            price = float(pool.get("price", 0))
            return price if price > 0 else None
        except (ValueError, TypeError):
            return None

    async def get_token_info(self, mint_address: str) -> TokenInfo | None:
        """Get token info from Raydium pools."""
        data = await self._get(
            "/pools/info/mint",
            params={"mint1": mint_address, "poolSortField": "liquidity",
                     "sortType": "desc", "pageSize": "1"},
        )
        if not data or "data" not in data:
            return None

        pools = data["data"].get("data", [])
        if not pools:
            return None

        pool = pools[0]
        mint_a = pool.get("mintA", {})
        mint_b = pool.get("mintB", {})
        sol_mint = "So11111111111111111111111111111111111111112"

        target = mint_b if mint_a.get("address") == sol_mint else mint_a

        return TokenInfo(
            mint_address=target.get("address", mint_address),
            symbol=target.get("symbol", "UNKNOWN"),
            name=target.get("name", ""),
            decimals=target.get("decimals", 9),
            liquidity_usd=float(pool.get("tvl", 0)),
            volume_24h_usd=float(pool.get("volume24h", 0)),
            price_sol=float(pool.get("price", 0)),
            pool_address=pool.get("id", ""),
            source="raydium",
        )
