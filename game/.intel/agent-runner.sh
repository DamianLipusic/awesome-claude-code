#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# EmpireOS Autonomous Agent Runner
# ═══════════════════════════════════════════════════════════════
# Invoked by cron to autonomously develop EmpireOS.
# Reads task queue, picks highest priority, runs claude CLI.
#
# Usage:
#   ./agent-runner.sh              # Normal run (pick next task)
#   ./agent-runner.sh --status     # Show queue status only
#   ./agent-runner.sh --dry-run    # Show what would run without executing
# ═══════════════════════════════════════════════════════════════

set -uo pipefail

GAME_DIR="$(cd "$(dirname "$0")/.." && pwd)"
INTEL_DIR="$GAME_DIR/.intel"
TASKS_FILE="$INTEL_DIR/tasks.json"
STATE_FILE="$INTEL_DIR/project_state.json"
EXEC_LOG="$INTEL_DIR/execution.log"
AGENT_LOG="$INTEL_DIR/agent-runs.log"
LOCK_FILE="/tmp/empireos-agent.lock"

# ─── Lock ───────────────────────────────────────────────────
# Prevent concurrent agent runs
if [ -f "$LOCK_FILE" ]; then
  LOCK_PID=$(cat "$LOCK_FILE" 2>/dev/null)
  if kill -0 "$LOCK_PID" 2>/dev/null; then
    echo "[$(date -Iseconds)] SKIP — another agent is running (PID $LOCK_PID)" >> "$AGENT_LOG"
    exit 0
  else
    rm -f "$LOCK_FILE"
  fi
fi
echo $$ > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

# ─── Helpers ────────────────────────────────────────────────
log() { echo "[$(date -Iseconds)] $*" >> "$AGENT_LOG"; }
log_exec() { echo "[$(date '+%Y-%m-%d %H:%M')] $*" >> "$EXEC_LOG"; }

get_next_task() {
  # Returns the highest priority pending task as JSON
  # Priority order: critical > high > medium > low
  python3 -c "
import json, sys
with open('$TASKS_FILE') as f:
    data = json.load(f)
priority_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
pending = [t for t in data['tasks'] if t['status'] == 'pending']
if not pending:
    sys.exit(1)
pending.sort(key=lambda t: (priority_order.get(t.get('priority', 'low'), 4), t.get('created_at', '')))
print(json.dumps(pending[0]))
" 2>/dev/null
}

