/**
 * EmpireOS — Imperial Construction Drive (T221).
 *
 * At Bronze Age+, the player can launch an Imperial Construction Drive,
 * spending stone and wood to temporarily boost all resource production rates.
 *
 * Cost:     150 stone + 100 wood
 * Effect:   +20% to ALL resource production rates for 3 minutes
 * Cooldown: 12 minutes after expiry
 * Min Age:  Bronze (age ≥ 1)
 *
 * On completion: +5 morale (workers return proud of their output).
 *
 * state.constructionDrive = {
 *   active:        { expiresAt: number } | null,
 *   cooldownUntil: number,
 *   totalDrives:   number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from './morale.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Constants ──────────────────────────────────────────────────────────────

const DRIVE_DURATION   = 3  * 60 * TICKS_PER_SECOND; // 3 min
const COOLDOWN_TICKS   = 12 * 60 * TICKS_PER_SECOND; // 12 min
const MIN_AGE          = 1;                           // Bronze Age+

export const DRIVE_STONE_COST = 150;
export const DRIVE_WOOD_COST  = 100;
export const DRIVE_PROD_MULT  = 1.20; // +20% all production rates

// ── Init ──────────────────────────────────────────────────────────────────

export function initConstructionDrive() {
  if (!state.constructionDrive) {
    state.constructionDrive = {
      active:        null,
      cooldownUntil: 0,
      totalDrives:   0,
    };
  }
  if (state.constructionDrive.cooldownUntil === undefined) state.constructionDrive.cooldownUntil = 0;
  if (state.constructionDrive.totalDrives   === undefined) state.constructionDrive.totalDrives   = 0;
}

// ── Tick ──────────────────────────────────────────────────────────────────

export function constructionDriveTick() {
  if (!state.constructionDrive) return;
  const cd = state.constructionDrive;
  if (!cd.active) return;

  if (state.tick >= cd.active.expiresAt) {
    cd.active        = null;
    cd.cooldownUntil = state.tick + COOLDOWN_TICKS;
    changeMorale(+5);
    addMessage('🏗️ Imperial Construction Drive complete! Workers return to regular duties. (+5 morale)', 'event');
    emit(Events.CONSTRUCTION_DRIVE_CHANGED, { phase: 'ended' });
  }
}

// ── Launch ────────────────────────────────────────────────────────────────

/**
 * Launch an Imperial Construction Drive.
 * Returns { ok: true } or { ok: false, reason: string }.
 */
export function launchConstructionDrive() {
  if (!state.constructionDrive) return { ok: false, reason: 'System not ready.' };
  const cd = state.constructionDrive;

  if ((state.age ?? 0) < MIN_AGE)
    return { ok: false, reason: 'Requires Bronze Age.' };
  if (cd.active)
    return { ok: false, reason: 'A Construction Drive is already underway.' };
  if (state.tick < cd.cooldownUntil)
    return { ok: false, reason: 'Construction Drive on cooldown.' };
  if ((state.resources?.stone ?? 0) < DRIVE_STONE_COST)
    return { ok: false, reason: `Need ${DRIVE_STONE_COST} stone.` };
  if ((state.resources?.wood ?? 0) < DRIVE_WOOD_COST)
    return { ok: false, reason: `Need ${DRIVE_WOOD_COST} wood.` };

  state.resources.stone -= DRIVE_STONE_COST;
  state.resources.wood  -= DRIVE_WOOD_COST;

  cd.active = { expiresAt: state.tick + DRIVE_DURATION };
  cd.totalDrives++;

  addMessage(
    `🏗️ Imperial Construction Drive launched! All resource production +20% for 3 minutes. (${DRIVE_STONE_COST}🪨 ${DRIVE_WOOD_COST}🪵 consumed)`,
    'windfall',
  );
  emit(Events.CONSTRUCTION_DRIVE_CHANGED, { phase: 'started' });
  emit(Events.RESOURCE_CHANGED, {});
  return { ok: true };
}

// ── Accessors ─────────────────────────────────────────────────────────────

export function isDriveActive() {
  const cd = state.constructionDrive;
  if (!cd?.active) return false;
  return cd.active.expiresAt > state.tick;
}

export function getDriveSecsLeft() {
  const cd = state.constructionDrive;
  if (!cd?.active) return 0;
  return Math.max(0, Math.ceil((cd.active.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function getDriveCooldownSecs() {
  const cd = state.constructionDrive;
  if (!cd) return 0;
  return Math.max(0, Math.ceil((cd.cooldownUntil - state.tick) / TICKS_PER_SECOND));
}
