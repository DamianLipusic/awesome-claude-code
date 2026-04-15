/**
 * EmpireOS — Wandering Merchant System (T087).
 *
 * Every 8–12 minutes a travelling merchant visits with 3 random item offers.
 * The merchant departs after 90 seconds. The player may purchase ONE offer
 * (or none). Purchasing closes all remaining offers.
 *
 * Item types:
 *   resource   — immediate resource grant
 *   research   — reduces current research by N seconds
 *   morale     — adds N army morale
 *   warbanner  — adds N War Banner charges (decree system)
 *   reveal     — reveals N random fog-of-war tiles
 *   unit       — instantly trains N units
 *   spell      — resets a spell cooldown
 *
 * State shape:
 *   state.merchant = {
 *     offer:         null | { items: [{id,icon,title,desc,cost,type,data?}], expiresAt },
 *     nextVisitTick: number,
 *     totalVisits:   number,
 *     totalPurchases: number,
 *   }
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';
import { changeMorale } from './morale.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Timing ────────────────────────────────────────────────────────────────────

const VISIT_MIN_TICKS  = 8  * 60 * TICKS_PER_SECOND;  // 8 min
const VISIT_MAX_TICKS  = 12 * 60 * TICKS_PER_SECOND;  // 12 min
const STAY_TICKS       = 90 * TICKS_PER_SECOND;        // 90 s

// ── Item pool ─────────────────────────────────────────────────────────────────

const ITEM_POOL = [
  {
    id:    'food_bundle',
    icon:  '🌾',
    title: 'Food Cache',
    desc:  'Fresh provisions — grants 300 food immediately.',
    cost:  120,
    type:  'resource',
    data:  { food: 300 },
  },
  {
    id:    'wood_bundle',
    icon:  '🪵',
    title: 'Timber Lot',
    desc:  'Seasoned lumber — grants 300 wood immediately.',
    cost:  100,
    type:  'resource',
    data:  { wood: 300 },
  },
  {
    id:    'stone_bundle',
    icon:  '🪨',
    title: 'Stone Blocks',
    desc:  'Quarried stone — grants 250 stone immediately.',
    cost:  110,
    type:  'resource',
    data:  { stone: 250 },
  },
  {
    id:    'iron_cache',
    icon:  '⚙️',
    title: 'Iron Cache',
    desc:  'Smelted iron ingots — grants 200 iron immediately.',
    cost:  150,
    type:  'resource',
    data:  { iron: 200 },
  },
  {
    id:    'mana_vial',
    icon:  '💎',
    title: 'Mana Vial',
    desc:  'Crystallised mana essence — grants 150 mana immediately.',
    cost:  180,
    type:  'resource',
    data:  { mana: 150 },
  },
  {
    id:    'ancient_tome',
    icon:  '📜',
    title: 'Ancient Tome',
    desc:  'Rare text of forgotten knowledge — reduces current research by 90 seconds.',
    cost:  250,
    type:  'research',
    data:  { reduceSecs: 90 },
  },
  {
    id:    'elixir',
    icon:  '⚗️',
    title: 'Morale Elixir',
    desc:  'Alchemical brew that fires up your soldiers — grants +20 army morale.',
    cost:  140,
    type:  'morale',
    data:  { amount: 20 },
  },
  {
    id:    'war_horn',
    icon:  '📯',
    title: 'War Horn',
    desc:  'Ancient rallying horn — adds 2 War Banner charges to your decree.',
    cost:  200,
    type:  'warbanner',
    data:  { charges: 2 },
  },
  {
    id:    'map_scroll',
    icon:  '🗺️',
    title: 'Surveyor\'s Map',
    desc:  'Reveals 10 unexplored map tiles through the fog of war.',
    cost:  130,
    type:  'reveal',
    data:  { tiles: 10 },
  },
  {
    id:    'infantry_contract',
    icon:  '🪖',
    title: 'Mercenary Band',
    desc:  'A small band of sell-swords joins your army — instantly trains 4 infantry.',
    cost:  160,
    type:  'unit',
    data:  { unitId: 'infantry', count: 4 },
  },
  {
    id:    'gold_stash',
    icon:  '💰',
    title: 'Recovered Treasury',
    desc:  'Looted wealth from a fallen realm — grants 400 gold immediately.',
    cost:  0,    // free! But barter cost covered by paying with 80 food + 80 wood
    costNote: '80 food + 80 wood',
    type:  'barter',
    data:  { gold: 400, costFood: 80, costWood: 80 },
  },
];

// ── Public API ────────────────────────────────────────────────────────────────

/** Idempotent init — safe to call on boot and new game. */
export function initMerchant() {
  if (!state.merchant) {
    state.merchant = {
      offer:          null,
      nextVisitTick:  state.tick + _visitInterval(),
      totalVisits:    0,
      totalPurchases: 0,
    };
  }
  // Migration guards for older saves
  if (state.merchant.totalVisits    === undefined) state.merchant.totalVisits    = 0;
  if (state.merchant.totalPurchases === undefined) state.merchant.totalPurchases = 0;
  if (state.merchant.nextVisitTick  === undefined) state.merchant.nextVisitTick  = state.tick + _visitInterval();
}

