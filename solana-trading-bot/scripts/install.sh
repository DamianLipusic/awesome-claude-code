#!/bin/bash
# Solana Trading Bot - VPS Installation Script
# Run: chmod +x scripts/install.sh && ./scripts/install.sh

set -e

echo "=========================================="
echo "  Solana Trading Bot - VPS Installation"
echo "=========================================="

# Check Python version
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
echo "Python version: $PYTHON_VERSION"

REQUIRED_VERSION="3.10"
if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$PYTHON_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "Error: Python 3.10+ required"
    exit 1
fi

# Create virtual environment
echo ""
echo "[1/5] Creating virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Install dependencies
echo "[2/5] Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Create directories
echo "[3/5] Creating directories..."
mkdir -p data/historical logs

# Setup .env file
echo "[4/5] Setting up environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "  Created .env file - EDIT IT with your settings!"
else
    echo "  .env already exists, skipping"
fi

# Setup systemd service
echo "[5/5] Setting up systemd service..."
BOT_DIR=$(pwd)
BOT_USER=$(whoami)

cat > /tmp/solana-trading-bot.service << EOF
[Unit]
Description=Solana Memecoin Trading Bot
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=$BOT_USER
WorkingDirectory=$BOT_DIR
ExecStart=$BOT_DIR/venv/bin/python main.py --mode paper
Restart=always
RestartSec=30
StandardOutput=journal
StandardError=journal

# Environment
EnvironmentFile=$BOT_DIR/.env

# Resource limits
MemoryMax=512M
CPUQuota=80%

[Install]
WantedBy=multi-user.target
EOF

echo ""
echo "=========================================="
echo "  Installation Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Edit .env file with your settings:"
echo "     nano .env"
echo ""
echo "  2. Test with paper trading:"
echo "     source venv/bin/activate"
echo "     python main.py --mode paper"
echo ""
echo "  3. Run backtesting (if you have data):"
echo "     python main.py --backtest"
echo ""
echo "  4. Install as systemd service (optional):"
echo "     sudo cp /tmp/solana-trading-bot.service /etc/systemd/system/"
echo "     sudo systemctl daemon-reload"
echo "     sudo systemctl enable solana-trading-bot"
echo "     sudo systemctl start solana-trading-bot"
echo ""
echo "  5. Check status:"
echo "     python main.py --status"
echo "     # or if running as service:"
echo "     sudo systemctl status solana-trading-bot"
echo "     sudo journalctl -u solana-trading-bot -f"
echo ""
echo "  6. Switch to live trading (when ready):"
echo "     Edit config/config.yaml: mode: \"live\""
echo "     Set SOLANA_PRIVATE_KEY in .env"
echo "     Restart the bot"
echo ""
