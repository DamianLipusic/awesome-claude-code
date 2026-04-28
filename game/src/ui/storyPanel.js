/**
 * EmpireOS — Empire Chronicle panel UI.
 *
 * Renders empire milestones as a vertical timeline.
 * Refreshes whenever any milestone-triggering event fires.
 */

import { state } from '../core/state.js';
import { on, Events } from '../core/events.js';
import { getSeasonChronicle, getCurrentSeasonStats } from '../systems/seasonChronicle.js';

const PANEL_ID = 'panel-story';

const UPDATE_EVENTS = [
  Events.GAME_STARTED,
  Events.GAME_LOADED,
  Events.BUILDING_CHANGED,
  Events.UNIT_CHANGED,
  Events.TECH_CHANGED,
  Events.AGE_CHANGED,
  Events.MAP_CHANGED,
  Events.QUEST_COMPLETED,
  Events.SEASON_CHANGED,
];

export function initStoryPanel() {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;

  for (const ev of UPDATE_EVENTS) on(ev, render);
  render();
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function render() {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;

  const entries  = state.story ?? [];
  const recaps   = getSeasonChronicle();
  const current  = getCurrentSeasonStats();
  const hasData  = entries.length > 0 || recaps.length > 0 || current;

  if (!hasData) {
    panel.innerHTML = `
      <div class="story-header">
        <div class="story-header__title">Empire Chronicle</div>
        <div class="story-header__sub">Your empire's history will be recorded here.</div>
      </div>
      <div class="story-empty">No history yet — your story is just beginning.</div>
    `;
    return;
  }

  panel.innerHTML = `
    <div class="story-header">
      <div class="story-header__title">Empire Chronicle</div>
      <div class="story-header__sub">${entries.length} milestone${entries.length !== 1 ? 's' : ''} recorded</div>
    </div>
    ${_chronicleSection(recaps, current)}
    <div class="story-timeline">
      ${entries.map(_entryHtml).join('')}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Season Chronicle section
// ---------------------------------------------------------------------------

function _chronicleSection(recaps, current) {
  if (!current && recaps.length === 0) return '';

  const cards = [];

  if (current) {
    cards.push(_recapCardHtml(current, true));
  }

  for (const r of recaps.slice(0, 4)) {
    cards.push(_recapCardHtml(r, false));
  }

  return `
    <div class="chron-section">
      <div class="chron-section__title">Season Chronicle</div>
      <div class="chron-cards">
        ${cards.join('')}
      </div>
    </div>
  `;
}

function _recapCardHtml(r, isCurrent) {
  const winRate = (r.battlesWon + r.battlesLost) > 0
    ? Math.round(100 * r.battlesWon / (r.battlesWon + r.battlesLost))
    : null;

  const winBadge = winRate !== null
    ? `<span class="chron-stat chron-stat--${winRate >= 50 ? 'win' : 'loss'}">${winRate}% wins</span>`
    : '';

  const label = isCurrent ? 'Current Season' : 'Past Season';

  return `
    <div class="chron-card${isCurrent ? ' chron-card--active' : ''}">
      <div class="chron-card__head">
        <span class="chron-card__icon">${r.seasonIcon}</span>
        <span class="chron-card__name">${r.seasonName}</span>
        <span class="chron-card__label">${label}</span>
      </div>
      <div class="chron-card__stats">
        <div class="chron-stat-row">
          <span class="chron-stat-key">⚔️ Battles</span>
          <span class="chron-stat-val">${r.battlesWon}W / ${r.battlesLost}L ${winBadge}</span>
        </div>
        <div class="chron-stat-row">
          <span class="chron-stat-key">🏛️ Built</span>
          <span class="chron-stat-val">${r.built}</span>
        </div>
        <div class="chron-stat-row">
          <span class="chron-stat-key">🔬 Techs</span>
          <span class="chron-stat-val">${r.techs}</span>
        </div>
        <div class="chron-stat-row">
          <span class="chron-stat-key">📜 Quests</span>
          <span class="chron-stat-val">${r.quests}</span>
        </div>
        <div class="chron-stat-row">
          <span class="chron-stat-key">🗺️ Tiles</span>
          <span class="chron-stat-val">${r.tilesGained}</span>
        </div>
      </div>
    </div>
  `;
}

function _entryHtml(entry) {
  const timeStr = _tickToTime(entry.tick ?? 0);
  return `
    <div class="story-entry story-entry--${entry.type ?? 'info'}">
      <div class="story-entry__icon">${entry.icon ?? '📌'}</div>
      <div class="story-entry__body">
        <div class="story-entry__title">${entry.title}</div>
        <div class="story-entry__desc">${entry.desc}</div>
        <div class="story-entry__time">${timeStr}</div>
      </div>
    </div>
  `;
}

function _tickToTime(tick) {
  const totalSecs = Math.floor(tick / 4);
  const mins      = Math.floor(totalSecs / 60);
  const secs      = totalSecs % 60;
  if (mins === 0) return `${secs}s into reign`;
  return `${mins}m ${secs}s into reign`;
}
