/**
 * EmpireOS — War Trophy Collection (T226).
 *
 * Major military victories automatically add trophies to the War Trophy Vault.
 * Victory sources:
 *   - Warlord defeated  (WARLORD_DEFEATED)
 *   - Legendary creature defeated (LEGENDARY_CHANGED, action='defeated')
 *   - Campaign milestone reached  (CAMPAIGN_WON)
 *
 * Milestone bonuses:
 *   3+ trophies: +5% attack power permanently
 *   5  trophies: +5 morale (one-time on reaching this count)
 *   8+ trophies: +1 gold/s (applied in resources.js recalcRates)
 *
 * state.trophies = {
 *   list:           [{ type, name, icon, tick }],  // newest first
 *   moraleAwarded5: boolean,
 * }
 */

import { state }                from '../core/state.js';
import { emit, on, Events }     from '../core/events.js';
import { addMessage }           from '../core/actions.js';
import { changeMorale }         from './morale.js';
import { LEGENDARY_TYPES }      from './legendaryEncounters.js';
import { EMPIRES }              from '../data/empires.js';

// ── Milestone constants ────────────────────────────────────────────────────

export const TROPHY_ATTACK_THRESHOLD = 3;
export const TROPHY_ATTACK_MULT      = 1.05;   // +5% attack
export const TROPHY_MORALE_THRESHOLD = 5;
export const TROPHY_MORALE_BONUS     = 5;
export const TROPHY_GOLD_THRESHOLD   = 8;
export const TROPHY_GOLD_RATE        = 1.0;    // +1 gold/s (applied in resources.js)

// ── Init ──────────────────────────────────────────────────────────────────

export function initTrophies() {
  if (!state.trophies) {
    state.trophies = { list: [], moraleAwarded5: false };
  }
  if (!Array.isArray(state.trophies.list)) state.trophies.list = [];
  if (state.trophies.moraleAwarded5 === undefined) state.trophies.moraleAwarded5 = false;

  on(Events.WARLORD_DEFEATED,  _onWarlordDefeated);
  on(Events.LEGENDARY_CHANGED, _onLegendaryChanged);
  on(Events.CAMPAIGN_WON,      _onCampaignWon);
}

function _onWarlordDefeated(data) {
  _awardTrophy('warlord', data?.name ?? 'Unnamed Warlord', '⚔️');
}

function _onLegendaryChanged(data) {
  if (data?.action !== 'defeated') return;
  const typeKey = data?.type ?? 'dragon';
  const def     = LEGENDARY_TYPES?.[typeKey];
  _awardTrophy('legendary', def?.name ?? 'Legendary Creature', def?.icon ?? '🐉');
}

function _onCampaignWon(data) {
  const empireId = data?.empireId;
  const empire   = EMPIRES?.[empireId];
  const label    = empire ? `${empire.icon} ${empire.name}` : (empireId ?? 'enemy');
  _awardTrophy('campaign', `Campaign vs ${label}`, '🏆');
}

function _awardTrophy(type, name, icon) {
  if (!state.trophies) return;
  const t = state.trophies;

  t.list.unshift({ type, name, icon, tick: state.tick });
  const count = t.list.length;

  addMessage(`🏆 Trophy earned: ${icon} ${name} (${count} total)`, 'windfall');
  emit(Events.TROPHY_EARNED, { type, name, icon, count });

  // Milestone: 3 trophies → +5% attack
  if (count === TROPHY_ATTACK_THRESHOLD) {
    addMessage(
      `🏆 Trophy Milestone: ${TROPHY_ATTACK_THRESHOLD} Trophies — Your army fights with legendary resolve! +5% attack power.`,
      'windfall',
    );
  }

  // Milestone: 5 trophies → +5 morale (one-time)
  if (count >= TROPHY_MORALE_THRESHOLD && !t.moraleAwarded5) {
    t.moraleAwarded5 = true;
    changeMorale(TROPHY_MORALE_BONUS);
    addMessage(
      `🏆 Trophy Milestone: ${TROPHY_MORALE_THRESHOLD} Trophies — Troops inspired by the Vault of Glory! +${TROPHY_MORALE_BONUS} morale.`,
      'windfall',
    );
  }

  // Milestone: 8 trophies → +1 gold/s (passive, rates recalculated next tick)
  if (count === TROPHY_GOLD_THRESHOLD) {
    addMessage(
      `🏆 Trophy Milestone: ${TROPHY_GOLD_THRESHOLD} Trophies — Imperial fame attracts tribute from afar! +1 gold/s permanently.`,
      'windfall',
    );
    emit(Events.RESOURCE_CHANGED, {});
  }
}

// ── Accessors ─────────────────────────────────────────────────────────────

export function getTrophyCount() {
  return state.trophies?.list?.length ?? 0;
}

export function getTrophyAttackMult() {
  return getTrophyCount() >= TROPHY_ATTACK_THRESHOLD ? TROPHY_ATTACK_MULT : 1.0;
}

export function getTrophyGoldRate() {
  return getTrophyCount() >= TROPHY_GOLD_THRESHOLD ? TROPHY_GOLD_RATE : 0;
}
