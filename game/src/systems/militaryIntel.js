/**
 * EmpireOS — Military Intelligence Reports (T220).
 *
 * When the player has researched the 'espionage' tech, the spy network
 * generates automated intelligence briefings on each non-allied empire
 * every 8–12 minutes.
 *
 * Each briefing assesses three indicators from the game map:
 *
 *   tileTrend    — empire tile count vs. previous report:
 *                  'expanding' (+3+ tiles), 'stable', 'contracting' (−3+ tiles)
 *
 *   powerTier    — estimated combat power based on tile count + tech count:
 *                  'weak' (≤5), 'average' (6–12), 'strong' (13–22),
 *                  'overwhelming' (23+)
 *
 *   threatLevel  — expansion direction: how many of the empire's tiles
 *                  are adjacent to player tiles (0=none→low, ≤2→medium, 3+→high)
 *
 * Reports are stored per-empire and shown in the Diplomacy panel.
 *
 * state.intel = {
 *   reports: {
 *     [empireId]: {
 *       tileTrend:    'expanding' | 'stable' | 'contracting',
 *       powerTier:    'weak' | 'average' | 'strong' | 'overwhelming',
 *       threatLevel:  'low' | 'medium' | 'high',
 *       tileCount:    number,
 *       generatedAt:  number,   // tick
 *     }
 *   },
 *   prevTileCounts:  { [empireId]: number },   // counts from previous cycle
 *   nextReportTick:  number,
 *   totalReports:    number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Constants ──────────────────────────────────────────────────────────────

const REPORT_MIN     =  8 * 60 * TICKS_PER_SECOND;  // 8 min
const REPORT_MAX     = 12 * 60 * TICKS_PER_SECOND;  // 12 min
const FIRST_DELAY    =  8 * 60 * TICKS_PER_SECOND;  // first report ≥ 8 min in

const EMPIRE_IDS = ['ironHorde', 'mageCouncil', 'seaWolves'];

// Power tier thresholds (tile count + tech count combined score)
const TIER_WEAK         =  5;
const TIER_AVERAGE      = 13;
const TIER_STRONG       = 23;

// Expansion: tile count delta thresholds
const EXPAND_THRESHOLD  =  3;
const CONTRACT_THRESHOLD = -3;

// Threat: adjacent-to-player tile count
const THREAT_MEDIUM_MIN = 1;
const THREAT_HIGH_MIN   = 3;

// ── Init ──────────────────────────────────────────────────────────────────

export function initMilitaryIntel() {
  if (!state.intel) {
    state.intel = {
      reports:        {},
      prevTileCounts: {},
      nextReportTick: 0,
      totalReports:   0,
    };
  }
  if (!state.intel.reports)        state.intel.reports        = {};
  if (!state.intel.prevTileCounts) state.intel.prevTileCounts = {};
  if (state.intel.nextReportTick   === undefined) state.intel.nextReportTick = 0;
  if (state.intel.totalReports     === undefined) state.intel.totalReports   = 0;
}

// ── Tick ──────────────────────────────────────────────────────────────────

export function militaryIntelTick() {
  if (!state.intel) return;
  if (!state.techs?.espionage) return;
  if (!state.map?.tiles) return;

  const intel = state.intel;

  // Schedule first report
  if (intel.nextReportTick === 0) {
    intel.nextReportTick = state.tick + FIRST_DELAY;
    return;
  }

  if (state.tick < intel.nextReportTick) return;

  _generateReports();
  intel.nextReportTick = state.tick + REPORT_MIN + Math.floor(Math.random() * (REPORT_MAX - REPORT_MIN));
}

// ── Report generation ─────────────────────────────────────────────────────

function _generateReports() {
  const intel     = state.intel;
  const tiles     = state.map.tiles;
  const empires   = state.diplomacy?.empires ?? [];
  const techCount = Object.keys(state.techs ?? {}).length;

  let reportsGenerated = 0;

  for (const empId of EMPIRE_IDS) {
    const emp = empires.find(e => e.id === empId);
    if (!emp) continue;
    // Only report on non-allied empires
    if (emp.relations === 'allied') continue;

    // Count empire tiles and adjacency to player
    let empTiles     = 0;
    let borderTiles  = 0;

    for (let y = 0; y < tiles.length; y++) {
      for (let x = 0; x < tiles[y].length; x++) {
        const tile = tiles[y][x];
        if (tile.owner !== empId) continue;
        empTiles++;
        // Check if any neighbour is player-owned (threat proximity)
        if (_hasPlayerNeighbour(x, y, tiles)) borderTiles++;
      }
    }

    // tileTrend
    const prev  = intel.prevTileCounts[empId] ?? empTiles;
    const delta = empTiles - prev;
    const tileTrend =
      delta >= EXPAND_THRESHOLD  ? 'expanding'   :
      delta <= CONTRACT_THRESHOLD ? 'contracting' : 'stable';

    // powerTier — combined score of tile count + fraction of techs known
    // Enemy AI doesn't track techs explicitly, so estimate from tile count alone
    const score = empTiles + Math.floor(techCount * 0.3);
    const powerTier =
      score >= TIER_STRONG   ? 'overwhelming' :
      score >= TIER_AVERAGE  ? 'strong'       :
      score >= TIER_WEAK     ? 'average'      : 'weak';

    // threatLevel
    const threatLevel =
      borderTiles >= THREAT_HIGH_MIN   ? 'high'   :
      borderTiles >= THREAT_MEDIUM_MIN ? 'medium' : 'low';

    intel.reports[empId] = {
      tileTrend,
      powerTier,
      threatLevel,
      tileCount: empTiles,
      generatedAt: state.tick,
    };

    intel.prevTileCounts[empId] = empTiles;
    reportsGenerated++;
  }

  if (reportsGenerated > 0) {
    intel.totalReports++;
    addMessage('🔍 Spy network intelligence reports updated. Check the Diplomacy panel.', 'event');
    emit(Events.INTEL_REPORT, { count: reportsGenerated });
  }
}

function _hasPlayerNeighbour(x, y, tiles) {
  const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    if (ny < 0 || ny >= tiles.length) continue;
    if (nx < 0 || nx >= tiles[ny].length) continue;
    if (tiles[ny][nx].owner === 'player') return true;
  }
  return false;
}

// ── Accessors ─────────────────────────────────────────────────────────────

export function getIntelReport(empireId) {
  return state.intel?.reports?.[empireId] ?? null;
}

export function getIntelNextSecs() {
  if (!state.intel) return 0;
  return Math.max(0, Math.ceil((state.intel.nextReportTick - state.tick) / TICKS_PER_SECOND));
}

export function isIntelActive() {
  return !!(state.techs?.espionage && state.intel);
}
