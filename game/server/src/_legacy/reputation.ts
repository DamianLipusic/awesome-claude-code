import { query } from '../db/client';

// The 6 reputation axes matching the DB schema
export const REPUTATION_AXES = ['BUSINESS', 'CRIMINAL', 'NEGOTIATION', 'EMPLOYEE', 'COMMUNITY', 'RELIABILITY'] as const;
export type ReputationAxis = (typeof REPUTATION_AXES)[number];

const DEFAULT_SCORE = 50;
const MIN_SCORE = 0;
const MAX_SCORE = 100;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Get a player's reputation on a specific axis (0-100, default 50).
 */
export async function getReputation(playerId: string, axis: string): Promise<number> {
  const result = await query<{ score: number }>(
    `SELECT score FROM reputation_profiles WHERE player_id = $1 AND axis = $2`,
    [playerId, axis],
  );
  return result.rows.length > 0 ? Number(result.rows[0].score) : DEFAULT_SCORE;
}

/**
 * Get all 6 reputation axes for a player as a Record.
 */
export async function getReputationProfile(playerId: string): Promise<Record<string, number>> {
  const result = await query<{ axis: string; score: number }>(
    `SELECT axis, score FROM reputation_profiles WHERE player_id = $1`,
    [playerId],
  );
  const profile: Record<string, number> = {};
  for (const axis of REPUTATION_AXES) {
    profile[axis] = DEFAULT_SCORE;
  }
  for (const row of result.rows) {
    profile[row.axis] = Number(row.score);
  }
  return profile;
}

/**
 * Apply a reputation modifier to a base value.
 * reputation is 0-100 (50 = neutral). factor controls strength.
 * Returns baseValue * (1 + (reputation - 50) / 50 * factor)
 * e.g. rep 75, factor 0.3 => baseValue * 1.15
 */
export function applyReputationModifier(baseValue: number, reputation: number, factor: number): number {
  const normalized = (reputation - 50) / 50; // -1 to +1
  return baseValue * (1 + normalized * factor);
}

/**
 * Calculate employee loyalty modifier based on EMPLOYEE and NEGOTIATION reputation.
 * Returns a value to ADD to loyalty calculations (can be negative).
 * High EMPLOYEE rep => employees are more loyal. Range roughly -5 to +5.
 */
export function employeeLoyaltyModifier(reputation: Record<string, number>): number {
  const empRep = reputation['EMPLOYEE'] ?? DEFAULT_SCORE;
  const negRep = reputation['NEGOTIATION'] ?? DEFAULT_SCORE;
  // Weighted: 70% employee rep, 30% negotiation rep
  const combined = empRep * 0.7 + negRep * 0.3;
  // Normalized from -5 to +5
  return ((combined - 50) / 50) * 5;
}

/**
 * Calculate police attention modifier based on CRIMINAL reputation (notoriety).
 * Returns a multiplier for detection/heat gain chances.
 * High CRIMINAL rep => more police attention (higher multiplier).
 * Range: 0.7 (low notoriety) to 1.5 (high notoriety).
 */
export function policeAttentionModifier(notoriety: number): number {
  // notoriety is 0-100, default 50
  // 0 => 0.7x detection, 50 => 1.0x, 100 => 1.5x
  return 0.7 + (notoriety / 100) * 0.8;
}

/**
 * Calculate business revenue modifier based on BUSINESS, COMMUNITY, and RELIABILITY rep.
 * Returns a multiplier for revenue. Range: 0.85 to 1.25.
 */
export function businessRevenueModifier(reputation: Record<string, number>): number {
  const bizRep = reputation['BUSINESS'] ?? DEFAULT_SCORE;
  const comRep = reputation['COMMUNITY'] ?? DEFAULT_SCORE;
  const relRep = reputation['RELIABILITY'] ?? DEFAULT_SCORE;
  // Weighted average: 50% business, 30% community, 20% reliability
  const combined = bizRep * 0.5 + comRep * 0.3 + relRep * 0.2;
  // Map 0-100 to 0.85-1.25
  return 0.85 + (combined / 100) * 0.4;
}

/**
 * Adjust a player's reputation on a given axis by delta.
 * Inserts the profile row if missing, then updates. Also logs an event.
 */
export async function adjustReputation(
  playerId: string,
  axis: ReputationAxis,
  delta: number,
  reason: string = 'game_action',
): Promise<{ oldScore: number; newScore: number }> {
  // Ensure row exists
  await query(
    `INSERT INTO reputation_profiles (player_id, axis, score)
     VALUES ($1, $2, $3)
     ON CONFLICT (player_id, axis) DO NOTHING`,
    [playerId, axis, DEFAULT_SCORE],
  );

  // Get current score
  const current = await query<{ score: number }>(
    `SELECT score FROM reputation_profiles WHERE player_id = $1 AND axis = $2`,
    [playerId, axis],
  );
  const oldScore = current.rows.length > 0 ? Number(current.rows[0].score) : DEFAULT_SCORE;
  const newScore = clamp(oldScore + delta, MIN_SCORE, MAX_SCORE);

  // Update
  await query(
    `UPDATE reputation_profiles SET score = $1, updated_at = NOW()
     WHERE player_id = $2 AND axis = $3`,
    [newScore, playerId, axis],
  );

  // Log event
  await query(
    `INSERT INTO reputation_events (player_id, event_type, axis, impact, description)
     VALUES ($1, $2, $3, $4, $5)`,
    [playerId, 'SYSTEM', axis, delta, reason],
  );

  return { oldScore, newScore };
}

/**
 * Decay all reputation scores toward 50 (neutral) by a percentage per tick.
 * decayPercent = 0.005 means 0.5% per tick.
 */
export async function decayAllReputation(decayPercent: number = 0.005): Promise<void> {
  // Move scores toward 50 by decayPercent of the distance from 50
  await query(
    `UPDATE reputation_profiles
     SET score = score - (score - 50) * $1,
         updated_at = NOW()
     WHERE ABS(score - 50) > 0.5`,
    [decayPercent],
  );
}
