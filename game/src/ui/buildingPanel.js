/**
 * EmpireOS — Building panel UI.
 * Shows available buildings with build button and cost tooltip.
 */

import { state } from '../core/state.js';
import { on, Events } from '../core/events.js';
import { buildBuilding, demolishBuilding, specializeBuilding, chooseCapitalPlan, upgradeResourceCap, CAP_UPGRADE_MAX, CAP_UPGRADE_BONUS, CAP_UPGRADE_BASE, forgeItem, addToBuildQueue, removeFromBuildQueue, BUILD_QUEUE_MAX } from '../core/actions.js';
import { BUILDINGS } from '../data/buildings.js';
import { SPECIALIZATIONS, SPECIALS_BY_BUILDING, ELIGIBLE_BUILDINGS } from '../data/buildingSpecials.js';
import { CAPITAL_PLANS, CAPITAL_PLAN_ORDER } from '../data/capitalPlans.js';
import { FORGE_ITEMS, FORGE_ORDER } from '../data/forgeItems.js';
import { fmtNum } from '../utils/fmt.js';

export function initBuildingPanel() {
  const panel = document.getElementById('panel-buildings');
  if (!panel) return;

  renderBuildingPanel();

  on(Events.BUILDING_CHANGED, (data) => {
    renderBuildingPanel();
    // Pop-in the card that just changed
    if (data?.id) _popCard(data.id);
  });
  on(Events.TECH_CHANGED,          renderBuildingPanel);
  on(Events.AGE_CHANGED,           renderBuildingPanel);
  on(Events.BUILDING_SPECIALIZED,  renderBuildingPanel);
  on(Events.CAPITAL_PLAN_CHOSEN,   renderBuildingPanel);
  on(Events.CAP_UPGRADED,          renderBuildingPanel);
  on(Events.FORGE_CHANGED,         renderBuildingPanel);
  on(Events.QUEUE_CHANGED,         renderBuildingPanel);
  on(Events.RESOURCE_CHANGED,      _throttleRender());
}

function _popCard(id) {
  const card = document.querySelector(`#panel-buildings [data-building-id="${id}"]`);
  if (!card) return;
  card.classList.remove('building-card--popin');
  void card.offsetWidth; // restart animation
  card.classList.add('building-card--popin');
  card.addEventListener('animationend', () => card.classList.remove('building-card--popin'), { once: true });
}

