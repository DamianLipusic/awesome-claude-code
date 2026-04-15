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
  payTribute, demandTribute, sendGift,
  ALLIANCE_COST, TRADE_ROUTE_COST, PEACE_COST, MAX_TRADE_ROUTES,
  SURRENDER_COST, WAR_SCORE_THRESHOLD,
  TRIBUTE_COST, TRIBUTE_DEMAND, DEMAND_WARSCORE_MIN,
  GIFT_SMALL_COST, GIFT_LARGE_COST, GIFT_SMALL_ALLY_CHANCE, GIFT_LARGE_ALLY_CHANCE,
  isSkirmishActive, getSkirmish, skirmishSecsLeft, mediateSkirmish,
  MEDIATE_MIN_ALLIANCES, MEDIATE_GOLD_REWARD, MEDIATE_PRESTIGE,
} from '../systems/diplomacy.js';
import {
  launchMission, canLaunchMission, espionageCooldownSecs,
  MISSION_LABELS, MISSION_DESCS,
} from '../systems/espionage.js';
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
  on(Events.ALLIANCE_GIFT,     () => _render(panel));  // T076
  on(Events.BORDER_SKIRMISH,   () => _render(panel));  // T088
  on(Events.RESOURCE_CHANGED,  _throttle(() => _render(panel), 8));
  on(Events.TECH_CHANGED,      () => _render(panel));
  on(Events.ESPIONAGE_EVENT,   () => _render(panel));
  // Refresh cooldown countdown every second; also refresh ceasefire/gift/skirmish timers when active
  on(Events.TICK, _throttle(() => {
    const cd = document.getElementById('espionage-cooldown');
    if (cd) _updateCooldownDisplay(cd);
    const hasCeasefire    = state.diplomacy?.empires.some(e => (e.ceasefireTick ?? 0) > state.tick);
    // T076: refresh when allied empires exist (gift countdown ticks down)
    const hasAllied       = state.diplomacy?.empires.some(e => e.relations === 'allied');
    // T081: refresh while any per-empire gift cooldown is active
    const hasGiftCooldown = state.diplomacy?.empires.some(e => (e.playerGiftCooldownUntil ?? 0) > state.tick);
    // T088: refresh while skirmish is active (countdown ticks)
    const hasSkirmish     = isSkirmishActive();
    if (hasCeasefire || hasAllied || hasGiftCooldown || hasSkirmish) {
      _render(panel);
    }
  }, 4));
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
    ${_skirmishBanner()}
    <div class="dipl-empire-list">${cards}</div>
    ${_espionageSection()}
    ${_historySection()}
  `;
}

// ── T088: Border Skirmish banner ────────────────────────────────────────────

function _skirmishBanner() {
  const sk = getSkirmish();
  if (!sk) return '';

  const def1 = EMPIRES[sk.empire1Id];
  const def2 = EMPIRES[sk.empire2Id];
  const secs  = skirmishSecsLeft();
  const mins  = Math.floor(secs / 60);
  const s     = secs % 60;
  const timeStr = mins > 0 ? `${mins}m ${String(s).padStart(2,'0')}s` : `${secs}s`;

  const alliedCount    = state.diplomacy.empires.filter(e => e.relations === 'allied').length;
  const canMediate     = alliedCount >= MEDIATE_MIN_ALLIANCES;
  const alreadyMed    = !!sk.mediatedBy;

  let mediateBtn = '';
  if (!alreadyMed) {
    mediateBtn = `
      <button
        class="btn btn--sm btn--mediate ${canMediate ? '' : 'btn--disabled'}"
        data-action="mediateSkirmish"
        ${canMediate ? '' : 'disabled'}
        title="${canMediate
          ? `Mediate the skirmish — earn ${MEDIATE_GOLD_REWARD} gold + ${MEDIATE_PRESTIGE} prestige`
          : `Need ${MEDIATE_MIN_ALLIANCES} allied empires to mediate`}">
        🕊️ Mediate${canMediate ? ` (+${MEDIATE_GOLD_REWARD}💰)` : ' (need 2 allies)'}
      </button>`;
  } else {
    mediateBtn = `<span class="skirmish-mediated">🕊️ Mediating…</span>`;
  }

  return `
    <div class="skirmish-banner">
      <div class="skirmish-banner__header">
        <span class="skirmish-banner__icon">⚔️</span>
        <span class="skirmish-banner__title">Border Skirmish Active!</span>
        <span class="skirmish-banner__timer">Ends in ${timeStr}</span>
      </div>
      <div class="skirmish-banner__desc">
        ${def1.icon} ${def1.name} and ${def2.icon} ${def2.name} clash at the frontier.
        Both empires are <strong>distracted</strong> — your attacks on them have +${Math.round(0.20*100)}% win chance.
      </div>
      <div class="skirmish-banner__actions">${mediateBtn}</div>
    </div>`;
}

// ── T060: Espionage section ────────────────────────────────────────────────

function _espionageSection() {
  if (!state.techs?.espionage) {
    return `
      <div class="dipl-espionage dipl-espionage--locked">
        <div class="dipl-esp-header">🕵️ Espionage</div>
        <div class="dipl-esp-locked-msg">
          Research <strong>Espionage</strong> in the Research tab to unlock spy missions.
        </div>
      </div>`;
  }

  const coolSecs = espionageCooldownSecs();
  const cdText   = coolSecs > 0
    ? `⏳ Cooldown: ${coolSecs}s`
    : '✅ Spy network ready';
  const ready = coolSecs === 0;

  // Mission buttons (each target all 3 empires)
  const missionRows = Object.entries(MISSION_LABELS).map(([mId, label]) => {
    const { ok } = ready ? canLaunchMission(mId) : { ok: false };
    const empireBtns = (state.diplomacy?.empires ?? []).map(emp => {
      const empDef = EMPIRES[emp.id];
      const disabled = !ok ? 'disabled' : '';
      const relIcon = { neutral: '🤝', allied: '🟢', war: '⚔️' }[emp.relations] ?? '';
      return `<button
        class="btn btn--sm btn--spy ${ok ? '' : 'btn--disabled'}"
        data-action="spy" data-mission="${mId}" data-empire="${emp.id}"
        ${disabled}
        title="${MISSION_DESCS[mId]}">
        ${relIcon} ${empDef.name}
      </button>`;
    }).join('');

    return `
      <div class="dipl-esp-mission">
        <span class="dipl-esp-mission__label">${label}</span>
        <span class="dipl-esp-mission__targets">${empireBtns}</span>
      </div>`;
  }).join('');

  // Log entries
  const logEntries = (state.espionage?.log ?? []).slice(0, 8).map(entry => {
    const cls = entry.success ? 'dipl-esp-log--success' : 'dipl-esp-log--fail';
    const timeStr = _relativeTime(entry.tick);
    return `<div class="dipl-esp-log-entry ${cls}">
      <span class="dipl-esp-log-text">${entry.text}</span>
      <span class="dipl-esp-log-time">${timeStr}</span>
    </div>`;
  }).join('') || '<div class="dipl-esp-log-empty">No missions launched yet.</div>';

  return `
    <div class="dipl-espionage">
      <div class="dipl-esp-header">🕵️ Espionage</div>
      <div class="dipl-esp-status" id="espionage-cooldown">${cdText}</div>
      <div class="dipl-esp-missions">${missionRows}</div>
      <div class="dipl-esp-log-header">Mission Log</div>
      <div class="dipl-esp-log">${logEntries}</div>
    </div>`;
}

function _updateCooldownDisplay(el) {
  if (!el) return;
  const coolSecs = espionageCooldownSecs();
  el.textContent = coolSecs > 0 ? `⏳ Cooldown: ${coolSecs}s` : '✅ Spy network ready';
}

// ── T054: Diplomatic history section ────────────────────────────────────────

const HIST_ICON = {
  alliance: '🤝',
  trade:    '🛤️',
  war:      '⚔️',
  peace:    '🕊️',
  raid:     '💥',
  ai:       '📜',
  gift:     '🎁',
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
    </div>
    ${_giftTimingHtml(emp)}` : '';

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
    // T067: Tribute buttons (ceasefire payment / demand)
    const cfTick = emp.ceasefireTick ?? 0;
    const cfActive = cfTick > state.tick;
    if (cfActive) {
      const secsLeft = Math.ceil((cfTick - state.tick) / 4);
      btns.push(`<div class="dipl-ceasefire-badge">⏳ Ceasefire: ${secsLeft}s</div>`);
    } else {
      const canPayTribute = gold >= TRIBUTE_COST;
      btns.push(`<button
        class="btn btn--pay-tribute ${canPayTribute ? '' : 'btn--disabled'}"
        data-action="payTribute" data-empire="${emp.id}"
        ${canPayTribute ? '' : 'disabled'}
        title="Pay tribute for a 30-second ceasefire — costs ${TRIBUTE_COST} gold">
        🏳️ Pay Tribute (${fmtNum(TRIBUTE_COST)}💰)
      </button>`);
      if (ws >= DEMAND_WARSCORE_MIN) {
        btns.push(`<button
          class="btn btn--demand-tribute"
          data-action="demandTribute" data-empire="${emp.id}"
          title="Demand tribute — receive +${TRIBUTE_DEMAND} gold (requires ${DEMAND_WARSCORE_MIN} war score)">
          💰 Demand Tribute (+${TRIBUTE_DEMAND}💰)
        </button>`);
      }
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

  // T088: skirmish indicator badge on empire card
  const sk = getSkirmish();
  const inSkirmish = sk && (sk.empire1Id === emp.id || sk.empire2Id === emp.id);
  const skirmishBadge = inSkirmish
    ? `<span class="dipl-badge dipl-badge--skirmish" title="This empire is engaged in a border skirmish — you have +20% attack chance against them">⚔️ Skirmishing</span>`
    : '';

  return `
    <div class="dipl-empire-card ${cardMod}">
      <div class="dipl-empire-card__header">
        <span class="dipl-empire-card__icon">${def.icon}</span>
        <span class="dipl-empire-card__name">${def.name}</span>
        <span class="dipl-badge ${relClass}">${relLabel}</span>
        ${skirmishBadge}
      </div>
      <div class="dipl-empire-card__desc">${def.desc}</div>
      <div class="dipl-empire-card__specialty">
        Specialty: ${def.specialty.map(r => `${RES_ICONS[r] ?? ''}${r}`).join(', ')}
      </div>
      ${tradeHtml}
      ${warScoreHtml}
      ${_giftRow(emp)}
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

/**
 * T076: Show when the next alliance gift will arrive for an allied empire.
 */
function _giftTimingHtml(emp) {
  const nextTick = emp.nextGiftTick ?? 0;
  const ticksLeft = nextTick - state.tick;
  if (ticksLeft <= 0) {
    return `<div class="dipl-alliance-gift">
      🎁 <span class="dipl-alliance-gift__ready">Gift arriving soon…</span>
    </div>`;
  }
  const secsLeft = Math.ceil(ticksLeft / 4);
  const minsLeft = Math.floor(secsLeft / 60);
  const sRem     = secsLeft % 60;
  const timeStr  = minsLeft > 0
    ? `${minsLeft}m ${String(sRem).padStart(2,'0')}s`
    : `${secsLeft}s`;
  return `<div class="dipl-alliance-gift">
    🎁 Next gift in <strong>${timeStr}</strong>
  </div>`;
}

// ── T081: Player gift row ────────────────────────────────────────────────────

/**
 * Renders a "Send Gift" row for neutral and allied empire cards.
 * Hidden for war-relation empires (gifts are rejected while at war).
 */
function _giftRow(emp) {
  if (emp.relations === 'war') return '';

  const gold      = state.resources?.gold ?? 0;
  const cdUntil   = emp.playerGiftCooldownUntil ?? 0;
  const onCd      = cdUntil > state.tick;
  const secsLeft  = onCd ? Math.ceil((cdUntil - state.tick) / 4) : 0;

  if (onCd) {
    return `
      <div class="dipl-gift-row">
        <span class="dipl-gift-label">🎁 Gift cooldown:</span>
        <span class="dipl-gift-cd">⏳ ${secsLeft}s</span>
      </div>`;
  }

  const smallOk  = gold >= GIFT_SMALL_COST;
  const largeOk  = gold >= GIFT_LARGE_COST;
  const smallHint = emp.relations === 'neutral'
    ? `Small gift (${GIFT_SMALL_COST}💰) — ${Math.round(GIFT_SMALL_ALLY_CHANCE * 100)}% alliance chance`
    : `Small goodwill gift (${GIFT_SMALL_COST}💰)`;
  const largeHint = emp.relations === 'neutral'
    ? `Large gift (${GIFT_LARGE_COST}💰) — ${Math.round(GIFT_LARGE_ALLY_CHANCE * 100)}% alliance chance`
    : `Large goodwill gift (${GIFT_LARGE_COST}💰)`;

  return `
    <div class="dipl-gift-row">
      <span class="dipl-gift-label">🎁 Send Gift:</span>
      <button
        class="btn btn--sm btn--gift ${smallOk ? '' : 'btn--disabled'}"
        data-action="sendGift" data-empire="${emp.id}" data-gift-size="small"
        ${smallOk ? '' : 'disabled'}
        title="${smallHint}">
        Small (${fmtNum(GIFT_SMALL_COST)}💰)
      </button>
      <button
        class="btn btn--sm btn--gift ${largeOk ? '' : 'btn--disabled'}"
        data-action="sendGift" data-empire="${emp.id}" data-gift-size="large"
        ${largeOk ? '' : 'disabled'}
        title="${largeHint}">
        Large (${fmtNum(GIFT_LARGE_COST)}💰)
      </button>
    </div>`;
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
    case 'payTribute':
      result = payTribute(empire);
      if (!result.ok) addMessageFallback(result.reason);
      break;
    case 'demandTribute':
      result = demandTribute(empire);
      if (!result.ok) addMessageFallback(result.reason);
      break;
    case 'spy': {
      const missionId = btn.dataset.mission;
      result = launchMission(missionId, empire);
      if (!result.ok) addMessageFallback(result.reason);
      break;
    }
    case 'sendGift': {
      const giftSize = btn.dataset.giftSize ?? 'small';
      result = sendGift(empire, giftSize);
      if (!result.ok) addMessageFallback(result.reason);
      break;
    }
    case 'mediateSkirmish': {
      result = mediateSkirmish();
      if (!result.ok) addMessageFallback(result.reason);
      break;
    }
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
