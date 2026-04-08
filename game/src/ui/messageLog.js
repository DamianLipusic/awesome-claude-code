/**
 * EmpireOS — Message / event log panel.
 */

import { state } from '../core/state.js';
import { on, Events } from '../core/events.js';

const MAX_VISIBLE = 15;

export function initMessageLog() {
  const log = document.getElementById('message-log');
  if (!log) return;

  on(Events.MESSAGE, renderLog);
  renderLog();
}

function renderLog() {
  const log = document.getElementById('message-log');
  if (!log) return;

  log.innerHTML = state.messages.slice(0, MAX_VISIBLE).map(m => `
    <div class="log-entry log-entry--${m.type ?? 'info'}">
      ${escapeHtml(m.text)}
    </div>
  `).join('');
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
