# EmpireOS — Autonomous Agent Instructions

## Identity

You are an autonomous development agent for EmpireOS, a multiplayer economy game.
You operate independently — no human in the loop. Make decisions, ship code, validate.

## Project

- **Stack**: Fastify + PostgreSQL 16 + Redis 7 (server), React Native/Expo (client)
- **Entry**: `server/src/index.ts` (port 3000)
- **Tick**: `server/src/jobs/gameTick.ts` (2-min cycle)
- **Routes**: `server/src/routes/game.ts` (V2 core API)
- **Client**: `client/src/screens/DashboardScreen.tsx` (main UI)
- **DB**: Raw pg pool, parameterized SQL, `withTransaction()` for atomic ops

## Autonomous Work Loop

Every session follows this exact loop:

```
1. READ STATE    → cat .intel/project_state.json, .intel/tasks.json
2. PICK TASK     → highest priority pending task
3. HEALTH CHECK  → ./dev.sh health (abort if infra down)
4. IMPLEMENT     → write code, migrations, tests
5. VALIDATE      → ./dev.sh validate (must pass 100%)
6. WEB BUILD     → cd client && npx expo export --platform web (if client changed)
7. RESTART       → ./dev.sh restart && ./dev.sh web-restart (if needed)
8. UPDATE STATE  → mark task done in .intel/tasks.json, update project_state.json
9. COMMIT        → git add + commit with descriptive message
10. NEXT TASK    → repeat from step 2 (max 3 tasks per session)
```

## Task Priority Rules

Pick tasks in this order:
1. `critical` priority first
2. `high` priority second
3. `medium` third
4. `low` last
5. Within same priority: earlier `created_at` first

## Coding Standards

- Raw SQL with parameterized queries (no ORM)
- All money operations in transactions with `FOR UPDATE` locks
- Business config in `BUSINESS_CONFIG` constant (server/src/routes/game.ts)
- Activity log entries for every player-visible action
- V2 types inline in client (no shared package)
- Mobile-first CSS, dark theme (#0f172a background)
- Toast notifications via `useToast()` for user feedback
- Test with `./dev.sh validate` — 0 failures required

## Migration Rules

- New file in `server/src/db/migrations/` with next sequence number
- Format: `NNN_description.sql`
- Always add `IF NOT EXISTS` / `IF EXISTS` guards
- Run with `./dev.sh migrate`

## Safety Rules

- NEVER drop tables or delete data without explicit task instruction
- NEVER change auth/JWT logic without a security-tagged task
- NEVER modify docker-compose.yml
- ALWAYS validate after changes
- ALWAYS restart server after backend changes
- ALWAYS rebuild web after frontend changes
- If validation fails after 2 fix attempts → mark task as blocked, move to next

## State Files

| File | Purpose |
|------|---------|
| `.intel/project_state.json` | System health, current phase, game stats |
| `.intel/tasks.json` | Task queue with status/priority |
| `.intel/roadmap.md` | Phase roadmap |
| `.intel/decisions.md` | Architectural decisions log |
| `.intel/known_issues.md` | Bug tracker |
| `.intel/execution.log` | Action audit trail |

## Updating State

After completing a task, update these files:

### tasks.json
```json
{"id": "T0XX", "status": "done", "completed_at": "YYYY-MM-DD", "notes": "what was done"}
```

### execution.log
Append one line:
```
[YYYY-MM-DD HH:MM] T0XX — <description of what was done>
```

### project_state.json
Update `current_task`, `last_completed_task`, `last_updated`

## Dev Commands

```bash
./dev.sh health        # Check all services
./dev.sh validate      # Run 21-test suite
./dev.sh restart       # Restart game server
./dev.sh web-build     # Rebuild Expo web export
./dev.sh web-restart   # Restart web server
./dev.sh migrate       # Run DB migrations
./dev.sh logs 30       # Recent server logs
./dev.sh status        # Process status
```

## Git Conventions

- Commit message format: `TXXX: short description`
- One commit per task (squash if needed)
- Push to `main` after validation passes
- Include `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`
