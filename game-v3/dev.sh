#!/usr/bin/env bash
set -euo pipefail

# ─── EmpireOS V3 Dev Helper ─────────────────────────────────────
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$DIR/server"
CLIENT_DIR="$DIR/client"
SERVER_LOG="$HOME/v3-server.log"
WEB_LOG="$HOME/v3-web.log"
API_PORT=3000
WEB_PORT=8080
DB_URL="postgresql://postgres:postgres@localhost:5432/empireos_v3"

G='\033[0;32m'; R='\033[0;31m'; Y='\033[1;33m'; C='\033[0;36m'; N='\033[0m'
ok()   { echo -e "${G}[v3]${N} $*"; }
err()  { echo -e "${R}[v3]${N} $*"; }
info() { echo -e "${C}[v3]${N} $*"; }

server_pid() { ss -tlnp 2>/dev/null | grep ":${API_PORT} " | grep -oP 'pid=\K[0-9]+' | head -1; }
web_pid()    { ss -tlnp 2>/dev/null | grep ":${WEB_PORT} " | grep -oP 'pid=\K[0-9]+' | head -1; }

case "${1:-help}" in

  start)
    if [ -n "$(server_pid)" ]; then ok "Server already running (PID $(server_pid))"; else
      info "Starting server on :$API_PORT..."
      cd "$SERVER_DIR" && PORT=$API_PORT nohup npx tsx src/index.ts >> "$SERVER_LOG" 2>&1 &
      sleep 4
      [ -n "$(server_pid)" ] && ok "Server started (PID $(server_pid))" || err "Failed. Check: tail $SERVER_LOG"
    fi
    ;;

  stop)
    pkill -9 -f "game-v3/server.*tsx" 2>/dev/null || true
    sleep 1; ok "Server stopped"
    ;;

  restart)
    "$0" stop; sleep 2; "$0" start; sleep 2; "$0" health
    ;;

  health)
    echo -n "API:   "; curl -sf "http://localhost:$API_PORT/health" > /dev/null 2>&1 && echo -e "${G}OK${N}" || echo -e "${R}DOWN${N}"
    echo -n "Web:   "; curl -sf "http://localhost:$WEB_PORT/" > /dev/null 2>&1 && echo -e "${G}OK${N}" || echo -e "${R}DOWN${N}"
    echo -n "DB:    "; ss -tlnp | grep -q ":5432 " && echo -e "${G}OK${N}" || echo -e "${R}DOWN${N}"
    echo -n "Redis: "; ss -tlnp | grep -q ":6379 " && echo -e "${G}OK${N}" || echo -e "${R}DOWN${N}"
    ;;

  status)
    "$0" health
    echo ""
    info "Server PID: $(server_pid || echo 'not running')"
    info "Web PID: $(web_pid || echo 'not running')"
    curl -sf "http://localhost:$API_PORT/dev/snapshot" 2>/dev/null | jq '.' || true
    ;;

  logs)   tail -${2:-30} "$SERVER_LOG" 2>/dev/null || echo "No log" ;;
  logsf)  tail -f "$SERVER_LOG" ;;

  migrate)
    info "Running migrations..."
    cd "$SERVER_DIR" && DATABASE_URL="$DB_URL" npx tsx src/db/migrate.ts
    ;;

  seed)
    info "Seeding..."
    cd "$SERVER_DIR"
    DATABASE_URL="$DB_URL" npx tsx src/db/seed.ts
    DATABASE_URL="$DB_URL" npx tsx src/db/add-recipes.ts
    DATABASE_URL="$DB_URL" npx tsx src/db/seed-discovery.ts
    ok "Seed complete"
    ;;

  reset)
    info "Wiping all player data..."
    cd "$SERVER_DIR" && DATABASE_URL="$DB_URL" npx tsx src/db/reset.ts
    "$0" seed
    ok "Reset complete"
    ;;

  test)
    info "Running playtest..."
    cd "$DIR" && bash test-playtest.sh
    ;;

  build)
    info "Building web client..."
    cd "$CLIENT_DIR" && npx expo export --platform web
    # Restore PWA files
    cp /tmp/manifest.json dist/ 2>/dev/null || true
    cp /tmp/icon-192.svg dist/ 2>/dev/null || true
    cp /tmp/icon-512.svg dist/ 2>/dev/null || true
    # Add PWA meta to index.html
    sed -i 's|<title>EmpireOS V3</title>|<title>EmpireOS V3</title>\n    <link rel="manifest" href="/manifest.json" /><meta name="theme-color" content="#030712" /><meta name="apple-mobile-web-app-capable" content="yes" /><link rel="icon" type="image/svg+xml" href="/icon-192.svg" />|' dist/index.html
    ok "Build complete"
    ;;

  web-start)
    if [ -n "$(web_pid)" ]; then ok "Web already running (PID $(web_pid))"; else
      info "Starting web on :$WEB_PORT..."
      cd "$CLIENT_DIR" && nohup npx serve dist -l $WEB_PORT -s >> "$WEB_LOG" 2>&1 &
      sleep 2
      [ -n "$(web_pid)" ] && ok "Web started" || err "Failed. Check: tail $WEB_LOG"
    fi
    ;;

  web-stop)
    pkill -f "serve.*$WEB_PORT" 2>/dev/null || true
    sleep 1; ok "Web stopped"
    ;;

  web-restart) "$0" web-stop; sleep 1; "$0" web-start ;;

  deploy)
    info "Full deploy..."
    "$0" stop
    "$0" build
    "$0" start
    "$0" web-stop
    "$0" web-start
    sleep 2
    "$0" health
    ok "Deploy complete"
    ;;

  quick-test)
    info "Quick smoke test..."
    curl -sf "http://localhost:$API_PORT/health" | jq -r '.status' || { err "API down"; exit 1; }
    T=$(curl -sf "http://localhost:$API_PORT/api/v1/auth/register" -H "Content-Type: application/json" -d "{\"username\":\"smoke_$RANDOM\",\"password\":\"test12345\",\"email\":\"smoke_$RANDOM@t.com\"}" | jq -r '.data.access_token')
    curl -sf "http://localhost:$API_PORT/api/v1/dashboard" -H "Authorization: Bearer $T" | jq -r '.data.player.cash' | grep -q "75000" && ok "Smoke test PASS" || err "Smoke test FAIL"
    ;;

  help|*)
    cat <<HELP
EmpireOS V3 Dev Helper

  start         Start game server (:$API_PORT)
  stop          Stop game server
  restart       Stop + start + health
  health        Check all services
  status        Full status + snapshot
  logs [N]      Last N lines of server log
  logsf         Follow server log
  migrate       Run DB migrations
  seed          Seed DB (items, recipes, locations, employees, discovery)
  reset         Wipe all players + re-seed
  test          Run 24-test integration suite
  build         Build Expo web export + PWA
  web-start     Start web server (:$WEB_PORT)
  web-stop      Stop web server
  web-restart   Restart web server
  deploy        Full deploy (stop → build → start → web)
  quick-test    Smoke test (register + dashboard)
HELP
    ;;
esac
