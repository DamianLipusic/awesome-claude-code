/**
 * EmpireOS — Map panel UI (T007 / T037 / T038).
 *
 * Renders a 20×20 canvas tile grid with:
 *   - Terrain colours and fog-of-war
 *   - Player territory (blue tint / border)
 *   - Enemy settlements (red tint / border)
 *   - Hover highlight on attackable tiles
 *   - Click-to-attack on adjacent enemy tiles
 *   - T037: Resource overlay mode (toggle button recolors tiles by resource)
 *   - T038: Tile hover tooltip (terrain, owner, resource bonus, defense)
 *
 * Canvas size: 480×480 px (24 px per tile × 20 tiles).
 */

import { state } from '../core/state.js';
import { on, Events } from '../core/events.js';
import { attackTile, getAttackPreview } from '../systems/combat.js';
import { buildTileImprovement, addMessage } from '../core/actions.js';
import { IMPROVEMENTS } from '../data/improvements.js';

const TILE_PX   = 24;     // pixels per tile side
const GRID_SIZE = 20;     // tiles per axis

// Terrain base colours (normal mode)
const TERRAIN_COLOR = {
  grass:    '#243520',
  forest:   '#1a3010',
  hills:    '#44361e',
  river:    '#182d50',
  mountain: '#35353a',
  capital:  '#4a3808',
};

// T037: Resource overlay colours — one per terrain→resource mapping
const OVERLAY_COLOR = {
  grass:    '#3b2d08',   // gold territory  → amber-brown
  forest:   '#0d2d0d',   // wood territory  → deep green
  hills:    '#30303c',   // stone territory → slate
  river:    '#0a2a22',   // food territory  → dark teal
  mountain: '#3b1a08',   // iron territory  → rust
  capital:  '#4a3808',   // capital keeps warm colour
};

const FOG_COLOR      = '#0a0d11';
const FOG_GRID       = '#12161b';
const PLAYER_TINT    = 'rgba(88,166,255,0.22)';
const ENEMY_TINT     = 'rgba(248,81,73,0.28)';
const HOVER_ATTACK   = 'rgba(240,180,41,0.38)';
const HOVER_NEUTRAL  = 'rgba(255,255,255,0.08)';
const PLAYER_BORDER  = '#58a6ff';
const ENEMY_BORDER   = '#f85149';
const NEUTRAL_BORDER = '#30363d';

// Terrain labels shown in normal-mode legend
const TERRAIN_LABEL = {
  grass:    { label: 'Grassland', bonus: '+gold' },
  forest:   { label: 'Forest',    bonus: '+wood' },
  hills:    { label: 'Hills',     bonus: '+stone' },
  river:    { label: 'River',     bonus: '+food' },
  mountain: { label: 'Mountain',  bonus: '+iron' },
};

// T037: Resource overlay legend entries
const OVERLAY_LEGEND = [
  { color: '#3b2d08', icon: '💰', label: 'Gold territory' },
  { color: '#0d2d0d', icon: '🪵', label: 'Wood territory' },
  { color: '#30303c', icon: '🪨', label: 'Stone territory' },
  { color: '#0a2a22', icon: '🍞', label: 'Food territory' },
  { color: '#3b1a08', icon: '⚙️', label: 'Iron territory' },
];

// T038: Human-readable terrain names and resource bonus text
const TERRAIN_NAME = {
  grass:    'Grassland',
  forest:   'Forest',
  hills:    'Hills',
  river:    'River',
  mountain: 'Mountain',
  capital:  'Capital',
};

const TERRAIN_BONUS = {
  grass:    '💰 +gold/s',
  forest:   '🪵 +wood/s',
  hills:    '🪨 +stone/s',
  river:    '🍞 +food/s',
  mountain: '⚙️ +iron/s',
  capital:  '',
};

