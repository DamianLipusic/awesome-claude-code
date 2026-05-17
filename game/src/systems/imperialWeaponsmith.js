/**
 * EmpireOS — Imperial Weaponsmith (T310).
 *
 * Every 13–18 minutes (Iron Age+, 12+ player tiles), an imperial weaponsmith
 * arrives bearing master-forged weapons and armour from the great foundries.
 * The player has 75 seconds to decide.
 *
 * Choices:
 *   ⚔️ Commission Elite Armory      — pay 35 iron + 20 stone
 *        → +0.25 iron/s for 2.5 min · +25 prestige · +10 morale
 *   🛡️ Purchase Combat Techniques   — pay 25 gold
 *        → +0.18 iron/s for 2 min · +18 prestige
 *   🚶 Send Away                    — dismiss (no reward)
 *
 * state.imperialWeaponsmith = {
 *   active:               { expiresAt: tick } | null,
 *   nextSpawnTick:        tick,
 *   totalVisits:          number,
 *   totalCommissions:     number,
 *   totalPurchases:       number,
 *   totalDismissals:      number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 13 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 75 * TICKS_PER_SECOND;
const MIN_AGE          = 2;   // Iron Age+
const MIN_PLAYER_TILES = 12;

export const ARMORY_IRON_COST           = 35;
export const ARMORY_STONE_COST          = 20;
export const ARMORY_IRON_RATE           = 0.25;
export const ARMORY_PRESTIGE_REWARD     = 25;
export const ARMORY_MORALE_REWARD       = 10;
export const ARMORY_DURATION_TICKS      = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const TECHNIQUES_GOLD_COST       = 25;
export const TECHNIQUES_IRON_RATE       = 0.18;
export const TECHNIQUES_PRESTIGE_REWARD = 18;
export const TECHNIQUES_DURATION_TICKS  = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initImperialWeaponsmith() {
  if (!state.imperialWeaponsmith) {
    state.imperialWeaponsmith = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalCommissions: 0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.imperialWeaponsmith;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick     = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits       = 0;
  if (s.totalCommissions  === undefined) s.totalCommissions  = 0;
  if (s.totalPurchases    === undefined) s.totalPurchases    = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals   = 0;
}

export function imperialWeaponsmithTick() {
  const a = state.imperialWeaponsmith;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.IMPERIAL_WEAPONSMITH_CHANGED, { expired: true });
      addMessage('⚔️ The imperial weaponsmith sheathes their masterwork blade, loads the armour samples onto their ox-cart, and rides back toward the great foundries whence they came.', 'info');
    }
    return;
  }
  if (state.tick < a.nextSpawnTick) return;
  if ((state.age ?? 0) < MIN_AGE) return;
  if (!state.map?.tiles) return;
  let playerTiles = 0;
  for (const row of state.map.tiles) for (const tile of row) if (tile.owner === 'player') playerTiles++;
  if (playerTiles < MIN_PLAYER_TILES) return;
  a.active      = { expiresAt: state.tick + WINDOW_TICKS };
  a.totalVisits = (a.totalVisits ?? 0) + 1;
  emit(Events.IMPERIAL_WEAPONSMITH_CHANGED, { spawned: true });
  addMessage('⚔️ An imperial weaponsmith rides through the palace gates, their saddle-bags overflowing with samples of master-forged swords, shields, and articulated plate armour. They bear the seal of the great foundry guilds and offer their services to the empire\'s military. Respond within 75 seconds.', 'info');
}

export function getActiveWeaponsmith() { return state.imperialWeaponsmith?.active ?? null; }
export function getWeaponsmithSecsLeft() {
  const a = state.imperialWeaponsmith?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function commissionEliteArmory() {
  const a = state.imperialWeaponsmith;
  if (!a?.active) return { ok: false, reason: 'No weaponsmith present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The weaponsmith has departed.' };
  if ((state.resources.iron  ?? 0) < ARMORY_IRON_COST)  return { ok: false, reason: `Need ${ARMORY_IRON_COST} iron.` };
  if ((state.resources.stone ?? 0) < ARMORY_STONE_COST) return { ok: false, reason: `Need ${ARMORY_STONE_COST} stone.` };
  state.resources.iron  -= ARMORY_IRON_COST;
  state.resources.stone -= ARMORY_STONE_COST;
  changeMorale(ARMORY_MORALE_REWARD);
  awardPrestige(ARMORY_PRESTIGE_REWARD, 'Commissioned an elite armory from the imperial weaponsmith');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'weaponsmithArmory');
    state.randomEvents.activeModifiers.push({
      id: 'weaponsmithArmory', resource: 'iron',
      rateMult: 1 + (ARMORY_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + ARMORY_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalCommissions = (a.totalCommissions ?? 0) + 1;
  emit(Events.IMPERIAL_WEAPONSMITH_CHANGED, { armory: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`⚔️ The imperial weaponsmith establishes a field armory within the palace grounds! Master smiths work around the clock, their hammers ringing on anvils as swords and shields are forged to outfit the imperial legions. The heightened military production inspires iron miners and smelters to increase output dramatically! −${ARMORY_IRON_COST} iron · −${ARMORY_STONE_COST} stone · +${ARMORY_PRESTIGE_REWARD} prestige · +${ARMORY_MORALE_REWARD} morale. Forging surge: +${ARMORY_IRON_RATE} iron/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseCombatTechniques() {
  const a = state.imperialWeaponsmith;
  if (!a?.active) return { ok: false, reason: 'No weaponsmith present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The weaponsmith has departed.' };
  if ((state.resources.gold ?? 0) < TECHNIQUES_GOLD_COST) return { ok: false, reason: `Need ${TECHNIQUES_GOLD_COST} gold.` };
  state.resources.gold -= TECHNIQUES_GOLD_COST;
  awardPrestige(TECHNIQUES_PRESTIGE_REWARD, 'Purchased combat techniques from the imperial weaponsmith');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'weaponsmithTechniques');
    state.randomEvents.activeModifiers.push({
      id: 'weaponsmithTechniques', resource: 'iron',
      rateMult: 1 + (TECHNIQUES_IRON_RATE / Math.max(0.001, Math.abs(state.rates?.iron ?? 1))),
      expiresAt: state.tick + TECHNIQUES_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.IMPERIAL_WEAPONSMITH_CHANGED, { techniques: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🛡️ The weaponsmith shares advanced smelting and alloying techniques with the imperial foundries. Their knowledge of flux compositions and quenching methods transforms the quality of iron production, allowing the same raw ore to yield far more usable metal! −${TECHNIQUES_GOLD_COST} gold · +${TECHNIQUES_PRESTIGE_REWARD} prestige. Smelting surge: +${TECHNIQUES_IRON_RATE} iron/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendWeaponsmithAway() {
  const a = state.imperialWeaponsmith;
  if (!a?.active) return { ok: false, reason: 'No weaponsmith present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.IMPERIAL_WEAPONSMITH_CHANGED, { dismissed: true });
  addMessage('⚔️ The imperial weaponsmith inclines their head with professional courtesy, secures the masterwork samples in their saddlebags, and rides back toward the great foundries of the east.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
