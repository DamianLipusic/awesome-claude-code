/**
 * EmpireOS — Season Performance Bonus (T197).
 *
 * At each season transition, reads the just-completed season chronicle
 * (completed[0] after SeasonChronicle's SEASON_CHANGED handler fires)
 * and awards morale + prestige based on that season's activity:
 *
 *   3+ battles won       → +2 morale per 3 wins (max +6)
 *   2+ buildings built   → +2 morale per 2 built (max +4)
 *   any tech researched  → +4 morale
 *   5+ tiles gained      → +3 morale per 5 tiles (max +6)
 *   any quest completed  → +3 morale
 *   no battles lost      → +2 morale (peaceful season bonus)
 *
 * Prestige = min(40, floor(season_score × 0.25))
 * where season_score = wins×5 + built×3 + techs×10 + tiles×2 + quests×5
 *
 * Subscribes to SEASON_CHANGED *after* SeasonChronicle (which runs first
 * because it is initialised earlier in boot()), so completed[0] is
 * already populated when this handler fires.
 */

import { state }        from '../core/state.js';
import { on, Events }   from '../core/events.js';
import { changeMorale } from './morale.js';
import { awardPrestige } from './prestige.js';
import { addMessage }   from '../core/actions.js';
import { showToast }    from '../ui/toastManager.js';

const TOAST_MS = 6000;

export function initSeasonPerformance() {
  on(Events.SEASON_CHANGED, _onSeasonChanged);
}

function _onSeasonChanged() {
  // SeasonChronicle already pushed the completed season to completed[0]
  const recap = state.seasonChronicle?.completed?.[0];
  if (!recap) return;

  const wins   = recap.battlesWon  ?? 0;
  const lost   = recap.battlesLost ?? 0;
  const built  = recap.built       ?? 0;
  const techs  = recap.techs       ?? 0;
  const tiles  = recap.tilesGained ?? 0;
  const quests = recap.quests      ?? 0;

  let moraleDelta   = 0;
  let prestigeDelta = 0;
  const parts       = [];

  if (wins >= 3) {
    const b = Math.min(6, Math.floor(wins / 3) * 2);
    moraleDelta += b;
    parts.push(`+${b}⚔️`);
  }
  if (built >= 2) {
    const b = Math.min(4, Math.floor(built / 2) * 2);
    moraleDelta += b;
    parts.push(`+${b}🏗️`);
  }
  if (techs > 0) {
    moraleDelta += 4;
    parts.push('+4🔬');
  }
  if (tiles >= 5) {
    const b = Math.min(6, Math.floor(tiles / 5) * 3);
    moraleDelta += b;
    parts.push(`+${b}🗺️`);
  }
  if (quests > 0) {
    moraleDelta += 3;
    parts.push('+3📜');
  }
  if (lost === 0 && moraleDelta > 0) {
    moraleDelta += 2;
    parts.push('+2☮️');
  }

  const scoreSum = wins * 5 + built * 3 + techs * 10 + tiles * 2 + quests * 5;
  if (scoreSum > 0) prestigeDelta = Math.min(40, Math.floor(scoreSum * 0.25));

  if (moraleDelta === 0 && prestigeDelta === 0) return;

  const icon = recap.seasonIcon ?? '📅';
  const name = recap.seasonName ?? 'Season';

  if (moraleDelta   > 0) changeMorale(moraleDelta);
  if (prestigeDelta > 0) awardPrestige(prestigeDelta, `${name} performance`);

  const moraleStr   = moraleDelta   > 0 ? `+${moraleDelta} morale`   : '';
  const prestigeStr = prestigeDelta > 0 ? `+${prestigeDelta} prestige` : '';
  const bonusStr    = [moraleStr, prestigeStr].filter(Boolean).join(', ');

  addMessage(
    `${icon} ${name} Performance: ${bonusStr} — ${wins}⚔️ ${built}🏗️ ${techs}🔬 ${tiles}🗺️ ${quests}📜`,
    'info'
  );

  if (parts.length > 0) {
    showToast(`${icon} ${name} Recap — ${bonusStr}  ${parts.slice(0, 4).join(' ')}`, 'windfall', TOAST_MS);
  }
}
