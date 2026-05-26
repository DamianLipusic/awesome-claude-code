/**
 * EmpireOS — Wandering Chronicler (T407).
 *
 * Every 14–18 minutes (Medieval Age+, 10+ player tiles), a wandering chronicler
 * arrives at the palace bearing leather-bound volumes of illustrated histories,
 * annotated campaign maps, and gilded dynastic records — offering to compile a
 * lavish imperial chronicle celebrating the empire's greatest deeds and ages, or
 * to sell a rare compendium of historical trade records and merchant ledgers that
 * the palace treasury scribes can study for economic insight.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   📜 Commission Imperial Chronicle   — pay 30 mana + 20 gold
 *        → +0.25 mana/s for 2.5 min · +22 prestige · +10 morale
 *   💰 Purchase Historical Compendium  — pay 25 gold
 *        → +0.18 gold/s for 2 min · +15 prestige
 *   🚶 Send Away                        — dismiss (no reward)
 *
 * state.wanderingChronicler = {
 *   active:             { expiresAt: tick } | null,
 *   nextSpawnTick:      tick,
 *   totalVisits:        number,
 *   totalCommissions:   number,
 *   totalPurchases:     number,
 *   totalDismissals:    number,
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

export const COMMISSION_MANA_COST          = 30;
export const COMMISSION_GOLD_COST          = 20;
export const COMMISSION_MANA_RATE          = 0.25;
export const COMMISSION_PRESTIGE_REWARD    = 22;
export const COMMISSION_MORALE_REWARD      = 10;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST            = 25;
export const PURCHASE_GOLD_RATE            = 0.18;
export const PURCHASE_PRESTIGE_REWARD      = 15;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingChronicler() {
  if (!state.wanderingChronicler) {
    state.wanderingChronicler = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingChronicler;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick     = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits       = 0;
  if (s.totalCommissions  === undefined) s.totalCommissions  = 0;
  if (s.totalPurchases    === undefined) s.totalPurchases    = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals   = 0;
}

export function wanderingChroniclerTick() {
  const a = state.wanderingChronicler;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_CHRONICLER_CHANGED, { expired: true });
      addMessage('📜 The wandering chronicler carefully closes the leather-bound volumes and departs the palace scriptorium — the faint smell of vellum, oak-gall ink, and beeswax candles fading as the cart of illustrated histories disappears through the gate.', 'info');
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
  emit(Events.WANDERING_CHRONICLER_CHANGED, { spawned: true });
  addMessage('📜 A wandering chronicler arrives at the palace bearing leather-bound volumes of illustrated histories, annotated campaign maps, and gilded dynastic records — offering to compile a lavish imperial chronicle celebrating the empire\'s greatest deeds and ages, or to sell a rare compendium of historical trade records and merchant ledgers that the palace treasury scribes can study for economic insight. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingChronicler() { return state.wanderingChronicler?.active ?? null; }
export function getChroniclerSecsLeft() {
  const a = state.wanderingChronicler?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionImperialChronicle() {
  const a = state.wanderingChronicler;
  if (!a?.active) return { ok: false, reason: 'No chronicler present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The chronicler has departed.' };
  if ((state.resources.mana ?? 0) < COMMISSION_MANA_COST) return { ok: false, reason: `Need ${COMMISSION_MANA_COST} mana.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.mana -= COMMISSION_MANA_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned an imperial chronicle from the wandering chronicler');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'chroniclerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'chroniclerCommission', resource: 'mana',
      rateMult: 1 + (COMMISSION_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_CHRONICLER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The chronicler retreats to the palace scriptorium, spreading gilded vellum sheets across the great table and dipping a goose-quill into oak-gall ink — calligraphing illuminated histories of every conquest, alliance, and age advance the empire has achieved, adorning each chapter with intricate knotwork borders, miniature portraits, and heraldic devices that inspire the palace scribes and scholars to redouble their own intellectual pursuits with renewed scholarly vigour! −${COMMISSION_MANA_COST} mana · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Mana surge: +${COMMISSION_MANA_RATE} mana/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseHistoricalCompendium() {
  const a = state.wanderingChronicler;
  if (!a?.active) return { ok: false, reason: 'No chronicler present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The chronicler has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased a historical trade compendium from the wandering chronicler');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'chroniclerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'chroniclerPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_CHRONICLER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`💰 The chronicler hands over a thick ledger of annotated merchant records spanning generations of trade — prices, seasonal demand patterns, guild commission rates, and the most profitable routes between distant markets — the palace treasury scribes study the compendium avidly, identifying margin-expansion opportunities in every current trade agreement and sharpening the empire's commercial acumen to squeeze greater gold yields from each transaction! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendChroniclerAway() {
  const a = state.wanderingChronicler;
  if (!a?.active) return { ok: false, reason: 'No chronicler present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_CHRONICLER_CHANGED, { dismissed: true });
  addMessage('📜 The wandering chronicler secures the illustrated volumes beneath oilskin covers and departs the palace — the quiet rustle of vellum and the creak of the loaded cart fading as the historian rounds the corner of the courtyard wall.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
