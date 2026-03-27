# Production Chains — Food Chain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the core gameplay loop with production chains, starting with the Food Chain: Farm→Wheat, Mill→Flour, Bakery→Bread.

**Architecture:** Extend existing BUSINESS_CONFIG with `input`/`inputPerUnit` fields for conversion businesses. Add `input_inventory` column to businesses table for storing raw materials waiting to be converted. gameTick runs in two phases: pure producers first, then converters. New transfer endpoint lets players move goods between their own businesses. Dashboard updated to show chain flow.

**Tech Stack:** PostgreSQL (ALTER TYPE, ALTER TABLE), Fastify routes, React Native/Expo UI, TanStack React Query

**Key files:**
- `game/server/src/db/migrations/012_production_chains.sql` (create)
- `game/server/src/routes/game.ts` (modify: config, routes, dashboard)
- `game/server/src/jobs/gameTick.ts` (modify: two-phase production)
- `game/client/src/screens/DashboardScreen.tsx` (modify: chain UI)

**Economics (tunable):**

| Type | Cost | Prod/Worker/Tick | Sell Price | Input | Input/Unit |
|------|------|-----------------|------------|-------|-----------|
| FARM | $5k | 8 Wheat | $5 | — | — |
| MILL | $12k | 4 Flour | $25 | Wheat | 2 |
| BAKERY | $20k | 2 Bread | $70 | Flour | 2 |
| MINE | $8k | 5 Ore | $25 | — | — |
| RETAIL | $10k | 6 Goods | $20 | — | — |

Full chain (1 Farm + 1 Mill + 1 Bakery = 3 workers): 2 Bread/tick = $140/tick = $46.7/worker — 17% better than raw farming ($40/worker).

---

### Task 1: Database Migration

**Files:**
- Create: `game/server/src/db/migrations/012_production_chains.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- 012: Production Chains — Food Chain
-- Adds MILL and BAKERY business types, input_inventory for conversion businesses

-- Add new business types to enum
ALTER TYPE business_type ADD VALUE IF NOT EXISTS 'MILL';
ALTER TYPE business_type ADD VALUE IF NOT EXISTS 'BAKERY';

-- Add input_inventory column for conversion businesses
-- Producers (FARM, MINE, RETAIL): always 0
-- Converters (MILL, BAKERY): stores input materials waiting to be processed
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS input_inventory INTEGER NOT NULL DEFAULT 0;
```

Write this to `game/server/src/db/migrations/012_production_chains.sql`.

- [ ] **Step 2: Apply the migration**

Run from the game/server directory:
```bash
cd /home/claude/awesome-claude-code/game/server && node -e "
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/economy_game' });
const sql = fs.readFileSync('src/db/migrations/012_production_chains.sql', 'utf8');
pool.query(sql).then(() => { console.log('Migration applied'); pool.end(); }).catch(e => { console.error(e.message); pool.end(); });
"
```

- [ ] **Step 3: Verify migration**

```bash
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/economy_game' });
Promise.all([
  pool.query(\"SELECT unnest(enum_range(NULL::business_type))::text AS t\"),
  pool.query(\"SELECT column_name FROM information_schema.columns WHERE table_name='businesses' AND column_name='input_inventory'\")
]).then(([types, cols]) => {
  console.log('Types:', types.rows.map(r => r.t));
  console.log('input_inventory column:', cols.rows.length > 0 ? 'EXISTS' : 'MISSING');
  pool.end();
});
"
```

Expected: Types include MILL and BAKERY. input_inventory column exists.

- [ ] **Step 4: Commit**

```bash
git add game/server/src/db/migrations/012_production_chains.sql
git commit -m "T031-1: DB migration for production chains (MILL, BAKERY types + input_inventory)"
```

---

### Task 2: Extend BUSINESS_CONFIG and Types

**Files:**
- Modify: `game/server/src/routes/game.ts` (lines 7-31)

- [ ] **Step 1: Update BUSINESS_CONFIG**

Replace the existing BUSINESS_CONFIG constant (lines 7-11) with:

```typescript
const BUSINESS_CONFIG = {
  FARM:   { cost: 5000,  product: 'Wheat', prodPerWorker: 8,  sellPrice: 5,   upgradeCost: 12000, emoji: '🌾', input: null,    inputPerUnit: 0 },
  MILL:   { cost: 12000, product: 'Flour', prodPerWorker: 4,  sellPrice: 25,  upgradeCost: 20000, emoji: '🏭', input: 'Wheat', inputPerUnit: 2 },
  BAKERY: { cost: 20000, product: 'Bread', prodPerWorker: 2,  sellPrice: 70,  upgradeCost: 30000, emoji: '🍞', input: 'Flour', inputPerUnit: 2 },
  MINE:   { cost: 8000,  product: 'Ore',   prodPerWorker: 5,  sellPrice: 25,  upgradeCost: 25000, emoji: '⛏️', input: null,    inputPerUnit: 0 },
  RETAIL: { cost: 10000, product: 'Goods', prodPerWorker: 6,  sellPrice: 20,  upgradeCost: 20000, emoji: '🏪', input: null,    inputPerUnit: 0 },
} as const;
```

- [ ] **Step 2: Update CreateBizSchema**

Replace the Zod schema (line 23) to include new types:

```typescript
const CreateBizSchema = z.object({
  name: z.string().min(1).max(50),
  type: z.enum(['FARM', 'MINE', 'RETAIL', 'MILL', 'BAKERY']),
});
```

