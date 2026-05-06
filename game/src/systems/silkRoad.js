/**
 * EmpireOS — Silk Road Trade Window (T218).
 *
 * At Iron Age+, the Silk Road opens every 20–25 minutes for 3 minutes.
 * Four exotic goods (drawn from a pool of 10) become available; the player
 * may purchase up to 2 per window.  Each good has a one-time effect or a
 * permanent passive bonus.
 *
 * Goods pool:
 *   fine_silks        (120g) — +30 morale · +20 prestige
 *   ancient_maps      (150g) — reveal 8 random unrevealed tiles
 *   eastern_herbs     (100g) — +80 food · grant 15-min plague immunity
 *   rare_spices        (90g) — +70 food · +5 morale
 *   iron_ingots        (80g) — +100 iron
 *   jade_figurines    (140g) — permanent +0.15 gold/s
 *   crystal_lens      (160g) — +60 mana · +35 prestige
 *   war_provisions    (110g) — +60 iron · +40 food
 *   philosophers_tome (170g) — +60 prestige · +5 Imperial Codex fragments
 *   silk_banner       (130g) — +35 morale · +20 prestige
 *
 * state.silkRoad = {
 *   current: {
 *     goods:       [{ id, icon, name, desc, cost, purchased }],
 *     expiresAt:   number,    // tick when window closes
 *     boughtCount: number,    // max 2 per window
 *   } | null,
 *   nextWindowTick:    number,
 *   totalPurchases:    number,
 *   permanentGoldRate: number,   // cumulative from jade_figurines
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { awardPrestige }    from './prestige.js';
import { changeMorale }     from './morale.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

// ── Constants ──────────────────────────────────────────────────────────────

const MIN_AGE         = 2;  // Iron Age+
const SPAWN_MIN       = 20 * 60 * TICKS_PER_SECOND;  // 20 min
const SPAWN_MAX       = 25 * 60 * TICKS_PER_SECOND;  // 25 min
const FIRST_DELAY     = 20 * 60 * TICKS_PER_SECOND;  // first window ≥ 20 min in
const WINDOW_TICKS    =  3 * 60 * TICKS_PER_SECOND;  // 3-min shopping window
const MAX_BUYS        = 2;
const GOODS_PER_SHOW  = 4;
const PLAGUE_IMMUNITY = 15 * 60 * TICKS_PER_SECOND;  // 15 min immunity from herbs
const JADE_GOLD_RATE  = 0.15;

// ── Goods pool ─────────────────────────────────────────────────────────────

const ALL_GOODS = [
  {
    id:   'fine_silks',
    icon: '🧵',
    name: 'Fine Silks',
    desc: '+30 morale · +20 prestige',
    cost: 120,
  },
  {
    id:   'ancient_maps',
    icon: '🗺️',
    name: 'Ancient Maps',
    desc: 'Reveal 8 unrevealed map tiles',
    cost: 150,
  },
  {
    id:   'eastern_herbs',
    icon: '🌿',
    name: 'Eastern Herbs',
    desc: '+80 food · 15-min plague immunity',
    cost: 100,
  },
  {
    id:   'rare_spices',
    icon: '🫙',
    name: 'Rare Spices',
    desc: '+70 food · +5 morale',
    cost: 90,
  },
  {
    id:   'iron_ingots',
    icon: '⚙️',
    name: 'Iron Ingots',
    desc: '+100 iron',
    cost: 80,
  },
  {
    id:   'jade_figurines',
    icon: '🐉',
    name: 'Jade Figurines',
    desc: 'Permanent +0.15 gold/s',
    cost: 140,
  },
  {
    id:   'crystal_lens',
    icon: '🔮',
    name: 'Crystal Lens',
    desc: '+60 mana · +35 prestige',
    cost: 160,
  },
  {
    id:   'war_provisions',
    icon: '⚔️',
    name: 'War Provisions',
    desc: '+60 iron · +40 food',
    cost: 110,
  },
  {
    id:   'philosophers_tome',
    icon: '📜',
    name: "Philosopher's Tome",
    desc: '+60 prestige · +5 codex fragments',
    cost: 170,
  },
  {
    id:   'silk_banner',
    icon: '🚩',
    name: 'Silk Banner',
    desc: '+35 morale · +20 prestige',
    cost: 130,
  },
];

// ── Init ───────────────────────────────────────────────────────────────────

export function initSilkRoad() {
  if (!state.silkRoad) {
    state.silkRoad = {
      current:           null,
      nextWindowTick:    state.tick + FIRST_DELAY,
      totalPurchases:    0,
      permanentGoldRate: 0,
    };
  } else {
    if (state.silkRoad.permanentGoldRate == null) state.silkRoad.permanentGoldRate = 0;
    if (state.silkRoad.totalPurchases   == null) state.silkRoad.totalPurchases = 0;
  }
}

// ── Tick ───────────────────────────────────────────────────────────────────

export function silkRoadTick() {
  if (!state.silkRoad) return;
  if ((state.age ?? 0) < MIN_AGE) return;

  const sr = state.silkRoad;

  // Close expired window
  if (sr.current && state.tick >= sr.current.expiresAt) {
    _closeWindow();
    return;
  }

  // Open new window
  if (!sr.current && state.tick >= sr.nextWindowTick) {
    _openWindow();
  }
}

// ── Private ────────────────────────────────────────────────────────────────

function _openWindow() {
  const sr = state.silkRoad;

  // Pick GOODS_PER_SHOW unique goods at random
  const pool   = ALL_GOODS.slice();
  const chosen = [];
  while (chosen.length < GOODS_PER_SHOW && pool.length) {
    const idx = Math.floor(Math.random() * pool.length);
    chosen.push({ ...pool.splice(idx, 1)[0], purchased: false });
  }

  sr.current = {
    goods:       chosen,
    expiresAt:   state.tick + WINDOW_TICKS,
    boughtCount: 0,
  };

  sr.nextWindowTick = state.tick
    + SPAWN_MIN + Math.floor(Math.random() * (SPAWN_MAX - SPAWN_MIN));

  addMessage(
    '🐪 The Silk Road caravan has arrived! Exotic goods available for 3 minutes. (Market tab)',
    'windfall',
  );
  emit(Events.SILK_ROAD_CHANGED, { type: 'opened' });
}

function _closeWindow() {
  const sr = state.silkRoad;
  const remaining = sr.current?.goods.filter(g => !g.purchased).length ?? 0;
  sr.current = null;
  if (remaining > 0) addMessage('🐪 The Silk Road caravan has departed.', 'info');
  emit(Events.SILK_ROAD_CHANGED, { type: 'closed' });
}

// ── Public Action ───────────────────────────────────────────────────────────

/**
 * Purchase a Silk Road good by id.
 * Returns { ok, reason } so the UI can show feedback.
 */
