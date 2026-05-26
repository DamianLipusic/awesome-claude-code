/**
 * EmpireOS — Imperial Harbor Master (T410).
 *
 * Every 14–18 minutes (Iron Age+, 12+ player tiles), an imperial harbor master
 * arrives at the palace bearing rolled nautical charts, timber-gauge calipers,
 * iron anchor-chain samples, and ledgers of dock-tariff schedules — offering to
 * oversee construction of new deep-water berths and cargo cranes that will expand
 * the empire's maritime trade capacity, or to share a comprehensive study of
 * maritime law, safe-passage agreements, and tidal almanacs used to maximise
 * stone quarry barge efficiency along the empire's river and coastal routes.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   ⚓ Commission Harbor Works          — pay 30 wood + 20 gold
 *        → +0.25 wood/s for 2.5 min · +25 prestige · +12 morale
 *   📖 Study Maritime Law              — pay 25 stone
 *        → +0.20 stone/s for 2 min · +18 prestige
 *   🚶 Send Away                        — dismiss (no reward)
 *
 * state.imperialHarborMaster = {
 *   active:             { expiresAt: tick } | null,
 *   nextSpawnTick:      tick,
 *   totalVisits:        number,
 *   totalCommissions:   number,
 *   totalStudied:       number,
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
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 12;

export const COMMISSION_WOOD_COST          = 30;
export const COMMISSION_GOLD_COST          = 20;
export const COMMISSION_WOOD_RATE          = 0.25;
export const COMMISSION_PRESTIGE_REWARD    = 25;
export const COMMISSION_MORALE_REWARD      = 12;
export const COMMISSION_DURATION_TICKS     = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const STUDY_STONE_COST              = 25;
export const STUDY_STONE_RATE             = 0.20;
export const STUDY_PRESTIGE_REWARD         = 18;
export const STUDY_DURATION_TICKS          = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialHarborMaster() {
  if (!state.imperialHarborMaster) {
    state.imperialHarborMaster = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalStudied:     0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialHarborMaster;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick     = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits       = 0;
  if (s.totalCommissions  === undefined) s.totalCommissions  = 0;
  if (s.totalStudied      === undefined) s.totalStudied      = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals   = 0;
}

export function imperialHarborMasterTick() {
  const a = state.imperialHarborMaster;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_HARBOR_MASTER_CHANGED, { expired: true });
      addMessage('⚓ The imperial harbor master rolls the nautical charts back into their oilskin tubes, packs the timber-gauge calipers and anchor-chain samples into a brass-clasped satchel, and departs the palace — the harbor commission and maritime study offer passing unrealised as the dock-ledger cart rumbles back down the quayside road.', 'info');
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
  emit(Events.IMPERIAL_HARBOR_MASTER_CHANGED, { spawned: true });
  addMessage('⚓ An imperial harbor master arrives at the palace bearing rolled nautical charts, timber-gauge calipers, iron anchor-chain samples, and ledgers of dock-tariff schedules — offering to oversee construction of new deep-water berths and cargo cranes that will expand the empire\'s maritime trade capacity, or to share a comprehensive study of maritime law, safe-passage agreements, and tidal almanacs used to maximise stone quarry barge efficiency along the empire\'s river and coastal routes. Respond within 80 seconds.', 'info');
}

export function getActiveImperialHarborMaster() { return state.imperialHarborMaster?.active ?? null; }
export function getHarborMasterSecsLeft() {
  const a = state.imperialHarborMaster?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionHarborWorks() {
  const a = state.imperialHarborMaster;
  if (!a?.active) return { ok: false, reason: 'No harbor master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The harbor master has departed.' };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.wood -= COMMISSION_WOOD_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned harbor works from the imperial harbor master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'harborCommission');
    state.randomEvents.activeModifiers.push({
      id: 'harborCommission', resource: 'wood',
      rateMult: 1 + (COMMISSION_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_HARBOR_MASTER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⚓ The harbor master leads a corps of master shipwrights and dock engineers to the waterfront, driving oak piles into the riverbed with iron-headed rams and assembling seasoned timber gantry cranes fitted with block-and-tackle cargo hoists — the new deep-water berths accommodate far larger cargo barges loaded with freshly sawn timber from the imperial forestry mills, and the efficient crane-assisted loading dramatically cuts the turnaround time for every lumber shipment arriving at the palace yards! −${COMMISSION_WOOD_COST} wood · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Wood surge: +${COMMISSION_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function studyMaritimeLaw() {
  const a = state.imperialHarborMaster;
  if (!a?.active) return { ok: false, reason: 'No harbor master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The harbor master has departed.' };
  if ((state.resources.stone ?? 0) < STUDY_STONE_COST) return { ok: false, reason: `Need ${STUDY_STONE_COST} stone.` };
  state.resources.stone -= STUDY_STONE_COST;
  awardPrestige(STUDY_PRESTIGE_REWARD, 'Studied maritime law from the imperial harbor master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'harborStudy');
    state.randomEvents.activeModifiers.push({
      id: 'harborStudy', resource: 'stone',
      rateMult: 1 + (STUDY_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + STUDY_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalStudied = (a.totalStudied ?? 0) + 1;
  emit(Events.IMPERIAL_HARBOR_MASTER_CHANGED, { studied: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The harbor master opens the tidal almanac to the quarry-barge scheduling tables and walks the palace engineers through the optimal loading windows keyed to spring-tide depth soundings, explaining how the correct use of safe-passage agreements and river-right tariffs clears priority channels for heavy stone barges on the empire's busiest inland waterways — the engineers immediately reroute the quarry barge convoys to arrive at peak flood tide, raising the effective stone delivery rate to the palace masonry yards by eliminating the silting delays that previously stranded laden barges on the upstream shallows! −${STUDY_STONE_COST} stone · +${STUDY_PRESTIGE_REWARD} prestige. Stone surge: +${STUDY_STONE_RATE} stone/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendHarborMasterAway() {
  const a = state.imperialHarborMaster;
  if (!a?.active) return { ok: false, reason: 'No harbor master present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_HARBOR_MASTER_CHANGED, { dismissed: true });
  addMessage('⚓ The imperial harbor master rolls the nautical charts back into their oilskin tubes, secures the timber-gauge calipers and anchor-chain samples, and departs the palace — the quiet creak of dock-ledger bindings fading as the harbor commission cart rolls back through the gatehouse arch.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
