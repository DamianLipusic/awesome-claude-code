/**
 * EmpireOS — Imperial Mosaic Master (T438).
 *
 * Every 14–18 minutes (Medieval Age+, 10+ player tiles), an imperial mosaic
 * master arrives at the settlement carrying a satchel of stone tesserae cut
 * and sorted into labelled linen bags by colour and material — the red and
 * orange pieces from fired terracotta tile, the white and cream from marble
 * quarried from distant beds, the black from basalt river pebbles split to
 * reveal the dark interior face, the blue and turquoise from glazed ceramic
 * fragments fired with cobalt and copper oxide washes in the specialist kiln
 * attached to the palace workshop at the provincial capital — each tessera
 * individually shaped with the hardie and hammer to the required face
 * dimension and thickness before being sorted into the colour bags that allow
 * the mosaic master to lay the detailed geometric and figural designs directly
 * in the lime mortar bed without a preparatory drawn cartoon, working from
 * memory of the design proportions and colour sequences rehearsed through
 * decades of pavement and wall mosaic commissions in halls, bathhouses, and
 * temple floors across the province — offering to commission a grand mosaic
 * hall pavement in the settlement's principal meeting hall using the finest
 * marble and ceramic tesserae in a complex geometric pattern with figural
 * panels depicting scenes of imperial victory and prosperity, or to purchase
 * the tesserae selection and laying techniques that allow the settlement's own
 * craftsmen to execute simpler geometric mosaic borders and floors from locally
 * sourced stone. The player has 80 seconds to decide.
 *
 * Choices:
 *   🎨 Commission Grand Mosaic Hall  — pay 25 stone + 20 gold
 *        → +0.22 stone/s for 2.5 min · +22 prestige · +12 morale
 *   📖 Purchase Tesserae Techniques  — pay 20 mana
 *        → +0.18 mana/s for 2 min · +15 prestige
 *   🚶 Send Away                    — dismiss (no reward)
 *
 * state.imperialMosaicMaster = {
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
const MIN_AGE          = 3;   // Medieval Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_STONE_COST       = 25;
export const COMMISSION_GOLD_COST        = 20;
export const COMMISSION_STONE_RATE       = 0.22;
export const COMMISSION_PRESTIGE_REWARD  = 22;
export const COMMISSION_MORALE_REWARD    = 12;
export const COMMISSION_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_MANA_COST          = 20;
export const PURCHASE_MANA_RATE          = 0.18;
export const PURCHASE_PRESTIGE_REWARD    = 15;
export const PURCHASE_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialMosaicMaster() {
  if (!state.imperialMosaicMaster) {
    state.imperialMosaicMaster = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialMosaicMaster;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialMosaicMasterTick() {
  const a = state.imperialMosaicMaster;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_MOSAIC_MASTER_CHANGED, { expired: true });
      addMessage('🎨 The imperial mosaic master carefully re-seals the sorted tessera bags into the satchel and departs along the road to the next commission.', 'info');
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
  emit(Events.IMPERIAL_MOSAIC_MASTER_CHANGED, { spawned: true });
  addMessage('🎨 An imperial mosaic master arrives at the settlement carrying a satchel of stone tesserae — marble whites, terracotta reds, basalt blacks, and glazed ceramic blues — individually cut and sorted by colour and material, offering to commission a grand mosaic hall pavement in intricate geometric and figural designs depicting imperial victory and prosperity, or to share the complete tesserae selection and laying techniques for reliable mosaic execution from locally sourced stone. Respond within 80 seconds.', 'info');
}

export function getActiveImperialMosaicMaster() { return state.imperialMosaicMaster?.active ?? null; }
export function getMosaicMasterSecsLeft() {
  const a = state.imperialMosaicMaster?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionGrandMosaicHall() {
  const a = state.imperialMosaicMaster;
  if (!a?.active) return { ok: false, reason: 'No mosaic master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The mosaic master has departed.' };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.stone -= COMMISSION_STONE_COST;
  state.resources.gold  -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned grand mosaic hall from the imperial mosaic master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'mosaicMasterCommission');
    state.randomEvents.activeModifiers.push({
      id: 'mosaicMasterCommission', resource: 'stone',
      rateMult: 1 + (COMMISSION_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_MOSAIC_MASTER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🎨 The mosaic master lays out the full-scale cartoon for the grand hall pavement — a complex geometric border of interlocking meander and guilloche bands framing a central figurative panel depicting scenes of imperial triumph with victorious cavalry, captive figures bearing tribute chests, and the imperial eagle with spread wings above the composition — setting the lime mortar bed in sections and pressing each tessera carefully to the drawn lines with the small trowel while maintaining the subtle colour gradations that give the figural panels their three-dimensional modelling quality, completing the pavement in the finest marble and ceramic tesserae that transforms the principal meeting hall into a statement of imperial authority and cultural achievement commanding admiration from every dignitary and envoy who enters! −${COMMISSION_STONE_COST} stone · −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Stone surge: +${COMMISSION_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseTesseraeTechniques() {
  const a = state.imperialMosaicMaster;
  if (!a?.active) return { ok: false, reason: 'No mosaic master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The mosaic master has departed.' };
  if ((state.resources.mana ?? 0) < PURCHASE_MANA_COST) return { ok: false, reason: `Need ${PURCHASE_MANA_COST} mana.` };
  state.resources.mana -= PURCHASE_MANA_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased tesserae techniques from the imperial mosaic master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'mosaicMasterPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'mosaicMasterPurchase', resource: 'mana',
      rateMult: 1 + (PURCHASE_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_MOSAIC_MASTER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The mosaic master shares the complete tesserae selection and laying techniques — the stone selection criteria that identifies the quarry beds and river sources yielding material that splits cleanly to the required face dimension without crumbling at the cut edge, the hardie and hammer technique that shapes each tessera to consistent thickness without fracturing the face, the lime mortar mix proportions and working time that allows the fine positioning of small tesserae before the mortar stiffens, the colour palette sequencing used in geometric patterns that achieves visual rhythm and balance across the full pavement area, and the joint finishing technique that fills the interstices with coloured grout without obscuring the individual tessera faces — knowledge that allows the settlement's craftsmen to execute simple geometric mosaic borders and floors from locally sourced stone to lasting high quality. −${PURCHASE_MANA_COST} mana · +${PURCHASE_PRESTIGE_REWARD} prestige. Mana surge: +${PURCHASE_MANA_RATE} mana/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendMosaicMasterAway() {
  const a = state.imperialMosaicMaster;
  if (!a?.active) return { ok: false, reason: 'No mosaic master present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_MOSAIC_MASTER_CHANGED, { dismissed: true });
  addMessage('🎨 The imperial mosaic master carefully re-seals the sorted tessera bags and departs along the road with a respectful nod.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