- [ ] **Step 3: Add TransferSchema**

Add below SellSchema (after line 30):

```typescript
const TransferSchema = z.object({
  from_business_id: z.string().uuid(),
  to_business_id: z.string().uuid(),
  quantity: z.number().int().min(1),
});
```

- [ ] **Step 4: Verify server starts**

```bash
cd /home/claude/awesome-claude-code/game/server && pkill -f "tsx src/index.ts" 2>/dev/null; sleep 1; npx tsx src/index.ts >> /tmp/empire_v2.log 2>&1 & disown; sleep 3; curl -sf http://localhost:3000/health && echo "OK"
```

- [ ] **Step 5: Commit**

```bash
git add game/server/src/routes/game.ts
git commit -m "T031-2: Extend BUSINESS_CONFIG with chain types (MILL, BAKERY)"
```

---

### Task 3: Two-Phase gameTick

**Files:**
- Modify: `game/server/src/jobs/gameTick.ts` (full rewrite of production logic)

The current gameTick produces output for all businesses. We need two phases:
1. **Producers** (input === null): Same as before — workers produce output
2. **Converters** (input !== null): Workers convert input_inventory into output, limited by available input

- [ ] **Step 1: Read the current gameTick.ts**

Read the full file at `game/server/src/jobs/gameTick.ts` to understand the exact current implementation.

- [ ] **Step 2: Rewrite gameTick with two-phase production**

The new `runGameTick()` function should:

```typescript
import { query, withTransaction } from '../db/client';

const BUSINESS_CONFIG = {
  FARM:   { prodPerWorker: 8,  sellPrice: 5,   input: null,    inputPerUnit: 0 },
  MILL:   { prodPerWorker: 4,  sellPrice: 25,  input: 'Wheat', inputPerUnit: 2 },
  BAKERY: { prodPerWorker: 2,  sellPrice: 70,  input: 'Flour', inputPerUnit: 2 },
  MINE:   { prodPerWorker: 5,  sellPrice: 25,  input: null,    inputPerUnit: 0 },
  RETAIL: { prodPerWorker: 6,  sellPrice: 20,  input: null,    inputPerUnit: 0 },
} as const;

type BizType = keyof typeof BUSINESS_CONFIG;

export async function runGameTick(): Promise<{ duration_ms: number; businesses: number; produced: number }> {
  const start = Date.now();

  // Fetch all businesses with worker counts
  const bizRes = await query<{
    id: string; owner_id: string; name: string; type: BizType;
    tier: number; inventory: number; input_inventory: number;
    worker_count: string;
  }>(
    `SELECT b.id, b.owner_id, b.name, b.type, b.tier, b.inventory, b.input_inventory,
            (SELECT COUNT(*) FROM workers w WHERE w.business_id = b.id)::text AS worker_count
     FROM businesses b`
  );

  if (!bizRes.rows.length) {
    return { duration_ms: Date.now() - start, businesses: 0, produced: 0 };
  }

  // Separate into producers and converters
  const producers: typeof bizRes.rows = [];
  const converters: typeof bizRes.rows = [];

  for (const biz of bizRes.rows) {
    const cfg = BUSINESS_CONFIG[biz.type];
    if (cfg.input === null) {
      producers.push(biz);
    } else {
      converters.push(biz);
    }
  }

  // --- PHASE 1: Pure Producers (FARM, MINE, RETAIL) ---
  const prodUpdates: { id: string; amount: number }[] = [];
  const prodLogs: { player_id: string; message: string; amount: number }[] = [];

  for (const biz of producers) {
    const workers = Number(biz.worker_count);
    if (workers === 0) continue;
    const cfg = BUSINESS_CONFIG[biz.type];
    const produced = workers * cfg.prodPerWorker * biz.tier;
    prodUpdates.push({ id: biz.id, amount: produced });
    prodLogs.push({
      player_id: biz.owner_id,
      message: `${biz.name} produced ${produced} ${cfg.product}`,
      amount: produced,
    });
  }

  // --- PHASE 2: Converters (MILL, BAKERY) ---
  const convInventoryUpdates: { id: string; outputAdd: number; inputSub: number }[] = [];
  const convLogs: { player_id: string; message: string; amount: number }[] = [];

  for (const biz of converters) {
    const workers = Number(biz.worker_count);
    if (workers === 0) continue;
    const cfg = BUSINESS_CONFIG[biz.type];
    const maxByWorkers = workers * cfg.prodPerWorker * biz.tier;
    const maxByInput = Math.floor(biz.input_inventory / cfg.inputPerUnit);
    const produced = Math.min(maxByWorkers, maxByInput);
    if (produced === 0) continue;
    const consumed = produced * cfg.inputPerUnit;
    convInventoryUpdates.push({ id: biz.id, outputAdd: produced, inputSub: consumed });
    convLogs.push({
      player_id: biz.owner_id,
      message: `${biz.name} converted ${consumed} ${cfg.input} → ${produced} ${cfg.product}`,
      amount: produced,
    });
  }

  let totalProduced = 0;

  await withTransaction(async (client) => {
    // Batch update producers (add to inventory)
    if (prodUpdates.length > 0) {
      const ids = prodUpdates.map(u => u.id);
      const amounts = prodUpdates.map(u => u.amount);
      await client.query(
        `UPDATE businesses b SET inventory = b.inventory + v.amount
         FROM (SELECT UNNEST($1::uuid[]) AS id, UNNEST($2::int[]) AS amount) v
         WHERE b.id = v.id`,
        [ids, amounts]
      );
      totalProduced += amounts.reduce((s, a) => s + a, 0);
    }

    // Batch update converters (add output, subtract input)
    if (convInventoryUpdates.length > 0) {
      const ids = convInventoryUpdates.map(u => u.id);
      const outputAdds = convInventoryUpdates.map(u => u.outputAdd);
      const inputSubs = convInventoryUpdates.map(u => u.inputSub);
      await client.query(
        `UPDATE businesses b
         SET inventory = b.inventory + v.output_add,
             input_inventory = b.input_inventory - v.input_sub
         FROM (SELECT UNNEST($1::uuid[]) AS id, UNNEST($2::int[]) AS output_add, UNNEST($3::int[]) AS input_sub) v
         WHERE b.id = v.id`,
        [ids, outputAdds, inputSubs]
      );
      totalProduced += outputAdds.reduce((s, a) => s + a, 0);
    }

    // Batch insert activity logs
    const allLogs = [...prodLogs, ...convLogs];
    if (allLogs.length > 0) {
      const playerIds = allLogs.map(l => l.player_id);
      const messages = allLogs.map(l => l.message);
      const amounts = allLogs.map(l => l.amount);
      await client.query(
        `INSERT INTO activity_log (player_id, type, message, amount)
         SELECT UNNEST($1::uuid[]), 'PRODUCTION', UNNEST($2::text[]), UNNEST($3::numeric[])`,
        [playerIds, messages, amounts]
      );
    }
  });

  // Update net_worth for all players who own businesses
  await query(
    `UPDATE players p SET net_worth = p.cash + COALESCE((
      SELECT SUM(
        b.inventory * (CASE b.type
          WHEN 'FARM' THEN 5 WHEN 'MILL' THEN 25 WHEN 'BAKERY' THEN 70
          WHEN 'MINE' THEN 25 WHEN 'RETAIL' THEN 20 ELSE 0 END) * b.tier
        + b.input_inventory * (CASE b.type
          WHEN 'MILL' THEN 5 WHEN 'BAKERY' THEN 25 ELSE 0 END)
      ) FROM businesses b WHERE b.owner_id = p.id
    ), 0)
    WHERE p.id IN (SELECT DISTINCT owner_id FROM businesses)`
  );

  // Log tick
  const duration = Date.now() - start;
  const totalBiz = prodUpdates.length + convInventoryUpdates.length;
  await query(
    `INSERT INTO game_ticks (duration_ms, businesses_processed, goods_produced) VALUES ($1, $2, $3)`,
    [duration, totalBiz, totalProduced]
  );

  return { duration_ms: duration, businesses: totalBiz, produced: totalProduced };
}
```

