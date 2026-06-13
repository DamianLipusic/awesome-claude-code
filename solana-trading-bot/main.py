#!/usr/bin/env python3
"""Solana Memecoin Trading Bot - Main Entry Point.

Usage:
    python main.py                    # Run in paper trading mode (default)
    python main.py --mode paper       # Explicit paper trading
    python main.py --mode live        # Live trading (requires wallet)
    python main.py --backtest         # Run backtesting
    python main.py --backtest --data data/historical/
    python main.py --status           # Show current status
"""

from __future__ import annotations

import argparse
import asyncio
import json
import signal
import sys
from pathlib import Path

import yaml
from dotenv import load_dotenv

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from bot.engine import TradingEngine
from bot.backtester import Backtester
from bot.database import Database
from bot.utils.logger import setup_logging


def load_config(config_path: str = "config/config.yaml") -> dict:
    """Load configuration from YAML file."""
    path = Path(config_path)
    if not path.exists():
        print(f"Config file not found: {config_path}")
        sys.exit(1)

    with open(path) as f:
        return yaml.safe_load(f)


def show_status(config: dict) -> None:
    """Show current bot status."""
    from bot.trading.paper_trader import PaperTrader
    db = Database(config.get("data", {}).get("db_path", "data/trading_bot.db"))
    db.connect()

    trader = PaperTrader(config, db)
    summary = trader.get_portfolio_summary()

    print("\n=== Solana Trading Bot Status ===")
    print(f"  Mode:           {summary['mode']}")
    print(f"  Balance:        {summary['balance_sol']:.4f} SOL")
    print(f"  Total Value:    {summary['total_value_sol']:.4f} SOL")
    print(f"  Total PnL:      {summary['total_pnl_sol']:+.4f} SOL")
    print(f"  Open Positions: {summary['open_positions']}")
    print(f"  Total Trades:   {summary['total_trades']}")
    print(f"  Win Rate:       {summary['win_rate']}")
    print(f"  Max Drawdown:   {summary['max_drawdown']}")

    if summary.get("positions"):
        print("\n  Open Positions:")
        for p in summary["positions"]:
            print(f"    {p['symbol']}: {p['invested']:.4f} SOL "
                  f"({p['pnl_pct']}) - {p['hold_hours']}h")

    # ML Model stats
    from bot.ml_engine.model import TradingModel
    model = TradingModel(config, db)
    ml_stats = model.get_stats()
    print(f"\n  ML Model:")
    print(f"    Trained:      {ml_stats['is_trained']}")
    print(f"    Type:         {ml_stats['model_type']}")
    print(f"    Train Count:  {ml_stats['train_count']}")

    # Recent trades
    trades = db.get_completed_trades(limit=5)
    if trades:
        print(f"\n  Recent Trades:")
        for t in trades:
            emoji = "W" if t.was_profitable else "L"
            print(f"    [{emoji}] {t.symbol}: {t.pnl_pct:+.2%} "
                  f"({t.pnl_sol:+.4f} SOL) - {t.exit_reason}")

    db.close()
    print()


def run_backtest(config: dict, data_path: str | None = None) -> None:
    """Run backtesting."""
    db = Database(":memory:")  # Use in-memory DB for backtest
    db.connect()

    backtester = Backtester(config, db)

    if data_path:
        price_data = backtester.load_csv_data(data_path)
    else:
        bt_config = config.get("backtesting", {})
        default_path = bt_config.get("data_source", "data/historical/")
        price_data = backtester.load_csv_data(default_path)

    if not price_data:
        print("No historical data found. Place CSV files in data/historical/")
        print("CSV format: timestamp,open,high,low,close,volume[,mint_address]")
        db.close()
        return

    results = backtester.run_backtest(price_data)

    print("\n=== Backtest Results ===")
    for key, value in results.items():
        if key == "exit_reasons":
            print(f"  Exit Reasons:")
            for reason, count in value.items():
                print(f"    {reason}: {count}")
        else:
            print(f"  {key}: {value}")
    print()

    db.close()


def run_trading(config: dict, mode: str) -> None:
    """Run the trading bot."""
    config["mode"] = mode

    print(f"\n{'='*50}")
    print(f"  Solana Memecoin Trading Bot")
    print(f"  Mode: {'PAPER TRADING' if mode == 'paper' else 'LIVE TRADING'}")
    print(f"{'='*50}")

    if mode == "live":
        print("\n  WARNING: Live trading uses REAL SOL!")
        print("  Make sure SOLANA_PRIVATE_KEY is set in .env")
        print("  Press Ctrl+C to stop at any time.\n")

    engine = TradingEngine(config)

    # Handle graceful shutdown
    loop = asyncio.new_event_loop()

    def shutdown_handler(sig, frame):
        print("\n\nShutting down gracefully...")
        loop.call_soon_threadsafe(loop.stop)

    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)

    try:
        loop.run_until_complete(engine.start())
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        loop.run_until_complete(engine.stop())
        loop.close()


def main():
    # Load environment variables
    load_dotenv()

    parser = argparse.ArgumentParser(
        description="Solana Memecoin Trading Bot",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py                        Start paper trading (default)
  python main.py --mode live            Start live trading
  python main.py --backtest             Run backtest with default data
  python main.py --backtest --data ./my_data/
  python main.py --status               Show current status
        """,
    )

    parser.add_argument(
        "--mode", choices=["paper", "live"], default="paper",
        help="Trading mode (default: paper)",
    )
    parser.add_argument(
        "--config", default="config/config.yaml",
        help="Path to config file",
    )
    parser.add_argument(
        "--backtest", action="store_true",
        help="Run backtesting instead of live/paper trading",
    )
    parser.add_argument(
        "--data",
        help="Path to historical data for backtesting",
    )
    parser.add_argument(
        "--status", action="store_true",
        help="Show current bot status and exit",
    )

    args = parser.parse_args()

    # Load config
    config = load_config(args.config)

    # Setup logging
    monitoring = config.get("monitoring", {})
    setup_logging(
        log_level=monitoring.get("log_level", "INFO"),
        log_file=monitoring.get("log_file"),
    )

    if args.status:
        show_status(config)
    elif args.backtest:
        run_backtest(config, args.data)
    else:
        run_trading(config, args.mode)


if __name__ == "__main__":
    main()
