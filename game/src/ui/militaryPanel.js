/**
 * EmpireOS — Military panel UI.
 *
 * Shows:
 *   - Hero section (recruit / active abilities)
 *   - Current army composition (trained units)
 *   - Training queue with progress
 *   - Unit cards with costs, stats, and Train button
 */

import { state } from '../core/state.js';
import { on, Events } from '../core/events.js';
import { trainUnit, recruitHero, useHeroAbility, setFormation, chooseHeroSkill, addMessage } from '../core/actions.js';
import { castSpell, SPELLS, SPELL_ORDER } from '../systems/spells.js';
import { getMoraleLabel, getMoraleEffect } from '../systems/morale.js';
import { hireMercenary, mercenarySecsLeft } from '../systems/mercenaries.js';
import { UNITS } from '../data/units.js';
import { BUILDINGS } from '../data/buildings.js';
import { TECHS } from '../data/techs.js';
import { AGES } from '../data/ages.js';
import { HERO_DEF, HERO_SKILLS, HERO_SKILL_WIN_INTERVAL, HERO_MAX_SKILLS } from '../data/hero.js';
import { fmtNum } from '../utils/fmt.js';

const UNIT_ORDER = ['soldier', 'archer', 'knight', 'mage'];

// XP thresholds (mirrors combat.js constants)
const VETERAN_XP = 3;
const ELITE_XP   = 6;

function _rankMult(id) {
  const rank = state.unitRanks?.[id];
  if (rank === 'elite')   return 2.0;
  if (rank === 'veteran') return 1.5;
  return 1.0;
}

function _rankBadge(id) {
  const rank = state.unitRanks?.[id];
  if (rank === 'elite')   return `<span class="rank-badge rank-badge--elite">★★ Elite</span>`;
  if (rank === 'veteran') return `<span class="rank-badge rank-badge--veteran">★ Veteran</span>`;
  return '';
}

// ── Public API ─────────────────────────────────────────────────────────────

export function initMilitaryPanel() {
  const panel = document.getElementById('panel-military');
  if (!panel) return;

  _render(panel);

  on(Events.UNIT_CHANGED,     () => _render(panel));
  on(Events.BUILDING_CHANGED, () => _render(panel));
  on(Events.TECH_CHANGED,     () => _render(panel));
  on(Events.AGE_CHANGED,      () => _render(panel));
  on(Events.HERO_CHANGED,     () => _render(panel));
  on(Events.HERO_LEVEL_UP,   () => _render(panel));  // T070: skill offer available
  on(Events.MAP_CHANGED,      () => _render(panel));  // combat outcomes update history
  on(Events.SPELL_CAST,       () => _render(panel));
  on(Events.MORALE_CHANGED,    () => _render(panel));  // T057: re-render on morale change
  on(Events.MERCENARY_CHANGED, () => _render(panel));  // T075: mercenary offer spawned/expired
  on(Events.RESOURCE_CHANGED,  () => _renderCosts(panel));
  on(Events.GAME_LOADED,       () => _render(panel));

  // Refresh hero/spell cooldown countdowns and mercenary timer every ~4 seconds
  let _tickCount = 0;
  on(Events.TICK, () => {
    if (++_tickCount % 16 !== 0) return;
    const h = state.hero;
    const hasHeroActivity = h?.recruited && (
      h.activeEffects.battleCry ||
      h.activeEffects.inspire > state.tick ||
      h.activeEffects.siege ||
      Object.values(h.abilityCooldowns).some(cd => cd > state.tick)
    );
    const sp = state.spells;
    const hasSpellActivity = sp && (
      sp.activeEffects.blessing > state.tick ||
      sp.activeEffects.aegis    > state.tick ||
      sp.activeEffects.manaBolt ||
      Object.values(sp.cooldowns).some(cd => cd > state.tick)
    );
    const hasMercOffer = !!state.mercenaries?.current;
    if (hasHeroActivity || hasSpellActivity || hasMercOffer) _render(panel);
  });
}

