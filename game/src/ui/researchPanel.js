/**
 * EmpireOS — Research / Tech Tree panel.
 * Also contains the Age Advancement section.
 */

import { state } from '../core/state.js';
import { on, Events } from '../core/events.js';
import { startResearch, cancelResearch, MAX_RESEARCH_QUEUE } from '../systems/research.js';
import { advanceAge, setPolicy } from '../core/actions.js';
import { TECHS, MASTERY_GROUPS, SYNERGIES, SYNERGY_ORDER } from '../data/techs.js';
import { AGES } from '../data/ages.js';
import { fmtNum, fmtTime } from '../utils/fmt.js';
import { TICKS_PER_SECOND } from '../core/tick.js';
import { RELICS, RELIC_ORDER, TERRAIN_RELIC } from '../data/relics.js';
import { LANDMARKS, LANDMARK_ORDER } from '../data/landmarks.js';
import { RUIN_COUNT, RUIN_OUTCOMES } from '../data/ruins.js';
import { POLICIES, POLICY_ORDER, POLICY_COOLDOWN_TICKS } from '../data/policies.js';
import { FESTIVALS, FESTIVAL_ORDER } from '../data/festivals.js';
import { useFestival, getActiveFestival, getFestivalSecsLeft, getFestivalCooldownSecs } from '../systems/festivals.js';
import { acceptInspiration, dismissInspiration, getInspirationSecsLeft, INSPIRATION_TYPES } from '../systems/researchInspiration.js';

export function initResearchPanel() {
  const panel = document.getElementById('panel-research');
  if (!panel) return;

  renderResearchPanel();
  on(Events.TECH_CHANGED,     renderResearchPanel);
  on(Events.AGE_CHANGED,      renderResearchPanel);
  on(Events.BUILDING_CHANGED, _throttle(renderResearchPanel, 8));
  on(Events.UNIT_CHANGED,     _throttle(renderResearchPanel, 8));
  on(Events.RESOURCE_CHANGED, _throttle(renderResearchPanel, 16));
  on(Events.RELIC_DISCOVERED,      renderResearchPanel);
  on(Events.LANDMARK_CAPTURED,     renderResearchPanel);
  on(Events.POLICY_CHANGED,        renderResearchPanel);
  on(Events.MORALE_CHANGED,    _throttle(renderResearchPanel, 8));
  on(Events.MASTERY_UNLOCKED,  renderResearchPanel);
  on(Events.SYNERGY_UNLOCKED,  renderResearchPanel);
  on(Events.FESTIVAL_CHANGED,       renderResearchPanel);
  on(Events.RUIN_EXCAVATED,         renderResearchPanel);
  on(Events.RESEARCH_INSPIRATION,   renderResearchPanel);
  // Refresh countdown text every second while a festival or inspiration event is active
  on(Events.TICK, _throttle(() => {
    const hasActivity = getActiveFestival() || getFestivalCooldownSecs() > 0
      || !!state.researchInspiration?.pending;
    if (hasActivity) renderResearchPanel();
  }, 4));
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

  panel.innerHTML = _ageSection() + progressHtml + _inspirationCard() + `<div class="tech-grid">${techCards}</div>` + _masteriesSection() + _synergiesSection() + _policySection() + _festivalsSection() + _relicsSection() + _landmarksSection() + _ruinsSection();

  panel.onclick = (e) => {
    // T116: Research inspiration accept/dismiss
    if (e.target.closest('[data-action="insp-accept"]')) {
      acceptInspiration();
      return;
    }
    if (e.target.closest('[data-action="insp-dismiss"]')) {
      dismissInspiration();
      return;
    }
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
    // Policy buttons
    const policyBtn = e.target.closest('[data-policy]');
    if (policyBtn) {
      const id = policyBtn.dataset.policy || null;
      const result = setPolicy(id === 'none' ? null : id);
      if (!result.ok) {
        policyBtn.title = result.reason;
      }
      return;
    }
    // Festival buttons
    const festBtn = e.target.closest('[data-festival]');
    if (festBtn) {
      useFestival(festBtn.dataset.festival);
      return;
    }
    const btn = e.target.closest('[data-tech]');
    if (!btn) return;
    startResearch(btn.dataset.tech);
  };
}

// ── T116: Research Inspiration card ───────────────────────────────────────

