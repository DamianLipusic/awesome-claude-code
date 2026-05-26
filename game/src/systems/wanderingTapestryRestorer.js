/**
 * EmpireOS — Wandering Tapestry Restorer (T409).
 *
 * Every 14–19 minutes (Medieval Age+, 10+ player tiles), a wandering tapestry
 * restorer arrives at the palace bearing rolled linen canvases, embroidery frames,
 * silk thread spools, and aged re-dyeing pigments — offering to undertake a full
 * restoration of the imperial tapestry collection depicting legendary conquests and
 * dynastic allegories, or to teach the palace artisans the advanced needle-work
 * and mordant-dyeing techniques used to preserve antique textile masterpieces.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🧵 Commission Tapestry Restoration  — pay 25 wood + 15 food
 *        → +0.22 wood/s for 2.5 min · +20 prestige · +10 morale
 *   🎨 Learn Restoration Arts           — pay 18 mana
 *        → +0.15 mana/s for 2 min · +15 prestige
 *   🚶 Send Away                         — dismiss (no reward)
 *
 * state.wanderingTapestryRestorer = {
 *   active:             { expiresAt: tick } | null,
 *   nextSpawnTick:      tick,
 *   totalVisits:        number,
 *   totalCommissions:   number,
 *   totalLearned:       number,
 *   totalDismissals:    number,
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

export const COMMISSION_WOOD_COST          = 25;
export const COMMISSION_FOOD_COST          = 15;
export const COMMISSION_WOOD_RATE          = 0.22;
export const COMMISSION_PRESTIGE_REWARD    = 20;
export const COMMISSION_MORALE_REWARD      = 10;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const LEARN_MANA_COST               = 18;
export const LEARN_MANA_RATE               = 0.15;
export const LEARN_PRESTIGE_REWARD         = 15;
export const LEARN_DURATION_TICKS          = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingTapestryRestorer() {
  if (!state.wanderingTapestryRestorer) {
    state.wanderingTapestryRestorer = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalLearned:     0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingTapestryRestorer;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick     = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits       = 0;
  if (s.totalCommissions  === undefined) s.totalCommissions  = 0;
  if (s.totalLearned      === undefined) s.totalLearned      = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals   = 0;
}

export function wanderingTapestryRestorerTick() {
  const a = state.wanderingTapestryRestorer;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_TAPESTRY_RESTORER_CHANGED, { expired: true });
      addMessage('🧵 The wandering tapestry restorer rolls the linen canvases back onto their wooden spools, packs the embroidery frames and silk thread into a padded chest, and departs the palace — the restoration commission passing unrealised as the cart of pigment jars and mordant pots disappears through the gatehouse.', 'info');
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
  emit(Events.WANDERING_TAPESTRY_RESTORER_CHANGED, { spawned: true });
  addMessage('🧵 A wandering tapestry restorer arrives at the palace bearing rolled linen canvases, embroidery frames, silk thread spools, and aged re-dyeing pigments — offering to undertake a full restoration of the imperial tapestry collection depicting legendary conquests and dynastic allegories, or to teach the palace artisans the advanced needle-work and mordant-dyeing techniques used to preserve antique textile masterpieces. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingTapestryRestorer() { return state.wanderingTapestryRestorer?.active ?? null; }
export function getTapestryRestorerSecsLeft() {
  const a = state.wanderingTapestryRestorer?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionTapestryRestoration() {
  const a = state.wanderingTapestryRestorer;
  if (!a?.active) return { ok: false, reason: 'No tapestry restorer present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The restorer has departed.' };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  state.resources.wood -= COMMISSION_WOOD_COST;
  state.resources.food -= COMMISSION_FOOD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned tapestry restoration from the wandering restorer');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'tapestryRestoreCommission');
    state.randomEvents.activeModifiers.push({
      id: 'tapestryRestoreCommission', resource: 'wood',
      rateMult: 1 + (COMMISSION_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.WANDERING_TAPESTRY_RESTORER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🧵 The restorer mounts the great tapestries on tension frames in the palace gallery, carefully unpicking broken threads with a fine awl and re-weaving the faded panels strand by strand using period-correct wool and silk dyed with indigo, madder, and weld — the revitalised tapestries depicting the empire's founding battles, legendary alliances, and age-defining moments in vivid colour once more, filling every dignitary and courtier who walks beneath them with renewed pride and imperial patriotism! −${COMMISSION_WOOD_COST} wood · −${COMMISSION_FOOD_COST} food · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Wood surge: +${COMMISSION_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function learnRestorationArts() {
  const a = state.wanderingTapestryRestorer;
  if (!a?.active) return { ok: false, reason: 'No tapestry restorer present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The restorer has departed.' };
  if ((state.resources.mana ?? 0) < LEARN_MANA_COST) return { ok: false, reason: `Need ${LEARN_MANA_COST} mana.` };
  state.resources.mana -= LEARN_MANA_COST;
  awardPrestige(LEARN_PRESTIGE_REWARD, 'Learned restoration arts from the wandering tapestry restorer');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'tapestryRestoreLearn');
    state.randomEvents.activeModifiers.push({
      id: 'tapestryRestoreLearn', resource: 'mana',
      rateMult: 1 + (LEARN_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + LEARN_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalLearned = (a.totalLearned ?? 0) + 1;
  emit(Events.WANDERING_TAPESTRY_RESTORER_CHANGED, { learned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🎨 The restorer spreads mordant sample boards across the workbench and demonstrates the precise temperature control and mineral salt ratios needed to achieve the richest, most light-fast dye bonds in wool and silk — the palace artisans absorb the chromatic chemistry, flux-mixing ratios, and needle-counting techniques used in the finest restoration ateliers, channelling the meditative precision of textile conservation into a more careful, focused approach to every creative and scholarly pursuit across the palace workshop! −${LEARN_MANA_COST} mana · +${LEARN_PRESTIGE_REWARD} prestige. Mana surge: +${LEARN_MANA_RATE} mana/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendTapestryRestorerAway() {
  const a = state.wanderingTapestryRestorer;
  if (!a?.active) return { ok: false, reason: 'No tapestry restorer present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_TAPESTRY_RESTORER_CHANGED, { dismissed: true });
  addMessage('🧵 The wandering tapestry restorer rolls the linen canvases onto their wooden bobbins, tucks the silk thread spools and mordant pigment jars back into the padded travelling chest, and departs the palace — the soft clatter of the embroidery frames fading as the restoration cart rounds the courtyard gate.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
