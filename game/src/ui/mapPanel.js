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
import { attackTile, getAttackPreview, raidTile, getRaidPreview } from '../systems/combat.js';
import { buildTileImprovement, upgradeTileImprovement, fortifyTile, garrisonUnit, withdrawGarrison, getTotalGarrisoned, GARRISON_MAX_TOTAL, addMessage, foundCity } from '../core/actions.js';
import { UNITS } from '../data/units.js';
import { IMPROVEMENTS } from '../data/improvements.js';
import { EMPIRES } from '../data/empires.js';
import { acceptCaravanOffer, getCaravanSecsLeft } from '../systems/caravans.js';
import { LANDMARKS } from '../data/landmarks.js';
import { collectResourceNode, getNodeAt, nodeSecsLeft, activeNodeCount } from '../systems/resourceNodes.js';

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

const FOG_COLOR        = '#0a0d11';
const FOG_GRID         = '#12161b';
const PLAYER_TINT      = 'rgba(88,166,255,0.22)';
const ENEMY_TINT       = 'rgba(248,81,73,0.28)';
const BARBARIAN_TINT   = 'rgba(192,60,30,0.38)';   // T056
const CARAVAN_TINT     = 'rgba(255,200,50,0.28)';  // T063
const NODE_TINT        = 'rgba(255,170,0,0.35)';   // T104: resource node amber glow
const RUIN_TINT        = 'rgba(40,160,140,0.30)';  // T106: ancient ruin dark teal glow
const HOVER_ATTACK     = 'rgba(240,180,41,0.38)';
const HOVER_NEUTRAL    = 'rgba(255,255,255,0.08)';
const PLAYER_BORDER    = '#58a6ff';
const ENEMY_BORDER     = '#f85149';
const BARBARIAN_BORDER = '#c0402a';                 // T056
const NEUTRAL_BORDER   = '#30363d';

// T053: Per-faction enemy tile colors (tint overlay + border)
const FACTION_TINT = {
  ironHorde:   'rgba(255,140,0,0.26)',
  mageCouncil: 'rgba(175,100,255,0.24)',
  seaWolves:   'rgba(0,200,170,0.22)',
};
const FACTION_BORDER = {
  ironHorde:   '#e07010',
  mageCouncil: '#a060f0',
  seaWolves:   '#00c8aa',
};
// Legend entries for faction mode (shown in terrain legend alongside terrain swatches)
const FACTION_LEGEND = [
  { color: '#e07010', icon: '⚔️', label: 'Iron Horde' },
  { color: '#a060f0', icon: '🔮', label: 'Mage Council' },
  { color: '#00c8aa', icon: '🐺', label: 'Sea Wolves' },
];

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
let _caravanPickerEl = null;  // T063: caravan trade picker modal element
let _caravanTickRef  = 0;     // T063: setInterval id for live countdown

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
  on(Events.UNIT_CHANGED,    _render);
  on(Events.GARRISON_CHANGED, _render);
  on(Events.GAME_LOADED,     _render);

  // T063: re-render when caravan arrives/departs/trades
  on(Events.CARAVAN_UPDATED, (data) => {
    _render();
    if (data?.expired || data?.traded) _hideCaravanPicker();
  });

  // T089: re-render when a landmark is captured (tile icon clears)
  on(Events.LANDMARK_CAPTURED, _render);

  // T104: re-render when resource nodes spawn, are collected, or expire
  on(Events.RESOURCE_NODE_CHANGED, _render);

  // T106: re-render when a ruin is excavated (teal tint/icon needs to clear)
  on(Events.RUIN_EXCAVATED, _render);

  // T121: re-render when a city is founded
  on(Events.CITY_FOUNDED, _render);

  _render();
}

// ── HTML scaffold ──────────────────────────────────────────────────────────

