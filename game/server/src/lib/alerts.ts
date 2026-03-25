import { query } from '../db/client';
import type { AlertType } from '../../../shared/src/types/entities';

export async function createAlert(
  playerId: string,
  seasonId: string,
  type: AlertType,
  message: string,
  data?: Record<string, unknown>,
): Promise<void> {
  await query(
    `INSERT INTO alerts (id, player_id, season_id, type, message, data, read, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, false, NOW())`,
    [
      crypto.randomUUID(),
      playerId,
      seasonId,
      type,
      message,
      JSON.stringify(data ?? {}),
    ],
  );
}

export async function getPlayerAlerts(
  playerId: string,
  limit = 50,
): Promise<unknown[]> {
  const res = await query(
    `SELECT * FROM alerts
     WHERE player_id = $1
     ORDER BY read ASC, created_at DESC
     LIMIT $2`,
    [playerId, limit],
  );
  return res.rows;
}

export async function getUnreadAlertCount(
  playerId: string,
): Promise<number> {
  const res = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM alerts
     WHERE player_id = $1 AND read = false`,
    [playerId],
  );
  return parseInt(res.rows[0]?.count ?? '0', 10);
}

export async function markAlertRead(alertId: string): Promise<boolean> {
  const res = await query(
    `UPDATE alerts SET read = true WHERE id = $1 RETURNING id`,
    [alertId],
  );
  return res.rows.length > 0;
}

export async function markAllAlertsRead(playerId: string): Promise<number> {
  const res = await query(
    `UPDATE alerts SET read = true
     WHERE player_id = $1 AND read = false
     RETURNING id`,
    [playerId],
  );
  return res.rows.length;
}
