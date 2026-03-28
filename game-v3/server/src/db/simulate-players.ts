// Simulate gameplay for all test players — creates market activity, trades, crimes, etc.
import pool from './client.js';

const BASE = 'http://localhost:3000/api/v1';

async function login(email: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'test1234' }),
    });
    const data = await res.json() as any;
    return data.data?.access_token ?? null;
  } catch { return null; }
}

async function api(token: string, method: string, path: string, body?: any) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return await res.json() as any;
  } catch { return null; }
}

async function simulatePlayer(email: string, username: string) {
  const token = await login(email);
  if (!token) { console.log(`  ✗ ${username}: login failed`); return; }

  const dash = await api(token, 'GET', '/dashboard');
  const cash = dash?.data?.player?.cash ?? 0;
  const bizzes = dash?.data?.businesses ?? [];
  const phase = dash?.data?.player?.unlock_phase ?? 1;

  let actions: string[] = [];

  // 1. If no businesses, create one
  if (bizzes.length === 0) {
    const locs = await api(token, 'GET', '/locations');
    const loc = locs?.data?.[0]?.id;
    if (loc) {
      await api(token, 'POST', '/businesses', { type: 'MINE', name: `${username}'s Mine`, location_id: loc });
      actions.push('created mine');
    }
  }

  // 2. Hire if business has no employees
  for (const biz of bizzes) {
    if (biz.employee_count === 0) {
      const pool = await api(token, 'GET', '/employees/pool');
      const emp = pool?.data?.[0]?.id;
      if (emp) {
        await api(token, 'POST', '/employees/hire', { employee_id: emp, business_id: biz.id });
        actions.push(`hired for ${biz.name}`);
      }
    }
  }

  // 3. Sell all inventory
  const sellRes = await api(token, 'POST', '/actions/sell-all', {});
  if (sellRes?.data?.sold > 0) {
    actions.push(`sold ${sellRes.data.sold} items for $${sellRes.data.total_revenue.toFixed(0)}`);
  }

  // 4. Maybe create a second business
  if (bizzes.length === 1 && cash > 20000 && Math.random() > 0.5) {
    const locs = await api(token, 'GET', '/locations');
    const usedLocs = new Set(bizzes.map((b: any) => b.location_id));
    const freeLoc = locs?.data?.find((l: any) => !usedLocs.has(l.id));
    if (freeLoc) {
      const types = ['FACTORY', 'SHOP', 'FARM'];
      const type = types[Math.floor(Math.random() * types.length)];
      let recipeId = undefined;
      if (type === 'FACTORY' || type === 'SHOP' || type === 'FARM') {
        const recipes = await api(token, 'GET', '/businesses/recipes');
        const matching = recipes?.data?.filter((r: any) => r.business_type === type);
        if (matching?.length) recipeId = matching[Math.floor(Math.random() * matching.length)].id;
      }
      await api(token, 'POST', '/businesses', { type, name: `${username}'s ${type}`, location_id: freeLoc.id, recipe_id: recipeId });
      actions.push(`created ${type}`);
    }
  }

  // 5. Buy from market (if has factory/shop that needs inputs)
  for (const biz of bizzes) {
    if (['FACTORY', 'SHOP', 'RESTAURANT'].includes(biz.type)) {
      const listings = await api(token, 'GET', '/market');
      if (listings?.data?.length > 0) {
        const listing = listings.data[Math.floor(Math.random() * listings.data.length)];
        const qty = Math.min(10, Math.floor(Number(listing.quantity)));
        if (qty > 0 && cash > qty * Number(listing.price_per_unit)) {
          await api(token, 'POST', '/market/buy', { listing_id: listing.id, quantity: qty, business_id: biz.id });
          actions.push(`bought ${qty} ${listing.item_name}`);
        }
      }
    }
  }

  // 6. Create market listing (sell some items)
  if (bizzes.length > 0 && Math.random() > 0.6) {
    const biz = bizzes[0];
    const inv = await api(token, 'GET', `/inventory/businesses/${biz.id}/inventory`);
    const items = inv?.data?.inventory?.filter((i: any) => Number(i.amount) > 5);
    if (items?.length > 0) {
      const item = items[0];
      const qty = Math.floor(Number(item.amount) / 2);
      const price = Number(item.base_price) * (0.9 + Math.random() * 0.3);
      await api(token, 'POST', '/market/list', { business_id: biz.id, item_id: item.item_id, quantity: qty, price_per_unit: Math.round(price * 100) / 100 });
      actions.push(`listed ${qty} ${item.item_name}`);
    }
  }

  // 7. Start a crime (if available)
  if (Math.random() > 0.5) {
    const crimeRes = await api(token, 'POST', '/crime/start', { type: 'theft' });
    if (crimeRes?.data?.operation_id) actions.push('started theft');
  }

  // 8. Deposit some cash to bank
  if (cash > 30000 && Math.random() > 0.5) {
    const amount = Math.floor(cash * 0.3);
    await api(token, 'POST', '/actions/deposit', { amount });
    actions.push(`deposited $${amount}`);
  }

  // 9. Enable auto-sell on first business
  if (bizzes.length > 0) {
    await api(token, 'PATCH', `/businesses/${bizzes[0].id}/auto-sell`, { enabled: true });
    actions.push('enabled auto-sell');
  }

  // 10. Upgrade security on random business
  if (bizzes.length > 0 && cash > 5000 && Math.random() > 0.5) {
    const types = ['physical', 'cyber', 'legal'];
    await api(token, 'POST', `/businesses/${bizzes[0].id}/security`, { type: types[Math.floor(Math.random() * types.length)] });
    actions.push('upgraded security');
  }

  console.log(`  ✓ ${username}: ${actions.join(', ') || 'idle'}`);
}

async function main() {
  console.log('Simulating player actions...\n');

  // Trigger production tick first
  await fetch('http://localhost:3000/dev/tick/production', { method: 'POST' });
  await fetch('http://localhost:3000/dev/tick/economy', { method: 'POST' });
  console.log('  Ticks executed\n');

  const players = [
    { email: 'max@empire.os', username: 'MaxPower' },
    { email: 'dark@empire.os', username: 'DarkLord' },
    { email: 'trade@empire.os', username: 'TradeMaster' },
    { email: 'crime@empire.os', username: 'CrimeBoss' },
    { email: 'factory@empire.os', username: 'FactoryKing' },
    { email: 'steel@empire.os', username: 'SteelBaron' },
    { email: 'bread@empire.os', username: 'BreadMaker' },
    { email: 'spy@empire.os', username: 'SpyGirl' },
    { email: 'mogul@empire.os', username: 'Mogul99' },
    { email: 'night@empire.os', username: 'NightOwl' },
  ];

  for (const p of players) {
    await simulatePlayer(p.email, p.username);
  }

  // Run autosell tick
  await fetch('http://localhost:3000/dev/tick/autosell', { method: 'POST' });
  console.log('\n  Autosell tick executed');

  // Check leaderboard
  const lb = await fetch('http://localhost:3000/api/v1/leaderboard').then(r => r.json()) as any;
  console.log('\nLeaderboard:');
  for (const p of lb.data.slice(0, 5)) {
    console.log(`  #${p.rank} ${p.username} — $${p.net_worth.toLocaleString()} (Lv.${p.level})`);
  }

  await pool.end();
}

main();
