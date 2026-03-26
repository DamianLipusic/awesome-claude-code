import { query, withTransaction } from '../db/client';
import type { PoolClient } from 'pg';
import { CITIES } from '../../../shared/src/types/entities';
import { GAME_BALANCE } from './constants';
import { secureRandom, secureRandomInt } from './random';

// ─── Event Templates ──────────────────────────────────────────

export interface EventEffects {
  heat_multiplier?: number;
  crime_success_rate?: number;
  revenue_multiplier?: number;
  demand_increase?: number;
  demand_decrease?: number;
  employee_loyalty_penalty?: number;
  fear_bonus?: number;
  community_bonus?: number;
  logistics_cost_multiplier?: number;
  supply_reduction?: number;
  employee_cost_reduction?: number;
  efficiency_bonus?: number;
  upgrade_cost_reduction?: number;
}

export interface EventTemplate {
  duration_ticks: number;
  effects: EventEffects;
  title: string;
  description: string;
  category: string;
}

export const EVENT_TEMPLATES: Record<string, EventTemplate> = {
  POLICE_CRACKDOWN: {
    duration_ticks: 12,
    effects: { heat_multiplier: 2.0, crime_success_rate: -0.3 },
    title: 'Police Crackdown',
    description: 'Law enforcement is conducting a major crackdown. Crime detection doubled, success rates reduced.',
    category: 'POLICE_CRACKDOWN',
  },
  MARKET_BOOM: {
    duration_ticks: 8,
    effects: { revenue_multiplier: 1.5, demand_increase: 0.4 },
    title: 'Market Boom',
    description: 'Consumer spending surges! Business revenues increased by 50%.',
    category: 'BOOM',
  },
  MARKET_CRASH: {
    duration_ticks: 8,
    effects: { revenue_multiplier: 0.6, demand_decrease: 0.3 },
    title: 'Market Crash',
    description: 'Economic downturn hits hard. Business revenues drop to 60%.',
    category: 'MARKET_CRASH',
  },
  GANG_WAR: {
    duration_ticks: 6,
    effects: { employee_loyalty_penalty: -10, fear_bonus: 5 },
    title: 'Gang War',
    description: 'Violence erupts between factions. Employee loyalty drops, but fear keeps some in line.',
    category: 'DISASTER',
  },
  FESTIVAL: {
    duration_ticks: 4,
    effects: { revenue_multiplier: 1.3, community_bonus: 3 },
    title: 'City Festival',
    description: 'A major festival brings crowds and spending. Revenue up 30%.',
    category: 'BOOM',
  },
  PORT_STRIKE: {
    duration_ticks: 10,
    effects: { logistics_cost_multiplier: 2.5, supply_reduction: 0.5 },
    title: 'Port Strike',
    description: 'Dock workers go on strike. Logistics costs skyrocket, supply halved.',
    category: 'EMPLOYEE_STRIKE',
  },
  RECESSION: {
    duration_ticks: 16,
    effects: { revenue_multiplier: 0.7, employee_cost_reduction: 0.8 },
    title: 'Economic Recession',
    description: 'A prolonged downturn. Revenues drop but labor becomes cheaper.',
    category: 'MARKET_CRASH',
  },
  TECH_BOOM: {
    duration_ticks: 6,
    effects: { efficiency_bonus: 0.2, upgrade_cost_reduction: 0.7 },
    title: 'Tech Boom',
    description: 'Technological advances boost efficiency and lower upgrade costs.',
    category: 'BOOM',
  },
};

// ─── Event Modifiers (aggregated from active events) ──────────

export interface EventModifiers {
  heat_multiplier: number;
  crime_success_rate_modifier: number;
  revenue_multiplier: number;
  logistics_cost_multiplier: number;
  employee_loyalty_modifier: number;
  efficiency_bonus: number;
  supply_reduction: number;
}

const DEFAULT_MODIFIERS: EventModifiers = {
  heat_multiplier: 1.0,
  crime_success_rate_modifier: 0.0,
  revenue_multiplier: 1.0,
  logistics_cost_multiplier: 1.0,
  employee_loyalty_modifier: 0,
  efficiency_bonus: 0.0,
  supply_reduction: 0.0,
};

// ─── Roll Random Events ───────────────────────────────────────
// Called once per tick. For each city, 5% chance to spawn a new event.

