import { query } from '../db/client';
import type { SeasonProfile } from '../../../shared/src/types/entities';

export async function getCurrentSeason(): Promise<SeasonProfile | null> {
  const res = await query<SeasonProfile>(
    `SELECT * FROM season_profiles WHERE status = 'ACTIVE' ORDER BY started_at DESC LIMIT 1`
  );
  if (res.rows.length === 0) return null;
  return res.rows[0];
}

export async function getSeasonById(id: string): Promise<SeasonProfile | null> {
  const res = await query<SeasonProfile>(
    `SELECT * FROM season_profiles WHERE id = $1`,
    [id]
  );
  if (res.rows.length === 0) return null;
  return res.rows[0];
}
