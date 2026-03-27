#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# EmpireOS Project Intelligence Updater
# ═══════════════════════════════════════════════════════════════
# Usage:
#   ./update.sh validate          — Run validation and sync results
#   ./update.sh health            — Update health status
#   ./update.sh log "message"     — Append to execution log
#   ./update.sh task-start T015   — Mark task as running
#   ./update.sh task-done T015    — Mark task as done
#   ./update.sh task-fail T015    — Mark task as failed + create issue
#   ./update.sh status            — Show project status summary
#   ./update.sh full              — Full status + validate + sync
# ═══════════════════════════════════════════════════════════════

set -uo pipefail

GAME_DIR="$(cd "$(dirname "$0")/.." && pwd)"
INTEL_DIR="$GAME_DIR/.intel"
STATE_FILE="$INTEL_DIR/project_state.json"
TASKS_FILE="$INTEL_DIR/tasks.json"
EXEC_LOG="$INTEL_DIR/execution.log"
VALIDATION_RESULTS="$GAME_DIR/tests/validation-results/latest.json"

API="http://localhost:3000"
WEB="http://localhost:8080"
NOW=$(date -Iseconds)
NOW_SHORT=$(date '+%Y-%m-%dT%H:%M')

R='\033[0;31m'; G='\033[0;32m'; Y='\033[0;33m'; C='\033[0;36m'; B='\033[1m'; N='\033[0m'

# ─── Helpers ────────────────────────────────────────────────

log_action() {
  echo "[$NOW_SHORT] $1" >> "$EXEC_LOG"
}

update_state_field() {
  local key="$1"
  local value="$2"
  python3 -c "
import json
with open('$STATE_FILE') as f:
    d = json.load(f)
keys = '$key'.split('.')
obj = d
for k in keys[:-1]:
    obj = obj[k]
obj[keys[-1]] = $value
d['last_updated'] = '$NOW'
with open('$STATE_FILE', 'w') as f:
    json.dump(d, f, indent=2)
" 2>/dev/null
}

update_task_status() {
  local task_id="$1"
  local new_status="$2"
  python3 -c "
import json
with open('$TASKS_FILE') as f:
    d = json.load(f)
for t in d['tasks']:
    if t['id'] == '$task_id':
        t['status'] = '$new_status'
        if '$new_status' == 'done':
            t['completed_at'] = '$(date +%Y-%m-%d)'
        break
# Recount
d['meta']['done'] = sum(1 for t in d['tasks'] if t['status'] == 'done')
d['meta']['running'] = sum(1 for t in d['tasks'] if t['status'] == 'running')
d['meta']['pending'] = sum(1 for t in d['tasks'] if t['status'] == 'pending')
d['meta']['failed'] = sum(1 for t in d['tasks'] if t['status'] == 'failed')
d['meta']['last_updated'] = '$NOW'
with open('$TASKS_FILE', 'w') as f:
    json.dump(d, f, indent=2)
" 2>/dev/null
}

# ─── Commands ───────────────────────────────────────────────

cmd_health() {
  echo -e "${B}${C}Checking system health...${N}"

  local api_ok="false" web_ok="false" db_ok="false"

  # API
  if curl -sf "$API/health" > /dev/null 2>&1; then
    api_ok="true"
    echo -e "  ${G}✓${N} API (:3000)"
  else
    echo -e "  ${R}✗${N} API (:3000)"
  fi

  # Web
  if curl -sf "$WEB" > /dev/null 2>&1; then
    web_ok="true"
    echo -e "  ${G}✓${N} Web (:8080)"
  else
    echo -e "  ${R}✗${N} Web (:8080)"
  fi

  # DB (via snapshot)
  if curl -sf "$API/dev/snapshot" > /dev/null 2>&1; then
    db_ok="true"
    echo -e "  ${G}✓${N} Database"
  else
    echo -e "  ${R}✗${N} Database"
  fi

  # Redis
  if ss -tlnp | grep -q ':6379'; then
    echo -e "  ${G}✓${N} Redis (:6379)"
  else
    echo -e "  ${R}✗${N} Redis (:6379)"
  fi

  # Update state
  local overall="ok"
  if [ "$api_ok" = "false" ] || [ "$db_ok" = "false" ]; then
    overall="broken"
  elif [ "$web_ok" = "false" ]; then
    overall="degraded"
  fi

  update_state_field "health.overall" "\"$overall\""
  update_state_field "health.api" "\"$([ "$api_ok" = "true" ] && echo ok || echo down)\""
  update_state_field "health.web" "\"$([ "$web_ok" = "true" ] && echo ok || echo down)\""
  update_state_field "health.database" "\"$([ "$db_ok" = "true" ] && echo ok || echo down)\""

  echo -e "\n  Overall: ${B}$overall${N}"
  log_action "HEALTH CHECK — $overall (api=$api_ok web=$web_ok db=$db_ok)"
}

