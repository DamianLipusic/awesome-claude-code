/**
 * EmpireOS — T208: Resource Exchange Pact.
 *
 * When allied with a foreign empire, the player can propose a resource
 * exchange pact. The first season's exchange fires immediately on
 * proposal; subsequent seasons execute automatically on SEASON_CHANGED.
 * Duration: 2 seasons total. Only one pact active at a time.
 *
 * Fixed pact types per empire:
 *   ironHorde:   give 80 food → receive 60 iron   (iron supply chain)
 *   mageCouncil: give 60 gold → receive 80 mana   (arcane patronage)
 *   seaWolves:   give 60 iron → receive 100 gold  (maritime trade)
 *
 * state.resourcePact = {
 *   active: {
 *     empireId:    string,
 *     empireLabel: string,
 *     empireIcon:  string,
 *     offeredRes:  string,
 *     offeredAmt:  number,
 *     receivedRes: string,
 *     receivedAmt: number,
 *     seasonsLeft: number,   // decrements each SEASON_CHANGED; starts at 1 after first exchange
 *   } | null,
 *   totalPacts: number,
 *   history:    [{ empireId, empireLabel, empireIcon, offeredRes, offeredAmt,
 *                  receivedRes, receivedAmt }]   (newest first, max 5)
 * } | null
 */

import { state }          from '../core/state.js';
import { emit, on, Events } from '../core/events.js';
import { addMessage }     from '../core/actions.js';
import { EMPIRES }        from '../data/empires.js';

export const PACT_SEASONS = 2;

export const PACT_DEFINITIONS = {
  ironHorde:   {
    offeredRes: 'food', offeredAmt: 80,
    receivedRes: 'iron', receivedAmt: 60,
    icon: '⚙️', desc: 'Feed their warriors, receive forged iron',
  },
  mageCouncil: {
    offeredRes: 'gold', offeredAmt: 60,
    receivedRes: 'mana', receivedAmt: 80,
    icon: '✨', desc: 'Fund their research, receive arcane mana',
  },
  seaWolves:   {
    offeredRes: 'iron', offeredAmt: 60,
    receivedRes: 'gold', receivedAmt: 100,
    icon: '💰', desc: 'Equip their ships, receive trading gold',
  },
};

const RES_ICONS = { food: '🍞', wood: '🪵', stone: '🪨', iron: '⚙️', gold: '💰', mana: '✨' };

// ── Init ───────────────────────────────────────────────────────────────────

export function initResourcePact() {
  if (!state.resourcePact) {
    state.resourcePact = { active: null, totalPacts: 0, history: [] };
  }
  on(Events.SEASON_CHANGED, _onSeasonChanged);
}

// ── Public API ─────────────────────────────────────────────────────────────

export function getActivePact() {
  return state.resourcePact?.active ?? null;
}

export function getResourcePactInfo() {
  return state.resourcePact ?? null;
}

/**
 * Propose (and immediately execute the first exchange of) a resource pact.
 * @param {string} empireId
 * @returns {{ ok: boolean, reason?: string }}
 */
export function proposeResourcePact(empireId) {
  if (!state.resourcePact) initResourcePact();
  const rp = state.resourcePact;

  if (rp.active) return { ok: false, reason: 'A resource pact is already active.' };

  const pactDef = PACT_DEFINITIONS[empireId];
  if (!pactDef) return { ok: false, reason: 'No pact terms available with this empire.' };

  const empireState = state.diplomacy?.empires.find(e => e.id === empireId);
  if (!empireState || empireState.relations !== 'allied') {
    return { ok: false, reason: 'You must be allied to propose a resource pact.' };
  }

  const { offeredRes, offeredAmt, receivedRes, receivedAmt } = pactDef;

  if ((state.resources[offeredRes] ?? 0) < offeredAmt) {
    return {
      ok: false,
      reason: `Need ${offeredAmt} ${RES_ICONS[offeredRes]} ${offeredRes} to initiate the pact.`,
    };
  }

  const empDef = EMPIRES[empireId];

  // Execute first exchange immediately
  state.resources[offeredRes] -= offeredAmt;
  const cap      = state.caps?.[receivedRes] ?? 500;
  const received = Math.min(receivedAmt, Math.max(0, cap - (state.resources[receivedRes] ?? 0)));
  state.resources[receivedRes] = Math.min(cap, (state.resources[receivedRes] ?? 0) + received);

  // Record active pact (1 exchange done, 1 season remaining)
  rp.active = {
    empireId,
    empireLabel: empDef?.name  ?? empireId,
    empireIcon:  empDef?.icon  ?? '🏰',
    offeredRes,
    offeredAmt,
    receivedRes,
    receivedAmt,
    seasonsLeft: PACT_SEASONS - 1,
  };
  rp.totalPacts++;

  emit(Events.RESOURCE_CHANGED, {});
  emit(Events.RESOURCE_PACT_CHANGED, { action: 'proposed', empireId });
  addMessage(
    `🤝 Resource Pact signed with ${empDef?.icon ?? ''} ${empDef?.name ?? empireId}! ` +
    `First exchange: −${offeredAmt} ${RES_ICONS[offeredRes]}, +${received} ${RES_ICONS[receivedRes]}. ` +
    `${rp.active.seasonsLeft} season${rp.active.seasonsLeft !== 1 ? 's' : ''} remaining.`,
    'achievement',
  );

  return { ok: true };
}