// ── Rendering ──────────────────────────────────────────────────────────────

function _render(panel) {
  panel.innerHTML = `
    ${_mercenarySection()}
    ${_formationSection()}
    ${_moraleSection()}
    ${_spellsSection()}
    ${_heroSection()}
    ${_armySection()}
    ${_queueSection()}
    <div class="unit-grid" id="unit-grid">
      ${UNIT_ORDER.map(id => _unitCard(id)).join('')}
    </div>
    ${_combatHistorySection()}
  `;

  panel.addEventListener('click', _handleClick);
}

// ── Mercenary offer section (T075) ────────────────────────────────────────

function _mercenarySection() {
  const m = state.mercenaries;
  if (!m?.current) return '';    // no offer active — render nothing

  const { unitId, cost } = m.current;
  const def    = UNITS[unitId];
  const secsLeft = mercenarySecsLeft() ?? 0;
  const urgent   = secsLeft <= 20;
  const canAfford = (state.resources.gold ?? 0) >= cost;

  const costColor = canAfford ? 'var(--green, #48bb78)' : 'var(--red, #e53e3e)';

  return `
    <div class="merc-offer">
      <div class="merc-offer__header">
        <span class="merc-offer__title">⚔️ Mercenary Available</span>
        <span class="merc-offer__timer ${urgent ? 'merc-offer__timer--urgent' : ''}">
          ${secsLeft}s
        </span>
      </div>
      <div class="merc-offer__body">
        <span class="merc-offer__icon">${def?.icon ?? '⚔️'}</span>
        <div class="merc-offer__info">
          <div class="merc-offer__name">${def?.name ?? unitId}</div>
          <div class="merc-offer__stats">
            ATK ${def?.attack ?? '?'} · DEF ${def?.defense ?? '?'} · Instant recruitment
          </div>
        </div>
        <button
          class="btn btn--hire-merc ${canAfford ? '' : 'btn--disabled'}"
          data-action="hire-merc"
          ${canAfford ? '' : 'disabled'}
          title="${canAfford ? `Hire for ${cost} gold` : `Need ${cost} gold`}">
          Hire<br><span style="color:${costColor};font-size:11px">${fmtNum(cost)} 💰</span>
        </button>
      </div>
      <div class="merc-offer__sub">
        One-time fee · no upkeep · offer expires in ${secsLeft}s
      </div>
    </div>`;
}

// ── Formation section (T052) ───────────────────────────────────────────────

const FORMATIONS = [
  { id: 'defensive',  icon: '🛡️', label: 'Defensive',  desc: '–15% attack  ·  –30% enemy raid success' },
  { id: 'balanced',   icon: '⚖️', label: 'Balanced',   desc: 'No modifiers' },
  { id: 'aggressive', icon: '⚔️', label: 'Aggressive', desc: '+25% attack  ·  +25% enemy raid success' },
];

function _formationSection() {
  const f = state.formation ?? 'balanced';
  const activeDef = FORMATIONS.find(fm => fm.id === f) ?? FORMATIONS[1];

  const buttons = FORMATIONS.map(fm => `
    <button class="btn btn--sm btn--formation ${f === fm.id ? 'btn--formation-active' : ''}"
            data-formation="${fm.id}" title="${fm.desc}">
      ${fm.icon} ${fm.label}
    </button>`).join('');

  return `
    <div class="formation-section">
      <div class="formation-title">Battle Formation</div>
      <div class="formation-buttons">${buttons}</div>
      <div class="formation-desc">${activeDef.icon} ${activeDef.desc}</div>
    </div>`;
}

// ── Morale section (T057) ─────────────────────────────────────────────────

