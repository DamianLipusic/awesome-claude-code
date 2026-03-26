#!/usr/bin/env bash
# EmpireOS dev helper — one-command workflows
# Usage: ./dev.sh {command}

set -uo pipefail

GAME_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$GAME_DIR/server"
CLIENT_DIR="$GAME_DIR/client"
SERVER_LOG="/root/server.log"
WEB_LOG="/root/web.log"
API="http://localhost:3000"
MAX_LOG=5242880  # 5MB

R='\033[0;31m'; G='\033[0;32m'; Y='\033[0;33m'; N='\033[0m'

server_pid() { pgrep -f "tsx watch src/index.ts" 2>/dev/null | head -1 || true; }
web_pid() { pgrep -f "serve dist" 2>/dev/null | head -1 || true; }
sup_pid() { pgrep -f "supervisor.sh" 2>/dev/null | head -1 || true; }

rotate_log() {
  local f="$1"
  if [ -f "$f" ] && [ "$(stat -c%s "$f" 2>/dev/null || echo 0)" -gt "$MAX_LOG" ]; then
    mv "$f" "${f}.old"
    touch "$f"
  fi
}

wait_healthy() {
  for i in 1 2 3 4 5; do
    curl -sf "$API/health" > /dev/null 2>&1 && return 0
    sleep 1
  done
  return 1
}

