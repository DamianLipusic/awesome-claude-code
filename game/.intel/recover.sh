#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# EmpireOS Session Recovery
# ═══════════════════════════════════════════════════════════════
# Run this at the START of every new session.
# It reconstructs full context from intel files.
# ═══════════════════════════════════════════════════════════════

set -uo pipefail

GAME_DIR="$(cd "$(dirname "$0")/.." && pwd)"
INTEL_DIR="$GAME_DIR/.intel"

R='\033[0;31m'; G='\033[0;32m'; Y='\033[0;33m'; C='\033[0;36m'; B='\033[1m'; N='\033[0m'

echo -e "${B}${C}╔═══════════════════════════════════════════════╗${N}"
echo -e "${B}${C}║  EmpireOS Session Recovery                    ║${N}"
echo -e "${B}${C}╚═══════════════════════════════════════════════╝${N}"
echo ""

# ── 1. Check intel files exist ──
echo -e "${B}1. Checking intelligence files...${N}"
missing=0
for f in project_state.json tasks.json roadmap.md decisions.md known_issues.md execution.log; do
  if [ -f "$INTEL_DIR/$f" ]; then
    echo -e "  ${G}✓${N} $f"
  else
    echo -e "  ${R}✗${N} $f — MISSING"
    missing=$((missing + 1))
  fi
done

if [ "$missing" -gt 0 ]; then
  echo -e "\n${R}ERROR: $missing intel files missing. Run: .intel/update.sh full${N}"
  exit 1
fi

# ── 2. Read project state ──
echo -e "\n${B}2. Project State${N}"
python3 -c "
import json
with open('$INTEL_DIR/project_state.json') as f:
    s = json.load(f)
p = s.get('phase', {})
h = s.get('health', {})
v = s.get('validation', {})
gs = s.get('game_stats', {})

print(f'  Phase:      {p.get(\"name\", \"?\")}')
print(f'  Health:     {h.get(\"overall\", \"?\")}')
print(f'  Validation: {v.get(\"status\", \"?\")} ({v.get(\"passed\", 0)}/{v.get(\"total\", 0)})')
print(f'  Last run:   {v.get(\"last_run\", \"never\")}')
print(f'  Game:       {gs.get(\"players\", 0)} players, {gs.get(\"businesses\", 0)} biz, {gs.get(\"workers\", 0)} workers')
print(f'  Updated:    {s.get(\"last_updated\", \"?\")}')
" 2>/dev/null

# ── 3. Active tasks ──
echo -e "\n${B}3. Active Tasks${N}"
python3 -c "
import json
with open('$INTEL_DIR/tasks.json') as f:
    t = json.load(f)
m = t.get('meta', {})
print(f'  Total: {m.get(\"total\",0)}  Done: {m.get(\"done\",0)}  Running: {m.get(\"running\",0)}  Pending: {m.get(\"pending\",0)}  Failed: {m.get(\"failed\",0)}')
print()
running = [x for x in t.get('tasks', []) if x.get('status') == 'running']
if running:
    print('  RUNNING:')
    for r in running:
        print(f'    → {r[\"id\"]}: {r[\"title\"]}')
pending = [x for x in t.get('tasks', []) if x.get('status') == 'pending'][:5]
if pending:
    print('  NEXT UP:')
    for p in pending:
        print(f'    ○ {p[\"id\"]}: {p[\"title\"]}')
failed = [x for x in t.get('tasks', []) if x.get('status') == 'failed']
if failed:
    print('  \033[31mFAILED:\033[0m')
    for f in failed:
        print(f'    ✗ {f[\"id\"]}: {f[\"title\"]}')
" 2>/dev/null

# ── 4. Known issues ──
echo -e "\n${B}4. Known Issues (Active)${N}"
grep -c "^### I[0-9]" "$INTEL_DIR/known_issues.md" 2>/dev/null | xargs -I{} echo "  {} active issues"
grep "^### I[0-9]" "$INTEL_DIR/known_issues.md" 2>/dev/null | while read line; do
  echo "  $line"
done

# ── 5. Recent execution log ──
echo -e "\n${B}5. Recent Actions (last 10)${N}"
grep "^\[" "$INTEL_DIR/execution.log" | tail -10 | while read line; do
  echo "  $line"
done

# ── 6. Live health check ──
echo -e "\n${B}6. Live Health Check${N}"
if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
  echo -e "  ${G}✓${N} API server running (:3000)"
else
  echo -e "  ${R}✗${N} API server DOWN"
fi
if curl -sf http://localhost:8080 > /dev/null 2>&1; then
  echo -e "  ${G}✓${N} Web client running (:8080)"
else
  echo -e "  ${R}✗${N} Web client DOWN"
fi
if ss -tlnp | grep -q ':5432'; then
  echo -e "  ${G}✓${N} PostgreSQL running (:5432)"
else
  echo -e "  ${R}✗${N} PostgreSQL DOWN"
fi
if ss -tlnp | grep -q ':6379'; then
  echo -e "  ${G}✓${N} Redis running (:6379)"
else
  echo -e "  ${R}✗${N} Redis DOWN"
fi

# ── 7. Summary ──
echo -e "\n${B}${C}═══════════════════════════════════════════════${N}"
echo -e "${B}Session recovery complete.${N}"
echo -e "Commands: ${C}./dev.sh intel${N} | ${C}./dev.sh validate${N} | ${C}./dev.sh intel-full${N}"
echo -e "${B}${C}═══════════════════════════════════════════════${N}"

# Log recovery
echo "[$(date '+%Y-%m-%dT%H:%M')] SESSION RECOVERY — Context reconstructed" >> "$INTEL_DIR/execution.log"
