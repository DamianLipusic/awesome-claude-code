/**
 * EmpireOS — Empire Summary Dashboard (T030).
 *
 * A single-tab overview panel that aggregates key metrics from all systems
 * so players don't need to tab-hunt for at-a-glance status.
 *
 * Sections:
 *   - Empire header (name, age, season, time played)
 *   - Resources (all 6: value/cap + rate)
 *   - Military (total power, unit composition, hero status)
 *   - Territory (tiles owned, enemy, explored)
 *   - Diplomacy (3 empire relations + trade routes)
 *   - Progression (quests, achievements, victory checklist)
 *   - Lifetime Stats (gold earned, peak territory, trades)
 */

import { state } from '../core/state.js';
import { on, Events } from '../core/events.js';
import { getResourceHistory } from './hud.js';
import { CITIZEN_ROLES, CITIZEN_ROLE_ORDER, adjustCitizenRole } from '../core/actions.js';
import { AGES } from '../data/ages.js';
import { UNITS } from '../data/units.js';
import { HERO_DEF } from '../data/hero.js';
import { EMPIRES } from '../data/empires.js';
import { QUESTS } from '../systems/quests.js';
import { TECHS } from '../data/techs.js';
import { ARCHETYPES } from '../data/archetypes.js';
import { RELIC_ORDER } from '../data/relics.js';
import { LANDMARK_ORDER } from '../data/landmarks.js';
import { RUIN_COUNT } from '../data/ruins.js';
import { currentSeason, seasonTicksRemaining } from '../systems/seasons.js';
import { getTerrainControl } from '../systems/map.js';
import { fmtNum, fmtRate } from '../utils/fmt.js';
import { TICKS_PER_SECOND } from '../core/tick.js';
import { calcScore, getScoreBreakdown } from '../utils/score.js';
import { WIN_ECONOMIC_GOLD } from '../systems/victory.js';
import {
  getAvailableGreatPerson, getGreatPersonSecsLeft,
  useGreatPerson,
} from '../systems/greatPersons.js'; // T136
const _GP_POINTS_TO_SPAWN = 3;

const TOTAL_ACHIEVEMENTS = 25;

// Per-resource line colours for the trend chart
const RES_CHART_COLORS = {
  gold:  '#f0b429',
  food:  '#3fb950',
  wood:  '#a0785a',
  stone: '#90a4ae',
  iron:  '#f85149',
  mana:  '#bc8cff',
};
const ACH_KEY = 'empireos-achievements';

// Victory condition thresholds (mirror systems/victory.js)
const VICTORY_TERRITORY = 80;
const VICTORY_QUESTS    = 10;
const VICTORY_AGE       = 3; // Medieval
const VICTORY_ALLIANCES = 3; // all 3 AI empires allied (diplomatic)

const RESOURCES = [
  { id: 'gold',  label: 'Gold',  icon: '💰' },
  { id: 'food',  label: 'Food',  icon: '🍞' },
  { id: 'wood',  label: 'Wood',  icon: '🪵' },
  { id: 'stone', label: 'Stone', icon: '🪨' },
  { id: 'iron',  label: 'Iron',  icon: '⚙️' },
  { id: 'mana',  label: 'Mana',  icon: '✨' },
];

// ── Public API ─────────────────────────────────────────────────────────────

export function initSummaryPanel() {
  const panel = document.getElementById('panel-summary');
  if (!panel) return;

  _render();

  // Re-render on any significant state change (throttled for performance)
  on(Events.RESOURCE_CHANGED,  _throttledRender());
  on(Events.BUILDING_CHANGED,  _render);
  on(Events.UNIT_CHANGED,      _render);
  on(Events.TECH_CHANGED,      _render);
  on(Events.AGE_CHANGED,       _render);
  on(Events.MAP_CHANGED,       _render);
  on(Events.DIPLOMACY_CHANGED, _render);
  on(Events.QUEST_COMPLETED,   _render);
  on(Events.ACHIEVEMENT_UNLOCKED, _render);
  on(Events.HERO_CHANGED,      _render);
  on(Events.SEASON_CHANGED,    _render);
  on(Events.RELIC_DISCOVERED,      _render);
  on(Events.LANDMARK_CAPTURED,     _render);
  on(Events.RUIN_EXCAVATED,        _render);
  on(Events.BUILDING_SPECIALIZED,  _render);
  on(Events.EXPLORATION_MILESTONE, _render);   // T108: exploration milestone reached
  on(Events.POPULATION_CHANGED,    _render);      // T096: rerender when pop changes (slot count changes)
  on(Events.CITIZEN_ROLES_CHANGED, _render);      // T096: rerender when roles adjusted
  on(Events.CAPITAL_PLAN_CHOSEN,   _render);      // T100: rerender when capital plan chosen
  on(Events.GREAT_PERSON,          _render);      // T136: great person spawned/used/expired
  on(Events.TICK, _tickCountdown());

  // Delegated click handler for citizen role +/- and great person use buttons
  if (panel) {
    panel.addEventListener('click', (e) => {
      // T096: citizen role adjustments
      const roleBtn = e.target.closest('[data-citizen-role]');
      if (roleBtn) {
        const role  = roleBtn.dataset.citizenRole;
        const delta = parseInt(roleBtn.dataset.citizenDelta, 10);
        const result = adjustCitizenRole(role, delta);
        if (!result.ok) {
          roleBtn.classList.add('btn--shake');
          setTimeout(() => roleBtn.classList.remove('btn--shake'), 400);
        }
        return;
      }
      // T136: use great person
      const gpBtn = e.target.closest('[data-use-gp]');
      if (gpBtn) {
        const result = useGreatPerson();
        if (!result.ok) {
          gpBtn.title = result.reason ?? 'Cannot use.';
          gpBtn.classList.add('btn--shake');
          setTimeout(() => gpBtn.classList.remove('btn--shake'), 400);
        }
      }
    });
  }
}

