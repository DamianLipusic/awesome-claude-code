/**
 * EmpireOS — Delivery Contracts System (T085).
 *
 * Every 8–10 minutes, 2 random delivery contracts appear in the Market tab.
 * Requires at least one Market building.
 *
 * Flow:
 *   1. Player accepts a contract — resources deducted immediately.
 *   2. A 60-second "processing" countdown begins (active contract).
 *   3. On completion: gold reward awarded, prestige +20, totalTrades++.
 *   One active contract at a time; accepting clears remaining offers.
 *
 * State shape:
 *   state.contracts = {
 *     available:       [],     // up to 2 offer objects
 *     active:          null,   // { ...template, acceptedAt, collectAt }
 *     nextRefreshTick: 0,      // tick when new offers spawn
 *     totalCompleted:  0,      // lifetime completed contracts
 *   }
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';
import { TICKS_PER_SECOND } from '../core/tick.js';
import { awardPrestige } from './prestige.js';

// ── Timing constants ───────────────────────────────────────────────────────

const REFRESH_MIN_TICKS = 1920;   // 8 min
const REFRESH_MAX_TICKS = 2400;   // 10 min
const PROCESS_TICKS     = 240;    // 60 s processing time after acceptance

// ── Contract template pool ─────────────────────────────────────────────────

const CONTRACT_POOL = [
  {
    id:      'grain_export',
    icon:    '🌾',
    title:   'Grain Export',
    deliver: { food: 150 },
    reward:  { gold: 220 },
  },
  {
    id:      'timber_supply',
    icon:    '🪵',
    title:   'Timber Supply',
    deliver: { wood: 120 },
    reward:  { gold: 180 },
  },
  {
    id:      'stone_contract',
    icon:    '🪨',
    title:   'Stone Contract',
    deliver: { stone: 100 },
    reward:  { gold: 200 },
  },
  {
    id:      'iron_trade',
    icon:    '⚙️',
    title:   'Iron Trade',
    deliver: { iron: 60 },
    reward:  { gold: 250 },
  },
  {
    id:      'mana_export',
    icon:    '✨',
    title:   'Mana Export',
    deliver: { mana: 40 },
    reward:  { gold: 220 },
  },
  {
    id:      'mixed_supply',
    icon:    '📦',
    title:   'Mixed Supply',
    deliver: { food: 100, wood: 60 },
    reward:  { gold: 280 },
  },
  {
    id:      'arms_contract',
    icon:    '⚔️',
    title:   'Arms Contract',
    deliver: { iron: 50, stone: 40 },
    reward:  { gold: 310 },
  },
  {
    id:      'arcane_deal',
    icon:    '💎',
    title:   'Arcane Deal',
    deliver: { mana: 30, iron: 30 },
    reward:  { gold: 260, mana: 15 },
  },
];

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Initialise contracts state. Idempotent.
 */
export function initContracts() {
  if (!state.contracts) {
    state.contracts = {
      available:       [],
      active:          null,
      nextRefreshTick: _nextRefreshTick(),
      totalCompleted:  0,
    };
  }
  // Migration guards for older saves
  if (state.contracts.totalCompleted === undefined) state.contracts.totalCompleted = 0;
  if (!state.contracts.available)  state.contracts.available  = [];
  if (state.contracts.active === undefined) state.contracts.active = null;
  if (state.contracts.nextRefreshTick === undefined) {
    state.contracts.nextRefreshTick = _nextRefreshTick();
  }
}

/**
 * Tick handler — spawns offers and completes active contracts.
 */
export function contractsTick() {
  if (!state.contracts) return;

  // Only spawn offers when Market is built
  const hasMarket = (state.buildings?.market ?? 0) >= 1;

  // Complete active contract
  if (state.contracts.active && state.tick >= state.contracts.active.collectAt) {
    _completeContract();
  }

  // Spawn new offers when cooldown elapsed and no active contract
  if (hasMarket && !state.contracts.active && state.tick >= state.contracts.nextRefreshTick) {
    _spawnOffers();
  }
}

