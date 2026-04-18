/**
 * EmpireOS — Empire History / Story system.
 *
 * Records narrative milestones in state.story as the player's empire grows.
 * Entry shape: { milestoneId, tick, icon, title, desc, type }
 *
 * Listens to game events and adds entries for key moments:
 *   - Empire founding
 *   - Building construction milestones
 *   - Military milestones
 *   - Research milestones
 *   - Age advances
 *   - Territory expansion milestones
 *   - Quest completions
 */

import { state } from '../core/state.js';
import { on, Events } from '../core/events.js';
import { AGES } from '../data/ages.js';
import { QUESTS } from './quests.js';
import { RELICS } from '../data/relics.js';

// Set of milestoneIds already recorded (rebuilt from state.story on init)
const _recorded = new Set();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _add({ milestoneId, icon, title, desc, type }) {
  if (milestoneId && _recorded.has(milestoneId)) return;
  if (milestoneId) _recorded.add(milestoneId);

  state.story.unshift({ milestoneId, tick: state.tick, icon, title, desc, type });

  // Cap at 100 entries
  if (state.story.length > 100) state.story.length = 100;
}

function _totalBuildings() {
  return Object.values(state.buildings).reduce((s, c) => s + c, 0);
}

function _totalUnits() {
  return Object.values(state.units).reduce((s, c) => s + c, 0);
}

