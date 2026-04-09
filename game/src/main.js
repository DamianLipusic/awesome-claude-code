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
import { AGES } from './data/ages.js';
import { initHUD } from './ui/hud.js';
import { initBuildingPanel } from './ui/buildingPanel.js';
import { initMessageLog } from './ui/messageLog.js';
import { initResearchPanel } from './ui/researchPanel.js';
import { initMilitaryPanel } from './ui/militaryPanel.js';
import { initMapPanel } from './ui/mapPanel.js';
import { initQuestPanel } from './ui/questPanel.js';
import { initTabs } from './ui/tabs.js';
import { addMessage } from './core/actions.js';

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

  // Init event-driven systems
  initRandomEvents();
  initQuests();

  // Init UI
  initHUD();
  initTabs();
  initBuildingPanel();
  initMilitaryPanel();
  initMapPanel();
  initResearchPanel();
  initQuestPanel();
  initMessageLog();

  // Bind top-level controls
  _bindControls();

  // Update age badge on changes
  _updateAgeBadge();
  on(Events.AGE_CHANGED, _updateAgeBadge);

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
      version: 4,
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

// ── UI Controls ───────────────────────────────────────────────────────────

function _bindControls() {
  document.getElementById('btn-save')?.addEventListener('click', () => {
    _save();
    addMessage('Game saved.', 'info');
  });

  document.getElementById('btn-new-game')?.addEventListener('click', () => {
    if (confirm('Start a new game? This will erase your current progress.')) {
      localStorage.removeItem('empireos-save');
      initState('My Empire');
      initMap();
      initRandomEvents();
      recalcRates();
      emit(Events.MAP_CHANGED, {});
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
