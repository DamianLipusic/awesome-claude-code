/**
 * EmpireOS — Seasonal Map Objectives (T170).
 *
 * Each season a special objective tile is placed on a revealed non-player
 * tile at distance 4–10 from the capital. Capturing the tile awards a
 * season-specific resource bonus + prestige. Objectives expire at season end.
 *
 * Season objectives:
 *   Spring  🌸  Sacred Grove   (forest pref)  +80 food +8 morale +20 prestige
 *   Summer  ☀️  Sunstone Quarry (hills pref)   +120 gold +25 prestige
 *   Autumn  🍂  Harvest Temple  (grass pref)   +100 food +50 wood +8 morale +20 prestige
 *   Winter  ❄️  Frozen Oracle   (any)          +80 mana +30 prestige
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';
import { recalcRates } from './resources.js';
import { awardPrestige } from './prestige.js';
import { changeMorale } from './morale.js';
import { CAPITAL, MAP_W, MAP_H } from './map.js';

// ── Objective definitions per season index (0=Spring, 1=Summer, 2=Autumn, 3=Winter) ──

const OBJECTIVES = [
  {
    seasonIdx: 0,
    icon: '🌸',
    name: 'Sacred Grove',
    desc: 'An ancient, sacred forest clearing radiating life-energy.',
    preferredTerrain: ['forest', 'grass'],
    reward: { food: 80, morale: 8, prestige: 20 },
    rewardDesc: '+80 🍖 +8 morale +20 prestige',
  },
  {
    seasonIdx: 1,
    icon: '☀️',
    name: 'Sunstone Quarry',
    desc: 'Rare solar crystals glinting in the summer heat.',
    preferredTerrain: ['hills', 'mountain'],
    reward: { gold: 120, prestige: 25 },
    rewardDesc: '+120 💰 +25 prestige',
  },
  {
    seasonIdx: 2,
    icon: '🍂',
    name: 'Harvest Temple',
    desc: 'A bountiful harvest site blessed by the gods of plenty.',
    preferredTerrain: ['grass', 'river'],
    reward: { food: 100, wood: 50, morale: 8, prestige: 20 },
    rewardDesc: '+100 🍖 +50 🪵 +8 morale +20 prestige',
  },
  {
    seasonIdx: 3,
    icon: '❄️',
    name: 'Frozen Oracle',
    desc: 'A mystical shrine locked in eternal ice, humming with arcane power.',
    preferredTerrain: ['mountain', 'hills', 'river', 'forest', 'grass'],
    reward: { mana: 80, prestige: 30 },
    rewardDesc: '+80 ✨ +30 prestige',
  },
];

// ── Internal helpers ──────────────────────────────────────────────────────────

function _dist(x, y) {
  return Math.abs(x - CAPITAL.x) + Math.abs(y - CAPITAL.y);
}

function _spawnObjective(seasonIdx) {
  if (!state.map) return;
  if (!state.seasonalObjectives) {
    state.seasonalObjectives = { current: null, captured: [] };
  }
  // Clear any existing objective tile
  _clearObjectiveTile();

  const def = OBJECTIVES[seasonIdx];
  const tiles = state.map.tiles;

  // Build candidate list: revealed, non-player, non-enemy, non-barbarian tiles at dist 4–10
  const candidates = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const t = tiles[y][x];
      if (!t.revealed) continue;
      if (t.owner === 'player') continue;
      if (t.owner === 'enemy') continue;
      if (t.owner === 'barbarian') continue;
      if (t.landmark || t.hasRuin || t.isChokepoint || t.ancientBattlefield) continue;
      const d = _dist(x, y);
      if (d < 4 || d > 10) continue;
      // Prefer matching terrain
      const preferred = def.preferredTerrain.includes(t.type);
      candidates.push({ x, y, preferred });
    }
  }

  if (candidates.length === 0) return;

  // Shuffle candidates, preferred first
  const preferred = candidates.filter(c => c.preferred);
  const others    = candidates.filter(c => !c.preferred);
  const pool      = [...preferred, ...others];

  // Pick a random candidate (weighted toward preferred)
  const pick = pool[Math.floor(Math.random() * Math.min(pool.length, Math.max(preferred.length, 5) + 5))];
  if (!pick) return;

  const tile = tiles[pick.y][pick.x];
  tile.seasonalObjective = seasonIdx;

  state.seasonalObjectives.current = {
    x: pick.x,
    y: pick.y,
    seasonIdx,
    icon: def.icon,
    name: def.name,
    desc: def.desc,
    rewardDesc: def.rewardDesc,
  };

  emit(Events.SEASONAL_OBJECTIVE, { type: 'spawned', seasonIdx, x: pick.x, y: pick.y });
  emit(Events.MAP_CHANGED, {});
  addMessage(`${def.icon} A ${def.name} has appeared at (${pick.x},${pick.y})! Capture it for ${def.rewardDesc}.`, 'windfall');
}

function _clearObjectiveTile() {
  const cur = state.seasonalObjectives?.current;
  if (!cur || !state.map) return;
  const tile = state.map.tiles[cur.y]?.[cur.x];
  if (tile && tile.seasonalObjective !== undefined) {
    delete tile.seasonalObjective;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Called from main.js on SEASON_CHANGED to spawn a new objective.
 * Also clears any previous objective (expired, uncaptured).
 */
