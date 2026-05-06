/**
 * EmpireOS — Diplomacy system.
 *
 * Manages relations with 3 AI empires: Iron Horde, Mage Council, Sea Wolves.
 * Relations: neutral | allied | war
 *
 * Allied empires accept trade routes (100 gold each, max 3) that grant
 * per-second resource income (see data/empires.js tradeGift values).
 * War empires periodically raid your gold and food stores.
 * AI empires change their stance autonomously every 60–120 s.
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';
import { recalcRates } from './resources.js';
import { EMPIRES } from '../data/empires.js';
import { TICKS_PER_SECOND } from '../core/tick.js';
import { changeReputation } from './reputation.js'; // T211

const AI_MIN_INTERVAL  = 60  * TICKS_PER_SECOND;   // 240 ticks  (~60 s)
const AI_MAX_INTERVAL  = 120 * TICKS_PER_SECOND;   // 480 ticks  (~120 s)
const WAR_RAID_MIN     = 45  * TICKS_PER_SECOND;   // 180 ticks  (~45 s)
const WAR_RAID_MAX     = 90  * TICKS_PER_SECOND;   // 360 ticks  (~90 s)

// T076: Alliance gift intervals
const GIFT_MIN_TICKS   = 5 * 60 * TICKS_PER_SECOND;  // 5 min = 1200 ticks
const GIFT_MAX_TICKS   = 7 * 60 * TICKS_PER_SECOND;  // 7 min = 1680 ticks

/**
 * Per-empire gift resource amounts.
 * Each gift scales gently with game tick so later games feel more rewarding.
 */
const EMPIRE_GIFTS = {
  ironHorde:   (tick) => ({
    iron: Math.round(20 + tick / 200),
    food: Math.round(15 + tick / 300),
  }),
  mageCouncil: (tick) => ({
    mana: Math.round(15 + tick / 200),
    gold: Math.round(20 + tick / 300),
  }),
  seaWolves:   (tick) => ({
    wood: Math.round(25 + tick / 200),
    food: Math.round(20 + tick / 300),
  }),
};

export const ALLIANCE_COST       = 200;
export const TRADE_ROUTE_COST    = 100;
export const PEACE_COST          = 300;
export const MARRIAGE_COST       = 300;   // T172: dynastic marriage gold cost
export const MAX_TRADE_ROUTES    = 3;
export const SURRENDER_COST      = 200;   // T058
export const WAR_SCORE_THRESHOLD = 20;    // T058

// T067: Tribute / ceasefire constants
export const TRIBUTE_COST          = 150;   // gold to pay for a ceasefire
export const TRIBUTE_DEMAND        = 60;    // gold received when demanding tribute
export const CEASEFIRE_TICKS       = 120 * TICKS_PER_SECOND; // 120 s
export const DEMAND_WARSCORE_MIN   = 10;    // warScore needed to demand tribute

// T081: Player-initiated diplomatic gifts
export const GIFT_SMALL_COST           = 50;    // gold cost of a small gift
export const GIFT_LARGE_COST           = 150;   // gold cost of a large gift
export const GIFT_SMALL_ALLY_CHANCE    = 0.30;  // 30% chance neutral→allied on small gift
export const GIFT_LARGE_ALLY_CHANCE    = 0.70;  // 70% chance neutral→allied on large gift
const PLAYER_GIFT_COOLDOWN_TICKS       = 120 * TICKS_PER_SECOND; // 30 s cooldown per empire

// T114: Alliance Favor constants
export const FAVOR_MAX          = 50;                        // max favor per allied empire
const FAVOR_ACCRUAL_TICKS       = 60 * TICKS_PER_SECOND;    // 1 point every 60 ticks (15s)
export const FAVOR_REQUESTS = {
  gold_loan:      { label: '💰 Gold Loan',       cost: 25, desc: 'Receive 300 gold from your ally.' },
  supply_convoy:  { label: '🚚 Supply Convoy',   cost: 35, desc: 'Receive 100 food + 50 wood + 50 stone.' },
  war_party:      { label: '⚔️ War Party',        cost: 45, desc: 'Ally sends a war party — +10 morale, +80 prestige.' },
};

// T159: Trade Embargo constants
export const EMBARGO_COST              = 100;                          // gold to declare
const EMBARGO_DURATION_TICKS           = 5  * 60 * TICKS_PER_SECOND;  // 5 min active
const EMBARGO_COOLDOWN_TICKS           = 8  * 60 * TICKS_PER_SECOND;  // 8 min cooldown after expiry

// T088: Border Skirmish constants
const SKIRMISH_INTERVAL_MIN  = 15 * 60 * TICKS_PER_SECOND;  // 15 min between skirmishes
const SKIRMISH_INTERVAL_MAX  = 20 * 60 * TICKS_PER_SECOND;  // 20 min between skirmishes
const SKIRMISH_DURATION_MIN  = 3  * 60 * TICKS_PER_SECOND;  // 3 min duration
const SKIRMISH_DURATION_MAX  = 5  * 60 * TICKS_PER_SECOND;  // 5 min duration
export const SKIRMISH_ATTACK_BONUS  = 0.20;  // player gets +20% win chance vs skirmishing empire
export const MEDIATE_MIN_ALLIANCES  = 2;     // alliances needed to mediate
export const MEDIATE_GOLD_REWARD    = 150;
export const MEDIATE_PRESTIGE       = 50;

// T185: Trade Route Specializations — doubles income from one resource per empire
export const TRADE_SPEC_TYPES = Object.freeze({
  food_route: { icon: '🌾', name: 'Grain Route',  desc: 'Doubles food income from this trade route.', resource: 'food' },
  gold_route: { icon: '💰', name: 'Luxury Route', desc: 'Doubles gold income from this trade route.', resource: 'gold' },
  iron_route: { icon: '⚒️', name: 'Iron Route',   desc: 'Doubles iron income from this trade route. Requires metalworking tech.', resource: 'iron', requires: 'metalworking' },
});
export const TRADE_SPEC_ORDER = ['food_route', 'gold_route', 'iron_route'];

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Called once during boot. Initialises state.diplomacy for a new game,
 * or leaves existing save data intact.
 */