function renderBuildingPanel() {
  const panel = document.getElementById('panel-buildings');
  if (!panel) return;

  let html = _queueSection();
  let wonderHeaderAdded = false;

  for (const [id, def] of Object.entries(BUILDINGS)) {
    const count  = state.buildings[id] ?? 0;
    const locked = !meetsRequirements(def.requires);

    // Insert Wonders section header before first wonder building
    if (def.wonder && !wonderHeaderAdded) {
      wonderHeaderAdded = true;
      html += `<div class="wonder-section-header">🏛️ Wonders</div>`;
    }

    if (locked) {
      html += `
        <div class="building-card building-card--locked${def.wonder ? ' building-card--wonder' : ''}"
             data-building-id="${id}" title="Locked: build prerequisites first">
          <span class="building-card__icon">${def.icon}</span>
          <span class="building-card__name">${def.name}</span>
          <span class="building-card__count">🔒</span>
        </div>`;
      continue;
    }

    // Unique building already built — show "Built" state, no actions
    if (def.unique && count >= 1) {
      html += `
        <div class="building-card building-card--wonder building-card--wonder-built"
             data-building-id="${id}" title="${def.description}">
          <div class="building-card__header">
            <span class="building-card__icon">${def.icon}</span>
            <span class="building-card__name">${def.name}</span>
            <span class="building-card__count building-card__count--built">✓ Built</span>
          </div>
          <div class="building-card__prod">${Object.entries(def.production).map(([r,a]) => `+${a}/s ${_resIcon(r)}`).join(' ')}</div>
          <div class="building-card__cost building-card__cost--wonder">${def.description}</div>
        </div>`;
      continue;
    }

    const cost   = scaledCost(def.baseCost, count);
    const canBuy = canAfford(cost);
    const costStr = Object.entries(cost).map(([r, a]) => `${_resIcon(r)}${fmtNum(a)}`).join(' ');
    const prodStr = Object.entries(def.production).map(([r, a]) => `+${a}/s ${_resIcon(r)}`).join(' ');

    // T137: queue button for non-wonder buildings
    const queue       = state.buildQueue ?? [];
    const inQueue     = queue.includes(id);
    const queueFull   = queue.length >= BUILD_QUEUE_MAX;
    const queueBtnHtml = (!def.wonder && !def.unique)
      ? (inQueue
          ? `<button class="btn btn--queue btn--queue-in" disabled title="Already queued">⏳ Queued</button>`
          : `<button class="btn btn--queue ${queueFull ? 'btn--disabled' : ''}"
                     data-action="queue" data-id="${id}"
                     ${queueFull ? 'disabled' : ''}
                     title="${queueFull ? 'Queue full (max 3)' : 'Add to auto-build queue'}">+ Queue</button>`)
      : '';

    html += `
      <div class="building-card ${def.wonder ? 'building-card--wonder' : ''} ${canBuy ? '' : 'building-card--cant-afford'}"
           data-building-id="${id}"
           title="${def.description}">
        <div class="building-card__header">
          <span class="building-card__icon">${def.icon}</span>
          <span class="building-card__name">${def.name}</span>
          <span class="building-card__count">×${count}</span>
        </div>
        ${prodStr ? `<div class="building-card__prod">${prodStr}</div>` : ''}
        <div class="building-card__cost">${costStr}</div>
        <div class="building-card__actions">
          <button class="btn ${def.wonder ? 'btn--wonder' : 'btn--build'} ${canBuy ? '' : 'btn--disabled'}"
                  data-action="build" data-id="${id}"
                  ${canBuy ? '' : 'disabled'}>${def.wonder ? 'Construct' : 'Build'}</button>
          ${!def.unique && count > 0 ? `<button class="btn btn--demolish" data-action="demolish" data-id="${id}">−</button>` : ''}
          ${queueBtnHtml}
        </div>
      </div>`;
  }

  html += _specializationsSection();
  html += _capitalPlansSection();
  html += _treasurySection();
  html += _forgeSection();

  panel.innerHTML = html;

  // Delegate click events
  panel.onclick = (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id, specid, planid, res } = btn.dataset;
    if (action === 'build')           buildBuilding(id);
    if (action === 'demolish')        demolishBuilding(id);
    if (action === 'queue') {
      const result = addToBuildQueue(id);
      if (!result.ok) {
        btn.classList.add('btn--shake');
        setTimeout(() => btn.classList.remove('btn--shake'), 400);
      }
    }
    if (action === 'queue-remove') {
      removeFromBuildQueue(parseInt(btn.dataset.idx, 10));
    }
    if (action === 'specialize')      specializeBuilding(id, specid);
    if (action === 'choose-plan') {
      const result = chooseCapitalPlan(planid);
      if (!result.ok) {
        btn.classList.add('btn--shake');
        setTimeout(() => btn.classList.remove('btn--shake'), 400);
      }
    }
    if (action === 'upgrade-cap') {
      const result = upgradeResourceCap(res);
      if (!result.ok) {
        btn.classList.add('btn--shake');
        setTimeout(() => btn.classList.remove('btn--shake'), 400);
      }
    }
    if (action === 'forge-item') {
      const result = forgeItem(id);
      if (!result.ok) {
        btn.classList.add('btn--shake');
        setTimeout(() => btn.classList.remove('btn--shake'), 400);
      }
    }
  };
}

// ── Building Auto-Queue section (T137) ────────────────────────────────────

