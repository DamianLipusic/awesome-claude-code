import { query } from '../db/client';

/**
 * Recalculates and persists net_worth for a player.
 * net_worth = cash + business_value (depreciated) + inventory_value
 */
export async function recalculateNetWorth(playerId: string): Promise<number> {
  // Get current cash
  const playerRes = await query('SELECT cash FROM players WHERE id = $1', [playerId]);
  if (playerRes.rows.length === 0) return 0;
  const cash = Number(playerRes.rows[0].cash);

  // Business value: depreciated startup cost per type/tier
  const businessRes = await query(
    `SELECT type, tier FROM businesses WHERE owner_id = $1 AND status != 'BANKRUPT'`,
    [playerId],
  );

  const STARTUP_COSTS: Record<string, number[]> = {
    RETAIL: [5000, 30000, 170000, 600000, 1800000],
    FACTORY: [20000, 120000, 680000, 2400000, 7200000],
    MINE: [15000, 90000, 510000, 1800000, 5400000],
    FARM: [8000, 48000, 272000, 960000, 2880000],
    LOGISTICS: [12000, 72000, 408000, 1440000, 4320000],
    SECURITY_FIRM: [10000, 60000, 340000, 1200000, 3600000],
    FRONT_COMPANY: [18000, 108000, 612000, 2160000, 6480000],
  };

  let businessValue = 0;
  for (const b of businessRes.rows) {
    const type = String(b.type);
    const tier = Number(b.tier);
    const costs = STARTUP_COSTS[type] ?? [5000];
    const tierCost = costs[Math.min(tier - 1, costs.length - 1)] ?? 5000;
    businessValue += tierCost * 0.7; // 70% book value
  }

  // Inventory value: sum all business inventories × current AI price
  const inventoryRes = await query(
    `SELECT b.inventory, s.id as season_id
     FROM businesses b
     JOIN players p ON b.owner_id = p.id
     JOIN season_profiles s ON s.id = p.season_id
     WHERE b.owner_id = $1 AND b.status != 'BANKRUPT'`,
    [playerId],
  );

  let inventoryValue = 0;
  for (const row of inventoryRes.rows) {
    const inventory = row.inventory as Record<string, number>;
    for (const [resourceId, qty] of Object.entries(inventory)) {
      if (qty <= 0) continue;
      const priceRes = await query(
        'SELECT current_ai_price FROM resources WHERE id = $1',
        [resourceId],
      );
      if (priceRes.rows.length > 0) {
        inventoryValue += qty * Number(priceRes.rows[0].current_ai_price);
      }
    }
  }

  const netWorth = cash + businessValue + inventoryValue;

  await query('UPDATE players SET net_worth = $1 WHERE id = $2', [netWorth, playerId]);

  return netWorth;
}
