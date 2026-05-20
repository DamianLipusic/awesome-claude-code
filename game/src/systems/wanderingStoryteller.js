/**
 * EmpireOS — Wandering Storyteller (T347).
 *
 * Every 12–16 minutes (Stone Age+, 6+ player tiles), a wandering storyteller
 * arrives at the imperial court bearing epic chronicles, ancient tales, and
 * the stories of fallen kingdoms and great heroes. The player has 80 seconds
 * to decide.
 *
 * Choices:
 *   📜 Commission Epic Chronicle  — pay 25 gold
 *        → +0.2 gold/s for 2.5 min · +20 prestige · +12 morale
 *   📖 Listen to Ancient Tales    — free
 *        → +10 morale · +8 prestige
 *   👋 Send Away                  — dismiss (no reward)
 *
 * state.wanderingStoryteller = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalChronicles:  number,
 *   totalListens:     number,
 *   totalDismissals:  number,
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

export const CHRONICLE_GOLD_COST        = 25;
export const CHRONICLE_GOLD_RATE        = 0.2;
export const CHRONICLE_PRESTIGE_REWARD  = 20;
export const CHRONICLE_MORALE_REWARD    = 12;
export const CHRONICLE_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const TALES_MORALE_REWARD        = 10;
export const TALES_PRESTIGE_REWARD      = 8;

export function initWanderingStoryteller() {
  if (!state.wanderingStoryteller) {
    state.wanderingStoryteller = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalChronicles: 0,
      totalListens:    0,
      totalDismissals: 0,
    };
  }
  const s = state.wanderingStoryteller;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalChronicles  === undefined) s.totalChronicles  = 0;
  if (s.totalListens     === undefined) s.totalListens     = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingStorytellerTick() {
  const a = state.wanderingStoryteller;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_STORYTELLER_CHANGED, { expired: true });
      addMessage('📖 The wandering storyteller carefully rolls up the ancient manuscripts, packs the woven tale-scrolls into a weathered leather satchel, and continues their journey through distant kingdoms.', 'info');
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
  emit(Events.WANDERING_STORYTELLER_CHANGED, { spawned: true });
  addMessage('📖 A wandering storyteller arrives at the imperial court bearing hand-illustrated chronicles of fallen kingdoms, legendary heroes, and ancient wisdom. They offer to compose a grand epic chronicle of your empire\'s deeds, or simply share ancient tales from distant lands to inspire your people. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingStoryteller() { return state.wanderingStoryteller?.active ?? null; }
export function getStorytellerSecsLeft() {
  const a = state.wanderingStoryteller?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionEpicChronicle() {
  const a = state.wanderingStoryteller;
  if (!a?.active) return { ok: false, reason: 'No storyteller present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The storyteller has departed.' };
  if ((state.resources.gold ?? 0) < CHRONICLE_GOLD_COST) return { ok: false, reason: `Need ${CHRONICLE_GOLD_COST} gold.` };
  state.resources.gold -= CHRONICLE_GOLD_COST;
  changeMorale(CHRONICLE_MORALE_REWARD);
  awardPrestige(CHRONICLE_PRESTIGE_REWARD, 'Commissioned an epic chronicle from the wandering storyteller');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'storytellerChronicle');
    state.randomEvents.activeModifiers.push({
      id: 'storytellerChronicle', resource: 'gold',
      rateMult: 1 + (CHRONICLE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + CHRONICLE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalChronicles = (a.totalChronicles ?? 0) + 1;
  emit(Events.WANDERING_STORYTELLER_CHANGED, { chronicled: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The storyteller sets to work with gilded quill and finest vellum, composing a magnificent epic chronicle of your empire's conquests, alliances, and noble deeds. Copies are distributed throughout the realm, inspiring merchants and nobles to invest more heavily in the imperial treasury! −${CHRONICLE_GOLD_COST} gold · +${CHRONICLE_PRESTIGE_REWARD} prestige · +${CHRONICLE_MORALE_REWARD} morale. Trade surge: +${CHRONICLE_GOLD_RATE} gold/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function listenToAncientTales() {
  const a = state.wanderingStoryteller;
  if (!a?.active) return { ok: false, reason: 'No storyteller present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The storyteller has departed.' };
  changeMorale(TALES_MORALE_REWARD);
  awardPrestige(TALES_PRESTIGE_REWARD, 'Listened to ancient tales from the wandering storyteller');
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalListens = (a.totalListens ?? 0) + 1;
  emit(Events.WANDERING_STORYTELLER_CHANGED, { listened: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The storyteller gathers the court for an evening of captivating tales — legends of ancient kings, dragon-slaying heroes, and prosperous trade cities of old. The people leave inspired and uplifted! +${TALES_MORALE_REWARD} morale · +${TALES_PRESTIGE_REWARD} prestige.`, 'windfall');
  return { ok: true };
}

export function sendStorytellerAway() {
  const a = state.wanderingStoryteller;
  if (!a?.active) return { ok: false, reason: 'No storyteller present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_STORYTELLER_CHANGED, { dismissed: true });
  addMessage('📖 The wandering storyteller respectfully bows, gathers the ancient chronicles and tale-scrolls, and departs along the road to other kingdoms that may be more receptive to the timeless art of storytelling.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
