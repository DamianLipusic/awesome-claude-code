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

  // Inventory value: batch-fetch all resource prices in one query, then compute in-memory
  const inventoryRes = await query(
    `SELECT b.inventory
     FROM businesses b
     WHERE b.owner_id = $1 AND b.status != 'BANKRUPT'`,
    [playerId],
  );

  // Collect all unique resource names across inventories
  // (inventory keys are resource names, not UUIDs)
  const resourceNames = new Set<string>();
  for (const row of inventoryRes.rows) {
    const inventory = row.inventory as Record<string, number>;
    for (const [resourceName, qty] of Object.entries(inventory)) {
      if (qty > 0) resourceNames.add(resourceName);
    }
  }

  // Single query to fetch all prices at once by name
  const priceMap = new Map<string, number>();
  if (resourceNames.size > 0) {
    const names = Array.from(resourceNames);
    const placeholders = names.map((_, i) => `$${i + 1}`).join(',');
    const priceRes = await query<{ name: string; current_ai_price: string }>(
      `SELECT name, current_ai_price FROM resources WHERE name IN (${placeholders})`,
      names,
    );
    for (const row of priceRes.rows) {
      priceMap.set(row.name, Number(row.current_ai_price));
    }
  }

  // Compute inventory value from in-memory price map
  let inventoryValue = 0;
  for (const row of inventoryRes.rows) {
    const inventory = row.inventory as Record<string, number>;
    for (const [resourceName, qty] of Object.entries(inventory)) {
      if (qty <= 0) continue;
      const price = priceMap.get(resourceName);
      if (price) inventoryValue += qty * price;
    }
  }

  const netWorth = cash + businessValue + inventoryValue;

  await query('UPDATE players SET net_worth = $1 WHERE id = $2', [netWorth, playerId]);

  return netWorth;
}
