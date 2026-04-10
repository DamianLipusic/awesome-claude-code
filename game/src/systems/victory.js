/**
 * EmpireOS — Victory / Defeat system (T025).
 *
 * Win condition:  Medieval Age (3) + ≥80 player tiles + ≥10 quests completed.
 * Lose condition: food = 0 AND food rate negative for 120 consecutive ticks (30s).
 *
 * Fires Events.GAME_OVER { outcome, reason } and stops the tick loop.
 */

import { state }        from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { stopLoop }     from '../core/tick.js';
import { addMessage }   from '../core/actions.js';

// Win thresholds
const WIN_AGE       = 3;   // Medieval Age
const WIN_TILES     = 80;
const WIN_QUESTS    = 10;

// Starvation threshold (ticks at food=0 + negative rate before defeat)
const STARVE_TICKS = 120;  // 30 seconds

// Module-level state (not persisted — resets with new game via initVictory())
let _starvationTicks = 0;
let _warnedStarvation = false;
let _triggered = false;

/**
 * Reset victory-check module state for a new game.
 */
export function initVictory() {
  _starvationTicks  = 0;
  _warnedStarvation = false;
  _triggered        = false;
}

/**
 * Called once per tick by the main tick loop.
 * Checks win and lose conditions; fires GAME_OVER when met.
 */
export function victoryTick() {
  if (_triggered || state.gameOver) return;

  // ── Win check ──────────────────────────────────────────────────────────────
  if ((state.age ?? 0) >= WIN_AGE) {
    const tiles      = _countPlayerTiles();
    const questsDone = Object.keys(state.quests?.completed ?? {}).length;
    if (tiles >= WIN_TILES && questsDone >= WIN_QUESTS) {
      _trigger('win',
        'Your empire spans the known world, ushering in a golden age of civilization!');
      return;
    }
  }

  // ── Lose check: starvation ─────────────────────────────────────────────────
  if (state.resources.food <= 0 && (state.rates.food ?? 0) < 0) {
    _starvationTicks++;

    if (!_warnedStarvation && _starvationTicks >= 60) {
      _warnedStarvation = true;
      addMessage(
        '⚠️ Famine! Your people are starving — build Farms immediately or your empire will fall.',
        'disaster',
      );
    }

    if (_starvationTicks >= STARVE_TICKS) {
      _trigger('lose', 'Your people starved. The empire collapses into ruin.');
    }
  } else {
    // Food recovered — reset starvation counter
    if (_starvationTicks > 0) {
      _starvationTicks  = 0;
      _warnedStarvation = false;
    }
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _trigger(outcome, reason) {
  _triggered      = true;
  state.gameOver  = { outcome, reason, tick: state.tick };
  stopLoop();

  const msgType = outcome === 'win' ? 'quest' : 'raid';
  const prefix  = outcome === 'win' ? '🏆 VICTORY!' : '💀 DEFEAT!';
  addMessage(`${prefix} ${reason}`, msgType);

  emit(Events.GAME_OVER, { outcome, reason });
}

function _countPlayerTiles() {
  if (!state.map) return 0;
  let n = 0;
  for (const row of state.map.tiles)
    for (const tile of row)
      if (tile.owner === 'player') n++;
  return n;
}
