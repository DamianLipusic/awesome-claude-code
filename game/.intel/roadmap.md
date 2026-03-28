# EmpireOS Rebuild Roadmap

## Vision
Clean, addictive, mobile-first economic game. A player understands it in 10 seconds, makes money in 1-2 minutes, always knows what to do next.

---

## Phase 1: Foundation (COMPLETED 2026-03-24 → 2026-03-26)
- [x] Fastify server with JWT auth
- [x] PostgreSQL schema (players, businesses, workers, activity_log, game_ticks)
- [x] Docker compose for DB + Redis
- [x] Basic auth (register, login, refresh, logout, me)
- [x] Business CRUD (create, hire, upgrade)
- [x] Game tick (production cycle)
- [x] Sell/Sell-all endpoints
- [x] Dashboard API
- [x] Expo/React Native client scaffold
- [x] Web static export on :8080

## Phase 2: V2 Rebuild & Cleanup (COMPLETED 2026-03-26 → 2026-03-27)
- [x] CORE-001 through CORE-010: Core gameplay loop rebuild
- [x] V2 migration (010_v2_rebuild.sql) — dropped 40+ legacy tables
- [x] Disabled dead tick subsystems
- [x] Focused dashboard on working features

## Phase 3: Validation & Stabilization (COMPLETED 2026-03-27)
- [x] Validation system (21-test suite: health, auth, gameplay loop)
- [x] `./dev.sh validate` integration
- [x] `/dev/validation` API endpoint
- [x] Dashboard rewrite for V2 API (mobile-first, clean)
- [x] Auth store fix (V2 endpoints)
- [x] Simplified navigation (Dashboard-only, removed dead tabs)
- [x] GameTick N+1 fix (UNNEST batch queries)
- [x] Rate limiting on auth endpoints
- [x] Mobile-first HTML meta tags
- [x] SQL injection confirmed resolved (legacy only)

## ► Phase 4: Project Intelligence (CURRENT — 2026-03-27)
- [x] project_state.json — central state tracking
- [x] roadmap.md — this file
- [x] tasks.json — task tracking
- [x] decisions.md — architectural decisions
- [x] known_issues.md — bug tracker
- [x] execution.log — action log
- [ ] Auto-update hooks for validation → state sync
- [ ] API endpoint for project intelligence
- [ ] dev.sh status integration

## Phase 5: Player Progression & Feedback (NEXT)
- [ ] Player levels or net worth milestones
- [ ] Achievement/badge system
- [ ] Toast notifications for actions (hire, sell, create)
- [ ] Sound effects for key actions
- [ ] Progress bar or XP display on dashboard
- [ ] "Congratulations" moments for milestones

## Phase 6: Economy Depth
- [ ] Market system (player-to-player trading)
- [ ] Dynamic pricing (supply/demand)
- [ ] More business types (FACTORY, WAREHOUSE, BANK)
- [ ] Business specialization (upgrades that change behavior)
- [ ] Daily costs (maintenance, wages)
- [ ] Random events (boom, bust, opportunity)

## Phase 7: Social & Competition
- [ ] Leaderboard endpoint and UI
- [ ] Player profiles
- [ ] Rankings (net worth, production, revenue)
- [ ] Seasonal resets with rewards
- [ ] WebSocket for real-time updates

## Phase 8: Polish & Launch
- [ ] CORS lockdown
- [ ] JWT secret rotation
- [ ] Crypto RNG (replace Math.random)
- [ ] PWA manifest + icons
- [ ] Performance monitoring
- [ ] Error tracking
- [ ] Clean up _legacy/ directory
- [ ] Production deployment guide

---

## Key Metrics for Success
1. Player understands game in 10 seconds
2. Player makes money in 1-2 minutes
3. Player always knows what to do next
4. Player can see clear progress
5. Game tick < 100ms at scale
6. 0 validation failures
