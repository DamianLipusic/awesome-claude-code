/**
 * EmpireOS — Settings panel UI.
 *
 * Provides:
 *   - Game speed control: 0.5× / 1× / 2× / 4×
 *   - Sound toggle placeholder (disabled — no audio implemented yet)
 *   - About section
 */

import { setTickSpeed, getTickSpeed } from '../core/tick.js';

const PANEL_ID = 'panel-settings';

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
      _render(panel);   // re-render to update active highlight
    });
  });
}
