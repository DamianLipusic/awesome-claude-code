/**
 * EmpireOS — Main entry point.
 * Wires together core engine, systems, and UI on DOMContentLoaded.
 */

import { state, initState } from './core/state.js';
import { emit, on, Events } from './core/events.js';
import { registerSystem, startLoop, stopLoop } from './core/tick.js';
import { resourceTick, recalcRates } from './systems/resources.js';
import { researchTick } from './systems/research.js';
import { initMap } from './systems/map.js';
import { initRandomEvents, randomEventTick } from './systems/randomEvents.js';
import { initQuests } from './systems/quests.js';
import { initStory } from './systems/story.js';
import { initDiplomacy, diplomacyTick } from './systems/diplomacy.js';
import { initSeasons, seasonTick, currentSeason, seasonTicksRemaining } from './systems/seasons.js';
import { initVictory, victoryTick } from './systems/victory.js';
import { initMarket, marketTick } from './systems/market.js';
import { initAchievements } from './systems/achievements.js';
import { initEnemyAI, enemyAITick } from './systems/enemyAI.js';
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
import { initMarketPanel } from './ui/marketPanel.js';
import { initSaveModal } from './ui/saveModal.js';
import { initGameOverPanel } from './ui/gameOverPanel.js';
import { initDiplomacyPanel } from './ui/diplomacyPanel.js';
import { initTabs, switchTab } from './ui/tabs.js';
import { initToasts } from './ui/toastManager.js';
import { initSummaryPanel } from './ui/summaryPanel.js';
import { showNewGameWizard } from './ui/newGameModal.js';
import { calcOfflineProgress, showOfflineModal } from './ui/offlineModal.js';
import { initMinimap, drawMinimap } from './ui/minimap.js';
import { addMessage } from './core/actions.js';
import { calcScore } from './utils/score.js';

// Leaderboard localStorage key (shared with settingsPanel.js)
const LB_KEY = 'empireos-leaderboard';

// Offline progress calculated during _applySave(); shown after UI is ready
let _pendingOffline = null;

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
    _applyDifficultyStart();
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
  registerSystem(victoryTick);
  registerSystem(marketTick);
  registerSystem(enemyAITick);

  // Init event-driven systems
  initRandomEvents();
  initQuests();
  initStory();
  initDiplomacy();
  initSeasons();
  initVictory();
  initMarket();
  initAchievements();
  initEnemyAI();

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
  initMarketPanel();
  initDiplomacyPanel();
  initMessageLog();
  initSaveModal(_applySave);
  initGameOverPanel(_newGame);
  initToasts();
  initSummaryPanel();
  initMinimap();

  // Show offline progress modal if the player was away when they last saved
  if (_pendingOffline) {
    showOfflineModal(_pendingOffline.elapsed, _pendingOffline.gains);
    _pendingOffline = null;
  }

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

  // Update score badge on any score-affecting state change
  _updateScoreBadge();
  on(Events.RESOURCE_CHANGED,  _updateScoreBadge);
  on(Events.BUILDING_CHANGED,  _updateScoreBadge);
  on(Events.UNIT_CHANGED,      _updateScoreBadge);
  on(Events.TECH_CHANGED,      _updateScoreBadge);
  on(Events.AGE_CHANGED,       _updateScoreBadge);
  on(Events.MAP_CHANGED,       _updateScoreBadge);
  on(Events.QUEST_COMPLETED,   _updateScoreBadge);

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
      version: 13,
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
        market:        state.market,
        enemyAI:       state.enemyAI,
        unitXP:        state.unitXP,
        unitRanks:     state.unitRanks,
        difficulty:    state.difficulty,
        alerts:        state.alerts ?? {},
        combatHistory: state.combatHistory ?? [],
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
  state.market         = s.market         ?? null;
  state.enemyAI        = s.enemyAI        ?? null;
  state.unitXP         = s.unitXP         ?? {};
  state.unitRanks      = s.unitRanks      ?? {};
  state.difficulty     = s.difficulty     ?? 'normal';
  state.alerts         = s.alerts         ?? {};
  state.combatHistory  = s.combatHistory  ?? [];
  state.tick           = s.tick           ?? 0;
  recalcRates();

  // Calculate offline resource progress (applies gains to state.resources in-place).
  // Stored so we can show the modal after UI panels are ready.
  _pendingOffline = calcOfflineProgress(save.ts, state.rates, state.resources, state.caps);

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

// ── Score badge ───────────────────────────────────────────────────────────