get_queue_status() {
  python3 -c "
import json
with open('$TASKS_FILE') as f:
    data = json.load(f)
m = data['meta']
pending = [t for t in data['tasks'] if t['status'] == 'pending']
print(f\"Queue: {m['done']} done, {m['pending']} pending, {m['failed']} failed\")
for t in pending[:5]:
    spec = '(has spec)' if t.get('spec') else '(no spec)'
    print(f\"  → [{t['priority']}] {t['id']}: {t['title']} {spec}\")
"
}

mark_task_running() {
  local task_id="$1"
  python3 -c "
import json
with open('$TASKS_FILE') as f:
    data = json.load(f)
for t in data['tasks']:
    if t['id'] == '$task_id':
        t['status'] = 'running'
        break
data['meta']['running'] = sum(1 for t in data['tasks'] if t['status'] == 'running')
data['meta']['pending'] = sum(1 for t in data['tasks'] if t['status'] == 'pending')
with open('$TASKS_FILE', 'w') as f:
    json.dump(data, f, indent=2)
"
}

mark_task_done() {
  local task_id="$1"
  local notes="$2"
  python3 -c "
import json
from datetime import date
with open('$TASKS_FILE') as f:
    data = json.load(f)
for t in data['tasks']:
    if t['id'] == '$task_id':
        t['status'] = 'done'
        t['completed_at'] = str(date.today())
        t['notes'] = '''$notes'''
        break
data['meta']['done'] = sum(1 for t in data['tasks'] if t['status'] == 'done')
data['meta']['running'] = sum(1 for t in data['tasks'] if t['status'] == 'running')
data['meta']['pending'] = sum(1 for t in data['tasks'] if t['status'] == 'pending')
data['meta']['last_updated'] = '$(date -Iseconds)'
with open('$TASKS_FILE', 'w') as f:
    json.dump(data, f, indent=2)
"
}

mark_task_failed() {
  local task_id="$1"
  local reason="$2"
  python3 -c "
import json
with open('$TASKS_FILE') as f:
    data = json.load(f)
for t in data['tasks']:
    if t['id'] == '$task_id':
        t['status'] = 'blocked'
        t['blocked_reason'] = '''$reason'''
        break
data['meta']['failed'] = sum(1 for t in data['tasks'] if t['status'] in ('blocked', 'failed'))
data['meta']['running'] = sum(1 for t in data['tasks'] if t['status'] == 'running')
with open('$TASKS_FILE', 'w') as f:
    json.dump(data, f, indent=2)
"
}

# ─── Status mode ────────────────────────────────────────────
if [ "${1:-}" = "--status" ]; then
  get_queue_status
  exit 0
fi

# ─── Health check ───────────────────────────────────────────
log "Starting agent run"

cd "$GAME_DIR"
if ! ./dev.sh health > /dev/null 2>&1; then
  log "ABORT — health check failed, attempting recovery"
  ./dev.sh restart > /dev/null 2>&1
  sleep 3
  if ! ./dev.sh health > /dev/null 2>&1; then
    log "ABORT — recovery failed, skipping this run"
    exit 1
  fi
  log "Recovery successful, continuing"
fi

# ─── Pick next task ─────────────────────────────────────────
TASK_JSON=$(get_next_task)
if [ -z "$TASK_JSON" ]; then
  log "No pending tasks — queue empty"
  exit 0
fi

TASK_ID=$(echo "$TASK_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
TASK_TITLE=$(echo "$TASK_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['title'])")
TASK_SPEC=$(echo "$TASK_JSON" | python3 -c "import json,sys; t=json.load(sys.stdin); print(json.dumps(t.get('spec',{})))")

log "Picked task: $TASK_ID — $TASK_TITLE"

# ─── Dry run mode ──────────────────────────────────────────
if [ "${1:-}" = "--dry-run" ]; then
  echo "Would execute: $TASK_ID — $TASK_TITLE"
  echo "Spec: $TASK_SPEC"
  exit 0
fi

# ─── Mark running ──────────────────────────────────────────
mark_task_running "$TASK_ID"

# ─── Build prompt ──────────────────────────────────────────
PROMPT="You are an autonomous agent working on EmpireOS. Read game/CLAUDE.md for full instructions.

YOUR TASK: $TASK_ID — $TASK_TITLE

SPEC: $TASK_SPEC

INSTRUCTIONS:
1. Read game/CLAUDE.md for coding standards and workflow
2. Read .intel/project_state.json for current state
3. Implement the task following the spec
4. Run: cd game && ./dev.sh validate — ALL tests must pass
5. If you changed client code: cd game/client && npx expo export --platform web
6. Restart services if needed: cd game && ./dev.sh restart && ./dev.sh web-restart
7. Update .intel/tasks.json — mark $TASK_ID as done with notes
8. Update .intel/execution.log with what you did
9. Commit all changes: git add -A && git commit

SAFETY: If validation fails after 2 attempts, stop and mark the task as blocked.
Do NOT ask questions. Make reasonable decisions and document them."

# ─── Execute ───────────────────────────────────────────────
AGENT_OUTPUT_FILE="/tmp/agent-output-${TASK_ID}.log"

log "Executing claude for $TASK_ID"
timeout 600 claude --print --dangerously-skip-permissions \
  -p "$PROMPT" \
  > "$AGENT_OUTPUT_FILE" 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  log "SUCCESS: $TASK_ID completed"
  log_exec "$TASK_ID — $TASK_TITLE (autonomous agent)"

  # Verify task was marked done by the agent
  TASK_STATUS=$(python3 -c "
import json
with open('$TASKS_FILE') as f:
    data = json.load(f)
for t in data['tasks']:
    if t['id'] == '$TASK_ID':
        print(t['status'])
        break
" 2>/dev/null)

  if [ "$TASK_STATUS" != "done" ]; then
    mark_task_done "$TASK_ID" "Completed by autonomous agent"
  fi

  # Push changes
  cd "$GAME_DIR/.."
  git push origin main 2>/dev/null || log "WARN: git push failed"

else
  log "FAILED: $TASK_ID (exit code $EXIT_CODE)"
  mark_task_failed "$TASK_ID" "Agent exited with code $EXIT_CODE"
fi

# ─── Validate after ────────────────────────────────────────
cd "$GAME_DIR"
VALIDATION=$(./dev.sh validate 2>&1 | tail -5)
log "Post-run validation: $VALIDATION"

log "Agent run complete"
