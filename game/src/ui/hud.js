/**
 * EmpireOS — Resource HUD (top bar).
 * Re-renders on RESOURCE_CHANGED and TICK events.
 */

import { state } from '../core/state.js';
import { on, Events } from '../core/events.js';
import { fmtNum, fmtRate } from '../utils/fmt.js';

const RESOURCES = [
  { id: 'gold',  label: 'Gold',  icon: '💰' },
  { id: 'food',  label: 'Food',  icon: '🍞' },
  { id: 'wood',  label: 'Wood',  icon: '🪵' },
  { id: 'stone', label: 'Stone', icon: '🪨' },
  { id: 'iron',  label: 'Iron',  icon: '⚙️' },
  { id: 'mana',  label: 'Mana',  icon: '✨' },
];

// Minimum change to trigger a flash (filters out normal per-tick increments)
const FLASH_THRESHOLD = 40;
// Snapshot of resource values from last render (for delta detection)
const _prevValues = {};

export function initHUD() {
  const container = document.getElementById('hud');
  if (!container) return;

  container.innerHTML = RESOURCES.map(r => `
    <div class="hud__resource" id="hud-${r.id}" title="${r.label}">
      <span class="hud__icon">${r.icon}</span>
      <span class="hud__value" id="hud-val-${r.id}">0</span>
      <span class="hud__rate"  id="hud-rate-${r.id}">+0/s</span>
    </div>
  `).join('');

  on(Events.RESOURCE_CHANGED, renderHUD);
  on(Events.TICK, _throttledRender());
  renderHUD();
}

function renderHUD() {
  for (const r of RESOURCES) {
    const valEl  = document.getElementById(`hud-val-${r.id}`);
    const rateEl = document.getElementById(`hud-rate-${r.id}`);
    if (!valEl || !rateEl) continue;

    const val  = state.resources[r.id] ?? 0;
    const cap  = state.caps[r.id] ?? 500;
    const rate = state.rates[r.id] ?? 0;

    // Flash on significant change (skip tiny per-tick increments)
    const prev  = _prevValues[r.id] ?? val;
    const delta = val - prev;
    _prevValues[r.id] = val;

    if (delta > FLASH_THRESHOLD) {
      _flashEl(valEl, 'hud__value--gain');
    } else if (delta < -FLASH_THRESHOLD) {
      _flashEl(valEl, 'hud__value--loss');
    }

    valEl.textContent  = `${fmtNum(val)}/${fmtNum(cap)}`;
    rateEl.textContent = fmtRate(rate);
    rateEl.className   = `hud__rate ${rate >= 0 ? 'hud__rate--pos' : 'hud__rate--neg'}`;
  }
}

function _flashEl(el, cls) {
  el.classList.remove('hud__value--gain', 'hud__value--loss');
  void el.offsetWidth; // force reflow so animation restarts
  el.classList.add(cls);
  el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
}

// Throttle HUD re-render to every 4 ticks (1s) to avoid flicker
function _throttledRender() {
  let last = 0;
  return () => {
    if (state.tick - last >= 4) {
      last = state.tick;
      renderHUD();
    }
  };
}
