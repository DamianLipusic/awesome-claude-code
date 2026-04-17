/**
 * EmpireOS — Alliance Military Aid system (T102).
 *
 * Allied empires can send temporary troop reinforcements to assist the player.
 * Aid troops fight alongside the player's army for AID_BATTLES battles then depart.
 * Each empire has a per-request cooldown of AID_COOLDOWN_TICKS (15 minutes).
 * Requesting aid costs AID_COST gold.
 */

import { state }        from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { EMPIRES }      from '../data/empires.js';
import { addMessage }   from '../core/actions.js';

export const AID_COST           = 80;    // gold cost to call for aid
export const AID_BATTLES        = 5;     // battles before troops return home
export const AID_COOLDOWN_TICKS = 3600;  // 15 minutes (4 ticks/s × 60s × 15)

function _guard() {
  if (!state.militaryAid) state.militaryAid = { cooldowns: {}, active: null };
}

export function initMilitaryAid() {
  _guard();
  // migration: ensure cooldowns object exists for older saves
  if (!state.militaryAid.cooldowns) state.militaryAid.cooldowns = {};
}

/**
 * Check whether the player can request military aid from the given empire.
 * Returns { ok: true } or { ok: false, reason: string }.
 */
export function canRequestAid(empireId) {
  _guard();

  const emp = state.diplomacy?.empires.find(e => e.id === empireId);
  if (!emp || emp.relations !== 'allied') {
    return { ok: false, reason: 'Not allied with this empire.' };
  }

  if ((state.resources.gold ?? 0) < AID_COST) {
    return { ok: false, reason: `Need ${AID_COST} gold.` };
  }

  const cd = state.militaryAid.cooldowns[empireId] ?? 0;
  if (state.tick < cd) {
    const secs = Math.ceil((cd - state.tick) / 4);
    return { ok: false, reason: `Cooldown: ${secs}s remaining.` };
  }

  if (state.militaryAid.active?.empireId === empireId) {
    return { ok: false, reason: 'Aid from this empire already active.' };
  }

  return { ok: true };
}

/**
 * Request military aid from an allied empire.
 * Deducts gold, creates active aid entry, starts cooldown.
 */
export function requestMilitaryAid(empireId) {
  const check = canRequestAid(empireId);
  if (!check.ok) return check;

  const empire = EMPIRES[empireId];
  if (!empire) return { ok: false, reason: 'Unknown empire.' };

  state.resources.gold -= AID_COST;

  // Resolve aid unit counts
  const aidUnits = {};
  for (const { unitId, count } of (empire.aidUnits ?? [])) {
    aidUnits[unitId] = (aidUnits[unitId] ?? 0) + count;
  }

  state.militaryAid.active = {
    empireId,
    units: aidUnits,
    battlesLeft: AID_BATTLES,
  };
  state.militaryAid.cooldowns[empireId] = state.tick + AID_COOLDOWN_TICKS;

  const unitList = Object.entries(aidUnits).map(([id, c]) => `${c}× ${id}`).join(', ');
  addMessage(
    `${empire.icon} ${empire.name} sends military aid: ${unitList} for ${AID_BATTLES} battles!`,
    'windfall',
  );

  emit(Events.MILITARY_AID_CHANGED, { empireId, active: true, battlesLeft: AID_BATTLES });
  emit(Events.RESOURCE_CHANGED, {});
  return { ok: true };
}

/**
 * Called after each combat resolution to consume one aid battle.
 * When battlesLeft reaches 0 the aid expires.
 */
export function consumeAidBattle() {
  _guard();
  if (!state.militaryAid.active) return;

  state.militaryAid.active.battlesLeft--;
  const left = state.militaryAid.active.battlesLeft;

  if (left <= 0) {
    const empire = EMPIRES[state.militaryAid.active.empireId];
    addMessage(
      `${empire?.icon ?? '⚔️'} ${empire?.name ?? 'Allied'} troops have returned home after ${AID_BATTLES} battles.`,
      'info',
    );
    state.militaryAid.active = null;
    emit(Events.MILITARY_AID_CHANGED, { active: false });
  } else {
    emit(Events.MILITARY_AID_CHANGED, { active: true, battlesLeft: left });
  }
}

/** Returns the active aid entry or null. */
export function getActiveAid() {
  _guard();
  return state.militaryAid.active ?? null;
}

/** Returns seconds remaining on cooldown for the given empire (0 if ready). */
export function getAidCooldownSecs(empireId) {
  _guard();
  const cd = state.militaryAid.cooldowns[empireId] ?? 0;
  return Math.max(0, Math.ceil((cd - state.tick) / 4));
}
