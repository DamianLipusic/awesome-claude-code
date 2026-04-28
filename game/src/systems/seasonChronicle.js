/**
 * EmpireOS — Season Chronicle System (T181).
 *
 * Tracks per-season statistics: battles won/lost, buildings built,
 * techs researched, quests completed, and tiles gained.
 * At each season change, finalises the current season's recap and
 * prepends it to a rolling history capped at MAX_RECAPS entries.
 */

import { state } from '../core/state.js';
import { on, Events } from '../core/events.js';
import { SEASONS } from '../data/seasons.js';

const MAX_RECAPS = 8;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function initSeasonChronicle() {
  if (!state.seasonChronicle) {
    const idx = state.season?.index ?? 0;
    const s   = SEASONS[idx] ?? SEASONS[0];
    state.seasonChronicle = {
      completed: [],
      current:   _freshCounters(idx, s.name, s.icon),
    };
  }

  on(Events.MAP_CHANGED,      _onMapChanged);
  on(Events.BUILDING_CHANGED, _onBuildingChanged);
  on(Events.TECH_CHANGED,     _onTechChanged);
  on(Events.QUEST_COMPLETED,  _onQuestCompleted);
  on(Events.SEASON_CHANGED,   _onSeasonChanged);
}

/** Returns the array of completed season recaps (newest first, max 8). */
export function getSeasonChronicle() {
  return state.seasonChronicle?.completed ?? [];
}

/** Returns the running stats for the current (in-progress) season. */
export function getCurrentSeasonStats() {
  return state.seasonChronicle?.current ?? null;
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

function _onMapChanged(data) {
  const c = state.seasonChronicle?.current;
  if (!c) return;
  if (data?.outcome === 'win') {
    c.battlesWon++;
    c.tilesGained++;
  } else if (data?.outcome === 'loss') {
    c.battlesLost++;
  }
}

function _onBuildingChanged(data) {
  const c = state.seasonChronicle?.current;
  if (!c) return;
  // Only count deliberate construction events (carry id + count > 0).
  if (data?.id && data?.count != null && data.count > 0) {
    c.built++;
  }
}

function _onTechChanged(data) {
  const c = state.seasonChronicle?.current;
  if (!c) return;
  if (data?.techId) {
    c.techs++;
  }
}

function _onQuestCompleted(data) {
  const c = state.seasonChronicle?.current;
  if (!c) return;
  if (data?.id) {
    c.quests++;
  }
}

function _onSeasonChanged(data) {
  if (!state.seasonChronicle) return;

  // Finalise the outgoing season's recap.
  const old = state.seasonChronicle.current;
  if (old) {
    old.endTick = state.tick ?? 0;
    state.seasonChronicle.completed.unshift(old);
    if (state.seasonChronicle.completed.length > MAX_RECAPS) {
      state.seasonChronicle.completed.length = MAX_RECAPS;
    }
  }

  // Start fresh counters for the new season.
  const newIdx = data?.index ?? 0;
  const s      = SEASONS[newIdx] ?? SEASONS[0];
  state.seasonChronicle.current = _freshCounters(newIdx, s.name, s.icon);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _freshCounters(seasonIndex, seasonName, seasonIcon) {
  return {
    seasonIndex,
    seasonName,
    seasonIcon,
    battlesWon:  0,
    battlesLost: 0,
    built:       0,
    techs:       0,
    quests:      0,
    tilesGained: 0,
    startTick:   state.tick ?? 0,
    endTick:     null,
  };
}