let canvas, ctx;
let hoveredTile     = null;   // { x, y } | null
let _combatFlash    = null;   // { x, y, alpha, outcome } | null
let _flashRafId     = null;   // requestAnimationFrame id
let _overlayMode    = false;  // T037: resource overlay toggle
let _tileTipEl      = null;   // T038: floating tile tooltip element
let _previewEl      = null;   // T045: combat preview modal element
let _previewTarget  = null;   // T045: { x, y } of tile pending confirmation
let _impPickerEl    = null;   // T051: improvement picker modal element

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

  // T037: wire overlay toggle button
  const toggleBtn = panel.querySelector('#map-overlay-toggle');
  toggleBtn.addEventListener('click', () => {
    _overlayMode = !_overlayMode;
    toggleBtn.textContent = _overlayMode ? '🗺️ Terrain' : '🌾 Resources';
    toggleBtn.classList.toggle('btn--map-overlay-active', _overlayMode);
    _updateLegend(panel);
    _render();
  });

  // T038: create persistent tile tooltip
  _createTileTip();

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
    `<span class="map-legend__item" data-terrain="${type}">
       <span class="map-legend__swatch" style="background:${TERRAIN_COLOR[type]}"></span>
       ${label} <span class="map-legend__bonus">${bonus}</span>
     </span>`
  ).join('');

  return `
    <div class="map-controls">
      <button id="map-overlay-toggle" class="btn btn--sm btn--map-overlay"
        title="Toggle resource overlay — see which tiles produce which resources">🌾 Resources</button>
    </div>
    <div class="map-wrap">
      <canvas id="map-canvas"
        width="${TILE_PX * GRID_SIZE}"
        height="${TILE_PX * GRID_SIZE}"
        title="Click an adjacent enemy tile to attack it"></canvas>
    </div>
    <div id="map-legend" class="map-legend">
      ${legendItems}
      <span class="map-legend__item map-legend__hint">
        ⚔️ Click a highlighted tile to attack
      </span>
    </div>
    <div id="map-stats" class="map-stats"></div>
  `;
}

// ── T037: Legend update ────────────────────────────────────────────────────

function _updateLegend(panel) {
  const el = panel.querySelector('#map-legend');
  if (!el) return;

  if (_overlayMode) {
    el.innerHTML = OVERLAY_LEGEND.map(({ color, icon, label }) =>
      `<span class="map-legend__item">
         <span class="map-legend__swatch" style="background:${color}"></span>
         ${icon} ${label}
       </span>`
    ).join('') +
    `<span class="map-legend__item map-legend__hint">⚔️ Click a highlighted tile to attack</span>`;
  } else {
    el.innerHTML = Object.entries(TERRAIN_LABEL).map(([type, { label, bonus }]) =>
      `<span class="map-legend__item" data-terrain="${type}">
         <span class="map-legend__swatch" style="background:${TERRAIN_COLOR[type]}"></span>
         ${label} <span class="map-legend__bonus">${bonus}</span>
       </span>`
    ).join('') +
    `<span class="map-legend__item map-legend__hint">⚔️ Click a highlighted tile to attack</span>`;
  }
}

// ── T038: Tile tooltip ─────────────────────────────────────────────────────

function _createTileTip() {
  const existing = document.getElementById('map-tile-tip');
  if (existing) { _tileTipEl = existing; return; }
  _tileTipEl = document.createElement('div');
  _tileTipEl.id        = 'map-tile-tip';
  _tileTipEl.className = 'map-tile-tip map-tile-tip--hidden';
  document.body.appendChild(_tileTipEl);
}