Replace the entire contents of `game/server/src/jobs/gameTick.ts` with this code.

- [ ] **Step 3: Restart server and verify tick works**

```bash
cd /home/claude/awesome-claude-code/game/server && pkill -f "tsx src/index.ts" 2>/dev/null; sleep 1; npx tsx src/index.ts >> /tmp/empire_v2.log 2>&1 & disown; sleep 3
curl -sf http://localhost:3000/dev/tick | python3 -c "import json,sys; print(json.load(sys.stdin))"
```

Expected: Tick runs without errors, returns duration/businesses/produced.

- [ ] **Step 4: Commit**

```bash
git add game/server/src/jobs/gameTick.ts
git commit -m "T031-3: Two-phase gameTick (producers + converters)"
```

---

### Task 4: Transfer Endpoint

**Files:**
- Modify: `game/server/src/routes/game.ts` (add route before the closing `}` of `gameRoutes`)

- [ ] **Step 1: Add the transfer route**

Add this route inside `gameRoutes()`, before the final closing `}`:

```typescript
  // ═══════════════════════════════════════════════════════════════
  // TRANSFER — move output from one business to another's input
  // ═══════════════════════════════════════════════════════════════
  app.post('/transfer', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = TransferSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });

    const { from_business_id, to_business_id, quantity } = parsed.data;
    const pid = req.player.id;

    const result = await withTransaction(async (client) => {
      const [fromRes, toRes] = await Promise.all([
        client.query<{ id: string; type: BizType; inventory: number; name: string }>(
          `SELECT id, type, inventory, name FROM businesses WHERE id = $1 AND owner_id = $2 FOR UPDATE`,
          [from_business_id, pid]
        ),
        client.query<{ id: string; type: BizType; input_inventory: number; name: string }>(
          `SELECT id, type, input_inventory, name FROM businesses WHERE id = $1 AND owner_id = $2 FOR UPDATE`,
          [to_business_id, pid]
        ),
      ]);

      if (!fromRes.rows.length) return { error: 'Source business not found' };
      if (!toRes.rows.length) return { error: 'Destination business not found' };

      const from = fromRes.rows[0];
      const to = toRes.rows[0];
      const fromCfg = BUSINESS_CONFIG[from.type];
      const toCfg = BUSINESS_CONFIG[to.type];

      // Destination must be a converter that accepts this product
      if (toCfg.input === null) {
        return { error: `${to.name} doesn't accept inputs — it's a producer.` };
      }
      if (toCfg.input !== fromCfg.product) {
        return { error: `${to.name} needs ${toCfg.input}, but ${from.name} produces ${fromCfg.product}.` };
      }
      if (from.inventory < quantity) {
        return { error: `${from.name} only has ${from.inventory} ${fromCfg.product} in stock.` };
      }

      await client.query(
        `UPDATE businesses SET inventory = inventory - $1 WHERE id = $2`,
        [quantity, from_business_id]
      );
      await client.query(
        `UPDATE businesses SET input_inventory = input_inventory + $1 WHERE id = $2`,
        [quantity, to_business_id]
      );

      await client.query(
        `INSERT INTO activity_log (player_id, type, message, amount) VALUES ($1, 'TRANSFER', $2, $3)`,
        [pid, `Transferred ${quantity} ${fromCfg.product} from ${from.name} → ${to.name}`, quantity]
      );

      const xpResult = await awardXP(client, pid, 10);
      return { transferred: quantity, product: fromCfg.product, from: from.name, to: to.name, xp: xpResult };
    });

    if ('error' in result) return reply.status(400).send(result);
    return reply.send({
      data: {
        transferred: result.transferred,
        product: result.product,
        from: result.from,
        to: result.to,
        xp_earned: 10,
        leveled_up: result.xp.leveled_up,
        new_level: result.xp.new_level,
      },
    });
  });
```

