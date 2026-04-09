/**
 * EmpireOS — Building panel UI.
 * Shows available buildings with build button and cost tooltip.
 */

import { state } from '../core/state.js';
import { on, Events } from '../core/events.js';
import { buildBuilding, demolishBuilding } from '../core/actions.js';
import { BUILDINGS } from '../data/buildings.js';
import { fmtNum } from '../utils/fmt.js';

export function initBuildingPanel() {
  const panel = document.getElementById('panel-buildings');
  if (!panel) return;

  renderBuildingPanel();

  on(Events.BUILDING_CHANGED, renderBuildingPanel);
  on(Events.TECH_CHANGED,     renderBuildingPanel);
  on(Events.AGE_CHANGED,      renderBuildingPanel);
  on(Events.RESOURCE_CHANGED, _throttleRender());
}

function renderBuildingPanel() {
  const panel = document.getElementById('panel-buildings');
  if (!panel) return;

  panel.innerHTML = Object.entries(BUILDINGS).map(([id, def]) => {
    const count   = state.buildings[id] ?? 0;
    const cost    = scaledCost(def.baseCost, count);
    const canBuy  = canAfford(cost);
    const locked  = !meetsRequirements(def.requires);

    if (locked) return `
      <div class="building-card building-card--locked" title="Locked: build prerequisites first">
        <span class="building-card__icon">${def.icon}</span>
        <span class="building-card__name">${def.name}</span>
        <span class="building-card__count">🔒</span>
      </div>`;

    const costStr = Object.entries(cost)
      .map(([r, a]) => `${_resIcon(r)}${fmtNum(a)}`).join(' ');
    const prodStr = Object.entries(def.production)
      .map(([r, a]) => `+${a}/s ${_resIcon(r)}`).join(' ');

    return `
      <div class="building-card ${canBuy ? '' : 'building-card--cant-afford'}"
           title="${def.description}">
        <div class="building-card__header">
          <span class="building-card__icon">${def.icon}</span>
          <span class="building-card__name">${def.name}</span>
          <span class="building-card__count">×${count}</span>
        </div>
        ${prodStr ? `<div class="building-card__prod">${prodStr}</div>` : ''}
        <div class="building-card__cost">${costStr}</div>
        <div class="building-card__actions">
          <button class="btn btn--build ${canBuy ? '' : 'btn--disabled'}"
                  data-action="build" data-id="${id}"
                  ${canBuy ? '' : 'disabled'}>Build</button>
          ${count > 0 ? `<button class="btn btn--demolish" data-action="demolish" data-id="${id}">−</button>` : ''}
        </div>
      </div>`;
  }).join('');

  // Delegate click events
  panel.onclick = (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'build')    buildBuilding(id);
    if (action === 'demolish') demolishBuilding(id);
  };
}

// ── helpers ──────────────────────────────────────────────────────────────────

function scaledCost(base, existing) {
  const factor = Math.pow(1.15, existing);
  const scaled = {};
  for (const [res, amt] of Object.entries(base)) {
    scaled[res] = Math.ceil(amt * factor);
  }
  return scaled;
}

function canAfford(cost) {
  for (const [res, amt] of Object.entries(cost)) {
    if ((state.resources[res] ?? 0) < amt) return false;
  }
  return true;
}

function meetsRequirements(requires) {
  for (const req of requires) {
    if (req.type === 'building') {
      if ((state.buildings[req.id] ?? 0) < (req.count ?? 1)) return false;
    }
    if (req.type === 'tech') {
      if (!state.techs[req.id]) return false;
    }
    if (req.type === 'age') {
      if ((state.age ?? 0) < req.minAge) return false;
    }
  }
  return true;
}

const RES_ICONS = { gold: '💰', food: '🍞', wood: '🪵', stone: '🪨', iron: '⚙️', mana: '✨' };
function _resIcon(res) { return RES_ICONS[res] ?? ''; }

function _throttleRender() {
  let last = 0;
  return () => {
    if (state.tick - last >= 8) {
      last = state.tick;
      renderBuildingPanel();
    }
  };
}
