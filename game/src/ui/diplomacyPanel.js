/**
 * EmpireOS — Diplomacy panel UI.
 *
 * Shows three AI empire cards with current relation status, trade route
 * controls, and action buttons (Ally, Trade Route, Declare War, Peace).
 * Re-renders on DIPLOMACY_CHANGED and throttled RESOURCE_CHANGED events.
 */

import { state } from '../core/state.js';
import { on, Events } from '../core/events.js';
import { EMPIRES } from '../data/empires.js';
import {
  proposeAlliance, openTradeRoute, closeTradeRoute,
  declareWar, proposePeace, demandSurrender,
  ALLIANCE_COST, TRADE_ROUTE_COST, PEACE_COST, MAX_TRADE_ROUTES,
  SURRENDER_COST, WAR_SCORE_THRESHOLD,
} from '../systems/diplomacy.js';
import { fmtNum } from '../utils/fmt.js';

const PANEL_ID = 'panel-diplomacy';

const RES_ICONS = {
  gold: '💰', food: '🍞', wood: '🪵', stone: '🪨', iron: '⚙️', mana: '✨',
};

export function initDiplomacyPanel() {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;

  // Bind click handler once — survives innerHTML replacement
  panel.addEventListener('click', _onClick);

  _render(panel);
  on(Events.DIPLOMACY_CHANGED, () => _render(panel));
  on(Events.RESOURCE_CHANGED,  _throttle(() => _render(panel), 8));
}

// ── Render ──────────────────────────────────────────────────────────────────

function _render(panel) {
  if (!state.diplomacy) {
    panel.innerHTML = '<div class="dipl-empty">Diplomacy not yet initialised.</div>';
    return;
  }

  const cards = state.diplomacy.empires.map(_empireCard).join('');

  panel.innerHTML = `
    <div class="dipl-header">
      <div class="dipl-header__title">🤝 Diplomacy</div>
      <div class="dipl-header__sub">
        Ally with neighbouring empires to unlock trade routes and shared resources.
        War empires will raid your stores periodically.
      </div>
    </div>
    <div class="dipl-empire-list">${cards}</div>
    ${_historySection()}
  `;
}

// ── T054: Diplomatic history section ────────────────────────────────────────

const HIST_ICON = {
  alliance: '🤝',
  trade:    '🛤️',
  war:      '⚔️',
  peace:    '🕊️',
  raid:     '💥',
  ai:       '📜',
};

function _historySection() {
  const hist = state.diplomacy?.history;
  if (!hist || hist.length === 0) return '';

  const entries = hist.slice(0, 15).map(entry => {
    const icon    = HIST_ICON[entry.type] ?? '📜';
    const empDef  = entry.empireId ? EMPIRES[entry.empireId] : null;
    const empIcon = empDef ? `${empDef.icon} ` : '';
    const timeStr = _relativeTime(entry.tick);
    const typeMod = `dipl-hist-entry--${entry.type}`;
    return `
      <div class="dipl-hist-entry ${typeMod}">
        <span class="dipl-hist-icon">${icon}</span>
        <span class="dipl-hist-body">
          <span class="dipl-hist-text">${empIcon}${entry.text}</span>
          <span class="dipl-hist-time">${timeStr}</span>
        </span>
      </div>`;
  }).join('');

  return `
    <div class="dipl-history">
      <div class="dipl-history__header">📜 Diplomatic History</div>
      ${entries}
    </div>`;
}

/** Convert a game tick to a relative time string (e.g. "2m ago", "30s ago"). */
function _relativeTime(tick) {
  const elapsed = Math.max(0, state.tick - tick);
  const secs    = Math.round(elapsed / 4);  // 4 ticks per second
  if (secs < 60)  return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60)  return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

