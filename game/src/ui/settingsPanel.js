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
import { ACHIEVEMENTS, loadAchievements, setAchievementRenderer } from '../systems/achievements.js';
import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { loadLegacy, buyLegacyTrait, LEGACY_TRAITS, LEGACY_TRAIT_ORDER } from '../data/legacyTraits.js'; // T124

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
  // Let the achievements system trigger a re-render when an achievement unlocks
  setAchievementRenderer(() => _render(panel));
  _render(panel);
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function _render(panel) {
  const current = getTickSpeed();

  panel.innerHTML = `
    ${_difficultySection()}

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

    ${_achievementsSection()}

    ${_leaderboardSection()}

    ${_legacySection()}

    ${_shortcutsSection()}

    ${_alertsSection()}

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

  // Bind difficulty buttons
  panel.querySelectorAll('.btn--difficulty').forEach(btn => {
    btn.addEventListener('click', () => {
      state.difficulty = btn.dataset.difficulty;
      emit(Events.DIFFICULTY_CHANGED, { difficulty: state.difficulty });
      _render(panel);
    });
  });

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

  // Bind alert threshold inputs — save directly into state.alerts on change
  panel.querySelectorAll('.alert-input').forEach(input => {
    input.addEventListener('change', () => {
      const res = input.dataset.res;
      if (!state.alerts) state.alerts = {};
      const v = parseFloat(input.value);
      if (input.value.trim() === '' || isNaN(v) || v < 0) {
        delete state.alerts[res];
      } else {
        state.alerts[res] = Math.floor(v);
      }
    });
  });

  // T124: Bind legacy trait buy buttons
  panel.querySelectorAll('.btn--legacy-buy').forEach(btn => {
    btn.addEventListener('click', () => {
      const traitId = btn.dataset.legacyTrait;
      const result  = buyLegacyTrait(traitId);
      if (result.ok) {
        _render(panel);
      } else {
        btn.classList.add('btn--shake');
        btn.title = result.reason;
        setTimeout(() => btn.classList.remove('btn--shake'), 500);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Difficulty section
// ---------------------------------------------------------------------------

const DIFFICULTIES = [
  {
    value: 'easy',
    label: '🌿 Easy',
    desc: '+50% starting resources. Raids and disasters are 40% weaker. Enemies expand 50% slower.',
  },
  {
    value: 'normal',
    label: '⚔️ Normal',
    desc: 'Standard balance. The intended experience.',
  },
  {
    value: 'hard',
    label: '💀 Hard',
    desc: '-25% starting resources. Raids and disasters are 50% more severe. Enemies expand 30% faster.',
  },
];

function _difficultySection() {
  const current = state.difficulty ?? 'normal';
  const currentDef = DIFFICULTIES.find(d => d.value === current);

  const buttons = DIFFICULTIES.map(d => `
    <button
      class="btn btn--difficulty ${d.value === current ? 'btn--difficulty-active' : ''}"
      data-difficulty="${d.value}"
      title="${_escHtml(d.desc)}"
    >${d.label}</button>
  `).join('');

  return `<div class="settings-section">
    <div class="settings-section__title">🎯 Difficulty</div>
    <div class="settings-section__desc">
      ${_escHtml(currentDef?.desc ?? '')}
      Starting-resource adjustments apply at <strong>New Game</strong> only.
      AI speed and event severity change immediately.
    </div>
    <div class="difficulty-buttons">${buttons}</div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Achievements section
// ---------------------------------------------------------------------------

function _achievementsSection() {
  const saved    = loadAchievements();
  const unlocked = saved.unlocked ?? {};
  const total    = Object.keys(ACHIEVEMENTS).length;
  const count    = Object.keys(unlocked).length;

  const cards = Object.entries(ACHIEVEMENTS).map(([id, def]) => {
    const u = unlocked[id];
    if (u) {
      return `<div class="ach-card ach-card--unlocked">
        <span class="ach-icon">${def.icon}</span>
        <div class="ach-body">
          <div class="ach-title">${_escHtml(def.title)}</div>
          <div class="ach-desc">${_escHtml(def.desc)}</div>
          <div class="ach-date">Unlocked ${_escHtml(u.date)}</div>
        </div>
      </div>`;
    }
    return `<div class="ach-card ach-card--locked">
      <span class="ach-icon">🔒</span>
      <div class="ach-body">
        <div class="ach-title">${_escHtml(def.title)}</div>
        <div class="ach-desc">${_escHtml(def.desc)}</div>
        <div class="ach-locked-label">Not yet unlocked</div>
      </div>
    </div>`;
  }).join('');

  return `<div class="settings-section">
    <div class="settings-section__title">🏅 Achievements</div>
    <div class="ach-progress">${count} / ${total} unlocked</div>
    <div class="ach-grid">${cards}</div>
  </div>`;
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
    const ageName  = AGE_NAMES[s.age] ?? 'Stone';
    const gold     = Math.round(s.goldEarned).toLocaleString();
    const scoreStr = s.score != null ? Number(s.score).toLocaleString() : '—';
    return `<div class="lb-row ${i === 0 ? 'lb-row--gold' : ''}">
      <span class="lb-rank">#${i + 1}</span>
      <span class="lb-name">${_escHtml(s.name)}</span>
      <span class="lb-score">⭐ ${scoreStr}</span>
      <span class="lb-territory">🗺️ ${s.territory}</span>
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
        <span>Score</span>
        <span>Territory</span>
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
// Resource alerts section (T044)
// ---------------------------------------------------------------------------

const _ALERT_RESOURCES = [
  { id: 'gold',  icon: '💰', label: 'Gold'  },
  { id: 'food',  icon: '🍞', label: 'Food'  },
  { id: 'wood',  icon: '🪵', label: 'Wood'  },
  { id: 'stone', icon: '🪨', label: 'Stone' },
  { id: 'iron',  icon: '⚙️', label: 'Iron'  },
  { id: 'mana',  icon: '✨', label: 'Mana'  },
];

function _alertsSection() {
  const rows = _ALERT_RESOURCES.map(r => {
    const val    = state.alerts?.[r.id];
    const valStr = typeof val === 'number' ? val : '';
    return `<div class="alert-row">
      <span class="alert-label">${r.icon} ${_escHtml(r.label)}</span>
      <input
        type="number"
        class="alert-input"
        data-res="${r.id}"
        placeholder="off"
        min="0"
        max="9999"
        step="10"
        value="${_escHtml(String(valStr))}"
      >
    </div>`;
  }).join('');

  return `<div class="settings-section">
    <div class="settings-section__title">⚠️ Resource Alerts</div>
    <div class="settings-section__desc">
      The HUD cell for a resource will pulse red when its value drops at or
      below the threshold you set here. Leave blank to disable the alert.
      These settings persist across new games.
    </div>
    <div class="alerts-grid">${rows}</div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Keyboard shortcuts section
// ---------------------------------------------------------------------------

function _shortcutsSection() {
  const rows = [
    { keys: ['1', '–', '0'],   desc: 'Switch tabs (Empire → Settings)' },
    { keys: ['-'],              desc: 'Open Log tab' },
    { keys: ['Space', 'P'],    desc: 'Pause / Resume game' },
    { keys: ['S'],             desc: 'Quick save' },
    { keys: ['Esc'],           desc: 'Close save/export modal' },
  ].map(({ keys, desc }) => {
    const kbds = keys.map(k => `<kbd>${k}</kbd>`).join(' ');
    return `<div class="kbd-row"><span class="kbd-keys">${kbds}</span><span>${_escHtml(desc)}</span></div>`;
  }).join('');

  return `<div class="settings-section">
    <div class="settings-section__title">⌨️ Keyboard Shortcuts</div>
    <div class="settings-section__desc">
      Active when not typing in an input field. Tab keys match the tab bar order.
    </div>
    <div class="kbd-grid">${rows}</div>
  </div>`;
}

// ---------------------------------------------------------------------------
// T124: Legacy Traits section
// ---------------------------------------------------------------------------

function _legacySection() {
  const legacy = loadLegacy();
  const { points, owned } = legacy;

  const cards = LEGACY_TRAIT_ORDER.map(id => {
    const def    = LEGACY_TRAITS[id];
    const isOwned = owned.includes(id);
    const canAfford = points >= def.cost;

    if (isOwned) {
      return `<div class="legacy-card legacy-card--owned">
        <div class="legacy-card__header">
          <span class="legacy-card__icon">${def.icon}</span>
          <span class="legacy-card__name">${_escHtml(def.name)}</span>
          <span class="legacy-owned-badge">✓ Owned</span>
        </div>
        <div class="legacy-card__desc">${_escHtml(def.desc)}</div>
      </div>`;
    }

    return `<div class="legacy-card legacy-card--locked">
      <div class="legacy-card__header">
        <span class="legacy-card__icon">${def.icon}</span>
        <span class="legacy-card__name">${_escHtml(def.name)}</span>
      </div>
      <div class="legacy-card__desc">${_escHtml(def.desc)}</div>
      <div class="legacy-card__cost ${canAfford ? '' : 'legacy-card__cost--cant'}">
        ✨ ${def.cost} legacy pts
      </div>
      <button
        class="btn btn--legacy-buy"
        data-legacy-trait="${id}"
        ${canAfford ? '' : 'disabled'}
        title="${canAfford ? `Buy for ${def.cost} pts` : `Need ${def.cost} pts (have ${points})`}"
      >Buy Trait</button>
    </div>`;
  }).join('');

  return `<div class="settings-section legacy-section">
    <div class="settings-section__title">✨ Empire Legacy</div>
    <div class="settings-section__desc">
      Earn legacy points at the end of each game (1 point per 100 score).
      Spend them on permanent starting bonuses that apply to every new game — your dynasty's lasting gifts.
    </div>
    <div class="legacy-points-bar">
      <span class="legacy-points-icon">✨</span>
      <div>
        <div class="legacy-points-label">Available Legacy Points</div>
        <div class="legacy-points-value">${points}</div>
      </div>
    </div>
    <div class="legacy-grid">${cards}</div>
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
