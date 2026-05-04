/**
 * EmpireOS — T194: Artisan Guilds — Production Specialization System.
 *
 * Players may found up to GUILD_SLOTS (3) Artisan Guilds simultaneously.
 * Each guild provides flat rate bonuses for a specific resource group and
 * lasts GUILD_DURATION ticks (4 minutes). An active guild may be renewed at
 * half its original cost before it expires; the renewal extends the timer by
 * GUILD_DURATION from the current tick.
 *
 * Available from Stone Age (no tech requirement).
 *
 * Rate bonuses are applied in resources.js via getGuildRateBonuses().
 *
 * state.guilds = {
 *   active:       [{ guildId, expiresAt }],   // max GUILD_SLOTS entries
 *   totalFounded: number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { TICKS_PER_SECOND } from '../core/tick.js';
import { recalcRates }      from './resources.js';

export const GUILD_SLOTS    = 3;
export const GUILD_DURATION = 4 * 60 * TICKS_PER_SECOND;  // 960 ticks = 4 min
const        RENEW_MULT     = 0.5;                          // 50 % of original cost

// ── Guild definitions ──────────────────────────────────────────────────────────

export const GUILDS = Object.freeze({
  farmers: {
    id:      'farmers',
    icon:    '🌾',
    name:    "Farmer's Guild",
    desc:    'Organises local farmers for peak harvest.',
    cost:    { gold: 50, food: 30 },
    bonuses: { food: 2.5 },
  },
  lumberers: {
    id:      'lumberers',
    icon:    '🪓',
    name:    'Lumber Guild',
    desc:    'Coordinates lumberjacks across the forests.',
    cost:    { gold: 50, wood: 30 },
    bonuses: { wood: 2.5 },
  },
  miners: {
    id:      'miners',
    icon:    '⛏️',
    name:    "Miners' Guild",
    desc:    'Trains quarry workers and iron smiths.',
    cost:    { gold: 60, stone: 20 },
    bonuses: { stone: 2.0, iron: 1.0 },
  },
  merchants: {
    id:      'merchants',
    icon:    '💰',
    name:    "Merchant's Guild",
    desc:    'Opens new trade routes across the realm.',
    cost:    { gold: 80 },
    bonuses: { gold: 2.0 },
  },
  mages: {
    id:      'mages',
    icon:    '🔮',
    name:    "Mage's Guild",
    desc:    'Organises arcane scholars and enchantment artisans.',
    cost:    { gold: 60, mana: 30 },
    bonuses: { mana: 2.5 },
  },
});

export const GUILD_ORDER = ['farmers', 'lumberers', 'miners', 'merchants', 'mages'];

// ── Init ───────────────────────────────────────────────────────────────────────

export function initGuilds() {
  if (!state.guilds) {
    state.guilds = { active: [], totalFounded: 0 };
  } else {
    if (!Array.isArray(state.guilds.active)) state.guilds.active = [];
    if (!state.guilds.totalFounded)          state.guilds.totalFounded = 0;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Number of currently active (non-expired) guilds. */
export function activeGuildCount() {
  return (state.guilds?.active ?? []).filter(g => state.tick < g.expiresAt).length;
}

/** True if the named guild is currently active and not expired. */
export function isGuildFounded(guildId) {
  return (state.guilds?.active ?? []).some(
    g => g.guildId === guildId && state.tick < g.expiresAt
  );
}

/** Seconds remaining for the named guild (0 if not active or expired). */
export function guildSecsLeft(guildId) {
  const g = (state.guilds?.active ?? []).find(g => g.guildId === guildId);
  if (!g || state.tick >= g.expiresAt) return 0;
  return Math.max(0, Math.ceil((g.expiresAt - state.tick) / TICKS_PER_SECOND));
}

/**
 * Returns summed flat rate bonuses from all currently active guilds.
 * Called by resources.js recalcRates(); avoids reading GUILDS there directly.
 * @returns {{ gold?:number, food?:number, wood?:number, stone?:number, iron?:number, mana?:number }}
 */
export function getGuildRateBonuses() {
  const result = {};
  for (const g of (state.guilds?.active ?? [])) {
    if (state.tick >= g.expiresAt) continue;
    const def = GUILDS[g.guildId];
    if (!def) continue;
    for (const [res, val] of Object.entries(def.bonuses)) {
      result[res] = (result[res] ?? 0) + val;
    }
  }
  return result;
}

/**
 * Found a new guild or renew an already-active one.
 * @param {string} guildId
 * @returns {{ ok: boolean, reason?: string }}
 */
export function foundGuild(guildId) {
  const def = GUILDS[guildId];
  if (!def) return { ok: false, reason: 'Unknown guild.' };

  const existing = (state.guilds?.active ?? []).find(g => g.guildId === guildId);
  const isRenew  = existing && state.tick < existing.expiresAt;

  if (!isRenew && activeGuildCount() >= GUILD_SLOTS)
    return { ok: false, reason: `Maximum ${GUILD_SLOTS} guilds may be active at once.` };

  // Renewal costs half the original
  const costMult = isRenew ? RENEW_MULT : 1.0;
  const cost = Object.fromEntries(
    Object.entries(def.cost).map(([res, amt]) => [res, Math.ceil(amt * costMult)])
  );

  for (const [res, amount] of Object.entries(cost)) {
    if ((state.resources?.[res] ?? 0) < amount)
      return { ok: false, reason: `Need ${amount} ${res} to ${isRenew ? 'renew' : 'found'} the ${def.name}.` };
  }

  for (const [res, amount] of Object.entries(cost))
    state.resources[res] = Math.max(0, (state.resources[res] ?? 0) - amount);
  emit(Events.RESOURCE_CHANGED, {});

  if (isRenew) {
    existing.expiresAt = state.tick + GUILD_DURATION;
    emit(Events.GUILD_RENEWED, { guildId });
    addMessage(`⚙️ ${def.icon} ${def.name} renewed for 4 more minutes.`, 'info');
  } else {
    state.guilds.active.push({ guildId, expiresAt: state.tick + GUILD_DURATION });
    state.guilds.totalFounded++;
    recalcRates();
    emit(Events.GUILD_FOUNDED, { guildId });
    const bonusStr = Object.entries(def.bonuses).map(([r, v]) => `+${v} ${r}/s`).join(', ');
    addMessage(`⚙️ ${def.icon} ${def.name} founded — ${bonusStr} for 4 min.`, 'info');
  }

  emit(Events.GUILD_CHANGED, {});
  return { ok: true };
}

// ── Tick ───────────────────────────────────────────────────────────────────────

/** Registered as a tick system — removes expired guilds and recalculates rates. */
export function guildTick() {
  if (!state.guilds?.active?.length) return;

  const expired = state.guilds.active.filter(g => state.tick >= g.expiresAt);
  if (!expired.length) return;

  state.guilds.active = state.guilds.active.filter(g => state.tick < g.expiresAt);
  recalcRates();

  for (const g of expired) {
    const def = GUILDS[g.guildId];
    emit(Events.GUILD_EXPIRED, { guildId: g.guildId });
    addMessage(`⚙️ ${def?.icon ?? ''} ${def?.name ?? g.guildId} has disbanded — bonus expired.`, 'info');
  }

  emit(Events.GUILD_CHANGED, {});
}
