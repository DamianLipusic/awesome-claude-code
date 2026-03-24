#!/bin/bash
# EmpireOS — VPS Deploy Script
# Run this on your Hostinger VPS after cloning the repo.
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh

set -e

echo "=== EmpireOS Deploy ==="

# ─── 1. Check .env ────────────────────────────────────────────
if [ ! -f server/.env ]; then
  echo "ERROR: server/.env not found."
  echo "Run: cp server/.env.prod.example server/.env"
  echo "Then fill in your secrets before deploying."
  exit 1
fi

# Load env for JWT_SECRET check
set -a; source server/.env; set +a

if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "CHANGE_ME_64_CHAR_RANDOM_STRING" ]; then
  echo "ERROR: JWT_SECRET is not set in server/.env"
  echo "Generate one with: openssl rand -hex 64"
  exit 1
fi

# ─── 2. Build + start containers ──────────────────────────────
echo "[1/3] Building and starting containers..."
docker-compose -f docker-compose.prod.yml --env-file server/.env up -d --build

# ─── 3. Wait for postgres ─────────────────────────────────────
echo "[2/3] Waiting for PostgreSQL to be ready..."
sleep 5

# ─── 4. Run migrations ────────────────────────────────────────
echo "[3/3] Running database migrations..."
docker-compose -f docker-compose.prod.yml exec server \
  node -e "
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sql = fs.readFileSync('/app/src/db/migrations/001_initial_schema.sql', 'utf8');
pool.query(sql).then(() => { console.log('Migration OK'); pool.end(); }).catch(e => { console.error(e.message); pool.end(); process.exit(1); });
"

echo ""
echo "=== Deploy complete ==="
echo "Server running at: http://$(curl -s ifconfig.me 2>/dev/null || echo YOUR_VPS_IP):3000"
echo ""
echo "=== To connect from the Expo app ==="
VPS_IP=$(curl -s ifconfig.me 2>/dev/null || echo "YOUR_VPS_IP")
echo "  API_BASE_URL=http://${VPS_IP}:3000/api/v1 \\"
echo "  WS_BASE_URL=ws://${VPS_IP}:3000/ws \\"
echo "  npx expo start --tunnel"
