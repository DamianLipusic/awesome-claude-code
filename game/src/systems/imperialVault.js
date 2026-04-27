/**
 * EmpireOS — Imperial Vault system (T173).
 *
 * Allows the player to deposit gold and collect it with 30% interest after
 * a 5-minute lock period. Locked gold is immune to raid/disaster losses.
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';

export const VAULT_DEPOSIT_AMOUNT  = 200;   // gold deducted on deposit
export const VAULT_RETURN_AMOUNT   = 260;   // gold returned after lock period (+30%)
export const VAULT_LOCK_TICKS      = 1200;  // 5 minutes at 4 ticks/s
export const VAULT_COOLDOWN_TICKS  = 480;   // 2 minutes between deposits

export function initVault() {
  if (!state.vault) {
    state.vault = { locked: null, cooldownUntil: 0, totalDeposits: 0 };
  }
}

/**
 * Register as a tick system — auto-collects matured deposits.
 */
export function vaultTick() {
  const v = state.vault;
  if (!v?.locked) return;
  if (state.tick < v.locked.unlocksAt) return;

  // Deposit has matured — return gold with interest
  state.resources.gold = Math.min(state.caps.gold, state.resources.gold + VAULT_RETURN_AMOUNT);
  v.cooldownUntil = state.tick + VAULT_COOLDOWN_TICKS;
  v.totalDeposits = (v.totalDeposits ?? 0) + 1;
  v.locked = null;

  emit(Events.VAULT_CHANGED, { matured: true, returned: VAULT_RETURN_AMOUNT });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(
    `🏦 Imperial Vault: deposit matured! Collected ${VAULT_RETURN_AMOUNT} gold (+30% interest).`,
    'build',
  );
}

/**
 * Deposit VAULT_DEPOSIT_AMOUNT gold into the vault.
 * Requires the Imperial Vault building, sufficient gold, no active lock, and no cooldown.
 */
export function depositToVault() {
  if ((state.buildings?.imperialVault ?? 0) < 1) {
    return { ok: false, reason: 'Requires an Imperial Vault building.' };
  }
  if (!state.vault) initVault();

  if (state.vault.locked) {
    const secsLeft = Math.max(0, Math.ceil((state.vault.locked.unlocksAt - state.tick) / 4));
    return { ok: false, reason: `Vault locked — matures in ${secsLeft}s.` };
  }

  if (state.tick < (state.vault.cooldownUntil ?? 0)) {
    const secsLeft = Math.ceil((state.vault.cooldownUntil - state.tick) / 4);
    return { ok: false, reason: `Vault on cooldown — ${secsLeft}s remaining.` };
  }

  if ((state.resources.gold ?? 0) < VAULT_DEPOSIT_AMOUNT) {
    return { ok: false, reason: `Need ${VAULT_DEPOSIT_AMOUNT} gold to deposit.` };
  }

  state.resources.gold -= VAULT_DEPOSIT_AMOUNT;
  state.vault.locked = { amount: VAULT_DEPOSIT_AMOUNT, unlocksAt: state.tick + VAULT_LOCK_TICKS };

  emit(Events.VAULT_CHANGED, { deposited: VAULT_DEPOSIT_AMOUNT });
  emit(Events.RESOURCE_CHANGED, {});
  addMessage(
    `🏦 Deposited ${VAULT_DEPOSIT_AMOUNT} gold in the Imperial Vault. Returns ${VAULT_RETURN_AMOUNT} gold in 5 minutes.`,
    'build',
  );
  return { ok: true };
}
