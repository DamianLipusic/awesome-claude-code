/**
 * EmpireOS — Quest Panel (T265).
 *
 * Renders the Quests tab:
 *  1. Quest progress cards (QUESTS from quests.js)
 *  2. Active encounter sections for T249–T264 periodic systems.
 *
 * Only active encounters are rendered; idle systems are hidden to keep the
 * panel clean. Timer countdowns update every second via TICK.
 */

import { state }                         from '../core/state.js';
import { on, Events }                    from '../core/events.js';
import { QUESTS, setQuestPanelRenderer } from '../systems/quests.js';
import { TICKS_PER_SECOND }              from '../core/tick.js';

import * as Circus     from '../systems/travelingCircus.js';     // T249
import * as Spring     from '../systems/sacredSpring.js';        // T250
import * as Bard       from '../systems/wanderingBard.js';       // T251
import * as Artisan    from '../systems/masterArtisan.js';       // T252
import * as Hermit     from '../systems/mountainHermit.js';      // T253
import * as Jubilee    from '../systems/imperialJubilee.js';     // T254
import * as Prince     from '../systems/exiledPrince.js';        // T255
import * as Guardian   from '../systems/ancientGuardian.js';     // T256
import * as Oasis      from '../systems/desertOasis.js';         // T257
import * as Dignitary  from '../systems/foreignDignitary.js';    // T258
import * as Caravan    from '../systems/lostCaravan.js';         // T259
import * as Scholar    from '../systems/nomadicScholar.js';      // T260
import * as Feast      from '../systems/royalFeast.js';          // T261
import * as Blacksmith from '../systems/wanderingBlacksmith.js'; // T262
import * as Astrologer from '../systems/travelingAstrologer.js'; // T263
import * as Merchant   from '../systems/merchantPrince.js';      // T264
import * as Sage      from '../systems/wanderingSage.js';       // T266

let _panel = null;

// ---------------------------------------------------------------------------
// Quest section
// ---------------------------------------------------------------------------

function _questsSection() {
  if (!state.quests) return '';
  const completed = state.quests.completed ?? {};
  const done  = QUESTS.filter(q => completed[q.id]).length;
  const total = QUESTS.length;

  const cards = QUESTS.map(q => {
    const isDone     = !!completed[q.id];
    const rewardStr  = Object.entries(q.reward).map(([r, a]) => `+${a} ${r}`).join(', ');
    return `
      <div class="quest-card ${isDone ? 'quest-card--done' : 'quest-card--pending'}">
        <div class="quest-card__header">
          <span class="quest-card__icon">${q.icon}</span>
          <span class="quest-card__title">${q.title}</span>
          ${isDone ? '<span class="quest-card__check">✓</span>' : ''}
        </div>
        <div class="quest-card__desc">${q.desc}</div>
        <div class="quest-card__reward">Reward: <span class="quest-reward-text">${rewardStr}</span></div>
      </div>`;
  }).join('');

  return `
    <div class="quest-header">
      <span class="quest-header__title">🏆 Quests</span>
      <span class="quest-header__count">${done} / ${total} completed</span>
    </div>
    <div class="quest-list">${cards}</div>`;
}

// ---------------------------------------------------------------------------
// Encounter sections (T249–T264) — only rendered when active
// ---------------------------------------------------------------------------

function _encountersSection() {
  const parts = [
    _circusSection(),
    _springSection(),
    _bardSection(),
    _artisanSection(),
    _hermitSection(),
    _jubileeSection(),
    _princeSection(),
    _guardianSection(),
    _oasisSection(),
    _dignitarySection(),
    _caravanSection(),
    _scholarSection(),
    _feastSection(),
    _blacksmithSection(),
    _astrologerSection(),
    _merchantPrinceSection(),
    _wanderingSageSection(),
  ].filter(Boolean);

  if (parts.length === 0) return '';
  return `<div class="encounters-header">⚡ Active Encounters</div>${parts.join('')}`;
}

// ── T249 Traveling Circus ────────────────────────────────────────────────────

function _circusSection() {
  if (!Circus.getActiveCircus()) return '';
  const secs      = Circus.getCircusSecsLeft();
  const gold      = Math.floor(state.resources.gold ?? 0);
  const canShow   = gold >= Circus.SHOW_GOLD_COST;
  const canRecruit = gold >= Circus.RECRUIT_GOLD_COST;
  const urg = secs <= 15 ? ' circus-timer--urgent' : '';
  return `
    <div class="circus-section--active">
      <div class="circus-header">
        <span class="circus-icon">🎪</span>
        <span class="circus-title">Traveling Circus</span>
        <span class="circus-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="circus-desc">A traveling circus arrives at the empire gates! Acrobats, exotic animals, and performers await your decision.</div>
      <div class="circus-actions">
        <button class="btn--circus-show${canShow ? '' : ' btn--disabled'}" data-action="circus-show" ${canShow ? '' : 'disabled'}>
          🎪 Welcome Show — ${Circus.SHOW_GOLD_COST}💰
          <span class="circus-cost">→ +${Circus.SHOW_MORALE_REWARD} morale · +${Circus.SHOW_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--circus-recruit${canRecruit ? '' : ' btn--disabled'}" data-action="circus-recruit" ${canRecruit ? '' : 'disabled'}>
          🤹 Recruit Performers — ${Circus.RECRUIT_GOLD_COST}💰
          <span class="circus-cost">→ +${Circus.RECRUIT_MORALE_REWARD} morale · +${Circus.RECRUIT_FOOD_RATE} food/s (2 min)</span>
        </button>
        <button class="btn--circus-dismiss" data-action="circus-dismiss">👋 Dismiss Circus</button>
      </div>
    </div>`;
}