/** Tick system — spawns and expires merchant offers. */
export function merchantTick() {
  if (!state.merchant) return;

  const m = state.merchant;

  // Expire active offer
  if (m.offer && state.tick >= m.offer.expiresAt) {
    addMessage('🧳 The wandering merchant packs up and departs.', 'info');
    m.offer = null;
    m.nextVisitTick = state.tick + _visitInterval();
    emit(Events.MERCHANT_CHANGED, { type: 'departed' });
    return;
  }

  // Spawn new offer
  if (!m.offer && state.tick >= m.nextVisitTick) {
    m.offer = {
      items:     _pickItems(3),
      expiresAt: state.tick + STAY_TICKS,
    };
    m.totalVisits++;
    addMessage('🧳 A wandering merchant has arrived with rare goods! (90s)', 'windfall');
    emit(Events.MERCHANT_CHANGED, { type: 'arrived' });
  }
}

/**
 * Attempt to purchase item at index `idx` from the current merchant offer.
 * Returns { ok: boolean, reason?: string }.
 */
export function buyMerchantItem(idx) {
  const m = state.merchant;
  if (!m?.offer) return { ok: false, reason: 'No merchant is currently visiting.' };

  const item = m.offer.items[idx];
  if (!item)  return { ok: false, reason: 'Invalid item index.' };

  // Check affordability
  if (!_canAfford(item)) {
    return { ok: false, reason: 'Not enough resources.' };
  }

  // Deduct cost
  _deductCost(item);

  // Apply effect
  _applyEffect(item);

  // Close the offer (one purchase per visit)
  m.offer = null;
  m.totalPurchases++;
  m.nextVisitTick = state.tick + _visitInterval();

  emit(Events.MERCHANT_CHANGED, { type: 'purchased', item: item.id });
  emit(Events.RESOURCE_CHANGED, {});
  return { ok: true };
}

/** Seconds until merchant departs (0 if no active offer). */
export function merchantSecsLeft() {
  const offer = state.merchant?.offer;
  if (!offer) return 0;
  return Math.max(0, Math.ceil((offer.expiresAt - state.tick) / TICKS_PER_SECOND));
}

/** Seconds until next merchant visit (0 if already active). */
export function merchantNextVisitSecs() {
  if (state.merchant?.offer) return 0;
  const next = state.merchant?.nextVisitTick ?? 0;
  return Math.max(0, Math.ceil((next - state.tick) / TICKS_PER_SECOND));
}