export function initDiplomacy() {
  if (!state.diplomacy) {
    state.diplomacy = {
      empires: Object.keys(EMPIRES).map(id => ({
        id,
        relations:              'neutral',
        tradeRoutes:            0,
        nextAITick:             state.tick + _aiInterval(),
        nextWarRaidTick:        0,
        warScore:               0,   // T058
        ceasefireTick:          0,   // T067
        nextGiftTick:           state.tick + _giftInterval(),   // T076
        playerGiftCooldownUntil: 0,                              // T081
      })),
      history:          [],    // T054: diplomatic event log
      skirmish:         null,  // T088: active AI vs AI border skirmish
      nextSkirmishTick: state.tick + _skirmishInterval(),  // T088
    };
  }
  // T054: migrate saves that predate the history field
  if (!state.diplomacy.history) state.diplomacy.history = [];
  // T058: migrate saves that predate the warScore field
  for (const emp of state.diplomacy.empires) {
    if (emp.warScore === undefined) emp.warScore = 0;
  }
  // T067: migrate saves that predate the ceasefireTick field
  for (const emp of state.diplomacy.empires) {
    if (emp.ceasefireTick === undefined) emp.ceasefireTick = 0;
  }
  // T076: migrate saves that predate the nextGiftTick field
  for (const emp of state.diplomacy.empires) {
    if (emp.nextGiftTick === undefined) emp.nextGiftTick = state.tick + _giftInterval();
  }
  // T081: migrate saves that predate the playerGiftCooldownUntil field
  for (const emp of state.diplomacy.empires) {
    if (emp.playerGiftCooldownUntil === undefined) emp.playerGiftCooldownUntil = 0;
  }
  // T088: migrate saves that predate border skirmish fields
  if (state.diplomacy.skirmish         === undefined) state.diplomacy.skirmish         = null;
  if (state.diplomacy.nextSkirmishTick === undefined) state.diplomacy.nextSkirmishTick = state.tick + _skirmishInterval();
  // T114: migrate saves that predate alliance favor
  for (const emp of state.diplomacy.empires) {
    if (emp.favor         === undefined) emp.favor         = 0;
    if (emp.nextFavorTick === undefined) emp.nextFavorTick = state.tick + FAVOR_ACCRUAL_TICKS;
  }
  // T159: migrate saves that predate trade embargo fields
  for (const emp of state.diplomacy.empires) {
    if (emp.embargoUntil          === undefined) emp.embargoUntil          = 0;
    if (emp.embargoCooldownUntil  === undefined) emp.embargoCooldownUntil  = 0;
  }
  // T185: migrate saves that predate tradeSpec field
  for (const emp of state.diplomacy.empires) {
    if (emp.tradeSpec === undefined) emp.tradeSpec = null;
  }
}

/**
 * Registered as a tick system. Processes AI actions and war raids each tick.
 */
export function diplomacyTick() {
  if (!state.diplomacy) return;

  for (const emp of state.diplomacy.empires) {
    // War raids — check periodically
    if (emp.relations === 'war' && state.tick >= emp.nextWarRaidTick) {
      _warRaid(emp);
      emp.nextWarRaidTick = state.tick + WAR_RAID_MIN +
        Math.floor(Math.random() * (WAR_RAID_MAX - WAR_RAID_MIN));
    }

    // T076: Alliance gifts — allied empires periodically send resource gifts
    if (emp.relations === 'allied' && state.tick >= (emp.nextGiftTick ?? Infinity)) {
      _allianceGift(emp);
    }

    // T114: Alliance favor accrual — 1 point per FAVOR_ACCRUAL_TICKS when allied
    if (emp.relations === 'allied' && state.tick >= (emp.nextFavorTick ?? Infinity)) {
      emp.favor = Math.min(FAVOR_MAX, (emp.favor ?? 0) + 1);
      emp.nextFavorTick = state.tick + FAVOR_ACCRUAL_TICKS;
      emit(Events.ALLIANCE_FAVOR_CHANGED, { empireId: emp.id, favor: emp.favor });
    }

    // T159: Expire trade embargo when duration elapsed
    if ((emp.embargoUntil ?? 0) > 0 && state.tick >= emp.embargoUntil) {
      emp.embargoUntil         = 0;
      emp.embargoCooldownUntil = state.tick + EMBARGO_COOLDOWN_TICKS;
      const def = EMPIRES[emp.id];
      addMessage(`📜 Trade embargo against ${def.icon} ${def.name} has expired.`, 'info');
      emit(Events.EMBARGO_CHANGED, { empireId: emp.id, active: false });
    }

    // AI diplomatic stance change
    if (state.tick >= emp.nextAITick) {
      _aiAction(emp);
      emp.nextAITick = state.tick + _aiInterval();
    }
  }

  // T088: Border skirmish lifecycle
  _skirmishTick();
}

// ── Player actions ─────────────────────────────────────────────────────────────

/** Spend 200 gold to propose an alliance with a neutral empire. */
export function proposeAlliance(empireId) {
  const emp = _findEmpire(empireId);
  if (!emp) return { ok: false, reason: 'Unknown empire.' };
  if (emp.relations !== 'neutral')
    return { ok: false, reason: 'Can only propose an alliance from neutral relations.' };
  if ((state.resources.gold ?? 0) < ALLIANCE_COST)
    return { ok: false, reason: `Need ${ALLIANCE_COST} gold.` };

  state.resources.gold -= ALLIANCE_COST;
  emp.relations = 'allied';
  const def = EMPIRES[empireId];
  recalcRates();
  changeReputation(+5, 'alliance forged'); // T211
  emit(Events.DIPLOMACY_CHANGED, { empireId, relations: 'allied' });
  emit(Events.RESOURCE_CHANGED, {});
  _logDiplomacy(empireId, 'alliance', `Alliance forged with ${def.name}`);
  addMessage(`🤝 Alliance forged with ${def.icon} ${def.name}!`, 'diplomacy');
  return { ok: true };
}

