/**
 * EmpireOS — Research / Tech Tree panel.
 */

import { state } from '../core/state.js';
import { on, Events } from '../core/events.js';
import { startResearch } from '../systems/research.js';
import { TECHS } from '../data/techs.js';
import { fmtNum, fmtTime } from '../utils/fmt.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

export function initResearchPanel() {
  const panel = document.getElementById('panel-research');
  if (!panel) return;

  renderResearchPanel();
  on(Events.TECH_CHANGED,    renderResearchPanel);
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

  panel.innerHTML = progressHtml + `<div class="tech-grid">${techCards}</div>`;

  panel.onclick = (e) => {
    const btn = e.target.closest('[data-tech]');
    if (!btn) return;
    const result = startResearch(btn.dataset.tech);
    if (!result.ok) {
      // Flash error in log (already done by startResearch → addMessage)
    }
  };
}

const RES_ICONS = { gold: '💰', food: '🍞', wood: '🪵', stone: '🪨', iron: '⚙️', mana: '✨' };
function _resIcon(res) { return RES_ICONS[res] ?? ''; }

function _throttle(fn, ticks) {
  let last = 0;
  return () => {
    if (state.tick - last >= ticks) { last = state.tick; fn(); }
  };
}
