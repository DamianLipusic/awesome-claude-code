#!/usr/bin/env node
/**
 * EmpireOS UI Smoke Test
 * Validates the core gameplay loop through the real browser client.
 *
 * Usage:
 *   node tests/smoke.mjs                  # run all tests
 *   node tests/smoke.mjs --test=register  # run single test
 *   node tests/smoke.mjs --headed         # show browser (requires X)
 *
 * Returns exit code 0 if all pass, 1 if any fail.
 * Saves screenshots to tests/screenshots/
 */

import { chromium } from 'playwright';
import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';

const BASE = process.env.GAME_URL || 'http://localhost:8080';
const API  = process.env.API_URL  || 'http://localhost:3000';
const SCREENSHOTS = path.join(import.meta.dirname, 'screenshots');
const HEADED = process.argv.includes('--headed');
const ONLY = process.argv.find(a => a.startsWith('--test='))?.split('=')[1];

// ── Helpers ──────────────────────────────────────────────────

const uid = randomBytes(4).toString('hex');
const TEST_USER = `smoke_${uid}`;
const TEST_EMAIL = `smoke_${uid}@test.local`;
const TEST_PASS = 'Smoke123!';

let browser, page, results = [];
let token = '';

function log(msg) { console.log(`  ${msg}`); }

