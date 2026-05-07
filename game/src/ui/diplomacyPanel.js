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
  requestAllianceFavor,
  declareEmbargo, liftEmbargo, isEmbargoed, embargoSecsLeft, embargoCooldownSecsLeft, // T159
  proposeDynasticMarriage, MARRIAGE_COST, // T172
  callDiplomaticSummit, SUMMIT_PRESTIGE_COST, SUMMIT_GOLD_COST, // T174
  setTradeSpec, TRADE_SPEC_TYPES, TRADE_SPEC_ORDER, // T185
  ALLIANCE_COST, TRADE_ROUTE_COST, PEACE_COST, MAX_TRADE_ROUTES,
  SURRENDER_COST, WAR_SCORE_THRESHOLD,
  TRIBUTE_COST, TRIBUTE_DEMAND, DEMAND_WARSCORE_MIN,
  GIFT_SMALL_COST, GIFT_LARGE_COST, GIFT_SMALL_ALLY_CHANCE, GIFT_LARGE_ALLY_CHANCE,
  isSkirmishActive, getSkirmish, skirmishSecsLeft, mediateSkirmish,
  MEDIATE_MIN_ALLIANCES, MEDIATE_GOLD_REWARD, MEDIATE_PRESTIGE,
  FAVOR_MAX, FAVOR_REQUESTS,
  EMBARGO_COST, // T159
} from '../systems/diplomacy.js';
import {
  launchMission, canLaunchMission, espionageCooldownSecs,
  MISSION_LABELS, MISSION_DESCS,
  upgradeSpyNetwork, getNetworkLevel, getNextNetworkLevel, NETWORK_LEVELS,
} from '../systems/espionage.js';
import {
  requestMilitaryAid, canRequestAid, getAidCooldownSecs, getActiveAid,
  AID_COST, AID_BATTLES,
} from '../systems/militaryAid.js';
import { missionSecsLeft, missionNextSecs } from '../systems/allianceMissions.js'; // T142
import { demandTribute as _demandTribute, getTributeStatus, hasCapturedCapital, TRIBUTE_PRESTIGE, TRIBUTE_GOLD, TRIBUTE_PAYMENTS } from '../systems/tributes.js'; // T166
import {
  startCampaign, getActiveCampaign, getCampaignSecsLeft, getCampaignCooldownSecs,
  CAMPAIGN_COST, CAMPAIGN_WIN_GOAL,
} from '../systems/campaigns.js'; // T154
import {
  dispatchEnvoy, recallEnvoy, getEnvoyInfo, isEnvoyActive,
  ENVOY_COST, ENVOY_RECALL_REFUND,
} from '../systems/envoy.js'; // T192
import {
  proposeResourcePact, cancelResourcePact, getActivePact, getResourcePactInfo,
  PACT_DEFINITIONS, PACT_SEASONS,
} from '../systems/resourcePact.js'; // T208
import {
  demandReparations, canDemandReparations, isAngryBonusActive, getAngryBonusSecs,
  REPARATIONS_PRESTIGE_COST, REPARATIONS_WAR_SCORE_MIN,
} from '../systems/warReparations.js'; // T210
import {
  getActiveCounteroffensives, getCounteroffensiveSecs,
} from '../systems/counteroffensive.js'; // T212
import { getIntelReport, getIntelNextSecs, isIntelActive } from '../systems/militaryIntel.js'; // T220
import { sendPeaceOverture, canSendOverture, hasAttemptedOverture, OVERTURE_PRESTIGE_COST } from '../systems/peaceOverture.js'; // T222
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
  on(Events.TECH_CHANGED,          () => _render(panel));
  on(Events.ESPIONAGE_EVENT,        () => _render(panel));
  on(Events.MILITARY_AID_CHANGED,   () => _render(panel));
  on(Events.ALLIANCE_FAVOR_CHANGED, () => _render(panel));  // T114
  on(Events.ALLIANCE_MISSION,       () => _render(panel));  // T142
  on(Events.CAMPAIGN_STARTED,       () => _render(panel));  // T154
  on(Events.CAMPAIGN_WON,           () => _render(panel));  // T154
  on(Events.CAMPAIGN_ENDED,         () => _render(panel));  // T154
  on(Events.EMBARGO_CHANGED,        () => _render(panel));  // T159
  on(Events.TRIBUTE_CHANGED,        () => _render(panel));  // T166
  on(Events.MARRIAGE_PROPOSED,      () => _render(panel));  // T172
  on(Events.SUMMIT_CALLED,          () => _render(panel));  // T174
  on(Events.ENVOY_DISPATCHED,       () => _render(panel));  // T192
  on(Events.ENVOY_ARRIVED,          () => _render(panel));  // T192
  on(Events.ENVOY_RECALLED,         () => _render(panel));  // T192
  on(Events.RESOURCE_PACT_CHANGED,  () => _render(panel));  // T208
  on(Events.REPARATIONS_DEMANDED,    () => _render(panel));  // T210
  on(Events.COUNTEROFFENSIVE,        () => _render(panel));  // T212
  on(Events.INTEL_REPORT,            () => _render(panel));  // T220
  on(Events.PEACE_OVERTURE_CHANGED,  () => _render(panel));  // T222
  // Refresh cooldown countdown every second; also refresh ceasefire/gift/skirmish/aid timers when active
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
    // T102: refresh while aid is active or any aid cooldown is ticking
    const hasAidActivity  = !!getActiveAid() || Object.values(state.militaryAid?.cooldowns ?? {}).some(t => t > state.tick);
    // T142: refresh while any alliance mission is active (timer countdown)
    const hasMission = state.allianceMissions && Object.values(state.allianceMissions).some(m => m?.active);
    // T154: refresh while campaign is active (win counter + timer)
    const hasCampaign = !!getActiveCampaign();
    // T159: refresh while any embargo is active (countdown ticks)
    const hasEmbargo  = state.diplomacy?.empires.some(e => (e.embargoUntil ?? 0) > state.tick);
    // T166: refresh while any tribute is being paid (countdown to next payment)
    const hasTribute  = state.tributes && Object.values(state.tributes.demanded ?? {}).some(t => t.paymentsLeft > 0);
    // T192: refresh while an envoy is travelling (progress bar updates)
    const hasEnvoy    = isEnvoyActive();
    // T210: refresh while righteous anger countdown is active
    const hasAngryBonus = isAngryBonusActive();
    if (hasCeasefire || hasAllied || hasGiftCooldown || hasSkirmish || hasAidActivity || hasMission || hasCampaign || hasEmbargo || hasTribute || hasEnvoy || hasAngryBonus) {
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
    ${_counteroffensiveBanner()}
    ${_skirmishBanner()}
    ${_angryBonusBanner()}
    ${_tradeNetworkBanner()}
    ${_summitSection()}
    <div class="dipl-empire-list">${cards}</div>
    ${_espionageSection()}
    ${_campaignSection()}
    ${_pactSection()}
    ${_historySection()}
  `;
}

// ── T210: Righteous Anger banner ────────────────────────────────────────────

// ── T212: Counteroffensive warning banner ───────────────────────────────────

function _counteroffensiveBanner() {
  const active = getActiveCounteroffensives();
  if (active.length === 0) return '';
  const items = active.map(({ factionId, expiresAt }) => {
    const def = EMPIRES[factionId] ?? null;
    const name = def ? `${def.icon} ${def.name}` : factionId;
    const secs = getCounteroffensiveSecs(factionId);
    return `<div class="dipl-coff-banner__item">
      <span class="dipl-coff-faction">${name}</span>
      — 3× expansion, +40% attack chance for ${secs}s
    </div>`;
  }).join('');
  return `
    <div class="dipl-coff-banner">
      ⚠️ <strong>Enemy Counteroffensive!</strong><br>
      ${items}
    </div>`;
}

function _angryBonusBanner() {
  if (!isAngryBonusActive()) return '';
  const secs = getAngryBonusSecs();
  return `
    <div class="dipl-angry-banner">
      ⚔️ <strong>Righteous Anger</strong> — +10% attack power for ${secs}s
      <span class="dipl-angry-sub">(Reparations refused)</span>
    </div>`;
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

// ── T155: Global Trade Network banner ──────────────────────────────────────

function _tradeNetworkBanner() {
  if (!state.diplomacy) return '';
  const allActive = ['ironHorde', 'mageCouncil', 'seaWolves'].every(id => {
    const e = state.diplomacy.empires.find(emp => emp.id === id);
    return e && e.relations === 'allied' && e.tradeRoutes > 0;
  });
  if (!allActive) return '';
  return `
    <div class="trade-network-banner">
      <span class="trade-network-banner__icon">🌐</span>
      <span class="trade-network-banner__text">
        <strong>Global Trade Network Active!</strong>
        All empires allied with open trade routes — <strong>+3 gold/s</strong> and <strong>+25% sell prices</strong>.
      </span>
    </div>`;
}

// ── T174: Diplomatic Summit section ──────────────────────────────────────────

function _summitSection() {
  if ((state.age ?? 0) < 3) return '';  // Medieval Age required

  const usedThisAge = state.summit?.usedAtAge === state.age;
  const prestige    = state.prestige?.score ?? 0;
  const gold        = state.resources.gold ?? 0;
  const canAfford   = prestige >= SUMMIT_PRESTIGE_COST && gold >= SUMMIT_GOLD_COST;
  const disabled    = usedThisAge || !canAfford;

  const alliedCount  = state.diplomacy?.empires.filter(e => e.relations === 'allied').length ?? 0;
  const neutralCount = state.diplomacy?.empires.filter(e => e.relations === 'neutral').length ?? 0;

  let statusMsg = '';
  if (usedThisAge) {
    statusMsg = `<div class="summit-status summit-status--used">✅ Summit called this age. Available again next age.</div>`;
  } else if (!canAfford) {
    const needs = [];
    if (prestige < SUMMIT_PRESTIGE_COST) needs.push(`${SUMMIT_PRESTIGE_COST} prestige (have ${prestige})`);
    if (gold < SUMMIT_GOLD_COST)         needs.push(`${SUMMIT_GOLD_COST} gold`);
    statusMsg = `<div class="summit-status summit-status--locked">🔒 Requires: ${needs.join(', ')}</div>`;
  }

  const effectsHtml = [
    alliedCount > 0 ? `🎁 ${alliedCount} allied empire${alliedCount > 1 ? 's' : ''} each send 60–120 of a random resource` : '',
    neutralCount > 0 ? `🤝 ${neutralCount} neutral empire${neutralCount > 1 ? 's' : ''} may join your coalition (20% chance each)` : '',
    `⚔️ Hostile empires condemn the summit (relations unchanged)`,
  ].filter(Boolean).map(e => `<li>${e}</li>`).join('');

  return `
    <div class="summit-section">
      <div class="summit-section__header">🌐 Diplomatic Summit</div>
      <div class="summit-section__intro">
        Call a grand diplomatic gathering once per age. Costs ${SUMMIT_PRESTIGE_COST} prestige + ${SUMMIT_GOLD_COST} gold.
      </div>
      <ul class="summit-effects">${effectsHtml}</ul>
      ${statusMsg}
      <button class="btn btn--summit ${disabled ? 'btn--disabled' : ''}"
              data-action="call-summit"
              ${disabled ? 'disabled' : ''}>
        🌐 Call Diplomatic Summit
      </button>
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
  const networkLevel = state.espionage?.networkLevel ?? 0;
  const missionRows = Object.entries(MISSION_LABELS).map(([mId, label]) => {
    // T213: tech_theft is locked until spy network reaches Intelligence Bureau (level 2)
    if (mId === 'tech_theft' && networkLevel < 2) {
      return `
        <div class="dipl-esp-mission dipl-esp-mission--locked">
          <span class="dipl-esp-mission__label">${label}</span>
          <span class="dipl-esp-mission__locked-note">🔐 Requires Intelligence Bureau (level 2)</span>
        </div>`;
    }
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
      ${_spyNetworkSection()}
      <div class="dipl-esp-missions">${missionRows}</div>
      <div class="dipl-esp-log-header">Mission Log</div>
      <div class="dipl-esp-log">${logEntries}</div>
    </div>`;
}

// T113: Spy network upgrade section
function _spyNetworkSection() {
  const current = getNetworkLevel();
  const next    = getNextNetworkLevel();

  const levelPips = NETWORK_LEVELS.slice(0, 4).map((lvl, i) => {
    const filled = i <= current.level;
    return `<span class="spy-net-pip${filled ? ' spy-net-pip--filled' : ''}"></span>`;
  }).join('');

  const upgradeBtn = next
    ? (() => {
        const canAfford = (state.resources?.gold ?? 0) >= next.cost;
        return `<button
          class="btn btn--sm btn--spy-upgrade ${canAfford ? '' : 'btn--disabled'}"
          data-action="spy-upgrade"
          ${canAfford ? '' : 'disabled'}
          title="Upgrade to ${next.name}: +${Math.round(next.successBonus*100)}% success, -${next.cooldownRedSecs}s cooldown${next.counterspy ? ', counterspy passive' : ''}${next.heistBonus > 0 ? ', +'+next.heistBonus+' heist gold' : ''}">
          Upgrade (${next.cost}💰)
        </button>`;
      })()
    : `<span class="spy-net-maxed">✅ Max Level</span>`;

  const bonuses = current.level > 0
    ? `+${Math.round(current.successBonus*100)}% success, -${current.cooldownRedSecs}s cd${current.counterspy ? ', counterspy' : ''}${current.heistBonus > 0 ? ', +'+current.heistBonus+' heist gold' : ''}`
    : 'No bonuses yet';

  return `
    <div class="spy-network-section">
      <div class="spy-net-row">
        <span class="spy-net-name">🔐 ${current.name}</span>
        <span class="spy-net-pips">${levelPips}</span>
      </div>
      <div class="spy-net-bonuses">${bonuses}</div>
      <div class="spy-net-upgrade">${upgradeBtn}</div>
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

// ── T154: Conquest Campaign section ─────────────────────────────────────────

function _campaignSection() {
  const active       = getActiveCampaign();
  const secsLeft     = getCampaignSecsLeft();
  const cdSecs       = getCampaignCooldownSecs();
  const canAfford    = (state.resources?.gold ?? 0) >= CAMPAIGN_COST.gold
                    && (state.resources?.food ?? 0) >= CAMPAIGN_COST.food;

  const costLabel    = `${CAMPAIGN_COST.gold}💰 ${CAMPAIGN_COST.food}🍞`;

  let activeHtml = '';
  if (active) {
    const mins  = Math.floor(secsLeft / 60);
    const secs  = secsLeft % 60;
    const tStr  = mins > 0 ? `${mins}m${String(secs).padStart(2,'0')}s` : `${secsLeft}s`;
    const pct   = Math.round((active.wins / CAMPAIGN_WIN_GOAL) * 100);
    activeHtml = `
      <div class="campaign-active">
        <div class="campaign-active__header">
          <span class="campaign-active__label">⚔️ Campaign vs ${active.empireLabel}</span>
          <span class="campaign-active__timer">Expires in ${tStr}</span>
        </div>
        <div class="campaign-active__progress">
          <div class="campaign-active__bar-bg">
            <div class="campaign-active__bar-fill" style="width:${pct}%"></div>
          </div>
          <span class="campaign-active__count">${active.wins}/${CAMPAIGN_WIN_GOAL} victories (+25% loot)</span>
        </div>
      </div>`;
  }

  const cdHtml = cdSecs > 0 && !active
    ? `<div class="campaign-cooldown">⏳ Campaign cooldown: ${cdSecs}s</div>`
    : '';

  // Launch buttons — one per non-allied empire
  const launchBtns = (state.diplomacy?.empires ?? []).map(emp => {
    if (emp.relations === 'allied') return '';
    const def      = EMPIRES[emp.id];
    const canLaunch = !active && cdSecs === 0 && canAfford;
    const relLabel  = { neutral: 'Neutral', war: 'At War' }[emp.relations] ?? emp.relations;
    return `<button
      class="btn btn--sm btn--campaign ${canLaunch ? '' : 'btn--disabled'}"
      data-action="launch-campaign"
      data-empire="${emp.id}"
      ${canLaunch ? '' : 'disabled'}
      title="Launch a 5-minute conquest campaign. Cost: ${costLabel}. Win ${CAMPAIGN_WIN_GOAL} battles for +200 prestige.">
      ${def.icon} ${def.name} (${relLabel})
    </button>`;
  }).join('');

  return `
    <div class="dipl-campaign">
      <div class="dipl-campaign__header">⚔️ Conquest Campaigns</div>
      <div class="dipl-campaign__sub">Launch a focused campaign for +25% loot and glory. Win ${CAMPAIGN_WIN_GOAL} battles in 5 min for victory. Cost: ${costLabel}.</div>
      ${activeHtml}
      ${cdHtml}
      ${!active ? `<div class="campaign-launch-row">${launchBtns || '<span class="campaign-no-targets">Ally with all empires to unlock new campaigns.</span>'}</div>` : ''}
    </div>`;
}

// ── T208: Resource Exchange Pact section ────────────────────────────────────

const _PACT_RES_ICONS = { food: '🍞', wood: '🪵', stone: '🪨', iron: '⚙️', gold: '💰', mana: '✨' };

function _pactSection() {
  const active = getActivePact();
  const info   = getResourcePactInfo();

  if (active) {
    const r = active;
    return `
      <div class="pact-section pact-section--active">
        <div class="pact-header">
          <span class="pact-header__icon">🤝</span>
          <span class="pact-header__title">Active Resource Pact</span>
        </div>
        <div class="pact-card pact-card--active">
          <div class="pact-card__empire">${r.empireIcon} ${r.empireLabel}</div>
          <div class="pact-card__exchange">
            <span class="pact-card__give">−${r.offeredAmt} ${_PACT_RES_ICONS[r.offeredRes]} per season</span>
            <span class="pact-card__arrow">→</span>
            <span class="pact-card__receive">+${r.receivedAmt} ${_PACT_RES_ICONS[r.receivedRes]} per season</span>
          </div>
          <div class="pact-card__seasons">${r.seasonsLeft} season${r.seasonsLeft !== 1 ? 's' : ''} remaining</div>
          <button class="btn btn--xs pact-cancel-btn" data-action="cancel-pact"
            title="Cancel the pact — forfeit remaining exchanges">✕ Cancel Pact</button>
        </div>
        ${_pactHistory(info?.history)}
      </div>`;
  }

  // Check for allied empires that have a pact definition
  const allied = (state.diplomacy?.empires ?? []).filter(e => e.relations === 'allied' && PACT_DEFINITIONS[e.id]);
  if (allied.length === 0) {
    return `
      <div class="pact-section">
        <div class="pact-header">
          <span class="pact-header__icon">🤝</span>
          <span class="pact-header__title">Resource Exchange Pact</span>
        </div>
        <div class="pact-locked">Ally with Iron Horde, Mage Council, or Sea Wolves to unlock pacts.</div>
        ${_pactHistory(info?.history)}
      </div>`;
  }

  const offers = allied.map(e => {
    const def  = PACT_DEFINITIONS[e.id];
    const empDef = EMPIRES[e.id];
    const res  = state.resources ?? {};
    const canAfford = (res[def.offeredRes] ?? 0) >= def.offeredAmt;
    return `
      <div class="pact-offer">
        <div class="pact-offer__empire">${empDef?.icon ?? ''} ${empDef?.name ?? e.id}</div>
        <div class="pact-offer__desc">${def.icon} ${def.desc}</div>
        <div class="pact-offer__terms">
          Give ${def.offeredAmt} ${_PACT_RES_ICONS[def.offeredRes]} · Receive ${def.receivedAmt} ${_PACT_RES_ICONS[def.receivedRes]}
          <span class="pact-offer__dur">× ${PACT_SEASONS} seasons</span>
        </div>
        <button class="btn btn--xs pact-propose-btn ${canAfford ? '' : 'btn--disabled'}"
          data-action="propose-pact" data-empire="${e.id}"
          ${canAfford ? '' : 'disabled'}
          title="${canAfford
            ? `Propose pact: pay ${def.offeredAmt} ${def.offeredRes} per season for ${PACT_SEASONS} seasons`
            : `Need ${def.offeredAmt} ${def.offeredRes} to initiate`}">
          🤝 Propose Pact
        </button>
      </div>`;
  }).join('');

  return `
    <div class="pact-section">
      <div class="pact-header">
        <span class="pact-header__icon">🤝</span>
        <span class="pact-header__title">Resource Exchange Pact</span>
        <span class="pact-header__sub">Trade resources with allied empires for ${PACT_SEASONS} seasons</span>
      </div>
      ${offers}
      ${_pactHistory(info?.history)}
    </div>`;
}

function _pactHistory(history) {
  if (!history || history.length === 0) return '';
  const entries = history.map(p =>
    `<div class="pact-hist-entry">
       ${p.empireIcon} ${p.empireLabel}: −${p.offeredAmt} ${_PACT_RES_ICONS[p.offeredRes]} / +${p.receivedAmt} ${_PACT_RES_ICONS[p.receivedRes]}
     </div>`
  ).join('');
  return `<div class="pact-history"><div class="pact-history__label">Past Pacts</div>${entries}</div>`;
}

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

// ── T185: Trade Route Specialization row ────────────────────────────────────

// ── T192: Diplomatic Envoy row ───────────────────────────────────────────────

function _envoyRow(emp) {
  const info     = getEnvoyInfo();
  const gold     = state.resources?.gold ?? 0;
  const isActive = !!info.active;
  const activeHere = isActive && info.active.empireId === emp.id;
  const activeElsewhere = isActive && info.active.empireId !== emp.id;

  if (activeHere) {
    const mins = Math.floor(info.travelSecsLeft / 60);
    const secs = info.travelSecsLeft % 60;
    const timeStr = mins > 0 ? `${mins}m ${String(secs).padStart(2, '0')}s` : `${info.travelSecsLeft}s`;
    return `
      <div class="envoy-row envoy-row--active">
        <div class="envoy-row__header">
          <span class="envoy-row__label">✉️ Envoy en route…</span>
          <span class="envoy-row__timer">${timeStr} left</span>
        </div>
        <div class="envoy-progress-bar">
          <div class="envoy-progress-fill" style="width:${info.progressPct}%"></div>
        </div>
        <div class="envoy-row__effect">
          ${emp.relations === 'war' ? '⚔️→🤝 Restore peace' : emp.relations === 'neutral' ? '🤝→✅ Form alliance' : `✅→⭐ +15 favor`}
        </div>
        <button class="btn btn--envoy-recall"
          data-action="recall-envoy"
          title="Recall envoy — refunds ${ENVOY_RECALL_REFUND} gold">
          ↩ Recall (+${ENVOY_RECALL_REFUND}💰)
        </button>
      </div>`;
  }

  const canDispatch = !isActive && gold >= ENVOY_COST;
  const disabled    = isActive || gold < ENVOY_COST;
  const reason      = activeElsewhere
    ? `Envoy already on a mission to ${EMPIRES[info.active?.empireId]?.name ?? '…'}`
    : gold < ENVOY_COST ? `Need ${ENVOY_COST} gold` : '';

  return `
    <div class="envoy-row">
      <button class="btn btn--envoy ${disabled ? 'btn--disabled' : ''}"
        data-action="dispatch-envoy" data-empire="${emp.id}"
        ${disabled ? 'disabled' : ''}
        title="${reason || `Send an envoy — improves relations after 8 min (${ENVOY_COST} gold)`}">
        ✉️ Envoy (${ENVOY_COST}💰)
      </button>
      ${reason ? `<span class="envoy-row__reason">${reason}</span>` : ''}
    </div>`;
}

// ── T220: Military Intelligence row ─────────────────────────────────────────

function _intelRow(emp) {
  if (!isIntelActive()) return '';
  if (emp.relations === 'allied') return ''; // intel only for neutral/war empires

  const report = getIntelReport(emp.id);
  if (!report) {
    const nextSecs = getIntelNextSecs();
    const hintStr  = nextSecs > 0 ? ` (first report in ~${Math.ceil(nextSecs / 60)} min)` : '';
    return `<div class="intel-row intel-row--pending">🔍 Intel: awaiting first report${hintStr}</div>`;
  }

  const TREND_ICON  = { expanding: '📈', stable: '➡️', contracting: '📉' };
  const POWER_COLOR = { weak: '#6b7280', average: '#22c55e', strong: '#f59e0b', overwhelming: '#ef4444' };
  const THREAT_COLOR = { low: '#22c55e', medium: '#f59e0b', high: '#ef4444' };

  const trendIcon   = TREND_ICON[report.tileTrend]   ?? '➡️';
  const powerColor  = POWER_COLOR[report.powerTier]  ?? '#9ca3af';
  const threatColor = THREAT_COLOR[report.threatLevel] ?? '#9ca3af';

  const ageTicks = state.tick - report.generatedAt;
  const ageMins  = Math.floor(ageTicks / (60 * 4)); // TICKS_PER_SECOND=4
  const ageStr   = ageMins < 1 ? 'just now' : `${ageMins}m ago`;

  return `
    <div class="intel-row">
      <span class="intel-row__label">🔍 Intel</span>
      <span class="intel-row__tiles">${trendIcon} ${report.tileCount} tiles (${report.tileTrend})</span>
      <span class="intel-row__power" style="color:${powerColor}">⚔️ ${report.powerTier}</span>
      <span class="intel-row__threat" style="color:${threatColor}">🎯 ${report.threatLevel} threat</span>
      <span class="intel-row__age">${ageStr}</span>
    </div>`;
}

function _tradeSpecRow(emp) {
  if (emp.relations !== 'allied' || emp.tradeRoutes <= 0) return '';

  const current = emp.tradeSpec ?? null;
  const specLabel = current
    ? `${TRADE_SPEC_TYPES[current].icon} <strong>${TRADE_SPEC_TYPES[current].name}</strong> (×2 ${TRADE_SPEC_TYPES[current].resource})`
    : '<em>No specialization</em>';

  const btns = TRADE_SPEC_ORDER.map(type => {
    const spec   = TRADE_SPEC_TYPES[type];
    const locked = spec.requires && !state.techs?.[spec.requires];
    const active = current === type;
    return `<button
      class="btn btn--xs btn--trade-spec${active ? ' btn--trade-spec--active' : ''}${locked ? ' btn--disabled' : ''}"
      data-action="set-trade-spec" data-empire="${emp.id}" data-spec-type="${type}"
      ${locked ? 'disabled' : ''}
      title="${spec.desc}${locked ? ' (requires ' + spec.requires + ' tech)' : ''}">
      ${spec.icon} ${spec.name}${active ? ' ✓' : ''}
    </button>`;
  }).join('');

  return `
    <div class="dipl-trade-spec">
      <div class="dipl-trade-spec__header">🛤️ Route Specialization: ${specLabel}</div>
      <div class="dipl-trade-spec__btns">${btns}</div>
    </div>`;
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

  // T091: Alliance bonus row (only when allied)
  const allianceBonusHtml = rel === 'allied' && def.allianceBonus?.label ? `
    <div class="dipl-alliance-bonus">
      🌟 Alliance Bonus: <strong>${def.allianceBonus.label}</strong>
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
    // T172: Dynastic Marriage — available at Medieval Age, one partner only
    const isMarried       = state.dynasticMarriage?.partnerId === emp.id;
    const hasOtherMarriage = !!state.dynasticMarriage?.partnerId && !isMarried;
    if (isMarried) {
      btns.push(`<div class="dipl-marriage-badge">💍 Dynastic Marriage</div>`);
    } else if (!hasOtherMarriage && (state.age ?? 0) >= 3) {
      const canMarry = gold >= MARRIAGE_COST;
      btns.push(`<button
        class="btn btn--marriage ${canMarry ? '' : 'btn--disabled'}"
        data-action="propose-marriage" data-empire="${emp.id}"
        ${canMarry ? '' : 'disabled'}
        title="Forge a dynastic marriage — permanent bond, ×1.5 trade income, ally never breaks, gifts twice as often. Costs ${MARRIAGE_COST} gold. Requires Medieval Age.">
        💍 Marry (${fmtNum(MARRIAGE_COST)}💰)
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
    // T210: Demand War Reparations
    const repCheck   = canDemandReparations(emp.id);
    const demanded   = !!(state.reparations?.demanded?.[emp.id]);
    const repWs      = emp.warScore ?? 0;
    if (demanded) {
      btns.push(`<div class="dipl-reparations--demanded">💰 Reparations demanded this war</div>`);
    } else if (repWs >= REPARATIONS_WAR_SCORE_MIN) {
      btns.push(`<button
        class="btn btn--reparations ${repCheck.ok ? '' : 'btn--disabled'}"
        data-action="demand-reparations" data-empire="${emp.id}"
        ${repCheck.ok ? '' : 'disabled'}
        title="${repCheck.ok ? `Demand war reparations — costs ${REPARATIONS_PRESTIGE_COST} prestige` : repCheck.reason}">
        💰 Demand Reparations (${REPARATIONS_PRESTIGE_COST}⭐)
      </button>`);
    }
    // T222: Peace Overture — formal prestige-based peace proposal
    const overtureCheck    = canSendOverture(emp.id);
    const overtureAttempted = hasAttemptedOverture(emp.id);
    const prestige         = state.prestige?.score ?? 0;
    if (overtureAttempted) {
      btns.push(`<div class="dipl-overture-badge">📜 Peace Overture sent this war</div>`);
    } else {
      btns.push(`<button
        class="btn btn--overture ${overtureCheck.ok ? '' : 'btn--disabled'}"
        data-action="send-overture" data-empire="${emp.id}"
        ${overtureCheck.ok ? '' : 'disabled'}
        title="${overtureCheck.ok
          ? `Send a formal peace overture — costs ${OVERTURE_PRESTIGE_COST} prestige. Accept chance: ${(emp.warScore ?? 0) >= 15 ? '75%' : (emp.warScore ?? 0) >= 5 ? '50%' : '25%'}.`
          : overtureCheck.reason}">
        📜 Peace Overture (${OVERTURE_PRESTIGE_COST}⭐)
      </button>`);
    }

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
      ${allianceBonusHtml}
      ${_tradeSpecRow(emp)}
      ${warScoreHtml}
      ${_giftRow(emp)}
      ${_aidRow(emp)}
      ${_favorRow(emp)}
      ${_missionRow(emp)}
      ${_embargoRow(emp)}
      ${_tributeRow(emp)}
      ${_envoyRow(emp)}
      ${_intelRow(emp)}
      <div class="dipl-empire-card__actions">${btns.join('')}</div>
    </div>
  `;
}

// ── T114: Alliance Favor row ──────────────────────────────────────────────────

function _favorRow(emp) {
  if (emp.relations !== 'allied') return '';

  const favor   = emp.favor ?? 0;
  const pct     = Math.round(favor / FAVOR_MAX * 100);
  const empDef  = EMPIRES[emp.id];

  const reqBtns = Object.entries(FAVOR_REQUESTS).map(([reqId, req]) => {
    const canAfford = favor >= req.cost;
    return `<button
      class="btn btn--xs btn--favor ${canAfford ? '' : 'btn--disabled'}"
      data-action="alliance-favor" data-empire="${emp.id}" data-req-type="${reqId}"
      ${canAfford ? '' : 'disabled'}
      title="${req.desc} (costs ${req.cost} favor)">
      ${req.label} (${req.cost}✨)
    </button>`;
  }).join('');

  return `
    <div class="dipl-favor-row">
      <div class="dipl-favor-header">
        <span class="dipl-favor-label">✨ Alliance Favor: ${favor}/${FAVOR_MAX}</span>
        <div class="dipl-favor-bar-wrap" title="Accumulates 1 point every 15s while allied">
          <div class="dipl-favor-bar" style="width:${pct}%"></div>
        </div>
      </div>
      <div class="dipl-favor-requests">${reqBtns}</div>
    </div>`;
}

// ── T102: Military Aid row ────────────────────────────────────────────────────

function _aidRow(emp) {
  if (emp.relations !== 'allied') return '';

  const def = EMPIRES[emp.id];
  const unitList = (def.aidUnits ?? []).map(u => `${u.count}× ${u.unitId}`).join(', ');

  const active   = getActiveAid();
  const isActive = active?.empireId === emp.id;
  const cdSecs   = getAidCooldownSecs(emp.id);
  const check    = canRequestAid(emp.id);

  if (isActive) {
    return `<div class="dipl-aid-row dipl-aid-row--active">
      🛡️ Aid active — ${active.battlesLeft} battle${active.battlesLeft !== 1 ? 's' : ''} remaining
    </div>`;
  }

  const btnDisabled = !check.ok ? 'disabled' : '';
  const btnTitle    = !check.ok ? check.reason : `Request ${unitList} for ${AID_BATTLES} battles`;
  const cdText      = cdSecs > 0
    ? `<span class="dipl-aid-cd">⏳ ${cdSecs}s</span>`
    : '';

  return `<div class="dipl-aid-row">
    <span class="dipl-aid-label">🛡️ Military Aid (${AID_COST}g):</span>
    ${cdText}
    <button class="btn btn--xs btn--request-aid" data-action="request-aid" data-empire="${emp.id}"
      ${btnDisabled} title="${btnTitle}">Request Aid</button>
  </div>`;
}

// ── T142: Alliance mission row ────────────────────────────────────────────────

function _missionRow(emp) {
  if (emp.relations !== 'allied') return '';

  const empMission = state.allianceMissions?.[emp.id];
  if (!empMission) return '';

  const mission = empMission.active;

  if (!mission) {
    const nextSecs = missionNextSecs(emp.id);
    const mins  = Math.floor(nextSecs / 60);
    const secs  = nextSecs % 60;
    const timeStr = mins > 0 ? `${mins}m ${String(secs).padStart(2,'0')}s` : `${nextSecs}s`;
    return `
      <div class="dipl-mission-row dipl-mission-row--idle">
        <span class="dipl-mission-idle">📜 Next mission in <strong>${timeStr}</strong></span>
      </div>`;
  }

  const secsLeft = missionSecsLeft(emp.id);
  const mins  = Math.floor(secsLeft / 60);
  const secs  = secsLeft % 60;
  const timeStr = mins > 0 ? `${mins}m ${String(secs).padStart(2,'0')}s` : `${secsLeft}s`;

  let progressHtml = '';
  if (mission.type === 'battle_wins') {
    const pct = Math.min(100, Math.round(mission.progress / mission.target * 100));
    progressHtml = `
      <div class="dipl-mission-progress">
        <span class="dipl-mission-progress__label">Battles: ${mission.progress}/${mission.target}</span>
        <div class="dipl-mission-bar-wrap"><div class="dipl-mission-bar" style="width:${pct}%"></div></div>
      </div>`;
  } else if (mission.type === 'earn_gold') {
    const earned  = Math.max(0, (state.resources?.gold ?? 0) - mission.baseline);
    const needed  = mission.target - mission.baseline;
    const pct     = Math.min(100, Math.round(earned / needed * 100));
    progressHtml = `
      <div class="dipl-mission-progress">
        <span class="dipl-mission-progress__label">Gold earned: ${fmtNum(earned)}/${fmtNum(needed)}</span>
        <div class="dipl-mission-bar-wrap"><div class="dipl-mission-bar" style="width:${pct}%"></div></div>
      </div>`;
  } else {
    progressHtml = `<div class="dipl-mission-progress"><span class="dipl-mission-progress__label">Research any technology</span></div>`;
  }

  return `
    <div class="dipl-mission-row">
      <div class="dipl-mission-card">
        <div class="dipl-mission-card__header">
          <span class="dipl-mission-card__label">📜 ${mission.label}</span>
          <span class="dipl-mission-card__timer">⏳ ${timeStr}</span>
        </div>
        <div class="dipl-mission-card__desc">${mission.desc}</div>
        ${progressHtml}
        <div class="dipl-mission-card__reward">Reward: +${mission.goldReward}💰 +30 prestige</div>
      </div>
    </div>`;
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

// ── T159: Trade Embargo row ──────────────────────────────────────────────────

function _embargoRow(emp) {
  if (emp.relations === 'allied') return '';

  const active   = isEmbargoed(emp.id);
  const secsLeft = embargoSecsLeft(emp.id);
  const cdSecs   = embargoCooldownSecsLeft(emp.id);
  const gold     = state.resources?.gold ?? 0;

  if (active) {
    const mins    = Math.floor(secsLeft / 60);
    const secs    = secsLeft % 60;
    const timeStr = mins > 0 ? `${mins}m ${String(secs).padStart(2,'0')}s` : `${secsLeft}s`;
    return `
      <div class="dipl-embargo-row dipl-embargo-active">
        <span class="dipl-embargo-label">🚫 Embargo active — ${timeStr} left</span>
        <button
          class="btn btn--sm btn--embargo-lift"
          data-action="lift-embargo" data-empire="${emp.id}"
          title="Lift the embargo early (starts cooldown)">
          Lift
        </button>
      </div>`;
  }

  if (cdSecs > 0) {
    return `
      <div class="dipl-embargo-row">
        <span class="dipl-embargo-label">🚫 Embargo cooldown:</span>
        <span class="dipl-embargo-cd">⏳ ${cdSecs}s</span>
      </div>`;
  }

  const canDeclare = gold >= EMBARGO_COST;
  return `
    <div class="dipl-embargo-row">
      <span class="dipl-embargo-label">🚫 Trade Embargo:</span>
      <button
        class="btn btn--sm btn--embargo ${canDeclare ? '' : 'btn--disabled'}"
        data-action="declare-embargo" data-empire="${emp.id}"
        ${canDeclare ? '' : 'disabled'}
        title="Declare a trade embargo — costs ${EMBARGO_COST}g. Lasts 5 min. Reduces their war raids by 30% and gives +15% market sell prices.">
        Declare (${EMBARGO_COST}💰)
      </button>
    </div>`;
}

// ── T166: Tribute Demand row ──────────────────────────────────────────────────

function _tributeRow(emp) {
  const capitalCaptured = hasCapturedCapital(emp.id);
  if (!capitalCaptured) return '';

  const tribute = getTributeStatus(emp.id);

  // Tribute currently active — show countdown to next payment
  if (tribute && tribute.paymentsLeft > 0) {
    const secsLeft = Math.max(0, Math.ceil((tribute.nextPaymentTick - state.tick) / 4));
    const mins     = Math.floor(secsLeft / 60);
    const secs     = secsLeft % 60;
    const timeStr  = mins > 0 ? `${mins}m ${String(secs).padStart(2, '0')}s` : `${secsLeft}s`;
    const paidSoFar = tribute.totalPaid;
    const totalDue  = TRIBUTE_GOLD * TRIBUTE_PAYMENTS;
    return `
      <div class="dipl-tribute-row dipl-tribute-active">
        <span class="dipl-tribute-icon">💰</span>
        <span class="dipl-tribute-label">Tribute: ${tribute.paymentsLeft} payments left</span>
        <span class="dipl-tribute-timer">next in ${timeStr}</span>
      </div>
      <div class="dipl-tribute-progress">
        Collected ${paidSoFar}/${totalDue}g
      </div>`;
  }

  // Already paid in full
  if (tribute && tribute.totalPaid > 0) {
    return `
      <div class="dipl-tribute-row dipl-tribute-done">
        <span class="dipl-tribute-icon">📜</span>
        <span class="dipl-tribute-label">Tribute fulfilled (${tribute.totalPaid}g collected)</span>
      </div>`;
  }

  // Eligible to demand — show button
  const prestige   = state.prestige?.score ?? 0;
  const canDemand  = prestige >= TRIBUTE_PRESTIGE;
  return `
    <div class="dipl-tribute-row">
      <span class="dipl-tribute-icon">📜</span>
      <span class="dipl-tribute-label">Capital captured:</span>
      <button
        class="btn btn--sm btn--tribute ${canDemand ? '' : 'btn--disabled'}"
        data-action="demand-tribute" data-empire="${emp.id}"
        ${canDemand ? '' : 'disabled'}
        title="Demand tribute — costs ${TRIBUTE_PRESTIGE} prestige. Pays ${TRIBUTE_GOLD}g every 90s × ${TRIBUTE_PAYMENTS} times (${TRIBUTE_GOLD * TRIBUTE_PAYMENTS}g total).">
        Demand Tribute (${TRIBUTE_PRESTIGE}✨)
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
    case 'request-aid': {
      result = requestMilitaryAid(empire);
      if (!result.ok) {
        btn.classList.add('btn--shake');
        setTimeout(() => btn.classList.remove('btn--shake'), 400);
        addMessageFallback(result.reason);
      }
      break;
    }
    case 'spy-upgrade': {  // T113
      result = upgradeSpyNetwork();
      if (!result.ok) addMessageFallback(result.reason);
      break;
    }
    case 'alliance-favor': {  // T114
      const reqType = btn.dataset.reqType;
      result = requestAllianceFavor(empire, reqType);
      if (!result.ok) addMessageFallback(result.reason);
      break;
    }
    case 'launch-campaign': {  // T154
      result = startCampaign(empire);
      if (!result.ok) addMessageFallback(result.reason);
      break;
    }
    case 'declare-embargo': {  // T159
      result = declareEmbargo(empire);
      if (!result.ok) addMessageFallback(result.reason);
      break;
    }
    case 'lift-embargo': {  // T159
      result = liftEmbargo(empire);
      if (!result.ok) addMessageFallback(result.reason);
      break;
    }
    case 'demand-tribute': {  // T166
      result = _demandTribute(empire);
      if (!result.ok) addMessageFallback(result.reason);
      break;
    }
    case 'propose-marriage': {  // T172
      result = proposeDynasticMarriage(empire);
      if (!result.ok) addMessageFallback(result.reason);
      break;
    }
    case 'call-summit': {  // T174
      result = callDiplomaticSummit();
      if (!result.ok) addMessageFallback(result.reason);
      break;
    }
    case 'set-trade-spec': {  // T185
      setTradeSpec(empire, btn.dataset.specType);
      break;
    }
    case 'dispatch-envoy': {  // T192
      result = dispatchEnvoy(empire);
      if (!result.ok) addMessageFallback(result.reason);
      break;
    }
    case 'recall-envoy': {  // T192
      result = recallEnvoy();
      if (!result.ok) addMessageFallback(result.reason);
      break;
    }
    case 'propose-pact': {  // T208
      result = proposeResourcePact(empire);
      if (!result.ok) addMessageFallback(result.reason);
      break;
    }
    case 'cancel-pact': {  // T208
      result = cancelResourcePact();
      if (!result.ok) addMessageFallback(result.reason);
      break;
    }
    case 'demand-reparations': {  // T210
      result = demandReparations(empire);
      if (!result.ok) addMessageFallback(result.reason);
      break;
    }
    case 'send-overture': {  // T222
      result = sendPeaceOverture(empire);
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