// ── T250 Sacred Spring ───────────────────────────────────────────────────────

function _springSection() {
  if (!Spring.getActiveSacredSpring()) return '';
  const secs     = Spring.getSacredSpringSecsLeft();
  const mana     = Math.floor(state.resources.mana ?? 0);
  const canBless = mana >= Spring.BLESS_MANA_COST;
  const urg = secs <= 15 ? ' spring-timer--urgent' : '';
  return `
    <div class="spring-section--active">
      <div class="spring-header">
        <span class="spring-title">💧 Sacred Spring Discovery</span>
        <span class="spring-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="spring-desc">Scouts discovered a sacred spring in imperial territory. Its waters shimmer with mystical energy.</div>
      <div class="spring-actions">
        <button class="btn--spring-bless${canBless ? '' : ' btn--disabled'}" data-action="spring-bless" ${canBless ? '' : 'disabled'}>
          🌊 Bless the Waters — ${Spring.BLESS_MANA_COST}✨
          <span class="spring-cost">→ +${Spring.BLESS_FOOD_REWARD} food · +${Spring.BLESS_MORALE_REWARD} morale · +${Spring.BLESS_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--spring-sell" data-action="spring-sell">
          💰 Sell Water Rights — −${Spring.SELL_PRESTIGE_COST} prestige
          <span class="spring-cost">→ +${Spring.SELL_GOLD_REWARD} gold (people displeased)</span>
        </button>
        <button class="btn--spring-protect" data-action="spring-protect">
          🌿 Protect the Spring — free
          <span class="spring-cost">→ +${Spring.PROTECT_MORALE_REWARD} morale · +${Spring.PROTECT_PRESTIGE_REWARD} prestige</span>
        </button>
      </div>
    </div>`;
}

// ── T251 Wandering Bard ──────────────────────────────────────────────────────

function _bardSection() {
  if (!Bard.getActiveWanderingBard()) return '';
  const secs          = Bard.getWanderingBardSecsLeft();
  const gold          = Math.floor(state.resources.gold ?? 0);
  const canCommission = gold >= Bard.COMMISSION_GOLD_COST;
  const urg = secs <= 15 ? ' bard-timer--urgent' : '';
  return `
    <div class="bard-section--active">
      <div class="bard-header">
        <span class="bard-title">🎵 Wandering Bard</span>
        <span class="bard-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="bard-desc">A wandering bard arrives bearing songs of distant lands and epic tales of heroes.</div>
      <div class="bard-actions">
        <button class="btn--bard-commission${canCommission ? '' : ' btn--disabled'}" data-action="bard-commission" ${canCommission ? '' : 'disabled'}>
          🎵 Commission Performance — ${Bard.COMMISSION_GOLD_COST}💰
          <span class="bard-cost">→ +${Bard.COMMISSION_MORALE_REWARD} morale · +${Bard.COMMISSION_PRESTIGE_REWARD} prestige · +${Bard.COMMISSION_FOOD_RATE} food/s (2 min)</span>
        </button>
        <button class="btn--bard-listen" data-action="bard-listen">
          📖 Listen to Stories — free
          <span class="bard-cost">→ +${Bard.LISTEN_MORALE_REWARD} morale · +${Bard.LISTEN_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--bard-away" data-action="bard-away">🚪 Send Away</button>
      </div>
    </div>`;
}

// ── T252 Master Artisan ──────────────────────────────────────────────────────

function _artisanSection() {
  if (!Artisan.getActiveMasterArtisan()) return '';
  const secs          = Artisan.getMasterArtisanSecsLeft();
  const gold          = Math.floor(state.resources.gold ?? 0);
  const wood          = Math.floor(state.resources.wood ?? 0);
  const stone         = Math.floor(state.resources.stone ?? 0);
  const canHire       = gold >= Artisan.HIRE_GOLD_COST;
  const canCommission = wood >= Artisan.COMMISSION_WOOD_COST && stone >= Artisan.COMMISSION_STONE_COST;
  const urg = secs <= 15 ? ' artisan-timer--urgent' : '';
  return `
    <div class="artisan-section--active">
      <div class="artisan-header">
        <span class="artisan-title">🔨 Master Artisan Visit</span>
        <span class="artisan-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="artisan-desc">A renowned master artisan arrives at the imperial court seeking patronage. Their skills are legendary.</div>
      <div class="artisan-actions">
        <button class="btn--artisan-hire${canHire ? '' : ' btn--disabled'}" data-action="artisan-hire" ${canHire ? '' : 'disabled'}>
          🏅 Hire Master Artisan — ${Artisan.HIRE_GOLD_COST}💰
          <span class="artisan-cost">→ +${Artisan.HIRE_PRESTIGE_REWARD} prestige · +${Artisan.HIRE_IRON_RATE} iron/s (3 min)</span>
        </button>
        <button class="btn--artisan-commission${canCommission ? '' : ' btn--disabled'}" data-action="artisan-commission" ${canCommission ? '' : 'disabled'}>
          🎨 Commission Pieces — ${Artisan.COMMISSION_WOOD_COST}🪵 + ${Artisan.COMMISSION_STONE_COST}🪨
          <span class="artisan-cost">→ +${Artisan.COMMISSION_GOLD_REWARD} gold · +${Artisan.COMMISSION_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--artisan-farewell" data-action="artisan-farewell">👋 Bid Farewell</button>
      </div>
    </div>`;
}

// ── T253 Mountain Hermit ─────────────────────────────────────────────────────

