/**
 * EmpireOS — Imperial Records Exchange (T239).
 *
 * Once per age (Iron Age+, requires 2+ allied empires), the player may initiate
 * an Imperial Records Exchange: share accumulated historical knowledge with allies
 * to gain a bundle of diplomatic resources.
 *
 * Requirements:
 *   - Iron Age (age ≥ 2)
 *   - 2 or more allied empires
 *   - Not already used this age
 *   - ≥ 60 gold  and  ≥ 40 mana
 *
 * Rewards on exchange:
 *   - −60 gold, −40 mana
 *   - +50 prestige, +10 morale
 *   - +80 food, +60 wood
 *
 * state.recordsExchange = {
 *   usedAtAge:      number,   // age index when last used (-1 = never)
 *   totalExchanges: number,
 * }
 */

import { state }         from '../core/state.js';
import { emit, Events }  from '../core/events.js';
import { addMessage }    from '../core/actions.js';
import { awardPrestige } from './prestige.js';
import { changeMorale }  from './morale.js';

// ── Constants ──────────────────────────────────────────────────────────────

export const EXCHANGE_MIN_AGE      = 2;      // Iron Age
export const EXCHANGE_MIN_ALLIES   = 2;
export const EXCHANGE_GOLD_COST    = 60;
export const EXCHANGE_MANA_COST    = 40;
export const EXCHANGE_FOOD_REWARD  = 80;
export const EXCHANGE_WOOD_REWARD  = 60;
export const EXCHANGE_PRESTIGE     = 50;
export const EXCHANGE_MORALE       = 10;

// ── Init ──────────────────────────────────────────────────────────────────

export function initRecordsExchange() {
  if (!state.recordsExchange) {
    state.recordsExchange = { usedAtAge: -1, totalExchanges: 0 };
  }
  if (state.recordsExchange.usedAtAge      === undefined) state.recordsExchange.usedAtAge      = -1;
  if (state.recordsExchange.totalExchanges === undefined) state.recordsExchange.totalExchanges = 0;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Returns { ok: true } if the exchange can be performed, or { ok: false, reason }.
 */
export function canExchange() {
  const rx = state.recordsExchange;
  if (!rx) return { ok: false, reason: 'System not initialised.' };

  if ((state.age ?? 0) < EXCHANGE_MIN_AGE) {
    return { ok: false, reason: `Requires Iron Age (Age ${EXCHANGE_MIN_AGE}+).` };
  }

  const allies = (state.diplomacy?.empires ?? []).filter(e => e.relations === 'allied').length;
  if (allies < EXCHANGE_MIN_ALLIES) {
    return { ok: false, reason: `Requires ${EXCHANGE_MIN_ALLIES} allied empires (currently ${allies}).` };
  }

  if (rx.usedAtAge === (state.age ?? 0)) {
    return { ok: false, reason: 'Already exchanged records this age.' };
  }

  if ((state.resources?.gold ?? 0) < EXCHANGE_GOLD_COST) {
    return { ok: false, reason: `Requires ${EXCHANGE_GOLD_COST} gold.` };
  }
  if ((state.resources?.mana ?? 0) < EXCHANGE_MANA_COST) {
    return { ok: false, reason: `Requires ${EXCHANGE_MANA_COST} mana.` };
  }

  return { ok: true };
}

/**
 * Perform the exchange. Returns { ok, reason? }.
 */
export function performExchange() {
  const check = canExchange();
  if (!check.ok) return check;

  const rx = state.recordsExchange;

  // Deduct costs
  state.resources.gold -= EXCHANGE_GOLD_COST;
  state.resources.mana -= EXCHANGE_MANA_COST;

  // Award food and wood (capped)
  state.resources.food = Math.min(state.caps.food ?? 500, (state.resources.food ?? 0) + EXCHANGE_FOOD_REWARD);
  state.resources.wood = Math.min(state.caps.wood ?? 500, (state.resources.wood ?? 0) + EXCHANGE_WOOD_REWARD);

  // Award prestige and morale
  awardPrestige(EXCHANGE_PRESTIGE, 'imperial records exchange');
  changeMorale(EXCHANGE_MORALE);

  // Mark used this age
  rx.usedAtAge      = state.age ?? 0;
  rx.totalExchanges = (rx.totalExchanges ?? 0) + 1;

  emit(Events.RECORDS_EXCHANGE_CHANGED, { performed: true });
  emit(Events.RESOURCE_CHANGED, {});

  addMessage(
    `📜 Imperial Records Exchange! Allies share knowledge: +${EXCHANGE_FOOD_REWARD} food, +${EXCHANGE_WOOD_REWARD} wood, +${EXCHANGE_PRESTIGE} prestige, +${EXCHANGE_MORALE} morale.`,
    'windfall',
  );

  return { ok: true };
}

/** Returns true if the exchange has been used in the current age. */
export function isExchangeUsedThisAge() {
  return (state.recordsExchange?.usedAtAge ?? -1) === (state.age ?? 0);
}
