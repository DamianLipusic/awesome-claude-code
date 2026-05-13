/**
 * EmpireOS — Merchant Prince (T264).
 *
 * Every 12–17 minutes (Bronze Age+, 6+ player tiles), a wealthy merchant
 * prince passes through the empire seeking profitable arrangements.
 * The player has 75 seconds to decide.
 *
 * Choices:
 *   💰 Arrange Trade Deal     — pay 50 gold → +0.35 gold/s for 2.5 min + 22 prestige
 *   🤝 Exchange Valuable Goods — pay 20 food + 10 wood → +45 gold + 15 prestige
 *   🍷 Host Lavish Reception   — pay 30 food → +8 morale + 8 prestige
 *
 * state.merchantPrince = {
 *   active:          { expiresAt: tick } | null,
 *   nextSpawnTick:   tick,
 *   totalVisits:     number,
 *   totalDeals:      number,
 *   totalExchanges:  number,
 *   totalReceptions: number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 12 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      = 5  * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 75 * TICKS_PER_SECOND;
const MIN_AGE          = 1;
const MIN_PLAYER_TILES = 6;

export const DEAL_GOLD_COST         = 50;
export const DEAL_GOLD_RATE         = 0.35;
export const DEAL_DURATION_TICKS    = Math.round(2.5 * 60 * TICKS_PER_SECOND);
export const DEAL_PRESTIGE_REWARD   = 22;

export const EXCHANGE_FOOD_COST     = 20;
export const EXCHANGE_WOOD_COST     = 10;
export const EXCHANGE_GOLD_REWARD   = 45;
export const EXCHANGE_PRESTIGE_REWARD = 15;

export const RECEPTION_FOOD_COST    = 30;
export const RECEPTION_MORALE_REWARD  = 8;
export const RECEPTION_PRESTIGE_REWARD = 8;

export function initMerchantPrince() {
  if (!state.merchantPrince) {
    state.merchantPrince = { active: null, nextSpawnTick: _nextSpawnTick(), totalVisits: 0, totalDeals: 0, totalExchanges: 0, totalReceptions: 0 };
  }
  if (state.merchantPrince.nextSpawnTick    === undefined) state.merchantPrince.nextSpawnTick    = _nextSpawnTick();
  if (state.merchantPrince.totalVisits      === undefined) state.merchantPrince.totalVisits      = 0;
  if (state.merchantPrince.totalDeals       === undefined) state.merchantPrince.totalDeals       = 0;
  if (state.merchantPrince.totalExchanges   === undefined) state.merchantPrince.totalExchanges   = 0;
  if (state.merchantPrince.totalReceptions  === undefined) state.merchantPrince.totalReceptions  = 0;
}

export function merchantPrinceTick() {
  const mp = state.merchantPrince;
  if (!mp) return;
  if (mp.active) {
    if (state.tick >= mp.active.expiresAt) {
      mp.active        = null; mp.nextSpawnTick = _nextSpawnTick();
      emit(Events.MERCHANT_PRINCE_CHANGED, { expired: true });
      addMessage('💰 The merchant prince departs without striking a deal, continuing their trade circuit.', 'info');
    }
    return;
  }
  if (state.tick < mp.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  mp.active      = { expiresAt: state.tick + WINDOW_TICKS };
  mp.totalVisits = (mp.totalVisits ?? 0) + 1;
  emit(Events.MERCHANT_PRINCE_CHANGED, { spawned: true });
  addMessage('💰 A wealthy merchant prince has arrived at the imperial trading post, seeking profitable arrangements! Respond within 75 seconds.', 'info');
}

export function getActiveMerchantPrince() { return state.merchantPrince?.active ?? null; }
export function getMerchantPrinceSecsLeft() {
  const a = state.merchantPrince?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function arrangeTradeDeal() {
  const mp = state.merchantPrince;
  if (!mp?.active) return { ok: false, reason: 'No merchant prince present.' };
  if (state.tick >= mp.active.expiresAt) return { ok: false, reason: 'The merchant prince has departed.' };
  if ((state.resources.gold ?? 0) < DEAL_GOLD_COST) return { ok: false, reason: `Need ${DEAL_GOLD_COST} gold.` };
  state.resources.gold -= DEAL_GOLD_COST;
  awardPrestige(DEAL_PRESTIGE_REWARD, 'Arranged an exclusive trade deal with a merchant prince');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'merchantPrinceDeal');
    state.randomEvents.activeModifiers.push({ id: 'merchantPrinceDeal', resource: 'gold', rateMult: 1 + (DEAL_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))), expiresAt: state.tick + DEAL_DURATION_TICKS });
  }
  mp.active        = null; mp.nextSpawnTick = _nextSpawnTick(); mp.totalDeals    = (mp.totalDeals ?? 0) + 1;
  emit(Events.MERCHANT_PRINCE_CHANGED, { deal: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`💰 The merchant prince seals an exclusive trade arrangement! +${DEAL_PRESTIGE_REWARD} prestige. Commerce flourishes: +${DEAL_GOLD_RATE} gold/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function exchangeValuableGoods() {
  const mp = state.merchantPrince;
  if (!mp?.active) return { ok: false, reason: 'No merchant prince present.' };
  if (state.tick >= mp.active.expiresAt) return { ok: false, reason: 'The merchant prince has departed.' };
  if ((state.resources.food ?? 0) < EXCHANGE_FOOD_COST) return { ok: false, reason: `Need ${EXCHANGE_FOOD_COST} food.` };
  if ((state.resources.wood ?? 0) < EXCHANGE_WOOD_COST) return { ok: false, reason: `Need ${EXCHANGE_WOOD_COST} wood.` };
  state.resources.food -= EXCHANGE_FOOD_COST; state.resources.wood -= EXCHANGE_WOOD_COST;
  const goldCap = state.caps?.gold ?? 9999;
  state.resources.gold = Math.min(goldCap, (state.resources.gold ?? 0) + EXCHANGE_GOLD_REWARD);
  awardPrestige(EXCHANGE_PRESTIGE_REWARD, 'Exchanged valuable goods with a merchant prince');
  mp.active          = null; mp.nextSpawnTick   = _nextSpawnTick(); mp.totalExchanges  = (mp.totalExchanges ?? 0) + 1;
  emit(Events.MERCHANT_PRINCE_CHANGED, { exchanged: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🤝 The merchant prince trades fine goods for imperial produce and timber! +${EXCHANGE_GOLD_REWARD} gold, +${EXCHANGE_PRESTIGE_REWARD} prestige.`, 'windfall');
  return { ok: true };
}

export function hostMerchantReception() {
  const mp = state.merchantPrince;
  if (!mp?.active) return { ok: false, reason: 'No merchant prince present.' };
  if (state.tick >= mp.active.expiresAt) return { ok: false, reason: 'The merchant prince has departed.' };
  if ((state.resources.food ?? 0) < RECEPTION_FOOD_COST) return { ok: false, reason: `Need ${RECEPTION_FOOD_COST} food.` };
  state.resources.food -= RECEPTION_FOOD_COST;
  changeMorale(RECEPTION_MORALE_REWARD);
  awardPrestige(RECEPTION_PRESTIGE_REWARD, 'Hosted a lavish reception for a merchant prince');
  mp.active           = null; mp.nextSpawnTick    = _nextSpawnTick(); mp.totalReceptions  = (mp.totalReceptions ?? 0) + 1;
  emit(Events.MERCHANT_PRINCE_CHANGED, { reception: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🍷 The merchant prince is deeply impressed by the imperial hospitality! +${RECEPTION_MORALE_REWARD} morale, +${RECEPTION_PRESTIGE_REWARD} prestige.`, 'windfall');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }