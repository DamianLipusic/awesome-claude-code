/**
 * EmpireOS — Wandering Meadmaker (T487).
 *
 * Every 12–17 minutes (Bronze Age+, 8+ player tiles), a wandering meadmaker
 * arrives at the settlement leading a pack mule loaded with two sealed clay
 * vessels of finished mead and a collection of the trade tools: a carved wooden
 * stirring paddle worn smooth along its lower half from years of fermentation-
 * vat work, a set of wax-sealed sample bottles in a leather roll each filled
 * with mead at different stages of maturation from the pale straw-coloured
 * young brew through the deeper amber of a six-month ferment to the rich gold
 * of a year-aged reserve with its characteristic raisin-and-honeysuckle nose,
 * and a folded linen bag containing dried wildflower heads from six varieties
 * used to flavour specialty batches — the meadmaker's trademark blends built
 * from years of seasonal experimentation with local flower varieties and the
 * particular mineral character of different honey sources from upland versus
 * lowland hives.
 * The player has 80 seconds to decide.
 *
 * Choices:
 *   🍯 Brew Imperial Mead        — pay 25 food + 15 wood
 *        → +0.22 food/s for 2.5 min · +18 prestige · +12 morale
 *   📖 Purchase Meadmaking Lore  — pay 18 gold
 *        → +0.15 gold/s for 2 min · +10 prestige
 *   🚶 Send Away                  — dismiss (no reward)
 *
 * state.wanderingMeadmaker = {
 *   active:             { expiresAt: tick } | null,
 *   nextSpawnTick:      tick,
 *   totalVisits:        number,
 *   totalBrewed:        number,
 *   totalPurchases:     number,
 *   totalDismissals:    number,
 * }
 */

import { state }            from '../core/state.js';
import { emit, Events }     from '../core/events.js';
import { addMessage }       from '../core/actions.js';
import { changeMorale }     from '../systems/morale.js';
import { awardPrestige }    from '../systems/prestige.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const SPAWN_MIN        = 12 * 60 * TICKS_PER_SECOND;
const SPAWN_RANGE      =  5 * 60 * TICKS_PER_SECOND;
const WINDOW_TICKS     = 80 * TICKS_PER_SECOND;
const MIN_AGE          = 1;   // Bronze Age+
const MIN_PLAYER_TILES = 8;

export const BREW_FOOD_COST              = 25;
export const BREW_WOOD_COST              = 15;
export const BREW_FOOD_RATE              = 0.22;
export const BREW_PRESTIGE_REWARD        = 18;
export const BREW_MORALE_REWARD          = 12;
export const BREW_DURATION_TICKS         = Math.round(2.5 * 60 * TICKS_PER_SECOND);

export const PURCHASE_GOLD_COST          = 18;
export const PURCHASE_GOLD_RATE          = 0.15;
export const PURCHASE_PRESTIGE_REWARD    = 10;
export const PURCHASE_DURATION_TICKS     = Math.round(2 * 60 * TICKS_PER_SECOND);

export function initWanderingMeadmaker() {
  if (!state.wanderingMeadmaker) {
    state.wanderingMeadmaker = {
      active:           null,
      nextSpawnTick:    _nextSpawnTick(),
      totalVisits:      0,
      totalBrewed:      0,
      totalPurchases:   0,
      totalDismissals:  0,
    };
  }
  const s = state.wanderingMeadmaker;
  if (s.nextSpawnTick    === undefined) s.nextSpawnTick    = _nextSpawnTick();
  if (s.totalVisits      === undefined) s.totalVisits      = 0;
  if (s.totalBrewed      === undefined) s.totalBrewed      = 0;
  if (s.totalPurchases   === undefined) s.totalPurchases   = 0;
  if (s.totalDismissals  === undefined) s.totalDismissals  = 0;
}

