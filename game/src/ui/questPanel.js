/**
 * EmpireOS — Quest panel UI.
 * Renders milestone objectives and the active dynamic challenge.
 */

import { state } from '../core/state.js';
import { on, Events } from '../core/events.js';
import { QUESTS, setQuestPanelRenderer } from '../systems/quests.js';
import { getChallengeSecsLeft } from '../systems/challenges.js';
import { resolvePoliticalEvent, getPoliticalEventSecsLeft } from '../systems/politicalEvents.js';
import { getActiveBounty, getBountySecsLeft } from '../systems/bounty.js';
import { getActiveRebels } from '../systems/rebels.js'; // T151
import { getActivePlague, getPlagueSecsLeft, quarantinePlague, QUARANTINE_GOLD_COST, QUARANTINE_FOOD_COST } from '../systems/plague.js'; // T161
import { hostPilgrimage } from '../systems/pilgrimages.js'; // T162
import { getActiveSeasonalObjective } from '../systems/seasonalObjectives.js'; // T170
import { TICKS_PER_SECOND } from '../core/tick.js';
import { WIN_AGE, WIN_TILES, WIN_QUESTS, WIN_DIPLOMATIC_ALLIANCES, WIN_ECONOMIC_GOLD } from '../systems/victory.js'; // T187
import { getActiveOmen, getOmenSecsLeft, avertOmen, channelOmen } from '../systems/oracle.js'; // T193
import { EPIC_CHAINS, CHAIN_ORDER, getChainProgress } from '../systems/epicQuests.js'; // T202
import { getRoyalHuntStatus, launchRoyalHunt, HUNT_GOLD_COST, HUNT_FOOD_COST } from '../systems/royalHunt.js'; // T214

export function initQuestPanel() {
  const panel = document.getElementById('panel-quests');
  if (!panel) return;

  // Re-render on quest/challenge/state changes
  const events = [
    Events.BUILDING_CHANGED, Events.UNIT_CHANGED, Events.TECH_CHANGED,
    Events.AGE_CHANGED, Events.MAP_CHANGED, Events.QUEST_COMPLETED,
    Events.CHALLENGE_UPDATED, Events.POPULATION_CHANGED, Events.RESOURCE_CHANGED,
    Events.POLITICAL_EVENT, Events.BOUNTY_CHANGED,
    Events.REBEL_UPRISING, Events.REBELS_SUPPRESSED,  // T151
    Events.PLAGUE_STARTED, Events.PLAGUE_ENDED,        // T161
    Events.PILGRIMAGE_ARRIVED, Events.PILGRIMAGE_HOSTED, // T162
    Events.SEASONAL_OBJECTIVE,                          // T170
    Events.DIPLOMACY_CHANGED,                           // T187: victory progress alliance count
    Events.OMEN_APPEARED, Events.OMEN_AVERTED,          // T193: oracle omen state changes
    Events.OMEN_CHANNELED, Events.OMEN_FIRED,           // T193
    Events.EPIC_QUEST_PROGRESS,                         // T202: epic quest chain step/completion
    Events.HUNT_CHANGED,                                // T214: royal hunt state changes
  ];
  for (const ev of events) on(ev, render);

  // Refresh countdowns every second via TICK
  let _tickCount = 0;
  on(Events.TICK, () => {
    if (++_tickCount % TICKS_PER_SECOND === 0) {
      const ch = state.challenges?.active;
      const pe = state.politicalEvents?.pending;
      const bo = state.bounty?.current;
      const pl = state.plague?.active;
      const pi = state.pilgrimages?.pending;
      const om = state.oracle?.activeOmen;
      const rh = state.royalHunt?.pending || state.royalHunt?.active;
      if (ch || pe || bo || pl || pi || om || rh) render();
    }
  });

  // Delegate click events
  panel.addEventListener('click', (e) => {
    // Oracle omen actions (T193)
    if (e.target.closest('[data-action="avert-omen"]')) {
      const r = avertOmen();
      if (!r.ok) {
        const b = e.target.closest('[data-action="avert-omen"]');
        if (b) { b.textContent = r.reason; setTimeout(() => render(), 1500); }
      }
      return;
    }
    if (e.target.closest('[data-action="channel-omen"]')) {
      const r = channelOmen();
      if (!r.ok) {
        const b = e.target.closest('[data-action="channel-omen"]');
        if (b) { b.textContent = r.reason; setTimeout(() => render(), 1500); }
      }
      return;
    }
    // Political event choices
    const polBtn = e.target.closest('[data-pol-choice]');
    if (polBtn) {
      const choice = polBtn.dataset.polChoice;
      const result = resolvePoliticalEvent(choice);
      if (!result.ok) {
        polBtn.title = result.reason ?? 'Cannot choose that option.';
        polBtn.classList.add('btn--shake');
        setTimeout(() => polBtn.classList.remove('btn--shake'), 500);
      }
      return;
    }
    // Quarantine button (T161)
    if (e.target.closest('[data-action="quarantine-plague"]')) {
      const r = quarantinePlague();
      if (!r.ok) {
        const b = e.target.closest('[data-action="quarantine-plague"]');
        if (b) { b.textContent = r.reason; setTimeout(() => render(), 1500); }
      }
      return;
    }
    // Host pilgrimage button (T162)
    if (e.target.closest('[data-action="host-pilgrimage"]')) {
      const r = hostPilgrimage();
      if (!r.ok) {
        const b = e.target.closest('[data-action="host-pilgrimage"]');
        if (b) { b.textContent = r.reason; setTimeout(() => render(), 1500); }
      }
      return;
    }
    // Launch royal hunt button (T214)
    if (e.target.closest('[data-action="launch-hunt"]')) {
      const r = launchRoyalHunt();
      if (!r.ok) {
        const b = e.target.closest('[data-action="launch-hunt"]');
        if (b) { b.textContent = r.reason; setTimeout(() => render(), 1500); }
      }
    }
  });

  setQuestPanelRenderer(render);
  render();
}