function _queueSection() {
  const queue = state.buildQueue ?? [];

  const itemsHtml = queue.length === 0
    ? `<div class="bq-empty">No buildings queued. Click <strong>+ Queue</strong> on any building below to auto-build it when affordable.</div>`
    : queue.map((bid, idx) => {
        const def = BUILDINGS[bid];
        if (!def) return '';
        const cost    = scaledCost(def.baseCost, state.buildings[bid] ?? 0);
        const costStr = Object.entries(cost).map(([r, a]) => `${_resIcon(r)}${fmtNum(a)}`).join(' ');
        return `
          <div class="bq-item">
            <span class="bq-pos">${idx + 1}</span>
            <span class="bq-icon">${def.icon}</span>
            <span class="bq-name">${def.name}</span>
            <span class="bq-cost">${costStr}</span>
            <button class="btn btn--sm bq-remove" data-action="queue-remove" data-idx="${idx}" title="Remove from queue">✕</button>
          </div>`;
      }).join('');

  return `
    <div class="build-queue-section">
      <div class="bq-header">
        <span class="bq-title">🔨 Build Queue</span>
        <span class="bq-count">${queue.length}/${BUILD_QUEUE_MAX}</span>
      </div>
      <div class="bq-items">${itemsHtml}</div>
    </div>`;
}

// ── Specializations section (T090) ──────────────────────────────────────────

function _specializationsSection() {
  // Only show buildings that the player owns at least 1 of
  const eligible = ELIGIBLE_BUILDINGS.filter(id => (state.buildings[id] ?? 0) >= 1);
  if (eligible.length === 0) return '';

  const cards = eligible.map(buildingId => {
    const bdef         = BUILDINGS[buildingId];
    const activeSpecId = state.buildingSpecials?.[buildingId];
    const specIds      = SPECIALS_BY_BUILDING[buildingId] ?? [];

    if (activeSpecId) {
      const sdef = SPECIALIZATIONS[activeSpecId];
      return `
        <div class="spec-card spec-card--active" title="${sdef.desc}">
          <div class="spec-card__header">
            <span>${bdef.icon} ${bdef.name}</span>
            <span class="spec-badge">${sdef.icon} ${sdef.name}</span>
          </div>
          <div class="spec-card__desc">${sdef.desc}</div>
        </div>`;
    }

    const options = specIds.map(specId => {
      const sdef      = SPECIALIZATIONS[specId];
      const canAffordSpec = canAfford(sdef.cost);
      const meetsReqs = meetsRequirements(sdef.requires ?? []);
      const costStr   = Object.entries(sdef.cost).map(([r, a]) => `${_resIcon(r)}${fmtNum(a)}`).join(' ');
      const avail     = canAffordSpec && meetsReqs;
      return `
        <div class="spec-option">
          <div class="spec-option__header">
            <span class="spec-option__icon">${sdef.icon}</span>
            <strong class="spec-option__name">${sdef.name}</strong>
            <span class="spec-option__cost ${canAffordSpec ? 'spec-cost--ok' : 'spec-cost--bad'}">${costStr}</span>
          </div>
          <div class="spec-option__desc">${sdef.desc}</div>
          <button class="btn btn--specialize ${avail ? '' : 'btn--disabled'}"
                  data-action="specialize" data-id="${buildingId}" data-specid="${specId}"
                  ${avail ? '' : 'disabled'}
                  title="${meetsReqs ? '' : 'Requires tech: ' + (sdef.requires?.[0]?.id ?? '')}"
          >Specialize</button>
        </div>`;
    }).join('');

    return `
      <div class="spec-card">
        <div class="spec-card__title">${bdef.icon} ${bdef.name} — Choose a Specialization</div>
        <div class="spec-options">${options}</div>
      </div>`;
  }).join('');

  return `
    <div class="spec-section">
      <div class="spec-section__header">⚗️ Building Specializations</div>
      <div class="spec-section__intro">Permanently upgrade a building with one specialization. Costs apply once.</div>
      ${cards}
    </div>`;
}

// ── Capital Development Plans section (T100) ──────────────────────────────────

