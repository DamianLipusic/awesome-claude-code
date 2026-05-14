/**
 * EmpireOS — Cosmic Alignment System (T244).
 *
 * Every 20-25 minutes (Iron Age+, 10+ player tiles), a rare cosmic event
 * is sighted over the empire. The player has 80 seconds to respond; the
 * encounter card appears in the Quest panel.
 *
 * Alignment types:
 *   🌕 Lunar Eclipse, 🌞 Solar Halo, ☄️ Meteor Shower,
 *   🌌 Aurora Borealis, 🌟 Red Star
 *
 * Player choices:
 *   Observe — free → +20 prestige + reveal 3 unrevealed tiles near capital
 *   Ritual  — pay 40 mana → +60 prestige + +8 morale
 *   Ignore  — no cost, no reward; dismisses the event
 *
 * Spawn conditions:
 *   - Iron Age (age ≥ 2)
 *   - 10+ player-owned map tiles
 *   - No active event
 *   - 20-25 min spawn interval
 *
 * state.cosmicAlignment = {
 *   active:            { id, icon, name, expiresAt } | null,
 *   nextSpawnTick:     tick,
 *   totalAlignments:   number,
 *   totalObserved:     number,
 *   totalRitualed:     number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { awardPrestige }    from './prestige.js';
import { changeMorale }     from './morale.js';
import { TICKS_PER_SECOND } from '../core/tick.js';
import { MAP_W, MAP_H }     from './map.js';

// ── Constants ──────────────────────────────────────────────────────────────

const SPAWN_MIN        = 20 * 60 * TICKS_PER_SECOND;  // 20 min
const SPAWN_RANGE      = 5  * 60 * TICKS_PER_SECOND;  // +0-5 min jitter
const ALIGN_WINDOW     = 80 * TICKS_PER_SECOND;        // 80 sec
const MIN_AGE          = 2;                             // Iron Age
const MIN_PLAYER_TILES = 10;
const OBSERVE_PRESTIGE = 20;
const OBSERVE_REVEALS  = 3;

export const RITUAL_MANA_COST = 40;
export const RITUAL_PRESTIGE  = 60;
export const RITUAL_MORALE    = 8;

const ALIGNMENT_TYPES = [
  { id: 'lunar_eclipse',    icon: '🌕', name: 'Lunar Eclipse',    desc: 'The moon darkens as it crosses the sun\'s shadow. Astronomers scramble for their charts.' },
  { id: 'solar_halo',       icon: '🌞', name: 'Solar Halo',        desc: 'A radiant halo of light encircles the midday sun. Priests call it a divine blessing.' },
  { id: 'meteor_shower',    icon: '☄️', name: 'Meteor Shower',     desc: 'Streaks of fire race across the night sky. The common folk whisper of omens.' },
  { id: 'aurora_borealis',  icon: '🌌', name: 'Aurora Borealis',   desc: 'Curtains of coloured light dance on the horizon. Mystics say the spirit world draws near.' },
  { id: 'red_star',         icon: '🌟', name: 'Red Star Rising',   desc: 'A brilliant red star appears in an unexpected quarter of the sky, unseen for generations.' },
];

// ── Init ──────────────────────────────────────────────────────────────

export function initCosmicAlignment() {
  if (!state.cosmicAlignment) {
    state.cosmicAlignment = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalAlignments: 0,
      totalObserved:   0,
      totalRitualed:   0,
    };
  }
  if (state.cosmicAlignment.nextSpawnTick    === undefined) state.cosmicAlignment.nextSpawnTick    = _nextSpawnTick();
  if (state.cosmicAlignment.totalAlignments  === undefined) state.cosmicAlignment.totalAlignments  = 0;
  if (state.cosmicAlignment.totalObserved    === undefined) state.cosmicAlignment.totalObserved    = 0;
  if (state.cosmicAlignment.totalRitualed    === undefined) state.cosmicAlignment.totalRitualed    = 0;
}

// ── Tick ──────────────────────────────────────────────────────────────

export function cosmicAlignmentTick() {
  const ca = state.cosmicAlignment;
  if (!ca) return;

  // Expire active alignment
  if (ca.active) {
    if (state.tick >= ca.active.expiresAt) {
      const { icon, name } = ca.active;
      ca.active          = null;
      ca.nextSpawnTick   = _nextSpawnTick();
      emit(Events.COSMIC_ALIGNMENT_CHANGED, { expired: true });
      addMessage(`${icon} The ${name} passed unobserved.`, 'info');
    }
    return;
  }

  // Check spawn timing
  if (state.tick < ca.nextSpawnTick) return;

  // Check age requirement
  if ((state.age ?? 0) < MIN_AGE) return;

  // Count player tiles
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) {
    for (const tile of row) {
      if (tile.owner === 'player') playerTiles++;
    }
  }
  if (playerTiles < MIN_PLAYER_TILES) return;

  // Pick a random alignment type
  const type = ALIGNMENT_TYPES[Math.floor(Math.random() * ALIGNMENT_TYPES.length)];

  // Spawn alignment
  ca.active = {
    id:        type.id,
    icon:      type.icon,
    name:      type.name,
    desc:      type.desc,
    expiresAt: state.tick + ALIGN_WINDOW,
  };
  ca.totalAlignments = (ca.totalAlignments ?? 0) + 1;

  emit(Events.COSMIC_ALIGNMENT_CHANGED, { spawned: true });
  addMessage(
    `${type.icon} A ${type.name} lights the sky! Astronomers request guidance — respond within 80 seconds.`,
    'info',
  );
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Observe the alignment — free; +20 prestige, reveal 3 tiles near capital.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function observeAlignment() {
  const ca = state.cosmicAlignment;
  if (!ca?.active) return { ok: false, reason: 'No active cosmic alignment.' };
  if (state.tick >= ca.active.expiresAt) return { ok: false, reason: 'The alignment has passed.' };

  const { icon, name } = ca.active;

  // Reveal up to OBSERVE_REVEALS unrevealed tiles within range 2-6 of capital
  const revealed = _revealTilesNearCapital(OBSERVE_REVEALS);

  awardPrestige(OBSERVE_PRESTIGE, 'cosmic observation');

  ca.active          = null;
  ca.nextSpawnTick   = _nextSpawnTick();
  ca.totalObserved   = (ca.totalObserved ?? 0) + 1;

  emit(Events.COSMIC_ALIGNMENT_CHANGED, { observed: true });
  emit(Events.RESOURCE_CHANGED, {});
  const revealMsg = revealed > 0 ? `, ${revealed} tiles revealed` : '';
  addMessage(
    `${icon} Astronomers record the ${name}. +${OBSERVE_PRESTIGE} prestige${revealMsg}.`,
    'windfall',
  );
  return { ok: true };
}

/**
 * Perform a ritual — costs 40 mana; +60 prestige +8 morale.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function performRitual() {
  const ca = state.cosmicAlignment;
  if (!ca?.active) return { ok: false, reason: 'No active cosmic alignment.' };
  if (state.tick >= ca.active.expiresAt) return { ok: false, reason: 'The alignment has passed.' };

  if ((state.resources?.mana ?? 0) < RITUAL_MANA_COST) {
    return { ok: false, reason: `Requires ${RITUAL_MANA_COST} mana.` };
  }

  const { icon, name } = ca.active;

  state.resources.mana -= RITUAL_MANA_COST;
  awardPrestige(RITUAL_PRESTIGE, 'cosmic ritual');
  changeMorale(RITUAL_MORALE);

  ca.active          = null;
  ca.nextSpawnTick   = _nextSpawnTick();
  ca.totalRitualed   = (ca.totalRitualed ?? 0) + 1;

  emit(Events.COSMIC_ALIGNMENT_CHANGED, { ritualed: true });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(
    `${icon} Priests perform the ${name} ritual. +${RITUAL_PRESTIGE} prestige, +${RITUAL_MORALE} morale.`,
    'windfall',
  );
  return { ok: true };
}

/**
 * Ignore the alignment — no cost, no reward.
 * @returns {{ ok: boolean }}
 */
