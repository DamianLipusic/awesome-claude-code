/**
 * EmpireOS — Empire Score System (T046, T244).
 *
 * calcScore()         → total score number (pure derivation from state).
 * getScoreBreakdown() → array of labelled contribution objects.
 *
 * Base formula:
 *   territory   × 10   (player-owned tiles)
 *   buildings   × 3    (total individual buildings)
 *   units       × 2    (total individual units)
 *   techs       × 50   (researched technologies)
 *   quests      × 100  (completed quests)
 *   goldEarned  ÷ 100  (lifetime gold income, floored)
 *   age         × 200  (age index: 0=Stone … 3=Medieval)
 *
 * T244 additions:
 *   prestige    × 1    (direct prestige score points)
 *   battlesWon  × 8    (combat victories)
 *   seasons     × 25   (seasons survived, floor(tick/360))
 *   wonder      × 300  (1 if a wonder is completed)
 *   × difficulty multiplier (easy 0.75, normal 1.0, hard 1.5)
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
  // T244
  prestige:     1,   // direct prestige score
  battleWin:    8,   // per battle victory
  season:      25,   // per season survived
  wonder:     300,   // one-time wonder bonus
};

const DIFFICULTY_MULT = {
  easy:   0.75,
  normal: 1.00,
  hard:   1.50,
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

function _battlesWon() {
  return (state.combatHistory ?? []).filter(h => h.outcome === 'win').length;
}

function _seasonsElapsed() {
  return Math.floor((state.tick ?? 0) / 360); // 360 ticks per season
}

function _difficultyMult() {
  return DIFFICULTY_MULT[state.difficulty ?? 'normal'] ?? 1.0;
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

  // T244 additions
  const prestigePts = Math.floor((state.prestige?.score ?? 0) * W.prestige);
  const battlePts   = _battlesWon() * W.battleWin;
  const seasonPts   = _seasonsElapsed() * W.season;
  const wonderPts   = state.wonder?.completedId ? W.wonder : 0;

  const raw = (
    territory   * W.territory   +
    buildingCnt * W.building    +
    unitCnt     * W.unit        +
    techCnt     * W.tech        +
    questCnt    * W.quest       +
    goldPts                     +
    agePts                      +
    prestigePts                 +
    battlePts                   +
    seasonPts                   +
    wonderPts
  );

  return Math.floor(raw * _difficultyMult());
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

  // T244 additions
  const prestigeScore = Math.floor(state.prestige?.score ?? 0);
  const prestigePts   = Math.floor(prestigeScore * W.prestige);
  const battlesWon    = _battlesWon();
  const battlePts     = battlesWon * W.battleWin;
  const seasons       = _seasonsElapsed();
  const seasonPts     = seasons * W.season;
  const hasWonder     = !!state.wonder?.completedId;
  const mult          = _difficultyMult();
  const diffLabel     = state.difficulty === 'hard' ? ' ×1.5 (Hard)' : state.difficulty === 'easy' ? ' ×0.75 (Easy)' : '';

  const rows = [
    { label: '🗺️ Territory',   value: Math.floor(territory   * W.territory  * mult), detail: `${territory} tiles × ${W.territory}${diffLabel}` },
    { label: '🏗️ Buildings',   value: Math.floor(buildingCnt * W.building   * mult), detail: `${buildingCnt} built × ${W.building}` },
    { label: '⚔️ Military',    value: Math.floor(unitCnt     * W.unit       * mult), detail: `${unitCnt} units × ${W.unit}` },
    { label: '🔬 Research',    value: Math.floor(techCnt     * W.tech       * mult), detail: `${techCnt} techs × ${W.tech}` },
    { label: '🏆 Quests',      value: Math.floor(questCnt    * W.quest      * mult), detail: `${questCnt} done × ${W.quest}` },
    { label: '💰 Gold income', value: Math.floor(goldPts                    * mult), detail: `${goldEarned} earned ÷ ${W.goldDiv}` },
    { label: '🏛️ Age tier',   value: Math.floor(agePts                    * mult), detail: `Age ${age} × ${W.age}` },
    { label: '✨ Prestige',    value: Math.floor(prestigePts               * mult), detail: `${prestigeScore} prestige pts` },
    { label: '⚔️ Battles won', value: Math.floor(battlePts                 * mult), detail: `${battlesWon} wins × ${W.battleWin}` },
    { label: '🌸 Seasons',     value: Math.floor(seasonPts                 * mult), detail: `${seasons} seasons × ${W.season}` },
    { label: '🏛️ Wonder',      value: hasWonder ? Math.floor(W.wonder      * mult) : 0, detail: hasWonder ? '1 wonder built' : 'No wonder built' },
  ];

  return rows;
}
