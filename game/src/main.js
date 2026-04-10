/**
 * EmpireOS — Main entry point.
 * Wires together core engine, systems, and UI on DOMContentLoaded.
 */

import { state, initState } from './core/state.js';
import { emit, on, Events } from './core/events.js';
import { registerSystem, startLoop } from './core/tick.js';
import { resourceTick, recalcRates } from './systems/resources.js';
import { researchTick } from './systems/research.js';
import { initMap } from './systems/map.js';
import { initRandomEvents, randomEventTick } from './systems/randomEvents.js';
import { initQuests } from './systems/quests.js';
import { initStory } from './systems/story.js';
import { initDiplomacy, diplomacyTick } from './systems/diplomacy.js';
import { initSeasons, seasonTick, currentSeason, seasonTicksRemaining } from './systems/seasons.js';
import { SEASONS } from './data/seasons.js';
import { AGES } from './data/ages.js';
import { TICKS_PER_SECOND } from './core/tick.js';
import { initHUD } from './ui/hud.js';
import { initBuildingPanel } from './ui/buildingPanel.js';
import { initMessageLog } from './ui/messageLog.js';
import { initResearchPanel } from './ui/researchPanel.js';
import { initMilitaryPanel } from './ui/militaryPanel.js';
import { initMapPanel } from './ui/mapPanel.js';
import { initQuestPanel } from './ui/questPanel.js';
import { initStoryPanel } from './ui/storyPanel.js';
import { initSettingsPanel } from './ui/settingsPanel.js';
import { initSaveModal } from './ui/saveModal.js';
import { initDiplomacyPanel } from './ui/diplomacyPanel.js';
import { initTabs } from './ui/tabs.js';
import { addMessage } from './core/actions.js';

// Leaderboard localStorage key (shared with settingsPanel.js)
const LB_KEY = 'empireos-leaderboard';

// ── Boot sequence ─────────────────────────────────────────────────────────

function boot() {
  // Check for a saved game first
  const saved = _loadSave();
  if (saved) {
    _applySave(saved);
    // Generate fresh map if save predates map system
    if (!state.map) initMap();
    emit(Events.GAME_LOADED, {});
  } else {
    initState('My Empire');
    initMap();
    addMessage('Welcome to EmpireOS. Build your empire!', 'info');
    addMessage('Start by constructing Farms and Lumber Mills.', 'info');
    addMessage('Train soldiers and open the Map tab to expand your territory!', 'info');
  }

  // Register tick systems (order matters)
  registerSystem(resourceTick);
  registerSystem(researchTick);
  registerSystem(randomEventTick);
  registerSystem(diplomacyTick);
  registerSystem(seasonTick);

  // Init event-driven systems
  initRandomEvents();
  initQuests();
  initStory();
  initDiplomacy();
  initSeasons();

  // Init UI
  initHUD();
  initTabs();
  initBuildingPanel();
  initMilitaryPanel();
  initMapPanel();
  initResearchPanel();
  initQuestPanel();
  initStoryPanel();
  initSettingsPanel();
  initDiplomacyPanel();
  initMessageLog();
  initSaveModal(_applySave);

  // Bind top-level controls
  _bindControls();

  // Track peak territory for leaderboard
  on(Events.MAP_CHANGED, _updatePeakTerritory);

  // Update age badge on changes
  _updateAgeBadge();
  on(Events.AGE_CHANGED, _updateAgeBadge);

  // Update season badge on changes (also on TICK for countdown display)
  _updateSeasonBadge();
  on(Events.SEASON_CHANGED, _updateSeasonBadge);
  // Refresh season badge every 4 ticks (~1 s) for countdown accuracy
  let _seasonBadgeTick = 0;
  on(Events.TICK, () => { if (++_seasonBadgeTick % 4 === 0) _updateSeasonBadge(); });

  // Start auto-save every 60 seconds
  setInterval(_save, 60_000);

  // Start the game loop
  startLoop();

  emit(Events.GAME_STARTED, {});
}

// ── Save / Load ───────────────────────────────────────────────────────────

function _save() {
  try {
    localStorage.setItem('empireos-save', JSON.stringify({
      version: 8,
      ts: Date.now(),
      state: {
        empire:        state.empire,
        resources:     state.resources,
        rates:         state.rates,
        caps:          state.caps,
        buildings:     state.buildings,
        units:         state.units,
        techs:         state.techs,
        trainingQueue: state.trainingQueue,
        researchQueue: state.researchQueue,
        messages:      state.messages.slice(0, 20),
        map:           state.map,
        age:           state.age,
        randomEvents:  state.randomEvents,
        quests:        state.quests,
        story:         state.story,
        diplomacy:     state.diplomacy,
        season:        state.season,
        hero:          state.hero,
        stats:         state.stats,
        tick:          state.tick,
      }
    }));
    emit(Events.GAME_SAVED, {});
  } catch (e) {
    console.error('[save error]', e);
  }
}