function render() {
  const panel = document.getElementById('panel-quests');
  if (!panel) return;

  const completed = state.quests?.completed ?? {};
  const doneCount = Object.keys(completed).length;
  const total     = QUESTS.length;
  const pct       = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  panel.innerHTML = `
    ${_oracleSection()}
    ${_plagueSection()}
    ${_pilgrimageSection()}
    ${_royalHuntSection()}
    ${_rebelSection()}
    ${_seasonalObjectiveSection()}
    ${_bountySection()}
    ${_politicalEventSection()}
    ${_challengeSection()}
    <div class="quest-header">
      <div class="quest-header__title">Quests &amp; Objectives</div>
      <div class="quest-header__meta">
        <span class="quest-header__count">${doneCount} / ${total}</span>
        <div class="progress-bar" style="width:160px">
          <div class="progress-bar__fill progress-bar__fill--quest" style="width:${pct}%"></div>
        </div>
      </div>
    </div>
    <div class="quest-list">
      ${QUESTS.map(q => _questCard(q, completed[q.id])).join('')}
    </div>
    ${_victoryProgressSection()}
    ${_epicChainsSection()}
  `;
}

// ── Oracle of Fate section (T193) ────────────────────────────────────────

function _oracleSection() {
  if ((state.age ?? 0) < 1) return '';  // only from Bronze Age

  const omen = getActiveOmen();
  if (!omen) return '';

  const secsLeft = getOmenSecsLeft();
  const urgency  = secsLeft < 20 ? 'omen-card--urgent'
                 : secsLeft < 40 ? 'omen-card--warning' : '';

  const _costStr = (costs) =>
    Object.entries(costs).map(([r, v]) => `${v} ${r}`).join(' + ');

  return `
    <div class="omen-card ${urgency}">
      <div class="omen-card__header">
        <span class="omen-card__icon">${omen.icon}</span>
        <span class="omen-card__title">${omen.title}</span>
        <span class="omen-card__timer">${secsLeft}s</span>
      </div>
      <div class="omen-card__desc">${omen.desc}</div>
      <div class="omen-card__actions">
        <button class="btn btn--omen-avert" data-action="avert-omen"
                title="${omen.avertDesc}">
          🛡️ Avert (${_costStr(omen.avertCost)})
        </button>
        <button class="btn btn--omen-channel" data-action="channel-omen"
                title="${omen.channelDesc}">
          ✨ Channel (${_costStr(omen.channelCost)})
        </button>
      </div>
      <div class="omen-card__footer">Ignore: omen fires in ${secsLeft}s.</div>
    </div>`;
}

