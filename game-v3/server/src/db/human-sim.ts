// EmpireOS V3 — Human Player Simulator
// Simulates realistic player behavior over multiple rounds.
// Each player has a personality that determines their strategy.

import pool from './client.js';
import bcrypt from 'bcrypt';

const BASE = 'http://localhost:3000/api/v1';

// ─── Player Personalities ─────────────────────────────────────────
interface Persona {
  name: string;
  email: string;
  strategy: 'grinder' | 'trader' | 'criminal' | 'balanced' | 'newbie' | 'tycoon' | 'spy' | 'saboteur';
  description: string;
}

const PERSONAS: Persona[] = [
  { name: 'GrindKing', email: 'grind@sim.os', strategy: 'grinder', description: 'Builds mines and farms, never stops producing. Upgrades everything to max.' },
  { name: 'WallStreet', email: 'wall@sim.os', strategy: 'trader', description: 'Buys low, sells high. Creates listings, fills bulk orders. Market focused.' },
  { name: 'Scarface', email: 'scar@sim.os', strategy: 'criminal', description: 'Crime first. Launders money. Spies on everyone. Sabotages rivals.' },
  { name: 'BalancedBob', email: 'bob@sim.os', strategy: 'balanced', description: 'Does a bit of everything. The average player.' },
  { name: 'Noob123', email: 'noob@sim.os', strategy: 'newbie', description: 'Confused player. Makes mistakes. Tries random things. Tests error handling.' },
  { name: 'MegaCorp', email: 'mega@sim.os', strategy: 'tycoon', description: 'Builds every type of business. Hires managers. Full production chain.' },
  { name: 'Shadow', email: 'shadow@sim.os', strategy: 'spy', description: 'Spies on every player. Gathers intel. Poaches employees.' },
  { name: 'Chaos', email: 'chaos@sim.os', strategy: 'saboteur', description: 'Sabotages everything. Maximum destruction. Tests edge cases.' },
];

// ─── API Helper ───────────────────────────────────────────────────
async function api(token: string, method: string, path: string, body?: any): Promise<any> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json() as any;
    return { ok: res.ok, status: res.status, ...(json.data !== undefined ? { data: json.data } : json) };
  } catch (e: any) {
    return { ok: false, status: 0, error: e.message };
  }
}

// ─── Logging ──────────────────────────────────────────────────────
const LOG: { player: string; action: string; result: string; bug?: boolean }[] = [];

function log(player: string, action: string, result: string, isBug = false) {
  LOG.push({ player, action, result, bug: isBug });
  if (isBug) console.log(`  🐛 [${player}] ${action}: ${result}`);
}

function act(player: string, action: string, res: any) {
  if (!res.ok && res.status >= 500) {
    log(player, action, `SERVER ERROR ${res.status}: ${res.error ?? res.message ?? '?'}`, true);
  } else if (!res.ok && res.status !== 400 && res.status !== 401 && res.status !== 404 && res.status !== 429) {
    log(player, action, `UNEXPECTED ${res.status}: ${res.error ?? res.message ?? '?'}`, true);
  } else {
    log(player, action, res.ok ? 'OK' : `${res.status}: ${(res.error ?? res.message ?? '').toString().slice(0, 50)}`);
  }
  return res;
}

// ─── Strategy Implementations ─────────────────────────────────────

