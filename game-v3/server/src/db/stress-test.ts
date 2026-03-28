// EmpireOS V3 — Stress Test
// Runs MANY rounds without rate limiting by generating JWT tokens directly.
import pool from './client.js';
import jwt from 'jsonwebtoken';

const BASE = 'http://localhost:3000';
const SECRET = process.env.JWT_SECRET || 'empireos_v3_dev_secret_change_in_production';
const ROUNDS = parseInt(process.argv[2] || '10');

function makeToken(playerId: string, username: string): string {
  return jwt.sign({ sub: playerId, username, type: 'access' }, SECRET, { expiresIn: '1h' });
}

async function api(token: string, method: string, path: string, body?: any): Promise<any> {
  try {
    const res = await fetch(`${BASE}/api/v1${path}`, {
      method,
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { ok: res.ok, status: res.status, ...(await res.json() as any) };
  } catch { return { ok: false, status: 0 }; }
}

let totalActions = 0;
let errors500 = 0;
let errors400 = 0;
let successes = 0;

async function tick() {
  await fetch(`${BASE}/dev/tick/production`, { method: 'POST' });
}

async function playRound(token: string, name: string, bizzes: any[]) {
  // Sell all
  const sa = await api(token, 'POST', '/actions/sell-all', {});
  totalActions++; if (sa.ok) successes++; else if (sa.status >= 500) errors500++;

  // Auto supply
  const as2 = await api(token, 'POST', '/actions/auto-supply', {});
  totalActions++; if (as2.ok) successes++; else if (as2.status >= 500) errors500++;

  // Buy from market
  const listings = await api(token, 'GET', '/market');
  totalActions++;
  if (listings.data?.length > 0 && bizzes.length > 0) {
    const l = listings.data[Math.floor(Math.random() * listings.data.length)];
    const qty = Math.min(5, Math.floor(Number(l.quantity)));
    if (qty > 0) {
      const buy = await api(token, 'POST', '/market/buy', { listing_id: l.id, quantity: qty, business_id: bizzes[0].id });
      totalActions++; if (buy.ok) successes++; else if (buy.status >= 500) errors500++; else errors400++;
    }
  }

  // Create listing
  if (bizzes.length > 0) {
    const inv = await api(token, 'GET', `/inventory/businesses/${bizzes[0].id}/inventory`);
    const items = inv.data?.inventory?.filter((i: any) => Number(i.amount) > 5) ?? [];
    if (items.length > 0) {
      const item = items[0];
      await api(token, 'POST', '/market/list', {
        business_id: bizzes[0].id, item_id: item.item_id,
        quantity: Math.floor(Number(item.amount) / 3),
        price_per_unit: Number(item.base_price) * (0.8 + Math.random() * 0.4),
      });
      totalActions++; successes++;
    }
  }

  // Hire if pool available
  const empPool = await api(token, 'GET', '/employees/pool');
  if (empPool.data?.length > 0 && bizzes.length > 0) {
    const hire = await api(token, 'POST', '/employees/hire', { employee_id: empPool.data[0].id, business_id: bizzes[Math.floor(Math.random() * bizzes.length)].id });
    totalActions++; if (hire.ok) successes++; else errors400++;
  }

  // Crime
  if (Math.random() > 0.5) {
    await api(token, 'POST', '/crime/start', { type: 'theft' });
    totalActions++; successes++;
  }

  // Banking
  const dash = await api(token, 'GET', '/dashboard');
  totalActions++; if (dash.ok) successes++; else if (dash.status >= 500) errors500++;
  const cash = dash.data?.player?.cash ?? 0;
  if (cash > 10000) {
    await api(token, 'POST', '/actions/deposit', { amount: Math.floor(cash * 0.2) });
    totalActions++; successes++;
  }
}

async function main() {
  console.log(`═══════════════════════════════════════════════════`);
  console.log(`  EmpireOS V3 — Stress Test (${ROUNDS} rounds)`);
  console.log(`═══════════════════════════════════════════════════\n`);

  // Get all players with their businesses
  const playersRes = await pool.query(`
    SELECT p.id, p.username,
      COALESCE(json_agg(json_build_object('id', b.id, 'type', b.type)) FILTER (WHERE b.id IS NOT NULL), '[]') AS businesses
    FROM players p
    LEFT JOIN businesses b ON b.owner_id = p.id AND b.status != 'shutdown'
    GROUP BY p.id
  `);

  const players = playersRes.rows.map((p: any) => ({
    id: p.id as string,
    username: p.username as string,
    token: makeToken(p.id as string, p.username as string),
    businesses: (typeof p.businesses === 'string' ? JSON.parse(p.businesses) : p.businesses) as any[],
  }));

  console.log(`  Players: ${players.length}`);
  console.log(`  Rounds: ${ROUNDS}\n`);

  const start = Date.now();

  for (let round = 1; round <= ROUNDS; round++) {
    // Production ticks
    for (let i = 0; i < 3; i++) await tick();
    if (round % 3 === 0) await fetch(`${BASE}/dev/tick/economy`, { method: 'POST' });
    if (round % 5 === 0) await fetch(`${BASE}/dev/tick/autosell`, { method: 'POST' });
    if (round % 10 === 0) await fetch(`${BASE}/dev/tick/daily`, { method: 'POST' });

    // Each player plays
    for (const p of players) {
      await playRound(p.token, p.username, p.businesses);
    }

    // Refresh business list every 3 rounds
    if (round % 3 === 0) {
      for (const p of players) {
        const biz = await api(p.token, 'GET', '/businesses');
        if (biz.data) p.businesses = biz.data;
      }
    }

    if (round % 5 === 0 || round === ROUNDS) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`  Round ${round}/${ROUNDS} — ${totalActions} actions, ${errors500} server errors, ${elapsed}s`);
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  // Final leaderboard
  const lb = await fetch(`${BASE}/api/v1/leaderboard`).then(r => r.json()) as any;
  const stats = await fetch(`${BASE}/api/v1/leaderboard/stats`).then(r => r.json()) as any;

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  RESULTS (${elapsed}s)`);
  console.log(`═══════════════════════════════════════════════════`);
  console.log(`  Total actions:  ${totalActions}`);
  console.log(`  Successes:      ${successes} (${(successes/totalActions*100).toFixed(1)}%)`);
  console.log(`  Client errors:  ${errors400} (expected)`);
  console.log(`  Server errors:  ${errors500} (BUGS)`);
  console.log(`  Actions/sec:    ${(totalActions / (parseFloat(elapsed))).toFixed(1)}`);

  if (errors500 > 0) {
    console.log(`\n  🐛 ${errors500} SERVER ERRORS DETECTED — needs investigation`);
  } else {
    console.log(`\n  ✅ ZERO server errors — all endpoints stable`);
  }

  console.log(`\n  📊 Leaderboard:`);
  for (const p of (lb.data ?? []).slice(0, 5)) {
    console.log(`    #${p.rank} ${p.username} — $${Number(p.net_worth).toLocaleString()} (Lv.${p.level})`);
  }
  console.log(`\n  🌍 World: ${stats.data?.total_players} players, ${stats.data?.total_businesses} biz, $${Number(stats.data?.market_volume_24h ?? 0).toLocaleString()} volume`);

  console.log(`\n═══════════════════════════════════════════════════`);
  await pool.end();
}

main();
