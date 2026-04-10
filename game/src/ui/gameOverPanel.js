/**
 * EmpireOS — Game-over overlay UI (T025).
 * Shown on win or defeat. Displays session stats and a Play Again button.
 */

import { state }        from '../core/state.js';
import { on, Events }   from '../core/events.js';
import { fmtTime }      from '../utils/fmt.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const AGE_NAMES = ['Stone Age', 'Bronze Age', 'Iron Age', 'Medieval Age'];

export function initGameOverPanel(onNewGame) {
  const overlay = document.createElement('div');
  overlay.id = 'game-over-overlay';
  overlay.className = 'game-over-overlay game-over-overlay--hidden';
  document.body.appendChild(overlay);

  on(Events.GAME_OVER, ({ outcome, reason }) => {
    _render(overlay, outcome, reason, onNewGame);
    overlay.classList.remove('game-over-overlay--hidden');
  });
}

function _render(overlay, outcome, reason, onNewGame) {
  const isWin      = outcome === 'win';
  const tiles      = _countPlayerTiles();
  const questsDone = Object.keys(state.quests?.completed ?? {}).length;
  const totalQuests = 11;
  const secs       = Math.floor(state.tick / TICKS_PER_SECOND);
  const timeStr    = fmtTime(secs);
  const goldEarned = Math.floor(state.stats?.goldEarned ?? 0).toLocaleString();
  const ageName    = AGE_NAMES[state.age ?? 0] ?? 'Stone Age';

  overlay.innerHTML = `
    <div class="game-over-box game-over-box--${outcome}">
      <div class="game-over-icon">${isWin ? '🏆' : '💀'}</div>
      <h2 class="game-over-title">${isWin ? 'VICTORY!' : 'DEFEAT'}</h2>
      <p class="game-over-reason">${reason}</p>

      <div class="game-over-stats">
        <div class="game-over-stat">
          <span class="go-stat-label">Age Reached</span>
          <span class="go-stat-value">${ageName}</span>
        </div>
        <div class="game-over-stat">
          <span class="go-stat-label">Territory</span>
          <span class="go-stat-value">${tiles} tiles</span>
        </div>
        <div class="game-over-stat">
          <span class="go-stat-label">Quests</span>
          <span class="go-stat-value">${questsDone} / ${totalQuests}</span>
        </div>
        <div class="game-over-stat">
          <span class="go-stat-label">Gold Earned</span>
          <span class="go-stat-value">${goldEarned}</span>
        </div>
        <div class="game-over-stat">
          <span class="go-stat-label">Time Played</span>
          <span class="go-stat-value">${timeStr}</span>
        </div>
      </div>

      <button class="btn btn--advance game-over-btn" id="btn-game-over-again">
        ${isWin ? '🎮 Play Again' : '🔄 Try Again'}
      </button>
    </div>
  `;

  overlay.querySelector('#btn-game-over-again').addEventListener('click', () => {
    overlay.classList.add('game-over-overlay--hidden');
    onNewGame();
  });
}

function _countPlayerTiles() {
  if (!state.map) return 0;
  let n = 0;
  for (const row of state.map.tiles)
    for (const tile of row)
      if (tile.owner === 'player') n++;
  return n;
}