// ── Victory Progress section (T187) ──────────────────────────────────────

function _victoryProgressSection() {
  if (!state.quests) return '';

  // ── Conquest progress ──────────────────────────────────────────────────
  let playerTiles = 0;
  if (state.map) {
    for (const row of state.map.tiles) for (const t of row) if (t.owner === 'player') playerTiles++;
  }
  const currentAge   = state.age ?? 0;
  const questsDone   = Object.keys(state.quests?.completed ?? {}).length;
  const tilePct      = Math.min(100, Math.round((playerTiles / WIN_TILES) * 100));
  const agePct       = Math.min(100, Math.round((currentAge  / WIN_AGE)   * 100));
  const questPct     = Math.min(100, Math.round((questsDone  / WIN_QUESTS) * 100));
  const conquestPct  = Math.round((tilePct + agePct + questPct) / 3);

  // ── Diplomatic progress ────────────────────────────────────────────────
  const alliedCount  = state.diplomacy?.empires?.filter(e => e.relations === 'allied').length ?? 0;
  const diplomPct    = Math.min(100, Math.round((alliedCount / WIN_DIPLOMATIC_ALLIANCES) * 100));

  // ── Economic progress ──────────────────────────────────────────────────
  const goldEarned   = state.stats?.goldEarned ?? 0;
  const hasTech      = !!state.techs?.economics;
  const goldPct      = Math.min(100, Math.round((goldEarned / WIN_ECONOMIC_GOLD) * 100));
  const econPct      = hasTech ? Math.round((goldPct + 100) / 2) : Math.round(goldPct / 2);

  function bar(pct, cls) {
    return `<div class="vp-bar-bg"><div class="vp-bar-fill ${cls}" style="width:${pct}%"></div></div>`;
  }

  return `
    <div class="victory-progress-section">
      <div class="victory-progress-header">🏆 Victory Paths</div>

      <div class="vp-card vp-card--conquest">
        <div class="vp-card__title">⚔️ Conquest <span class="vp-pct">${conquestPct}%</span></div>
        <div class="vp-row">
          <span class="vp-label">Territory</span>
          ${bar(tilePct, 'vp-bar-fill--conquest')}
          <span class="vp-val">${playerTiles}/${WIN_TILES}</span>
        </div>
        <div class="vp-row">
          <span class="vp-label">Age</span>
          ${bar(agePct, 'vp-bar-fill--conquest')}
          <span class="vp-val">${currentAge}/${WIN_AGE}</span>
        </div>
        <div class="vp-row">
          <span class="vp-label">Quests</span>
          ${bar(questPct, 'vp-bar-fill--conquest')}
          <span class="vp-val">${questsDone}/${WIN_QUESTS}</span>
        </div>
      </div>

      <div class="vp-card vp-card--diplomatic">
        <div class="vp-card__title">🤝 Diplomatic <span class="vp-pct">${diplomPct}%</span></div>
        <div class="vp-row">
          <span class="vp-label">Alliances</span>
          ${bar(diplomPct, 'vp-bar-fill--diplomatic')}
          <span class="vp-val">${alliedCount}/${WIN_DIPLOMATIC_ALLIANCES}</span>
        </div>
        <div class="vp-card__sub">Ally all ${WIN_DIPLOMATIC_ALLIANCES} rival empires simultaneously.</div>
      </div>

      <div class="vp-card vp-card--economic">
        <div class="vp-card__title">💰 Economic <span class="vp-pct">${econPct}%</span></div>
        <div class="vp-row">
          <span class="vp-label">Gold Earned</span>
          ${bar(goldPct, 'vp-bar-fill--economic')}
          <span class="vp-val">${Math.floor(goldEarned).toLocaleString()}/${WIN_ECONOMIC_GOLD.toLocaleString()}</span>
        </div>
        <div class="vp-row">
          <span class="vp-label">Economics Tech</span>
          <span class="vp-tech-status ${hasTech ? 'vp-tech-status--done' : ''}">${hasTech ? '✅ Researched' : '🔒 Not yet researched'}</span>
        </div>
      </div>
    </div>
  `;
}

