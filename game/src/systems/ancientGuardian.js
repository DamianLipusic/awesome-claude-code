/**
 * EmpireOS — Ancient Guardian Awakens (T256).
 *
 * Every 17–22 minutes (Iron Age+, 12+ player tiles), an ancient stone guardian
 * stirs at the empire's borders, drawn by the growing power of the realm.
 * The player has 75 seconds to decide.
 *
 * Choices:
 *   🗿 Offer Tribute     — pay 40 food → +20 morale, +25 prestige,
 *                           +0.2 stone/s for 2 min (guardian blesses quarries)
 *   🔮 Conduct Ritual    — pay 25 mana → +35 prestige,
 *                           +0.15 mana/s for 3 min (ritual awakens ley lines)
 *   🛡️  Stand Firm        — free → +8 morale, +6 prestige
 *                           (empire's resolve impresses the guardian)
 *
 * state.ancientGuardian = {
 *   active:          { expiresAt: tick } | null,
 *   nextSpawnTick:   tick,
 *   totalAwakenings: number,
 *   totalTributed:   number,
 *   totalRituals:    number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Constants ──────────────────────────────────────────────────────────────

const SPAWN_MIN        = 17 * 60 * TICKS_PER_SECOND; // 17 min
const SPAWN_RANGE      = 5  * 60 * TICKS_PER_SECOND; // +0–5 min jitter
const WINDOW_TICKS     = 75 * TICKS_PER_SECOND;       // 75-second decision window
const MIN_AGE          = 2;                            // Iron Age
const MIN_PLAYER_TILES = 12;

export const TRIBUTE_FOOD_COST       = 40;
export const TRIBUTE_MORALE_REWARD   = 20;
export const TRIBUTE_PRESTIGE_REWARD = 25;
export const TRIBUTE_STONE_RATE      = 0.2; // +0.2 stone/s
export const TRIBUTE_DURATION_TICKS  = 2 * 60 * TICKS_PER_SECOND; // 2 min

export const RITUAL_MANA_COST        = 25;
export const RITUAL_PRESTIGE_REWARD  = 35;
export const RITUAL_MANA_RATE        = 0.15; // +0.15 mana/s
export const RITUAL_DURATION_TICKS   = 3 * 60 * TICKS_PER_SECOND; // 3 min

export const STANDFIRM_MORALE_REWARD   = 8;
export const STANDFIRM_PRESTIGE_REWARD = 6;

// ── Init ──────────────────────────────────────────────────────────────

export function initAncientGuardian() {
  if (!state.ancientGuardian) {
    state.ancientGuardian = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalAwakenings: 0,
      totalTributed:   0,
      totalRituals:    0,
    };
  }
  if (state.ancientGuardian.nextSpawnTick   === undefined) state.ancientGuardian.nextSpawnTick   = _nextSpawnTick();
  if (state.ancientGuardian.totalAwakenings === undefined) state.ancientGuardian.totalAwakenings = 0;
  if (state.ancientGuardian.totalTributed   === undefined) state.ancientGuardian.totalTributed   = 0;
  if (state.ancientGuardian.totalRituals    === undefined) state.ancientGuardian.totalRituals    = 0;
}

// ── Tick ──────────────────────────────────────────────────────────────

export function ancientGuardianTick() {
  const ag = state.ancientGuardian;
  if (!ag) return;

  // Expire active window
  if (ag.active) {
    if (state.tick >= ag.active.expiresAt) {
      ag.active        = null;
      ag.nextSpawnTick = _nextSpawnTick();
      emit(Events.ANCIENT_GUARDIAN_CHANGED, { expired: true });
      addMessage('🗿 The ancient guardian returns to slumber, unappeased by the empire\'s silence.', 'info');
    }
    return;
  }

  if (state.tick < ag.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;

  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) {
    for (const tile of row) {
      if (tile.owner === 'player') playerTiles++;
    }
  }
  if (playerTiles < MIN_PLAYER_TILES) return;

  ag.active          = { expiresAt: state.tick + WINDOW_TICKS };
  ag.totalAwakenings = (ag.totalAwakenings ?? 0) + 1;

  emit(Events.ANCIENT_GUARDIAN_CHANGED, { spawned: true });
  addMessage('🗿 An ancient stone guardian stirs at the empire\'s borders, awakened by your growing power! Respond within 75 seconds.', 'info');
}

// ── Public API ──────────────────────────────────────────────────────────

export function getActiveAncientGuardian() {
  return state.ancientGuardian?.active ?? null;
}

export function getAncientGuardianSecsLeft() {
  const a = state.ancientGuardian?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

/**
 * Offer Tribute — pay 40 food; +20 morale, +25 prestige, +0.2 stone/s for 2 min.
 */
