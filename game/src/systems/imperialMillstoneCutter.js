/**
 * EmpireOS — Imperial Millstone Cutter (T414).
 *
 * Every 13–18 minutes (Iron Age+, 10+ player tiles), an imperial millstone
 * cutter arrives at the palace bearing a set of dressed gritstone and
 * sandstone millstone pairs, iron-fitted runner and bedstone sets, and a
 * portfolio of mill-house blueprint designs — offering to commission a full
 * set of imperial grinding millstones fitted with precision-balanced iron
 * drive shafts for every grain mill and ore-crushing facility in the realm,
 * or to sell the specialist stone-dressing, furrow-cutting, and balancing
 * techniques that keep millstones grinding at peak efficiency for decades.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   ⚙️ Commission Grinding Millstones — pay 25 stone + 20 gold
 *        → +0.22 stone/s for 2.5 min · +20 prestige · +10 morale
 *   🪨 Purchase Milling Designs       — pay 20 iron
 *        → +0.18 iron/s for 2 min · +15 prestige
 *   🚶 Send Away                      — dismiss (no reward)
 *
 * state.imperialMillstoneCutter = {
 *   active:             { expiresAt: tick } | null,
 *   nextSpawnTick:      tick,
 *   totalVisits:        number,
 *   totalCommissions:   number,
 *   totalPurchased:     number,
 *   totalDismissals:    number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 13 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_STONE_COST          = 25;
export const COMMISSION_GOLD_COST           = 20;
export const COMMISSION_STONE_RATE          = 0.22;
export const COMMISSION_PRESTIGE_REWARD     = 20;
export const COMMISSION_MORALE_REWARD       = 10;
export const COMMISSION_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_IRON_COST             = 20;
export const PURCHASE_IRON_RATE             = 0.18;
export const PURCHASE_PRESTIGE_REWARD       = 15;
export const PURCHASE_DURATION_TICKS        = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialMillstoneCutter() {
  if (!state.imperialMillstoneCutter) {
    state.imperialMillstoneCutter = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchased:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialMillstoneCutter;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchased   === undefined) s.totalPurchased   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialMillstoneCutterTick() {
  const a = state.imperialMillstoneCutter;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_MILLSTONE_CUTTER_CHANGED, { expired: true });
      addMessage('⚙️ The imperial millstone cutter rewraps the dressed gritstone pairs in their burlap covers, secures the iron-fitted drive shafts and furrow-cutting chisels in the travelling chest, and departs the palace — the millstone commission and milling-designs offer passing unrealised as the cart of millstone pairs and blueprint portfolios disappears through the gatehouse.', 'info');
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
  emit(Events.IMPERIAL_MILLSTONE_CUTTER_CHANGED, { spawned: true });
  addMessage('⚙️ An imperial millstone cutter arrives at the palace bearing a set of dressed gritstone and sandstone millstone pairs, iron-fitted runner and bedstone sets, and a portfolio of mill-house blueprint designs — offering to commission a full set of imperial grinding millstones fitted with precision-balanced iron drive shafts for every grain mill and ore-crushing facility in the realm, or to sell the specialist stone-dressing, furrow-cutting, and balancing techniques that keep millstones grinding at peak efficiency for decades. Respond within 80 seconds.', 'info');
}

export function getActiveImperialMillstoneCutter() { return state.imperialMillstoneCutter?.active ?? null; }
export function getMillstoneCutterSecsLeft() {
  const a = state.imperialMillstoneCutter?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionGrindingMillstones() {
  const a = state.imperialMillstoneCutter;
  if (!a?.active) return { ok: false, reason: 'No millstone cutter present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The millstone cutter has departed.' };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.stone -= COMMISSION_STONE_COST;
  state.resources.gold  -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned grinding millstones from the imperial millstone cutter');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'millstoneCommission');
    state.randomEvents.activeModifiers.push({
      id: 'millstoneCommission', resource: 'stone',
      rateMult: 1 + (COMMISSION_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_MILLSTONE_CUTTER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⚙️ The millstone cutter selects the finest gritstone blocks from the quarry stockpile and begins the delicate work of dressing each face — scoring the furrow pattern with a millbill, undercutting the lands to the precise depth that channels grain outward from the eye without excessive heat, and fitting the iron-banded runner stone onto its spindle with a balance test to within a hair's width of true — every grain mill and ore crusher in the realm receives replacement millstone pairs that grind harder, faster, and longer without redressing, flooding the imperial stockpiles with finely processed grain and crushed ore! −${COMMISSION_STONE_COST} stone · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Stone surge: +${COMMISSION_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseMillingDesigns() {
  const a = state.imperialMillstoneCutter;
  if (!a?.active) return { ok: false, reason: 'No millstone cutter present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The millstone cutter has departed.' };
  if ((state.resources.iron ?? 0) < PURCHASE_IRON_COST) return { ok: false, reason: `Need ${PURCHASE_IRON_COST} iron.` };
  state.resources.iron -= PURCHASE_IRON_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased milling designs from the imperial millstone cutter');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'millstonePurchase');
    state.randomEvents.activeModifiers.push({
      id: 'millstonePurchase', resource: 'iron',
      rateMult: 1 + (PURCHASE_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchased = (a.totalPurchased ?? 0) + 1;
  emit(Events.IMPERIAL_MILLSTONE_CUTTER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪨 The millstone cutter unrolls the portfolio of mill-house blueprints and explains the geometry of the furrow pattern — the precise bill-track angle, land width, and cracking zone that converts raw grain or ore into the finest ground output with the least heat and the lowest rate of stone wear — the imperial smiths and quarrymen absorb the stone-selection and iron-fitting tolerances and immediately apply the same precision measurement principles to every forge component and ore-crushing apparatus across the industrial quarter! −${PURCHASE_IRON_COST} iron · +${PURCHASE_PRESTIGE_REWARD} prestige. Iron surge: +${PURCHASE_IRON_RATE} iron/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendMillstoneCutterAway() {
  const a = state.imperialMillstoneCutter;
  if (!a?.active) return { ok: false, reason: 'No millstone cutter present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_MILLSTONE_CUTTER_CHANGED, { dismissed: true });
  addMessage('⚙️ The imperial millstone cutter rewraps the dressed gritstone pairs in their burlap covers, bundles the iron drive shafts and furrow-cutting chisels back into the travelling chest, and departs the palace — the soft scrape of stone on stone fading as the artisan\'s heavy cart rolls through the gatehouse arch.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
