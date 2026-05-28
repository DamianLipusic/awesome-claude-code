/**
 * EmpireOS — Imperial Granary Master (T440).
 *
 * Every 14–18 minutes (Iron Age+, 10+ player tiles), an imperial granary
 * master arrives at the settlement bearing rolled architectural drawings
 * for the standard imperial granary design — a rectangular raised-floor
 * structure built on rows of short stone pillars called staddle stones that
 * lift the grain floor above the ground by two feet to allow air circulation
 * beneath the floor boards and prevent ground moisture from rising into the
 * grain mass, the walls constructed of closely fitted ashlar stone with
 * ventilation slots cut at regular intervals through the wall thickness at
 * floor level and below the eave line to allow a continuous current of dry
 * air to pass through the stored grain and carry away the moisture of
 * respiration from the living grain kernels before it can accumulate to
 * the humidity levels at which fungal growth begins, the roof pitched steeply
 * in the double-hipped imperial style with broad overhanging eaves that keep
 * driving rain from wetting the ventilation slots while allowing the free
 * movement of air, and the granary floor sealed with a lime-washed render
 * that discourages the burrowing insects that infest grain stored on bare
 * earthen floors — offering to commission a full imperial-specification
 * granary expansion built to the standard raised-floor ventilated design
 * using the settlement's own stone reserves and treasury resources, or to
 * share the complete storage optimisation and pest management techniques
 * that allow the settlement's grain stores to sustain larger populations
 * through winter and drought without significant spoilage losses. The
 * player has 80 seconds to decide.
 *
 * Choices:
 *   🏗️ Commission Imperial Granary   — pay 25 food + 20 gold
 *        → +0.22 food/s for 2.5 min · +22 prestige · +12 morale
 *   📖 Purchase Storage Techniques   — pay 20 mana
 *        → +0.18 mana/s for 2 min · +15 prestige
 *   🚶 Send Away                    — dismiss (no reward)
 *
 * state.imperialGranaryMaster = {
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

const SPAWN_MIN        = 14 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_FOOD_COST        = 25;
export const COMMISSION_GOLD_COST        = 20;
export const COMMISSION_FOOD_RATE        = 0.22;
export const COMMISSION_PRESTIGE_REWARD  = 22;
export const COMMISSION_MORALE_REWARD    = 12;
export const COMMISSION_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_MANA_COST          = 20;
export const PURCHASE_MANA_RATE          = 0.18;
export const PURCHASE_PRESTIGE_REWARD    = 15;
export const PURCHASE_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialGranaryMaster() {
  if (!state.imperialGranaryMaster) {
    state.imperialGranaryMaster = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialGranaryMaster;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialGranaryMasterTick() {
  const a = state.imperialGranaryMaster;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_GRANARY_MASTER_CHANGED, { expired: true });
      addMessage('🏗️ The imperial granary master carefully re-rolls the architectural drawings into their leather tube and departs along the road to the next commission.', 'info');
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
  emit(Events.IMPERIAL_GRANARY_MASTER_CHANGED, { spawned: true });
  addMessage('🏗️ An imperial granary master arrives at the settlement bearing detailed architectural drawings for the standard imperial raised-floor ventilated granary design — offering to commission a full imperial-specification granary expansion built with staddle stone pillars, ashlar walls, and properly ventilated construction using the settlement\'s own stone and treasury reserves, or to share the complete storage optimisation and pest management techniques for superior grain preservation year-round. Respond within 80 seconds.', 'info');
}

export function getActiveImperialGranaryMaster() { return state.imperialGranaryMaster?.active ?? null; }
export function getGranaryMasterSecsLeft() {
  const a = state.imperialGranaryMaster?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionImperialGranary() {
  const a = state.imperialGranaryMaster;
  if (!a?.active) return { ok: false, reason: 'No granary master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The granary master has departed.' };
  if ((state.resources.food ?? 0) < COMMISSION_FOOD_COST) return { ok: false, reason: `Need ${COMMISSION_FOOD_COST} food.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.food -= COMMISSION_FOOD_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned imperial granary expansion from the imperial granary master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'granaryMasterCommission');
    state.randomEvents.activeModifiers.push({
      id: 'granaryMasterCommission', resource: 'food',
      rateMult: 1 + (COMMISSION_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_GRANARY_MASTER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🏗️ The granary master surveys the settlement's existing storage facilities and selects the optimal site for the new granary annexe — laying out the staddle stone rows at the precise spacing that provides full floor support while maximising under-floor air circulation, dressing and fitting the ashlar wall courses to the ventilation slot pattern that achieves the required air exchange rate without admitting sufficient light to encourage pest breeding, pitching the double-hipped roof at the steep angle that sheds the heaviest downpour without water ingress at the eave ventilation openings, and applying the final lime-wash render to the interior floor and lower wall surfaces that discourages the grain weevil and beetle infestations that plague poorly sealed earthen-floor granaries — completing a granary expansion of imperial standard that materially increases the settlement's secure food storage capacity and brings lasting prosperity and stability to the population's food supply! −${COMMISSION_FOOD_COST} food · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Food surge: +${COMMISSION_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseStorageTechniques() {
  const a = state.imperialGranaryMaster;
  if (!a?.active) return { ok: false, reason: 'No granary master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The granary master has departed.' };
  if ((state.resources.mana ?? 0) < PURCHASE_MANA_COST) return { ok: false, reason: `Need ${PURCHASE_MANA_COST} mana.` };
  state.resources.mana -= PURCHASE_MANA_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased storage techniques from the imperial granary master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'granaryMasterPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'granaryMasterPurchase', resource: 'mana',
      rateMult: 1 + (PURCHASE_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_GRANARY_MASTER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The granary master shares the complete storage optimisation and pest management techniques — the grain moisture measurement method using a small sample jar and a careful feel for the grain temperature that identifies whether the bulk is heating from fungal activity or insect infestation before visible damage appears, the turning schedule and ventilation management that removes moisture accumulation from the grain mass during the critical early storage weeks when respiration rates are highest, the chaff and foreign seed separation sequence using the settlement's sieves and winnowing floor that removes the harbourage for weevil pupae that concentrate in the fine material settling through the grain column, the diatomaceous earth and bay leaf layering technique that creates a physical and aromatic barrier against insect reinfestation between harvests, and the record-keeping system that tracks storage duration and quality by bay for optimal first-in first-out rotation — knowledge that allows the settlement's grain keepers to maintain food reserves at high quality through full storage cycles without the customary losses to spoilage that erode even the best harvest. −${PURCHASE_MANA_COST} mana · +${PURCHASE_PRESTIGE_REWARD} prestige. Mana surge: +${PURCHASE_MANA_RATE} mana/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendGranaryMasterAway() {
  const a = state.imperialGranaryMaster;
  if (!a?.active) return { ok: false, reason: 'No granary master present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_GRANARY_MASTER_CHANGED, { dismissed: true });
  addMessage('🏗️ The imperial granary master carefully re-rolls the architectural drawings into their leather tube and departs along the road with a respectful nod.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