async function playGrinder(token: string, name: string) {
  const dash = await act(name, 'dashboard', await api(token, 'GET', '/dashboard'));
  const bizzes = dash.data?.businesses ?? [];
  const cash = dash.data?.player?.cash ?? 0;
  const locs = (await api(token, 'GET', '/locations')).data ?? [];

  // Build as many resource businesses as possible
  const usedLocs = new Set(bizzes.map((b: any) => b.location_id));
  for (const type of ['MINE', 'FARM', 'MINE', 'FARM', 'FACTORY']) {
    if (cash < 15000) break;
    const loc = locs.find((l: any) => !usedLocs.has(l.id));
    if (!loc) break;
    let recipeId;
    if (type === 'FACTORY') {
      const recipes = (await api(token, 'GET', '/businesses/recipes')).data ?? [];
      recipeId = recipes[0]?.id;
    }
    const r = await act(name, `create ${type}`, await api(token, 'POST', '/businesses', { type, name: `${name} ${type}`, location_id: loc.id, recipe_id: recipeId }));
    if (r.ok) usedLocs.add(loc.id);
  }

  // Hire for all businesses
  const updatedBiz = (await api(token, 'GET', '/businesses')).data ?? [];
  for (const biz of updatedBiz) {
    if (biz.employee_count < biz.max_employees) {
      const pool = (await api(token, 'GET', '/employees/pool')).data ?? [];
      for (const emp of pool.slice(0, 2)) {
        await act(name, 'hire', await api(token, 'POST', '/employees/hire', { employee_id: emp.id, business_id: biz.id }));
      }
    }
    // Upgrade if tier < 3
    if (biz.tier < 3) {
      await act(name, 'upgrade', await api(token, 'POST', `/businesses/${biz.id}/upgrade`));
    }
    // Enable auto-sell
    await act(name, 'auto-sell', await api(token, 'PATCH', `/businesses/${biz.id}/auto-sell`, { enabled: true }));
  }

  // Sell all
  await act(name, 'sell-all', await api(token, 'POST', '/actions/sell-all', {}));
  // Auto-supply
  await act(name, 'auto-supply', await api(token, 'POST', '/actions/auto-supply', {}));
}

async function playTrader(token: string, name: string) {
  const dash = await act(name, 'dashboard', await api(token, 'GET', '/dashboard'));
  const bizzes = dash.data?.businesses ?? [];
  const cash = dash.data?.player?.cash ?? 0;

  // Create a business if none
  if (bizzes.length === 0) {
    const locs = (await api(token, 'GET', '/locations')).data ?? [];
    await act(name, 'create MINE', await api(token, 'POST', '/businesses', { type: 'MINE', name: `${name} Mine`, location_id: locs[0]?.id }));
  }

  const biz = (await api(token, 'GET', '/businesses')).data?.[0];
  if (!biz) return;

  // Check prices and buy cheap
  const prices = (await api(token, 'GET', '/market/prices')).data ?? [];
  const listings = (await api(token, 'GET', '/market')).data ?? [];
  for (const listing of listings.slice(0, 3)) {
    const price = prices.find((p: any) => p.key === listing.item_key);
    if (price && Number(listing.price_per_unit) < Number(price.current_price) * 0.9 && cash > 1000) {
      await act(name, `buy cheap ${listing.item_name}`, await api(token, 'POST', '/market/buy', { listing_id: listing.id, quantity: Math.min(5, Math.floor(Number(listing.quantity))), business_id: biz.id }));
    }
  }

  // Sell inventory at premium
  const inv = (await api(token, 'GET', `/inventory/businesses/${biz.id}/inventory`)).data?.inventory ?? [];
  for (const item of inv) {
    if (Number(item.amount) > 3) {
      await act(name, `list ${item.item_name}`, await api(token, 'POST', '/market/list', { business_id: biz.id, item_id: item.item_id, quantity: Math.floor(Number(item.amount) / 2), price_per_unit: Number(item.base_price) * 1.15 }));
    }
  }

  // Check bulk orders
  const bulkOrders = await act(name, 'bulk-orders', await api(token, 'GET', '/market/bulk-orders'));

  // Create a bulk order
  if (cash > 5000) {
    const items = (await api(token, 'GET', '/game/info')).data?.items ?? [];
    if (items.length > 0) {
      const item = items[Math.floor(Math.random() * items.length)];
      // Need item_id from DB - use prices endpoint
      const priceItem = prices.find((p: any) => p.key === item.key);
      if (priceItem) {
        // Get item_id from market listings or prices
        await act(name, 'bulk-order', await api(token, 'POST', '/market/bulk-order', {
          business_id: biz.id,
          item_id: listings[0]?.item_id ?? inv[0]?.item_id,
          quantity: 20,
          max_price_per_unit: Number(item.basePrice) * 1.2,
        }));
      }
    }
  }

  // Deposit profits
  const newCash = (await api(token, 'GET', '/dashboard')).data?.player?.cash ?? 0;
  if (newCash > 20000) {
    await act(name, 'deposit', await api(token, 'POST', '/actions/deposit', { amount: Math.floor(newCash * 0.5) }));
  }
}

