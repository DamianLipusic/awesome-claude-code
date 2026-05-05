/**
 * T205: Battle Standard System
 *
 * A unique military banner that grants one unit type +20% attack power.
 * Cost to acquire: 150 gold + 50 iron.
 * Reassigning to a different unit costs 50 gold with a 3-minute cooldown.
 *
 * state.battleStandard = {
 *   equippedUnit: string | null,   // unit type bearing the standard
 *   transferCooldownUntil: tick,   // tick when reassignment is available again
 *   totalTransfers: number,
 * } | null
 */

import { state }    from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';

export const STANDARD_COST = { gold: 150, iron: 50 };
export const TRANSFER_COST = { gold: 50 };
export const STANDARD_BONUS = 0.20;            // +20% attack for the bearer unit type
export const TRANSFER_COOLDOWN_TICKS = 720;    // 3 minutes

export function initBattleStandard() {
  if (!state.battleStandard) {
    state.battleStandard = {
      equippedUnit:           null,
      transferCooldownUntil:  0,
      totalTransfers:         0,
    };
  }
}

/** Returns the current battleStandard state or a safe default. */
export function getBattleStandard() {
  return state.battleStandard ?? { equippedUnit: null, transferCooldownUntil: 0, totalTransfers: 0 };
}

/** How many seconds until reassignment cooldown clears (0 = ready). */
export function standardTransferSecs() {
  const bs = getBattleStandard();
  const remaining = Math.max(0, bs.transferCooldownUntil - state.tick);
  return Math.ceil(remaining / 4);  // 4 ticks/s
}

/**
 * Assign the battle standard to a unit type.
 * First assignment requires full STANDARD_COST.
 * Subsequent reassignments require TRANSFER_COST + cooldown.
 *
 * Returns { ok: bool, reason?: string }
 */
export function assignBattleStandard(unitId) {
  if (!state.battleStandard) initBattleStandard();

  const bs  = state.battleStandard;
  const res = state.resources;

  if ((state.units[unitId] ?? 0) <= 0) {
    return { ok: false, reason: 'You need at least 1 of that unit type!' };
  }

  if (bs.equippedUnit === unitId) {
    return { ok: false, reason: 'That unit already bears the standard.' };
  }

  const isFirstAssign = bs.equippedUnit === null;

  if (isFirstAssign) {
    // First assignment — pay full cost
    if (res.gold < STANDARD_COST.gold) return { ok: false, reason: `Need ${STANDARD_COST.gold} gold.` };
    if (res.iron < STANDARD_COST.iron) return { ok: false, reason: `Need ${STANDARD_COST.iron} iron.` };
    res.gold -= STANDARD_COST.gold;
    res.iron -= STANDARD_COST.iron;
    bs.equippedUnit = unitId;
    addMessage(`🚩 Battle Standard raised with ${unitId}s! +${Math.round(STANDARD_BONUS * 100)}% attack.`, 'achievement');
  } else {
    // Reassignment — requires cooldown + gold
    if (state.tick < bs.transferCooldownUntil) {
      return { ok: false, reason: `Standard on cooldown for ${standardTransferSecs()}s.` };
    }
    if (res.gold < TRANSFER_COST.gold) return { ok: false, reason: `Need ${TRANSFER_COST.gold} gold to reassign.` };
    res.gold -= TRANSFER_COST.gold;
    const oldUnit = bs.equippedUnit;
    bs.equippedUnit = unitId;
    bs.transferCooldownUntil = state.tick + TRANSFER_COOLDOWN_TICKS;
    bs.totalTransfers += 1;
    addMessage(`🚩 Battle Standard transferred from ${oldUnit} to ${unitId}s.`, 'info');
  }

  emit(Events.STANDARD_CHANGED, { equippedUnit: unitId });
  emit(Events.RESOURCE_CHANGED, {});
  return { ok: true };
}