export function buySilkRoadGood(goodId) {
  const sr = state.silkRoad;
  if (!sr?.current) return { ok: false, reason: 'No Silk Road window is open.' };
  if (sr.current.boughtCount >= MAX_BUYS) {
    return { ok: false, reason: 'Already purchased the maximum (2) items this window.' };
  }

  const good = sr.current.goods.find(g => g.id === goodId);
  if (!good)           return { ok: false, reason: 'Item not found.' };
  if (good.purchased)  return { ok: false, reason: 'Already purchased.' };

  if ((state.resources.gold ?? 0) < good.cost) {
    return { ok: false, reason: `Need ${good.cost} gold.` };
  }

  state.resources.gold = (state.resources.gold ?? 0) - good.cost;
  good.purchased = true;
  sr.current.boughtCount++;
  sr.totalPurchases = (sr.totalPurchases ?? 0) + 1;

  _applyGood(good);

  addMessage(
    `🐪 Purchased ${good.icon} ${good.name} — ${good.desc}`,
    'windfall',
  );
  emit(Events.SILK_ROAD_CHANGED, { type: 'purchased', goodId });
  emit(Events.RESOURCE_CHANGED, {});
  return { ok: true };
}

function _applyGood(good) {
  const goldCap  = state.caps.gold  ?? 500;
  const foodCap  = state.caps.food  ?? 500;
  const ironCap  = state.caps.iron  ?? 500;
  const manaCap  = state.caps.mana  ?? 500;

  switch (good.id) {
    case 'fine_silks':
      changeMorale(30, 'Silk Road: Fine Silks');
      awardPrestige(20, 'Silk Road: Fine Silks');
      break;

    case 'ancient_maps':
      _revealTiles(8);
      emit(Events.MAP_CHANGED, { silkRoad: true });
      break;

    case 'eastern_herbs':
      state.resources.food = Math.min(foodCap, (state.resources.food ?? 0) + 80);
      if (state.plague) {
        state.plague.immuneUntil = Math.max(
          state.plague.immuneUntil ?? 0,
          state.tick + PLAGUE_IMMUNITY,
        );
      }
      break;

    case 'rare_spices':
      state.resources.food = Math.min(foodCap, (state.resources.food ?? 0) + 70);
      changeMorale(5, 'Silk Road: Rare Spices');
      break;

    case 'iron_ingots':
      state.resources.iron = Math.min(ironCap, (state.resources.iron ?? 0) + 100);
      break;

    case 'jade_figurines':
      state.silkRoad.permanentGoldRate =
        (state.silkRoad.permanentGoldRate ?? 0) + JADE_GOLD_RATE;
      break;

    case 'crystal_lens':
      state.resources.mana = Math.min(manaCap, (state.resources.mana ?? 0) + 60);
      awardPrestige(35, 'Silk Road: Crystal Lens');
      break;

    case 'war_provisions':
      state.resources.iron = Math.min(ironCap, (state.resources.iron ?? 0) + 60);
      state.resources.food = Math.min(foodCap, (state.resources.food ?? 0) + 40);
      break;

    case 'philosophers_tome':
      awardPrestige(60, "Silk Road: Philosopher's Tome");
      if (state.codex) {
        state.codex.fragments = (state.codex.fragments ?? 0) + 5;
        emit(Events.CODEX_MILESTONE, { fragments: state.codex.fragments });
      }
      break;

    case 'silk_banner':
      changeMorale(35, 'Silk Road: Silk Banner');
      awardPrestige(20, 'Silk Road: Silk Banner');
      break;

    default:
      break;
  }
}

