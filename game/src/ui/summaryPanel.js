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
import { AGES } from '../data/ages.js';
import { UNITS } from '../data/units.js';
import { HERO_DEF } from '../data/hero.js';
import { EMPIRES } from '../data/empires.js';
import { QUESTS } from '../systems/quests.js';
import { currentSeason, seasonTicksRemaining } from '../systems/seasons.js';
import { fmtNum, fmtRate } from '../utils/fmt.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const TOTAL_ACHIEVEMENTS = 15;
const ACH_KEY = 'empireos-achievements';

// Victory conditions (mirrors systems/victory.js thresholds)
const VICTORY_TERRITORY = 80;
const VICTORY_QUESTS    = 10;
const VICTORY_AGE       = 3; // Medieval

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
  on(Events.TICK, _tickCountdown());
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
      ${_resourcesCard()}
      ${_militaryCard()}
      ${_territoryCard()}
      ${_diplomacyCard()}
      ${_progressionCard()}
      ${_statsCard(timeStr)}
    </div>
  `;
}

// ── Empire header ──────────────────────────────────────────────────────────

function _empireHeader(age, season, timeStr) {
  return `
    <div class="summary-empire-header">
      <div>
        <div class="summary-empire-name">${_escHtml(state.empire?.name ?? 'My Empire')}</div>
        <div class="summary-empire-meta">
          <span class="summary-empire-badge">${age?.icon ?? '🪨'} ${age?.name ?? 'Stone Age'}</span>
          <span class="summary-empire-badge">${season.icon} ${season.name}</span>
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

function _militaryCard() {
  let attackPower = 0;
  const unitRows = [];

  for (const [id, count] of Object.entries(state.units ?? {})) {
    if (count <= 0) continue;
    const def = UNITS[id];
    if (!def) continue;
    const power = def.attack * count;
    attackPower += power;
    unitRows.push(`
      <div class="sum-stat-row">
        <span class="sum-stat-label">${def.icon} ${def.name}</span>
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

  // Victory conditions
  let playerTiles = 0;
  if (state.map) {
    for (const row of state.map.tiles)
      for (const t of row)
        if (t.owner === 'player') playerTiles++;
  }
  const vicAge      = (state.age ?? 0) >= VICTORY_AGE;
  const vicTerritory = playerTiles >= VICTORY_TERRITORY;
  const vicQuests   = questsDone >= VICTORY_QUESTS;

  function vc(label, met, detail) {
    const c = met ? 'sum-stat-value--green' : 'sum-stat-value--red';
    const icon = met ? '✅' : '⬜';
    return `
      <div class="sum-stat-row">
        <span class="sum-stat-label">${icon} ${label}</span>
        <span class="sum-stat-value ${c}">${detail}</span>
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

    <div style="margin-top:8px;font-size:11px;color:var(--text-dim);font-weight:600;text-transform:uppercase;letter-spacing:.05em">Victory Conditions</div>
    ${vc('Medieval Age', vicAge, vicAge ? 'Reached' : `Age ${state.age ?? 0}/3`)}
    ${vc('Territory ≥ 80', vicTerritory, `${playerTiles} / ${VICTORY_TERRITORY}`)}
    ${vc('Quests ≥ 10', vicQuests, `${questsDone} / ${VICTORY_QUESTS}`)}
  `;

  return _card('🏆 Progression', rows);
}

// ── Lifetime stats card ────────────────────────────────────────────────────

function _statsCard(timeStr) {
  const goldEarned    = Math.round(state.stats?.goldEarned ?? 0);
  const peakTerritory = state.stats?.peakTerritory ?? 0;
  const totalTrades   = state.market?.totalTrades ?? 0;

  const rows = `
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