function _capitalPlansSection() {
  const chosen = state.capitalPlan;

  if (chosen) {
    const plan = CAPITAL_PLANS[chosen];
    return `
      <div class="cap-plan-section">
        <div class="cap-plan-section__header">🏛️ Capital Development</div>
        <div class="cap-plan-chosen">
          <span class="cap-plan-icon">${plan.icon}</span>
          <div class="cap-plan-body">
            <div class="cap-plan-name">${plan.name}</div>
            <div class="cap-plan-bonuses">${plan.bonusDesc.map(b => `✅ ${b}`).join('<br>')}</div>
          </div>
        </div>
      </div>`;
  }

  const cards = CAPITAL_PLAN_ORDER.map(planId => {
    const plan       = CAPITAL_PLANS[planId];
    const ageOk      = (state.age ?? 0) >= (plan.requiresAge ?? 0);
    const affordable = canAfford(plan.cost);
    const avail      = ageOk && affordable;
    const costStr    = Object.entries(plan.cost).map(([r, a]) => `${_resIcon(r)}${fmtNum(a)}`).join(' ');
    const ageLock    = !ageOk ? `<span class="cap-plan__lock">Requires ${plan.requiresAge === 1 ? 'Bronze' : 'Iron'} Age</span>` : '';
    const bonusList  = plan.bonusDesc.map(b => `<div class="cap-plan__bonus">⚡ ${b}</div>`).join('');

    return `
      <div class="cap-plan-card ${avail ? '' : 'cap-plan-card--locked'}">
        <div class="cap-plan-card__header">
          <span class="cap-plan-icon">${plan.icon}</span>
          <div>
            <div class="cap-plan-card__name">${plan.name}</div>
            <div class="cap-plan-card__cost ${affordable ? 'cap-plan-cost--ok' : 'cap-plan-cost--bad'}">${costStr}</div>
          </div>
        </div>
        <div class="cap-plan-card__desc">${plan.desc}</div>
        ${bonusList}
        ${ageLock}
        <button class="btn btn--cap-plan ${avail ? '' : 'btn--disabled'}"
                data-action="choose-plan" data-planid="${planId}"
                ${avail ? '' : 'disabled'}>
          ${ageOk ? 'Establish Plan' : 'Age Required'}
        </button>
      </div>`;
  }).join('');

  return `
    <div class="cap-plan-section">
      <div class="cap-plan-section__header">🏛️ Capital Development Plan</div>
      <div class="cap-plan-section__intro">Choose one permanent strategic development for your capital. This decision cannot be undone.</div>
      <div class="cap-plan-grid">${cards}</div>
    </div>`;
}

// ── Treasury: Resource Cap Upgrades (T120) ────────────────────────────────────

const RES_ORDER = ['gold', 'food', 'wood', 'stone', 'iron', 'mana'];
const CAP_RES_ICONS = { gold: '💰', food: '🍞', wood: '🪵', stone: '🪨', iron: '⚙️', mana: '✨' };
const CAP_RES_NAMES = { gold: 'Gold', food: 'Food', wood: 'Wood', stone: 'Stone', iron: 'Iron', mana: 'Mana' };

function _treasurySection() {
  const upgrades = state.capUpgrades ?? {};

  const rows = RES_ORDER.map(res => {
    const level    = upgrades[res] ?? 0;
    const maxed    = level >= CAP_UPGRADE_MAX;
    const cost     = CAP_UPGRADE_BASE * (level + 1);
    const canBuy   = !maxed && (state.resources.gold ?? 0) >= cost;
    const baseCap  = state.caps[res] ?? 500;
    const bonusCap = level * CAP_UPGRADE_BONUS;
    const nextBonus = CAP_UPGRADE_BONUS;

    return `
      <div class="treasury-row">
        <span class="treasury-row__icon">${CAP_RES_ICONS[res]}</span>
        <span class="treasury-row__name">${CAP_RES_NAMES[res]}</span>
        <span class="treasury-row__cap">Cap: ${fmtNum(baseCap + bonusCap)}</span>
        <span class="treasury-row__level">${level}/${CAP_UPGRADE_MAX}</span>
        ${maxed
          ? `<span class="treasury-row__maxed">Maxed</span>`
          : `<button class="btn btn--treasury-upgrade ${canBuy ? '' : 'btn--disabled'}"
                     data-action="upgrade-cap" data-res="${res}"
                     ${canBuy ? '' : 'disabled'}
                     title="+${fmtNum(nextBonus)} cap">
               💰${fmtNum(cost)}
             </button>`}
      </div>`;
  }).join('');

  return `
    <div class="treasury-section">
      <div class="treasury-section__header">🏦 Treasury Expansion</div>
      <div class="treasury-section__intro">Invest gold to permanently increase resource storage caps. Each upgrade adds +${CAP_UPGRADE_BONUS} capacity. Max ${CAP_UPGRADE_MAX} upgrades per resource.</div>
      <div class="treasury-grid">${rows}</div>
    </div>`;
}