function _hermitSection() {
  if (!Hermit.getActiveMountainHermit()) return '';
  const secs       = Hermit.getMountainHermitSecsLeft();
  const gold       = Math.floor(state.resources.gold ?? 0);
  const canTribute = gold >= Hermit.TRIBUTE_GOLD_COST;
  const urg = secs <= 15 ? ' hermit-timer--urgent' : '';
  return `
    <div class="hermit-section--active">
      <div class="hermit-header">
        <span class="hermit-title">🧙 Mountain Hermit</span>
        <span class="hermit-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="hermit-desc">A wise hermit descends from the mountains bearing ancient wisdom and cryptic counsel.</div>
      <div class="hermit-actions">
        <button class="btn--hermit-counsel" data-action="hermit-counsel">
          📿 Seek Counsel — free
          <span class="hermit-cost">→ +${Hermit.COUNSEL_PRESTIGE_REWARD} prestige · +${Hermit.COUNSEL_MANA_RATE} mana/s (2 min)</span>
        </button>
        <button class="btn--hermit-tribute${canTribute ? '' : ' btn--disabled'}" data-action="hermit-tribute" ${canTribute ? '' : 'disabled'}>
          🪙 Offer Tribute — ${Hermit.TRIBUTE_GOLD_COST}💰
          <span class="hermit-cost">→ +${Hermit.TRIBUTE_PRESTIGE_REWARD} prestige · +${Hermit.TRIBUTE_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--hermit-leave" data-action="hermit-leave">🏔️ Leave in Peace</button>
      </div>
    </div>`;
}

// ── T254 Imperial Jubilee ────────────────────────────────────────────────────

function _jubileeSection() {
  if (!Jubilee.getActiveImperialJubilee()) return '';
  const secs      = Jubilee.getImperialJubileeSecsLeft();
  const gold      = Math.floor(state.resources.gold ?? 0);
  const food      = Math.floor(state.resources.food ?? 0);
  const canParade = gold >= Jubilee.PARADE_GOLD_COST;
  const canFeast  = food >= Jubilee.FEAST_FOOD_COST;
  const urg = secs <= 15 ? ' jubilee-timer--urgent' : '';
  return `
    <div class="jubilee-section--active">
      <div class="jubilee-header">
        <span class="jubilee-title">🎉 Imperial Jubilee</span>
        <span class="jubilee-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="jubilee-desc">A milestone moment calls for celebration! Declare a jubilee to lift the spirits of your people.</div>
      <div class="jubilee-actions">
        <button class="btn--jubilee-parade${canParade ? '' : ' btn--disabled'}" data-action="jubilee-parade" ${canParade ? '' : 'disabled'}>
          🎺 Grand Parade — ${Jubilee.PARADE_GOLD_COST}💰
          <span class="jubilee-cost">→ +${Jubilee.PARADE_MORALE_REWARD} morale · +${Jubilee.PARADE_PRESTIGE_REWARD} prestige · rate bonuses (3 min)</span>
        </button>
        <button class="btn--jubilee-feast${canFeast ? '' : ' btn--disabled'}" data-action="jubilee-feast" ${canFeast ? '' : 'disabled'}>
          🍖 Royal Feast — ${Jubilee.FEAST_FOOD_COST}🌾
          <span class="jubilee-cost">→ +${Jubilee.FEAST_MORALE_REWARD} morale · +${Jubilee.FEAST_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--jubilee-ceremony" data-action="jubilee-ceremony">
          🕊️ Simple Ceremony — free
          <span class="jubilee-cost">→ +${Jubilee.CEREMONY_MORALE_REWARD} morale · +${Jubilee.CEREMONY_PRESTIGE_REWARD} prestige</span>
        </button>
      </div>
    </div>`;
}

// ── T255 Exiled Prince ───────────────────────────────────────────────────────

function _princeSection() {
  if (!Prince.getActiveExiledPrince()) return '';
  const secs       = Prince.getExiledPrinceSecsLeft();
  const gold       = Math.floor(state.resources.gold ?? 0);
  const canAdvisor = gold >= Prince.ADVISOR_GOLD_COST;
  const asyMin     = Math.round(Prince.ASYLUM_DURATION_TICKS / (60 * TICKS_PER_SECOND));
  const advMin     = Math.round(Prince.ADVISOR_DURATION_TICKS / (60 * TICKS_PER_SECOND));
  const urg = secs <= 15 ? ' prince-timer--urgent' : '';
  return `
    <div class="prince-section--active">
      <div class="prince-header">
        <span class="prince-title">👑 Exiled Prince</span>
        <span class="prince-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="prince-desc">A deposed prince from a distant land seeks refuge at your court, bearing secrets of statecraft.</div>
      <div class="prince-actions">
        <button class="btn--prince-asylum" data-action="prince-asylum">
          🏰 Grant Asylum — free
          <span class="prince-cost">→ +${Prince.ASYLUM_MORALE_REWARD} morale · +${Prince.ASYLUM_PRESTIGE_REWARD} prestige · +${Prince.ASYLUM_GOLD_RATE} gold/s (${asyMin} min)</span>
        </button>
        <button class="btn--prince-advisor${canAdvisor ? '' : ' btn--disabled'}" data-action="prince-advisor" ${canAdvisor ? '' : 'disabled'}>
          📜 Hire as Advisor — ${Prince.ADVISOR_GOLD_COST}💰
          <span class="prince-cost">→ +${Prince.ADVISOR_PRESTIGE_REWARD} prestige · +${Prince.ADVISOR_MORALE_REWARD} morale · +${Prince.ADVISOR_IRON_RATE} iron/s (${advMin} min)</span>
        </button>
        <button class="btn--prince-away" data-action="prince-away">🚪 Turn Away</button>
      </div>
    </div>`;
}

// ── T256 Ancient Guardian ────────────────────────────────────────────────────

