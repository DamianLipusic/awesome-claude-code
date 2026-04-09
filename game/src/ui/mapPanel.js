/**
 * EmpireOS — Map panel UI (T007).
 *
 * Renders a 20×20 canvas tile grid with:
 *   - Terrain colours and fog-of-war
 *   - Player territory (blue tint / border)
 *   - Enemy settlements (red tint / border)
 *   - Hover highlight on attackable tiles
 *   - Click-to-attack on adjacent enemy tiles
 *
 * Canvas size: 480×480 px (24 px per tile × 20 tiles).
 */

import { state } from '../core/state.js';
import { on, Events } from '../core/events.js';
import { attackTile } from '../systems/combat.js';

const TILE_PX   = 24;     // pixels per tile side
const GRID_SIZE = 20;     // tiles per axis

// Terrain base colours
const TERRAIN_COLOR = {
  grass:    '#243520',
  forest:   '#1a3010',
  hills:    '#44361e',
  river:    '#182d50',
  mountain: '#35353a',
  capital:  '#4a3808',
};

const FOG_COLOR     = '#0a0d11';
const FOG_GRID      = '#12161b';
const PLAYER_TINT   = 'rgba(88,166,255,0.22)';
const ENEMY_TINT    = 'rgba(248,81,73,0.28)';
const HOVER_ATTACK  = 'rgba(240,180,41,0.38)';
const HOVER_NEUTRAL = 'rgba(255,255,255,0.08)';
const PLAYER_BORDER = '#58a6ff';
const ENEMY_BORDER  = '#f85149';
const NEUTRAL_BORDER = '#30363d';

// Terrain labels shown in legend
const TERRAIN_LABEL = {
  grass:    { label: 'Grassland',       bonus: '+gold' },
  forest:   { label: 'Forest',          bonus: '+wood' },
  hills:    { label: 'Hills',           bonus: '+stone' },
  river:    { label: 'River',           bonus: '+food' },
  mountain: { label: 'Mountain',        bonus: '+iron' },
};

let canvas, ctx;
let hoveredTile  = null;  // { x, y } | null
let _combatFlash = null;  // { x, y, alpha, outcome } | null
let _flashRafId  = null;  // requestAnimationFrame id

// ── Public API ─────────────────────────────────────────────────────────────

export function initMapPanel() {
  const panel = document.getElementById('panel-map');
  if (!panel) return;

  panel.innerHTML = _buildHTML();

  canvas = document.getElementById('map-canvas');
  ctx    = canvas.getContext('2d');

  canvas.addEventListener('click',      _onClick);
  canvas.addEventListener('mousemove',  _onMousemove);
  canvas.addEventListener('mouseleave', _onMouseleave);

  // Re-render on relevant state changes
  on(Events.MAP_CHANGED, (data) => {
    if (data?.outcome) {
      _startCombatFlash(data.x, data.y, data.outcome);
    } else {
      _render();
    }
  });
  on(Events.UNIT_CHANGED, _render);
  on(Events.GAME_LOADED,  _render);

  _render();
}

// ── HTML scaffold ──────────────────────────────────────────────────────────

function _buildHTML() {
  const legendItems = Object.entries(TERRAIN_LABEL).map(([type, { label, bonus }]) =>
    `<span class="map-legend__item">
       <span class="map-legend__swatch" style="background:${TERRAIN_COLOR[type]}"></span>
       ${label} <span class="map-legend__bonus">${bonus}</span>
     </span>`
  ).join('');

  return `
    <div class="map-wrap">
      <canvas id="map-canvas"
        width="${TILE_PX * GRID_SIZE}"
        height="${TILE_PX * GRID_SIZE}"
        title="Click an adjacent enemy tile to attack it"></canvas>
    </div>
    <div class="map-legend">
      ${legendItems}
      <span class="map-legend__item map-legend__hint">
        ⚔️ Click a highlighted tile to attack
      </span>
    </div>
    <div id="map-stats" class="map-stats"></div>
  `;
}

// ── Combat flash (rAF-driven) ──────────────────────────────────────────────

function _startCombatFlash(x, y, outcome) {
  _combatFlash = { x, y, alpha: 0.75, outcome };
  if (!_flashRafId) _animateFlash();
}

function _animateFlash() {
  if (!_combatFlash) { _flashRafId = null; return; }
  _combatFlash.alpha -= 0.04;  // ~19 frames ≈ 315ms at 60 fps
  if (_combatFlash.alpha <= 0) {
    _combatFlash = null;
    _flashRafId  = null;
    _render();
    return;
  }
  _render();
  _flashRafId = requestAnimationFrame(_animateFlash);
}

// ── Rendering ──────────────────────────────────────────────────────────────

function _render() {
  if (!ctx) return;

  if (!state.map) {
    ctx.fillStyle = FOG_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const { tiles, width, height, capital } = state.map;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      _drawTile(tiles[y][x], x, y, capital);
    }
  }

  _updateStats();
}