export function ignoreAlignment() {
  const ca = state.cosmicAlignment;
  if (!ca?.active) return { ok: false, reason: 'No active cosmic alignment.' };

  const name = ca.active.name;
  ca.active          = null;
  ca.nextSpawnTick   = _nextSpawnTick();

  emit(Events.COSMIC_ALIGNMENT_CHANGED, { ignored: true });
  addMessage(`🌌 The ${name} passed without ceremony.`, 'info');
  return { ok: true };
}

/** Returns the active alignment object or null. */
export function getActiveAlignment() {
  return state.cosmicAlignment?.active ?? null;
}

/** Seconds remaining on the active alignment window. */
export function getAlignmentSecsLeft() {
  const a = state.cosmicAlignment?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

// ── Internal helpers ────────────────────────────────────────────────

function _nextSpawnTick() {
  return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE);
}

/**
 * Reveal up to `count` unrevealed tiles within distance 2-8 of the capital.
 * Returns the number of tiles actually revealed.
 */
function _revealTilesNearCapital(count) {
  if (!state.map?.tiles) return 0;
  const tiles = state.map.tiles;
  const cx    = state.map.capital?.x ?? 10;
  const cy    = state.map.capital?.y ?? 10;

  const candidates = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (tiles[y][x].revealed) continue;
      const dist = Math.hypot(x - cx, y - cy);
      if (dist >= 2 && dist <= 8) candidates.push({ x, y });
    }
  }

  // Shuffle candidates, take first `count`
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  let revealed = 0;
  for (const { x, y } of candidates.slice(0, count)) {
    tiles[y][x].revealed = true;
    revealed++;
  }
  if (revealed > 0) emit(Events.MAP_CHANGED, {});
  return revealed;
}