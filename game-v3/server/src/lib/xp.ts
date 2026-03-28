// Shared XP award helper — handles level-up detection and activity logging.

import { calculateLevel, XP_REWARDS } from '../config/game.config.js';
import type { PoolClient } from 'pg';

export { XP_REWARDS, calculateLevel };

export async function awardXP(
  client: PoolClient,
  playerId: string,
  amount: number,
): Promise<{ newXp: number; newLevel: number; leveledUp: boolean }> {
  if (amount <= 0) return { newXp: 0, newLevel: 1, leveledUp: false };

  const res = await client.query<{ xp: number; level: number }>(
    `UPDATE players SET xp = xp + $1 WHERE id = $2 RETURNING xp, level`,
    [amount, playerId],
  );
  const { xp, level: oldLevel } = res.rows[0];
  const { level: newLevel } = calculateLevel(xp);

  if (newLevel !== oldLevel) {
    await client.query(`UPDATE players SET level = $1 WHERE id = $2`, [newLevel, playerId]);
    await client.query(
      `INSERT INTO activity_log (player_id, type, message, amount)
       VALUES ($1, 'LEVEL_UP', $2, $3)`,
      [playerId, `Reached Level ${newLevel}!`, amount],
    );
  }

  return { newXp: xp, newLevel, leveledUp: newLevel > oldLevel };
}
