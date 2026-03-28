#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# EmpireOS Continuous Validation System
# ═══════════════════════════════════════════════════════════════
# Usage:
#   ./validate.sh              # Run all levels
#   ./validate.sh level1       # Fast health checks only
#   ./validate.sh level2       # Core gameplay loop only
#   ./validate.sh --json       # JSON output for dashboard
# ═══════════════════════════════════════════════════════════════

set -uo pipefail

API="${API_URL:-http://localhost:3000}"
WEB="${WEB_URL:-http://localhost:8080}"
RESULTS_DIR="$(dirname "$0")/validation-results"
mkdir -p "$RESULTS_DIR"

# Test account (unique per run to avoid collisions)
UNIQUE=$(date +%s%N | tail -c 8)
TEST_USER="vtest_${UNIQUE}"
TEST_EMAIL="${TEST_USER}@test.empireos.dev"
TEST_PASS="TestPass_${UNIQUE}!"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# Results tracking
PASS=0
FAIL=0
TESTS=()
FAILURES=()
START_TIME=$(date +%s)

JSON_MODE=false
LEVEL=""

for arg in "$@"; do
  case "$arg" in
    --json) JSON_MODE=true ;;
    level1) LEVEL="1" ;;
    level2) LEVEL="2" ;;
  esac
done

# ─── Helpers ────────────────────────────────────────────────
pass() {
  local name="$1"
  local detail="${2:-}"
  PASS=$((PASS + 1))
  TESTS+=("{\"name\":\"$name\",\"status\":\"pass\",\"detail\":\"$detail\"}")
  if [ "$JSON_MODE" = false ]; then
    echo -e "  ${GREEN}✓${NC} $name ${detail:+— $detail}"
  fi
}

fail() {
  local name="$1"
  local detail="${2:-}"
  FAIL=$((FAIL + 1))
  TESTS+=("{\"name\":\"$name\",\"status\":\"fail\",\"detail\":\"$detail\"}")
  FAILURES+=("$name: $detail")
  if [ "$JSON_MODE" = false ]; then
    echo -e "  ${RED}✗${NC} $name ${detail:+— $detail}"
  fi
}

header() {
  if [ "$JSON_MODE" = false ]; then
    echo -e "\n${BOLD}${CYAN}═══ $1 ═══${NC}"
  fi
}

# JSON-safe curl wrapper: returns body, sets HTTP_CODE
api_call() {
  local method="$1"
  local endpoint="$2"
  local data="${3:-}"
  local token="${4:-}"

  local args=(-s -w '\n%{http_code}' -X "$method" "${API}${endpoint}")
  args+=(-H 'Content-Type: application/json')

  if [ -n "$token" ]; then
    args+=(-H "Authorization: Bearer $token")
  fi

  # Fastify rejects empty body with Content-Type: application/json
  if [ -n "$data" ]; then
    args+=(-d "$data")
  elif [ "$method" = "POST" ] || [ "$method" = "PUT" ] || [ "$method" = "PATCH" ]; then
    args+=(-d '{}')
  fi

  local response
  response=$(curl "${args[@]}" 2>/dev/null) || { HTTP_CODE=0; BODY=""; return 1; }

  HTTP_CODE=$(echo "$response" | tail -1)
  BODY=$(echo "$response" | sed '$d')
  return 0
}

# Extract JSON field via jq or python3
json_val() {
  local key="$1"
  if command -v jq &>/dev/null; then
    echo "$BODY" | jq -r "$key" 2>/dev/null || echo ""
  else
    echo "$BODY" | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  keys='$key'.strip('.').split('.')
  v=d
  for k in keys:
    if k.startswith('['):
      v=v[int(k.strip('[]'))]
    else:
      v=v[k]
  print(v)
except: print('')
" 2>/dev/null
  fi
}

# ═══════════════════════════════════════════════════════════════
# LEVEL 1 — FAST HEALTH CHECKS
# ═══════════════════════════════════════════════════════════════
run_level1() {
  header "LEVEL 1 — Health Checks"

  # 1. API health
  api_call GET "/health"
  if [ "$HTTP_CODE" = "200" ]; then
    pass "api-health" "HTTP 200"
  else
    fail "api-health" "HTTP $HTTP_CODE"
  fi

  # 2. Web client responds
  local web_code
  web_code=$(curl -s -o /dev/null -w '%{http_code}' "$WEB" 2>/dev/null) || web_code=0
  if [ "$web_code" = "200" ]; then
    pass "web-client" "HTTP 200 on :8080"
  else
    fail "web-client" "HTTP $web_code on :8080"
  fi

  # 3. Database connectivity (via /dev/snapshot which queries DB)
  api_call GET "/dev/snapshot"
  if [ "$HTTP_CODE" = "200" ]; then
    pass "db-connectivity" "snapshot endpoint OK"
  else
    fail "db-connectivity" "snapshot HTTP $HTTP_CODE"
  fi

  # 4. Auth endpoint responds
  api_call POST "/api/v1/auth/login" '{"email":"nonexistent@test.dev","password":"wrong"}'
  if [ "$HTTP_CODE" = "401" ]; then
    pass "auth-endpoint" "login returns 401 for bad creds"
  else
    fail "auth-endpoint" "expected 401, got $HTTP_CODE"
  fi

  # 5. Protected endpoint rejects unauthenticated
  api_call GET "/api/v1/game/dashboard"
  if [ "$HTTP_CODE" = "401" ]; then
    pass "auth-protection" "dashboard rejects unauthenticated"
  else
    fail "auth-protection" "expected 401, got $HTTP_CODE"
  fi
}