cmd_validate() {
  echo -e "${B}${C}Running validation...${N}"
  bash "$GAME_DIR/tests/validate.sh" 2>&1

  # Sync results to project_state
  if [ -f "$VALIDATION_RESULTS" ]; then
    python3 -c "
import json
with open('$VALIDATION_RESULTS') as f:
    v = json.load(f)
with open('$STATE_FILE') as f:
    s = json.load(f)
s['validation'] = {
    'last_run': v.get('timestamp', '$NOW'),
    'status': v.get('status', 'UNKNOWN'),
    'total': v.get('total', 0),
    'passed': v.get('passed', 0),
    'failed': v.get('failed', 0),
    'duration_seconds': v.get('duration_seconds', 0),
    'script': 'tests/validate.sh'
}
s['health']['game_loop'] = 'ok' if v.get('status') == 'PASS' else 'broken'
s['last_updated'] = '$NOW'
with open('$STATE_FILE', 'w') as f:
    json.dump(s, f, indent=2)
" 2>/dev/null

    local status=$(python3 -c "import json; print(json.load(open('$VALIDATION_RESULTS')).get('status','?'))")
    local passed=$(python3 -c "import json; print(json.load(open('$VALIDATION_RESULTS')).get('passed',0))")
    local total=$(python3 -c "import json; print(json.load(open('$VALIDATION_RESULTS')).get('total',0))")
    log_action "VALIDATION — $status ($passed/$total)"
  fi
}

cmd_log() {
  local message="$1"
  log_action "$message"
  echo -e "${G}Logged:${N} $message"
}

cmd_task_start() {
  local task_id="$1"
  update_task_status "$task_id" "running"
  update_state_field "current_task" "\"$task_id\""
  log_action "TASK START — $task_id"
  echo -e "${C}Task $task_id → running${N}"
}

cmd_task_done() {
  local task_id="$1"
  update_task_status "$task_id" "done"
  update_state_field "last_completed_task" "\"$task_id\""
  update_state_field "current_task" "null"
  log_action "TASK DONE — $task_id"
  echo -e "${G}Task $task_id → done${N}"
}

cmd_task_fail() {
  local task_id="$1"
  local reason="${2:-unknown reason}"
  update_task_status "$task_id" "failed"
  log_action "TASK FAILED — $task_id: $reason"
  echo -e "${R}Task $task_id → failed: $reason${N}"
}

