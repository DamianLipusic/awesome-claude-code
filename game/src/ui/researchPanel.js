/**
 * EmpireOS — Research / Tech Tree panel.
 * Also contains the Age Advancement section.
 */

import { state } from '../core/state.js';
import { on, Events } from '../core/events.js';
import { startResearch } from '../systems/research.js';
import { advanceAge } from '../core/actions.js';
import { TECHS } from '../data/techs.js';
import { AGES } from '../data/ages.js';
import { fmtNum, fmtTime } from '../utils/fmt.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

export function initResearchPanel() {
  const panel = document.getElementById('panel-research');
  if (!panel) return;

  renderResearchPanel();
  on(Events.TECH_CHANGED,     renderResearchPanel);
  on(Events.AGE_CHANGED,      renderResearchPanel);
  on(Events.BUILDING_CHANGED, _throttle(renderResearchPanel, 8));
  on(Events.UNIT_CHANGED,     _throttle(renderResearchPanel, 8));
  on(Events.RESOURCE_CHANGED, _throttle(renderResearchPanel, 16));
}

function renderResearchPanel() {
  const panel = document.getElementById('panel-research');
  if (!panel) return;

  // Active research progress bar
  const active = state.researchQueue[0];
  const progressHtml = active
    ? (() => {
        const def = TECHS[active.techId];
        const total = def.researchTicks;
        const done  = total - active.remaining;
        const pct   = Math.floor((done / total) * 100);
        const secsLeft = Math.ceil(active.remaining / TICKS_PER_SECOND);
        return `
          <div class="research-active">
            <span>${def.icon} Researching ${def.name}</span>
            <div class="progress-bar">
              <div class="progress-bar__fill" style="width:${pct}%"></div>
            </div>
            <span class="research-active__time">${fmtTime(secsLeft)} left</span>
          </div>`;
      })()
    : '';

  const techCards = Object.entries(TECHS).map(([id, def]) => {
    const done     = !!state.techs[id];
    const inQueue  = state.researchQueue.some(e => e.techId === id);
    const prereqOk = (def.requires ?? []).every(r => state.techs[r]);
    const canAfford = Object.entries(def.cost).every(
      ([r, a]) => (state.resources[r] ?? 0) >= a
    );
    const costStr = Object.entries(def.cost)
      .map(([r, a]) => `${_resIcon(r)}${fmtNum(a)}`).join(' ');
    const timeStr = fmtTime(def.researchTicks / TICKS_PER_SECOND);

    if (done) {
      return `<div class="tech-card tech-card--done" title="${def.effectDesc}">
        ${def.icon} <strong>${def.name}</strong> ✓
      </div>`;
    }
    if (!prereqOk) {
      return `<div class="tech-card tech-card--locked" title="Requires prerequisites">
        ${def.icon} ${def.name} 🔒
      </div>`;
    }
    if (inQueue) {
      return `<div class="tech-card tech-card--queued">
        ${def.icon} <strong>${def.name}</strong> (queued)
      </div>`;
    }

    return `<div class="tech-card ${canAfford ? '' : 'tech-card--cant-afford'}"
                 title="${def.description} — ${def.effectDesc}">
      <div class="tech-card__header">${def.icon} <strong>${def.name}</strong></div>
      <div class="tech-card__cost">${costStr} · ⏱${timeStr}</div>
      <button class="btn btn--research ${canAfford ? '' : 'btn--disabled'}"
              data-tech="${id}" ${canAfford ? '' : 'disabled'}>Research</button>
    </div>`;
  }).join('');

  panel.innerHTML = _ageSection() + progressHtml + `<div class="tech-grid">${techCards}</div>`;

  panel.onclick = (e) => {
    if (e.target.closest('#btn-advance-age')) {
      advanceAge();
      return;
    }
    const btn = e.target.closest('[data-tech]');
    if (!btn) return;
    startResearch(btn.dataset.tech);
  };
}

// ── Age section ────────────────────────────────────────────────────────────

function _ageSection() {
  const currentAge = AGES[state.age ?? 0];
  const nextAge    = AGES[(state.age ?? 0) + 1];
  const isMaxAge   = !nextAge;

  const currentHtml = `
    <div class="age-current">
      <span class="age-icon">${currentAge.icon}</span>
      <div class="age-info">
        <span class="age-name">${currentAge.name}</span>
        <span class="age-desc">${currentAge.description}</span>
      </div>
    </div>`;

  if (isMaxAge) {
    return `<div class="age-panel">
      ${currentHtml}
      <div class="age-max">🏆 Maximum age achieved!</div>
    </div>`;
  }

  // Build requirements checklist
  const totalBuildings = Object.values(state.buildings).reduce((s, c) => s + c, 0);
  const totalUnits     = Object.values(state.units).reduce((s, c) => s + c, 0);
  const territoryCount = _countTiles();

  const reqItems = nextAge.requires.map(req => {
    let met = false;
    let text = req.label ?? '?';
    if (req.type === 'totalBuildings') { met = totalBuildings >= req.count; text = `${totalBuildings}/${req.count} buildings`; }
    if (req.type === 'totalUnits')     { met = totalUnits >= req.count;     text = `${totalUnits}/${req.count} units`; }
    if (req.type === 'territory')      { met = territoryCount >= req.count; text = `${territoryCount}/${req.count} territories`; }
    if (req.type === 'tech')           { met = !!state.techs[req.id];       text = req.label ?? req.id; }
    return `<span class="age-req ${met ? 'age-req--met' : 'age-req--unmet'}">${met ? '✓' : '✗'} ${text}</span>`;
  }).join('');

  const costStr = Object.entries(nextAge.cost ?? {})
    .map(([r, a]) => `${_resIcon(r)}${fmtNum(a)}`).join(' ');

  const canAdvance = nextAge.requires.every(req => {
    if (req.type === 'totalBuildings') return totalBuildings >= req.count;
    if (req.type === 'totalUnits')     return totalUnits >= req.count;
    if (req.type === 'territory')      return territoryCount >= req.count;
    if (req.type === 'tech')           return !!state.techs[req.id];
    return true;
  }) && _canAffordAge(nextAge.cost);

  return `<div class="age-panel">
    ${currentHtml}
    <div class="age-next">
      <div class="age-next__title">
        Next: <strong>${nextAge.icon} ${nextAge.name}</strong>
        <span class="age-next__bonus">${nextAge.description}</span>
      </div>
      <div class="age-reqs">${reqItems}</div>
      <div class="age-cost">Cost: ${costStr}</div>
      <button id="btn-advance-age"
              class="btn btn--advance ${canAdvance ? '' : 'btn--disabled'}"
              ${canAdvance ? '' : 'disabled'}>
        Advance to ${nextAge.name}
      </button>
    </div>
  </div>`;
}

function _countTiles() {
  if (!state.map) return 0;
  let n = 0;
  for (const row of state.map.tiles) {
    for (const tile of row) { if (tile.owner === 'player') n++; }
  }
  return n;
}

function _canAffordAge(cost) {
  if (!cost) return true;
  return Object.entries(cost).every(([r, a]) => (state.resources[r] ?? 0) >= a);
}

const RES_ICONS = { gold: '💰', food: '🍞', wood: '🪵', stone: '🪨', iron: '⚙️', mana: '✨' };
function _resIcon(res) { return RES_ICONS[res] ?? ''; }

function _throttle(fn, ticks) {
  let last = 0;
  return () => {
    if (state.tick - last >= ticks) { last = state.tick; fn(); }
  };
}