function _showTileTip(tile, x, y, mouseX, mouseY) {
  if (!_tileTipEl || !tile.revealed) { _hideTileTip(); return; }

  const ownerHtml =
    tile.owner === 'player' ? `<span class="map-tt-owner map-tt-owner--player">Your territory</span>`
    : tile.owner === 'enemy' ? `<span class="map-tt-owner map-tt-owner--enemy">Enemy territory</span>`
    : `<span class="map-tt-owner">Neutral</span>`;

  const bonusTxt  = TERRAIN_BONUS[tile.type];
  const bonusHtml = bonusTxt
    ? `<div class="map-tt-row map-tt-bonus">${bonusTxt}</div>`
    : '';

  // T051: show improvement status or build hint
  const impDef = IMPROVEMENTS[tile.type];
  let impHtml = '';
  if (tile.improvement && impDef) {
    impHtml = `<div class="map-tt-row map-tt-bonus">${impDef.icon} ${impDef.name}: ${impDef.desc}</div>`;
  } else if (tile.owner === 'player' && tile.type !== 'capital' && impDef) {
    impHtml = `<div class="map-tt-action">🏗️ Click to build ${impDef.name}</div>`;
  }

  const actionHtml = _isAttackable(x, y)
    ? `<div class="map-tt-action">⚔️ Click to attack</div>`
    : '';

  _tileTipEl.innerHTML = `
    <div class="map-tt-title">${TERRAIN_NAME[tile.type] ?? tile.type}</div>
    <div class="map-tt-row">${ownerHtml}</div>
    ${bonusHtml}
    ${impHtml}
    <div class="map-tt-row">🛡️ Defense: ${tile.defense}</div>
    ${actionHtml}
  `;

  // Position below-right of cursor; clamp within viewport
  const TIP_W = 150;
  const TIP_H = 110;
  let tx = mouseX + 14;
  let ty = mouseY + 14;
  if (tx + TIP_W > window.innerWidth  - 8) tx = mouseX - TIP_W - 8;
  if (ty + TIP_H > window.innerHeight - 8) ty = mouseY - TIP_H - 8;

  _tileTipEl.style.left = `${Math.max(4, tx)}px`;
  _tileTipEl.style.top  = `${Math.max(4, ty)}px`;
  _tileTipEl.classList.remove('map-tile-tip--hidden');
}

function _hideTileTip() {
  _tileTipEl?.classList.add('map-tile-tip--hidden');
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

  // T037: choose color map based on overlay mode
  const colorMap = _overlayMode ? OVERLAY_COLOR : TERRAIN_COLOR;
  ctx.fillStyle = colorMap[tile.type] ?? colorMap.grass;
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

  // Icons: capital castle and enemy sword (same in both modes)
  if (x === capital.x && y === capital.y) {
    _drawIcon(px, py, '🏰');
  } else if (tile.owner === 'enemy' && tile.revealed) {
    _drawIcon(px, py, '⚔️');
  } else if (tile.owner === 'player' && tile.improvement) {
    // T051: draw improvement icon on player-owned improved tiles
    const impDef = IMPROVEMENTS[tile.type];
    if (impDef) _drawIcon(px, py, impDef.icon);
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

  let playerTiles   = 0;
  let enemyTiles    = 0;
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
    _hideTileTip();
    _render();
    return;
  }

  const prev = hoveredTile;
  hoveredTile = { x, y };

  // T038: show tile tooltip for revealed tiles
  const tile = state.map?.tiles[y]?.[x];
  if (tile?.revealed) {
    _showTileTip(tile, x, y, e.clientX, e.clientY);
  } else {
    _hideTileTip();
  }

  if (!prev || prev.x !== x || prev.y !== y) {
    canvas.style.cursor = _isAttackable(x, y) ? 'pointer' : 'default';
    _render();
  }
}

function _onMouseleave() {
  hoveredTile = null;
  canvas.style.cursor = 'default';
  _hideTileTip();
  _render();
}

function _onClick(e) {
  const { x, y } = _tileAt(e);
  if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return;
  if (_isAttackable(x, y)) {
    _showCombatPreview(x, y);
  } else {
    // T051: clicking a player-owned tile (not capital) opens improvement picker
    const tile = state.map?.tiles[y]?.[x];
    if (tile?.owner === 'player' && tile.type !== 'capital') {
      _showImprovementPicker(x, y, tile);
    }
  }
}

// ── T045: Combat preview modal ─────────────────────────────────────────────

const _TERRAIN_LABELS = {
  grass: 'Grassland', forest: 'Forest', hills: 'Hills',
  river: 'River', mountain: 'Mountain', capital: 'Capital',
};

