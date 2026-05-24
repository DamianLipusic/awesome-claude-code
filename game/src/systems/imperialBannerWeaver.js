/**
 * EmpireOS — Imperial Banner Weaver (T385).
 *
 * Every 14–18 minutes (Medieval Age+, 10+ player tiles), a master banner
 * weaver arrives at court bearing bolts of crimson silk, spools of golden
 * thread, and a set of heraldic pattern books — offering to weave a
 * magnificent collection of imperial battle banners for the palace halls
 * and legions, or to share rare heraldic design patterns with the royal
 * artisans.  The player has 80 seconds to decide.
 *
 * Choices:
 *   🏴 Weave Imperial Battle Banners — pay 25 wood + 20 gold
 *        → +0.25 wood/s for 2.5 min · +22 prestige · +12 morale
 *   📜 Purchase Heraldic Patterns    — pay 22 gold
 *        → +0.18 gold/s for 2 min · +15 prestige
 *   🚶 Send Away                     — dismiss (no reward)
 *
 * state.imperialBannerWeaver = {
 *   active:            { expiresAt: tick } | null,
 *   nextSpawnTick:     tick,
 *   totalVisits:       number,
 *   totalWeavings:     number,
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

export const WEAVE_WOOD_COST            = 25;
export const WEAVE_GOLD_COST            = 20;
export const WEAVE_WOOD_RATE            = 0.25;
export const WEAVE_PRESTIGE_REWARD      = 22;
export const WEAVE_MORALE_REWARD        = 12;
export const WEAVE_DURATION_TICKS       = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST         = 22;
export const PURCHASE_GOLD_RATE         = 0.18;
export const PURCHASE_PRESTIGE_REWARD   = 15;
export const PURCHASE_DURATION_TICKS    = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialBannerWeaver() {
  if (!state.imperialBannerWeaver) {
    state.imperialBannerWeaver = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalWeavings:   0,
      totalPurchases:  0,
      totalDismissals: 0,
    };
  }
  const s = state.imperialBannerWeaver;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalWeavings    === undefined) s.totalWeavings    = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialBannerWeaverTick() {
  const a = state.imperialBannerWeaver;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_BANNER_WEAVER_CHANGED, { expired: true });
      addMessage('🏴 The imperial banner weaver carefully rolls up the unfinished bolts of crimson silk, tucks the golden thread spools into a travelling case, and departs through the palace gates — the rich fabric catching the sunlight as the artisan fades into the city streets.', 'info');
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
  emit(Events.IMPERIAL_BANNER_WEAVER_CHANGED, { spawned: true });
  addMessage('🏴 A master imperial banner weaver arrives at the palace gates bearing bolts of crimson silk, spools of golden thread, and a set of elaborate heraldic pattern books — offering to weave a breathtaking collection of imperial battle banners for the palace halls and marching legions, or to share rare heraldic design patterns with the royal artisans. Respond within 80 seconds.', 'info');
}

export function getActiveImperialBannerWeaver() { return state.imperialBannerWeaver?.active ?? null; }
export function getBannerWeaverSecsLeft() {
  const a = state.imperialBannerWeaver?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function weaveImperialBattleBanners() {
  const a = state.imperialBannerWeaver;
  if (!a?.active) return { ok: false, reason: 'No banner weaver present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The banner weaver has departed.' };
  if ((state.resources.wood ?? 0) < WEAVE_WOOD_COST) return { ok: false, reason: `Need ${WEAVE_WOOD_COST} wood.` };
  if ((state.resources.gold ?? 0) < WEAVE_GOLD_COST) return { ok: false, reason: `Need ${WEAVE_GOLD_COST} gold.` };
  state.resources.wood -= WEAVE_WOOD_COST;
  state.resources.gold -= WEAVE_GOLD_COST;
  changeMorale(WEAVE_MORALE_REWARD);
  awardPrestige(WEAVE_PRESTIGE_REWARD, 'Commissioned imperial battle banners from the banner weaver');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'bannerWeaverWeave');
    state.randomEvents.activeModifiers.push({
      id: 'bannerWeaverWeave', resource: 'wood',
      rateMult: 1 + (WEAVE_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + WEAVE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalWeavings = (a.totalWeavings ?? 0) + 1;
  emit(Events.IMPERIAL_BANNER_WEAVER_CHANGED, { woven: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🏴 The banner weaver sets up a great loom in the palace hall and produces a stunning array of imperial battle banners emblazoned with golden eagles, rampant lions, and the imperial crest — the brilliant crimson standards inspire the legions to march with pride as fresh timber is eagerly harvested to craft new banner poles across the empire! −${WEAVE_WOOD_COST} wood · −${WEAVE_GOLD_COST} gold · +${WEAVE_PRESTIGE_REWARD} prestige · +${WEAVE_MORALE_REWARD} morale. Wood surge: +${WEAVE_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseHeraldicPatterns() {
  const a = state.imperialBannerWeaver;
  if (!a?.active) return { ok: false, reason: 'No banner weaver present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The banner weaver has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased heraldic patterns from the imperial banner weaver');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'bannerWeaverPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'bannerWeaverPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_BANNER_WEAVER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The banner weaver spreads out a magnificent collection of heraldic pattern books across the palace design table — royal artisans eagerly copy the intricate emblems, weaving fine tapestries, pennants, and decorative cloths commissioned by nobles and wealthy merchants whose steady payments flow into the imperial treasury! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendBannerWeaverAway() {
  const a = state.imperialBannerWeaver;
  if (!a?.active) return { ok: false, reason: 'No banner weaver present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_BANNER_WEAVER_CHANGED, { dismissed: true });
  addMessage('🏴 The banner weaver gathers the bolts of crimson silk and the heraldic pattern books with quiet dignity, and departs through the palace gates — the gleam of golden thread fading as the artisan disappears into the winding city streets.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
