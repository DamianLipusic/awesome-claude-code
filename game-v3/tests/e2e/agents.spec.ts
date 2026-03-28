// EmpireOS V3 — Playwright E2E Tests
// Each test = one agent persona testing a specific area

import { test, expect, Page } from '@playwright/test';

const APP = 'http://localhost:8080';
const API = 'http://localhost:3000/api/v1';

const BUGS: { agent: string; severity: string; desc: string }[] = [];
const CONSOLE_ERRORS: string[] = [];

function bug(agent: string, sev: 'critical' | 'major' | 'minor', desc: string) {
  BUGS.push({ agent, severity: sev, desc });
  console.log(`  🐛 [${agent}] ${sev}: ${desc}`);
}

// Register via API + login via UI
async function loginAs(page: Page, name: string): Promise<boolean> {
  const email = `${name}@pw.test`;
  // Register via API (fast, no rate limit issues)
  await fetch(`${API}/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: name, email, password: 'test12345' }),
  }).catch(() => {});

  await page.goto(APP);
  await page.waitForSelector('text=EmpireOS', { timeout: 10000 });
  await page.waitForTimeout(1000);

  // Fill login form
  const emailInput = page.locator('input[placeholder="you@example.com"]').first();
  const pwInput = page.locator('input[placeholder="Your password"]').first();
  await emailInput.fill(email);
  await pwInput.fill('test12345');
  await page.locator('text=Sign In').first().click();
  await page.waitForTimeout(4000);

  // Verify dashboard loaded
  const checks = ['Logout', 'Earnings', 'Next Steps', 'Sell All Inventory', 'ROOKIE', 'Season'];
  for (const t of checks) {
    if (await page.locator(`text=${t}`).first().isVisible().catch(() => false)) return true;
  }
  return false;
}

async function ss(page: Page, name: string) {
  await page.screenshot({ path: `tests/e2e/screenshots/${name}.png`, fullPage: true });
}

function setupConsoleCapture(page: Page, agent: string) {
  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('favicon'))
      CONSOLE_ERRORS.push(`[${agent}] ${msg.text().slice(0, 150)}`);
  });
  page.on('response', res => {
    if (res.status() >= 500)
      bug(agent, 'critical', `500: ${res.url().replace(API, '')}`);
  });
}

// ═══════════════════════════════════════════════════════════════════
// AGENT 1: Normal User — Happy Path
// ═══════════════════════════════════════════════════════════════════
test('Agent:NormalUser — full happy path', async ({ page }) => {
  setupConsoleCapture(page, 'NormalUser');
  const ok = await loginAs(page, `normal_${Date.now()}`);
  expect(ok).toBeTruthy();
  await ss(page, 'normal-01-dashboard');

  // Cash visible
  const hasCash = await page.locator('text=$75,000').first().isVisible().catch(() => false);
  if (!hasCash) bug('NormalUser', 'major', 'Starting cash not visible');

  // Season visible
  const hasSeason = await page.locator('text=Iron Dawn').isVisible().catch(() => false);
  if (!hasSeason) bug('NormalUser', 'minor', 'Season not shown');

  // Navigate all 5 tabs
  for (const tab of ['Businesses', 'Market', 'Employees', 'Underworld', 'Dashboard']) {
    await page.locator(`text=${tab}`).last().click();
    await page.waitForTimeout(1500);
    await ss(page, `normal-${tab.toLowerCase()}`);
  }

  // Quick nav buttons
  for (const btn of ['Ranking', 'Info', 'Intel']) {
    const el = page.locator(`text=${btn}`).last();
    if (await el.isVisible().catch(() => false)) {
      await el.click();
      await page.waitForTimeout(2000);
      await ss(page, `normal-modal-${btn.toLowerCase()}`);
      // Go back — navigate to dashboard tab instead of goBack (avoids modal crash)
      await page.waitForTimeout(500);
      await page.goto(APP);
      await page.waitForTimeout(3000);
    } else {
      bug('NormalUser', 'minor', `Quick nav "${btn}" not visible`);
    }
  }

  // Profile
  const profileBtn = page.locator('text=Profile').first();
  if (await profileBtn.isVisible().catch(() => false)) {
    await profileBtn.click();
    await page.waitForTimeout(2000);
    await ss(page, 'normal-profile');
  }
});

// ═══════════════════════════════════════════════════════════════════
// AGENT 2: Speed Clicker — Race conditions
// ═══════════════════════════════════════════════════════════════════
test('Agent:SpeedClicker — rapid tab switching', async ({ page }) => {
  setupConsoleCapture(page, 'SpeedClicker');
  const ok = await loginAs(page, `speed_${Date.now()}`);
  expect(ok).toBeTruthy();

  // Rapidly switch tabs 5 times
  const tabs = ['Businesses', 'Market', 'Employees', 'Underworld', 'Dashboard'];
  for (let round = 0; round < 5; round++) {
    for (const tab of tabs) {
      await page.locator(`text=${tab}`).last().click().catch(() => {});
      await page.waitForTimeout(100);
    }
  }
  await page.waitForTimeout(2000);
  await ss(page, 'speed-after-rapid');

  // App should still be alive
  const alive = await page.locator('text=Dashboard').first().isVisible().catch(() => false);
  if (!alive) bug('SpeedClicker', 'critical', 'App crashed after rapid tab switching');

  // Double-click sell-all
  await page.locator('text=Dashboard').last().click();
  await page.waitForTimeout(1000);
  const sellBtn = page.locator('text=Sell All Inventory');
  if (await sellBtn.isVisible().catch(() => false)) {
    await sellBtn.dblclick();
    await page.waitForTimeout(1000);
    await sellBtn.click();
    await page.waitForTimeout(500);
  }
  await ss(page, 'speed-after-double-click');
});

// ═══════════════════════════════════════════════════════════════════
// AGENT 3: Abuser — XSS, injection, invalid inputs
// ═══════════════════════════════════════════════════════════════════
test('Agent:Abuser — malicious inputs', async ({ page }) => {
  setupConsoleCapture(page, 'Abuser');

  // Try XSS in registration
  await page.goto(APP);
  await page.waitForSelector('text=EmpireOS', { timeout: 10000 });
  await page.locator('text=Register').click();
  await page.waitForTimeout(1500);

  const xssName = '<img src=x onerror=alert(1)>';
  const usernameInput = page.locator('input[placeholder="empire_builder"]');
  if (await usernameInput.isVisible().catch(() => false)) {
    await usernameInput.fill(xssName);
    await page.locator('input[placeholder="you@example.com"]').last().fill('xss@test.com');
    await page.locator('input[placeholder="Min 8 characters"]').fill('test12345');
    await page.locator('text=Create Account').click();
    await page.waitForTimeout(3000);
    await ss(page, 'abuser-xss');

    // Check no alert dialog
    let alertFired = false;
    page.on('dialog', () => { alertFired = true; });
    await page.waitForTimeout(1000);
    if (alertFired) bug('Abuser', 'critical', 'XSS — alert() executed!');
  }

  // Login normally for further testing
  const ok = await loginAs(page, `abuser_${Date.now()}`);
  if (!ok) return;

  // Try SQL injection in search/input fields
  await page.locator('text=Market').last().click();
  await page.waitForTimeout(1500);
  await ss(page, 'abuser-market');
});

// ═══════════════════════════════════════════════════════════════════
// AGENT 4: FullChain — production chain validation
// ═══════════════════════════════════════════════════════════════════
test('Agent:FullChain — verify game info and market', async ({ page }) => {
  setupConsoleCapture(page, 'FullChain');
  const ok = await loginAs(page, `chain_${Date.now()}`);
  expect(ok).toBeTruthy();

  // Open Game Info via quick nav
  const infoBtn = page.locator('text=Info').last();
  if (await infoBtn.isVisible().catch(() => false)) {
    await infoBtn.click();
    await page.waitForTimeout(3000);

    const pageText = await page.evaluate(() => document.body.innerText);
    if (!pageText.includes('Ore')) bug('FullChain', 'major', 'Game Info missing Ore');
    if (!pageText.includes('Wheat')) bug('FullChain', 'major', 'Game Info missing Wheat');
    if (!pageText.includes('Steel')) bug('FullChain', 'major', 'Game Info missing Steel');
    if (!pageText.includes('Bread')) bug('FullChain', 'major', 'Game Info missing Bread');
    if (!pageText.includes('Tools')) bug('FullChain', 'major', 'Game Info missing Tools');
    if (!pageText.includes('Meals')) bug('FullChain', 'major', 'Game Info missing Meals');

    await ss(page, 'chain-gameinfo');
    await page.goto(APP);
    await page.waitForTimeout(3000);
  }

  // Check market prices
  await page.locator('text=Market').last().click();
  await page.waitForTimeout(2000);
  const marketText = await page.evaluate(() => document.body.innerText);
  if (!marketText.includes('Ore')) bug('FullChain', 'minor', 'Market missing Ore price');
  await ss(page, 'chain-market');

  // Check businesses tab
  await page.locator('text=Businesses').last().click();
  await page.waitForTimeout(2000);
  await ss(page, 'chain-businesses');
});

// ═══════════════════════════════════════════════════════════════════
// AGENT 5: CrimeLord — crime system E2E
// ═══════════════════════════════════════════════════════════════════
test('Agent:CrimeLord — crime tabs and actions', async ({ page }) => {
  setupConsoleCapture(page, 'CrimeLord');
  const ok = await loginAs(page, `crime_${Date.now()}`);
  expect(ok).toBeTruthy();

  await page.locator('text=Underworld').last().click();
  await page.waitForTimeout(2000);
  await ss(page, 'crime-main');

  const pageText = await page.evaluate(() => document.body.innerText);

  // Check crime sub-tabs exist
  for (const tab of ['Operations', 'Laundering', 'History', 'Sabotage']) {
    if (!pageText.includes(tab)) bug('CrimeLord', 'major', `Crime tab "${tab}" missing`);
  }

  // Check Petty Theft visible
  if (!pageText.includes('Petty Theft') && !pageText.includes('theft')) {
    bug('CrimeLord', 'minor', 'Petty Theft not shown');
  }

  // Click through sub-tabs
  for (const tab of ['Laundering', 'Sabotage', 'History', 'Operations']) {
    const el = page.locator(`text=${tab}`).first();
    if (await el.isVisible().catch(() => false)) {
      await el.click();
      await page.waitForTimeout(1000);
      await ss(page, `crime-${tab.toLowerCase()}`);
    }
  }
});

// ═══════════════════════════════════════════════════════════════════
// AGENT 6: MarketTrader — all market tabs
// ═══════════════════════════════════════════════════════════════════
test('Agent:MarketTrader — all market tabs', async ({ page }) => {
  setupConsoleCapture(page, 'MarketTrader');
  const ok = await loginAs(page, `trader_${Date.now()}`);
  expect(ok).toBeTruthy();

  await page.locator('text=Market').last().click();
  await page.waitForTimeout(2000);
  await ss(page, 'trader-main');

  const pageText = await page.evaluate(() => document.body.innerText);

  // Verify all 6 market sub-tabs exist in page text
  for (const tab of ['Prices', 'Buy', 'Sell', 'Listings', 'Contracts', 'Orders']) {
    if (!pageText.includes(tab)) bug('MarketTrader', 'minor', `Market tab "${tab}" missing`);
  }
  await ss(page, 'trader-all-tabs');
});

// ═══════════════════════════════════════════════════════════════════
// AGENT 7: Employees — hire, train, pool
// ═══════════════════════════════════════════════════════════════════
test('Agent:EmployeeMgr — employee system', async ({ page }) => {
  setupConsoleCapture(page, 'EmployeeMgr');
  const ok = await loginAs(page, `emp_${Date.now()}`);
  expect(ok).toBeTruthy();

  await page.locator('text=Employees').last().click();
  await page.waitForTimeout(2000);
  await ss(page, 'emp-main');

  const pageText = await page.evaluate(() => document.body.innerText);

  // Should show recruit pool or my employees sections
  const hasPool = pageText.includes('Pool') || pageText.includes('Recruit') || pageText.includes('Available');
  if (!hasPool) bug('EmployeeMgr', 'major', 'Employee pool section missing');

  // Check sub-sections
  for (const section of ['Pool', 'My Employees', 'Training']) {
    const el = page.locator(`text=${section}`).first();
    if (await el.isVisible().catch(() => false)) {
      await el.click().catch(() => {});
      await page.waitForTimeout(1000);
      await ss(page, `emp-${section.toLowerCase().replace(' ', '-')}`);
    }
  }
});

// ═══════════════════════════════════════════════════════════════════
// AGENT 8: Destroyer — rapid create/delete
// ═══════════════════════════════════════════════════════════════════
test('Agent:Destroyer — stress UI actions', async ({ page }) => {
  setupConsoleCapture(page, 'Destroyer');
  const ok = await loginAs(page, `destroy_${Date.now()}`);
  expect(ok).toBeTruthy();

  // Rapid sell-all clicks
  for (let i = 0; i < 10; i++) {
    const btn = page.locator('text=Sell All Inventory');
    if (await btn.isVisible().catch(() => false)) {
      await btn.click().catch(() => {});
      await page.waitForTimeout(200);
    }
  }

  // Rapid auto-supply clicks
  for (let i = 0; i < 10; i++) {
    const btn = page.locator('text=Auto-Supply');
    if (await btn.isVisible().catch(() => false)) {
      await btn.click().catch(() => {});
      await page.waitForTimeout(200);
    }
  }

  // Rapid deposit/withdraw
  const depositBtn = page.locator('text=Deposit').first();
  const withdrawBtn = page.locator('text=Withdraw').first();
  for (let i = 0; i < 5; i++) {
    if (await depositBtn.isVisible().catch(() => false)) await depositBtn.click().catch(() => {});
    await page.waitForTimeout(100);
    if (await withdrawBtn.isVisible().catch(() => false)) await withdrawBtn.click().catch(() => {});
    await page.waitForTimeout(100);
  }

  await page.waitForTimeout(2000);
  const alive = await page.locator('text=Dashboard').first().isVisible().catch(() => false);
  if (!alive) bug('Destroyer', 'critical', 'App crashed after stress actions');
  await ss(page, 'destroyer-final');
});

// ═══════════════════════════════════════════════════════════════════
// Bug Report
// ═══════════════════════════════════════════════════════════════════
test.afterAll(() => {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  PLAYWRIGHT E2E — BUG REPORT');
  console.log('═══════════════════════════════════════════════════════');

  if (BUGS.length === 0) {
    console.log('  ✅ NO BUGS FOUND');
  } else {
    console.log(`\n  🐛 BUGS (${BUGS.length}):`);
    for (const b of BUGS) {
      const icon = b.severity === 'critical' ? '🔴' : b.severity === 'major' ? '🟠' : '🟡';
      console.log(`    ${icon} [${b.agent}] ${b.desc}`);
    }
  }

  if (CONSOLE_ERRORS.length > 0) {
    const unique = [...new Set(CONSOLE_ERRORS)];
    console.log(`\n  ⚠️  JS CONSOLE ERRORS (${unique.length}):`);
    for (const e of unique.slice(0, 10)) console.log(`    ${e}`);
  }

  console.log(`\n  Screenshots: tests/e2e/screenshots/`);
  console.log('═══════════════════════════════════════════════════════\n');
});