function _createCombatPreview() {
  const existing = document.getElementById('combat-preview');
  if (existing) { _previewEl = existing; return; }

  _previewEl = document.createElement('div');
  _previewEl.id        = 'combat-preview';
  _previewEl.className = 'combat-preview combat-preview--hidden';
  document.body.appendChild(_previewEl);

  // Delegated click handler inside the modal
  _previewEl.addEventListener('click', (e) => {
    if (e.target.id === 'cp-attack-btn') {
      const t = _previewTarget;
      _hideCombatPreview();
      if (t) attackTile(t.x, t.y);
    } else if (e.target.id === 'cp-cancel-btn' || e.target === _previewEl) {
      _hideCombatPreview();
    }
  });

  // Keyboard shortcuts when the modal is open
  document.addEventListener('keydown', (e) => {
    if (_previewEl?.classList.contains('combat-preview--hidden')) return;
    if (e.key === 'Escape') {
      e.stopPropagation();
      _hideCombatPreview();
    }
    if (e.key === 'Enter') {
      e.stopPropagation();
      const t = _previewTarget;
      _hideCombatPreview();
      if (t) attackTile(t.x, t.y);
    }
  });
}

function _showCombatPreview(x, y) {
  if (!_previewEl) _createCombatPreview();

  const p = getAttackPreview(x, y);
  if (!p.valid) {
    // Fallback: just attack directly if preview fails validation
    attackTile(x, y);
    return;
  }

  _previewTarget = { x, y };

  const winPct   = Math.round(p.winChance * 100);
  const winColor = winPct >= 70 ? 'var(--green)' : winPct >= 40 ? 'var(--accent)' : 'var(--red)';
  const terrain  = _TERRAIN_LABELS[p.terrain] ?? p.terrain;
  const ownerStr = p.owner === 'enemy' ? 'Enemy territory' : 'Neutral territory';

  const lootEntries = Object.entries(p.loot).filter(([, v]) => v > 0);
  const lootHtml = lootEntries.length
    ? lootEntries.map(([res, amt]) => `<span class="cp-loot-item">+${amt} ${res}</span>`).join('')
    : '<span class="cp-loot-none">None</span>';

  const siegeHtml = p.siegeActive
    ? `<div class="cp-siege-notice">🏰 Siege Master active — guaranteed victory!</div>`
    : '';

  const battleCryHtml = (state.hero?.activeEffects?.battleCry)
    ? `<div class="cp-siege-notice" style="color:var(--blue)">📣 Battle Cry active — attack doubled!</div>`
    : '';

  const formationLabels = { defensive: '🛡️ Defensive (–15% atk)', balanced: '⚖️ Balanced', aggressive: '⚔️ Aggressive (+25% atk)' };
  const formationHtml = p.formation && p.formation !== 'balanced'
    ? `<div class="cp-siege-notice" style="color:var(--text-dim)">${formationLabels[p.formation] ?? p.formation}</div>`
    : '';

  _previewEl.innerHTML = `
    <div class="cp-box">
      <div class="cp-header">⚔️ Attack Preview</div>
      <div class="cp-sub">${terrain} (${x}, ${y}) · ${ownerStr}</div>
      <div class="cp-stats">
        <div class="cp-stat">
          <span class="cp-stat__label">Your Attack</span>
          <span class="cp-stat__value" style="color:var(--blue)">${p.attackPower}</span>
        </div>
        <div class="cp-stat">
          <span class="cp-stat__label">Enemy Defense</span>
          <span class="cp-stat__value" style="color:var(--red)">${p.defense}</span>
        </div>
        <div class="cp-stat">
          <span class="cp-stat__label">Win Chance</span>
          <span class="cp-stat__value" style="color:${winColor}">${winPct}%</span>
        </div>
      </div>
      ${siegeHtml}${battleCryHtml}${formationHtml}
      <div class="cp-loot-row">
        <span class="cp-loot-label">Loot on victory:</span>
        <span class="cp-loot-items">${lootHtml}</span>
      </div>
      <div class="cp-actions">
        <button id="cp-attack-btn" class="btn btn--sm btn--cp-attack">⚔️ Attack</button>
        <button id="cp-cancel-btn" class="btn btn--sm btn--ghost">✕ Cancel</button>
      </div>
      <div class="cp-hint">Enter to confirm · Escape to cancel</div>
    </div>
  `;

  _previewEl.classList.remove('combat-preview--hidden');
}

function _hideCombatPreview() {
  _previewTarget = null;
  _previewEl?.classList.add('combat-preview--hidden');
}