function _empireCard(emp) {
  const def      = EMPIRES[emp.id];
  const rel      = emp.relations;
  const relLabel = { neutral: 'Neutral', allied: 'Allied ✓', war: 'At War ⚔️' }[rel];
  const relClass = { neutral: 'dipl-badge--neutral', allied: 'dipl-badge--allied', war: 'dipl-badge--war' }[rel];
  const cardMod  = rel === 'allied' ? 'dipl-empire-card--allied' : rel === 'war' ? 'dipl-empire-card--war' : '';
  const gold     = state.resources?.gold ?? 0;

  // Trade route row (only when allied)
  const tradeHtml = rel === 'allied' ? `
    <div class="dipl-trade">
      <span class="dipl-trade__label">Trade Routes: ${emp.tradeRoutes}/${MAX_TRADE_ROUTES}</span>
      <span class="dipl-trade__income">${_tradeIncomeStr(def, emp.tradeRoutes)}</span>
    </div>` : '';

  // Action buttons
  const btns = [];

  if (rel === 'neutral') {
    const canAlly = gold >= ALLIANCE_COST;
    btns.push(`<button
      class="btn btn--ally ${canAlly ? '' : 'btn--disabled'}"
      data-action="ally" data-empire="${emp.id}"
      ${canAlly ? '' : 'disabled'}
      title="Forge an alliance — costs ${ALLIANCE_COST} gold">
      🤝 Ally (${fmtNum(ALLIANCE_COST)}💰)
    </button>`);
    btns.push(`<button
      class="btn btn--war-btn"
      data-action="war" data-empire="${emp.id}"
      title="Declare war on this empire">
      ⚔️ Declare War
    </button>`);
  }

  if (rel === 'allied') {
    const canOpen  = gold >= TRADE_ROUTE_COST && emp.tradeRoutes < MAX_TRADE_ROUTES;
    const canClose = emp.tradeRoutes > 0;
    btns.push(`<button
      class="btn btn--trade-open ${canOpen ? '' : 'btn--disabled'}"
      data-action="openTrade" data-empire="${emp.id}"
      ${canOpen ? '' : 'disabled'}
      title="Open a trade route — costs ${TRADE_ROUTE_COST} gold${emp.tradeRoutes >= MAX_TRADE_ROUTES ? ' (max reached)' : ''}">
      🛤️ Trade Route (${fmtNum(TRADE_ROUTE_COST)}💰)
    </button>`);
    if (canClose) {
      btns.push(`<button
        class="btn btn--trade-close"
        data-action="closeTrade" data-empire="${emp.id}"
        title="Close one trade route">
        ❌ Close Route
      </button>`);
    }
    btns.push(`<button
      class="btn btn--war-btn"
      data-action="war" data-empire="${emp.id}"
      title="Declare war — cancels all trade routes">
      ⚔️ Declare War
    </button>`);
  }

  if (rel === 'war') {
    const canPeace = gold >= PEACE_COST;
    btns.push(`<button
      class="btn btn--peace ${canPeace ? '' : 'btn--disabled'}"
      data-action="peace" data-empire="${emp.id}"
      ${canPeace ? '' : 'disabled'}
      title="Propose peace — costs ${PEACE_COST} gold">
      🕊️ Propose Peace (${fmtNum(PEACE_COST)}💰)
    </button>`);
    // T058: Demand Surrender when enough war score accumulated
    const ws = emp.warScore ?? 0;
    if (ws >= WAR_SCORE_THRESHOLD) {
      const canSurrender = gold >= SURRENDER_COST;
      btns.push(`<button
        class="btn btn--surrender ${canSurrender ? '' : 'btn--disabled'}"
        data-action="surrender" data-empire="${emp.id}"
        ${canSurrender ? '' : 'disabled'}
        title="Demand surrender — requires ${WAR_SCORE_THRESHOLD} war score &amp; ${SURRENDER_COST} gold">
        🏳️ Demand Surrender (${fmtNum(SURRENDER_COST)}💰)
      </button>`);
    }
  }

  // T058: War score progress bar (shown only when at war)
  const warScoreHtml = rel === 'war' ? (() => {
    const ws    = emp.warScore ?? 0;
    const pct   = Math.min(100, Math.round(ws / WAR_SCORE_THRESHOLD * 100));
    const ready = ws >= WAR_SCORE_THRESHOLD;
    return `
      <div class="dipl-war-score">
        <span class="dipl-ws-label">
          ⚔️ War Score: ${ws} / ${WAR_SCORE_THRESHOLD}
          ${ready ? ' <strong style="color:#f6ad55">— Surrender available!</strong>' : ''}
        </span>
        <div class="dipl-ws-bar-wrap" title="Capture enemy faction tiles to increase war score">
          <div class="dipl-ws-bar" style="width:${pct}%"></div>
        </div>
      </div>`;
  })() : '';

  return `
    <div class="dipl-empire-card ${cardMod}">
      <div class="dipl-empire-card__header">
        <span class="dipl-empire-card__icon">${def.icon}</span>
        <span class="dipl-empire-card__name">${def.name}</span>
        <span class="dipl-badge ${relClass}">${relLabel}</span>
      </div>
      <div class="dipl-empire-card__desc">${def.desc}</div>
      <div class="dipl-empire-card__specialty">
        Specialty: ${def.specialty.map(r => `${RES_ICONS[r] ?? ''}${r}`).join(', ')}
      </div>
      ${tradeHtml}
      ${warScoreHtml}
      <div class="dipl-empire-card__actions">${btns.join('')}</div>
    </div>
  `;
}

function _tradeIncomeStr(def, count) {
  if (count <= 0) return '<em style="color:var(--text-dim)">No active trade routes</em>';
  const parts = Object.entries(def.tradeGift)
    .map(([r, rate]) => `${RES_ICONS[r] ?? ''}+${(rate * count).toFixed(1)}/s`);
  return parts.join(' ');
}

// ── Click delegation ─────────────────────────────────────────────────────────

function _onClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn || btn.disabled) return;

  const { action, empire } = btn.dataset;
  let result;

  switch (action) {
    case 'ally':
      result = proposeAlliance(empire);
      if (!result.ok) addMessageFallback(result.reason);
      break;
    case 'openTrade':
      result = openTradeRoute(empire);
      if (!result.ok) addMessageFallback(result.reason);
      break;
    case 'closeTrade':
      closeTradeRoute(empire);
      break;
    case 'war': {
      const empName = EMPIRES[empire]?.name ?? empire;
      if (confirm(`Declare war on ${empName}? All trade routes will be cancelled.`)) {
        declareWar(empire);
      }
      break;
    }
    case 'peace':
      result = proposePeace(empire);
      if (!result.ok) addMessageFallback(result.reason);
      break;
    case 'surrender':
      result = demandSurrender(empire);
      if (!result.ok) addMessageFallback(result.reason);
      break;
  }
}

// Fallback: import addMessage lazily to avoid circular dep at module load time
function addMessageFallback(msg) {
  import('../core/actions.js').then(m => m.addMessage(msg, 'info'));
}

function _throttle(fn, ticks) {
  let last = 0;
  return () => {
    if (state.tick - last >= ticks) { last = state.tick; fn(); }
  };
}
