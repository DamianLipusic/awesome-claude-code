/**
 * EmpireOS — Almanac Panel (T177)
 *
 * A searchable in-game reference covering buildings, units, technologies,
 * wonders, and core game mechanics. Keyboard shortcut: '=' to open.
 */

import { BUILDINGS } from '../data/buildings.js';
import { UNITS }     from '../data/units.js';
import { TECHS }     from '../data/techs.js';
import { WONDERS }   from '../data/wonders.js';
import { state }     from '../core/state.js';

const PANEL_ID = 'panel-almanac';

const CATEGORIES = [
  { id: 'all',       label: '🔍 All'       },
  { id: 'buildings', label: '🏗️ Buildings'  },
  { id: 'units',     label: '⚔️ Units'       },
  { id: 'techs',     label: '🔬 Techs'       },
  { id: 'wonders',   label: '🏛️ Wonders'     },
  { id: 'mechanics', label: '📖 Mechanics'   },
];

const MECHANICS = [
  {
    id: 'resources', name: 'Resources', icon: '💰',
    description: 'Six main resources: Food (sustains population), Wood (construction), Stone (advanced buildings), Gold (trade & training), Iron (military), Mana (magic). Each has a storage cap you can expand with warehouses and upgrades.',
  },
  {
    id: 'ages', name: 'Ages', icon: '⚡',
    description: 'Your empire advances through four ages: Stone, Bronze, Iron, and Medieval. Each age unlocks new buildings, units, and technologies. Advance by meeting population, research, and prestige milestones shown in the Empire tab.',
  },
  {
    id: 'seasons', name: 'Seasons', icon: '🌸',
    description: 'The year cycles through Spring, Summer, Autumn, and Winter. Each season boosts certain buildings and units while penalising others. Winter is harsh — stock up on food and wood before it arrives.',
  },
  {
    id: 'territory', name: 'Territory', icon: '🗺️',
    description: 'The map is a 20×20 grid of tiles. Capture tiles by defeating enemies in combat. Each tile you hold generates resources each tick and can be improved with farms, mines, and fortifications.',
  },
  {
    id: 'morale', name: 'Morale', icon: '💪',
    description: 'Morale (0–100) represents your citizens\' spirit. High morale boosts all production; low morale can trigger rebel uprisings. Keep citizens happy with food surpluses, festivals, and military victories.',
  },
  {
    id: 'prestige', name: 'Prestige', icon: '✨',
    description: 'Prestige is earned through military victories, wonders, and great deeds. It gates diplomatic actions like alliances and summits, and determines your empire\'s rank on the leaderboard at game end.',
  },
  {
    id: 'research', name: 'Research', icon: '🔬',
    description: 'Technologies are unlocked one at a time via the Research tab. Each tech provides permanent bonuses to production, combat, or unlocks new units and buildings. Completing tech groups earns mastery bonuses.',
  },
  {
    id: 'diplomacy', name: 'Diplomacy', icon: '🤝',
    description: 'Three rival empires share the map. Form alliances for trade bonuses and military aid, or declare war to seize their territory. Relations improve through gifts, mediation, and joint campaigns.',
  },
  {
    id: 'hero', name: 'Hero', icon: '🦸',
    description: 'Your empire\'s hero is a powerful named commander who levels up and gains traits. Heroes can lead expeditions, duel rival warlords, and be enshrined upon retirement for a permanent legacy bonus.',
  },
  {
    id: 'war_exhaustion', name: 'War Exhaustion', icon: '😩',
    description: 'Prolonged combat accumulates War Exhaustion, penalising production and morale. Exhaustion fades naturally during peace. Avoid overextending your forces — quality over quantity wins wars.',
  },
  {
    id: 'population', name: 'Population', icon: '👥',
    description: 'Citizens generate passive production bonuses and can fill special roles (scholars, artisans, soldiers). Grow population by building Houses. Reaching milestones at 500, 1 000, and 2 000 citizens grants a special bonus choice.',
  },
  {
    id: 'save_load', name: 'Save & Load', icon: '💾',
    description: 'The game auto-saves to your browser\'s localStorage every 60 seconds. Press S or click Save to save manually. Export your save as a text code to back up or transfer your progress to another browser.',
  },
];

// ── Formatting helpers ──────────────────────────────────────────────────────

const RES_ICONS = {
  gold: '💰', food: '🍞', wood: '🪵', stone: '🪨',
  iron: '⚒️', mana: '✨', prestige: '👑',
};

function _fmt(obj) {
  if (!obj) return '—';
  const parts = Object.entries(obj).filter(([, v]) => v > 0)
    .map(([k, v]) => `${RES_ICONS[k] ?? ''} ${Number.isInteger(v) ? v : v.toFixed(1)} ${k}`);
  return parts.length ? parts.join(', ') : '—';
}

