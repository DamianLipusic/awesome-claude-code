/**
 * EmpireOS — Research / Tech Tree panel.
 * Also contains the Age Advancement section.
 */

import { state } from '../core/state.js';
import { on, Events } from '../core/events.js';
import { startResearch, cancelResearch, MAX_RESEARCH_QUEUE } from '../systems/research.js';
import { advanceAge } from '../core/actions.js';
import { TECHS } from '../data/techs.js';
import { AGES } from '../data/ages.js';
import { fmtNum, fmtTime } from '../utils/fmt.js';
import { TICKS_PER_SECOND } from '../core/tick.js';
import { RELICS, RELIC_ORDER, TERRAIN_RELIC } from '../data/relics.js';

export function initResearchPanel() {
  const panel = document.getElementById('panel-research');
  if (!panel) return;

  renderResearchPanel();
  on(Events.TECH_CHANGED,     renderResearchPanel);
  on(Events.AGE_CHANGED,      renderResearchPanel);
  on(Events.BUILDING_CHANGED, _throttle(renderResearchPanel, 8));
  on(Events.UNIT_CHANGED,     _throttle(renderResearchPanel, 8));
  on(Events.RESOURCE_CHANGED, _throttle(renderResearchPanel, 16));
  on(Events.RELIC_DISCOVERED, renderResearchPanel);
}

function renderResearchPanel() {
  const panel = document.getElementById('panel-research');
  if (!panel) return;

  // Research queue section (active + pending items)
  const progressHtml = _queueSection();

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

  panel.innerHTML = _ageSection() + progressHtml + `<div class="tech-grid">${techCards}</div>` + _relicsSection();

  panel.onclick = (e) => {
    if (e.target.closest('#btn-advance-age')) {
      advanceAge();
      return;
    }
    // Cancel a queued research item
    const cancelBtn = e.target.closest('[data-cancel-tech]');
    if (cancelBtn) {
      cancelResearch(cancelBtn.dataset.cancelTech);
      return;
    }
    const btn = e.target.closest('[data-tech]');
    if (!btn) return;
    startResearch(btn.dataset.tech);
  };
}

// ── Research queue section ─────────────────────────────────────────────────

function _queueSection() {
  if (state.researchQueue.length === 0) return '';

  const qLen = state.researchQueue.length;
  const header = `<div class="rq-header">
    🔬 Research Queue
    <span class="rq-count">${qLen} / ${MAX_RESEARCH_QUEUE}</span>
  </div>`;

  const items = state.researchQueue.map((entry, idx) => {
    const def  = TECHS[entry.techId];
    if (!def) return '';

    const isActive = idx === 0;
    const total    = entry.totalTicks ?? def.researchTicks;
    const done     = total - entry.remaining;
    const pct      = isActive ? Math.floor((done / total) * 100) : 0;
    const secsLeft = Math.ceil(entry.remaining / TICKS_PER_SECOND);

    const progressBar = isActive
      ? `<div class="progress-bar rq-progress">
           <div class="progress-bar__fill" style="width:${pct}%"></div>
         </div>
         <span class="rq-time">${fmtTime(secsLeft)} left</span>`
      : `<span class="rq-pending">⏳ Pending</span>`;

    return `<div class="rq-item ${isActive ? 'rq-item--active' : 'rq-item--pending'}">
      <span class="rq-pos">${idx + 1}</span>
      <span class="rq-icon">${def.icon}</span>
      <div class="rq-body">
        <span class="rq-name">${def.name}</span>
        <div class="rq-progress-row">${progressBar}</div>
      </div>
      <button class="btn btn--icon rq-cancel" data-cancel-tech="${entry.techId}"
              title="Cancel and refund cost">✕</button>
    </div>`;
  }).join('');

  return `<div class="rq-section">${header}${items}</div>`;
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

// ── T064: Relics section ───────────────────────────────────────────────────

function _relicsSection() {
  const discovered = state.relics?.discovered ?? {};
  const count = Object.keys(discovered).length;

  const cards = RELIC_ORDER.map(relicId => {
    const def    = RELICS[relicId];
    const found  = !!discovered[relicId];
    const hint   = def.terrain
      ? `Found on ${def.terrain} tiles`
      : 'Found on any terrain';

    if (found) {
      const bonusLines = [];
      if (def.bonus.rates) {
        for (const [r, v] of Object.entries(def.bonus.rates)) {
          bonusLines.push(`+${v}/s ${r}`);
        }
      }
      if (def.bonus.caps) {
        for (const [r, v] of Object.entries(def.bonus.caps)) {
          bonusLines.push(`+${v} ${r} cap`);
        }
      }
      return `
        <div class="relic-card relic-card--found">
          <div class="relic-icon">${def.icon}</div>
          <div class="relic-body">
            <div class="relic-name">${def.name}</div>
            <div class="relic-desc">${def.desc}</div>
            <div class="relic-bonus">${bonusLines.join(' · ')}</div>
          </div>
        </div>`;
    }

    return `
      <div class="relic-card relic-card--locked">
        <div class="relic-icon">❓</div>
        <div class="relic-body">
          <div class="relic-name">???</div>
          <div class="relic-hint">${hint}</div>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="relics-section">
      <div class="relics-header">
        <span>🏺 Ancient Relics</span>
        <span class="relics-count">${count} / ${RELIC_ORDER.length} discovered</span>
      </div>
      <div class="relics-intro">Capture territory tiles to discover ancient relics with permanent bonuses.</div>
      <div class="relics-grid">${cards}</div>
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