/** Spend 100 gold to open a trade route with an allied empire (max 3). */
export function openTradeRoute(empireId) {
  const emp = _findEmpire(empireId);
  if (!emp) return { ok: false, reason: 'Unknown empire.' };
  if (emp.relations !== 'allied')
    return { ok: false, reason: 'Must be allied to open trade routes.' };
  if (emp.tradeRoutes >= MAX_TRADE_ROUTES)
    return { ok: false, reason: `Maximum ${MAX_TRADE_ROUTES} trade routes per empire.` };
  if ((state.resources.gold ?? 0) < TRADE_ROUTE_COST)
    return { ok: false, reason: `Need ${TRADE_ROUTE_COST} gold.` };

  state.resources.gold -= TRADE_ROUTE_COST;
  emp.tradeRoutes++;
  const def = EMPIRES[empireId];
  recalcRates();
  emit(Events.DIPLOMACY_CHANGED, { empireId, tradeRoutes: emp.tradeRoutes });
  emit(Events.RESOURCE_CHANGED, {});
  _logDiplomacy(empireId, 'trade', `Trade route opened with ${def.name} (${emp.tradeRoutes}/${MAX_TRADE_ROUTES})`);
  addMessage(
    `🛤️ Trade route opened with ${def.icon} ${def.name} (${emp.tradeRoutes}/${MAX_TRADE_ROUTES}).`,
    'diplomacy',
  );
  return { ok: true };
}

/** Close one trade route with an allied empire (free). */
export function closeTradeRoute(empireId) {
  const emp = _findEmpire(empireId);
  if (!emp || emp.tradeRoutes <= 0)
    return { ok: false, reason: 'No trade routes to close.' };

  emp.tradeRoutes--;
  const def = EMPIRES[empireId];
  recalcRates();
  emit(Events.DIPLOMACY_CHANGED, { empireId, tradeRoutes: emp.tradeRoutes });
  _logDiplomacy(empireId, 'trade', `Trade route closed with ${def.name}`);
  addMessage(`❌ Trade route closed with ${def.icon} ${def.name}.`, 'info');
  return { ok: true };
}

/** T185: Set (or toggle off) a trade route specialization for an allied empire. */
export function setTradeSpec(empireId, type) {
  const emp = _findEmpire(empireId);
  if (!emp || emp.relations !== 'allied' || emp.tradeRoutes <= 0) return;
  if (type && TRADE_SPEC_TYPES[type]?.requires && !state.techs[TRADE_SPEC_TYPES[type].requires]) {
    addMessage(`⚠️ Requires ${TRADE_SPEC_TYPES[type].requires} tech for this route specialization.`, 'info');
    return;
  }
  emp.tradeSpec = (emp.tradeSpec === type) ? null : type;
  recalcRates();
  const label = emp.tradeSpec
    ? `${TRADE_SPEC_TYPES[emp.tradeSpec].icon} ${TRADE_SPEC_TYPES[emp.tradeSpec].name}`
    : 'unspecialized';
  const def = EMPIRES[empireId];
  addMessage(`🛤️ ${def.icon} ${def.name} trade route: ${label}.`, 'info');
  emit(Events.DIPLOMACY_CHANGED, { empireId, tradeSpec: emp.tradeSpec });
}

/** Declare war on any empire (free; closes all trade routes). */
export function declareWar(empireId) {
  const emp = _findEmpire(empireId);
  if (!emp) return { ok: false, reason: 'Unknown empire.' };
  if (emp.relations === 'war') return { ok: false, reason: 'Already at war.' };

  const wasAllied   = emp.relations === 'allied';
  emp.relations     = 'war';
  emp.tradeRoutes   = 0;
  emp.warScore      = 0;   // T058: fresh war score when war begins
  emp.favor         = 0;   // T114: reset favor when alliance broken
  emp.nextWarRaidTick = state.tick + WAR_RAID_MIN;
  const def = EMPIRES[empireId];
  recalcRates();
  changeReputation(-10, 'war declared'); // T211
  emit(Events.DIPLOMACY_CHANGED, { empireId, relations: 'war' });
  if (wasAllied) emit(Events.RESOURCE_CHANGED, {});
  _logDiplomacy(empireId, 'war', `You declared war on ${def.name}`);
  addMessage(`⚔️ You declared WAR on ${def.icon} ${def.name}!`, 'raid');
  return { ok: true };
}

/** Spend 300 gold to end a war and restore neutral relations. */
export function proposePeace(empireId) {
  const emp = _findEmpire(empireId);
  if (!emp) return { ok: false, reason: 'Unknown empire.' };
  if (emp.relations !== 'war')
    return { ok: false, reason: 'Not at war with this empire.' };
  if ((state.resources.gold ?? 0) < PEACE_COST)
    return { ok: false, reason: `Need ${PEACE_COST} gold.` };

  state.resources.gold -= PEACE_COST;
  emp.relations = 'neutral';
  const def = EMPIRES[empireId];
  recalcRates();
  changeReputation(+8, 'peace treaty signed'); // T211
  emit(Events.DIPLOMACY_CHANGED, { empireId, relations: 'neutral' });
  emit(Events.RESOURCE_CHANGED, {});
  _logDiplomacy(empireId, 'peace', `Peace treaty signed with ${def.name}`);
  addMessage(`🕊️ Peace treaty signed with ${def.icon} ${def.name}.`, 'diplomacy');
  return { ok: true };
}

/**
 * (T058) Force an empire to surrender after accumulating ≥ WAR_SCORE_THRESHOLD
 * war score. Costs SURRENDER_COST gold. Resets the empire to neutral and
 * clears their war score.
 */
export function demandSurrender(empireId) {
  const emp = _findEmpire(empireId);
  if (!emp) return { ok: false, reason: 'Unknown empire.' };
  if (emp.relations !== 'war') return { ok: false, reason: 'Not at war with this empire.' };
  if ((emp.warScore ?? 0) < WAR_SCORE_THRESHOLD)
    return { ok: false, reason: `Need ${WAR_SCORE_THRESHOLD} war score (currently ${emp.warScore ?? 0}).` };
  if ((state.resources.gold ?? 0) < SURRENDER_COST)
    return { ok: false, reason: `Need ${SURRENDER_COST} gold to issue the surrender ultimatum.` };

  state.resources.gold -= SURRENDER_COST;
  emp.relations = 'neutral';
  emp.warScore  = 0;
  const def = EMPIRES[empireId];
  recalcRates();
  emit(Events.DIPLOMACY_CHANGED, { empireId, relations: 'neutral' });
  emit(Events.RESOURCE_CHANGED, {});
  _logDiplomacy(empireId, 'peace', `${def.name} surrendered after crushing military defeats`);
  addMessage(
    `🏳️ ${def.icon} ${def.name} surrendered! Your victories forced them to yield.`,
    'diplomacy',
  );
  return { ok: true };
}