function _loadSave() {
  try {
    const raw = localStorage.getItem('empireos-save');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function _applySave(save) {
  const s = save.state;
  Object.assign(state.empire,        s.empire        ?? {});
  Object.assign(state.resources,     s.resources     ?? {});
  Object.assign(state.caps,          s.caps          ?? {});
  Object.assign(state.buildings,     s.buildings     ?? {});
  Object.assign(state.units,         s.units         ?? {});
  Object.assign(state.techs,         s.techs         ?? {});
  state.trainingQueue  = s.trainingQueue  ?? [];
  state.researchQueue  = s.researchQueue  ?? [];
  state.messages       = s.messages       ?? [];
  state.map            = s.map            ?? null;
  state.age            = s.age            ?? 0;
  state.randomEvents   = s.randomEvents   ?? null;
  state.quests         = s.quests         ?? null;
  state.story          = s.story          ?? [];
  state.diplomacy      = s.diplomacy      ?? null;
  state.season         = s.season         ?? null;
  state.hero           = s.hero           ?? null;
  state.stats          = s.stats          ?? { goldEarned: 0, peakTerritory: 0 };
  state.tick           = s.tick           ?? 0;
  recalcRates();
  addMessage('Game loaded.', 'info');
}

// ── Age badge ─────────────────────────────────────────────────────────────

function _updateAgeBadge() {
  const el  = document.getElementById('age-badge');
  if (!el) return;
  const age = AGES[state.age ?? 0];
  el.textContent = age ? `${age.icon} ${age.name}` : '';
}

// ── Season badge ──────────────────────────────────────────────────────────

function _updateSeasonBadge() {
  const el = document.getElementById('season-badge');
  if (!el) return;
  const s = currentSeason();
  const remaining = seasonTicksRemaining();
  const secsLeft  = Math.ceil(remaining / TICKS_PER_SECOND);
  const mins = Math.floor(secsLeft / 60);
  const secs = secsLeft % 60;
  const timeStr = mins > 0 ? `${mins}m${String(secs).padStart(2,'0')}s` : `${secs}s`;
  el.textContent = `${s.icon} ${s.name}`;
  el.title = `${s.name}: ${s.desc} — Changes in ${timeStr}`;
}

// ── Leaderboard ───────────────────────────────────────────────────────────

/**
 * Persist the current session's stats to the shared leaderboard in localStorage.
 * Called before wiping state on New Game.
 * Only records if the player has done something meaningful (tick > 0).
 */
function _saveToLeaderboard() {
  if (!state.tick || state.tick < 40) return; // ignore trivially-short sessions
  try {
    const raw = localStorage.getItem(LB_KEY);
    const lb  = (raw ? JSON.parse(raw) : null) ?? { scores: [] };

    const quests = Object.keys(state.quests?.completed ?? {}).length;
    lb.scores.push({
      name:       state.empire.name,
      territory:  state.stats?.peakTerritory ?? 0,
      goldEarned: Math.round(state.stats?.goldEarned ?? 0),
      age:        state.age ?? 0,
      quests,
      tick:       state.tick,
      date:       new Date().toLocaleDateString(),
    });

    // Keep top 10 ranked by territory (primary) then gold (secondary)
    lb.scores.sort((a, b) =>
      b.territory !== a.territory
        ? b.territory - a.territory
        : b.goldEarned - a.goldEarned
    );
    lb.scores = lb.scores.slice(0, 10);

    localStorage.setItem(LB_KEY, JSON.stringify(lb));
  } catch (e) {
    console.error('[leaderboard save error]', e);
  }
}

/**
 * Keep state.stats.peakTerritory up to date after every map change.
 */
function _updatePeakTerritory() {
  if (!state.stats || !state.map) return;
  let count = 0;
  for (const row of state.map.tiles) {
    for (const tile of row) {
      if (tile.owner === 'player') count++;
    }
  }
  if (count > state.stats.peakTerritory) state.stats.peakTerritory = count;
}

// ── UI Controls ───────────────────────────────────────────────────────────

function _bindControls() {
  document.getElementById('btn-save')?.addEventListener('click', () => {
    _save();
    addMessage('Game saved.', 'info');
  });

  document.getElementById('btn-new-game')?.addEventListener('click', () => {
    if (confirm('Start a new game? This will erase your current progress.')) {
      // Save current session score to the leaderboard before wiping
      _saveToLeaderboard();
      localStorage.removeItem('empireos-save');
      initState('My Empire');
      initMap();
      initRandomEvents();
      initDiplomacy();
      initSeasons();
      recalcRates();
      emit(Events.MAP_CHANGED, {});
      emit(Events.HERO_CHANGED, {});
      addMessage('New game started. Build your empire!', 'info');
      emit(Events.STATE_CHANGED, {});
      emit(Events.RESOURCE_CHANGED, {});
      emit(Events.BUILDING_CHANGED, {});
      emit(Events.TECH_CHANGED, {});
      emit(Events.AGE_CHANGED, { age: 0 });
    }
  });

  document.getElementById('btn-empire-name')?.addEventListener('click', () => {
    const name = prompt('Enter your empire name:', state.empire.name);
    if (name && name.trim()) {
      state.empire.name = name.trim();
      const el = document.getElementById('empire-name');
      if (el) el.textContent = state.empire.name;
    }
  });
}

// ── Start ─────────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