// ── Rendering ──────────────────────────────────────────────────────────────

function _render() {
  const panel = document.getElementById('panel-summary');
  if (!panel) return;

  const age      = AGES[state.age ?? 0];
  const season   = currentSeason?.() ?? { icon: '🌸', name: 'Spring' };
  const timeSecs = Math.floor((state.tick ?? 0) / TICKS_PER_SECOND);
  const mins     = Math.floor(timeSecs / 60);
  const secs     = timeSecs % 60;
  const timeStr  = `${mins}m ${String(secs).padStart(2, '0')}s`;

  panel.innerHTML = `
    ${_empireHeader(age, season, timeStr)}
    <div class="summary-grid">
      ${_advisorCard()}
      ${_scoreCard()}
      ${_greatPersonCard()}
      ${_resourcesCard()}
      ${_militaryCard()}
      ${_territoryCard()}
      ${_terrainControlCard()}
      ${_diplomacyCard()}
      ${_citizenRolesCard()}
      ${_progressionCard()}
      ${_statsCard(timeStr)}
      ${_chartCard()}
    </div>
  `;
}

// ── Empire header ──────────────────────────────────────────────────────────

function _empireHeader(age, season, timeStr) {
  const arch    = ARCHETYPES[state.archetype ?? 'none'];
  const archBadge = arch && arch.id !== 'none'
    ? `<span class="summary-empire-badge summary-empire-badge--arch">${arch.icon} ${arch.name}</span>`
    : '';
  return `
    <div class="summary-empire-header">
      <div>
        <div class="summary-empire-name">${_escHtml(state.empire?.name ?? 'My Empire')}</div>
        <div class="summary-empire-meta">
          <span class="summary-empire-badge">${age?.icon ?? '🪨'} ${age?.name ?? 'Stone Age'}</span>
          <span class="summary-empire-badge">${season.icon} ${season.name}</span>
          ${archBadge}
          <span class="summary-empire-badge">⏱️ ${timeStr}</span>
        </div>
      </div>
    </div>`;
}

// ── Resources card ─────────────────────────────────────────────────────────

function _resourcesCard() {
  const rows = RESOURCES.map(r => {
    const val  = state.resources[r.id] ?? 0;
    const cap  = state.caps[r.id] ?? 500;
    const rate = state.rates[r.id] ?? 0;
    const rateClass = rate >= 0 ? 'sum-res-rate--pos' : 'sum-res-rate--neg';
    return `
      <div class="sum-res-row">
        <span class="sum-res-icon">${r.icon}</span>
        <span class="sum-res-name">${r.label}</span>
        <span class="sum-res-val">${fmtNum(val)}/${fmtNum(cap)}</span>
        <span class="sum-res-rate ${rateClass}">${fmtRate(rate)}</span>
      </div>`;
  }).join('');

  return _card('💰 Resources', rows);
}

// ── Military card ──────────────────────────────────────────────────────────

function _rankMult(id) {
  const rank = state.unitRanks?.[id];
  if (rank === 'elite')   return 2.0;
  if (rank === 'veteran') return 1.5;
  return 1.0;
}

function _rankBadge(id) {
  const rank = state.unitRanks?.[id];
  if (rank === 'elite')   return ` <span class="rank-badge rank-badge--elite">★★</span>`;
  if (rank === 'veteran') return ` <span class="rank-badge rank-badge--veteran">★</span>`;
  return '';
}

