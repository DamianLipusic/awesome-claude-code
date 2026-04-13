/**
 * EmpireOS — Espionage system (T060).
 *
 * Requires the 'espionage' tech (listed in techs.js).
 *
 * Missions (one at a time, 60-second cooldown between missions):
 *
 *   gold_heist   — Steal gold from an enemy empire.
 *                  Success: gain 150–350 gold.
 *                  Failure: lose 50 gold (counter-bribe).
 *
 *   sabotage     — Sabotage a rival's production.
 *                  Success: boost player morale +8 and log a story entry.
 *                  Failure: enemy counter-attack raid (steals 200–400 gold).
 *
 *   intel        — Gather intelligence on an empire.
 *                  Success: reveal their tile count, relations, and army strength.
 *                  Failure: lose 30 gold (blown cover).
 *
 * Success chance (base 60 %):
 *   - Each alliance with a different empire:  +5 %
 *   - Currently at war with the target:      −10 %
 *   - Target is 'war' relation:               no change to base
 *   - 'counterintelligence' tech (future):   reserved
 *
 * Espionage log stored in state.espionage.log (last 20 entries).
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';
import { changeMorale } from './morale.js';
import { EMPIRES } from '../data/empires.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// Cooldown in ticks (60 seconds)
export const ESPIONAGE_COOLDOWN = 60 * TICKS_PER_SECOND;

// Mission costs (gold)
const COST = {
  gold_heist: 50,
  sabotage:   75,
  intel:      30,
};

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Initialise espionage state. Idempotent — safe to call on every new game.
 */
export function initEspionage() {
  if (!state.espionage) {
    state.espionage = {
      cooldownUntil: 0,   // tick when next mission becomes available
      log:           [],  // [{ tick, mission, empireId, success, text }]
    };
  }
  // Migrate older saves
  if (!state.espionage.log) state.espionage.log = [];
  if (state.espionage.cooldownUntil === undefined) state.espionage.cooldownUntil = 0;
}

/**
 * Check whether a mission can be launched right now.
 * Returns { ok: true } or { ok: false, reason: string }.
 */
export function canLaunchMission(missionId) {
  if (!state.techs?.espionage) {
    return { ok: false, reason: 'Research the Espionage tech first.' };
  }
  const cost = COST[missionId] ?? 0;
  if ((state.resources?.gold ?? 0) < cost) {
    return { ok: false, reason: `Not enough gold (need ${cost}).` };
  }
  if (state.tick < (state.espionage?.cooldownUntil ?? 0)) {
    const secsLeft = Math.ceil((state.espionage.cooldownUntil - state.tick) / TICKS_PER_SECOND);
    return { ok: false, reason: `Spy network on cooldown — ${secsLeft}s remaining.` };
  }
  return { ok: true };
}

/**
 * Launch a spy mission against a specific empire.
 * @param {'gold_heist'|'sabotage'|'intel'} missionId
 * @param {string} empireId  — one of the keys in EMPIRES
 * @returns {{ ok: boolean, reason?: string }}
 */
export function launchMission(missionId, empireId) {
  const check = canLaunchMission(missionId);
  if (!check.ok) return check;

  const empDef = EMPIRES[empireId];
  if (!empDef) return { ok: false, reason: 'Unknown empire.' };

  const emp = state.diplomacy?.empires?.find(e => e.id === empireId);
  if (!emp) return { ok: false, reason: 'Empire not found in diplomacy state.' };

  // Deduct cost
  const cost = COST[missionId] ?? 0;
  state.resources.gold = Math.max(0, (state.resources.gold ?? 0) - cost);
  emit(Events.RESOURCE_CHANGED, {});

  // Set cooldown
  state.espionage.cooldownUntil = state.tick + ESPIONAGE_COOLDOWN;

  // Resolve success
  const success = Math.random() < _successChance(emp);
  const logEntry = _resolve(missionId, emp, empDef, success);

  // Record in log (newest first, cap at 20)
  state.espionage.log.unshift(logEntry);
  if (state.espionage.log.length > 20) state.espionage.log.pop();

  emit(Events.ESPIONAGE_EVENT, logEntry);
  return { ok: true };
}

