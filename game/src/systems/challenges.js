/**
 * EmpireOS — Dynamic timed challenge system (T061).
 *
 * Generates one active challenge every CHALLENGE_INTERVAL ticks (~3 min).
 * The player has CHALLENGE_DURATION ticks (~2 min) to complete it.
 * On completion: resource reward + quest-type message.
 * On expiry: new challenge generated after CHALLENGE_COOLDOWN (~30 s).
 *
 * Five challenge types:
 *   territory  — expand to N total territories
 *   gold       — accumulate N gold in treasury
 *   combat     — win N more battles (delta from challenge start)
 *   population — reach N citizens
 *   mana       — gather N mana in reserves
 *
 * State: state.challenges = {
 *   active:      { type, icon, label, desc, startValue, target, reward, expiresAt } | null,
 *   completed:   [{ type, icon, label, reward, completedTick }]   max 10, newest first,
 *   nextGenTick: number   — tick when next challenge generates
 * }
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const CHALLENGE_INTERVAL = 3  * 60 * TICKS_PER_SECOND;   // 720 ticks — 3 min between generations
const CHALLENGE_DURATION = 2  * 60 * TICKS_PER_SECOND;   // 480 ticks — 2 min to complete
const CHALLENGE_COOLDOWN = 30 * TICKS_PER_SECOND;         // 120 ticks — 30 s after expire/complete

const MAX_COMPLETED = 10;

// ── Metric helpers ─────────────────────────────────────────────────────────

function _territoryCount() {
  if (!state.map) return 0;
  let c = 0;
  for (const row of state.map.tiles)
    for (const t of row)
      if (t.owner === 'player') c++;
  return c;
}

function _combatWins() {
  return state.combatHistory?.filter(h => h.outcome === 'win').length ?? 0;
}

// ── Challenge templates ────────────────────────────────────────────────────
// label(startValue, target) → string used in messages and UI
// desc(startValue, target)  → longer description for the card
// metric()                  → current value (snapshot)
// target(currentValue)      → absolute target value to reach
// reward(target)            → { resource: amount } payout on success

const TEMPLATES = [
  {
    type:   'territory',
    icon:   '🗺️',
    label:  (sv, tgt) => `Expand to ${tgt} territories`,
    desc:   (sv, tgt) => `Capture enough tiles to control ${tgt} territories total.`,
    metric: _territoryCount,
    target: (cur) => cur + 4 + Math.floor(state.tick / 1000),
    reward: (tgt)  => ({ gold: Math.round(60 + tgt * 3), food: 30 }),
  },
  {
    type:   'gold',
    icon:   '💰',
    label:  (sv, tgt) => `Accumulate ${tgt} gold`,
    desc:   (sv, tgt) => `Build your treasury to ${tgt} gold.`,
    metric: () => Math.floor(state.resources?.gold ?? 0),
    target: (cur) => cur + 120 + Math.floor(state.tick / 400),
    reward: ()     => ({ food: 40, wood: 40, stone: 20 }),
  },
  {
    type:   'combat',
    icon:   '⚔️',
    label:  (sv, tgt) => `Win ${tgt - sv} more battle${tgt - sv !== 1 ? 's' : ''}`,
    desc:   (sv, tgt) => `Defeat enemies in ${tgt - sv} more battle${tgt - sv !== 1 ? 's' : ''} starting now.`,
    metric: _combatWins,
    target: (cur) => cur + 3,
    reward: ()     => ({ gold: 100, iron: 30 }),
  },
  {
    type:   'population',
    icon:   '🏘️',
    label:  (sv, tgt) => `Reach ${tgt} citizens`,
    desc:   (sv, tgt) => `Grow your population to ${tgt} citizens.`,
    metric: () => Math.floor(state.population?.count ?? 0),
    target: (cur) => Math.max(cur + 60, 150),
    reward: ()     => ({ food: 60, wood: 30, gold: 50 }),
  },
  {
    type:   'mana',
    icon:   '✨',
    label:  (sv, tgt) => `Gather ${tgt} mana`,
    desc:   (sv, tgt) => `Accumulate ${tgt} mana in your reserves.`,
    metric: () => Math.floor(state.resources?.mana ?? 0),
    target: (cur) => Math.max(cur + 40, 60),
    reward: ()     => ({ gold: 70, iron: 15, stone: 40 }),
  },
];

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Initialise challenges state. Idempotent — safe to call on every boot/new game.
 */
