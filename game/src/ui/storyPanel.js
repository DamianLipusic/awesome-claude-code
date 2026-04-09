/**
 * EmpireOS — Empire Chronicle panel UI.
 *
 * Renders empire milestones as a vertical timeline.
 * Refreshes whenever any milestone-triggering event fires.
 */

import { state } from '../core/state.js';
import { on, Events } from '../core/events.js';

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

  const entries = state.story ?? [];

  if (entries.length === 0) {
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
    <div class="story-timeline">
      ${entries.map(_entryHtml).join('')}
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
