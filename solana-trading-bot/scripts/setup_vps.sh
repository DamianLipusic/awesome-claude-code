#!/bin/bash
# ==============================================
# Solana Trading Bot - Full VPS Auto-Setup
# ==============================================
# Usage (on your VPS):
#   git clone https://github.com/DamianLipusic/awesome-claude-code.git
#   cd awesome-claude-code/solana-trading-bot
#   chmod +x scripts/setup_vps.sh
#   sudo bash scripts/setup_vps.sh
# ==============================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info() { echo -e "${BLUE}[i]${NC} $1"; }

echo ""
echo "============================================"
echo "  Solana Memecoin Trading Bot - VPS Setup"
echo "============================================"
echo ""

# ---- Check root ----
if [ "$EUID" -ne 0 ]; then
    err "Please run as root: sudo bash scripts/setup_vps.sh"
fi

BOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BOT_USER="solbot"
BOT_HOME="/opt/solana-trading-bot"

# ---- 1. System dependencies ----
info "Step 1/8: Installing system dependencies..."
apt-get update -qq
apt-get install -y -qq python3 python3-venv python3-pip git curl jq > /dev/null 2>&1
log "System dependencies installed"

# ---- 2. Verify Python version ----
PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
PYTHON_MAJOR=$(echo "$PYTHON_VERSION" | cut -d. -f1)
PYTHON_MINOR=$(echo "$PYTHON_VERSION" | cut -d. -f2)

if [ "$PYTHON_MAJOR" -lt 3 ] || [ "$PYTHON_MINOR" -lt 10 ]; then
    err "Python 3.10+ required, found $PYTHON_VERSION"
fi
log "Python $PYTHON_VERSION detected"

# ---- 3. Create bot user ----
info "Step 2/8: Creating bot user..."
if ! id "$BOT_USER" &>/dev/null; then
    useradd -r -m -s /bin/bash -d /home/$BOT_USER $BOT_USER
    log "User '$BOT_USER' created"
else
    log "User '$BOT_USER' already exists"
fi

# ---- 4. Copy bot to /opt ----
info "Step 3/8: Installing bot to $BOT_HOME..."
mkdir -p "$BOT_HOME"
cp -r "$BOT_DIR"/* "$BOT_HOME"/
cp -r "$BOT_DIR"/.env.example "$BOT_HOME"/ 2>/dev/null || true
cp -r "$BOT_DIR"/.gitignore "$BOT_HOME"/ 2>/dev/null || true
log "Bot files copied to $BOT_HOME"

# ---- 5. Create venv & install deps ----
info "Step 4/8: Creating virtual environment & installing dependencies..."
cd "$BOT_HOME"
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt -q
deactivate
log "Dependencies installed"

# ---- 6. Create directories & config ----
info "Step 5/8: Creating directories & config..."
mkdir -p "$BOT_HOME/data/historical"
mkdir -p "$BOT_HOME/logs"
mkdir -p "$BOT_HOME/models"

if [ ! -f "$BOT_HOME/.env" ]; then
    cp "$BOT_HOME/.env.example" "$BOT_HOME/.env"
    warn ".env created from template - EDIT IT: nano $BOT_HOME/.env"
else
    log ".env already exists"
fi

# Set ownership
chown -R $BOT_USER:$BOT_USER "$BOT_HOME"
log "Directories created & permissions set"

# ---- 7. Setup systemd service ----
info "Step 6/8: Setting up systemd service..."
cat > /etc/systemd/system/solana-trading-bot.service << EOF
[Unit]
Description=Solana Memecoin Trading Bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$BOT_USER
Group=$BOT_USER
WorkingDirectory=$BOT_HOME
ExecStart=$BOT_HOME/venv/bin/python main.py --mode paper
Restart=always
RestartSec=30
StandardOutput=journal
StandardError=journal
EnvironmentFile=$BOT_HOME/.env

# Security hardening
NoNewPrivileges=yes
ProtectSystem=strict
ReadWritePaths=$BOT_HOME/data $BOT_HOME/logs $BOT_HOME/models
PrivateTmp=yes

# Resource limits
MemoryMax=512M
CPUQuota=80%

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable solana-trading-bot
log "Systemd service installed & enabled"

# ---- 8. Setup logrotate ----
info "Step 7/8: Setting up log rotation..."
cat > /etc/logrotate.d/solana-trading-bot << EOF
$BOT_HOME/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
EOF
log "Log rotation configured"

# ---- 9. Firewall (optional) ----
info "Step 8/8: Checking firewall..."
if command -v ufw &>/dev/null; then
    ufw allow 22/tcp > /dev/null 2>&1 || true
    log "SSH port allowed in UFW"
else
    log "No UFW detected, skipping firewall config"
fi

# ---- Done ----
echo ""
echo "============================================"
echo -e "  ${GREEN}Setup Complete!${NC}"
echo "============================================"
echo ""
echo "Bot installed at: $BOT_HOME"
echo "Running as user:  $BOT_USER"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo ""
echo "  1. Edit your config:"
echo "     nano $BOT_HOME/.env"
echo "     nano $BOT_HOME/config/config.yaml"
echo ""
echo "  2. Start paper trading:"
echo "     sudo systemctl start solana-trading-bot"
echo ""
echo "  3. Watch logs:"
echo "     sudo journalctl -u solana-trading-bot -f"
echo ""
echo "  4. Check status:"
echo "     sudo systemctl status solana-trading-bot"
echo ""
echo "  5. Switch to live (when ready):"
echo "     Edit config/config.yaml -> mode: \"live\""
echo "     Set SOLANA_PRIVATE_KEY in .env"
echo "     sudo systemctl restart solana-trading-bot"
echo ""
echo -e "${RED}WICHTIG: Der Bot startet im PAPER-TRADING Modus!${NC}"
echo -e "${RED}Kein echtes Geld bis du mode: \"live\" setzt.${NC}"
echo ""