function _esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _reqLabel(r) {
  if (r.type === 'building') return `🏗️ ${BUILDINGS[r.id]?.name ?? r.id}${r.count && r.count > 1 ? ` ×${r.count}` : ''}`;
  if (r.type === 'tech')    return `🔬 ${TECHS[r.id]?.name ?? r.id}`;
  if (r.type === 'age')     return `⚡ Age ${r.minAge + 1}+`;
  return r.id;
}

// ── Card renderers ──────────────────────────────────────────────────────────

function _buildingCard(id, b) {
  const owned   = (state.buildings ?? {})[id] ?? 0;
  const costStr = _fmt(b.baseCost);
  const prodStr = _fmt(b.production);
  const consStr = _fmt(b.consumption);
  const reqs    = (b.requires ?? []).map(_reqLabel).join(' · ');

  return `
    <div class="alm-card" data-category="buildings">
      <div class="alm-card__hd">
        <span class="alm-card__ico">${_esc(b.icon)}</span>
        <div class="alm-card__ti">
          <span class="alm-card__name">${_esc(b.name)}</span>
          ${b.unique ? '<span class="alm-badge">Unique</span>' : ''}
          ${owned ? `<span class="alm-badge alm-badge--own">Own: ${owned}</span>` : ''}
        </div>
      </div>
      <p class="alm-card__desc">${_esc(b.description)}</p>
      <dl class="alm-dl">
        <dt>Cost</dt><dd>${costStr}</dd>
        ${prodStr !== '—' ? `<dt>Produces</dt><dd>${prodStr}/s</dd>` : ''}
        ${consStr !== '—' ? `<dt>Consumes</dt><dd>${consStr}/s</dd>` : ''}
        ${reqs ? `<dt>Requires</dt><dd>${reqs}</dd>` : ''}
      </dl>
    </div>`;
}

function _unitCard(id, u) {
  const count      = (state.units ?? {})[id] ?? 0;
  const costStr    = _fmt(u.cost);
  const upkeepStr  = _fmt(u.upkeep);
  const trainSecs  = Math.round(u.trainTicks / 4);
  const reqs       = (u.requires ?? []).map(_reqLabel).join(' · ');

  return `
    <div class="alm-card" data-category="units">
      <div class="alm-card__hd">
        <span class="alm-card__ico">${_esc(u.icon)}</span>
        <div class="alm-card__ti">
          <span class="alm-card__name">${_esc(u.name)}</span>
          ${count ? `<span class="alm-badge alm-badge--own">Active: ${count}</span>` : ''}
        </div>
      </div>
      <p class="alm-card__desc">${_esc(u.description)}</p>
      <dl class="alm-dl">
        <dt>Train cost</dt><dd>${costStr}</dd>
        <dt>Train time</dt><dd>${trainSecs}s</dd>
        <dt>Attack</dt><dd>${u.attack}</dd>
        <dt>Defense</dt><dd>${u.defense}</dd>
        ${upkeepStr !== '—' ? `<dt>Upkeep</dt><dd>${upkeepStr}/s</dd>` : ''}
        ${reqs ? `<dt>Requires</dt><dd>${reqs}</dd>` : ''}
      </dl>
    </div>`;
}

function _techCard(id, t) {
  const done     = !!(state.techs ?? {})[id];
  const costStr  = _fmt(t.cost);
  const secs     = Math.round(t.researchTicks / 4);
  const prereqs  = (t.requires ?? []).map(r => TECHS[r]?.name ?? r).join(', ');

  return `
    <div class="alm-card ${done ? 'alm-card--done' : ''}" data-category="techs">
      <div class="alm-card__hd">
        <span class="alm-card__ico">${_esc(t.icon)}</span>
        <div class="alm-card__ti">
          <span class="alm-card__name">${_esc(t.name)}</span>
          ${done ? '<span class="alm-badge alm-badge--done">✓ Researched</span>' : ''}
        </div>
      </div>
      <p class="alm-card__desc">${_esc(t.description)}</p>
      <dl class="alm-dl">
        <dt>Cost</dt><dd>${costStr}</dd>
        <dt>Time</dt><dd>${secs}s</dd>
        ${t.effectDesc ? `<dt>Effect</dt><dd>${_esc(t.effectDesc)}</dd>` : ''}
        ${prereqs ? `<dt>Requires</dt><dd>${_esc(prereqs)}</dd>` : ''}
      </dl>
    </div>`;
}