/**
 * (T067) Pay tribute to a war empire for a ceasefire.
 * Costs TRIBUTE_COST gold; suppresses raids for CEASEFIRE_TICKS ticks.
 */
export function payTribute(empireId) {
  const emp = _findEmpire(empireId);
  if (!emp) return { ok: false, reason: 'Unknown empire.' };
  if (emp.relations !== 'war') return { ok: false, reason: 'Not at war with this empire.' };
  if (emp.ceasefireTick > state.tick)
    return { ok: false, reason: 'Ceasefire already active.' };
  if ((state.resources.gold ?? 0) < TRIBUTE_COST)
    return { ok: false, reason: `Need ${TRIBUTE_COST} gold.` };

  state.resources.gold -= TRIBUTE_COST;
  emp.ceasefireTick = state.tick + CEASEFIRE_TICKS;
  const def = EMPIRES[empireId];
  emit(Events.DIPLOMACY_CHANGED, { empireId });
  emit(Events.RESOURCE_CHANGED, {});
  _logDiplomacy(empireId, 'peace', `Paid tribute to ${def.name} — ceasefire for 30s`);
  addMessage(
    `🏳️ Paid tribute to ${def.icon} ${def.name}. Raids suppressed for 30 seconds.`,
    'diplomacy',
  );
  return { ok: true };
}

/**
 * (T067) Demand tribute from a losing war empire.
 * Requires warScore >= DEMAND_WARSCORE_MIN; grants TRIBUTE_DEMAND gold.
 */
export function demandTribute(empireId) {
  const emp = _findEmpire(empireId);
  if (!emp) return { ok: false, reason: 'Unknown empire.' };
  if (emp.relations !== 'war') return { ok: false, reason: 'Not at war with this empire.' };
  if ((emp.warScore ?? 0) < DEMAND_WARSCORE_MIN)
    return { ok: false, reason: `Need ${DEMAND_WARSCORE_MIN} war score (have ${emp.warScore ?? 0}).` };
  if (emp.ceasefireTick > state.tick)
    return { ok: false, reason: 'Tribute demand already pending.' };

  const gold = Math.min(state.caps.gold, (state.resources.gold ?? 0) + TRIBUTE_DEMAND);
  state.resources.gold = gold;
  emp.ceasefireTick = state.tick + CEASEFIRE_TICKS;  // they pay — no raids while "paying"
  const def = EMPIRES[empireId];
  emit(Events.DIPLOMACY_CHANGED, { empireId });
  emit(Events.RESOURCE_CHANGED, {});
  _logDiplomacy(empireId, 'trade', `Demanded tribute from ${def.name} — received ${TRIBUTE_DEMAND} gold`);
  addMessage(
    `💰 ${def.icon} ${def.name} pays tribute! Received +${TRIBUTE_DEMAND} gold.`,
    'windfall',
  );
  return { ok: true };
}

/**
 * (T081) Player sends a gold gift to a neutral or allied empire.
 *
 * Neutral empires:
 *   small (50g) → 30% chance of immediate alliance; otherwise goodwill logged
 *   large (150g) → 70% chance of immediate alliance; otherwise goodwill logged
 * Allied empires:
 *   Either size → appreciation gift, no gameplay effect (shows goodwill)
 * War relations: gifts are not accepted — use peace/tribute mechanics instead.
 *
 * A 30-second per-empire cooldown prevents gift spam.
 */
export function sendGift(empireId, size = 'small') {
  const emp = _findEmpire(empireId);
  if (!emp) return { ok: false, reason: 'Unknown empire.' };
  if (emp.relations === 'war')
    return { ok: false, reason: 'Enemy empires reject your gifts. Use Peace or Tribute.' };

  const cost   = size === 'large' ? GIFT_LARGE_COST : GIFT_SMALL_COST;
  const chance = size === 'large' ? GIFT_LARGE_ALLY_CHANCE : GIFT_SMALL_ALLY_CHANCE;

  // Cooldown check
  const cdUntil = emp.playerGiftCooldownUntil ?? 0;
  if (cdUntil > state.tick) {
    const secsLeft = Math.ceil((cdUntil - state.tick) / TICKS_PER_SECOND);
    return { ok: false, reason: `Gift on cooldown — ${secsLeft}s remaining.` };
  }

  if ((state.resources.gold ?? 0) < cost)
    return { ok: false, reason: `Need ${cost} gold.` };

  const def = EMPIRES[empireId];
  state.resources.gold -= cost;
  emp.playerGiftCooldownUntil = state.tick + PLAYER_GIFT_COOLDOWN_TICKS;
  changeReputation(+3, 'gift sent'); // T211

  if (emp.relations === 'neutral') {
    if (Math.random() < chance) {
      // Gift accepted — empire proposes alliance
      emp.relations = 'allied';
      recalcRates();
      emit(Events.DIPLOMACY_CHANGED, { empireId, relations: 'allied' });
      emit(Events.RESOURCE_CHANGED, {});
      _logDiplomacy(empireId, 'alliance', `${def.name} was moved by your generosity — alliance formed!`);
      addMessage(
        `🎁→🤝 ${def.icon} ${def.name} was delighted by your gifts and proposes an alliance!`,
        'diplomacy',
      );
    } else {
      // Gift noted but no immediate stance change
      emit(Events.DIPLOMACY_CHANGED, { empireId });
      emit(Events.RESOURCE_CHANGED, {});
      _logDiplomacy(empireId, 'gift', `Sent ${size} gift to ${def.name} — goodwill improved`);
      addMessage(
        `🎁 Gifts sent to ${def.icon} ${def.name}. They are pleased but not yet ready to ally.`,
        'info',
      );
    }
  } else {
    // Allied — appreciate the gesture
    emit(Events.DIPLOMACY_CHANGED, { empireId });
    emit(Events.RESOURCE_CHANGED, {});
    _logDiplomacy(empireId, 'gift', `Sent appreciation gifts to ${def.name}`);
    addMessage(`🎁 Appreciation gifts sent to ${def.icon} ${def.name}. Your friendship strengthens.`, 'info');
  }

  return { ok: true };
}