function _moraleSection() {
  const m     = Math.round(state.morale ?? 50);
  const pct   = m;   // 0–100
  const label = getMoraleLabel();
  const eff   = getMoraleEffect();

  // Gauge color: red → amber → green
  const color = m >= 65 ? '#48bb78' : m >= 25 ? '#ecc94b' : '#e53e3e';

  // Tier CSS modifier for the label badge
  const tierMod = m >= 80 ? 'inspired' : m >= 65 ? 'confident' : m >= 25 ? 'steady'
                : m >= 10 ? 'demoralized' : 'broken';

  // Combat effect line
  let effectHtml = '';
  if (eff > 1) {
    effectHtml = `<div class="morale-effect morale-effect--bonus">⚔️ Inspired: +${Math.round((eff - 1) * 100)}% attack power</div>`;
  } else if (eff < 1) {
    effectHtml = `<div class="morale-effect morale-effect--penalty">📉 Demoralized: −${Math.round((1 - eff) * 100)}% attack power</div>`;
  }

  // Active modifier hints
  const modLines = [];
  const warCount  = state.diplomacy?.empires?.filter(e => e.relations === 'war').length  ?? 0;
  const allyCount = state.diplomacy?.empires?.filter(e => e.relations === 'allied').length ?? 0;
  if (warCount > 0)  modLines.push(`⚔️ ${warCount} war${warCount > 1 ? 's' : ''} (draining)`);
  if (allyCount > 0) modLines.push(`🤝 ${allyCount} alliance${allyCount > 1 ? 's' : ''} (sustaining)`);
  if (state.season != null) {
    const idx = state.season.index ?? 0;
    if (idx === 0) modLines.push('🌸 Spring (sustaining)');
    if (idx === 3) modLines.push('❄️ Winter (draining)');
  }
  if (m < 15) modLines.push('😰 Desertion risk!');

  const modHtml = modLines.length
    ? `<div class="morale-mods">${modLines.map(l => `<span class="morale-mod">${l}</span>`).join('')}</div>`
    : '';

  return `
    <div class="morale-section">
      <div class="morale-header">
        <span class="morale-title">🎖️ Army Morale</span>
        <span class="morale-label morale-label--${tierMod}">${label}</span>
      </div>
      <div class="morale-bar-wrap" title="Morale: ${m}/100">
        <div class="morale-bar" style="width:${pct}%;background:${color}"></div>
      </div>
      <div class="morale-value">${m} / 100</div>
      ${effectHtml}
      ${modHtml}
    </div>`;
}

// ── Spells section (T055) ─────────────────────────────────────────────────

function _spellsSection() {
  if (!state.spells) return '';
  const now = state.tick;
  const sp  = state.spells;

  const cards = SPELL_ORDER.map(id => {
    const def = SPELLS[id];

    // Lock check (tech requirement)
    const locked = def.requires.some(req => req.type === 'tech' && !state.techs[req.id]);

    const mana      = state.resources.mana ?? 0;
    const affordable = mana >= def.manaCost;
    const cdExpires  = sp.cooldowns[id] ?? 0;
    const onCd       = now < cdExpires;

    const isActive =
      (id === 'blessing'  && sp.activeEffects.blessing  > now) ||
      (id === 'aegis'     && sp.activeEffects.aegis     > now) ||
      (id === 'manaBolt'  && sp.activeEffects.manaBolt);

    const disabled = locked || !affordable || onCd || isActive;

    // Status line
    let statusHtml = '';
    if (locked) {
      const techReq  = def.requires[0];
      const techName = techReq ? (TECHS[techReq.id]?.name ?? techReq.id) : '';
      statusHtml = `<span class="spell-status spell-status--locked">🔒 Requires ${techName}</span>`;
    } else if (id === 'manaBolt' && isActive) {
      statusHtml = `<span class="spell-status spell-status--active">⚡ Primed — will fire on next attack!</span>`;
    } else if (isActive) {
      const expTick  = id === 'blessing' ? sp.activeEffects.blessing : sp.activeEffects.aegis;
      const secsLeft = Math.max(0, Math.ceil((expTick - now) / 4));
      statusHtml = `<span class="spell-status spell-status--active">✅ Active — ${secsLeft}s remaining</span>`;
    } else if (onCd) {
      const secsLeft = Math.max(0, Math.ceil((cdExpires - now) / 4));
      statusHtml = `<span class="spell-status spell-status--cd">⏱ Cooldown — ${secsLeft}s</span>`;
    }

    const costClass = (affordable && !locked) ? 'spell-cost--ok' : 'spell-cost--bad';

    return `<div class="spell-card ${locked ? 'spell-card--locked' : ''}">
      <div class="spell-card__header">
        <span class="spell-card__icon">${def.icon}</span>
        <span class="spell-card__name">${def.name}</span>
        <span class="spell-card__cost ${costClass}">✨${def.manaCost}</span>
      </div>
      <div class="spell-card__desc">${def.desc}</div>
      ${statusHtml}
      <button class="btn btn--sm btn--spell ${disabled ? 'btn--disabled' : ''}"
        data-cast-spell="${id}" ${disabled ? 'disabled' : ''}>Cast</button>
    </div>`;
  }).join('');

  return `<div class="spells-section">
    <div class="spells-title">🔮 Arcane Spells</div>
    <div class="spell-grid">${cards}</div>
  </div>`;
}