// ── Plague section (T161) ────────────────────────────────────────────────

function _plagueSection() {
  if ((state.age ?? 0) < 1) return '';  // Bronze Age+ only

  const plague = getActivePlague();
  if (!plague) return '';

  const secsLeft = getPlagueSecsLeft();
  const canAfford = (state.resources?.gold ?? 0) >= QUARANTINE_GOLD_COST &&
                    (state.resources?.food ?? 0) >= QUARANTINE_FOOD_COST;
  const btnClass = canAfford ? 'btn btn--sm btn--quarantine' : 'btn btn--sm btn--quarantine btn--disabled';

  return `
    <div class="plague-section plague-section--active">
      <div class="plague-section__header">🦠 Plague Outbreak!</div>
      <div class="plague-section__desc">
        Food production −35%. Population slowly declining. Ends in <strong>${secsLeft}s</strong>.
      </div>
      <div class="plague-section__actions">
        <button class="${btnClass}" data-action="quarantine-plague"
          title="${canAfford ? `Quarantine the plague (${QUARANTINE_GOLD_COST}💰 ${QUARANTINE_FOOD_COST}🍞)` : `Need ${QUARANTINE_GOLD_COST}💰 + ${QUARANTINE_FOOD_COST}🍞`}">
          🏥 Quarantine (${QUARANTINE_GOLD_COST}💰 ${QUARANTINE_FOOD_COST}🍞)
        </button>
      </div>
    </div>`;
}

// ── Pilgrimage section (T162) ─────────────────────────────────────────────

function _pilgrimageSection() {
  if ((state.age ?? 0) < 1) return '';  // Bronze Age+ only
  const pg = state.pilgrimages;
  if (!pg) return '';

  // Active bonus display
  const bonus = pg.activeBonus;
  if (bonus && state.tick < bonus.expiresAt) {
    const secsLeft = Math.max(0, Math.ceil((bonus.expiresAt - state.tick) / TICKS_PER_SECOND));
    const label = bonus.type === 'artists'  ? '+0.5 gold/s' :
                  bonus.type === 'scholars' ? '+15% research speed' : '+0.3 mana/s';
    return `
      <div class="pilgrimage-section pilgrimage-section--bonus">
        <div class="pilgrimage-section__header">${bonus.icon} Pilgrimage Blessing Active</div>
        <div class="pilgrimage-section__desc">${label} — expires in <strong>${secsLeft}s</strong></div>
      </div>`;
  }

  // Pending pilgrim visit
  const pending = pg.pending;
  if (!pending) return '';

  const secsLeft = Math.max(0, Math.ceil((pending.expiresAt - state.tick) / TICKS_PER_SECOND));
  const canAfford = (state.resources?.gold ?? 0) >= 20 && (state.resources?.food ?? 0) >= 30;
  const hasBuilding = (state.buildings?.[pending.buildingId] ?? 0) > 0;
  const canHost = canAfford && hasBuilding;
  const btnClass = `btn btn--sm btn--pilgrimage${canHost ? '' : ' btn--disabled'}`;
  const reason = !hasBuilding ? `Requires ${pending.buildingId}` :
                 !canAfford  ? 'Need 20💰 + 30🍞' : 'Host pilgrims';

  return `
    <div class="pilgrimage-section pilgrimage-section--pending">
      <div class="pilgrimage-section__header">${pending.icon} ${pending.name} Arrive!</div>
      <div class="pilgrimage-section__desc">${pending.desc} Expires in <strong>${secsLeft}s</strong>.</div>
      <div class="pilgrimage-section__actions">
        <button class="${btnClass}" data-action="host-pilgrimage" title="${reason}">
          🏛️ Host (20💰 30🍞)
        </button>
      </div>
    </div>`;
}