export function initChallenges() {
  if (!state.challenges) {
    state.challenges = {
      active:      null,
      completed:   [],
      nextGenTick: state.tick + CHALLENGE_INTERVAL,
    };
  }
  // Migration guards for older saves
  if (!state.challenges.completed) state.challenges.completed = [];
  if (state.challenges.nextGenTick === undefined)
    state.challenges.nextGenTick = state.tick + CHALLENGE_INTERVAL;
}

/**
 * Registered as a tick system. Checks completion/expiry and generates new challenges.
 */
export function challengeTick() {
  if (!state.challenges) return;
  const ch = state.challenges;

  // ── Check active challenge ──────────────────────────────────────────────
  if (ch.active) {
    const tpl = TEMPLATES.find(t => t.type === ch.active.type);
    if (tpl) {
      const cur = tpl.metric();
      if (cur >= ch.active.target) {
        _completeChallenge(ch.active);
        ch.active      = null;
        ch.nextGenTick = state.tick + CHALLENGE_COOLDOWN;
        return;
      }
    }
    // Expiry check
    if (state.tick >= ch.active.expiresAt) {
      addMessage(`⏰ Challenge expired: ${ch.active.label}`, 'info');
      ch.active      = null;
      ch.nextGenTick = state.tick + CHALLENGE_COOLDOWN;
      emit(Events.CHALLENGE_UPDATED, {});
      return;
    }
  }

  // ── Generate next challenge when scheduled ──────────────────────────────
  if (!ch.active && state.tick >= ch.nextGenTick) {
    _generateChallenge();
  }
}

/**
 * Seconds remaining on the active challenge (0 if none).
 */
export function getChallengeSecsLeft() {
  if (!state.challenges?.active) return 0;
  return Math.max(
    0,
    Math.ceil((state.challenges.active.expiresAt - state.tick) / TICKS_PER_SECOND),
  );
}

// ── Internal helpers ──────────────────────────────────────────────────────

function _generateChallenge() {
  const tpl   = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
  const cur   = tpl.metric();
  const tgt   = tpl.target(cur);
  const label = tpl.label(cur, tgt);
  const desc  = tpl.desc(cur, tgt);
  const reward = tpl.reward(tgt);

  state.challenges.active = {
    type:       tpl.type,
    icon:       tpl.icon,
    label,
    desc,
    startValue: cur,
    target:     tgt,
    reward,
    expiresAt:  state.tick + CHALLENGE_DURATION,
  };

  addMessage(`🎯 New challenge: ${label}`, 'info');
  emit(Events.CHALLENGE_UPDATED, {});
}

function _completeChallenge(active) {
  // Award rewards
  for (const [res, amt] of Object.entries(active.reward)) {
    if (state.resources?.[res] !== undefined) {
      state.resources[res] = Math.min(
        state.caps?.[res] ?? 999,
        (state.resources[res] ?? 0) + amt,
      );
    }
  }
  const rewardStr = Object.entries(active.reward)
    .map(([r, a]) => `+${a} ${r}`)
    .join(', ');
  addMessage(`🎯 Challenge complete: "${active.label}"! Reward: ${rewardStr}`, 'quest');

  // Record completion (newest first, cap at MAX_COMPLETED)
  state.challenges.completed.unshift({ ...active, completedTick: state.tick });
  if (state.challenges.completed.length > MAX_COMPLETED) state.challenges.completed.pop();

  emit(Events.RESOURCE_CHANGED, {});
  emit(Events.CHALLENGE_UPDATED, {});
}
