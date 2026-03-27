import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, withTransaction } from '../db/client';
import { requireAuth } from '../middleware/auth';

// ─── Game Constants ──────────────────────────────────────────────
const BUSINESS_CONFIG = {
  FARM:   { cost: 5000,  product: 'Food',    prodPerWorker: 8,  sellPrice: 15,  upgradeCost: 15000, emoji: '🌾' },
  MINE:   { cost: 8000,  product: 'Ore',     prodPerWorker: 5,  sellPrice: 25,  upgradeCost: 25000, emoji: '⛏️' },
  RETAIL: { cost: 10000, product: 'Goods',   prodPerWorker: 6,  sellPrice: 20,  upgradeCost: 20000, emoji: '🏪' },
} as const;

const WORKER_COST = 2000;
const WORKER_NAMES = [
  'Alex', 'Jordan', 'Sam', 'Casey', 'Riley', 'Morgan', 'Taylor', 'Quinn',
  'Avery', 'Blake', 'Charlie', 'Drew', 'Ellis', 'Frankie', 'Gray', 'Harper',
];

type BizType = keyof typeof BUSINESS_CONFIG;

// ─── Schemas ─────────────────────────────────────────────────────
const CreateBizSchema = z.object({
  name: z.string().min(1).max(50),
  type: z.enum(['FARM', 'MINE', 'RETAIL']),
});

const SellSchema = z.object({
  business_id: z.string().uuid(),
  quantity: z.number().int().min(1),
});