// ── Royal Hunt section (T214) ────────────────────────────────────────────

function _royalHuntSection() {
  if ((state.age ?? 0) < 1) return '';  // Bronze Age+ only
  const hs = getRoyalHuntStatus();
  if (!hs.pending && !hs.active) return '';

  // Hunt underway
  if (hs.active) {
    return `
      <div class="hunt-section hunt-section--active">
        <div class="hunt-section__header">🦌 Royal Hunt Underway</div>
        <div class="hunt-section__desc">
          The hunting party is out in the field. Results in <strong>${hs.activeSecsLeft}s</strong>.
        </div>
      </div>`;
  }

  // Pending invitation
  const canAffordGold = (state.resources?.gold ?? 0) >= HUNT_GOLD_COST;
  const canAffordFood = (state.resources?.food ?? 0) >= HUNT_FOOD_COST;
  const canLaunch = canAffordGold && canAffordFood;
  const btnClass = `btn btn--sm btn--hunt${canLaunch ? '' : ' btn--disabled'}`;
  const reason = !canAffordGold ? `Need ${HUNT_GOLD_COST}💰`
               : !canAffordFood ? `Need ${HUNT_FOOD_COST}🍞`
               : 'Join the royal hunt';

  return `
    <div class="hunt-section hunt-section--pending">
      <div class="hunt-section__header">🦌 Royal Hunt Called!</div>
      <div class="hunt-section__desc">
        A hunting season has begun. Success grants +15 morale, +5 prestige, and a chance at iron.
        Expires in <strong>${hs.pendingSecsLeft}s</strong>.
      </div>
      <div class="hunt-section__actions">
        <button class="${btnClass}" data-action="launch-hunt" title="${reason}">
          🏹 Join Hunt (${HUNT_GOLD_COST}💰 ${HUNT_FOOD_COST}🍞)
        </button>
      </div>
    </div>`;
}

// ── Rebel section (T151) ─────────────────────────────────────────────────

function _rebelSection() {
  const rebels = getActiveRebels();
  if (rebels.length === 0) {
    // Show low-morale warning when morale is dangerously close to threshold
    const m = state.morale ?? 50;
    if (m >= 25 || state.age < 1) return '';
    return `
      <div class="rebel-section rebel-section--warning">
        <div class="rebel-section__header">⚠️ Unrest Warning</div>
        <div class="rebel-section__desc">Morale is critically low (${Math.round(m)}). If it stays below 25 a rebel uprising may occur!</div>
      </div>`;
  }

  const tileList = rebels.map(r => `(${r.x},${r.y})`).join(', ');
  return `
    <div class="rebel-section rebel-section--active">
      <div class="rebel-section__header">🔥 Rebel Uprising!</div>
      <div class="rebel-section__desc">${rebels.length} tile${rebels.length > 1 ? 's are' : ' is'} under rebel control: ${tileList}</div>
      <div class="rebel-section__hint">Open the Map tab and attack rebel tiles 🔥 to restore order. Each suppression grants +10 morale and +50 prestige.</div>
    </div>`;
}

// ── Bounty section (T135) ─────────────────────────────────────────────────

// ── Seasonal Objective section (T170) ────────────────────────────────────────