// ── T114: Alliance Favor public API ──────────────────────────────────────────

/**
 * Spend accumulated favor with an allied empire for a powerful one-time benefit.
 * @param {string} empireId
 * @param {'gold_loan'|'supply_convoy'|'war_party'} requestType
 */
export function requestAllianceFavor(empireId, requestType) {
  const emp = _findEmpire(empireId);
  if (!emp) return { ok: false, reason: 'Unknown empire.' };
  if (emp.relations !== 'allied') return { ok: false, reason: 'Must be allied to request favors.' };

  const req = FAVOR_REQUESTS[requestType];
  if (!req) return { ok: false, reason: 'Unknown request type.' };

  const favor = emp.favor ?? 0;
  if (favor < req.cost)
    return { ok: false, reason: `Need ${req.cost} favor (have ${favor}).` };

  emp.favor -= req.cost;

  const empDef = EMPIRES[empireId];
  let rewardText = '';

  if (requestType === 'gold_loan') {
    state.resources.gold = Math.min(state.caps?.gold ?? 500, (state.resources.gold ?? 0) + 300);
    emit(Events.RESOURCE_CHANGED, {});
    rewardText = '+300 gold';
  } else if (requestType === 'supply_convoy') {
    state.resources.food  = Math.min(state.caps?.food  ?? 500, (state.resources.food  ?? 0) + 100);
    state.resources.wood  = Math.min(state.caps?.wood  ?? 500, (state.resources.wood  ?? 0) + 50);
    state.resources.stone = Math.min(state.caps?.stone ?? 500, (state.resources.stone ?? 0) + 50);
    emit(Events.RESOURCE_CHANGED, {});
    rewardText = '+100 food, +50 wood, +50 stone';
  } else if (requestType === 'war_party') {
    // Import lazily to avoid circular deps
    import('./morale.js').then(m => m.changeMorale(10));
    import('./prestige.js').then(m => m.awardPrestige(80, `war party from ${empDef.name}`));
    rewardText = '+10 morale, +80 prestige';
  }

  emit(Events.ALLIANCE_FAVOR_CHANGED, { empireId, favor: emp.favor, requestType });
  emit(Events.DIPLOMACY_CHANGED, { empireId });
  addMessage(`🤝 ${empDef.icon} ${empDef.name} granted your request: ${rewardText}!`, 'diplomacy');
  _logDiplomacy(empireId, 'gift', `Favor request: ${req.label} (${rewardText})`);
  return { ok: true };
}

// ── T172: Dynastic Marriage public API ───────────────────────────────────────

/**
 * Propose a dynastic marriage with an allied empire.
 * Requires Medieval Age (age >= 3), alliance, no existing marriage, and 300 gold.
 * Locks the AI alliance (partner won't break it), halves gift intervals, and
 * grants ×1.5 trade income from the partner (applied in resources.js).
 */
export function proposeDynasticMarriage(empireId) {
  const emp = _findEmpire(empireId);
  if (!emp) return { ok: false, reason: 'Unknown empire.' };
  if (emp.relations !== 'allied')
    return { ok: false, reason: 'Must be allied to propose a dynastic marriage.' };
  if ((state.age ?? 0) < 3)
    return { ok: false, reason: 'Dynastic marriages require the Medieval Age.' };
  if (state.dynasticMarriage?.partnerId)
    return { ok: false, reason: 'You already have a dynastic marriage partner.' };
  if ((state.resources.gold ?? 0) < MARRIAGE_COST)
    return { ok: false, reason: `Need ${MARRIAGE_COST} gold.` };

  state.resources.gold -= MARRIAGE_COST;
  state.dynasticMarriage = { partnerId: empireId };

  // Halve next gift tick so the first post-marriage gift arrives sooner
  emp.nextGiftTick = state.tick + Math.floor(_giftInterval() / 2);

  const def = EMPIRES[empireId];
  recalcRates();
  emit(Events.DIPLOMACY_CHANGED, { empireId, marriageFormed: true });
  emit(Events.RESOURCE_CHANGED, {});
  emit(Events.MARRIAGE_PROPOSED, { empireId });
  _logDiplomacy(empireId, 'alliance', `Dynastic marriage with ${def.name}`);
  addMessage(
    `💍 Dynastic marriage forged with ${def.icon} ${def.name}! The alliance is now unbreakable and trade income is increased.`,
    'diplomacy',
  );
  return { ok: true };
}

// ── T088: Border Skirmish public API ──────────────────────────────────────────

/**
 * Whether a border skirmish is currently active.
 */
export function isSkirmishActive() {
  return !!state.diplomacy?.skirmish;
}

/**
 * Get the current skirmish object or null.
 * { empire1Id, empire2Id, startedAt, endsAt, mediatedBy? }
 */
export function getSkirmish() {
  return state.diplomacy?.skirmish ?? null;
}

/**
 * Seconds until current skirmish ends (0 if none active).
 */
export function skirmishSecsLeft() {
  const sk = state.diplomacy?.skirmish;
  if (!sk) return 0;
  return Math.max(0, Math.ceil((sk.endsAt - state.tick) / TICKS_PER_SECOND));
}

/**
 * Attempt to mediate the active border skirmish.
 * Requires MEDIATE_MIN_ALLIANCES allied empires (including neither skirmisher).
 * Awards MEDIATE_GOLD_REWARD gold and MEDIATE_PRESTIGE prestige.
 */
export function mediateSkirmish() {
  const sk = state.diplomacy?.skirmish;
  if (!sk) return { ok: false, reason: 'No active border skirmish to mediate.' };
  if (sk.mediatedBy) return { ok: false, reason: 'Skirmish already being mediated.' };

  const alliedCount = state.diplomacy.empires.filter(e => e.relations === 'allied').length;
  if (alliedCount < MEDIATE_MIN_ALLIANCES) {
    return { ok: false, reason: `Need ${MEDIATE_MIN_ALLIANCES} allied empires to mediate.` };
  }

  // Mark mediated and resolve immediately (peace restored)
  sk.mediatedBy = 'player';
  sk.endsAt = state.tick;  // will be cleaned up by _skirmishTick this same tick

  return { ok: true };
}

