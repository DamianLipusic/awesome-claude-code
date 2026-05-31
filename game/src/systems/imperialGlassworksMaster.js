/**
 * EmpireOS — Imperial Glassworks Master (T468).
 *
 * Every 15–19 minutes (Medieval Age+, 10+ player tiles), an imperial
 * glassworks master arrives at the settlement bearing a satchel of glass
 * samples — coloured rounds of blown glass in amber, cobalt, and clear
 * crystal — and a set of architectural drawings showing how a grand glass
 * dome could be raised above the settlement's central hall, the concentric
 * rings of lead came holding the glass panels in a geometric pattern that
 * floods the interior with coloured light at midday — offering to commission
 * an imperial glass dome installation for the hall, or to sell the
 * proprietary glass-casting formulas that would allow the settlement's own
 * craftsmen to produce similar architectural glass for future projects.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🏛️ Commission Imperial Glass Dome — pay 25 stone + 20 gold
 *        → +0.22 stone/s for 2.5 min · +22 prestige · +12 morale
 *   📜 Purchase Glass-Casting Formulas — pay 20 mana
 *        → +0.18 mana/s for 2 min · +15 prestige
 *   🚶 Send Away                       — dismiss (no reward)
 *
 * state.imperialGlassworksMaster = {
 *   active:             { expiresAt: tick } | null,
 *   nextSpawnTick:      tick,
 *   totalVisits:        number,
 *   totalCommissions:   number,
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

const SPAWN_MIN        = 15 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 3;   // Medieval Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_STONE_COST           = 25;
export const COMMISSION_GOLD_COST            = 20;
export const COMMISSION_STONE_RATE           = 0.22;
export const COMMISSION_PRESTIGE_REWARD      = 22;
export const COMMISSION_MORALE_REWARD        = 12;
export const COMMISSION_DURATION_TICKS       = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_MANA_COST              = 20;
export const PURCHASE_MANA_RATE              = 0.18;
export const PURCHASE_PRESTIGE_REWARD        = 15;
export const PURCHASE_DURATION_TICKS         = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialGlassworksMaster() {
  if (!state.imperialGlassworksMaster) {
    state.imperialGlassworksMaster = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialGlassworksMaster;
  if (s.nextSpawnTick      === undefined) s.nextSpawnTick      = _nextSpawnTick();
  if (s.totalVisits        === undefined) s.totalVisits        = 0;
  if (s.totalCommissions   === undefined) s.totalCommissions   = 0;
  if (s.totalPurchases     === undefined) s.totalPurchases     = 0;
  if (s.totalDismissals    === undefined) s.totalDismissals    = 0;
}

export function imperialGlassworksMasterTick() {
  const a = state.imperialGlassworksMaster;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_GLASSWORKS_MASTER_CHANGED, { expired: true });
      addMessage('🏛️ The imperial glassworks master wraps the glass samples back in their protective cloth, rolls up the architectural drawings, and departs to seek a patron elsewhere.', 'info');
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
  emit(Events.IMPERIAL_GLASSWORKS_MASTER_CHANGED, { spawned: true });
  addMessage('🏛️ An imperial glassworks master arrives bearing a satchel of glass samples — coloured rounds of blown glass in amber, cobalt, and clear crystal — and architectural drawings for a grand glass dome above the settlement\'s central hall, its lead-came panels flooding the interior with coloured light at midday. The master offers to commission the dome installation, or to sell the proprietary glass-casting formulas for the settlement\'s own craftsmen to use. Respond within 80 seconds.', 'info');
}

export function getActiveImperialGlassworksMaster() { return state.imperialGlassworksMaster?.active ?? null; }
export function getGlassworksMasterSecsLeft() {
  const a = state.imperialGlassworksMaster?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionImperialGlassDome() {
  const a = state.imperialGlassworksMaster;
  if (!a?.active) return { ok: false, reason: 'No glassworks master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The glassworks master has departed.' };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.stone -= COMMISSION_STONE_COST;
  state.resources.gold  -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned an imperial glass dome from the glassworks master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'glassworksMasterCommission');
    state.randomEvents.activeModifiers.push({
      id: 'glassworksMasterCommission', resource: 'stone',
      rateMult: 1 + (COMMISSION_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_GLASSWORKS_MASTER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🏛️ The glassworks master unrolls the dome plans across the floor and marks the centre-point of the hall with a compass, then steps through each ring of the lead-came grid from the crown panel downward — explaining how the amber glass panels at the top catch the morning light, how the cobalt rings below them diffuse the midday glare into a cool blue wash across the stone floor, and how the clear crystal sections at the base allow the occupants to see the sky directly while remaining sheltered from wind and rain. The stonecutters and glaziers begin the preliminary work immediately: cutting the circular stone drum that will support the dome's lower rim, drilling the lead-seating grooves into the capstone, and pre-assembling the largest panels on the ground so the fit can be checked before hoisting. −${COMMISSION_STONE_COST} stone −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Stone surge: +${COMMISSION_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseGlassCastingFormulas() {
  const a = state.imperialGlassworksMaster;
  if (!a?.active) return { ok: false, reason: 'No glassworks master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The glassworks master has departed.' };
  if ((state.resources.mana ?? 0) < PURCHASE_MANA_COST) return { ok: false, reason: `Need ${PURCHASE_MANA_COST} mana.` };
  state.resources.mana -= PURCHASE_MANA_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased glass-casting formulas from the glassworks master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'glassworksMasterPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'glassworksMasterPurchase', resource: 'mana',
      rateMult: 1 + (PURCHASE_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_GLASSWORKS_MASTER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The glassworks master produces a bound folio of casting formulas — each page setting out the precise ratios of silica sand, soda ash, and limestone for a different glass type, with marginal notes indicating the furnace temperature required for each blend, the duration of the initial melt, and the annealing schedule that prevents the finished glass from developing internal stress fractures. A separate section details the colouring agents: cobalt oxide for blue, copper oxide for green, manganese for purple, and the tricky iron-sulphur combination that produces the warm amber tone most prized for decorative panels. The settlement's glassworkers study the formulas with growing confidence, already planning the layout of the first colour-trial batch. −${PURCHASE_MANA_COST} mana · +${PURCHASE_PRESTIGE_REWARD} prestige. Mana surge: +${PURCHASE_MANA_RATE} mana/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendGlassworksMasterAway() {
  const a = state.imperialGlassworksMaster;
  if (!a?.active) return { ok: false, reason: 'No glassworks master present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_GLASSWORKS_MASTER_CHANGED, { dismissed: true });
  addMessage('🏛️ The imperial glassworks master wraps the glass samples back in their protective cloth, rolls up the architectural drawings, and departs to seek a patron elsewhere.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
