/**
 * EmpireOS — Quest / Objective system.
 *
 * Defines milestone quests. Each quest has a check() predicate;
 * when it first returns true the reward is granted and a message logged.
 * Completed quests are stored in state.quests.completed.
 */

import { state } from '../core/state.js';
import { on, emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';

// ---------------------------------------------------------------------------
// Quest definitions
// ---------------------------------------------------------------------------

export const QUESTS = [
  {
    id: 'first_building',
    title: 'First Steps',
    desc: 'Construct your first building.',
    icon: '🏗️',
    reward: { gold: 100 },
    check: st => _totalBuildings(st) >= 1,
  },
  {
    id: 'first_unit',
    title: 'Raise an Army',
    desc: 'Train your first military unit.',
    icon: '⚔️',
    reward: { food: 50 },
    check: st => _totalUnits(st) >= 1,
  },
  {
    id: 'five_buildings',
    title: 'Growing Settlement',
    desc: 'Have 5 or more buildings.',
    icon: '🏘️',
    reward: { gold: 200, wood: 100 },
    check: st => _totalBuildings(st) >= 5,
  },
  {
    id: 'first_research',
    title: 'Knowledge is Power',
    desc: 'Research your first technology.',
    icon: '🔬',
    reward: { food: 150, gold: 50 },
    check: st => Object.keys(st.techs).length >= 1,
  },
  {
    id: 'first_capture',
    title: 'Territorial Expansion',
    desc: 'Capture your first enemy territory.',
    icon: '🗺️',
    reward: { gold: 100, wood: 50 },
    // Player starts with 9 tiles (3×3 capital). ≥10 means at least one capture.
    check: st => _countPlayerTiles(st) >= 10,
  },
  {
    id: 'army_ten',
    title: 'Legion',
    desc: 'Field an army of 10 or more units.',
    icon: '🛡️',
    reward: { food: 200, gold: 100 },
    check: st => _totalUnits(st) >= 10,
  },
  {
    id: 'ten_buildings',
    title: 'Thriving City',
    desc: 'Have 10 or more buildings.',
    icon: '🏰',
    reward: { gold: 400, stone: 200 },
    check: st => _totalBuildings(st) >= 10,
  },
  {
    id: 'twenty_territory',
    title: 'Spreading Empire',
    desc: 'Control 20 or more territories.',
    icon: '🌍',
    reward: { gold: 300, iron: 100 },
    check: st => _countPlayerTiles(st) >= 20,
  },
  {
    id: 'age_bronze',
    title: 'Bronze Age',
    desc: 'Advance to the Bronze Age.',
    icon: '🥉',
    reward: { gold: 500, food: 200 },
    check: st => (st.age ?? 0) >= 1,
  },
  {
    id: 'age_iron',
    title: 'Iron Age',
    desc: 'Advance to the Iron Age.',
    icon: '⚙️',
    reward: { gold: 1000, iron: 500 },
    check: st => (st.age ?? 0) >= 2,
  },
  {
    id: 'age_medieval',
    title: 'Medieval Empire',
    desc: 'Reach the Medieval Age — the pinnacle of your empire!',
    icon: '👑',
    reward: { gold: 2000, mana: 1000 },
    check: st => (st.age ?? 0) >= 3,
  },
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _totalBuildings(st) {
  return Object.values(st.buildings).reduce((s, c) => s + c, 0);
}

function _totalUnits(st) {
  return Object.values(st.units).reduce((s, c) => s + c, 0);
}

function _countPlayerTiles(st) {
  if (!st.map) return 0;
  let count = 0;
  for (const row of st.map.tiles) {
    for (const tile of row) {
      if (tile.owner === 'player') count++;
    }
  }
  return count;
}

function _grantReward(reward) {
  for (const [res, amt] of Object.entries(reward)) {
    const cap = state.caps[res] ?? 500;
    state.resources[res] = Math.min(cap, (state.resources[res] ?? 0) + amt);
  }
}

function _rewardStr(reward) {
  return Object.entries(reward)
    .map(([res, amt]) => `+${amt} ${res}`)
    .join(', ');
}

// ---------------------------------------------------------------------------
// Check engine
// ---------------------------------------------------------------------------

function _checkAll() {
  if (!state.quests) state.quests = { completed: {} };
  for (const q of QUESTS) {
    if (state.quests.completed[q.id]) continue;
    try {
      if (q.check(state)) {
        state.quests.completed[q.id] = state.tick;
        _grantReward(q.reward);
        addMessage(
          `${q.icon} Quest complete: "${q.title}"! Reward: ${_rewardStr(q.reward)}.`,
          'quest',
        );
        emit(Events.QUEST_COMPLETED, { id: q.id });
      }
    } catch (e) {
      console.error('[quest check]', q.id, e);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Called once during boot. Wires event listeners and runs an initial check
 * (handles loaded saves that already meet some quest conditions).
 */
export function initQuests() {
  if (!state.quests) state.quests = { completed: {} };

  on(Events.BUILDING_CHANGED, _checkAll);
  on(Events.UNIT_CHANGED,     _checkAll);
  on(Events.TECH_CHANGED,     _checkAll);
  on(Events.AGE_CHANGED,      _checkAll);
  on(Events.MAP_CHANGED,      _checkAll);
  on(Events.QUEST_COMPLETED,  () => _renderQuestPanel());

  // Deferred initial check so boot messages appear before quest rewards
  setTimeout(_checkAll, 500);
}

// Forward-declared ref to avoid a circular import; set by initQuestPanel.
let _renderQuestPanel = () => {};
export function setQuestPanelRenderer(fn) { _renderQuestPanel = fn; }