function _militaryCard() {
  let attackPower = 0;
  const unitRows = [];

  for (const [id, count] of Object.entries(state.units ?? {})) {
    if (count <= 0) continue;
    const def = UNITS[id];
    if (!def) continue;
    const power = Math.round(def.attack * count * _rankMult(id));
    attackPower += power;
    unitRows.push(`
      <div class="sum-stat-row">
        <span class="sum-stat-label">${def.icon} ${def.name}${_rankBadge(id)}</span>
        <span class="sum-stat-value">×${count} <span style="color:var(--red);font-size:11px">(+${power} atk)</span></span>
      </div>`);
  }

  // Apply tech multipliers to displayed power
  if (state.techs?.tactics)     attackPower *= 1.25;
  if (state.techs?.steel)       attackPower *= 1.50;
  if (state.techs?.engineering) attackPower *= 1.10;

  // Hero
  let heroRow = '';
  if (state.hero) {
    attackPower += HERO_DEF.attack;
    heroRow = `
      <div class="sum-stat-row">
        <span class="sum-stat-label">⭐ Champion (Hero)</span>
        <span class="sum-stat-value sum-stat-value--purple">+${HERO_DEF.attack} atk</span>
      </div>`;
  }

  const emptyRow = unitRows.length === 0 && !state.hero
    ? `<div class="sum-stat-row"><span class="sum-stat-label" style="font-style:italic;color:var(--text-dim)">No units trained yet</span></div>`
    : '';

  const trainingRow = (state.trainingQueue?.length ?? 0) > 0
    ? `<div class="sum-stat-row"><span class="sum-stat-label">Training queue</span><span class="sum-stat-value">${state.trainingQueue.length} unit(s)</span></div>`
    : '';

  const totalRow = `
    <div class="sum-stat-row" style="border-top:1px solid var(--border);padding-top:5px;margin-top:3px">
      <span class="sum-stat-label">Total attack power</span>
      <span class="sum-stat-value sum-stat-value--red">${Math.round(attackPower)}</span>
    </div>`;

  return _card('⚔️ Military', emptyRow + unitRows.join('') + heroRow + trainingRow + totalRow);
}

// ── Territory card ─────────────────────────────────────────────────────────

function _territoryCard() {
  let player = 0, enemy = 0, revealed = 0, total = 0;

  if (state.map) {
    total = state.map.width * state.map.height;
    for (const row of state.map.tiles) {
      for (const t of row) {
        if (t.owner === 'player') player++;
        else if (t.owner === 'enemy') enemy++;
        if (t.revealed) revealed++;
      }
    }
  }

  const pct = total > 0 ? Math.round(player / total * 100) : 0;

  const rows = `
    <div class="sum-stat-row">
      <span class="sum-stat-label">Your territory</span>
      <span class="sum-stat-value sum-stat-value--blue">${player} tiles (${pct}%)</span>
    </div>
    <div class="sum-stat-row">
      <span class="sum-stat-label">Enemy settlements</span>
      <span class="sum-stat-value sum-stat-value--red">${enemy} tiles</span>
    </div>
    <div class="sum-stat-row">
      <span class="sum-stat-label">Explored</span>
      <span class="sum-stat-value">${revealed} / ${total}</span>
    </div>`;

  return _card('🗺️ Territory', rows);
}

// ── Diplomacy card ─────────────────────────────────────────────────────────

function _diplomacyCard() {
  if (!state.diplomacy?.empires) {
    return _card('🤝 Diplomacy', '<div class="sum-stat-row"><span class="sum-stat-label" style="font-style:italic">Not yet initialised</span></div>');
  }

  const rows = state.diplomacy.empires.map(emp => {
    const def  = EMPIRES[emp.id];
    const rel  = emp.relations ?? 'neutral';
    const badgeCls = `sum-dipl-badge sum-dipl-badge--${rel}`;
    const relLabel = rel.charAt(0).toUpperCase() + rel.slice(1);
    const tradeStr = rel === 'allied' && emp.tradeRoutes > 0
      ? `<span style="font-size:11px;color:var(--green)">+${emp.tradeRoutes} route(s)</span>`
      : '';
    return `
      <div class="sum-dipl-row">
        <span style="font-size:16px">${def?.icon ?? '?'}</span>
        <span class="sum-dipl-name">${def?.name ?? emp.id}</span>
        <span class="${badgeCls}">${relLabel}</span>
        ${tradeStr}
      </div>`;
  }).join('');

  return _card('🤝 Diplomacy', rows);
}

// ── Progression card ───────────────────────────────────────────────────────