function _guardianSection() {
  if (!Guardian.getActiveAncientGuardian()) return '';
  const secs       = Guardian.getAncientGuardianSecsLeft();
  const food       = Math.floor(state.resources.food ?? 0);
  const mana       = Math.floor(state.resources.mana ?? 0);
  const canTribute = food >= Guardian.TRIBUTE_FOOD_COST;
  const canRitual  = mana >= Guardian.RITUAL_MANA_COST;
  const urg = secs <= 15 ? ' guardian-timer--urgent' : '';
  return `
    <div class="guardian-section--active">
      <div class="guardian-header">
        <span class="guardian-title">🗿 Ancient Guardian Awakens</span>
        <span class="guardian-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="guardian-desc">A colossal stone guardian stirs from millennial slumber at the empire's borders, demanding acknowledgement.</div>
      <div class="guardian-actions">
        <button class="btn--guardian-tribute${canTribute ? '' : ' btn--disabled'}" data-action="guardian-tribute" ${canTribute ? '' : 'disabled'}>
          🌾 Offer Tribute — ${Guardian.TRIBUTE_FOOD_COST}🌾
          <span class="guardian-cost">→ +${Guardian.TRIBUTE_MORALE_REWARD} morale · +${Guardian.TRIBUTE_PRESTIGE_REWARD} prestige · +${Guardian.TRIBUTE_STONE_RATE} stone/s (2 min)</span>
        </button>
        <button class="btn--guardian-ritual${canRitual ? '' : ' btn--disabled'}" data-action="guardian-ritual" ${canRitual ? '' : 'disabled'}>
          🔮 Conduct Ritual — ${Guardian.RITUAL_MANA_COST}✨
          <span class="guardian-cost">→ +${Guardian.RITUAL_PRESTIGE_REWARD} prestige · +${Guardian.RITUAL_MANA_RATE} mana/s (3 min)</span>
        </button>
        <button class="btn--guardian-firm" data-action="guardian-firm">
          🛡️ Stand Firm — free
          <span class="guardian-cost">→ +${Guardian.STANDFIRM_MORALE_REWARD} morale · +${Guardian.STANDFIRM_PRESTIGE_REWARD} prestige</span>
        </button>
      </div>
    </div>`;
}

// ── T257 Desert Oasis ────────────────────────────────────────────────────────

function _oasisSection() {
  if (!Oasis.getActiveDesertOasis()) return '';
  const secs        = Oasis.getDesertOasisSecsLeft();
  const gold        = Math.floor(state.resources.gold ?? 0);
  const mana        = Math.floor(state.resources.mana ?? 0);
  const canTrade    = gold >= Oasis.TRADE_GOLD_COST;
  const canOffering = mana >= Oasis.OFFERING_MANA_COST;
  const urg = secs <= 15 ? ' oasis-timer--urgent' : '';
  return `
    <div class="oasis-section--active">
      <div class="oasis-header">
        <span class="oasis-title">🌴 Desert Oasis Discovery</span>
        <span class="oasis-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="oasis-desc">Scouts discovered a hidden desert oasis shimmering with water and life in the empire's territory.</div>
      <div class="oasis-actions">
        <button class="btn--oasis-trade${canTrade ? '' : ' btn--disabled'}" data-action="oasis-trade" ${canTrade ? '' : 'disabled'}>
          🏪 Develop Trade Stop — ${Oasis.TRADE_GOLD_COST}💰
          <span class="oasis-cost">→ +${Oasis.TRADE_GOLD_RATE} gold/s (3 min) · +${Oasis.TRADE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--oasis-water" data-action="oasis-water">
          💧 Draw Oasis Water — free
          <span class="oasis-cost">→ +${Oasis.WATER_FOOD_REWARD} food · +${Oasis.WATER_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--oasis-offering${canOffering ? '' : ' btn--disabled'}" data-action="oasis-offering" ${canOffering ? '' : 'disabled'}>
          🙏 Sacred Offering — ${Oasis.OFFERING_MANA_COST}✨
          <span class="oasis-cost">→ +${Oasis.OFFERING_PRESTIGE_REWARD} prestige · +${Oasis.OFFERING_FOOD_RATE} food/s (2 min)</span>
        </button>
      </div>
    </div>`;
}

// ── T258 Foreign Dignitary ───────────────────────────────────────────────────

function _dignitarySection() {
  if (!Dignitary.getActiveForeignDignitary()) return '';
  const secs         = Dignitary.getForeignDignitarySecsLeft();
  const gold         = Math.floor(state.resources.gold ?? 0);
  const food         = Math.floor(state.resources.food ?? 0);
  const iron         = Math.floor(state.resources.iron ?? 0);
  const canReception = gold >= Dignitary.RECEPTION_GOLD_COST;
  const canGifts     = food >= Dignitary.GIFT_FOOD_COST && iron >= Dignitary.GIFT_IRON_COST;
  const urg = secs <= 15 ? ' dignitary-timer--urgent' : '';
  return `
    <div class="dignitary-section--active">
      <div class="dignitary-header">
        <span class="dignitary-title">🤵 Foreign Dignitary Visit</span>
        <span class="dignitary-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="dignitary-desc">A distinguished foreign dignitary arrives with entourage to assess the empire's standing and power.</div>
      <div class="dignitary-actions">
        <button class="btn--dignitary-reception${canReception ? '' : ' btn--disabled'}" data-action="dignitary-reception" ${canReception ? '' : 'disabled'}>
          🥂 Grand Reception — ${Dignitary.RECEPTION_GOLD_COST}💰
          <span class="dignitary-cost">→ +${Dignitary.RECEPTION_PRESTIGE_REWARD} prestige · +${Dignitary.RECEPTION_MORALE_REWARD} morale · +${Dignitary.RECEPTION_GOLD_RATE} gold/s (4 min)</span>
        </button>
        <button class="btn--dignitary-welcome" data-action="dignitary-welcome">
          🤝 Modest Welcome — free
          <span class="dignitary-cost">→ +${Dignitary.WELCOME_PRESTIGE_REWARD} prestige · +${Dignitary.WELCOME_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--dignitary-gifts${canGifts ? '' : ' btn--disabled'}" data-action="dignitary-gifts" ${canGifts ? '' : 'disabled'}>
          🎁 Present Gifts — ${Dignitary.GIFT_FOOD_COST}🌾 + ${Dignitary.GIFT_IRON_COST}⚙️
          <span class="dignitary-cost">→ +${Dignitary.GIFT_PRESTIGE_REWARD} prestige · +${Dignitary.GIFT_MORALE_REWARD} morale</span>
        </button>
      </div>
    </div>`;
}

