/**
 * EmpireOS — T203: Corruption & Reform System.
 *
 * As the empire expands beyond 15 territory tiles, administrative corruption
 * accumulates over time.  High corruption reduces all positive production rates.
 * Two reform actions can reduce it at a resource cost.
 *
 * State shape:
 *   state.corruption = {
 *     level:        number,  // 0–100 (float)
 *     totalReforms: number,  // cumulative reform count
 *   } | null
 *
 * Penalty applied in recalcRates():
 *   multiplier = 1.0 − (level × 0.002)   →  max −20 % at level 100.
 *
 * Reforms:
 *   adminReform()  — 200 gold → −30 corruption, +10 prestige
 *   justicePurge() — 100 gold + 15 morale → −50 corruption, +20 prestige
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from './morale.js';
import { awardPrestige }    from './prestige.js';
import { recalcRates }      from './resources.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Constants ──────────────────────────────────────────────────────────────

const TERRITORY_THRESHOLD = 15;    // tiles before corruption starts growing
const GROWTH_RATE_BASE    = 0.0001; // per-tick growth per tile above threshold
const AGE_MULT            = [1.0, 1.2, 1.4, 1.6]; // per age (Stone→Medieval)
const MAX_LEVEL           = 100;
const PENALTY_PER_LEVEL   = 0.002; // -0.2% per point → -20% at 100

// Thresholds for one-time warning messages
const WARN_THRESHOLDS = [40, 70, 90];

// ── Public API ─────────────────────────────────────────────────────────────

export function initCorruption() {
  state.corruption  = state.corruption ?? { level: 0, totalReforms: 0 };
  _lastWarnLevel = state.corruption.level;  // don't re-fire old warnings on load
}

/**
 * Returns the production-rate multiplier due to corruption (0.80 – 1.00).
 */
export function getCorruptionPenalty() {
  const level = state.corruption?.level ?? 0;
  return Math.max(0.80, 1.0 - level * PENALTY_PER_LEVEL);
}

/**
 * Administrative Reform — 200 gold → −30 corruption, +10 prestige.
 */
export function adminReform() {
  const c = state.corruption;
  if (!c) return { ok: false, reason: 'Corruption system not initialised.' };
  if (c.level <= 0) return { ok: false, reason: 'No corruption to reform.' };
  if ((state.resources.gold ?? 0) < 200) return { ok: false, reason: 'Need 200 gold.' };

  state.resources.gold -= 200;
  const before = c.level;
  c.level = Math.max(0, c.level - 30);
  c.totalReforms++;
  recalcRates();
  awardPrestige(10, 'administrative reform');
  addMessage(
    `📜 Administrative Reform enacted. Corruption reduced by ${Math.round(before - c.level)} points.`,
    'windfall',
  );
  emit(Events.CORRUPTION_CHANGED, { level: c.level, reform: 'admin' });
  return { ok: true };
}

/**
 * Justice Purge — 100 gold + 15 morale → −50 corruption, +20 prestige.
 */
export function justicePurge() {
  const c = state.corruption;
  if (!c) return { ok: false, reason: 'Corruption system not initialised.' };
  if (c.level <= 0) return { ok: false, reason: 'No corruption to purge.' };
  if ((state.resources.gold ?? 0) < 100) return { ok: false, reason: 'Need 100 gold.' };
  if ((state.morale ?? 50) < 15)         return { ok: false, reason: 'Need at least 15 morale.' };

  state.resources.gold -= 100;
  changeMorale(-15);
  const before = c.level;
  c.level = Math.max(0, c.level - 50);
  c.totalReforms++;
  recalcRates();
  awardPrestige(20, 'justice purge');
  addMessage(
    `⚖️ Justice Purge completed. Corruption reduced by ${Math.round(before - c.level)} points. (-15 morale)`,
    'windfall',
  );
  emit(Events.CORRUPTION_CHANGED, { level: c.level, reform: 'purge' });
  return { ok: true };
}

// ── Tick ───────────────────────────────────────────────────────────────────

let _lastWarnLevel = -1;

export function corruptionTick() {
  const c = state.corruption;
  if (!c) return;
  if (c.level >= MAX_LEVEL) return;

  const playerTiles = _countPlayerTiles();
  if (playerTiles <= TERRITORY_THRESHOLD) return;

  const excess  = playerTiles - TERRITORY_THRESHOLD;
  const age     = state.age ?? 0;
  const mult    = AGE_MULT[Math.min(age, AGE_MULT.length - 1)];
  const growth  = excess * GROWTH_RATE_BASE * mult;

  const before = c.level;
  c.level = Math.min(MAX_LEVEL, c.level + growth);

  // One-time warning messages at thresholds
  for (const thresh of WARN_THRESHOLDS) {
    if (before < thresh && c.level >= thresh && thresh > _lastWarnLevel) {
      _lastWarnLevel = thresh;
      if (thresh === 40) {
        addMessage('🔴 Corruption is spreading through the provinces. Enact a reform before production suffers.', 'loss');
      } else if (thresh === 70) {
        addMessage('⚠️ High corruption is crippling the empire! Immediate reform is required.', 'loss');
      } else if (thresh === 90) {
        addMessage('💀 Extreme corruption! The empire is on the brink of administrative collapse.', 'loss');
      }
      emit(Events.CORRUPTION_CHANGED, { level: c.level });
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function _countPlayerTiles() {
  if (!state.map?.tiles) return 0;
  let count = 0;
  for (const row of state.map.tiles) {
    for (const tile of row) {
      if (tile.owner === 'player') count++;
    }
  }
  return count;
}
