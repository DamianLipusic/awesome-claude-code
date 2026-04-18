/**
 * EmpireOS — Pioneer Expedition System (T110).
 *
 * Players can dispatch a pioneering party to settle distant uninhabited lands.
 * Each expedition:
 *   - Costs 120 food + 80 wood
 *   - Takes 2.5 minutes (600 ticks at 4 ticks/s)
 *   - On completion: captures 2–3 neutral tiles near a randomly-chosen distant
 *     point (dist 8–16 from the capital) and reveals surrounding fog
 *   - Grants +60 prestige on arrival
 *   - Maximum 3 expeditions per game
 *
 * state.pioneers saved/loaded (backwards-compat null default). No version bump.
 * PIONEER_CHANGED event fires on send and completion.
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { TICKS_PER_SECOND } from '../core/tick.js';
import { recalcRates }      from './resources.js';
import { awardPrestige }    from './prestige.js';
import { revealAround, MAP_W, MAP_H, CAPITAL } from './map.js';

// ── Constants ──────────────────────────────────────────────────────────────

export const PIONEER_COST          = { food: 120, wood: 80 };
export const PIONEER_MAX           = 3;          // max expeditions per game
const        EXPEDITION_TICKS      = 600;        // 2.5 min at 4 ticks/s
const        MIN_DIST              = 8;          // tiles from capital
const        MAX_DIST              = 16;
const        MAX_CAPTURE           = 3;          // tiles captured per expedition

// Offsets to try when claiming tiles around target centre (nearest-first)
const CAPTURE_OFFSETS = [
  [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [-1, -1], [1, -1], [-1, 1],
];

// ── Helpers ────────────────────────────────────────────────────────────────

function _inBounds(x, y) {
  return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
}

/** Pick a random neutral tile at distance [MIN_DIST, MAX_DIST] from the capital. */
function _pickTarget() {
  if (!state.map?.tiles) return null;
  const candidates = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const t    = state.map.tiles[y][x];
      const dist = Math.hypot(x - CAPITAL.x, y - CAPITAL.y);
      if (t.owner === null && dist >= MIN_DIST && dist <= MAX_DIST) {
        candidates.push({ x, y });
      }
    }
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// ── Public API ─────────────────────────────────────────────────────────────

export function initPioneers() {
  if (state.pioneers !== null) return;
  state.pioneers = { active: null, sent: 0 };
}

/**
 * Dispatch a pioneer expedition.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function sendPioneerExpedition() {
  if (!state.pioneers) return { ok: false, reason: 'Not initialised.' };
  if (state.pioneers.active)            return { ok: false, reason: 'An expedition is already underway.' };
  if (state.pioneers.sent >= PIONEER_MAX) return { ok: false, reason: 'No more expeditions available this game.' };

  for (const [res, amt] of Object.entries(PIONEER_COST)) {
    if ((state.resources[res] ?? 0) < amt) {
      return { ok: false, reason: `Need ${amt} ${res} to dispatch pioneers.` };
    }
  }

  const target = _pickTarget();
  if (!target) return { ok: false, reason: 'No suitable distant lands found.' };

  for (const [res, amt] of Object.entries(PIONEER_COST)) state.resources[res] -= amt;

  state.pioneers.active = {
    endsAt: state.tick + EXPEDITION_TICKS,
    cx: target.x,
    cy: target.y,
  };

  emit(Events.RESOURCE_CHANGED);
  emit(Events.PIONEER_CHANGED, { phase: 'sent' });
  addMessage('🚶 Pioneers dispatched! They will return with new territory in ~2.5 minutes.', 'build');
  return { ok: true };
}

export function pioneerTick() {
  if (!state.pioneers?.active) return;
  if (state.tick < state.pioneers.active.endsAt) return;

  const { cx, cy } = state.pioneers.active;
  state.pioneers.active = null;
  state.pioneers.sent++;

  const tiles    = state.map?.tiles;
  if (!tiles) return;

  let captured = 0;
  for (const [dx, dy] of CAPTURE_OFFSETS) {
    if (captured >= MAX_CAPTURE) break;
    const nx = cx + dx;
    const ny = cy + dy;
    if (!_inBounds(nx, ny)) continue;
    const t = tiles[ny][nx];
    if (t.owner !== null) continue;
    t.owner    = 'player';
    t.revealed = true;
    revealAround(nx, ny);
    captured++;
  }

  recalcRates();
  awardPrestige(60);

  const remaining = PIONEER_MAX - state.pioneers.sent;
  addMessage(
    `🏕️ Pioneers settled ${captured} new tile${captured !== 1 ? 's' : ''}! +60 prestige.` +
    (remaining > 0 ? ` (${remaining} expedition${remaining !== 1 ? 's' : ''} remaining)` : ' (all expeditions used)'),
    'windfall',
  );

  emit(Events.PIONEER_CHANGED, { phase: 'completed', captured });
  emit(Events.MAP_CHANGED, { outcome: 'pioneer' });
}

/** Progress 0→1 while an expedition is active. */
export function getPioneerProgress() {
  if (!state.pioneers?.active) return 0;
  const elapsed = EXPEDITION_TICKS - (state.pioneers.active.endsAt - state.tick);
  return Math.min(1, Math.max(0, elapsed / EXPEDITION_TICKS));
}

/** Seconds until the current expedition completes (0 if none). */
export function getPioneerSecsLeft() {
  if (!state.pioneers?.active) return 0;
  return Math.max(0, Math.ceil((state.pioneers.active.endsAt - state.tick) / TICKS_PER_SECOND));
}
