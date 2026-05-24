/**
 * EmpireOS — Wandering Lute Maker (T389).
 *
 * Every 12–16 minutes (Stone Age+, 6+ player tiles), a wandering lute maker
 * arrives at court carrying a satchel of carved wooden instruments, fine
 * strings, and decorative inlays — offering to commission a set of handcrafted
 * court lutes for the imperial musicians, or to sell a collection of rare
 * instrument patterns and woodworking techniques to the court artisans.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🎸 Commission Court Lutes        — pay 20 wood + 15 gold
 *        → +0.22 wood/s for 2.5 min · +18 prestige · +12 morale
 *   🎵 Purchase Instrument Patterns  — pay 18 gold
 *        → +0.15 gold/s for 2 min · +10 prestige
 *   🚶 Send Away                     — dismiss (no reward)
 *
 * state.wanderingLuteMaker = {
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

const SPAWN_MIN        = 12 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 0;   // Stone Age+
const MIN_PLAYER_TILES = 6;

export const COMMISSION_WOOD_COST        = 20;
export const COMMISSION_GOLD_COST        = 15;
export const COMMISSION_WOOD_RATE        = 0.22;
export const COMMISSION_PRESTIGE_REWARD  = 18;
export const COMMISSION_MORALE_REWARD    = 12;
export const COMMISSION_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST          = 18;
export const PURCHASE_GOLD_RATE          = 0.15;
export const PURCHASE_PRESTIGE_REWARD    = 10;
export const PURCHASE_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingLuteMaker() {
  if (!state.wanderingLuteMaker) {
    state.wanderingLuteMaker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingLuteMaker;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits      = 0;
  if (s.totalCommissions  === undefined) s.totalCommissions = 0;
  if (s.totalPurchases    === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals  = 0;
}

export function wanderingLuteMakerTick() {
  const a = state.wanderingLuteMaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_LUTE_MAKER_CHANGED, { expired: true });
      addMessage('🎸 The wandering lute maker carefully wraps the carved instruments back in the traveling satchel with gentle hands, and departs down the road — the faint melody of a plucked string fading as the artisan disappears over the ridge.', 'info');
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
  emit(Events.WANDERING_LUTE_MAKER_CHANGED, { spawned: true });
  addMessage('🎸 A wandering lute maker arrives at the settlement carrying a satchel of beautifully carved wooden instruments, fine gut strings, and decorative inlay patterns — offering to commission a set of handcrafted court lutes for the imperial musicians, or to share rare instrument patterns and woodworking techniques with the settlement artisans. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingLuteMaker() { return state.wanderingLuteMaker?.active ?? null; }
export function getLuteMakerSecsLeft() {
  const a = state.wanderingLuteMaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionCourtLutes() {
  const a = state.wanderingLuteMaker;
  if (!a?.active) return { ok: false, reason: 'No lute maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The lute maker has departed.' };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.wood -= COMMISSION_WOOD_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned court lutes from the wandering lute maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'luteMakerCommission');
    state.randomEvents.activeModifiers.push({
      id: 'luteMakerCommission', resource: 'wood',
      rateMult: 1 + (COMMISSION_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_LUTE_MAKER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🎸 The lute maker works with extraordinary skill and care, producing a magnificent set of handcrafted court lutes — resonant cedar-bodied instruments with ivory inlays and silk ribbons that fill the imperial halls with glorious music, lifting the spirits of court and commoner alike and inspiring the woodworkers and foresters to push timber production to remarkable new heights! −${COMMISSION_WOOD_COST} wood · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Wood surge: +${COMMISSION_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseInstrumentPatterns() {
  const a = state.wanderingLuteMaker;
  if (!a?.active) return { ok: false, reason: 'No lute maker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The lute maker has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased instrument patterns from the wandering lute maker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'luteMakerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'luteMakerPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_LUTE_MAKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🎵 The lute maker presents a remarkable collection of instrument patterns — detailed scrolls showing lute body proportions, sound-hole designs, and decorative inlay templates that the court artisans eagerly study, incorporating the refined woodworking techniques into their craft and producing beautifully finished goods eagerly sought by wealthy patrons! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendLuteMakerAway() {
  const a = state.wanderingLuteMaker;
  if (!a?.active) return { ok: false, reason: 'No lute maker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_LUTE_MAKER_CHANGED, { dismissed: true });
  addMessage('🎸 The lute maker gathers the carved instruments and patterned scrolls back into the traveling satchel with quiet acceptance, and departs down the road — the faint echo of a plucked string fading as the wandering artisan disappears over the ridge.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