export function wanderingMeadmakerTick() {
  const a = state.wanderingMeadmaker;
  if (!a) return;
  if (a.active) {
    if (state.tick >= a.active.expiresAt) {
      a.active = null; a.nextSpawnTick = _nextSpawnTick();
      emit(Events.WANDERING_MEADMAKER_CHANGED, { expired: true });
      addMessage('🍯 The wandering meadmaker loads the sample bottles back into the leather roll, leads the mule back onto the road, and continues to the next settlement.', 'info');
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
  emit(Events.WANDERING_MEADMAKER_CHANGED, { spawned: true });
  addMessage('🍯 A wandering meadmaker arrives leading a pack mule loaded with sealed clay vessels of finished mead and a leather roll of sample bottles showing the full maturation range — pale young brew through deep amber six-month ferment to rich year-aged gold with raisin and honeysuckle notes — along with dried wildflower heads from six varieties used to flavour specialty batches. The meadmaker offers to brew an imperial mead batch using the settlement\'s surplus provisions and fuel wood, or to teach the meadmaking craft so the settlement\'s brewers can produce their own seasonal batches. Respond within 80 seconds.', 'info');
}

export function getActiveWanderingMeadmaker() { return state.wanderingMeadmaker?.active ?? null; }
export function getMeadmakerSecsLeft() {
  const a = state.wanderingMeadmaker?.active;
  if (!a) return 0;
  return Math.max(0, Math.ceil((a.expiresAt - state.tick) / TICKS_PER_SECOND));
}

export function brewImperialMead() {
  const a = state.wanderingMeadmaker;
  if (!a?.active) return { ok: false, reason: 'No meadmaker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The meadmaker has departed.' };
  if ((state.resources.food ?? 0) < BREW_FOOD_COST) return { ok: false, reason: `Need ${BREW_FOOD_COST} food.` };
  if ((state.resources.wood ?? 0) < BREW_WOOD_COST) return { ok: false, reason: `Need ${BREW_WOOD_COST} wood.` };
  state.resources.food -= BREW_FOOD_COST;
  state.resources.wood -= BREW_WOOD_COST;
  changeMorale(BREW_MORALE_REWARD);
  awardPrestige(BREW_PRESTIGE_REWARD, 'Brewed imperial mead with the wandering meadmaker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'meadmakerBrew');
    state.randomEvents.activeModifiers.push({
      id: 'meadmakerBrew', resource: 'food',
      rateMult: 1 + (BREW_FOOD_RATE / Math.max(0.001, Math.abs(state.rates?.food ?? 1))),
      expiresAt: state.tick + BREW_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalBrewed = (a.totalBrewed ?? 0) + 1;
  emit(Events.WANDERING_MEADMAKER_CHANGED, { brewed: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`🍯 The meadmaker selects grain and dried fruit from the food stores in the proportions calculated to give the ferment enough sugars for a full secondary fermentation without overwhelming the honey character that distinguishes mead from ordinary ale — the grain contributes body and the dried fruit a residual sweetness that the wild yeasts leave partially unconverted, creating the characteristic gentle sweetness of a well-made mead without the cloying quality of a ferment that has not been given sufficient time before being sealed. The wood is split into short lengths suitable for maintaining a steady moderate fire rather than a high heat: the critical stage in mead production is not the boiling of the must but the slow warm ferment that follows, which requires an ambient temperature sustained above the threshold at which the wild yeast population becomes sluggish without rising to the level at which the ferment becomes turbulent and produces off-flavours from cell stress. The clay vessels are sealed with a mixture of beeswax and pine resin pressed into a groove around the fitted wooden lid, creating a seal that allows carbon dioxide to escape slowly while preventing the contamination from airborne wild yeasts distinct from the cultivated strain introduced at pitching. The first batch is ready within the session's duration — a young mead, not the year-aged reserve from the sample roll, but with the same wildflower character and a clean finish that reflects the meadmaker's control of the fermentation temperature throughout. −${BREW_FOOD_COST} food −${BREW_WOOD_COST} wood · +${BREW_PRESTIGE_REWARD} prestige · +${BREW_MORALE_REWARD} morale. Food surge: +${BREW_FOOD_RATE} food/s for 2.5 minutes.`, 'windfall');
  return { ok: true };
}

export function purchaseMeadmakingLore() {
  const a = state.wanderingMeadmaker;
  if (!a?.active) return { ok: false, reason: 'No meadmaker present.' };
  if (state.tick >= a.active.expiresAt) return { ok: false, reason: 'The meadmaker has departed.' };
  if ((state.resources.gold ?? 0) < PURCHASE_GOLD_COST) return { ok: false, reason: `Need ${PURCHASE_GOLD_COST} gold.` };
  state.resources.gold -= PURCHASE_GOLD_COST;
  awardPrestige(PURCHASE_PRESTIGE_REWARD, 'Purchased meadmaking lore from the wandering meadmaker');
  if (state.randomEvents?.activeModifiers !== undefined) {
    state.randomEvents.activeModifiers = state.randomEvents.activeModifiers.filter(m => m.id !== 'meadmakerPurchase');
    state.randomEvents.activeModifiers.push({
      id: 'meadmakerPurchase', resource: 'gold',
      rateMult: 1 + (PURCHASE_GOLD_RATE / Math.max(0.001, Math.abs(state.rates?.gold ?? 1))),
      expiresAt: state.tick + PURCHASE_DURATION_TICKS,
    });
  }
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalPurchases = (a.totalPurchases ?? 0) + 1;
  emit(Events.WANDERING_MEADMAKER_CHANGED, { purchased: true }); emit(Events.RESOURCE_CHANGED, {});
  addMessage(`📖 The meadmaking lore manual opens with a section on honey sourcing that distinguishes between the floral varieties by the plant species that dominate the foraging territory of the hive: lowland hives near meadow flowers produce a light delicate honey with a high fructose ratio that ferments cleanly and quickly, while upland hives near heather produce a thicker more aromatic honey with a higher protein content that requires longer conditioning before the must clears. The fermentation section covers the construction of a temperature-controlled ferment space using banked earth against the exterior of a stone-walled room: the thermal mass of the earth buffer dampens the daily temperature swing to a range manageable with a single small fire rather than requiring continuous stoking, and the gradual warming in the morning followed by the slow cooling through the night mirrors the natural rhythm that wild yeasts evolved in fruit ferments before they were recruited to brewing. The wildflower additive section lists the six varieties in the meadmaker's blend with their flavour contributions ranked from background to foreground: the elderflower for the front-of-palate delicacy that would be lost if added too early, the meadowsweet for the mid-palate body that balances the honey sweetness, the linden blossom for the persistent clean finish, and the three hedgerow species that provide the aromatic complexity that prevents the finished mead from tasting simply like diluted honey. The settlement's brewers practise the must preparation and pitching procedure on a small trial batch under the meadmaker's supervision, checking the must density with the calibrated floating gauge from the leather roll and adjusting with additional honey to reach the target fermentation gravity. −${PURCHASE_GOLD_COST} gold · +${PURCHASE_PRESTIGE_REWARD} prestige. Gold surge: +${PURCHASE_GOLD_RATE} gold/s for 2 minutes.`, 'windfall');
  return { ok: true };
}

export function sendMeadmakerAway() {
  const a = state.wanderingMeadmaker;
  if (!a?.active) return { ok: false, reason: 'No meadmaker present.' };
  a.active = null; a.nextSpawnTick = _nextSpawnTick(); a.totalDismissals = (a.totalDismissals ?? 0) + 1;
  emit(Events.WANDERING_MEADMAKER_CHANGED, { dismissed: true });
  addMessage('🍯 The wandering meadmaker loads the sample bottles back into the leather roll, leads the mule back onto the road, and continues to the next settlement.', 'info');
  return { ok: true };
}

function _nextSpawnTick() { return state.tick + SPAWN_MIN + Math.floor(Math.random() * SPAWN_RANGE); }