function _updateScoreBadge() {
  const el = document.getElementById('score-badge');
  if (!el) return;
  const s = calcScore();
  el.textContent = `⭐ ${s.toLocaleString()}`;
  el.title = `Empire Score: ${s.toLocaleString()} — see breakdown in the Empire tab`;
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
      score:      calcScore(),
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

// ── Difficulty ────────────────────────────────────────────────────────────

/**
 * Apply a starting-resource bonus/penalty based on the current difficulty setting.
 * Called once at the start of every new game, after initState() has set base values.
 * Easy  → ×1.5 gold/food/wood  (floor: 10 each)
 * Hard  → ×0.75 gold/food/wood (floor: 10 each)
 */
function _applyDifficultyStart() {
  const d = state.difficulty ?? 'normal';
  if (d === 'normal') return;
  const mult = d === 'easy' ? 1.5 : 0.75;
  for (const res of ['gold', 'food', 'wood']) {
    state.resources[res] = Math.max(10, Math.round((state.resources[res] ?? 0) * mult));
  }
}

// ── New Game ──────────────────────────────────────────────────────────────

/**
 * Reset all state and start a fresh game.
 * @param {object} [opts]             Optional overrides from the wizard modal.
 * @param {string} [opts.name]        Empire name; defaults to 'My Empire'.
 * @param {string} [opts.difficulty]  'easy'|'normal'|'hard'; persists in state.
 */
function _newGame(opts = {}) {
  _saveToLeaderboard();
  localStorage.removeItem('empireos-save');
  // Apply difficulty before initState so _applyDifficultyStart sees the right value
  if (opts.difficulty) state.difficulty = opts.difficulty;
  initState(opts.name ?? 'My Empire');
  _applyDifficultyStart();
  initMap();
  initRandomEvents();
  initDiplomacy();
  initSeasons();
  initVictory();
  initMarket();
  initAchievements();
  initEnemyAI();
  recalcRates();
  startLoop();  // restart loop in case it was stopped by game-over
  _syncPauseUI();  // ensure pause overlay is hidden on new game
  emit(Events.MAP_CHANGED, {});
  emit(Events.HERO_CHANGED, {});
  // Reflect the new empire name in the title bar
  const nameEl = document.getElementById('empire-name');
  if (nameEl) nameEl.textContent = state.empire.name;

  // Refresh minimap thumbnail for the new game's map
  drawMinimap();
  addMessage(`New game started. Long live the ${state.empire.name}!`, 'info');
  emit(Events.STATE_CHANGED, {});
  emit(Events.RESOURCE_CHANGED, {});
  emit(Events.BUILDING_CHANGED, {});
  emit(Events.TECH_CHANGED, {});
  emit(Events.AGE_CHANGED, { age: 0 });
  _updateScoreBadge();
}

// ── UI Controls ───────────────────────────────────────────────────────────

function _bindControls() {
  document.getElementById('btn-save')?.addEventListener('click', () => {
    _save();
    addMessage('Game saved.', 'info');
  });

  // New Game: open wizard modal instead of native confirm/prompt
  document.getElementById('btn-new-game')?.addEventListener('click', () => {
    showNewGameWizard(state.difficulty, (opts) => _newGame(opts));
  });

  // Rename empire: inline prompt on title-bar name span (fixed: was using wrong id)
  document.getElementById('empire-name')?.addEventListener('click', () => {
    const name = prompt('Enter your empire name:', state.empire.name);
    if (name && name.trim()) {
      state.empire.name = name.trim();
      const el = document.getElementById('empire-name');
      if (el) el.textContent = state.empire.name;
    }
  });

  // Pause button
  document.getElementById('btn-pause')?.addEventListener('click', _togglePause);

  _bindKeyboard();
}

// ── Pause ─────────────────────────────────────────────────────────────────

/**
 * Toggle the game loop and synchronise all pause-state UI indicators.
 */
function _togglePause() {
  if (state.running) {
    stopLoop();
    addMessage('⏸ Game paused. Press Space, P, or the Pause button to resume.', 'info');
  } else {
    startLoop();
    addMessage('▶ Game resumed.', 'info');
  }
  _syncPauseUI();
}

/**
 * Sync the pause button label and the pause overlay to match state.running.
 * Safe to call before the DOM is ready (guards with optional chaining).
 */
function _syncPauseUI() {
  const btn     = document.getElementById('btn-pause');
  const overlay = document.getElementById('pause-overlay');
  const paused  = !state.running;

  if (btn) {
    btn.textContent = paused ? '▶ Resume' : '⏸ Pause';
    btn.classList.toggle('btn--paused', paused);
  }
  if (overlay) {
    overlay.classList.toggle('pause-overlay--hidden', !paused);
    overlay.setAttribute('aria-hidden', String(!paused));
  }
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────

/**
 * Map number/symbol keys to tab panel ids.
 * Mirrors the tab order in index.html.
 */
const _TAB_KEYS = {
  '1': 'summary',
  '2': 'buildings',
  '3': 'military',
  '4': 'map',
  '5': 'research',
  '6': 'diplomacy',
  '7': 'market',
  '8': 'quests',
  '9': 'story',
  '0': 'settings',
  '-': 'log',
};

function _bindKeyboard() {
  document.addEventListener('keydown', (e) => {
    // Never fire shortcuts when the user is typing in a form element
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;

    // Skip if any system modifier is held (keeps browser shortcuts intact)
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    // Tab switching: 1-0 and -
    if (_TAB_KEYS[e.key] !== undefined) {
      e.preventDefault();
      switchTab(_TAB_KEYS[e.key]);
      return;
    }

    switch (e.key) {
      // Pause / resume
      case ' ':
      case 'p':
      case 'P':
        e.preventDefault();
        _togglePause();
        break;

      // Quick save
      case 's':
      case 'S':
        e.preventDefault();
        _save();
        addMessage('💾 Game saved. [S]', 'info');
        break;

      // Close the save/export modal if open
      case 'Escape': {
        const modal = document.getElementById('save-modal');
        if (modal && !modal.classList.contains('modal--hidden')) {
          document.getElementById('save-modal-close')?.click();
        }
        break;
      }
    }
  });
}

// ── Start ─────────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
