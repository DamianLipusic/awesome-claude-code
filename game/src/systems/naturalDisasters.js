/**
 * EmpireOS — Natural Disaster System (T111).
 *
 * Every 8–10 minutes a natural disaster strikes player-owned tiles,
 * destroying tile improvements and/or fortifications based on terrain type.
 *
 * Disaster types:
 *   wildfire      — targets forest tiles, destroys sawmill improvements
 *   earthquake    — targets mountain/hills tiles, destroys improvements + fortifications
 *   flood         — targets river tiles, destroys dock improvements
 *   locust_swarm  — targets grass tiles, destroys farm improvements
 *
 * If no player tiles of the matching terrain have improvements or fortifications,
 * the disaster has no effect (no empty warning fires).
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';
import { recalcRates } from './resources.js';

const SPAWN_MIN_TICKS = 1920;  // 8 minutes  (at 4 ticks/s)
const SPAWN_MAX_TICKS = 2400;  // 10 minutes
const MAX_TARGETS     = 2;     // max tiles affected per event

const DISASTER_TYPES = [
  {
    id:    'wildfire',
    icon:  '🔥',
    name:  'Wildfire',
    terrain: ['forest'],
    desc:  'A wildfire tore through your forest lands, destroying lumber improvements.',
    affectsImprovement:   true,
    affectsFortification: false,
  },
  {
    id:    'earthquake',
    icon:  '🌍',
    name:  'Earthquake',
    terrain: ['mountain', 'hills'],
    desc:  'An earthquake struck your highland territories, destroying improvements and fortifications.',
    affectsImprovement:   true,
    affectsFortification: true,
  },
  {
    id:    'flood',
    icon:  '🌊',
    name:  'Flood',
    terrain: ['river'],
    desc:  'Flooding washed out your riverside infrastructure.',
    affectsImprovement:   true,
    affectsFortification: false,
  },
  {
    id:    'locust_swarm',
    icon:  '🦗',
    name:  'Locust Swarm',
    terrain: ['grass'],
    desc:  'Locusts devastated your farmlands, destroying agricultural improvements.',
    affectsImprovement:   true,
    affectsFortification: false,
  },
];

export function initNaturalDisasters() {
  if (state.naturalDisasters) {
    // Migration guard — add new fields if missing from older saves
    if (state.naturalDisasters.nextSpawnTick === undefined) {
      state.naturalDisasters.nextSpawnTick = state.tick + _randomInterval();
    }
    return;
  }
  state.naturalDisasters = {
    nextSpawnTick: state.tick + _randomInterval(),
    lastType:      null,
    totalFired:    0,
  };
}

export function naturalDisasterTick() {
  const nd = state.naturalDisasters;
  if (!nd || state.tick < nd.nextSpawnTick) return;

  // Schedule next disaster before doing anything (so errors can't block future events)
  nd.nextSpawnTick = state.tick + _randomInterval();

  // Pick a random disaster type
  const type = DISASTER_TYPES[Math.floor(Math.random() * DISASTER_TYPES.length)];
  nd.lastType = type.id;

  if (!state.map?.tiles) return;

  // Find player-owned tiles of the matching terrain that have something to destroy
  const candidates = [];
  for (let y = 0; y < state.map.height; y++) {
    for (let x = 0; x < state.map.width; x++) {
      const tile = state.map.tiles[y][x];
      if (tile.owner !== 'player') continue;
      if (!type.terrain.includes(tile.type)) continue;

      const hasImprovement   = !!tile.improvement;
      const hasFortification = !!tile.fortified;

      const wouldAffect =
        (type.affectsImprovement   && hasImprovement) ||
        (type.affectsFortification && hasFortification);

      if (wouldAffect) candidates.push({ tile, x, y });
    }
  }

  // No eligible targets — silently skip (no message spam)
  if (candidates.length === 0) return;

  // Shuffle and take up to MAX_TARGETS
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  const targets  = shuffled.slice(0, MAX_TARGETS);

  const affectedCoords = [];
  for (const { tile, x, y } of targets) {
    let damaged = false;

    if (type.affectsImprovement && tile.improvement) {
      tile.improvement      = null;
      tile.improvementLevel = null;
      damaged = true;
    }

    if (type.affectsFortification && tile.fortified) {
      tile.fortified = false;
      tile.defense   = Math.max(0, (tile.defense ?? 0) - 15);
      damaged = true;
    }

    if (damaged) affectedCoords.push(`(${x},${y})`);
  }

  if (affectedCoords.length === 0) return;

  nd.totalFired = (nd.totalFired ?? 0) + 1;

  recalcRates();
  emit(Events.MAP_CHANGED, { naturalDisaster: type.id });
  emit(Events.RESOURCE_CHANGED, {});
  emit(Events.NATURAL_DISASTER, { type: type.id, coords: affectedCoords });

  const coordStr = affectedCoords.join(', ');
  addMessage(
    `${type.icon} ${type.name}! ${type.desc} Affected tiles: ${coordStr}.`,
    'disaster',
  );
}

function _randomInterval() {
  return SPAWN_MIN_TICKS + Math.floor(Math.random() * (SPAWN_MAX_TICKS - SPAWN_MIN_TICKS));
}