function _wonderCard(id, w) {
  const builtState = (state.wonders ?? {})[w.id ?? id];
  const built      = builtState?.built;
  const costStr    = _fmt(w.cost);
  const buildSecs  = Math.round((w.buildTicks ?? 0) / 4);

  return `
    <div class="alm-card ${built ? 'alm-card--done' : ''}" data-category="wonders">
      <div class="alm-card__hd">
        <span class="alm-card__ico">${_esc(w.icon)}</span>
        <div class="alm-card__ti">
          <span class="alm-card__name">${_esc(w.name)}</span>
          ${built ? '<span class="alm-badge alm-badge--done">✓ Built</span>' : ''}
        </div>
      </div>
      <p class="alm-card__desc">${_esc(w.desc ?? '')}</p>
      <dl class="alm-dl">
        <dt>Cost</dt><dd>${costStr}</dd>
        <dt>Build time</dt><dd>${buildSecs}s</dd>
        ${w.bonusLabel ? `<dt>Bonus</dt><dd>${_esc(w.bonusLabel)}</dd>` : ''}
        ${w.flavorText ? `<dt>Lore</dt><dd><em>${_esc(w.flavorText)}</em></dd>` : ''}
      </dl>
    </div>`;
}

function _mechanicCard(m) {
  return `
    <div class="alm-card" data-category="mechanics">
      <div class="alm-card__hd">
        <span class="alm-card__ico">${_esc(m.icon)}</span>
        <div class="alm-card__ti">
          <span class="alm-card__name">${_esc(m.name)}</span>
        </div>
      </div>
      <p class="alm-card__desc">${_esc(m.description)}</p>
    </div>`;
}

// ── Entry list ──────────────────────────────────────────────────────────────

function _allEntries() {
  const entries = [];

  Object.entries(BUILDINGS).forEach(([id, b]) => {
    entries.push({
      category: 'buildings',
      searchText: `${b.name} ${b.description}`.toLowerCase(),
      html: () => _buildingCard(id, b),
    });
  });

  Object.entries(UNITS).forEach(([id, u]) => {
    entries.push({
      category: 'units',
      searchText: `${u.name} ${u.description}`.toLowerCase(),
      html: () => _unitCard(id, u),
    });
  });

  Object.entries(TECHS).forEach(([id, t]) => {
    entries.push({
      category: 'techs',
      searchText: `${t.name} ${t.description} ${t.effectDesc ?? ''}`.toLowerCase(),
      html: () => _techCard(id, t),
    });
  });

  Object.entries(WONDERS).forEach(([id, w]) => {
    entries.push({
      category: 'wonders',
      searchText: `${w.name} ${w.desc ?? ''} ${w.bonusLabel ?? ''}`.toLowerCase(),
      html: () => _wonderCard(id, w),
    });
  });

  MECHANICS.forEach(m => {
    entries.push({
      category: 'mechanics',
      searchText: `${m.name} ${m.description}`.toLowerCase(),
      html: () => _mechanicCard(m),
    });
  });

  return entries;
}

// ── State ───────────────────────────────────────────────────────────────────

let _activeCat   = 'all';
let _query       = '';

// ── Render ──────────────────────────────────────────────────────────────────

function _render(panel) {
  const q       = _query.toLowerCase().trim();
  const entries = _allEntries().filter(e => {
    const catOk = _activeCat === 'all' || e.category === _activeCat;
    const txtOk = !q || e.searchText.includes(q);
    return catOk && txtOk;
  });

  panel.innerHTML = `
    <div class="alm-toolbar">
      <input
        id="alm-search"
        class="alm-search"
        type="search"
        placeholder="Search buildings, units, techs, wonders…"
        value="${_esc(_query)}"
        autocomplete="off"
        spellcheck="false"
      >
      <div class="alm-cats">
        ${CATEGORIES.map(c => `
          <button
            class="btn btn--sm alm-cat${_activeCat === c.id ? ' alm-cat--active' : ''}"
            data-cat="${c.id}"
          >${_esc(c.label)}</button>
        `).join('')}
      </div>
    </div>
    <p class="alm-count">${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}</p>
    <div class="alm-grid">
      ${entries.length
        ? entries.map(e => e.html()).join('')
        : '<p class="alm-empty">No entries match your search.</p>'}
    </div>
  `;

  const searchEl = panel.querySelector('#alm-search');
  if (searchEl) {
    searchEl.addEventListener('input', () => { _query = searchEl.value; _render(panel); });
    // Don't auto-focus — let user click deliberately
  }

  panel.querySelectorAll('.alm-cat').forEach(btn => {
    btn.addEventListener('click', () => { _activeCat = btn.dataset.cat; _render(panel); });
  });
}

// ── Public init ─────────────────────────────────────────────────────────────

export function initAlmanac() {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;

  _render(panel);

  // Re-render when tab is switched to so "Own: X" counts stay fresh
  document.getElementById('tab-bar')?.addEventListener('click', e => {
    if (e.target.closest('[data-tab="almanac"]')) _render(panel);
  });
}
