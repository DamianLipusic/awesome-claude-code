/**
 * EmpireOS — Epic Quest Chains (T202).
 *
 * Three multi-step quest chains that track narrative progress across the game.
 * Completing an entire chain grants a permanent empire-wide bonus.
 *
 * Chains:
 *   conqueror  "The Conqueror's Legacy"  — 5 steps; reward: +15% combat power
 *   scholar    "The Scholar's Codex"     — 5 steps; reward: -15% research time
 *   merchant   "The Merchant Prince"     — 5 steps; reward: +1.5 gold/s
 *
 * Each chain advances one step at a time (steps must be completed in order).
 * Progress is checked on every tick (every 250 ms) for active steps only.
 *
 * State shape:
 *   state.epicQuests = {
 *     chains: {
 *       conqueror: { step: 0-5, completed: bool },
 *       scholar:   { step: 0-5, completed: bool },
 *       merchant:  { step: 0-5, completed: bool },
 *     },
 *     bonuses: { conqueror: bool, scholar: bool, merchant: bool },
 *   } | null
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { awardPrestige }    from './prestige.js';

// ── Chain definitions ──────────────────────────────────────────────────────

export const EPIC_CHAINS = Object.freeze({
  conqueror: {
    id:       'conqueror',
    icon:     '⚔️',
    name:     "The Conqueror's Legacy",
    rewardDesc: '+15% permanent combat power',
    steps: [
      { label: 'Capture your first enemy tile',         check: s => _playerTiles(s) >= 2 },
      { label: 'Command an army of 10+ units',          check: s => _totalUnits(s) >= 10 },
      { label: 'Win 5 battles',                         check: s => _battleWins(s) >= 5 },
      { label: 'Advance to the Bronze Age',             check: s => (s.age ?? 0) >= 1 },
      { label: 'Conquer 50 territory tiles',            check: s => _playerTiles(s) >= 50 },
    ],
  },
  scholar: {
    id:       'scholar',
    icon:     '🔬',
    name:     "The Scholar's Codex",
    rewardDesc: '−15% permanent research time',
    steps: [
      { label: 'Research your first technology',        check: s => Object.keys(s.techs ?? {}).length >= 1 },
      { label: 'Research 5 technologies',               check: s => Object.keys(s.techs ?? {}).length >= 5 },
      { label: 'Advance to the Iron Age',               check: s => (s.age ?? 0) >= 2 },
      { label: 'Research 10 technologies',              check: s => Object.keys(s.techs ?? {}).length >= 10 },
      { label: 'Master all 16 technologies',            check: s => Object.keys(s.techs ?? {}).length >= 16 },
    ],
  },
  merchant: {
    id:       'merchant',
    icon:     '💰',
    name:     'The Merchant Prince',
    rewardDesc: '+1.5 gold/s permanent income',
    steps: [
      { label: 'Open your first trade route',           check: s => _tradeRoutes(s) >= 1 },
      { label: 'Earn 1,000 total gold',                 check: s => (s.stats?.goldEarned ?? 0) >= 1_000 },
      { label: 'Open 3 trade routes simultaneously',    check: s => _tradeRoutes(s) >= 3 },
      { label: 'Earn 10,000 total gold',                check: s => (s.stats?.goldEarned ?? 0) >= 10_000 },
      { label: 'Earn 30,000 total gold',                check: s => (s.stats?.goldEarned ?? 0) >= 30_000 },
    ],
  },
});

export const CHAIN_ORDER = ['conqueror', 'scholar', 'merchant'];

// ── State helpers ──────────────────────────────────────────────────────────

function _playerTiles(s) {
  if (!s.map) return 0;
  let n = 0;
  for (const row of s.map.tiles)
    for (const t of row) if (t.owner === 'player') n++;
  return n;
}

function _totalUnits(s) {
  return Object.values(s.units ?? {}).reduce((a, v) => a + (v || 0), 0);
}

function _battleWins(s) {
  return (s.combatHistory ?? []).filter(b => b.outcome === 'win').length;
}

function _tradeRoutes(s) {
  if (!s.diplomacy?.empires) return 0;
  return s.diplomacy.empires.reduce((a, e) => a + (e.tradeRoutes || 0), 0);
}

// ── Init ───────────────────────────────────────────────────────────────────

export function initEpicQuests() {
  if (!state.epicQuests) {
    state.epicQuests = {
      chains: {
        conqueror: { step: 0, completed: false },
        scholar:   { step: 0, completed: false },
        merchant:  { step: 0, completed: false },
      },
      bonuses: { conqueror: false, scholar: false, merchant: false },
    };
  } else {
    // Migrate older saves
    for (const id of CHAIN_ORDER) {
      if (!state.epicQuests.chains[id]) {
        state.epicQuests.chains[id] = { step: 0, completed: false };
      }
      if (state.epicQuests.bonuses[id] === undefined) {
        state.epicQuests.bonuses[id] = false;
      }
    }
  }
}

// ── Tick ───────────────────────────────────────────────────────────────────

export function epicQuestsTick() {
  if (!state.epicQuests) return;
  let changed = false;

  for (const id of CHAIN_ORDER) {
    const chain    = EPIC_CHAINS[id];
    const progress = state.epicQuests.chains[id];
    if (progress.completed) continue;

    const currentStep = progress.step;
    if (currentStep >= chain.steps.length) {
      // All steps done — award bonus
      _completeChain(id);
      changed = true;
      continue;
    }

    if (chain.steps[currentStep].check(state)) {
      progress.step++;
      changed = true;

      if (progress.step >= chain.steps.length) {
        _completeChain(id);
      } else {
        const nextStep = chain.steps[progress.step];
        addMessage(
          `${chain.icon} ${chain.name}: Step ${progress.step}/${chain.steps.length} — "${nextStep.label}"`,
          'epic-quest',
        );
        emit(Events.EPIC_QUEST_PROGRESS, { chainId: id, step: progress.step });
      }
    }
  }
}

function _completeChain(id) {
  const chain    = EPIC_CHAINS[id];
  const progress = state.epicQuests.chains[id];
  if (progress.completed) return;

  progress.completed               = true;
  state.epicQuests.bonuses[id]     = true;

  awardPrestige(75, `epic quest: ${chain.name}`);
  addMessage(
    `🏆 Epic Quest Complete: "${chain.name}" — ${chain.rewardDesc}!`,
    'epic-quest',
  );
  emit(Events.EPIC_QUEST_PROGRESS, { chainId: id, completed: true });
}

// ── Public getters ─────────────────────────────────────────────────────────

/** Progress fraction 0-1 for a given chain. */
export function getChainProgress(chainId) {
  const progress = state.epicQuests?.chains?.[chainId];
  if (!progress) return 0;
  return progress.step / EPIC_CHAINS[chainId].steps.length;
}
