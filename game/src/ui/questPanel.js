/**
 * EmpireOS — Quest panel UI.
 * Renders all milestone objectives with completion status and rewards.
 */

import { state } from '../core/state.js';
import { on, Events } from '../core/events.js';
import { QUESTS, setQuestPanelRenderer } from '../systems/quests.js';

export function initQuestPanel() {
  const panel = document.getElementById('panel-quests');
  if (!panel) return;

  // Re-render whenever quests or related state changes
  const events = [
    Events.BUILDING_CHANGED, Events.UNIT_CHANGED, Events.TECH_CHANGED,
    Events.AGE_CHANGED, Events.MAP_CHANGED, Events.QUEST_COMPLETED,
  ];
  for (const ev of events) on(ev, render);

  // Give the quest system a reference so it can trigger re-renders too
  setQuestPanelRenderer(render);

  render();
}

function render() {
  const panel = document.getElementById('panel-quests');
  if (!panel) return;

  const completed    = state.quests?.completed ?? {};
  const doneCount    = Object.keys(completed).length;
  const total        = QUESTS.length;
  const pct          = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  panel.innerHTML = `
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