// ── T259 Lost Merchant Caravan ───────────────────────────────────────────────

function _caravanSection() {
  if (!Caravan.getActiveLostCaravan()) return '';
  const secs       = Caravan.getLostCaravanSecsLeft();
  const food       = Math.floor(state.resources.food ?? 0);
  const gold       = Math.floor(state.resources.gold ?? 0);
  const canShelter = food >= Caravan.SHELTER_FOOD_COST;
  const canHire    = gold >= Caravan.HIRE_GOLD_COST;
  const urg = secs <= 15 ? ' caravan-timer--urgent' : '';
  return `
    <div class="caravan-section--active">
      <div class="caravan-header">
        <span class="caravan-title">🐫 Lost Merchant Caravan</span>
        <span class="caravan-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="caravan-desc">A lost merchant caravan is spotted at the empire's edge, exhausted and low on supplies.</div>
      <div class="caravan-actions">
        <button class="btn--caravan-shelter${canShelter ? '' : ' btn--disabled'}" data-action="caravan-shelter" ${canShelter ? '' : 'disabled'}>
          🏕️ Offer Shelter — ${Caravan.SHELTER_FOOD_COST}🌾
          <span class="caravan-cost">→ +${Caravan.SHELTER_MORALE_REWARD} morale · +${Caravan.SHELTER_PRESTIGE_REWARD} prestige · +${Caravan.SHELTER_GOLD_RATE} gold/s (3 min)</span>
        </button>
        <button class="btn--caravan-hire${canHire ? '' : ' btn--disabled'}" data-action="caravan-hire" ${canHire ? '' : 'disabled'}>
          🗺️ Hire as Guides — ${Caravan.HIRE_GOLD_COST}💰
          <span class="caravan-cost">→ +${Caravan.HIRE_IRON_REWARD} iron · +${Caravan.HIRE_PRESTIGE_REWARD} prestige · +${Caravan.HIRE_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--caravan-away" data-action="caravan-away">🚪 Turn Away</button>
      </div>
    </div>`;
}

// ── T260 Nomadic Scholar ─────────────────────────────────────────────────────

function _scholarSection() {
  if (!Scholar.getActiveNomadicScholar()) return '';
  const secs          = Scholar.getNomadicScholarSecsLeft();
  const mana          = Math.floor(state.resources.mana ?? 0);
  const gold          = Math.floor(state.resources.gold ?? 0);
  const canCommission = mana >= Scholar.COMMISSION_MANA_COST;
  const canPurchase   = gold >= Scholar.PURCHASE_GOLD_COST;
  const urg = secs <= 15 ? ' scholar-timer--urgent' : '';
  return `
    <div class="scholar-section--active">
      <div class="scholar-header">
        <span class="scholar-title">📚 Nomadic Scholar</span>
        <span class="scholar-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="scholar-desc">A nomadic scholar carrying ancient manuscripts arrives at the imperial court seeking a patron.</div>
      <div class="scholar-actions">
        <button class="btn--scholar-commission${canCommission ? '' : ' btn--disabled'}" data-action="scholar-commission" ${canCommission ? '' : 'disabled'}>
          🔬 Commission Studies — ${Scholar.COMMISSION_MANA_COST}✨
          <span class="scholar-cost">→ +${Scholar.COMMISSION_PRESTIGE} prestige · +${Scholar.COMMISSION_IRON_RATE} iron/s (2 min)</span>
        </button>
        <button class="btn--scholar-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="scholar-purchase" ${canPurchase ? '' : 'disabled'}>
          📜 Purchase Manuscripts — ${Scholar.PURCHASE_GOLD_COST}💰
          <span class="scholar-cost">→ +${Scholar.PURCHASE_PRESTIGE} prestige · +${Scholar.PURCHASE_MANA_RATE} mana/s (3 min)</span>
        </button>
        <button class="btn--scholar-dismiss" data-action="scholar-dismiss">
          👋 Thank and Dismiss — free
          <span class="scholar-cost">→ +${Scholar.DISMISS_MORALE_REWARD} morale · +${Scholar.DISMISS_PRESTIGE_REWARD} prestige</span>
        </button>
      </div>
    </div>`;
}

// ── T261 Royal Feast ─────────────────────────────────────────────────────────

