/**
 * EmpireOS — Imperial Lacquerwork Master (T488).
 *
 * Every 14–18 minutes (Iron Age+, 10+ player tiles), an imperial lacquerwork
 * master arrives at the settlement accompanied by a journeyman apprentice
 * carrying a flat-lidded display case lined with dark silk that holds a
 * selection of finished lacquerwork pieces arranged by technique complexity:
 * in the first row a set of wooden bowls coated with twelve alternating layers
 * of red and black lacquer with each layer rubbed flat with powdered charcoal
 * between applications producing a surface depth that shifts between the two
 * colours depending on the angle of light, in the second row a set of panels
 * inlaid with mother-of-pearl shell cut into small geometric pieces and bedded
 * into a final lacquer layer before the last polishing stage to secure them
 * flush with the surrounding surface, and in the third row the master's
 * signature pieces: small reliquary boxes with carved lacquer decoration
 * produced by applying a thick layer of mixed lacquer and sawdust filler to
 * a wooden core, allowing it to cure to a hard but workable consistency, then
 * carving the surface decoration with steel tools before applying the final
 * colour coats.
 * The player has 75 seconds to decide.
 *
 * Choices:
 *   🎨 Commission Lacquer Artworks   — pay 25 wood + 20 gold
 *        → +0.22 wood/s for 2.5 min · +22 prestige · +12 morale
 *   📚 Study Lacquer Techniques      — pay 20 mana
 *        → +0.18 mana/s for 2 min · +15 prestige
 *   🚶 Send Away                      — dismiss (no reward)
 *
 * state.imperialLacquerworkMaster = {
 *   active:              { expiresAt: tick } | null,
 *   nextSpawnTick:       tick,
 *   totalVisits:         number,
 *   totalCommissions:    number,
 *   totalStudied:        number,
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

export const COMMISSION_WOOD_COST        = 25;
export const COMMISSION_GOLD_COST        = 20;
export const COMMISSION_WOOD_RATE        = 0.22;
export const COMMISSION_PRESTIGE_REWARD  = 22;
export const COMMISSION_MORALE_REWARD    = 12;
export const COMMISSION_DURATION_TICKS   = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const STUDY_MANA_COST             = 20;
export const STUDY_MANA_RATE             = 0.18;
export const STUDY_PRESTIGE_REWARD       = 15;
export const STUDY_DURATION_TICKS        = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialLacquerworkMaster() {
  if (!state.imperialLacquerworkMaster) {
    state.imperialLacquerworkMaster = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalStudied:     0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialLacquerworkMaster;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalCommissions === undefined) s.totalCommissions = 0;
  if (s.totalStudied     === undefined) s.totalStudied     = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function imperialLacquerworkMasterTick() {
  const a = state.imperialLacquerworkMaster;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_LACQUERWORK_MASTER_CHANGED, { expired: true });
      addMessage('🎨 The imperial lacquerwork master closes the display case, signals the apprentice to shoulder it, and departs for the next commission.', 'info');
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
  emit(Events.IMPERIAL_LACQUERWORK_MASTER_CHANGED, { spawned: true });
  addMessage('🎨 An imperial lacquerwork master arrives with a journeyman apprentice carrying a display case lined with dark silk — twelve-layer red-and-black lacquer bowls whose surface depth shifts with viewing angle, mother-of-pearl inlaid panels bedded flush in a final lacquer coat, and carved reliquary boxes with surface decoration cut into a mixed lacquer and sawdust filler before the final colour coats were applied. The master offers to commission a prestige lacquerwork set for the settlement\'s ceremonial halls, or to conduct a study session in advanced lacquer technique for the settlement\'s craftspeople. Respond within 75 seconds.', 'info');
}

export function getActiveImperialLacquerworkMaster() { return state.imperialLacquerworkMaster?.active ?? null; }
export function getLacquerworkMasterSecsLeft() {
  const a = state.imperialLacquerworkMaster?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionLacquerArtworks() {
  const a = state.imperialLacquerworkMaster;
  if (!a?.active) return { ok: false, reason: 'No lacquerwork master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The lacquerwork master has departed.' };
  if ((state.resources.wood ?? 0) < COMMISSION_WOOD_COST) return { ok: false, reason: `Need ${COMMISSION_WOOD_COST} wood.` };
  if ((state.resources.gold ?? 0) < COMMISSION_GOLD_COST) return { ok: false, reason: `Need ${COMMISSION_GOLD_COST} gold.` };
  state.resources.wood -= COMMISSION_WOOD_COST;
  state.resources.gold -= COMMISSION_GOLD_COST;
  changeMorale(COMMISSION_MORALE_REWARD);
  awardPrestige(COMMISSION_PRESTIGE_REWARD, 'Commissioned lacquer artworks from the imperial lacquerwork master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'lacquerworkCommission');
    state.randomEvents.activeModifiers.push({
      id: 'lacquerworkCommission', resource: 'wood',
      rateMult: 1 + (COMMISSION_WOOD_RATE / Math.max(0.001, Math.abs(state.rates?.wood ?? 1))),
      expiresAt: state.tick + COMMISSION_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_LACQUERWORK_MASTER_CHANGED, { commissioned: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🎨 The lacquerwork master inspects the available timber stock and selects pieces with straight close-grained wood free of knots or resin pockets: the grain determines the absorption pattern of the first lacquer applications that seal the wood before the decorative layers are built up, and a knotted piece will show uneven absorption that creates visible patches in the finished surface even through twelve subsequent layers. The wood is turned and fitted into the required forms — bowls on the lathe, panels from split planks with the annual ring direction oriented to minimise future movement, box cores assembled with mortice joints rather than nails to avoid the rust staining that migrates through lacquer over time — before the first sealing coat of raw lacquer is applied with a soft brush in a thin even film and left to cure in a humidity-controlled room made by hanging wet cloths around the work: lacquer cures by oxidation catalysed by humidity rather than by drying, so a dry room produces a finish that remains soft and prone to marking while the high-humidity environment produces a hard surface ready for rubbing flat with the powdered charcoal pad in preparation for the next application. The apprentice applies the alternating red and black layers under the master's supervision, each layer rubbed flat before the next is applied, the colour built up gradually across twelve cycles until the surface depth that characterises the master's work becomes visible — the quality emerges from patience and the sequence rather than from any single layer. −${COMMISSION_WOOD_COST} wood −${COMMISSION_GOLD_COST} gold · +${COMMISSION_PRESTIGE_REWARD} prestige · +${COMMISSION_MORALE_REWARD} morale. Wood surge: +${COMMISSION_WOOD_RATE} wood/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function studyLacquerTechniques() {
  const a = state.imperialLacquerworkMaster;
  if (!a?.active) return { ok: false, reason: 'No lacquerwork master present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The lacquerwork master has departed.' };
  if ((state.resources.mana ?? 0) < STUDY_MANA_COST) return { ok: false, reason: `Need ${STUDY_MANA_COST} mana.` };
  state.resources.mana -= STUDY_MANA_COST;
  awardPrestige(STUDY_PRESTIGE_REWARD, 'Studied lacquer techniques with the imperial lacquerwork master');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'lacquerworkStudy');
    state.randomEvents.activeModifiers.push({
      id: 'lacquerworkStudy', resource: 'mana',
      rateMult: 1 + (STUDY_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + STUDY_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalStudied = (a.totalStudied ?? 0) + 1;
  emit(Events.IMPERIAL_LACQUERWORK_MASTER_CHANGED, { studied: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📚 The study session begins with the chemistry of lacquer curing: the sap of the lacquer tree contains urushiol, a compound that polymerises in the presence of oxygen and water vapour to form a hard cross-linked surface — unlike varnish which cures by solvent evaporation, the lacquer film continues to harden and increase in chemical resistance over months after application, which is why old lacquerwork from a skilled maker develops a deeper lustre with age while a varnished surface gradually becomes brittle and chips from the edges. The humidity-room section explains the construction and management of the curing environment: the target is a relative humidity above sixty percent maintained throughout the cure period, not a saturated atmosphere that causes the surface to cure too quickly and trap solvent vapour in the underlayers — the wet cloths hanging method works by evaporation from the cloth surface at a rate that maintains the humidity band without the extreme saturation of a fully enclosed steam environment. The inlay technique section covers the preparation of mother-of-pearl shell pieces: the shell is split along the growth planes with a fine chisel to produce flat pieces of consistent thickness, then each piece is cut to the pattern shape with a small bow saw fitted with a fine blade, the cut edges refined with a needle file, and the piece test-fitted in its recess in the still-soft final lacquer layer before being pressed gently into position and the surrounding lacquer smoothed back to a flat surface. The settlement's craftspeople work through the preparation and first application stages, the master correcting brush angle and film thickness and demonstrating the rubbing technique that produces the smooth transition between layers without cutting through to the colour layer beneath. −${STUDY_MANA_COST} mana · +${STUDY_PRESTIGE_REWARD} prestige. Mana surge: +${STUDY_MANA_RATE} mana/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendLacquerworkMasterAway() {
  const a = state.imperialLacquerworkMaster;
  if (!a?.active) return { ok: false, reason: 'No lacquerwork master present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_LACQUERWORK_MASTER_CHANGED, { dismissed: true });
  addMessage('🎨 The imperial lacquerwork master closes the display case, signals the apprentice to shoulder it, and departs for the next commission.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
