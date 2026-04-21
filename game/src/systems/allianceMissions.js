/**
 * EmpireOS — Alliance Missions System (T142).
 *
 * When the player is allied with an AI empire, that empire will periodically
 * (every 8–12 minutes) assign a small mission.  The player has 5 minutes to
 * complete it.  Success awards gold + prestige + a diplomatic history entry.
 * Failure is silent — a new mission is scheduled after the window closes.
 *
 * Three mission types:
 *   battle_wins   — win N (2–4) combat battles while the mission is active
 *   earn_gold     — accumulate N (300–800) additional gold above the baseline
 *   research_tech — complete any technology research
 *
 * Integration points:
 *   main.js            — imports initAllianceMissions + allianceMissionTick;
 *                        hooks MAP_CHANGED / RESOURCE_CHANGED / TECH_CHANGED
 *                        to checkMissionProgress()
 *   ui/diplomacyPanel.js — _missionRow(emp) injected into allied empire cards
 */

import { state }    from '../core/state.js';
import { emit, on, Events }  from '../core/events.js';
import { EMPIRES }  from '../data/empires.js';
import { addMessage } from '../core/actions.js';
import { awardPrestige } from './prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Constants ────────────────────────────────────────────────────────────────

const SPAWN_MIN_TICKS  = 8  * 60 * TICKS_PER_SECOND;  // 1920 ticks (8 min)
const SPAWN_MAX_TICKS  = 12 * 60 * TICKS_PER_SECOND;  // 2880 ticks (12 min)
const MISSION_DURATION = 5  * 60 * TICKS_PER_SECOND;  // 1200 ticks (5 min)
export const MISSION_PRESTIGE = 30;

// ── Internal helpers ──────────────────────────────────────────────────────────