// ── T159: Trade Embargo public API ────────────────────────────────────────────

/**
 * Declare a trade embargo against a non-allied empire.
 * Cost: EMBARGO_COST gold. Lasts EMBARGO_DURATION_TICKS.
 * Effect: that empire's war raids deal 30% less loot; player market sell prices +15%.
 */
export function declareEmbargo(empireId) {
  const emp = _findEmpire(empireId);
  if (!emp) return { ok: false, reason: 'Unknown empire.' };
  if (emp.relations === 'allied')
    return { ok: false, reason: 'Cannot embargo an allied empire.' };
  if ((emp.embargoUntil ?? 0) > state.tick)
    return { ok: false, reason: 'Embargo already active against this empire.' };
  const cdUntil = emp.embargoCooldownUntil ?? 0;
  if (cdUntil > state.tick) {
    const secsLeft = Math.ceil((cdUntil - state.tick) / TICKS_PER_SECOND);
    return { ok: false, reason: `Embargo on cooldown — ${secsLeft}s remaining.` };
  }
  if ((state.resources.gold ?? 0) < EMBARGO_COST)
    return { ok: false, reason: `Need ${EMBARGO_COST} gold.` };

  state.resources.gold -= EMBARGO_COST;
  emp.embargoUntil = state.tick + EMBARGO_DURATION_TICKS;
  const def = EMPIRES[empireId];
  emit(Events.EMBARGO_CHANGED, { empireId, active: true });
  emit(Events.RESOURCE_CHANGED, {});
  _logDiplomacy(empireId, 'embargo', `Trade embargo declared against ${def.name}`);
  addMessage(
    `🚫 Trade embargo declared against ${def.icon} ${def.name}! Their raids deal 30% less loot. Market sell prices +15% for 5 minutes.`,
    'diplomacy',
  );
  return { ok: true };
}

/**
 * Lift a trade embargo early (free). Starts the cooldown immediately.
 */
export function liftEmbargo(empireId) {
  const emp = _findEmpire(empireId);
  if (!emp) return { ok: false, reason: 'Unknown empire.' };
  if ((emp.embargoUntil ?? 0) <= state.tick)
    return { ok: false, reason: 'No active embargo against this empire.' };

  emp.embargoUntil         = 0;
  emp.embargoCooldownUntil = state.tick + EMBARGO_COOLDOWN_TICKS;
  const def = EMPIRES[empireId];
  emit(Events.EMBARGO_CHANGED, { empireId, active: false });
  _logDiplomacy(empireId, 'embargo', `Trade embargo lifted against ${def.name}`);
  addMessage(`📜 Trade embargo against ${def.icon} ${def.name} lifted early.`, 'info');
  return { ok: true };
}

/** Whether the specified empire is currently under a trade embargo. */
export function isEmbargoed(empireId) {
  const emp = _findEmpire(empireId);
  return emp ? (emp.embargoUntil ?? 0) > state.tick : false;
}

/** Seconds remaining on the active embargo (0 if none). */
export function embargoSecsLeft(empireId) {
  const emp = _findEmpire(empireId);
  if (!emp || (emp.embargoUntil ?? 0) <= state.tick) return 0;
  return Math.ceil((emp.embargoUntil - state.tick) / TICKS_PER_SECOND);
}

/** Seconds remaining on the per-empire embargo cooldown (0 if ready). */
export function embargoCooldownSecsLeft(empireId) {
  const emp = _findEmpire(empireId);
  if (!emp || (emp.embargoCooldownUntil ?? 0) <= state.tick) return 0;
  return Math.ceil((emp.embargoCooldownUntil - state.tick) / TICKS_PER_SECOND);
}

/** Whether any empire is currently under a trade embargo (for market sell bonus). */
export function anyEmbargoActive() {
  return state.diplomacy?.empires.some(e => (e.embargoUntil ?? 0) > state.tick) ?? false;
}

/**
 * Whether the target empire is currently in a border skirmish
 * (used by combat.js to apply bonus win chance).
 */
export function isEmpireInSkirmish(empireId) {
  const sk = state.diplomacy?.skirmish;
  return sk ? (sk.empire1Id === empireId || sk.empire2Id === empireId) : false;
}

// ── T174: Diplomatic Summit ───────────────────────────────────────────────────

export const SUMMIT_PRESTIGE_COST = 200;
export const SUMMIT_GOLD_COST     = 100;
// Resources allied empires can gift during a summit
const SUMMIT_GIFT_RESOURCES = ['gold', 'food', 'wood', 'stone', 'iron'];
const SUMMIT_GIFT_MIN = 60;
const SUMMIT_GIFT_MAX = 120;

/**
 * Call a Diplomatic Summit — once per age at Medieval Age.
 * Costs SUMMIT_PRESTIGE_COST prestige + SUMMIT_GOLD_COST gold.
 * Effects:
 *   - Each allied empire sends a random resource gift (60–120 units).
 *   - Each neutral empire gains +20 relations (may become allied).
 *   - Each war empire becomes angrier (−10 relations shown in log).
 */
