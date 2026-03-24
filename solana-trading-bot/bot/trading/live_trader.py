"""Live trading engine using Solana blockchain."""

from __future__ import annotations

import os
import uuid
from datetime import datetime

import structlog

from bot.database import Database
from bot.models import (
    BotMode, Position, PortfolioState, TradeRecord,
    TradeSignal, TradeSide, TradeStatus,
)

logger = structlog.get_logger()

# Solana constants
SOL_MINT = "So11111111111111111111111111111111111111112"
LAMPORTS_PER_SOL = 1_000_000_000


class LiveTrader:
    """Executes real trades on Solana via Jupiter aggregator with scaled exits."""

    def __init__(self, config: dict, db: Database):
        self.config = config
        self.db = db

        wallet_config = config.get("wallet", {})
        self.max_sol_per_trade = wallet_config.get("max_sol_per_trade", 0.1)
        self.total_portfolio_sol = wallet_config.get("total_portfolio_sol", 1.0)
        self.reserve_sol = wallet_config.get("reserve_sol", 0.5)

        strategy = config.get("strategy", {})
        self.take_profit = strategy.get("take_profit_pct", 0.50)
        self.stop_loss = strategy.get("stop_loss_pct", 0.20)
        self.trailing_stop = strategy.get("trailing_stop_pct", 0.10)
        self.max_hold_hours = strategy.get("max_hold_time_hours", 24)
        self.max_positions = strategy.get("max_positions", 5)

        # Scaled exit levels
        self.scaled_exits = [
            (0.25, 0.30),  # Sell 30% at 25% profit
            (0.50, 0.30),  # Sell 30% at 50% profit
            (1.00, 0.40),  # Sell remaining at 100% profit
        ]

        self.portfolio = PortfolioState(
            mode=BotMode.LIVE,
            balance_sol=0,
        )

        self._keypair = None
        self._public_key: str = ""
        self._initialized = False
        self._exit_levels_hit: dict[str, set[int]] = {}
        self._rpc_url: str = ""

    async def initialize(self) -> bool:
        """Initialize wallet and Solana connection."""
        private_key = os.getenv("SOLANA_PRIVATE_KEY", "")
        if not private_key:
            logger.error("no_private_key",
                         msg="Set SOLANA_PRIVATE_KEY in .env file")
            return False

        try:
            import base58
            from solders.keypair import Keypair

            key_bytes = base58.b58decode(private_key)
            self._keypair = Keypair.from_bytes(key_bytes)
            self._public_key = str(self._keypair.pubkey())

            self._rpc_url = self.config.get("solana", {}).get(
                "rpc_url", "https://api.mainnet-beta.solana.com"
            )

            # Get SOL balance
            balance = await self._get_sol_balance()
            self.portfolio.balance_sol = balance
            self.portfolio.peak_balance_sol = balance

            self._initialized = True
            logger.info("live_trader_initialized",
                        wallet=self._public_key[:8] + "...",
                        balance=f"{balance:.4f} SOL")
            return True

        except ImportError:
            logger.error("missing_deps",
                         msg="Install solana-py and solders for live trading")
            return False
        except Exception as e:
            logger.error("init_error", error=str(e))
            return False

    async def _get_sol_balance(self) -> float:
        """Get wallet SOL balance."""
        try:
            from solana.rpc.async_api import AsyncClient
            from solders.pubkey import Pubkey

            async with AsyncClient(self._rpc_url) as client:
                pubkey = Pubkey.from_string(self._public_key)
                resp = await client.get_balance(pubkey)
                return resp.value / LAMPORTS_PER_SOL
        except Exception as e:
            logger.error("balance_error", error=str(e))
            return 0.0

    async def execute_buy(self, signal: TradeSignal,
                          sol_amount: float) -> Position | None:
        """Execute a real buy on Solana via Jupiter."""
        if not self._initialized:
            logger.error("not_initialized")
            return None

        if len(self.portfolio.open_positions) >= self.max_positions:
            logger.info("max_positions_reached")
            return None

        # Safety checks
        sol_amount = min(sol_amount, self.max_sol_per_trade)
        available = self.portfolio.balance_sol - self.reserve_sol
        if sol_amount > available:
            sol_amount = available

        if sol_amount <= 0.001:
            logger.info("insufficient_balance")
            return None

        try:
            import httpx
            from solana.rpc.async_api import AsyncClient
            from solders.transaction import VersionedTransaction
            import base64

            amount_lamports = int(sol_amount * LAMPORTS_PER_SOL)

            # 1. Get Jupiter quote
            async with httpx.AsyncClient(timeout=30) as http:
                quote_resp = await http.get(
                    "https://api.jup.ag/quote/v6",
                    params={
                        "inputMint": SOL_MINT,
                        "outputMint": signal.mint_address,
                        "amount": str(amount_lamports),
                        "slippageBps": "300",
                    },
                )
                quote_resp.raise_for_status()
                quote = quote_resp.json()

                # 2. Get swap transaction
                swap_resp = await http.post(
                    "https://api.jup.ag/swap/v6",
                    json={
                        "quoteResponse": quote,
                        "userPublicKey": self._public_key,
                        "wrapAndUnwrapSol": True,
                        "dynamicComputeUnitLimit": True,
                        "prioritizationFeeLamports": "auto",
                    },
                )
                swap_resp.raise_for_status()
                swap_data = swap_resp.json()

            # 3. Sign and send transaction
            swap_tx_bytes = base64.b64decode(swap_data["swapTransaction"])
            tx = VersionedTransaction.from_bytes(swap_tx_bytes)
            signed_tx = VersionedTransaction(tx.message, [self._keypair])

            async with AsyncClient(self._rpc_url) as client:
                tx_sig = await client.send_transaction(signed_tx)
                signature = str(tx_sig.value)

            # 4. Create position record
            out_amount = int(quote.get("outAmount", 0))
            token_decimals = int(quote.get("outputMint", {}).get("decimals", 9))
            tokens_received = out_amount / (10 ** token_decimals) if out_amount else 0
            price = sol_amount / tokens_received if tokens_received > 0 else 0

            position = Position(
                id=signature[:8],
                mint_address=signal.mint_address,
                symbol=signal.symbol,
                entry_price_sol=price,
                amount_tokens=tokens_received,
                sol_invested=sol_amount,
                entry_time=datetime.utcnow(),
                current_price_sol=price,
                highest_price_sol=price,
                confidence_at_entry=signal.confidence,
            )

            self.portfolio.open_positions.append(position)
            self.portfolio.balance_sol -= sol_amount
            self._exit_levels_hit[position.id] = set()
            self.db.save_open_position(position)

            logger.info("live_buy",
                        symbol=signal.symbol,
                        sol=f"{sol_amount:.4f}",
                        tx=signature[:16],
                        confidence=f"{signal.confidence:.2%}")

            return position

        except Exception as e:
            logger.error("live_buy_error",
                         symbol=signal.symbol, error=str(e))
            return None

    async def execute_sell(self, position: Position, current_price: float,
                           reason: str = "manual",
                           sell_fraction: float = 1.0) -> TradeRecord | None:
        """Execute a real sell on Solana via Jupiter, optionally partial."""
        if not self._initialized:
            return None

        tokens_to_sell = position.amount_tokens * sell_fraction
        sol_invested_portion = position.sol_invested * sell_fraction

        try:
            import httpx
            from solana.rpc.async_api import AsyncClient
            from solders.transaction import VersionedTransaction
            import base64

            # Get token decimals (default 9 for most, 6 for pump.fun)
            decimals = 9
            amount_raw = int(tokens_to_sell * (10 ** decimals))

            # 1. Get Jupiter quote (token -> SOL)
            async with httpx.AsyncClient(timeout=30) as http:
                quote_resp = await http.get(
                    "https://api.jup.ag/quote/v6",
                    params={
                        "inputMint": position.mint_address,
                        "outputMint": SOL_MINT,
                        "amount": str(amount_raw),
                        "slippageBps": "300",
                    },
                )
                quote_resp.raise_for_status()
                quote = quote_resp.json()

                swap_resp = await http.post(
                    "https://api.jup.ag/swap/v6",
                    json={
                        "quoteResponse": quote,
                        "userPublicKey": self._public_key,
                        "wrapAndUnwrapSol": True,
                        "dynamicComputeUnitLimit": True,
                        "prioritizationFeeLamports": "auto",
                    },
                )
                swap_resp.raise_for_status()
                swap_data = swap_resp.json()

            # 2. Sign and send
            swap_tx_bytes = base64.b64decode(swap_data["swapTransaction"])
            tx = VersionedTransaction.from_bytes(swap_tx_bytes)
            signed_tx = VersionedTransaction(tx.message, [self._keypair])

            async with AsyncClient(self._rpc_url) as client:
                tx_sig = await client.send_transaction(signed_tx)

            # 3. Calculate PnL
            sol_received = int(quote.get("outAmount", 0)) / LAMPORTS_PER_SOL
            pnl_sol = sol_received - sol_invested_portion
            pnl_pct = pnl_sol / sol_invested_portion if sol_invested_portion > 0 else 0

            now = datetime.utcnow()
            hold_minutes = (now - position.entry_time).total_seconds() / 60

            trade = TradeRecord(
                id=position.id + (f"_p{int(sell_fraction*100)}" if sell_fraction < 1.0 else ""),
                mint_address=position.mint_address,
                symbol=position.symbol,
                side=TradeSide.SELL,
                entry_price=position.entry_price_sol,
                exit_price=current_price,
                amount=tokens_to_sell,
                sol_invested=sol_invested_portion,
                pnl_sol=pnl_sol,
                pnl_pct=pnl_pct,
                entry_time=position.entry_time,
                exit_time=now,
                hold_duration_minutes=hold_minutes,
                exit_reason=reason,
                confidence_at_entry=position.confidence_at_entry,
                was_profitable=pnl_sol > 0,
            )

            # Update portfolio
            self.portfolio.balance_sol += sol_received
            self.portfolio.total_pnl_sol += pnl_sol

            if sell_fraction >= 1.0:
                self.portfolio.total_trades += 1
                if pnl_sol > 0:
                    self.portfolio.winning_trades += 1
                else:
                    self.portfolio.losing_trades += 1
                self.portfolio.open_positions = [
                    p for p in self.portfolio.open_positions if p.id != position.id
                ]
                self._exit_levels_hit.pop(position.id, None)
            else:
                position.amount_tokens -= tokens_to_sell
                position.sol_invested -= sol_invested_portion

            self.db.save_trade(trade)

            prefix = "partial_" if sell_fraction < 1.0 else ""
            logger.info(f"live_{prefix}sell",
                        symbol=position.symbol,
                        pnl_sol=f"{pnl_sol:+.4f}",
                        fraction=f"{sell_fraction:.0%}",
                        reason=reason)

            return trade

        except Exception as e:
            logger.error("live_sell_error",
                         symbol=position.symbol, error=str(e))
            return None

    async def check_exits(self, prices: dict[str, float]) -> list[TradeRecord]:
        """Check all positions for exit conditions with scaled exits."""
        closed_trades = []

        for position in list(self.portfolio.open_positions):
            price = prices.get(position.mint_address)
            if price is None or price <= 0:
                continue

            position.current_price_sol = price
            if price > position.highest_price_sol:
                position.highest_price_sol = price

            if position.entry_price_sol <= 0:
                continue

            pnl_pct = (price - position.entry_price_sol) / position.entry_price_sol

            # 1. Stop loss
            if pnl_pct <= -self.stop_loss:
                trade = await self.execute_sell(position, price, "stop_loss")
                if trade:
                    closed_trades.append(trade)
                continue

            # 2. Max hold time
            hold_hours = (datetime.utcnow() - position.entry_time).total_seconds() / 3600
            if hold_hours >= self.max_hold_hours:
                trade = await self.execute_sell(position, price, "max_hold_time")
                if trade:
                    closed_trades.append(trade)
                continue

            # 3. Scaled profit taking
            levels_hit = self._exit_levels_hit.get(position.id, set())
            for level_idx, (profit_level, sell_pct) in enumerate(self.scaled_exits):
                if level_idx in levels_hit:
                    continue
                if pnl_pct >= profit_level:
                    trade = await self.execute_sell(
                        position, price,
                        f"take_profit_{int(profit_level*100)}pct",
                        sell_fraction=sell_pct,
                    )
                    if trade:
                        closed_trades.append(trade)
                        levels_hit.add(level_idx)
                    self._exit_levels_hit[position.id] = levels_hit

            # 4. Trailing stop
            if position.highest_price_sol > position.entry_price_sol * 1.1:
                drawdown = (position.highest_price_sol - price) / position.highest_price_sol
                if drawdown >= self.trailing_stop:
                    trade = await self.execute_sell(position, price, "trailing_stop")
                    if trade:
                        closed_trades.append(trade)

        return closed_trades

    def get_portfolio_summary(self) -> dict:
        """Get current portfolio summary."""
        total_value = self.portfolio.balance_sol + sum(
            p.sol_invested * (1 + p.unrealized_pnl_pct)
            for p in self.portfolio.open_positions
        )
        return {
            "mode": "LIVE",
            "wallet": self._public_key[:8] + "..." if self._public_key else "N/A",
            "balance_sol": round(self.portfolio.balance_sol, 4),
            "total_value_sol": round(total_value, 4),
            "total_pnl_sol": round(self.portfolio.total_pnl_sol, 4),
            "open_positions": len(self.portfolio.open_positions),
            "total_trades": self.portfolio.total_trades,
            "win_rate": f"{self.portfolio.win_rate:.1%}",
        }