function _buildHTML() {
  const terrainItems = Object.entries(TERRAIN_LABEL).map(([type, { label, bonus }]) =>
    `<span class="map-legend__item" data-terrain="${type}">
       <span class="map-legend__swatch" style="background:${TERRAIN_COLOR[type]}"></span>
       ${label} <span class="map-legend__bonus">${bonus}</span>
     </span>`
  ).join('');

  // T053: faction swatch items appended to terrain legend
  const factionItems = FACTION_LEGEND.map(({ color, icon, label }) =>
    `<span class="map-legend__item">
       <span class="map-legend__swatch map-legend__swatch--faction" style="background:${color}"></span>
       ${icon} ${label}
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
      ${terrainItems}
      ${factionItems}
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

  const hint = `<span class="map-legend__item map-legend__hint">⚔️ Click a highlighted tile to attack</span>`;

  if (_overlayMode) {
    el.innerHTML = OVERLAY_LEGEND.map(({ color, icon, label }) =>
      `<span class="map-legend__item">
         <span class="map-legend__swatch" style="background:${color}"></span>
         ${icon} ${label}
       </span>`
    ).join('') + hint;
  } else {
    // Terrain legend + T053: faction legend
    const terrainHtml = Object.entries(TERRAIN_LABEL).map(([type, { label, bonus }]) =>
      `<span class="map-legend__item" data-terrain="${type}">
         <span class="map-legend__swatch" style="background:${TERRAIN_COLOR[type]}"></span>
         ${label} <span class="map-legend__bonus">${bonus}</span>
       </span>`
    ).join('');
    const factionHtml = FACTION_LEGEND.map(({ color, icon, label }) =>
      `<span class="map-legend__item">
         <span class="map-legend__swatch map-legend__swatch--faction" style="background:${color}"></span>
         ${icon} ${label}
       </span>`
    ).join('');
    el.innerHTML = terrainHtml + factionHtml + hint;
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

  // T053: show faction name for enemy tiles; T056: show barbarian camp label
  const factionLabel = (tile.owner === 'enemy' && tile.faction && EMPIRES[tile.faction])
    ? `${EMPIRES[tile.faction].icon} ${EMPIRES[tile.faction].name}`
    : 'Enemy';
  // T093: show capital badge for faction capital tiles
  const capitalLabel = tile.isFactionCapital ? `👑 ${factionLabel} Capital` : factionLabel;
  const ownerHtml =
    tile.owner === 'player'    ? `<span class="map-tt-owner map-tt-owner--player">Your territory</span>`
    : tile.owner === 'enemy'   ? `<span class="map-tt-owner map-tt-owner--enemy">${capitalLabel}</span>`
    : tile.owner === 'barbarian' ? `<span class="map-tt-owner map-tt-owner--enemy">💀 Barbarian Camp</span>`
    : `<span class="map-tt-owner">Neutral</span>`;

  const bonusTxt  = TERRAIN_BONUS[tile.type];
  const bonusHtml = bonusTxt
    ? `<div class="map-tt-row map-tt-bonus">${bonusTxt}</div>`
    : '';

  // T063: detect caravan tile first so we can suppress build hints below
  const activeCaravan = state.caravans?.active;
  const isCaravanTile = !!(activeCaravan && activeCaravan.x === x && activeCaravan.y === y);

  // T121: city indicator in tooltip
  const cityHtml = tile.hasCity && tile.owner === 'player'
    ? `<div class="map-tt-row map-tt-bonus">🏙️ City (+1.5 gold/s, +0.5 food/s)</div>`
    : '';

  // T051: show improvement status or build hint (not for barbarian camps, not when caravan present)
  const impDef = IMPROVEMENTS[tile.type];
  let impHtml = '';
  if (tile.owner !== 'barbarian') {
    if (tile.improvement && impDef) {
      const isLv2 = tile.improvementLevel === 2;
      const lvl2  = impDef.level2;
      const display = isLv2 && lvl2 ? lvl2 : impDef;
      const lv2Badge = isLv2 ? ' <strong>Lv.2</strong>' : (lvl2 ? ' <span style="opacity:.6">(upgradeable)</span>' : '');
      impHtml = `<div class="map-tt-row map-tt-bonus">${display.icon} ${display.name}: ${display.desc}${lv2Badge}</div>`;
    } else if (!isCaravanTile && tile.owner === 'player' && tile.type !== 'capital' && impDef) {
      impHtml = `<div class="map-tt-action">🏗️ Click to build ${impDef.name}</div>`;
    }
  }

  // T056: show loot hint for barbarian camps
  let barbHtml = '';
  if (tile.owner === 'barbarian' && tile.loot && Object.keys(tile.loot).length) {
    const lootStr = Object.entries(tile.loot).map(([r, v]) => `+${v} ${r}`).join(', ');
    barbHtml = `<div class="map-tt-row map-tt-bonus">💰 Loot on capture: ${lootStr}</div>`;
  }

  // T063: caravan indicator
  const caravanHtml = isCaravanTile
    ? `<div class="map-tt-row map-tt-bonus">🛒 Merchant Caravan (${getCaravanSecsLeft()}s)</div>
       <div class="map-tt-action">🛒 Click to trade</div>`
    : '';

  // T104: resource node indicator
  const activeNode    = getNodeAt(x, y);
  const isNodeTile    = !!(activeNode && state.tick < activeNode.expiresAt);
  const nodeHtml      = isNodeTile
    ? `<div class="map-tt-row map-tt-bonus" style="color:#ffd700">✦ Resource Node: +${activeNode.amount} ${activeNode.resource} (${nodeSecsLeft(activeNode)}s left)</div>
       <div class="map-tt-action">✦ Click to collect</div>`
    : '';

  const actionHtml = !isCaravanTile && !isNodeTile && _isAttackable(x, y)
    ? `<div class="map-tt-action">⚔️ Click to attack</div>`
    : '';

  // T071: terrain combat modifier hint (shown for non-player tiles with a modifier)
  const tModEntry = _TERRAIN_MOD_LABELS[tile.type];
  const terrainCombatHtml = tModEntry && tile.owner !== 'player'
    ? `<div class="map-tt-row" style="font-size:0.7rem;color:var(--accent)">${tModEntry.icon} ${tModEntry.text}</div>`
    : '';

  // T093: faction capital capture hint
  const capitalHtml = tile.isFactionCapital && tile.owner === 'enemy'
    ? `<div class="map-tt-row" style="color:#ffd700;font-weight:600">👑 Capture for peace + prestige!</div>`
    : '';

  // T089: landmark hint
  const lmHtml = tile.landmark
    ? (() => {
        const ldef = LANDMARKS[tile.landmark];
        if (!ldef) return '';
        const captured = !!state.landmarks?.captured?.[tile.landmark];
        return captured
          ? `<div class="map-tt-row map-tt-bonus">🏅 ${ldef.icon} ${ldef.name} (captured)</div>`
          : `<div class="map-tt-row" style="color:#ffd700;font-weight:600">★ Landmark: ${ldef.name}</div>
             <div class="map-tt-row" style="font-size:0.7rem;color:var(--text-dim)">${ldef.desc}</div>`;
      })()
    : '';

  // T106: ruin hint
  const ruinHtml = tile.hasRuin && tile.revealed
    ? (() => {
        const excavated = !!state.ruins?.excavated?.[tile.hasRuin];
        return excavated
          ? `<div class="map-tt-row map-tt-bonus">🏛️ Ancient Ruin (excavated)</div>`
          : `<div class="map-tt-row" style="color:#28a08c;font-weight:600">🏛️ Ancient Ruins</div>
             <div class="map-tt-row" style="font-size:0.7rem;color:var(--text-dim)">Capture to excavate for a random reward!</div>`;
      })()
    : '';

  _tileTipEl.innerHTML = `
    <div class="map-tt-title">${TERRAIN_NAME[tile.type] ?? tile.type}</div>
    <div class="map-tt-row">${ownerHtml}</div>
    ${capitalHtml}
    ${lmHtml}
    ${ruinHtml}
    ${cityHtml}
    ${bonusHtml}
    ${terrainCombatHtml}
    ${barbHtml}
    ${impHtml}
    ${caravanHtml}
    ${nodeHtml}
    <div class="map-tt-row">🛡️ Defense: ${tile.defense}${tile.fortified ? ' 🏰' : ''}</div>
    ${(() => {
      const key = `${x},${y}`;
      const g = state.garrisons?.[key];
      if (!g) return '';
      const unitDef = UNITS[g.unitId];
      return `<div class="map-tt-row" style="color:#ffd700">🛡️ Garrison: ${g.count}× ${unitDef?.name ?? g.unitId} (+${(unitDef?.defense ?? 0) * g.count} def)</div>`;
    })()}
    ${tile.owner === 'player' && !tile.fortified && tile.type !== 'capital'
      ? `<div class="map-tt-row" style="font-size:0.7rem;color:var(--text-dim)">🏰 Click → Fortify (+15 def)</div>`
      : ''}
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

  // Owner tint — T053: faction colors for enemy, T056: maroon for barbarian
  if (tile.owner === 'player') {
    ctx.fillStyle = PLAYER_TINT;
    ctx.fillRect(px, py, TILE_PX, TILE_PX);
  } else if (tile.owner === 'enemy') {
    ctx.fillStyle = (tile.faction && FACTION_TINT[tile.faction]) ? FACTION_TINT[tile.faction] : ENEMY_TINT;
    ctx.fillRect(px, py, TILE_PX, TILE_PX);
  } else if (tile.owner === 'barbarian') {
    ctx.fillStyle = BARBARIAN_TINT;
    ctx.fillRect(px, py, TILE_PX, TILE_PX);
  }

  // T063: caravan gold tint on the caravan's tile
  const caravan = state.caravans?.active;
  if (caravan && caravan.x === x && caravan.y === y) {
    ctx.fillStyle = CARAVAN_TINT;
    ctx.fillRect(px, py, TILE_PX, TILE_PX);
  }

  // T104: amber glow tint on resource node tiles
  const _node = getNodeAt(x, y);
  if (_node && state.tick < _node.expiresAt) {
    ctx.fillStyle = NODE_TINT;
    ctx.fillRect(px, py, TILE_PX, TILE_PX);
  }

  // Hover highlight
  if (hoveredTile && hoveredTile.x === x && hoveredTile.y === y) {
    ctx.fillStyle = _isAttackable(x, y) ? HOVER_ATTACK : HOVER_NEUTRAL;
    ctx.fillRect(px, py, TILE_PX, TILE_PX);
  }

  // Border — T053: faction colors for enemy, T056: maroon for barbarian
  const borderColor = tile.owner === 'player'    ? PLAYER_BORDER
                    : tile.owner === 'enemy'      ? ((tile.faction && FACTION_BORDER[tile.faction]) ?? ENEMY_BORDER)
                    : tile.owner === 'barbarian'  ? BARBARIAN_BORDER
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

  // T063: caravan icon drawn on top of normal icons so it's always visible
  if (caravan && caravan.x === x && caravan.y === y) {
    _drawIcon(px, py, '🛒');
    return;  // caravan overrides all other icons
  }

  // Icons: capital castle, enemy sword/crown, barbarian skull, improvement icons
  if (x === capital.x && y === capital.y) {
    _drawIcon(px, py, '🏰');
  } else if (tile.owner === 'barbarian' && tile.revealed) {
    _drawIcon(px, py, '💀');   // T056: barbarian camp skull
  } else if (tile.owner === 'enemy' && tile.revealed) {
    _drawIcon(px, py, tile.isFactionCapital ? '👑' : '⚔️');  // T093: crown for faction capitals
  } else if (tile.owner === 'player' && tile.hasCity) {
    // T121: draw city icon on city tiles (takes precedence over improvement)
    _drawIcon(px, py, '🏙️');
  } else if (tile.owner === 'player' && tile.improvement) {
    // T051: draw improvement icon on player-owned improved tiles
    const impDef = IMPROVEMENTS[tile.type];
    if (impDef) _drawIcon(px, py, impDef.icon);
    // T095: draw "2" badge on Level 2 improved tiles (bottom-right corner)
    if (tile.improvementLevel === 2) {
      ctx.font          = 'bold 8px sans-serif';
      ctx.textAlign     = 'right';
      ctx.textBaseline  = 'bottom';
      ctx.fillStyle     = '#ffd700';
      ctx.fillText('2', px + TILE_PX - 2, py + TILE_PX - 1);
      ctx.textAlign     = 'center';
      ctx.textBaseline  = 'middle';
    }
  }

  // T066: draw fortification indicator (small corner mark) on fortified player tiles
  if (tile.owner === 'player' && tile.fortified && x !== capital?.x || y !== capital?.y) {
    // Draw a small '▲' fortress indicator in the top-right corner
    ctx.font          = `8px sans-serif`;
    ctx.textAlign     = 'right';
    ctx.textBaseline  = 'top';
    ctx.fillStyle     = '#aad4ff';
    ctx.fillText('▲', px + TILE_PX - 2, py + 2);
    ctx.textAlign = 'center';
  }

  // T068: draw garrison shield indicator in bottom-left corner
  if (tile.owner === 'player' && state.garrisons?.[`${x},${y}`]) {
    const g = state.garrisons[`${x},${y}`];
    ctx.font         = `7px sans-serif`;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle    = '#ffd700';
    ctx.fillText(`🛡${g.count}`, px + 2, py + TILE_PX - 1);
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
  }

  // T089: draw landmark star indicator — revealed non-player-captured landmarks get a ★ mark
  if (tile.landmark && tile.owner !== 'player') {
    const ldef = LANDMARKS[tile.landmark];
    if (ldef) {
      ctx.font         = `9px sans-serif`;
      ctx.textAlign    = 'right';
      ctx.textBaseline = 'top';
      ctx.fillStyle    = '#ffd700';
      ctx.fillText('★', px + TILE_PX - 2, py + 2);
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
    }
  }

  // T104: draw ✦ resource node glyph in tile centre (neutral tiles only, visible on top)
  if (_node && state.tick < _node.expiresAt) {
    ctx.font         = `bold ${TILE_PX - 8}px sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#ffd700';
    ctx.fillText('✦', px + TILE_PX / 2, py + TILE_PX / 2 + 1);
  }

  // T106: draw 🏛 ruin indicator on revealed non-excavated neutral tiles
  const _ruinId = tile.hasRuin;
  if (_ruinId && tile.owner !== 'player' && tile.revealed) {
    const alreadyDone = !!state.ruins?.excavated?.[_ruinId];
    if (!alreadyDone) {
      ctx.fillStyle = RUIN_TINT;
      ctx.fillRect(px, py, TILE_PX, TILE_PX);
      ctx.font         = `${TILE_PX - 10}px sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🏛', px + TILE_PX / 2, py + TILE_PX / 2 + 1);
    }
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

  let playerTiles    = 0;
  let enemyTiles     = 0;
  let barbarianCamps = 0;
  let revealedTiles  = 0;

  for (let y = 0; y < state.map.height; y++) {
    for (let x = 0; x < state.map.width; x++) {
      const t = state.map.tiles[y][x];
      if (t.owner === 'player')    playerTiles++;
      else if (t.owner === 'enemy')     enemyTiles++;
      else if (t.owner === 'barbarian') barbarianCamps++;
      if (t.revealed) revealedTiles++;
    }
  }

  const total = state.map.width * state.map.height;
  const barbStr    = barbarianCamps > 0 ? `  ·  💀 Camps: ${barbarianCamps}` : '';
  const caravanStr = state.caravans?.active
    ? `  ·  🛒 Caravan: ${getCaravanSecsLeft()}s left` : '';
  const nodeCount  = activeNodeCount();
  const nodeStr    = nodeCount > 0 ? `  ·  ✦ Nodes: ${nodeCount}` : '';
  el.textContent =
    `Territory: ${playerTiles} tiles  ·  Enemy: ${enemyTiles} tiles${barbStr}  ·  Explored: ${revealedTiles}/${total}${caravanStr}${nodeStr}`;
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

  // T104: check for resource node before other actions
  const clickedNode = getNodeAt(x, y);
  if (clickedNode && state.tick < clickedNode.expiresAt) {
    const result = collectResourceNode(x, y);
    if (!result.ok) addMessage(`✦ ${result.reason}`, 'info');
    return;
  }

  // T063: check for caravan tile
  const caravan = state.caravans?.active;
  if (caravan && caravan.x === x && caravan.y === y) {
    _showCaravanPicker();
    return;
  }

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

// T071: Human-readable terrain combat modifier descriptions (shown in preview + tooltip)
const _TERRAIN_MOD_LABELS = {
  mountain: { icon: '⛰️', text: 'Mountain — ATK −15%  ·  DEF +25%' },
  hills:    { icon: '⛺', text: 'Hills — DEF +15%' },
  forest:   { icon: '🌲', text: 'Forest — ATK +10%  ·  DEF +5%' },
  river:    { icon: '🌊', text: 'River — ATK −5%  ·  DEF +10%' },
};

/** Format a terrain combat modifier for display (returns '' if no effect). */
function _terrainModHtml(terrainType, style = '') {
  const entry = _TERRAIN_MOD_LABELS[terrainType];
  if (!entry) return '';
  return `<div class="cp-siege-notice cp-terrain-mod" style="${style}">${entry.icon} ${entry.text}</div>`;
}

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
    } else if (e.target.id === 'cp-raid-btn') {
      const t = _previewTarget;
      _hideCombatPreview();
      if (t) raidTile(t.x, t.y);
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
  const ownerStr = p.owner === 'barbarian' ? '💀 Barbarian Camp'
                 : p.owner === 'enemy'     ? 'Enemy territory'
                 : 'Neutral territory';

  const lootEntries = Object.entries(p.loot).filter(([, v]) => v > 0);
  const lootHtml = lootEntries.length
    ? lootEntries.map(([res, amt]) => `<span class="cp-loot-item">+${amt} ${res}</span>`).join('')
    : '<span class="cp-loot-none">None</span>';

  const siegeHtml = p.siegeActive
    ? `<div class="cp-siege-notice">🏰 Siege Master active — guaranteed victory!</div>`
    : '';

  const manaBoltHtml = p.manaBoltActive
    ? `<div class="cp-siege-notice" style="color:#9bb4f8">⚡ Mana Bolt primed — guaranteed victory!</div>`
    : '';

  const battleCryHtml = (state.hero?.activeEffects?.battleCry)
    ? `<div class="cp-siege-notice" style="color:var(--blue)">📣 Battle Cry active — attack doubled!</div>`
    : '';

  const formationLabels = { defensive: '🛡️ Defensive (–15% atk)', balanced: '⚖️ Balanced', aggressive: '⚔️ Aggressive (+25% atk)' };
  const formationHtml = p.formation && p.formation !== 'balanced'
    ? `<div class="cp-siege-notice" style="color:var(--text-dim)">${formationLabels[p.formation] ?? p.formation}</div>`
    : '';

  // T071: terrain modifier notice (only shown when there's actually a modifier)
  const terrainNoticeHtml = _terrainModHtml(p.terrain, 'color:var(--accent-h)');

  // T101: Streak bonus notice
  const STREAK_TIER_LABELS = ['', '🔥 Momentum', '⚡ Battle Fury', '💥 Unstoppable'];
  const STREAK_TIER_BONUS  = ['', '+10% ATK', '+20% ATK', '+35% ATK, ×2 loot'];
  const streakTier  = p.streakTier ?? 0;
  const streakCount = p.streakCount ?? 0;
  const streakHtmlPreview = streakTier > 0
    ? `<div class="cp-streak-notice">${STREAK_TIER_LABELS[streakTier]}: ${streakCount}-win streak — ${STREAK_TIER_BONUS[streakTier]}</div>`
    : (streakCount >= 2
      ? `<div class="cp-streak-notice" style="opacity:0.7">⚔️ Streak: ${streakCount} wins (${3 - streakCount} more for Momentum)</div>`
      : '');

  // T102: Aid troops notice
  const aidHtmlPreview = p.aidActive
    ? `<div class="cp-siege-notice" style="color:#68d391">🛡️ Allied Aid: ${p.aidBattlesLeft} battle${p.aidBattlesLeft !== 1 ? 's' : ''} remaining</div>`
    : '';

  // Use effective defense (after terrain) for the stat display; show base if different
  const defDisplay = (p.effectiveDefense !== undefined && p.effectiveDefense !== p.defense)
    ? `${p.effectiveDefense} <span style="font-size:0.75em;opacity:0.6">(base ${p.defense})</span>`
    : `${p.defense}`;

  // T127: Raid preview info
  const raidP = getRaidPreview(x, y);
  const raidHtml = raidP.valid
    ? (() => {
        const raidPct  = Math.round(raidP.winChance * 100);
        const raidCol  = raidPct >= 65 ? 'var(--green)' : raidPct >= 45 ? 'var(--accent)' : 'var(--red)';
        const raidLoot = Object.entries(raidP.loot).filter(([, v]) => v > 0)
          .map(([r, v]) => `+${v} ${r}`).join(', ');
        const cdNote   = raidP.onCooldown
          ? `<span style="color:var(--red);font-size:10px"> (cooldown: ${raidP.cooldownSecs}s)</span>` : '';
        return `
          <div class="cp-raid-section">
            <div class="cp-raid-header">⚡ Raid for Resources${cdNote}</div>
            <div class="cp-raid-info">
              <span>Win: <b style="color:${raidCol}">${raidPct}%</b></span>
              <span>·</span>
              <span>Cost: <b>30 🍞</b></span>
              <span>·</span>
              <span style="font-size:10px;color:var(--text-dim)">${raidLoot}</span>
            </div>
            <div class="cp-raid-desc">Steal resources without capturing territory.</div>
          </div>`;
      })()
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
          <span class="cp-stat__value" style="color:var(--red)">${defDisplay}</span>
        </div>
        <div class="cp-stat">
          <span class="cp-stat__label">Win Chance</span>
          <span class="cp-stat__value" style="color:${winColor}">${winPct}%</span>
        </div>
      </div>
      ${terrainNoticeHtml}${siegeHtml}${manaBoltHtml}${battleCryHtml}${formationHtml}${streakHtmlPreview}${aidHtmlPreview}
      <div class="cp-loot-row">
        <span class="cp-loot-label">Loot on victory:</span>
        <span class="cp-loot-items">${lootHtml}</span>
      </div>
      ${raidHtml}
      <div class="cp-actions">
        <button id="cp-attack-btn" class="btn btn--sm btn--cp-attack">⚔️ Attack</button>
        ${raidP.valid ? `<button id="cp-raid-btn" class="btn btn--sm btn--cp-raid" ${raidP.onCooldown ? 'disabled' : ''}>⚡ Raid</button>` : ''}
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
    // Build improvement button
    if (e.target.dataset.impBuild) {
      const [sx, sy] = e.target.dataset.impBuild.split(',').map(Number);
      _hideImprovementPicker();
      const result = buildTileImprovement(sx, sy);
      if (!result.ok) addMessage(`❌ ${result.reason}`, 'info');
    }
    // T095: Upgrade improvement button
    if (e.target.dataset.impUpgrade) {
      const [sx, sy] = e.target.dataset.impUpgrade.split(',').map(Number);
      _hideImprovementPicker();
      const result = upgradeTileImprovement(sx, sy);
      if (!result.ok) addMessage(`❌ ${result.reason}`, 'info');
    }
    // T066: Fortify button
    if (e.target.dataset.fortify) {
      const [sx, sy] = e.target.dataset.fortify.split(',').map(Number);
      _hideImprovementPicker();
      const result = fortifyTile(sx, sy);
      if (!result.ok) addMessage(`❌ ${result.reason}`, 'info');
    }
    // T068: Garrison unit button
    if (e.target.dataset.garrison) {
      const { garrison: unitId, gx, gy } = e.target.dataset;
      const result = garrisonUnit(Number(gx), Number(gy), unitId);
      if (!result.ok) addMessage(`❌ ${result.reason}`, 'info');
      else _hideImprovementPicker();
    }
    // T121: Found city button
    if (e.target.dataset.foundCity) {
      const [sx, sy] = e.target.dataset.foundCity.split(',').map(Number);
      _hideImprovementPicker();
      const result = foundCity(sx, sy);
      if (!result.ok) addMessage(`❌ ${result.reason}`, 'info');
    }
    // T068: Withdraw garrison button
    if (e.target.dataset.withdrawGarrison) {
      const [sx, sy] = e.target.dataset.withdrawGarrison.split(',').map(Number);
      const result = withdrawGarrison(sx, sy);
      if (!result.ok) addMessage(`❌ ${result.reason}`, 'info');
      else _hideImprovementPicker();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (_impPickerEl?.classList.contains('imp-picker--hidden')) return;
    if (e.key === 'Escape') { e.stopPropagation(); _hideImprovementPicker(); }
  });
}