function _feastSection() {
  if (!Feast.getActiveRoyalFeast()) return '';
  const secs      = Feast.getRoyalFeastSecsLeft();
  const food      = Math.floor(state.resources.food ?? 0);
  const gold      = Math.floor(state.resources.gold ?? 0);
  const canBanquet = food >= Feast.BANQUET_FOOD_COST && gold >= Feast.BANQUET_GOLD_COST;
  const canModest  = food >= Feast.MODEST_FOOD_COST;
  const urg = secs <= 15 ? ' feast-timer--urgent' : '';
  return `
    <div class="feast-section--active">
      <div class="feast-header">
        <span class="feast-title">🍖 Royal Feast</span>
        <span class="feast-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="feast-desc">The time has come for a grand celebration! Declare a feast to raise the spirits of your people.</div>
      <div class="feast-actions">
        <button class="btn--feast-grand${canBanquet ? '' : ' btn--disabled'}" data-action="feast-grand" ${canBanquet ? '' : 'disabled'}>
          🎊 Grand Banquet — ${Feast.BANQUET_FOOD_COST}🌾 + ${Feast.BANQUET_GOLD_COST}💰
          <span class="feast-cost">→ +${Feast.BANQUET_MORALE_REWARD} morale · +${Feast.BANQUET_PRESTIGE_REWARD} prestige · +${Feast.BANQUET_FOOD_RATE} food/s (3 min)</span>
        </button>
        <button class="btn--feast-modest${canModest ? '' : ' btn--disabled'}" data-action="feast-modest" ${canModest ? '' : 'disabled'}>
          🍽️ Modest Celebration — ${Feast.MODEST_FOOD_COST}🌾
          <span class="feast-cost">→ +${Feast.MODEST_MORALE_REWARD} morale · +${Feast.MODEST_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--feast-holiday" data-action="feast-holiday">
          🎈 Declare Holiday — free
          <span class="feast-cost">→ +${Feast.HOLIDAY_MORALE_REWARD} morale · +${Feast.HOLIDAY_PRESTIGE_REWARD} prestige</span>
        </button>
      </div>
    </div>`;
}

// ── T262 Wandering Blacksmith ────────────────────────────────────────────────

function _blacksmithSection() {
  if (!Blacksmith.getActiveWanderingBlacksmith()) return '';
  const secs       = Blacksmith.getBlacksmithSecsLeft();
  const iron       = Math.floor(state.resources.iron ?? 0);
  const gold       = Math.floor(state.resources.gold ?? 0);
  const food       = Math.floor(state.resources.food ?? 0);
  const canWeapons = iron >= Blacksmith.WEAPONS_IRON_COST;
  const canTools   = iron >= Blacksmith.TOOLS_IRON_COST && gold >= Blacksmith.TOOLS_GOLD_COST;
  const canLodging = food >= Blacksmith.LODGING_FOOD_COST;
  const urg = secs <= 15 ? ' blacksmith-timer--urgent' : '';
  return `
    <div class="blacksmith-section--active">
      <div class="blacksmith-header">
        <span class="blacksmith-title">⚒️ Wandering Blacksmith</span>
        <span class="blacksmith-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="blacksmith-desc">A master blacksmith travels through the empire, offering rare craftsmanship services.</div>
      <div class="blacksmith-actions">
        <button class="btn--blacksmith-weapons${canWeapons ? '' : ' btn--disabled'}" data-action="blacksmith-weapons" ${canWeapons ? '' : 'disabled'}>
          ⚔️ Commission Elite Weapons — ${Blacksmith.WEAPONS_IRON_COST}⚙️
          <span class="blacksmith-cost">→ +${Blacksmith.WEAPONS_IRON_RATE} iron/s (2 min) · +${Blacksmith.WEAPONS_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--blacksmith-tools${canTools ? '' : ' btn--disabled'}" data-action="blacksmith-tools" ${canTools ? '' : 'disabled'}>
          🛠️ Forge Iron Tools — ${Blacksmith.TOOLS_IRON_COST}⚙️ + ${Blacksmith.TOOLS_GOLD_COST}💰
          <span class="blacksmith-cost">→ +${Blacksmith.TOOLS_IRON_REWARD} iron · +${Blacksmith.TOOLS_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--blacksmith-lodging${canLodging ? '' : ' btn--disabled'}" data-action="blacksmith-lodging" ${canLodging ? '' : 'disabled'}>
          🏠 Offer Lodging — ${Blacksmith.LODGING_FOOD_COST}🌾
          <span class="blacksmith-cost">→ +${Blacksmith.LODGING_MORALE_REWARD} morale · +${Blacksmith.LODGING_PRESTIGE_REWARD} prestige</span>
        </button>
      </div>
    </div>`;
}

// ── T263 Traveling Astrologer ────────────────────────────────────────────────

function _astrologerSection() {
  if (!Astrologer.getActiveTravelingAstrologer()) return '';
  const secs      = Astrologer.getAstrologerSecsLeft();
  const gold      = Math.floor(state.resources.gold ?? 0);
  const mana      = Math.floor(state.resources.mana ?? 0);
  const food      = Math.floor(state.resources.food ?? 0);
  const canChart   = gold >= Astrologer.CHART_GOLD_COST && mana >= Astrologer.CHART_MANA_COST;
  const canWisdom  = mana >= Astrologer.WISDOM_MANA_COST;
  const canRefresh = food >= Astrologer.REFRESH_FOOD_COST;
  const urg = secs <= 15 ? ' astrologer-timer--urgent' : '';
  return `
    <div class="astrologer-section--active">
      <div class="astrologer-header">
        <span class="astrologer-title">🔭 Traveling Astrologer</span>
        <span class="astrologer-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="astrologer-desc">A renowned astrologer arrives with celestial charts, offering cosmic guidance and star wisdom.</div>
      <div class="astrologer-actions">
        <button class="btn--astrologer-chart${canChart ? '' : ' btn--disabled'}" data-action="astrologer-chart" ${canChart ? '' : 'disabled'}>
          🗺️ Commission Star Chart — ${Astrologer.CHART_GOLD_COST}💰 + ${Astrologer.CHART_MANA_COST}✨
          <span class="astrologer-cost">→ +${Astrologer.CHART_MANA_RATE} mana/s (2.5 min) · +${Astrologer.CHART_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--astrologer-wisdom${canWisdom ? '' : ' btn--disabled'}" data-action="astrologer-wisdom" ${canWisdom ? '' : 'disabled'}>
          🌟 Seek Celestial Wisdom — ${Astrologer.WISDOM_MANA_COST}✨
          <span class="astrologer-cost">→ +${Astrologer.WISDOM_MORALE_REWARD} morale · +${Astrologer.WISDOM_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--astrologer-refreshments${canRefresh ? '' : ' btn--disabled'}" data-action="astrologer-refreshments" ${canRefresh ? '' : 'disabled'}>
          🍵 Offer Refreshments — ${Astrologer.REFRESH_FOOD_COST}🌾
          <span class="astrologer-cost">→ +${Astrologer.REFRESH_MORALE_REWARD} morale · +${Astrologer.REFRESH_PRESTIGE_REWARD} prestige</span>
        </button>
      </div>
    </div>`;
}

