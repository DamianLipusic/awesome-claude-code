// EmpireOS V3 — Random Events Engine
// Called during economy tick. Creates time-limited events that affect prices/production.

import type { PoolClient } from 'pg';

interface EventDef {
  type: string;
  title: string;
  description: string;
  icon: string;
  durationMinutes: number;
  modifiers: Record<string, number>; // e.g. { price_modifier: 1.5 }
  affectedItems?: string[]; // item keys
  weight: number;
}

const EVENT_DEFS: EventDef[] = [
  {
    type: 'market_boom',
    title: 'Market Boom!',
    description: 'Demand is surging — sell prices are up 40%!',
    icon: '📈',
    durationMinutes: 30,
    modifiers: { price_modifier: 1.4 },
    weight: 20,
  },
  {
    type: 'market_crash',
    title: 'Market Crash',
    description: 'Prices have dropped 30%. Buy low!',
    icon: '📉',
    durationMinutes: 20,
    modifiers: { price_modifier: 0.7 },
    weight: 15,
  },
  {
    type: 'supply_shortage',
    title: 'Supply Shortage',
    description: 'Raw materials are scarce. AI market supply halved.',
    icon: '⚠️',
    durationMinutes: 45,
    modifiers: { supply_modifier: 0.5 },
    affectedItems: ['ore', 'wheat'],
    weight: 15,
  },
  {
    type: 'production_boost',
    title: 'Worker Motivation',
    description: 'Workers are extra motivated! Production +25% for all businesses.',
    icon: '💪',
    durationMinutes: 30,
    modifiers: { production_modifier: 1.25 },
    weight: 20,
  },
  {
    type: 'tax_audit',
    title: 'Tax Audit',
    description: 'The tax office is watching. Daily costs increase 20%.',
    icon: '🏛️',
    durationMinutes: 60,
    modifiers: { cost_modifier: 1.2 },
    weight: 10,
  },
  {
    type: 'lucky_shipment',
    title: 'Lucky Shipment!',
    description: 'A free shipment of goods arrived at the docks!',
    icon: '🎁',
    durationMinutes: 15,
    modifiers: { free_goods: 1 },
    weight: 10,
  },
  {
    type: 'gold_rush',
    title: 'Gold Rush!',
    description: 'Ore prices doubled! Miners rejoice.',
    icon: '⛏️',
    durationMinutes: 20,
    modifiers: { price_modifier: 2.0 },
    affectedItems: ['ore', 'steel', 'tools'],
    weight: 10,
  },
];

function pickWeightedEvent(): EventDef {
  const totalWeight = EVENT_DEFS.reduce((s, e) => s + e.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const ev of EVENT_DEFS) {
    roll -= ev.weight;
    if (roll <= 0) return ev;
  }
  return EVENT_DEFS[0];
}

/**
 * Maybe create a new event. Called during economy tick.
 * 15% chance per tick (every 5 min) = roughly 1 event per 30 minutes.
 */
export async function maybeCreateEvent(client: PoolClient): Promise<{ created: boolean; event?: string }> {
  // Check if there's already an active event
  const activeRes = await client.query(
    "SELECT COUNT(*)::int AS cnt FROM game_events WHERE active = TRUE AND ends_at > NOW()",
  );
  if (Number(activeRes.rows[0].cnt) >= 2) {
    return { created: false }; // Max 2 concurrent events
  }

  // 15% chance
  if (Math.random() > 0.15) {
    return { created: false };
  }

  const ev = pickWeightedEvent();
  const seasonRes = await client.query<{ id: string }>("SELECT id FROM seasons WHERE status = 'active' LIMIT 1");
  const seasonId = seasonRes.rows[0]?.id ?? null;

  await client.query(
    `INSERT INTO game_events (season_id, type, title, description, icon, modifiers, affected_items, ends_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + ($8 || ' minutes')::interval)`,
    [seasonId, ev.type, ev.title, ev.description, ev.icon, JSON.stringify(ev.modifiers), ev.affectedItems ?? [], String(ev.durationMinutes)],
  );

  return { created: true, event: ev.title };
}

/** Expire old events */
export async function expireEvents(client: PoolClient): Promise<number> {
  const res = await client.query(
    "UPDATE game_events SET active = FALSE WHERE active = TRUE AND ends_at <= NOW() RETURNING id",
  );
  return res.rowCount ?? 0;
}

/** Get active events */
export async function getActiveEvents(client: PoolClient): Promise<{ type: string; title: string; description: string; icon: string; modifiers: Record<string, number>; affected_items: string[]; ends_at: string }[]> {
  const res = await client.query(
    "SELECT type, title, description, icon, modifiers, affected_items, ends_at FROM game_events WHERE active = TRUE AND ends_at > NOW() ORDER BY started_at DESC",
  );
  return res.rows;
}
