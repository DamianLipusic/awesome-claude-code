/**
 * EmpireOS — Empire Score System (T046).
 *
 * calcScore()         → total score number (pure derivation from state).
 * getScoreBreakdown() → array of labelled contribution objects.
 *
 * Formula:
 *   territory   × 10   (player-owned tiles)
 *   buildings   × 3    (total individual buildings)
 *   units       × 2    (total individual units)
 *   techs       × 50   (researched technologies)
 *   quests      × 100  (completed quests)
 *   goldEarned  ÷ 100  (lifetime gold income, floored)
 *   age         × 200  (age index: 0=Stone … 3=Medieval)
 */

import { state } from '../core/state.js';

const W = {
  territory:   10,
  building:     3,
  unit:         2,
  tech:        50,
  quest:      100,
  goldDiv:    100,   // 1 point per 100 gold earned
  age:        200,
};

// ── Helpers ────────────────────────────────────────────────────────────────

function _playerTileCount() {
  if (!state.map) return 9; // default 3×3 capital before map init
  let n = 0;
  for (const row of state.map.tiles)
    for (const tile of row)
      if (tile.owner === 'player') n++;
  return n;
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Returns the total empire score as a whole number. */
export function calcScore() {
  const territory   = _playerTileCount();
  const buildingCnt = Object.values(state.buildings ?? {}).reduce((a, b) => a + b, 0);
  const unitCnt     = Object.values(state.units     ?? {}).reduce((a, b) => a + b, 0);
  const techCnt     = Object.keys(state.techs       ?? {}).length;
  const questCnt    = Object.keys(state.quests?.completed ?? {}).length;
  const goldPts     = Math.floor((state.stats?.goldEarned ?? 0) / W.goldDiv);
  const agePts      = (state.age ?? 0) * W.age;

  return (
    territory   * W.territory   +
    buildingCnt * W.building    +
    unitCnt     * W.unit        +
    techCnt     * W.tech        +
    questCnt    * W.quest       +
    goldPts                     +
    agePts
  );
}

/**
 * Returns an array of score contribution rows for the summary breakdown card.
 * Each row: { label, value, detail }
 */
export function getScoreBreakdown() {
  const territory   = _playerTileCount();
  const buildingCnt = Object.values(state.buildings ?? {}).reduce((a, b) => a + b, 0);
  const unitCnt     = Object.values(state.units     ?? {}).reduce((a, b) => a + b, 0);
  const techCnt     = Object.keys(state.techs       ?? {}).length;
  const questCnt    = Object.keys(state.quests?.completed ?? {}).length;
  const goldEarned  = Math.floor(state.stats?.goldEarned ?? 0);
  const goldPts     = Math.floor(goldEarned / W.goldDiv);
  const age         = state.age ?? 0;
  const agePts      = age * W.age;

  return [
    { label: '🗺️ Territory',   value: territory   * W.territory,  detail: `${territory} tiles × ${W.territory}` },
    { label: '🏗️ Buildings',   value: buildingCnt * W.building,   detail: `${buildingCnt} built × ${W.building}` },
    { label: '⚔️ Military',    value: unitCnt     * W.unit,       detail: `${unitCnt} units × ${W.unit}` },
    { label: '🔬 Research',    value: techCnt     * W.tech,       detail: `${techCnt} techs × ${W.tech}` },
    { label: '🏆 Quests',      value: questCnt    * W.quest,      detail: `${questCnt} done × ${W.quest}` },
    { label: '💰 Gold income', value: goldPts,                    detail: `${goldEarned} earned ÷ ${W.goldDiv}` },
    { label: '🏛️ Age tier',   value: agePts,                     detail: `Age ${age} × ${W.age}` },
  ];
}