case "${1:-help}" in

  start)
    pid=$(server_pid)
    if [ -n "$pid" ]; then
      echo -e "${Y}Server running (PID $pid)${N}"
    else
      rotate_log "$SERVER_LOG"
      cd "$SERVER_DIR"
      nohup npm run dev < /dev/null >> "$SERVER_LOG" 2>&1 &
      wait_healthy && echo -e "${G}Server started. OK.${N}" || echo -e "${Y}Starting... (check: dev.sh health)${N}"
    fi
    ;;

  stop)
    pkill -f "supervisor.sh" 2>/dev/null || true
    pkill -f "tsx watch src/index.ts" 2>/dev/null && echo -e "${G}Server stopped${N}" || echo -e "${Y}Not running${N}"
    ;;

  restart)
    pkill -f "tsx watch src/index.ts" 2>/dev/null || true
    rotate_log "$SERVER_LOG"
    cd "$SERVER_DIR"
    nohup npm run dev < /dev/null >> "$SERVER_LOG" 2>&1 &
    wait_healthy && echo -e "${G}Restarted. OK.${N}" || echo -e "${R}Health failed. tail -20 $SERVER_LOG${N}"
    ;;

  supervise)
    if [ -n "$(sup_pid)" ]; then
      echo -e "${Y}Supervisor already running${N}"
    else
      nohup bash "$GAME_DIR/supervisor.sh" < /dev/null >> "$SERVER_LOG" 2>&1 &
      echo -e "${G}Supervisor started (PID $!)${N}"
    fi
    ;;

  status)
    pid=$(server_pid); wpid=$(web_pid); spid=$(sup_pid)
    [ -n "$pid" ] && echo -e "Server:     ${G}UP${N} ($pid)" || echo -e "Server:     ${R}DOWN${N}"
    [ -n "$wpid" ] && echo -e "Web:        ${G}UP${N} ($wpid)" || echo -e "Web:        ${R}DOWN${N}"
    [ -n "$spid" ] && echo -e "Supervisor: ${G}UP${N} ($spid)" || echo -e "Supervisor: ${Y}OFF${N}"
    docker compose -f "$SERVER_DIR/docker-compose.yml" ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null
    ;;

  health)
    echo -n "API:   "; curl -sf "$API/health" > /dev/null 2>&1 && echo -e "${G}OK${N}" || echo -e "${R}DOWN${N}"
    echo -n "Web:   "; curl -sf "http://localhost:8080" > /dev/null 2>&1 && echo -e "${G}OK${N}" || echo -e "${R}DOWN${N}"
    echo -n "DB:    "; docker compose -f "$SERVER_DIR/docker-compose.yml" exec -T postgres pg_isready -U postgres -d economy_game > /dev/null 2>&1 && echo -e "${G}OK${N}" || echo -e "${R}DOWN${N}"
    echo -n "Redis: "; docker compose -f "$SERVER_DIR/docker-compose.yml" exec -T redis redis-cli ping > /dev/null 2>&1 && echo -e "${G}OK${N}" || echo -e "${R}DOWN${N}"
    ;;

  logs)    tail -${2:-30} "$SERVER_LOG" 2>/dev/null || echo "No log" ;;
  logsf)   tail -f "$SERVER_LOG" ;;
  errors)  grep -iE 'error|exception|fatal|crash' "$SERVER_LOG" | tail -${2:-10} ;;

  web-start)
    wpid=$(web_pid)
    if [ -n "$wpid" ]; then echo -e "${Y}Web running ($wpid)${N}"
    else cd "$CLIENT_DIR" && nohup npx serve dist -l 8080 < /dev/null > "$WEB_LOG" 2>&1 & sleep 1; echo -e "${G}Web :8080 started${N}"; fi
    ;;
  web-stop)    pkill -f "serve dist" 2>/dev/null && echo -e "${G}Web stopped${N}" || echo -e "${Y}Not running${N}" ;;
  web-restart) pkill -f "serve dist" 2>/dev/null || true; sleep 1; cd "$CLIENT_DIR" && nohup npx serve dist -l 8080 < /dev/null > "$WEB_LOG" 2>&1 & sleep 1; echo -e "${G}Web restarted${N}" ;;
  web-build)   cd "$CLIENT_DIR"; npx expo export --platform web; echo -e "${G}Build done${N}" ;;

  db)      docker compose -f "$SERVER_DIR/docker-compose.yml" exec postgres psql -U postgres economy_game ;;
  redis)   docker compose -f "$SERVER_DIR/docker-compose.yml" exec redis redis-cli ;;
  seed)    cd "$SERVER_DIR" && npm run seed ;;
  migrate) cd "$SERVER_DIR" && npm run migrate ;;

  quick-test)
    curl -sf "$API/health" | jq -c . 2>/dev/null || { echo -e "${R}API down${N}"; exit 1; }
    TOKEN=$(curl -sf -X POST "$API/api/v1/auth/login" \
      -H "Content-Type: application/json" \
      -d '{"email":"devtest@empireos.local","password":"DevTest_2024_pass!"}' 2>/dev/null | jq -r '.data.access_token // .access_token // empty' 2>/dev/null)
    [ -z "$TOKEN" ] && TOKEN=$(curl -sf -X POST "$API/api/v1/auth/register" \
      -H "Content-Type: application/json" \
      -d '{"username":"devtest","email":"devtest@empireos.local","password":"DevTest_2024_pass!"}' 2>/dev/null | jq -r '.data.access_token // .access_token // empty' 2>/dev/null)
    if [ -n "$TOKEN" ]; then
      echo -e "${G}Auth OK${N}"
      curl -sf -H "Authorization: Bearer $TOKEN" "$API/api/v1/players/dashboard" | jq -c '{cash:.data.player.cash,biz:(.data.business_overview|length),heat:.data.heat.level}' 2>/dev/null || echo "Dashboard fail"
    else
      echo -e "${R}Auth failed${N}"
    fi
    ;;

  dash-start)
    if pgrep -f "dashboard-server.js" > /dev/null 2>&1; then
      echo -e "${Y}Dashboard already running${N}"
    else
      nohup node /root/awesome-claude-code/.claude/agent/dashboard-server.js < /dev/null > /root/dashboard.log 2>&1 &
      echo -e "${G}Dashboard started on :9000${N}"
    fi
    ;;
  dash-stop) pkill -f "dashboard-server.js" 2>/dev/null && echo -e "${G}Dashboard stopped${N}" || echo -e "${Y}Not running${N}" ;;

  help|*) echo "Server:  start|stop|restart|supervise|logs [n]|logsf|errors [n]"
          echo "Web:     web-start|web-stop|web-restart|web-build"
          echo "Infra:   status|health|db|redis|dash-start|dash-stop"
          echo "Data:    migrate|seed"
          echo "Test:    quick-test" ;;
esac
