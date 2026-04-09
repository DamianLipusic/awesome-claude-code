/**
 * EmpireOS — Military panel UI.
 *
 * Shows:
 *   - Current army composition (trained units)
 *   - Training queue with progress
 *   - Unit cards with costs, stats, and Train button
 *
 * Gated on building requirements (same as T006 unit data).
 */

import { state } from '../core/state.js';
import { on, Events } from '../core/events.js';
import { trainUnit } from '../core/actions.js';
import { UNITS } from '../data/units.js';
import { BUILDINGS } from '../data/buildings.js';
import { TECHS } from '../data/techs.js';
import { fmtNum } from '../utils/fmt.js';

const UNIT_ORDER = ['soldier', 'archer', 'knight', 'mage'];

// ── Public API ─────────────────────────────────────────────────────────────

export function initMilitaryPanel() {
  const panel = document.getElementById('panel-military');
  if (!panel) return;

  _render(panel);

  on(Events.UNIT_CHANGED,     () => _render(panel));
  on(Events.BUILDING_CHANGED, () => _render(panel));
  on(Events.TECH_CHANGED,     () => _render(panel));
  on(Events.RESOURCE_CHANGED, () => _renderCosts(panel));
  on(Events.GAME_LOADED,      () => _render(panel));
}

// ── Rendering ──────────────────────────────────────────────────────────────

function _render(panel) {
  panel.innerHTML = `
    ${_armySection()}
    ${_queueSection()}
    <div class="unit-grid" id="unit-grid">
      ${UNIT_ORDER.map(id => _unitCard(id)).join('')}
    </div>
  `;

  panel.addEventListener('click', _handleClick);
}

function _armySection() {
  const entries = UNIT_ORDER.filter(id => (state.units[id] ?? 0) > 0);
  if (entries.length === 0) {
    return `<div class="mil-army">
      <span class="mil-section-title">⚔️ Army</span>
      <span class="mil-empty">No units trained yet.</span>
    </div>`;
  }

  const items = entries.map(id => {
    const def   = UNITS[id];
    const count = state.units[id];
    const power = def.attack * count;
    return `<span class="mil-unit-badge">
      ${def.icon} <strong>${count}</strong> ${def.name}
      <span class="mil-power">⚔ ${power}</span>
    </span>`;
  }).join('');

  let totalPower = UNIT_ORDER.reduce((sum, id) => {
    const count = state.units[id] ?? 0;
    const def   = UNITS[id];
    return sum + (def ? def.attack * count : 0);
  }, 0);
  // Apply combat tech multipliers (mirrors combat.js logic)
  if (state.techs.tactics)     totalPower *= 1.25;
  if (state.techs.steel)       totalPower *= 1.5;
  if (state.techs.engineering) totalPower *= 1.1;

  return `<div class="mil-army">
    <span class="mil-section-title">⚔️ Army <span class="mil-total-power">Combat power: ${Math.round(totalPower)}</span></span>
    <div class="mil-badges">${items}</div>
  </div>`;
}

function _queueSection() {
  if (state.trainingQueue.length === 0) return '';

  const current = state.trainingQueue[0];
  const def     = UNITS[current.unitId];
  const total   = current.totalTicks ?? def?.trainTicks ?? 1;
  const pct     = Math.round(((total - current.remaining) / total) * 100);

  const rest = state.trainingQueue.slice(1).map(e =>
    `<span>${UNITS[e.unitId]?.icon ?? '?'} ${UNITS[e.unitId]?.name ?? e.unitId}</span>`
  ).join('');

  return `<div class="mil-queue">
    <span class="mil-section-title">🔄 Training</span>
    <div class="research-active">
      <span>${def?.icon ?? '?'} <strong>${def?.name ?? current.unitId}</strong></span>
      <div class="progress-bar">
        <div class="progress-bar__fill" style="width:${pct}%"></div>
      </div>
      <span class="research-active__time">${pct}%</span>
    </div>
    ${rest ? `<div class="mil-queue-rest">${rest}</div>` : ''}
  </div>`;
}

function _unitCard(id) {
  const def    = UNITS[id];
  if (!def) return '';

  const unlocked = _isUnlocked(id);
  const canAfford = unlocked && _canAfford(def.cost);

  const costStr = Object.entries(def.cost)
    .map(([r, a]) => `${_resIcon(r)}${fmtNum(a)}`)
    .join(' ');

  const upkeepStr = Object.entries(def.upkeep ?? {})
    .map(([r, a]) => `${_resIcon(r)}${a}/s`)
    .join(' ');

  const reqStr = def.requires.length
    ? def.requires.map(r => {
        if (r.type === 'tech') {
          const tech = TECHS[r.id];
          return tech ? `${tech.icon} ${tech.name}` : r.id;
        }
        const bld = BUILDINGS[r.id];
        return bld ? `${bld.icon} ${bld.name}` : r.id;
      }).join(', ')
    : '';

  const locked   = !unlocked;
  const disabled = locked || !canAfford;

  return `<div class="unit-card ${locked ? 'unit-card--locked' : ''} ${!locked && !canAfford ? 'unit-card--cant-afford' : ''}">
    <div class="unit-card__header">
      <span class="unit-card__icon">${def.icon}</span>
      <span class="unit-card__name">${def.name}</span>
      <span class="unit-card__count">${state.units[id] ?? 0}</span>
    </div>
    <div class="unit-card__desc">${def.description}</div>
    <div class="unit-card__stats">
      ⚔ ${def.attack} &nbsp; 🛡 ${def.defense}
    </div>
    <div class="unit-card__cost">${locked ? `🔒 Requires: ${reqStr}` : `Cost: ${costStr}`}</div>
    ${upkeepStr ? `<div class="unit-card__upkeep">Upkeep: ${upkeepStr}</div>` : ''}
    <div class="unit-card__actions">
      <button class="btn btn--build ${disabled ? 'btn--disabled' : ''}"
        data-train="${id}" ${disabled ? 'disabled' : ''}>Train</button>
    </div>
  </div>`;
}

function _renderCosts(panel) {
  // Lightweight refresh: just update disabled state of Train buttons
  panel.querySelectorAll('[data-train]').forEach(btn => {
    const id  = btn.dataset.train;
    const def = UNITS[id];
    if (!def) return;
    const can = _isUnlocked(id) && _canAfford(def.cost);
    btn.disabled = !can;
    btn.classList.toggle('btn--disabled', !can);
  });
}

// ── Interaction ────────────────────────────────────────────────────────────

function _handleClick(e) {
  const btn = e.target.closest('[data-train]');
  if (!btn || btn.disabled) return;
  trainUnit(btn.dataset.train);
}

// ── Helpers ────────────────────────────────────────────────────────────────

function _isUnlocked(unitId) {
  const def = UNITS[unitId];
  if (!def) return false;
  return def.requires.every(req => {
    if (req.type === 'building') return (state.buildings[req.id] ?? 0) >= (req.count ?? 1);
    if (req.type === 'tech')    return state.techs[req.id];
    return true;
  });
}

function _canAfford(cost) {
  return Object.entries(cost).every(([r, a]) => (state.resources[r] ?? 0) >= a);
}

const RES_ICONS = {
  gold: '🪙', food: '🌾', wood: '🪵', stone: '🪨', iron: '⚒️', mana: '✨',
};
function _resIcon(r) { return RES_ICONS[r] ?? ''; }
