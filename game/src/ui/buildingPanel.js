/**
 * EmpireOS — Building panel UI.
 * Shows available buildings with build button and cost tooltip.
 */

import { state } from '../core/state.js';
import { on, Events } from '../core/events.js';
import { buildBuilding, demolishBuilding, specializeBuilding } from '../core/actions.js';
import { BUILDINGS } from '../data/buildings.js';
import { SPECIALIZATIONS, SPECIALS_BY_BUILDING, ELIGIBLE_BUILDINGS } from '../data/buildingSpecials.js';
import { fmtNum } from '../utils/fmt.js';

export function initBuildingPanel() {
  const panel = document.getElementById('panel-buildings');
  if (!panel) return;

  renderBuildingPanel();

  on(Events.BUILDING_CHANGED, (data) => {
    renderBuildingPanel();
    // Pop-in the card that just changed
    if (data?.id) _popCard(data.id);
  });
  on(Events.TECH_CHANGED,          renderBuildingPanel);
  on(Events.AGE_CHANGED,           renderBuildingPanel);
  on(Events.BUILDING_SPECIALIZED,  renderBuildingPanel);
  on(Events.RESOURCE_CHANGED,      _throttleRender());
}

function _popCard(id) {
  const card = document.querySelector(`#panel-buildings [data-building-id="${id}"]`);
  if (!card) return;
  card.classList.remove('building-card--popin');
  void card.offsetWidth; // restart animation
  card.classList.add('building-card--popin');
  card.addEventListener('animationend', () => card.classList.remove('building-card--popin'), { once: true });
}

function renderBuildingPanel() {
  const panel = document.getElementById('panel-buildings');
  if (!panel) return;

  let html = '';
  let wonderHeaderAdded = false;

  for (const [id, def] of Object.entries(BUILDINGS)) {
    const count  = state.buildings[id] ?? 0;
    const locked = !meetsRequirements(def.requires);

    // Insert Wonders section header before first wonder building
    if (def.wonder && !wonderHeaderAdded) {
      wonderHeaderAdded = true;
      html += `<div class="wonder-section-header">🏛️ Wonders</div>`;
    }

    if (locked) {
      html += `
        <div class="building-card building-card--locked${def.wonder ? ' building-card--wonder' : ''}"
             data-building-id="${id}" title="Locked: build prerequisites first">
          <span class="building-card__icon">${def.icon}</span>
          <span class="building-card__name">${def.name}</span>
          <span class="building-card__count">🔒</span>
        </div>`;
      continue;
    }

    // Unique building already built — show "Built" state, no actions
    if (def.unique && count >= 1) {
      html += `
        <div class="building-card building-card--wonder building-card--wonder-built"
             data-building-id="${id}" title="${def.description}">
          <div class="building-card__header">
            <span class="building-card__icon">${def.icon}</span>
            <span class="building-card__name">${def.name}</span>
            <span class="building-card__count building-card__count--built">✓ Built</span>
          </div>
          <div class="building-card__prod">${Object.entries(def.production).map(([r,a]) => `+${a}/s ${_resIcon(r)}`).join(' ')}</div>
          <div class="building-card__cost building-card__cost--wonder">${def.description}</div>
        </div>`;
      continue;
    }

    const cost   = scaledCost(def.baseCost, count);
    const canBuy = canAfford(cost);
    const costStr = Object.entries(cost).map(([r, a]) => `${_resIcon(r)}${fmtNum(a)}`).join(' ');
    const prodStr = Object.entries(def.production).map(([r, a]) => `+${a}/s ${_resIcon(r)}`).join(' ');

    html += `
      <div class="building-card ${def.wonder ? 'building-card--wonder' : ''} ${canBuy ? '' : 'building-card--cant-afford'}"
           data-building-id="${id}"
           title="${def.description}">
        <div class="building-card__header">
          <span class="building-card__icon">${def.icon}</span>
          <span class="building-card__name">${def.name}</span>
          <span class="building-card__count">×${count}</span>
        </div>
        ${prodStr ? `<div class="building-card__prod">${prodStr}</div>` : ''}
        <div class="building-card__cost">${costStr}</div>
        <div class="building-card__actions">
          <button class="btn ${def.wonder ? 'btn--wonder' : 'btn--build'} ${canBuy ? '' : 'btn--disabled'}"
                  data-action="build" data-id="${id}"
                  ${canBuy ? '' : 'disabled'}>${def.wonder ? 'Construct' : 'Build'}</button>
          ${!def.unique && count > 0 ? `<button class="btn btn--demolish" data-action="demolish" data-id="${id}">−</button>` : ''}
        </div>
      </div>`;
  }

  html += _specializationsSection();

  panel.innerHTML = html;

  // Delegate click events
  panel.onclick = (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id, specid } = btn.dataset;
    if (action === 'build')       buildBuilding(id);
    if (action === 'demolish')    demolishBuilding(id);
    if (action === 'specialize')  specializeBuilding(id, specid);
  };
}

// ── Specializations section (T090) ──────────────────────────────────────────

function _specializationsSection() {
  // Only show buildings that the player owns at least 1 of
  const eligible = ELIGIBLE_BUILDINGS.filter(id => (state.buildings[id] ?? 0) >= 1);
  if (eligible.length === 0) return '';

  const cards = eligible.map(buildingId => {
    const bdef         = BUILDINGS[buildingId];
    const activeSpecId = state.buildingSpecials?.[buildingId];
    const specIds      = SPECIALS_BY_BUILDING[buildingId] ?? [];

    if (activeSpecId) {
      const sdef = SPECIALIZATIONS[activeSpecId];
      return `
        <div class="spec-card spec-card--active" title="${sdef.desc}">
          <div class="spec-card__header">
            <span>${bdef.icon} ${bdef.name}</span>
            <span class="spec-badge">${sdef.icon} ${sdef.name}</span>
          </div>
          <div class="spec-card__desc">${sdef.desc}</div>
        </div>`;
    }

    const options = specIds.map(specId => {
      const sdef      = SPECIALIZATIONS[specId];
      const canAffordSpec = canAfford(sdef.cost);
      const meetsReqs = meetsRequirements(sdef.requires ?? []);
      const costStr   = Object.entries(sdef.cost).map(([r, a]) => `${_resIcon(r)}${fmtNum(a)}`).join(' ');
      const avail     = canAffordSpec && meetsReqs;
      return `
        <div class="spec-option">
          <div class="spec-option__header">
            <span class="spec-option__icon">${sdef.icon}</span>
            <strong class="spec-option__name">${sdef.name}</strong>
            <span class="spec-option__cost ${canAffordSpec ? 'spec-cost--ok' : 'spec-cost--bad'}">${costStr}</span>
          </div>
          <div class="spec-option__desc">${sdef.desc}</div>
          <button class="btn btn--specialize ${avail ? '' : 'btn--disabled'}"
                  data-action="specialize" data-id="${buildingId}" data-specid="${specId}"
                  ${avail ? '' : 'disabled'}
                  title="${meetsReqs ? '' : 'Requires tech: ' + (sdef.requires?.[0]?.id ?? '')}"
          >Specialize</button>
        </div>`;
    }).join('');

    return `
      <div class="spec-card">
        <div class="spec-card__title">${bdef.icon} ${bdef.name} — Choose a Specialization</div>
        <div class="spec-options">${options}</div>
      </div>`;
  }).join('');

  return `
    <div class="spec-section">
      <div class="spec-section__header">⚗️ Building Specializations</div>
      <div class="spec-section__intro">Permanently upgrade a building with one specialization. Costs apply once.</div>
      ${cards}
    </div>`;
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
