#!/bin/bash
# EmpireOS — VPS Deploy Script
# Run this on your Hostinger VPS after cloning the repo.
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
fail() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo ""
echo "╔══════════════════════════════════════╗"
echo "║       EmpireOS — Deploy Script       ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ─── Checks ───────────────────────────────────────────────────
command -v docker        >/dev/null 2>&1 || fail "Docker not installed. Run: curl -fsSL https://get.docker.com | sh"
command -v docker-compose >/dev/null 2>&1 || docker compose version >/dev/null 2>&1 || fail "Docker Compose not installed."

if [ ! -f server/.env ]; then
  fail "server/.env not found.\nRun: cp server/.env.prod.example server/.env && nano server/.env"
fi

# Load env
set -a; source server/.env; set +a

[ -z "$JWT_SECRET" ]          && fail "JWT_SECRET is not set in server/.env"
[ "$JWT_SECRET" = "CHANGE_ME_64_CHAR_RANDOM_STRING" ] && fail "JWT_SECRET is still the example value. Generate one:\n  openssl rand -hex 64"
[ -z "$POSTGRES_PASSWORD" ]   && fail "POSTGRES_PASSWORD is not set in server/.env"
[ "$POSTGRES_PASSWORD" = "CHANGE_ME_STRONG_PASSWORD" ] && fail "POSTGRES_PASSWORD is still the example value. Set a real password."
ok "Environment checks passed"

# Support both 'docker-compose' and 'docker compose'
DC="docker-compose"
command -v docker-compose >/dev/null 2>&1 || DC="docker compose"

# ─── Build + start ────────────────────────────────────────────
echo ""
echo "[1/4] Building and starting containers..."
$DC -f docker-compose.prod.yml --env-file server/.env up -d --build
ok "Containers started"

# ─── Wait for DB ──────────────────────────────────────────────
echo ""
echo "[2/4] Waiting for PostgreSQL to be ready..."
for i in $(seq 1 30); do
  if $DC -f docker-compose.prod.yml exec -T postgres \
      pg_isready -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-economy_game}" >/dev/null 2>&1; then
    ok "PostgreSQL is ready"
    break
  fi
  if [ "$i" = "30" ]; then
    fail "PostgreSQL did not become ready in time."
  fi
  sleep 2
done

# ─── Migrations ───────────────────────────────────────────────
echo ""
echo "[3/4] Running database migrations..."
$DC -f docker-compose.prod.yml exec -T server node dist/db/migrate.js
ok "Migrations complete"

# ─── Seed ─────────────────────────────────────────────────────
echo ""
echo "[4/4] Seeding database (NPC players, market, price history)..."
$DC -f docker-compose.prod.yml exec -T server node dist/db/seed.js
ok "Seed complete"

# ─── Summary ──────────────────────────────────────────────────
VPS_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null || echo "YOUR_VPS_IP")

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║              Deploy Complete!                        ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Server:  http://${VPS_IP}:3000                "
echo "║  Health:  http://${VPS_IP}:3000/health          "
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Start the Expo app with:                            ║"
echo "║                                                      ║"
echo "║  cd game/client                                      ║"
echo "║  API_BASE_URL=http://${VPS_IP}:3000/api/v1 \\ "
echo "║  WS_BASE_URL=ws://${VPS_IP}:3000/ws \\         "
echo "║  npx expo start --tunnel                             ║"
echo "║                                                      ║"
echo "║  Friends scan the QR with Expo Go app                ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
