/**
 * EmpireOS — Imperial Lantern Maker (T396).
 *
 * Every 14–19 minutes (Medieval Age+, 10+ player tiles), an imperial lantern
 * maker arrives at court carrying hand-painted paper lanterns, gilded iron frames,
 * coloured glass panels, and finely-crafted wick mechanisms — offering to commission
 * a magnificent collection of festival lanterns to illuminate the imperial capital and
 * celebration squares, or to share refined lantern-crafting and glasswork techniques
 * with the imperial artisans and craftsmen.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🏮 Commission Festival Lanterns  — pay 25 mana + 20 gold
 *        → +0.25 mana/s for 2.5 min · +22 prestige · +12 morale
 *   📜 Purchase Lantern Craft        — pay 20 wood
 *        → +0.18 wood/s for 2 min · +15 prestige
 *   🚶 Send Away                     — dismiss (no reward)
 *
 * state.imperialLanternMaker = {
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
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 3;   // Medieval Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_MANA_COST        = 25;
export const COMMISSION_GOLD_COST        = 20;
export const COMMISSION_MANA_RATE        = 0.25;
export const COMMISSION_PRESTIGE_REWARD  = 22;
export const COMMISSION_MORALE_REWARD    = 12;
export const COMMISSION_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_WOOD_COST          = 20;
export const PURCHASE_WOOD_RATE          = 0.18;
export const PURCHASE_PRESTIGE_REWARD    = 15;
export const PURCHASE_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialLanternMaker() {
  if (!state.imperialLanternMaker) {
    state.imperialLanternMaker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialLanternMaker;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits      = 0;
  if (s.totalCommissions  === undefined) s.totalCommissions = 0;
  if (s.totalPurchases    === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals  = 0;
}

export function imperialLanternMakerTick() {
  const a = state.imperialLanternMaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_LANTERN_MAKER_CHANGED, { expired: true });
      addMessage('🏮 The imperial lantern maker carefully wraps the unsold lanterns in silk cloth, tucks the gilded frames into carrying cases, and bows graciously before departing from the court — the warm amber glow of the lantern samples fading as the artisan heads off down the palace corridor.', 'info');
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
  emit(Events.IMPERIAL_LANTERN_MAKER_CHANGED, { spawned: true });
  addMessage('🏮 An imperial lantern maker arrives at court carrying hand-painted paper lanterns, gilded iron frames, coloured glass panels, and finely-crafted wick mechanisms — offering to commission a magnificent collection of festival lanterns to illuminate the imperial capital and celebration squares, or to share refined lantern-crafting and glasswork techniques with the imperial artisans. Respond within 80 seconds.', 'info');
}

export function getActiveImperialLanternMaker() { return state.imperialLanternMaker?.active ?? null; }
export function getLanternMakerSecsLeft() {
  const a = state.imperialLanternMaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionFestivalLanterns() {
  const a = state.imperialLanternMaker;
  if (!a?.active) return { ok: false, reason: 'No lantern maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The lantern maker has departed.' };
  if ((state.resources.mana ?? 0) < COMMISSION_MANA_COST) return { ok: false, reason: `Need ${COMMISSION_MANA_COST} mana.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.mana -= COMMISSION_MANA_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned festival lanterns from the imperial lantern maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'lanternMakerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'lanternMakerCommission', resource: 'mana',
      rateMult: 1 + (COMMISSION_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_LANTERN_MAKER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🏮 The lantern maker sets to work with remarkable artistry — painting, gilding, and assembling hundreds of magnificent festival lanterns that are hung throughout the imperial capital, squares, and celebration halls, bathing the city in warm amber light that fills citizens with wonder and joy. The festival atmosphere awakens mystical energies that course through the realm! −${COMMISSION_MANA_COST} mana · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Mana surge: +${COMMISSION_MANA_RATE} mana/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseLanternCraft() {
  const a = state.imperialLanternMaker;
  if (!a?.active) return { ok: false, reason: 'No lantern maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The lantern maker has departed.' };
  if ((state.resources.wood ?? 0) < PURCHASE_WOOD_COST) return { ok: false, reason: `Need ${PURCHASE_WOOD_COST} wood.` };
  state.resources.wood -= PURCHASE_WOOD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased lantern craft from the imperial lantern maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'lanternMakerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'lanternMakerPurchase', resource: 'wood',
      rateMult: 1 + (PURCHASE_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_LANTERN_MAKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The lantern maker shares a folio of detailed lantern-crafting blueprints — intricate frame-bending patterns, paper-lacquering methods, and precision woodworking guides that the imperial carpenters and joiners eagerly adopt, dramatically refining their woodcraft and generating a steady new supply of fine timber goods for the imperial workshops! −${PURCHASE_WOOD_COST} wood · +${PURCHASE_PRESTIGE_REWARD} prestige. Wood surge: +${PURCHASE_WOOD_RATE} wood/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendLanternMakerAway() {
  const a = state.imperialLanternMaker;
  if (!a?.active) return { ok: false, reason: 'No lantern maker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_LANTERN_MAKER_CHANGED, { dismissed: true });
  addMessage('🏮 The imperial lantern maker carefully wraps the unsold lanterns in silk cloth and tucks the gilded frames into carrying cases before bowing graciously and departing from the court — the warm amber glow of the lantern samples fading as the artisan heads off down the road.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