- [ ] **Step 2: Restart and test transfer**

```bash
cd /home/claude/awesome-claude-code/game/server && pkill -f "tsx src/index.ts" 2>/dev/null; sleep 1; npx tsx src/index.ts >> /tmp/empire_v2.log 2>&1 & disown; sleep 3

API="http://localhost:3000"
TS=$(date +%s)
REG=$(curl -sf -X POST "$API/api/v1/auth/register" -H "Content-Type: application/json" \
  -d "{\"username\":\"chain_${TS}\",\"email\":\"chain_${TS}@test.dev\",\"password\":\"TestPass123!\"}")
TOKEN=$(echo "$REG" | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['access_token'])")

# Create Farm + Mill
FARM=$(curl -sf -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  "$API/api/v1/game/businesses" -d '{"name":"My Farm","type":"FARM"}')
FARM_ID=$(echo "$FARM" | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['business_id'])")

MILL=$(curl -sf -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  "$API/api/v1/game/businesses" -d '{"name":"My Mill","type":"MILL"}')
MILL_ID=$(echo "$MILL" | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['business_id'])")

# Hire worker for farm
curl -sf -X POST -H "Authorization: Bearer $TOKEN" "$API/api/v1/game/businesses/$FARM_ID/hire" > /dev/null

# Trigger tick to produce wheat
curl -sf "$API/dev/tick" > /dev/null

# Check farm inventory
echo "=== After tick ==="
curl -sf -H "Authorization: Bearer $TOKEN" "$API/api/v1/game/businesses/$FARM_ID" | \
  python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print(f'Farm inventory: {d[\"inventory\"]} {d[\"product\"]}')"

# Transfer wheat to mill
echo "=== Transfer ==="
curl -sf -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  "$API/api/v1/game/transfer" -d "{\"from_business_id\":\"$FARM_ID\",\"to_business_id\":\"$MILL_ID\",\"quantity\":4}" | \
  python3 -c "import json,sys; print(json.load(sys.stdin))"
```

Expected: Farm produces Wheat, transfer succeeds, Mill has input_inventory.

- [ ] **Step 3: Commit**

```bash
git add game/server/src/routes/game.ts
git commit -m "T031-4: Transfer endpoint for production chains"
```

---

### Task 5: Update Dashboard Response

**Files:**
- Modify: `game/server/src/routes/game.ts` (dashboard route, ~line 82-240)

- [ ] **Step 1: Add input_inventory to business query**

In the dashboard GET handler, update the businesses query to include `input_inventory`:

Change the bizRes query type from:
```typescript
query<{
  id: string; name: string; type: BizType; tier: number;
  inventory: number; efficiency: string; worker_count: string;
}>
```

To:
```typescript
query<{
  id: string; name: string; type: BizType; tier: number;
  inventory: number; input_inventory: number; efficiency: string; worker_count: string;
}>
```

And update the SQL to include `b.input_inventory`:
```sql
SELECT b.id, b.name, b.type, b.tier, b.inventory, b.input_inventory, b.efficiency,
       (SELECT COUNT(*) FROM workers w WHERE w.business_id = b.id)::text AS worker_count
FROM businesses b WHERE b.owner_id = $1 ORDER BY b.created_at
```

- [ ] **Step 2: Add chain info to business response objects**

In the `businesses` mapping (around line 79-97), add chain fields:

```typescript
const businesses = bizRes.rows.map(b => {
  const cfg = BUSINESS_CONFIG[b.type];
  const workers = Number(b.worker_count);
  const prodPerTick = cfg.input === null
    ? workers * cfg.prodPerWorker * b.tier
    : Math.min(workers * cfg.prodPerWorker * b.tier, Math.floor(b.input_inventory / cfg.inputPerUnit));
  return {
    id: b.id,
    name: b.name,
    type: b.type,
    tier: b.tier,
    inventory: b.inventory,
    input_inventory: b.input_inventory,
    efficiency: Number(b.efficiency),
    workers,
    product: cfg.product,
    input: cfg.input,
    input_per_unit: cfg.inputPerUnit,
    prod_per_tick: prodPerTick,
    sell_price: cfg.sellPrice * b.tier,
    upgrade_cost: cfg.upgradeCost * b.tier,
    emoji: cfg.emoji,
  };
});
```

