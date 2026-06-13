"""SQLite database for storing trades, prices, and ML training data."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

import structlog

from bot.models import PriceCandle, Position, TradeRecord, TradeSide, TradeStatus

logger = structlog.get_logger()


class Database:
    """SQLite database manager with WAL mode and batch operations."""

    def __init__(self, db_path: str = "data/trading_bot.db"):
        self.db_path = Path(db_path)
        if str(db_path) != ":memory:":
            self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.conn: sqlite3.Connection | None = None

    def connect(self) -> None:
        self.conn = sqlite3.connect(str(self.db_path))
        self.conn.row_factory = sqlite3.Row

        # Performance optimizations
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.execute("PRAGMA synchronous=NORMAL")
        self.conn.execute("PRAGMA cache_size=-64000")  # 64MB cache
        self.conn.execute("PRAGMA temp_store=MEMORY")
        self.conn.execute("PRAGMA mmap_size=268435456")  # 256MB mmap

        self._create_tables()

    def close(self) -> None:
        if self.conn:
            try:
                self.conn.execute("PRAGMA optimize")
            except Exception:
                pass
            self.conn.close()

    def _create_tables(self) -> None:
        if self.conn is None:
            raise RuntimeError("Database not connected. Call connect() first.")
        self.conn.executescript("""
            CREATE TABLE IF NOT EXISTS price_candles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mint_address TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                open REAL NOT NULL,
                high REAL NOT NULL,
                low REAL NOT NULL,
                close REAL NOT NULL,
                volume REAL NOT NULL,
                UNIQUE(mint_address, timestamp)
            );

            CREATE TABLE IF NOT EXISTS trades (
                id TEXT PRIMARY KEY,
                mint_address TEXT NOT NULL,
                symbol TEXT NOT NULL,
                side TEXT NOT NULL,
                entry_price REAL NOT NULL,
                exit_price REAL DEFAULT 0,
                amount REAL NOT NULL,
                sol_invested REAL NOT NULL,
                pnl_sol REAL DEFAULT 0,
                pnl_pct REAL DEFAULT 0,
                entry_time TEXT NOT NULL,
                exit_time TEXT,
                hold_duration_minutes REAL DEFAULT 0,
                exit_reason TEXT DEFAULT '',
                confidence_at_entry REAL DEFAULT 0,
                features_at_entry TEXT DEFAULT '{}',
                was_profitable INTEGER DEFAULT 0,
                status TEXT DEFAULT 'open'
            );

            CREATE TABLE IF NOT EXISTS token_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mint_address TEXT NOT NULL,
                symbol TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                price_sol REAL,
                price_usd REAL,
                liquidity_usd REAL,
                volume_24h_usd REAL,
                holder_count INTEGER,
                market_cap_usd REAL,
                features TEXT DEFAULT '{}'
            );

            CREATE TABLE IF NOT EXISTS ml_training_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                mint_address TEXT NOT NULL,
                features TEXT NOT NULL,
                label REAL NOT NULL,
                label_type TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS portfolio_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                balance_sol REAL NOT NULL,
                total_invested_sol REAL DEFAULT 0,
                total_pnl_sol REAL DEFAULT 0,
                open_positions_count INTEGER DEFAULT 0,
                total_trades INTEGER DEFAULT 0,
                win_rate REAL DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS idx_candles_mint_ts
                ON price_candles(mint_address, timestamp);
            CREATE INDEX IF NOT EXISTS idx_trades_mint
                ON trades(mint_address);
            CREATE INDEX IF NOT EXISTS idx_trades_status
                ON trades(status);
            CREATE INDEX IF NOT EXISTS idx_trades_exit_time
                ON trades(exit_time);
            CREATE INDEX IF NOT EXISTS idx_snapshots_mint_ts
                ON token_snapshots(mint_address, timestamp);
            CREATE INDEX IF NOT EXISTS idx_ml_data_type_ts
                ON ml_training_data(label_type, timestamp);
            CREATE INDEX IF NOT EXISTS idx_portfolio_ts
                ON portfolio_snapshots(timestamp);
        """)
        self.conn.commit()

    # --- Price Candles ---

    def save_candle(self, candle: PriceCandle) -> None:
        if self.conn is None:
            raise RuntimeError("Database not connected. Call connect() first.")
        self.conn.execute(
            """INSERT OR REPLACE INTO price_candles
               (mint_address, timestamp, open, high, low, close, volume)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (candle.mint_address, candle.timestamp.isoformat(),
             candle.open, candle.high, candle.low, candle.close, candle.volume),
        )
        self.conn.commit()

    def save_candles_batch(self, candles: list[PriceCandle]) -> None:
        """Batch insert candles for better performance."""
        if self.conn is None:
            raise RuntimeError("Database not connected. Call connect() first.")
        if not candles:
            return
        self.conn.executemany(
            """INSERT OR REPLACE INTO price_candles
               (mint_address, timestamp, open, high, low, close, volume)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            [(c.mint_address, c.timestamp.isoformat(),
              c.open, c.high, c.low, c.close, c.volume) for c in candles],
        )
        self.conn.commit()

    def get_candles(self, mint_address: str, limit: int = 500) -> list[PriceCandle]:
        if self.conn is None:
            raise RuntimeError("Database not connected. Call connect() first.")
        rows = self.conn.execute(
            """SELECT * FROM price_candles
               WHERE mint_address = ?
               ORDER BY timestamp DESC LIMIT ?""",
            (mint_address, limit),
        ).fetchall()
        return [
            PriceCandle(
                timestamp=datetime.fromisoformat(r["timestamp"]),
                open=r["open"], high=r["high"], low=r["low"],
                close=r["close"], volume=r["volume"],
                mint_address=r["mint_address"],
            )
            for r in reversed(rows)
        ]

    # --- Trades ---

    def save_trade(self, trade: TradeRecord) -> None:
        if self.conn is None:
            raise RuntimeError("Database not connected. Call connect() first.")
        self.conn.execute(
            """INSERT OR REPLACE INTO trades
               (id, mint_address, symbol, side, entry_price, exit_price,
                amount, sol_invested, pnl_sol, pnl_pct, entry_time, exit_time,
                hold_duration_minutes, exit_reason, confidence_at_entry,
                features_at_entry, was_profitable, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (trade.id, trade.mint_address, trade.symbol, trade.side.value,
             trade.entry_price, trade.exit_price, trade.amount, trade.sol_invested,
             trade.pnl_sol, trade.pnl_pct, trade.entry_time.isoformat(),
             trade.exit_time.isoformat() if trade.exit_time else None,
             trade.hold_duration_minutes, trade.exit_reason,
             trade.confidence_at_entry, json.dumps(trade.features_at_entry),
             int(trade.was_profitable), "closed"),
        )
        self.conn.commit()

    def save_open_position(self, pos: Position) -> None:
        if self.conn is None:
            raise RuntimeError("Database not connected. Call connect() first.")
        self.conn.execute(
            """INSERT OR REPLACE INTO trades
               (id, mint_address, symbol, side, entry_price, exit_price,
                amount, sol_invested, pnl_sol, pnl_pct, entry_time, exit_time,
                hold_duration_minutes, exit_reason, confidence_at_entry,
                features_at_entry, was_profitable, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (pos.id, pos.mint_address, pos.symbol, "buy",
             pos.entry_price_sol, 0, pos.amount_tokens, pos.sol_invested,
             0, 0, pos.entry_time.isoformat(), None, 0, "",
             pos.confidence_at_entry, "{}", 0, "open"),
        )
        self.conn.commit()

    def get_completed_trades(self, limit: int = 1000) -> list[TradeRecord]:
        if self.conn is None:
            raise RuntimeError("Database not connected. Call connect() first.")
        rows = self.conn.execute(
            """SELECT * FROM trades WHERE status = 'closed'
               ORDER BY exit_time DESC LIMIT ?""",
            (limit,),
        ).fetchall()
        return [
            TradeRecord(
                id=r["id"], mint_address=r["mint_address"], symbol=r["symbol"],
                side=TradeSide(r["side"]), entry_price=r["entry_price"],
                exit_price=r["exit_price"], amount=r["amount"],
                sol_invested=r["sol_invested"], pnl_sol=r["pnl_sol"],
                pnl_pct=r["pnl_pct"],
                entry_time=datetime.fromisoformat(r["entry_time"]),
                exit_time=datetime.fromisoformat(r["exit_time"]) if r["exit_time"] else datetime.utcnow(),
                hold_duration_minutes=r["hold_duration_minutes"],
                exit_reason=r["exit_reason"],
                confidence_at_entry=r["confidence_at_entry"],
                features_at_entry=json.loads(r["features_at_entry"] or "{}"),
                was_profitable=bool(r["was_profitable"]),
            )
            for r in rows
        ]

    def get_trade_stats(self) -> dict:
        """Get aggregate trade statistics."""
        if self.conn is None:
            raise RuntimeError("Database not connected. Call connect() first.")
        row = self.conn.execute("""
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN was_profitable = 1 THEN 1 ELSE 0 END) as wins,
                SUM(pnl_sol) as total_pnl,
                AVG(pnl_pct) as avg_pnl_pct,
                AVG(hold_duration_minutes) as avg_hold_min,
                MAX(pnl_pct) as best_trade_pct,
                MIN(pnl_pct) as worst_trade_pct
            FROM trades WHERE status = 'closed'
        """).fetchone()
        if not row or row["total"] == 0:
            return {"total": 0}
        return dict(row)

    # --- ML Training Data ---

    def save_training_sample(self, mint_address: str, features: dict,
                              label: float, label_type: str = "return") -> None:
        if self.conn is None:
            raise RuntimeError("Database not connected. Call connect() first.")
        self.conn.execute(
            """INSERT INTO ml_training_data
               (timestamp, mint_address, features, label, label_type)
               VALUES (?, ?, ?, ?, ?)""",
            (datetime.utcnow().isoformat(), mint_address,
             json.dumps(features), label, label_type),
        )
        self.conn.commit()

    def get_training_data(self, label_type: str = "return",
                          limit: int = 10000) -> list[dict]:
        if self.conn is None:
            raise RuntimeError("Database not connected. Call connect() first.")
        rows = self.conn.execute(
            """SELECT features, label FROM ml_training_data
               WHERE label_type = ?
               ORDER BY timestamp DESC LIMIT ?""",
            (label_type, limit),
        ).fetchall()
        return [
            {"features": json.loads(r["features"]), "label": r["label"]}
            for r in rows
        ]

    def get_training_data_count(self, label_type: str = "return") -> int:
        """Get count of training samples without loading all data."""
        if self.conn is None:
            raise RuntimeError("Database not connected. Call connect() first.")
        row = self.conn.execute(
            "SELECT COUNT(*) as cnt FROM ml_training_data WHERE label_type = ?",
            (label_type,),
        ).fetchone()
        return row["cnt"] if row else 0

    # --- Portfolio Snapshots ---

    def save_portfolio_snapshot(self, balance: float, invested: float,
                                 pnl: float, positions: int,
                                 trades: int, win_rate: float) -> None:
        if self.conn is None:
            raise RuntimeError("Database not connected. Call connect() first.")
        self.conn.execute(
            """INSERT INTO portfolio_snapshots
               (timestamp, balance_sol, total_invested_sol, total_pnl_sol,
                open_positions_count, total_trades, win_rate)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (datetime.utcnow().isoformat(), balance, invested, pnl,
             positions, trades, win_rate),
        )
        self.conn.commit()

    def get_portfolio_history(self, days: int = 7) -> list[dict]:
        """Get portfolio snapshots for the last N days."""
        if self.conn is None:
            raise RuntimeError("Database not connected. Call connect() first.")
        cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
        rows = self.conn.execute(
            """SELECT * FROM portfolio_snapshots
               WHERE timestamp > ? ORDER BY timestamp""",
            (cutoff,),
        ).fetchall()
        return [dict(r) for r in rows]

    # --- Maintenance ---

    def cleanup_old_data(self, days: int = 30) -> None:
        """Remove old data to prevent database bloat."""
        if self.conn is None:
            raise RuntimeError("Database not connected. Call connect() first.")
        cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()

        deleted_candles = self.conn.execute(
            "DELETE FROM price_candles WHERE timestamp < ?", (cutoff,)
        ).rowcount
        deleted_snapshots = self.conn.execute(
            "DELETE FROM token_snapshots WHERE timestamp < ?", (cutoff,)
        ).rowcount

        # Keep more training data (90 days)
        training_cutoff = (datetime.utcnow() - timedelta(days=90)).isoformat()
        deleted_training = self.conn.execute(
            "DELETE FROM ml_training_data WHERE timestamp < ?", (training_cutoff,)
        ).rowcount

        self.conn.commit()

        logger.info("db_cleanup",
                     candles=deleted_candles,
                     snapshots=deleted_snapshots,
                     training=deleted_training)

    def optimize(self) -> None:
        """Run VACUUM and ANALYZE for optimal performance."""
        if self.conn is None:
            raise RuntimeError("Database not connected. Call connect() first.")
        try:
            self.conn.execute("ANALYZE")
            # Only VACUUM occasionally as it rewrites the whole DB
            size = self.db_path.stat().st_size if self.db_path.exists() else 0
            if size > 100 * 1024 * 1024:  # > 100MB
                self.conn.execute("VACUUM")
                logger.info("db_vacuumed", size_mb=round(size / 1024 / 1024, 1))
        except Exception as e:
            logger.error("db_optimize_error", error=str(e))

    def get_db_stats(self) -> dict:
        """Get database size and row count statistics."""
        if self.conn is None:
            raise RuntimeError("Database not connected. Call connect() first.")
        stats = {}
        for table in ["price_candles", "trades", "token_snapshots",
                       "ml_training_data", "portfolio_snapshots"]:
            row = self.conn.execute(f"SELECT COUNT(*) as cnt FROM {table}").fetchone()
            stats[table] = row["cnt"] if row else 0

        if self.db_path.exists():
            stats["size_mb"] = round(self.db_path.stat().st_size / 1024 / 1024, 2)

        return stats
