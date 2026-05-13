/**
 * EmpireOS — Nomadic Scholar (T260).
 *
 * Every 15–20 minutes (Iron Age+, 10+ player tiles), a wandering scholar
 * carrying ancient manuscripts arrives at the imperial court seeking patronage.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   📚 Commission Studies  — pay 35 mana → +0.1 iron/s for 2 min + 25 prestige
 *                             (scholar reveals metallurgical and engineering secrets)
 *   📜 Purchase Manuscripts — pay 30 gold → +0.08 mana/s for 3 min + 20 prestige
 *                              (ancient texts unlock arcane knowledge)
 *   👋 Thank and Dismiss   — free → +8 morale + 5 prestige
 *                             (the scholar departs with the empire's gratitude)
 *
 * state.nomadicScholar = {
 *   active:            { expiresAt: tick } | null,
 *   nextSpawnTick:     tick,
 *   totalEncounters:   number,
 *   totalCommissioned: number,
 *   totalPurchased:    number,
 *   totalDismissed:    number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Constants ──────────────────────────────────────────────────────────────

const SPAWN_MIN        = 15 * 60 * TICKS_PER_SECOND; // 15 min
const SPAWN_RANGE      = 5  * 60 * TICKS_PER_SECOND; // +0–5 min jitter
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;       // 80-second decision window
const MIN_AGE          = 2;                            // Iron Age
const MIN_PLAYER_TILES = 10;

export const COMMISSION_MANA_COST      = 35;
export const COMMISSION_IRON_RATE      = 0.1; // +0.1 iron/s
export const COMMISSION_DURATION_TICKS = 2 * 60 * TICKS_PER_SECOND; // 2 min
export const COMMISSION_PRESTIGE       = 25;

export const PURCHASE_GOLD_COST        = 30;
export const PURCHASE_MANA_RATE        = 0.08; // +0.08 mana/s
export const PURCHASE_DURATION_TICKS   = 3 * 60 * TICKS_PER_SECOND; // 3 min
export const PURCHASE_PRESTIGE         = 20;

export const DISMISS_MORALE_REWARD     = 8;
export const DISMISS_PRESTIGE_REWARD   = 5;

// ── Init ──────────────────────────────────────────────────────────────────

export function initNomadicScholar() {
  if (!state.nomadicScholar) {
    state.nomadicScholar = {
      active:            null,
      nextSpawnTick:     _nextSpawnTick(),
      totalEncounters:   0,
      totalCommissioned: 0,
      totalPurchased:    0,
      totalDismissed:    0,
    };
  }
  if (state.nomadicScholar.nextSpawnTick     === undefined) state.nomadicScholar.nextSpawnTick     = _nextSpawnTick();
  if (state.nomadicScholar.totalEncounters   === undefined) state.nomadicScholar.totalEncounters   = 0;
  if (state.nomadicScholar.totalCommissioned === undefined) state.nomadicScholar.totalCommissioned = 0;
  if (state.nomadicScholar.totalPurchased    === undefined) state.nomadicScholar.totalPurchased    = 0;
  if (state.nomadicScholar.totalDismissed    === undefined) state.nomadicScholar.totalDismissed    = 0;
}

// ── Tick ──────────────────────────────────────────────────────────────────

export function nomadicScholarTick() {
  const ns = state.nomadicScholar;
  if (!ns) return;

  // Expire active window
  if (ns.active) {
    if (state.tick >= ns.active.expiresAt) {
      ns.active          = null;
      ns.nextSpawnTick   = _nextSpawnTick();
      ns.totalDismissed  = (ns.totalDismissed ?? 0) + 1;
      emit(Events.NOMADIC_SCHOLAR_CHANGED, { expired: true });
      addMessage('📚 The nomadic scholar packs their manuscripts and departs, finding no patron in the empire.', 'info');
    }
    return;
  }

  if (state.tick < ns.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;

  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) {
    for (const tile of row) {
      if (tile.owner === 'player') playerTiles++;
    }
  }
  if (playerTiles < MIN_PLAYER_TILES) return;

  ns.active          = { expiresAt: state.tick + WINDOW_TICKS };
  ns.totalEncounters = (ns.totalEncounters ?? 0) + 1;

  emit(Events.NOMADIC_SCHOLAR_CHANGED, { spawned: true });
  addMessage('📚 A nomadic scholar bearing ancient manuscripts has arrived at the imperial court seeking a patron! Respond within 80 seconds.', 'info');
}

// ── Public API ─────────────────────────────────────────────────────────────

export function getActiveNomadicScholar() {
  return state.nomadicScholar?.active ?? null;
}

export function getNomadicScholarSecsLeft() {
  const a = state.nomadicScholar?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

/**
 * Commission Studies — pay 35 mana; +0.1 iron/s for 2 min + 25 prestige.
 */
