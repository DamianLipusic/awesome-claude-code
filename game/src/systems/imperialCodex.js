/**
 * EmpireOS — Imperial Codex System (T215).
 *
 * Tracks knowledge fragments gained from diverse in-game activities.
 * Reaching milestone thresholds unlocks permanent empire bonuses.
 *
 * Fragment sources:
 *   Combat victory (MAP_CHANGED with outcome=victory): +1
 *   Quest completed (QUEST_COMPLETED):                 +3
 *   Tech researched (TECH_CHANGED, new tech):          +2
 *   Age advanced (AGE_CHANGED):                        +10
 *   Achievement unlocked (ACHIEVEMENT_UNLOCKED):        +5
 *   Omen averted or channeled (OMEN_AVERTED/CHANNELED): +2
 *   Epic quest chain completed (EPIC_QUEST_PROGRESS):  +8
 *
 * Milestone bonuses (cumulative fragment thresholds):
 *   10  → +80 gold (instant)
 *   25  → +0.25 gold/s permanent rate
 *   50  → +8 morale permanent
 *   75  → +25 mana cap + +50 prestige
 *   100 → +1.0 gold/s permanent rate
 *   150 → +15% all building production (codexProdMult = 1.15)
 *
 * State: state.codex = {
 *   fragments:     number,   // total fragments this game
 *   milestones:    string[], // IDs of unlocked milestone rewards
 *   codexGoldRate: number,   // permanent gold/s from codex milestones
 *   codexProdMult: number,   // production multiplier (1.0 default, 1.15 at 150 frags)
 * }
 */

import { state }            from '../core/state.js';
import { on, emit, Events } from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { awardPrestige }    from './prestige.js';
import { changeMorale }     from './morale.js';
import { recalcRates }      from './resources.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Milestone definitions ──────────────────────────────────────────────────

export const CODEX_MILESTONES = [
  {
    id:        'tome_i',
    threshold: 10,
    icon:      '📖',
    name:      'Tome I — Foundation',
    desc:      '+80 gold',
    apply(s) {
      s.resources.gold = Math.min(s.caps.gold ?? 500, (s.resources.gold ?? 0) + 80);
    },
  },
  {
    id:        'tome_ii',
    threshold: 25,
    icon:      '📜',
    name:      'Tome II — Commerce',
    desc:      '+0.25 gold/s permanently',
    apply(s) {
      s.codex.codexGoldRate = (s.codex.codexGoldRate ?? 0) + 0.25;
    },
  },
  {
    id:        'tome_iii',
    threshold: 50,
    icon:      '📚',
    name:      'Tome III — Virtue',
    desc:      '+8 morale permanently',
    apply(_s) {
      changeMorale(8, 'Imperial Codex milestone');
    },
  },
  {
    id:        'tome_iv',
    threshold: 75,
    icon:      '🔮',
    name:      'Tome IV — Arcane',
    desc:      '+25 mana cap · +50 prestige',
    apply(s) {
      s.caps.mana = (s.caps.mana ?? 200) + 25;
      awardPrestige(50, 'Imperial Codex milestone');
    },
  },
  {
    id:        'tome_v',
    threshold: 100,
    icon:      '⚜️',
    name:      'Tome V — Prosperity',
    desc:      '+1.0 gold/s permanently',
    apply(s) {
      s.codex.codexGoldRate = (s.codex.codexGoldRate ?? 0) + 1.0;
    },
  },
  {
    id:        'tome_vi',
    threshold: 150,
    icon:      '🌟',
    name:      'Grand Codex — Legacy',
    desc:      '+15% all building production',
    apply(s) {
      s.codex.codexProdMult = 1.15;
    },
  },
];

// ── Initialization ─────────────────────────────────────────────────────────

let _initialized = false;
let _prevTechCount = 0;
let _prevChainsDone = 0;

export function initCodex() {
  if (!state.codex) {
    state.codex = {
      fragments:     0,
      milestones:    [],
      codexGoldRate: 0,
      codexProdMult: 1.0,
    };
  } else {
    if (!state.codex.milestones)    state.codex.milestones    = [];
    if (!state.codex.codexGoldRate) state.codex.codexGoldRate = 0;
    if (!state.codex.codexProdMult) state.codex.codexProdMult = 1.0;
  }

  _prevTechCount   = Object.keys(state.techs ?? {}).length;
  _prevChainsDone  = _countChainsDone();

  if (!_initialized) {
    _initialized = true;
    on(Events.MAP_CHANGED,           _onMapChanged);
    on(Events.QUEST_COMPLETED,       _onQuestCompleted);
    on(Events.TECH_CHANGED,          _onTechChanged);
    on(Events.AGE_CHANGED,           _onAgeChanged);
    on(Events.ACHIEVEMENT_UNLOCKED,  _onAchievement);
    on(Events.OMEN_AVERTED,          () => _addFragments(2, 'omen averted'));
    on(Events.OMEN_CHANNELED,        () => _addFragments(2, 'omen channeled'));
    on(Events.EPIC_QUEST_PROGRESS,   _onEpicQuestProgress);
  }
}

// ── Fragment Award Helpers ─────────────────────────────────────────────────

function _addFragments(count, source) {
  if (!state.codex) return;
  state.codex.fragments = (state.codex.fragments ?? 0) + count;
  _checkMilestones();
  emit(Events.CODEX_MILESTONE, { source, count, total: state.codex.fragments });
}

function _checkMilestones() {
  const c = state.codex;
  for (const ms of CODEX_MILESTONES) {
    if (c.milestones.includes(ms.id)) continue;
    if (c.fragments >= ms.threshold) {
      c.milestones.push(ms.id);
      ms.apply(state);
      recalcRates();
      addMessage(
        `📖 Imperial Codex: "${ms.name}" unlocked — ${ms.desc}!`,
        'windfall',
      );
      emit(Events.RESOURCE_CHANGED, {});
    }
  }
}

// ── Event Handlers ─────────────────────────────────────────────────────────

function _onMapChanged(data) {
  if (data?.outcome === 'victory') _addFragments(1, 'combat victory');
}

function _onQuestCompleted() {
  _addFragments(3, 'quest completed');
}

function _onTechChanged() {
  const newCount = Object.keys(state.techs ?? {}).length;
  if (newCount > _prevTechCount) {
    const gained = newCount - _prevTechCount;
    _addFragments(gained * 2, 'technology researched');
  }
  _prevTechCount = newCount;
}

function _onAgeChanged() {
  _addFragments(10, 'age advanced');
}

function _onAchievement() {
  _addFragments(5, 'achievement unlocked');
}

function _onEpicQuestProgress(data) {
  if (data?.completed) _addFragments(8, 'epic quest chain completed');
}

// ── Helpers ────────────────────────────────────────────────────────────────

function _countChainsDone() {
  const chains = state.epicQuests?.chains ?? {};
  return Object.values(chains).filter(c => c.completed).length;
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Returns codex info for UI rendering. */
export function getCodexInfo() {
  const c = state.codex;
  if (!c) return null;

  const next = CODEX_MILESTONES.find(ms => !c.milestones.includes(ms.id));
  return {
    fragments:     c.fragments ?? 0,
    milestones:    c.milestones ?? [],
    codexGoldRate: c.codexGoldRate ?? 0,
    codexProdMult: c.codexProdMult ?? 1.0,
    nextMilestone: next ?? null,
    allDone:       !next,
  };
}
