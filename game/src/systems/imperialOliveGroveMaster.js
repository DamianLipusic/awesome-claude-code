/**
 * EmpireOS — Imperial Olive Grove Master (T448).
 *
 * Every 13–17 minutes (Bronze Age+, 8+ player tiles), an imperial olive
 * grove master arrives at the settlement carrying a satchel of pressed olive
 * oil samples, sprouted cuttings wrapped in damp moss, and a rolled
 * parchment of grove management records that document the forty-year cycle
 * of planting, grafting, pruning, and pressing that transforms a hillside
 * of bare rock terraces into a productive grove of ancient silver-leafed
 * trees whose gnarled trunks can outlive ten generations of farmers — each
 * grove master responsible for the selection of the correct stony well-
 * drained soils on south-facing slopes where the reflected warmth from the
 * limestone terracing accelerates ripening, the grafting of high-yield
 * fruiting wood onto the cold-hardy rootstock cut from century-old stumps
 * that survive winter frosts fatal to ordinary saplings, the precise harvest
 * timing after the first colour change when the fruit is still firm and the
 * oil bitter and peppery rather than the flat oxidised flavour of fully
 * black overripe fruit, the pressing sequence in the stone mill and weighted
 * press that extracts the highest proportion of oil without heating the
 * paste and destroying the volatile compounds responsible for flavour and
 * keeping quality — offering to commission a complete olive cultivation
 * program for the settlement's agricultural lands, or to purchase the full
 * grove management records and pressing methods. The player has 80 seconds
 * to decide.
 *
 * Choices:
 *   🫒 Commission Olive Cultivation    — pay 25 food + 20 gold
 *        → +0.22 food/s for 2.5 min · +20 prestige · +12 morale
 *   📖 Purchase Orchard Management Lore — pay 20 wood
 *        → +0.18 wood/s for 2 min · +15 prestige
 *   🚶 Send Away                        — dismiss (no reward)
 *
 * state.imperialOliveGroveMaster = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalCommissions:    number,
 *   totalPurchases:      number,
 *   totalDismissals:     number,
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

export const COMMISSION_FOOD_COST          = 25;
export const COMMISSION_GOLD_COST          = 20;
export const COMMISSION_FOOD_RATE          = 0.22;
export const COMMISSION_PRESTIGE_REWARD    = 20;
export const COMMISSION_MORALE_REWARD      = 12;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_WOOD_COST            = 20;
export const PURCHASE_WOOD_RATE            = 0.18;
export const PURCHASE_PRESTIGE_REWARD      = 15;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialOliveGroveMaster() {
  if (!state.imperialOliveGroveMaster) {
    state.imperialOliveGroveMaster = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialOliveGroveMaster;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialOliveGroveMasterTick() {
  const a = state.imperialOliveGroveMaster;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_OLIVE_GROVE_MASTER_CHANGED, { expired: true });
      addMessage('🫒 The imperial olive grove master rolls the parchment records back into the satchel and departs down the hillside track toward the next estate.', 'info');
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
  emit(Events.IMPERIAL_OLIVE_GROVE_MASTER_CHANGED, { spawned: true });
  addMessage('🫒 An imperial olive grove master arrives carrying pressed olive oil samples, sprouted cuttings wrapped in damp moss, and forty years of grove management records — offering to commission a complete olive cultivation program for the settlement\'s agricultural lands, or to purchase the full grove management records and pressing methods. Respond within 80 seconds.', 'info');
}

export function getActiveImperialOliveGroveMaster() { return state.imperialOliveGroveMaster?.active ?? null; }
export function getOliveGroveMasterSecsLeft() {
  const a = state.imperialOliveGroveMaster?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionOliveCultivation() {
  const a = state.imperialOliveGroveMaster;
  if (!a?.active) return { ok: false, reason: 'No olive grove master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The olive grove master has departed.' };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.food -= COMMISSION_FOOD_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned olive cultivation with the imperial olive grove master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'olivegroveCommission');
    state.randomEvents.activeModifiers.push({
      id: 'olivegroveCommission', resource: 'food',
      rateMult: 1 + (COMMISSION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_OLIVE_GROVE_MASTER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🫒 The grove master spends the following weeks directing a complete olive cultivation program — selecting the south-facing rocky terraces above the settlement where shallow limestone soil drains fast after rain and the afternoon sun heats the pale stone to accelerate fruit ripening by three weeks compared to the valley floor, grafting the high-yield fruiting wood onto the cold-hardy rootstock stumps cut from century-old trees on the upper terraces that survived the last severe winter without damage, laying out the spacing pattern that gives each tree enough root room to avoid competition during the summer drought yet positions the canopies close enough for harvesting gangs to move efficiently along the rows, and marking the terrace walls that need rebuilding to prevent soil loss before the autumn rains — establishing the foundation of a grove that will yield increasing harvests for the next three generations with no further significant investment beyond the annual labour of pruning and picking. −${COMMISSION_FOOD_COST} food · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Food surge: +${COMMISSION_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseOrchardManagementLore() {
  const a = state.imperialOliveGroveMaster;
  if (!a?.active) return { ok: false, reason: 'No olive grove master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The olive grove master has departed.' };
  if ((state.resources.wood ?? 0) < PURCHASE_WOOD_COST) return { ok: false, reason: `Need ${PURCHASE_WOOD_COST} wood.` };
  state.resources.wood -= PURCHASE_WOOD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased orchard management lore from the imperial olive grove master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'olivegrovePurchase');
    state.randomEvents.activeModifiers.push({
      id: 'olivegrovePurchase', resource: 'wood',
      rateMult: 1 + (PURCHASE_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_OLIVE_GROVE_MASTER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The olive grove master transfers the full forty-year grove management records — the soil survey method that identifies the correct stony well-drained slopes where olive roots find the crevices in the bedrock to anchor against wind and draw moisture from deep rock joints during the summer drought, the grafting calendar that schedules scion collection in late winter when the cambium of the rootstock is first moving but the grafted wood is still dormant, the pruning philosophy that removes the crossing branches and inward growth that shades the fruit-bearing wood and promotes the open vase form that allows maximum light into the canopy on short winter days, the harvest-timing indicators that mark the precise two-week window after first colour change when the fruit is at peak oil content and the flavour compounds have fully developed but before the fruit softens and the oil begins to oxidise inside the skin, and the pressing sequence that recovers the first-press cold-extracted oil from the freshly crushed paste before the second pressing with added water for the common oil used in lamps and soap — enabling the settlement's farmers to establish and manage productive olive groves on all suitable hillside terraces using local knowledge and materials from the first planting year forward. −${PURCHASE_WOOD_COST} wood · +${PURCHASE_PRESTIGE_REWARD} prestige. Wood surge: +${PURCHASE_WOOD_RATE} wood/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendOliveGroveMasterAway() {
  const a = state.imperialOliveGroveMaster;
  if (!a?.active) return { ok: false, reason: 'No olive grove master present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_OLIVE_GROVE_MASTER_CHANGED, { dismissed: true });
  addMessage('🫒 The imperial olive grove master rolls the parchment records into the satchel and departs with a respectful bow.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