Note: `prod_per_tick` for converters is now limited by available input_inventory.

- [ ] **Step 3: Add TRANSFER icon to activity feed (already done in client if type exists)**

No server change needed — activity_log already stores type='TRANSFER'. The client just needs the icon mapping (Task 7).

- [ ] **Step 4: Restart and verify dashboard**

```bash
cd /home/claude/awesome-claude-code/game/server && pkill -f "tsx src/index.ts" 2>/dev/null; sleep 1; npx tsx src/index.ts >> /tmp/empire_v2.log 2>&1 & disown; sleep 3
curl -sf http://localhost:3000/health && echo "Server OK"
```

- [ ] **Step 5: Commit**

```bash
git add game/server/src/routes/game.ts
git commit -m "T031-5: Dashboard includes chain info (input_inventory, input type, prod limit)"
```

---

### Task 6: Client — Update Types and BusinessCard

**Files:**
- Modify: `game/client/src/screens/DashboardScreen.tsx`

- [ ] **Step 1: Update V2Business type**

Replace the V2Business interface:

```typescript
interface V2Business {
  id: string;
  name: string;
  type: 'FARM' | 'MINE' | 'RETAIL' | 'MILL' | 'BAKERY';
  tier: number;
  inventory: number;
  input_inventory: number;
  efficiency: number;
  workers: number;
  product: string;
  input: string | null;
  input_per_unit: number;
  prod_per_tick: number;
  sell_price: number;
  upgrade_cost: number;
  emoji: string;
}
```

- [ ] **Step 2: Update BusinessCard to show chain info**

Replace the BusinessCard component to show input requirements for conversion businesses:

```typescript
function BusinessCard({ biz, onHire, onSell, onTransfer, allBusinesses }: {
  biz: V2Business;
  onHire: () => void;
  onSell: () => void;
  onTransfer: (fromId: string) => void;
  allBusinesses: V2Business[];
}) {
  const hasInventory = biz.inventory > 0;
  const isConverter = biz.input !== null;
  const revenuePerTick = biz.prod_per_tick * biz.sell_price;

  // Find businesses that can feed this one
  const feeders = isConverter
    ? allBusinesses.filter(b => {
        const cfg = BUSINESS_CONFIG_CLIENT[b.type];
        return cfg && cfg.product === biz.input && b.inventory > 0 && b.id !== biz.id;
      })
    : [];

  return (
    <View style={s.bizCard}>
      <View style={s.bizHeader}>
        <Text style={s.bizEmoji}>{biz.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.bizName}>{biz.name}</Text>
          <Text style={s.bizMeta}>
            {biz.type} T{biz.tier} · {biz.workers} workers · {biz.product}
          </Text>
        </View>
        {biz.prod_per_tick > 0 && (
          <View style={[s.profitPill, { backgroundColor: C.success + '22' }]}>
            <Text style={[s.profitText, { color: C.success }]}>
              +{formatCurrency(revenuePerTick)}/tick
            </Text>
          </View>
        )}
      </View>

      {/* Chain info for converters */}
      {isConverter && (
        <View style={s.chainInfo}>
          <Text style={s.chainText}>
            Needs: {biz.input_per_unit} {biz.input} → 1 {biz.product}
          </Text>
          <Text style={[s.chainStock, { color: biz.input_inventory > 0 ? C.success : C.error }]}>
            📥 {biz.input_inventory} {biz.input} in stock
          </Text>
        </View>
      )}

      {/* Production info */}
      {biz.workers > 0 ? (
        isConverter && biz.input_inventory === 0 ? (
          <Text style={[s.prodText, { color: C.warning }]}>
            Waiting for {biz.input} — transfer from a {biz.input === 'Wheat' ? 'Farm' : 'Mill'}!
          </Text>
        ) : (
          <Text style={[s.prodText, { color: C.success }]}>
            {isConverter ? 'Converts' : 'Produces'} {biz.prod_per_tick} {biz.product}/tick · Sells at ${biz.sell_price}/unit
          </Text>
        )
      ) : (
        <Text style={[s.prodText, { color: C.error }]}>No workers — not producing!</Text>
      )}

      {/* Output inventory */}
      {hasInventory && (
        <Text style={[s.invText, { color: C.warning }]}>
          📦 {biz.inventory} {biz.product} in stock ({formatCurrency(biz.inventory * biz.sell_price)})
        </Text>
      )}

      {/* Actions */}
      <View style={s.bizActions}>
        <TouchableOpacity
          style={[s.actionBtn, { borderColor: C.success + '66' }]}
          onPress={onHire}
        >
          <Text style={[s.actionBtnText, { color: C.success }]}>+ Hire ($2,000)</Text>
        </TouchableOpacity>

        {hasInventory && (
          <TouchableOpacity
            style={[s.actionBtn, { borderColor: C.warning + '66' }]}
            onPress={onSell}
          >
            <Text style={[s.actionBtnText, { color: C.warning }]}>
              Sell {biz.inventory} ({formatCurrency(biz.inventory * biz.sell_price)})
            </Text>
          </TouchableOpacity>
        )}

        {/* Transfer buttons: show for businesses whose output feeds this converter */}
        {feeders.map(feeder => (
          <TouchableOpacity
            key={feeder.id}
            style={[s.actionBtn, { borderColor: C.accent + '66' }]}
            onPress={() => onTransfer(feeder.id)}
          >
            <Text style={[s.actionBtnText, { color: C.accent }]}>
              ← {feeder.inventory} {biz.input} from {feeder.name}
            </Text>
          </TouchableOpacity>
        ))}

        <View style={s.upgradeInfo}>
          <Text style={s.upgradeText}>
            Upgrade T{biz.tier + 1}: {formatCurrency(biz.upgrade_cost)}
          </Text>
        </View>
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Add BUSINESS_CONFIG_CLIENT constant**

Add near the top of the file (after the theme constants):

```typescript
const BUSINESS_CONFIG_CLIENT: Record<string, { product: string; input: string | null }> = {
  FARM:   { product: 'Wheat', input: null },
  MILL:   { product: 'Flour', input: 'Wheat' },
  BAKERY: { product: 'Bread', input: 'Flour' },
  MINE:   { product: 'Ore',   input: null },
  RETAIL: { product: 'Goods', input: null },
};
```

- [ ] **Step 4: Add chain styles**

Add to the StyleSheet:

```typescript
  // Chain Info
  chainInfo: {
    backgroundColor: C.primary + '11',
    borderRadius: 6,
    padding: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: C.primary + '22',
  },
  chainText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.accent,
  },
  chainStock: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