// ── Hero section ───────────────────────────────────────────────────────────

function _heroSection() {
  if (state.hero?.recruited) return _heroActiveSection();

  // Recruit card
  const ageReq    = HERO_DEF.requires.find(r => r.type === 'age');
  const ageOk     = !ageReq || (state.age ?? 0) >= ageReq.minAge;
  const affordable = Object.entries(HERO_DEF.cost).every(([r, a]) => (state.resources[r] ?? 0) >= a);
  const disabled  = !ageOk || !affordable;

  const costStr = Object.entries(HERO_DEF.cost)
    .map(([r, a]) => `${_resIcon(r)}${fmtNum(a)}`).join(' ');

  const reqLine = !ageOk
    ? `<div class="hero-card__req">🔒 Requires ${AGES[ageReq.minAge]?.name ?? `Age ${ageReq.minAge}`}</div>`
    : `<div class="hero-card__cost">Cost: ${costStr}</div>`;

  return `<div class="hero-card hero-card--recruit">
    <div class="hero-card__header">
      <span class="hero-card__icon">${HERO_DEF.icon}</span>
      <span class="hero-card__name">${HERO_DEF.name}</span>
      <span class="hero-card__subtitle">Hero Unit — once per game</span>
    </div>
    <div class="hero-card__desc">${HERO_DEF.description}</div>
    <div class="hero-card__stats">⚔ +${HERO_DEF.attack} combat power &nbsp; 🛡 ${HERO_DEF.defense}</div>
    <div class="hero-card__upkeep">Upkeep: ${Object.entries(HERO_DEF.upkeep).map(([r,a]) => `${_resIcon(r)}${a}/s`).join(' ')}</div>
    ${reqLine}
    <button class="btn btn--hero ${disabled ? 'btn--disabled' : ''}"
      data-action="recruit-hero" ${disabled ? 'disabled' : ''}>
      ⭐ Recruit Champion
    </button>
  </div>`;
}