export function commissionScholarStudies() {
  const ns = state.nomadicScholar;
  if (!ns?.active) return { ok: false, reason: 'No scholar present.' };
  if (state.tick >= ns.active.expiresAt) return { ok: false, reason: 'The scholar has departed.' };
  if ((state.resources.mana ?? 0) < COMMISSION_MANA_COST) {
    return { ok: false, reason: `Need ${COMMISSION_MANA_COST} mana.` };
  }

  state.resources.mana -= COMMISSION_MANA_COST;
  awardPrestige(COMMISSION_PRESTIGE, 'Commissioned a nomadic scholar to reveal metallurgical secrets');

  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'scholarCommission');
    state.randomEvents.activeModifiers.push({
      id:        'scholarCommission',
      resource:  'iron',
      rateMult:  1 + (COMMISSION_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }

  ns.active            = null;
  ns.nextSpawnTick     = _nextSpawnTick();
  ns.totalCommissioned = (ns.totalCommissioned ?? 0) + 1;

  emit(Events.NOMADIC_SCHOLAR_CHANGED, { commissioned: true });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📚 The scholar reveals ancient metallurgical techniques! +${COMMISSION_PRESTIGE} prestige. Imperial forges surge: +${COMMISSION_IRON_RATE} iron/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

/**
 * Purchase Manuscripts — pay 30 gold; +0.08 mana/s for 3 min + 20 prestige.
 */
export function purchaseScholarManuscripts() {
  const ns = state.nomadicScholar;
  if (!ns?.active) return { ok: false, reason: 'No scholar present.' };
  if (state.tick >= ns.active.expiresAt) return { ok: false, reason: 'The scholar has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) {
    return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  }

  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE, 'Purchased ancient manuscripts from a nomadic scholar');

  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'scholarManuscripts');
    state.randomEvents.activeModifiers.push({
      id:        'scholarManuscripts',
      resource:  'mana',
      rateMult:  1 + (PURCHASE_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }

  ns.active          = null;
  ns.nextSpawnTick   = _nextSpawnTick();
  ns.totalPurchased  = (ns.totalPurchased ?? 0) + 1;

  emit(Events.NOMADIC_SCHOLAR_CHANGED, { purchased: true });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 Ancient arcane texts fill the imperial library! +${PURCHASE_PRESTIGE} prestige. Mana wells respond: +${PURCHASE_MANA_RATE} mana/s for 3 minutes.`, 'windfall');
  return { ok: true };
}

/**
 * Thank and Dismiss — free; +8 morale + 5 prestige.
 */
export function dismissScholarGracefully() {
  const ns = state.nomadicScholar;
  if (!ns?.active) return { ok: false, reason: 'No scholar present.' };

  awardPrestige(DISMISS_PRESTIGE_REWARD, 'Graciously thanked a nomadic scholar at the imperial court');
  changeMorale(DISMISS_MORALE_REWARD);

  ns.active         = null;
  ns.nextSpawnTick  = _nextSpawnTick();
  ns.totalDismissed = (ns.totalDismissed ?? 0) + 1;

  emit(Events.NOMADIC_SCHOLAR_CHANGED, { dismissed: true });
  addMessage(`👋 The scholar departs with the empire's warmest regards. +${DISMISS_PRESTIGE_REWARD} prestige, +${DISMISS_MORALE_REWARD} morale.`, 'windfall');
  return { ok: true };
}

// ── Internal helpers ──────────────────────────────────────────────────────

function _nextSpawnTick() {
  return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE);
}