```

- [ ] **Step 5: Commit**

```bash
git add game/client/src/screens/DashboardScreen.tsx
git commit -m "T031-6: Client chain-aware BusinessCard with input display and transfer buttons"
```

---

### Task 7: Client — Transfer Mutation and Updated CreateBusiness

**Files:**
- Modify: `game/client/src/screens/DashboardScreen.tsx`

- [ ] **Step 1: Add transfer mutation in DashboardScreen**

In the DashboardScreen component, add the transfer mutation after sellMut:

```typescript
  const transferMut = useMutation({
    mutationFn: ({ fromId, toId, qty }: { fromId: string; toId: string; qty: number }) =>
      api.post('/game/transfer', { from_business_id: fromId, to_business_id: toId, quantity: qty }),
    onSuccess: (data: any) => {
      const d = data?.data || data;
      const xp = d?.xp_earned ? ` (+${d.xp_earned} XP)` : '';
      show(`Transferred ${d?.transferred} ${d?.product}!${xp}`, 'success');
      if (d?.leveled_up) show(`Level Up! You're now Level ${d.new_level}!`, 'info');
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: any) => show(err?.message || 'Transfer failed', 'error'),
  });
```

- [ ] **Step 2: Update BusinessCard rendering to pass transfer handler and allBusinesses**

In the businesses rendering section, update the BusinessCard usage:

```typescript
{data.businesses.map((biz) => (
  <BusinessCard
    key={biz.id}
    biz={biz}
    allBusinesses={data.businesses}
    onHire={() => hireMut.mutate(biz.id)}
    onSell={() => sellMut.mutate({ bizId: biz.id, qty: biz.inventory })}
    onTransfer={(fromId) => {
      const feeder = data.businesses.find(b => b.id === fromId);
      if (feeder) transferMut.mutate({ fromId, toId: biz.id, qty: feeder.inventory });
    }}
  />
))}
```

- [ ] **Step 3: Update CreateBusinessSection with chain types**

Replace the `types` array in CreateBusinessSection:

```typescript
  const types = [
    { type: 'FARM',   emoji: '🌾', cost: 5000,  product: 'Wheat' },
    { type: 'MILL',   emoji: '🏭', cost: 12000, product: 'Flour (needs Wheat)' },
    { type: 'BAKERY', emoji: '🍞', cost: 20000, product: 'Bread (needs Flour)' },
    { type: 'MINE',   emoji: '⛏️', cost: 8000,  product: 'Ore' },
    { type: 'RETAIL', emoji: '🏪', cost: 10000, product: 'Goods' },
  ] as const;
```

Update the createRow style to handle 5 items with wrapping:

```typescript
  createRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
```

And update each createBtn to have a fixed width instead of flex:1:

```typescript
  createBtn: {
    width: '30%',
    flexGrow: 1,
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.cardBorder,
    gap: 3,
  },
```

- [ ] **Step 4: Add TRANSFER to activity feed icons**

Update the typeIcons object in ActivityFeed:

```typescript
  const typeIcons: Record<string, string> = {
    PRODUCTION: '⚙️',
    SALE: '💰',
    HIRE: '👤',
    CREATE_BIZ: '🏗️',
    UPGRADE: '⬆️',
    TICK: '🔄',
    LEVEL_UP: '🎉',
    TRANSFER: '🔄',
  };
```

- [ ] **Step 5: Commit**

```bash
git add game/client/src/screens/DashboardScreen.tsx
git commit -m "T031-7: Transfer mutation, chain CreateBusiness, activity icons"
```

---

### Task 8: Validation — Chain Tests

**Files:**
- Modify: `game/tests/validate.sh` (add chain test section after existing Level 2)

- [ ] **Step 1: Read current validate.sh**

Read the full file at `game/tests/validate.sh` to understand the test framework (pass/fail helpers, auth flow, etc.).

- [ ] **Step 2: Add chain tests after the existing Level 2 section**

After the existing Level 2 cleanup test, add a new section:

```bash
# ═══════════════════════════════════════════════════════════════
# LEVEL 3 — Production Chain (Food Chain)
# ═══════════════════════════════════════════════════════════════
if [ "$LEVEL" != "1" ] && [ "$LEVEL" != "2" ]; then