function _heroActiveSection() {
  const h   = state.hero;
  const now = state.tick;

  const abilities = Object.values(HERO_DEF.abilities).map(ab => {
    const cdExpires = h.abilityCooldowns[ab.id] ?? 0;
    const onCd      = now < cdExpires;

    // Check if this ability's effect is currently pending / active
    let effectLabel = '';
    if (ab.id === 'battleCry' && h.activeEffects.battleCry) {
      effectLabel = `<span class="hero-effect--active">⚡ Primed!</span>`;
    } else if (ab.id === 'inspire' && h.activeEffects.inspire > now) {
      const secsLeft = Math.ceil((h.activeEffects.inspire - now) / 4);
      effectLabel = `<span class="hero-effect--active">✅ Active ${secsLeft}s</span>`;
    } else if (ab.id === 'siege' && h.activeEffects.siege) {
      effectLabel = `<span class="hero-effect--active">⚡ Primed!</span>`;
    } else if (onCd) {
      const secsLeft = Math.ceil((cdExpires - now) / 4);
      effectLabel = `<span class="hero-effect--cd">⏱ ${secsLeft}s</span>`;
    }

    const effectPending =
      (ab.id === 'battleCry' && h.activeEffects.battleCry) ||
      (ab.id === 'inspire'   && h.activeEffects.inspire > now) ||
      (ab.id === 'siege'     && h.activeEffects.siege);
    const disabled = onCd || effectPending;

    return `<div class="hero-ability">
      <button class="btn btn--ability ${disabled ? 'btn--disabled' : ''}"
        data-action="hero-ability" data-ability="${ab.id}" ${disabled ? 'disabled' : ''}>
        ${ab.icon} ${ab.name}
      </button>
      <span class="hero-ability__desc">${ab.desc}</span>
      ${effectLabel}
    </div>`;
  }).join('');

  const upkeepStr = Object.entries(HERO_DEF.upkeep)
    .map(([r, a]) => `${_resIcon(r)}${a}/s`).join(' ');

  return `<div class="hero-card hero-card--active">
    <div class="hero-card__header">
      <span class="hero-card__icon">${HERO_DEF.icon}</span>
      <span class="hero-card__name">${HERO_DEF.name}</span>
      <span class="hero-card__badge">Active</span>
    </div>
    <div class="hero-card__stats">⚔ +${HERO_DEF.attack} combat power &nbsp; Upkeep: ${upkeepStr}</div>
    <div class="hero-abilities">${abilities}</div>
    ${_heroSkillsSection()}
  </div>`;
}

// ── Hero skills section (T070) ─────────────────────────────────────────────

function _heroSkillsSection() {
  const h = state.hero;
  if (!h?.recruited) return '';

  const skills   = h.skills   ?? [];
  const wins     = h.combatWins ?? 0;
  const offer    = h.pendingSkillOffer ?? null;

  // Pending skill chooser takes priority
  if (offer?.length) {
    const cards = offer.map(id => {
      const s = HERO_SKILLS.find(sk => sk.id === id);
      if (!s) return '';
      return `<div class="hero-skill-option">
        <span class="hero-skill-option__icon">${s.icon}</span>
        <div class="hero-skill-option__body">
          <span class="hero-skill-option__name">${s.name}</span>
          <span class="hero-skill-option__desc">${s.desc}</span>
        </div>
        <button class="btn btn--sm btn--skill-choose" data-choose-skill="${id}">Choose</button>
      </div>`;
    }).join('');

    return `<div class="hero-skills-section hero-skills-section--offer">
      <div class="hero-skills-title">⭐ New Skill Available!</div>
      <div class="hero-skills-chooser">${cards}</div>
    </div>`;
  }

  // Active skills display
  const nextMilestone = (Math.floor(wins / HERO_SKILL_WIN_INTERVAL) + 1) * HERO_SKILL_WIN_INTERVAL;
  const maxReached    = skills.length >= HERO_MAX_SKILLS;

  const skillItems = skills.map(id => {
    const s = HERO_SKILLS.find(sk => sk.id === id);
    if (!s) return '';
    return `<div class="hero-skill-active">
      <span class="hero-skill-active__icon">${s.icon}</span>
      <div class="hero-skill-active__body">
        <span class="hero-skill-active__name">${s.name}</span>
        <span class="hero-skill-active__desc">${s.desc}</span>
      </div>
    </div>`;
  }).join('');

  const emptyHint = skills.length === 0
    ? `<div class="hero-skills-hint">Earn ${HERO_SKILL_WIN_INTERVAL} combat victories to unlock the first skill.</div>`
    : '';

  const progressHtml = maxReached
    ? `<div class="hero-skills-progress">🏆 All ${HERO_MAX_SKILLS} skills mastered!</div>`
    : `<div class="hero-skills-progress">Combat wins: ${wins} · Next skill at ${nextMilestone} wins</div>`;

  return `<div class="hero-skills-section">
    <div class="hero-skills-title">📖 Champion Skills (${skills.length}/${HERO_MAX_SKILLS})</div>
    ${emptyHint}
    ${skillItems}
    ${progressHtml}
  </div>`;
}

