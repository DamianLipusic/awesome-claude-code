/**
 * EmpireOS — Ancient Ruins data (T106).
 *
 * 4 ruin sites are placed during map generation on neutral tiles.
 * Capturing a ruin tile triggers an excavation roll with 4 possible outcomes.
 */

export const RUIN_COUNT = 4;

/** Outcome weights: must sum to 100. */
export const RUIN_OUTCOMES = [
  {
    id:     'resource_cache',
    weight: 35,
    icon:   '💰',
    name:   'Resource Cache',
    desc:   'Ancient storerooms filled with gold, mana, and iron.',
    apply:  (state) => {
      const cap = (r) => state.caps[r] ?? 500;
      state.resources.gold  = Math.min(cap('gold'),  (state.resources.gold  ?? 0) + 100);
      state.resources.mana  = Math.min(cap('mana'),  (state.resources.mana  ?? 0) + 50);
      state.resources.iron  = Math.min(cap('iron'),  (state.resources.iron  ?? 0) + 50);
      return '+100 gold, +50 mana, +50 iron';
    },
  },
  {
    id:     'ancient_wisdom',
    weight: 30,
    icon:   '📜',
    name:   'Ancient Wisdom',
    desc:   'Scrolls accelerate research or grant XP to your veterans.',
    apply:  (state) => {
      if (state.researchQueue?.length > 0) {
        const entry = state.researchQueue[0];
        const reduction = Math.min(entry.remaining ?? 0, 480); // max 120s
        entry.remaining = Math.max(0, (entry.remaining ?? 0) - reduction);
        const secs = Math.round(reduction / 4);
        return `-${secs}s current research`;
      }
      // No active research: grant +1 XP to every trained unit type
      let gained = 0;
      for (const unitId of Object.keys(state.units ?? {})) {
        if ((state.units[unitId] ?? 0) > 0) {
          state.unitXP = state.unitXP ?? {};
          state.unitXP[unitId] = (state.unitXP[unitId] ?? 0) + 1;
          gained++;
        }
      }
      return gained > 0 ? `+1 XP to ${gained} unit type(s)` : 'no effect';
    },
  },
  {
    id:     'cursed_trap',
    weight: 20,
    icon:   '💀',
    name:   'Cursed Trap',
    desc:   'Ancient wards drain morale and plunder your treasury.',
    apply:  (state) => {
      state.morale = Math.max(0, (state.morale ?? 50) - 8);
      const stolen = Math.min(state.resources.gold ?? 0, 80);
      state.resources.gold = Math.max(0, (state.resources.gold ?? 0) - stolen);
      return `-8 morale, -${stolen} gold`;
    },
  },
  {
    id:     'lost_artifact',
    weight: 15,
    icon:   '🏺',
    name:   'Lost Artifact',
    desc:   'A legendary artifact grants a permanent empire bonus.',
    apply:  (_state) => '+0.8 gold/s, +100 gold cap (permanent)',
  },
];

/** Sum of all weights — used for weighted random selection. */
export const RUIN_TOTAL_WEIGHT = RUIN_OUTCOMES.reduce((s, o) => s + o.weight, 0);

/**
 * Roll a random excavation outcome.
 * @returns {object} one of RUIN_OUTCOMES
 */
export function rollRuinOutcome() {
  let roll = Math.random() * RUIN_TOTAL_WEIGHT;
  for (const outcome of RUIN_OUTCOMES) {
    roll -= outcome.weight;
    if (roll <= 0) return outcome;
  }
  return RUIN_OUTCOMES[0];
}
