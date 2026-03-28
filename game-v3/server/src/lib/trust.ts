// EmpireOS V3 — Trust System
// Pairwise trust between players. Affects contract terms and trade prices.

type QueryFn = (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;

/** Get or create trust record between two players (always sorted so A < B) */
export async function getTrust(dbQuery: QueryFn, playerA: string, playerB: string): Promise<{ trust_score: number; contracts_completed: number; contracts_missed: number; trades_completed: number; betrayals: number }> {
  const [a, b] = playerA < playerB ? [playerA, playerB] : [playerB, playerA];

  const res = await dbQuery(
    'SELECT trust_score, contracts_completed, contracts_missed, trades_completed, betrayals FROM player_trust WHERE player_a = $1 AND player_b = $2',
    [a, b],
  );

  if (res.rows.length) {
    return {
      trust_score: Number(res.rows[0].trust_score),
      contracts_completed: Number(res.rows[0].contracts_completed),
      contracts_missed: Number(res.rows[0].contracts_missed),
      trades_completed: Number(res.rows[0].trades_completed),
      betrayals: Number(res.rows[0].betrayals),
    };
  }

  // Create default
  await dbQuery(
    'INSERT INTO player_trust (player_a, player_b) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [a, b],
  );
  return { trust_score: 50, contracts_completed: 0, contracts_missed: 0, trades_completed: 0, betrayals: 0 };
}

/** Adjust trust between two players */
export async function adjustTrust(
  dbQuery: QueryFn,
  playerA: string,
  playerB: string,
  delta: number,
  reason: 'contract_completed' | 'contract_missed' | 'trade' | 'betrayal' | 'poach' | 'sabotage',
): Promise<number> {
  const [a, b] = playerA < playerB ? [playerA, playerB] : [playerB, playerA];

  const counterCol =
    reason === 'contract_completed' ? 'contracts_completed = contracts_completed + 1' :
    reason === 'contract_missed' ? 'contracts_missed = contracts_missed + 1' :
    reason === 'trade' ? 'trades_completed = trades_completed + 1' :
    'betrayals = betrayals + 1';

  const res = await dbQuery(
    `INSERT INTO player_trust (player_a, player_b, trust_score, ${reason === 'contract_completed' ? 'contracts_completed' : reason === 'contract_missed' ? 'contracts_missed' : reason === 'trade' ? 'trades_completed' : 'betrayals'})
     VALUES ($1, $2, $3, 1)
     ON CONFLICT (player_a, player_b) DO UPDATE SET
       trust_score = LEAST(100, GREATEST(0, player_trust.trust_score + $4)),
       ${counterCol},
       last_interaction = NOW()
     RETURNING trust_score`,
    [a, b, Math.max(0, Math.min(100, 50 + delta)), delta],
  );

  return Number(res.rows[0]?.trust_score ?? 50);
}
