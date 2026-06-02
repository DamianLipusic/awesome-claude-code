/**
 * EmpireOS — Wandering Linen Merchant (T479).
 *
 * Every 12–16 minutes (Bronze Age+, 8+ player tiles), a wandering linen
 * merchant arrives at the settlement leading a pair of pack-horses whose
 * panniers are filled with rolled bolts of finished linen — some in the
 * natural pale straw colour of the undyed fibre, others bleached to a clean
 * white by repeated wetdressing and sun-laying on a stretch of close-cropped
 * grass, and a few dyed with weld or woad in even shades of yellow and blue —
 * along with a set of notes on the cultivation calendar for fibre flax: the
 * seeding rate and row spacing that produces long straight stems with few side
 * branches, the pulling date identified by the colour of the lowest leaves
 * rather than by a fixed number of days, and the retting schedule that
 * separates the bast fibre cleanly from the woody core without degrading the
 * fibre strength — offering to trade a consignment of fine linen for use in
 * the settlement's workshops and storerooms, or to share the production notes
 * so the settlement's growers can establish a productive linen harvest of
 * their own. The player has 80 seconds to decide.
 *
 * Choices:
 *   🪡 Trade Fine Linen                  — pay 25 food
 *        → +0.22 food/s for 2.5 min · +18 prestige · +10 morale
 *   📜 Purchase Weaving Secrets          — pay 18 gold
 *        → +0.15 gold/s for 2 min · +12 prestige
 *   🚶 Send Away                          — dismiss (no reward)
 *
 * state.wanderingLinenMerchant = {
 *   active:           { expiresAt: tick } | null,
 *   nextSpawnTick:    tick,
 *   totalVisits:      number,
 *   totalTrades:      number,
 *   totalPurchases:   number,
 *   totalDismissals:  number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 12 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  4 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 1;   // Bronze Age+
const MIN_PLAYER_TILES = 8;

export const TRADE_FOOD_COST              = 25;
export const TRADE_FOOD_RATE              = 0.22;
export const TRADE_PRESTIGE_REWARD        = 18;
export const TRADE_MORALE_REWARD          = 10;
export const TRADE_DURATION_TICKS         = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST           = 18;
export const PURCHASE_GOLD_RATE           = 0.15;
export const PURCHASE_PRESTIGE_REWARD     = 12;
export const PURCHASE_DURATION_TICKS      = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingLinenMerchant() {
  if (!state.wanderingLinenMerchant) {
    state.wanderingLinenMerchant = {
      active:          null,
      nextSpawnTick:   _nextSpawnTick(),
      totalVisits:     0,
      totalTrades:     0,
      totalPurchases:  0,
      totalDismissals: 0,
    };
  }
  const s = state.wanderingLinenMerchant;
  if (s.nextSpawnTick     === undefined) s.nextSpawnTick     = _nextSpawnTick();
  if (s.totalVisits       === undefined) s.totalVisits       = 0;
  if (s.totalTrades       === undefined) s.totalTrades       = 0;
  if (s.totalPurchases    === undefined) s.totalPurchases    = 0;
  if (s.totalDismissals   === undefined) s.totalDismissals   = 0;
}

export function wanderingLinenMerchantTick() {
  const a = state.wanderingLinenMerchant;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_LINEN_MERCHANT_CHANGED, { expired: true });
      addMessage('🪡 The wandering linen merchant reloads the bolt-rolls onto the pack-horses, secures the top flap of each pannier, and continues along the road toward the next settlement.', 'info');
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
  emit(Events.WANDERING_LINEN_MERCHANT_CHANGED, { spawned: true });
  addMessage('🪡 A wandering linen merchant arrives leading pack-horses whose panniers are filled with rolled bolts of finished linen — natural straw-coloured, sun-bleached white, and weld-dyed yellow — along with cultivation notes on seeding rate, pulling date, and retting schedule for fibre flax. The merchant offers to trade a consignment of fine linen for the settlement\'s workshops and storerooms, or to share the production notes so local growers can establish a productive linen harvest. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingLinenMerchant() { return state.wanderingLinenMerchant?.active ?? null; }
export function getLinenMerchantSecsLeft() {
  const a = state.wanderingLinenMerchant?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function tradeFineLinen() {
  const a = state.wanderingLinenMerchant;
  if (!a?.active) return { ok: false, reason: 'No linen merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The linen merchant has departed.' };
  if ((state.resources.food ?? 0) < TRADE_FOOD_COST) return { ok: false, reason: `Need ${TRADE_FOOD_COST} food.` };
  state.resources.food -= TRADE_FOOD_COST;
  changeMorale(TRADE_MORALE_REWARD);
  awardPrestige(TRADE_PRESTIGE_REWARD, 'Traded for fine linen from the wandering linen merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'linenMerchantTrade');
    state.randomEvents.activeModifiers.push({
      id: 'linenMerchantTrade', resource: 'food',
      rateMult: 1 + (TRADE_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + TRADE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalTrades = (a.totalTrades ?? 0) + 1;
  emit(Events.WANDERING_LINEN_MERCHANT_CHANGED, { traded: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🪡 The merchant unloads the bolt-rolls and lays them out on the ground so the settlement's cloth-keeper can inspect the quality: the bleached bolts are unrolled a short distance to check the evenness of the weave and confirm that the bleaching has not weakened the fibre by over-retting, the dyed bolts are held up to the light to assess the colour penetration and check for undyed patches where the folded cloth did not reach the dye bath, and the natural-coloured bolts are examined for any grey or brown streaks that would indicate incompletely retted woody core mixed in with the bast. The cloth-keeper selects the best examples from each category, and the remainder are allocated to the settlement's workshops: the fine white bolts go to the tailors and embroiderers, the natural-coloured cloth is divided between the tentmakers and the sack-sewers, and the dyed bolts are reserved for the banners and ceremonial hangings. The immediate availability of a good stock of finished linen — which the settlement normally has to produce from its own retted and spun fibre — relieves the pressure on the textile workers and allows them to concentrate on the more skilled finishing tasks rather than on the preparatory stages. −${TRADE_FOOD_COST} food · +${TRADE_PRESTIGE_REWARD} prestige · +${TRADE_MORALE_REWARD} morale. Food surge: +${TRADE_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseWeavingSecrets() {
  const a = state.wanderingLinenMerchant;
  if (!a?.active) return { ok: false, reason: 'No linen merchant present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The linen merchant has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased linen weaving knowledge from the wandering linen merchant');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'linenMerchantPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'linenMerchantPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_LINEN_MERCHANT_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📜 The merchant unfolds the cultivation notes and goes through them section by section with the settlement's senior flax grower: the seeding rate section explains how a denser sowing suppresses side-branch development and forces the plants to put their energy into upward stem growth, producing longer internodes and thus longer fibres, while a thinner sowing produces shorter plants with more side branches and coarser fibre suitable for sacking rather than for fine cloth. The pulling section describes the visual cues that indicate the correct pulling date — the yellowing of the lowest two leaf pairs, not the lowest one, because pulling a day early results in fibre that has not yet developed its full cell-wall thickness and will shrink unevenly in the first washing — and explains the hand-pulling technique that keeps the roots attached so the full length of the stem is preserved. The retting section covers the water temperature and duration that separates the bast cleanly: cool slow retting over ten to fourteen days produces finer, more lustrous fibre than warm fast retting, but requires the grower to check the stems daily and pull the bundles as soon as the woody core begins to separate rather than waiting for a fixed number of days, because the fibre begins to degrade almost immediately after the retting is complete. The growers work through the practical implications for the settlement's own fields, identifying the adjustments they can make to the current season's crop. −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendLinenMerchantAway() {
  const a = state.wanderingLinenMerchant;
  if (!a?.active) return { ok: false, reason: 'No linen merchant present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_LINEN_MERCHANT_CHANGED, { dismissed: true });
  addMessage('🪡 The wandering linen merchant reloads the bolt-rolls onto the pack-horses, secures the top flap of each pannier, and continues along the road toward the next settlement.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
