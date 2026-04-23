#!/bin/bash
# Quick monitoring script for the trading bot
# Usage: ./scripts/monitor.sh

set -e

BOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$BOT_DIR"

echo "=========================================="
echo "  Solana Trading Bot - Monitor"
echo "=========================================="
echo ""

# Check if running as systemd service
if systemctl is-active --quiet solana-trading-bot 2>/dev/null; then
    echo "Service Status: RUNNING"
    echo "  Uptime: $(systemctl show solana-trading-bot --property=ActiveEnterTimestamp --value)"
    echo "  Memory: $(systemctl show solana-trading-bot --property=MemoryCurrent --value 2>/dev/null || echo 'N/A')"
else
    echo "Service Status: NOT RUNNING (or not installed as service)"
    # Check if running as process
    if pgrep -f "python.*main.py" > /dev/null 2>&1; then
        PID=$(pgrep -f "python.*main.py" | head -1)
        echo "  Running as process PID: $PID"
    fi
fi

echo ""

# Show bot status
if [ -f venv/bin/python ]; then
    source venv/bin/activate
    python main.py --status 2>/dev/null || echo "Could not get bot status"
elif command -v python3 &> /dev/null; then
    python3 main.py --status 2>/dev/null || echo "Could not get bot status"
fi

# Show recent logs
echo ""
echo "--- Recent Logs ---"
if [ -f logs/trading_bot.log ]; then
    tail -20 logs/trading_bot.log
elif systemctl is-active --quiet solana-trading-bot 2>/dev/null; then
    journalctl -u solana-trading-bot --no-pager -n 20
else
    echo "No logs found"
fi