// ─── Routes ──────────────────────────────────────────────────────
export async function gameRoutes(app: FastifyInstance): Promise<void> {
  // All game routes require auth
  app.addHook('preHandler', requireAuth);

  // ═══════════════════════════════════════════════════════════════
  // DASHBOARD — the main screen data
  // ═══════════════════════════════════════════════════════════════
  app.get('/dashboard', async (req: FastifyRequest, reply: FastifyReply) => {
    const pid = req.player.id;

    const [playerRes, bizRes, activityRes, earningsRes, lastTickRes] = await Promise.all([
      query<{ cash: string; net_worth: string; created_at: string }>(
        `SELECT cash, net_worth, created_at FROM players WHERE id = $1`, [pid]
      ),
      query<{
        id: string; name: string; type: BizType; tier: number;
        inventory: number; efficiency: string; worker_count: string;
      }>(
        `SELECT b.id, b.name, b.type, b.tier, b.inventory, b.efficiency,
                (SELECT COUNT(*) FROM workers w WHERE w.business_id = b.id)::text AS worker_count
         FROM businesses b WHERE b.owner_id = $1 ORDER BY b.created_at`, [pid]
      ),
      query<{ type: string; message: string; amount: string | null; created_at: string }>(
        `SELECT type, message, amount, created_at FROM activity_log
         WHERE player_id = $1 ORDER BY created_at DESC LIMIT 20`, [pid]
      ),
      // Earnings summary: income (sales only) and expenses in the last hour
      query<{ total_income: string; total_expenses: string; sale_count: string }>(
        `SELECT
          COALESCE(SUM(CASE WHEN type = 'SALE' THEN amount ELSE 0 END), 0)::text AS total_income,
          COALESCE(SUM(CASE WHEN type IN ('CREATE_BIZ','HIRE','UPGRADE') THEN ABS(amount) ELSE 0 END), 0)::text AS total_expenses,
          COUNT(CASE WHEN type = 'SALE' THEN 1 END)::text AS sale_count
         FROM activity_log
         WHERE player_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`, [pid]
      ),
      // Last tick time
      query<{ completed_at: string }>(
        `SELECT completed_at FROM game_ticks ORDER BY completed_at DESC LIMIT 1`
      ),
    ]);

    if (!playerRes.rows.length) {
      return reply.status(404).send({ error: 'Player not found' });
    }

    const player = playerRes.rows[0];
    const businesses = bizRes.rows.map(b => {
      const cfg = BUSINESS_CONFIG[b.type];
      const workers = Number(b.worker_count);
      const prodPerTick = workers * cfg.prodPerWorker * (b.tier);
      return {
        id: b.id,
        name: b.name,
        type: b.type,
        tier: b.tier,
        inventory: b.inventory,
        efficiency: Number(b.efficiency),
        workers,
        product: cfg.product,
        prod_per_tick: prodPerTick,
        sell_price: cfg.sellPrice * b.tier,
        upgrade_cost: cfg.upgradeCost * b.tier,
        emoji: cfg.emoji,
      };
    });

    // Calculate income potential
    const totalProdValue = businesses.reduce((sum, b) => sum + (b.prod_per_tick * b.sell_price), 0);
    const cash = Number(player.cash);
    const netWorth = Number(player.net_worth);
    const totalWorkers = businesses.reduce((s, b) => s + b.workers, 0);

    // Milestone system — clear progression targets
    const MILESTONES = [
      { name: 'Newcomer',      req: 'Create your first business',       check: () => businesses.length >= 1,        icon: '🌱' },
      { name: 'Employer',      req: 'Hire your first worker',           check: () => totalWorkers >= 1,             icon: '👤' },
      { name: 'Producer',      req: 'Reach $51,000 cash (earn $1k)',    check: () => cash >= 51000,                 icon: '📦' },
      { name: 'Entrepreneur',  req: 'Own 3 businesses',                 check: () => businesses.length >= 3,        icon: '🏢' },
      { name: 'Boss',          req: 'Hire 10 workers',                  check: () => totalWorkers >= 10,            icon: '💼' },
      { name: 'Upgrader',      req: 'Upgrade a business to Tier 2',     check: () => businesses.some(b => b.tier >= 2), icon: '⬆' },
      { name: 'Mogul',         req: 'Reach $100,000 net worth',         check: () => netWorth >= 100000,            icon: '💎' },
      { name: 'Diversified',   req: 'Own one of each business type',    check: () => {
        const types = new Set(businesses.map(b => b.type));
        return types.has('FARM') && types.has('MINE') && types.has('RETAIL');
      }, icon: '🎯' },
      { name: 'Tycoon',        req: 'Reach $500,000 net worth',         check: () => netWorth >= 500000,            icon: '🏆' },
      { name: 'Empire',        req: 'Reach $1,000,000 net worth',       check: () => netWorth >= 1000000,           icon: '👑' },
    ];

    let currentMilestone = { name: 'Starter', icon: '🚀' };
    let nextMilestone = MILESTONES[0];
    let completedCount = 0;
    for (const m of MILESTONES) {
      if (m.check()) {
        currentMilestone = { name: m.name, icon: m.icon };
        completedCount++;
      } else {
        nextMilestone = m;
        break;
      }
    }
    if (completedCount === MILESTONES.length) nextMilestone = null as any;

    // Smarter next action based on state
    let next_action = 'Create your first business!';
    if (businesses.length === 0) {
      next_action = 'Create your first business to start earning!';
    } else if (businesses.every(b => b.workers === 0)) {
      next_action = 'Hire workers — they produce goods every tick!';
    } else if (businesses.some(b => b.inventory > 0)) {
      const totalValue = businesses.reduce((s, b) => s + b.inventory * b.sell_price, 0);
      next_action = `Sell inventory for $${totalValue.toLocaleString()}!`;
    } else if (nextMilestone) {
      next_action = `Goal: ${nextMilestone.req}`;
    } else {
      next_action = 'You built an empire! Keep growing!';
    }

    const earnings = earningsRes.rows[0];
    const lastTick = lastTickRes.rows[0];
    const income = Number(earnings.total_income);
    const expenses = Number(earnings.total_expenses);
    const profit = income - expenses;

    return reply.send({
      data: {
        player: {
          cash,
          net_worth: netWorth,
          joined: player.created_at,
          rank: currentMilestone,
          next_milestone: nextMilestone ? { name: nextMilestone.name, req: nextMilestone.req, icon: nextMilestone.icon } : null,
          milestones_completed: completedCount,
          milestones_total: MILESTONES.length,
        },
        businesses,
        activity: activityRes.rows.map(a => ({
          type: a.type,
          message: a.message,
          amount: a.amount ? Number(a.amount) : null,
          time: a.created_at,
        })),
        stats: {
          total_businesses: businesses.length,
          total_workers: businesses.reduce((s, b) => s + b.workers, 0),
          income_per_tick: totalProdValue,
        },
        earnings: {
          income,
          expenses,
          profit,
          sales: Number(earnings.sale_count),
        },
        tick: {
          last_at: lastTick?.completed_at || null,
          interval_ms: 120000,
        },
        next_action,
      },
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // CREATE BUSINESS
  // ═══════════════════════════════════════════════════════════════
  app.post('/businesses', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = CreateBizSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });

    const { name, type } = parsed.data;
    const pid = req.player.id;
    const cost = BUSINESS_CONFIG[type].cost;

    const result = await withTransaction(async (client) => {
      const cashRes = await client.query<{ cash: string }>(`SELECT cash FROM players WHERE id = $1 FOR UPDATE`, [pid]);
      const cash = Number(cashRes.rows[0].cash);

      if (cash < cost) {
        return { error: `Not enough cash. Need $${cost.toLocaleString()}, have $${cash.toLocaleString()}.` };
      }

      await client.query(`UPDATE players SET cash = cash - $1, net_worth = net_worth - $1 WHERE id = $2`, [cost, pid]);

      const bizRes = await client.query<{ id: string }>(
        `INSERT INTO businesses (owner_id, name, type) VALUES ($1, $2, $3) RETURNING id`,
        [pid, name, type]
      );

      await client.query(
        `INSERT INTO activity_log (player_id, type, message, amount) VALUES ($1, 'CREATE_BIZ', $2, $3)`,
        [pid, `Created ${BUSINESS_CONFIG[type].emoji} ${name} (${type})`, -cost]
      );

      return { id: bizRes.rows[0].id };
    });

    if ('error' in result) return reply.status(400).send(result);
    return reply.status(201).send({ data: { business_id: result.id, cost } });
  });

  // ═══════════════════════════════════════════════════════════════
  // HIRE WORKER
  // ═══════════════════════════════════════════════════════════════
  app.post('/businesses/:bizId/hire', async (req: FastifyRequest<{ Params: { bizId: string } }>, reply: FastifyReply) => {
    const pid = req.player.id;
    const bizId = req.params.bizId;

    const result = await withTransaction(async (client) => {
      const bizRes = await client.query<{ id: string; type: BizType; tier: number; name: string }>(
        `SELECT id, type, tier, name FROM businesses WHERE id = $1 AND owner_id = $2`, [bizId, pid]
      );
      if (!bizRes.rows.length) return { error: 'Business not found' };

      const biz = bizRes.rows[0];
      const maxWorkers = biz.tier * 3;

      const workerCount = await client.query<{ count: string }>(
        `SELECT COUNT(*) FROM workers WHERE business_id = $1`, [bizId]
      );
      if (Number(workerCount.rows[0].count) >= maxWorkers) {
        return { error: `Max ${maxWorkers} workers at tier ${biz.tier}. Upgrade to hire more!` };
      }

      const cashRes = await client.query<{ cash: string }>(`SELECT cash FROM players WHERE id = $1 FOR UPDATE`, [pid]);
      if (Number(cashRes.rows[0].cash) < WORKER_COST) {
        return { error: `Not enough cash. Workers cost $${WORKER_COST.toLocaleString()}.` };
      }

      await client.query(`UPDATE players SET cash = cash - $1 WHERE id = $2`, [WORKER_COST, pid]);

      const workerName = WORKER_NAMES[Math.floor(Math.random() * WORKER_NAMES.length)];
      const skill = 40 + Math.floor(Math.random() * 40); // 40-80

      const wRes = await client.query<{ id: string }>(
        `INSERT INTO workers (business_id, name, skill) VALUES ($1, $2, $3) RETURNING id`,
        [bizId, workerName, skill]
      );

      await client.query(
        `INSERT INTO activity_log (player_id, type, message, amount) VALUES ($1, 'HIRE', $2, $3)`,
        [pid, `Hired ${workerName} (skill ${skill}) at ${biz.name}`, -WORKER_COST]
      );

      return { worker: { id: wRes.rows[0].id, name: workerName, skill } };
    });

    if ('error' in result) return reply.status(400).send(result);
    return reply.status(201).send({ data: result.worker });
  });

  // ═══════════════════════════════════════════════════════════════
  // SELL INVENTORY
  // ═══════════════════════════════════════════════════════════════
  app.post('/sell', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = SellSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.errors[0].message });

    const { business_id, quantity } = parsed.data;
    const pid = req.player.id;

    const result = await withTransaction(async (client) => {
      const bizRes = await client.query<{ id: string; type: BizType; tier: number; inventory: number; name: string }>(
        `SELECT id, type, tier, inventory, name FROM businesses WHERE id = $1 AND owner_id = $2 FOR UPDATE`,
        [business_id, pid]
      );
      if (!bizRes.rows.length) return { error: 'Business not found' };

      const biz = bizRes.rows[0];
      if (biz.inventory < quantity) {
        return { error: `Only ${biz.inventory} units in inventory.` };
      }

      const cfg = BUSINESS_CONFIG[biz.type];
      const unitPrice = cfg.sellPrice * biz.tier;
      const revenue = quantity * unitPrice;

      await client.query(`UPDATE businesses SET inventory = inventory - $1 WHERE id = $2`, [quantity, business_id]);
      await client.query(`UPDATE players SET cash = cash + $1, net_worth = net_worth + $1 WHERE id = $2`, [revenue, pid]);

      await client.query(
        `INSERT INTO activity_log (player_id, type, message, amount) VALUES ($1, 'SALE', $2, $3)`,
        [pid, `Sold ${quantity} ${cfg.product} from ${biz.name} at $${unitPrice}/unit`, revenue]
      );

      return { revenue, quantity, unit_price: unitPrice, product: cfg.product };
    });

    if ('error' in result) return reply.status(400).send(result);
    return reply.send({ data: result });
  });

  // ═══════════════════════════════════════════════════════════════
  // UPGRADE BUSINESS
  // ═══════════════════════════════════════════════════════════════
  app.post('/businesses/:bizId/upgrade', async (req: FastifyRequest<{ Params: { bizId: string } }>, reply: FastifyReply) => {
    const pid = req.player.id;
    const bizId = req.params.bizId;

    const result = await withTransaction(async (client) => {
      const bizRes = await client.query<{ id: string; type: BizType; tier: number; name: string }>(
        `SELECT id, type, tier, name FROM businesses WHERE id = $1 AND owner_id = $2 FOR UPDATE`,
        [bizId, pid]
      );
      if (!bizRes.rows.length) return { error: 'Business not found' };

      const biz = bizRes.rows[0];
      if (biz.tier >= 5) return { error: 'Already at max tier!' };

      const cfg = BUSINESS_CONFIG[biz.type];
      const cost = cfg.upgradeCost * biz.tier;

      const cashRes = await client.query<{ cash: string }>(`SELECT cash FROM players WHERE id = $1 FOR UPDATE`, [pid]);
      if (Number(cashRes.rows[0].cash) < cost) {
        return { error: `Need $${cost.toLocaleString()} to upgrade.` };
      }

      await client.query(`UPDATE businesses SET tier = tier + 1 WHERE id = $1`, [bizId]);
      await client.query(`UPDATE players SET cash = cash - $1 WHERE id = $2`, [cost, pid]);

      await client.query(
        `INSERT INTO activity_log (player_id, type, message, amount) VALUES ($1, 'UPGRADE', $2, $3)`,
        [pid, `Upgraded ${biz.name} to Tier ${biz.tier + 1}`, -cost]
      );

      return { new_tier: biz.tier + 1, cost };
    });

    if ('error' in result) return reply.status(400).send(result);
    return reply.send({ data: result });
  });

  // ═══════════════════════════════════════════════════════════════
  // SELL ALL — quick sell all inventory across all businesses
  // ═══════════════════════════════════════════════════════════════
  app.post('/sell-all', async (req: FastifyRequest, reply: FastifyReply) => {
    const pid = req.player.id;

    const result = await withTransaction(async (client) => {
      const bizRes = await client.query<{ id: string; type: BizType; tier: number; inventory: number; name: string }>(
        `SELECT id, type, tier, inventory, name FROM businesses WHERE owner_id = $1 AND inventory > 0 FOR UPDATE`,
        [pid]
      );

      if (!bizRes.rows.length) return { error: 'No inventory to sell.' };

      let totalRevenue = 0;
      let totalUnits = 0;
      const sales: { business: string; quantity: number; revenue: number }[] = [];

      for (const biz of bizRes.rows) {
        const cfg = BUSINESS_CONFIG[biz.type];
        const unitPrice = cfg.sellPrice * biz.tier;
        const revenue = biz.inventory * unitPrice;
        totalRevenue += revenue;
        totalUnits += biz.inventory;
        sales.push({ business: biz.name, quantity: biz.inventory, revenue });

        await client.query(`UPDATE businesses SET inventory = 0 WHERE id = $1`, [biz.id]);
        await client.query(
          `INSERT INTO activity_log (player_id, type, message, amount) VALUES ($1, 'SALE', $2, $3)`,
          [pid, `Sold ${biz.inventory} ${cfg.product} from ${biz.name}`, revenue]
        );
      }

      await client.query(`UPDATE players SET cash = cash + $1, net_worth = net_worth + $1 WHERE id = $2`, [totalRevenue, pid]);

      return { total_revenue: totalRevenue, total_units: totalUnits, sales };
    });

    if ('error' in result) return reply.status(400).send(result);
    return reply.send({ data: result });
  });

  // ═══════════════════════════════════════════════════════════════
  // BUSINESS DETAIL
  // ═══════════════════════════════════════════════════════════════
  app.get('/businesses/:bizId', async (req: FastifyRequest<{ Params: { bizId: string } }>, reply: FastifyReply) => {
    const pid = req.player.id;
    const bizId = req.params.bizId;

    const [bizRes, workersRes, activityRes] = await Promise.all([
      query<{ id: string; name: string; type: BizType; tier: number; inventory: number; efficiency: string; created_at: string }>(
        `SELECT id, name, type, tier, inventory, efficiency, created_at FROM businesses WHERE id = $1 AND owner_id = $2`,
        [bizId, pid]
      ),
      query<{ id: string; name: string; skill: number; hired_at: string }>(
        `SELECT id, name, skill, hired_at FROM workers WHERE business_id = $1 ORDER BY hired_at`, [bizId]
      ),
      query<{ type: string; message: string; amount: string | null; created_at: string }>(
        `SELECT type, message, amount, created_at FROM activity_log
         WHERE player_id = $1 AND message LIKE '%' || (SELECT name FROM businesses WHERE id = $2) || '%'
         ORDER BY created_at DESC LIMIT 10`, [pid, bizId]
      ),
    ]);

    if (!bizRes.rows.length) return reply.status(404).send({ error: 'Business not found' });

    const b = bizRes.rows[0];
    const cfg = BUSINESS_CONFIG[b.type];
    const workers = workersRes.rows;
    const prodPerTick = workers.length * cfg.prodPerWorker * b.tier;

    return reply.send({
      data: {
        id: b.id,
        name: b.name,
        type: b.type,
        tier: b.tier,
        inventory: b.inventory,
        efficiency: Number(b.efficiency),
        emoji: cfg.emoji,
        product: cfg.product,
        prod_per_tick: prodPerTick,
        sell_price: cfg.sellPrice * b.tier,
        upgrade_cost: cfg.upgradeCost * b.tier,
        max_workers: b.tier * 3,
        workers,
        activity: activityRes.rows.map(a => ({
          type: a.type,
          message: a.message,
          amount: a.amount ? Number(a.amount) : null,
          time: a.created_at,
        })),
      },
    });
  });
}
