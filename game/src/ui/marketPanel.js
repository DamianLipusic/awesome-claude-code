/**
 * EmpireOS — Market Panel UI.
 *
 * Displays current resource prices with trend arrows and buy/sell buttons.
 * Requires at least one Market building to unlock trading.
 */

import { on, Events } from '../core/events.js';
import { state } from '../core/state.js';
import { buyPrice, sellPrice, buyResources, sellResources, MARKET_RESOURCES } from '../systems/market.js';
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

  on(Events.MARKET_CHANGED,   _render);
  on(Events.BUILDING_CHANGED, _render);
  on(Events.RESOURCE_CHANGED, _render);

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

  const rows = MARKET_RESOURCES.map(res => _row(res)).join('');

  _panel.innerHTML = `
    <div class="market-header">
      <span class="market-title">🏪 Resource Market</span>
      <span class="market-trades">Total trades: ${state.market.totalTrades ?? 0}</span>
    </div>
    <div class="market-note">Prices update every 15 seconds. Buy price includes a 20% premium; sell price has a 20% discount.</div>
    <div class="market-table">
      <div class="market-table__head">
        <span>Resource</span>
        <span>Sell price / unit</span>
        <span>Buy price / unit</span>
        <span>Sell</span>
        <span>Buy</span>
      </div>
      ${rows}
    </div>`;
}

function _row(res) {
  const trend  = state.market.trends[res] ?? 0;
  const icon   = RESOURCE_ICONS[res] ?? res;
  const sp     = sellPrice(res, 1);
  const bp     = buyPrice(res, 1);
  const stock  = Math.floor(state.resources[res] ?? 0);
  const cap    = state.caps[res] ?? 500;
  const tIcon  = TREND_ICONS[String(trend)];
  const tClass = TREND_CLASS[String(trend)];

  return `
    <div class="market-row" data-res="${res}">
      <span class="market-res-name">${icon} ${res.charAt(0).toUpperCase() + res.slice(1)}
        <span class="market-stock">${fmtNum(stock)}/${fmtNum(cap)}</span>
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
  }

  if (result && !result.ok) {
    // Brief shake feedback on the button
    btn.classList.add('btn--shake');
    btn.addEventListener('animationend', () => btn.classList.remove('btn--shake'), { once: true });
  }
}
