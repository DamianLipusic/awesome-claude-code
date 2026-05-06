/**
 * EmpireOS — Imperial Propaganda Campaigns (T219).
 *
 * Players can run empire-wide propaganda campaigns from the Research panel.
 * Three campaign types, each with distinct costs and timed effects:
 *
 *   military_morale   (120g + 50 iron)  — +12 morale immediately;
 *                                          +5% attack power for 5 minutes
 *   economic_stimulus (100g + 50 food)  — +20% market sell prices for 4 minutes;
 *                                          +8 Imperial Codex fragments
 *   cultural_diplomacy(150g + 50 mana)  — requires ≥1 allied empire with trade routes;
 *                                          +12 reputation; +8 favor per allied empire
 *
 * An 8-minute cooldown applies after any campaign ends.
 *
 * state.propaganda = {
 *   activeCampaign: { type, expiresAt } | null,
 *   cooldownUntil:  number,   // tick when next campaign may begin
 *   totalLaunched:  number,
 * }
 */

import { state }           from '../core/state.js';
import { emit, Events }    from '../core/events.js';
import { addMessage }      from '../core/actions.js';
import { changeMorale }    from './morale.js';
import { changeReputation } from './reputation.js';
import { TICKS_PER_SECOND } from '../core/tick.js';
import { FAVOR_MAX }        from './diplomacy.js';

// ── Constants ──────────────────────────────────────────────────────────────

const CAMPAIGN_DURATION = {
  military_morale:    5 * 60 * TICKS_PER_SECOND,  // 5 min
  economic_stimulus:  4 * 60 * TICKS_PER_SECOND,  // 4 min
  cultural_diplomacy: 0,                           // instant effect, no active window
};
const COOLDOWN_TICKS = 8 * 60 * TICKS_PER_SECOND; // 8 min between campaigns

export const CAMPAIGN_DEFS = [
  {
    id:    'military_morale',
    icon:  '⚔️',
    name:  'Military Morale',
    desc:  '+12 morale · +5% attack power for 5 min',
    costs: { gold: 120, iron: 50 },
  },
  {
    id:    'economic_stimulus',
    icon:  '📜',
    name:  'Economic Stimulus',
    desc:  '+20% market sell prices for 4 min · +8 codex fragments',
    costs: { gold: 100, food: 50 },
  },
  {
    id:    'cultural_diplomacy',
    icon:  '🕊️',
    name:  'Cultural Diplomacy',
    desc:  '+12 reputation · +8 favor per ally (requires trade route)',
    costs: { gold: 150, mana: 50 },
    requires: 'tradeRoute',
  },
];

// ── Init ──────────────────────────────────────────────────────────────────

export function initPropaganda() {
  if (!state.propaganda) {
    state.propaganda = {
      activeCampaign: null,
      cooldownUntil:  0,
      totalLaunched:  0,
    };
  }
  if (state.propaganda.activeCampaign  === undefined) state.propaganda.activeCampaign = null;
  if (state.propaganda.cooldownUntil   === undefined) state.propaganda.cooldownUntil  = 0;
  if (state.propaganda.totalLaunched   === undefined) state.propaganda.totalLaunched  = 0;
}

// ── Tick ──────────────────────────────────────────────────────────────────

export function propagandaTick() {
  if (!state.propaganda) return;
  const p = state.propaganda;
  if (!p.activeCampaign) return;

  if (state.tick >= p.activeCampaign.expiresAt) {
    const type = p.activeCampaign.type;
    p.activeCampaign  = null;
    p.cooldownUntil   = state.tick + COOLDOWN_TICKS;
    addMessage(`📣 The ${_campaignName(type)} campaign has concluded. Cooldown: 8 minutes.`, 'event');
    emit(Events.PROPAGANDA_LAUNCHED, { type, phase: 'ended' });
  }
}

// ── Launch ────────────────────────────────────────────────────────────────

/**
 * Launch a propaganda campaign.
 * Returns { ok: true } or { ok: false, reason: string }.
 */
