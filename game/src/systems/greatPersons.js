/**
 * EmpireOS — Great Person System (T136).
 *
 * Earn 1 Great Person point every 10 minutes.  At 3 points a random Great
 * Person appears and the point counter resets.  The player can use them from
 * the Empire Summary tab.  Unused persons expire after 5 minutes.
 *
 * Great Person types:
 *   Engineer  — instantly construct the cheapest affordable building (no cost)
 *   Merchant  — +600 gold instantly
 *   Scholar   — instantly complete current research (or −50% remaining time on next)
 *   General   — +50 flat attack power for the next 5 battles
 *
 * Integration points:
 *   systems/combat.js attackTile()  — applies General bonus + consumes charge
 *   systems/research.js researchTick() — applies Scholar workshop discount
 *   ui/summaryPanel.js             — _greatPersonCard()
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage, buildBuilding } from '../core/actions.js';
import { TICKS_PER_SECOND } from '../core/tick.js';
import { BUILDINGS } from '../data/buildings.js';
import { recalcRates } from './resources.js';

// ── Constants ────────────────────────────────────────────────────────────────

const POINT_INTERVAL     = 10 * 60 * TICKS_PER_SECOND;  // 2400 ticks (10 min)
const POINTS_TO_SPAWN    = 3;
const EXPIRE_TICKS       = 5  * 60 * TICKS_PER_SECOND;  // 1200 ticks (5 min)
const GENERAL_BONUS_ATK  = 50;
const GENERAL_CHARGES    = 5;

export const GREAT_PERSON_TYPES = [
  {
    type:  'engineer',
    icon:  '⚙️',
    name:  'Great Engineer',
    desc:  'Instantly constructs the cheapest affordable building at no resource cost.',
  },
  {
    type:  'merchant',
    icon:  '💰',
    name:  'Great Merchant',
    desc:  'Delivers +600 gold from successful trade ventures.',
  },
  {
    type:  'scholar',
    icon:  '📖',
    name:  'Great Scholar',
    desc:  'Completes current research instantly, or halves remaining research time on the next tech.',
  },
  {
    type:  'general',
    icon:  '⚔️',
    name:  'Great General',
    desc:  `+${GENERAL_BONUS_ATK} flat attack power for the next ${GENERAL_CHARGES} battles.`,
  },
];

// ── Init ─────────────────────────────────────────────────────────────────────

export function initGreatPersons() {
  if (!state.greatPersons) {
    state.greatPersons = {
      points:           0,
      nextPointTick:    (state.tick ?? 0) + POINT_INTERVAL,
      available:        null,
      generalCharges:   0,
      totalUsed:        0,
    };
  }
  // Migration guards
  if (state.greatPersons.nextPointTick === undefined) {
    state.greatPersons.nextPointTick = (state.tick ?? 0) + POINT_INTERVAL;
  }
  if (state.greatPersons.generalCharges === undefined) {
    state.greatPersons.generalCharges = 0;
  }
  if (state.greatPersons.totalUsed === undefined) {
    state.greatPersons.totalUsed = 0;
  }
}

// ── Tick ─────────────────────────────────────────────────────────────────────

export function greatPersonTick() {
  if (!state.greatPersons) return;
  const gp = state.greatPersons;

  // Expire available great person
  if (gp.available && state.tick >= gp.available.expiresAt) {
    const name = gp.available.name;
    gp.available = null;
    addMessage(`📜 The ${name} has departed without being called upon.`, 'info');
    emit(Events.GREAT_PERSON, { type: 'expired' });
  }

  // Earn a point
  if (state.tick >= gp.nextPointTick) {
    gp.points++;
    gp.nextPointTick = state.tick + POINT_INTERVAL;
    addMessage(`✨ Great Person progress: ${gp.points}/${POINTS_TO_SPAWN} points accumulated.`, 'info');
    emit(Events.GREAT_PERSON, { type: 'point', points: gp.points });

    // Spawn a new great person when threshold is reached
    if (gp.points >= POINTS_TO_SPAWN && !gp.available) {
      _spawnGreatPerson();
    }
  }
}

// ── Public helpers ────────────────────────────────────────────────────────────

/** Returns the available great person or null. */
export function getAvailableGreatPerson() {
  return state.greatPersons?.available ?? null;
}