function _progressionCard() {
  const questsDone  = Object.keys(state.quests?.completed ?? {}).length;
  const questsTotal = QUESTS.length;
  const questPct    = Math.round(questsDone / questsTotal * 100);

  // Read achievements from localStorage (same approach as settingsPanel.js)
  let achDone = 0;
  try {
    const raw = localStorage.getItem(ACH_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      achDone = Object.keys(data.unlocked ?? {}).length;
    }
  } catch { /* ignore */ }
  const achPct = Math.round(achDone / TOTAL_ACHIEVEMENTS * 100);

  // Count player tiles
  let playerTiles = 0;
  if (state.map) {
    for (const row of state.map.tiles)
      for (const t of row)
        if (t.owner === 'player') playerTiles++;
  }

  // ── T069: Three victory paths ─────────────────────────────────────────────
  // Conquest Victory
  const vicAge       = (state.age ?? 0) >= VICTORY_AGE;
  const vicTerritory = playerTiles >= VICTORY_TERRITORY;
  const vicQuests    = questsDone >= VICTORY_QUESTS;
  const conquestDone = vicAge && vicTerritory && vicQuests;

  // Diplomatic Victory: all 3 empires allied
  const alliedCount   = state.diplomacy?.empires?.filter(e => e.relations === 'allied').length ?? 0;
  const diplomaticDone = alliedCount >= VICTORY_ALLIANCES;

  // Economic Victory: 50k gold + Economics tech
  const goldEarned    = Math.floor(state.stats?.goldEarned ?? 0);
  const goldPct       = Math.min(100, Math.round(goldEarned / WIN_ECONOMIC_GOLD * 100));
  const hasEconomics  = !!state.techs?.economics;
  const economicDone  = goldEarned >= WIN_ECONOMIC_GOLD && hasEconomics;

  function vc(label, met, detail) {
    const c    = met ? 'sum-stat-value--green' : 'sum-stat-value--red';
    const icon = met ? '✅' : '⬜';
    return `
      <div class="sum-stat-row">
        <span class="sum-stat-label">${icon} ${label}</span>
        <span class="sum-stat-value ${c}">${detail}</span>
      </div>`;
  }

  function pathHeader(icon, label, done) {
    const cls = done ? 'sum-vic-path--done' : 'sum-vic-path';
    const tick = done ? ' ✅' : '';
    return `<div class="${cls}" style="margin-top:8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:${done ? 'var(--accent-h)' : 'var(--text-dim)'}">
      ${icon} ${label}${tick}
    </div>`;
  }

  const rows = `
    <div class="sum-stat-row">
      <span class="sum-stat-label">Quests</span>
      <span class="sum-stat-value">${questsDone} / ${questsTotal}</span>
    </div>
    <div class="sum-progress"><div class="sum-progress__fill sum-progress__fill--quest" style="width:${questPct}%"></div></div>

    <div class="sum-stat-row" style="margin-top:6px">
      <span class="sum-stat-label">Achievements</span>
      <span class="sum-stat-value">${achDone} / ${TOTAL_ACHIEVEMENTS}</span>
    </div>
    <div class="sum-progress"><div class="sum-progress__fill sum-progress__fill--ach" style="width:${achPct}%"></div></div>

    <div class="sum-stat-row" style="margin-top:6px">
      <span class="sum-stat-label">🏺 Relics</span>
      <span class="sum-stat-value">${Object.keys(state.relics?.discovered ?? {}).length} / ${RELIC_ORDER.length}</span>
    </div>

    <div class="sum-stat-row" style="margin-top:4px">
      <span class="sum-stat-label">🗺️ Landmarks</span>
      <span class="sum-stat-value">${Object.keys(state.landmarks?.captured ?? {}).length} / ${LANDMARK_ORDER.length}</span>
    </div>

    <div class="sum-stat-row" style="margin-top:4px">
      <span class="sum-stat-label">🏛️ Ruins</span>
      <span class="sum-stat-value">${Object.keys(state.ruins?.excavated ?? {}).length} / ${RUIN_COUNT}</span>
    </div>

    ${(() => {
      // T108: exploration progress
      if (!state.map) return '';
      let total = 0, revealedCount = 0;
      for (const row of state.map.tiles) {
        for (const t of row) {
          total++;
          if (t.revealed) revealedCount++;
        }
      }
      const exploredPct = total > 0 ? Math.round(revealedCount / total * 100) : 0;
      const explMilestones = state.explorationMilestones ?? {};
      const nextMs = [50, 75, 90].find(p => !explMilestones[p]);
      const statusLabel = nextMs
        ? `Next at ${nextMs}%`
        : `<span style="color:var(--accent-h)">All reached!</span>`;
      return `
        <div class="sum-stat-row" style="margin-top:6px">
          <span class="sum-stat-label">🗺️ Exploration</span>
          <span class="sum-stat-value">${exploredPct}% — ${statusLabel}</span>
        </div>
        <div class="sum-progress"><div class="sum-progress__fill sum-progress__fill--quest" style="width:${exploredPct}%"></div></div>
      `;
    })()}

    ${pathHeader('⚔️', 'Conquest Victory', conquestDone)}
    ${vc('Medieval Age', vicAge, vicAge ? 'Reached' : `Age ${state.age ?? 0}/3`)}
    ${vc('Territory ≥ 80', vicTerritory, `${playerTiles} / ${VICTORY_TERRITORY}`)}
    ${vc('Quests ≥ 10', vicQuests, `${questsDone} / ${VICTORY_QUESTS}`)}

    ${pathHeader('🤝', 'Diplomatic Victory', diplomaticDone)}
    ${vc('All 3 Empires Allied', diplomaticDone, `${alliedCount} / ${VICTORY_ALLIANCES} allied`)}

    ${pathHeader('💰', 'Economic Victory', economicDone)}
    ${vc('Economics Tech', hasEconomics, hasEconomics ? 'Researched' : 'Not yet')}
    ${vc(`${WIN_ECONOMIC_GOLD.toLocaleString()} Gold Earned`, goldEarned >= WIN_ECONOMIC_GOLD, `${goldEarned.toLocaleString()} / ${WIN_ECONOMIC_GOLD.toLocaleString()}`)}
    <div class="sum-progress"><div class="sum-progress__fill sum-progress__fill--quest" style="width:${goldPct}%"></div></div>
  `;

  return _card('🏆 Progression', rows);
}