function _citySection(x, y, tile) {
  if (tile.type === 'capital') return '';
  if (tile.hasCity) return `<div class="imp-city-built">🏙️ City established (+1.5 gold/s, +0.5 food/s)</div>`;

  const bronzeAge = (state.age ?? 0) >= 1;
  let cityCount = 0;
  for (const row of (state.map?.tiles ?? [])) {
    for (const t of row) { if (t.hasCity) cityCount++; }
  }
  const atCityMax  = cityCount >= 5;
  const canAfford  = (state.resources.gold  ?? 0) >= 200
                  && (state.resources.stone ?? 0) >= 100
                  && (state.resources.iron  ?? 0) >= 50;
  const disabled   = !bronzeAge || atCityMax || !canAfford;
  const costClass  = canAfford ? 'imp-cost--ok' : 'imp-cost--bad';
  const ageNote    = !bronzeAge ? '<span class="imp-note">🔒 Requires Bronze Age</span>' : '';
  const maxNote    = atCityMax  ? '<span class="imp-note">City limit (5) reached</span>' : '';

  return `
    <div class="imp-city-section">
      <div class="imp-city-header">🏙️ Found City — 200💰 100🪨 50⚙️ (${cityCount}/5)</div>
      <div class="imp-city-desc">+1.5 gold/s and +0.5 food/s permanently.</div>
      <span class="${costClass}">200 gold · 100 stone · 50 iron</span>
      ${ageNote}${maxNote}
      <button class="btn btn--sm btn--city-found" data-found-city="${x},${y}"
        ${disabled ? 'disabled' : ''}>
        🏙️ Found City
      </button>
    </div>`;
}