header "LEVEL 3 — Production Chain (Food Chain)"

# Register fresh test user for chain tests
CHAIN_UNIQUE=$(date +%s%N | tail -c 8)
CHAIN_USER="chain_${CHAIN_UNIQUE}"
CHAIN_EMAIL="${CHAIN_USER}@test.empireos.dev"
CHAIN_PASS="ChainTest_${CHAIN_UNIQUE}!"

CHAIN_REG=$(api_call POST "/auth/register" "{\"username\":\"$CHAIN_USER\",\"email\":\"$CHAIN_EMAIL\",\"password\":\"$CHAIN_PASS\"}")
CHAIN_TOKEN=$(echo "$CHAIN_REG" | jq -r '.data.access_token // empty')

if [ -n "$CHAIN_TOKEN" ]; then
  pass "chain-register" "user=$CHAIN_USER"
else
  fail "chain-register" "Could not register chain test user"
fi

# Create Farm
FARM_RES=$(api_call POST "/game/businesses" '{"name":"Test Farm","type":"FARM"}' "$CHAIN_TOKEN")
FARM_ID=$(echo "$FARM_RES" | jq -r '.data.business_id // empty')
[ -n "$FARM_ID" ] && pass "chain-create-farm" "id=${FARM_ID:0:8}..." || fail "chain-create-farm" "No business_id"

# Hire worker for farm
HIRE_RES=$(api_call_no_body POST "/game/businesses/$FARM_ID/hire" "$CHAIN_TOKEN")
HIRE_NAME=$(echo "$HIRE_RES" | jq -r '.data.name // empty')
[ -n "$HIRE_NAME" ] && pass "chain-hire-farm-worker" "$HIRE_NAME" || fail "chain-hire-farm-worker" "Hire failed"

# Trigger tick → Farm produces Wheat
TICK_RES=$(curl -sf "$API/dev/tick")
[ -n "$TICK_RES" ] && pass "chain-tick-1" "Tick completed" || fail "chain-tick-1" "Tick failed"

# Verify farm has Wheat inventory
FARM_DETAIL=$(api_call GET "/game/businesses/$FARM_ID" "" "$CHAIN_TOKEN")
FARM_INV=$(echo "$FARM_DETAIL" | jq -r '.data.inventory // 0')
FARM_PROD=$(echo "$FARM_DETAIL" | jq -r '.data.product // empty')
[ "$FARM_INV" -ge 8 ] && pass "chain-wheat-produced" "inventory=$FARM_INV $FARM_PROD" || fail "chain-wheat-produced" "Expected ≥8, got $FARM_INV"

# Create Mill
MILL_RES=$(api_call POST "/game/businesses" '{"name":"Test Mill","type":"MILL"}' "$CHAIN_TOKEN")
MILL_ID=$(echo "$MILL_RES" | jq -r '.data.business_id // empty')
[ -n "$MILL_ID" ] && pass "chain-create-mill" "id=${MILL_ID:0:8}..." || fail "chain-create-mill" "No business_id"

# Transfer Wheat from Farm to Mill
TRANSFER_RES=$(api_call POST "/game/transfer" "{\"from_business_id\":\"$FARM_ID\",\"to_business_id\":\"$MILL_ID\",\"quantity\":$FARM_INV}" "$CHAIN_TOKEN")
TRANSFERRED=$(echo "$TRANSFER_RES" | jq -r '.data.transferred // 0')
[ "$TRANSFERRED" -ge 8 ] && pass "chain-transfer-wheat" "transferred=$TRANSFERRED" || fail "chain-transfer-wheat" "Expected ≥8, got $TRANSFERRED"

# Hire worker for Mill
MILL_HIRE=$(api_call_no_body POST "/game/businesses/$MILL_ID/hire" "$CHAIN_TOKEN")
[ -n "$(echo "$MILL_HIRE" | jq -r '.data.name // empty')" ] && pass "chain-hire-mill-worker" || fail "chain-hire-mill-worker"

# Trigger tick → Mill converts Wheat to Flour
TICK2=$(curl -sf "$API/dev/tick")
pass "chain-tick-2" "Tick completed"

# Verify Mill produced Flour
MILL_DETAIL=$(api_call GET "/game/businesses/$MILL_ID" "" "$CHAIN_TOKEN")
MILL_INV=$(echo "$MILL_DETAIL" | jq -r '.data.inventory // 0')
MILL_PROD=$(echo "$MILL_DETAIL" | jq -r '.data.product // empty')
[ "$MILL_INV" -ge 1 ] && pass "chain-flour-produced" "inventory=$MILL_INV $MILL_PROD" || fail "chain-flour-produced" "Expected ≥1 Flour, got $MILL_INV"

# Sell Flour
SELL_RES=$(api_call POST "/game/sell" "{\"business_id\":\"$MILL_ID\",\"quantity\":$MILL_INV}" "$CHAIN_TOKEN")
SELL_REV=$(echo "$SELL_RES" | jq -r '.data.revenue // 0')
[ "$SELL_REV" -gt 0 ] && pass "chain-sell-flour" "revenue=\$$SELL_REV" || fail "chain-sell-flour" "No revenue"