/** Whether the player can afford a specific item (by index). */
export function canAffordItem(idx) {
  const item = state.merchant?.offer?.items[idx];
  return item ? _canAfford(item) : false;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _visitInterval() {
  return VISIT_MIN_TICKS + Math.floor(Math.random() * (VISIT_MAX_TICKS - VISIT_MIN_TICKS));
}

/** Randomly pick `n` distinct items from ITEM_POOL. */
function _pickItems(n) {
  const pool    = [...ITEM_POOL];
  const chosen  = [];
  while (chosen.length < n && pool.length > 0) {
    const i    = Math.floor(Math.random() * pool.length);
    chosen.push(pool.splice(i, 1)[0]);
  }
  return chosen;
}

function _canAfford(item) {
  if (item.type === 'barter') {
    return (state.resources.food ?? 0) >= item.data.costFood &&
           (state.resources.wood ?? 0) >= item.data.costWood;
  }
  return (state.resources.gold ?? 0) >= item.cost;
}

function _deductCost(item) {
  if (item.type === 'barter') {
    state.resources.food = Math.max(0, (state.resources.food ?? 0) - item.data.costFood);
    state.resources.wood = Math.max(0, (state.resources.wood ?? 0) - item.data.costWood);
  } else {
    state.resources.gold = Math.max(0, (state.resources.gold ?? 0) - item.cost);
  }
}

function _applyEffect(item) {
  switch (item.type) {
    case 'resource': {
      for (const [res, amount] of Object.entries(item.data)) {
        const cap = state.caps?.[res] ?? 9999;
        state.resources[res] = Math.min(cap, (state.resources[res] ?? 0) + amount);
      }
      addMessage(`🧳 Merchant: purchased ${item.title} — ${item.desc}`, 'windfall');
      break;
    }
    case 'barter': {
      const cap = state.caps?.gold ?? 9999;
      state.resources.gold = Math.min(cap, (state.resources.gold ?? 0) + item.data.gold);
      addMessage(`🧳 Merchant: bartered for ${item.title} — gained ${item.data.gold} gold.`, 'windfall');
      break;
    }
    case 'research': {
      if (state.researchQueue?.length > 0) {
        const entry = state.researchQueue[0];
        const reduction = item.data.reduceSecs * TICKS_PER_SECOND;
        entry.remaining = Math.max(0, entry.remaining - reduction);
        addMessage(`🧳 Merchant: ${item.title} — current research advanced by 90 seconds.`, 'info');
      } else {
        addMessage(`🧳 Merchant: ${item.title} purchased but no research in progress — effect wasted.`, 'info');
      }
      break;
    }
    case 'morale': {
      changeMorale(item.data.amount);
      addMessage(`🧳 Merchant: ${item.title} — army morale +${item.data.amount}.`, 'windfall');
      break;
    }
    case 'warbanner': {
      if (state.decrees) {
        state.decrees.warBannerCharges = (state.decrees.warBannerCharges ?? 0) + item.data.charges;
        addMessage(`🧳 Merchant: ${item.title} — War Banner +${item.data.charges} charges.`, 'info');
      } else {
        addMessage(`🧳 Merchant: ${item.title} — War Banner charges purchased (activate the Decree first).`, 'info');
      }
      break;
    }
    case 'reveal': {
      const count = _revealFogTiles(item.data.tiles);
      addMessage(`🧳 Merchant: ${item.title} — revealed ${count} map tiles.`, 'windfall');
      emit(Events.MAP_CHANGED, { outcome: 'reveal' });
      break;
    }
    case 'unit': {
      const { unitId, count } = item.data;
      state.units[unitId] = (state.units[unitId] ?? 0) + count;
      addMessage(`🧳 Merchant: ${item.title} — ${count} ${unitId} joined your army.`, 'windfall');
      emit(Events.UNIT_CHANGED, { unitId });
      break;
    }
  }
}

/** Reveal up to `n` unrevealed non-capital tiles that aren't already visible. */
function _revealFogTiles(n) {
  if (!state.map?.tiles) return 0;
  const hidden = [];
  for (const row of state.map.tiles) {
    for (const tile of row) {
      if (!tile.revealed) hidden.push(tile);
    }
  }
  const toReveal = Math.min(n, hidden.length);
  // Shuffle and reveal
  for (let i = hidden.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [hidden[i], hidden[j]] = [hidden[j], hidden[i]];
  }
  hidden.slice(0, toReveal).forEach(t => { t.revealed = true; });
  return toReveal;
}
