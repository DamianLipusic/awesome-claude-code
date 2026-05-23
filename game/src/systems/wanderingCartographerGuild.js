/**
 * EmpireOS — Wandering Cartographer's Guild (T373).
 *
 * Every 12–17 minutes (Bronze Age+, 8+ player tiles), a band of wandering
 * cartographers arrives at the palace bearing rolled parchment surveys,
 * polished brass instruments, and fine quill sets — offering to chart the
 * surrounding territory in exhaustive detail or sell their precision
 * surveying tools to the imperial engineers.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🗺️ Commission Regional Survey — pay 25 wood + 15 gold
 *        → +0.22 wood/s for 2.5 min · +20 prestige · +8 morale
 *   🔭 Purchase Surveying Instruments — pay 20 gold
 *        → +0.15 gold/s for 2 min · +12 prestige
 *   🚶 Send Away                — dismiss (no reward)
 *
 * state.wanderingCartographerGuild = {
 *   active:             { expiresAt: tick } | null,
 *   nextSpawnTick:      tick,
 *   totalVisits:        number,
 *   totalSurveys:       number,
 *   totalPurchases:     number,
 *   totalDismissals:    number,
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

export const SURVEY_WOOD_COST           = 25;
export const SURVEY_GOLD_COST           = 15;
export const SURVEY_WOOD_RATE           = 0.22;
export const SURVEY_PRESTIGE_REWARD     = 20;
export const SURVEY_MORALE_REWARD       = 8;
export const SURVEY_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST         = 20;
export const PURCHASE_GOLD_RATE         = 0.15;
export const PURCHASE_PRESTIGE_REWARD   = 12;
export const PURCHASE_DURATION_TICKS    = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingCartographerGuild() {
  if (!state.wanderingCartographerGuild) {
    state.wanderingCartographerGuild = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalSurveys:    0,
      totalPurchases:  0,
      totalDismissals: 0,
    };
  }
  const s = state.wanderingCartographerGuild;
  if (s.nextSpawnTick   === undefined) s.nextSpawnTick   = _nextSpawnTick();
  if (s.totalVisits     === undefined) s.totalVisits     = 0;
  if (s.totalSurveys    === undefined) s.totalSurveys    = 0;
  if (s.totalPurchases  === undefined) s.totalPurchases  = 0;
  if (s.totalDismissals === undefined) s.totalDismissals = 0;
}

export function wanderingCartographerGuildTick() {
  const a = state.wanderingCartographerGuild;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_CARTOGRAPHER_GUILD_CHANGED, { expired: true });
      addMessage('🗺️ The cartographer\'s guild rolls up their survey parchments, stows the brass instruments in padded cases, and departs with a courteous bow — the measured footsteps of the survey party fading beyond the palace gates.', 'info');
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
  emit(Events.WANDERING_CARTOGRAPHER_GUILD_CHANGED, { spawned: true });
  addMessage('🗺️ A wandering cartographer\'s guild arrives at the palace bearing beautifully rolled parchment surveys, polished brass measuring instruments, and quill sets of exceptional quality — offering to chart the surrounding territory in exhaustive detail or sell their precision surveying tools to the imperial engineers. Respond within 80 seconds.', 'info');
}

export function getActiveCartographerGuild() { return state.wanderingCartographerGuild?.active ?? null; }
export function getCartographerGuildSecsLeft() {
  const a = state.wanderingCartographerGuild?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionRegionalSurvey() {
  const a = state.wanderingCartographerGuild;
  if (!a?.active) return { ok: false, reason: 'No cartographer guild present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The guild has departed.' };
  if ((state.resources.wood ?? 0) < SURVEY_WOOD_COST) return { ok: false, reason: `Need ${SURVEY_WOOD_COST} wood.` };
  if ((state.resources.gold ?? 0) < SURVEY_GOLD_COST) return { ok: false, reason: `Need ${SURVEY_GOLD_COST} gold.` };
  state.resources.wood -= SURVEY_WOOD_COST;
  state.resources.gold -= SURVEY_GOLD_COST;
  changeMorale(SURVEY_MORALE_REWARD);
  awardPrestige(SURVEY_PRESTIGE_REWARD, 'Commissioned a regional survey from the wandering cartographer guild');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'cartGuildSurvey');
    state.randomEvents.activeModifiers.push({
      id: 'cartGuildSurvey', resource: 'wood',
      rateMult: 1 + (SURVEY_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + SURVEY_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalSurveys = (a.totalSurveys ?? 0) + 1;
  emit(Events.WANDERING_CARTOGRAPHER_GUILD_CHANGED, { surveyed: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🗺️ The cartographers fan out across the realm with their measuring chains and drawing boards — every forest track, stream crossing, and timber stand meticulously recorded on great folding maps. The imperial foresters use the new charts to optimise timber collection across the entire province! −${SURVEY_WOOD_COST} wood · −${SURVEY_GOLD_COST} gold · +${SURVEY_PRESTIGE_REWARD} prestige · +${SURVEY_MORALE_REWARD} morale. Wood surge: +${SURVEY_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseSurveyingInstruments() {
  const a = state.wanderingCartographerGuild;
  if (!a?.active) return { ok: false, reason: 'No cartographer guild present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The guild has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased surveying instruments from the wandering cartographer guild');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'cartGuildPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'cartGuildPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_CARTOGRAPHER_GUILD_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🔭 The guild's master surveyor presents a full set of brass theodolites, measuring chains, and drawing compasses to the palace trade committee — the imperial merchants quickly apply the precision instruments to route planning and customs assessment, streamlining levy collection at every toll gate! −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendCartographerGuildAway() {
  const a = state.wanderingCartographerGuild;
  if (!a?.active) return { ok: false, reason: 'No cartographer guild present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_CARTOGRAPHER_GUILD_CHANGED, { dismissed: true });
  addMessage('🗺️ The cartographer\'s guild ties the survey rolls with cord, stows the brass instruments in padded cases, and files out through the palace gate with quiet dignity — the soft scratch of quill on parchment already fading from the courtyard.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