function _showImprovementPicker(x, y, tile) {
  if (!_impPickerEl) _createImprovementPicker();

  const impDef = IMPROVEMENTS[tile.type];

  // T066: Fortification section (shared across all states)
  const isFortified = !!tile.fortified;
  const canFortifyAfford = (state.resources.stone ?? 0) >= 40 && (state.resources.iron ?? 0) >= 25;
  const fortifySection = isFortified
    ? `<div class="imp-fortified">🏰 Fortified (+15 defense)</div>`
    : `<div class="imp-fortify-row">
        <span class="imp-fortify-label">🏰 Fortify (+15 def) — 40🪨 25⚙️</span>
        <button class="btn btn--sm btn--fortify" data-fortify="${x},${y}"
          ${canFortifyAfford ? '' : 'disabled'}>
          Fortify
        </button>
       </div>`;

  // T068: Garrison section (shared across all states, below fortify)
  const garrisonSection = _garrisonSection(x, y, tile);

  if (tile.improvement) {
    // Already improved — show info + optional Level 2 upgrade
    const isLv2    = tile.improvementLevel === 2;
    const lvl2Def  = impDef?.level2;
    const canUpgrade = !isLv2 && lvl2Def && (state.age ?? 0) >= 2;
    const currentDesc = isLv2 && lvl2Def
      ? `${lvl2Def.icon} ${lvl2Def.name} — ${lvl2Def.desc} <span class="imp-lv2-badge">Lv.2</span>`
      : (impDef ? `${impDef.icon} ${impDef.name} — ${impDef.desc}` : tile.improvement);

    let upgradeSection = '';
    if (canUpgrade) {
      const costParts = Object.entries(lvl2Def.upgradeCost).map(([r, a]) => {
        const have   = Math.floor(state.resources[r] ?? 0);
        const enough = have >= a;
        return `<span class="${enough ? 'imp-cost--ok' : 'imp-cost--bad'}">${a} ${r} (have ${have})</span>`;
      });
      const canAffordUpgrade = Object.entries(lvl2Def.upgradeCost).every(([r, a]) => (state.resources[r] ?? 0) >= a);
      upgradeSection = `
        <div class="imp-upgrade-section">
          <div class="imp-upgrade-label">⬆️ Upgrade to ${lvl2Def.name}</div>
          <div class="imp-upgrade-desc">${lvl2Def.desc} (Level 2 — Iron Age required)</div>
          <div class="imp-costs">${costParts.join(' · ')}</div>
          <button class="btn btn--sm btn--imp-upgrade" data-imp-upgrade="${x},${y}"
            ${canAffordUpgrade ? '' : 'disabled'}>
            ⬆️ Upgrade
          </button>
        </div>`;
    } else if (!isLv2 && lvl2Def) {
      upgradeSection = `<div class="imp-note imp-upgrade-locked">🔒 Iron Age required to upgrade.</div>`;
    }

    _impPickerEl.innerHTML = `
      <div class="imp-box">
        <div class="imp-header">🏗️ Tile Actions</div>
        <div class="imp-sub">${_TERRAIN_LABELS[tile.type] ?? tile.type} (${x}, ${y})</div>
        <div class="imp-built">${currentDesc}</div>
        ${isLv2 ? '' : '<div class="imp-note">Improvement built.</div>'}
        ${upgradeSection}
        ${fortifySection}
        ${garrisonSection}
        ${_citySection(x, y, tile)}
        <div class="imp-actions">
          <button id="imp-picker-cancel" class="btn btn--sm btn--ghost">Close</button>
        </div>
      </div>`;
  } else if (!impDef) {
    // No improvement available for this terrain (shouldn't happen for non-capital)
    _impPickerEl.innerHTML = `
      <div class="imp-box">
        <div class="imp-header">🏗️ Tile Actions</div>
        <div class="imp-sub">${_TERRAIN_LABELS[tile.type] ?? tile.type} (${x}, ${y})</div>
        <div class="imp-note">No terrain improvement available here.</div>
        ${fortifySection}
        ${garrisonSection}
        ${_citySection(x, y, tile)}
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
        <div class="imp-header">🏗️ Tile Actions</div>
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
        ${fortifySection}
        ${garrisonSection}
        ${_citySection(x, y, tile)}
        <div class="imp-hint">Escape to cancel</div>
      </div>`;
  }

  _impPickerEl.classList.remove('imp-picker--hidden');
}

