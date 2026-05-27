/**
 * EmpireOS — Imperial Mason's Guild (T430).
 *
 * Every 14–18 minutes (Iron Age+, 12+ player tiles), a delegation from
 * the imperial mason's guild arrives at the palace carrying a set of
 * master drawings on vellum — elevation sections through the full wall
 * thickness from rubble core to dressed ashlar face, mortar joint
 * profiles with the exact aggregate grading and lime-to-sand ratios
 * tested and refined over multiple construction seasons, voussoir
 * templates for arches and vault ribs cut from thin hardwood sheet to
 * the exact intrados and extrados curvature, and a bound ledger of
 * stone performance records noting the compressive strength, frost
 * resistance, and bed-face orientation for every quarry the guild has
 * worked — offering to commission a complete stone masonry expansion
 * of the imperial fortifications using guild labour and stone drawn
 * directly from the current stockpile, or to purchase the guild's
 * complete masonry secrets covering the mortar preparation, ashlar
 * dressing, and arch-construction methods that allow every imperial
 * building crew to produce work of guild quality without specialist
 * oversight.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🏛️  Commission Stone Masonry Works — pay 30 stone + 20 gold
 *        → +0.25 stone/s for 2.5 min · +25 prestige · +12 morale
 *   📐 Purchase Guild Masonry Secrets  — pay 25 iron
 *        → +0.20 iron/s for 2 min · +18 prestige
 *   🚶 Send Away                        — dismiss (no reward)
 *
 * state.imperialMasonsGuild = {
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
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 12;

export const COMMISSION_STONE_COST          = 30;
export const COMMISSION_GOLD_COST           = 20;
export const COMMISSION_STONE_RATE          = 0.25;
export const COMMISSION_PRESTIGE_REWARD     = 25;
export const COMMISSION_MORALE_REWARD       = 12;
export const COMMISSION_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_IRON_COST             = 25;
export const PURCHASE_IRON_RATE             = 0.20;
export const PURCHASE_PRESTIGE_REWARD       = 18;
export const PURCHASE_DURATION_TICKS        = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialMasonsGuild() {
  if (!state.imperialMasonsGuild) {
    state.imperialMasonsGuild = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialMasonsGuild;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialMasonsGuildTick() {
  const a = state.imperialMasonsGuild;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_MASONS_GUILD_CHANGED, { expired: true });
      addMessage('🏛️ The imperial mason\'s guild delegation rolls up the master drawings, returns the voussoir templates to their carrying case, and departs the palace — the guild master offering a respectful bow before the delegation files out through the archway and down the road toward the next commission on the seasonal schedule.', 'info');
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
  emit(Events.IMPERIAL_MASONS_GUILD_CHANGED, { spawned: true });
  addMessage('🏛️ A delegation from the imperial mason\'s guild arrives at the palace carrying a set of master drawings on vellum — elevation sections through the full wall thickness from rubble core to dressed ashlar face, mortar joint profiles with exact aggregate grading and lime-to-sand ratios, voussoir templates for arches and vault ribs, and a bound ledger of stone performance records noting compressive strength, frost resistance, and bed-face orientation for every quarry the guild has worked — offering to commission a complete stone masonry expansion of the imperial fortifications using guild labour and current stone stockpile, or to purchase the guild\'s complete masonry secrets for mortar preparation, ashlar dressing, and arch construction. Respond within 80 seconds.', 'info');
}

export function getActiveImperialMasonsGuild() { return state.imperialMasonsGuild?.active ?? null; }
export function getMasonsGuildSecsLeft() {
  const a = state.imperialMasonsGuild?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionStoneMasonryWorks() {
  const a = state.imperialMasonsGuild;
  if (!a?.active) return { ok: false, reason: 'No mason\'s guild delegation present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The mason\'s guild delegation has departed.' };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.stone -= COMMISSION_STONE_COST;
  state.resources.gold  -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned stone masonry works from the imperial mason\'s guild');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'masonsGuildCommission');
    state.randomEvents.activeModifiers.push({
      id: 'masonsGuildCommission', resource: 'stone',
      rateMult: 1 + (COMMISSION_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_MASONS_GUILD_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🏛️ The guild master unrolls the elevation drawings across the planning table, traces the full wall section from rubble-filled core to the dressed ashlar facing course, shows the mortar joint profile with the exact aggregate grading and lime ratio to be used at each layer, and directs the guild crew to begin setting out the foundation line with a stretched cord and plumb bobs calibrated to the site datum — each stone selected from the stockpile by face orientation and compressive grade, dressed to the template dimensions on the banker before being lifted into position with the stone crane, and bedded into mortar mixed to the guild specification and left to cure under damp hessian for the prescribed period before the next course is laid. The imperial fortifications grow stronger and more imposing with each completed section as guild-trained masons work with a precision and speed that draws admiring attention from allies and warns enemies of the empire's enduring power! −${COMMISSION_STONE_COST} stone · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Stone surge: +${COMMISSION_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseGuildMasonrySecrets() {
  const a = state.imperialMasonsGuild;
  if (!a?.active) return { ok: false, reason: 'No mason\'s guild delegation present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The mason\'s guild delegation has departed.' };
  if ((state.resources.iron ?? 0) < PURCHASE_IRON_COST) return { ok: false, reason: `Need ${PURCHASE_IRON_COST} iron.` };
  state.resources.iron -= PURCHASE_IRON_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased guild masonry secrets from the imperial mason\'s guild');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'masonsGuildPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'masonsGuildPurchase', resource: 'iron',
      rateMult: 1 + (PURCHASE_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_MASONS_GUILD_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📐 The guild master opens the bound ledger to the mortar preparation section and shares the complete methodology — the slaking schedule for quicklime that produces a smooth, plastic putty without overheating the mix and destroying the binding compounds, the aggregate grading sequence that sieves quarry sand through three successive mesh sizes to remove oversized fragments that weaken the joint and fine clay particles that cause shrinkage cracking, the water-to-lime ratio range that produces a mortar workable enough to tool cleanly but stiff enough to support the stone weight without squeezing out under load, and the curing protocol that keeps the fresh mortar damp for the first seven days to develop full carbonation strength before the next course is loaded — together with the ashlar dressing sequence that produces a flat bed-face accurate to a single hair-width using a dragged steel straight-edge rather than a ground surface plate, and the voussoir setting method that maintains the arch geometry through the closing-stone installation without temporary centering. Knowledge that allows every imperial building crew to produce work of guild quality using standard site tools and locally-sourced lime and aggregate materials! −${PURCHASE_IRON_COST} iron · +${PURCHASE_PRESTIGE_REWARD} prestige. Iron surge: +${PURCHASE_IRON_RATE} iron/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendMasonsGuildAway() {
  const a = state.imperialMasonsGuild;
  if (!a?.active) return { ok: false, reason: 'No mason\'s guild delegation present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_MASONS_GUILD_CHANGED, { dismissed: true });
  addMessage('🏛️ The imperial mason\'s guild delegation rolls up the master drawings, returns the voussoir templates to their carrying case, and departs the palace — the guild master offering a respectful bow before the delegation files out through the archway.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