// ── Empire score card (T046) ───────────────────────────────────────────────

function _scoreCard() {
  const breakdown = getScoreBreakdown();
  const total     = calcScore();

  const rows = breakdown.map(item => {
    if (item.value === 0) return '';
    return `
      <div class="sum-score-row">
        <span class="sum-score-label">${_escHtml(item.label)}</span>
        <span>
          <span class="sum-score-detail">${_escHtml(item.detail)}</span>
          <span class="sum-score-value"> = ${item.value.toLocaleString()}</span>
        </span>
      </div>`;
  }).join('');

  const totalRow = `
    <div class="sum-score-total">
      <span>Total Score</span>
      <span class="sum-score-total-value">⭐ ${total.toLocaleString()}</span>
    </div>`;

  return _card('⭐ Empire Score', `<div class="sum-score-rows">${rows}${totalRow}</div>`);
}

// ── Great Person card (T136) ───────────────────────────────────────────────

function _greatPersonCard() {
  const gp = state.greatPersons;

  if (!gp) {
    return _card('✨ Great Persons', '<div class="sum-stat-row"><span class="sum-stat-label" style="font-style:italic;color:var(--text-dim)">Initialising…</span></div>');
  }

  // Points progress pips
  const pips = Array.from({ length: _GP_POINTS_TO_SPAWN }, (_, i) =>
    `<span class="gp-pip ${i < gp.points ? 'gp-pip--filled' : ''}"></span>`,
  ).join('');
  const nextSecs = Math.max(0, Math.ceil(((gp.nextPointTick ?? 0) - (state.tick ?? 0)) / 4));
  const nextMins = Math.floor(nextSecs / 60);
  const nextS    = nextSecs % 60;
  const nextStr  = nextMins > 0 ? `${nextMins}m ${String(nextS).padStart(2,'0')}s` : `${nextSecs}s`;

  const progressSection = `
    <div class="sum-gp-section">
      <div class="sum-gp-header">Progress: <span class="gp-points-pips">${pips}</span> ${gp.points}/${_GP_POINTS_TO_SPAWN}</div>
      <div style="font-size:11px;color:var(--text-dim);margin-top:3px">Next point in ${nextStr}</div>
    </div>`;

  // General charges
  const generalRow = (gp.generalCharges ?? 0) > 0
    ? `<div class="sum-stat-row" style="margin-top:6px">
        <span class="sum-stat-label">⚔️ General charges</span>
        <span class="sum-stat-value sum-stat-value--red">${gp.generalCharges} battle(s) left</span>
       </div>`
    : '';

  const person = getAvailableGreatPerson();
  if (!person) {
    return _card('✨ Great Persons', `
      ${progressSection}
      ${generalRow}
      <div style="font-size:11px;color:var(--text-dim);margin-top:6px">Reach ${_GP_POINTS_TO_SPAWN} points to summon a Great Person.</div>
      <div style="font-size:11px;color:var(--text-dim);margin-top:4px">Total used: ${gp.totalUsed ?? 0}</div>
    `);
  }

  const secsLeft = getGreatPersonSecsLeft();
  const mins = Math.floor(secsLeft / 60);
  const secs = secsLeft % 60;
  const timeStr = mins > 0 ? `${mins}m ${String(secs).padStart(2,'0')}s` : `${secsLeft}s`;
  const urgent  = secsLeft <= 60;

  return _card('✨ Great Persons', `
    ${progressSection}
    ${generalRow}
    <div class="great-person-card great-person-card--available" style="margin-top:8px">
      <div class="great-person-card__header">
        <span class="great-person-card__icon">${person.icon}</span>
        <span class="great-person-card__name">${_escHtml(person.name)}</span>
        <span class="great-person-card__timer${urgent ? ' great-person-card__timer--urgent' : ''}">${timeStr}</span>
      </div>
      <div class="great-person-card__desc">${_escHtml(person.desc)}</div>
      <button class="btn btn--sm btn--use-gp" data-use-gp="1">Summon</button>
    </div>
    <div style="font-size:11px;color:var(--text-dim);margin-top:4px">Total used: ${gp.totalUsed ?? 0}</div>
  `);
}

// ── Citizen Roles card (T096) ──────────────────────────────────────────────