function _garrisonSection(x, y, tile) {
  if (tile.owner !== 'player') return '';
  const cap = state.map?.capital;
  if (x === cap?.x && y === cap?.y) return '';  // capital always defended

  const key       = `${x},${y}`;
  const existing  = state.garrisons?.[key];
  const totalUsed = getTotalGarrisoned();
  const atLimit   = totalUsed >= GARRISON_MAX_TOTAL;

  if (existing) {
    const unitDef = UNITS[existing.unitId];
    return `
      <div class="imp-garrison">
        <div class="imp-garrison__header">🛡️ Garrison (${totalUsed}/${GARRISON_MAX_TOTAL} total)</div>
        <div class="imp-garrison__current">
          ${unitDef?.icon ?? ''} ${existing.count}× ${unitDef?.name ?? existing.unitId}
          <span style="color:var(--green)">+${(unitDef?.defense ?? 0) * existing.count} def</span>
        </div>
        <button class="btn btn--sm btn--garrison-withdraw"
          data-withdraw-garrison="${x},${y}">
          ↩ Withdraw
        </button>
      </div>`;
  }

  // Show available unit types for garrisoning
  const unitButtons = Object.entries(state.units ?? {})
    .filter(([, count]) => count > 0)
    .map(([unitId, count]) => {
      const def = UNITS[unitId];
      const disabled = atLimit ? 'disabled' : '';
      const foodCost = 30;
      const canAffordFood = (state.resources?.food ?? 0) >= foodCost;
      const isDisabled = atLimit || !canAffordFood;
      return `<button class="btn btn--sm btn--garrison-unit ${isDisabled ? 'btn--disabled' : ''}"
        data-garrison="${unitId}" data-gx="${x}" data-gy="${y}"
        ${isDisabled ? 'disabled' : ''}
        title="${def?.name ?? unitId} — 1 unit, ${foodCost} 🍞">
        ${def?.icon ?? ''} ${def?.name ?? unitId} (${count}) — 30🍞
      </button>`;
    }).join('');

  if (!unitButtons) return '';

  return `
    <div class="imp-garrison">
      <div class="imp-garrison__header">🛡️ Garrison Unit (${totalUsed}/${GARRISON_MAX_TOTAL} total)</div>
      ${atLimit ? `<div class="imp-garrison__limit">Garrison limit reached.</div>` : ''}
      <div class="imp-garrison__units">${unitButtons}</div>
    </div>`;
}