// ── T264 Merchant Prince ─────────────────────────────────────────────────────

function _merchantPrinceSection() {
  if (!Merchant.getActiveMerchantPrince()) return '';
  const secs         = Merchant.getMerchantPrinceSecsLeft();
  const gold         = Math.floor(state.resources.gold ?? 0);
  const food         = Math.floor(state.resources.food ?? 0);
  const wood         = Math.floor(state.resources.wood ?? 0);
  const canDeal      = gold >= Merchant.DEAL_GOLD_COST;
  const canExchange  = food >= Merchant.EXCHANGE_FOOD_COST && wood >= Merchant.EXCHANGE_WOOD_COST;
  const canReception = food >= Merchant.RECEPTION_FOOD_COST;
  const urg = secs <= 15 ? ' merchant-timer--urgent' : '';
  return `
    <div class="merchant-section--active">
      <div class="merchant-header">
        <span class="merchant-icon">💰</span>
        <span class="merchant-title">Merchant Prince</span>
        <span class="merchant-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="merchant-desc">A wealthy merchant prince passes through seeking profitable arrangements with the empire.</div>
      <div class="merchant-actions">
        <button class="btn--merchant-deal${canDeal ? '' : ' btn--disabled'}" data-action="merchant-deal" ${canDeal ? '' : 'disabled'}>
          💰 Arrange Trade Deal — ${Merchant.DEAL_GOLD_COST}💰
          <span class="merchant-cost">→ +${Merchant.DEAL_GOLD_RATE} gold/s (2.5 min) · +${Merchant.DEAL_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--merchant-exchange${canExchange ? '' : ' btn--disabled'}" data-action="merchant-exchange" ${canExchange ? '' : 'disabled'}>
          🤝 Exchange Valuable Goods — ${Merchant.EXCHANGE_FOOD_COST}🌾 + ${Merchant.EXCHANGE_WOOD_COST}🪵
          <span class="merchant-cost">→ +${Merchant.EXCHANGE_GOLD_REWARD} gold · +${Merchant.EXCHANGE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--merchant-reception${canReception ? '' : ' btn--disabled'}" data-action="merchant-reception" ${canReception ? '' : 'disabled'}>
          🍷 Host Lavish Reception — ${Merchant.RECEPTION_FOOD_COST}🌾
          <span class="merchant-cost">→ +${Merchant.RECEPTION_MORALE_REWARD} morale · +${Merchant.RECEPTION_PRESTIGE_REWARD} prestige</span>
        </button>
      </div>
    </div>`;
}

// ── T266 Wandering Sage ──────────────────────────────────────────────────────