function _playerTiles() {
  if (!state.map) return 0;
  let n = 0;
  for (const row of state.map.tiles)
    for (const t of row)
      if (t.owner === 'player') n++;
  return n;
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

function _onGameStarted() {
  const founded = state.empire.founded
    ? new Date(state.empire.founded).toLocaleDateString(undefined, {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : 'a distant age';
  _add({
    milestoneId: 'founding',
    icon: '🏛️',
    title: `${state.empire.name} Founded`,
    desc: `On ${founded}, the seeds of a great empire were planted. Your story begins.`,
    type: 'founding',
  });
}

function _onBuildingChanged() {
  const total = _totalBuildings();

  if (total === 1) {
    _add({
      milestoneId: 'first_building',
      icon: '🏗️',
      title: 'First Stone Laid',
      desc: 'Your empire took its first step — a building was constructed.',
      type: 'building',
    });
  }
  if (total === 5) {
    _add({
      milestoneId: 'five_buildings',
      icon: '🏘️',
      title: 'A Growing Settlement',
      desc: "Five structures stand as testament to your people's labour.",
      type: 'building',
    });
  }
  if (total === 10) {
    _add({
      milestoneId: 'ten_buildings',
      icon: '🏰',
      title: 'A Thriving City',
      desc: 'Ten buildings strong — your capital begins to resemble a true city.',
      type: 'building',
    });
  }
  if (total === 20) {
    _add({
      milestoneId: 'twenty_buildings',
      icon: '🌆',
      title: "An Empire's Capital",
      desc: 'Twenty buildings — a magnificent capital befitting a great empire.',
      type: 'building',
    });
  }
}

function _onUnitChanged() {
  const total = _totalUnits();

  if (total === 1) {
    _add({
      milestoneId: 'first_unit',
      icon: '⚔️',
      title: 'The First Soldier',
      desc: 'Your first warrior took up arms to defend and expand the realm.',
      type: 'military',
    });
  }
  if (total === 5) {
    _add({
      milestoneId: 'five_units',
      icon: '🛡️',
      title: 'A Band of Warriors',
      desc: 'Five brave fighters now march under your banner.',
      type: 'military',
    });
  }
  if (total === 10) {
    _add({
      milestoneId: 'ten_units',
      icon: '🎖️',
      title: 'A Legion Forms',
      desc: 'Ten soldiers trained and ready. Your military force grows formidable.',
      type: 'military',
    });
  }
}

function _onTechChanged() {
  const count = Object.keys(state.techs).length;

  if (count === 1) {
    _add({
      milestoneId: 'first_tech',
      icon: '🔬',
      title: 'Knowledge is Power',
      desc: 'Your scholars completed their first great research. A new era of learning begins.',
      type: 'research',
    });
  }
  if (count === 3) {
    _add({
      milestoneId: 'third_tech',
      icon: '📚',
      title: 'A Scholarly Empire',
      desc: 'Three technologies mastered. Your empire grows wiser with each discovery.',
      type: 'research',
    });
  }
  if (count === 6) {
    _add({
      milestoneId: 'all_techs',
      icon: '🧙',
      title: 'Master of All Arts',
      desc: 'All known technologies have been mastered. The secrets of the ages are yours.',
      type: 'research',
    });
  }
}

function _onAgeChanged({ age } = {}) {
  const ageIdx = age ?? state.age ?? 0;
  if (ageIdx === 0) return;
  const ageDef = AGES[ageIdx];
  if (!ageDef) return;
  _add({
    milestoneId: `age_${ageIdx}`,
    icon: ageDef.icon,
    title: `The ${ageDef.name} Begins`,
    desc: ageDef.description,
    type: 'age',
  });
}

function _onMapChanged() {
  const tiles = _playerTiles();

  if (tiles === 10) {
    _add({
      milestoneId: 'first_capture',
      icon: '🗺️',
      title: 'Territorial Expansion',
      desc: 'Your armies secured their first conquest beyond the capital.',
      type: 'territory',
    });
  }
  if (tiles === 20) {
    _add({
      milestoneId: 'twenty_territory',
      icon: '🌍',
      title: 'Spreading Empire',
      desc: 'Twenty territories under your banner. The map begins to bear your mark.',
      type: 'territory',
    });
  }
  if (tiles === 35) {
    _add({
      milestoneId: 'thirty_five_territory',
      icon: '🌐',
      title: 'Dominant Force',
      desc: 'Thirty-five territories! Neighbouring peoples speak of your expanding realm with awe.',
      type: 'territory',
    });
  }
  if (tiles === 50) {
    _add({
      milestoneId: 'fifty_territory',
      icon: '👑',
      title: 'Overlord of the Realm',
      desc: 'Fifty territories. Your empire now dominates the known world.',
      type: 'territory',
    });
  }
}

function _onQuestCompleted({ id } = {}) {
  if (!id) return;
  const quest = QUESTS.find(q => q.id === id);
  if (!quest) return;
  _add({
    milestoneId: `quest_${id}`,
    icon: quest.icon,
    title: `Quest: "${quest.title}"`,
    desc: quest.desc,
    type: 'quest',
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Called once during boot. Initialises state.story if absent,
 * restores _recorded set from an existing save, and wires event listeners.
 */
export function initStory() {
  if (!state.story) state.story = [];

  // Rebuild the dedup set so saves don't get duplicate entries
  for (const entry of state.story) {
    if (entry.milestoneId) _recorded.add(entry.milestoneId);
  }

  on(Events.GAME_STARTED,      _onGameStarted);
  on(Events.BUILDING_CHANGED,  _onBuildingChanged);
  on(Events.UNIT_CHANGED,      _onUnitChanged);
  on(Events.TECH_CHANGED,      _onTechChanged);
  on(Events.AGE_CHANGED,       _onAgeChanged);
  on(Events.MAP_CHANGED,       _onMapChanged);
  on(Events.QUEST_COMPLETED,   _onQuestCompleted);
  on(Events.RELIC_DISCOVERED,  _onRelicDiscovered);
  on(Events.TITLE_EARNED,      _onTitleEarned);
  on(Events.RUIN_EXCAVATED,    _onRuinExcavated);
}

function _onTitleEarned({ titleId, level } = {}) {
  const name = titleId?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) ?? 'New Title';
  _add({
    milestoneId: `title_${titleId}`,
    icon:        level >= 4 ? '🌟' : '👑',
    title:       `Title: ${name}`,
    desc:        `Your growing empire has earned the prestigious title of ${name}.`,
    type:        'achievement',
  });
}

function _onRuinExcavated({ ruinId, outcome } = {}) {
  _add({
    milestoneId: `ruin_${ruinId}`,
    icon:        '🏛️',
    title:       'Ancient Ruin Excavated',
    desc:        `Your forces uncovered the secrets of ${ruinId ?? 'an ancient ruin'} (${outcome ?? 'unknown'}).`,
    type:        'windfall',
  });
}

function _onRelicDiscovered({ relicId }) {
  const def = RELICS[relicId];
  if (!def) return;
  _add({
    milestoneId: `relic_${relicId}`,
    icon:        def.icon,
    title:       `Relic Found: ${def.name}`,
    desc:        def.desc,
    type:        'windfall',
  });
}