function _inspirationCard() {
  const insp = state.researchInspiration;
  if (!insp) return '';

  // Pending inspiration awaiting player response
  if (insp.pending) {
    const def      = INSPIRATION_TYPES.find(t => t.id === insp.pending.typeId);
    if (!def) return '';
    const secsLeft = getInspirationSecsLeft();
    const urgent   = secsLeft <= 15;
    return `
      <div class="inspiration-card">
        <div class="inspiration-header">
          <span class="inspiration-icon">${def.icon}</span>
          <span class="inspiration-title">${def.name}</span>
          <span class="inspiration-timer ${urgent ? 'inspiration-timer--urgent' : ''}">⏳ ${secsLeft}s</span>
        </div>
        <div class="inspiration-desc">${def.desc}<br>
          <strong>${def.effectDesc}</strong>
        </div>
        <div class="inspiration-actions">
          <button class="btn btn--inspiration-accept" data-action="insp-accept">✓ Accept</button>
          <button class="btn btn--inspiration-dismiss" data-action="insp-dismiss">✕ Dismiss</button>
        </div>
      </div>`;
  }

  // Workshop discount active (consumed when next research starts)
  if (insp.workshopDiscount) {
    return `<div class="inspiration-discount-banner">⚗️ <strong>Workshop Discount Active</strong> — next research takes 20% less time</div>`;
  }

  return '';
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

// ── T065: Policy section ───────────────────────────────────────────────────

function _policySection() {
  const active = state.policy;
  const changedAt = state.policyChangedAt ?? -999;
  const cooldownRemaining = Math.max(0, (changedAt + POLICY_COOLDOWN_TICKS) - state.tick);
  const onCooldown = cooldownRemaining > 0 && active !== null;
  const cooldownSecs = Math.ceil(cooldownRemaining / 4);

  const policyCards = POLICY_ORDER.map(id => {
    const def = POLICIES[id];
    const isActive = active === id;
    return `
      <div class="policy-card ${isActive ? 'policy-card--active' : ''}">
        <div class="policy-card__header">
          <span class="policy-icon">${def.icon}</span>
          <strong class="policy-name">${def.name}</strong>
          ${isActive ? '<span class="policy-badge">Active</span>' : ''}
        </div>
        <div class="policy-desc">${def.desc}</div>
        <div class="policy-effects">${def.effectDesc}</div>
        <button class="btn btn--sm ${isActive ? 'btn--policy-deactivate' : 'btn--policy-activate'}"
                data-policy="${isActive ? 'none' : id}"
                ${onCooldown && !isActive ? 'disabled' : ''}>
          ${isActive ? 'Deactivate' : 'Activate'}
        </button>
      </div>`;
  }).join('');

  const cooldownHtml = onCooldown
    ? `<div class="policy-cooldown">⏳ Policy cooldown: ${cooldownSecs}s</div>`
    : '';

  return `
    <div class="policy-section">
      <div class="policy-header">
        <span>📜 Governance Policy</span>
        <span class="policy-active-label">${active ? `Active: ${POLICIES[active].icon} ${POLICIES[active].name}` : 'No Active Policy'}</span>
      </div>
      <div class="policy-intro">Enact one policy to shape your empire's focus. Policies have a 60-second cooldown when changed.</div>
      ${cooldownHtml}
      <div class="policy-grid">${policyCards}</div>
    </div>`;
}

// ── T077: Tech Synergy section ─────────────────────────────────────────────

function _synergiesSection() {
  const unlockedCount = SYNERGY_ORDER.filter(id => {
    const syn = SYNERGIES[id];
    return syn.techs.every(t => !!state.techs[t]);
  }).length;

  const cards = SYNERGY_ORDER.map(id => {
    const syn     = SYNERGIES[id];
    const active  = syn.techs.every(t => !!state.techs[t]);
    const techBadges = syn.techs.map(t => {
      const done = !!state.techs[t];
      const def  = TECHS[t];
      return `<span class="synergy-tech ${done ? 'synergy-tech--done' : ''}"
                     title="${def?.name ?? t}">${def?.icon ?? '?'} ${def?.name ?? t}</span>`;
    }).join('<span class="synergy-plus">+</span>');

    if (active) {
      return `<div class="synergy-card synergy-card--active">
        <div class="synergy-card__header">
          <span class="synergy-icon">${syn.icon}</span>
          <strong class="synergy-name">${syn.name}</strong>
          <span class="synergy-badge">✨ Active</span>
        </div>
        <div class="synergy-techs">${techBadges}</div>
        <div class="synergy-effect synergy-effect--active">${syn.effectDesc}</div>
      </div>`;
    }

    return `<div class="synergy-card synergy-card--locked">
      <div class="synergy-card__header">
        <span class="synergy-icon">${syn.icon}</span>
        <strong class="synergy-name">${syn.name}</strong>
      </div>
      <div class="synergy-techs">${techBadges}</div>
      <div class="synergy-effect synergy-effect--locked">${syn.effectDesc}</div>
    </div>`;
  }).join('');

  return `
    <div class="synergy-section">
      <div class="synergy-section__header">
        <span>✨ Tech Synergies</span>
        <span class="synergy-section__count">${unlockedCount} / ${SYNERGY_ORDER.length} active</span>
      </div>
      <div class="synergy-section__intro">Research both paired technologies to unlock a permanent synergy bonus.</div>
      <div class="synergy-grid">${cards}</div>
    </div>`;
}

// ── Tech Mastery section ───────────────────────────────────────────────────

function _masteriesSection() {
  const masteries = state.masteries ?? {};
  const unlockedCount = Object.keys(masteries).length;

  const cards = MASTERY_GROUPS.map(group => {
    const unlocked  = !!masteries[group.id];
    const progress  = group.techs.filter(t => state.techs[t]).length;
    const total     = group.techs.length;
    const pct       = Math.round((progress / total) * 100);
    const allTechsHtml = group.techs.map(t => {
      const done = !!state.techs[t];
      const def  = TECHS[t];
      return `<span class="mastery-tech ${done ? 'mastery-tech--done' : ''}"
                     title="${def?.name ?? t}">${def?.icon ?? '?'}</span>`;
    }).join('');

    if (unlocked) {
      return `<div class="mastery-card mastery-card--unlocked">
        <div class="mastery-card__header">
          <span class="mastery-card__icon">${group.icon}</span>
          <strong class="mastery-card__name">${group.name}</strong>
          <span class="mastery-badge">✓ Mastered</span>
        </div>
        <div class="mastery-techs">${allTechsHtml}</div>
        <div class="mastery-bonus mastery-bonus--active">${group.bonusLabel}</div>
      </div>`;
    }

    return `<div class="mastery-card">
      <div class="mastery-card__header">
        <span class="mastery-card__icon">${group.icon}</span>
        <strong class="mastery-card__name">${group.name}</strong>
        <span class="mastery-progress-label">${progress}/${total}</span>
      </div>
      <div class="mastery-techs">${allTechsHtml}</div>
      <div class="mastery-bar-wrap">
        <div class="mastery-bar" style="width:${pct}%"></div>
      </div>
      <div class="mastery-bonus mastery-bonus--locked">${group.bonusLabel}</div>
    </div>`;
  }).join('');

  return `
    <div class="mastery-section">
      <div class="mastery-section__header">
        <span>🎓 Tech Mastery</span>
        <span class="mastery-section__count">${unlockedCount} / ${MASTERY_GROUPS.length} unlocked</span>
      </div>
      <div class="mastery-section__intro">Research all technologies in a group to permanently unlock its bonus.</div>
      <div class="mastery-grid">${cards}</div>
    </div>`;
}

// ── T089: Landmarks section ────────────────────────────────────────────────

function _landmarksSection() {
  const captured = state.landmarks?.captured ?? {};
  const count    = Object.keys(captured).length;

  const cards = LANDMARK_ORDER.map(id => {
    const def   = LANDMARKS[id];
    const found = !!captured[id];

    const bonusLines = [];
    if (def.bonus.rates) {
      for (const [r, v] of Object.entries(def.bonus.rates)) bonusLines.push(`+${v}/s ${r}`);
    }
    if (def.bonus.caps) {
      for (const [r, v] of Object.entries(def.bonus.caps)) bonusLines.push(`+${v} ${r} cap`);
    }

    if (found) {
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
        <div class="relic-icon">★</div>
        <div class="relic-body">
          <div class="relic-name">${def.name}</div>
          <div class="relic-hint">Find it on the map — capture the ★ tile for: ${bonusLines.join(', ')}</div>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="relics-section">
      <div class="relics-header">
        <span>🗺️ Map Landmarks</span>
        <span class="relics-count">${count} / ${LANDMARK_ORDER.length} captured</span>
      </div>
      <div class="relics-intro">Legendary sites are marked ★ on the map. Capture them for permanent empire bonuses.</div>
      <div class="relics-grid">${cards}</div>
    </div>`;
}

// ── T106: Ancient Ruins section ───────────────────────────────────────────

function _ruinsSection() {
  const excavated = state.ruins?.excavated ?? {};
  const count     = Object.keys(excavated).length;

  // Build per-ruin cards using the 4 ruinId slots (ruin_0 … ruin_3)
  const cards = Array.from({ length: RUIN_COUNT }, (_, i) => {
    const ruinId = `ruin_${i}`;
    const data   = excavated[ruinId];

    if (data) {
      const outcomeDef = RUIN_OUTCOMES.find(o => o.id === data.outcome);
      return `
        <div class="relic-card relic-card--found">
          <div class="relic-icon">${outcomeDef?.icon ?? '🏛️'}</div>
          <div class="relic-body">
            <div class="relic-name">${outcomeDef?.name ?? data.outcome}</div>
            <div class="relic-desc">${outcomeDef?.desc ?? ''}</div>
            <div class="relic-bonus">${data.outcome === 'lost_artifact' ? '+0.8 gold/s, +100 gold cap' : 'One-time reward applied'}</div>
          </div>
        </div>`;
    }

    return `
      <div class="relic-card relic-card--locked">
        <div class="relic-icon">🏛️</div>
        <div class="relic-body">
          <div class="relic-name">Ancient Ruin</div>
          <div class="relic-hint">Marked 🏛️ on the map — capture the tile to excavate</div>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="relics-section">
      <div class="relics-header">
        <span>🏛️ Ancient Ruins</span>
        <span class="relics-count">${count} / ${RUIN_COUNT} excavated</span>
      </div>
      <div class="relics-intro">Ancient ruins are marked 🏛️ on the map. Capture the tile to excavate and reveal a random reward.</div>
      <div class="relics-grid">${cards}</div>
    </div>`;
}

// ── T103: Festivals section ────────────────────────────────────────────────

function _festivalsSection() {
  const active    = getActiveFestival();
  const cdSecs    = getFestivalCooldownSecs();
  const secsLeft  = getFestivalSecsLeft();

  // Active festival status banner
  let statusHtml = '';
  if (active) {
    const def = FESTIVALS[active.type];
    const detailHtml = def.durationTicks
      ? `<span class="festival-time">⏳ ${secsLeft}s remaining</span>`
      : `<span class="festival-charges">${active.chargesLeft ?? 0} battle charge${(active.chargesLeft ?? 0) !== 1 ? 's' : ''} left</span>`;
    statusHtml = `<div class="festival-active-banner">
      <span class="festival-active-icon">${def.icon}</span>
      <div class="festival-active-body">
        <strong>${def.name}</strong>
        ${detailHtml}
      </div>
    </div>`;
  } else if (cdSecs > 0) {
    const mins = Math.floor(cdSecs / 60);
    const secs = cdSecs % 60;
    const cdStr = mins > 0 ? `${mins}m ${secs}s` : `${cdSecs}s`;
    statusHtml = `<div class="festival-cooldown-banner">⏳ Festival cooldown: ${cdStr}</div>`;
  }

  const cards = FESTIVAL_ORDER.map(id => {
    const def       = FESTIVALS[id];
    const isActive  = active?.type === id;
    const onCooldown = cdSecs > 0 || (active && !isActive);
    const costParts = Object.entries(def.cost)
      .map(([r, a]) => {
        const ok = (state.resources[r] ?? 0) >= a;
        return `<span class="festival-cost ${ok ? 'festival-cost--ok' : 'festival-cost--bad'}">${_resIcon(r)}${fmtNum(a)}</span>`;
      }).join(' ');
    const canAfford = Object.entries(def.cost).every(([r, a]) => (state.resources[r] ?? 0) >= a);
    const disabled  = isActive || onCooldown || !canAfford;

    return `<div class="festival-card ${isActive ? 'festival-card--active' : ''}">
      <div class="festival-card__header">
        <span class="festival-card__icon">${def.icon}</span>
        <strong class="festival-card__name">${def.name}</strong>
        ${isActive ? '<span class="festival-badge">Active</span>' : ''}
      </div>
      <div class="festival-card__desc">${def.desc}</div>
      <div class="festival-card__cost">${costParts}</div>
      <button class="btn btn--sm btn--festival"
              data-festival="${id}"
              ${disabled ? 'disabled' : ''}>
        ${isActive ? 'Underway' : 'Declare'}
      </button>
    </div>`;
  }).join('');

  return `
    <div class="festival-section">
      <div class="festival-header">
        <span>🎉 Empire Festivals</span>
        <span class="festival-used-label">${state.festivals?.totalUsed ?? 0} declared this game</span>
      </div>
      <div class="festival-intro">Declare a festival for a temporary empire-wide boost. One at a time, 8-minute cooldown after each.</div>
      ${statusHtml}
      <div class="festival-grid">${cards}</div>
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