# Cleanup
api_call_raw "DELETE FROM activity_log WHERE player_id = (SELECT id FROM players WHERE username = '$CHAIN_USER')" > /dev/null 2>&1
api_call_raw "DELETE FROM workers WHERE business_id IN (SELECT id FROM businesses WHERE owner_id = (SELECT id FROM players WHERE username = '$CHAIN_USER'))" > /dev/null 2>&1
api_call_raw "DELETE FROM businesses WHERE owner_id = (SELECT id FROM players WHERE username = '$CHAIN_USER')" > /dev/null 2>&1
api_call_raw "DELETE FROM refresh_tokens WHERE player_id = (SELECT id FROM players WHERE username = '$CHAIN_USER')" > /dev/null 2>&1
CHAIN_DEL=$(api_call_raw "DELETE FROM players WHERE username = '$CHAIN_USER'")
CHAIN_DEL_COUNT=$(echo "$CHAIN_DEL" | grep -oP '\d+' | head -1)
pass "chain-cleanup" "removed ($CHAIN_DEL_COUNT rows)"

fi
```

**IMPORTANT:** The above is a template. You must adapt it to use the exact helper functions (`api_call`, `api_call_no_body`, `api_call_raw`, `pass`, `fail`, `header`) that exist in the current validate.sh. Read the file first to get the exact function signatures.

The cleanup section uses direct SQL — check how the existing cleanup does it (likely via the `/dev/snapshot` endpoint or direct DB access).

- [ ] **Step 3: Run validation**

```bash
cd /home/claude/awesome-claude-code/game && ./dev.sh validate
```

Expected: All Level 1 + Level 2 + Level 3 tests pass.

- [ ] **Step 4: Commit**

```bash
git add game/tests/validate.sh
git commit -m "T031-8: Chain validation tests (Farm→Wheat→Mill→Flour→Sell)"
```

---

### Task 9: Build, Deploy, and Final Validation

**Files:**
- Modify: `game/.intel/tasks.json`
- Modify: `game/.intel/execution.log`

- [ ] **Step 1: Rebuild web client**

```bash
cd /home/claude/awesome-claude-code/game/client && npx expo export --platform web
```

- [ ] **Step 2: Restart all services**

```bash
cd /home/claude/awesome-claude-code/game
pkill -f "tsx src/index.ts" 2>/dev/null; sleep 1
cd server && npx tsx src/index.ts >> /tmp/empire_v2.log 2>&1 & disown; sleep 3
cd ../client && pkill -f "serve dist" 2>/dev/null; sleep 1; npx serve dist -l 8080 > /tmp/web.log 2>&1 & disown; sleep 2
```

- [ ] **Step 3: Run full validation**

```bash
cd /home/claude/awesome-claude-code/game && ./dev.sh validate
```

Expected: ALL tests pass (Level 1 + Level 2 + Level 3).

- [ ] **Step 4: Update task queue**

Mark T031 (production chains food chain) as done in `game/.intel/tasks.json`. Add the task if it doesn't exist:

```json
{
  "id": "T031",
  "title": "Production Chains — Food Chain (Farm→Wheat→Mill→Flour→Bakery→Bread)",
  "status": "done",
  "priority": "high",
  "phase": "chains",
  "created_at": "2026-03-27",
  "completed_at": "<today>",
  "notes": "BUSINESS_CONFIG extended, two-phase gameTick, transfer endpoint, chain-aware dashboard, validation tests"
}
```

- [ ] **Step 5: Update execution log**

Append to `game/.intel/execution.log`:
```
[YYYY-MM-DD HH:MM] T031 — Production Chains Food Chain: DB migration, BUSINESS_CONFIG, two-phase gameTick, transfer endpoint, chain BusinessCard, validation tests
```

- [ ] **Step 6: Final commit**

```bash
cd /home/claude/awesome-claude-code
git add -f game/.intel/tasks.json game/.intel/execution.log game/client/src/ game/server/src/ game/tests/
git commit -m "T031: Production Chains — Food Chain complete

- DB: MILL/BAKERY business types, input_inventory column
- Server: BUSINESS_CONFIG with input/inputPerUnit for chain types
- Server: Two-phase gameTick (producers → converters)
- Server: POST /game/transfer to move goods between businesses
- Server: Dashboard includes chain info (input_inventory, production limits)
- Client: Chain-aware BusinessCard with input display + transfer buttons
- Client: CreateBusiness includes MILL and BAKERY options
- Validation: Chain tests (Farm→Wheat→Mill→Flour→Sell)
- FARM product changed: Food→Wheat ($15→$5)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"

git push origin claude/economy-game-mvp-spec-J4Zj7
```

---

## Post-Implementation Notes

**Breaking change:** FARM now produces "Wheat" at $5/unit instead of "Food" at $15/unit. Existing farms will produce lower-value goods. This is intentional — the value is recovered through the chain.

**Next chains (separate plans):**
1. Metal Chain: MINE→Ore (lower price), SMELTER→Iron, WORKSHOP→Tools
2. Wood Chain: LUMBER→Planks, CARPENTER→Furniture

**Future enhancements (not in this plan):**
- Market system for buying/selling resources between players
- Auto-transfer (configure continuous resource flow between businesses)
- Chain efficiency bonuses (+20-25% for optimized setups)
- Chain visualization (flow diagram in UI)