async function playCriminal(token: string, name: string) {
  const dash = await act(name, 'dashboard', await api(token, 'GET', '/dashboard'));
  const cash = dash.data?.player?.cash ?? 0;
  const dirtyMoney = dash.data?.player?.dirty_money ?? 0;
  const heat = dash.data?.player?.heat_police ?? 0;
  const bizzes = dash.data?.businesses ?? [];

  // Create business if none (need one for laundering)
  if (bizzes.length === 0) {
    const locs = (await api(token, 'GET', '/locations')).data ?? [];
    await act(name, 'create SHOP', await api(token, 'POST', '/businesses', { type: 'SHOP', name: `${name} Front`, location_id: locs[0]?.id }));
  }

  // Start crimes
  const crimeTypes = (await api(token, 'GET', '/crime/types')).data ?? [];
  for (const ct of crimeTypes) {
    await act(name, `start ${ct.name}`, await api(token, 'POST', '/crime/start', { type: ct.type }));
  }

  // Check/resolve crimes
  await act(name, 'resolve crimes', await api(token, 'POST', '/crime/resolve'));
  await act(name, 'crime status', await api(token, 'GET', '/crime/status'));

  // Launder if dirty money
  if (dirtyMoney > 100) {
    const biz = (await api(token, 'GET', '/businesses')).data?.[0];
    if (biz) {
      await act(name, 'launder', await api(token, 'POST', '/crime/launder', { business_id: biz.id, amount: Math.min(dirtyMoney, 5000) }));
      await act(name, 'resolve launder', await api(token, 'POST', '/crime/laundering/resolve'));
    }
  }

  // Check laundering status
  await act(name, 'laundering list', await api(token, 'GET', '/crime/laundering'));
}

async function playSpy(token: string, name: string) {
  await act(name, 'dashboard', await api(token, 'GET', '/dashboard'));

  // Create business
  const bizzes = (await api(token, 'GET', '/businesses')).data ?? [];
  if (bizzes.length === 0) {
    const locs = (await api(token, 'GET', '/locations')).data ?? [];
    await act(name, 'create MINE', await api(token, 'POST', '/businesses', { type: 'MINE', name: `${name} Base`, location_id: locs[0]?.id }));
  }

  // Spy on everyone
  const players = (await api(token, 'GET', '/intel/players')).data ?? [];
  for (const p of players.slice(0, 5)) {
    await act(name, `spy on ${p.username}`, await api(token, 'POST', '/intel/spy', { target_id: p.id }));
  }

  // Check reports
  await act(name, 'view reports', await api(token, 'GET', '/intel/reports'));

  // Try poaching
  const biz = (await api(token, 'GET', '/businesses')).data?.[0];
  if (biz && players.length > 0) {
    // Get target's employees (we'd need their business detail - use spy approach)
    await act(name, 'poach attempt', await api(token, 'POST', '/employees/poach', { employee_id: '00000000-0000-0000-0000-000000000000', business_id: biz.id }));
  }
}

async function playSaboteur(token: string, name: string) {
  await act(name, 'dashboard', await api(token, 'GET', '/dashboard'));

  // Create business first
  const bizzes = (await api(token, 'GET', '/businesses')).data ?? [];
  if (bizzes.length === 0) {
    const locs = (await api(token, 'GET', '/locations')).data ?? [];
    await act(name, 'create MINE', await api(token, 'POST', '/businesses', { type: 'MINE', name: `${name} HQ`, location_id: locs[0]?.id }));
  }

  // Spy first (needed for sabotage)
  const players = (await api(token, 'GET', '/intel/players')).data ?? [];
  if (players.length > 0) {
    await act(name, 'spy', await api(token, 'POST', '/intel/spy', { target_id: players[0].id }));

    // Sabotage each type
    for (const type of ['disruption', 'arson', 'data_leak']) {
      await act(name, `sabotage:${type}`, await api(token, 'POST', '/crime/sabotage', { target_player_id: players[0].id, type }));
    }
  }

  // Edge cases: sabotage self
  await act(name, 'sabotage self', await api(token, 'POST', '/crime/sabotage', { target_player_id: 'self', type: 'disruption' }));

  // Edge: invalid operations
  await act(name, 'invalid crime', await api(token, 'POST', '/crime/start', { type: 'nuclear_bomb' }));
  await act(name, 'negative deposit', await api(token, 'POST', '/actions/deposit', { amount: -1000 }));
  await act(name, 'zero withdraw', await api(token, 'POST', '/actions/withdraw', { amount: 0 }));
}

