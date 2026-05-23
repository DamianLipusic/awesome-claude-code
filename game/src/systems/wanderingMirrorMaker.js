/**
 * EmpireOS — Wandering Mirror Maker (T381).
 *
 * Every 13–17 minutes (Iron Age+, 10+ player tiles), a skilled mirror maker
 * arrives at court carrying a portable polishing wheel, sheets of hammered
 * tin, and polished bronze discs — offering to commission a set of exquisite
 * polished mirrors for the imperial palace, or to sell the ancient art of
 * mirror-making and metal-polishing techniques to the palace workshops.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🪞 Commission Polished Mirrors — pay 20 iron + 15 stone
 *        → +0.20 iron/s for 2.5 min · +20 prestige · +10 morale
 *   ✨ Purchase Mirror-Making Craft — pay 18 gold
 *        → +0.15 gold/s for 2 min · +12 prestige
 *   🚶 Send Away                    — dismiss (no reward)
 *
 * state.wanderingMirrorMaker = {
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
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_IRON_COST           = 20;
export const COMMISSION_STONE_COST          = 15;
export const COMMISSION_IRON_RATE           = 0.20;
export const COMMISSION_PRESTIGE_REWARD     = 20;
export const COMMISSION_MORALE_REWARD       = 10;
export const COMMISSION_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST             = 18;
export const PURCHASE_GOLD_RATE             = 0.15;
export const PURCHASE_PRESTIGE_REWARD       = 12;
export const PURCHASE_DURATION_TICKS        = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingMirrorMaker() {
  if (!state.wanderingMirrorMaker) {
    state.wanderingMirrorMaker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingMirrorMaker;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingMirrorMakerTick() {
  const a = state.wanderingMirrorMaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_MIRROR_MAKER_CHANGED, { expired: true });
      addMessage('🪞 The wandering mirror maker wraps the polished bronze discs in soft cloth, stows the polishing wheel in a leather case, and departs with a gracious bow — leaving behind only the faint gleam of reflected light on the palace floor.', 'info');
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
  emit(Events.WANDERING_MIRROR_MAKER_CHANGED, { spawned: true });
  addMessage('🪞 A skilled mirror maker arrives at court carrying a portable polishing wheel, sheets of hammered tin, and gleaming polished bronze discs — offering to commission a set of exquisite palace mirrors, or to share the ancient art of mirror-making and metal polishing with the palace workshops. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingMirrorMaker() { return state.wanderingMirrorMaker?.active ?? null; }
export function getMirrorMakerSecsLeft() {
  const a = state.wanderingMirrorMaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionPolishedMirrors() {
  const a = state.wanderingMirrorMaker;
  if (!a?.active) return { ok: false, reason: 'No mirror maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The mirror maker has departed.' };
  if ((state.resources.iron ?? 0) < COMMISSION_IRON_COST) return { ok: false, reason: `Need ${COMMISSION_IRON_COST} iron.` };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  state.resources.iron  -= COMMISSION_IRON_COST;
  state.resources.stone -= COMMISSION_STONE_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned polished mirrors from the wandering mirror maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'mirrorMakerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'mirrorMakerCommission', resource: 'iron',
      rateMult: 1 + (COMMISSION_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_MIRROR_MAKER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪞 The mirror maker sets up a portable forge in the imperial smithy and crafts a magnificent set of polished bronze and tin mirrors — the gleaming surfaces not only adorn the palace halls but also focus sunlight into smelting chambers, dramatically improving ore extraction and refining yields throughout the empire! −${COMMISSION_IRON_COST} iron · −${COMMISSION_STONE_COST} stone · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Iron surge: +${COMMISSION_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseMirrorMakingCraft() {
  const a = state.wanderingMirrorMaker;
  if (!a?.active) return { ok: false, reason: 'No mirror maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The mirror maker has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased mirror-making craft from the wandering mirror maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'mirrorMakerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'mirrorMakerPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_MIRROR_MAKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`✨ The mirror maker instructs the palace artisans in the ancient art of polishing and surface finishing — merchants across the empire eagerly commission decorative mirrors, reflective panels, and signal mirrors for communication, creating a lucrative new trade that flows gold into the imperial treasury! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendMirrorMakerAway() {
  const a = state.wanderingMirrorMaker;
  if (!a?.active) return { ok: false, reason: 'No mirror maker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_MIRROR_MAKER_CHANGED, { dismissed: true });
  addMessage('🪞 The mirror maker nods respectfully, wraps the polished bronze discs and polishing tools in protective cloth, and departs through the palace gates — the soft gleam of reflected light fades as the craftsman vanishes around the corner.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
