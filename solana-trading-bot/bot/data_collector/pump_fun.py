"""Pump.fun data collector for new memecoin launches."""

from __future__ import annotations

from datetime import datetime

import structlog

from bot.data_collector.base import BaseCollector
from bot.models import TokenInfo

logger = structlog.get_logger()


class PumpFunCollector(BaseCollector):
    """Collect new token launches from pump.fun."""

    def __init__(self):
        super().__init__(
            base_url="https://frontend-api-v3.pump.fun",
            rate_limit=1.0,  # Be conservative with pump.fun
        )

    async def get_trending_tokens(self, limit: int = 50) -> list[TokenInfo]:
        """Get latest token launches from pump.fun."""
        data = await self._get(
            "/coins/currently-live",
            params={"limit": str(limit), "offset": "0",
                     "includeNsfw": "false"},
        )
        if not data or not isinstance(data, list):
            # Try alternative endpoint
            data = await self._get(
                "/coins/latest",
                params={"limit": str(limit), "offset": "0"},
            )
        if not data or not isinstance(data, list):
            return []

        tokens = []
        for item in data:
            try:
                created = None
                if item.get("created_timestamp"):
                    created = datetime.utcfromtimestamp(
                        item["created_timestamp"] / 1000
                    )

                market_cap = float(item.get("usd_market_cap", 0))
                token = TokenInfo(
                    mint_address=item.get("mint", ""),
                    symbol=item.get("symbol", "UNKNOWN"),
                    name=item.get("name", ""),
                    decimals=6,  # pump.fun tokens are 6 decimals
                    market_cap_usd=market_cap,
                    created_at=created,
                    source="pump_fun",
                )
                tokens.append(token)
            except (KeyError, TypeError, ValueError):
                continue

        logger.info("pump_fun_tokens_fetched", count=len(tokens))
        return tokens

    async def get_token_price(self, mint_address: str) -> float | None:
        """Get token price from pump.fun."""
        data = await self._get(f"/coins/{mint_address}")
        if not data or not isinstance(data, dict):
            return None

        try:
            # pump.fun returns virtual SOL/token reserves
            virt_sol = float(data.get("virtual_sol_reserves", 0))
            virt_token = float(data.get("virtual_token_reserves", 0))
            if virt_token > 0 and virt_sol > 0:
                return virt_sol / virt_token
        except (ValueError, TypeError):
            pass
        return None

    async def get_token_info(self, mint_address: str) -> TokenInfo | None:
        """Get detailed token info from pump.fun."""
        data = await self._get(f"/coins/{mint_address}")
        if not data or not isinstance(data, dict):
            return None

        try:
            created = None
            if data.get("created_timestamp"):
                created = datetime.utcfromtimestamp(
                    data["created_timestamp"] / 1000
                )

            virt_sol = float(data.get("virtual_sol_reserves", 0))
            virt_token = float(data.get("virtual_token_reserves", 0))
            price_sol = virt_sol / virt_token if virt_token > 0 else 0

            return TokenInfo(
                mint_address=mint_address,
                symbol=data.get("symbol", "UNKNOWN"),
                name=data.get("name", ""),
                decimals=6,
                price_sol=price_sol,
                market_cap_usd=float(data.get("usd_market_cap", 0)),
                created_at=created,
                source="pump_fun",
            )
        except (KeyError, TypeError, ValueError) as e:
            logger.error("pump_fun_parse_error", error=str(e))
            return None

    async def get_token_trades(self, mint_address: str,
                                limit: int = 50) -> list[dict]:
        """Get recent trades for a pump.fun token."""
        data = await self._get(
            f"/coins/{mint_address}/trades",
            params={"limit": str(limit), "offset": "0"},
        )
        if not data or not isinstance(data, list):
            return []
        return data
