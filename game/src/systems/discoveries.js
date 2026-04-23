/**
 * EmpireOS — Map Discoveries (T146).
 *
 * When tiles are newly revealed (fog lifted), there is a 15% chance that the
 * tile contains a hidden discovery — an interactive encounter the player can
 * claim by clicking the tile on the map.
 *
 * Discovery types and their rewards:
 *   ancient_cache   — gold windfall (80–160 gold)
 *   lost_supplies   — food + wood windfall
 *   runic_tablet    — mana windfall + small research progress
 *   buried_hoard    — stone + iron windfall
 *   wandering_sage  — +15 morale
 *
 * Claimed discoveries are logged in state.discoveries.claimed and
 * the tile.discovery field is cleared.  Each discovery emits
 * DISCOVERY_FOUND (on spawn) and MAP_CHANGED (on claim).
 *
 * State: state.discoveries = { claimed: {'x,y': true}, totalClaimed: 0 }
 */

import { state }        from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage }   from '../core/actions.js';
import { recalcRates }  from './resources.js';
import { changeMorale } from './morale.js';

const DISCOVERY_CHANCE = 0.15; // 15% per newly-revealed tile

const DISCOVERY_TYPES = [
  'ancient_cache',
  'lost_supplies',
  'runic_tablet',
  'buried_hoard',
  'wandering_sage',
];

// Display name + reward function for each discovery type
const DISCOVERY_DEFS = {
  ancient_cache: {
    label: 'Ancient Cache',
    icon: '💰',
    description: 'A sealed chest of gold coins from a forgotten age.',
    apply(x, y) {
      const amt = 80 + Math.floor(Math.random() * 81); // 80–160
      const cap = state.caps.gold ?? 500;
      state.resources.gold = Math.min(cap, (state.resources.gold ?? 0) + amt);
      addMessage(`💰 Ancient cache at (${x},${y}) yielded +${amt} gold!`, 'windfall');
    },
  },
  lost_supplies: {
    label: 'Lost Supplies',
    icon: '🌾',
    description: 'Abandoned wagons packed with food and timber.',
    apply(x, y) {
      const food = 60 + Math.floor(Math.random() * 41); // 60–100
      const wood = 40 + Math.floor(Math.random() * 31); // 40–70
      const fCap = state.caps.food ?? 500;
      const wCap = state.caps.wood ?? 500;
      state.resources.food = Math.min(fCap, (state.resources.food ?? 0) + food);
      state.resources.wood = Math.min(wCap, (state.resources.wood ?? 0) + wood);
      addMessage(`🌾 Lost supplies at (${x},${y}) recovered! +${food} food, +${wood} wood.`, 'windfall');
    },
  },
  runic_tablet: {
    label: 'Runic Tablet',
    icon: '📜',
    description: 'An inscribed stone humming with ancient knowledge.',
    apply(x, y) {
      const mana = 30 + Math.floor(Math.random() * 21); // 30–50
      const mCap = state.caps.mana ?? 500;
      state.resources.mana = Math.min(mCap, (state.resources.mana ?? 0) + mana);
      // Small research boost — advance current research by 10 ticks of progress
      if (state.researchQueue?.length > 0) {
        const current = state.researchQueue[0];
        current.progress = Math.min(current.cost, (current.progress ?? 0) + 10);
        addMessage(`📜 Runic tablet at (${x},${y}) granted +${mana} mana and accelerated research!`, 'windfall');
      } else {
        addMessage(`📜 Runic tablet at (${x},${y}) granted +${mana} mana!`, 'windfall');
      }
    },
  },
  buried_hoard: {
    label: 'Buried Hoard',
    icon: '⛏️',
    description: 'An old mine cache of stone and iron ingots.',
    apply(x, y) {
      const stone = 50 + Math.floor(Math.random() * 51); // 50–100
      const iron  = 30 + Math.floor(Math.random() * 31); // 30–60
      const sCap  = state.caps.stone ?? 500;
      const iCap  = state.caps.iron  ?? 500;
      state.resources.stone = Math.min(sCap, (state.resources.stone ?? 0) + stone);
      state.resources.iron  = Math.min(iCap, (state.resources.iron  ?? 0) + iron);
      addMessage(`⛏️ Buried hoard at (${x},${y})! +${stone} stone, +${iron} iron.`, 'windfall');
    },
  },
  wandering_sage: {
    label: 'Wandering Sage',
    icon: '🧙',
    description: 'An elder sage who blesses your soldiers with wisdom.',
    apply(x, y) {
      changeMorale(15);
      addMessage(`🧙 A wandering sage at (${x},${y}) uplifted your people! +15 morale.`, 'windfall');
    },
  },
};

/** Idempotent init — safe to call multiple times (boot + _newGame). */
export function initDiscoveries() {
  if (!state.discoveries) {
    state.discoveries = { claimed: {}, totalClaimed: 0 };
  } else {
    if (!state.discoveries.claimed)     state.discoveries.claimed     = {};
    if (state.discoveries.totalClaimed == null) state.discoveries.totalClaimed = 0;
  }
}

/**
 * Called by mapPanel.js (and optionally other systems) whenever tiles are
 * newly revealed.  Pass the array returned by revealAround().
 * Each freshly revealed tile has a DISCOVERY_CHANCE to contain a discovery.
 * Mountain and ruins tiles get a slight bonus (+10%) for flavor.
 */
export function spawnDiscoveries(newlyRevealedTiles) {
  if (!state.map || !state.discoveries || !newlyRevealedTiles?.length) return;
  const { tiles } = state.map;

  for (const { x, y } of newlyRevealedTiles) {
    const tile = tiles[y]?.[x];
    if (!tile) continue;
    // Only neutral or player non-capital tiles without an existing discovery
    if (tile.owner === 'enemy' || tile.owner === 'barbarian') continue;
    if (tile.type === 'capital') continue;
    if (tile.discovery) continue;
    if (state.discoveries.claimed[`${x},${y}`]) continue;

    let chance = DISCOVERY_CHANCE;
    if (tile.type === 'mountain' || tile.hasRuin) chance += 0.10;

    if (Math.random() < chance) {
      const type = DISCOVERY_TYPES[Math.floor(Math.random() * DISCOVERY_TYPES.length)];
      tile.discovery = type;
      emit(Events.DISCOVERY_FOUND, { x, y, type });
    }
  }
}

/**
 * Claim the discovery on tile (x, y).
 * Applies rewards, marks as claimed, clears tile.discovery, and emits MAP_CHANGED.
 * Returns true if a discovery was claimed, false if none existed.
 */
export function claimDiscovery(x, y) {
  if (!state.map || !state.discoveries) return false;
  const tile = state.map.tiles[y]?.[x];
  if (!tile?.discovery) return false;

  const type = tile.discovery;
  const def  = DISCOVERY_DEFS[type];
  if (!def) return false;

  // Apply the reward
  def.apply(x, y);

  // Mark as claimed
  tile.discovery = null;
  state.discoveries.claimed[`${x},${y}`] = true;
  state.discoveries.totalClaimed++;

  recalcRates();
  emit(Events.RESOURCE_CHANGED, {});
  emit(Events.MAP_CHANGED, { x, y, type: 'discovery-claimed' });
  return true;
}

/**
 * Get the discovery definition for a given type id.
 * Used by the UI to display the discovery modal.
 */
export function getDiscoveryDef(type) {
  return DISCOVERY_DEFS[type] ?? null;
}