function _drawTile(tile, x, y, capital) {
  const px = x * TILE_PX;
  const py = y * TILE_PX;

  if (!tile.revealed) {
    ctx.fillStyle = FOG_COLOR;
    ctx.fillRect(px, py, TILE_PX, TILE_PX);
    ctx.strokeStyle = FOG_GRID;
    ctx.lineWidth   = 0.5;
    ctx.strokeRect(px + 0.25, py + 0.25, TILE_PX - 0.5, TILE_PX - 0.5);
    return;
  }

  // Base terrain colour
  ctx.fillStyle = TERRAIN_COLOR[tile.type] ?? TERRAIN_COLOR.grass;
  ctx.fillRect(px, py, TILE_PX, TILE_PX);

  // Owner tint
  if (tile.owner === 'player') {
    ctx.fillStyle = PLAYER_TINT;
    ctx.fillRect(px, py, TILE_PX, TILE_PX);
  } else if (tile.owner === 'enemy') {
    ctx.fillStyle = ENEMY_TINT;
    ctx.fillRect(px, py, TILE_PX, TILE_PX);
  }

  // Hover highlight
  if (hoveredTile && hoveredTile.x === x && hoveredTile.y === y) {
    ctx.fillStyle = _isAttackable(x, y) ? HOVER_ATTACK : HOVER_NEUTRAL;
    ctx.fillRect(px, py, TILE_PX, TILE_PX);
  }

  // Border
  const borderColor = tile.owner === 'player' ? PLAYER_BORDER
                    : tile.owner === 'enemy'  ? ENEMY_BORDER
                    : NEUTRAL_BORDER;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth   = tile.owner ? 1.5 : 0.5;
  ctx.strokeRect(px + 0.75, py + 0.75, TILE_PX - 1.5, TILE_PX - 1.5);

  // Combat flash overlay (fades out over ~315ms after attack)
  if (_combatFlash && _combatFlash.x === x && _combatFlash.y === y) {
    const rgb = _combatFlash.outcome === 'win' ? '88,166,255' : '248,81,73';
    ctx.fillStyle = `rgba(${rgb},${_combatFlash.alpha})`;
    ctx.fillRect(px, py, TILE_PX, TILE_PX);
  }

  // Icons: capital castle and enemy sword
  if (x === capital.x && y === capital.y) {
    _drawIcon(px, py, '🏰');
  } else if (tile.owner === 'enemy' && tile.revealed) {
    _drawIcon(px, py, '⚔️');
  }
}

function _drawIcon(px, py, icon) {
  ctx.font          = `${TILE_PX - 6}px sans-serif`;
  ctx.textAlign     = 'center';
  ctx.textBaseline  = 'middle';
  ctx.fillText(icon, px + TILE_PX / 2, py + TILE_PX / 2 + 1);
}

// ── Stats bar ──────────────────────────────────────────────────────────────

function _updateStats() {
  const el = document.getElementById('map-stats');
  if (!el || !state.map) return;

  let playerTiles = 0;
  let enemyTiles  = 0;
  let revealedTiles = 0;

  for (let y = 0; y < state.map.height; y++) {
    for (let x = 0; x < state.map.width; x++) {
      const t = state.map.tiles[y][x];
      if (t.owner === 'player') playerTiles++;
      else if (t.owner === 'enemy') enemyTiles++;
      if (t.revealed) revealedTiles++;
    }
  }

  const total = state.map.width * state.map.height;
  el.textContent =
    `Territory: ${playerTiles} tiles  ·  Enemy: ${enemyTiles} tiles  ·  Explored: ${revealedTiles}/${total}`;
}

// ── Event handlers ─────────────────────────────────────────────────────────

function _tileAt(e) {
  const rect  = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: Math.floor((e.clientX - rect.left) * scaleX / TILE_PX),
    y: Math.floor((e.clientY - rect.top)  * scaleY / TILE_PX),
  };
}

function _isAttackable(x, y) {
  if (!state.map) return false;
  const { tiles, width, height } = state.map;
  const tile = tiles[y]?.[x];
  if (!tile || !tile.revealed || tile.owner === 'player') return false;
  return [[-1,0],[1,0],[0,-1],[0,1]].some(([dx, dy]) => {
    const nx = x + dx;
    const ny = y + dy;
    return nx >= 0 && nx < width && ny >= 0 && ny < height
        && tiles[ny][nx].owner === 'player';
  });
}

function _onMousemove(e) {
  const { x, y } = _tileAt(e);
  if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) {
    hoveredTile = null;
    canvas.style.cursor = 'default';
    _render();
    return;
  }
  const prev = hoveredTile;
  hoveredTile = { x, y };
  if (!prev || prev.x !== x || prev.y !== y) {
    canvas.style.cursor = _isAttackable(x, y) ? 'pointer' : 'default';
    _render();
  }
}

function _onMouseleave() {
  hoveredTile = null;
  canvas.style.cursor = 'default';
  _render();
}

function _onClick(e) {
  const { x, y } = _tileAt(e);
  if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return;
  if (_isAttackable(x, y)) attackTile(x, y);
}
