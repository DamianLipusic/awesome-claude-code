import type { HeatLevel } from '../../../shared/src/types/entities';
import { DETECTION_BASE_RATE, BRIBE_DISCOUNT } from './constants';
import { query } from '../db/client';

export interface DetectionContext {
  risk_level: number;           // 1–10 from CRIME_OP_CONFIGS
  security_reduction: number;   // 0.0–0.65 from security layer
  informant_active: boolean;    // from heat_scores.informant_active
  bribe_applied: boolean;       // whether bribe discount applies
}

/**
 * Detection check implementing:
 *   probability = base(0.02) * heat_multiplier * risk_multiplier
 *                 * (1 - security_reduction)
 *                 * (1 + informant_bonus)
 *                 - bribe_discount
 * clamped to [0.001, 0.95]
 */
export function calcDetectionProbability(
  heatScore: number,
  ctx: DetectionContext
): number {
  const base = DETECTION_BASE_RATE; // 0.02

  // Heat multiplier: COLD=1, WARM=2, HOT=4, BURNING=7, FUGITIVE=12
  const heatMultiplier = getHeatMultiplier(heatScore);

  // Risk multiplier: linear scale 1–10 → 0.5–3.0
  const riskMultiplier = 0.5 + (ctx.risk_level - 1) * (2.5 / 9);

  // Security reduction from installed security layer
  const secReduction = Math.min(ctx.security_reduction, 0.65);

  // Informant bonus: if active, +50% detection chance
  const informantBonus = ctx.informant_active ? 0.5 : 0;

  // Bribe discount
  const bribeDiscount = ctx.bribe_applied ? BRIBE_DISCOUNT : 0;

  const probability =
    base * heatMultiplier * riskMultiplier *
    (1 - secReduction) *
    (1 + informantBonus) -
    bribeDiscount;

  // Clamp to [0.001, 0.95]
  return Math.max(0.001, Math.min(0.95, probability));
}

/**
 * Performs a random detection roll.
 * Returns { detected: boolean, roll: number, probability: number }
 */
export function detection_check(
  heatScore: number,
  ctx: DetectionContext
): { detected: boolean; roll: number; probability: number } {
  const probability = calcDetectionProbability(heatScore, ctx);
  const roll = Math.random();
  return {
    detected: roll < probability,
    roll,
    probability,
  };
}

export function getHeatLevel(score: number): HeatLevel {
  if (score >= 900) return 'FUGITIVE';
  if (score >= 600) return 'BURNING';
  if (score >= 300) return 'HOT';
  if (score >= 100) return 'WARM';
  return 'COLD';
}

function getHeatMultiplier(score: number): number {
  const level = getHeatLevel(score);
  switch (level) {
    case 'COLD':     return 1.0;
    case 'WARM':     return 2.0;
    case 'HOT':      return 4.0;
    case 'BURNING':  return 7.0;
    case 'FUGITIVE': return 12.0;
    default:         return 1.0;
  }
}

/**
 * Fetch security reduction for a given player in a given season
 * by looking up their businesses' security layers.
 */
export async function getPlayerSecurityReduction(playerId: string): Promise<number> {
  const res = await query<{ protection_rating: string }>(
    `SELECT sl.protection_rating
       FROM security_layers sl
       JOIN businesses b ON b.id = sl.business_id
      WHERE b.owner_id = $1
        AND b.status NOT IN ('RAIDED', 'BANKRUPT')
      ORDER BY sl.protection_rating DESC
      LIMIT 1`,
    [playerId]
  );
  if (res.rows.length === 0) return 0;
  return parseFloat(res.rows[0].protection_rating);
}