export async function rollRandomEvents(): Promise<void> {
  const seasonRes = await query<{ id: string }>(
    "SELECT id FROM season_profiles WHERE status = 'ACTIVE' LIMIT 1",
  );
  if (!seasonRes.rows.length) return;
  const seasonId = seasonRes.rows[0].id;

  for (const city of CITIES) {
    // Check concurrent event count for this city
    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM seasonal_events
        WHERE season_id = $1 AND status = 'ACTIVE'
          AND (impact_json->>'target_city' = $2 OR impact_json->>'target_city' IS NULL)`,
      [seasonId, city.name],
    );
    const activeCount = parseInt(countRes.rows[0].count);
    if (activeCount >= GAME_BALANCE.MAX_CONCURRENT_EVENTS) continue;

    // Roll for event
    if (secureRandom() >= GAME_BALANCE.EVENT_CHANCE_PER_CITY) continue;

    // Pick a random event template
    const templateKeys = Object.keys(EVENT_TEMPLATES);
    const key = templateKeys[secureRandomInt(0, templateKeys.length)];
    const template = EVENT_TEMPLATES[key];

    // Convert duration_ticks to hours (5 min per tick => ticks * 5 / 60)
    const durationHours = Math.max(1, Math.round((template.duration_ticks * 5) / 60));

    // Magnitude scales with city size
    const sizeMagnitude: Record<string, number> = {
      SMALL: 0.8, MEDIUM: 1.0, LARGE: 1.2, CAPITAL: 1.5,
    };
    const magnitude = sizeMagnitude[city.size] ?? 1.0;

    await query(
      `INSERT INTO seasonal_events
       (season_id, category, title, description, impact_json, triggered_at, status, duration_hours)
       VALUES ($1, $2, $3, $4, $5, NOW(), 'ACTIVE', $6)`,
      [
        seasonId,
        template.category,
        `${template.title} in ${city.name}`,
        template.description,
        JSON.stringify({
          ...template.effects,
          target_city: city.name,
          magnitude,
          template_key: key,
        }),
        durationHours,
      ],
    );

    console.log(`[Events] Triggered ${key} in ${city.name} (duration: ${durationHours}h)`);

    // Check for cascade effects
    await checkCascadeEffects(key, city.name, seasonId);
  }
}

// ─── Event Modifier Cache (cleared per game tick) ─────────────

const _eventModCache = new Map<string, EventModifiers>();

export function clearEventModifierCache(): void {
  _eventModCache.clear();
}

// ─── Get Active Event Modifiers for a City ────────────────────

export async function getActiveEventModifiers(seasonId: string, cityName?: string): Promise<EventModifiers> {
  const cacheKey = `${seasonId}:${cityName || '_global'}`;
  const cached = _eventModCache.get(cacheKey);
  if (cached) return cached;
  const result = await query<{ impact_json: Record<string, any> }>(
    `SELECT impact_json FROM seasonal_events
      WHERE season_id = $1
        AND status = 'ACTIVE'
        AND triggered_at <= NOW()
        AND (duration_hours IS NULL OR (triggered_at + (duration_hours || ' hours')::interval) > NOW())`,
    [seasonId],
  );

  const mods: EventModifiers = { ...DEFAULT_MODIFIERS };

  for (const row of result.rows) {
    const impact = row.impact_json;

    // Only apply city-specific events if they match, or apply global events (no target_city)
    if (cityName && impact.target_city && impact.target_city !== cityName) {
      continue;
    }

    const mag = (impact.magnitude as number) ?? 1.0;

    if (impact.heat_multiplier) {
      mods.heat_multiplier *= impact.heat_multiplier;
    }
    if (impact.crime_success_rate) {
      mods.crime_success_rate_modifier += impact.crime_success_rate * mag;
    }
    if (impact.revenue_multiplier) {
      const effectiveMultiplier = 1 + (impact.revenue_multiplier - 1) * mag;
      mods.revenue_multiplier *= effectiveMultiplier;
    }
    if (impact.logistics_cost_multiplier) {
      mods.logistics_cost_multiplier *= impact.logistics_cost_multiplier;
    }
    if (impact.employee_loyalty_penalty) {
      mods.employee_loyalty_modifier += impact.employee_loyalty_penalty * mag;
    }
    if (impact.efficiency_bonus) {
      mods.efficiency_bonus += impact.efficiency_bonus * mag;
    }
    if (impact.supply_reduction) {
      mods.supply_reduction = Math.min(0.8, mods.supply_reduction + impact.supply_reduction * mag);
    }
  }

  _eventModCache.set(cacheKey, mods);
  return mods;
}

// ─── Cascade Effects ──────────────────────────────────────────
// Some events can trigger follow-up events.

const CASCADE_RULES: Record<string, { triggers: string; chance: number }[]> = {
  POLICE_CRACKDOWN: [
    { triggers: 'GANG_WAR', chance: 0.15 },
  ],
  MARKET_CRASH: [
    { triggers: 'RECESSION', chance: 0.20 },
  ],
  PORT_STRIKE: [
    { triggers: 'MARKET_CRASH', chance: 0.10 },
  ],
  GANG_WAR: [
    { triggers: 'POLICE_CRACKDOWN', chance: 0.25 },
  ],
  RECESSION: [
    { triggers: 'MARKET_CRASH', chance: 0.05 },
  ],
};

async function checkCascadeEffects(
  templateKey: string,
  cityName: string,
  seasonId: string,
): Promise<void> {
  const rules = CASCADE_RULES[templateKey];
  if (!rules) return;

  for (const rule of rules) {
    if (secureRandom() >= rule.chance) continue;

    const cascadeTemplate = EVENT_TEMPLATES[rule.triggers];
    if (!cascadeTemplate) continue;

    const durationHours = Math.max(1, Math.round((cascadeTemplate.duration_ticks * 5) / 60));

    await query(
      `INSERT INTO seasonal_events
       (season_id, category, title, description, impact_json, triggered_at, status, duration_hours)
       VALUES ($1, $2, $3, $4, $5, NOW() + interval '5 minutes', 'ACTIVE', $6)`,
      [
        seasonId,
        cascadeTemplate.category,
        `${cascadeTemplate.title} in ${cityName} (Cascade)`,
        `Triggered as a consequence of ${EVENT_TEMPLATES[templateKey].title}. ${cascadeTemplate.description}`,
        JSON.stringify({
          ...cascadeTemplate.effects,
          target_city: cityName,
          magnitude: 0.8,
          template_key: rule.triggers,
          cascaded_from: templateKey,
        }),
        durationHours,
      ],
    );

    console.log(`[Events] CASCADE: ${templateKey} -> ${rule.triggers} in ${cityName}`);
  }
}

// ─── Expire Old Events ───────────────────────────────────────

export async function expireOldEvents(): Promise<void> {
  const result = await query<{ id: string; title: string }>(
    `UPDATE seasonal_events
        SET status = 'RESOLVED'
      WHERE status = 'ACTIVE'
        AND triggered_at + (duration_hours || ' hours')::interval <= NOW()
      RETURNING id, title`,
  );

  for (const evt of result.rows) {
    console.log(`[Events] Expired: ${evt.title} (${evt.id})`);
  }
}