// ── T051: Improvement picker modal ────────────────────────────────────────

function _createImprovementPicker() {
  const existing = document.getElementById('imp-picker');
  if (existing) { _impPickerEl = existing; return; }

  _impPickerEl = document.createElement('div');
  _impPickerEl.id        = 'imp-picker';
  _impPickerEl.className = 'imp-picker imp-picker--hidden';
  document.body.appendChild(_impPickerEl);

  _impPickerEl.addEventListener('click', (e) => {
    if (e.target.id === 'imp-picker-cancel' || e.target === _impPickerEl) {
      _hideImprovementPicker();
    }
    // Build button handled in _showImprovementPicker via data attribute
    if (e.target.dataset.impBuild) {
      const [sx, sy] = e.target.dataset.impBuild.split(',').map(Number);
      _hideImprovementPicker();
      const result = buildTileImprovement(sx, sy);
      if (!result.ok) addMessage(`❌ ${result.reason}`, 'info');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (_impPickerEl?.classList.contains('imp-picker--hidden')) return;
    if (e.key === 'Escape') { e.stopPropagation(); _hideImprovementPicker(); }
  });
}

function _showImprovementPicker(x, y, tile) {
  if (!_impPickerEl) _createImprovementPicker();

  const impDef = IMPROVEMENTS[tile.type];

  if (tile.improvement) {
    // Already improved — show info card only
    const desc = impDef ? `${impDef.icon} ${impDef.name} — ${impDef.desc}` : tile.improvement;
    _impPickerEl.innerHTML = `
      <div class="imp-box">
        <div class="imp-header">🏗️ Tile Improvement</div>
        <div class="imp-sub">${_TERRAIN_LABELS[tile.type] ?? tile.type} (${x}, ${y})</div>
        <div class="imp-built">${desc}</div>
        <div class="imp-note">This tile already has an improvement.</div>
        <div class="imp-actions">
          <button id="imp-picker-cancel" class="btn btn--sm btn--ghost">Close</button>
        </div>
      </div>`;
  } else if (!impDef) {
    // No improvement available for this terrain (shouldn't happen for non-capital)
    _impPickerEl.innerHTML = `
      <div class="imp-box">
        <div class="imp-header">🏗️ Tile Improvement</div>
        <div class="imp-note">No improvement available for this terrain.</div>
        <div class="imp-actions">
          <button id="imp-picker-cancel" class="btn btn--sm btn--ghost">Close</button>
        </div>
      </div>`;
  } else {
    // Show build card
    const costParts = Object.entries(impDef.cost).map(([r, a]) => {
      const have = Math.floor(state.resources[r] ?? 0);
      const enough = have >= a;
      return `<span class="${enough ? 'imp-cost--ok' : 'imp-cost--bad'}">${a} ${r} (have ${have})</span>`;
    });
    const canAfford = Object.entries(impDef.cost).every(([r, a]) => (state.resources[r] ?? 0) >= a);

    _impPickerEl.innerHTML = `
      <div class="imp-box">
        <div class="imp-header">🏗️ Build Improvement</div>
        <div class="imp-sub">${_TERRAIN_LABELS[tile.type] ?? tile.type} (${x}, ${y})</div>
        <div class="imp-card">
          <div class="imp-icon">${impDef.icon}</div>
          <div class="imp-body">
            <div class="imp-name">${impDef.name}</div>
            <div class="imp-effect">${impDef.desc}</div>
            <div class="imp-costs">${costParts.join(' · ')}</div>
          </div>
        </div>
        <div class="imp-actions">
          <button class="btn btn--sm btn--imp-build" data-imp-build="${x},${y}"
            ${canAfford ? '' : 'disabled'}>
            🏗️ Build
          </button>
          <button id="imp-picker-cancel" class="btn btn--sm btn--ghost">Cancel</button>
        </div>
        <div class="imp-hint">Escape to cancel</div>
      </div>`;
  }

  _impPickerEl.classList.remove('imp-picker--hidden');
}

function _hideImprovementPicker() {
  _impPickerEl?.classList.add('imp-picker--hidden');
}