function _seasonalObjectiveSection() {
  const obj = getActiveSeasonalObjective();
  if (!obj) return '';

  const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];
  const seasonName   = SEASON_NAMES[obj.seasonIdx] ?? 'Season';

  return `
    <div class="seasonal-obj-section">
      <div class="seasonal-obj-header">${obj.icon} Seasonal Objective — ${seasonName}</div>
      <div class="seasonal-obj-card">
        <div class="seasonal-obj-card__top">
          <span class="seasonal-obj-card__icon">${obj.icon}</span>
          <span class="seasonal-obj-card__label">${obj.name}</span>
          <span class="seasonal-obj-card__coords">(${obj.x}, ${obj.y})</span>
        </div>
        <div class="seasonal-obj-card__desc">${obj.desc}</div>
        <div class="seasonal-obj-card__reward">Reward: ${obj.rewardDesc}</div>
        <div class="seasonal-obj-card__hint">Combat-capture this tile before the season ends!</div>
      </div>
    </div>`;
}

function _bountySection() {
  if (state.age < 1) return '';   // Bronze Age+ only

  const bounty = getActiveBounty();

  if (!bounty) {
    const b = state.bounty;
    if (!b) return '';
    const ticksLeft = (b.nextBountyTick ?? 0) - state.tick;
    if (ticksLeft <= 0) return '';
    const secsLeft = Math.ceil(ticksLeft / TICKS_PER_SECOND);
    const mins = Math.floor(secsLeft / 60);
    const secs = secsLeft % 60;
    const nextStr = mins > 0 ? `${mins}m ${String(secs).padStart(2,'0')}s` : `${secsLeft}s`;
    return `
      <div class="bounty-section">
        <div class="bounty-header">⭐ Territory Bounty</div>
        <div class="bounty-waiting">No active bounty. Next bounty in ~${nextStr}.</div>
      </div>`;
  }

  const secsLeft = getBountySecsLeft();
  const mins = Math.floor(secsLeft / 60);
  const secs = secsLeft % 60;
  const timeStr = mins > 0 ? `${mins}m ${String(secs).padStart(2,'0')}s` : `${secsLeft}s`;
  const urgent  = secsLeft <= 45;
  const rewardParts = Object.entries(bounty.reward).map(([r, a]) => `${a} ${r}`).join(' + ');

  return `
    <div class="bounty-section">
      <div class="bounty-header">⭐ Territory Bounty</div>
      <div class="bounty-card">
        <div class="bounty-card__top">
          <span class="bounty-card__icon">⭐</span>
          <span class="bounty-card__label">Capture (${bounty.x}, ${bounty.y})</span>
          <span class="bounty-card__timer${urgent ? ' bounty-card__timer--urgent' : ''}">
            ${timeStr}
          </span>
        </div>
        <div class="bounty-card__terrain">Terrain: ${bounty.terrain}</div>
        <div class="bounty-card__reward">Reward: ${rewardParts} + 60 prestige</div>
        <div class="bounty-card__hint">Combat-capture this tile to claim the bounty automatically!</div>
      </div>
    </div>`;
}

// ── Political event section ────────────────────────────────────────────────