function _randBetween(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function _nextTick() {
  return (state.tick ?? 0) + SPAWN_MIN_TICKS +
    Math.floor(Math.random() * (SPAWN_MAX_TICKS - SPAWN_MIN_TICKS));
}

/** Pick a random mission type and parameters for the given empire. */
function _buildMission(empireId) {
  const types = ['battle_wins', 'earn_gold', 'research_tech'];
  const type  = types[Math.floor(Math.random() * types.length)];

  const empDef = EMPIRES[empireId];
  const goldReward = _randBetween(150, 250);

  if (type === 'battle_wins') {
    const target = _randBetween(2, 4);
    return {
      type,
      target,
      progress:   0,                 // battles won since mission started
      baseline:   null,              // unused
      expiresAt:  state.tick + MISSION_DURATION,
      goldReward,
      label:      `Win ${target} battle${target > 1 ? 's' : ''}`,
      desc:       `${empDef?.name ?? 'Your ally'} calls on your military prowess.`,
    };
  }

  if (type === 'earn_gold') {
    const extra  = _randBetween(300, 800);
    const target = Math.floor((state.resources?.gold ?? 0) + extra);
    return {
      type,
      target,
      progress:   state.resources?.gold ?? 0,   // gold baseline at mission start
      baseline:   state.resources?.gold ?? 0,
      expiresAt:  state.tick + MISSION_DURATION,
      goldReward,
      label:      `Accumulate ${extra} gold`,
      desc:       `${empDef?.name ?? 'Your ally'} needs proof of your economic strength.`,
    };
  }

  // research_tech
  return {
    type:       'research_tech',
    target:     1,
    progress:   0,                 // 0 or 1
    baseline:   null,
    expiresAt:  state.tick + MISSION_DURATION,
    goldReward,
    label:      'Research any technology',
    desc:       `${empDef?.name ?? 'Your ally'} seeks to learn from your scholars.`,
  };
}

/** Award mission success rewards. */
function _completeMission(empireId, mission) {
  const empState  = state.allianceMissions[empireId];
  const empDef    = EMPIRES[empireId];

  empState.active = null;
  empState.nextMissionTick = _nextTick();
  empState.totalCompleted  = (empState.totalCompleted ?? 0) + 1;

  // Award gold (capped)
  const goldCap = state.caps?.gold ?? 500;
  state.resources.gold = Math.min(goldCap, (state.resources?.gold ?? 0) + mission.goldReward);

  awardPrestige(MISSION_PRESTIGE, `alliance mission for ${empireId}`);

  // Diplomatic history entry
  if (state.diplomacy) {
    const emp = state.diplomacy.empires.find(e => e.id === empireId);
    if (emp) {
      if (!emp.history) emp.history = [];
      emp.history.unshift({
        type: 'mission',
        text: `✅ Mission completed: "${mission.label}". Received +${mission.goldReward} gold.`,
        tick: state.tick,
        empireId,
      });
      while (emp.history.length > 25) emp.history.pop();
    }
  }

  emit(Events.RESOURCE_CHANGED, {});
  emit(Events.ALLIANCE_MISSION, { type: 'completed', empireId });
  addMessage(
    `✅ Alliance Mission complete (${empDef?.name ?? empireId}): "${mission.label}" — +${mission.goldReward} gold, +${MISSION_PRESTIGE} prestige!`,
    'windfall',
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Initialise (or migrate) alliance mission state. */
export function initAllianceMissions() {
  if (!state.allianceMissions) {
    state.allianceMissions = {};
  }
  // Ensure each empire has an entry (migration + new-game setup)
  const EMPIRE_IDS = ['ironHorde', 'mageCouncil', 'seaWolves'];
  for (const id of EMPIRE_IDS) {
    if (!state.allianceMissions[id]) {
      state.allianceMissions[id] = {
        active:           null,
        nextMissionTick:  _nextTick(),
        totalCompleted:   0,
      };
    }
  }
}

/**
 * Called once per tick.  Expires stale missions and assigns new ones for
 * currently-allied empires.
 */
export function allianceMissionTick() {
  if (!state.diplomacy || !state.allianceMissions) return;

  for (const emp of state.diplomacy.empires) {
    const empState = state.allianceMissions[emp.id];
    if (!empState) continue;

    const mission = empState.active;

    // Expire overdue missions silently
    if (mission && state.tick >= mission.expiresAt) {
      empState.active = null;
      empState.nextMissionTick = _nextTick();
      emit(Events.ALLIANCE_MISSION, { type: 'expired', empireId: emp.id });
    }

    // Spawn new mission for allied empires when cooldown elapsed
    if (!empState.active && emp.relations === 'allied' &&
        state.tick >= empState.nextMissionTick) {
      const newMission = _buildMission(emp.id);
      empState.active = newMission;
      const empDef = EMPIRES[emp.id];
      addMessage(
        `📜 Alliance Mission from ${empDef?.name ?? emp.id}: "${newMission.label}" — ${newMission.goldReward} gold reward. 5 min window.`,
        'info',
      );
      emit(Events.ALLIANCE_MISSION, { type: 'assigned', empireId: emp.id });
    }
  }
}

/**
 * Check mission progress when a relevant game event fires.
 * @param {'map'|'resource'|'tech'} eventType  which event triggered this call
 */
export function checkMissionProgress(eventType) {
  if (!state.diplomacy || !state.allianceMissions) return;

  for (const emp of state.diplomacy.empires) {
    const empState = state.allianceMissions[emp.id];
    const mission  = empState?.active;
    if (!mission) continue;
    if (emp.relations !== 'allied') continue;

    let completed = false;

    if (mission.type === 'battle_wins' && eventType === 'map') {
      // progress tracked via trackMissionBattleWin(); check target here
      if (mission.progress >= mission.target) completed = true;
    }

    if (mission.type === 'earn_gold' && eventType === 'resource') {
      const currentGold = state.resources?.gold ?? 0;
      if (currentGold >= mission.target) completed = true;
    }

    if (mission.type === 'research_tech' && eventType === 'tech') {
      mission.progress = 1;
      completed = true;
    }

    if (completed) _completeMission(emp.id, mission);
  }
}

/**
 * Called from combat._victory() for each player combat win.
 * Increments battle_wins progress for any active allied mission.
 */
export function trackMissionBattleWin() {
  if (!state.allianceMissions) return;
  for (const [, empState] of Object.entries(state.allianceMissions)) {
    const mission = empState?.active;
    if (mission?.type === 'battle_wins') {
      mission.progress = (mission.progress ?? 0) + 1;
    }
  }
}

/**
 * Returns seconds remaining on the active mission for empireId, or 0.
 */
export function missionSecsLeft(empireId) {
  const mission = state.allianceMissions?.[empireId]?.active;
  if (!mission) return 0;
  return Math.max(0, Math.ceil((mission.expiresAt - (state.tick ?? 0)) / TICKS_PER_SECOND));
}

/**
 * Returns seconds until the next mission will be assigned for empireId, or 0.
 */
export function missionNextSecs(empireId) {
  const empState = state.allianceMissions?.[empireId];
  if (!empState || empState.active) return 0;
  return Math.max(0, Math.ceil((empState.nextMissionTick - (state.tick ?? 0)) / TICKS_PER_SECOND));
}