/** Seconds left until the available great person expires (0 if none). */
export function getGreatPersonSecsLeft() {
  const a = state.greatPersons?.available;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

/** Seconds until the next point is earned. */
export function getNextPointSecs() {
  const gp = state.greatPersons;
  if (!gp) return 0;
  return Math.max(0, Math.ceil((gp.nextPointTick - state.tick) / TICKS_PER_SECOND));
}

/**
 * Use the available great person.
 * Returns { ok, reason? }.
 */
export function useGreatPerson() {
  const gp = state.greatPersons;
  if (!gp?.available) return { ok: false, reason: 'No Great Person available.' };

  const person = gp.available;
  gp.available = null;
  gp.points    = 0;     // reset points after use
  gp.totalUsed++;

  const result = _applyEffect(person);
  emit(Events.GREAT_PERSON, { type: 'used', personType: person.type });
  emit(Events.RESOURCE_CHANGED, {});
  return result;
}

/**
 * Returns the current General bonus flat attack power (0 when no charges remain).
 * Called by combat.js getAttackPreview() and attackTile().
 */
export function getGeneralBonus() {
  const gp = state.greatPersons;
  if (!gp || gp.generalCharges <= 0) return 0;
  return GENERAL_BONUS_ATK;
}

/**
 * Consume one General charge (called by combat.js attackTile() after each battle).
 */
export function consumeGeneralCharge() {
  const gp = state.greatPersons;
  if (!gp || gp.generalCharges <= 0) return;
  gp.generalCharges--;
  if (gp.generalCharges === 0) {
    addMessage('⚔️ Great General\'s guidance has been fully spent.', 'info');
    emit(Events.GREAT_PERSON, { type: 'general_expired' });
  }
}

// ── Internal ──────────────────────────────────────────────────────────────────

function _spawnGreatPerson() {
  const types   = GREAT_PERSON_TYPES;
  const def     = types[Math.floor(Math.random() * types.length)];

  state.greatPersons.available = {
    type:      def.type,
    icon:      def.icon,
    name:      def.name,
    desc:      def.desc,
    expiresAt: state.tick + EXPIRE_TICKS,
  };
  state.greatPersons.points = 0;

  addMessage(
    `✨ A ${def.name} has arrived! ${def.desc} (expires in 5 min)`,
    'windfall',
  );
  emit(Events.GREAT_PERSON, { type: 'spawned', personType: def.type });
}

function _applyEffect(person) {
  switch (person.type) {
    case 'engineer': {
      // Find the cheapest affordable building the player can construct
      const canAfford = (building) => {
        if (!building || building.requires) {
          if (building.requires) {
            for (const [k, v] of Object.entries(building.requires)) {
              if (typeof v === 'number') {
                if ((state.buildings[k] ?? 0) < v) return false;
              } else if (typeof v === 'boolean' && v) {
                if (!state.techs[k]) return false;
              }
            }
          }
        }
        // age gate
        if (building.requiresAge && state.age < building.requiresAge) return false;
        // unique gate
        if (building.unique && (state.buildings[building.id] ?? 0) >= 1) return false;
        return true;
      };

      // Collect affordable non-wonder buildings sorted by total gold cost
      const affordable = Object.values(BUILDINGS)
        .filter(b => !b.wonder && canAfford(b))
        .sort((a, b) => (a.cost?.gold ?? 999) - (b.cost?.gold ?? 999));

      if (affordable.length === 0) {
        addMessage('⚙️ Great Engineer arrived but no affordable buildings could be constructed.', 'info');
        return { ok: true };
      }

      const target = affordable[0];
      // Grant the building directly (bypass cost)
      state.buildings[target.id] = (state.buildings[target.id] ?? 0) + 1;
      recalcRates();
      emit(Events.BUILDING_CHANGED, { id: target.id });
      addMessage(`⚙️ Great Engineer: instantly constructed a ${target.name}!`, 'windfall');
      return { ok: true };
    }

    case 'merchant': {
      const goldCap = state.caps.gold ?? 500;
      const gained  = Math.min(600, goldCap - (state.resources.gold ?? 0));
      state.resources.gold = (state.resources.gold ?? 0) + gained;
      addMessage(`💰 Great Merchant: +${gained} gold from lucrative trade!`, 'windfall');
      return { ok: true };
    }

    case 'scholar': {
      if (state.researchQueue?.length > 0) {
        // Complete current research instantly
        const entry = state.researchQueue[0];
        entry.remaining = 0;
        addMessage(`📖 Great Scholar: research on ${entry.techId} completed instantly!`, 'windfall');
      } else {
        // No active research — discount the next tech by 50%
        if (!state.greatPersons) state.greatPersons = { scholarDiscount: false };
        state.greatPersons.scholarDiscount = true;
        addMessage(`📖 Great Scholar: next research will take 50% less time!`, 'windfall');
      }
      return { ok: true };
    }

    case 'general': {
      if (!state.greatPersons) return { ok: false, reason: 'State error.' };
      state.greatPersons.generalCharges = GENERAL_CHARGES;
      addMessage(
        `⚔️ Great General: +${GENERAL_BONUS_ATK} attack power for the next ${GENERAL_CHARGES} battles!`,
        'windfall',
      );
      return { ok: true };
    }

    default:
      return { ok: false, reason: `Unknown great person type: ${person.type}` };
  }
}