function _politicalEventSection() {
  const pe = state.politicalEvents;
  if (!pe) return '';

  const pending = pe.pending;

  // Show recent log even if no pending event
  const logHtml = pe.log.length > 0 ? `
    <div class="pol-event-log">
      <div class="pol-event-log__header">Recent Decisions</div>
      ${pe.log.slice(0, 4).map(e => `
        <div class="pol-event-log__entry">
          ${e.icon} <strong>${_escHtml(e.title)}</strong>:
          ${_escHtml(e.choiceLabel)} — ${_escHtml(e.effect)}
        </div>
      `).join('')}
    </div>` : '';

  if (!pending) {
    if (pe.log.length === 0) return ''; // nothing to show at all
    return `<div class="pol-event-section">
      <div class="pol-event-header">👑 Political Events</div>
      <div class="pol-event-waiting">No active event. Next event within 5–10 min.</div>
      ${logHtml}
    </div>`;
  }

  const secsLeft  = getPoliticalEventSecsLeft();
  const minsLeft  = Math.floor(secsLeft / 60);
  const sLeft     = secsLeft % 60;
  const timeStr   = minsLeft > 0
    ? `${minsLeft}m ${String(sLeft).padStart(2, '0')}s`
    : `${sLeft}s`;
  const urgent    = secsLeft < 30;

  // Check affordability of each choice
  const canAffordA = Object.entries(pending.choiceA.cost ?? {}).every(
    ([r, a]) => (state.resources[r] ?? 0) >= a,
  );
  const canAffordB = Object.entries(pending.choiceB.cost ?? {}).every(
    ([r, a]) => (state.resources[r] ?? 0) >= a,
  );

  return `
    <div class="pol-event-section">
      <div class="pol-event-header">
        <span>👑 Political Event</span>
        <span class="pol-event-timer ${urgent ? 'pol-event-timer--urgent' : ''}">
          ⏱ ${timeStr} left
        </span>
      </div>
      <div class="pol-event-card">
        <div class="pol-event-title">${pending.icon} ${_escHtml(pending.title)}</div>
        <div class="pol-event-desc">${_escHtml(pending.desc)}</div>
        <div class="pol-event-choices">
          <div class="pol-event-choice">
            <span class="pol-event-choice__label">${_escHtml(pending.choiceA.label)}</span>
            <span class="pol-event-choice__effect">${_escHtml(pending.choiceA.effect)}</span>
            <button class="btn--pol-choice" data-pol-choice="a"
                    ${canAffordA ? '' : 'disabled'}>Choose A</button>
          </div>
          <div class="pol-event-choice">
            <span class="pol-event-choice__label">${_escHtml(pending.choiceB.label)}</span>
            <span class="pol-event-choice__effect">${_escHtml(pending.choiceB.effect)}</span>
            <button class="btn--pol-choice" data-pol-choice="b"
                    ${canAffordB ? '' : 'disabled'}>Choose B</button>
          </div>
        </div>
      </div>
      ${logHtml}
    </div>`;
}

// ── Challenge section ──────────────────────────────────────────────────────