function _hideImprovementPicker() {
  _impPickerEl?.classList.add('imp-picker--hidden');
}

// ── T063: Caravan trade picker ─────────────────────────────────────────────

function _createCaravanPicker() {
  const existing = document.getElementById('caravan-picker');
  if (existing) { _caravanPickerEl = existing; return; }

  _caravanPickerEl = document.createElement('div');
  _caravanPickerEl.id        = 'caravan-picker';
  _caravanPickerEl.className = 'caravan-picker caravan-picker--hidden';
  document.body.appendChild(_caravanPickerEl);

  // Delegated click handler
  _caravanPickerEl.addEventListener('click', (e) => {
    if (e.target.id === 'caravan-close' || e.target === _caravanPickerEl) {
      _hideCaravanPicker();
    }
    if (e.target.dataset.caravanOffer !== undefined) {
      const idx = Number(e.target.dataset.caravanOffer);
      const result = acceptCaravanOffer(idx);
      if (!result.ok) {
        addMessage(`❌ ${result.reason}`, 'info');
      }
      // CARAVAN_UPDATED listener will close the picker on trade
      _showCaravanPicker(); // refresh offer display
    }
  });

  document.addEventListener('keydown', (e) => {
    if (_caravanPickerEl?.classList.contains('caravan-picker--hidden')) return;
    if (e.key === 'Escape') { e.stopPropagation(); _hideCaravanPicker(); }
  });
}

