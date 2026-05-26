/**
 * EmpireOS — Imperial Icon Painter (T416).
 *
 * Every 14–18 minutes (Medieval Age+, 10+ player tiles), an imperial icon
 * painter arrives at the palace carrying gilded oak icon boards, ground
 * lapis lazuli and malachite pigments, gold-leaf booklets, and a fine
 * collection of squirrel-hair icon brushes — offering to commission a series
 * of sacred icons for every chapel, throne hall, and officer's quarters in
 * the empire, or to sell the gilded iconography pattern book containing the
 * canonical face-proportions, halo geometry, and gold-leaf burnishing
 * techniques used in the imperial court tradition. The player has 80 seconds
 * to decide.
 *
 * Choices:
 *   🎨 Commission Sacred Icons     — pay 25 mana + 20 gold
 *        → +0.25 mana/s for 2.5 min · +22 prestige · +10 morale
 *   📖 Purchase Gilded Iconography — pay 20 stone
 *        → +0.18 stone/s for 2 min · +15 prestige
 *   🚶 Send Away                   — dismiss (no reward)
 *
 * state.imperialIconPainter = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalCommissioned:number,
 *   totalPurchased:   number,
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
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 3;   // Medieval Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_MANA_COST          = 25;
export const COMMISSION_GOLD_COST          = 20;
export const COMMISSION_MANA_RATE          = 0.25;
export const COMMISSION_PRESTIGE_REWARD    = 22;
export const COMMISSION_MORALE_REWARD      = 10;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_STONE_COST           = 20;
export const PURCHASE_STONE_RATE           = 0.18;
export const PURCHASE_PRESTIGE_REWARD      = 15;
export const PURCHASE_DURATION_TICKS       = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialIconPainter() {
  if (!state.imperialIconPainter) {
    state.imperialIconPainter = {
      active:            null,
      nextSpawnTick:     _nextSpawnTick(),
      totalVisits:       0,
      totalCommissioned: 0,
      totalPurchased:    0,
      totalDismissals:   0,
    };
  }
  const s = state.imperialIconPainter;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissioned=== undefined) s.totalCommissioned= 0;
  if (s.totalPurchased   === undefined) s.totalPurchased   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialIconPainterTick() {
  const a = state.imperialIconPainter;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_ICON_PAINTER_CHANGED, { expired: true });
      addMessage('🎨 The imperial icon painter wraps the gilded oak boards, lapis lazuli pigments, and gold-leaf booklets in the oiled-canvas transport rolls, gathers the squirrel-hair brushes into their ivory case, and departs the palace — the sacred icon commission and gilded pattern book passing unrealised as the artist\'s lacquered case disappears beyond the gatehouse arch.', 'info');
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
  emit(Events.IMPERIAL_ICON_PAINTER_CHANGED, { spawned: true });
  addMessage('🎨 An imperial icon painter arrives at the palace carrying gilded oak icon boards, ground lapis lazuli and malachite pigments, gold-leaf booklets, and fine squirrel-hair brushes — offering to commission a complete series of sacred icons for every chapel, throne hall, and officer\'s quarters in the empire, or to sell the gilded iconography pattern book containing canonical proportions and gold-leaf burnishing techniques. Respond within 80 seconds.', 'info');
}

export function getActiveImperialIconPainter() { return state.imperialIconPainter?.active ?? null; }
export function getIconPainterSecsLeft() {
  const a = state.imperialIconPainter?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionSacredIcons() {
  const a = state.imperialIconPainter;
  if (!a?.active) return { ok: false, reason: 'No icon painter present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The icon painter has departed.' };
  if ((state.resources.mana ?? 0) < COMMISSION_MANA_COST) return { ok: false, reason: `Need ${COMMISSION_MANA_COST} mana.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.mana -= COMMISSION_MANA_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned sacred icons from the imperial icon painter');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'iconPainterIcons');
    state.randomEvents.activeModifiers.push({
      id: 'iconPainterIcons', resource: 'mana',
      rateMult: 1 + (COMMISSION_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissioned = (a.totalCommissioned ?? 0) + 1;
  emit(Events.IMPERIAL_ICON_PAINTER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🎨 The icon painter prepares each gilded oak board with a chalk-and-rabbit-glue gesso ground, transfers the canonical face proportions and drapery folds using pricked cartoon paper, layers ground lapis lazuli and malachite pigments in the egg-tempera binder from shadow to highlight, and burnishes every halo, throne-back, and vestment border with double-layered gold leaf until the icons glow with the warm, deep luminosity of the imperial court tradition — a complete series installed in every chapel, throne hall, and officer's quarters across the empire! −${COMMISSION_MANA_COST} mana · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Mana surge: +${COMMISSION_MANA_RATE} mana/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseGildedIconography() {
  const a = state.imperialIconPainter;
  if (!a?.active) return { ok: false, reason: 'No icon painter present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The icon painter has departed.' };
  if ((state.resources.stone ?? 0) < PURCHASE_STONE_COST) return { ok: false, reason: `Need ${PURCHASE_STONE_COST} stone.` };
  state.resources.stone -= PURCHASE_STONE_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased gilded iconography from the imperial icon painter');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'iconPainterIconography');
    state.randomEvents.activeModifiers.push({
      id: 'iconPainterIconography', resource: 'stone',
      rateMult: 1 + (PURCHASE_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchased = (a.totalPurchased ?? 0) + 1;
  emit(Events.IMPERIAL_ICON_PAINTER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The icon painter opens the gilded pattern book and explains the mathematical canon governing face proportions, the specific gesso-layer thicknesses that prevent cracking on oak panel, the grinding and tempering ratios for each mineral pigment, and the leaf-by-leaf gold burnishing sequence that eliminates lifting and produces a mirror-smooth gold surface — the imperial stone masons and chapel architects absorb the precision-layout and material-preparation principles and apply the same exacting measurement and layering discipline to every carved stonework and decorative masonry commission across the empire! −${PURCHASE_STONE_COST} stone · +${PURCHASE_PRESTIGE_REWARD} prestige. Stone surge: +${PURCHASE_STONE_RATE} stone/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendIconPainterAway() {
  const a = state.imperialIconPainter;
  if (!a?.active) return { ok: false, reason: 'No icon painter present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_ICON_PAINTER_CHANGED, { dismissed: true });
  addMessage('🎨 The imperial icon painter wraps the lapis lazuli pigments and gold-leaf booklets in the transport rolls and departs the palace — the faint scent of beeswax and mineral pigment fading as the lacquered case disappears down the gatehouse road.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
