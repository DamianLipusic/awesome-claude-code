/**
 * EmpireOS — Mana Spells System (T055).
 *
 * Four spells that consume mana:
 *   Vision       (🔭, 15 mana)           — reveals 6-tile radius around capital
 *   Blessing     (🌟, 40 mana, arcane)   — +60% food+gold production for 90s
 *   Aegis Ward   (🛡️, 55 mana, engineering) — −40% enemy counterattack for 120s
 *   Mana Bolt    (⚡, 80 mana, divine_favor) — primes next attack for guaranteed win
 *
 * Integration points:
 *   resources.js recalcRates() — applies Blessing multiplier to food+gold
 *   combat.js attackTile()    — consumes Mana Bolt for guaranteed victory
 *   enemyAI.js _counterattack() — applies Aegis Ward defence reduction
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';
import { MAP_W, MAP_H } from './map.js';

// ── Spell catalogue ────────────────────────────────────────────────────────

export const SPELLS = {
  vision: {
    id:            'vision',
    icon:          '🔭',
    name:          'Vision',
    desc:          'Reveals all tiles within 6 squares of your capital instantly.',
    manaCost:      15,
    requires:      [],
    cooldownTicks: 120,  // 30 s
  },
  blessing: {
    id:             'blessing',
    icon:           '🌟',
    name:           'Blessing',
    desc:           '+60% food and gold production for 90 seconds.',
    manaCost:       40,
    requires:       [{ type: 'tech', id: 'arcane' }],
    durationTicks:  360,  // 90 s
    cooldownTicks:  480,  // 120 s after activation (not after expiry)
  },
  aegis: {
    id:             'aegis',
    icon:           '🛡️',
    name:           'Aegis Ward',
    desc:           'Reduces enemy counterattack success chance by 40% for 120 seconds.',
    manaCost:       55,
    requires:       [{ type: 'tech', id: 'engineering' }],
    durationTicks:  480,  // 120 s
    cooldownTicks:  600,  // 150 s
  },
  manaBolt: {
    id:            'manaBolt',
    icon:          '⚡',
    name:          'Mana Bolt',
    desc:          'Primes your next attack for guaranteed victory, regardless of tile defense.',
    manaCost:      80,
    requires:      [{ type: 'tech', id: 'divine_favor' }],
    cooldownTicks: 320,  // 80 s
  },
};

export const SPELL_ORDER = ['vision', 'blessing', 'aegis', 'manaBolt'];

// ── Init ───────────────────────────────────────────────────────────────────

/**
 * Idempotent: ensures state.spells exists with the right shape.
 * Safe to call on every boot, new game, and save-load.
 */
export function initSpells() {
  if (!state.spells) state.spells = {};
  if (!state.spells.activeEffects) {
    state.spells.activeEffects = { blessing: 0, aegis: 0, manaBolt: false };
  }
  if (!state.spells.cooldowns) {
    state.spells.cooldowns = { vision: 0, blessing: 0, aegis: 0, manaBolt: 0 };
  }
}

// ── Cast ───────────────────────────────────────────────────────────────────

