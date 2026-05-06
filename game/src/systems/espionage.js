/**
 * EmpireOS — Espionage system (T060, T213).
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
 *   tech_theft   — Steal technology blueprints from a rival (T213).
 *                  Requires Intelligence Bureau (spy network level 2+).
 *                  Success: queues a random unresearched tech at 40–60% completion.
 *                  Failure: lose 80 gold and diplomatic trust damaged.
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
import { TECHS } from '../data/techs.js'; // T213: tech theft mission

// Cooldown in ticks (60 seconds base)
export const ESPIONAGE_COOLDOWN = 60 * TICKS_PER_SECOND;

// Mission costs (gold)
const COST = {
  gold_heist: 50,
  sabotage:   75,
  intel:      30,
  tech_theft: 100, // T213: tech theft requires Intelligence Bureau (network level 2+)
};

// T113: Spy network upgrade levels
export const NETWORK_LEVELS = [
  { level: 0, name: 'Basic Spy Ring',        cost: 0,   successBonus: 0,    cooldownRedSecs: 0,  heistBonus: 0,  counterspy: false },
  { level: 1, name: 'Agent Network',         cost: 150, successBonus: 0.15, cooldownRedSecs: 15, heistBonus: 0,  counterspy: false },
  { level: 2, name: 'Intelligence Bureau',   cost: 300, successBonus: 0.25, cooldownRedSecs: 30, heistBonus: 0,  counterspy: true  },
  { level: 3, name: 'Shadow Ministry',       cost: 600, successBonus: 0.35, cooldownRedSecs: 45, heistBonus: 100, counterspy: true },
];

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Initialise espionage state. Idempotent — safe to call on every new game.
 */
export function initEspionage() {
  if (!state.espionage) {
    state.espionage = {
      cooldownUntil: 0,   // tick when next mission becomes available
      log:           [],  // [{ tick, mission, empireId, success, text }]
      networkLevel:  0,   // T113: spy network upgrade level (0-3)
    };
  }
  // Migrate older saves
  if (!state.espionage.log)                       state.espionage.log           = [];
  if (state.espionage.cooldownUntil === undefined) state.espionage.cooldownUntil = 0;
  if (state.espionage.networkLevel  === undefined) state.espionage.networkLevel  = 0;  // T113
}

/**
 * T113: Upgrade the spy network to the next level.
 * Requires espionage tech. Costs increase per level.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function upgradeSpyNetwork() {
  if (!state.techs?.espionage)
    return { ok: false, reason: 'Research the Espionage tech first.' };

  const currentLevel = state.espionage?.networkLevel ?? 0;
  const nextDef = NETWORK_LEVELS[currentLevel + 1];
  if (!nextDef)
    return { ok: false, reason: 'Spy network is already at maximum level.' };

  if ((state.resources?.gold ?? 0) < nextDef.cost)
    return { ok: false, reason: `Need ${nextDef.cost} gold to upgrade.` };

  state.resources.gold -= nextDef.cost;
  state.espionage.networkLevel = nextDef.level;

  emit(Events.RESOURCE_CHANGED, {});
  emit(Events.ESPIONAGE_EVENT, { type: 'upgrade', level: nextDef.level, name: nextDef.name });
  addMessage(`🕵️ Spy network upgraded to ${nextDef.name}! ${_networkBenefitDesc(nextDef)}`, 'info');
  return { ok: true };
}

/** Human-readable description of the benefits of a network level def. */
function _networkBenefitDesc(def) {
  const parts = [`+${Math.round(def.successBonus * 100)}% mission success`];
  if (def.cooldownRedSecs > 0) parts.push(`-${def.cooldownRedSecs}s cooldown`);
  if (def.counterspy)          parts.push('counterspy passive');
  if (def.heistBonus > 0)      parts.push(`+${def.heistBonus} heist bonus`);
  return parts.join(', ') + '.';
}

/** Returns the current network level definition. */
export function getNetworkLevel() {
  return NETWORK_LEVELS[state.espionage?.networkLevel ?? 0] ?? NETWORK_LEVELS[0];
}

/** Returns the next network level definition, or null if maxed. */
export function getNextNetworkLevel() {
  const lvl = state.espionage?.networkLevel ?? 0;
  return NETWORK_LEVELS[lvl + 1] ?? null;
}

/**
 * Check whether a mission can be launched right now.
 * Returns { ok: true } or { ok: false, reason: string }.
 */