export function onSeasonChanged(seasonIdx) {
  if (!state.seasonalObjectives) {
    state.seasonalObjectives = { current: null, captured: [] };
  }

  const cur = state.seasonalObjectives.current;
  if (cur) {
    // Previous objective expired uncaptured
    _clearObjectiveTile();
    const def = OBJECTIVES[cur.seasonIdx];
    if (def) addMessage(`${def.icon} The ${cur.name} has faded with the changing season.`, 'info');
    state.seasonalObjectives.current = null;
    emit(Events.SEASONAL_OBJECTIVE, { type: 'expired', seasonIdx: cur.seasonIdx });
  }

  _spawnObjective(seasonIdx);
}

/**
 * Called from combat.js _victory() when a tile is captured.
 * Returns true if the tile was a seasonal objective and the reward was granted.
 */
export function tryClaimSeasonalObjective(x, y) {
  const cur = state.seasonalObjectives?.current;
  if (!cur || cur.x !== x || cur.y !== y) return false;

  const def = OBJECTIVES[cur.seasonIdx];
  if (!def) return false;

  const { reward } = def;

  // Apply resource rewards
  if (reward.gold)  state.resources.gold  = Math.min(state.caps.gold,  (state.resources.gold  ?? 0) + reward.gold);
  if (reward.food)  state.resources.food  = Math.min(state.caps.food,  (state.resources.food  ?? 0) + reward.food);
  if (reward.wood)  state.resources.wood  = Math.min(state.caps.wood,  (state.resources.wood  ?? 0) + reward.wood);
  if (reward.mana)  state.resources.mana  = Math.min(state.caps.mana,  (state.resources.mana  ?? 0) + reward.mana);
  if (reward.iron)  state.resources.iron  = Math.min(state.caps.iron,  (state.resources.iron  ?? 0) + reward.iron);
  if (reward.stone) state.resources.stone = Math.min(state.caps.stone, (state.resources.stone ?? 0) + reward.stone);

  // Apply morale
  if (reward.morale) changeMorale(reward.morale);

  // Apply prestige
  if (reward.prestige) awardPrestige(reward.prestige, `${def.name} captured`);

  // Clear the objective
  state.seasonalObjectives.captured.push(cur.seasonIdx);
  state.seasonalObjectives.current = null;

  // Clear the tile flag (already captured so owner is now 'player', but remove marker)
  if (state.map) {
    const tile = state.map.tiles[y]?.[x];
    if (tile) delete tile.seasonalObjective;
  }

  recalcRates();
  emit(Events.SEASONAL_OBJECTIVE, { type: 'captured', seasonIdx: cur.seasonIdx, x, y });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`${def.icon} ${def.name} captured! ${def.rewardDesc}`, 'windfall');
  return true;
}

/**
 * Returns the current active seasonal objective, or null.
 */
export function getActiveSeasonalObjective() {
  return state.seasonalObjectives?.current ?? null;
}
