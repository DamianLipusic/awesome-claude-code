/**
 * EmpireOS — Imperial Vineyard Master (T394).
 *
 * Every 13–17 minutes (Bronze Age+, 8+ player tiles), an imperial vineyard
 * master arrives at the capital bearing clay amphoras of fine aged wine,
 * pruning tools, and pressed grape samples — offering to commission a grand
 * wine cellar for the imperial palace, or to share rare viticulture secrets
 * and wine-making techniques with the imperial stewards.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🍇 Commission Wine Cellar    — pay 25 food + 20 gold
 *        → +0.25 food/s for 2.5 min · +20 prestige · +12 morale
 *   📜 Purchase Vineyard Secrets — pay 20 wood
 *        → +0.18 wood/s for 2 min · +15 prestige
 *   🚶 Send Away                 — dismiss (no reward)
 *
 * state.imperialVineyardMaster = {
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

const SPAWN_MIN        = 13 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 1;   // Bronze Age+
const MIN_PLAYER_TILES = 8;

export const COMMISSION_FOOD_COST        = 25;
export const COMMISSION_GOLD_COST        = 20;
export const COMMISSION_FOOD_RATE        = 0.25;
export const COMMISSION_PRESTIGE_REWARD  = 20;
export const COMMISSION_MORALE_REWARD    = 12;
export const COMMISSION_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_WOOD_COST          = 20;
export const PURCHASE_WOOD_RATE          = 0.18;
export const PURCHASE_PRESTIGE_REWARD    = 15;
export const PURCHASE_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialVineyardMaster() {
  if (!state.imperialVineyardMaster) {
    state.imperialVineyardMaster = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialVineyardMaster;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits      = 0;
  if (s.totalCommissions  === undefined) s.totalCommissions = 0;
  if (s.totalPurchases    === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals  = 0;
}

export function imperialVineyardMasterTick() {
  const a = state.imperialVineyardMaster;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_VINEYARD_MASTER_CHANGED, { expired: true });
      addMessage('🍇 The imperial vineyard master carefully seals the amphoras of aged wine, bows respectfully, and departs from the capital — the rich bouquet of grape and oak fading on the breeze as the vintner travels back to the distant vineyards.', 'info');
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
  emit(Events.IMPERIAL_VINEYARD_MASTER_CHANGED, { spawned: true });
  addMessage('🍇 An imperial vineyard master arrives at the capital bearing clay amphoras of fine aged wine, ornate pruning tools, and pressed grape samples from sun-drenched hillside terraces — offering to commission a grand wine cellar and tasting hall for the imperial palace, or to share rare viticulture secrets and grape-cultivation techniques with the imperial stewards. Respond within 80 seconds.', 'info');
}

export function getActiveImperialVineyardMaster() { return state.imperialVineyardMaster?.active ?? null; }
export function getVineyardMasterSecsLeft() {
  const a = state.imperialVineyardMaster?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionWineCellar() {
  const a = state.imperialVineyardMaster;
  if (!a?.active) return { ok: false, reason: 'No vineyard master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The vineyard master has departed.' };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.food -= COMMISSION_FOOD_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned wine cellar from the imperial vineyard master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'vineyardCommission');
    state.randomEvents.activeModifiers.push({
      id: 'vineyardCommission', resource: 'food',
      rateMult: 1 + (COMMISSION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_VINEYARD_MASTER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🍇 The vineyard master oversees the construction of a magnificent vaulted wine cellar beneath the imperial palace — rows of oak barrels, terracotta amphoras, and marble tasting tables filling the cool stone chambers with the heady fragrance of aging wine. The grand cellar becomes a place of celebration and diplomacy, lifting the spirits of nobles and citizens alike while the feasting revitalises the realm's food production! −${COMMISSION_FOOD_COST} food · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Food surge: +${COMMISSION_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseVineyardSecrets() {
  const a = state.imperialVineyardMaster;
  if (!a?.active) return { ok: false, reason: 'No vineyard master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The vineyard master has departed.' };
  if ((state.resources.wood ?? 0) < PURCHASE_WOOD_COST) return { ok: false, reason: `Need ${PURCHASE_WOOD_COST} wood.` };
  state.resources.wood -= PURCHASE_WOOD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased vineyard secrets from the imperial vineyard master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'vineyardPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'vineyardPurchase', resource: 'wood',
      rateMult: 1 + (PURCHASE_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_VINEYARD_MASTER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The vineyard master shares a beautifully illustrated compendium of viticulture knowledge — trellis-construction diagrams, soil preparation methods, vine-pruning calendars, and oak-barrel coopering techniques that the imperial foresters and estate workers eagerly implement, dramatically improving timber management and wood harvesting across the realm! −${PURCHASE_WOOD_COST} wood · +${PURCHASE_PRESTIGE_REWARD} prestige. Wood surge: +${PURCHASE_WOOD_RATE} wood/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendVineyardMasterAway() {
  const a = state.imperialVineyardMaster;
  if (!a?.active) return { ok: false, reason: 'No vineyard master present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_VINEYARD_MASTER_CHANGED, { dismissed: true });
  addMessage('🍇 The vineyard master carefully seals the amphoras of aged wine, bows respectfully, and departs from the capital — the rich bouquet of grape and oak fading on the breeze as the vintner travels back to the distant vineyards.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