function _challengeSection() {
  const ch = state.challenges;
  if (!ch) return '';

  const secsLeft = getChallengeSecsLeft();
  const minsLeft = Math.floor(secsLeft / 60);
  const sLeft    = secsLeft % 60;
  const timeStr  = minsLeft > 0
    ? `${minsLeft}m ${String(sLeft).padStart(2, '0')}s`
    : `${sLeft}s`;

  const nextSecs = !ch.active && ch.nextGenTick !== undefined
    ? Math.max(0, Math.ceil((ch.nextGenTick - (state.tick ?? 0)) / TICKS_PER_SECOND))
    : null;

  const recentDone = (ch.completed ?? []).slice(0, 5);

  return `
    <div class="challenge-section">
      <div class="challenge-header">
        <span class="challenge-header__title">🎯 Active Challenge</span>
      </div>

      ${ch.active ? `
        <div class="challenge-card challenge-card--active">
          <div class="challenge-card__top">
            <span class="challenge-card__icon">${ch.active.icon}</span>
            <span class="challenge-card__label">${_escHtml(ch.active.label)}</span>
            <span class="challenge-card__timer ${secsLeft < 30 ? 'challenge-card__timer--urgent' : ''}">
              ⏱️ ${timeStr}
            </span>
          </div>
          <div class="challenge-card__desc">${_escHtml(ch.active.desc)}</div>
          <div class="challenge-card__reward">
            Reward: <span class="challenge-reward-text">${_rewardStr(ch.active.reward)}</span>
          </div>
          ${_progressBar(ch.active)}
        </div>
      ` : `
        <div class="challenge-card challenge-card--waiting">
          <div class="challenge-card__waiting-text">
            ${nextSecs !== null && nextSecs > 0
              ? `⏳ Next challenge in ${nextSecs}s…`
              : '⏳ Generating next challenge…'
            }
          </div>
        </div>
      `}

      ${recentDone.length > 0 ? `
        <div class="challenge-completed">
          <div class="challenge-completed__header">Completed (${recentDone.length})</div>
          ${recentDone.map(c => `
            <div class="challenge-completed__entry">
              <span>${c.icon} ${_escHtml(c.label)}</span>
              <span class="challenge-completed__reward">${_rewardStr(c.reward)}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

function _progressBar(active) {
  const tpl = _metricFor(active.type);
  if (!tpl) return '';

  const cur    = tpl();
  const start  = active.startValue ?? 0;
  const target = active.target;
  const range  = target - start;

  // For absolute types (territory, gold, population, mana) measure from startValue
  const progress = range > 0 ? Math.min(1, Math.max(0, (cur - start) / range)) : (cur >= target ? 1 : 0);
  const pct      = Math.round(progress * 100);

  return `
    <div class="challenge-progress">
      <div class="progress-bar">
        <div class="progress-bar__fill progress-bar__fill--challenge" style="width:${pct}%"></div>
      </div>
      <span class="challenge-progress__label">${pct}%</span>
    </div>
  `;
}

// Map challenge type to a live metric snapshot function
function _metricFor(type) {
  switch (type) {
    case 'territory':
      return () => {
        if (!state.map) return 0;
        let c = 0;
        for (const row of state.map.tiles) for (const t of row) if (t.owner === 'player') c++;
        return c;
      };
    case 'gold':       return () => Math.floor(state.resources?.gold  ?? 0);
    case 'combat':     return () => state.combatHistory?.filter(h => h.outcome === 'win').length ?? 0;
    case 'population': return () => Math.floor(state.population?.count ?? 0);
    case 'mana':       return () => Math.floor(state.resources?.mana  ?? 0);
    default:           return null;
  }
}

function _rewardStr(reward) {
  return Object.entries(reward ?? {}).map(([r, a]) => `+${a} ${r}`).join(', ');
}

function _escHtml(str) {
  return (str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Quest cards ────────────────────────────────────────────────────────────

// ── T202: Epic Quest Chains section ────────────────────────────────────────

function _epicChainsSection() {
  if (!state.epicQuests) return '';

  const chainCards = CHAIN_ORDER.map(id => {
    const chain    = EPIC_CHAINS[id];
    const progress = state.epicQuests.chains[id];
    const pct      = Math.round(getChainProgress(id) * 100);
    const step     = progress.step;
    const completed = progress.completed;

    const steps = chain.steps.map((s, i) => {
      let cls = 'epic-chain__step';
      if (i < step)  cls += ' epic-chain__step--done';
      else if (i === step && !completed) cls += ' epic-chain__step--active';
      return `<li class="${cls}">${_escHtml(s.label)}</li>`;
    }).join('');

    const badgeHtml = completed
      ? `<div class="epic-chain__bonus-badge">✅ ${_escHtml(chain.rewardDesc)}</div>`
      : `<div class="epic-chain__reward">🏆 Reward: ${_escHtml(chain.rewardDesc)}</div>`;

    return `
      <div class="epic-chain ${completed ? 'epic-chain--completed' : ''}">
        <div class="epic-chain__header">
          <span>${chain.icon}</span>
          <span>${_escHtml(chain.name)}</span>
        </div>
        ${badgeHtml}
        <ul class="epic-chain__steps">${steps}</ul>
        <div class="epic-chain__progress-bar">
          <div class="epic-chain__progress-fill" style="width:${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="epic-chains-section">
      <div class="quest-header">
        <div class="quest-header__title">⚗️ Epic Quest Chains</div>
      </div>
      ${chainCards}
    </div>
  `;
}

function _questCard(q, completedTick) {
  const done      = completedTick !== undefined;
  const rewardStr = Object.entries(q.reward).map(([r, a]) => `+${a} ${r}`).join(', ');

  return `
    <div class="quest-card ${done ? 'quest-card--done' : 'quest-card--pending'}">
      <div class="quest-card__header">
        <span class="quest-card__icon">${q.icon}</span>
        <span class="quest-card__title">${q.title}</span>
        ${done ? '<span class="quest-card__check">✓</span>' : ''}
      </div>
      <div class="quest-card__desc">${q.desc}</div>
      <div class="quest-card__reward">Reward: <span class="quest-reward-text">${rewardStr}</span></div>
    </div>
  `;
}
