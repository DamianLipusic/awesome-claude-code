/**
 * EmpireOS — Victory / Defeat system (T025, T069).
 *
 * Three win paths:
 *   Conquest    — Medieval Age (3) + ≥80 player tiles + ≥10 quests completed.
 *   Diplomatic  — All 3 AI empires allied simultaneously (T069).
 *   Economic    — 50 000 lifetime gold earned + Economics tech researched (T069).
 *
 * Lose condition: food = 0 AND food rate negative for 120 consecutive ticks (30s).
 *
 * Fires Events.GAME_OVER { outcome, reason, victoryType } and stops the tick loop.
 */

import { state }        from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { stopLoop }     from '../core/tick.js';
import { addMessage }   from '../core/actions.js';

// ── Conquest win thresholds ───────────────────────────────────────────────────
export const WIN_AGE       = 3;   // Medieval Age
export const WIN_TILES     = 80;
export const WIN_QUESTS    = 10;

// ── Diplomatic win threshold ──────────────────────────────────────────────────
export const WIN_DIPLOMATIC_ALLIANCES = 3;   // all AI empires allied simultaneously

// ── Economic win thresholds ───────────────────────────────────────────────────
export const WIN_ECONOMIC_GOLD = 50_000;   // lifetime gold earned (exported for summaryPanel)

// ── Starvation threshold ─────────────────────────────────────────────────────
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

  // ── Diplomatic victory: all AI empires allied ─────────────────────────────
  if (state.diplomacy?.empires) {
    const alliedCount = state.diplomacy.empires.filter(e => e.relations === 'allied').length;
    if (alliedCount >= WIN_DIPLOMATIC_ALLIANCES) {
      _trigger('win',
        'Through masterful diplomacy, you forged alliances with all rival empires, ushering in an era of unprecedented peace!',
        'diplomatic');
      return;
    }
  }

  // ── Economic victory: 50k gold earned + Economics tech ───────────────────
  if (state.techs?.economics && (state.stats?.goldEarned ?? 0) >= WIN_ECONOMIC_GOLD) {
    _trigger('win',
      'Your merchant empire dominates all trade. Gold flows from every corner of the known world!',
      'economic');
    return;
  }

  // ── Conquest victory: Medieval Age + territory + quests ──────────────────
  if ((state.age ?? 0) >= WIN_AGE) {
    const tiles      = _countPlayerTiles();
    const questsDone = Object.keys(state.quests?.completed ?? {}).length;
    if (tiles >= WIN_TILES && questsDone >= WIN_QUESTS) {
      _trigger('win',
        'Your empire spans the known world, ushering in a golden age of civilization!',
        'conquest');
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
      _trigger('lose', 'Your people starved. The empire collapses into ruin.', 'starvation');
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

function _trigger(outcome, reason, victoryType = 'conquest') {
  _triggered      = true;
  state.gameOver  = { outcome, reason, tick: state.tick, victoryType };
  stopLoop();

  const msgType = outcome === 'win' ? 'quest' : 'raid';
  const prefix  = outcome === 'win' ? '🏆 VICTORY!' : '💀 DEFEAT!';
  addMessage(`${prefix} ${reason}`, msgType);

  emit(Events.GAME_OVER, { outcome, reason, victoryType });
}

function _countPlayerTiles() {
  if (!state.map) return 0;
  let n = 0;
  for (const row of state.map.tiles)
    for (const tile of row)
      if (tile.owner === 'player') n++;
  return n;
}