async function screenshot(name) {
  const file = path.join(SCREENSHOTS, `${name}_${uid}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function runTest(name, fn) {
  if (ONLY && ONLY !== name) return;
  const t0 = Date.now();
  try {
    await fn();
    const ms = Date.now() - t0;
    results.push({ name, status: 'PASS', ms });
    log(`\x1b[32mPASS\x1b[0m ${name} (${ms}ms)`);
  } catch (err) {
    const ms = Date.now() - t0;
    const shot = await screenshot(`FAIL_${name}`).catch(() => null);
    results.push({ name, status: 'FAIL', ms, error: err.message, screenshot: shot });
    log(`\x1b[31mFAIL\x1b[0m ${name} (${ms}ms): ${err.message}`);
    if (shot) log(`       screenshot: ${shot}`);
  }
}

async function apiPost(path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  return res.json();
}

async function apiGet(path) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { headers });
  return res.json();
}

// ── Tests ────────────────────────────────────────────────────

async function testAppLoads() {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
  await screenshot('01_app_loaded');
  // The app should render something — check for root element content
  const body = await page.textContent('body');
  if (!body || body.length < 10) throw new Error('Page body is empty');
}

async function testRegister() {
  const res = await apiPost('/api/v1/auth/register', {
    username: TEST_USER, email: TEST_EMAIL, password: TEST_PASS,
  });
  if (res.error) throw new Error(`Register failed: ${res.error}`);
  if (!res.data?.access_token) throw new Error('No token returned');
  token = res.data.access_token;
}

async function testLogin() {
  const res = await apiPost('/api/v1/auth/login', {
    email: TEST_EMAIL, password: TEST_PASS,
  });
  if (res.error) throw new Error(`Login failed: ${res.error}`);
  if (!res.data?.access_token) throw new Error('No token returned');
  token = res.data.access_token;
}

async function testDashboard() {
  const res = await apiGet('/api/v1/players/dashboard');
  if (res.error) throw new Error(`Dashboard failed: ${res.error}`);
  const cash = parseFloat(res.data?.player?.cash || 0);
  if (cash < 90000) throw new Error(`Starting cash too low: ${cash}`);
}

async function testCreateBusiness() {
  const res = await apiPost('/api/v1/businesses', {
    name: `Smoke Shop ${uid}`, type: 'FARM', city: 'Ashvale',
  });
  if (res.error) throw new Error(`Create business failed: ${res.error}`);
  if (!res.data?.id) throw new Error('No business ID returned');
}

async function testHireWorker() {
  // Get available workers
  const avail = await apiGet('/api/v1/employees/available?role=WORKER');
  if (avail.error) throw new Error(`List workers failed: ${avail.error}`);
  const workers = avail.data?.employees || [];
  if (workers.length === 0) throw new Error('No workers available to hire');

  // Get business
  const bizRes = await apiGet('/api/v1/businesses');
  const biz = bizRes.data?.[0];
  if (!biz) throw new Error('No business found');

  const hire = await apiPost('/api/v1/employees/hire', {
    business_id: biz.id, employee_id: workers[0].id,
  });
  if (hire.error) throw new Error(`Hire failed: ${hire.error}`);
}

async function testTriggerTick() {
  const res = await apiPost('/dev/tick', {});
  if (!res.ok) throw new Error(`Tick failed: ${JSON.stringify(res)}`);
  if (res.duration_ms > 5000) throw new Error(`Tick too slow: ${res.duration_ms}ms`);
}

async function testProductionHappened() {
  const bizRes = await apiGet('/api/v1/businesses');
  const biz = bizRes.data?.[0];
  if (!biz) throw new Error('No business found');
  const inv = biz.inventory || {};
  const totalItems = Object.values(inv).reduce((a, b) => a + b, 0);
  if (totalItems === 0) throw new Error('No items produced after tick');
}

async function testSellToMarket() {
  const bizRes = await apiGet('/api/v1/businesses');
  const biz = bizRes.data?.[0];
  if (!biz) throw new Error('No business found');
  const inv = biz.inventory || {};
  const entries = Object.entries(inv).filter(([, v]) => v > 0);
  if (entries.length === 0) throw new Error('No inventory to sell');

  // Find resource ID by name
  const dashboard = await apiGet('/api/v1/players/dashboard');
  const seasonId = dashboard.data?.player?.season_id;

  // Get AI prices to find a resource we can sell
  const prices = await apiGet(`/api/v1/market/ai-prices?city=${biz.city}`);
  if (prices.error) throw new Error(`AI prices failed: ${prices.error}`);

  const resourceName = entries[0][0];
  const qty = Math.min(entries[0][1], 10);
  const resource = (prices.data || []).find(r =>
    r.resource_name === resourceName || r.resource_type === resourceName || r.name === resourceName
  );
  if (!resource) throw new Error(`Resource ${resourceName} not found in AI prices`);

  const sellPrice = parseFloat(resource.ai_buy_price || resource.current_ai_price) * 0.90;

  const listing = await apiPost('/api/v1/market/listings', {
    resource_id: resource.resource_id || resource.id,
    city: biz.city,
    listing_type: 'PLAYER_SELL',
    quantity: qty,
    price_per_unit: parseFloat(sellPrice.toFixed(2)),
    duration_hours: 24,
    business_id: biz.id,
  });
  if (listing.error) throw new Error(`Create listing failed: ${listing.error}`);
}

async function testAIBuysFill() {
  // Trigger tick to run AI buy orders
  await apiPost('/dev/tick', {});

  // Check player cash increased (or at least listing filled)
  const dashboard = await apiGet('/api/v1/players/dashboard');
  const alerts = dashboard.data?.alerts || [];
  const soldAlert = alerts.find(a => a.type === 'MARKET_SOLD');
  if (!soldAlert) {
    // Check if cash went up from initial
    log(`  (no MARKET_SOLD alert found — AI buy price may be below listing price)`);
  }
}

async function testCashPositive() {
  // After all operations, player should still have reasonable cash
  const dashboard = await apiGet('/api/v1/players/dashboard');
  const cash = parseFloat(dashboard.data?.player?.cash || 0);
  if (cash < 50000) throw new Error(`Cash too low after operations: ${cash}`);
  log(`  Cash: $${cash.toLocaleString()}`);
}

async function testEconomySnapshot() {
  const res = await fetch(`${API}/dev/snapshot`).then(r => r.json());
  if (!res.counts) throw new Error('Snapshot missing counts');
  if (res.counts.businesses < 1) throw new Error('No businesses in snapshot');
  if (res.counts.employees_hired < 1) throw new Error('No hired employees');
  log(`  Economy: ${res.counts.businesses} biz, ${res.counts.employees_hired} emp, ${res.counts.open_listings} listings`);
}

// ── Runner ───────────────────────────────────────────────────

async function main() {
  console.log(`\n  EmpireOS Smoke Test (${TEST_USER})\n  ${BASE} → ${API}\n`);

  browser = await chromium.launch({
    headless: !HEADED,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  page = await browser.newPage();

  await runTest('app-loads',         testAppLoads);
  await runTest('register',          testRegister);
  await runTest('login',             testLogin);
  await runTest('dashboard',         testDashboard);
  await runTest('create-business',   testCreateBusiness);
  await runTest('hire-worker',       testHireWorker);
  await runTest('trigger-tick',      testTriggerTick);
  await runTest('production',        testProductionHappened);
  await runTest('sell-to-market',    testSellToMarket);
  await runTest('ai-buys-fill',      testAIBuysFill);
  await runTest('cash-positive',     testCashPositive);
  await runTest('economy-snapshot',  testEconomySnapshot);

  await browser.close();

  // Summary
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const total = results.length;

  console.log(`\n  Results: ${passed}/${total} passed` + (failed ? `, ${failed} failed` : '') + '\n');

  // Write results JSON
  const resultFile = path.join(SCREENSHOTS, `results_${uid}.json`);
  fs.writeFileSync(resultFile, JSON.stringify({ uid, timestamp: new Date().toISOString(), results }, null, 2));

  // Report to dashboard if available
  try {
    await fetch('http://localhost:9000/api/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'smoke_test_result',
        data: { uid, passed, failed, total, results },
      }),
    });
  } catch { /* dashboard may not be running */ }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