cmd_status() {
  if [ ! -f "$STATE_FILE" ]; then
    echo -e "${R}No project state found.${N}"
    return 1
  fi

  python3 -c "
import json

with open('$STATE_FILE') as f:
    s = json.load(f)
with open('$TASKS_FILE') as f:
    t = json.load(f)

# Header
print()
print('\033[1m\033[36m╔═══════════════════════════════════════════╗\033[0m')
print('\033[1m\033[36m║  EmpireOS Project Intelligence            ║\033[0m')
print('\033[1m\033[36m╚═══════════════════════════════════════════╝\033[0m')

# Phase
p = s.get('phase', {})
print(f\"\"\"
  \033[1mPhase:\033[0m     {p.get('name', '?')}
  \033[1mStatus:\033[0m    {p.get('status', '?')}
\"\"\")

# Health
h = s.get('health', {})
overall = h.get('overall', '?')
color = '\033[32m' if overall == 'ok' else '\033[33m' if overall == 'degraded' else '\033[31m'
print(f'  \033[1mHealth:\033[0m    {color}{overall}\033[0m')
for k in ['api', 'web', 'database', 'redis', 'game_loop']:
    v = h.get(k, '?')
    c = '\033[32m✓\033[0m' if v == 'ok' else '\033[31m✗\033[0m'
    print(f'    {c} {k}')

# Validation
v = s.get('validation', {})
vs = v.get('status', '?')
vc = '\033[32m' if vs == 'PASS' else '\033[31m'
print(f\"\"\"
  \033[1mValidation:\033[0m {vc}{vs}\033[0m ({v.get('passed',0)}/{v.get('total',0)})
  \033[1mLast run:\033[0m   {v.get('last_run', 'never')}
\"\"\")

# Tasks
m = t.get('meta', {})
print(f'  \033[1mTasks:\033[0m     {m.get(\"done\",0)} done / {m.get(\"running\",0)} running / {m.get(\"pending\",0)} pending / {m.get(\"failed\",0)} failed')

# Running tasks
running = [x for x in t.get('tasks', []) if x.get('status') == 'running']
if running:
    print(f'  \033[1mActive:\033[0m')
    for r in running:
        print(f\"    → {r['id']}: {r['title']}\")

# Next pending
pending = [x for x in t.get('tasks', []) if x.get('status') == 'pending']
if pending:
    nxt = pending[0]
    print(f'  \033[1mNext:\033[0m      {nxt[\"id\"]}: {nxt[\"title\"]}')

# Game stats
gs = s.get('game_stats', {})
print(f\"\"\"
  \033[1mGame:\033[0m      {gs.get('players',0)} players, {gs.get('businesses',0)} biz, {gs.get('workers',0)} workers
  \033[1mLast tick:\033[0m {gs.get('last_tick_duration_ms','?')}ms, {gs.get('last_tick_produced','?')} produced
  \033[1mUpdated:\033[0m   {s.get('last_updated', '?')}
\"\"\")
" 2>/dev/null
}

cmd_full() {
  cmd_health
  echo ""
  cmd_validate
  echo ""

  # Sync game stats
  local snapshot_file="/tmp/empireos_snapshot.json"
  curl -sf "$API/dev/snapshot" > "$snapshot_file" 2>/dev/null
  if [ -s "$snapshot_file" ]; then
    python3 -c "
import json
with open('$snapshot_file') as f:
    snap = json.load(f)
with open('$STATE_FILE') as f:
    s = json.load(f)
c = snap.get('counts', {})
s['game_stats']['players'] = c.get('players', 0)
s['game_stats']['businesses'] = c.get('businesses', 0)
s['game_stats']['workers'] = c.get('workers', 0)
lt = snap.get('lastTick')
if lt:
    s['game_stats']['last_tick_duration_ms'] = lt.get('duration_ms', 0)
    s['game_stats']['last_tick_produced'] = lt.get('goods_produced', 0)
s['last_updated'] = '$NOW'
with open('$STATE_FILE', 'w') as f:
    json.dump(s, f, indent=2)
" 2>/dev/null
    rm -f "$snapshot_file"
  fi

  cmd_status
  log_action "FULL STATUS SYNC — completed"
}

# ─── Main ───────────────────────────────────────────────────

case "${1:-status}" in
  validate)    cmd_validate ;;
  health)      cmd_health ;;
  log)         cmd_log "${2:-no message}" ;;
  task-start)  cmd_task_start "${2:?task ID required}" ;;
  task-done)   cmd_task_done "${2:?task ID required}" ;;
  task-fail)   cmd_task_fail "${2:?task ID required}" "${3:-}" ;;
  status)      cmd_status ;;
  full)        cmd_full ;;
  *)           echo "Usage: update.sh {validate|health|log|task-start|task-done|task-fail|status|full}"
               echo "  validate          Run validation and sync results"
               echo "  health            Check and update system health"
               echo "  log \"message\"     Append to execution log"
               echo "  task-start T015   Mark task as running"
               echo "  task-done T015    Mark task as done"
               echo "  task-fail T015    Mark task as failed"
               echo "  status            Show project status"
               echo "  full              Full sync: health + validate + status"
               ;;
esac