export function callDiplomaticSummit() {
  if (!state.diplomacy) return { ok: false, reason: 'Diplomacy not yet initialised.' };
  if ((state.age ?? 0) < 3) return { ok: false, reason: 'Diplomatic summits require the Medieval Age.' };

  if (!state.summit) state.summit = { usedAtAge: null, totalSummits: 0 };
  if (state.summit.usedAtAge === state.age) {
    return { ok: false, reason: 'A summit has already been called this age.' };
  }

  const prestige = state.prestige?.score ?? 0;
  if (prestige < SUMMIT_PRESTIGE_COST) {
    return { ok: false, reason: `Need ${SUMMIT_PRESTIGE_COST} prestige to call a summit.` };
  }
  if ((state.resources.gold ?? 0) < SUMMIT_GOLD_COST) {
    return { ok: false, reason: `Need ${SUMMIT_GOLD_COST} gold to call a summit.` };
  }

  // Deduct costs
  if (state.prestige) state.prestige.score = Math.max(0, state.prestige.score - SUMMIT_PRESTIGE_COST);
  state.resources.gold -= SUMMIT_GOLD_COST;

  const giftLog = [];

  state.diplomacy.empires.forEach(emp => {
    const def = EMPIRES[emp.id];
    if (emp.relations === 'allied') {
      // Allied empires send a generous gift
      const res = SUMMIT_GIFT_RESOURCES[Math.floor(Math.random() * SUMMIT_GIFT_RESOURCES.length)];
      const amt = SUMMIT_GIFT_MIN + Math.floor(Math.random() * (SUMMIT_GIFT_MAX - SUMMIT_GIFT_MIN + 1));
      state.resources[res] = Math.min(state.caps[res] ?? 500, (state.resources[res] ?? 0) + amt);
      giftLog.push(`${def.icon} ${def.name} gifted ${amt} ${res}`);
      _logDiplomacy(emp.id, 'gift', `Summit gift: ${amt} ${res}`);
    } else if (emp.relations === 'neutral') {
      // Neutral empires are impressed — relations improve (20% chance of alliance)
      if (Math.random() < 0.2) {
        emp.relations = 'allied';
        recalcRates();
        emit(Events.DIPLOMACY_CHANGED, { empireId: emp.id, relations: 'allied' });
        _logDiplomacy(emp.id, 'alliance', `${def.name} joined your coalition at the summit!`);
        giftLog.push(`${def.icon} ${def.name} joined your coalition!`);
      } else {
        _logDiplomacy(emp.id, 'gift', `${def.name} attended the summit — goodwill improved`);
      }
    } else if (emp.relations === 'war') {
      // War empires are infuriated — noted in log only
      _logDiplomacy(emp.id, 'ai', `${def.name} condemned the summit`);
    }
  });

  state.summit.usedAtAge    = state.age;
  state.summit.totalSummits = (state.summit.totalSummits ?? 0) + 1;

  emit(Events.SUMMIT_CALLED, { age: state.age, gifts: giftLog });
  emit(Events.DIPLOMACY_CHANGED, { type: 'summit' });
  emit(Events.RESOURCE_CHANGED, {});

  const giftDesc = giftLog.length > 0 ? ` ${giftLog.join('; ')}.` : '';
  addMessage(`🌐 Diplomatic Summit called! Allied empires sent gifts.${giftDesc}`, 'diplomacy');
  return { ok: true };
}

