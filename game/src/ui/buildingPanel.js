/**
 * EmpireOS — Building panel UI.
 * Shows available buildings with build button and cost tooltip.
 */

import { state } from '../core/state.js';
import { on, Events } from '../core/events.js';
import { buildBuilding, demolishBuilding, specializeBuilding, chooseCapitalPlan, upgradeResourceCap, CAP_UPGRADE_MAX, CAP_UPGRADE_BONUS, CAP_UPGRADE_BASE, forgeItem, addToBuildQueue, removeFromBuildQueue, BUILD_QUEUE_MAX, convertResource, CONVERSION_CHAIN, CONVERSION_INPUT, CONVERSION_OUTPUT, CONVERSION_COOLDOWN_TICKS } from '../core/actions.js';
import { depositToVault, VAULT_DEPOSIT_AMOUNT, VAULT_RETURN_AMOUNT, VAULT_LOCK_TICKS } from '../systems/imperialVault.js';
import { communeWithRelics, getCommuneSecsLeft, getRelicCount } from '../systems/relicShrine.js'; // T180
import { GUILDS, GUILD_ORDER, GUILD_SLOTS, foundGuild, isGuildFounded, guildSecsLeft, activeGuildCount } from '../systems/artisanGuilds.js'; // T194
import { launchConstructionDrive, isDriveActive, getDriveSecsLeft, getDriveCooldownSecs, DRIVE_STONE_COST, DRIVE_WOOD_COST } from '../systems/constructionDrive.js'; // T221
import { getBuildingNetworks } from '../systems/resources.js'; // T223
import { heedForecast, FORECAST_GOLD_COST } from '../systems/royalForecast.js'; // T225
import { BUILDINGS } from '../data/buildings.js';
import { SPECIALIZATIONS, SPECIALS_BY_BUILDING, ELIGIBLE_BUILDINGS } from '../data/buildingSpecials.js';
import { CAPITAL_PLANS, CAPITAL_PLAN_ORDER } from '../data/capitalPlans.js';
import { FORGE_ITEMS, FORGE_ORDER } from '../data/forgeItems.js';
import { fmtNum } from '../utils/fmt.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

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
  on(Events.CONVERSION_CHANGED,    renderBuildingPanel);
  on(Events.VAULT_CHANGED,         renderBuildingPanel);
  on(Events.RELIC_SHRINE_COMMUNE,  renderBuildingPanel); // T180
  on(Events.RELIC_DISCOVERED,      renderBuildingPanel); // T180: relic count update
  on(Events.GUILD_FOUNDED,             renderBuildingPanel); // T194
  on(Events.GUILD_RENEWED,             renderBuildingPanel); // T194
  on(Events.GUILD_EXPIRED,             renderBuildingPanel); // T194
  on(Events.GUILD_CHANGED,             renderBuildingPanel); // T194
  on(Events.CONSTRUCTION_DRIVE_CHANGED, renderBuildingPanel); // T221
  on(Events.FORECAST_CHANGED,           renderBuildingPanel); // T225
  // Refresh guild timers and construction drive countdown every second via TICK
  let _guildTickCnt = 0;
  on(Events.TICK, () => {
    _guildTickCnt++;
    const refreshGuild = _guildTickCnt % TICKS_PER_SECOND === 0 && state.guilds?.active?.length;
    const refreshDrive = _guildTickCnt % TICKS_PER_SECOND === 0 && isDriveActive();
    if (refreshGuild || refreshDrive) renderBuildingPanel();
  });
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
  html += _conversionSection();
  html += _vaultSection();
  html += _relicShrineSection();       // T180
  html += _artisanGuildsSection();     // T194
  html += _buildingNetworksSection();  // T223
  html += _constructionDriveSection(); // T221
  html += _forecastSection();          // T225

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
    if (action === 'convert') {
      const result = convertResource(btn.dataset.res);
      if (!result.ok) {
        btn.classList.add('btn--shake');
        setTimeout(() => btn.classList.remove('btn--shake'), 400);
      }
    }
    if (action === 'vault-deposit') {
      const result = depositToVault();
      if (!result.ok) {
        btn.classList.add('btn--shake');
        setTimeout(() => btn.classList.remove('btn--shake'), 400);
      }
    }
    if (action === 'shrine-commune') { // T180
      const result = communeWithRelics();
      if (!result.ok) {
        btn.classList.add('btn--shake');
        setTimeout(() => btn.classList.remove('btn--shake'), 400);
      }
    }
    if (action === 'guild-found') { // T194
      const result = foundGuild(btn.dataset.gid);
      if (!result.ok) {
        btn.classList.add('btn--shake');
        btn.title = result.reason;
        setTimeout(() => btn.classList.remove('btn--shake'), 400);
      }
    }
    if (action === 'construction-drive') { // T221
      const result = launchConstructionDrive();
      if (!result.ok) {
        btn.classList.add('btn--shake');
        btn.title = result.reason;
        setTimeout(() => btn.classList.remove('btn--shake'), 400);
      }
    }
    if (action === 'heed-forecast') { // T225
      const result = heedForecast();
      if (!result.ok) {
        btn.classList.add('btn--shake');
        btn.title = result.reason;
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

// ── Workshop conversion section (T164) ────────────────────────────────────

const _RES_ICONS = { food: '🌾', wood: '🪵', stone: '🪨', iron: '⚙️', mana: '✨', gold: '💰' };
const _RES_NAMES = { food: 'Food', wood: 'Wood', stone: 'Stone', iron: 'Iron', mana: 'Mana' };

function _conversionSection() {
  if ((state.buildings?.workshop ?? 0) < 1) return '';

  const cooldownUntil  = state.conversions?.cooldownUntil ?? 0;
  const onCooldown     = state.tick < cooldownUntil;
  const secsLeft       = onCooldown ? Math.ceil((cooldownUntil - state.tick) / 4) : 0;
  const totalConverted = state.conversions?.totalConverted ?? 0;

  const rows = CONVERSION_CHAIN.map(fromRes => {
    const toIdx   = (CONVERSION_CHAIN.indexOf(fromRes) + 1) % CONVERSION_CHAIN.length;
    const toRes   = CONVERSION_CHAIN[toIdx];
    const hasEnough = (state.resources[fromRes] ?? 0) >= CONVERSION_INPUT;
    const disabled  = onCooldown || !hasEnough;

    return `<div class="conv-row">
      <span class="conv-from">${_RES_ICONS[fromRes]} ${_RES_NAMES[fromRes]} ×${CONVERSION_INPUT}</span>
      <span class="conv-arrow">→</span>
      <span class="conv-to">${_RES_ICONS[toRes]} ${_RES_NAMES[toRes]} ×${CONVERSION_OUTPUT}</span>
      <button class="btn btn--convert ${disabled ? 'btn--disabled' : ''} ${!hasEnough ? 'conv-row__btn--short' : ''}"
              data-action="convert" data-res="${fromRes}"
              ${disabled ? 'disabled' : ''}>Convert</button>
    </div>`;
  }).join('');

  const cooldownHtml = onCooldown
    ? `<div class="conv-cooldown">⏳ Workshop busy — ready in ${secsLeft}s</div>`
    : '';

  const totalHtml = totalConverted > 0
    ? `<div class="conv-total">Total conversions this game: ${totalConverted}</div>`
    : '';

  return `<div class="conv-section">
    <div class="conv-section__header">⚙️ Workshop — Resource Conversion</div>
    <div class="conv-section__intro">
      Convert ${CONVERSION_INPUT} of any resource into ${CONVERSION_OUTPUT} of the next in the chain.
      Chain: 🌾 Food → 🪵 Wood → 🪨 Stone → ⚙️ Iron → ✨ Mana → 🌾 Food
    </div>
    ${cooldownHtml}
    <div class="conv-rows">${rows}</div>
    ${totalHtml}
  </div>`;
}

// ── T173: Imperial Vault section ─────────────────────────────────────────────

function _vaultSection() {
  if ((state.buildings?.imperialVault ?? 0) < 1) return '';

  const v             = state.vault;
  const locked        = v?.locked ?? null;
  const cooldownUntil = v?.cooldownUntil ?? 0;
  const onCooldown    = !locked && state.tick < cooldownUntil;
  const totalDeposits = v?.totalDeposits ?? 0;

  let statusHtml = '';
  let btnDisabled = false;

  if (locked) {
    const secsLeft = Math.max(0, Math.ceil((locked.unlocksAt - state.tick) / 4));
    const mins  = Math.floor(secsLeft / 60);
    const secs  = secsLeft % 60;
    const timeStr = mins > 0 ? `${mins}m ${String(secs).padStart(2, '0')}s` : `${secsLeft}s`;
    statusHtml = `<div class="vault-status vault-status--locked">🔒 ${locked.amount} gold locked — matures in ${timeStr}</div>`;
    btnDisabled = true;
  } else if (onCooldown) {
    const secsLeft = Math.ceil((cooldownUntil - state.tick) / 4);
    statusHtml = `<div class="vault-status vault-status--cooldown">⏳ Vault accepting new deposits in ${secsLeft}s</div>`;
    btnDisabled = true;
  } else {
    statusHtml = `<div class="vault-status vault-status--ready">✅ Vault ready — deposit ${VAULT_DEPOSIT_AMOUNT} gold, collect ${VAULT_RETURN_AMOUNT} in 5 min</div>`;
  }

  const canAfford  = (state.resources.gold ?? 0) >= VAULT_DEPOSIT_AMOUNT;
  const disabled   = btnDisabled || !canAfford;
  const totalHtml  = totalDeposits > 0 ? `<div class="vault-total">Total deposits this game: ${totalDeposits}</div>` : '';

  return `<div class="vault-section">
    <div class="vault-section__header">🏦 Imperial Vault</div>
    <div class="vault-section__intro">
      Deposit ${VAULT_DEPOSIT_AMOUNT} gold and collect ${VAULT_RETURN_AMOUNT} after 5 minutes (+30% interest). Locked gold is safe from raids and disasters.
    </div>
    ${statusHtml}
    <button class="btn btn--vault ${disabled ? 'btn--disabled' : ''}"
            data-action="vault-deposit"
            ${disabled ? 'disabled' : ''}>
      💰 Deposit ${VAULT_DEPOSIT_AMOUNT} Gold
    </button>
    ${totalHtml}
  </div>`;
}

// ── T180: Relic Shrine section ────────────────────────────────────────────────

function _relicShrineSection() {
  if ((state.buildings?.relicShrine ?? 0) < 1) return '';

  const relicCount  = getRelicCount();
  const secsLeft    = getCommuneSecsLeft();
  const onCooldown  = secsLeft > 0;
  const totalComms  = state.relicShrine?.totalCommunions ?? 0;
  const totalPres   = state.relicShrine?.totalPrestigeAwarded ?? 0;

  const mins = Math.floor(secsLeft / 60);
  const secs = secsLeft % 60;
  const cdStr = mins > 0 ? `${mins}m ${String(secs).padStart(2, '0')}s` : `${secsLeft}s`;

  // Describe the commune bonus tier
  let tierDesc;
  if (relicCount >= 6)      tierDesc = '+150 prestige, +150 gold, +10 morale, reveal 5 tiles';
  else if (relicCount >= 4) tierDesc = '+80 prestige, +80 gold, +5 morale';
  else if (relicCount >= 2) tierDesc = '+50 prestige, +50 gold';
  else if (relicCount === 1) tierDesc = '+30 prestige';
  else                      tierDesc = '+20 prestige';

  const communeStatusHtml = onCooldown
    ? `<div class="shrine-commune-status shrine-commune-status--cooldown">⏳ Next communion available in ${cdStr}</div>`
    : `<div class="shrine-commune-status shrine-commune-status--ready">✨ Communion ready (${relicCount} relic${relicCount !== 1 ? 's' : ''}: ${tierDesc})</div>`;

  const passiveRate = relicCount > 0
    ? `<div class="shrine-relics">⛩️ Passive: +${relicCount * 12} prestige/min from ${relicCount} relic${relicCount !== 1 ? 's' : ''}</div>`
    : `<div class="shrine-relics">⛩️ Discover relics to unlock passive prestige income.</div>`;

  const statsHtml = totalComms > 0
    ? `<div class="shrine-total">Communions: ${totalComms}  ·  Prestige awarded: ${totalPres}</div>`
    : '';

  return `<div class="shrine-section">
    <div class="shrine-section__header">⛩️ Relic Shrine</div>
    <div class="shrine-section__intro">
      Amplifies the power of your ancient relics. Passive prestige scales with relic count. Commune every 5 minutes for scaled rewards.
    </div>
    ${passiveRate}
    ${communeStatusHtml}
    <button class="btn btn--commune ${onCooldown ? 'btn--disabled' : ''}"
            data-action="shrine-commune"
            ${onCooldown ? 'disabled' : ''}>
      ⛩️ Commune with Relics
    </button>
    ${statsHtml}
  </div>`;
}

// ── T194: Artisan Guilds section ──────────────────────────────────────────────

function _artisanGuildsSection() {
  const activeCount = activeGuildCount();
  const slotsLeft   = GUILD_SLOTS - activeCount;

  const guildRows = GUILD_ORDER.map(gid => {
    const def     = GUILDS[gid];
    const active  = isGuildFounded(gid);
    const secsLeft = active ? guildSecsLeft(gid) : 0;

    const costStr = Object.entries(def.cost)
      .map(([r, v]) => `${_resIcon(r)}${v}`)
      .join(' ');
    const bonusStr = Object.entries(def.bonuses)
      .map(([r, v]) => `+${v} ${r}/s`)
      .join(' ');

    const renewCostStr = Object.entries(def.cost)
      .map(([r, v]) => `${_resIcon(r)}${Math.ceil(v * 0.5)}`)
      .join(' ');

    const canAffordNew  = Object.entries(def.cost).every(([r, v]) => (state.resources?.[r] ?? 0) >= v);
    const renewCost     = Object.fromEntries(Object.entries(def.cost).map(([r, v]) => [r, Math.ceil(v * 0.5)]));
    const canAffordRenew = Object.entries(renewCost).every(([r, v]) => (state.resources?.[r] ?? 0) >= v);

    if (active) {
      const mins = Math.floor(secsLeft / 60);
      const secs = secsLeft % 60;
      const timeStr = mins > 0 ? `${mins}m${String(secs).padStart(2,'0')}s` : `${secsLeft}s`;
      const nearExpiry = secsLeft < 60;

      return `
        <div class="guild-row guild-row--active${nearExpiry ? ' guild-row--expiring' : ''}">
          <span class="guild-row__icon">${def.icon}</span>
          <div class="guild-row__info">
            <span class="guild-row__name">${def.name}</span>
            <span class="guild-row__bonus">${bonusStr}</span>
          </div>
          <span class="guild-row__timer">${timeStr}</span>
          <button class="btn btn--guild-renew ${canAffordRenew ? '' : 'btn--disabled'}"
                  data-action="guild-found" data-gid="${gid}"
                  ${canAffordRenew ? '' : 'disabled'}
                  title="Renew for ${renewCostStr}">
            ↺ Renew (${renewCostStr})
          </button>
        </div>`;
    }

    const blocked = !active && slotsLeft <= 0;
    return `
      <div class="guild-row${blocked ? ' guild-row--blocked' : ''} ${canAffordNew ? '' : 'guild-row--cant-afford'}">
        <span class="guild-row__icon">${def.icon}</span>
        <div class="guild-row__info">
          <span class="guild-row__name">${def.name}</span>
          <span class="guild-row__desc">${def.desc} <em>${bonusStr}</em></span>
        </div>
        <button class="btn btn--guild-found ${(canAffordNew && !blocked) ? '' : 'btn--disabled'}"
                data-action="guild-found" data-gid="${gid}"
                ${(canAffordNew && !blocked) ? '' : 'disabled'}
                title="${blocked ? `Max ${GUILD_SLOTS} guilds active` : `Found for ${costStr}`}">
          Found (${costStr})
        </button>
      </div>`;
  }).join('');

  const slotLine = `<div class="guilds-slots">Slots: ${activeCount} / ${GUILD_SLOTS} active</div>`;

  return `<div class="guilds-section">
    <div class="guilds-section__header">⚙️ Artisan Guilds</div>
    <div class="guilds-section__intro">
      Found up to ${GUILD_SLOTS} guilds simultaneously for flat production bonuses. Each lasts 4 minutes. Renew at half cost before expiry.
    </div>
    ${slotLine}
    <div class="guilds-list">${guildRows}</div>
  </div>`;
}

// ── T221: Imperial Construction Drive section ─────────────────────────────────

// ── T223: Building Network Bonuses ───────────────────────────────────────────

function _buildingNetworksSection() {
  const networks = getBuildingNetworks();
  if (networks.length === 0) return '';

  const rows = networks.map(n => `
    <div class="bnet-row">
      <span class="bnet-icon">${n.icon}</span>
      <span class="bnet-label">${n.label}</span>
      <span class="bnet-count">×${n.count}</span>
      <span class="bnet-bonus">${n.bonus}</span>
    </div>`).join('');

  return `
    <div class="bnet-section">
      <div class="bnet-header">🔗 Active Building Networks</div>
      ${rows}
    </div>`;
}

function _constructionDriveSection() {
  if ((state.age ?? 0) < 1) return ''; // Bronze Age+

  const active     = isDriveActive();
  const secsLeft   = getDriveSecsLeft();
  const cdSecs     = getDriveCooldownSecs();
  const stone      = state.resources?.stone ?? 0;
  const wood       = state.resources?.wood  ?? 0;
  const canAfford  = stone >= DRIVE_STONE_COST && wood >= DRIVE_WOOD_COST;
  const onCooldown = !active && cdSecs > 0;

  let statusHtml = '';
  if (active) {
    const mins = Math.floor(secsLeft / 60);
    const secs = secsLeft % 60;
    const tStr = mins > 0 ? `${mins}m ${String(secs).padStart(2, '0')}s` : `${secsLeft}s`;
    statusHtml = `
      <div class="cdrive-active">
        <span class="cdrive-active__icon">🏗️</span>
        <span class="cdrive-active__text">Drive active — all production +20%</span>
        <span class="cdrive-active__timer">${tStr} remaining</span>
      </div>`;
  } else if (onCooldown) {
    statusHtml = `<div class="cdrive-cooldown">⏳ Cooldown: ${cdSecs}s</div>`;
  }

  const disabled = active || onCooldown || !canAfford;
  const btnTitle = active
    ? 'Drive already active'
    : onCooldown
      ? `On cooldown for ${cdSecs}s`
      : !canAfford
        ? `Need ${DRIVE_STONE_COST}🪨 ${DRIVE_WOOD_COST}🪵`
        : `Spend ${DRIVE_STONE_COST} stone + ${DRIVE_WOOD_COST} wood to boost all production +20% for 3 min`;

  return `
    <div class="cdrive-section">
      <div class="cdrive-header">🏗️ Imperial Construction Drive</div>
      <div class="cdrive-desc">
        Spend <strong>${DRIVE_STONE_COST}🪨 stone</strong> and <strong>${DRIVE_WOOD_COST}🪵 wood</strong>
        to rally your workforce — all resource production <strong>+20%</strong> for 3 minutes.
        Awards +5 morale on completion. 12-min cooldown.
      </div>
      ${statusHtml}
      ${!active ? `
        <div class="cdrive-actions">
          <button class="btn btn--cdrive ${disabled ? 'btn--disabled' : ''}"
                  data-action="construction-drive"
                  ${disabled ? 'disabled' : ''}
                  title="${btnTitle}">
            🏗️ Launch Drive (${DRIVE_STONE_COST}🪨 ${DRIVE_WOOD_COST}🪵)
          </button>
          <span class="cdrive-have">Have: ${Math.floor(stone)}🪨 ${Math.floor(wood)}🪵</span>
        </div>` : ''}
      ${state.constructionDrive?.totalDrives > 0
        ? `<div class="cdrive-total">Total drives: ${state.constructionDrive.totalDrives}</div>` : ''}
    </div>`;
}

// ── T225: Royal Forecast section ─────────────────────────────────────────────

function _forecastSection() {
  const fc = state.forecast;
  if (!fc) return '';

  const gold      = state.resources?.gold ?? 0;
  const canAfford = gold >= FORECAST_GOLD_COST;

  if (fc.heeded) {
    const bonusEntries = Object.entries(fc.bonus ?? {})
      .map(([res, val]) => `+${val} ${res}/s`)
      .join(', ');
    return `
      <div class="forecast-section">
        <div class="forecast-header">🔭 Royal Forecast</div>
        <div class="forecast-name">${fc.icon} ${fc.name}</div>
        <div class="forecast-prediction">${fc.prediction}</div>
        <div class="forecast-active">✅ Forecast heeded — ${bonusEntries} (expires next season)</div>
        ${fc.totalHeeded > 0 ? `<div class="forecast-total">Total forecasts heeded: ${fc.totalHeeded}</div>` : ''}
      </div>`;
  }

  return `
    <div class="forecast-section">
      <div class="forecast-header">🔭 Royal Forecast</div>
      <div class="forecast-name">${fc.icon} ${fc.name}</div>
      <div class="forecast-prediction">${fc.prediction}</div>
      <div class="forecast-bonus-hint">Prepare your empire: <strong>${fc.bonusDesc}</strong></div>
      <div class="forecast-actions">
        <button class="btn btn--forecast ${canAfford ? '' : 'btn--disabled'}"
                data-action="heed-forecast"
                ${canAfford ? '' : 'disabled'}
                title="${canAfford ? `Spend ${FORECAST_GOLD_COST} gold to heed the forecast` : `Need ${FORECAST_GOLD_COST} gold`}">
          🔭 Heed Forecast (${FORECAST_GOLD_COST}🪙)
        </button>
        <span class="forecast-have">Have: ${Math.floor(gold)}🪙</span>
      </div>
      ${fc.totalHeeded > 0 ? `<div class="forecast-total">Total forecasts heeded: ${fc.totalHeeded}</div>` : ''}
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