/**
 * Accept a contract by index into state.contracts.available.
 * Deducts resources immediately and starts the 60-second countdown.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function acceptContract(idx) {
  if (!state.contracts) return { ok: false, reason: 'Contracts not initialised.' };
  if (state.contracts.active) return { ok: false, reason: 'You already have an active contract.' };

  const contract = state.contracts.available[idx];
  if (!contract) return { ok: false, reason: 'Contract not found.' };

  // Validate resources
  for (const [res, amt] of Object.entries(contract.deliver)) {
    if ((state.resources[res] ?? 0) < amt) {
      const rName = res.charAt(0).toUpperCase() + res.slice(1);
      return { ok: false, reason: `Not enough ${rName} (need ${amt}).` };
    }
  }

  // Deduct resources
  for (const [res, amt] of Object.entries(contract.deliver)) {
    state.resources[res] = Math.max(0, (state.resources[res] ?? 0) - amt);
  }

  // Activate
  state.contracts.active    = { ...contract, acceptedAt: state.tick, collectAt: state.tick + PROCESS_TICKS };
  state.contracts.available = [];

  const deliverStr = Object.entries(contract.deliver).map(([r, a]) => `${a} ${r}`).join(' + ');
  addMessage(`📋 Contract accepted: delivering ${deliverStr} — reward in 60s!`, 'windfall');

  emit(Events.RESOURCE_CHANGED, {});
  emit(Events.CONTRACTS_CHANGED, {});
  return { ok: true };
}

/**
 * Cancel the active contract. Resources are forfeited (no refund).
 */
export function cancelContract() {
  if (!state.contracts?.active) return { ok: false, reason: 'No active contract.' };

  const c = state.contracts.active;
  state.contracts.active          = null;
  state.contracts.nextRefreshTick = _nextRefreshTick();

  addMessage(`📋 Contract "${c.title}" cancelled — resources forfeited.`, 'raid');
  emit(Events.CONTRACTS_CHANGED, {});
  return { ok: true };
}

/**
 * Seconds remaining until new offers refresh (0 = offers already available or active).
 */
export function contractsRefreshSecs() {
  if (!state.contracts) return 0;
  if (state.contracts.active) return 0;
  if (state.contracts.available.length > 0) return 0;
  return Math.max(0, Math.ceil((state.contracts.nextRefreshTick - state.tick) / TICKS_PER_SECOND));
}

/**
 * Progress fraction (0–1) of the active contract. 0 if none.
 */
export function contractProgress() {
  const c = state.contracts?.active;
  if (!c) return 0;
  const elapsed = state.tick - c.acceptedAt;
  return Math.max(0, Math.min(1, elapsed / PROCESS_TICKS));
}

/**
 * Seconds remaining until active contract completes. 0 if none.
 */
export function contractSecsLeft() {
  const c = state.contracts?.active;
  if (!c) return 0;
  return Math.max(0, Math.ceil((c.collectAt - state.tick) / TICKS_PER_SECOND));
}

// ── Internal helpers ───────────────────────────────────────────────────────

function _nextRefreshTick() {
  return state.tick + REFRESH_MIN_TICKS
    + Math.floor(Math.random() * (REFRESH_MAX_TICKS - REFRESH_MIN_TICKS));
}

function _spawnOffers() {
  // Pick 2 unique templates at random
  const shuffled = [...CONTRACT_POOL].sort(() => Math.random() - 0.5);
  state.contracts.available = shuffled.slice(0, 2);
  addMessage('📋 New delivery contracts available in the Market!', 'info');
  emit(Events.CONTRACTS_CHANGED, {});
}

function _completeContract() {
  const c = state.contracts.active;

  // Award reward resources (capped)
  const rewardParts = [];
  for (const [res, amt] of Object.entries(c.reward)) {
    const cap = state.caps[res] ?? Infinity;
    state.resources[res] = Math.min(cap, (state.resources[res] ?? 0) + amt);
    rewardParts.push(`+${amt} ${res}`);
  }

  state.contracts.active          = null;
  state.contracts.totalCompleted  = (state.contracts.totalCompleted ?? 0) + 1;
  state.contracts.nextRefreshTick = _nextRefreshTick();

  // Prestige reward
  awardPrestige(20, `contract completed: ${c.title}`);

  // Increment market trades counter if market exists
  if (state.market) {
    state.market.totalTrades = (state.market.totalTrades ?? 0) + 1;
  }

  const rewardStr = rewardParts.join(', ');
  addMessage(`📋 Contract fulfilled: "${c.title}" — Received ${rewardStr}!`, 'windfall');

  emit(Events.RESOURCE_CHANGED, {});
  emit(Events.MARKET_CHANGED,   {});
  emit(Events.CONTRACTS_CHANGED, {});
}
