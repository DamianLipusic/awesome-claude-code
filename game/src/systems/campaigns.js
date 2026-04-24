/**
 * EmpireOS — Conquest Campaign System (T154).
 *
 * The player can launch a focused military campaign against a non-allied empire.
 * Cost: 200 gold + 30 food. Duration: 5 minutes (1200 ticks).
 * During the campaign: all attacks on that empire's tiles grant +25% loot.
 * At 5+ campaign battle wins → Campaign Victory: +200 prestige, +15 morale.
 * 10-minute cooldown between campaigns.
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';
import { awardPrestige } from './prestige.js';
import { changeMorale } from './morale.js';
import { EMPIRES } from '../data/empires.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

export const CAMPAIGN_COST       = { gold: 200, food: 30 };
export const CAMPAIGN_DURATION   = 1200;  // ticks (~5 min)
export const CAMPAIGN_WIN_GOAL   = 5;     // victories needed for campaign win
export const CAMPAIGN_LOOT_MULT  = 1.25;  // +25% loot on target empire tiles
export const CAMPAIGN_COOLDOWN   = 2400;  // ticks (~10 min) cooldown after any campaign
const CAMPAIGN_VICTORY_PRESTIGE  = 200;

export function initCampaigns() {
  if (!state.campaigns) {
    state.campaigns = {
      active:       null, // { empireId, empireLabel, startTick, endsAt, wins }
      cooldownUntil: 0,
      totalWon:     0,
    };
  }
}

export function campaignTick() {
  if (!state.campaigns) initCampaigns();
  const c = state.campaigns;

  // Auto-end expired campaign without enough wins
  if (c.active && state.tick >= c.active.endsAt) {
    _endCampaign(false);
  }
}

/**
 * Launch a new conquest campaign against the given empire.
 * @param {string} empireId  e.g. 'ironHorde', 'mageCouncil', 'deserter'
 * @returns {{ ok: boolean, reason?: string }}
 */
export function startCampaign(empireId) {
  if (!state.campaigns) initCampaigns();
  const c = state.campaigns;

  if (c.active) return { ok: false, reason: 'A campaign is already active.' };
  if (state.tick < c.cooldownUntil) {
    const secsLeft = Math.ceil((c.cooldownUntil - state.tick) / TICKS_PER_SECOND);
    return { ok: false, reason: `Campaign cooldown — ${secsLeft}s remaining.` };
  }

  const emp = state.diplomacy?.empires?.find(e => e.id === empireId);
  if (!emp) return { ok: false, reason: 'Unknown empire.' };
  if (emp.relations === 'allied') {
    return { ok: false, reason: 'Cannot campaign against an ally.' };
  }

  for (const [res, amt] of Object.entries(CAMPAIGN_COST)) {
    if ((state.resources[res] ?? 0) < amt) {
      return { ok: false, reason: 'Insufficient resources. Need 200 gold + 30 food.' };
    }
  }

  for (const [res, amt] of Object.entries(CAMPAIGN_COST)) {
    state.resources[res] -= amt;
  }

  const def = EMPIRES[empireId];
  const label = `${def?.icon ?? ''} ${def?.name ?? empireId}`.trim();
  c.active = {
    empireId,
    empireLabel: label,
    startTick:   state.tick,
    endsAt:      state.tick + CAMPAIGN_DURATION,
    wins:        0,
  };

  addMessage(
    `⚔️ Conquest Campaign launched against ${label}! Win ${CAMPAIGN_WIN_GOAL} battles in 5 minutes for a great victory. Campaign loot +25%.`,
    'achievement',
  );
  emit(Events.CAMPAIGN_STARTED, { empireId });
  emit(Events.RESOURCE_CHANGED, {});
  return { ok: true };
}

/**
 * Called from combat.js after a victorious battle on an enemy tile.
 * @param {string} tileEmpireId  The faction that owned the tile (from tile.faction before capture).
 * @returns {number} loot multiplier to apply (1.25 if this is a campaign target, 1.0 otherwise)
 */
export function getCampaignLootMult(tileEmpireId) {
  if (!state.campaigns?.active) return 1.0;
  if (state.campaigns.active.empireId !== tileEmpireId) return 1.0;
  return CAMPAIGN_LOOT_MULT;
}

/**
 * Called from combat.js after a victorious battle on a campaign-target tile.
 * Increments win counter and triggers victory when goal is reached.
 * @param {string} tileEmpireId
 */
export function recordCampaignWin(tileEmpireId) {
  if (!state.campaigns?.active) return;
  if (state.campaigns.active.empireId !== tileEmpireId) return;

  const c = state.campaigns;
  c.active.wins++;

  if (c.active.wins >= CAMPAIGN_WIN_GOAL) {
    _endCampaign(true);
  } else {
    const rem = CAMPAIGN_WIN_GOAL - c.active.wins;
    addMessage(
      `🏆 Campaign victory ${c.active.wins}/${CAMPAIGN_WIN_GOAL}! ${rem} more ${rem === 1 ? 'battle' : 'battles'} to win the campaign.`,
      'combat-win',
    );
    emit(Events.CAMPAIGN_WON, { empireId: c.active.empireId, wins: c.active.wins });
  }
}

function _endCampaign(won) {
  if (!state.campaigns?.active) return;
  const c     = state.campaigns;
  const label = c.active.empireLabel;
  const wins  = c.active.wins;

  if (won) {
    awardPrestige(CAMPAIGN_VICTORY_PRESTIGE, `conquest campaign victory over ${label}`);
    changeMorale(15);
    c.totalWon++;
    addMessage(
      `🎖️ Campaign Victory! The ${label} campaign is won! +${CAMPAIGN_VICTORY_PRESTIGE} prestige, +15 morale.`,
      'windfall',
    );
    emit(Events.CAMPAIGN_ENDED, { empireId: c.active.empireId, won: true, wins });
  } else {
    addMessage(
      `❌ Campaign expired — ${wins}/${CAMPAIGN_WIN_GOAL} victories achieved. The ${label} campaign dissolves.`,
      'danger',
    );
    emit(Events.CAMPAIGN_ENDED, { empireId: c.active.empireId, won: false, wins });
  }

  c.cooldownUntil = state.tick + CAMPAIGN_COOLDOWN;
  c.active        = null;
}

/** Returns the active campaign object, or null. */
export function getActiveCampaign() {
  return state.campaigns?.active ?? null;
}

/** Returns seconds remaining in the active campaign (0 if none). */
export function getCampaignSecsLeft() {
  if (!state.campaigns?.active) return 0;
  return Math.max(0, Math.ceil((state.campaigns.active.endsAt - state.tick) / TICKS_PER_SECOND));
}

/** Returns seconds until the campaign cooldown expires (0 if ready). */
export function getCampaignCooldownSecs() {
  if (!state.campaigns || state.campaigns.active) return 0;
  return Math.max(0, Math.ceil((state.campaigns.cooldownUntil - state.tick) / TICKS_PER_SECOND));
}