function _wanderingSageSection() {
  if (!Sage.getActiveWanderingSage()) return '';
  const secs      = Sage.getWanderingSageSecsLeft();
  const gold      = Math.floor(state.resources.gold ?? 0);
  const mana      = Math.floor(state.resources.mana ?? 0);
  const food      = Math.floor(state.resources.food ?? 0);
  const canEdict  = gold >= Sage.EDICT_GOLD_COST && mana >= Sage.EDICT_MANA_COST;
  const canStudy  = mana >= Sage.STUDY_MANA_COST;
  const canHost   = food >= Sage.HOST_FOOD_COST;
  const urg = secs <= 15 ? ' sage-timer--urgent' : '';
  return `
    <div class="sage-section--active">
      <div class="sage-header">
        <span class="sage-title">🧑‍🏫 Wandering Sage</span>
        <span class="sage-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="sage-desc">A sage renowned for ancient knowledge has arrived at the imperial court. Their wisdom spans centuries.</div>
      <div class="sage-actions">
        <button class="btn--sage-edict${canEdict ? '' : ' btn--disabled'}" data-action="sage-edict" ${canEdict ? '' : 'disabled'}>
          📜 Commission Imperial Edict — ${Sage.EDICT_GOLD_COST}💰 + ${Sage.EDICT_MANA_COST}✨
          <span class="sage-cost">→ +${Sage.EDICT_GOLD_RATE} gold/s · +${Sage.EDICT_MANA_RATE} mana/s (3 min) · +${Sage.EDICT_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--sage-study${canStudy ? '' : ' btn--disabled'}" data-action="sage-study" ${canStudy ? '' : 'disabled'}>
          📖 Study Ancient Texts — ${Sage.STUDY_MANA_COST}✨
          <span class="sage-cost">→ +${Sage.STUDY_MANA_RATE} mana/s (2.5 min) · +${Sage.STUDY_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--sage-host${canHost ? '' : ' btn--disabled'}" data-action="sage-host" ${canHost ? '' : 'disabled'}>
          🍵 Offer Humble Hospitality — ${Sage.HOST_FOOD_COST}🌾
          <span class="sage-cost">→ +${Sage.HOST_MORALE_REWARD} morale · +${Sage.HOST_PRESTIGE_REWARD} prestige</span>
        </button>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Main render
// ---------------------------------------------------------------------------

function _render() {
  if (!_panel) return;
  _panel.innerHTML = `
    <div class="quest-panel-inner">
      ${_questsSection()}
      ${_encountersSection()}
    </div>`;
}

// ---------------------------------------------------------------------------
// Click handler — delegates to encounter action functions
// ---------------------------------------------------------------------------

const _HANDLERS = {
  'circus-show':    () => Circus.circusWelcomeShow(),
  'circus-recruit': () => Circus.circusRecruitPerformers(),
  'circus-dismiss': () => Circus.dismissCircus(),

  'spring-bless':   () => Spring.blessSpringWaters(),
  'spring-sell':    () => Spring.sellSpringWaterRights(),
  'spring-protect': () => Spring.protectSacredSpring(),

  'bard-commission': () => Bard.commissionBardPerformance(),
  'bard-listen':     () => Bard.listenToBardStories(),
  'bard-away':       () => Bard.sendBardAway(),

  'artisan-hire':       () => Artisan.hireMasterArtisan(),
  'artisan-commission': () => Artisan.commissionArtisanPieces(),
  'artisan-farewell':   () => Artisan.bidArtisanFarewell(),

  'hermit-counsel': () => Hermit.seekHermitCounsel(),
  'hermit-tribute': () => Hermit.offerHermitTribute(),
  'hermit-leave':   () => Hermit.leaveHermitInPeace(),

  'jubilee-parade':   () => Jubilee.declareGrandParade(),
  'jubilee-feast':    () => Jubilee.declareRoyalFeast(),
  'jubilee-ceremony': () => Jubilee.declareSimpleCeremony(),

  'prince-asylum':  () => Prince.grantAsylum(),
  'prince-advisor': () => Prince.acceptPrinceAdvisor(),
  'prince-away':    () => Prince.turnPrinceAway(),

  'guardian-tribute': () => Guardian.offerGuardianTribute(),
  'guardian-ritual':  () => Guardian.conductGuardianRitual(),
  'guardian-firm':    () => Guardian.standFirmGuardian(),

  'oasis-trade':    () => Oasis.developOasisTradeStop(),
  'oasis-water':    () => Oasis.drawOasisWater(),
  'oasis-offering': () => Oasis.offerOasisSacrifice(),

  'dignitary-reception': () => Dignitary.hostGrandReception(),
  'dignitary-welcome':   () => Dignitary.offerModestWelcome(),
  'dignitary-gifts':     () => Dignitary.presentDignitaryGifts(),

  'caravan-shelter': () => Caravan.offerCaravanShelter(),
  'caravan-hire':    () => Caravan.hireCaravanGuides(),
  'caravan-away':    () => Caravan.turnCaravanAway(),

  'scholar-commission': () => Scholar.commissionScholarStudies(),
  'scholar-purchase':   () => Scholar.purchaseScholarManuscripts(),
  'scholar-dismiss':    () => Scholar.dismissScholarGracefully(),

  'feast-grand':   () => Feast.declareGrandBanquet(),
  'feast-modest':  () => Feast.declareModestCelebration(),
  'feast-holiday': () => Feast.declareHoliday(),

  'blacksmith-weapons': () => Blacksmith.commissionEliteWeapons(),
  'blacksmith-tools':   () => Blacksmith.forgeIronTools(),
  'blacksmith-lodging': () => Blacksmith.offerBlacksmithLodging(),

  'astrologer-chart':        () => Astrologer.commissionStarChart(),
  'astrologer-wisdom':       () => Astrologer.seekCelestialWisdom(),
  'astrologer-refreshments': () => Astrologer.offerAstrologerRefreshments(),

  'merchant-deal':      () => Merchant.arrangeTradeDeal(),
  'merchant-exchange':  () => Merchant.exchangeValuableGoods(),
  'merchant-reception': () => Merchant.hostMerchantReception(),

  'sage-edict': () => Sage.commissionImperialEdict(),
  'sage-study': () => Sage.studyAncientTexts(),
  'sage-host':  () => Sage.offerHumbleHospitality(),
};

function _handleClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn || btn.disabled || btn.classList.contains('btn--disabled')) return;
  const fn = _HANDLERS[btn.dataset.action];
  if (fn) { fn(); _render(); }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function initQuestPanel() {
  _panel = document.getElementById('panel-quests');
  if (!_panel) return;

  setQuestPanelRenderer(_render);

  const ENCOUNTER_EVENTS = [
    Events.QUEST_COMPLETED,
    Events.CIRCUS_CHANGED,
    Events.SACRED_SPRING_CHANGED,
    Events.WANDERING_BARD_CHANGED,
    Events.MASTER_ARTISAN_CHANGED,
    Events.MOUNTAIN_HERMIT_CHANGED,
    Events.IMPERIAL_JUBILEE_CHANGED,
    Events.EXILED_PRINCE_CHANGED,
    Events.ANCIENT_GUARDIAN_CHANGED,
    Events.DESERT_OASIS_CHANGED,
    Events.FOREIGN_DIGNITARY_CHANGED,
    Events.LOST_CARAVAN_CHANGED,
    Events.NOMADIC_SCHOLAR_CHANGED,
    Events.ROYAL_FEAST_CHANGED,
    Events.BLACKSMITH_CHANGED,
    Events.ASTROLOGER_CHANGED,
    Events.MERCHANT_PRINCE_CHANGED,
    Events.WANDERING_SAGE_CHANGED,
    Events.RESOURCE_CHANGED,
  ];
  for (const ev of ENCOUNTER_EVENTS) on(ev, _render);

  let _ticks = 0;
  on(Events.TICK, () => { if (++_ticks % 4 === 0) _render(); });

  _panel.addEventListener('click', _handleClick);
  _render();
}
