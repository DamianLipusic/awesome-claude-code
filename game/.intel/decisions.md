# EmpireOS Architectural Decisions

## D001: Raw SQL over ORM
**Date:** 2026-03-24
**Decision:** Use raw `pg` Pool with parameterized SQL instead of an ORM (Prisma, TypeORM, etc.)
**Why:** Game tick needs maximum query performance and control. ORM abstractions add overhead and hide query patterns.
**Tradeoff:** More manual work for migrations and queries, but full control over N+1 patterns and batching.

## D002: V2 Rebuild — Drop Legacy Tables
**Date:** 2026-03-26
**Decision:** Created migration 010_v2_rebuild.sql that drops 40+ legacy tables (syndicates, crime ops, contracts, loyalty, location, events) and keeps only: players, businesses, workers, activity_log, game_ticks, refresh_tokens.
**Why:** Legacy systems were half-implemented, untested, and made the tick unreliable. Focus on the core loop first.
**Tradeoff:** Lost complex features, but gained stability and a clean foundation to rebuild on.

## D003: BullMQ Disabled in V2
**Date:** 2026-03-26
**Decision:** Replaced BullMQ queue system with a simple `setInterval` for the game tick.
**Why:** V2 only has one job (production tick). BullMQ adds Redis dependency complexity for no benefit at this scale. Can re-enable when multiple job types are needed.
**Tradeoff:** No delayed/retry job semantics, but the tick is simple enough not to need them.

## D004: Dashboard-Only Navigation
**Date:** 2026-03-27
**Decision:** Removed Market, Crime, Strategy, and Business tabs from the mobile navigation. Dashboard is the only tab.
**Why:** Those tabs called legacy V1 API endpoints that no longer exist. The V2 dashboard now contains all core loop actions inline (create business, hire, sell, upgrade).
**Tradeoff:** Less navigation depth, but zero dead-end screens. Tabs will be re-added as V2 APIs are built.

## D005: Guest Login (No Password)
**Date:** 2026-03-26
**Decision:** Login screen accepts only a player name. Email is auto-generated as `{name}@empireos.guest`, password is hardcoded `EmpireOS_Guest_2024!`.
**Why:** Minimum friction entry. A player should be in the game in under 5 seconds. No email verification, no password to remember.
**Tradeoff:** No real account security, but appropriate for an early alpha game. Can add proper auth later.

## D006: Batched GameTick with UNNEST
**Date:** 2026-03-27
**Decision:** Rewrote gameTick to use PostgreSQL `UNNEST` arrays for batch inventory updates and activity log inserts. Single SELECT + single transaction for all businesses.
**Why:** Previous version had N+1 pattern — 2 queries per business per tick (~15k queries at scale). Batching reduces to 4 queries total regardless of business count.
**Tradeoff:** Slightly more complex SQL, but O(1) query count vs O(n).

## D007: Inline V2 Types (Not Shared Package)
**Date:** 2026-03-27
**Decision:** Dashboard defines its own `V2Dashboard` and `V2Business` TypeScript interfaces instead of importing from `@economy-game/shared`.
**Why:** The shared package has 713 lines of complex V1 types (seasons, heat, syndicates, etc.) that don't match V2's simple response shapes. Creating V2 types inline avoids a shared package rewrite.
**Tradeoff:** Type duplication between client and server, but types are simple enough that this is manageable.

## D008: Rate Limiting via @fastify/rate-limit
**Date:** 2026-03-27
**Decision:** Added rate limiting to `/auth/register` and `/auth/login` at 10 requests per minute per IP.
**Why:** Prevents brute force attacks on guest accounts and registration spam.
**Tradeoff:** May need tuning if legitimate users share IPs (NAT). Currently non-global (game routes are unlimited).

## D009: Project Intelligence System
**Date:** 2026-03-27
**Decision:** Created `.intel/` directory with structured project state tracking (project_state.json, tasks.json, roadmap.md, decisions.md, known_issues.md, execution.log).
**Why:** Ensures continuity across sessions. No "starting from zero" — every session can reconstruct full context from these files.
**Tradeoff:** Maintenance overhead (files must stay updated), but prevents much larger cost of context loss.
