/**
 * EmpireOS — Empire Decree System (T083).
 *
 * Decrees are player-activated strategic one-shots with per-decree cooldowns.
 *
 * state.decrees shape:
 *   {
 *     cooldowns:          { [decreeId]: tickWhenCooldownExpires },
 *     harvestEdictExpires: number,   // tick when harvest_edict ends (0 = inactive)
 *     warBannerCharges:    number,   // remaining war_banner combat charges (0 = inactive)
 *   }
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';
import { changeMorale } from './morale.js';
import { recalcRates } from './resources.js';
import { UNITS } from '../data/units.js';
import { DECREES } from '../data/decrees.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const EMERGENCY_LEVY_GOLD  = 200;
const EMERGENCY_LEVY_FOOD  = 100;
const EMERGENCY_LEVY_MORALE = -5;
const SCHOLARS_EDICT_REDUCTION = 480;  // 2 minutes in ticks

// ── Init ──────────────────────────────────────────────────────────────────

/**
 * Called during boot and New Game.  Idempotent — leaves existing save intact.
 */
export function initDecrees() {
  if (!state.decrees) {
    state.decrees = {
      cooldowns:           {},
      harvestEdictExpires: 0,
      warBannerCharges:    0,
    };
  } else {
    // Migration guard for older saves
    if (!state.decrees.cooldowns)           state.decrees.cooldowns           = {};
    if (!state.decrees.harvestEdictExpires) state.decrees.harvestEdictExpires = 0;
    if (!state.decrees.warBannerCharges)    state.decrees.warBannerCharges    = 0;
  }
}

// ── Tick ─────────────────────────────────────────────────────────────────

/**
 * Registered as a tick system.
 * Expires the harvest_edict timed effect and notifies the UI.
 */
export function decreesTick() {
  const d = state.decrees;
  if (!d) return;

  // Expire harvest_edict effect
  if (d.harvestEdictExpires > 0 && state.tick >= d.harvestEdictExpires) {
    d.harvestEdictExpires = 0;
    recalcRates();
    addMessage('🌾 Harvest Edict has ended — rates returned to normal.', 'info');
    emit(Events.DECREE_USED, { id: 'harvest_edict', phase: 'expired' });
  }
}

// ── Public helpers ────────────────────────────────────────────────────────

/**
 * Returns seconds until the decree is ready again (0 if ready now).
 */
export function getDecreeSecsLeft(id) {
  const expiry = state.decrees?.cooldowns?.[id] ?? 0;
  if (state.tick >= expiry) return 0;
  return Math.ceil((expiry - state.tick) / TICKS_PER_SECOND);
}

/**
 * Returns true if harvest_edict is currently active.
 */
export function isHarvestEdictActive() {
  return (state.decrees?.harvestEdictExpires ?? 0) > state.tick;
}

/**
 * Returns remaining war_banner charges (0 = inactive).
 */
export function getWarBannerCharges() {
  return state.decrees?.warBannerCharges ?? 0;
}

// ── canUseDecree ──────────────────────────────────────────────────────────

/**
 * Returns { ok: true } or { ok: false, reason: string }.
 */
export function canUseDecree(id) {
  const def = DECREES.find(d => d.id === id);
  if (!def) return { ok: false, reason: 'Unknown decree.' };

  initDecrees();
  const d = state.decrees;

  // Cooldown check
  const expiry = d.cooldowns[id] ?? 0;
  if (state.tick < expiry) {
    const secs = Math.ceil((expiry - state.tick) / TICKS_PER_SECOND);
    return { ok: false, reason: `On cooldown — ready in ${secs}s.` };
  }

  // Resource cost check
  for (const [res, amount] of Object.entries(def.cost ?? {})) {
    if ((state.resources[res] ?? 0) < amount) {
      return { ok: false, reason: `Need ${amount} ${res}.` };
    }
  }

  // Special per-decree checks
  if (id === 'scholars_edict' && (state.researchQueue?.length ?? 0) === 0) {
    return { ok: false, reason: 'No research in progress.' };
  }

  return { ok: true };
}

// ── useDecree ─────────────────────────────────────────────────────────────

/**
 * Attempt to activate a decree.
 * Returns { ok: boolean, reason?: string }.
 */
export function useDecree(id) {
  const check = canUseDecree(id);
  if (!check.ok) return check;

  const def = DECREES.find(d => d.id === id);
  const d   = state.decrees;

  // Deduct costs
  for (const [res, amount] of Object.entries(def.cost ?? {})) {
    state.resources[res] -= amount;
  }

  // Set cooldown
  d.cooldowns[id] = state.tick + def.cooldownTicks;

  // Apply effect
  switch (id) {
    case 'conscription':
      _applyConscription();
      break;
    case 'emergency_levy':
      _applyEmergencyLevy();
      break;
    case 'harvest_edict':
      _applyHarvestEdict(def);
      break;
    case 'war_banner':
      _applyWarBanner(def);
      break;
    case 'scholars_edict':
      _applyScholarsEdict();
      break;
  }

  emit(Events.DECREE_USED, { id, phase: 'activated' });
  emit(Events.RESOURCE_CHANGED, {});
  return { ok: true };
}

// ── Effect helpers ────────────────────────────────────────────────────────

function _applyConscription() {
  const soldier = UNITS['soldier'];
  const archer  = UNITS['archer'];

  state.units['soldier'] = (state.units['soldier'] ?? 0) + 5;
  state.units['archer']  = (state.units['archer']  ?? 0) + 3;
  recalcRates();

  addMessage(
    `⚔️ Conscription enacted — 5 ${soldier?.name ?? 'Infantry'} and ` +
    `3 ${archer?.name ?? 'Archers'} report for duty!`,
    'unit',
  );
  emit(Events.UNIT_CHANGED, {});
}

function _applyEmergencyLevy() {
  state.resources.gold = Math.min(
    state.caps.gold,
    (state.resources.gold ?? 0) + EMERGENCY_LEVY_GOLD,
  );
  state.resources.food = Math.min(
    state.caps.food,
    (state.resources.food ?? 0) + EMERGENCY_LEVY_FOOD,
  );
  changeMorale(EMERGENCY_LEVY_MORALE);

  addMessage(
    `💰 Emergency Levy collected — +${EMERGENCY_LEVY_GOLD} gold, ` +
    `+${EMERGENCY_LEVY_FOOD} food. Citizens grumble (morale ${EMERGENCY_LEVY_MORALE}).`,
    'windfall',
  );
}

function _applyHarvestEdict(def) {
  state.decrees.harvestEdictExpires = state.tick + def.durationTicks;
  recalcRates();

  addMessage(
    '🌾 Harvest Edict proclaimed — food and wood production +40% for 2 minutes!',
    'windfall',
  );
}

function _applyWarBanner(def) {
  state.decrees.warBannerCharges = def.charges;

  addMessage(
    `🚩 War Banner raised — next ${def.charges} battles deal +40% attack power!`,
    'unit',
  );
}

function _applyScholarsEdict() {
  const q = state.researchQueue;
  if (!q?.length) return;

  const reduction = Math.min(q[0].remaining, SCHOLARS_EDICT_REDUCTION);
  q[0].remaining -= reduction;

  const minsSaved = Math.round(reduction / TICKS_PER_SECOND / 60);
  addMessage(
    `📚 Scholar's Edict — current research accelerated by ~${minsSaved} minute(s)!`,
    'tech',
  );
  emit(Events.TECH_CHANGED, {});
}
