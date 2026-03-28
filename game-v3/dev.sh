#!/usr/bin/env bash
set -euo pipefail

# ─── EmpireOS V3 Dev Helper ─────────────────────────────────────
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$DIR/server"
CLIENT_DIR="$DIR/client"
SERVER_LOG="$HOME/v3-server.log"
WEB_LOG="$HOME/v3-web.log"
SERVER_PORT=3001
WEB_PORT=8081

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[v3]${NC} $*"; }
ok()    { echo -e "${GREEN}[v3]${NC} $*"; }
warn()  { echo -e "${YELLOW}[v3]${NC} $*"; }
err()   { echo -e "${RED}[v3]${NC} $*"; }

case "${1:-help}" in

  start)
    if lsof -i ":$SERVER_PORT" &>/dev/null; then
      warn "Server already running on port $SERVER_PORT"
    else
      info "Starting server on port $SERVER_PORT..."
      cd "$SERVER_DIR"
      nohup npx tsx watch src/index.ts >> "$SERVER_LOG" 2>&1 &
      sleep 2
      if lsof -i ":$SERVER_PORT" &>/dev/null; then
        ok "Server started (PID $(lsof -ti ":$SERVER_PORT" | head -1))"
      else
        err "Server failed to start. Check $SERVER_LOG"
      fi
    fi
    ;;

  stop)
    info "Stopping server..."
    pkill -f "tsx watch src/index.ts.*v3" 2>/dev/null || true
    # Also kill by port
    lsof -ti ":$SERVER_PORT" 2>/dev/null | xargs -r kill 2>/dev/null || true
    sleep 1
    if lsof -i ":$SERVER_PORT" &>/dev/null; then
      err "Server still running, force killing..."
      lsof -ti ":$SERVER_PORT" | xargs -r kill -9 2>/dev/null || true
    fi
    ok "Server stopped"
    ;;

  restart)
    "$0" stop
    sleep 1
    "$0" start
    sleep 1
    "$0" health
    ;;

  health)
    info "Checking health..."
    # API
    if curl -sf "http://localhost:$SERVER_PORT/health" -o /dev/null 2>/dev/null; then
      HEALTH=$(curl -sf "http://localhost:$SERVER_PORT/health")
      ok "API: $HEALTH"
    else
      err "API: not responding on port $SERVER_PORT"
    fi
    # Web
    if curl -sf "http://localhost:$WEB_PORT/" -o /dev/null 2>/dev/null; then
      ok "Web: running on port $WEB_PORT"
    else
      warn "Web: not running on port $WEB_PORT"
    fi
    # DB
    if psql "postgresql://postgres:postgres@localhost:5432/empireos_v3" -c "SELECT 1" &>/dev/null; then
      ok "DB: empireos_v3 connected"
    else
      err "DB: cannot connect to empireos_v3"
    fi
    # Redis
    if redis-cli ping &>/dev/null 2>&1; then
      ok "Redis: connected"
    else
      warn "Redis: not available"
    fi
    ;;

  migrate)
    info "Running migrations..."
    cd "$SERVER_DIR"
    npx tsx src/db/migrate.ts
    ;;

  seed)
    info "Running seeds..."
    cd "$SERVER_DIR"
    npx tsx src/db/seed.ts
    ;;

  logs)
    LINES="${2:-30}"
    tail -n "$LINES" "$SERVER_LOG"
    ;;

  logsf)
    tail -f "$SERVER_LOG"
    ;;

  web-build)
    info "Building web export..."
    cd "$CLIENT_DIR"
    npx expo export --platform web
    ok "Web build complete"
    ;;

  web-start)
    if lsof -i ":$WEB_PORT" &>/dev/null; then
      warn "Web server already running on port $WEB_PORT"
    else
      info "Starting web server on port $WEB_PORT..."
      cd "$CLIENT_DIR"
      nohup npx serve dist -l "$WEB_PORT" >> "$WEB_LOG" 2>&1 &
      sleep 2
      if lsof -i ":$WEB_PORT" &>/dev/null; then
        ok "Web server started"
      else
        err "Web server failed to start. Check $WEB_LOG"
      fi
    fi
    ;;

  web-stop)
    info "Stopping web server..."
    lsof -ti ":$WEB_PORT" 2>/dev/null | xargs -r kill 2>/dev/null || true
    ok "Web server stopped"
    ;;

  web-restart)
    "$0" web-stop
    sleep 1
    "$0" web-start
    ;;

  db)
    info "Opening psql shell..."
    psql "postgresql://postgres:postgres@localhost:5432/empireos_v3"
    ;;

  status)
    info "=== EmpireOS V3 Status ==="
    echo ""
    # Server
    if lsof -i ":$SERVER_PORT" &>/dev/null; then
      ok "Server: running on port $SERVER_PORT (PID $(lsof -ti ":$SERVER_PORT" | head -1))"
    else
      warn "Server: not running"
    fi
    # Web
    if lsof -i ":$WEB_PORT" &>/dev/null; then
      ok "Web: running on port $WEB_PORT"
    else
      warn "Web: not running"
    fi
    # Docker
    echo ""
    info "Docker containers:"
    docker ps --format "  {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || warn "Docker not available"
    echo ""
    info "Ports:"
    echo "  $SERVER_PORT (API)  $WEB_PORT (Web)  5432 (DB)  6379 (Redis)"
    ;;

  help|*)
    echo "EmpireOS V3 Dev Helper"
    echo ""
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  start        Start the game server"
    echo "  stop         Stop the game server"
    echo "  restart      Restart server + health check"
    echo "  health       Check all services"
    echo "  migrate      Run DB migrations"
    echo "  seed         Run DB seeds"
    echo "  logs [N]     Show last N lines of server log"
    echo "  logsf        Follow server log"
    echo "  web-build    Build Expo web export"
    echo "  web-start    Start web static server"
    echo "  web-stop     Stop web static server"
    echo "  web-restart  Restart web static server"
    echo "  db           Open psql shell"
    echo "  status       Show system status"
    ;;

esac
