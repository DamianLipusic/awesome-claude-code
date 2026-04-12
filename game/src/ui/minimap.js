/**
 * EmpireOS — Mini-map thumbnail in title bar (T050)
 *
 * Renders a compact 60×60 px bird's-eye overview of the 20×20 game map
 * into a <canvas id="minimap"> element in the title bar.
 *
 * Colour scheme:
 *   Unexplored  → very dark (#0d1117)
 *   Neutral     → dim gray  (#374151)
 *   Player tile → blue      (#1d4ed8)
 *   Enemy tile  → red       (#991b1b)
 *   Capital     → gold      (#d97706)
 *
 * The canvas updates on MAP_CHANGED, GAME_LOADED, and GAME_STARTED.
 *
 * Public API:
 *   initMinimap() — call once after DOM is ready
 *   drawMinimap() — exposed for external redraws (e.g., after new game)
 */

import { on, Events } from '../core/events.js';
import { state }      from '../core/state.js';

const TILE_PX  = 3;            // pixels per tile
const MAP_SIZE = 20;           // tiles per side
const W        = MAP_SIZE * TILE_PX;   // 60
const H        = MAP_SIZE * TILE_PX;   // 60

const CLR_UNEXPLORED = '#0d1117';
const CLR_NEUTRAL    = '#374151';
const CLR_PLAYER     = '#1e40af';
const CLR_ENEMY      = '#991b1b';
const CLR_CAPITAL    = '#d97706';

let _canvas = null;
let _ctx    = null;

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Initialise the minimap. Call once during the boot sequence, after DOM ready.
 */
export function initMinimap() {
  _canvas = document.getElementById('minimap');
  if (!_canvas) return;

  _canvas.width  = W;
  _canvas.height = H;
  _ctx = _canvas.getContext('2d');

  on(Events.MAP_CHANGED,  drawMinimap);
  on(Events.GAME_LOADED,  drawMinimap);
  on(Events.GAME_STARTED, drawMinimap);

  // Initial draw (may be blank if map not yet initialised)
  drawMinimap();
}

/**
 * Redraw the minimap from current state.
 * Safe to call before the map is initialised (renders an empty dark canvas).
 */
export function drawMinimap() {
  if (!_ctx) return;

  // Clear to unexplored colour
  _ctx.fillStyle = CLR_UNEXPLORED;
  _ctx.fillRect(0, 0, W, H);

  if (!state.map?.tiles) return;

  const tiles = state.map.tiles;
  const cap   = state.map.capital;

  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const tile = tiles[y]?.[x];
      if (!tile) continue;

      let color;
      if (!tile.revealed) {
        color = CLR_UNEXPLORED;
      } else if (tile.owner === 'player') {
        // Highlight the capital tile in gold
        color = (cap && x === cap.x && y === cap.y) ? CLR_CAPITAL : CLR_PLAYER;
      } else if (tile.owner === 'enemy') {
        color = CLR_ENEMY;
      } else {
        color = CLR_NEUTRAL;
      }

      _ctx.fillStyle = color;
      _ctx.fillRect(x * TILE_PX, y * TILE_PX, TILE_PX, TILE_PX);
    }
  }

  // Draw a 1-px border inside the capital tile for visibility
  if (cap) {
    _ctx.strokeStyle = CLR_CAPITAL;
    _ctx.lineWidth   = 1;
    _ctx.strokeRect(
      cap.x * TILE_PX + 0.5,
      cap.y * TILE_PX + 0.5,
      TILE_PX - 1,
      TILE_PX - 1
    );
  }
}
