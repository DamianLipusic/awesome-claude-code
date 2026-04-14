/**
 * EmpireOS — Quest panel UI.
 * Renders milestone objectives and the active dynamic challenge.
 */

import { state } from '../core/state.js';
import { on, Events } from '../core/events.js';
import { QUESTS, setQuestPanelRenderer } from '../systems/quests.js';
import { getChallengeSecsLeft } from '../systems/challenges.js';
import { resolvePoliticalEvent, getPoliticalEventSecsLeft } from '../systems/politicalEvents.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

export function initQuestPanel() {
  const panel = document.getElementById('panel-quests');
  if (!panel) return;

  // Re-render on quest/challenge/state changes
  const events = [
    Events.BUILDING_CHANGED, Events.UNIT_CHANGED, Events.TECH_CHANGED,
    Events.AGE_CHANGED, Events.MAP_CHANGED, Events.QUEST_COMPLETED,
    Events.CHALLENGE_UPDATED, Events.POPULATION_CHANGED, Events.RESOURCE_CHANGED,
    Events.POLITICAL_EVENT,
  ];
  for (const ev of events) on(ev, render);

  // Refresh challenge + political-event countdown every second via TICK
  let _tickCount = 0;
  on(Events.TICK, () => {
    if (++_tickCount % TICKS_PER_SECOND === 0) {
      const ch = state.challenges?.active;
      const pe = state.politicalEvents?.pending;
      if (ch || pe) render();
    }
  });

  // Delegate click events for political event choice buttons
  panel.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pol-choice]');
    if (!btn) return;
    const choice = btn.dataset.polChoice;
    const result = resolvePoliticalEvent(choice);
    if (!result.ok) {
      btn.title = result.reason ?? 'Cannot choose that option.';
      btn.classList.add('btn--shake');
      setTimeout(() => btn.classList.remove('btn--shake'), 500);
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
  `;
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
