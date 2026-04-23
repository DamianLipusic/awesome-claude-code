"""Jupiter aggregator data collector."""

from __future__ import annotations

from datetime import datetime

import structlog

from bot.data_collector.base import BaseCollector
from bot.models import TokenInfo

logger = structlog.get_logger()

# SOL mint address
SOL_MINT = "So11111111111111111111111111111111111111112"


class JupiterCollector(BaseCollector):
    """Collect token data from Jupiter aggregator API."""

    def __init__(self):
        super().__init__(
            base_url="https://api.jup.ag",
            rate_limit=0.3,
        )

    async def get_trending_tokens(self, limit: int = 50) -> list[TokenInfo]:
        """Get tokens available on Jupiter with price data."""
        # Get token list with prices
        data = await self._get("/tokens/v1/tagged/verified")
        if not data or not isinstance(data, list):
            return []

        tokens = []
        for item in data[:limit]:
            try:
                token = TokenInfo(
                    mint_address=item.get("address", ""),
                    symbol=item.get("symbol", "UNKNOWN"),
                    name=item.get("name", ""),
                    decimals=item.get("decimals", 9),
                    source="jupiter",
                )
                tokens.append(token)
            except (KeyError, TypeError):
                continue

        logger.info("jupiter_tokens_fetched", count=len(tokens))
        return tokens

    async def get_token_price(self, mint_address: str) -> float | None:
        """Get token price in SOL via Jupiter price API."""
        data = await self._get(
            "/price/v2",
            params={"ids": mint_address, "vsToken": SOL_MINT},
        )
        if not data or "data" not in data:
            return None

        token_data = data["data"].get(mint_address)
        if not token_data or "price" not in token_data:
            return None

        try:
            return float(token_data["price"])
        except (ValueError, TypeError):
            return None

    async def get_token_info(self, mint_address: str) -> TokenInfo | None:
        """Get token info from Jupiter."""
        price = await self.get_token_price(mint_address)
        if price is None:
            return None

        return TokenInfo(
            mint_address=mint_address,
            symbol="",
            name="",
            price_sol=price,
            source="jupiter",
        )

    async def get_quote(self, input_mint: str, output_mint: str,
                        amount_lamports: int, slippage_bps: int = 200) -> dict | None:
        """Get swap quote from Jupiter."""
        data = await self._get(
            "/quote/v6",
            params={
                "inputMint": input_mint,
                "outputMint": output_mint,
                "amount": str(amount_lamports),
                "slippageBps": str(slippage_bps),
                "onlyDirectRoutes": "false",
            },
        )
        return data if isinstance(data, dict) else None

    async def get_swap_transaction(self, quote: dict,
                                    user_public_key: str) -> dict | None:
        """Get serialized swap transaction from Jupiter."""
        if not self.client:
            await self.start()
        if self.client is None:
            return None

        try:
            resp = await self.client.post(
                "/swap/v6",
                json={
                    "quoteResponse": quote,
                    "userPublicKey": user_public_key,
                    "wrapAndUnwrapSol": True,
                    "dynamicComputeUnitLimit": True,
                    "prioritizationFeeLamports": "auto",
                },
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.error("jupiter_swap_error", error=str(e))
            return None