// ── Forge section (T125) ─────────────────────────────────────────────────────

function _forgeSection() {
  // Requires Iron Foundry + Metalworking
  if ((state.buildings.ironFoundry ?? 0) < 1) return '';

  const crafted = state.forge?.crafted ?? {};

  const cards = FORGE_ORDER.map(itemId => {
    const def        = FORGE_ITEMS[itemId];
    const isCrafted  = !!crafted[itemId];
    const techOk     = !def.requires?.tech || !!state.techs[def.requires.tech];
    const affordable = canAfford(def.cost);
    const avail      = techOk && affordable && !isCrafted;
    const costStr    = Object.entries(def.cost).map(([r, a]) => `${_resIcon(r)}${fmtNum(a)}`).join(' ');

    if (isCrafted) {
      return `
        <div class="forge-item forge-item--crafted" title="${def.desc}">
          <div class="forge-item__header">
            <span class="forge-item__icon">${def.icon}</span>
            <div>
              <div class="forge-item__name">${def.name}</div>
              <div class="forge-item__bonus">${def.bonusLabel}</div>
            </div>
            <span class="forge-item__crafted-badge">✓ Forged</span>
          </div>
        </div>`;
    }

    const lockNote = !techOk
      ? `<div class="forge-item__lock">🔒 Requires ${def.requires.tech}</div>`
      : '';

    return `
      <div class="forge-item ${avail ? '' : 'forge-item--locked'}" title="${def.desc}">
        <div class="forge-item__header">
          <span class="forge-item__icon">${def.icon}</span>
          <div>
            <div class="forge-item__name">${def.name}</div>
            <div class="forge-item__bonus">${def.bonusLabel}</div>
          </div>
        </div>
        <div class="forge-item__desc">${def.desc}</div>
        <div class="forge-item__cost ${affordable && techOk ? 'forge-cost--ok' : 'forge-cost--bad'}">${costStr}</div>
        ${lockNote}
        <button class="btn btn--forge ${avail ? '' : 'btn--disabled'}"
                data-action="forge-item" data-id="${itemId}"
                ${avail ? '' : 'disabled'}>Forge</button>
      </div>`;
  }).join('');

  return `
    <div class="forge-section">
      <div class="forge-section__header">⚒️ Iron Foundry</div>
      <div class="forge-section__intro">Craft permanent items that grant powerful bonuses. Each item can only be forged once.</div>
      <div class="forge-grid">${cards}</div>
    </div>`;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function scaledCost(base, existing) {
  const factor = Math.pow(1.15, existing);
  const scaled = {};
  for (const [res, amt] of Object.entries(base)) {
    scaled[res] = Math.ceil(amt * factor);
  }
  return scaled;
}

function canAfford(cost) {
  for (const [res, amt] of Object.entries(cost)) {
    if ((state.resources[res] ?? 0) < amt) return false;
  }
  return true;
}

function meetsRequirements(requires) {
  for (const req of requires) {
    if (req.type === 'building') {
      if ((state.buildings[req.id] ?? 0) < (req.count ?? 1)) return false;
    }
    if (req.type === 'tech') {
      if (!state.techs[req.id]) return false;
    }
    if (req.type === 'age') {
      if ((state.age ?? 0) < req.minAge) return false;
    }
  }
  return true;
}

const RES_ICONS = { gold: '💰', food: '🍞', wood: '🪵', stone: '🪨', iron: '⚙️', mana: '✨' };
function _resIcon(res) { return RES_ICONS[res] ?? ''; }

function _throttleRender() {
  let last = 0;
  return () => {
    if (state.tick - last >= 8) {
      last = state.tick;
      renderBuildingPanel();
    }
  };
}
