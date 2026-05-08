/**
 * EmpireOS — Seasonal Harvest Window (T234).
 *
 * At 70% through each season (tick 252 of 360), a harvest window opens.
 * The player can collect a one-time seasonal bounty from the Quest panel.
 * The window closes at season end. Resets each season via SEASON_CHANGED.
 *
 * Season rewards:
 *   Spring (0): +100 food  + 30 prestige
 *   Summer (1): +80  gold  + 25 prestige
 *   Autumn (2): +60  wood  + 60 stone + 20 prestige
 *   Winter (3): +40  mana  + 30 iron  + 20 prestige
 *
 * state.harvest = {
 *   collectedThisSeason: boolean,
 *   windowCloseAt:       tick | null,
 *   totalHarvests:       number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, on, Events } from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { TICKS_PER_SECOND } from '../core/tick.js';
import { awardPrestige }    from './prestige.js';

// ── Constants ──────────────────────────────────────────────────────────────

const SEASON_DURATION    = 90 * TICKS_PER_SECOND;          // 360 ticks / season
const HARVEST_TRIGGER    = Math.floor(SEASON_DURATION * 0.70); // 252 ticks in (70%)
const HARVEST_WINDOW     = SEASON_DURATION - HARVEST_TRIGGER;  // 108 ticks (~27 s)

// Per-season reward definitions
const SEASON_REWARDS = [
  { season: 'Spring', icon: '🌱', resources: { food: 100 },            prestige: 30 },
  { season: 'Summer', icon: '☀️', resources: { gold: 80  },            prestige: 25 },
  { season: 'Autumn', icon: '🍂', resources: { wood: 60, stone: 60 },  prestige: 20 },
  { season: 'Winter', icon: '❄️', resources: { mana: 40, iron:  30 },  prestige: 20 },
];

// ── Init ──────────────────────────────────────────────────────────────────

export function initHarvest() {
  if (!state.harvest) {
    state.harvest = {
      collectedThisSeason: false,
      windowCloseAt:       null,
      totalHarvests:       0,
    };
  }
  if (state.harvest.totalHarvests === undefined) state.harvest.totalHarvests = 0;

  // Reset flags when a new season begins
  on(Events.SEASON_CHANGED, _onSeasonChanged);
}

// ── Tick ──────────────────────────────────────────────────────────────────

export function harvestTick() {
  if (!state.harvest || !state.season) return;
  const h = state.harvest;

  // Close window if it expired
  if (h.windowCloseAt !== null && state.tick >= h.windowCloseAt) {
    const wasOpen = !h.collectedThisSeason;
    h.windowCloseAt = null;
    if (wasOpen) {
      emit(Events.HARVEST_CHANGED, { expired: true });
      addMessage('🌾 The seasonal harvest window has closed — it will reopen next season.', 'info');
    }
    return;
  }

  // Open window when season reaches 70%
  if (h.windowCloseAt === null && !h.collectedThisSeason) {
    const seasonTick = state.season.tick ?? 0;
    if (seasonTick >= HARVEST_TRIGGER) {
      h.windowCloseAt = state.tick + (SEASON_DURATION - seasonTick);
      const idx    = state.season.index ?? 0;
      const reward = SEASON_REWARDS[idx];
      emit(Events.HARVEST_CHANGED, { opened: true });
      addMessage(
        `🌾 ${reward.icon} Seasonal Harvest ready! Collect your ${reward.season} bounty in the Quests tab.`,
        'windfall',
      );
    }
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Collect the seasonal harvest reward.
 * Returns { ok: boolean, reason?: string }
 */
export function collectHarvest() {
  const h = state.harvest;
  if (!h) return { ok: false, reason: 'Not initialised.' };
  if (h.collectedThisSeason) return { ok: false, reason: 'Already collected this season.' };
  if (h.windowCloseAt === null || state.tick >= h.windowCloseAt) {
    return { ok: false, reason: 'Harvest window is not currently open.' };
  }

  const idx    = state.season?.index ?? 0;
  const reward = SEASON_REWARDS[idx];

  // Grant resources
  for (const [res, amt] of Object.entries(reward.resources)) {
    const cap = state.caps[res] ?? 500;
    state.resources[res] = Math.min(cap, (state.resources[res] ?? 0) + amt);
  }
  awardPrestige(reward.prestige, `${reward.season} harvest collected`);

  h.collectedThisSeason = true;
  h.windowCloseAt       = null;  // close the window immediately after collecting
  h.totalHarvests       = (h.totalHarvests ?? 0) + 1;

  const rewardStr = Object.entries(reward.resources)
    .map(([r, v]) => `+${v} ${r}`).join(', ');

  emit(Events.HARVEST_CHANGED, { collected: true });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(
    `🌾 ${reward.icon} ${reward.season} harvest collected! ${rewardStr}, +${reward.prestige} prestige.`,
    'windfall',
  );
  return { ok: true };
}

/** True when the harvest window is open and uncollected. */
export function isHarvestAvailable() {
  const h = state.harvest;
  return !!(h && !h.collectedThisSeason && h.windowCloseAt !== null && state.tick < h.windowCloseAt);
}

/** Seconds remaining in the current harvest window (0 when closed). */
export function getHarvestSecsLeft() {
  const h = state.harvest;
  if (!h?.windowCloseAt || state.tick >= h.windowCloseAt) return 0;
  return Math.max(0, Math.ceil((h.windowCloseAt - state.tick) / TICKS_PER_SECOND));
}

/** Returns the reward definition for the current season. */
export function getCurrentHarvestReward() {
  const idx = state.season?.index ?? 0;
  return SEASON_REWARDS[idx];
}

// ── Internal helpers ──────────────────────────────────────────────────────

function _onSeasonChanged() {
  if (!state.harvest) return;
  state.harvest.collectedThisSeason = false;
  state.harvest.windowCloseAt       = null;
  // HARVEST_CHANGED is not emitted here — questPanel will re-render on SEASON_CHANGED
}
