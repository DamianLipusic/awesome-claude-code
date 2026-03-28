#!/usr/bin/env bash
# Lightweight process supervisor for EmpireOS dev server
# Restarts tsx watch if it dies. Rotates logs. No dependencies.
# Usage: nohup bash game/supervisor.sh &

SERVER_DIR="/root/awesome-claude-code/game/server"
LOG="/root/server.log"
MAX_LOG_SIZE=5242880  # 5MB
HEALTH_URL="http://localhost:3000/health"
CHECK_INTERVAL=10

rotate_log() {
  if [ -f "$LOG" ] && [ "$(stat -c%s "$LOG" 2>/dev/null || echo 0)" -gt "$MAX_LOG_SIZE" ]; then
    mv "$LOG" "${LOG}.old"
    touch "$LOG"
  fi
}

start_server() {
  cd "$SERVER_DIR"
  npm run dev < /dev/null >> "$LOG" 2>&1 &
  echo $! > /tmp/empireos-server.pid
}

echo "[$(date -u +%H:%M:%S)] Supervisor started" >> "$LOG"
start_server

while true; do
  sleep "$CHECK_INTERVAL"
  rotate_log

  # Check if tsx watch is alive
  if ! pgrep -f "tsx watch src/index.ts" > /dev/null 2>&1; then
    echo "[$(date -u +%H:%M:%S)] Server process dead — restarting" >> "$LOG"
    start_server
    sleep 3
  fi
done
