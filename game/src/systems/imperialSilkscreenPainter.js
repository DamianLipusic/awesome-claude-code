/**
 * EmpireOS — Imperial Silkscreen Painter (T428).
 *
 * Every 14–18 minutes (Medieval Age+, 10+ player tiles), an imperial
 * silkscreen painter arrives at the palace carrying a set of fine-mesh
 * silk screens stretched taut over hardwood frames sized to fit the most
 * common banner, wall panel, and tile border formats used in imperial
 * court decoration — each screen hand-drawn with a pattern resist of
 * boiled linseed oil and pine resin that blocks the pigment precisely
 * along every fine line and dot without bleeding into the surrounding
 * weave, together with a small locked cabinet of powdered mineral
 * pigments ground to identical particle size from lapis lazuli,
 * malachite, cinnabar, and white lead calcined to a stable oxide, all
 * pre-mixed into a thick water-based paste that transfers through the
 * mesh in a single firm squeegee pass and dries to a hard, colour-fast
 * surface that resists fading under both direct sunlight and lamp smoke —
 * offering to commission a full set of painted screen panels for the
 * imperial throne room and banqueting hall, or to purchase the complete
 * pigment formulas and screen-cutting method that allows every palace
 * workshop to produce consistent, high-quality painted decoration without
 * specialist oversight.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🎨 Commission Painted Screen Panels — pay 20 mana + 20 gold
 *        → +0.22 mana/s for 2.5 min · +20 prestige · +10 morale
 *   🖌️  Purchase Painting Pigment Formulas — pay 18 wood
 *        → +0.18 wood/s for 2 min · +12 prestige
 *   🚶 Send Away                           — dismiss (no reward)
 *
 * state.imperialSilkscreenPainter = {
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
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 3;   // Medieval Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_MANA_COST           = 20;
export const COMMISSION_GOLD_COST           = 20;
export const COMMISSION_MANA_RATE           = 0.22;
export const COMMISSION_PRESTIGE_REWARD     = 20;
export const COMMISSION_MORALE_REWARD       = 10;
export const COMMISSION_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_WOOD_COST             = 18;
export const PURCHASE_WOOD_RATE             = 0.18;
export const PURCHASE_PRESTIGE_REWARD       = 12;
export const PURCHASE_DURATION_TICKS        = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialSilkscreenPainter() {
  if (!state.imperialSilkscreenPainter) {
    state.imperialSilkscreenPainter = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialSilkscreenPainter;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialSilkscreenPainterTick() {
  const a = state.imperialSilkscreenPainter;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_SILKSCREEN_PAINTER_CHANGED, { expired: true });
      addMessage('🎨 The imperial silkscreen painter carefully re-wraps each silk screen frame in waxed linen to protect the resist pattern, closes the pigment cabinet, and departs the palace workshop — the faint scent of linseed oil and mineral pigment fading as the figure carries the screen frames down the corridor.', 'info');
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
  emit(Events.IMPERIAL_SILKSCREEN_PAINTER_CHANGED, { spawned: true });
  addMessage('🎨 An imperial silkscreen painter arrives at the palace carrying fine-mesh silk screens stretched over hardwood frames — each screen hand-drawn with a linseed oil and pine resin pattern resist, together with a locked cabinet of powdered mineral pigments from lapis lazuli, malachite, cinnabar, and white lead oxide ground to identical particle size and mixed into colour-fast paste that transfers through the mesh in a single squeegee pass and dries hard and fade-resistant — offering to commission a full set of painted panels for the throne room and banqueting hall, or to share the pigment formulas and screen-cutting method allowing every palace workshop to produce consistent high-quality decoration. Respond within 80 seconds.', 'info');
}

export function getActiveImperialSilkscreenPainter() { return state.imperialSilkscreenPainter?.active ?? null; }
export function getSilkscreenPainterSecsLeft() {
  const a = state.imperialSilkscreenPainter?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionPaintedScreenPanels() {
  const a = state.imperialSilkscreenPainter;
  if (!a?.active) return { ok: false, reason: 'No silkscreen painter present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The silkscreen painter has departed.' };
  if ((state.resources.mana ?? 0) < COMMISSION_MANA_COST) return { ok: false, reason: `Need ${COMMISSION_MANA_COST} mana.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.mana -= COMMISSION_MANA_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned painted screen panels from the imperial silkscreen painter');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'silkscreenCommission');
    state.randomEvents.activeModifiers.push({
      id: 'silkscreenCommission', resource: 'mana',
      rateMult: 1 + (COMMISSION_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_SILKSCREEN_PAINTER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🎨 The silkscreen painter selects the largest frames from the set — the throne room panels sized for the full wall height between the window piers, the banqueting hall frieze panels proportioned to wrap continuously around the room at eye level — lays the first frame flat on the preparation table, loads the pigment squeegee with lapis blue paste, and draws it across the mesh in a single firm pass that transfers the entire pattern resist in one motion, revealing the design in vivid blue mineral colour on the pale silk ground as the frame is lifted. The throne room and banqueting hall fill with glowing colour as panel after panel is completed and hung — every court visitor noting the richness and precision of the decoration with admiration! −${COMMISSION_MANA_COST} mana · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Mana surge: +${COMMISSION_MANA_RATE} mana/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchasePaintingPigmentFormulas() {
  const a = state.imperialSilkscreenPainter;
  if (!a?.active) return { ok: false, reason: 'No silkscreen painter present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The silkscreen painter has departed.' };
  if ((state.resources.wood ?? 0) < PURCHASE_WOOD_COST) return { ok: false, reason: `Need ${PURCHASE_WOOD_COST} wood.` };
  state.resources.wood -= PURCHASE_WOOD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased painting pigment formulas from the imperial silkscreen painter');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'silkscreenPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'silkscreenPurchase', resource: 'wood',
      rateMult: 1 + (PURCHASE_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_SILKSCREEN_PAINTER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🖌️ The silkscreen painter opens the pigment cabinet and shares the complete mineral preparation method — the lapis lazuli grinding sequence that reduces the raw stone to a particle size fine enough to pass cleanly through the mesh without clogging the silk threads, the calcination temperature and duration for white lead that converts it to a stable non-reactive oxide without losing covering power, the resin-to-oil ratio for the pattern resist that sets hard enough to block pigment precisely while remaining flexible enough not to crack when the screen is rolled for storage, and the squeegee pressure and angle that loads each pass with exactly the right amount of paste to transfer the full pattern without bleeding through the margins — knowledge that allows every palace workshop to mix and apply mineral colour to the same standard as a specialist using locally-sourced frame timber and imported pigment materials! −${PURCHASE_WOOD_COST} wood · +${PURCHASE_PRESTIGE_REWARD} prestige. Wood surge: +${PURCHASE_WOOD_RATE} wood/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendSilkscreenPainterAway() {
  const a = state.imperialSilkscreenPainter;
  if (!a?.active) return { ok: false, reason: 'No silkscreen painter present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_SILKSCREEN_PAINTER_CHANGED, { dismissed: true });
  addMessage('🎨 The imperial silkscreen painter re-wraps the silk screen frames in waxed linen, closes the pigment cabinet, and departs the palace workshop — nodding respectfully before carrying the screen frames back down the corridor.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