/**
 * Cooldown seconds remaining (0 if ready).
 */
export function espionageCooldownSecs() {
  if (!state.espionage) return 0;
  return Math.max(0, Math.ceil((state.espionage.cooldownUntil - state.tick) / TICKS_PER_SECOND));
}

/** Human-readable mission label. */
export const MISSION_LABELS = {
  gold_heist: '💰 Gold Heist',
  sabotage:   '💣 Sabotage',
  intel:      '🔭 Gather Intel',
};

/** Mission descriptions for tooltip. */
export const MISSION_DESCS = {
  gold_heist: `Steal 150–350 gold from an enemy treasury. Costs ${COST.gold_heist} gold. Failure loses ${50} gold.`,
  sabotage:   `Sabotage a rival's supply lines, boosting your army morale +8. Costs ${COST.sabotage} gold. Failure triggers a counter-raid.`,
  intel:      `Gather intelligence on a rival — reveals their territory, army, and relations. Costs ${COST.intel} gold. Failure loses ${30} gold.`,
};

// ── Internal helpers ───────────────────────────────────────────────────────

function _successChance(emp) {
  let chance = 0.60;
  // Alliance bonus
  const alliedCount = state.diplomacy?.empires?.filter(e => e.relations === 'allied').length ?? 0;
  chance += alliedCount * 0.05;
  // At war with target: harder to infiltrate
  if (emp.relations === 'war') chance -= 0.10;
  return Math.max(0.15, Math.min(0.90, chance));
}

function _resolve(missionId, emp, empDef, success) {
  let text = '';

  if (missionId === 'gold_heist') {
    if (success) {
      const loot = Math.round(150 + Math.random() * 200);
      state.resources.gold = Math.min(
        state.caps?.gold ?? 500,
        (state.resources.gold ?? 0) + loot
      );
      emit(Events.RESOURCE_CHANGED, {});
      text = `🕵️ Spy heist on ${empDef.name} succeeded! Stole ${loot} gold.`;
      addMessage(text, 'info');
    } else {
      const penalty = 50;
      state.resources.gold = Math.max(0, (state.resources.gold ?? 0) - penalty);
      emit(Events.RESOURCE_CHANGED, {});
      text = `🕵️ Spy heist on ${empDef.name} failed. Spy was bribed — lost ${penalty} gold.`;
      addMessage(text, 'raid');
    }
  }

  else if (missionId === 'sabotage') {
    if (success) {
      changeMorale(8);
      text = `🕵️ Sabotage of ${empDef.name} succeeded! Supply lines disrupted — morale up.`;
      addMessage(text, 'info');
    } else {
      // Counter-raid: enemy steals gold
      const stolen = Math.round(200 + Math.random() * 200);
      state.resources.gold = Math.max(0, (state.resources.gold ?? 0) - stolen);
      emit(Events.RESOURCE_CHANGED, {});
      text = `🕵️ Sabotage on ${empDef.name} failed! Counter-agents raided your treasury for ${stolen} gold.`;
      addMessage(text, 'raid');
    }
  }

  else if (missionId === 'intel') {
    if (success) {
      // Count empire tiles
      let tileCnt = 0;
      if (state.map) {
        for (const row of state.map.tiles) {
          for (const tile of row) {
            if (tile.owner === emp.id) tileCnt++;
          }
        }
      }
      const relLabel = { neutral: 'neutral', allied: 'allied', war: 'at war' }[emp.relations] ?? emp.relations;
      text = `🕵️ Intel on ${empDef.name}: ${tileCnt} tiles, relation: ${relLabel}, war score: ${emp.warScore ?? 0}.`;
      addMessage(text, 'info');
    } else {
      const penalty = 30;
      state.resources.gold = Math.max(0, (state.resources.gold ?? 0) - penalty);
      emit(Events.RESOURCE_CHANGED, {});
      text = `🕵️ Intel mission on ${empDef.name} blown! Spy extracted — lost ${penalty} gold.`;
      addMessage(text, 'raid');
    }
  }

  return { tick: state.tick, mission: missionId, empireId: emp.id, success, text };
}
