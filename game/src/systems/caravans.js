/**
 * EmpireOS — Trade Caravan System (T063).
 *
 * A merchant caravan spawns on a revealed non-hostile tile every 3–5 minutes.
 * It offers 3 random barter trades from a pool of 8 and departs after 90 seconds
 * if the player ignores it.  Click the 🛒 icon on the map to open the trade picker.
 *
 * State shape:
 *   state.caravans = {
 *     active:        { x, y, offers: [...], expiresAt } | null,
 *     nextSpawnTick: number,
 *   }
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';

// ── Timing constants ───────────────────────────────────────────────────────

const SPAWN_MIN_TICKS = 720;   // 3 min
const SPAWN_MAX_TICKS = 1200;  // 5 min
const DURATION_TICKS  = 360;   // 90 s

// ── Offer pool ─────────────────────────────────────────────────────────────

export const CARAVAN_OFFERS = [
  {
    id:   'grain_export',
    icon: '🌾',
    desc: 'Sell surplus grain',
    give: { food: 80 },
    get:  { gold: 120 },
  },
  {
    id:   'lumber_sale',
    icon: '🪵',
    desc: 'Sell lumber to merchants',
    give: { wood: 100 },
    get:  { gold: 80 },
  },
  {
    id:   'stone_deal',
    icon: '🪨',
    desc: 'Barter stonework',
    give: { stone: 80 },
    get:  { gold: 100 },
  },
  {
    id:   'iron_trade',
    icon: '⚙️',
    desc: 'Sell raw iron',
    give: { iron: 50 },
    get:  { gold: 150 },
  },
  {
    id:   'mana_elixir',
    icon: '✨',
    desc: 'Trade distilled mana essence',
    give: { mana: 30 },
    get:  { gold: 100 },
  },
  {
    id:   'grain_purchase',
    icon: '🍞',
    desc: 'Buy provisions',
    give: { gold: 150 },
    get:  { food: 100 },
  },
  {
    id:   'timber_purchase',
    icon: '🌲',
    desc: 'Buy quality timber',
    give: { gold: 120 },
    get:  { wood: 80 },
  },
  {
    id:   'arms_deal',
    icon: '⚔️',
    desc: 'Buy weapons and reagents',
    give: { gold: 200 },
    get:  { iron: 60, mana: 20 },
  },
];

// ── Init ───────────────────────────────────────────────────────────────────

export function initCaravans() {
  if (!state.caravans) {
    state.caravans = {
      active:        null,
      nextSpawnTick: _nextSpawnTick(),
    };
  }
}

// ── Tick ───────────────────────────────────────────────────────────────────

export function caravanTick() {
  if (!state.caravans) return;

  // Expire active caravan
  if (state.caravans.active && state.tick >= state.caravans.active.expiresAt) {
    const { x, y } = state.caravans.active;
    state.caravans.active        = null;
    state.caravans.nextSpawnTick = _nextSpawnTick();
    addMessage('🛒 The merchant caravan has moved on.', 'info');
    emit(Events.CARAVAN_UPDATED, { expired: true, x, y });
    return;
  }

  // Spawn a new caravan when cooldown expires
  if (!state.caravans.active && state.tick >= state.caravans.nextSpawnTick) {
    _spawnCaravan();
  }
}

// ── Internal helpers ───────────────────────────────────────────────────────

function _nextSpawnTick() {
  return state.tick + SPAWN_MIN_TICKS
       + Math.floor(Math.random() * (SPAWN_MAX_TICKS - SPAWN_MIN_TICKS));
}

function _spawnCaravan() {
  if (!state.map) { state.caravans.nextSpawnTick = _nextSpawnTick(); return; }

  const { tiles, width, height, capital } = state.map;

  // Eligible tiles: revealed, not enemy/barbarian, not the capital
  const candidates = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = tiles[y][x];
      if (!t.revealed) continue;
      if (x === capital.x && y === capital.y) continue;
      if (t.owner === 'enemy' || t.owner === 'barbarian') continue;
      candidates.push({ x, y });
    }
  }

  if (candidates.length === 0) {
    state.caravans.nextSpawnTick = _nextSpawnTick();
    return;
  }

  const spot = candidates[Math.floor(Math.random() * candidates.length)];

  // Pick 3 unique random offers from the pool
  const shuffled = [...CARAVAN_OFFERS].sort(() => Math.random() - 0.5);
  const offers   = shuffled.slice(0, 3);

  state.caravans.active = {
    x:         spot.x,
    y:         spot.y,
    offers,
    expiresAt: state.tick + DURATION_TICKS,
  };

  addMessage(
    `🛒 Merchant caravan arrived at (${spot.x},${spot.y})! Click it on the map to trade.`,
    'windfall',
  );
  emit(Events.CARAVAN_UPDATED, { arrived: true, x: spot.x, y: spot.y });
}

// ── Public actions ─────────────────────────────────────────────────────────

/**
 * Accept one of the caravan's trade offers.
 * @param {number} offerIndex — 0-based index into active.offers
 * @returns {{ ok: boolean, reason?: string }}
 */
export function acceptCaravanOffer(offerIndex) {
  const c = state.caravans?.active;
  if (!c)                         return { ok: false, reason: 'No active caravan.' };
  if (state.tick >= c.expiresAt)  return { ok: false, reason: 'The caravan has departed.' };

  const offer = c.offers[offerIndex];
  if (!offer)                     return { ok: false, reason: 'Invalid offer.' };

  // Validate resources to give
  for (const [res, amt] of Object.entries(offer.give)) {
    if ((state.resources[res] ?? 0) < amt) {
      const rName = res.charAt(0).toUpperCase() + res.slice(1);
      return { ok: false, reason: `Not enough ${rName} (need ${amt}).` };
    }
  }

  // Deduct give resources
  for (const [res, amt] of Object.entries(offer.give)) {
    state.resources[res] = Math.max(0, (state.resources[res] ?? 0) - amt);
  }

  // Add get resources (capped)
  for (const [res, amt] of Object.entries(offer.get)) {
    const cap = state.caps[res] ?? Infinity;
    state.resources[res] = Math.min(cap, (state.resources[res] ?? 0) + amt);
  }

  const giveStr = Object.entries(offer.give).map(([r, a]) => `-${a} ${r}`).join(', ');
  const getStr  = Object.entries(offer.get).map(([r, a]) => `+${a} ${r}`).join(', ');
  addMessage(`🛒 Caravan trade: ${giveStr} → ${getStr}`, 'windfall');

  emit(Events.RESOURCE_CHANGED, {});
  emit(Events.CARAVAN_UPDATED, { traded: true });
  return { ok: true };
}

/** Seconds remaining until the active caravan departs. */
export function getCaravanSecsLeft() {
  if (!state.caravans?.active) return 0;
  return Math.max(0, Math.ceil((state.caravans.active.expiresAt - state.tick) / 4));
}
