/**
 * EmpireOS — Settings panel UI.
 *
 * Provides:
 *   - Game speed control: 0.5× / 1× / 2× / 4×
 *   - Leaderboard: top 5 scores from past sessions
 *   - Sound toggle placeholder (disabled — no audio implemented yet)
 *   - About section
 */

import { setTickSpeed, getTickSpeed } from '../core/tick.js';
import { exportSave, importSave } from './saveModal.js';

const PANEL_ID   = 'panel-settings';
const LB_KEY     = 'empireos-leaderboard';
const AGE_NAMES  = ['Stone', 'Bronze', 'Iron', 'Medieval'];

const SPEEDS = [
  { label: '½×', value: 0.5 },
  { label: '1×', value: 1   },
  { label: '2×', value: 2   },
  { label: '4×', value: 4   },
];

export function initSettingsPanel() {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;
  _render(panel);
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function _render(panel) {
  const current = getTickSpeed();

  panel.innerHTML = `
    <div class="settings-section">
      <div class="settings-section__title">⚡ Game Speed</div>
      <div class="settings-section__desc">
        Controls how fast the game clock runs. Higher speeds earn resources and
        train units faster, but random events and raids also arrive sooner.
      </div>
      <div class="speed-buttons">
        ${SPEEDS.map(s => `
          <button
            class="btn btn--speed ${s.value === current ? 'btn--speed-active' : ''}"
            data-speed="${s.value}"
            title="${s.value}× speed"
          >${s.label}</button>
        `).join('')}
      </div>
    </div>

    ${_leaderboardSection()}

    <div class="settings-section">
      <div class="settings-section__title">💾 Save Portability</div>
      <div class="settings-section__desc">
        Export your save as a text code you can back up or move to another
        browser. Paste the code back in to restore your progress.
      </div>
      <div class="save-port-buttons">
        <button class="btn btn--sm" id="btn-export-save">📤 Export Save</button>
        <button class="btn btn--sm" id="btn-import-save">📥 Import Save</button>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section__title">🔊 Sound Effects</div>
      <div class="settings-section__desc">
        Audio feedback for combat, construction, and events.
      </div>
      <label class="settings-toggle">
        <input type="checkbox" id="chk-sound" disabled>
        <span class="settings-toggle__label">Enable Sound Effects</span>
        <span class="settings-badge">Coming soon</span>
      </label>
    </div>

    <div class="settings-section">
      <div class="settings-section__title">ℹ️ About EmpireOS</div>
      <div class="settings-section__desc">
        A browser-based empire builder — vanilla ES modules, no dependencies,
        no build step. Open <code>game/index.html</code> directly to play.<br><br>
        Auto-saves every 60 seconds to <code>localStorage</code>.
        Use the Save button to save manually.
      </div>
    </div>
  `;

  // Bind speed buttons
  panel.querySelectorAll('.btn--speed').forEach(btn => {
    btn.addEventListener('click', () => {
      setTickSpeed(parseFloat(btn.dataset.speed));
      _render(panel);
    });
  });

  // Bind export / import buttons
  panel.querySelector('#btn-export-save')?.addEventListener('click', exportSave);
  panel.querySelector('#btn-import-save')?.addEventListener('click', importSave);

  // Bind clear-leaderboard button (if present)
  panel.querySelector('#btn-clear-lb')?.addEventListener('click', () => {
    if (confirm('Clear all leaderboard scores? This cannot be undone.')) {
      localStorage.removeItem(LB_KEY);
      _render(panel);
    }
  });
}

// ---------------------------------------------------------------------------
// Leaderboard section
// ---------------------------------------------------------------------------

function _leaderboardSection() {
  let lb;
  try {
    const raw = localStorage.getItem(LB_KEY);
    lb = raw ? JSON.parse(raw) : { scores: [] };
  } catch {
    lb = { scores: [] };
  }

  if (lb.scores.length === 0) {
    return `<div class="settings-section">
      <div class="settings-section__title">🏆 Leaderboard</div>
      <div class="settings-section__desc">
        No scores recorded yet. Start a New Game after playing to save your current
        session score to the leaderboard.
      </div>
    </div>`;
  }

  const rows = lb.scores.slice(0, 5).map((s, i) => {
    const ageName = AGE_NAMES[s.age] ?? 'Stone';
    const gold    = Math.round(s.goldEarned).toLocaleString();
    return `<div class="lb-row ${i === 0 ? 'lb-row--gold' : ''}">
      <span class="lb-rank">#${i + 1}</span>
      <span class="lb-name">${_escHtml(s.name)}</span>
      <span class="lb-territory">🗺️ ${s.territory}</span>
      <span class="lb-gold">🪙 ${gold}</span>
      <span class="lb-age">${ageName}</span>
      <span class="lb-date">${_escHtml(s.date)}</span>
    </div>`;
  }).join('');

  return `<div class="settings-section">
    <div class="settings-section__title">🏆 Leaderboard</div>
    <div class="settings-section__desc">
      Top sessions ranked by peak territory, then total gold earned.
      Score is saved when you start a New Game.
    </div>
    <div class="lb-table">
      <div class="lb-header">
        <span>Rank</span>
        <span>Empire</span>
        <span>Territory</span>
        <span>Gold Earned</span>
        <span>Age Reached</span>
        <span>Date</span>
      </div>
      ${rows}
    </div>
    <button class="btn btn--sm" id="btn-clear-lb" style="margin-top:8px;color:var(--red);border-color:var(--red)">
      🗑️ Clear Scores
    </button>
  </div>`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
