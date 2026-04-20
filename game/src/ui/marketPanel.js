/**
 * EmpireOS — Market Panel UI.
 *
 * Displays current resource prices with trend arrows and buy/sell buttons.
 * Requires at least one Market building to unlock trading.
 */

import { on, Events } from '../core/events.js';
import { state } from '../core/state.js';
import { buyPrice, sellPrice, buyResources, sellResources, MARKET_RESOURCES, getSeasonalCommodities } from '../systems/market.js';
import { acceptContract, cancelContract, contractProgress, contractSecsLeft, contractsRefreshSecs } from '../systems/contracts.js';
import { buyMerchantItem, merchantSecsLeft, merchantNextVisitSecs, canAffordItem } from '../systems/merchant.js';
import { bidOnAuction, passAuction } from '../systems/auction.js';
import { fmtNum } from '../utils/fmt.js';

const RESOURCE_ICONS = {
  food:  '🌾',
  wood:  '🪵',
  stone: '🪨',
  iron:  '⚒️',
  mana:  '✨',
};

const TREND_ICONS = { '1': '▲', '-1': '▼', '0': '—' };
const TREND_CLASS = { '1': 'trend--up', '-1': 'trend--down', '0': 'trend--flat' };

let _panel = null;

export function initMarketPanel() {
  _panel = document.getElementById('panel-market');
  if (!_panel) return;

  on(Events.MARKET_CHANGED,    _render);
  on(Events.BUILDING_CHANGED,  _render);
  on(Events.RESOURCE_CHANGED,  _render);
  on(Events.CONTRACTS_CHANGED, _render);
  on(Events.MERCHANT_CHANGED,  _render);
  on(Events.SEASON_CHANGED,    _render);  // T115: reprice seasonal commodities on season change
  on(Events.AUCTION_CHANGED,   _render);  // T126: auction updates

  // Refresh contract/merchant/auction countdowns every ~4 ticks (~1 s)
  let _contractTickCount = 0;
  on(Events.TICK, () => {
    if (++_contractTickCount % 4 !== 0) return;
    if (state.contracts?.active || state.merchant?.offer || state.auction?.current) _render();
  });

  _panel.addEventListener('click', _handleClick);
  _render();
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function _render() {
  if (!_panel) return;

  const hasMarket = (state.buildings?.market ?? 0) >= 1;

  if (!hasMarket) {
    _panel.innerHTML = `
      <div class="market-locked">
        <div class="market-locked__icon">🏪</div>
        <div class="market-locked__title">Trading Market</div>
        <div class="market-locked__desc">Build a <strong>Market</strong> to unlock resource trading.<br>
          Buy and sell food, wood, stone, iron, and mana for gold.</div>
      </div>`;
    return;
  }

  if (!state.market) {
    _panel.innerHTML = '<p class="market-loading">Initialising market…</p>';
    return;
  }

  const seasonal = getSeasonalCommodities();
  const rows = MARKET_RESOURCES.map(res => _row(res, seasonal)).join('');

  const seasonalNote = seasonal.length > 0
    ? `<div class="market-seasonal-note">🌟 Seasonal Premium: <strong>${seasonal.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(' &amp; ')}</strong> — sell for ×2 gold · buy at ×0.5 gold!</div>`
    : '';

  _panel.innerHTML = `
    <div class="market-header">
      <span class="market-title">🏪 Resource Market</span>
      <span class="market-trades">Total trades: ${state.market.totalTrades ?? 0}</span>
    </div>
    <div class="market-note">Prices update every 15 seconds. Buy price includes a 20% premium; sell price has a 20% discount.</div>
    ${seasonalNote}
    <div class="market-table">
      <div class="market-table__head">
        <span>Resource</span>
        <span>Sell price / unit</span>
        <span>Buy price / unit</span>
        <span>Sell</span>
        <span>Buy</span>
      </div>
      ${rows}
    </div>
    ${_merchantSection()}
    ${_contractsSection()}
    ${_auctionSection()}`;
}

function _row(res, seasonal = []) {
  const trend      = state.market.trends[res] ?? 0;
  const icon       = RESOURCE_ICONS[res] ?? res;
  const sp         = sellPrice(res, 1);
  const bp         = buyPrice(res, 1);
  const stock      = Math.floor(state.resources[res] ?? 0);
  const cap        = state.caps[res] ?? 500;
  const tIcon      = TREND_ICONS[String(trend)];
  const tClass     = TREND_CLASS[String(trend)];
  const isSeasonal = seasonal.includes(res);

  return `
    <div class="market-row ${isSeasonal ? 'market-row--seasonal' : ''}" data-res="${res}">
      <span class="market-res-name">${icon} ${res.charAt(0).toUpperCase() + res.slice(1)}
        <span class="market-stock">${fmtNum(stock)}/${fmtNum(cap)}</span>
        ${isSeasonal ? '<span class="market-seasonal-badge">🌟 Seasonal</span>' : ''}
      </span>
      <span class="market-price market-price--sell">${sp}g <span class="${tClass}">${tIcon}</span></span>
      <span class="market-price market-price--buy">${bp}g</span>
      <span class="market-sell-btns">
        <button class="btn btn--xs btn--sell" data-action="sell" data-res="${res}" data-amt="10">-10</button>
        <button class="btn btn--xs btn--sell" data-action="sell" data-res="${res}" data-amt="50">-50</button>
        <button class="btn btn--xs btn--sell" data-action="sell" data-res="${res}" data-amt="100">-100</button>
      </span>
      <span class="market-buy-btns">
        <button class="btn btn--xs btn--buy" data-action="buy" data-res="${res}" data-amt="10">+10</button>
        <button class="btn btn--xs btn--buy" data-action="buy" data-res="${res}" data-amt="50">+50</button>
        <button class="btn btn--xs btn--buy" data-action="buy" data-res="${res}" data-amt="100">+100</button>
      </span>
    </div>`;
}

// ---------------------------------------------------------------------------
// Wandering Merchant section (T087)
// ---------------------------------------------------------------------------

function _merchantSection() {
  const m = state.merchant;
  if (!m) return '';

  if (m.offer) {
    const secsLeft = merchantSecsLeft();
    const cards = m.offer.items.map((item, idx) => {
      const affordable = canAffordItem(idx);
      const costStr = item.type === 'barter'
        ? item.costNote
        : `${item.cost}g`;
      return `
        <div class="merchant-item ${affordable ? '' : 'merchant-item--poor'}">
          <div class="merchant-item__header">
            <span class="merchant-item__icon">${item.icon}</span>
            <span class="merchant-item__title">${item.title}</span>
            <span class="merchant-item__cost">${costStr}</span>
          </div>
          <div class="merchant-item__desc">${item.desc}</div>
          <button class="btn btn--sm btn--merchant-buy ${affordable ? '' : 'btn--disabled'}"
            data-action="merchant-buy" data-idx="${idx}"
            ${affordable ? '' : 'disabled'}
            title="${affordable ? 'Purchase this item' : 'Cannot afford'}">
            ${affordable ? 'Purchase' : 'Cannot Afford'}
          </button>
        </div>`;
    }).join('');

    const purchasesStr = m.totalPurchases > 0 ? ` · ${m.totalPurchases} purchases` : '';
    return `
      <div class="merchant-section merchant-section--active">
        <div class="merchant-header">
          <span class="merchant-title">🧳 Wandering Merchant</span>
          <span class="merchant-timer">Departs in <strong>${secsLeft}s</strong></span>
        </div>
        <div class="merchant-subtitle">One purchase per visit${purchasesStr}</div>
        <div class="merchant-items">${cards}</div>
      </div>`;
  }

  // Merchant not present — show next-visit timer
  const secs = merchantNextVisitSecs();
  const mins  = Math.floor(secs / 60);
  const s     = secs % 60;
  const timeStr = secs >= 60 ? `${mins}m ${String(s).padStart(2, '0')}s` : `${secs}s`;
  return `
    <div class="merchant-section">
      <div class="merchant-header">
        <span class="merchant-title">🧳 Wandering Merchant</span>
      </div>
      <div class="merchant-waiting">
        <span class="merchant-waiting__icon">🛤️</span>
        Next merchant arrives in <strong>${timeStr}</strong>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Contracts section (T085)
// ---------------------------------------------------------------------------

const RES_ICONS = { food: '🌾', wood: '🪵', stone: '🪨', iron: '⚙️', mana: '✨', gold: '💰' };

function _contractsSection() {
  const c = state.contracts;
  if (!c) return '';

  let bodyHtml = '';

  if (c.active) {
    // Active contract — show progress bar + countdown
    const pct     = Math.round(contractProgress() * 100);
    const secsLeft = contractSecsLeft();
    const deliverStr = Object.entries(c.active.deliver)
      .map(([r, a]) => `${RES_ICONS[r] ?? r}${a}`)
      .join(' + ');
    const rewardStr = Object.entries(c.active.reward)
      .map(([r, a]) => `${RES_ICONS[r] ?? r}${a}`)
      .join(' + ');

    bodyHtml = `
      <div class="contract-active">
        <div class="contract-active__header">
          <span class="contract-active__icon">${c.active.icon}</span>
          <span class="contract-active__title">${c.active.title}</span>
          <span class="contract-active__timer">${secsLeft}s remaining</span>
        </div>
        <div class="contract-active__sub">
          Delivering ${deliverStr} → Reward: ${rewardStr}
        </div>
        <div class="contract-bar-outer">
          <div class="contract-bar-fill" style="width:${pct}%"></div>
        </div>
        <button class="btn btn--xs btn--contract-cancel" data-action="cancel-contract">
          Cancel (forfeits resources)
        </button>
      </div>`;
  } else if (c.available.length > 0) {
    // Offer cards
    const cards = c.available.map((offer, idx) => {
      const deliverStr = Object.entries(offer.deliver)
        .map(([r, a]) => `${RES_ICONS[r] ?? r} ${a} ${r}`)
        .join(' + ');
      const rewardStr = Object.entries(offer.reward)
        .map(([r, a]) => `${RES_ICONS[r] ?? r} ${a} ${r}`)
        .join(' + ');

      // Check affordability
      const affordable = Object.entries(offer.deliver)
        .every(([r, a]) => (state.resources[r] ?? 0) >= a);

      return `
        <div class="contract-offer">
          <div class="contract-offer__header">
            <span class="contract-offer__icon">${offer.icon}</span>
            <span class="contract-offer__title">${offer.title}</span>
          </div>
          <div class="contract-offer__deliver">Deliver: <strong>${deliverStr}</strong></div>
          <div class="contract-offer__reward">Reward: <strong>${rewardStr}</strong> + 20 ✨ prestige</div>
          <div class="contract-offer__note">60-second processing · resources deducted immediately</div>
          <button class="btn btn--sm btn--contract-accept ${affordable ? '' : 'btn--disabled'}"
            data-action="accept-contract" data-idx="${idx}"
            ${affordable ? '' : 'disabled'}
            title="${affordable ? 'Accept this contract' : 'Not enough resources'}">
            ${affordable ? 'Accept Contract' : 'Insufficient Resources'}
          </button>
        </div>`;
    }).join('');

    bodyHtml = `<div class="contract-offers">${cards}</div>`;
  } else {
    // Waiting for refresh
    const secs = contractsRefreshSecs();
    const mins  = Math.floor(secs / 60);
    const s     = secs % 60;
    const timeStr = secs > 60 ? `${mins}m ${String(s).padStart(2, '0')}s` : `${secs}s`;
    bodyHtml = `<div class="contract-waiting">
      <span class="contract-waiting__icon">⏳</span>
      New contracts available in <strong>${timeStr}</strong>
    </div>`;
  }

  const completedStr = c.totalCompleted > 0 ? ` · ${c.totalCompleted} completed` : '';

  return `
    <div class="contracts-section">
      <div class="contracts-header">
        <span class="contracts-title">📋 Delivery Contracts</span>
        <span class="contracts-meta">One active at a time${completedStr}</span>
      </div>
      ${bodyHtml}
    </div>`;
}

// ---------------------------------------------------------------------------
// T126: Auction section
// ---------------------------------------------------------------------------

const _AUCTION_RES_ICONS = { gold: '💰', food: '🍞', wood: '🪵', stone: '🪨', iron: '⚙️', mana: '✨' };

function _auctionSection() {
  const a = state.auction;
  if (!a) return '';

  if (!a.current) {
    const secsUntil = Math.max(0, Math.ceil((a.nextAuctionTick - state.tick) / 4));
    return `
      <div class="auction-section">
        <div class="auction-header">🔨 Auction House</div>
        <div class="auction-idle">Next auction in ~${secsUntil}s · Total won: ${a.won ?? 0}</div>
      </div>`;
  }

  const c          = a.current;
  const bundleStr  = Object.entries(c.bundle).map(([r, v]) => `${_AUCTION_RES_ICONS[r]}${v}`).join(' ');
  const secsLeft   = Math.max(0, Math.ceil((c.expiresAt - state.tick) / 4));
  const bidPct     = Math.floor((c.playerBid / c.bidGoal) * 100);
  const canBid10   = (state.resources.gold ?? 0) >= 10;
  const canBid50   = (state.resources.gold ?? 0) >= 50;
  const isMet      = c.playerBid >= c.bidGoal;

  return `
    <div class="auction-section auction-section--active">
      <div class="auction-header">🔨 Live Auction <span class="auction-timer">${secsLeft}s left</span></div>
      <div class="auction-bundle">${bundleStr}</div>
      <div class="auction-bid-info">
        Bid goal: 💰${c.bidGoal} · Your bid: 💰${c.playerBid} (${bidPct}%)
      </div>
      <div class="auction-progress-bar">
        <div class="auction-progress-fill" style="width:${bidPct}%"></div>
      </div>
      ${isMet
        ? `<div class="auction-won-msg">✅ Bid met! Collecting when time expires…</div>`
        : `<div class="auction-actions">
             <button class="btn btn--auction ${canBid10 ? '' : 'btn--disabled'}" data-action="auction-bid" data-amt="10" ${canBid10 ? '' : 'disabled'}>Bid 💰10</button>
             <button class="btn btn--auction ${canBid50 ? '' : 'btn--disabled'}" data-action="auction-bid" data-amt="50" ${canBid50 ? '' : 'disabled'}>Bid 💰50</button>
             <button class="btn btn--auction-pass" data-action="auction-pass">Pass</button>
           </div>`}
    </div>`;
}

// ---------------------------------------------------------------------------
// Click handling
// ---------------------------------------------------------------------------

function _handleClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;
  const res    = btn.dataset.res;
  const amt    = parseInt(btn.dataset.amt, 10);

  let result;
  if (action === 'sell') {
    result = sellResources(res, amt);
  } else if (action === 'buy') {
    result = buyResources(res, amt);
  } else if (action === 'accept-contract') {
    const idx = parseInt(btn.dataset.idx, 10);
    result = acceptContract(idx);
  } else if (action === 'cancel-contract') {
    result = cancelContract();
  } else if (action === 'merchant-buy') {
    const idx = parseInt(btn.dataset.idx, 10);
    result = buyMerchantItem(idx);
  } else if (action === 'auction-bid') {
    result = bidOnAuction(parseInt(btn.dataset.amt, 10));
  } else if (action === 'auction-pass') {
    result = passAuction();
  }

  if (result && !result.ok) {
    // Brief shake feedback on the button
    btn.classList.add('btn--shake');
    btn.addEventListener('animationend', () => btn.classList.remove('btn--shake'), { once: true });
  }
}
