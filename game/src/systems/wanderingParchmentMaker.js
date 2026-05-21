/**
 * EmpireOS — Wandering Parchment Maker (T355).
 *
 * Every 14–18 minutes (Medieval Age+, 10+ player tiles), a wandering parchment
 * maker arrives with scrapers, stretching frames, and barrels of lime-water for
 * producing the finest vellum sheets. The player has 80 seconds to decide.
 *
 * Choices:
 *   📜 Commission Royal Parchments  — pay 20 wood + 15 mana
 *        → +0.22 mana/s for 2.5 min · +20 prestige · +8 morale
 *   ✍️ Purchase Writing Materials   — pay 18 gold
 *        → +0.15 gold/s for 2 min · +12 prestige
 *   👋 Send Away                    — dismiss (no reward)
 *
 * state.wanderingParchmentMaker = {
 *   active:            { expiresAt: tick } | null,
 *   nextSpawnTick:     tick,
 *   totalVisits:       number,
 *   totalCommissions:  number,
 *   totalPurchases:    number,
 *   totalDismissals:   number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 14 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 3;   // Medieval Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_WOOD_COST        = 20;
export const COMMISSION_MANA_COST        = 15;
export const COMMISSION_MANA_RATE        = 0.22;
export const COMMISSION_PRESTIGE_REWARD  = 20;
export const COMMISSION_MORALE_REWARD    = 8;
export const COMMISSION_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST          = 18;
export const PURCHASE_GOLD_RATE          = 0.15;
export const PURCHASE_PRESTIGE_REWARD    = 12;
export const PURCHASE_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingParchmentMaker() {
  if (!state.wanderingParchmentMaker) {
    state.wanderingParchmentMaker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingParchmentMaker;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingParchmentMakerTick() {
  const a = state.wanderingParchmentMaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_PARCHMENT_MAKER_CHANGED, { expired: true });
      addMessage('📜 The wandering parchment maker rolls up the stretching frames, carefully seals the lime-water barrels, and packs the scrapers away before departing to seek a court more in need of fine writing materials.', 'info');
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
  emit(Events.WANDERING_PARCHMENT_MAKER_CHANGED, { spawned: true });
  addMessage('📜 A wandering parchment maker arrives bearing stretching frames, sharp scrapers, and barrels of lime-water — everything needed to produce the finest vellum sheets for imperial correspondence, legal documents, and illuminated manuscripts. They offer to produce a royal collection of high-quality parchment or to sell a premium supply of specialised writing materials. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingParchmentMaker() { return state.wanderingParchmentMaker?.active ?? null; }
export function getParchmentMakerSecsLeft() {
  const a = state.wanderingParchmentMaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionRoyalParchments() {
  const a = state.wanderingParchmentMaker;
  if (!a?.active) return { ok: false, reason: 'No parchment maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The parchment maker has departed.' };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  if ((state.resources.mana ?? 0) < COMMISSION_MANA_COST) return { ok: false, reason: `Need ${COMMISSION_MANA_COST} mana.` };
  state.resources.wood -= COMMISSION_WOOD_COST;
  state.resources.mana -= COMMISSION_MANA_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned magnificent royal parchments from the wandering parchment maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'parchmentMakerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'parchmentMakerCommission', resource: 'mana',
      rateMult: 1 + (COMMISSION_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_PARCHMENT_MAKER_CHANGED, { commission: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The parchment maker works with meticulous care — soaking, scraping, and stretching hide on tight frames until it becomes translucent vellum of exceptional quality. The finished sheets, bound in imperial red ribbon, become prized throughout the empire: scribes work faster, scholars study more efficiently, and the arcane arts flourish with better recording materials! −${COMMISSION_WOOD_COST} wood · −${COMMISSION_MANA_COST} mana · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Mana surge: +${COMMISSION_MANA_RATE} mana/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseWritingMaterials() {
  const a = state.wanderingParchmentMaker;
  if (!a?.active) return { ok: false, reason: 'No parchment maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The parchment maker has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased premium writing materials from the wandering parchment maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'parchmentMakerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'parchmentMakerPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_PARCHMENT_MAKER_CHANGED, { purchase: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`✍️ The parchment maker produces quills of exceptional quality, inks in a dozen colours, and folded parchment sheets treated for longevity. Merchants snap them up for trade contracts, officials use them for precise record-keeping, and the improved commercial documentation dramatically increases economic efficiency across the empire! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendParchmentMakerAway() {
  const a = state.wanderingParchmentMaker;
  if (!a?.active) return { ok: false, reason: 'No parchment maker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_PARCHMENT_MAKER_CHANGED, { dismissed: true });
  addMessage('📜 The wandering parchment maker nods politely, folds the stretching frames into a compact bundle, and loads the lime-water barrels back onto the cart before continuing their journey to a court with greater need for fine writing materials.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
