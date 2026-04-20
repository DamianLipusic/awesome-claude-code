/**
 * EmpireOS — Resource Auction House (T126).
 *
 * Every 3–5 minutes a random bundle of resources goes up for auction.
 * The player can Bid (pays gold to compete) or Pass.
 * At expiry, if the player bid enough they win the bundle; otherwise it disappears.
 *
 * state.auction = {
 *   current: { bundle, bidGoal, playerBid, expiresAt } | null,
 *   nextAuctionTick: number,
 *   won: number,  // lifetime wins
 * }
 */

import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage } from '../core/actions.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const AUCTION_MIN = 3  * 60 * TICKS_PER_SECOND; // ~3 min
const AUCTION_MAX = 5  * 60 * TICKS_PER_SECOND; // ~5 min
const DURATION    = 90 * TICKS_PER_SECOND;       // 90 s to bid

const RESOURCE_ICONS = { gold: '💰', food: '🍞', wood: '🪵', stone: '🪨', iron: '⚙️', mana: '✨' };

const BUNDLE_TEMPLATES = [
  { food: 200, wood: 150 },
  { stone: 150, iron: 100 },
  { iron: 120, mana: 60 },
  { wood: 250, stone: 100 },
  { food: 300, mana: 80 },
  { gold: 200, food: 150 },
  { iron: 200, stone: 150, wood: 100 },
  { mana: 120, gold: 150 },
];

function _nextAuctionTick() {
  return state.tick + AUCTION_MIN + Math.floor(Math.random() * (AUCTION_MAX - AUCTION_MIN));
}

function _bundleValue(bundle) {
  // Rough gold value of a bundle — used to set bidGoal
  const prices = { gold: 1, food: 0.5, wood: 0.5, stone: 0.7, iron: 1.2, mana: 2.0 };
  return Object.entries(bundle).reduce((sum, [r, a]) => sum + a * (prices[r] ?? 1), 0);
}

function _spawnAuction() {
  const template = BUNDLE_TEMPLATES[Math.floor(Math.random() * BUNDLE_TEMPLATES.length)];
  // Scale bundle slightly by age
  const scale = 1 + (state.age ?? 0) * 0.3;
  const bundle = {};
  for (const [r, a] of Object.entries(template)) {
    bundle[r] = Math.ceil(a * scale);
  }
  const bidGoal = Math.ceil(_bundleValue(bundle) * 0.6); // bid ~60% of value in gold

  state.auction.current = {
    bundle,
    bidGoal,
    playerBid: 0,
    expiresAt: state.tick + DURATION,
  };
  state.auction.nextAuctionTick = _nextAuctionTick();

  const bundleStr = Object.entries(bundle).map(([r, a]) => `${RESOURCE_ICONS[r]}${a}`).join(' ');
  addMessage(`🔨 Auction: Win ${bundleStr} by bidding ${bidGoal}💰 before time runs out!`, 'market');
  emit(Events.AUCTION_CHANGED, {});
}

// ── Public API ─────────────────────────────────────────────────────────────

export function initAuction() {
  if (!state.auction) {
    state.auction = {
      current: null,
      nextAuctionTick: _nextAuctionTick(),
      won: 0,
    };
  }
}

export function auctionTick() {
  if (!state.auction) return;
  if (!(state.buildings?.market >= 1)) return; // requires market

  const a = state.auction;

  // Check for expiry of current auction
  if (a.current && state.tick >= a.current.expiresAt) {
    if (a.current.playerBid >= a.current.bidGoal) {
      // Player wins
      for (const [r, amt] of Object.entries(a.current.bundle)) {
        state.resources[r] = Math.min(
          state.caps[r] ?? 9999,
          (state.resources[r] ?? 0) + amt,
        );
      }
      a.won = (a.won ?? 0) + 1;
      const bundleStr = Object.entries(a.current.bundle).map(([r, v]) => `${RESOURCE_ICONS[r]}${v}`).join(' ');
      addMessage(`🏆 Auction won! Received: ${bundleStr}`, 'windfall');
      emit(Events.RESOURCE_CHANGED, {});
    } else {
      addMessage(`⏱️ Auction expired — outbid or not enough gold committed.`, 'info');
    }
    a.current = null;
    emit(Events.AUCTION_CHANGED, {});
    return;
  }

  // Spawn new auction when timer fires (and no active auction)
  if (!a.current && state.tick >= a.nextAuctionTick) {
    _spawnAuction();
  }
}

/**
 * Player commits gold toward the current auction.
 * Each call adds `amount` gold from player reserves to playerBid.
 */
export function bidOnAuction(amount) {
  const a = state.auction;
  if (!a?.current) return { ok: false, reason: 'No active auction.' };
  if ((state.resources.gold ?? 0) < amount) return { ok: false, reason: 'Not enough gold.' };
  if (a.current.playerBid >= a.current.bidGoal) return { ok: false, reason: 'Already met bid goal.' };

  state.resources.gold -= amount;
  a.current.playerBid  = Math.min(a.current.bidGoal, a.current.playerBid + amount);
  emit(Events.AUCTION_CHANGED, {});
  emit(Events.RESOURCE_CHANGED, {});
  return { ok: true };
}

/**
 * Player explicitly passes on the current auction (dismisses it early).
 */
export function passAuction() {
  const a = state.auction;
  if (!a?.current) return { ok: false, reason: 'No active auction.' };

  // Refund any partial bid
  if (a.current.playerBid > 0) {
    state.resources.gold = Math.min(
      state.caps.gold ?? 9999,
      (state.resources.gold ?? 0) + a.current.playerBid,
    );
    emit(Events.RESOURCE_CHANGED, {});
  }

  a.current = null;
  emit(Events.AUCTION_CHANGED, {});
  addMessage('Auction passed — gold refunded.', 'info');
  return { ok: true };
}