export function launchCampaign(type) {
  if (!state.propaganda) return { ok: false, reason: 'Propaganda system not ready.' };
  const p   = state.propaganda;
  const def = CAMPAIGN_DEFS.find(d => d.id === type);
  if (!def) return { ok: false, reason: 'Unknown campaign type.' };

  if (p.activeCampaign) return { ok: false, reason: 'A campaign is already running.' };
  if (state.tick < p.cooldownUntil) return { ok: false, reason: 'Campaign on cooldown.' };

  // Affordability
  for (const [res, amount] of Object.entries(def.costs)) {
    if ((state.resources[res] ?? 0) < amount) {
      return { ok: false, reason: `Not enough ${res}.` };
    }
  }

  // Cultural diplomacy requires at least one allied empire with a trade route
  if (type === 'cultural_diplomacy') {
    const hasRoute = state.diplomacy?.empires?.some(
      e => e.relations === 'allied' && (e.tradeRoutes ?? 0) > 0
    );
    if (!hasRoute) return { ok: false, reason: 'Requires at least one allied empire with a trade route.' };
  }

  // Deduct costs
  for (const [res, amount] of Object.entries(def.costs)) {
    state.resources[res] -= amount;
  }

  // Apply immediate effects
  if (type === 'military_morale') {
    changeMorale(+12);
    const duration = CAMPAIGN_DURATION.military_morale;
    p.activeCampaign = { type, expiresAt: state.tick + duration };
    addMessage('⚔️ Military Morale campaign launched! Troops inspired (+12 morale, +5% attack for 5 min).', 'event');
  }

  if (type === 'economic_stimulus') {
    // +8 codex fragments (if codex active)
    if (state.codex) state.codex.fragments = (state.codex.fragments ?? 0) + 8;
    const duration = CAMPAIGN_DURATION.economic_stimulus;
    p.activeCampaign = { type, expiresAt: state.tick + duration };
    addMessage('📜 Economic Stimulus campaign launched! Market sell prices +20% for 4 min (+8 codex fragments).', 'event');
  }

  if (type === 'cultural_diplomacy') {
    changeReputation(+12, 'Cultural Diplomacy campaign');
    // +8 favor to every allied empire
    let alliesGifted = 0;
    if (state.diplomacy?.empires) {
      for (const emp of state.diplomacy.empires) {
        if (emp.relations === 'allied') {
          emp.favor = Math.min(FAVOR_MAX, (emp.favor ?? 0) + 8);
          alliesGifted++;
        }
      }
    }
    if (alliesGifted > 0) {
      emit(Events.ALLIANCE_FAVOR_CHANGED, { bulk: true });
    }
    // No active window — instant effect with cooldown
    p.activeCampaign = null;
    p.cooldownUntil  = state.tick + COOLDOWN_TICKS;
    addMessage(`🕊️ Cultural Diplomacy campaign launched! +12 reputation, +8 favor to ${alliesGifted} allied empire(s).`, 'event');
  }

  p.totalLaunched++;
  emit(Events.PROPAGANDA_LAUNCHED, { type, phase: 'started' });
  emit(Events.RESOURCE_CHANGED, {});
  return { ok: true };
}

// ── Accessors ─────────────────────────────────────────────────────────────

export function getPropagandaInfo() {
  if (!state.propaganda) return null;
  return state.propaganda;
}

export function isPropagandaActive(type) {
  const p = state.propaganda;
  if (!p?.activeCampaign) return false;
  if (type && p.activeCampaign.type !== type) return false;
  return p.activeCampaign.expiresAt > state.tick;
}

export function getPropagandaSecsLeft() {
  const p = state.propaganda;
  if (!p?.activeCampaign) return 0;
  return Math.max(0, Math.ceil((p.activeCampaign.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function getPropagandaCooldownSecs() {
  const p = state.propaganda;
  if (!p) return 0;
  return Math.max(0, Math.ceil((p.cooldownUntil - state.tick) / TICKS_PER_SECOND));
}

// ── Helpers ───────────────────────────────────────────────────────────────

function _campaignName(type) {
  return CAMPAIGN_DEFS.find(d => d.id === type)?.name ?? type;
}