/**
 * Cancel the active pact early (forfeits remaining exchanges).
 * @returns {{ ok: boolean, reason?: string }}
 */
export function cancelResourcePact() {
  if (!state.resourcePact?.active) {
    return { ok: false, reason: 'No active pact to cancel.' };
  }
  const p = state.resourcePact.active;
  _recordHistory(p);
  state.resourcePact.active = null;
  emit(Events.RESOURCE_PACT_CHANGED, { action: 'cancelled' });
  addMessage(`🤝 Resource pact with ${p.empireIcon} ${p.empireLabel} cancelled.`, 'info');
  return { ok: true };
}

// ── Internal ───────────────────────────────────────────────────────────────

function _onSeasonChanged() {
  const rp = state.resourcePact;
  if (!rp?.active) return;

  const p = rp.active;

  // Check alliance still holds
  const empireState = state.diplomacy?.empires.find(e => e.id === p.empireId);
  if (!empireState || empireState.relations !== 'allied') {
    _recordHistory(p);
    rp.active = null;
    emit(Events.RESOURCE_PACT_CHANGED, { action: 'broken' });
    addMessage(
      `🤝 Resource pact with ${p.empireIcon} ${p.empireLabel} dissolved — alliance no longer active.`,
      'warning',
    );
    return;
  }

  if (p.seasonsLeft <= 0) {
    _recordHistory(p);
    rp.active = null;
    emit(Events.RESOURCE_PACT_CHANGED, { action: 'completed' });
    addMessage(`🤝 Resource pact with ${p.empireIcon} ${p.empireLabel} fulfilled — all exchanges complete.`, 'achievement');
    return;
  }

  // Execute season exchange
  if ((state.resources[p.offeredRes] ?? 0) < p.offeredAmt) {
    _recordHistory(p);
    rp.active = null;
    emit(Events.RESOURCE_PACT_CHANGED, { action: 'broken' });
    addMessage(
      `🤝 Resource pact broken — insufficient ${RES_ICONS[p.offeredRes]} ${p.offeredRes} to fulfil exchange.`,
      'warning',
    );
    return;
  }

  state.resources[p.offeredRes] -= p.offeredAmt;
  const cap      = state.caps?.[p.receivedRes] ?? 500;
  const received = Math.min(p.receivedAmt, Math.max(0, cap - (state.resources[p.receivedRes] ?? 0)));
  state.resources[p.receivedRes] = Math.min(cap, (state.resources[p.receivedRes] ?? 0) + received);
  p.seasonsLeft--;

  emit(Events.RESOURCE_CHANGED, {});
  emit(Events.RESOURCE_PACT_CHANGED, {
    action: 'exchange', offeredRes: p.offeredRes, offeredAmt: p.offeredAmt,
    receivedRes: p.receivedRes, receivedAmt: received,
  });
  addMessage(
    `🤝 Pact exchange with ${p.empireIcon} ${p.empireLabel}: ` +
    `−${p.offeredAmt} ${RES_ICONS[p.offeredRes]}, +${received} ${RES_ICONS[p.receivedRes]}. ` +
    `${p.seasonsLeft} season${p.seasonsLeft !== 1 ? 's' : ''} remaining.`,
    'windfall',
  );
}

function _recordHistory(pact) {
  if (!state.resourcePact) return;
  state.resourcePact.history.unshift({
    empireId:    pact.empireId,
    empireLabel: pact.empireLabel,
    empireIcon:  pact.empireIcon,
    offeredRes:  pact.offeredRes,
    offeredAmt:  pact.offeredAmt,
    receivedRes: pact.receivedRes,
    receivedAmt: pact.receivedAmt,
  });
  if (state.resourcePact.history.length > 5) state.resourcePact.history.pop();
}