function _citizenRolesCard() {
  const popCount = Math.floor(state.population?.count ?? 0);
  const maxSlots = Math.floor(popCount / 100);
  const roles    = state.citizenRoles ?? {};
  const used     = CITIZEN_ROLE_ORDER.reduce((s, r) => s + (roles[r] ?? 0), 0);

  const header = `
    <div class="sum-citizen-header">
      <span class="sum-citizen-title">👥 Citizen Roles</span>
      <span class="sum-citizen-slots ${used >= maxSlots ? 'sum-citizen-slots--full' : ''}">${used}/${maxSlots} slots</span>
    </div>
    <div class="sum-citizen-hint">${maxSlots === 0 ? '100 citizens = 1 role slot' : 'Each slot = 100 citizens'}</div>`;

  const roleRows = CITIZEN_ROLE_ORDER.map(roleId => {
    const def     = CITIZEN_ROLES[roleId];
    const current = roles[roleId] ?? 0;
    const canInc  = used < maxSlots;
    const canDec  = current > 0;
    return `
      <div class="sum-citizen-row">
        <span class="sum-citizen-icon">${def.icon}</span>
        <span class="sum-citizen-name">${def.name}</span>
        <span class="sum-citizen-count">${current}</span>
        <div class="sum-citizen-btns">
          <button class="btn btn--xs sum-citizen-btn" data-citizen-role="${roleId}" data-citizen-delta="-1"
            ${canDec ? '' : 'disabled'}>−</button>
          <button class="btn btn--xs sum-citizen-btn" data-citizen-role="${roleId}" data-citizen-delta="1"
            ${canInc ? '' : 'disabled'}>+</button>
        </div>
        <span class="sum-citizen-desc">${def.desc}</span>
      </div>`;
  }).join('');

  return _card('👥 Citizen Roles', `${header}${roleRows}`);
}

// ── Terrain control card (T099) ────────────────────────────────────────────

function _terrainControlCard() {
  const ctrl = getTerrainControl();
  const TERRAIN_ROWS = [
    { type: 'grass',    icon: '🌿', label: 'Grassland', res: 'food',  base5: 1.5 },
    { type: 'forest',   icon: '🌲', label: 'Forest',    res: 'wood',  base5: 1.5 },
    { type: 'hills',    icon: '⛰️', label: 'Hills',     res: 'stone', base5: 1.5 },
    { type: 'river',    icon: '🏞️', label: 'River',     res: 'gold+food', base5: 1.0 },
    { type: 'mountain', icon: '🏔️', label: 'Mountain',  res: 'iron',  base5: 1.5 },
  ];
  const rows = TERRAIN_ROWS.map(t => {
    const count  = ctrl[t.type] ?? 0;
    const bonus  = count >= 10 ? t.base5 * 2 : count >= 5 ? t.base5 : 0;
    const thresh = count >= 10 ? 10 : 5;
    const barPct = Math.min(100, Math.round(count / thresh * 100));
    const activeClass = bonus > 0 ? ' sum-terrain--active' : '';
    const bonusStr = bonus > 0
      ? `<span class="sum-terrain__bonus">+${bonus}/s ${t.res}</span>`
      : `<span class="sum-terrain__bonus sum-terrain__bonus--locked">Need ${thresh - count} more</span>`;
    return `
      <div class="sum-terrain-row${activeClass}">
        <span class="sum-terrain__icon">${t.icon}</span>
        <span class="sum-terrain__name">${t.label}</span>
        <div class="sum-terrain__bar-wrap"><div class="sum-terrain__bar" style="width:${barPct}%"></div></div>
        <span class="sum-terrain__count">${count}/${thresh}</span>
        ${bonusStr}
      </div>`;
  }).join('');

  const anyActive = Object.values(ctrl).some((c, i) => c >= [5,5,5,5,5][i]);
  const hint = anyActive ? '' : `<div class="sum-terrain__hint">Control 5+ tiles of a terrain type to gain resource bonuses (10+ doubles them)</div>`;
  return _card('🌍 Terrain Control', hint + rows);
}

// ── Lifetime stats card ────────────────────────────────────────────────────