// ── Army summary ───────────────────────────────────────────────────────────

function _armySection() {
  const entries = UNIT_ORDER.filter(id => (state.units[id] ?? 0) > 0);
  if (entries.length === 0 && !state.hero?.recruited) {
    return `<div class="mil-army">
      <span class="mil-section-title">⚔️ Army</span>
      <span class="mil-empty">No units trained yet.</span>
    </div>`;
  }

  const items = entries.map(id => {
    const def   = UNITS[id];
    const count = state.units[id];
    const power = Math.round(def.attack * count * _rankMult(id));
    return `<span class="mil-unit-badge">
      ${def.icon} <strong>${count}</strong> ${def.name}${_rankBadge(id)}
      <span class="mil-power">⚔ ${power}</span>
    </span>`;
  }).join('');

  let totalPower = UNIT_ORDER.reduce((sum, id) => {
    const count = state.units[id] ?? 0;
    const def   = UNITS[id];
    return sum + (def ? def.attack * count * _rankMult(id) : 0);
  }, 0);
  // Apply combat tech multipliers (mirrors combat.js logic)
  if (state.techs.tactics)     totalPower *= 1.25;
  if (state.techs.steel)       totalPower *= 1.5;
  if (state.techs.engineering) totalPower *= 1.1;
  // Hero bonus
  if (state.hero?.recruited) totalPower += HERO_DEF.attack;

  const heroEntry = state.hero?.recruited ? `<span class="mil-unit-badge mil-unit-badge--hero">
    ${HERO_DEF.icon} <strong>1</strong> ${HERO_DEF.name}
    <span class="mil-power">⚔ ${HERO_DEF.attack}</span>
  </span>` : '';

  return `<div class="mil-army">
    <span class="mil-section-title">⚔️ Army <span class="mil-total-power">Combat power: ${Math.round(totalPower)}</span></span>
    <div class="mil-badges">${heroEntry}${items}</div>
  </div>`;
}

// ── Training queue ─────────────────────────────────────────────────────────

function _queueSection() {
  if (state.trainingQueue.length === 0) return '';

  const current = state.trainingQueue[0];
  const def     = UNITS[current.unitId];
  const total   = current.totalTicks ?? def?.trainTicks ?? 1;
  const pct     = Math.round(((total - current.remaining) / total) * 100);

  const rest = state.trainingQueue.slice(1).map(e =>
    `<span>${UNITS[e.unitId]?.icon ?? '?'} ${UNITS[e.unitId]?.name ?? e.unitId}</span>`
  ).join('');

  const inspireActive = state.hero?.recruited &&
    state.hero.activeEffects?.inspire > state.tick;
  const speedNote = inspireActive
    ? ' <span class="hero-effect--active">✨ 2× speed</span>'
    : '';

  return `<div class="mil-queue">
    <span class="mil-section-title">🔄 Training${speedNote}</span>
    <div class="research-active">
      <span>${def?.icon ?? '?'} <strong>${def?.name ?? current.unitId}</strong></span>
      <div class="progress-bar">
        <div class="progress-bar__fill" style="width:${pct}%"></div>
      </div>
      <span class="research-active__time">${pct}%</span>
    </div>
    ${rest ? `<div class="mil-queue-rest">${rest}</div>` : ''}
  </div>`;
}

// ── Unit cards ─────────────────────────────────────────────────────────────