export function canLaunchMission(missionId) {
  if (!state.techs?.espionage) {
    return { ok: false, reason: 'Research the Espionage tech first.' };
  }
  // T213: tech_theft requires Intelligence Bureau (network level 2+)
  if (missionId === 'tech_theft' && (state.espionage?.networkLevel ?? 0) < 2) {
    return { ok: false, reason: 'Tech Theft requires Intelligence Bureau (spy network level 2).' };
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

/** T113: Returns the effective cooldown in ticks for the current network level. */
export function effectiveCooldownTicks() {
  const netDef = getNetworkLevel();
  return Math.max(TICKS_PER_SECOND * 10, ESPIONAGE_COOLDOWN - netDef.cooldownRedSecs * TICKS_PER_SECOND);
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

  // Set cooldown (T113: reduced by network level)
  state.espionage.cooldownUntil = state.tick + effectiveCooldownTicks();

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
  tech_theft: '🔬 Tech Theft',  // T213
};

/** Mission descriptions for tooltip. */
export const MISSION_DESCS = {
  gold_heist: `Steal 150–350 gold from an enemy treasury. Costs ${COST.gold_heist} gold. Failure loses ${50} gold.`,
  sabotage:   `Sabotage a rival's supply lines, boosting your army morale +8. Costs ${COST.sabotage} gold. Failure triggers a counter-raid.`,
  intel:      `Gather intelligence on a rival — reveals their territory, army, and relations. Costs ${COST.intel} gold. Failure loses ${30} gold.`,
  tech_theft: `Steal technology blueprints from a rival — queues a random unresearched tech at 40–60% completion. Costs ${COST.tech_theft} gold. Failure loses 80 gold. Requires Intelligence Bureau (level 2).`,
};

// ── Internal helpers ───────────────────────────────────────────────────────

/** T213: Returns tech IDs that can be targeted for theft (prereqs met, not researched, not queued). */
function _getStealableTechs() {
  return Object.keys(TECHS).filter(id => {
    if (state.techs?.[id]) return false;
    if (state.researchQueue?.some(e => e.techId === id)) return false;
    const def = TECHS[id];
    if (!def) return false;
    return (def.requires ?? []).every(r => state.techs?.[r]);
  });
}

function _successChance(emp) {
  let chance = 0.60;
  // Alliance bonus
  const alliedCount = state.diplomacy?.empires?.filter(e => e.relations === 'allied').length ?? 0;
  chance += alliedCount * 0.05;
  // At war with target: harder to infiltrate
  if (emp.relations === 'war') chance -= 0.10;
  // T113: spy network level bonus
  chance += getNetworkLevel().successBonus;
  return Math.max(0.15, Math.min(0.95, chance));
}

function _resolve(missionId, emp, empDef, success) {
  let text = '';
  const netDef = getNetworkLevel();  // T113

  if (missionId === 'gold_heist') {
    if (success) {
      // T113: Shadow Ministry adds +heistBonus gold
      const loot = Math.round(150 + Math.random() * 200) + netDef.heistBonus;
      state.resources.gold = Math.min(
        state.caps?.gold ?? 500,
        (state.resources.gold ?? 0) + loot
      );
      emit(Events.RESOURCE_CHANGED, {});
      text = `🕵️ Spy heist on ${empDef.name} succeeded! Stole ${loot} gold.`;
      addMessage(text, 'info');
    } else {
      let penalty = 50;
      // T113: Intelligence Bureau+ counterspy refunds 50% of failure cost
      if (netDef.counterspy) penalty = Math.round(penalty * 0.5);
      state.resources.gold = Math.max(0, (state.resources.gold ?? 0) - penalty);
      emit(Events.RESOURCE_CHANGED, {});
      text = `🕵️ Spy heist on ${empDef.name} failed. Spy was bribed — lost ${penalty} gold.${netDef.counterspy ? ' (counterspy halved penalty)' : ''}`;
      addMessage(text, 'raid');
    }
  }

  else if (missionId === 'sabotage') {
    if (success) {
      changeMorale(8);
      text = `🕵️ Sabotage of ${empDef.name} succeeded! Supply lines disrupted — morale up.`;
      addMessage(text, 'info');
    } else {
      // T113: counterspy passive reduces counter-raid damage by 50%
      let stolen = Math.round(200 + Math.random() * 200);
      if (netDef.counterspy) stolen = Math.round(stolen * 0.5);
      state.resources.gold = Math.max(0, (state.resources.gold ?? 0) - stolen);
      emit(Events.RESOURCE_CHANGED, {});
      text = `🕵️ Sabotage on ${empDef.name} failed! Counter-agents raided your treasury for ${stolen} gold.${netDef.counterspy ? ' (counterspy halved raid)' : ''}`;
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

  // T213: Tech Theft — steal research progress from a rival
  else if (missionId === 'tech_theft') {
    const candidates = _getStealableTechs();
    if (candidates.length === 0) {
      // Nothing to steal — refund the mission cost
      state.resources.gold = Math.min(
        state.caps?.gold ?? 500,
        (state.resources.gold ?? 0) + COST.tech_theft,
      );
      emit(Events.RESOURCE_CHANGED, {});
      text = `🕵️ Tech Theft from ${empDef.name}: no viable technology targets. Gold refunded.`;
      addMessage(text, 'info');
    } else if (success) {
      const techId = candidates[Math.floor(Math.random() * candidates.length)];
      const def = TECHS[techId];
      const pct = 0.40 + Math.random() * 0.20;           // 40–60% progress
      const stolenTicks = Math.round(def.researchTicks * pct);
      const remaining   = Math.max(1, def.researchTicks - stolenTicks);
      if (!state.researchQueue) state.researchQueue = [];
      if (state.researchQueue.length < 3) {
        state.researchQueue.push({ techId, remaining });
        emit(Events.TECH_CHANGED, {});
        text = `🕵️ Tech Theft from ${empDef.name} succeeded! ${def.name} blueprints obtained (${Math.round(pct * 100)}% progress). Added to research queue.`;
        addMessage(text, 'tech');
      } else {
        // Research queue full — sell the plans for gold
        const goldBonus = Math.round(stolenTicks * 0.4);
        state.resources.gold = Math.min(
          state.caps?.gold ?? 500,
          (state.resources.gold ?? 0) + goldBonus,
        );
        emit(Events.RESOURCE_CHANGED, {});
        text = `🕵️ Tech Theft from ${empDef.name} succeeded! ${def.name} plans sold for ${goldBonus}💰 (research queue full).`;
        addMessage(text, 'tech');
      }
    } else {
      const penalty = 80;
      state.resources.gold = Math.max(0, (state.resources.gold ?? 0) - penalty);
      emit(Events.RESOURCE_CHANGED, {});
      text = `🕵️ Tech Theft from ${empDef.name} failed! Spy captured — lost ${penalty} gold. Diplomatic relations strained.`;
      addMessage(text, 'raid');
    }
  }

  return { tick: state.tick, mission: missionId, empireId: emp.id, success, text };
}
