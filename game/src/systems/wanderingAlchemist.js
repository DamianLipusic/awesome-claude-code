/**
 * EmpireOS — Wandering Alchemist (T269).
 *
 * Every 14–18 minutes (Iron Age+, 10+ player tiles), a wandering alchemist
 * renowned for transmutation and arcane chemistry arrives at the imperial gates.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   ⚗️ Commission Transmutation  — pay 30 iron + 20 stone
 *        → +80 gold + 25 prestige
 *   🔮 Learn Alchemical Arts     — pay 25 mana
 *        → +0.15 mana/s for 2.5 min + 15 prestige
 *   🏠 Offer Laboratory Space    — pay 20 food
 *        → +10 morale + 8 prestige
 *
 * state.wanderingAlchemist = {
 *   active:                { expiresAt: tick } | null,
 *   nextSpawnTick:         tick,
 *   totalVisits:           number,
 *   totalTransmutations:   number,
 *   totalArts:             number,
 *   totalLabs:             number,
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

export const TRANSMUTE_IRON_COST    = 30;
export const TRANSMUTE_STONE_COST   = 20;
export const TRANSMUTE_GOLD_REWARD  = 80;
export const TRANSMUTE_PRESTIGE_REWARD = 25;

export const ARTS_MANA_COST         = 25;
export const ARTS_MANA_RATE         = 0.15;
export const ARTS_DURATION_TICKS    = Math.round(2.5 * 60 * TICKS_PER_SECOND);
export const ARTS_PRESTIGE_REWARD   = 15;

export const LAB_FOOD_COST          = 20;
export const LAB_MORALE_REWARD      = 10;
export const LAB_PRESTIGE_REWARD    = 8;

export function initWanderingAlchemist() {
  if (!state.wanderingAlchemist) {
    state.wanderingAlchemist = {
      active:              null,
      nextSpawnTick:       _nextSpawnTick(),
      totalVisits:         0,
      totalTransmutations: 0,
      totalArts:           0,
      totalLabs:           0,
    };
  }
  if (state.wanderingAlchemist.nextSpawnTick      === undefined) state.wanderingAlchemist.nextSpawnTick      = _nextSpawnTick();
  if (state.wanderingAlchemist.totalVisits        === undefined) state.wanderingAlchemist.totalVisits        = 0;
  if (state.wanderingAlchemist.totalTransmutations=== undefined) state.wanderingAlchemist.totalTransmutations= 0;
  if (state.wanderingAlchemist.totalArts          === undefined) state.wanderingAlchemist.totalArts          = 0;
  if (state.wanderingAlchemist.totalLabs          === undefined) state.wanderingAlchemist.totalLabs          = 0;
}

export function wanderingAlchemistTick() {
  const wa = state.wanderingAlchemist;
  if (!wa) return;
  if (wa.active) {
    if (state.tick >= wa.active.expiresAt) {
      wa.active = null; wa.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_ALCHEMIST_CHANGED, { expired: true });
      addMessage('⚗️ The wandering alchemist packs their vials and flasks, departing without a commission.', 'info');
    }
    return;
  }
  if (state.tick < wa.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  wa.active      = { expiresAt: state.tick + WINDOW_TICKS };
  wa.totalVisits = (wa.totalVisits ?? 0) + 1;
  emit(Events.WANDERING_ALCHEMIST_CHANGED, { spawned: true });
  addMessage('⚗️ A wandering alchemist renowned for transmutation and arcane chemistry has arrived at the imperial gates! Their secrets could unlock great wealth. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingAlchemist()  { return state.wanderingAlchemist?.active ?? null; }
export function getAlchemistSecsLeft() {
  const a = state.wanderingAlchemist?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionTransmutation() {
  const wa = state.wanderingAlchemist;
  if (!wa?.active) return { ok: false, reason: 'No alchemist present.' };
  if (state.tick >= wa.active.expiresAt) return { ok: false, reason: 'The alchemist has departed.' };
  if ((state.resources.iron  ?? 0) < TRANSMUTE_IRON_COST)  return { ok: false, reason: `Need ${TRANSMUTE_IRON_COST} iron.` };
  if ((state.resources.stone ?? 0) < TRANSMUTE_STONE_COST) return { ok: false, reason: `Need ${TRANSMUTE_STONE_COST} stone.` };
  state.resources.iron  -= TRANSMUTE_IRON_COST;
  state.resources.stone -= TRANSMUTE_STONE_COST;
  state.resources.gold  = (state.resources.gold ?? 0) + TRANSMUTE_GOLD_REWARD;
  awardPrestige(TRANSMUTE_PRESTIGE_REWARD, 'Commissioned alchemical transmutation');
  wa.active = null; wa.nextSpawnTick = _nextSpawnTick(); wa.totalTransmutations = (wa.totalTransmutations ?? 0) + 1;
  emit(Events.WANDERING_ALCHEMIST_CHANGED, { transmuted: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⚗️ The alchemist transmutes iron and stone into glittering gold! +${TRANSMUTE_GOLD_REWARD} gold · +${TRANSMUTE_PRESTIGE_REWARD} prestige. The imperial treasury overflows with newly coined wealth.`, 'windfall');
  return { ok: true };
}

export function learnAlchemicalArts() {
  const wa = state.wanderingAlchemist;
  if (!wa?.active) return { ok: false, reason: 'No alchemist present.' };
  if (state.tick >= wa.active.expiresAt) return { ok: false, reason: 'The alchemist has departed.' };
  if ((state.resources.mana ?? 0) < ARTS_MANA_COST) return { ok: false, reason: `Need ${ARTS_MANA_COST} mana.` };
  state.resources.mana -= ARTS_MANA_COST;
  awardPrestige(ARTS_PRESTIGE_REWARD, 'Learned alchemical arts from a wandering alchemist');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'alchemistArts');
    state.randomEvents.activeModifiers.push({
      id: 'alchemistArts', resource: 'mana',
      rateMult: 1 + (ARTS_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + ARTS_DURATION_TICKS,
    });
  }
  wa.active = null; wa.nextSpawnTick = _nextSpawnTick(); wa.totalArts = (wa.totalArts ?? 0) + 1;
  emit(Events.WANDERING_ALCHEMIST_CHANGED, { arts: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🔮 Imperial scholars absorb the alchemist's arcane teachings! +${ARTS_PRESTIGE_REWARD} prestige. Mana generation surges: +${ARTS_MANA_RATE} mana/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function offerLaboratorySpace() {
  const wa = state.wanderingAlchemist;
  if (!wa?.active) return { ok: false, reason: 'No alchemist present.' };
  if (state.tick >= wa.active.expiresAt) return { ok: false, reason: 'The alchemist has departed.' };
  if ((state.resources.food ?? 0) < LAB_FOOD_COST) return { ok: false, reason: `Need ${LAB_FOOD_COST} food.` };
  state.resources.food -= LAB_FOOD_COST;
  changeMorale(LAB_MORALE_REWARD);
  awardPrestige(LAB_PRESTIGE_REWARD, 'Offered laboratory space to a wandering alchemist');
  wa.active = null; wa.nextSpawnTick = _nextSpawnTick(); wa.totalLabs = (wa.totalLabs ?? 0) + 1;
  emit(Events.WANDERING_ALCHEMIST_CHANGED, { lab: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🏠 The alchemist graciously accepts imperial hospitality and conducts demonstrations for the people! +${LAB_MORALE_REWARD} morale · +${LAB_PRESTIGE_REWARD} prestige. Citizens marvel at the arcane displays.`, 'windfall');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
