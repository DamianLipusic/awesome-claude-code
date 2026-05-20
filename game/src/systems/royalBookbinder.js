/**
 * EmpireOS — Royal Bookbinder (T340).
 *
 * Every 15–19 minutes (Medieval Age+, 10+ player tiles), a master royal
 * bookbinder arrives bearing tooled leather covers, gilded spine-plates,
 * fine parchment quires, and the expertise to bind illuminated codices
 * and imperial law books into lasting, magnificent volumes.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   📚 Commission Illuminated Binding — pay 25 mana + 20 gold
 *        → +0.25 mana/s for 2.5 min · +22 prestige · +8 morale
 *   🪨 Purchase Binding Materials    — pay 20 stone
 *        → +0.18 stone/s for 2 min   · +15 prestige
 *   🚶 Send Away                     — dismiss (no reward)
 *
 * state.royalBookbinder = {
 *   active:            { expiresAt: tick } | null,
 *   nextSpawnTick:     tick,
 *   totalVisits:       number,
 *   totalCommissioned: number,
 *   totalPurchased:    number,
 *   totalDismissals:   number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 15 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 3;   // Medieval Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_MANA_COST          = 25;
export const COMMISSION_GOLD_COST          = 20;
export const COMMISSION_MANA_RATE          = 0.25;
export const COMMISSION_PRESTIGE_REWARD    = 22;
export const COMMISSION_MORALE_REWARD      = 8;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_STONE_COST           = 20;
export const PURCHASE_STONE_RATE           = 0.18;
export const PURCHASE_PRESTIGE_REWARD      = 15;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initRoyalBookbinder() {
  if (!state.royalBookbinder) {
    state.royalBookbinder = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissioned: 0,
      totalPurchased:   0,
      totalDismissals:  0,
    };
  }
  const s = state.royalBookbinder;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick     = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits       = 0;
  if (s.totalCommissioned === undefined) s.totalCommissioned = 0;
  if (s.totalPurchased    === undefined) s.totalPurchased    = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals   = 0;
}

export function royalBookbinderTick() {
  const a = state.royalBookbinder;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.ROYAL_BOOKBINDER_CHANGED, { expired: true });
      addMessage('📚 The royal bookbinder carefully wraps their tooled leather covers, gilded clasps, and parchment quires in protective cloth, loads the binding press onto a cart, and departs to serve other imperial courts along the bookbinding circuit.', 'info');
    }
    return;
  }
  if (state.tick < a.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  a.active      = { expiresAt: state.tick + WINDOW_TICKS };
  a.totalVisits = (a.totalVisits ?? 0) + 1;
  emit(Events.ROYAL_BOOKBINDER_CHANGED, { spawned: true });
  addMessage('📚 A master royal bookbinder arrives bearing fine tooled-leather covers, gilded spine-plates, gold leaf, and an elaborate portable binding press. They offer to bind illuminated codices and imperial law books into lasting magnificent volumes, or to supply the empire with quality binding materials for the royal scriptorium. Respond within 80 seconds.', 'info');
}

export function getActiveRoyalBookbinder() { return state.royalBookbinder?.active ?? null; }
export function getBookbinderSecsLeft() {
  const a = state.royalBookbinder?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionIlluminatedBinding() {
  const a = state.royalBookbinder;
  if (!a?.active) return { ok: false, reason: 'No bookbinder present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The bookbinder has departed.' };
  if ((state.resources.mana ?? 0) < COMMISSION_MANA_COST) return { ok: false, reason: `Need ${COMMISSION_MANA_COST} mana.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.mana -= COMMISSION_MANA_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned illuminated binding from the royal bookbinder');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'bookbinderCommission');
    state.randomEvents.activeModifiers.push({
      id: 'bookbinderCommission', resource: 'mana',
      rateMult: 1 + (COMMISSION_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissioned = (a.totalCommissioned ?? 0) + 1;
  emit(Events.ROYAL_BOOKBINDER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📚 The bookbinder sets up their press in the imperial scriptorium and begins binding magnificent illuminated codices — the imperial law books in tooled calfskin stamped with the royal seal, the chronicles of the realm in gilded vellum covers, and annotated copies of the grand imperial atlas. Scholars and nobles marvel at the splendid volumes! −${COMMISSION_MANA_COST} mana · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Mana surge: +${COMMISSION_MANA_RATE} mana/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseBindingMaterials() {
  const a = state.royalBookbinder;
  if (!a?.active) return { ok: false, reason: 'No bookbinder present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The bookbinder has departed.' };
  if ((state.resources.stone ?? 0) < PURCHASE_STONE_COST) return { ok: false, reason: `Need ${PURCHASE_STONE_COST} stone.` };
  state.resources.stone -= PURCHASE_STONE_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased binding materials from the royal bookbinder');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'bookbinderPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'bookbinderPurchase', resource: 'stone',
      rateMult: 1 + (PURCHASE_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchased = (a.totalPurchased ?? 0) + 1;
  emit(Events.ROYAL_BOOKBINDER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪨 The bookbinder supplies the imperial scriptorium with premium stone-polished binding boards, marble-dust smoothing compounds, and quarried slate pressing-plates for the bookbinding press. The scriptorium begins producing volumes at a greatly increased rate! −${PURCHASE_STONE_COST} stone · +${PURCHASE_PRESTIGE_REWARD} prestige. Stone surge: +${PURCHASE_STONE_RATE} stone/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendBookbinderAway() {
  const a = state.royalBookbinder;
  if (!a?.active) return { ok: false, reason: 'No bookbinder present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.ROYAL_BOOKBINDER_CHANGED, { dismissed: true });
  addMessage('📚 The royal bookbinder bows respectfully, secures their press and gilding tools, and departs to offer their fine bookbinding services at other courts along the circuit.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