function _unitCard(id) {
  const def    = UNITS[id];
  if (!def) return '';

  const unlocked  = _isUnlocked(id);
  const canAfford = unlocked && _canAfford(def.cost);

  const costStr = Object.entries(def.cost)
    .map(([r, a]) => `${_resIcon(r)}${fmtNum(a)}`)
    .join(' ');

  const upkeepStr = Object.entries(def.upkeep ?? {})
    .map(([r, a]) => `${_resIcon(r)}${a}/s`)
    .join(' ');

  // Rank / XP display for trained units
  const rank    = state.unitRanks?.[id];
  const xp      = state.unitXP?.[id] ?? 0;
  const rankBdg = _rankBadge(id);
  let xpLine = '';
  if ((state.units[id] ?? 0) > 0) {
    if (rank === 'elite') {
      xpLine = `<div class="unit-card__xp">${rankBdg} Max rank — ×2.0 attack</div>`;
    } else {
      const nextThreshold = rank === 'veteran' ? ELITE_XP : VETERAN_XP;
      const nextLabel     = rank === 'veteran' ? 'Elite' : 'Veteran';
      xpLine = `<div class="unit-card__xp">${rankBdg || 'Recruit'} &nbsp; XP: ${xp}/${nextThreshold} → ${nextLabel}</div>`;
    }
  }

  const reqStr = def.requires.length
    ? def.requires.map(r => {
        if (r.type === 'tech') {
          const tech = TECHS[r.id];
          return tech ? `${tech.icon} ${tech.name}` : r.id;
        }
        if (r.type === 'age') {
          const age = AGES[r.minAge];
          return age ? `${age.icon} ${age.name}` : `Age ${r.minAge}`;
        }
        const bld = BUILDINGS[r.id];
        return bld ? `${bld.icon} ${bld.name}` : r.id;
      }).join(', ')
    : '';

  const locked   = !unlocked;
  const disabled = locked || !canAfford;

  return `<div class="unit-card ${locked ? 'unit-card--locked' : ''} ${!locked && !canAfford ? 'unit-card--cant-afford' : ''}">
    <div class="unit-card__header">
      <span class="unit-card__icon">${def.icon}</span>
      <span class="unit-card__name">${def.name}</span>
      <span class="unit-card__count">${state.units[id] ?? 0}</span>
    </div>
    <div class="unit-card__desc">${def.description}</div>
    <div class="unit-card__stats">
      ⚔ ${def.attack} &nbsp; 🛡 ${def.defense}
    </div>
    <div class="unit-card__cost">${locked ? `🔒 Requires: ${reqStr}` : `Cost: ${costStr}`}</div>
    ${upkeepStr ? `<div class="unit-card__upkeep">Upkeep: ${upkeepStr}</div>` : ''}
    ${xpLine}
    <div class="unit-card__actions">
      <button class="btn btn--build ${disabled ? 'btn--disabled' : ''}"
        data-train="${id}" ${disabled ? 'disabled' : ''}>Train</button>
    </div>
  </div>`;
}

function _renderCosts(panel) {
  panel.querySelectorAll('[data-train]').forEach(btn => {
    const id  = btn.dataset.train;
    const def = UNITS[id];
    if (!def) return;
    const can = _isUnlocked(id) && _canAfford(def.cost);
    btn.disabled = !can;
    btn.classList.toggle('btn--disabled', !can);
  });
}

// ── Interaction ────────────────────────────────────────────────────────────

function _handleClick(e) {
  // T070: hero skill chooser
  const skillBtn = e.target.closest('[data-choose-skill]');
  if (skillBtn && !skillBtn.disabled) {
    const result = chooseHeroSkill(skillBtn.dataset.chooseSkill);
    if (!result.ok) addMessage(result.reason, 'info');
    return;
  }

  // T052: formation button
  const formationBtn = e.target.closest('[data-formation]');
  if (formationBtn) {
    setFormation(formationBtn.dataset.formation);
    return;
  }

  // T055: spell cast button
  const spellBtn = e.target.closest('[data-cast-spell]');
  if (spellBtn && !spellBtn.disabled) {
    const result = castSpell(spellBtn.dataset.castSpell);
    if (!result.ok) addMessage(result.reason, 'info');
    return;
  }

  const trainBtn = e.target.closest('[data-train]');
  if (trainBtn && !trainBtn.disabled) {
    trainUnit(trainBtn.dataset.train);
    return;
  }

  const actionBtn = e.target.closest('[data-action]');
  if (!actionBtn || actionBtn.disabled) return;

  if (actionBtn.dataset.action === 'hire-merc') {
    const result = hireMercenary();
    if (!result.ok) {
      actionBtn.classList.add('btn--shake');
      setTimeout(() => actionBtn.classList.remove('btn--shake'), 600);
      addMessage(result.reason, 'info');
    }
  } else if (actionBtn.dataset.action === 'recruit-hero') {
    const result = recruitHero();
    if (!result.ok) addMessage(result.reason, 'info');
  } else if (actionBtn.dataset.action === 'hero-ability') {
    const result = useHeroAbility(actionBtn.dataset.ability);
    if (!result.ok) addMessage(result.reason, 'info');
  }
}

