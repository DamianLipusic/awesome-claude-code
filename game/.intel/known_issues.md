# EmpireOS Known Issues

## Active Issues

### I001: CORS allows all origins
**Severity:** MEDIUM
**Status:** Open
**File:** `server/src/index.ts:16`
**Description:** CORS is set to `origin: true` which allows requests from any domain.
**Impact:** Any website can make authenticated API calls if user has a token.
**Fix:** Restrict to specific origins (game domain + localhost for dev).

### I002: JWT secrets hardcoded in .env
**Severity:** HIGH
**Status:** Open
**File:** `server/.env`
**Description:** `JWT_SECRET` and `JWT_REFRESH_SECRET` are committed to repo with known values.
**Impact:** Anyone with repo access can forge tokens.
**Fix:** Rotate secrets, use environment-specific values, add .env to .gitignore.

### I003: Math.random() for game RNG
**Severity:** LOW
**Status:** Open
**Files:** `server/src/routes/game.ts:193-194` (worker name/skill selection)
**Description:** Worker names and skills use `Math.random()` instead of `crypto.getRandomValues()`.
**Impact:** Predictable randomness. Low impact for worker hiring, but matters if used for loot/rewards.
**Fix:** Replace with `crypto.randomInt()` for game-impacting RNG.

### I004: No WebSocket in V2
**Severity:** LOW
**Status:** Open (deferred)
**Description:** V2 dashboard uses 30-second polling via React Query instead of WebSocket push.
**Impact:** 30s delay for seeing tick results. Not terrible but not instant.
**Fix:** Re-enable WebSocket handler for tick notifications.

### I005: Stale test players in database
**Severity:** LOW
**Status:** Open
**Description:** Some test players from validation runs may persist if cleanup fails.
**Impact:** Minor DB bloat. No gameplay impact.
**Fix:** Validation cleanup is working. Add periodic cleanup cron if needed.

### I006: Old client screens still exist
**Severity:** NONE (cosmetic)
**Status:** Open (deferred)
**Description:** Crime, Market, Strategy, Business screens in `client/src/screens/` reference old V1 APIs but are not imported since MainTabs was simplified.
**Impact:** None — dead code not bundled. Adds minor confusion when exploring codebase.
**Fix:** Delete when V2 replacements are built, or clean up in Phase 8.

## Resolved Issues

### I-R001: SQL injection in businesses route
**Resolved:** 2026-03-27
**Description:** INTERVAL interpolation in legacy `routes/businesses.ts:286`.
**Resolution:** V2 rebuild moved old code to `_legacy/`, not imported. V2 routes use parameterized queries exclusively.

### I-R002: N+1 queries in gameTick
**Resolved:** 2026-03-27
**Description:** Each business triggered 2 queries per tick (inventory update + activity log).
**Resolution:** Rewrote with UNNEST batch queries — single transaction for all businesses.

### I-R003: No rate limiting on auth
**Resolved:** 2026-03-27
**Description:** `/register` and `/login` had no rate limiting.
**Resolution:** Added `@fastify/rate-limit` at 10 req/min per IP on auth endpoints.

### I-R004: Dashboard called wrong API endpoints
**Resolved:** 2026-03-27
**Description:** Client called `/players/dashboard` and `/players/me` (V1 routes).
**Resolution:** Rewrote to use `/game/dashboard` and `/auth/me` (V2 routes).