async function playNewbie(token: string, name: string) {
  const dash = await act(name, 'dashboard', await api(token, 'GET', '/dashboard'));

  // Random clicking - test various endpoints
  await act(name, 'game info', await api(token, 'GET', '/game/info'));
  await act(name, 'leaderboard', await api(token, 'GET', '/leaderboard'));
  await act(name, 'my rank', await api(token, 'GET', '/leaderboard/me'));
  await act(name, 'world stats', await api(token, 'GET', '/leaderboard/stats'));
  await act(name, 'events', await api(token, 'GET', '/../events'));
  await act(name, 'achievements', await api(token, 'GET', '/achievements/me'));
  await act(name, 'all achievements', await api(token, 'GET', '/achievements/all'));

  // Try to do things without a business
  await act(name, 'sell without biz', await api(token, 'POST', '/actions/sell-all', {}));
  await act(name, 'auto-supply without biz', await api(token, 'POST', '/actions/auto-supply', {}));

  // Create wrong types of businesses
  await act(name, 'invalid type', await api(token, 'POST', '/businesses', { type: 'CASINO', name: 'Nope', location_id: '00000000-0000-0000-0000-000000000000' }));

  // Eventually create a real one
  const locs = (await api(token, 'GET', '/locations')).data ?? [];
  if (locs.length > 0) {
    await act(name, 'create FARM', await api(token, 'POST', '/businesses', { type: 'FARM', name: `${name} Farm`, location_id: locs[0]?.id }));
  }

  // Discovery hints
  await act(name, 'discovery', await api(token, 'GET', '/discovery'));
}

async function playTycoon(token: string, name: string) {
  const dash = await act(name, 'dashboard', await api(token, 'GET', '/dashboard'));
  const cash = dash.data?.player?.cash ?? 0;
  const locs = (await api(token, 'GET', '/locations')).data ?? [];

  // Build full chain: FARM → FACTORY → SHOP → RESTAURANT
  const chain = ['FARM', 'FACTORY', 'SHOP', 'RESTAURANT', 'WAREHOUSE', 'MINE'];
  const usedLocs = new Set<string>();
  for (let i = 0; i < chain.length && i < locs.length; i++) {
    const type = chain[i];
    const loc = locs.find((l: any) => !usedLocs.has(l.id));
    if (!loc) break;
    let recipeId;
    if (type === 'FACTORY') {
      const recipes = (await api(token, 'GET', '/businesses/recipes')).data ?? [];
      recipeId = recipes.find((r: any) => r.business_type === 'FACTORY')?.id;
    }
    const r = await act(name, `build ${type}`, await api(token, 'POST', '/businesses', { type, name: `${name} ${type}`, location_id: loc.id, recipe_id: recipeId }));
    if (r.ok) usedLocs.add(loc.id);
  }

  // Hire managers for all
  const allBiz = (await api(token, 'GET', '/businesses')).data ?? [];
  for (const biz of allBiz) {
    await act(name, `manager ${biz.type}`, await api(token, 'POST', `/businesses/${biz.id}/manager`, { auto_buy_inputs: true, auto_sell_output: true, risk_mode: 'aggressive' }));
    await act(name, `auto-sell ${biz.type}`, await api(token, 'PATCH', `/businesses/${biz.id}/auto-sell`, { enabled: true }));
  }

  // Hire everyone
  const empPool = (await api(token, 'GET', '/employees/pool')).data ?? [];
  for (const emp of empPool) {
    if (allBiz.length === 0) break;
    const targetBiz = allBiz[Math.floor(Math.random() * allBiz.length)];
    await act(name, 'hire', await api(token, 'POST', '/employees/hire', { employee_id: emp.id, business_id: targetBiz.id }));
  }

  // Contracts: offer to sell to others
  const players = (await api(token, 'GET', '/intel/players')).data ?? [];
  if (players.length > 0 && allBiz.length > 0) {
    const inv = (await api(token, 'GET', `/inventory/businesses/${allBiz[0].id}/inventory`)).data?.inventory ?? [];
    if (inv.length > 0) {
      await act(name, 'offer contract', await api(token, 'POST', '/contracts/offer', {
        buyer_id: players[0].id,
        item_id: inv[0].item_id,
        supplier_business_id: allBiz[0].id,
        quantity_per_cycle: 5,
        cycle_hours: 24,
        price_per_unit: Number(inv[0].base_price) * 0.95,
      }));
    }
  }

  await act(name, 'sell-all', await api(token, 'POST', '/actions/sell-all', {}));
  await act(name, 'auto-supply', await api(token, 'POST', '/actions/auto-supply', {}));
}

