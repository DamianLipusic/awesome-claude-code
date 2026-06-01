/**
 * EmpireOS — Imperial Porcelain Master (T476).
 *
 * Every 14–18 minutes (Iron Age+, 10+ player tiles), an imperial porcelain
 * master arrives at the settlement carrying a locked display case of finished
 * wares — a tall-necked vase with a celadon glaze that shows a faint crackle
 * pattern where the glaze cooled faster than the body, a set of broad-rimmed
 * bowls in a translucent white body that rings with a pure tone when struck,
 * and a lidded jar decorated with underglaze cobalt painted before the final
 * firing — along with a portfolio of glaze formulas and kiln-stacking diagrams
 * showing the cone arrangements that produce an even temperature across the
 * full chamber — offering to commission a collection of porcelain masterworks
 * for the settlement, or to teach the settlement's potters the glazing
 * techniques that distinguish imperial porcelain from ordinary earthenware.
 * The player has 75 seconds to decide.
 *
 * Choices:
 *   🏺 Commission Porcelain Masterworks  — pay 25 stone + 20 gold
 *        → +0.22 stone/s for 2.5 min · +22 prestige · +12 morale
 *   📜 Study Glazing Techniques          — pay 20 mana
 *        → +0.18 mana/s for 2 min · +15 prestige
 *   🚶 Send Away                          — dismiss (no reward)
 *
 * state.imperialPorcelainMaster = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalCommissions:    number,
 *   totalStudies:        number,
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
const WINDOW_TICKS     = 75 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 10;

export const COMMISSION_STONE_COST           = 25;
export const COMMISSION_GOLD_COST            = 20;
export const COMMISSION_STONE_RATE           = 0.22;
export const COMMISSION_PRESTIGE_REWARD      = 22;
export const COMMISSION_MORALE_REWARD        = 12;
export const COMMISSION_DURATION_TICKS       = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const STUDY_MANA_COST                 = 20;
export const STUDY_MANA_RATE                 = 0.18;
export const STUDY_PRESTIGE_REWARD           = 15;
export const STUDY_DURATION_TICKS            = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialPorcelainMaster() {
  if (!state.imperialPorcelainMaster) {
    state.imperialPorcelainMaster = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalStudies:     0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialPorcelainMaster;
  if (s.nextSpawnTick      === undefined) s.nextSpawnTick      = _nextSpawnTick();
  if (s.totalVisits        === undefined) s.totalVisits        = 0;
  if (s.totalCommissions   === undefined) s.totalCommissions   = 0;
  if (s.totalStudies       === undefined) s.totalStudies       = 0;
  if (s.totalDismissals    === undefined) s.totalDismissals    = 0;
}

export function imperialPorcelainMasterTick() {
  const a = state.imperialPorcelainMaster;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_PORCELAIN_MASTER_CHANGED, { expired: true });
      addMessage('🏺 The imperial porcelain master closes the display case, rolls the glaze formulas back into their protective tube, and departs for a settlement with potters skilled enough to appreciate the technical demands of imperial-quality ware.', 'info');
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
  emit(Events.IMPERIAL_PORCELAIN_MASTER_CHANGED, { spawned: true });
  addMessage('🏺 An imperial porcelain master arrives carrying a locked display case of finished wares — a celadon-glazed vase with faint crackle where the glaze cooled faster than the body, translucent white bowls that ring with a pure tone when struck, and a cobalt-decorated lidded jar fired with underglaze — along with a portfolio of glaze formulas and kiln-stacking diagrams. The master offers to commission a collection of porcelain masterworks for the settlement, or to teach the glazing techniques that distinguish imperial porcelain from ordinary earthenware. Respond within 75 seconds.', 'info');
}

export function getActiveImperialPorcelainMaster() { return state.imperialPorcelainMaster?.active ?? null; }
export function getPorcelainMasterSecsLeft() {
  const a = state.imperialPorcelainMaster?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionPorcelainMasterworks() {
  const a = state.imperialPorcelainMaster;
  if (!a?.active) return { ok: false, reason: 'No porcelain master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The porcelain master has departed.' };
  if ((state.resources.stone ?? 0) < COMMISSION_STONE_COST) return { ok: false, reason: `Need ${COMMISSION_STONE_COST} stone.` };
  if ((state.resources.gold  ?? 0) < COMMISSION_GOLD_COST)  return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.stone -= COMMISSION_STONE_COST;
  state.resources.gold  -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned porcelain masterworks from the imperial porcelain master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'porcelainMasterCommission');
    state.randomEvents.activeModifiers.push({
      id: 'porcelainMasterCommission', resource: 'stone',
      rateMult: 1 + (COMMISSION_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_PORCELAIN_MASTER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🏺 The porcelain master opens the portfolio to the commission sheets and works through the order in the sequence dictated by the kiln schedule: the bodies are thrown first on the wheel — a stoneware clay body with a high kaolin content that fires to a dense, vitrified state without warping — and set to dry under damp cloth so the walls dry uniformly rather than cracking at the rim. The glaze preparation comes next: the master measures the feldspar, quartz, and calcium carbonate fractions by weight against a reference card, grinds them together in a water suspension until no grit can be felt between the fingers, and tests the specific gravity before applying a single dipped coat to each bisque-fired piece. The kiln is stacked according to the portfolio diagrams — shelves set at heights that keep the flame path even across all levels — and the firing proceeds through three temperature stages, the master adjusting the draught and stoking rhythm to hold each stage for the correct duration. The finished pieces emerge from the kiln with the dense, translucent quality that marks imperial-grade ware, and the settlement's great hall gains a display that signals its status to every visiting dignitary. −${COMMISSION_STONE_COST} stone −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Stone surge: +${COMMISSION_STONE_RATE} stone/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function studyGlazingTechniques() {
  const a = state.imperialPorcelainMaster;
  if (!a?.active) return { ok: false, reason: 'No porcelain master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The porcelain master has departed.' };
  if ((state.resources.mana ?? 0) < STUDY_MANA_COST) return { ok: false, reason: `Need ${STUDY_MANA_COST} mana.` };
  state.resources.mana -= STUDY_MANA_COST;
  awardPrestige(STUDY_PRESTIGE_REWARD, 'Studied glazing techniques from the imperial porcelain master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'porcelainMasterStudy');
    state.randomEvents.activeModifiers.push({
      id: 'porcelainMasterStudy', resource: 'mana',
      rateMult: 1 + (STUDY_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + STUDY_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalStudies = (a.totalStudies ?? 0) + 1;
  emit(Events.IMPERIAL_PORCELAIN_MASTER_CHANGED, { studied: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The porcelain master begins the workshop session with the chemistry of the glaze — the role of silica as the glass-forming oxide, the way alumina raises the melting point and gives the fired glaze its resistance to thermal shock, and the effect of calcium on the surface quality, explaining that a high-calcium glaze produces the faint crackle characteristic of celadon because the calcium glaze contracts more than the body on cooling. The practical section follows: each potter prepares a small test glaze from the master's measured formula, applies it to a set of thumb-sized test tiles in coats of varying thickness, and fires them in a test kiln alongside the master's reference tiles so the comparison is direct. The master demonstrates the dipping technique that produces an even coat without runs at the foot ring, and explains the sequence of visual checks — colour, surface texture, drip pattern — that allows an experienced potter to judge glaze quality before the pieces go into the main kiln. Several of the settlement's potters show immediate improvement in their glazing results, and by the end of the session are independently producing coats that meet the master's standard. −${STUDY_MANA_COST} mana · +${STUDY_PRESTIGE_REWARD} prestige. Mana surge: +${STUDY_MANA_RATE} mana/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendPorcelainMasterAway() {
  const a = state.imperialPorcelainMaster;
  if (!a?.active) return { ok: false, reason: 'No porcelain master present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_PORCELAIN_MASTER_CHANGED, { dismissed: true });
  addMessage('🏺 The imperial porcelain master closes the display case, rolls the glaze formulas back into their protective tube, and departs for a settlement with potters skilled enough to appreciate the technical demands of imperial-quality ware.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
