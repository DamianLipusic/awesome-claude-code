/**
 * EmpireOS — Wandering Bell Founder (T353).
 *
 * Every 12–17 minutes (Bronze Age+, 8+ player tiles), a wandering bell
 * founder arrives with a portable smelting forge and moulds for casting
 * resonant ceremonial bells. The player has 80 seconds to decide.
 *
 * Choices:
 *   🔔 Commission Temple Bells  — pay 25 iron + 20 stone
 *        → +0.22 iron/s for 2.5 min · +20 prestige · +12 morale
 *   📜 Purchase Bell-Casting Secrets — pay 22 gold
 *        → +0.15 gold/s for 2 min · +15 prestige
 *   👋 Send Away                — dismiss (no reward)
 *
 * state.wanderingBellFounder = {
 *   active:          { expiresAt: tick } | null,
 *   nextSpawnTick:   tick,
 *   totalVisits:     number,
 *   totalBells:      number,
 *   totalSecrets:    number,
 *   totalDismissals: number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 12 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 1;   // Bronze Age+
const MIN_PLAYER_TILES = 8;

export const BELLS_IRON_COST          = 25;
export const BELLS_STONE_COST         = 20;
export const BELLS_IRON_RATE          = 0.22;
export const BELLS_PRESTIGE_REWARD    = 20;
export const BELLS_MORALE_REWARD      = 12;
export const BELLS_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const SECRETS_GOLD_COST        = 22;
export const SECRETS_GOLD_RATE        = 0.15;
export const SECRETS_PRESTIGE_REWARD  = 15;
export const SECRETS_DURATION_TICKS   = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingBellFounder() {
  if (!state.wanderingBellFounder) {
    state.wanderingBellFounder = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalBells:      0,
      totalSecrets:    0,
      totalDismissals: 0,
    };
  }
  const s = state.wanderingBellFounder;
  if (s.nextSpawnTick   === undefined) s.nextSpawnTick   = _nextSpawnTick();
  if (s.totalVisits     === undefined) s.totalVisits     = 0;
  if (s.totalBells      === undefined) s.totalBells      = 0;
  if (s.totalSecrets    === undefined) s.totalSecrets    = 0;
  if (s.totalDismissals === undefined) s.totalDismissals = 0;
}

export function wanderingBellFounderTick() {
  const a = state.wanderingBellFounder;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_BELL_FOUNDER_CHANGED, { expired: true });
      addMessage('🔔 The wandering bell founder carefully packs the moulds and portable smelting tools, loading the cart before rumbling onward to seek a patron with more enthusiasm for the resonant craft of bell-casting.', 'info');
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
  emit(Events.WANDERING_BELL_FOUNDER_CHANGED, { spawned: true });
  addMessage('🔔 A wandering bell founder arrives with a portable smelting forge, intricate sand moulds, and a lifetime of expertise in casting ceremonial bells — from tiny chapel chimes to massive civic bells audible for miles. They offer to cast a glorious set of temple bells for your empire, or to sell the closely-guarded secrets of their resonant alloy formulas. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingBellFounder() { return state.wanderingBellFounder?.active ?? null; }
export function getBellFounderSecsLeft() {
  const a = state.wanderingBellFounder?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionTempleBells() {
  const a = state.wanderingBellFounder;
  if (!a?.active) return { ok: false, reason: 'No bell founder present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The bell founder has departed.' };
  if ((state.resources.iron  ?? 0) < BELLS_IRON_COST)  return { ok: false, reason: `Need ${BELLS_IRON_COST} iron.` };
  if ((state.resources.stone ?? 0) < BELLS_STONE_COST) return { ok: false, reason: `Need ${BELLS_STONE_COST} stone.` };
  state.resources.iron  -= BELLS_IRON_COST;
  state.resources.stone -= BELLS_STONE_COST;
  changeMorale(BELLS_MORALE_REWARD);
  awardPrestige(BELLS_PRESTIGE_REWARD, 'Commissioned a set of magnificent temple bells from the wandering bell founder');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'bellFounderBells');
    state.randomEvents.activeModifiers.push({
      id: 'bellFounderBells', resource: 'iron',
      rateMult: 1 + (BELLS_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + BELLS_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalBells = (a.totalBells ?? 0) + 1;
  emit(Events.WANDERING_BELL_FOUNDER_CHANGED, { bells: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🔔 The bell founder stokes the smelting forge to white heat, pours the molten alloy into carefully prepared sand moulds, and produces a magnificent set of temple bells — their resonant tones ring out across the city as citizens pause their work to listen in wonder. The rhythmic hammering and pouring inspires the ironworkers of the empire! −${BELLS_IRON_COST} iron · −${BELLS_STONE_COST} stone · +${BELLS_PRESTIGE_REWARD} prestige · +${BELLS_MORALE_REWARD} morale. Iron surge: +${BELLS_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseBellCastingSecrets() {
  const a = state.wanderingBellFounder;
  if (!a?.active) return { ok: false, reason: 'No bell founder present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The bell founder has departed.' };
  if ((state.resources.gold ?? 0) < SECRETS_GOLD_COST) return { ok: false, reason: `Need ${SECRETS_GOLD_COST} gold.` };
  state.resources.gold -= SECRETS_GOLD_COST;
  awardPrestige(SECRETS_PRESTIGE_REWARD, 'Purchased bell-casting alloy secrets from the wandering bell founder');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'bellFounderSecrets');
    state.randomEvents.activeModifiers.push({
      id: 'bellFounderSecrets', resource: 'gold',
      rateMult: 1 + (SECRETS_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + SECRETS_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalSecrets = (a.totalSecrets ?? 0) + 1;
  emit(Events.WANDERING_BELL_FOUNDER_CHANGED, { secrets: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The bell founder produces a leather-bound manuscript of closely-guarded alloy formulas — precise ratios of copper, tin, and trace elements that yield bells of exceptional tonal purity. The empire's craftsmen study the proportions eagerly, applying the metallurgical principles to improve dozens of metalworking processes and dramatically increasing production yields! −${SECRETS_GOLD_COST} gold · +${SECRETS_PRESTIGE_REWARD} prestige. Gold surge: +${SECRETS_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendBellFounderAway() {
  const a = state.wanderingBellFounder;
  if (!a?.active) return { ok: false, reason: 'No bell founder present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_BELL_FOUNDER_CHANGED, { dismissed: true });
  addMessage('🔔 The wandering bell founder nods respectfully, loads the portable forge and sand moulds back onto the cart, and trundles onward with the patient confidence of one whose craft will always find eager patrons elsewhere.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
