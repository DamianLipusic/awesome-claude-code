/**
 * EmpireOS — Imperial Marble Polisher (T464).
 *
 * Every 13–17 minutes (Iron Age+, 10+ player tiles), an imperial marble
 * polisher arrives at the settlement carrying a series of abrasive tablets
 * progressing from coarse sandstone through increasingly fine grits of
 * pumice, tin oxide powder, and a final burnishing cloth charged with
 * finely ground hematite — demonstrating on a section of rough-cut limestone
 * how the progressive abrasion sequence reveals the stone's internal
 * crystalline structure and ultimately produces a mirror-bright surface that
 * reflects light as cleanly as polished bronze — offering to commission a
 * complete polished marble works installation for imperial architectural
 * projects, or to teach the full polishing methodology enabling permanent
 * stone-finishing capability. The player has 80 seconds to decide.
 *
 * Choices:
 *   🏛️ Commission Polished Marble Works — pay 25 stone + 20 gold
 *        → +0.22 stone/s for 2.5 min · +22 prestige · +12 morale
 *   🪨 Exchange Polishing Methods      — pay 20 iron
 *        → +0.18 iron/s for 2 min · +15 prestige
 *   🚶 Send Away                        — dismiss (no reward)
 *
 * state.imperialMarblePolisher = {
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

const SPAWN_MIN        = 13 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_STONE_COST          = 25;
export const COMMISSION_GOLD_COST           = 20;
export const COMMISSION_STONE_RATE          = 0.22;
export const COMMISSION_PRESTIGE_REWARD     = 22;
export const COMMISSION_MORALE_REWARD       = 12;
export const COMMISSION_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const EXCHANGE_IRON_COST             = 20;
export const EXCHANGE_IRON_RATE             = 0.18;
export const EXCHANGE_PRESTIGE_REWARD       = 15;
export const EXCHANGE_DURATION_TICKS        = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialMarblePolisher() {
  if (!state.imperialMarblePolisher) {
    state.imperialMarblePolisher = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialMarblePolisher;
  if (s.nextSpawnTick      === undefined) s.nextSpawnTick      = _nextSpawnTick();
  if (s.totalVisits        === undefined) s.totalVisits        = 0;
  if (s.totalCommissions   === undefined) s.totalCommissions   = 0;
  if (s.totalPurchases     === undefined) s.totalPurchases     = 0;
  if (s.totalDismissals    === undefined) s.totalDismissals    = 0;
}

export function imperialMarblePolisherTick() {
  const a = state.imperialMarblePolisher;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_MARBLE_POLISHER_CHANGED, { expired: true });
      addMessage('🏛️ The imperial marble polisher wraps the abrasive tablets in oiled cloth and departs toward the next construction site awaiting finishing work.', 'info');
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
  emit(Events.IMPERIAL_MARBLE_POLISHER_CHANGED, { spawned: true });
  addMessage('🏛️ An imperial marble polisher arrives at the settlement carrying a series of abrasive tablets progressing from coarse sandstone through pumice, tin oxide powder, and a final burnishing cloth charged with finely ground hematite — demonstrating on rough-cut limestone how progressive abrasion reveals the stone\'s internal crystalline structure and produces a mirror-bright surface reflecting light as cleanly as polished bronze. The polisher offers to commission a complete polished marble works installation for imperial architectural projects, or to teach the full polishing methodology. Respond within 80 seconds.', 'info');
}

export function getActiveImperialMarblePolisher() { return state.imperialMarblePolisher?.active ?? null; }
export function getMarblePolisherSecsLeft() {
  const a = state.imperialMarblePolisher?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionPolishedMarbleWorks() {
  const a = state.imperialMarblePolisher;
  if (!a?.active) return { ok: false, reason: 'No marble polisher present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The marble polisher has departed.' };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.stone -= COMMISSION_STONE_COST;
  state.resources.gold  -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned polished marble works from the imperial marble polisher');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'marblePolisherCommission');
    state.randomEvents.activeModifiers.push({
      id: 'marblePolisherCommission', resource: 'stone',
      rateMult: 1 + (COMMISSION_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_MARBLE_POLISHER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🏛️ The marble polisher establishes the workshop in a covered area adjacent to the stone yard — setting up the progression of abrasive stones on a long workbench: first the coarse sandstone tablets mounted in wooden frames, then the medium pumice blocks, then the fine pumice, then the tin oxide powder applied on felt pads, and finally the burnishing station where cloth charged with hematite brings the surface to its final mirror finish. The quarried stone is brought from the yard and worked through each stage: the coarse grind that removes saw marks and tool scars, leaving a surface uniformly rough but flat; the medium grind that removes the coarse scratches and begins to reveal the mineral grains; the fine pumice that smooths the surface until individual crystal faces are visible in low-angle light; the tin oxide polish that fills the microscopic irregularities between crystal faces until the surface reflectance rises to near-specular; and the final burnish that aligns the surface molecules into the smooth, hard skin that gives finished marble its characteristic cold, waxy sheen and virtual impermeability to staining. −${COMMISSION_STONE_COST} stone −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Stone surge: +${COMMISSION_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function exchangePolishingMethods() {
  const a = state.imperialMarblePolisher;
  if (!a?.active) return { ok: false, reason: 'No marble polisher present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The marble polisher has departed.' };
  if ((state.resources.iron ?? 0) < EXCHANGE_IRON_COST) return { ok: false, reason: `Need ${EXCHANGE_IRON_COST} iron.` };
  state.resources.iron -= EXCHANGE_IRON_COST;
  awardPrestige(EXCHANGE_PRESTIGE_REWARD, 'Exchanged polishing methods with the imperial marble polisher');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'marblePolisherExchange');
    state.randomEvents.activeModifiers.push({
      id: 'marblePolisherExchange', resource: 'iron',
      rateMult: 1 + (EXCHANGE_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + EXCHANGE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_MARBLE_POLISHER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪨 The marble polisher spreads the method charts across the worktable and explains each abrasive stage in precise technical terms — the mineral hardness required at each step and why using a grit finer than necessary at the coarse stage wastes time while a grit coarser than necessary at the fine stage creates deep scratches that the subsequent stages must remove rather than refine; the correct lubricant at each stage, ranging from water for the coarse work to olive oil for the fine pumice that allows the abrasive particles to roll rather than plough; the detection method for knowing when a stage is complete — holding the surface at a low angle to a lamp and watching the reflectance pattern, which will show a uniform circular sheen when all the scratches from the previous grit have been replaced by the finer, shallower scratches of the current one; the iron tools used in conjunction with the stone — the flat-faced rubbing block for plane surfaces, the profiled blocks of various curvatures for mouldings and rounded elements, the twisted cord technique for concave surfaces where no flat tool can reach. The tin oxide preparation method is included: the calcination temperature that converts metallic tin to the fine white powder, the mesh fineness required for the polishing grade, the binding medium that keeps it evenly distributed on the felt pad without caking or rolling into abrasive lumps. −${EXCHANGE_IRON_COST} iron · +${EXCHANGE_PRESTIGE_REWARD} prestige. Iron surge: +${EXCHANGE_IRON_RATE} iron/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendMarblePolisherAway() {
  const a = state.imperialMarblePolisher;
  if (!a?.active) return { ok: false, reason: 'No marble polisher present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_MARBLE_POLISHER_CHANGED, { dismissed: true });
  addMessage('🏛️ The imperial marble polisher wraps the abrasive tablets in oiled cloth and departs toward the next construction site awaiting finishing work.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