// ── Combat history ─────────────────────────────────────────────────────────

const MAX_HISTORY_DISPLAY = 15;

const TERRAIN_NAMES = {
  grass: 'Grassland', forest: 'Forest', hills: 'Hills',
  river: 'River', mountain: 'Mountain', capital: 'Capital',
};

function _combatHistorySection() {
  const history = state.combatHistory ?? [];
  if (history.length === 0) {
    return `<div class="mil-history">
      <span class="mil-section-title">📜 Combat History</span>
      <span class="mil-empty">No battles fought yet.</span>
    </div>`;
  }

  const entries = history.slice(0, MAX_HISTORY_DISPLAY).map(entry => {
    const isWin     = entry.outcome === 'win';
    const terrain   = TERRAIN_NAMES[entry.terrain] ?? entry.terrain;
    const ticksAgo  = state.tick - entry.tick;
    const secsAgo   = Math.round(ticksAgo / 4);
    const timeLabel = secsAgo < 60
      ? `${secsAgo}s ago`
      : `${Math.round(secsAgo / 60)}m ago`;

    // Loot/loss detail
    let detail = '';
    if (isWin && entry.loot) {
      const parts = Object.entries(entry.loot)
        .filter(([, v]) => v > 0)
        .map(([r, v]) => `+${v} ${r}`);
      detail = parts.length ? parts.join(', ') : 'No loot';
    } else if (!isWin && entry.lost) {
      detail = `Lost 1 ${entry.lost}`;
    }

    return `<div class="mil-hist-entry mil-hist-entry--${isWin ? 'win' : 'loss'}">
      <span class="mil-hist-icon">${isWin ? '⚔️' : '💀'}</span>
      <div class="mil-hist-body">
        <div class="mil-hist-main">
          <span class="mil-hist-outcome">${isWin ? 'Victory' : 'Defeat'}</span>
          <span class="mil-hist-terrain">${terrain} (${entry.x},${entry.y})</span>
        </div>
        ${detail ? `<div class="mil-hist-detail">${detail}</div>` : ''}
      </div>
      <div class="mil-hist-meta">
        <span class="mil-hist-power">⚔${entry.power} vs 🛡${entry.defense}</span>
        <span class="mil-hist-time">${timeLabel}</span>
      </div>
    </div>`;
  }).join('');

  return `<div class="mil-history">
    <span class="mil-section-title">📜 Combat History
      <span class="mil-hist-count">${history.length} battle${history.length !== 1 ? 's' : ''}</span>
    </span>
    ${entries}
  </div>`;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function _isUnlocked(unitId) {
  const def = UNITS[unitId];
  if (!def) return false;
  return def.requires.every(req => {
    if (req.type === 'building') return (state.buildings[req.id] ?? 0) >= (req.count ?? 1);
    if (req.type === 'tech')     return !!state.techs[req.id];
    if (req.type === 'age')      return (state.age ?? 0) >= req.minAge;
    return true;
  });
}

function _canAfford(cost) {
  return Object.entries(cost).every(([r, a]) => (state.resources[r] ?? 0) >= a);
}

const RES_ICONS = {
  gold: '🪙', food: '🌾', wood: '🪵', stone: '🪨', iron: '⚒️', mana: '✨',
};
function _resIcon(r) { return RES_ICONS[r] ?? ''; }