export function getSummitCooldownMsg() {
  if (!state.summit) return null;
  if (state.summit.usedAtAge === state.age) return 'Summit used this age.';
  return null;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _findEmpire(id) {
  return state.diplomacy?.empires.find(e => e.id === id) ?? null;
}

function _aiInterval() {
  return AI_MIN_INTERVAL + Math.floor(Math.random() * (AI_MAX_INTERVAL - AI_MIN_INTERVAL));
}

function _giftInterval() {
  return GIFT_MIN_TICKS + Math.floor(Math.random() * (GIFT_MAX_TICKS - GIFT_MIN_TICKS));
}

function _skirmishInterval() {
  return SKIRMISH_INTERVAL_MIN + Math.floor(Math.random() * (SKIRMISH_INTERVAL_MAX - SKIRMISH_INTERVAL_MIN));
}

/** T088: Tick handler for border skirmish lifecycle. */
function _skirmishTick() {
  const d = state.diplomacy;

  // Expire active skirmish
  if (d.skirmish && state.tick >= d.skirmish.endsAt) {
    const sk = d.skirmish;
    const def1 = EMPIRES[sk.empire1Id];
    const def2 = EMPIRES[sk.empire2Id];
    d.skirmish = null;
    d.nextSkirmishTick = state.tick + _skirmishInterval();

    if (sk.mediatedBy === 'player') {
      // Player mediated — reward
      const cap = state.caps?.gold ?? 500;
      state.resources.gold = Math.min(cap, (state.resources.gold ?? 0) + MEDIATE_GOLD_REWARD);
      emit(Events.RESOURCE_CHANGED, {});
      addMessage(
        `🕊️ Your mediation ended the skirmish between ${def1.icon} ${def1.name} and ${def2.icon} ${def2.name}. Earned ${MEDIATE_GOLD_REWARD} gold!`,
        'diplomacy',
      );
      emit(Events.BORDER_SKIRMISH, { type: 'mediated', empire1Id: sk.empire1Id, empire2Id: sk.empire2Id });
      // Prestige award is handled in main.js via BORDER_SKIRMISH event listener
    } else {
      // Natural resolution — one side wins
      const winnerDef = Math.random() < 0.5 ? def1 : def2;
      addMessage(
        `⚔️ The border skirmish between ${def1.icon} ${def1.name} and ${def2.icon} ${def2.name} has ended. ${winnerDef.icon} ${winnerDef.name} holds the border.`,
        'info',
      );
      emit(Events.BORDER_SKIRMISH, { type: 'resolved', empire1Id: sk.empire1Id, empire2Id: sk.empire2Id });
    }
    emit(Events.DIPLOMACY_CHANGED, { type: 'skirmish-ended' });
    return;
  }

  // Spawn new skirmish
  if (!d.skirmish && state.tick >= d.nextSkirmishTick) {
    // Pick two empires that aren't allied with each other (and exist)
    const candidates = d.empires.filter(e => e.relations !== 'war'); // don't add skirmishes during existing wars
    if (candidates.length < 2) {
      d.nextSkirmishTick = state.tick + _skirmishInterval();
      return;
    }
    // Pick two distinct candidates
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const [emp1, emp2] = shuffled;
    const def1 = EMPIRES[emp1.id];
    const def2 = EMPIRES[emp2.id];

    const duration = SKIRMISH_DURATION_MIN +
      Math.floor(Math.random() * (SKIRMISH_DURATION_MAX - SKIRMISH_DURATION_MIN));

    d.skirmish = {
      empire1Id: emp1.id,
      empire2Id: emp2.id,
      startedAt: state.tick,
      endsAt:    state.tick + duration,
    };

    _logDiplomacy(null, 'skirmish',
      `Border skirmish erupted between ${def1.name} and ${def2.name}`);
    addMessage(
      `⚔️ Border skirmish! ${def1.icon} ${def1.name} and ${def2.icon} ${def2.name} clash at the frontier. Both empires are weakened — exploit the opportunity!`,
      'raid',
    );
    emit(Events.BORDER_SKIRMISH, { type: 'started', empire1Id: emp1.id, empire2Id: emp2.id });
    emit(Events.DIPLOMACY_CHANGED, { type: 'skirmish-started' });
  }
}

/**
 * T054: Append a diplomatic event to the history log (max 25, newest first).
 * @param {string} empireId  Key into EMPIRES (or null for non-empire events)
 * @param {string} type      'alliance'|'trade'|'war'|'peace'|'raid'|'ai'
 * @param {string} text      Human-readable description of the event
 */
function _logDiplomacy(empireId, type, text) {
  const hist = state.diplomacy?.history;
  if (!Array.isArray(hist)) return;
  hist.unshift({ tick: state.tick, empireId: empireId ?? null, type, text });
  if (hist.length > 25) hist.length = 25;
}

/**
 * T076: An allied empire sends a resource gift to the player.
 * Gift amounts are empire-specific and scale gently with game age.
 */
function _allianceGift(emp) {
  const def   = EMPIRES[emp.id];
  const giftFn = EMPIRE_GIFTS[emp.id];
  if (!giftFn) return;

  const gifts = giftFn(state.tick);
  const parts = [];
  for (const [res, amount] of Object.entries(gifts)) {
    const cap    = state.caps?.[res] ?? 500;
    const before = state.resources?.[res] ?? 0;
    const after  = Math.min(cap, before + amount);
    const gained = after - before;
    state.resources[res] = after;
    if (gained > 0) parts.push(`+${gained} ${res}`);
  }

  if (parts.length === 0) {
    // All resources were already at cap — still schedule next gift
    emp.nextGiftTick = state.tick + _giftInterval();
    return;
  }

  const summary = parts.join(', ');
  _logDiplomacy(emp.id, 'gift', `${def.name} sent gifts: ${summary}`);
  addMessage(`🎁 ${def.icon} ${def.name} sends gifts! ${summary}`, 'windfall');
  emit(Events.RESOURCE_CHANGED, {});
  emit(Events.ALLIANCE_GIFT, { empireId: emp.id, gifts });
  // T172: marriage partner sends gifts twice as often
  const isMarried = state.dynasticMarriage?.partnerId === emp.id;
  emp.nextGiftTick = state.tick + (isMarried ? Math.floor(_giftInterval() / 2) : _giftInterval());
}

function _warRaid(emp) {
  // T067: suppress raid during ceasefire
  if (emp.ceasefireTick > state.tick) return;
  if (Math.random() >= 0.5) return;  // 50% chance each check
  changeReputation(-3, 'war raid suffered'); // T211: enemy raids erode honor
  const def     = EMPIRES[emp.id];
  // T159: trade embargo reduces raid loot by 30%
  const raidMult = (emp.embargoUntil ?? 0) > state.tick ? 0.70 : 1.0;
  const gold = Math.floor(Math.max(5,  (state.resources.gold ?? 0) * 0.08 * raidMult));
  const food = Math.floor(Math.max(2,  (state.resources.food ?? 0) * 0.05 * raidMult));
  state.resources.gold = Math.max(0, (state.resources.gold ?? 0) - gold);
  state.resources.food = Math.max(0, (state.resources.food ?? 0) - food);
  _logDiplomacy(emp.id, 'raid', `${def.name} war raid — lost ${gold} gold, ${food} food`);
  addMessage(`${def.icon} ${def.name} war raid! Lost ${gold} gold and ${food} food.`, 'raid');
  emit(Events.RESOURCE_CHANGED, {});
}

function _aiAction(emp) {
  const def = EMPIRES[emp.id];
  const r   = Math.random();

  if (emp.relations === 'neutral') {
    if (r < def.warChance) {
      // AI declares war
      emp.relations       = 'war';
      emp.tradeRoutes     = 0;
      emp.nextWarRaidTick = state.tick + WAR_RAID_MIN;
      recalcRates();
      emit(Events.DIPLOMACY_CHANGED, { empireId: emp.id, relations: 'war' });
      _logDiplomacy(emp.id, 'war', `${def.name} declared war on your empire`);
      addMessage(`⚔️ The ${def.icon} ${def.name} has declared WAR on your empire!`, 'raid');
    } else if (r < def.warChance + def.allyChance) {
      // AI proposes alliance (player gets it for free)
      emp.relations = 'allied';
      recalcRates();
      emit(Events.DIPLOMACY_CHANGED, { empireId: emp.id, relations: 'allied' });
      _logDiplomacy(emp.id, 'alliance', `${def.name} proposed an alliance`);
      addMessage(
        `🤝 The ${def.icon} ${def.name} has proposed an ALLIANCE! You are now allied.`,
        'diplomacy',
      );
    }
  } else if (emp.relations === 'allied') {
    // T172: dynastic marriage partner can never break the alliance
    const isMarried = state.dynasticMarriage?.partnerId === emp.id;
    if (!isMarried && r < def.breakAllyChance) {
      // AI breaks the alliance
      emp.relations   = 'neutral';
      emp.tradeRoutes = 0;
      recalcRates();
      emit(Events.DIPLOMACY_CHANGED, { empireId: emp.id, relations: 'neutral' });
      _logDiplomacy(emp.id, 'ai', `${def.name} broke the alliance`);
      addMessage(
        `💔 The ${def.icon} ${def.name} has broken the alliance. Relations: neutral.`,
        'info',
      );
    }
  } else if (emp.relations === 'war') {
    if (r < def.peaceChance) {
      // AI proposes peace
      emp.relations = 'neutral';
      recalcRates();
      emit(Events.DIPLOMACY_CHANGED, { empireId: emp.id, relations: 'neutral' });
      _logDiplomacy(emp.id, 'peace', `${def.name} proposed peace`);
      addMessage(
        `🕊️ The ${def.icon} ${def.name} proposes PEACE. Hostilities have ceased.`,
        'diplomacy',
      );
    }
  }
}