function _statsCard(timeStr) {
  const goldEarned    = Math.round(state.stats?.goldEarned ?? 0);
  const peakTerritory = state.stats?.peakTerritory ?? 0;
  const totalTrades   = state.market?.totalTrades ?? 0;

  const PLAN_LABELS = { fortress: '🏰 Fortress', commerce: '💼 Commerce Hub', academy: '📚 Grand Academy', arcane_tower: '🔮 Arcane Tower' };
  const planRow = state.capitalPlan
    ? `<div class="sum-stat-row"><span class="sum-stat-label">🏛️ Capital Plan</span><span class="sum-stat-value" style="color:#f0b429">${PLAN_LABELS[state.capitalPlan] ?? state.capitalPlan}</span></div>`
    : `<div class="sum-stat-row"><span class="sum-stat-label">🏛️ Capital Plan</span><span class="sum-stat-value" style="color:var(--text-dim)">None chosen</span></div>`;

  const rows = `
    ${planRow}
    <div class="sum-stat-row">
      <span class="sum-stat-label">💰 Gold earned (session)</span>
      <span class="sum-stat-value sum-stat-value--accent">${fmtNum(goldEarned)}</span>
    </div>
    <div class="sum-stat-row">
      <span class="sum-stat-label">🗺️ Peak territory</span>
      <span class="sum-stat-value">${peakTerritory} tiles</span>
    </div>
    <div class="sum-stat-row">
      <span class="sum-stat-label">🏪 Market trades</span>
      <span class="sum-stat-value">${totalTrades}</span>
    </div>
    <div class="sum-stat-row">
      <span class="sum-stat-label">⏱️ Time played</span>
      <span class="sum-stat-value">${timeStr}</span>
    </div>`;

  return _card('📈 Lifetime Stats', rows);
}

// ── Advisor card (T040) ────────────────────────────────────────────────────

/**
 * Generates a list of prioritised advisor tips based on the current game state.
 * Returns up to 4 tip objects: { icon, text, level }
 * level: 'warn' | 'info' | 'ok'
 */
function _generateTips() {
  const tips = [];

  // ── Critical warnings ──────────────────────────────────────────────────
  if ((state.rates?.food ?? 0) < -0.3) {
    tips.push({ icon: '⚠️', text: 'Food is depleting — build more Farms or reduce army size', level: 'warn' });
  }
  if ((state.rates?.gold ?? 0) < -0.5 && (state.resources?.gold ?? 0) < 200) {
    tips.push({ icon: '💸', text: 'Gold reserves draining — check diplomacy costs and upkeep', level: 'warn' });
  }

  // ── War overextension ──────────────────────────────────────────────────
  const warCount = (state.diplomacy?.empires ?? []).filter(e => e.relations === 'war').length;
  if (warCount >= 2) {
    tips.push({ icon: '🤝', text: `At war with ${warCount} empires — propose peace to reduce raid damage`, level: 'warn' });
  }

  // ── Age advance ready ──────────────────────────────────────────────────
  const nextAge = AGES[(state.age ?? 0) + 1];
  if (nextAge) {
    let reqsMet = true;
    for (const req of nextAge.requires) {
      if (req.type === 'tech' && !state.techs?.[req.id]) { reqsMet = false; break; }
      if (req.type === 'totalBuildings') {
        const total = Object.values(state.buildings ?? {}).reduce((a, b) => a + b, 0);
        if (total < req.count) { reqsMet = false; break; }
      }
      if (req.type === 'totalUnits') {
        const total = Object.values(state.units ?? {}).reduce((a, b) => a + b, 0);
        if (total < req.count) { reqsMet = false; break; }
      }
      if (req.type === 'territory') {
        let territory = 0;
        if (state.map) {
          for (const row of state.map.tiles)
            for (const t of row)
              if (t.owner === 'player') territory++;
        }
        if (territory < req.count) { reqsMet = false; break; }
      }
    }
    if (reqsMet) {
      tips.push({ icon: '⬆️', text: `Ready to advance to ${nextAge.icon} ${nextAge.name}! Go to the Research tab`, level: 'ok' });
    }
  }

  // ── No military ────────────────────────────────────────────────────────
  if ((state.tick ?? 0) > 120) {
    const totalUnits = Object.values(state.units ?? {}).reduce((a, b) => a + b, 0);
    if (totalUnits === 0) {
      tips.push({ icon: '⚔️', text: 'No military forces — train Soldiers to defend and expand', level: 'info' });
    }
  }

  // ── Research available ─────────────────────────────────────────────────
  if (state.researchQueue?.length === 0) {
    const inQueue = new Set();
    for (const [id, def] of Object.entries(TECHS)) {
      if (state.techs?.[id]) continue;
      if (inQueue.has(id))  continue;
      const prereqsMet = def.requires.every(r => state.techs?.[r]);
      if (!prereqsMet) continue;
      const affordable = Object.entries(def.cost).every(([r, a]) => (state.resources?.[r] ?? 0) >= a);
      if (affordable) {
        tips.push({ icon: '🔬', text: `Research available: ${def.icon} ${def.name} — visit the Research tab`, level: 'info' });
        break;
      }
    }
  }

  // ── Resource near cap ──────────────────────────────────────────────────
  const RES_LABELS = { gold: 'Gold', food: 'Food', wood: 'Wood', stone: 'Stone', iron: 'Iron', mana: 'Mana' };
  for (const [id, label] of Object.entries(RES_LABELS)) {
    const val = state.resources?.[id] ?? 0;
    const cap = state.caps?.[id] ?? 500;
    if (cap > 0 && val / cap >= 0.9 && (state.rates?.[id] ?? 0) > 0) {
      tips.push({ icon: '📦', text: `${label} is almost full (${Math.round(val / cap * 100)}%) — build more storage`, level: 'info' });
      break; // only one cap warning at a time
    }
  }

  // ── Territory small (late game) ────────────────────────────────────────
  if ((state.tick ?? 0) > 480) {
    let playerTiles = 0;
    if (state.map) {
      for (const row of state.map.tiles)
        for (const t of row)
          if (t.owner === 'player') playerTiles++;
    }
    if (playerTiles < 6) {
      tips.push({ icon: '🗺️', text: 'Territory is small — attack enemy tiles on the Map tab to expand', level: 'info' });
    }
  }

  return tips.slice(0, 4);
}