function _showCaravanPicker() {
  if (!_caravanPickerEl) _createCaravanPicker();

  const c = state.caravans?.active;
  if (!c) { _hideCaravanPicker(); return; }

  const secsLeft = getCaravanSecsLeft();

  const offerCards = c.offers.map((offer, i) => {
    const giveEntries = Object.entries(offer.give);
    const getEntries  = Object.entries(offer.get);

    const giveHtml = giveEntries.map(([res, amt]) => {
      const have   = Math.floor(state.resources[res] ?? 0);
      const enough = have >= amt;
      return `<span class="cv-res ${enough ? 'cv-res--ok' : 'cv-res--bad'}">−${amt} ${res}</span>`;
    }).join(' ');

    const getHtml = getEntries.map(([res, amt]) =>
      `<span class="cv-res cv-res--gain">+${amt} ${res}</span>`
    ).join(' ');

    const canAfford = giveEntries.every(([res, amt]) => (state.resources[res] ?? 0) >= amt);

    return `
      <div class="cv-offer">
        <div class="cv-offer__icon">${offer.icon}</div>
        <div class="cv-offer__body">
          <div class="cv-offer__desc">${offer.desc}</div>
          <div class="cv-offer__exchange">${giveHtml} → ${getHtml}</div>
        </div>
        <button class="btn btn--sm btn--caravan-trade"
          data-caravan-offer="${i}"
          ${canAfford ? '' : 'disabled'}>
          Trade
        </button>
      </div>`;
  }).join('');

  _caravanPickerEl.innerHTML = `
    <div class="cv-box">
      <div class="cv-header">🛒 Merchant Caravan</div>
      <div class="cv-sub">Departing in <span class="cv-countdown">${secsLeft}s</span> · Select a trade offer</div>
      <div class="cv-offers">${offerCards}</div>
      <div class="cv-actions">
        <button id="caravan-close" class="btn btn--sm btn--ghost">Close</button>
      </div>
      <div class="cv-hint">Escape to close</div>
    </div>
  `;

  // Start live countdown refresh
  clearInterval(_caravanTickRef);
  _caravanTickRef = setInterval(() => {
    if (_caravanPickerEl.classList.contains('caravan-picker--hidden')) {
      clearInterval(_caravanTickRef);
      return;
    }
    const el = _caravanPickerEl.querySelector('.cv-countdown');
    if (el) el.textContent = `${getCaravanSecsLeft()}s`;
  }, 1000);

  _caravanPickerEl.classList.remove('caravan-picker--hidden');
}

function _hideCaravanPicker() {
  clearInterval(_caravanTickRef);
  _caravanPickerEl?.classList.add('caravan-picker--hidden');
}