/**
 * Attempt to cast a spell by id.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function castSpell(spellId) {
  const def = SPELLS[spellId];
  if (!def) return { ok: false, reason: 'Unknown spell.' };

  initSpells();  // defensive — should already be initialised

  // Unlock requirements
  for (const req of def.requires) {
    if (req.type === 'tech' && !state.techs[req.id]) {
      return { ok: false, reason: `Requires ${req.id.replace(/_/g, ' ')} technology.` };
    }
  }

  // Cooldown
  const cdExpires = state.spells.cooldowns[spellId] ?? 0;
  if (state.tick < cdExpires) {
    const secsLeft = Math.ceil((cdExpires - state.tick) / 4);
    return { ok: false, reason: `${def.name} is on cooldown (${secsLeft}s remaining).` };
  }

  // Already active / primed
  const ae = state.spells.activeEffects;
  if (spellId === 'blessing'  && ae.blessing  > state.tick) return { ok: false, reason: 'Blessing is already active.' };
  if (spellId === 'aegis'     && ae.aegis     > state.tick) return { ok: false, reason: 'Aegis Ward is already active.' };
  if (spellId === 'manaBolt'  && ae.manaBolt)               return { ok: false, reason: 'Mana Bolt is already primed.' };

  // Mana cost (Arcane archetype: −25%; Arcane Tower capital plan: −25%; arcane_mind trait: −30%, stack multiplicatively)
  let manaCost = def.manaCost;
  if (state.archetype === 'arcane')         manaCost = Math.floor(manaCost * 0.75);
  if (state.capitalPlan === 'arcane_tower') manaCost = Math.floor(manaCost * 0.75);
  // T119: arcane_mind trait — -30% spell mana costs
  if (state.hero?.trait === 'arcane_mind' && !state.hero.pendingTrait) {
    manaCost = Math.floor(manaCost * 0.70);
  }
  // T150: Grand Theory Arcane Omniscience — -50% all spell mana costs
  if (state.grandTheory === 'arcane_omniscience') manaCost = Math.floor(manaCost * 0.50);
  manaCost = Math.max(1, manaCost);

  if ((state.resources.mana ?? 0) < manaCost) {
    return { ok: false, reason: `Not enough mana. Need ${manaCost} ✨ mana.` };
  }

  // Deduct mana
  state.resources.mana -= manaCost;

  // Apply effect and set cooldown
  switch (spellId) {
    case 'vision':
      _castVision();
      state.spells.cooldowns.vision = state.tick + def.cooldownTicks;
      addMessage(`${def.icon} Vision cast — fog lifted around your capital!`, 'spell');
      break;

    case 'blessing':
      ae.blessing = state.tick + def.durationTicks;
      state.spells.cooldowns.blessing = state.tick + def.cooldownTicks;
      addMessage(`${def.icon} Blessing active — food and gold production +60% for 90s!`, 'spell');
      break;

    case 'aegis':
      ae.aegis = state.tick + def.durationTicks;
      state.spells.cooldowns.aegis = state.tick + def.cooldownTicks;
      addMessage(`${def.icon} Aegis Ward raised — enemy raids weakened for 120s!`, 'spell');
      break;

    case 'manaBolt':
      ae.manaBolt = true;
      state.spells.cooldowns.manaBolt = state.tick + def.cooldownTicks;
      addMessage(`${def.icon} Mana Bolt primed — next attack is guaranteed to succeed!`, 'spell');
      break;
  }

  emit(Events.SPELL_CAST, { spell: spellId });
  emit(Events.RESOURCE_CHANGED, {});
  return { ok: true };
}

// ── Vision effect ──────────────────────────────────────────────────────────

function _castVision() {
  if (!state.map) return;
  const { tiles } = state.map;
  const cx = state.map.capital?.x ?? 10;
  const cy = state.map.capital?.y ?? 10;
  const RADIUS = 6;

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (Math.hypot(x - cx, y - cy) <= RADIUS) tiles[y][x].revealed = true;
    }
  }
  emit(Events.MAP_CHANGED, {});
}

// ── Tick: expire active effects ────────────────────────────────────────────

/**
 * Called once per game tick. Expires timed spell effects.
 */
export function spellTick() {
  if (!state.spells?.activeEffects) return;
  const ae = state.spells.activeEffects;
  const t  = state.tick;

  if (ae.blessing > 0 && t >= ae.blessing) {
    ae.blessing = 0;
    addMessage('🌟 Blessing has expired.', 'spell');
    emit(Events.SPELL_CAST, { spell: 'blessing', expired: true });
  }
  if (ae.aegis > 0 && t >= ae.aegis) {
    ae.aegis = 0;
    addMessage('🛡️ Aegis Ward has expired.', 'spell');
    emit(Events.SPELL_CAST, { spell: 'aegis', expired: true });
  }
}
