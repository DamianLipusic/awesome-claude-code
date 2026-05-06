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
import { executeDeal, getBlackMarketRefreshSecs } from '../systems/blackMarket.js';
import { isGuildActive, GUILD_ROUTE_BONUS, BOOST_COST, BOOST_MULT, getBoostSecs, boostTradeRoute } from '../systems/tradeGuildHall.js'; // T190
import { EMPIRES } from '../data/empires.js'; // T190
import { isMintActive, getMintInfo, performMintConversion, MINT_RATES, MINT_CONVERSION_MAX } from '../systems/imperialMint.js'; // T191
import { isFairActive, getFairDeals, isDealUsed, useFairDeal, FAIR_PARTICIPATION_GOAL } from '../systems/tradeFair.js'; // T196
import { getActiveTradeWind, getTradeWindHistory } from '../systems/tradeWinds.js'; // T198
import { buySilkRoadGood, isSilkRoadOpen, getSilkRoadSecsLeft, getSilkRoadGoods, getSilkRoadBuysLeft, getSilkRoadNextSecs } from '../systems/silkRoad.js'; // T218
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

  on(Events.MARKET_CHANGED,       _render);
  on(Events.BUILDING_CHANGED,     _render);
  on(Events.RESOURCE_CHANGED,     _render);
  on(Events.CONTRACTS_CHANGED,    _render);
  on(Events.MERCHANT_CHANGED,     _render);
  on(Events.SEASON_CHANGED,       _render);  // T115: reprice seasonal commodities on season change
  on(Events.AUCTION_CHANGED,      _render);  // T126: auction updates
  on(Events.BLACK_MARKET_CHANGED, _render);  // T167: black market deals refreshed
  on(Events.TRADE_GUILD_BOOSTED,  _render);  // T190: guild boost activated/expired
  on(Events.MINT_CONVERSION,      _render);  // T191: mint conversion performed (also resets on existing SEASON_CHANGED)
  on(Events.TRADE_FAIR_CHANGED,   _render);  // T196: fair started / deal used / ended
  on(Events.TRADE_WIND_CHANGED,   _render);  // T198: trade wind started or ended
  on(Events.SILK_ROAD_CHANGED,    _render);  // T218: silk road window opened / purchased / closed

  // Refresh contract/merchant/auction/silk-road countdowns every ~4 ticks (~1 s)
  let _contractTickCount = 0;
  on(Events.TICK, () => {
    if (++_contractTickCount % 4 !== 0) return;
    if (state.contracts?.active || state.merchant?.offer || state.auction?.current || state.silkRoad?.current) _render();
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
    ${_tradeFairSection()}
    ${_merchantSection()}
    ${_contractsSection()}
    ${_auctionSection()}
    ${_blackMarketSection()}
    ${_tradeGuildSection()}
    ${_mintSection()}
    ${_tradeWindSection()}
    ${_silkRoadSection()}`;
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
  } else if (action === 'bm-deal') {
    result = executeDeal(parseInt(btn.dataset.idx, 10));
  } else if (action === 'guild-boost') {
    // T190: boost a specific trade route
    result = boostTradeRoute(btn.dataset.empireId);
  } else if (action === 'mint-convert') {
    // T191: convert resource to gold at imperial mint
    result = performMintConversion(btn.dataset.res, parseInt(btn.dataset.amt, 10));
  } else if (action === 'fair-deal') {
    // T196: claim a trade fair deal
    result = useFairDeal(btn.dataset.dealId);
  } else if (action === 'silk-road-buy') {
    // T218: purchase a Silk Road exotic good
    result = buySilkRoadGood(btn.dataset.silkGood);
  }

  if (result && !result.ok) {
    // Brief shake feedback on the button
    btn.classList.add('btn--shake');
    btn.addEventListener('animationend', () => btn.classList.remove('btn--shake'), { once: true });
  }
}

// ---------------------------------------------------------------------------
// T196: Trade Fair section
// ---------------------------------------------------------------------------

const RES_ICONS_FAIR = { gold: '💰', food: '🌾', wood: '🪵', stone: '🪨', iron: '⚙️', mana: '✨' };

function _tradeFairSection() {
  if (!isFairActive()) return '';

  const tf      = state.tradeFair;
  const deals   = getFairDeals();
  const trades  = tf?.tradesDuringFair ?? 0;
  const claimed = tf?.bonusClaimed ?? false;
  const pct     = Math.min(100, Math.round((trades / FAIR_PARTICIPATION_GOAL) * 100));

  const dealsHtml = deals.map(def => {
    const used       = isDealUsed(def.id);
    const costStr    = Object.entries(def.cost).map(([r, a]) => `${a}g`).join('');
    const rewardStr  = Object.entries(def.reward).map(([r, a]) => `${RES_ICONS_FAIR[r] ?? r} +${a} ${r}`).join(', ');
    const canAfford  = !used && Object.entries(def.cost).every(([r, a]) => (state.resources[r] ?? 0) >= a);

    return `
      <div class="fair-deal-row${used ? ' fair-deal-row--used' : ''}">
        <div class="fair-deal-icon">${def.icon}</div>
        <div class="fair-deal-info">
          <div class="fair-deal-title">${def.title}</div>
          <div class="fair-deal-desc">${def.desc}</div>
          <div class="fair-deal-terms">${costStr} → ${rewardStr}</div>
        </div>
        <button class="btn btn--fair-deal${used || !canAfford ? ' btn--disabled' : ''}"
          data-action="fair-deal" data-deal-id="${def.id}"
          ${used || !canAfford ? 'disabled' : ''}>${used ? '✓ Claimed' : `Buy (${costStr})`}</button>
      </div>`;
  }).join('');

  const progressHtml = claimed
    ? `<div class="fair-bonus-claimed">🎁 Participation bonus claimed — well done!</div>`
    : `<div class="fair-participation">
        <div class="fair-participation__label">Participation: ${trades}/${FAIR_PARTICIPATION_GOAL} trades → +80g +15 prestige</div>
        <div class="fair-participation__bar-bg"><div class="fair-participation__bar-fill" style="width:${pct}%"></div></div>
       </div>`;

  return `
    <div class="fair-section">
      <div class="fair-header">
        <span class="fair-title">🎪 Annual Trade Fair</span>
        <span class="fair-badge">ACTIVE</span>
      </div>
      <div class="fair-benefits">Buy prices −20% · Sell prices +20%</div>
      <div class="fair-deals">${dealsHtml}</div>
      ${progressHtml}
    </div>`;
}

// ---------------------------------------------------------------------------
// T167: Black Market section
// ---------------------------------------------------------------------------

const RES_ICONS_BM = { gold: '💰', food: '🌾', wood: '🪵', stone: '🪨', iron: '⚙️', mana: '✨' };

function _blackMarketSection() {
  const bm = state.blackMarket;
  if (!bm) return '';

  const age = state.age ?? 0;
  if (age < 2) {
    return `
      <div class="bm-section bm-section--locked">
        <div class="bm-header">🕵️ Black Market</div>
        <div class="bm-locked-msg">Unlocks at <strong>Iron Age</strong> — underground traders will approach you then.</div>
      </div>`;
  }

  const deals       = bm.deals ?? [];
  const refreshSecs = getBlackMarketRefreshSecs();
  const mins        = Math.floor(refreshSecs / 60);
  const secs        = refreshSecs % 60;
  const timeStr     = refreshSecs >= 60 ? `${mins}m ${String(secs).padStart(2, '0')}s` : `${refreshSecs}s`;

  const dealCards = deals.map((deal, idx) => {
    const fromIcon = RES_ICONS_BM[deal.fromRes] ?? deal.fromRes;
    const toIcon   = RES_ICONS_BM[deal.toRes]   ?? deal.toRes;
    const canAfford = (state.resources[deal.fromRes] ?? 0) >= deal.fromAmt;
    const typeLabel = deal.type === 'buy' ? 'Buy' : deal.type === 'sell' ? 'Sell' : 'Swap';
    const typeCls   = `bm-deal--${deal.type}`;

    return `
      <div class="bm-deal ${typeCls}">
        <div class="bm-deal__header">
          <span class="bm-deal__type">${typeLabel}</span>
          <span class="bm-deal__risk">⚠️ 10% seizure risk</span>
        </div>
        <div class="bm-deal__trade">
          <span class="bm-deal__from">${fromIcon} ${deal.fromAmt} ${deal.fromRes}</span>
          <span class="bm-deal__arrow">→</span>
          <span class="bm-deal__to">${toIcon} ${deal.toAmt} ${deal.toRes}</span>
        </div>
        <button class="btn btn--sm btn--bm-deal ${canAfford ? '' : 'btn--disabled'}"
          data-action="bm-deal" data-idx="${idx}"
          ${canAfford ? '' : 'disabled'}
          title="${canAfford ? 'Execute this trade (10% seizure risk)' : 'Not enough ' + deal.fromRes}">
          ${canAfford ? 'Trade' : 'Cannot Afford'}
        </button>
      </div>`;
  }).join('');

  const statsStr = bm.totalTrades > 0
    ? `${bm.totalTrades} trades · ${bm.seizedCount} seized`
    : 'No trades yet';

  return `
    <div class="bm-section">
      <div class="bm-header">
        <span class="bm-title">🕵️ Black Market</span>
        <span class="bm-meta">${statsStr}</span>
      </div>
      <div class="bm-note">Underground deals — better rates, but risk of seizure. Refreshes in <strong>${timeStr}</strong>.</div>
      ${deals.length > 0
        ? `<div class="bm-deals">${dealCards}</div>`
        : `<div class="bm-empty">⏳ All deals taken. New deals in ${timeStr}.</div>`}
    </div>`;
}

// ---------------------------------------------------------------------------
// T190: Trade Guild Hall section
// ---------------------------------------------------------------------------

function _tradeGuildSection() {
  if (!isGuildActive()) return '';

  const alliedWithRoutes = (state.diplomacy?.empires ?? []).filter(
    e => e.relations === 'allied' && (e.tradeRoutes ?? 0) > 0
  );

  if (alliedWithRoutes.length === 0) {
    return `
      <div class="guild-section">
        <div class="guild-header">
          <span class="guild-title">🏦 Trade Guild Hall</span>
          <span class="guild-note">+${GUILD_ROUTE_BONUS}/s gold per open trade route</span>
        </div>
        <div class="guild-empty">Open trade routes with allied empires to activate guild bonuses.</div>
      </div>`;
  }

  const routeCards = alliedWithRoutes.map(emp => {
    const empDef   = EMPIRES[emp.id];
    const boostSec = getBoostSecs(emp.id);
    const boosted  = boostSec > 0;
    const canAfford = (state.resources.gold ?? 0) >= BOOST_COST;
    const routeIncome = (GUILD_ROUTE_BONUS * emp.tradeRoutes).toFixed(1);
    const boostNote   = boosted
      ? `<span class="guild-boost-active">⚡ Boosted ×${BOOST_MULT} · ${boostSec}s left</span>`
      : '';
    return `
      <div class="guild-route-card">
        <div class="guild-route-info">
          <span class="guild-route-empire">${empDef?.name ?? emp.id}</span>
          <span class="guild-route-count">${emp.tradeRoutes} route${emp.tradeRoutes !== 1 ? 's' : ''}</span>
          <span class="guild-route-income">+${routeIncome} 💰/s</span>
          ${boostNote}
        </div>
        <button class="btn btn--guild-boost ${boosted || !canAfford ? 'btn--disabled' : ''}"
          data-action="guild-boost" data-empire-id="${emp.id}"
          ${boosted || !canAfford ? 'disabled' : ''}
          title="${boosted ? `Boosted — ${boostSec}s remaining` : !canAfford ? `Need ${BOOST_COST} gold` : `×${BOOST_MULT} income for 5 min (${BOOST_COST} gold)`}">
          ${boosted ? `⚡ ${boostSec}s` : `⚡ Boost (${BOOST_COST}💰)`}
        </button>
      </div>`;
  }).join('');

  const totalBonus = alliedWithRoutes.reduce((s, e) => s + GUILD_ROUTE_BONUS * e.tradeRoutes, 0);

  return `
    <div class="guild-section">
      <div class="guild-header">
        <span class="guild-title">🏦 Trade Guild Hall</span>
        <span class="guild-bonus">+${totalBonus.toFixed(1)} 💰/s from routes</span>
      </div>
      <div class="guild-note">Boost a route for ×${BOOST_MULT} income for 5 min (${BOOST_COST} gold each).</div>
      <div class="guild-routes">${routeCards}</div>
    </div>`;
}

// ---------------------------------------------------------------------------
// T191: Imperial Mint section
// ---------------------------------------------------------------------------

function _mintSection() {
  if (!isMintActive()) return '';

  const info = getMintInfo();
  const gold  = state.resources?.gold  ?? 0;
  const goldCap = state.caps?.gold ?? 500;

  const RES_ICONS = { wood: '🪵', stone: '🪨', iron: '⚒️' };
  const RES_NAMES = { wood: 'Wood', stone: 'Stone', iron: 'Iron' };

  if (info.usedThisSeason) {
    return `
      <div class="mint-section">
        <div class="mint-header">
          <span class="mint-title">🏛️ Imperial Mint</span>
          <span class="mint-status mint-status--used">✅ Converted this season</span>
        </div>
        <div class="mint-note">Available again next season. Total coined: ${fmtNum(info.totalConverted)} gold.</div>
      </div>`;
  }

  const convBtns = Object.entries(MINT_RATES).map(([res, rate]) => {
    const stock    = Math.floor(state.resources?.[res] ?? 0);
    const maxGold  = Math.min(Math.floor(stock * rate), MINT_CONVERSION_MAX);
    const resNeeded = Math.ceil(MINT_CONVERSION_MAX / rate);
    const canConvert = stock > 0 && gold < goldCap;
    const disabled  = !canConvert;
    const tooltip = stock <= 0
      ? `No ${RES_NAMES[res]} available`
      : `Convert up to ${resNeeded} ${RES_NAMES[res]} → up to ${MINT_CONVERSION_MAX} gold (${rate}g/unit)`;
    return `
      <div class="mint-conv-row">
        <span class="mint-conv-res">${RES_ICONS[res]} ${RES_NAMES[res]}</span>
        <span class="mint-conv-rate">${rate}g/unit</span>
        <span class="mint-conv-stock">Have: ${fmtNum(stock)}</span>
        <span class="mint-conv-gain">→ up to ${fmtNum(maxGold)} 💰</span>
        <button class="btn btn--mint-conv ${disabled ? 'btn--disabled' : ''}"
          data-action="mint-convert" data-res="${res}" data-amt="${Math.max(1, stock)}"
          ${disabled ? 'disabled' : ''}
          title="${tooltip}">
          Coin
        </button>
      </div>`;
  }).join('');

  return `
    <div class="mint-section">
      <div class="mint-header">
        <span class="mint-title">🏛️ Imperial Mint</span>
        <span class="mint-status">Ready — 1 conversion per season</span>
      </div>
      <div class="mint-note">Convert surplus resources to gold (max ${MINT_CONVERSION_MAX}g per conversion).</div>
      <div class="mint-conversions">${convBtns}</div>
      ${info.totalConverted > 0 ? `<div class="mint-total">Total coined: ${fmtNum(info.totalConverted)} gold</div>` : ''}
    </div>`;
}

// ── Trade Wind section (T198) ────────────────────────────────────────────────

function _tradeWindSection() {
  const wind    = getActiveTradeWind();
  const history = getTradeWindHistory();

  const effectStr = (def) => {
    const parts = [];
    if (def.goldBonus > 0)  parts.push(`+${def.goldBonus} 💰/s`);
    if (def.goldBonus < 0)  parts.push(`${def.goldBonus} 💰/s`);
    if (def.ironBonus > 0)  parts.push(`+${def.ironBonus} ⚒️/s`);
    if (def.ironBonus < 0)  parts.push(`${def.ironBonus} ⚒️/s`);
    if (def.foodBonus > 0)  parts.push(`+${def.foodBonus} 🌾/s`);
    if (def.foodBonus < 0)  parts.push(`${def.foodBonus} 🌾/s`);
    return parts.join(' · ') || 'No rate change';
  };

  const activeHtml = wind
    ? `<div class="trade-wind-card trade-wind-card--active">
        <div class="trade-wind-card__icon">${wind.icon}</div>
        <div class="trade-wind-card__body">
          <div class="trade-wind-card__name">${wind.name}</div>
          <div class="trade-wind-card__desc">${wind.desc}</div>
          <div class="trade-wind-card__effect">${effectStr(wind)}</div>
          <div class="trade-wind-card__until">Lasts until next season change.</div>
        </div>
      </div>`
    : `<div class="trade-wind-calm">🌊 Calm Seas — no active trade wind.</div>`;

  const historyHtml = history.length > 0
    ? `<div class="trade-wind-history">
        <div class="trade-wind-history__label">Recent winds:</div>
        ${history.map(h => `
          <span class="trade-wind-history__entry" title="${h.name} — ${h.seasonName}">
            ${h.icon} ${h.name}
          </span>`).join('')}
      </div>`
    : '';

  return `
    <div class="trade-wind-section">
      <div class="trade-wind-header">🌬️ Trade Winds</div>
      <div class="trade-wind-note">Global trade environment shifts every 5–8 seasons, affecting resource rates for one season.</div>
      ${activeHtml}
      ${historyHtml}
    </div>`;
}

// ---------------------------------------------------------------------------
// Silk Road section (T218)
// ---------------------------------------------------------------------------

function _silkRoadSection() {
  const age = state.age ?? 0;
  if (age < 2) return '';  // Iron Age+ only

  const sr   = state.silkRoad;
  if (!sr) return '';

  if (!sr.current) {
    const nextSecs = getSilkRoadNextSecs();
    const nextStr  = nextSecs > 0
      ? `Next caravan in ~${Math.ceil(nextSecs / 60)}m`
      : 'A caravan is expected soon…';
    const permStr  = sr.permanentGoldRate > 0
      ? ` · ${sr.permanentGoldRate.toFixed(2)} gold/s from trade goods`
      : '';
    return `
      <div class="silk-road-section">
        <div class="silk-road-header">🐪 Silk Road</div>
        <div class="silk-road-idle">${nextStr}${permStr}. Total purchases: ${sr.totalPurchases ?? 0}</div>
      </div>`;
  }

  const secsLeft = getSilkRoadSecsLeft();
  const buysLeft = getSilkRoadBuysLeft();
  const goods    = getSilkRoadGoods();
  const gold     = Math.floor(state.resources.gold ?? 0);

  const goodsHtml = goods.map(g => {
    const canAfford = gold >= g.cost && !g.purchased && buysLeft > 0;
    return `
      <div class="silk-road-good ${g.purchased ? 'silk-road-good--purchased' : ''}">
        <div class="silk-road-good-name">${g.icon} ${g.name}</div>
        <div class="silk-road-good-desc">${g.desc}</div>
        <button class="btn btn--xs btn--buy
          ${(g.purchased || !canAfford) ? 'btn--disabled' : ''}"
          data-action="silk-road-buy" data-silk-good="${g.id}"
          ${(g.purchased || !canAfford) ? 'disabled' : ''}>
          ${g.purchased ? '✓ Purchased' : `💰${g.cost}g`}
        </button>
      </div>`;
  }).join('');

  return `
    <div class="silk-road-section">
      <div class="silk-road-header">
        🐪 Silk Road Caravan
        <span class="silk-road-timer">${secsLeft}s · ${buysLeft} buy${buysLeft === 1 ? '' : 's'} left</span>
      </div>
      <div class="silk-road-subtitle">Exotic goods from distant lands. Buy up to 2 items.</div>
      <div class="silk-road-goods">${goodsHtml}</div>
    </div>`;
}
