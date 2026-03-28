// EmpireOS V3 — Autonomous player bots that play the game and report bugs
import pool from './client.js';

const BASE = 'http://localhost:3000/api/v1';
const BUGS: string[] = [];
const FEEDBACK: string[] = [];
let TESTS = 0;
let PASS = 0;

function bug(msg: string) { BUGS.push(msg); console.log(`  🐛 ${msg}`); }
function feedback(msg: string) { FEEDBACK.push(msg); }
function test(desc: string, ok: boolean) {
  TESTS++;
  if (ok) { PASS++; } else { bug(desc); }
}

async function login(email: string): Promise<string | null> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'test1234' }),
  });
  const data = await res.json() as any;
  return data.data?.access_token ?? null;
}

async function api(token: string, method: string, path: string, body?: any): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json() as any;
  if (!res.ok && res.status >= 500) bug(`500 error on ${method} ${path}: ${json.message ?? JSON.stringify(json).slice(0, 80)}`);
  return { status: res.status, ...json };
}

// ═══════════════════════════════════════════════════════════════════
// BOT: Full gameplay test as a single player
// ═══════════════════════════════════════════════════════════════════
async function botPlaythrough(email: string, username: string) {
  console.log(`\n▸ ${username} playing...`);
  const token = await login(email);
  test(`${username} can login`, !!token);
  if (!token) return;

  // ─── Dashboard ────────────────────────────────────────────
  const dash = await api(token, 'GET', '/dashboard');
  test(`${username} dashboard loads`, !!dash.data?.player);
  const cash = dash.data?.player?.cash ?? 0;
  const bizzes = dash.data?.businesses ?? [];
  const phase = dash.data?.player?.unlock_phase ?? 1;
  const suggestions = dash.data?.suggestions ?? [];
  const season = dash.data?.season;
  const events = dash.data?.events ?? [];

  test(`${username} has cash`, cash > 0);
  test(`${username} has season data`, !!season);
  test(`${username} has suggestions`, suggestions.length > 0 || bizzes.length > 0);
  if (events.length > 0) feedback(`${username} sees ${events.length} active event(s)`);

  // ─── Business operations ──────────────────────────────────
  if (bizzes.length > 0) {
    const biz = bizzes[0];

    // Detail
    const detail = await api(token, 'GET', `/businesses/${biz.id}`);
    test(`${username} business detail loads`, !!detail.data?.id);
    test(`${username} detail has storage_cap`, detail.data?.storage_cap > 0);
    test(`${username} detail has costs`, !!detail.data?.costs);

    // Check recipe_info for non-warehouse
    if (biz.type !== 'WAREHOUSE') {
      test(`${username} ${biz.type} has recipe_info`, detail.data?.recipe_info !== undefined);
      if (!detail.data?.recipe_info && biz.type !== 'WAREHOUSE') {
        bug(`${username}: ${biz.type} "${biz.name}" has NO recipe_info — production broken`);
      }
    }

    // Manager
    const mgr = await api(token, 'GET', `/businesses/${biz.id}/manager`);
    test(`${username} manager endpoint works`, mgr.status < 500);

    // Try assign manager
    if (!mgr.data?.has_manager && phase >= 2) {
      const mgrSet = await api(token, 'POST', `/businesses/${biz.id}/manager`, {
        auto_buy_inputs: true, auto_sell_output: true, risk_mode: 'balanced',
      });
      test(`${username} set manager`, mgrSet.status < 500);
    }

    // Security
    if (cash > 2000) {
      const sec = await api(token, 'POST', `/businesses/${biz.id}/security`, { type: 'physical' });
      test(`${username} security upgrade`, sec.status < 500);
    }

    // Auto-sell toggle
    const autoSell = await api(token, 'PATCH', `/businesses/${biz.id}/auto-sell`, { enabled: true });
    test(`${username} auto-sell toggle`, autoSell.status < 500);

    // Rename
    const rename = await api(token, 'PATCH', `/businesses/${biz.id}/rename`, { name: `${username}'s Empire` });
    test(`${username} rename`, rename.status < 500);

    // Inventory
    const inv = await api(token, 'GET', `/inventory/businesses/${biz.id}/inventory`);
    test(`${username} inventory loads`, !!inv.data?.inventory);
  }

  // ─── Create second business if affordable ─────────────────
  if (bizzes.length <= 1 && cash > 15000) {
    const locs = await api(token, 'GET', '/locations');
    const usedLocs = new Set(bizzes.map((b: any) => b.location_id));
    const freeLoc = locs.data?.find((l: any) => !usedLocs.has(l.id));
    if (freeLoc) {
      const types = ['FACTORY', 'SHOP', 'FARM', 'RESTAURANT'];
      const type = types[Math.floor(Math.random() * types.length)];
      let recipeId;
      if (type === 'FACTORY') {
        const recipes = await api(token, 'GET', '/businesses/recipes');
        recipeId = recipes.data?.[0]?.id;
      }
      const create = await api(token, 'POST', '/businesses', {
        type, name: `${username}'s ${type}`, location_id: freeLoc.id, recipe_id: recipeId,
      });
      test(`${username} create ${type}`, create.status < 500);
      if (create.status >= 400 && create.status < 500) {
        feedback(`${username} couldn't create ${type}: ${create.error ?? create.message}`);
      }
    }
  }

  // ─── Employees ────────────────────────────────────────────
  const empPool = await api(token, 'GET', '/employees/pool');
  test(`${username} employee pool loads`, !!empPool.data);

  if (empPool.data?.length > 0 && bizzes.length > 0) {
    const emp = empPool.data[0];
    const hire = await api(token, 'POST', '/employees/hire', {
      employee_id: emp.id, business_id: bizzes[0].id,
    });
    test(`${username} hire`, hire.status < 500);
  }

  // ─── Market ───────────────────────────────────────────────
  const prices = await api(token, 'GET', '/market/prices');
  test(`${username} market prices load`, prices.data?.length > 0);

  const listings = await api(token, 'GET', '/market');
  test(`${username} market listings load`, !!listings.data);

  // Try sell-all
  const sellAll = await api(token, 'POST', '/actions/sell-all', {});
  test(`${username} sell-all`, sellAll.status < 500);

  // Bulk orders
  const bulkOrders = await api(token, 'GET', '/market/bulk-orders');
  test(`${username} bulk orders load`, !!bulkOrders.data);

  // My listings
  const myListings = await api(token, 'GET', '/market/my-listings');
  test(`${username} my listings load`, !!myListings.data);

  // ─── Crime ────────────────────────────────────────────────
  const crimeTypes = await api(token, 'GET', '/crime/types');
  test(`${username} crime types load`, crimeTypes.data?.length > 0);

  const crimeStatus = await api(token, 'GET', '/crime/status');
  test(`${username} crime status loads`, !!crimeStatus.data);

  // Start crime
  const startCrime = await api(token, 'POST', '/crime/start', { type: 'theft' });
  test(`${username} start crime`, startCrime.status < 500);

  // ─── Intel ────────────────────────────────────────────────
  const players = await api(token, 'GET', '/intel/players');
  test(`${username} intel players load`, !!players.data);

  if (players.data?.length > 0 && cash > 2000) {
    const spy = await api(token, 'POST', '/intel/spy', { target_id: players.data[0].id });
    test(`${username} spy`, spy.status < 500);
  }

  const reports = await api(token, 'GET', '/intel/reports');
  test(`${username} intel reports load`, !!reports.data);

  // ─── Banking ──────────────────────────────────────────────
  if (cash > 10000) {
    const dep = await api(token, 'POST', '/actions/deposit', { amount: 5000 });
    test(`${username} deposit`, dep.status < 500);
    const wd = await api(token, 'POST', '/actions/withdraw', { amount: 2000 });
    test(`${username} withdraw`, wd.status < 500);
  }

  // ─── Discovery ────────────────────────────────────────────
  const disc = await api(token, 'GET', '/discovery');
  test(`${username} discovery loads`, !!disc.data);

  // ─── Contracts ────────────────────────────────────────────
  const contracts = await api(token, 'GET', '/contracts');
  test(`${username} contracts load`, !!contracts.data);

  // ─── Achievements ─────────────────────────────────────────
  const achs = await api(token, 'GET', '/achievements/me');
  test(`${username} achievements load`, !!achs.data);
  if (achs.data?.length > 0) {
    feedback(`${username} earned ${achs.data.length} achievement(s): ${achs.data.map((a: any) => a.title).join(', ')}`);
  }

  // ─── Leaderboard ──────────────────────────────────────────
  const lb = await api(token, 'GET', '/leaderboard/me');
  test(`${username} leaderboard/me`, !!lb.data);

  // ─── Game Info ────────────────────────────────────────────
  const info = await api(token, 'GET', '/game/info');
  test(`${username} game info loads`, info.data?.recipes?.length >= 8);

  console.log(`  ✓ ${username}: ${TESTS} tests so far`);
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  EmpireOS V3 — Bot Players Testing');
  console.log('═══════════════════════════════════════════════════');

  // Run production ticks
  for (let i = 0; i < 5; i++) {
    await fetch('http://localhost:3000/dev/tick/production', { method: 'POST' });
  }
  await fetch('http://localhost:3000/dev/tick/economy', { method: 'POST' });
  await fetch('http://localhost:3000/dev/tick/daily', { method: 'POST' });
  console.log('  Ticks executed (5 prod + 1 econ + 1 daily)\n');

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
    await botPlaythrough(p.email, p.username);
  }

  // ═══════════════════════════════════════════════════════════════
  // REPORT
  // ═══════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  TEST RESULTS');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Tests: ${PASS}/${TESTS} passed`);

  if (BUGS.length > 0) {
    console.log(`\n  🐛 BUGS (${BUGS.length}):`);
    for (const b of BUGS) console.log(`    - ${b}`);
  } else {
    console.log('  ✅ No bugs found!');
  }

  if (FEEDBACK.length > 0) {
    console.log(`\n  💬 FEEDBACK (${FEEDBACK.length}):`);
    for (const f of FEEDBACK) console.log(`    - ${f}`);
  }

  console.log('\n═══════════════════════════════════════════════════');
  await pool.end();
}

main();
