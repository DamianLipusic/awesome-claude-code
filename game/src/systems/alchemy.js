/**
 * EmpireOS — Alchemy Workshop (T227).
 *
 * At Iron Age + alchemy tech, the Imperial Alchemist periodically offers to
 * transmute iron into mana. The offer window lasts 3 minutes; if ignored it
 * expires and the next offer is scheduled 12–15 minutes later.
 *
 * Success chance:
 *   - Base (1-2 arcane techs): 70% → 80 mana; 30% partial → 40 mana
 *   - High (all 3 arcane techs: arcane+alchemy+divine_favor): 90%/10%
 *
 * state.alchemy = {
 *   pending:         { expiresAt: tick } | null,
 *   nextOfferTick:   number,
 *   totalTransmuted: number,
 *   totalFailed:     number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Constants ─────────────────────────────────────────────────────────────────

export const ALCHEMY_IRON_COST    = 100;
export const ALCHEMY_MANA_SUCCESS = 80;
export const ALCHEMY_MANA_FAIL    = 40;
export const ALCHEMY_SUCCESS_BASE = 0.70;
export const ALCHEMY_SUCCESS_HIGH = 0.90;  // with all 3 arcane techs
export const ALCHEMY_MIN_AGE      = 2;     // Iron Age

const PENDING_TICKS = 3 * 60 * TICKS_PER_SECOND;   // 3 min window
const SPAWN_MIN     = 12 * 60 * TICKS_PER_SECOND;   // min 12 min between offers
const SPAWN_RANGE   = 3  * 60 * TICKS_PER_SECOND;   // + 0–3 min random

const ARCANE_TECHS = ['arcane', 'alchemy', 'divine_favor'];

// ── Init ──────────────────────────────────────────────────────────────────────

export function initAlchemy() {
  if (!state.alchemy) {
    state.alchemy = {
      pending:         null,
      nextOfferTick:   state.tick + SPAWN_MIN,
      totalTransmuted: 0,
      totalFailed:     0,
    };
  }
  if (state.alchemy.totalTransmuted === undefined) state.alchemy.totalTransmuted = 0;
  if (state.alchemy.totalFailed     === undefined) state.alchemy.totalFailed     = 0;
}

// ── Tick ──────────────────────────────────────────────────────────────────────

export function alchemyTick() {
  // Lazy-init after New Game
  if (!state.alchemy) initAlchemy();
  if (!isAlchemyUnlocked()) return;

  const a = state.alchemy;

  // Expire pending offer
  if (a.pending && state.tick >= a.pending.expiresAt) {
    a.pending       = null;
    a.nextOfferTick = state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE);
    emit(Events.ALCHEMY_CHANGED, { action: 'expired' });
    addMessage('⚗️ The Alchemist\'s transmutation offer has expired.', 'info');
    return;
  }

  // Spawn new offer
  if (!a.pending && state.tick >= a.nextOfferTick) {
    a.pending = { expiresAt: state.tick + PENDING_TICKS };
    emit(Events.ALCHEMY_CHANGED, { action: 'offered' });
    addMessage(
      `⚗️ Imperial Alchemist ready! Transmute ${ALCHEMY_IRON_COST} iron into mana — offer expires in 3 min.`,
      'info',
    );
  }
}

// ── Actions ───────────────────────────────────────────────────────────────────

export function acceptTransmutation() {
  if (!state.alchemy?.pending) return { ok: false, reason: 'No transmutation offer available.' };
  if (!isAlchemyUnlocked())    return { ok: false, reason: 'Requires Iron Age + Alchemy tech.' };
  if ((state.resources.iron ?? 0) < ALCHEMY_IRON_COST) {
    return { ok: false, reason: `Need ${ALCHEMY_IRON_COST} iron.` };
  }

  const a = state.alchemy;
  state.resources.iron -= ALCHEMY_IRON_COST;

  const success  = Math.random() < getSuccessChance();
  const manaGain = success ? ALCHEMY_MANA_SUCCESS : ALCHEMY_MANA_FAIL;
  state.resources.mana = Math.min(
    (state.resources.mana ?? 0) + manaGain,
    state.caps.mana ?? 500,
  );

  if (success) {
    a.totalTransmuted++;
    addMessage(`⚗️ Transmutation succeeded! +${manaGain} mana. (${a.totalTransmuted} total)`, 'windfall');
  } else {
    a.totalFailed++;
    addMessage(`⚗️ Transmutation partial — impurities in the iron. Only +${manaGain} mana recovered.`, 'info');
  }

  a.pending       = null;
  a.nextOfferTick = state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE);

  emit(Events.ALCHEMY_CHANGED, { action: 'completed', success, manaGain });
  emit(Events.RESOURCE_CHANGED, {});
  return { ok: true };
}

export function dismissTransmutation() {
  if (!state.alchemy?.pending) return;
  const a = state.alchemy;
  a.pending       = null;
  a.nextOfferTick = state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE);
  emit(Events.ALCHEMY_CHANGED, { action: 'dismissed' });
}

// ── Accessors ─────────────────────────────────────────────────────────────────

export function isAlchemyUnlocked() {
  return (state.age ?? 0) >= ALCHEMY_MIN_AGE && !!state.techs?.alchemy;
}

export function getSuccessChance() {
  const arcaneCount = ARCANE_TECHS.filter(id => !!state.techs?.[id]).length;
  return arcaneCount >= 3 ? ALCHEMY_SUCCESS_HIGH : ALCHEMY_SUCCESS_BASE;
}

export function getAlchemyPendingSecsLeft() {
  if (!state.alchemy?.pending) return 0;
  return Math.max(0, Math.ceil((state.alchemy.pending.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function getAlchemyNextSecs() {
  if (!state.alchemy || state.alchemy.pending) return 0;
  return Math.max(0, Math.ceil((state.alchemy.nextOfferTick - state.tick) / TICKS_PER_SECOND));
}