async function playBalanced(token: string, name: string) {
  await playGrinder(token, name);
  await playTrader(token, name);
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  EmpireOS V3 — Human Simulation Test');
  console.log('  8 personas × multiple rounds');
  console.log('═══════════════════════════════════════════════════════\n');

  // Register all personas
  const hash = await bcrypt.hash('test1234', 12);
  const seasonRes = await pool.query("SELECT id FROM seasons WHERE status = 'active' LIMIT 1");
  const seasonId = seasonRes.rows[0]?.id;

  for (const p of PERSONAS) {
    try {
      await pool.query(
        'INSERT INTO players (season_id, username, email, password_hash, cash) VALUES ($1, $2, $3, $4, 75000)',
        [seasonId, p.name, p.email, hash],
      );
      console.log(`  + Registered ${p.name} (${p.strategy})`);
    } catch { console.log(`  = ${p.name} already exists`); }
  }

  // Run ticks to seed the world
  console.log('\n  Running ticks...');
  for (let i = 0; i < 10; i++) await fetch('http://localhost:3000/dev/tick/production', { method: 'POST' });
  await fetch('http://localhost:3000/dev/tick/economy', { method: 'POST' });
  await fetch('http://localhost:3000/dev/tick/autosell', { method: 'POST' });
  await fetch('http://localhost:3000/dev/tick/daily', { method: 'POST' });
  console.log('  Done\n');

  // Play 3 rounds
  for (let round = 1; round <= 3; round++) {
    console.log(`\n══ ROUND ${round} ══════════════════════════════════════\n`);

    for (const p of PERSONAS) {
      const token = await (async () => {
        const res = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: p.email, password: 'test1234' }) });
        return ((await res.json()) as any).data?.access_token;
      })();
      if (!token) { log(p.name, 'login', 'FAILED', true); continue; }

      console.log(`  ▸ ${p.name} (${p.strategy}): ${p.description.slice(0, 50)}`);

      const strategies: Record<string, (t: string, n: string) => Promise<void>> = {
        grinder: playGrinder, trader: playTrader, criminal: playCriminal,
        balanced: playBalanced, newbie: playNewbie, tycoon: playTycoon,
        spy: playSpy, saboteur: playSaboteur,
      };
      await strategies[p.strategy](token, p.name);
    }

    // Run ticks between rounds
    for (let i = 0; i < 5; i++) await fetch('http://localhost:3000/dev/tick/production', { method: 'POST' });
    await fetch('http://localhost:3000/dev/tick/economy', { method: 'POST' });
  }

  // ═══════════════════════════════════════════════════════════════
  // REPORT
  // ═══════════════════════════════════════════════════════════════
  const bugs = LOG.filter(l => l.bug);
  const total = LOG.length;
  const ok = LOG.filter(l => !l.bug).length;

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  FINAL REPORT');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Total actions: ${total}`);
  console.log(`  Successful: ${ok}`);
  console.log(`  Bugs: ${bugs.length}`);

  if (bugs.length > 0) {
    console.log('\n  🐛 BUGS:');
    const uniqueBugs = [...new Set(bugs.map(b => `[${b.player}] ${b.action}: ${b.result}`))];
    for (const b of uniqueBugs) console.log(`    ${b}`);
  } else {
    console.log('\n  ✅ NO BUGS FOUND — All actions handled correctly');
  }

  // Leaderboard
  const lb = await fetch('http://localhost:3000/api/v1/leaderboard').then(r => r.json()) as any;
  console.log('\n  📊 LEADERBOARD:');
  for (const p of (lb.data ?? []).slice(0, 8)) {
    console.log(`    #${p.rank} ${p.username} — $${Number(p.net_worth).toLocaleString()} (Lv.${p.level})`);
  }

  // Stats
  const stats = await fetch('http://localhost:3000/api/v1/leaderboard/stats').then(r => r.json()) as any;
  console.log('\n  🌍 WORLD:');
  console.log(`    Players: ${stats.data?.total_players}, Businesses: ${stats.data?.total_businesses}`);
  console.log(`    Employees: ${stats.data?.total_employees}, Market: $${Number(stats.data?.market_volume_24h ?? 0).toLocaleString()}`);
  console.log(`    Events: ${stats.data?.active_events}`);

  console.log('\n═══════════════════════════════════════════════════════');
  await pool.end();
}

main();