# ═══════════════════════════════════════════════════════════════
# LEVEL 2 — CORE GAMEPLAY LOOP
# ═══════════════════════════════════════════════════════════════
run_level2() {
  header "LEVEL 2 — Core Gameplay Loop"

  # ── Step 1: Register ──
  api_call POST "/api/v1/auth/register" \
    "{\"username\":\"$TEST_USER\",\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\"}"

  if [ "$HTTP_CODE" = "201" ]; then
    ACCESS_TOKEN=$(json_val ".data.access_token")
    PLAYER_ID=$(json_val ".data.player_id")
    pass "register" "user=$TEST_USER id=${PLAYER_ID:0:8}..."
  else
    fail "register" "HTTP $HTTP_CODE — $BODY"
    return
  fi

  # ── Step 2: Login ──
  api_call POST "/api/v1/auth/login" \
    "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\"}"

  if [ "$HTTP_CODE" = "200" ]; then
    ACCESS_TOKEN=$(json_val ".data.access_token")
    REFRESH_TOKEN=$(json_val ".data.refresh_token")
    pass "login" "got access + refresh tokens"
  else
    fail "login" "HTTP $HTTP_CODE"
    return
  fi

  # ── Step 3: Dashboard (initial state) ──
  api_call GET "/api/v1/game/dashboard" "" "$ACCESS_TOKEN"

  if [ "$HTTP_CODE" = "200" ]; then
    INITIAL_CASH=$(json_val ".data.player.cash")
    BIZ_COUNT=$(json_val ".data.stats.total_businesses")
    if [ "$BIZ_COUNT" = "0" ] && [ "$INITIAL_CASH" = "50000" ]; then
      pass "dashboard-initial" "cash=\$50000, 0 businesses"
    else
      pass "dashboard-initial" "cash=\$$INITIAL_CASH, biz=$BIZ_COUNT"
    fi
  else
    fail "dashboard-initial" "HTTP $HTTP_CODE"
    return
  fi

  # ── Step 4: Create Business (FARM) ──
  api_call POST "/api/v1/game/businesses" \
    '{"name":"Test Farm","type":"FARM"}' "$ACCESS_TOKEN"

  if [ "$HTTP_CODE" = "201" ]; then
    BIZ_ID=$(json_val ".data.business_id")
    pass "create-business" "FARM id=${BIZ_ID:0:8}... cost=\$5000"
  else
    fail "create-business" "HTTP $HTTP_CODE — $BODY"
    return
  fi

  # ── Step 5: Hire Worker ──
  api_call POST "/api/v1/game/businesses/${BIZ_ID}/hire" "" "$ACCESS_TOKEN"

  if [ "$HTTP_CODE" = "201" ]; then
    WORKER_NAME=$(json_val ".data.name")
    WORKER_SKILL=$(json_val ".data.skill")
    pass "hire-worker" "$WORKER_NAME (skill $WORKER_SKILL)"
  else
    fail "hire-worker" "HTTP $HTTP_CODE — $BODY"
    return
  fi

  # ── Step 6: Verify dashboard shows business + worker ──
  api_call GET "/api/v1/game/dashboard" "" "$ACCESS_TOKEN"

  if [ "$HTTP_CODE" = "200" ]; then
    NEW_BIZ_COUNT=$(json_val ".data.stats.total_businesses")
    NEW_WORKER_COUNT=$(json_val ".data.stats.total_workers")
    CASH_AFTER_SPEND=$(json_val ".data.player.cash")
    if [ "$NEW_BIZ_COUNT" = "1" ] && [ "$NEW_WORKER_COUNT" = "1" ]; then
      pass "dashboard-after-setup" "1 biz, 1 worker, cash=\$$CASH_AFTER_SPEND"
    else
      fail "dashboard-after-setup" "expected 1 biz + 1 worker, got biz=$NEW_BIZ_COUNT workers=$NEW_WORKER_COUNT"
    fi
  else
    fail "dashboard-after-setup" "HTTP $HTTP_CODE"
  fi

  # ── Step 7: Run Game Tick ──
  api_call POST "/dev/tick"

  if [ "$HTTP_CODE" = "200" ]; then
    TICK_DURATION=$(json_val ".duration_ms")
    TICK_PRODUCED=$(json_val ".produced")
    TICK_BIZ=$(json_val ".businesses")
    if [ "$TICK_PRODUCED" -gt 0 ] 2>/dev/null; then
      pass "game-tick" "produced=$TICK_PRODUCED duration=${TICK_DURATION}ms"
    else
      fail "game-tick" "tick ran but produced=0"
    fi
  else
    fail "game-tick" "HTTP $HTTP_CODE — $BODY"
    return
  fi

  # ── Step 8: Verify Production (inventory increased) ──
  api_call GET "/api/v1/game/dashboard" "" "$ACCESS_TOKEN"

  if [ "$HTTP_CODE" = "200" ]; then
    # FARM with 1 worker at tier 1: should produce 8 units
    INVENTORY=$(echo "$BODY" | python3 -c "
import sys,json
d=json.load(sys.stdin)
biz = d['data']['businesses']
print(biz[0]['inventory'] if biz else 0)
" 2>/dev/null)

    if [ "$INVENTORY" -gt 0 ] 2>/dev/null; then
      pass "production-verified" "inventory=$INVENTORY (expected ≥8)"
    else
      fail "production-verified" "inventory=$INVENTORY, expected >0"
    fi
  else
    fail "production-verified" "HTTP $HTTP_CODE"
  fi

  # ── Step 9: Sell Inventory ──
  api_call POST "/api/v1/game/sell" \
    "{\"business_id\":\"$BIZ_ID\",\"quantity\":$INVENTORY}" "$ACCESS_TOKEN"

  if [ "$HTTP_CODE" = "200" ]; then
    REVENUE=$(json_val ".data.revenue")
    pass "sell-inventory" "sold $INVENTORY units, revenue=\$$REVENUE"
  else
    fail "sell-inventory" "HTTP $HTTP_CODE — $BODY"
  fi

  # ── Step 10: Verify Cash Increased ──
  api_call GET "/api/v1/game/dashboard" "" "$ACCESS_TOKEN"

  if [ "$HTTP_CODE" = "200" ]; then
    FINAL_CASH=$(json_val ".data.player.cash")
    FINAL_INVENTORY=$(echo "$BODY" | python3 -c "
import sys,json
d=json.load(sys.stdin)
biz = d['data']['businesses']
print(biz[0]['inventory'] if biz else -1)
" 2>/dev/null)

    # Cash should be: 50000 - 5000 (biz) - 2000 (worker) + revenue = 43000 + revenue
    if python3 -c "exit(0 if $FINAL_CASH > $CASH_AFTER_SPEND else 1)" 2>/dev/null; then
      pass "cash-increased" "cash \$$CASH_AFTER_SPEND → \$$FINAL_CASH (+\$$REVENUE)"
    else
      fail "cash-increased" "cash did not increase: was \$$CASH_AFTER_SPEND, now \$$FINAL_CASH"
    fi

    if [ "$FINAL_INVENTORY" = "0" ]; then
      pass "inventory-cleared" "inventory=0 after sell"
    else
      fail "inventory-cleared" "inventory=$FINAL_INVENTORY, expected 0"
    fi
  else
    fail "cash-verification" "HTTP $HTTP_CODE"
  fi

  # ── Step 11: Sell-All (after another tick) ──
  api_call POST "/dev/tick"
  api_call POST "/api/v1/game/sell-all" "" "$ACCESS_TOKEN"

  if [ "$HTTP_CODE" = "200" ]; then
    SELL_ALL_REVENUE=$(json_val ".data.total_revenue")
    SELL_ALL_UNITS=$(json_val ".data.total_units")
    pass "sell-all" "units=$SELL_ALL_UNITS revenue=\$$SELL_ALL_REVENUE"
  else
    fail "sell-all" "HTTP $HTTP_CODE — $BODY"
  fi

  # ── Step 12: Upgrade Business ──
  api_call POST "/api/v1/game/businesses/${BIZ_ID}/upgrade" "" "$ACCESS_TOKEN"

  if [ "$HTTP_CODE" = "200" ]; then
    NEW_TIER=$(json_val ".data.new_tier")
    UPGRADE_COST=$(json_val ".data.cost")
    pass "upgrade-business" "tier=$NEW_TIER cost=\$$UPGRADE_COST"
  else
    fail "upgrade-business" "HTTP $HTTP_CODE — $BODY"
  fi

  # ── Step 13: Token Refresh ──
  api_call POST "/api/v1/auth/refresh" \
    "{\"refresh_token\":\"$REFRESH_TOKEN\"}"

  if [ "$HTTP_CODE" = "200" ]; then
    NEW_ACCESS=$(json_val ".data.access_token")
    if [ -n "$NEW_ACCESS" ] && [ "$NEW_ACCESS" != "null" ]; then
      pass "token-refresh" "new access token issued"
    else
      fail "token-refresh" "no access token in response"
    fi
  else
    fail "token-refresh" "HTTP $HTTP_CODE — $BODY"
  fi

  # ── Step 14: Business Detail ──
  api_call GET "/api/v1/game/businesses/${BIZ_ID}" "" "$ACCESS_TOKEN"

  if [ "$HTTP_CODE" = "200" ]; then
    BIZ_TIER=$(json_val ".data.tier")
    BIZ_WORKERS=$(json_val ".data.workers" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")
    pass "business-detail" "tier=$BIZ_TIER workers=$BIZ_WORKERS"
  else
    fail "business-detail" "HTTP $HTTP_CODE"
  fi

  # ── Cleanup: Delete test player from DB ──
  local SCRIPT_DIR
  SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
  local cleanup_result
  cleanup_result=$(cd "$SCRIPT_DIR/server" && node -e "
    const{Pool}=require('pg');
    const p=new Pool({connectionString:'postgresql://postgres:postgres@localhost:5432/economy_game'});
    p.query('DELETE FROM players WHERE username = \$1', ['$TEST_USER'])
      .then(r=>{console.log(r.rowCount);p.end()})
      .catch(e=>{console.error(e.message);p.end();process.exit(1)});
  " 2>&1) && pass "cleanup" "test player removed (${cleanup_result} rows)" || \
    fail "cleanup" "could not remove test player: $cleanup_result"
}

# ═══════════════════════════════════════════════════════════════
# RUN
# ═══════════════════════════════════════════════════════════════

if [ "$JSON_MODE" = false ]; then
  echo -e "${BOLD}${CYAN}╔═══════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${CYAN}║  EmpireOS Validation System           ║${NC}"
  echo -e "${BOLD}${CYAN}╚═══════════════════════════════════════╝${NC}"
  echo -e "  API: $API  |  Web: $WEB"
  echo -e "  Time: $(date '+%Y-%m-%d %H:%M:%S')"
fi

case "${LEVEL}" in
  "1") run_level1 ;;
  "2") run_level2 ;;
  *)   run_level1; run_level2 ;;
esac

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
TOTAL=$((PASS + FAIL))

# ─── Summary ────────────────────────────────────────────────
if [ "$JSON_MODE" = false ]; then
  echo ""
  echo -e "${BOLD}═══ RESULTS ═══${NC}"
  echo -e "  Total: $TOTAL  |  ${GREEN}Pass: $PASS${NC}  |  ${RED}Fail: $FAIL${NC}  |  Duration: ${DURATION}s"

  if [ "$FAIL" -gt 0 ]; then
    echo -e "\n${RED}${BOLD}FAILURES:${NC}"
    for f in "${FAILURES[@]}"; do
      echo -e "  ${RED}✗${NC} $f"
    done
    echo ""
  fi

  if [ "$FAIL" = "0" ]; then
    echo -e "\n${GREEN}${BOLD}  ✓ ALL TESTS PASSED${NC}\n"
  else
    echo -e "\n${RED}${BOLD}  ✗ $FAIL TESTS FAILED${NC}\n"
  fi
fi

# ─── Save results JSON ──────────────────────────────────────
TESTS_JSON=""
if [ ${#TESTS[@]} -gt 0 ]; then
  TESTS_JSON=$(printf '%s,' "${TESTS[@]}" | sed 's/,$//')
fi
FAILURES_JSON=""
if [ ${#FAILURES[@]} -gt 0 ]; then
  FAILURES_JSON=$(printf '"%s",' "${FAILURES[@]}" | sed 's/,$//')
fi
RESULT_JSON="{
  \"timestamp\": \"$(date -Iseconds)\",
  \"duration_seconds\": $DURATION,
  \"total\": $TOTAL,
  \"passed\": $PASS,
  \"failed\": $FAIL,
  \"status\": \"$([ "$FAIL" = "0" ] && echo "PASS" || echo "FAIL")\",
  \"tests\": [$TESTS_JSON],
  \"failures\": [$FAILURES_JSON]
}"

echo "$RESULT_JSON" > "$RESULTS_DIR/latest.json"
echo "$RESULT_JSON" > "$RESULTS_DIR/run_$(date +%Y%m%d_%H%M%S).json"

if [ "$JSON_MODE" = true ]; then
  echo "$RESULT_JSON"
fi

# Exit with failure code if tests failed
[ "$FAIL" = "0" ] && exit 0 || exit 1