export function offerGuardianTribute() {
  const ag = state.ancientGuardian;
  if (!ag?.active) return { ok: false, reason: 'No guardian present.' };
  if (state.tick >= ag.active.expiresAt) return { ok: false, reason: 'The guardian has returned to slumber.' };
  if ((state.resources.food ?? 0) < TRIBUTE_FOOD_COST) {
    return { ok: false, reason: `Need ${TRIBUTE_FOOD_COST} food.` };
  }

  state.resources.food -= TRIBUTE_FOOD_COST;
  changeMorale(TRIBUTE_MORALE_REWARD);
  awardPrestige(TRIBUTE_PRESTIGE_REWARD, "Tribute appeases the ancient stone guardian");

  if (state.randomEvents) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers ?? [];
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'guardianTribute');
    state.randomEvents.activeModifiers.push({
      id:        'guardianTribute',
      resource:  'stone',
      rateMult:  1 + (TRIBUTE_STONE_RATE / Math.max(0.001, Math.abs(state.rates?.stone ?? 1))),
      expiresAt: state.tick + TRIBUTE_DURATION_TICKS,
    });
  }

  ag.active        = null;
  ag.nextSpawnTick = _nextSpawnTick();
  ag.totalTributed = (ag.totalTributed ?? 0) + 1;

  emit(Events.ANCIENT_GUARDIAN_CHANGED, { tributed: true });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🗿 The guardian is appeased! +${TRIBUTE_MORALE_REWARD} morale, +${TRIBUTE_PRESTIGE_REWARD} prestige. Sacred quarries surge: +${TRIBUTE_STONE_RATE} stone/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

/**
 * Conduct Ritual — pay 25 mana; +35 prestige, +0.15 mana/s for 3 min.
 */
export function conductGuardianRitual() {
  const ag = state.ancientGuardian;
  if (!ag?.active) return { ok: false, reason: 'No guardian present.' };
  if (state.tick >= ag.active.expiresAt) return { ok: false, reason: 'The guardian has returned to slumber.' };
  if ((state.resources.mana ?? 0) < RITUAL_MANA_COST) {
    return { ok: false, reason: `Need ${RITUAL_MANA_COST} mana.` };
  }

  state.resources.mana -= RITUAL_MANA_COST;
  awardPrestige(RITUAL_PRESTIGE_REWARD, "Ancient ritual awakens ley lines of the guardian's domain");

  if (state.randomEvents) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers ?? [];
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'guardianRitual');
    state.randomEvents.activeModifiers.push({
      id:        'guardianRitual',
      resource:  'mana',
      rateMult:  1 + (RITUAL_MANA_RATE / Math.max(0.001, Math.abs(state.rates?.mana ?? 1))),
      expiresAt: state.tick + RITUAL_DURATION_TICKS,
    });
  }

  ag.active        = null;
  ag.nextSpawnTick = _nextSpawnTick();
  ag.totalRituals  = (ag.totalRituals ?? 0) + 1;

  emit(Events.ANCIENT_GUARDIAN_CHANGED, { ritual: true });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🔮 The ritual awakens ancient ley lines! +${RITUAL_PRESTIGE_REWARD} prestige. Arcane energies surge: +${RITUAL_MANA_RATE} mana/s for 3 minutes.`, 'windfall');
  return { ok: true };
}

/**
 * Stand Firm — free; +8 morale, +6 prestige (empire's resolve impresses the guardian).
 */
export function standFirmGuardian() {
  const ag = state.ancientGuardian;
  if (!ag?.active) return { ok: false, reason: 'No guardian present.' };

  changeMorale(STANDFIRM_MORALE_REWARD);
  awardPrestige(STANDFIRM_PRESTIGE_REWARD, "Empire's resolve impresses the ancient guardian");

  ag.active        = null;
  ag.nextSpawnTick = _nextSpawnTick();

  emit(Events.ANCIENT_GUARDIAN_CHANGED, { firm: true });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🛡️ The empire stands resolute before the ancient guardian! +${STANDFIRM_MORALE_REWARD} morale, +${STANDFIRM_PRESTIGE_REWARD} prestige. The guardian retreats, impressed.`, 'windfall');
  return { ok: true };
}

// ── Internal helpers ────────────────────────────────────────────────

function _nextSpawnTick() {
  return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE);
}