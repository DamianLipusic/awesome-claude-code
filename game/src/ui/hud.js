/**
 * EmpireOS — Resource HUD (top bar).
 * Re-renders on RESOURCE_CHANGED and TICK events.
 * Shows inline SVG sparklines (60-second rolling history) per resource.
 */

import { state } from '../core/state.js';
import { on, Events } from '../core/events.js';
import { fmtNum, fmtRate } from '../utils/fmt.js';
import { getBreakdown } from '../systems/resources.js';
import { getPopulation, getPopCap } from '../systems/population.js';

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

// ── Sparkline ring buffer ─────────────────────────────────────────────────
// Sampled once per second (every 4 ticks). Keeps 60 entries = 60s of history.
const HISTORY_LEN = 60;
const SPARK_W = 60;
const SPARK_H = 18;
const _history = {};
for (const r of RESOURCES) _history[r.id] = [];

function _sampleHistory() {
  for (const r of RESOURCES) {
    const val  = state.resources[r.id] ?? 0;
    const hist = _history[r.id];
    hist.push(val);
    if (hist.length > HISTORY_LEN) hist.shift();
  }
}

/**
 * Build an inline SVG sparkline from an array of numeric samples.
 * Returns empty string if fewer than 2 samples exist.
 */
function _sparkSVG(values, positiveRate) {
  if (values.length < 2) return '';
  const min   = Math.min(...values);
  const max   = Math.max(...values);
  const range = max - min;

  // Flat line when value hasn't changed
  if (range === 0) {
    return `<svg class="hud__spark" viewBox="0 0 ${SPARK_W} ${SPARK_H}" width="${SPARK_W}" height="${SPARK_H}" aria-hidden="true">
      <line x1="1" y1="${SPARK_H / 2}" x2="${SPARK_W - 1}" y2="${SPARK_H / 2}" stroke="var(--border)" stroke-width="1"/>
    </svg>`;
  }

  const pts = values.map((v, i) => {
    const x = ((i / (values.length - 1)) * (SPARK_W - 2) + 1).toFixed(1);
    const y = ((1 - (v - min) / range) * (SPARK_H - 2) + 1).toFixed(1);
    return `${x},${y}`;
  }).join(' ');

  const color = positiveRate ? 'var(--green)' : 'var(--red)';
  return `<svg class="hud__spark" viewBox="0 0 ${SPARK_W} ${SPARK_H}" width="${SPARK_W}" height="${SPARK_H}" aria-hidden="true">
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

// ── Tooltip ───────────────────────────────────────────────────────────────

let _tooltipEl = null;

function _createTooltip() {
  const el = document.createElement('div');
  el.id        = 'hud-tooltip';
  el.className = 'hud-tooltip hud-tooltip--hidden';
  document.body.appendChild(el);
  return el;
}

function _showTooltip(resId, anchorEl) {
  if (!_tooltipEl) _tooltipEl = _createTooltip();
  const breakdown = getBreakdown(resId);
  const res = RESOURCES.find(r => r.id === resId);

  // Build HTML rows
  const fmtVal = v => {
    const sign = v >= 0 ? '+' : '';
    return `<span class="hud-tt__val ${v >= 0 ? 'hud-tt__val--pos' : 'hud-tt__val--neg'}">${sign}${v.toFixed(2)}/s</span>`;
  };

  const rows = breakdown.lines
    .filter(l => Math.abs(l.value) >= 0.005) // omit negligible
    .map(l => `<div class="hud-tt__row"><span class="hud-tt__label">${l.label}</span>${fmtVal(l.value)}</div>`)
    .join('');

  const seasonRow = breakdown.seasonName
    ? `<div class="hud-tt__modifier">🌀 ${breakdown.seasonName}</div>`
    : '';

  const disasterRows = breakdown.disasters
    .map(d => `<div class="hud-tt__modifier hud-tt__modifier--disaster">⚠️ ${d.label} (×${d.mult.toFixed(2)})</div>`)
    .join('');

  const policyRows = (breakdown.policyModifiers ?? [])
    .map(p => `<div class="hud-tt__modifier hud-tt__modifier--policy">📜 ${p.label}</div>`)
    .join('');

  const divider = rows ? '<div class="hud-tt__divider"></div>' : '';
  const totalSign = breakdown.total >= 0 ? '+' : '';
  const totalCls  = breakdown.total >= 0 ? 'hud-tt__val--pos' : 'hud-tt__val--neg';

  _tooltipEl.innerHTML = `
    <div class="hud-tt__header">${res?.icon ?? ''} ${res?.label ?? resId}</div>
    ${rows}
    ${seasonRow}
    ${disasterRows}
    ${policyRows}
    ${divider}
    <div class="hud-tt__row hud-tt__total">
      <span class="hud-tt__label">Net rate</span>
      <span class="hud-tt__val ${totalCls}">${totalSign}${breakdown.total.toFixed(2)}/s</span>
    </div>
  `;

  // Position below the anchor element
  const rect = anchorEl.getBoundingClientRect();
  _tooltipEl.className = 'hud-tooltip';
  // Initial off-screen render to measure width
  _tooltipEl.style.left = '-9999px';
  _tooltipEl.style.top  = '-9999px';

  requestAnimationFrame(() => {
    if (!_tooltipEl) return;
    const tw = _tooltipEl.offsetWidth;
    const vw = window.innerWidth;
    let left = rect.left + rect.width / 2 - tw / 2;
    // Clamp to viewport
    left = Math.max(4, Math.min(vw - tw - 4, left));
    _tooltipEl.style.left = `${Math.round(left)}px`;
    _tooltipEl.style.top  = `${Math.round(rect.bottom + 6)}px`;
  });
}

function _hideTooltip() {
  if (!_tooltipEl) return;
  _tooltipEl.className = 'hud-tooltip hud-tooltip--hidden';
}

// ── Init & render ─────────────────────────────────────────────────────────

export function initHUD() {
  const container = document.getElementById('hud');
  if (!container) return;

  container.innerHTML = RESOURCES.map(r => `
    <div class="hud__resource" id="hud-${r.id}">
      <span class="hud__icon">${r.icon}</span>
      <span class="hud__value" id="hud-val-${r.id}">0</span>
      <span class="hud__rate"  id="hud-rate-${r.id}">+0/s</span>
      <span class="hud__spark-wrap" id="hud-spark-${r.id}" aria-hidden="true"></span>
    </div>
  `).join('');

  // Attach hover tooltip listeners to each resource cell
  for (const r of RESOURCES) {
    const el = document.getElementById(`hud-${r.id}`);
    if (!el) continue;
    el.addEventListener('mouseenter', () => _showTooltip(r.id, el));
    el.addEventListener('mouseleave', _hideTooltip);
  }

  on(Events.RESOURCE_CHANGED, renderHUD);
  on(Events.POPULATION_CHANGED, _renderPopBadge);
  on(Events.TICK, _throttledRender());
  renderHUD();
  _renderPopBadge();
}

function renderHUD() {
  for (const r of RESOURCES) {
    const valEl   = document.getElementById(`hud-val-${r.id}`);
    const rateEl  = document.getElementById(`hud-rate-${r.id}`);
    const sparkEl = document.getElementById(`hud-spark-${r.id}`);
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

    if (sparkEl) {
      sparkEl.innerHTML = _sparkSVG(_history[r.id], rate >= 0);
    }

    // Alert threshold check — pulse red when resource drops at or below threshold
    const hudEl    = document.getElementById(`hud-${r.id}`);
    const threshold = state.alerts?.[r.id];
    if (hudEl) {
      hudEl.classList.toggle('hud__resource--alert',
        typeof threshold === 'number' && val <= threshold);
    }
  }
}

function _renderPopBadge() {
  const el = document.getElementById('population-badge');
  if (!el) return;
  const count = getPopulation();
  const cap   = getPopCap();
  el.textContent = `👥 ${count.toLocaleString()}/${cap.toLocaleString()}`;
  const pct = cap > 0 ? count / cap : 0;
  el.title = `Citizens: ${count.toLocaleString()} / ${cap.toLocaleString()} — ${Math.round(pct * 100)}% of cap. Build Houses to expand. Citizens generate gold and consume food.`;
  // Visual warning when at 90%+ of cap
  el.classList.toggle('population-badge--full', pct >= 0.9);
}

function _flashEl(el, cls) {
  el.classList.remove('hud__value--gain', 'hud__value--loss');
  void el.offsetWidth; // force reflow so animation restarts
  el.classList.add(cls);
  el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
}

/**
 * Return a live reference to the per-resource history ring buffers.
 * Each key is a resource id; each value is an array of up to HISTORY_LEN samples
 * (one per second).  Used by the summary panel trend chart.
 */
export function getResourceHistory() {
  return _history;
}

// Throttle HUD re-render to every 4 ticks (1s); also sample history at that interval
function _throttledRender() {
  let last = 0;
  return () => {
    if (state.tick - last >= 4) {
      last = state.tick;
      _sampleHistory();
      renderHUD();
    }
  };
}