function _revealTiles(count) {
  if (!state.map?.tiles) return;
  const tiles  = state.map.tiles;
  const h      = state.map.height;
  const w      = state.map.width;
  const hidden = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!tiles[y][x].revealed) hidden.push({ x, y });
    }
  }

  const toReveal = Math.min(count, hidden.length);
  for (let i = 0; i < toReveal; i++) {
    const idx = Math.floor(Math.random() * hidden.length);
    const { x, y } = hidden.splice(idx, 1)[0];
    tiles[y][x].revealed = true;
  }
}

// ── Public Helpers ─────────────────────────────────────────────────────────

export function isSilkRoadOpen()      { return !!state.silkRoad?.current; }
export function getSilkRoadSecsLeft() {
  const c = state.silkRoad?.current;
  if (!c) return 0;
  return Math.max(0, Math.ceil((c.expiresAt - state.tick) / TICKS_PER_SECOND));
}
export function getSilkRoadGoods()    { return state.silkRoad?.current?.goods ?? []; }
export function getSilkRoadBuysLeft() {
  const c = state.silkRoad?.current;
  return c ? MAX_BUYS - c.boughtCount : 0;
}
export function getSilkRoadNextSecs() {
  if (!state.silkRoad || state.silkRoad.current) return 0;
  return Math.max(0, Math.ceil((state.silkRoad.nextWindowTick - state.tick) / TICKS_PER_SECOND));
}
