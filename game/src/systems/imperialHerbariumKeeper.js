/**
 * EmpireOS — Imperial Herbarium Keeper (T420).
 *
 * Every 14–19 minutes (Medieval Age+, 10+ player tiles), an imperial herbarium
 * keeper arrives at the palace carrying pressed-plant folios bound in calfskin,
 * copper-topped specimen vials sealed with beeswax, dried root bundles tied in
 * linen tape, and illustrated botanical charts detailing medicinal preparation
 * routes for every plant in the imperial garden — offering to commission a
 * complete herbal compendium for the palace physic garden and apothecary
 * stores, or to sell a curated selection of medicinal plants — valerian, yarrow,
 * marsh-mallow, and elderflower — that extend the garrison's health through
 * the winter season.  The player has 80 seconds to decide.
 *
 * Choices:
 *   🌿 Commission Herbal Compendium  — pay 25 mana + 15 gold
 *        → +0.22 mana/s for 2.5 min · +20 prestige · +10 morale
 *   🌱 Purchase Medicinal Plants     — pay 20 food
 *        → +0.18 food/s for 2 min · +15 prestige
 *   🚶 Send Away                     — dismiss (no reward)
 *
 * state.imperialHerbariumKeeper = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalCommissions: number,
 *   totalPurchases:   number,
 *   totalDismissals:  number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 14 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 3;   // Medieval Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_MANA_COST          = 25;
export const COMMISSION_GOLD_COST          = 15;
export const COMMISSION_MANA_RATE          = 0.22;
export const COMMISSION_PRESTIGE_REWARD    = 20;
export const COMMISSION_MORALE_REWARD      = 10;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_FOOD_COST            = 20;
export const PURCHASE_FOOD_RATE            = 0.18;
export const PURCHASE_PRESTIGE_REWARD      = 15;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialHerbariumKeeper() {
  if (!state.imperialHerbariumKeeper) {
    state.imperialHerbariumKeeper = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialHerbariumKeeper;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialHerbariumKeeperTick() {
  const a = state.imperialHerbariumKeeper;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_HERBARIUM_KEEPER_CHANGED, { expired: true });
      addMessage('🌿 The imperial herbarium keeper repacks the pressed-plant folios, seals the copper-topped specimen vials, bundles the dried root collections back into the linen-lined carry-chest, and departs the palace — the faint mingled fragrance of dried valerian, yarrow, and elderflower fading as the cart disappears through the gatehouse.', 'info');
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
  emit(Events.IMPERIAL_HERBARIUM_KEEPER_CHANGED, { spawned: true });
  addMessage('🌿 An imperial herbarium keeper arrives at the palace carrying pressed-plant folios bound in calfskin, copper-topped specimen vials sealed with beeswax, dried root bundles tied in linen tape, and illustrated botanical charts detailing medicinal preparation routes — offering to commission a complete herbal compendium for the palace physic garden and apothecary stores, or to sell a curated selection of medicinal plants including valerian, yarrow, marsh-mallow, and elderflower that extend the garrison\'s health through the winter season. Respond within 80 seconds.', 'info');
}

export function getActiveImperialHerbariumKeeper() { return state.imperialHerbariumKeeper?.active ?? null; }
export function getHerbariumKeeperSecsLeft() {
  const a = state.imperialHerbariumKeeper?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionHerbalCompendium() {
  const a = state.imperialHerbariumKeeper;
  if (!a?.active) return { ok: false, reason: 'No herbarium keeper present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The herbarium keeper has departed.' };
  if ((state.resources.mana ?? 0) < COMMISSION_MANA_COST) return { ok: false, reason: `Need ${COMMISSION_MANA_COST} mana.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.mana -= COMMISSION_MANA_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned herbal compendium from the imperial herbarium keeper');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'herbariumCommission');
    state.randomEvents.activeModifiers.push({
      id: 'herbariumCommission', resource: 'mana',
      rateMult: 1 + (COMMISSION_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_HERBARIUM_KEEPER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌿 The herbarium keeper opens the calfskin folios and transcribes each plant entry with its illustrated identification key, preparation method, dosage guide, and seasonal harvest note — compiling valerian root tinctures for sleep disorders, yarrow poultice formulas for wound-closing, marsh-mallow syrup preparations for chest ailments, and elderflower infusion ratios for fever reduction into a single authoritative compendium delivered to the palace physic garden, the garrison apothecary, and every district healer — the systematic treatment protocols lifting the empire's collective vitality and sharpening the scholarly output of every palace scholar who consults the indexed botanical reference! −${COMMISSION_MANA_COST} mana · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Mana surge: +${COMMISSION_MANA_RATE} mana/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseMedicinalPlants() {
  const a = state.imperialHerbariumKeeper;
  if (!a?.active) return { ok: false, reason: 'No herbarium keeper present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The herbarium keeper has departed.' };
  if ((state.resources.food ?? 0) < PURCHASE_FOOD_COST) return { ok: false, reason: `Need ${PURCHASE_FOOD_COST} food.` };
  state.resources.food -= PURCHASE_FOOD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased medicinal plants from the imperial herbarium keeper');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'herbariumPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'herbariumPurchase', resource: 'food',
      rateMult: 1 + (PURCHASE_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_HERBARIUM_KEEPER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🌱 The herbarium keeper unpacks the copper-topped specimen vials and distributes dried valerian root bundles to the palace dispensary, yarrow flower heads to the garrison wound-station, marsh-mallow root slabs to the district apothecaries, and elderflower clusters to the market stall healers — the restorative tinctures, poultices, and infusions prepared from each plant cutting reaching the soldiers, craftsmen, and labourers who most need sustained energy and rapid recovery, keeping the empire's workforce healthy, alert, and productive through every winter month! −${PURCHASE_FOOD_COST} food · +${PURCHASE_PRESTIGE_REWARD} prestige. Food surge: +${PURCHASE_FOOD_RATE} food/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendHerbariumKeeperAway() {
  const a = state.imperialHerbariumKeeper;
  if (!a?.active) return { ok: false, reason: 'No herbarium keeper present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_HERBARIUM_KEEPER_CHANGED, { dismissed: true });
  addMessage('🌿 The imperial herbarium keeper repacks the calfskin folios, seals the specimen vials, and bundles the dried roots back into the linen carry-chest — bowing respectfully before departing the palace, the mingled scent of dried herbs lingering briefly in the gatehouse arch.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