function _advisorCard() {
  const tips = _generateTips();
  let body;
  if (tips.length === 0) {
    body = `<div class="sum-advisor-tip sum-advisor-tip--ok">✅ Your empire is flourishing — keep expanding!</div>`;
  } else {
    body = tips.map(t =>
      `<div class="sum-advisor-tip sum-advisor-tip--${t.level}">${t.icon} ${_escHtml(t.text)}</div>`
    ).join('');
  }
  return _card('💡 Advisor', body);
}

// ── Resource trend chart (T043) ────────────────────────────────────────────

/**
 * Full-width card showing a 6-line SVG trend chart of all resources.
 * Each polyline is independently normalised (min→max = full height) so
 * slow-changing resources (mana, iron) are as visible as fast ones (gold, food).
 */
function _chartCard() {
  const history = getResourceHistory();
  const W = 300, H = 80, PX = 4, PY = 6;
  const PW = W - PX * 2;
  const PH = H - PY * 2;

  // Subtle horizontal grid at 25 / 50 / 75 %
  const gridLines = [0.25, 0.5, 0.75].map(f => {
    const y = (PY + f * PH).toFixed(1);
    return `<line x1="${PX}" y1="${y}" x2="${W - PX}" y2="${y}" stroke="#30363d" stroke-width="0.5"/>`;
  }).join('');

  // One polyline per resource, independently normalised
  const polylines = Object.entries(RES_CHART_COLORS).map(([id, color]) => {
    const vals = history[id] ?? [];
    if (vals.length < 2) return '';
    const lo    = Math.min(...vals);
    const hi    = Math.max(...vals);
    const range = hi - lo;
    const pts   = vals.map((v, i) => {
      const x = (PX + (i / (vals.length - 1)) * PW).toFixed(1);
      const y = range === 0
        ? (H / 2).toFixed(1)
        : (PY + (1 - (v - lo) / range) * PH).toFixed(1);
      return `${x},${y}`;
    }).join(' ');
    return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.9"/>`;
  }).join('');

  const sampleCount = Math.max(0, ...Object.values(history).map(h => h.length));

  const svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" class="sum-chart__svg" aria-hidden="true" preserveAspectRatio="none">${gridLines}${polylines}</svg>`;

  const legend = Object.entries(RES_CHART_COLORS).map(([id, color]) => {
    const label = RESOURCES.find(r => r.id === id)?.label ?? id;
    return `<span class="sum-chart__item"><span class="sum-chart__dot" style="background:${color}"></span>${_escHtml(label)}</span>`;
  }).join('');

  const caption = sampleCount > 0
    ? `<div class="sum-chart__caption">Last ${sampleCount}s of history — each line independently scaled to show trends</div>`
    : `<div class="sum-chart__caption" style="font-style:italic">History accumulates as the game runs…</div>`;

  return `<div class="summary-card summary-card--wide">
    <div class="summary-card__title">
      <span class="summary-card__title-icon">📈</span>
      Resource Trends
    </div>
    <div class="summary-card__body">
      ${svg}
      <div class="sum-chart__legend">${legend}</div>
      ${caption}
    </div>
  </div>`;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function _card(title, bodyHtml) {
  const [icon, ...rest] = title.split(' ');
  const label = rest.join(' ');
  return `
    <div class="summary-card">
      <div class="summary-card__title">
        <span class="summary-card__title-icon">${icon}</span>
        ${_escHtml(label)}
      </div>
      <div class="summary-card__body">${bodyHtml}</div>
    </div>`;
}

function _escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Throttle RESOURCE_CHANGED renders to every 4 ticks (1 s)
function _throttledRender() {
  let last = 0;
  return () => {
    if ((state.tick ?? 0) - last >= 4) {
      last = state.tick;
      _render();
    }
  };
}

// Update time-played and season countdown every 4 ticks without full re-render
function _tickCountdown() {
  let last = 0;
  return () => {
    if ((state.tick ?? 0) - last >= 4) {
      last = state.tick;
      // Only re-render if the summary panel is currently visible
      const panel = document.getElementById('panel-summary');
      if (panel && !panel.classList.contains('panel--hidden')) {
        _render();
      }
    }
  };
}
