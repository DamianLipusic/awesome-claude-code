/**
 * EmpireOS — Wandering Glass Painter (T401).
 *
 * Every 14–19 minutes (Medieval Age+, 10+ player tiles), a wandering glass painter
 * arrives at the palace carrying a leather satchel of coloured glass fragments, lead
 * soldering tools, and rolled cartoons depicting luminous biblical scenes and heraldic
 * symbols — offering to commission magnificent stained glass windows for the imperial
 * cathedral and great hall, or to share the refined art of painted glass with the
 * palace glaziers and master craftsmen.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🎨 Commission Stained Glass Windows  — pay 25 stone + 20 gold
 *        → +0.22 stone/s for 2.5 min · +22 prestige · +10 morale
 *   🪟 Purchase Painting Techniques      — pay 20 mana
 *        → +0.18 mana/s for 2 min · +15 prestige
 *   🚶 Send Away                          — dismiss (no reward)
 *
 * state.wanderingGlassPainter = {
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

export const COMMISSION_STONE_COST       = 25;
export const COMMISSION_GOLD_COST        = 20;
export const COMMISSION_STONE_RATE       = 0.22;
export const COMMISSION_PRESTIGE_REWARD  = 22;
export const COMMISSION_MORALE_REWARD    = 10;
export const COMMISSION_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_MANA_COST          = 20;
export const PURCHASE_MANA_RATE          = 0.18;
export const PURCHASE_PRESTIGE_REWARD    = 15;
export const PURCHASE_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingGlassPainter() {
  if (!state.wanderingGlassPainter) {
    state.wanderingGlassPainter = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingGlassPainter;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits      = 0;
  if (s.totalCommissions  === undefined) s.totalCommissions = 0;
  if (s.totalPurchases    === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals  = 0;
}

export function wanderingGlassPainterTick() {
  const a = state.wanderingGlassPainter;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_GLASS_PAINTER_CHANGED, { expired: true });
      addMessage('🎨 The wandering glass painter carefully wraps the coloured glass fragments in cloth, rolls the cartoons back into their leather tube, and bows before departing from the palace — the vision of luminous cathedral windows fading with the footsteps.', 'info');
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
  emit(Events.WANDERING_GLASS_PAINTER_CHANGED, { spawned: true });
  addMessage('🎨 A wandering glass painter arrives at the palace carrying a leather satchel of coloured glass fragments, lead soldering tools, and rolled cartoons depicting luminous heraldic symbols — offering to commission magnificent stained glass windows for the imperial great hall, or to share the refined art of painted glass with the palace craftsmen. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingGlassPainter() { return state.wanderingGlassPainter?.active ?? null; }
export function getGlassPainterSecsLeft() {
  const a = state.wanderingGlassPainter?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionStainedGlassWindows() {
  const a = state.wanderingGlassPainter;
  if (!a?.active) return { ok: false, reason: 'No glass painter present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The glass painter has departed.' };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.stone -= COMMISSION_STONE_COST;
  state.resources.gold  -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned stained glass windows from the wandering glass painter');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'glassPainterCommission');
    state.randomEvents.activeModifiers.push({
      id: 'glassPainterCommission', resource: 'stone',
      rateMult: 1 + (COMMISSION_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_GLASS_PAINTER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🎨 The glass painter marshals the palace glaziers and begins cutting and soldering spectacular rose windows and heraldic panels, suffusing the imperial great hall with brilliant cascades of coloured light that lift the spirits of every courtier and dignitary who passes beneath them — the luminous craftsmanship drawing quarrying teams to bring fresh stone for mounting frames and expansion works! −${COMMISSION_STONE_COST} stone · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Stone surge: +${COMMISSION_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchasePaintingTechniques() {
  const a = state.wanderingGlassPainter;
  if (!a?.active) return { ok: false, reason: 'No glass painter present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The glass painter has departed.' };
  if ((state.resources.mana ?? 0) < PURCHASE_MANA_COST) return { ok: false, reason: `Need ${PURCHASE_MANA_COST} mana.` };
  state.resources.mana -= PURCHASE_MANA_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased glass painting techniques from the wandering glass painter');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'glassPainterPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'glassPainterPurchase', resource: 'mana',
      rateMult: 1 + (PURCHASE_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_GLASS_PAINTER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪟 The glass painter trades elaborate cartoons and colour-mixing formulas that reveal how powdered minerals and metallic oxides are suspended in molten glass to produce hues of celestial blue, sacred crimson, and golden amber — the palace alchemists immediately adapt the techniques to purify and concentrate mana-infused crystal preparations! −${PURCHASE_MANA_COST} mana · +${PURCHASE_PRESTIGE_REWARD} prestige. Mana surge: +${PURCHASE_MANA_RATE} mana/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendGlassPainterAway() {
  const a = state.wanderingGlassPainter;
  if (!a?.active) return { ok: false, reason: 'No glass painter present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_GLASS_PAINTER_CHANGED, { dismissed: true });
  addMessage('🎨 The wandering glass painter wraps the coloured fragments carefully and bows before departing from the palace — the light of imagined cathedral windows fading from view.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
