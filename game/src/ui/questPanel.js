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
import * as Forester  from '../systems/masterForester.js';      // T267
import * as Spirit    from '../systems/forestSpirit.js';        // T268
import * as Alchemist from '../systems/wanderingAlchemist.js';  // T269
import * as Explorer  from '../systems/seafaringExplorer.js';   // T270
import * as Monk         from '../systems/travelingMonk.js';         // T271
import * as ImpCarto     from '../systems/imperialCartographer.js';   // T272
import * as Oracle       from '../systems/wanderingOracle.js';        // T273
import * as Emissary     from '../systems/royalEmissary.js';          // T274
import * as Tinker       from '../systems/wanderingTinker.js';         // T275
import * as Physician    from '../systems/wanderingPhysician.js';      // T276
import * as Cartomancer  from '../systems/wanderingCartomancer.js';    // T277
import * as Elder        from '../systems/villageElderVisit.js';       // T278
import * as Scribe       from '../systems/wanderingScribe.js';         // T279
import * as DTrader      from '../systems/desertTrader.js';            // T280
import * as Gemcutter    from '../systems/wanderingGemcutter.js';      // T281
import * as FWarden      from '../systems/forestWarden.js';            // T282
import * as Beekeeper   from '../systems/wanderingBeekeeper.js';      // T283
import * as SCarver     from '../systems/stoneCarver.js';             // T284
import * as Glassblower from '../systems/wanderingGlassblower.js';    // T285
import * as RAstronomer from '../systems/royalAstronomer.js';         // T286
import * as IHerald     from '../systems/imperialHerald.js';          // T287
import * as TPotter     from '../systems/travelingPotter.js';         // T288
import * as WDyer       from '../systems/wanderingDyer.js';           // T289
import * as FScout      from '../systems/frontierScout.js';           // T290
import * as Shipwright  from '../systems/wanderingShipwright.js';    // T291
import * as MBrewer     from '../systems/masterBrewer.js';           // T292
import * as ManTrader   from '../systems/ancientManuscriptTrader.js'; // T293
import * as SiegeEng    from '../systems/imperialSiegeEngineer.js';   // T294
import * as Weaver      from '../systems/wanderingWeaver.js';          // T295
import * as Architect   from '../systems/travelingArchitect.js';       // T296
import * as Falconer   from '../systems/wanderingFalconer.js';         // T297
import * as Botanist   from '../systems/roamingBotanist.js';           // T298
import * as Jeweler    from '../systems/wanderingJeweler.js';          // T299
import * as NomadChief from '../systems/desertNomadChief.js';          // T300
import * as Sculptor   from '../systems/wanderingSculptor.js';         // T301
import * as Vintner    from '../systems/royalVintner.js';              // T302
import * as Mapmaker  from '../systems/wanderingMapmaker.js';          // T303
import * as Perfumer      from '../systems/royalPerfumer.js';              // T304
import * as Silversmith  from '../systems/wanderingSilversmith.js';       // T305
import * as SpiceMerchant from '../systems/imperialSpiceMerchant.js';    // T306
import * as Musician     from '../systems/courtMusician.js';             // T307
import * as LibKeeper    from '../systems/ancientLibraryKeeper.js';      // T308
import * as Clockmaker   from '../systems/wanderingClockmaker.js';       // T309
import * as Weaponsmith  from '../systems/imperialWeaponsmith.js';       // T310
import * as Stonemason  from '../systems/wanderingStonemason.js';       // T311
import * as DyeMaster   from '../systems/imperialDyeMaster.js';         // T312

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
      <span class="quest-header__title">\u{1F3C6} Quests</span>
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
    _masterForesterSection(),
    _forestSpiritSection(),
    _wanderingAlchemistSection(),
    _seafaringExplorerSection(),
    _travelingMonkSection(),
    _imperialCartographerSection(),
    _wanderingOracleSection(),
    _royalEmissarySection(),
    _wanderingTinkerSection(),
    _wanderingPhysicianSection(),
    _wanderingCartomancerSection(),
    _villageElderVisitSection(),
    _wanderingScribeSection(),
    _desertTraderSection(),
    _wanderingGemcutterSection(),
    _forestWardenSection(),
    _wanderingBeekeeperSection(),
    _stoneCarverSection(),
    _wanderingGlassblowerSection(),
    _royalAstronomerSection(),
    _imperialHeraldSection(),
    _travelingPotterSection(),
    _wanderingDyerSection(),
    _frontierScoutSection(),
    _wanderingShipwrightSection(),
    _masterBrewerSection(),
    _ancientManuscriptTraderSection(),
    _imperialSiegeEngineerSection(),
    _wanderingWeaverSection(),
    _travelingArchitectSection(),
    _wanderingFalconerSection(),
    _roamingBotanistSection(),
    _wanderingJewelerSection(),
    _desertNomadChiefSection(),
    _wanderingSculptorSection(),
    _royalVintnerSection(),
    _wanderingMapmakerSection(),
    _royalPerfumerSection(),
    _wanderingSilversmithSection(),
    _imperialSpiceMerchantSection(),
    _courtMusicianSection(),
    _ancientLibraryKeeperSection(),
    _wanderingClockmakerSection(),
    _imperialWeaponsmithSection(),
    _wanderingStonemasonSection(),
    _imperialDyeMasterSection(),
  ].filter(Boolean);

  if (parts.length === 0) return '';
  return `<div class="encounters-header">⚡ Active Encounters</div>${parts.join('')}`;
}

// ── T249 Traveling Circus ────────────────────────────────────────────

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
        <span class="circus-icon">\u{1F3AA}</span>
        <span class="circus-title">Traveling Circus</span>
        <span class="circus-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="circus-desc">A traveling circus arrives at the empire gates! Acrobats, exotic animals, and performers await your decision.</div>
      <div class="circus-actions">
        <button class="btn--circus-show${canShow ? '' : ' btn--disabled'}" data-action="circus-show" ${canShow ? '' : 'disabled'}>
          \u{1F3AA} Welcome Show — ${Circus.SHOW_GOLD_COST}\u{1F4B0}
          <span class="circus-cost">→ +${Circus.SHOW_MORALE_REWARD} morale · +${Circus.SHOW_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--circus-recruit${canRecruit ? '' : ' btn--disabled'}" data-action="circus-recruit" ${canRecruit ? '' : 'disabled'}>
          \u{1F939} Recruit Performers — ${Circus.RECRUIT_GOLD_COST}\u{1F4B0}
          <span class="circus-cost">→ +${Circus.RECRUIT_MORALE_REWARD} morale · +${Circus.RECRUIT_FOOD_RATE} food/s (2 min)</span>
        </button>
        <button class="btn--circus-dismiss" data-action="circus-dismiss">\u{1F44B} Dismiss Circus</button>
      </div>
    </div>`;
}

// ── T250 Sacred Spring ───────────────────────────────────────────────

function _springSection() {
  if (!Spring.getActiveSacredSpring()) return '';
  const secs     = Spring.getSacredSpringSecsLeft();
  const mana     = Math.floor(state.resources.mana ?? 0);
  const canBless = mana >= Spring.BLESS_MANA_COST;
  const urg = secs <= 15 ? ' spring-timer--urgent' : '';
  return `
    <div class="spring-section--active">
      <div class="spring-header">
        <span class="spring-title">\u{1F4A7} Sacred Spring Discovery</span>
        <span class="spring-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="spring-desc">Scouts discovered a sacred spring in imperial territory. Its waters shimmer with mystical energy.</div>
      <div class="spring-actions">
        <button class="btn--spring-bless${canBless ? '' : ' btn--disabled'}" data-action="spring-bless" ${canBless ? '' : 'disabled'}>
          \u{1F30A} Bless the Waters — ${Spring.BLESS_MANA_COST}✨
          <span class="spring-cost">→ +${Spring.BLESS_FOOD_REWARD} food · +${Spring.BLESS_MORALE_REWARD} morale · +${Spring.BLESS_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--spring-sell" data-action="spring-sell">
          \u{1F4B0} Sell Water Rights — −${Spring.SELL_PRESTIGE_COST} prestige
          <span class="spring-cost">→ +${Spring.SELL_GOLD_REWARD} gold (people displeased)</span>
        </button>
        <button class="btn--spring-protect" data-action="spring-protect">
          \u{1F33F} Protect the Spring — free
          <span class="spring-cost">→ +${Spring.PROTECT_MORALE_REWARD} morale · +${Spring.PROTECT_PRESTIGE_REWARD} prestige</span>
        </button>
      </div>
    </div>`;
}

// ── T251 Wandering Bard ──────────────────────────────────────────────

function _bardSection() {
  if (!Bard.getActiveWanderingBard()) return '';
  const secs          = Bard.getWanderingBardSecsLeft();
  const gold          = Math.floor(state.resources.gold ?? 0);
  const canCommission = gold >= Bard.COMMISSION_GOLD_COST;
  const urg = secs <= 15 ? ' bard-timer--urgent' : '';
  return `
    <div class="bard-section--active">
      <div class="bard-header">
        <span class="bard-title">\u{1F3B5} Wandering Bard</span>
        <span class="bard-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="bard-desc">A wandering bard arrives bearing songs of distant lands and epic tales of heroes.</div>
      <div class="bard-actions">
        <button class="btn--bard-commission${canCommission ? '' : ' btn--disabled'}" data-action="bard-commission" ${canCommission ? '' : 'disabled'}>
          \u{1F3B5} Commission Performance — ${Bard.COMMISSION_GOLD_COST}\u{1F4B0}
          <span class="bard-cost">→ +${Bard.COMMISSION_MORALE_REWARD} morale · +${Bard.COMMISSION_PRESTIGE_REWARD} prestige · +${Bard.COMMISSION_FOOD_RATE} food/s (2 min)</span>
        </button>
        <button class="btn--bard-listen" data-action="bard-listen">
          \u{1F4D6} Listen to Stories — free
          <span class="bard-cost">→ +${Bard.LISTEN_MORALE_REWARD} morale · +${Bard.LISTEN_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--bard-away" data-action="bard-away">\u{1F6AA} Send Away</button>
      </div>
    </div>`;
}

// ── T252 Master Artisan ──────────────────────────────────────────────

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
        <span class="artisan-title">\u{1F528} Master Artisan Visit</span>
        <span class="artisan-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="artisan-desc">A renowned master artisan arrives at the imperial court seeking patronage. Their skills are legendary.</div>
      <div class="artisan-actions">
        <button class="btn--artisan-hire${canHire ? '' : ' btn--disabled'}" data-action="artisan-hire" ${canHire ? '' : 'disabled'}>
          \u{1F3C5} Hire Master Artisan — ${Artisan.HIRE_GOLD_COST}\u{1F4B0}
          <span class="artisan-cost">→ +${Artisan.HIRE_PRESTIGE_REWARD} prestige · +${Artisan.HIRE_IRON_RATE} iron/s (3 min)</span>
        </button>
        <button class="btn--artisan-commission${canCommission ? '' : ' btn--disabled'}" data-action="artisan-commission" ${canCommission ? '' : 'disabled'}>
          \u{1F3A8} Commission Pieces — ${Artisan.COMMISSION_WOOD_COST}\u{1FAB5} + ${Artisan.COMMISSION_STONE_COST}\u{1FAA8}
          <span class="artisan-cost">→ +${Artisan.COMMISSION_GOLD_REWARD} gold · +${Artisan.COMMISSION_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--artisan-farewell" data-action="artisan-farewell">\u{1F44B} Bid Farewell</button>
      </div>
    </div>`;
}

// ── T253 Mountain Hermit ───────────────────────────────────────────────

function _hermitSection() {
  if (!Hermit.getActiveMountainHermit()) return '';
  const secs       = Hermit.getMountainHermitSecsLeft();
  const gold       = Math.floor(state.resources.gold ?? 0);
  const canTribute = gold >= Hermit.TRIBUTE_GOLD_COST;
  const urg = secs <= 15 ? ' hermit-timer--urgent' : '';
  return `
    <div class="hermit-section--active">
      <div class="hermit-header">
        <span class="hermit-title">\u{1F9D9} Mountain Hermit</span>
        <span class="hermit-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="hermit-desc">A wise hermit descends from the mountains bearing ancient wisdom and cryptic counsel.</div>
      <div class="hermit-actions">
        <button class="btn--hermit-counsel" data-action="hermit-counsel">
          \u{1F4FF} Seek Counsel — free
          <span class="hermit-cost">→ +${Hermit.COUNSEL_PRESTIGE_REWARD} prestige · +${Hermit.COUNSEL_MANA_RATE} mana/s (2 min)</span>
        </button>
        <button class="btn--hermit-tribute${canTribute ? '' : ' btn--disabled'}" data-action="hermit-tribute" ${canTribute ? '' : 'disabled'}>
          \u{1FA99} Offer Tribute — ${Hermit.TRIBUTE_GOLD_COST}\u{1F4B0}
          <span class="hermit-cost">→ +${Hermit.TRIBUTE_PRESTIGE_REWARD} prestige · +${Hermit.TRIBUTE_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--hermit-leave" data-action="hermit-leave">\u{1F3D4}️ Leave in Peace</button>
      </div>
    </div>`;
}

// ── T254 Imperial Jubilee ────────────────────────────────────────────

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
        <span class="jubilee-title">\u{1F389} Imperial Jubilee</span>
        <span class="jubilee-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="jubilee-desc">A milestone moment calls for celebration! Declare a jubilee to lift the spirits of your people.</div>
      <div class="jubilee-actions">
        <button class="btn--jubilee-parade${canParade ? '' : ' btn--disabled'}" data-action="jubilee-parade" ${canParade ? '' : 'disabled'}>
          \u{1F3BA} Grand Parade — ${Jubilee.PARADE_GOLD_COST}\u{1F4B0}
          <span class="jubilee-cost">→ +${Jubilee.PARADE_MORALE_REWARD} morale · +${Jubilee.PARADE_PRESTIGE_REWARD} prestige · rate bonuses (3 min)</span>
        </button>
        <button class="btn--jubilee-feast${canFeast ? '' : ' btn--disabled'}" data-action="jubilee-feast" ${canFeast ? '' : 'disabled'}>
          \u{1F356} Royal Feast — ${Jubilee.FEAST_FOOD_COST}\u{1F33E}
          <span class="jubilee-cost">→ +${Jubilee.FEAST_MORALE_REWARD} morale · +${Jubilee.FEAST_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--jubilee-ceremony" data-action="jubilee-ceremony">
          \u{1F54A}️ Simple Ceremony — free
          <span class="jubilee-cost">→ +${Jubilee.CEREMONY_MORALE_REWARD} morale · +${Jubilee.CEREMONY_PRESTIGE_REWARD} prestige</span>
        </button>
      </div>
    </div>`;
}

// ── T255 Exiled Prince ───────────────────────────────────────────────

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
        <span class="prince-title">\u{1F451} Exiled Prince</span>
        <span class="prince-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="prince-desc">A deposed prince from a distant land seeks refuge at your court, bearing secrets of statecraft.</div>
      <div class="prince-actions">
        <button class="btn--prince-asylum" data-action="prince-asylum">
          \u{1F3F0} Grant Asylum — free
          <span class="prince-cost">→ +${Prince.ASYLUM_MORALE_REWARD} morale · +${Prince.ASYLUM_PRESTIGE_REWARD} prestige · +${Prince.ASYLUM_GOLD_RATE} gold/s (${asyMin} min)</span>
        </button>
        <button class="btn--prince-advisor${canAdvisor ? '' : ' btn--disabled'}" data-action="prince-advisor" ${canAdvisor ? '' : 'disabled'}>
          \u{1F4DC} Hire as Advisor — ${Prince.ADVISOR_GOLD_COST}\u{1F4B0}
          <span class="prince-cost">→ +${Prince.ADVISOR_PRESTIGE_REWARD} prestige · +${Prince.ADVISOR_MORALE_REWARD} morale · +${Prince.ADVISOR_IRON_RATE} iron/s (${advMin} min)</span>
        </button>
        <button class="btn--prince-away" data-action="prince-away">\u{1F6AA} Turn Away</button>
      </div>
    </div>`;
}

// ── T256 Ancient Guardian ────────────────────────────────────────────

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
        <span class="guardian-title">\u{1F5FF} Ancient Guardian Awakens</span>
        <span class="guardian-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="guardian-desc">A colossal stone guardian stirs from millennial slumber at the empire's borders, demanding acknowledgement.</div>
      <div class="guardian-actions">
        <button class="btn--guardian-tribute${canTribute ? '' : ' btn--disabled'}" data-action="guardian-tribute" ${canTribute ? '' : 'disabled'}>
          \u{1F33E} Offer Tribute — ${Guardian.TRIBUTE_FOOD_COST}\u{1F33E}
          <span class="guardian-cost">→ +${Guardian.TRIBUTE_MORALE_REWARD} morale · +${Guardian.TRIBUTE_PRESTIGE_REWARD} prestige · +${Guardian.TRIBUTE_STONE_RATE} stone/s (2 min)</span>
        </button>
        <button class="btn--guardian-ritual${canRitual ? '' : ' btn--disabled'}" data-action="guardian-ritual" ${canRitual ? '' : 'disabled'}>
          \u{1F52E} Conduct Ritual — ${Guardian.RITUAL_MANA_COST}✨
          <span class="guardian-cost">→ +${Guardian.RITUAL_PRESTIGE_REWARD} prestige · +${Guardian.RITUAL_MANA_RATE} mana/s (3 min)</span>
        </button>
        <button class="btn--guardian-firm" data-action="guardian-firm">
          \u{1F6E1}️ Stand Firm — free
          <span class="guardian-cost">→ +${Guardian.STANDFIRM_MORALE_REWARD} morale · +${Guardian.STANDFIRM_PRESTIGE_REWARD} prestige</span>
        </button>
      </div>
    </div>`;
}

// ── T257 Desert Oasis ────────────────────────────────────────────────

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
        <span class="oasis-title">\u{1F334} Desert Oasis Discovery</span>
        <span class="oasis-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="oasis-desc">Scouts discovered a hidden desert oasis shimmering with water and life in the empire's territory.</div>
      <div class="oasis-actions">
        <button class="btn--oasis-trade${canTrade ? '' : ' btn--disabled'}" data-action="oasis-trade" ${canTrade ? '' : 'disabled'}>
          \u{1F3EA} Develop Trade Stop — ${Oasis.TRADE_GOLD_COST}\u{1F4B0}
          <span class="oasis-cost">→ +${Oasis.TRADE_GOLD_RATE} gold/s (3 min) · +${Oasis.TRADE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--oasis-water" data-action="oasis-water">
          \u{1F4A7} Draw Oasis Water — free
          <span class="oasis-cost">→ +${Oasis.WATER_FOOD_REWARD} food · +${Oasis.WATER_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--oasis-offering${canOffering ? '' : ' btn--disabled'}" data-action="oasis-offering" ${canOffering ? '' : 'disabled'}>
          \u{1F64F} Sacred Offering — ${Oasis.OFFERING_MANA_COST}✨
          <span class="oasis-cost">→ +${Oasis.OFFERING_PRESTIGE_REWARD} prestige · +${Oasis.OFFERING_FOOD_RATE} food/s (2 min)</span>
        </button>
      </div>
    </div>`;
}

// ── T258 Foreign Dignitary ───────────────────────────────────────────

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
        <span class="dignitary-title">\u{1F935} Foreign Dignitary Visit</span>
        <span class="dignitary-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="dignitary-desc">A distinguished foreign dignitary arrives with entourage to assess the empire's standing and power.</div>
      <div class="dignitary-actions">
        <button class="btn--dignitary-reception${canReception ? '' : ' btn--disabled'}" data-action="dignitary-reception" ${canReception ? '' : 'disabled'}>
          \u{1F942} Grand Reception — ${Dignitary.RECEPTION_GOLD_COST}\u{1F4B0}
          <span class="dignitary-cost">→ +${Dignitary.RECEPTION_PRESTIGE_REWARD} prestige · +${Dignitary.RECEPTION_MORALE_REWARD} morale · +${Dignitary.RECEPTION_GOLD_RATE} gold/s (4 min)</span>
        </button>
        <button class="btn--dignitary-welcome" data-action="dignitary-welcome">
          \u{1F91D} Modest Welcome — free
          <span class="dignitary-cost">→ +${Dignitary.WELCOME_PRESTIGE_REWARD} prestige · +${Dignitary.WELCOME_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--dignitary-gifts${canGifts ? '' : ' btn--disabled'}" data-action="dignitary-gifts" ${canGifts ? '' : 'disabled'}>
          \u{1F381} Present Gifts — ${Dignitary.GIFT_FOOD_COST}\u{1F33E} + ${Dignitary.GIFT_IRON_COST}⚙️
          <span class="dignitary-cost">→ +${Dignitary.GIFT_PRESTIGE_REWARD} prestige · +${Dignitary.GIFT_MORALE_REWARD} morale</span>
        </button>
      </div>
    </div>`;
}

// ── T259 Lost Merchant Caravan ───────────────────────────────────────────

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
        <span class="caravan-title">\u{1F42B} Lost Merchant Caravan</span>
        <span class="caravan-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="caravan-desc">A lost merchant caravan is spotted at the empire's edge, exhausted and low on supplies.</div>
      <div class="caravan-actions">
        <button class="btn--caravan-shelter${canShelter ? '' : ' btn--disabled'}" data-action="caravan-shelter" ${canShelter ? '' : 'disabled'}>
          \u{1F3D5}️ Offer Shelter — ${Caravan.SHELTER_FOOD_COST}\u{1F33E}
          <span class="caravan-cost">→ +${Caravan.SHELTER_MORALE_REWARD} morale · +${Caravan.SHELTER_PRESTIGE_REWARD} prestige · +${Caravan.SHELTER_GOLD_RATE} gold/s (3 min)</span>
        </button>
        <button class="btn--caravan-hire${canHire ? '' : ' btn--disabled'}" data-action="caravan-hire" ${canHire ? '' : 'disabled'}>
          \u{1F5FA}️ Hire as Guides — ${Caravan.HIRE_GOLD_COST}\u{1F4B0}
          <span class="caravan-cost">→ +${Caravan.HIRE_IRON_REWARD} iron · +${Caravan.HIRE_PRESTIGE_REWARD} prestige · +${Caravan.HIRE_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--caravan-away" data-action="caravan-away">\u{1F6AA} Turn Away</button>
      </div>
    </div>`;
}

// ── T260 Nomadic Scholar ───────────────────────────────────────────────

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
        <span class="scholar-title">\u{1F4DA} Nomadic Scholar</span>
        <span class="scholar-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="scholar-desc">A nomadic scholar carrying ancient manuscripts arrives at the imperial court seeking a patron.</div>
      <div class="scholar-actions">
        <button class="btn--scholar-commission${canCommission ? '' : ' btn--disabled'}" data-action="scholar-commission" ${canCommission ? '' : 'disabled'}>
          \u{1F52C} Commission Studies — ${Scholar.COMMISSION_MANA_COST}✨
          <span class="scholar-cost">→ +${Scholar.COMMISSION_PRESTIGE} prestige · +${Scholar.COMMISSION_IRON_RATE} iron/s (2 min)</span>
        </button>
        <button class="btn--scholar-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="scholar-purchase" ${canPurchase ? '' : 'disabled'}>
          \u{1F4DC} Purchase Manuscripts — ${Scholar.PURCHASE_GOLD_COST}\u{1F4B0}
          <span class="scholar-cost">→ +${Scholar.PURCHASE_PRESTIGE} prestige · +${Scholar.PURCHASE_MANA_RATE} mana/s (3 min)</span>
        </button>
        <button class="btn--scholar-dismiss" data-action="scholar-dismiss">
          \u{1F44B} Thank and Dismiss — free
          <span class="scholar-cost">→ +${Scholar.DISMISS_MORALE_REWARD} morale · +${Scholar.DISMISS_PRESTIGE_REWARD} prestige</span>
        </button>
      </div>
    </div>`;
}

// ── T261 Royal Feast ───────────────────────────────────────────────────

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
        <span class="feast-title">\u{1F356} Royal Feast</span>
        <span class="feast-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="feast-desc">The time has come for a grand celebration! Declare a feast to raise the spirits of your people.</div>
      <div class="feast-actions">
        <button class="btn--feast-grand${canBanquet ? '' : ' btn--disabled'}" data-action="feast-grand" ${canBanquet ? '' : 'disabled'}>
          \u{1F38A} Grand Banquet — ${Feast.BANQUET_FOOD_COST}\u{1F33E} + ${Feast.BANQUET_GOLD_COST}\u{1F4B0}
          <span class="feast-cost">→ +${Feast.BANQUET_MORALE_REWARD} morale · +${Feast.BANQUET_PRESTIGE_REWARD} prestige · +${Feast.BANQUET_FOOD_RATE} food/s (3 min)</span>
        </button>
        <button class="btn--feast-modest${canModest ? '' : ' btn--disabled'}" data-action="feast-modest" ${canModest ? '' : 'disabled'}>
          \u{1F37D}️ Modest Celebration — ${Feast.MODEST_FOOD_COST}\u{1F33E}
          <span class="feast-cost">→ +${Feast.MODEST_MORALE_REWARD} morale · +${Feast.MODEST_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--feast-holiday" data-action="feast-holiday">
          \u{1F388} Declare Holiday — free
          <span class="feast-cost">→ +${Feast.HOLIDAY_MORALE_REWARD} morale · +${Feast.HOLIDAY_PRESTIGE_REWARD} prestige</span>
        </button>
      </div>
    </div>`;
}

// ── T262 Wandering Blacksmith ────────────────────────────────────────────

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
          \u{1F6E0}️ Forge Iron Tools — ${Blacksmith.TOOLS_IRON_COST}⚙️ + ${Blacksmith.TOOLS_GOLD_COST}\u{1F4B0}
          <span class="blacksmith-cost">→ +${Blacksmith.TOOLS_IRON_REWARD} iron · +${Blacksmith.TOOLS_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--blacksmith-lodging${canLodging ? '' : ' btn--disabled'}" data-action="blacksmith-lodging" ${canLodging ? '' : 'disabled'}>
          \u{1F3E0} Offer Lodging — ${Blacksmith.LODGING_FOOD_COST}\u{1F33E}
          <span class="blacksmith-cost">→ +${Blacksmith.LODGING_MORALE_REWARD} morale · +${Blacksmith.LODGING_PRESTIGE_REWARD} prestige</span>
        </button>
      </div>
    </div>`;
}

// ── T263 Traveling Astrologer ────────────────────────────────────────────

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
        <span class="astrologer-title">\u{1F52D} Traveling Astrologer</span>
        <span class="astrologer-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="astrologer-desc">A renowned astrologer arrives with celestial charts, offering cosmic guidance and star wisdom.</div>
      <div class="astrologer-actions">
        <button class="btn--astrologer-chart${canChart ? '' : ' btn--disabled'}" data-action="astrologer-chart" ${canChart ? '' : 'disabled'}>
          \u{1F5FA}️ Commission Star Chart — ${Astrologer.CHART_GOLD_COST}\u{1F4B0} + ${Astrologer.CHART_MANA_COST}✨
          <span class="astrologer-cost">→ +${Astrologer.CHART_MANA_RATE} mana/s (2.5 min) · +${Astrologer.CHART_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--astrologer-wisdom${canWisdom ? '' : ' btn--disabled'}" data-action="astrologer-wisdom" ${canWisdom ? '' : 'disabled'}>
          ⭐ Seek Celestial Wisdom — ${Astrologer.WISDOM_MANA_COST}✨
          <span class="astrologer-cost">→ +${Astrologer.WISDOM_MORALE_REWARD} morale · +${Astrologer.WISDOM_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--astrologer-refreshments${canRefresh ? '' : ' btn--disabled'}" data-action="astrologer-refreshments" ${canRefresh ? '' : 'disabled'}>
          \u{1F375} Offer Refreshments — ${Astrologer.REFRESH_FOOD_COST}\u{1F33E}
          <span class="astrologer-cost">→ +${Astrologer.REFRESH_MORALE_REWARD} morale · +${Astrologer.REFRESH_PRESTIGE_REWARD} prestige</span>
        </button>
      </div>
    </div>`;
}

// ── T264 Merchant Prince ───────────────────────────────────────────────

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
        <span class="merchant-icon">\u{1F4B0}</span>
        <span class="merchant-title">Merchant Prince</span>
        <span class="merchant-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="merchant-desc">A wealthy merchant prince passes through seeking profitable arrangements with the empire.</div>
      <div class="merchant-actions">
        <button class="btn--merchant-deal${canDeal ? '' : ' btn--disabled'}" data-action="merchant-deal" ${canDeal ? '' : 'disabled'}>
          \u{1F4B0} Arrange Trade Deal — ${Merchant.DEAL_GOLD_COST}\u{1F4B0}
          <span class="merchant-cost">→ +${Merchant.DEAL_GOLD_RATE} gold/s (2.5 min) · +${Merchant.DEAL_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--merchant-exchange${canExchange ? '' : ' btn--disabled'}" data-action="merchant-exchange" ${canExchange ? '' : 'disabled'}>
          \u{1F91D} Exchange Valuable Goods — ${Merchant.EXCHANGE_FOOD_COST}\u{1F33E} + ${Merchant.EXCHANGE_WOOD_COST}\u{1FAB5}
          <span class="merchant-cost">→ +${Merchant.EXCHANGE_GOLD_REWARD} gold · +${Merchant.EXCHANGE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--merchant-reception${canReception ? '' : ' btn--disabled'}" data-action="merchant-reception" ${canReception ? '' : 'disabled'}>
          \u{1F377} Host Lavish Reception — ${Merchant.RECEPTION_FOOD_COST}\u{1F33E}
          <span class="merchant-cost">→ +${Merchant.RECEPTION_MORALE_REWARD} morale · +${Merchant.RECEPTION_PRESTIGE_REWARD} prestige</span>
        </button>
      </div>
    </div>`;
}

// ── T266 Wandering Sage ──────────────────────────────────────────────────

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
        <span class="sage-title">\u{1F9D1}‍\u{1F3EB} Wandering Sage</span>
        <span class="sage-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="sage-desc">A sage renowned for ancient knowledge has arrived at the imperial court. Their wisdom spans centuries.</div>
      <div class="sage-actions">
        <button class="btn--sage-edict${canEdict ? '' : ' btn--disabled'}" data-action="sage-edict" ${canEdict ? '' : 'disabled'}>
          \u{1F4DC} Commission Imperial Edict — ${Sage.EDICT_GOLD_COST}\u{1F4B0} + ${Sage.EDICT_MANA_COST}✨
          <span class="sage-cost">→ +${Sage.EDICT_GOLD_RATE} gold/s · +${Sage.EDICT_MANA_RATE} mana/s (3 min) · +${Sage.EDICT_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--sage-study${canStudy ? '' : ' btn--disabled'}" data-action="sage-study" ${canStudy ? '' : 'disabled'}>
          \u{1F4D6} Study Ancient Texts — ${Sage.STUDY_MANA_COST}✨
          <span class="sage-cost">→ +${Sage.STUDY_MANA_RATE} mana/s (2.5 min) · +${Sage.STUDY_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--sage-host${canHost ? '' : ' btn--disabled'}" data-action="sage-host" ${canHost ? '' : 'disabled'}>
          \u{1F375} Offer Humble Hospitality — ${Sage.HOST_FOOD_COST}\u{1F33E}
          <span class="sage-cost">→ +${Sage.HOST_MORALE_REWARD} morale · +${Sage.HOST_PRESTIGE_REWARD} prestige</span>
        </button>
      </div>
    </div>`;
}

// ── T267 Master Forester ─────────────────────────────────────────────────

function _masterForesterSection() {
  if (!Forester.getActiveMasterForester()) return '';
  const secs          = Forester.getMasterForesterSecsLeft();
  const gold          = Math.floor(state.resources.gold ?? 0);
  const food          = Math.floor(state.resources.food ?? 0);
  const canCommission = gold >= Forester.COMMISSION_GOLD_COST;
  const canLearn      = food >= Forester.LEARN_FOOD_COST;
  const urg = secs <= 15 ? ' forester-timer--urgent' : '';
  return `
    <div class="forester-section--active">
      <div class="forester-header">
        <span class="forester-title">\u{1FAB5} Master Forester</span>
        <span class="forester-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="forester-desc">A master forester renowned for sustainable woodland management arrives seeking imperial patronage. Their expertise could unlock the empire's timber potential.</div>
      <div class="forester-actions">
        <button class="btn--forester-commission${canCommission ? '' : ' btn--disabled'}" data-action="forester-commission" ${canCommission ? '' : 'disabled'}>
          \u{1FAB5} Commission Timber Works — ${Forester.COMMISSION_GOLD_COST}\u{1F4B0}
          <span class="forester-cost">→ +${Forester.COMMISSION_WOOD_RATE} wood/s (2.5 min) · +${Forester.COMMISSION_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--forester-learn${canLearn ? '' : ' btn--disabled'}" data-action="forester-learn" ${canLearn ? '' : 'disabled'}>
          \u{1F331} Learn Forest Techniques — ${Forester.LEARN_FOOD_COST}\u{1F33E}
          <span class="forester-cost">→ +${Forester.LEARN_WOOD_RATE} wood/s (2 min) · +${Forester.LEARN_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--forester-lodge" data-action="forester-lodge">
          \u{1F91D} Offer Seasonal Lodging — free
          <span class="forester-cost">→ +${Forester.LODGE_MORALE_REWARD} morale · +${Forester.LODGE_PRESTIGE_REWARD} prestige</span>
        </button>
      </div>
    </div>`;
}

// ── T268 Forest Spirit ───────────────────────────────────────────────────

function _forestSpiritSection() {
  if (!Spirit.getActiveForestSpirit()) return '';
  const secs       = Spirit.getForestSpiritSecsLeft();
  const food       = Math.floor(state.resources.food ?? 0);
  const mana       = Math.floor(state.resources.mana ?? 0);
  const canPact    = food >= Spirit.PACT_FOOD_COST && mana >= Spirit.PACT_MANA_COST;
  const canWisdom  = mana >= Spirit.WISDOM_MANA_COST;
  const canTribute = food >= Spirit.TRIBUTE_FOOD_COST;
  const urg = secs <= 15 ? ' spirit-timer--urgent' : '';
  return `
    <div class="spirit-section--active">
      <div class="spirit-header">
        <span class="spirit-title">\u{1F333} Enchanted Forest Spirit</span>
        <span class="spirit-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="spirit-desc">A luminous forest spirit has emerged from the ancient woods bordering the empire! Its ethereal glow illuminates the forest edge.</div>
      <div class="spirit-actions">
        <button class="btn--spirit-pact${canPact ? '' : ' btn--disabled'}" data-action="spirit-pact" ${canPact ? '' : 'disabled'}>
          \u{1F33F} Forge Forest Pact — ${Spirit.PACT_FOOD_COST}\u{1F33E} + ${Spirit.PACT_MANA_COST}✨
          <span class="spirit-cost">→ +${Spirit.PACT_FOOD_RATE} food/s (3 min) · +${Spirit.PACT_PRESTIGE_REWARD} prestige · +${Spirit.PACT_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--spirit-wisdom${canWisdom ? '' : ' btn--disabled'}" data-action="spirit-wisdom" ${canWisdom ? '' : 'disabled'}>
          \u{1F319} Request Ancient Wisdom — ${Spirit.WISDOM_MANA_COST}✨
          <span class="spirit-cost">→ +${Spirit.WISDOM_MANA_RATE} mana/s (2 min) · +${Spirit.WISDOM_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--spirit-tribute${canTribute ? '' : ' btn--disabled'}" data-action="spirit-tribute" ${canTribute ? '' : 'disabled'}>
          \u{1F338} Offer Nature's Tribute — ${Spirit.TRIBUTE_FOOD_COST}\u{1F33E}
          <span class="spirit-cost">→ +${Spirit.TRIBUTE_MORALE_REWARD} morale · +${Spirit.TRIBUTE_PRESTIGE_REWARD} prestige</span>
        </button>
      </div>
    </div>`;
}

// ── T269 Wandering Alchemist ─────────────────────────────────────────────────

function _wanderingAlchemistSection() {
  if (!Alchemist.getActiveWanderingAlchemist()) return '';
  const secs         = Alchemist.getAlchemistSecsLeft();
  const iron         = Math.floor(state.resources.iron  ?? 0);
  const stone        = Math.floor(state.resources.stone ?? 0);
  const mana         = Math.floor(state.resources.mana  ?? 0);
  const food         = Math.floor(state.resources.food  ?? 0);
  const canTransmute = iron >= Alchemist.TRANSMUTE_IRON_COST && stone >= Alchemist.TRANSMUTE_STONE_COST;
  const canArts      = mana >= Alchemist.ARTS_MANA_COST;
  const canLab       = food >= Alchemist.LAB_FOOD_COST;
  const urg = secs <= 15 ? ' alchemist-timer--urgent' : '';
  return `
    <div class="alchemist-section--active">
      <div class="alchemist-header">
        <span class="alchemist-title">⚗️ Wandering Alchemist</span>
        <span class="alchemist-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="alchemist-desc">A wandering alchemist renowned for transmutation and arcane chemistry has arrived at the imperial gates. Their secrets could unlock great wealth.</div>
      <div class="alchemist-actions">
        <button class="btn--alchemist-transmute${canTransmute ? '' : ' btn--disabled'}" data-action="alchemist-transmute" ${canTransmute ? '' : 'disabled'}>
          ⚗️ Commission Transmutation — ${Alchemist.TRANSMUTE_IRON_COST}⚙️ + ${Alchemist.TRANSMUTE_STONE_COST}\u{1FAA8}
          <span class="alchemist-cost">→ +${Alchemist.TRANSMUTE_GOLD_REWARD} gold · +${Alchemist.TRANSMUTE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--alchemist-arts${canArts ? '' : ' btn--disabled'}" data-action="alchemist-arts" ${canArts ? '' : 'disabled'}>
          🔮 Learn Alchemical Arts — ${Alchemist.ARTS_MANA_COST}✨
          <span class="alchemist-cost">→ +${Alchemist.ARTS_MANA_RATE} mana/s (2.5 min) · +${Alchemist.ARTS_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--alchemist-lab${canLab ? '' : ' btn--disabled'}" data-action="alchemist-lab" ${canLab ? '' : 'disabled'}>
          🏠 Offer Laboratory Space — ${Alchemist.LAB_FOOD_COST}\u{1F33E}
          <span class="alchemist-cost">→ +${Alchemist.LAB_MORALE_REWARD} morale · +${Alchemist.LAB_PRESTIGE_REWARD} prestige</span>
        </button>
      </div>
    </div>`;
}

// ── T270 Seafaring Explorer ──────────────────────────────────────────────────

function _seafaringExplorerSection() {
  if (!Explorer.getActiveSeafaringExplorer()) return '';
  const secs        = Explorer.getExplorerSecsLeft();
  const gold        = Math.floor(state.resources.gold ?? 0);
  const wood        = Math.floor(state.resources.wood ?? 0);
  const food        = Math.floor(state.resources.food ?? 0);
  const canFund     = gold >= Explorer.FUND_GOLD_COST;
  const canCharts   = wood >= Explorer.CHARTS_WOOD_COST;
  const canProvide  = food >= Explorer.PROVISIONS_FOOD_COST;
  const urg = secs <= 15 ? ' explorer-timer--urgent' : '';
  return `
    <div class="explorer-section--active">
      <div class="explorer-header">
        <span class="explorer-title">⛵ Seafaring Explorer</span>
        <span class="explorer-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="explorer-desc">A legendary seafaring explorer seeks imperial sponsorship for their next great voyage. They carry charts of uncharted waters and tales of distant riches.</div>
      <div class="explorer-actions">
        <button class="btn--explorer-fund${canFund ? '' : ' btn--disabled'}" data-action="explorer-fund" ${canFund ? '' : 'disabled'}>
          ⛵ Fund Expedition — ${Explorer.FUND_GOLD_COST}\u{1F4B0}
          <span class="explorer-cost">→ +${Explorer.FUND_GOLD_RATE} gold/s (2.5 min) · +${Explorer.FUND_PRESTIGE_REWARD} prestige · +${Explorer.FUND_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--explorer-charts${canCharts ? '' : ' btn--disabled'}" data-action="explorer-charts" ${canCharts ? '' : 'disabled'}>
          🗺️ Exchange Navigation Charts — ${Explorer.CHARTS_WOOD_COST}\u{1FAB5}
          <span class="explorer-cost">→ +${Explorer.CHARTS_WOOD_RATE} wood/s (2 min) · +${Explorer.CHARTS_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--explorer-provisions${canProvide ? '' : ' btn--disabled'}" data-action="explorer-provisions" ${canProvide ? '' : 'disabled'}>
          🍖 Provide Provisions — ${Explorer.PROVISIONS_FOOD_COST}\u{1F33E}
          <span class="explorer-cost">→ +${Explorer.PROVISIONS_MORALE_REWARD} morale · +${Explorer.PROVISIONS_PRESTIGE_REWARD} prestige</span>
        </button>
      </div>
    </div>`;
}

// ── T271 Traveling Monk ──────────────────────────────────────────────

function _travelingMonkSection() {
  if (!Monk.getActiveTravelingMonk()) return '';
  const secs         = Monk.getMonkSecsLeft();
  const gold         = Math.floor(state.resources.gold ?? 0);
  const canDonate    = gold >= Monk.DONATION_GOLD_COST;
  const urg = secs <= 15 ? ' monk-timer--urgent' : '';
  return `
    <div class="monk-section--active">
      <div class="monk-header">
        <span class="monk-title">🙏 Traveling Monk</span>
        <span class="monk-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="monk-desc">A wandering monk has arrived at the imperial gates seeking shelter and offering spiritual counsel to the ruler and their court.</div>
      <div class="monk-actions">
        <button class="btn--monk-guidance" data-action="monk-guidance">
          🙏 Seek Spiritual Guidance — free
          <span class="monk-cost">→ +${Monk.GUIDANCE_MANA_RATE} mana/s (2 min) · +${Monk.GUIDANCE_PRESTIGE_REWARD} prestige · +${Monk.GUIDANCE_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--monk-donate${canDonate ? '' : ' btn--disabled'}" data-action="monk-donate" ${canDonate ? '' : 'disabled'}>
          💰 Make Generous Donation — ${Monk.DONATION_GOLD_COST}\u{1F4B0}
          <span class="monk-cost">→ +${Monk.DONATION_PRESTIGE_REWARD} prestige · +${Monk.DONATION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--monk-away" data-action="monk-away">
          👋 Send on Their Way
          <span class="monk-cost">→ Monk continues their pilgrimage</span>
        </button>
      </div>
    </div>`;
}

// ── T272 Imperial Cartographer ──────────────────────────────────────

function _imperialCartographerSection() {
  if (!ImpCarto.getActiveImperialCartographer()) return '';
  const secs         = ImpCarto.getCartographerSecsLeft();
  const gold         = Math.floor(state.resources.gold ?? 0);
  const mana         = Math.floor(state.resources.mana ?? 0);
  const canSurvey    = gold >= ImpCarto.SURVEY_GOLD_COST;
  const canExchange  = mana >= ImpCarto.EXCHANGE_MANA_COST;
  const urg = secs <= 15 ? ' carto-timer--urgent' : '';
  return `
    <div class="carto-section--active">
      <div class="carto-header">
        <span class="carto-title">🗺️ Imperial Cartographer</span>
        <span class="carto-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="carto-desc">A renowned imperial cartographer arrives bearing precise survey instruments and maps of surrounding territories. Their geographic knowledge could prove invaluable.</div>
      <div class="carto-actions">
        <button class="btn--carto-survey${canSurvey ? '' : ' btn--disabled'}" data-action="carto-survey" ${canSurvey ? '' : 'disabled'}>
          🗺️ Commission Survey — ${ImpCarto.SURVEY_GOLD_COST}\u{1F4B0}
          <span class="carto-cost">→ +${ImpCarto.SURVEY_STONE_RATE} stone/s (2.5 min) · +${ImpCarto.SURVEY_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--carto-exchange${canExchange ? '' : ' btn--disabled'}" data-action="carto-exchange" ${canExchange ? '' : 'disabled'}>
          📜 Exchange Techniques — ${ImpCarto.EXCHANGE_MANA_COST}✨
          <span class="carto-cost">→ +${ImpCarto.EXCHANGE_PRESTIGE_REWARD} prestige · +${ImpCarto.EXCHANGE_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--carto-farewell" data-action="carto-farewell">
          👋 Bid Farewell
          <span class="carto-cost">→ Cartographer sets off to chart new lands</span>
        </button>
      </div>
    </div>`;
}

// ── T273 Wandering Oracle ────────────────────────────────────────────

function _wanderingOracleSection() {
  if (!Oracle.getActiveWanderingOracle()) return '';
  const secs        = Oracle.getOracleSecsLeft();
  const mana        = Math.floor(state.resources.mana ?? 0);
  const gold        = Math.floor(state.resources.gold ?? 0);
  const canConsult  = mana >= Oracle.CONSULT_MANA_COST;
  const canProphecy = gold >= Oracle.PROPHECY_GOLD_COST;
  const urg = secs <= 15 ? ' oracle-timer--urgent' : '';
  return `
    <div class="oracle-section--active">
      <div class="oracle-header">
        <span class="oracle-title">🔮 Wandering Oracle</span>
        <span class="oracle-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="oracle-desc">A mysterious oracle cloaked in starlight has appeared at the imperial gates, offering visions and prophecies from beyond the veil.</div>
      <div class="oracle-actions">
        <button class="btn--oracle-consult${canConsult ? '' : ' btn--disabled'}" data-action="oracle-consult" ${canConsult ? '' : 'disabled'}>
          🔮 Consult Vision — ${Oracle.CONSULT_MANA_COST}✨
          <span class="oracle-cost">→ +${Oracle.CONSULT_MANA_RATE} mana/s (2.5 min) · +${Oracle.CONSULT_PRESTIGE_REWARD} prestige · +${Oracle.CONSULT_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--oracle-prophecy${canProphecy ? '' : ' btn--disabled'}" data-action="oracle-prophecy" ${canProphecy ? '' : 'disabled'}>
          📜 Purchase Prophecy — ${Oracle.PROPHECY_GOLD_COST}💰
          <span class="oracle-cost">→ +${Oracle.PROPHECY_PRESTIGE_REWARD} prestige · +${Oracle.PROPHECY_GOLD_RATE} gold/s (2 min)</span>
        </button>
        <button class="btn--oracle-away" data-action="oracle-away">
          👋 Send Away
          <span class="oracle-cost">→ Oracle dissolves into the morning mist</span>
        </button>
      </div>
    </div>`;
}

// ── T274 Royal Emissary ──────────────────────────────────────────────

function _royalEmissarySection() {
  if (!Emissary.getActiveRoyalEmissary()) return '';
  const secs         = Emissary.getEmissarySecsLeft();
  const gold         = Math.floor(state.resources.gold ?? 0);
  const canExchange  = gold >= Emissary.EXCHANGE_GOLD_COST;
  const urg = secs <= 15 ? ' emissary-timer--urgent' : '';
  return `
    <div class="emissary-section--active">
      <div class="emissary-header">
        <span class="emissary-title">🤝 Royal Emissary</span>
        <span class="emissary-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="emissary-desc">A royal emissary bearing the seal of a distant realm arrives with letters of goodwill and diplomatic overtures for your empire.</div>
      <div class="emissary-actions">
        <button class="btn--emissary-receive" data-action="emissary-receive">
          🤝 Receive Delegation — free
          <span class="emissary-cost">→ +${Emissary.RECEIVE_PRESTIGE_REWARD} prestige · +${Emissary.RECEIVE_MORALE_REWARD} morale · +${Emissary.RECEIVE_GOLD_RATE} gold/s (2 min)</span>
        </button>
        <button class="btn--emissary-exchange${canExchange ? '' : ' btn--disabled'}" data-action="emissary-exchange" ${canExchange ? '' : 'disabled'}>
          📋 Exchange Treaties — ${Emissary.EXCHANGE_GOLD_COST}💰
          <span class="emissary-cost">→ +${Emissary.EXCHANGE_PRESTIGE_REWARD} prestige · +${Emissary.EXCHANGE_MORALE_REWARD} morale · +${Emissary.EXCHANGE_IRON_RATE} iron/s (2.5 min)</span>
        </button>
        <button class="btn--emissary-decline" data-action="emissary-decline">
          👋 Politely Decline
          <span class="emissary-cost">→ Emissary departs with diplomatic grace</span>
        </button>
      </div>
    </div>`;
}

// ── T275 Wandering Tinker ────────────────────────────────────────────

function _wanderingTinkerSection() {
  if (!Tinker.getActiveWanderingTinker()) return '';
  const secs           = Tinker.getTinkerSecsLeft();
  const iron           = Math.floor(state.resources.iron ?? 0);
  const wood           = Math.floor(state.resources.wood ?? 0);
  const gold           = Math.floor(state.resources.gold ?? 0);
  const canCommission  = iron >= Tinker.COMMISSION_IRON_COST && wood >= Tinker.COMMISSION_WOOD_COST;
  const canPurchase    = gold >= Tinker.PURCHASE_GOLD_COST;
  const urg = secs <= 15 ? ' tinker-timer--urgent' : '';
  return `
    <div class="tinker-section--active">
      <div class="tinker-header">
        <span class="tinker-title">🔧 Wandering Tinker</span>
        <span class="tinker-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="tinker-desc">A wandering tinker renowned for metalwork and craftsmanship arrives with a cart full of tools and spare parts, offering their expert services.</div>
      <div class="tinker-actions">
        <button class="btn--tinker-commission${canCommission ? '' : ' btn--disabled'}" data-action="tinker-commission" ${canCommission ? '' : 'disabled'}>
          🔧 Commission Repairs — ${Tinker.COMMISSION_IRON_COST}⚙️ + ${Tinker.COMMISSION_WOOD_COST}🪵
          <span class="tinker-cost">→ +${Tinker.COMMISSION_IRON_RATE} iron/s (2.5 min) · +${Tinker.COMMISSION_PRESTIGE_REWARD} prestige · +${Tinker.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--tinker-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="tinker-purchase" ${canPurchase ? '' : 'disabled'}>
          🛠️ Purchase Crafted Tools — ${Tinker.PURCHASE_GOLD_COST}💰
          <span class="tinker-cost">→ +${Tinker.PURCHASE_IRON_REWARD} iron · +${Tinker.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--tinker-away" data-action="tinker-away">
          👋 Send Away
          <span class="tinker-cost">→ Tinker moves on to the next settlement</span>
        </button>
      </div>
    </div>`;
}

// ── T276 Wandering Physician ──────────────────────────────────────────

function _wanderingPhysicianSection() {
  if (!Physician.getActiveWanderingPhysician()) return '';
  const secs        = Physician.getPhysicianSecsLeft();
  const food        = Math.floor(state.resources.food ?? 0);
  const mana        = Math.floor(state.resources.mana ?? 0);
  const canTreat    = food >= Physician.TREAT_FOOD_COST;
  const canLearn    = mana >= Physician.LEARN_MANA_COST;
  const urg = secs <= 15 ? ' physician-timer--urgent' : '';
  return `
    <div class="physician-section--active">
      <div class="physician-header">
        <span class="physician-title">💊 Wandering Physician</span>
        <span class="physician-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="physician-desc">A wandering physician carrying medicinal herbs and ancient healing texts arrives at your capital, offering their medical expertise to your people.</div>
      <div class="physician-actions">
        <button class="btn--physician-treat${canTreat ? '' : ' btn--disabled'}" data-action="physician-treat" ${canTreat ? '' : 'disabled'}>
          💊 Commission Treatments — ${Physician.TREAT_FOOD_COST}🌾
          <span class="physician-cost">→ +${Physician.TREAT_MORALE_REWARD} morale · +${Physician.TREAT_PRESTIGE_REWARD} prestige · +${Physician.TREAT_FOOD_RATE} food/s (2.5 min)</span>
        </button>
        <button class="btn--physician-learn${canLearn ? '' : ' btn--disabled'}" data-action="physician-learn" ${canLearn ? '' : 'disabled'}>
          📖 Learn Medical Lore — ${Physician.LEARN_MANA_COST}✨
          <span class="physician-cost">→ +${Physician.LEARN_MORALE_REWARD} morale · +${Physician.LEARN_PRESTIGE_REWARD} prestige · +${Physician.LEARN_MANA_RATE} mana/s (2 min)</span>
        </button>
        <button class="btn--physician-away" data-action="physician-away">
          👋 Send Away
          <span class="physician-cost">→ Physician departs to help other settlements</span>
        </button>
      </div>
    </div>`;
}

// ── T277 Wandering Cartomancer ──────────────────────────────────────────

function _wanderingCartomancerSection() {
  if (!Cartomancer.getActiveWanderingCartomancer()) return '';
  const secs       = Cartomancer.getCartomancerSecsLeft();
  const mana       = Math.floor(state.resources.mana ?? 0);
  const gold       = Math.floor(state.resources.gold ?? 0);
  const canMap     = mana >= Cartomancer.MAP_MANA_COST;
  const canExchange = gold >= Cartomancer.EXCHANGE_GOLD_COST;
  const urg = secs <= 15 ? ' carto2-timer--urgent' : '';
  return `
    <div class="carto2-section--active">
      <div class="carto2-header">
        <span class="carto2-title">🗺️ Wandering Cartomancer</span>
        <span class="carto2-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="carto2-desc">A skilled cartomancer bearing celestial charts and star-maps arrives, their astronomical knowledge famed across the known world.</div>
      <div class="carto2-actions">
        <button class="btn--carto2-map${canMap ? '' : ' btn--disabled'}" data-action="carto2-map" ${canMap ? '' : 'disabled'}>
          🗺️ Commission Celestial Map — ${Cartomancer.MAP_MANA_COST}✨
          <span class="carto2-cost">→ +${Cartomancer.MAP_MANA_RATE} mana/s (2.5 min) · +${Cartomancer.MAP_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--carto2-exchange${canExchange ? '' : ' btn--disabled'}" data-action="carto2-exchange" ${canExchange ? '' : 'disabled'}>
          ⭐ Exchange Stellar Knowledge — ${Cartomancer.EXCHANGE_GOLD_COST}💰
          <span class="carto2-cost">→ +${Cartomancer.EXCHANGE_GOLD_RATE} gold/s (2 min) · +${Cartomancer.EXCHANGE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--carto2-away" data-action="carto2-away">
          👋 Send Away
          <span class="carto2-cost">→ Cartomancer departs for the next horizon</span>
        </button>
      </div>
    </div>`;
}

// ── T278 Village Elder Visit ────────────────────────────────────────────

function _villageElderVisitSection() {
  if (!Elder.getActiveVillageElderVisit()) return '';
  const secs         = Elder.getElderSecsLeft();
  const food         = Math.floor(state.resources.food ?? 0);
  const canHospitality = food >= Elder.HOSPITALITY_FOOD_COST;
  const urg = secs <= 15 ? ' elder-timer--urgent' : '';
  return `
    <div class="elder-section--active">
      <div class="elder-header">
        <span class="elder-title">🧙 Village Elder Visit</span>
        <span class="elder-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="elder-desc">A venerable village elder bearing accumulated tribal wisdom arrives seeking an audience with your empire's ruler.</div>
      <div class="elder-actions">
        <button class="btn--elder-wisdom" data-action="elder-wisdom">
          🧙 Seek Ancient Wisdom — Free
          <span class="elder-cost">→ +${Elder.WISDOM_MORALE_REWARD} morale · +${Elder.WISDOM_PRESTIGE_REWARD} prestige · +${Elder.WISDOM_MANA_RATE} mana/s (2 min)</span>
        </button>
        <button class="btn--elder-hospitality${canHospitality ? '' : ' btn--disabled'}" data-action="elder-hospitality" ${canHospitality ? '' : 'disabled'}>
          🍖 Offer Generous Hospitality — ${Elder.HOSPITALITY_FOOD_COST}🌾
          <span class="elder-cost">→ +${Elder.HOSPITALITY_MORALE_REWARD} morale · +${Elder.HOSPITALITY_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--elder-away" data-action="elder-away">
          👋 Send Them Off
          <span class="elder-cost">→ Elder is politely thanked and departs</span>
        </button>
      </div>
    </div>`;
}

// ── T279 Wandering Scribe ────────────────────────────────────────────────

function _wanderingScribeSection() {
  if (!Scribe.getActiveWanderingScribe()) return '';
  const secs           = Scribe.getScribeSecsLeft();
  const mana           = Math.floor(state.resources.mana ?? 0);
  const gold           = Math.floor(state.resources.gold ?? 0);
  const canCodex       = mana >= Scribe.CODEX_MANA_COST;
  const canManuscripts = gold >= Scribe.MANUSCRIPTS_GOLD_COST;
  const urg = secs <= 15 ? ' scribe-timer--urgent' : '';
  return `
    <div class="scribe-section--active">
      <div class="scribe-header">
        <span class="scribe-title">🖋️ Wandering Scribe</span>
        <span class="scribe-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="scribe-desc">A wandering scribe bearing illuminated manuscripts and rare historical chronicles has arrived, their scholarly knowledge coveted by emperors across the known world.</div>
      <div class="scribe-actions">
        <button class="btn--scribe-codex${canCodex ? '' : ' btn--disabled'}" data-action="scribe-codex" ${canCodex ? '' : 'disabled'}>
          🖋️ Commission Imperial Codex — ${Scribe.CODEX_MANA_COST}✨
          <span class="scribe-cost">→ +${Scribe.CODEX_MANA_RATE} mana/s (3 min) · +${Scribe.CODEX_PRESTIGE_REWARD} prestige · +${Scribe.CODEX_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--scribe-manuscripts${canManuscripts ? '' : ' btn--disabled'}" data-action="scribe-manuscripts" ${canManuscripts ? '' : 'disabled'}>
          📜 Purchase Rare Manuscripts — ${Scribe.MANUSCRIPTS_GOLD_COST}💰
          <span class="scribe-cost">→ +${Scribe.MANUSCRIPTS_GOLD_RATE} gold/s (2.5 min) · +${Scribe.MANUSCRIPTS_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--scribe-away" data-action="scribe-away">
          👋 Send Away
          <span class="scribe-cost">→ Scribe continues to the next great library</span>
        </button>
      </div>
    </div>`;
}

// ── T280 Desert Trader ───────────────────────────────────────────────────

function _desertTraderSection() {
  if (!DTrader.getActiveDesertTrader()) return '';
  const secs        = DTrader.getDesertTraderSecsLeft();
  const gold        = Math.floor(state.resources.gold ?? 0);
  const food        = Math.floor(state.resources.food ?? 0);
  const wood        = Math.floor(state.resources.wood ?? 0);
  const canDeal     = gold >= DTrader.DEAL_GOLD_COST;
  const canExchange = food >= DTrader.EXCHANGE_FOOD_COST && wood >= DTrader.EXCHANGE_WOOD_COST;
  const urg = secs <= 15 ? ' trader-timer--urgent' : '';
  return `
    <div class="trader-section--active">
      <div class="trader-header">
        <span class="trader-title">🐪 Desert Trader</span>
        <span class="trader-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="trader-desc">A desert trader leading a magnificent camel caravan laden with exotic spices, silks, and rare goods from distant desert kingdoms has arrived at the imperial gates.</div>
      <div class="trader-actions">
        <button class="btn--trader-deal${canDeal ? '' : ' btn--disabled'}" data-action="trader-deal" ${canDeal ? '' : 'disabled'}>
          🐪 Arrange Caravan Deal — ${DTrader.DEAL_GOLD_COST}💰
          <span class="trader-cost">→ +${DTrader.DEAL_GOLD_RATE} gold/s (2.5 min) · +${DTrader.DEAL_PRESTIGE_REWARD} prestige · +${DTrader.DEAL_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--trader-exchange${canExchange ? '' : ' btn--disabled'}" data-action="trader-exchange" ${canExchange ? '' : 'disabled'}>
          🏺 Exchange Exotic Goods — ${DTrader.EXCHANGE_FOOD_COST}🌾 + ${DTrader.EXCHANGE_WOOD_COST}🪵
          <span class="trader-cost">→ +${DTrader.EXCHANGE_GOLD_REWARD} gold · +${DTrader.EXCHANGE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--trader-away" data-action="trader-away">
          👋 Send Away
          <span class="trader-cost">→ Trader leads their caravan onward</span>
        </button>
      </div>
    </div>`;
}

// ── T281 Wandering Gemcutter ──────────────────────────────────────────────────

function _wanderingGemcutterSection() {
  if (!Gemcutter.getActiveWanderingGemcutter()) return '';
  const secs              = Gemcutter.getGemcutterSecsLeft();
  const stone             = Math.floor(state.resources.stone ?? 0);
  const iron              = Math.floor(state.resources.iron  ?? 0);
  const gold              = Math.floor(state.resources.gold  ?? 0);
  const canCommission     = stone >= Gemcutter.COMMISSION_STONE_COST && iron >= Gemcutter.COMMISSION_IRON_COST;
  const canPurchase       = gold  >= Gemcutter.PURCHASE_GOLD_COST;
  const urg = secs <= 15 ? ' gemcutter-timer--urgent' : '';
  return `
    <div class="gemcutter-section--active">
      <div class="gemcutter-header">
        <span class="gemcutter-title">💎 Wandering Gemcutter</span>
        <span class="gemcutter-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="gemcutter-desc">A wandering gemcutter bearing a chest of dazzling raw gemstones and precision cutting tools has arrived, their exquisite gem-setting skills renowned throughout the empire and beyond.</div>
      <div class="gemcutter-actions">
        <button class="btn--gemcut-commission${canCommission ? '' : ' btn--disabled'}" data-action="gemcut-commission" ${canCommission ? '' : 'disabled'}>
          💎 Commission Gem Setting — ${Gemcutter.COMMISSION_STONE_COST}🪨 + ${Gemcutter.COMMISSION_IRON_COST}⚙️
          <span class="gemcutter-cost">→ +${Gemcutter.COMMISSION_IRON_RATE} iron/s (2.5 min) · +${Gemcutter.COMMISSION_PRESTIGE_REWARD} prestige · +${Gemcutter.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--gemcut-arts${canPurchase ? '' : ' btn--disabled'}" data-action="gemcut-arts" ${canPurchase ? '' : 'disabled'}>
          🔮 Purchase Gemstone Arts — ${Gemcutter.PURCHASE_GOLD_COST}💰
          <span class="gemcutter-cost">→ +${Gemcutter.PURCHASE_STONE_RATE} stone/s (2 min) · +${Gemcutter.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--gemcut-away" data-action="gemcut-away">
          👋 Send Away
          <span class="gemcutter-cost">→ Gemcutter continues to distant gem markets</span>
        </button>
      </div>
    </div>`;
}

// ── T282 Forest Warden ────────────────────────────────────────────────────────

function _forestWardenSection() {
  if (!FWarden.getActiveForestWarden()) return '';
  const secs         = FWarden.getForestWardenSecsLeft();
  const food         = Math.floor(state.resources.food ?? 0);
  const mana         = Math.floor(state.resources.mana ?? 0);
  const canSteward   = food >= FWarden.STEWARDSHIP_FOOD_COST;
  const canLore      = mana >= FWarden.LORE_MANA_COST;
  const urg = secs <= 15 ? ' warden-timer--urgent' : '';
  return `
    <div class="warden-section--active">
      <div class="warden-header">
        <span class="warden-title">🌲 Forest Warden</span>
        <span class="warden-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="warden-desc">A forest warden bearing ancient knowledge of woodland stewardship and deep nature lore has arrived at the imperial court, seeking to share their timeless wisdom with the empire.</div>
      <div class="warden-actions">
        <button class="btn--warden-steward${canSteward ? '' : ' btn--disabled'}" data-action="warden-steward" ${canSteward ? '' : 'disabled'}>
          🌲 Grant Forest Stewardship — ${FWarden.STEWARDSHIP_FOOD_COST}🌾
          <span class="warden-cost">→ +${FWarden.STEWARDSHIP_WOOD_RATE} wood/s (2.5 min) · +${FWarden.STEWARDSHIP_PRESTIGE_REWARD} prestige · +${FWarden.STEWARDSHIP_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--warden-lore${canLore ? '' : ' btn--disabled'}" data-action="warden-lore" ${canLore ? '' : 'disabled'}>
          🍃 Exchange Woodland Lore — ${FWarden.LORE_MANA_COST}✨
          <span class="warden-cost">→ +${FWarden.LORE_MORALE_REWARD} morale · +${FWarden.LORE_PRESTIGE_REWARD} prestige · +${FWarden.LORE_FOOD_RATE} food/s (2 min)</span>
        </button>
        <button class="btn--warden-away" data-action="warden-away">
          👋 Send Away
          <span class="warden-cost">→ Warden returns to the ancient woodland groves</span>
        </button>
      </div>
    </div>`;
}

// ── T283 Wandering Beekeeper ──────────────────────────────────────────────────

function _wanderingBeekeeperSection() {
  if (!Beekeeper.getActiveWanderingBeekeeper()) return '';
  const secs       = Beekeeper.getBeekeeperSecsLeft();
  const food       = Math.floor(state.resources.food ?? 0);
  const gold       = Math.floor(state.resources.gold ?? 0);
  const canApiary  = food >= Beekeeper.APIARY_FOOD_COST;
  const canTrade   = gold >= Beekeeper.TRADE_GOLD_COST;
  const urg = secs <= 15 ? ' beekeeper-timer--urgent' : '';
  return `
    <div class="beekeeper-section--active">
      <div class="beekeeper-header">
        <span class="beekeeper-title">🍯 Wandering Beekeeper</span>
        <span class="beekeeper-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="beekeeper-desc">A wandering beekeeper arrives bearing fragrant honeycomb and knowledge of the ancient art of apiculture, offering to share the secrets of the hive with the empire.</div>
      <div class="beekeeper-actions">
        <button class="btn--beekeeper-apiary${canApiary ? '' : ' btn--disabled'}" data-action="beekeeper-apiary" ${canApiary ? '' : 'disabled'}>
          🍯 Establish Royal Apiary — ${Beekeeper.APIARY_FOOD_COST}🌾
          <span class="beekeeper-cost">→ +${Beekeeper.APIARY_FOOD_RATE} food/s (2.5 min) · +${Beekeeper.APIARY_PRESTIGE_REWARD} prestige · +${Beekeeper.APIARY_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--beekeeper-trade${canTrade ? '' : ' btn--disabled'}" data-action="beekeeper-trade" ${canTrade ? '' : 'disabled'}>
          🌸 Trade Honey & Beeswax — ${Beekeeper.TRADE_GOLD_COST}💰
          <span class="beekeeper-cost">→ +${Beekeeper.TRADE_FOOD_REWARD} food · +${Beekeeper.TRADE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--beekeeper-away" data-action="beekeeper-away">
          👋 Send Away
          <span class="beekeeper-cost">→ Beekeeper moves on to the next settlement</span>
        </button>
      </div>
    </div>`;
}

// ── T284 Stone Carver ─────────────────────────────────────────────────────────

function _stoneCarverSection() {
  if (!SCarver.getActiveStoneCarver()) return '';
  const secs            = SCarver.getCarverSecsLeft();
  const stone           = Math.floor(state.resources.stone ?? 0);
  const gold            = Math.floor(state.resources.gold  ?? 0);
  const iron            = Math.floor(state.resources.iron  ?? 0);
  const canCommission   = stone >= SCarver.COMMISSION_STONE_COST && gold >= SCarver.COMMISSION_GOLD_COST;
  const canExchange     = iron >= SCarver.EXCHANGE_IRON_COST;
  const urg = secs <= 15 ? ' carver-timer--urgent' : '';
  return `
    <div class="carver-section--active">
      <div class="carver-header">
        <span class="carver-title">🗿 Stone Carver</span>
        <span class="carver-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="carver-desc">A master stone carver renowned for imperial reliefs and decorative stonework has arrived, offering to immortalize the empire's glory in enduring stone.</div>
      <div class="carver-actions">
        <button class="btn--carver-commission${canCommission ? '' : ' btn--disabled'}" data-action="carver-commission" ${canCommission ? '' : 'disabled'}>
          🗿 Commission Imperial Reliefs — ${SCarver.COMMISSION_STONE_COST}🪨 + ${SCarver.COMMISSION_GOLD_COST}💰
          <span class="carver-cost">→ +${SCarver.COMMISSION_STONE_RATE} stone/s (2.5 min) · +${SCarver.COMMISSION_PRESTIGE_REWARD} prestige · +${SCarver.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--carver-exchange${canExchange ? '' : ' btn--disabled'}" data-action="carver-exchange" ${canExchange ? '' : 'disabled'}>
          ⛏️ Exchange Carving Techniques — ${SCarver.EXCHANGE_IRON_COST}⚙️
          <span class="carver-cost">→ +${SCarver.EXCHANGE_IRON_RATE} iron/s (2 min) · +${SCarver.EXCHANGE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--carver-away" data-action="carver-away">
          👋 Send Away
          <span class="carver-cost">→ Carver departs to seek worthy commissions elsewhere</span>
        </button>
      </div>
    </div>`;
}

// ── T285 Wandering Glassblower ────────────────────────────────────────────────

function _wanderingGlassblowerSection() {
  if (!Glassblower.getActiveWanderingGlassblower()) return '';
  const secs           = Glassblower.getGlassblowerSecsLeft();
  const iron           = Math.floor(state.resources.iron  ?? 0);
  const stone          = Math.floor(state.resources.stone ?? 0);
  const gold           = Math.floor(state.resources.gold  ?? 0);
  const canCommission  = iron >= Glassblower.COMMISSION_IRON_COST && stone >= Glassblower.COMMISSION_STONE_COST;
  const canLearn       = gold >= Glassblower.LEARN_GOLD_COST;
  const urg = secs <= 15 ? ' glass-timer--urgent' : '';
  return `
    <div class="glass-section--active">
      <div class="glass-header">
        <span class="glass-title">🔮 Wandering Glassblower</span>
        <span class="glass-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="glass-desc">A wandering glassblower arrives at the imperial court, their cart laden with shimmering crystal vessels and delicate glasswork of rare beauty.</div>
      <div class="glass-actions">
        <button class="btn--glass-commission${canCommission ? '' : ' btn--disabled'}" data-action="glass-commission" ${canCommission ? '' : 'disabled'}>
          🔮 Commission Crystal Vessels — ${Glassblower.COMMISSION_IRON_COST}⚙️ + ${Glassblower.COMMISSION_STONE_COST}🪨
          <span class="glass-cost">→ +${Glassblower.COMMISSION_IRON_RATE} iron/s (2 min) · +${Glassblower.COMMISSION_PRESTIGE_REWARD} prestige · +${Glassblower.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--glass-learn${canLearn ? '' : ' btn--disabled'}" data-action="glass-learn" ${canLearn ? '' : 'disabled'}>
          🌊 Learn Glassblowing Arts — ${Glassblower.LEARN_GOLD_COST}💰
          <span class="glass-cost">→ +${Glassblower.LEARN_STONE_RATE} stone/s (2.5 min) · +${Glassblower.LEARN_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--glass-away" data-action="glass-away">
          👋 Send Away
          <span class="glass-cost">→ Glassblower continues their journey</span>
        </button>
      </div>
    </div>`;
}

// ── T286 Royal Astronomer ─────────────────────────────────────────────────────

function _royalAstronomerSection() {
  if (!RAstronomer.getActiveRoyalAstronomer()) return '';
  const secs       = RAstronomer.getAstronomerSecsLeft();
  const mana       = Math.floor(state.resources.mana ?? 0);
  const gold       = Math.floor(state.resources.gold ?? 0);
  const canSurvey  = mana >= RAstronomer.SURVEY_MANA_COST;
  const canAlmanac = gold >= RAstronomer.ALMANAC_GOLD_COST;
  const urg = secs <= 15 ? ' astronomer-timer--urgent' : '';
  return `
    <div class="astronomer-section--active">
      <div class="astronomer-header">
        <span class="astronomer-title">🔭 Royal Astronomer</span>
        <span class="astronomer-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="astronomer-desc">A celebrated royal astronomer arrives bearing gilded telescopes and meticulously charted star maps, offering the wisdom of the heavens to guide your empire's fate.</div>
      <div class="astronomer-actions">
        <button class="btn--astronomer-survey${canSurvey ? '' : ' btn--disabled'}" data-action="astronomer-survey" ${canSurvey ? '' : 'disabled'}>
          🔭 Commission Sky Survey — ${RAstronomer.SURVEY_MANA_COST}✨
          <span class="astronomer-cost">→ +${RAstronomer.SURVEY_MANA_RATE} mana/s (2.5 min) · +${RAstronomer.SURVEY_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--astronomer-almanac${canAlmanac ? '' : ' btn--disabled'}" data-action="astronomer-almanac" ${canAlmanac ? '' : 'disabled'}>
          📚 Purchase Star Almanac — ${RAstronomer.ALMANAC_GOLD_COST}💰
          <span class="astronomer-cost">→ +${RAstronomer.ALMANAC_GOLD_RATE} gold/s (2 min) · +${RAstronomer.ALMANAC_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--astronomer-away" data-action="astronomer-away">
          👋 Send Away
          <span class="astronomer-cost">→ Astronomer sets off to chart the skies elsewhere</span>
        </button>
      </div>
    </div>`;
}

// ── T287 Imperial Herald ──────────────────────────────────────────────────────

function _imperialHeraldSection() {
  if (!IHerald.getActiveImperialHerald()) return '';
  const secs       = IHerald.getHeraldSecsLeft();
  const gold       = Math.floor(state.resources.gold ?? 0);
  const canProclaim = gold >= IHerald.PROCLAIM_GOLD_COST;
  const urg = secs <= 15 ? ' herald-timer--urgent' : '';
  return `
    <div class="herald-section--active">
      <div class="herald-header">
        <span class="herald-title">📯 Imperial Herald</span>
        <span class="herald-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="herald-desc">A resplendent imperial herald arrives at the imperial gates, golden trumpets gleaming, bearing proclamations of imperial glory to spread throughout the realm.</div>
      <div class="herald-actions">
        <button class="btn--herald-proclaim${canProclaim ? '' : ' btn--disabled'}" data-action="herald-proclaim" ${canProclaim ? '' : 'disabled'}>
          📯 Proclaim Imperial Victory — ${IHerald.PROCLAIM_GOLD_COST}💰
          <span class="herald-cost">→ +${IHerald.PROCLAIM_GOLD_RATE} gold/s (2.5 min) · +${IHerald.PROCLAIM_PRESTIGE_REWARD} prestige · +${IHerald.PROCLAIM_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--herald-announce" data-action="herald-announce">
          📜 Announce Royal Decree — Free
          <span class="herald-cost">→ +${IHerald.ANNOUNCE_PRESTIGE_REWARD} prestige · +${IHerald.ANNOUNCE_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--herald-away" data-action="herald-away">
          👋 Send Away
          <span class="herald-cost">→ Herald rides onward to the distant provinces</span>
        </button>
      </div>
    </div>`;
}

// ── T288 Traveling Potter ─────────────────────────────────────────────────────

function _travelingPotterSection() {
  if (!TPotter.getActiveTravelingPotter()) return '';
  const secs         = TPotter.getPotterSecsLeft();
  const stone        = Math.floor(state.resources.stone ?? 0);
  const food         = Math.floor(state.resources.food  ?? 0);
  const gold         = Math.floor(state.resources.gold  ?? 0);
  const canCommission = stone >= TPotter.COMMISSION_STONE_COST && food >= TPotter.COMMISSION_FOOD_COST;
  const canLearn      = gold >= TPotter.LEARN_GOLD_COST;
  const urg = secs <= 15 ? ' potter-timer--urgent' : '';
  return `
    <div class="potter-section--active">
      <div class="potter-header">
        <span class="potter-title">🏺 Traveling Potter</span>
        <span class="potter-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="potter-desc">A skilled traveling potter arrives with a cart full of fine earthenware and ancient clay-working knowledge, offering their craft to the empire.</div>
      <div class="potter-actions">
        <button class="btn--potter-commission${canCommission ? '' : ' btn--disabled'}" data-action="potter-commission" ${canCommission ? '' : 'disabled'}>
          🏺 Commission Fine Pottery — ${TPotter.COMMISSION_STONE_COST}🪨 + ${TPotter.COMMISSION_FOOD_COST}🌾
          <span class="potter-cost">→ +${TPotter.COMMISSION_STONE_RATE} stone/s (2.5 min) · +${TPotter.COMMISSION_PRESTIGE_REWARD} prestige · +${TPotter.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--potter-learn${canLearn ? '' : ' btn--disabled'}" data-action="potter-learn" ${canLearn ? '' : 'disabled'}>
          🎨 Learn Potter's Craft — ${TPotter.LEARN_GOLD_COST}💰
          <span class="potter-cost">→ +${TPotter.LEARN_FOOD_RATE} food/s (2 min) · +${TPotter.LEARN_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--potter-away" data-action="potter-away">
          👋 Send Away
          <span class="potter-cost">→ Potter rolls their cart onward down the imperial road</span>
        </button>
      </div>
    </div>`;
}

// ── T289 Wandering Dyer ───────────────────────────────────────────────────────

function _wanderingDyerSection() {
  if (!WDyer.getActiveWanderingDyer()) return '';
  const secs      = WDyer.getDyerSecsLeft();
  const wood      = Math.floor(state.resources.wood ?? 0);
  const food      = Math.floor(state.resources.food ?? 0);
  const gold      = Math.floor(state.resources.gold ?? 0);
  const canDye    = wood >= WDyer.DYE_WOOD_COST && food >= WDyer.DYE_FOOD_COST;
  const canLearn  = gold >= WDyer.LEARN_GOLD_COST;
  const urg = secs <= 15 ? ' dyer-timer--urgent' : '';
  return `
    <div class="dyer-section--active">
      <div class="dyer-header">
        <span class="dyer-title">🎨 Wandering Dyer</span>
        <span class="dyer-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="dyer-desc">A wandering master dyer arrives with vibrant pigments, rare mordants, and bolts of brilliantly colored cloth, offering to transform the empire's textiles into resplendent banners and livery.</div>
      <div class="dyer-actions">
        <button class="btn--dyer-banners${canDye ? '' : ' btn--disabled'}" data-action="dyer-banners" ${canDye ? '' : 'disabled'}>
          🎨 Dye Imperial Banners — ${WDyer.DYE_WOOD_COST}🪵 + ${WDyer.DYE_FOOD_COST}🌾
          <span class="dyer-cost">→ +${WDyer.DYE_WOOD_RATE} wood/s (2.5 min) · +${WDyer.DYE_PRESTIGE_REWARD} prestige · +${WDyer.DYE_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--dyer-learn${canLearn ? '' : ' btn--disabled'}" data-action="dyer-learn" ${canLearn ? '' : 'disabled'}>
          🌿 Learn Natural Dyes — ${WDyer.LEARN_GOLD_COST}💰
          <span class="dyer-cost">→ +${WDyer.LEARN_FOOD_RATE} food/s (2 min) · +${WDyer.LEARN_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--dyer-away" data-action="dyer-away">
          👋 Send Away
          <span class="dyer-cost">→ Dyer rolls their colorful cart onward to the next settlement</span>
        </button>
      </div>
    </div>`;
}

// ── T290 Frontier Scout ───────────────────────────────────────────────────────

function _frontierScoutSection() {
  if (!FScout.getActiveFrontierScout()) return '';
  const secs            = FScout.getScoutSecsLeft();
  const iron            = Math.floor(state.resources.iron ?? 0);
  const mana            = Math.floor(state.resources.mana ?? 0);
  const canCommission   = iron >= FScout.COMMISSION_IRON_COST;
  const canExchange     = mana >= FScout.EXCHANGE_MANA_COST;
  const urg = secs <= 15 ? ' scout-timer--urgent' : '';
  return `
    <div class="scout-section--active">
      <div class="scout-header">
        <span class="scout-title">🗺️ Frontier Scout</span>
        <span class="scout-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="scout-desc">A weathered frontier scout emerges from the wilderness, bearing detailed maps of enemy positions, resource deposits, and treacherous terrain that could prove invaluable to the empire's campaigns.</div>
      <div class="scout-actions">
        <button class="btn--scout-commission${canCommission ? '' : ' btn--disabled'}" data-action="scout-commission" ${canCommission ? '' : 'disabled'}>
          🗺️ Commission Scouting Report — ${FScout.COMMISSION_IRON_COST}⚙️
          <span class="scout-cost">→ +${FScout.COMMISSION_IRON_RATE} iron/s (2.5 min) · +${FScout.COMMISSION_PRESTIGE_REWARD} prestige · +${FScout.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--scout-exchange${canExchange ? '' : ' btn--disabled'}" data-action="scout-exchange" ${canExchange ? '' : 'disabled'}>
          📜 Exchange Intelligence Maps — ${FScout.EXCHANGE_MANA_COST}✨
          <span class="scout-cost">→ +${FScout.EXCHANGE_MANA_RATE} mana/s (2 min) · +${FScout.EXCHANGE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--scout-away" data-action="scout-away">
          👋 Send Away
          <span class="scout-cost">→ Scout vanishes back into the wilderness from whence they came</span>
        </button>
      </div>
    </div>`;
}

// ── T291 Wandering Shipwright ─────────────────────────────────────────────────

function _wanderingShipwrightSection() {
  if (!Shipwright.getActiveWanderingShipwright()) return '';
  const secs          = Shipwright.getShipwrightSecsLeft();
  const wood          = Math.floor(state.resources.wood ?? 0);
  const iron          = Math.floor(state.resources.iron ?? 0);
  const gold          = Math.floor(state.resources.gold ?? 0);
  const canCommission = wood >= Shipwright.COMMISSION_WOOD_COST && iron >= Shipwright.COMMISSION_IRON_COST;
  const canPurchase   = gold >= Shipwright.PURCHASE_GOLD_COST;
  const urg = secs <= 15 ? ' shipwright-timer--urgent' : '';
  return `
    <div class="shipwright-section--active">
      <div class="shipwright-header">
        <span class="shipwright-title">⚓ Wandering Shipwright</span>
        <span class="shipwright-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="shipwright-desc">A seasoned wandering shipwright arrives at the imperial docks, bearing advanced hull designs and maritime engineering secrets that could transform the empire's naval power.</div>
      <div class="shipwright-actions">
        <button class="btn--shipwright-commission${canCommission ? '' : ' btn--disabled'}" data-action="shipwright-commission" ${canCommission ? '' : 'disabled'}>
          ⚓ Commission War Galleys — ${Shipwright.COMMISSION_WOOD_COST}🪵 + ${Shipwright.COMMISSION_IRON_COST}⚙️
          <span class="shipwright-cost">→ +${Shipwright.COMMISSION_WOOD_RATE} wood/s (2.5 min) · +${Shipwright.COMMISSION_PRESTIGE_REWARD} prestige · +${Shipwright.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--shipwright-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="shipwright-purchase" ${canPurchase ? '' : 'disabled'}>
          📜 Purchase Naval Expertise — ${Shipwright.PURCHASE_GOLD_COST}💰
          <span class="shipwright-cost">→ +${Shipwright.PURCHASE_IRON_RATE} iron/s (2 min) · +${Shipwright.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--shipwright-away" data-action="shipwright-away">
          👋 Send Away
          <span class="shipwright-cost">→ Shipwright sails off to distant shores</span>
        </button>
      </div>
    </div>`;
}

// ── T292 Master Brewer ────────────────────────────────────────────────────────

function _masterBrewerSection() {
  if (!MBrewer.getActiveMasterBrewer()) return '';
  const secs          = MBrewer.getBrewerSecsLeft();
  const food          = Math.floor(state.resources.food ?? 0);
  const wood          = Math.floor(state.resources.wood ?? 0);
  const gold          = Math.floor(state.resources.gold ?? 0);
  const canCommission = food >= MBrewer.COMMISSION_FOOD_COST && wood >= MBrewer.COMMISSION_WOOD_COST;
  const canLearn      = gold >= MBrewer.LEARN_GOLD_COST;
  const urg = secs <= 15 ? ' brewer-timer--urgent' : '';
  return `
    <div class="brewer-section--active">
      <div class="brewer-header">
        <span class="brewer-title">🍺 Master Brewer</span>
        <span class="brewer-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="brewer-desc">A renowned master brewer arrives with ancient fermentation crocks, exotic hops, and the jealously guarded secrets of imperial ale-making. Their craft could lift the spirits of the entire empire.</div>
      <div class="brewer-actions">
        <button class="btn--brewer-commission${canCommission ? '' : ' btn--disabled'}" data-action="brewer-commission" ${canCommission ? '' : 'disabled'}>
          🍺 Commission Imperial Ale — ${MBrewer.COMMISSION_FOOD_COST}🌾 + ${MBrewer.COMMISSION_WOOD_COST}🪵
          <span class="brewer-cost">→ +${MBrewer.COMMISSION_FOOD_RATE} food/s (2.5 min) · +${MBrewer.COMMISSION_PRESTIGE_REWARD} prestige · +${MBrewer.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--brewer-learn${canLearn ? '' : ' btn--disabled'}" data-action="brewer-learn" ${canLearn ? '' : 'disabled'}>
          📖 Learn Brewing Techniques — ${MBrewer.LEARN_GOLD_COST}💰
          <span class="brewer-cost">→ +${MBrewer.LEARN_WOOD_RATE} wood/s (2 min) · +${MBrewer.LEARN_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--brewer-away" data-action="brewer-away">
          👋 Send Away
          <span class="brewer-cost">→ Brewer continues down the imperial road</span>
        </button>
      </div>
    </div>`;
}

// ── T293 Ancient Manuscript Trader ───────────────────────────────────────

function _ancientManuscriptTraderSection() {
  if (!ManTrader.getActiveManuscriptTrader()) return '';
  const secs        = ManTrader.getManuscriptTraderSecsLeft();
  const mana        = Math.floor(state.resources.mana ?? 0);
  const gold        = Math.floor(state.resources.gold ?? 0);
  const canCodex    = mana >= ManTrader.CODEX_MANA_COST;
  const canSecrets  = gold >= ManTrader.SECRETS_GOLD_COST;
  const urg = secs <= 15 ? ' manuscript-timer--urgent' : '';
  return `
    <div class="manuscript-section--active">
      <div class="manuscript-header">
        <span class="manuscript-title">📜 Ancient Manuscript Trader</span>
        <span class="manuscript-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="manuscript-desc">A secretive trader arrives with illuminated codices, ancient star charts, and the lost records of vanished civilisations — knowledge that could reshape your empire's destiny.</div>
      <div class="manuscript-actions">
        <button class="btn--manuscript-codex${canCodex ? '' : ' btn--disabled'}" data-action="manuscript-codex" ${canCodex ? '' : 'disabled'}>
          📜 Purchase Illuminated Codex — ${ManTrader.CODEX_MANA_COST}✨
          <span class="manuscript-cost">→ +${ManTrader.CODEX_MANA_RATE} mana/s (2.5 min) · +${ManTrader.CODEX_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--manuscript-secrets${canSecrets ? '' : ' btn--disabled'}" data-action="manuscript-secrets" ${canSecrets ? '' : 'disabled'}>
          🪙 Acquire Trade Secrets — ${ManTrader.SECRETS_GOLD_COST}💰
          <span class="manuscript-cost">→ +${ManTrader.SECRETS_GOLD_RATE} gold/s (2 min) · +${ManTrader.SECRETS_PRESTIGE_REWARD} prestige · +${ManTrader.SECRETS_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--manuscript-away" data-action="manuscript-away">
          👋 Send Away
          <span class="manuscript-cost">→ Trader departs through the imperial gates</span>
        </button>
      </div>
    </div>`;
}

// ── T294 Imperial Siege Engineer ─────────────────────────────────────────

function _imperialSiegeEngineerSection() {
  if (!SiegeEng.getActiveSiegeEngineer()) return '';
  const secs         = SiegeEng.getSiegeEngineerSecsLeft();
  const iron         = Math.floor(state.resources.iron ?? 0);
  const stone        = Math.floor(state.resources.stone ?? 0);
  const gold         = Math.floor(state.resources.gold ?? 0);
  const canFortify   = iron >= SiegeEng.FORTIFY_IRON_COST && stone >= SiegeEng.FORTIFY_STONE_COST;
  const canDesigns   = gold >= SiegeEng.DESIGNS_GOLD_COST;
  const urg = secs <= 15 ? ' engineer-timer--urgent' : '';
  return `
    <div class="engineer-section--active">
      <div class="engineer-header">
        <span class="engineer-title">🏰 Imperial Siege Engineer</span>
        <span class="engineer-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="engineer-desc">A master siege engineer arrives bearing trebuchet blueprints, battle-tested fortification designs, and the siege warfare secrets forged across a dozen campaigns.</div>
      <div class="engineer-actions">
        <button class="btn--engineer-fortify${canFortify ? '' : ' btn--disabled'}" data-action="engineer-fortify" ${canFortify ? '' : 'disabled'}>
          🏰 Commission Battle Fortifications — ${SiegeEng.FORTIFY_IRON_COST}⚙️ + ${SiegeEng.FORTIFY_STONE_COST}🪨
          <span class="engineer-cost">→ +${SiegeEng.FORTIFY_STONE_RATE} stone/s (2.5 min) · +${SiegeEng.FORTIFY_PRESTIGE_REWARD} prestige · +${SiegeEng.FORTIFY_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--engineer-designs${canDesigns ? '' : ' btn--disabled'}" data-action="engineer-designs" ${canDesigns ? '' : 'disabled'}>
          📐 Study Engineering Designs — ${SiegeEng.DESIGNS_GOLD_COST}💰
          <span class="engineer-cost">→ +${SiegeEng.DESIGNS_IRON_RATE} iron/s (2 min) · +${SiegeEng.DESIGNS_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--engineer-away" data-action="engineer-away">
          👋 Send Away
          <span class="engineer-cost">→ Engineer departs to seek another patron</span>
        </button>
      </div>
    </div>`;
}

// ── T295 Wandering Weaver ────────────────────────────────────────────

function _wanderingWeaverSection() {
  if (!Weaver.getActiveWeaver()) return '';
  const secs         = Weaver.getWeaverSecsLeft();
  const wood         = Math.floor(state.resources.wood ?? 0);
  const food         = Math.floor(state.resources.food ?? 0);
  const gold         = Math.floor(state.resources.gold ?? 0);
  const canTapestry  = wood >= Weaver.TAPESTRY_WOOD_COST && food >= Weaver.TAPESTRY_FOOD_COST;
  const canPatterns  = gold >= Weaver.PATTERNS_GOLD_COST;
  const urg = secs <= 15 ? ' weaver-timer--urgent' : '';
  return `
    <div class="weaver-section--active">
      <div class="weaver-header">
        <span class="weaver-title">🧵 Wandering Weaver</span>
        <span class="weaver-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="weaver-desc">A wandering weaver arrives with rare silks, golden thread, and intricate loom patterns passed down through generations of master craftspeople.</div>
      <div class="weaver-actions">
        <button class="btn--weaver-tapestry${canTapestry ? '' : ' btn--disabled'}" data-action="weaver-tapestry" ${canTapestry ? '' : 'disabled'}>
          🧵 Commission Royal Tapestries — ${Weaver.TAPESTRY_WOOD_COST}🪵 + ${Weaver.TAPESTRY_FOOD_COST}🌾
          <span class="weaver-cost">→ +${Weaver.TAPESTRY_WOOD_RATE} wood/s (2.5 min) · +${Weaver.TAPESTRY_PRESTIGE_REWARD} prestige · +${Weaver.TAPESTRY_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--weaver-patterns${canPatterns ? '' : ' btn--disabled'}" data-action="weaver-patterns" ${canPatterns ? '' : 'disabled'}>
          🪡 Learn Weaving Patterns — ${Weaver.PATTERNS_GOLD_COST}💰
          <span class="weaver-cost">→ +${Weaver.PATTERNS_FOOD_RATE} food/s (2 min) · +${Weaver.PATTERNS_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--weaver-away" data-action="weaver-away">
          👋 Send Away
          <span class="weaver-cost">→ Weaver departs to distant markets</span>
        </button>
      </div>
    </div>`;
}

// ── T296 Traveling Architect ─────────────────────────────────────────

function _travelingArchitectSection() {
  if (!Architect.getActiveArchitect()) return '';
  const secs         = Architect.getArchitectSecsLeft();
  const gold         = Math.floor(state.resources.gold ?? 0);
  const stone        = Math.floor(state.resources.stone ?? 0);
  const mana         = Math.floor(state.resources.mana ?? 0);
  const canBlueprint = gold >= Architect.BLUEPRINT_GOLD_COST && stone >= Architect.BLUEPRINT_STONE_COST;
  const canDesign    = mana >= Architect.DESIGN_MANA_COST;
  const urg = secs <= 15 ? ' architect-timer--urgent' : '';
  return `
    <div class="architect-section--active">
      <div class="architect-header">
        <span class="architect-title">🏛️ Traveling Architect</span>
        <span class="architect-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="architect-desc">A celebrated architect arrives with ambitious blueprints for aqueducts, amphitheaters, and soaring stone towers inspired by the mightiest civilizations of the known world.</div>
      <div class="architect-actions">
        <button class="btn--architect-blueprint${canBlueprint ? '' : ' btn--disabled'}" data-action="architect-blueprint" ${canBlueprint ? '' : 'disabled'}>
          🏛️ Commission Imperial Blueprint — ${Architect.BLUEPRINT_GOLD_COST}💰 + ${Architect.BLUEPRINT_STONE_COST}🪨
          <span class="architect-cost">→ +${Architect.BLUEPRINT_STONE_RATE} stone/s (2.5 min) · +${Architect.BLUEPRINT_PRESTIGE_REWARD} prestige · +${Architect.BLUEPRINT_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--architect-design${canDesign ? '' : ' btn--disabled'}" data-action="architect-design" ${canDesign ? '' : 'disabled'}>
          📏 Study Design Principles — ${Architect.DESIGN_MANA_COST}✨
          <span class="architect-cost">→ +${Architect.DESIGN_IRON_RATE} iron/s (2 min) · +${Architect.DESIGN_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--architect-away" data-action="architect-away">
          👋 Send Away
          <span class="architect-cost">→ Architect departs to seek a grander patron</span>
        </button>
      </div>
    </div>`;
}

// ── T297 Wandering Falconer ───────────────────────────────────────────────────

function _wanderingFalconerSection() {
  if (!Falconer.getActiveFalconer()) return '';
  const secs     = Falconer.getFalconerSecsLeft();
  const gold     = Math.floor(state.resources.gold ?? 0);
  const food     = Math.floor(state.resources.food ?? 0);
  const canHunt  = gold >= Falconer.HUNT_GOLD_COST;
  const canLearn = food >= Falconer.FALCONRY_FOOD_COST;
  const urg = secs <= 15 ? ' falconer-timer--urgent' : '';
  return `
    <div class="falconer-section--active">
      <div class="falconer-header">
        <span class="falconer-title">🦅 Wandering Falconer</span>
        <span class="falconer-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="falconer-desc">A masterful wandering falconer arrives at court with trained gyrfalcons and golden eagles, carrying the ancient hunting traditions of desert nomads and mountain kingdoms.</div>
      <div class="falconer-actions">
        <button class="btn--falconer-hunt${canHunt ? '' : ' btn--disabled'}" data-action="falconer-hunt" ${canHunt ? '' : 'disabled'}>
          🦅 Host Royal Hunt — ${Falconer.HUNT_GOLD_COST}💰
          <span class="falconer-cost">→ +${Falconer.HUNT_GOLD_RATE} gold/s (2.5 min) · +${Falconer.HUNT_PRESTIGE_REWARD} prestige · +${Falconer.HUNT_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--falconer-learn${canLearn ? '' : ' btn--disabled'}" data-action="falconer-learn" ${canLearn ? '' : 'disabled'}>
          🪶 Learn Falconry Arts — ${Falconer.FALCONRY_FOOD_COST}🌾
          <span class="falconer-cost">→ +${Falconer.FALCONRY_FOOD_RATE} food/s (2 min) · +${Falconer.FALCONRY_PRESTIGE} prestige</span>
        </button>
        <button class="btn--falconer-away" data-action="falconer-away">
          👋 Send Away
          <span class="falconer-cost">→ Falconer rides onward with hooded birds to distant courts</span>
        </button>
      </div>
    </div>`;
}

// ── T298 Roaming Botanist ────────────────────────────────────────────────────

function _roamingBotanistSection() {
  if (!Botanist.getActiveBotanist()) return '';
  const secs       = Botanist.getBotanistSecsLeft();
  const food       = Math.floor(state.resources.food ?? 0);
  const mana       = Math.floor(state.resources.mana ?? 0);
  const gold       = Math.floor(state.resources.gold ?? 0);
  const canGarden  = food >= Botanist.GARDEN_FOOD_COST && mana >= Botanist.GARDEN_MANA_COST;
  const canLore    = gold >= Botanist.LORE_GOLD_COST;
  const urg = secs <= 15 ? ' botanist-timer--urgent' : '';
  return `
    <div class="botanist-section--active">
      <div class="botanist-header">
        <span class="botanist-title">🌿 Roaming Botanist</span>
        <span class="botanist-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="botanist-desc">A learned roaming botanist arrives with rare seeds, pressed herbaria, and volumes of plant wisdom accumulated across a lifetime of exploration in distant kingdoms.</div>
      <div class="botanist-actions">
        <button class="btn--botanist-garden${canGarden ? '' : ' btn--disabled'}" data-action="botanist-garden" ${canGarden ? '' : 'disabled'}>
          🌿 Establish Royal Garden — ${Botanist.GARDEN_FOOD_COST}🌾 + ${Botanist.GARDEN_MANA_COST}✨
          <span class="botanist-cost">→ +${Botanist.GARDEN_FOOD_RATE} food/s (2.5 min) · +${Botanist.GARDEN_PRESTIGE_REWARD} prestige · +${Botanist.GARDEN_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--botanist-lore${canLore ? '' : ' btn--disabled'}" data-action="botanist-lore" ${canLore ? '' : 'disabled'}>
          🌺 Purchase Plant Lore — ${Botanist.LORE_GOLD_COST}💰
          <span class="botanist-cost">→ +${Botanist.LORE_MANA_RATE} mana/s (2 min) · +${Botanist.LORE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--botanist-away" data-action="botanist-away">
          👋 Send Away
          <span class="botanist-cost">→ Botanist sets off to catalogue flora in distant lands</span>
        </button>
      </div>
    </div>`;
}

// ── T299 Wandering Jeweler ───────────────────────────────────────────────────

function _wanderingJewelerSection() {
  if (!Jeweler.getActiveJeweler()) return '';
  const secs      = Jeweler.getJewelerSecsLeft();
  const iron      = Math.floor(state.resources.iron  ?? 0);
  const stone     = Math.floor(state.resources.stone ?? 0);
  const gold      = Math.floor(state.resources.gold  ?? 0);
  const canRegalia = iron >= Jeweler.REGALIA_IRON_COST && stone >= Jeweler.REGALIA_STONE_COST;
  const canGems    = gold >= Jeweler.GEMS_GOLD_COST;
  const urg = secs <= 15 ? ' jeweler-timer--urgent' : '';
  return `
    <div class="jeweler-section--active">
      <div class="jeweler-header">
        <span class="jeweler-title">💎 Wandering Jeweler</span>
        <span class="jeweler-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="jeweler-desc">A master wandering jeweler arrives carrying rare gemstones and the knowledge to craft regal regalia fit for an emperor, their padded cases gleaming with treasures gathered across distant kingdoms.</div>
      <div class="jeweler-actions">
        <button class="btn--jeweler-regalia${canRegalia ? '' : ' btn--disabled'}" data-action="jeweler-regalia" ${canRegalia ? '' : 'disabled'}>
          💎 Commission Royal Regalia — ${Jeweler.REGALIA_IRON_COST}⚙️ + ${Jeweler.REGALIA_STONE_COST}🪨
          <span class="jeweler-cost">→ +${Jeweler.REGALIA_IRON_RATE} iron/s (2.5 min) · +${Jeweler.REGALIA_PRESTIGE_REWARD} prestige · +${Jeweler.REGALIA_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--jeweler-gems${canGems ? '' : ' btn--disabled'}" data-action="jeweler-gems" ${canGems ? '' : 'disabled'}>
          💍 Purchase Rare Gems — ${Jeweler.GEMS_GOLD_COST}💰
          <span class="jeweler-cost">→ +${Jeweler.GEMS_STONE_RATE} stone/s (2 min) · +${Jeweler.GEMS_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--jeweler-away" data-action="jeweler-away">
          👋 Send Away
          <span class="jeweler-cost">→ Jeweler sets off to craft treasures for distant kingdoms</span>
        </button>
      </div>
    </div>`;
}

// ── T300 Desert Nomad Chief ──────────────────────────────────────────────────

function _desertNomadChiefSection() {
  if (!NomadChief.getActiveNomadChief()) return '';
  const secs      = NomadChief.getNomadChiefSecsLeft();
  const food      = Math.floor(state.resources.food ?? 0);
  const gold      = Math.floor(state.resources.gold ?? 0);
  const wood      = Math.floor(state.resources.wood ?? 0);
  const canAlliance = food >= NomadChief.ALLIANCE_FOOD_COST && gold >= NomadChief.ALLIANCE_GOLD_COST;
  const canTrade    = wood >= NomadChief.TRADE_WOOD_COST;
  const urg = secs <= 15 ? ' nomad-timer--urgent' : '';
  return `
    <div class="nomad-section--active">
      <div class="nomad-header">
        <span class="nomad-title">🏜️ Desert Nomad Chief</span>
        <span class="nomad-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="nomad-desc">A powerful desert nomad chief arrives leading a delegation of warriors, traders, and desert scouts from the vast sand kingdoms beyond the horizon, seeking diplomacy and profitable exchange.</div>
      <div class="nomad-actions">
        <button class="btn--nomad-alliance${canAlliance ? '' : ' btn--disabled'}" data-action="nomad-alliance" ${canAlliance ? '' : 'disabled'}>
          🏜️ Forge Alliance — ${NomadChief.ALLIANCE_FOOD_COST}🌾 + ${NomadChief.ALLIANCE_GOLD_COST}💰
          <span class="nomad-cost">→ +${NomadChief.ALLIANCE_FOOD_RATE} food/s (2.5 min) · +${NomadChief.ALLIANCE_PRESTIGE_REWARD} prestige · +${NomadChief.ALLIANCE_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--nomad-trade${canTrade ? '' : ' btn--disabled'}" data-action="nomad-trade" ${canTrade ? '' : 'disabled'}>
          🐪 Exchange Trade Goods — ${NomadChief.TRADE_WOOD_COST}🪵
          <span class="nomad-cost">→ +${NomadChief.TRADE_GOLD_RATE} gold/s (2 min) · +${NomadChief.TRADE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--nomad-decline" data-action="nomad-decline">
          🚫 Decline Meeting
          <span class="nomad-cost">→ Chief departs with proud dignity back to the desert sands</span>
        </button>
      </div>
    </div>`;
}

function _wanderingSculptorSection() {
  if (!Sculptor.getActiveSculptor()) return '';
  const secs         = Sculptor.getSculptorSecsLeft();
  const stone        = Math.floor(state.resources.stone ?? 0);
  const gold         = Math.floor(state.resources.gold ?? 0);
  const canCommission = stone >= Sculptor.COMMISSION_STONE_COST;
  const canLesson     = gold  >= Sculptor.LESSON_GOLD_COST;
  const urg = secs <= 15 ? ' sculptor-timer--urgent' : '';
  return `
    <div class="sculptor-section--active">
      <div class="sculptor-header">
        <span class="sculptor-title">🗿 Wandering Sculptor</span>
        <span class="sculptor-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="sculptor-desc">A wandering master sculptor arrives seeking a patron for his monumental works, his cart laden with chisels, mallets, and sketches of breathtaking monuments carved from living stone.</div>
      <div class="sculptor-actions">
        <button class="btn--sculptor-commission${canCommission ? '' : ' btn--disabled'}" data-action="sculptor-commission" ${canCommission ? '' : 'disabled'}>
          🗿 Commission Grand Sculpture — ${Sculptor.COMMISSION_STONE_COST}🪨
          <span class="sculptor-cost">→ +${Sculptor.COMMISSION_GOLD_RATE} gold/s (2 min) · +${Sculptor.COMMISSION_PRESTIGE_REWARD} prestige · +${Sculptor.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--sculptor-lesson${canLesson ? '' : ' btn--disabled'}" data-action="sculptor-lesson" ${canLesson ? '' : 'disabled'}>
          🎨 Learn Stone-Carving Secrets — ${Sculptor.LESSON_GOLD_COST}💰
          <span class="sculptor-cost">→ +${Sculptor.LESSON_STONE_RATE} stone/s (2 min) · +${Sculptor.LESSON_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--sculptor-away" data-action="sculptor-away">
          🚶 Send Sculptor Away
          <span class="sculptor-cost">→ Sculptor departs with his uncarved masterpieces</span>
        </button>
      </div>
    </div>`;
}

function _royalVintnerSection() {
  if (!Vintner.getActiveVintner()) return '';
  const secs       = Vintner.getVintnerSecsLeft();
  const food       = Math.floor(state.resources.food ?? 0);
  const gold       = Math.floor(state.resources.gold ?? 0);
  const canVintage  = food >= Vintner.VINTAGE_FOOD_COST && gold >= Vintner.VINTAGE_GOLD_COST;
  const canKnowledge = gold >= Vintner.KNOWLEDGE_GOLD_COST;
  const urg = secs <= 15 ? ' vintner-timer--urgent' : '';
  return `
    <div class="vintner-section--active">
      <div class="vintner-header">
        <span class="vintner-title">🍷 Royal Vintner</span>
        <span class="vintner-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="vintner-desc">A celebrated royal vintner arrives bearing wagon loads of exquisite wines and viticultural wisdom gathered from the finest vineyard estates across distant lands, seeking a worthy imperial patron.</div>
      <div class="vintner-actions">
        <button class="btn--vintner-vintage${canVintage ? '' : ' btn--disabled'}" data-action="vintner-vintage" ${canVintage ? '' : 'disabled'}>
          🍷 Commission Imperial Vintage — ${Vintner.VINTAGE_FOOD_COST}🌾 + ${Vintner.VINTAGE_GOLD_COST}💰
          <span class="vintner-cost">→ +${Vintner.VINTAGE_FOOD_RATE} food/s (2.5 min) · +${Vintner.VINTAGE_PRESTIGE_REWARD} prestige · +${Vintner.VINTAGE_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--vintner-knowledge${canKnowledge ? '' : ' btn--disabled'}" data-action="vintner-knowledge" ${canKnowledge ? '' : 'disabled'}>
          📜 Purchase Vintner's Knowledge — ${Vintner.KNOWLEDGE_GOLD_COST}💰
          <span class="vintner-cost">→ +${Vintner.KNOWLEDGE_GOLD_RATE} gold/s (2 min) · +${Vintner.KNOWLEDGE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--vintner-away" data-action="vintner-away">
          🚶 Send Vintner Away
          <span class="vintner-cost">→ Vintner departs with his finest casks to another court</span>
        </button>
      </div>
    </div>`;
}

// ── T303 Wandering Mapmaker ───────────────────────────────────────────────────

function _wanderingMapmakerSection() {
  if (!Mapmaker.getActiveMapmaker()) return '';
  const secs      = Mapmaker.getMapmakerSecsLeft();
  const gold      = Math.floor(state.resources.gold  ?? 0);
  const mana      = Math.floor(state.resources.mana  ?? 0);
  const stone     = Math.floor(state.resources.stone ?? 0);
  const canAtlas  = gold >= Mapmaker.ATLAS_GOLD_COST && mana >= Mapmaker.ATLAS_MANA_COST;
  const canSurvey = stone >= Mapmaker.SURVEY_STONE_COST;
  const urg = secs <= 15 ? ' mapmaker-timer--urgent' : '';
  return `
    <div class="mapmaker-section--active">
      <div class="mapmaker-header">
        <span class="mapmaker-title">🗺️ Wandering Mapmaker</span>
        <span class="mapmaker-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="mapmaker-desc">A skilled wandering mapmaker arrives bearing rolled parchment charts and precision measuring instruments, offering to render the empire's territories in magnificent cartographic detail.</div>
      <div class="mapmaker-actions">
        <button class="btn--mapmaker-atlas${canAtlas ? '' : ' btn--disabled'}" data-action="mapmaker-atlas" ${canAtlas ? '' : 'disabled'}>
          🗺️ Commission Imperial Atlas — ${Mapmaker.ATLAS_GOLD_COST}💰 + ${Mapmaker.ATLAS_MANA_COST}✨
          <span class="mapmaker-cost">→ +${Mapmaker.ATLAS_MANA_RATE} mana/s (2.5 min) · +${Mapmaker.ATLAS_PRESTIGE_REWARD} prestige · +${Mapmaker.ATLAS_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--mapmaker-survey${canSurvey ? '' : ' btn--disabled'}" data-action="mapmaker-survey" ${canSurvey ? '' : 'disabled'}>
          📐 Purchase Regional Survey — ${Mapmaker.SURVEY_STONE_COST}🪨
          <span class="mapmaker-cost">→ +${Mapmaker.SURVEY_STONE_RATE} stone/s (2 min) · +${Mapmaker.SURVEY_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--mapmaker-away" data-action="mapmaker-away">
          🚶 Send Away
          <span class="mapmaker-cost">→ Mapmaker departs to chart territories elsewhere</span>
        </button>
      </div>
    </div>`;
}

// ── T304 Royal Perfumer ───────────────────────────────────────────────────────

function _royalPerfumerSection() {
  if (!Perfumer.getActivePerfumer()) return '';
  const secs           = Perfumer.getPerfumerSecsLeft();
  const food           = Math.floor(state.resources.food ?? 0);
  const gold           = Math.floor(state.resources.gold ?? 0);
  const canFragrance   = food >= Perfumer.FRAGRANCE_FOOD_COST && gold >= Perfumer.FRAGRANCE_GOLD_COST;
  const canHerbs       = food >= Perfumer.HERBS_FOOD_COST;
  const urg = secs <= 15 ? ' perfumer-timer--urgent' : '';
  return `
    <div class="perfumer-section--active">
      <div class="perfumer-header">
        <span class="perfumer-title">🌸 Royal Perfumer</span>
        <span class="perfumer-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="perfumer-desc">A celebrated royal perfumer arrives bearing exquisite essence vials and aromatic herb bundles gathered from the most fragrant gardens across the known world, offering their craft to the empire.</div>
      <div class="perfumer-actions">
        <button class="btn--perfumer-fragrance${canFragrance ? '' : ' btn--disabled'}" data-action="perfumer-fragrance" ${canFragrance ? '' : 'disabled'}>
          🌸 Create Imperial Fragrance — ${Perfumer.FRAGRANCE_FOOD_COST}🌾 + ${Perfumer.FRAGRANCE_GOLD_COST}💰
          <span class="perfumer-cost">→ +${Perfumer.FRAGRANCE_FOOD_RATE} food/s (2.5 min) · +${Perfumer.FRAGRANCE_PRESTIGE_REWARD} prestige · +${Perfumer.FRAGRANCE_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--perfumer-herbs${canHerbs ? '' : ' btn--disabled'}" data-action="perfumer-herbs" ${canHerbs ? '' : 'disabled'}>
          🌿 Purchase Aromatic Herbs — ${Perfumer.HERBS_FOOD_COST}🌾
          <span class="perfumer-cost">→ +${Perfumer.HERBS_FOOD_RATE} food/s (2 min) · +${Perfumer.HERBS_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--perfumer-away" data-action="perfumer-away">
          🚶 Send Away
          <span class="perfumer-cost">→ Perfumer departs with their aromatic treasures</span>
        </button>
      </div>
    </div>`;
}

// ── T305 Wandering Silversmith ────────────────────────────────────────────────

function _wanderingSilversmithSection() {
  if (!Silversmith.getActiveSilversmith()) return '';
  const secs         = Silversmith.getSilversmithSecsLeft();
  const iron         = state.resources.iron  ?? 0;
  const stone        = state.resources.stone ?? 0;
  const gold         = state.resources.gold  ?? 0;
  const canArtifacts = iron >= Silversmith.ARTIFACTS_IRON_COST && stone >= Silversmith.ARTIFACTS_STONE_COST;
  const canJewelry   = gold >= Silversmith.JEWELRY_GOLD_COST;
  const urg = secs <= 15 ? ' silversmith-timer--urgent' : '';
  return `
    <div class="silversmith-section--active">
      <div class="silversmith-header">
        <span class="silversmith-title">🥈 Wandering Silversmith</span>
        <span class="silversmith-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="silversmith-desc">A renowned wandering silversmith arrives with masterwork silver pieces and refined forging tools acquired across many kingdoms, offering their craft to the empire.</div>
      <div class="silversmith-actions">
        <button class="btn--silversmith-artifacts${canArtifacts ? '' : ' btn--disabled'}" data-action="silversmith-artifacts" ${canArtifacts ? '' : 'disabled'}>
          🥈 Commission Silver Artifacts — ${Silversmith.ARTIFACTS_IRON_COST}⚙️ + ${Silversmith.ARTIFACTS_STONE_COST}🪨
          <span class="silversmith-cost">→ +${Silversmith.ARTIFACTS_IRON_RATE} iron/s (2.5 min) · +${Silversmith.ARTIFACTS_PRESTIGE_REWARD} prestige · +${Silversmith.ARTIFACTS_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--silversmith-jewelry${canJewelry ? '' : ' btn--disabled'}" data-action="silversmith-jewelry" ${canJewelry ? '' : 'disabled'}>
          💎 Purchase Silver Jewelry — ${Silversmith.JEWELRY_GOLD_COST}💰
          <span class="silversmith-cost">→ +${Silversmith.JEWELRY_GOLD_RATE} gold/s (2 min) · +${Silversmith.JEWELRY_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--silversmith-away" data-action="silversmith-away">
          🚶 Send Away
          <span class="silversmith-cost">→ Silversmith departs with their masterwork samples</span>
        </button>
      </div>
    </div>`;
}

// ── T306 Imperial Spice Merchant ──────────────────────────────────────────────

function _imperialSpiceMerchantSection() {
  if (!SpiceMerchant.getActiveSpiceMerchant()) return '';
  const secs       = SpiceMerchant.getSpiceMerchantSecsLeft();
  const food       = state.resources.food ?? 0;
  const gold       = state.resources.gold ?? 0;
  const canTrade   = food >= SpiceMerchant.TRADE_FOOD_COST && gold >= SpiceMerchant.TRADE_GOLD_COST;
  const canPurchase = food >= SpiceMerchant.PURCHASE_FOOD_COST;
  const urg = secs <= 15 ? ' spice-timer--urgent' : '';
  return `
    <div class="spice-section--active">
      <div class="spice-header">
        <span class="spice-title">🌶 Imperial Spice Merchant</span>
        <span class="spice-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="spice-desc">An imperial spice merchant arrives with great caravans laden with saffron, cinnamon, pepper, and rare aromatics sourced from the farthest reaches of the known world.</div>
      <div class="spice-actions">
        <button class="btn--spice-trade${canTrade ? '' : ' btn--disabled'}" data-action="spice-trade" ${canTrade ? '' : 'disabled'}>
          🌶 Arrange Spice Trade — ${SpiceMerchant.TRADE_FOOD_COST}🌾 + ${SpiceMerchant.TRADE_GOLD_COST}💰
          <span class="spice-cost">→ +${SpiceMerchant.TRADE_FOOD_RATE} food/s (2.5 min) · +${SpiceMerchant.TRADE_PRESTIGE_REWARD} prestige · +${SpiceMerchant.TRADE_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--spice-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="spice-purchase" ${canPurchase ? '' : 'disabled'}>
          🧂 Purchase Exotic Spices — ${SpiceMerchant.PURCHASE_FOOD_COST}🌾
          <span class="spice-cost">→ +${SpiceMerchant.PURCHASE_FOOD_RATE} food/s (2 min) · +${SpiceMerchant.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--spice-away" data-action="spice-away">
          🚶 Send Away
          <span class="spice-cost">→ Merchant departs with their aromatic cargo</span>
        </button>
      </div>
    </div>`;
}

// ── T307 Court Musician ────────────────────────────────────────────────────

function _courtMusicianSection() {
  if (!Musician.getActiveCourtMusician()) return '';
  const secs          = Musician.getCourtMusicianSecsLeft();
  const gold          = Math.floor(state.resources.gold ?? 0);
  const canCommission = gold >= Musician.COMMISSION_GOLD_COST;
  const urg = secs <= 15 ? ' musician-timer--urgent' : '';
  return `
    <div class="musician-section--active">
      <div class="musician-header">
        <span class="musician-title">🎵 Court Musician</span>
        <span class="musician-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="musician-desc">A renowned court musician arrives at the imperial palace, bearing a lute inlaid with silver and a reputation for composing symphonies that move emperors to tears.</div>
      <div class="musician-actions">
        <button class="btn--musician-commission${canCommission ? '' : ' btn--disabled'}" data-action="musician-commission" ${canCommission ? '' : 'disabled'}>
          🎵 Commission Grand Symphony — ${Musician.COMMISSION_GOLD_COST}💰
          <span class="musician-cost">→ +${Musician.COMMISSION_GOLD_RATE} gold/s (2.5 min) · +${Musician.COMMISSION_PRESTIGE_REWARD} prestige · +${Musician.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--musician-performance" data-action="musician-performance">
          🎶 Request Folk Performance — free
          <span class="musician-cost">→ +${Musician.PERFORMANCE_MORALE_REWARD} morale · +${Musician.PERFORMANCE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--musician-away" data-action="musician-away">
          🚶 Send Away
          <span class="musician-cost">→ Musician departs to seek another patron</span>
        </button>
      </div>
    </div>`;
}

// ── T308 Ancient Library Keeper ───────────────────────────────────────────

function _ancientLibraryKeeperSection() {
  if (!LibKeeper.getActiveLibraryKeeper()) return '';
  const secs         = LibKeeper.getLibraryKeeperSecsLeft();
  const mana         = Math.floor(state.resources.mana ?? 0);
  const gold         = Math.floor(state.resources.gold ?? 0);
  const canArchive   = mana >= LibKeeper.ARCHIVE_MANA_COST;
  const canManuscripts = gold >= LibKeeper.MANUSCRIPTS_GOLD_COST;
  const urg = secs <= 15 ? ' libkeeper-timer--urgent' : '';
  return `
    <div class="libkeeper-section--active">
      <div class="libkeeper-header">
        <span class="libkeeper-title">📚 Ancient Library Keeper</span>
        <span class="libkeeper-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="libkeeper-desc">An ancient library keeper emerges from a hidden archive, bearing a lantern and a tome of extraordinary rarity from civilisations long forgotten.</div>
      <div class="libkeeper-actions">
        <button class="btn--libkeeper-archive${canArchive ? '' : ' btn--disabled'}" data-action="libkeeper-archive" ${canArchive ? '' : 'disabled'}>
          📚 Access Forbidden Archives — ${LibKeeper.ARCHIVE_MANA_COST}✨
          <span class="libkeeper-cost">→ +${LibKeeper.ARCHIVE_MANA_RATE} mana/s (2.5 min) · +${LibKeeper.ARCHIVE_PRESTIGE_REWARD} prestige · +${LibKeeper.ARCHIVE_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--libkeeper-manuscripts${canManuscripts ? '' : ' btn--disabled'}" data-action="libkeeper-manuscripts" ${canManuscripts ? '' : 'disabled'}>
          📜 Purchase Rare Manuscripts — ${LibKeeper.MANUSCRIPTS_GOLD_COST}💰
          <span class="libkeeper-cost">→ +${LibKeeper.MANUSCRIPTS_GOLD_RATE} gold/s (2 min) · +${LibKeeper.MANUSCRIPTS_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--libkeeper-away" data-action="libkeeper-away">
          🚶 Send Away
          <span class="libkeeper-cost">→ Keeper vanishes back into the hidden archives</span>
        </button>
      </div>
    </div>`;
}

// ── T309 Wandering Clockmaker ─────────────────────────────────────────────

function _wanderingClockmakerSection() {
  if (!Clockmaker.getActiveClockmaker()) return '';
  const secs      = Clockmaker.getClockmakerSecsLeft();
  const stone     = Math.floor(state.resources.stone ?? 0);
  const gold      = Math.floor(state.resources.gold  ?? 0);
  const canClock  = stone >= Clockmaker.CLOCK_STONE_COST && gold >= Clockmaker.CLOCK_GOLD_COST;
  const canPiece  = gold  >= Clockmaker.TIMEPIECE_GOLD_COST;
  const urg = secs <= 15 ? ' clockmaker-timer--urgent' : '';
  return `
    <div class="clockmaker-section--active">
      <div class="clockmaker-header">
        <span class="clockmaker-title">⚙️ Wandering Clockmaker</span>
        <span class="clockmaker-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="clockmaker-desc">A wandering clockmaker arrives with a cart laden with astrolabes, celestial globes, and mechanical timepieces of extraordinary precision from distant lands.</div>
      <div class="clockmaker-actions">
        <button class="btn--clockmaker-clock${canClock ? '' : ' btn--disabled'}" data-action="clockmaker-clock" ${canClock ? '' : 'disabled'}>
          ⚙️ Commission Celestial Clock — ${Clockmaker.CLOCK_STONE_COST}🪨 + ${Clockmaker.CLOCK_GOLD_COST}💰
          <span class="clockmaker-cost">→ +${Clockmaker.CLOCK_STONE_RATE} stone/s (2.5 min) · +${Clockmaker.CLOCK_PRESTIGE_REWARD} prestige · +${Clockmaker.CLOCK_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--clockmaker-timepiece${canPiece ? '' : ' btn--disabled'}" data-action="clockmaker-timepiece" ${canPiece ? '' : 'disabled'}>
          🕰️ Purchase Timepiece Mechanisms — ${Clockmaker.TIMEPIECE_GOLD_COST}💰
          <span class="clockmaker-cost">→ +${Clockmaker.TIMEPIECE_GOLD_RATE} gold/s (2 min) · +${Clockmaker.TIMEPIECE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--clockmaker-away" data-action="clockmaker-away">
          🚶 Send Away
          <span class="clockmaker-cost">→ Clockmaker departs to another imperial court</span>
        </button>
      </div>
    </div>`;
}

// ── T310 Imperial Weaponsmith ─────────────────────────────────────────────

function _imperialWeaponsmithSection() {
  if (!Weaponsmith.getActiveWeaponsmith()) return '';
  const secs       = Weaponsmith.getWeaponsmithSecsLeft();
  const iron       = Math.floor(state.resources.iron  ?? 0);
  const stone      = Math.floor(state.resources.stone ?? 0);
  const gold       = Math.floor(state.resources.gold  ?? 0);
  const canArmory  = iron >= Weaponsmith.ARMORY_IRON_COST && stone >= Weaponsmith.ARMORY_STONE_COST;
  const canTech    = gold >= Weaponsmith.TECHNIQUES_GOLD_COST;
  const urg = secs <= 15 ? ' weaponsmith-timer--urgent' : '';
  return `
    <div class="weaponsmith-section--active">
      <div class="weaponsmith-header">
        <span class="weaponsmith-title">⚔️ Imperial Weaponsmith</span>
        <span class="weaponsmith-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="weaponsmith-desc">An imperial weaponsmith rides through the palace gates bearing master-forged swords, shields, and articulated plate armour from the great foundry guilds.</div>
      <div class="weaponsmith-actions">
        <button class="btn--weaponsmith-armory${canArmory ? '' : ' btn--disabled'}" data-action="weaponsmith-armory" ${canArmory ? '' : 'disabled'}>
          ⚔️ Commission Elite Armory — ${Weaponsmith.ARMORY_IRON_COST}⚙️ + ${Weaponsmith.ARMORY_STONE_COST}🪨
          <span class="weaponsmith-cost">→ +${Weaponsmith.ARMORY_IRON_RATE} iron/s (2.5 min) · +${Weaponsmith.ARMORY_PRESTIGE_REWARD} prestige · +${Weaponsmith.ARMORY_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--weaponsmith-techniques${canTech ? '' : ' btn--disabled'}" data-action="weaponsmith-techniques" ${canTech ? '' : 'disabled'}>
          🛡️ Purchase Combat Techniques — ${Weaponsmith.TECHNIQUES_GOLD_COST}💰
          <span class="weaponsmith-cost">→ +${Weaponsmith.TECHNIQUES_IRON_RATE} iron/s (2 min) · +${Weaponsmith.TECHNIQUES_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--weaponsmith-away" data-action="weaponsmith-away">
          🚶 Send Away
          <span class="weaponsmith-cost">→ Weaponsmith rides back to the great foundries</span>
        </button>
      </div>
    </div>`;
}


// ── T311 Wandering Stonemason ────────────────────────────────────────

function _wanderingStonemasonSection() {
  if (!Stonemason.getActiveStonemason()) return '';
  const secs         = Stonemason.getStonemasonSecsLeft();
  const stone        = Math.floor(state.resources.stone ?? 0);
  const iron         = Math.floor(state.resources.iron  ?? 0);
  const gold         = Math.floor(state.resources.gold  ?? 0);
  const canStoneworks = stone >= Stonemason.STONEWORKS_STONE_COST && iron >= Stonemason.STONEWORKS_IRON_COST;
  const canTech       = gold  >= Stonemason.TECHNIQUES_GOLD_COST;
  const urg = secs <= 15 ? ' stonemason-timer--urgent' : '';
  return `
    <div class="stonemason-section--active">
      <div class="stonemason-header">
        <span class="stonemason-title">🏛️ Wandering Stonemason</span>
        <span class="stonemason-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="stonemason-desc">A master stonemason arrives seeking imperial commissions, their hands bearing the marks of a lifetime shaping stone into enduring monuments and fortifications.</div>
      <div class="stonemason-actions">
        <button class="btn--stonemason-stoneworks${canStoneworks ? '' : ' btn--disabled'}" data-action="stonemason-stoneworks" ${canStoneworks ? '' : 'disabled'}>
          🏛️ Commission Grand Stoneworks — ${Stonemason.STONEWORKS_STONE_COST}🪨 + ${Stonemason.STONEWORKS_IRON_COST}⚙️
          <span class="stonemason-cost">→ +${Stonemason.STONEWORKS_STONE_RATE} stone/s (2.5 min) · +${Stonemason.STONEWORKS_PRESTIGE_REWARD} prestige · +${Stonemason.STONEWORKS_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--stonemason-techniques${canTech ? '' : ' btn--disabled'}" data-action="stonemason-techniques" ${canTech ? '' : 'disabled'}>
          🔨 Exchange Master Techniques — ${Stonemason.TECHNIQUES_GOLD_COST}💰
          <span class="stonemason-cost">→ +${Stonemason.TECHNIQUES_IRON_RATE} iron/s (2 min) · +${Stonemason.TECHNIQUES_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--stonemason-away" data-action="stonemason-away">
          🚶 Send Away
          <span class="stonemason-cost">→ Stonemason continues their journey</span>
        </button>
      </div>
    </div>`;
}


// ── T312 Imperial Dye Master ─────────────────────────────────────────

function _imperialDyeMasterSection() {
  if (!DyeMaster.getActiveDyeMaster()) return '';
  const secs      = DyeMaster.getDyeMasterSecsLeft();
  const wood      = Math.floor(state.resources.wood ?? 0);
  const food      = Math.floor(state.resources.food ?? 0);
  const gold      = Math.floor(state.resources.gold ?? 0);
  const canWorks  = wood >= DyeMaster.DYE_WORKS_WOOD_COST && food >= DyeMaster.DYE_WORKS_FOOD_COST;
  const canFormulas = gold >= DyeMaster.FORMULAS_GOLD_COST;
  const urg = secs <= 15 ? ' dyemaster-timer--urgent' : '';
  return `
    <div class="dyemaster-section--active">
      <div class="dyemaster-header">
        <span class="dyemaster-title">🎨 Imperial Dye Master</span>
        <span class="dyemaster-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="dyemaster-desc">A renowned dye master arrives bearing exotic pigments from distant lands, their robes stained with the brilliant hues of indigo, crimson madder, and royal purple.</div>
      <div class="dyemaster-actions">
        <button class="btn--dyemaster-works${canWorks ? '' : ' btn--disabled'}" data-action="dyemaster-works" ${canWorks ? '' : 'disabled'}>
          🎨 Establish Royal Dye Works — ${DyeMaster.DYE_WORKS_WOOD_COST}🪵 + ${DyeMaster.DYE_WORKS_FOOD_COST}🌾
          <span class="dyemaster-cost">→ +${DyeMaster.DYE_WORKS_WOOD_RATE} wood/s (2.5 min) · +${DyeMaster.DYE_WORKS_PRESTIGE_REWARD} prestige · +${DyeMaster.DYE_WORKS_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--dyemaster-formulas${canFormulas ? '' : ' btn--disabled'}" data-action="dyemaster-formulas" ${canFormulas ? '' : 'disabled'}>
          🌿 Purchase Rare Dye Formulas — ${DyeMaster.FORMULAS_GOLD_COST}💰
          <span class="dyemaster-cost">→ +${DyeMaster.FORMULAS_FOOD_RATE} food/s (2 min) · +${DyeMaster.FORMULAS_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--dyemaster-away" data-action="dyemaster-away">
          🚶 Send Away
          <span class="dyemaster-cost">→ Dye master departs for another empire</span>
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

  'forester-commission': () => Forester.commissionTimberWorks(),
  'forester-learn':      () => Forester.learnForestTechniques(),
  'forester-lodge':      () => Forester.offerSeasonalLodging(),

  'spirit-pact':    () => Spirit.forgeForestPact(),
  'spirit-wisdom':  () => Spirit.requestAncientWisdom(),
  'spirit-tribute': () => Spirit.offerNaturesTribute(),

  'alchemist-transmute': () => Alchemist.commissionTransmutation(),
  'alchemist-arts':      () => Alchemist.learnAlchemicalArts(),
  'alchemist-lab':       () => Alchemist.offerLaboratorySpace(),

  'explorer-fund':        () => Explorer.fundExpedition(),
  'explorer-charts':      () => Explorer.exchangeNavigationCharts(),
  'explorer-provisions':  () => Explorer.provideProvisions(),

  'monk-guidance': () => Monk.seekSpiritualGuidance(),
  'monk-donate':   () => Monk.makeGenerousDonation(),
  'monk-away':     () => Monk.sendMonkAway(),

  'carto-survey':   () => ImpCarto.commissionCartographerSurvey(),
  'carto-exchange': () => ImpCarto.exchangeCartographicTechniques(),
  'carto-farewell': () => ImpCarto.bidCartographerFarewell(),

  'oracle-consult':  () => Oracle.consultOracleVision(),
  'oracle-prophecy': () => Oracle.purchaseOracleProphecy(),
  'oracle-away':     () => Oracle.sendOracleAway(),

  'emissary-receive':  () => Emissary.receiveEmissaryDelegation(),
  'emissary-exchange': () => Emissary.exchangeEmissaryTreaties(),
  'emissary-decline':  () => Emissary.declineRoyalEmissary(),

  'tinker-commission': () => Tinker.commissionTinkerRepairs(),
  'tinker-purchase':   () => Tinker.purchaseTinkerTools(),
  'tinker-away':       () => Tinker.sendTinkerAway(),

  'physician-treat': () => Physician.commissionPhysicianTreatments(),
  'physician-learn': () => Physician.learnPhysicianLore(),
  'physician-away':  () => Physician.sendPhysicianAway(),

  'carto2-map':      () => Cartomancer.commissionCelestialMap(),
  'carto2-exchange': () => Cartomancer.exchangeStellarKnowledge(),
  'carto2-away':     () => Cartomancer.sendCartomancerAway(),

  'elder-wisdom':      () => Elder.seekElderWisdom(),
  'elder-hospitality': () => Elder.offerElderHospitality(),
  'elder-away':        () => Elder.sendElderAway(),

  'scribe-codex':       () => Scribe.commissionImperialCodex(),
  'scribe-manuscripts': () => Scribe.purchaseRareManuscripts(),
  'scribe-away':        () => Scribe.sendScribeAway(),

  'trader-deal':     () => DTrader.arrangeCaravanDeal(),
  'trader-exchange': () => DTrader.exchangeExoticGoods(),
  'trader-away':     () => DTrader.sendDesertTraderAway(),

  'gemcut-commission': () => Gemcutter.commissionGemSetting(),
  'gemcut-arts':       () => Gemcutter.purchaseGemstoneArts(),
  'gemcut-away':       () => Gemcutter.sendGemcutterAway(),

  'warden-steward': () => FWarden.grantForestStewardship(),
  'warden-lore':    () => FWarden.exchangeWoodlandLore(),
  'warden-away':    () => FWarden.sendForestWardenAway(),

  'beekeeper-apiary': () => Beekeeper.establishRoyalApiary(),
  'beekeeper-trade':  () => Beekeeper.tradeHoneyBeeswax(),
  'beekeeper-away':   () => Beekeeper.sendBeekeeperAway(),

  'carver-commission': () => SCarver.commissionImperialReliefs(),
  'carver-exchange':   () => SCarver.exchangeCarvingTechniques(),
  'carver-away':       () => SCarver.sendStoneCarverAway(),

  'glass-commission': () => Glassblower.commissionCrystalVessels(),
  'glass-learn':      () => Glassblower.learnGlassblowingArts(),
  'glass-away':       () => Glassblower.sendGlassblowerAway(),

  'astronomer-survey':  () => RAstronomer.commissionSkySurvey(),
  'astronomer-almanac': () => RAstronomer.purchaseStarAlmanac(),
  'astronomer-away':    () => RAstronomer.sendAstronomerAway(),

  'herald-proclaim':  () => IHerald.proclaimImperialVictory(),
  'herald-announce':  () => IHerald.announceRoyalDecree(),
  'herald-away':      () => IHerald.sendHeraldAway(),

  'potter-commission': () => TPotter.commissionFinePottery(),
  'potter-learn':      () => TPotter.learnPottersCraft(),
  'potter-away':       () => TPotter.sendPotterAway(),

  'dyer-banners': () => WDyer.dyeImperialBanners(),
  'dyer-learn':   () => WDyer.learnNaturalDyes(),
  'dyer-away':    () => WDyer.sendDyerAway(),

  'scout-commission': () => FScout.commissionScoutingReport(),
  'scout-exchange':   () => FScout.exchangeIntelligenceMaps(),
  'scout-away':       () => FScout.sendScoutAway(),

  'shipwright-commission': () => Shipwright.commissionWarGalleys(),
  'shipwright-purchase':   () => Shipwright.purchaseNavalExpertise(),
  'shipwright-away':       () => Shipwright.sendShipwrightAway(),

  'brewer-commission': () => MBrewer.commissionImperialAle(),
  'brewer-learn':      () => MBrewer.learnBrewingTechniques(),
  'brewer-away':       () => MBrewer.sendBrewerAway(),

  'manuscript-codex':   () => ManTrader.purchaseIlluminatedCodex(),
  'manuscript-secrets': () => ManTrader.acquireTradeSecrets(),
  'manuscript-away':    () => ManTrader.sendManuscriptTraderAway(),

  'engineer-fortify':  () => SiegeEng.commissionBattleFortifications(),
  'engineer-designs':  () => SiegeEng.studyEngineeringDesigns(),
  'engineer-away':     () => SiegeEng.sendSiegeEngineerAway(),

  'weaver-tapestry': () => Weaver.commissionRoyalTapestries(),
  'weaver-patterns': () => Weaver.learnWeavingPatterns(),
  'weaver-away':     () => Weaver.sendWeaverAway(),

  'architect-blueprint': () => Architect.commissionImperialBlueprint(),
  'architect-design':    () => Architect.studyDesignPrinciples(),
  'architect-away':      () => Architect.sendArchitectAway(),

  'falconer-hunt':  () => Falconer.hostRoyalHunt(),
  'falconer-learn': () => Falconer.learnFalconryArts(),
  'falconer-away':  () => Falconer.sendFalconerAway(),

  'botanist-garden': () => Botanist.establishRoyalGarden(),
  'botanist-lore':   () => Botanist.purchasePlantLore(),
  'botanist-away':   () => Botanist.sendBotanistAway(),

  'jeweler-regalia': () => Jeweler.commissionRoyalRegalia(),
  'jeweler-gems':    () => Jeweler.purchaseRareGems(),
  'jeweler-away':    () => Jeweler.sendJewelerAway(),

  'nomad-alliance':  () => NomadChief.forgeNomadAlliance(),
  'nomad-trade':     () => NomadChief.exchangeTradeGoods(),
  'nomad-decline':   () => NomadChief.declineNomadMeeting(),

  'sculptor-commission': () => Sculptor.commissionGrandSculpture(),
  'sculptor-lesson':     () => Sculptor.learnStoneCarvingSecrets(),
  'sculptor-away':       () => Sculptor.sendSculptorAway(),

  'vintner-vintage':   () => Vintner.commissionImperialVintage(),
  'vintner-knowledge': () => Vintner.purchaseVintnersKnowledge(),
  'vintner-away':      () => Vintner.sendVintnerAway(),

  'mapmaker-atlas':  () => Mapmaker.commissionImperialAtlas(),
  'mapmaker-survey': () => Mapmaker.purchaseRegionalSurvey(),
  'mapmaker-away':   () => Mapmaker.sendMapmakerAway(),

  'perfumer-fragrance': () => Perfumer.createImperialFragrance(),
  'perfumer-herbs':     () => Perfumer.purchaseAromaticHerbs(),
  'perfumer-away':      () => Perfumer.sendPerfumerAway(),

  'silversmith-artifacts': () => Silversmith.commissionSilverArtifacts(),
  'silversmith-jewelry':   () => Silversmith.purchaseSilverJewelry(),
  'silversmith-away':      () => Silversmith.sendSilversmithAway(),

  'spice-trade':    () => SpiceMerchant.arrangeSpiceTrade(),
  'spice-purchase': () => SpiceMerchant.purchaseExoticSpices(),
  'spice-away':     () => SpiceMerchant.sendSpiceMerchantAway(),

  'musician-commission':  () => Musician.commissionGrandSymphony(),
  'musician-performance': () => Musician.requestFolkPerformance(),
  'musician-away':        () => Musician.sendCourtMusicianAway(),

  'libkeeper-archive':     () => LibKeeper.accessForbiddenArchives(),
  'libkeeper-manuscripts': () => LibKeeper.purchaseRareManuscripts(),
  'libkeeper-away':        () => LibKeeper.sendLibraryKeeperAway(),

  'clockmaker-clock':      () => Clockmaker.commissionCelestialClock(),
  'clockmaker-timepiece':  () => Clockmaker.purchaseTimepieceMechanisms(),
  'clockmaker-away':       () => Clockmaker.sendClockmakerAway(),

  'weaponsmith-armory':      () => Weaponsmith.commissionEliteArmory(),
  'weaponsmith-techniques':  () => Weaponsmith.purchaseCombatTechniques(),
  'weaponsmith-away':        () => Weaponsmith.sendWeaponsmithAway(),

  'stonemason-stoneworks':   () => Stonemason.commissionGrandStoneworks(),
  'stonemason-techniques':   () => Stonemason.exchangeMasterTechniques(),
  'stonemason-away':         () => Stonemason.sendStonemasonAway(),

  'dyemaster-works':         () => DyeMaster.establishRoyalDyeWorks(),
  'dyemaster-formulas':      () => DyeMaster.purchaseRareDyeFormulas(),
  'dyemaster-away':          () => DyeMaster.sendDyeMasterAway(),
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
    Events.MASTER_FORESTER_CHANGED,
    Events.FOREST_SPIRIT_CHANGED,
    Events.WANDERING_ALCHEMIST_CHANGED,
    Events.SEAFARING_EXPLORER_CHANGED,
    Events.TRAVELING_MONK_CHANGED,
    Events.IMPERIAL_CARTOGRAPHER_CHANGED,
    Events.WANDERING_ORACLE_CHANGED,
    Events.ROYAL_EMISSARY_CHANGED,
    Events.WANDERING_TINKER_CHANGED,
    Events.WANDERING_PHYSICIAN_CHANGED,
    Events.WANDERING_CARTOMANCER_CHANGED,
    Events.VILLAGE_ELDER_VISIT_CHANGED,
    Events.WANDERING_SCRIBE_CHANGED,
    Events.DESERT_TRADER_CHANGED,
    Events.WANDERING_GEMCUTTER_CHANGED,
    Events.FOREST_WARDEN_CHANGED,
    Events.WANDERING_BEEKEEPER_CHANGED,
    Events.STONE_CARVER_CHANGED,
    Events.WANDERING_GLASSBLOWER_CHANGED,
    Events.ROYAL_ASTRONOMER_CHANGED,
    Events.IMPERIAL_HERALD_CHANGED,
    Events.TRAVELING_POTTER_CHANGED,
    Events.WANDERING_DYER_CHANGED,
    Events.FRONTIER_SCOUT_CHANGED,
    Events.WANDERING_SHIPWRIGHT_CHANGED,
    Events.MASTER_BREWER_CHANGED,
    Events.ANCIENT_MANUSCRIPT_TRADER_CHANGED,
    Events.IMPERIAL_SIEGE_ENGINEER_CHANGED,
    Events.WANDERING_WEAVER_CHANGED,
    Events.TRAVELING_ARCHITECT_CHANGED,
    Events.WANDERING_FALCONER_CHANGED,
    Events.ROAMING_BOTANIST_CHANGED,
    Events.WANDERING_JEWELER_CHANGED,
    Events.DESERT_NOMAD_CHIEF_CHANGED,
    Events.WANDERING_SCULPTOR_CHANGED,
    Events.ROYAL_VINTNER_CHANGED,
    Events.WANDERING_MAPMAKER_CHANGED,
    Events.ROYAL_PERFUMER_CHANGED,
    Events.WANDERING_SILVERSMITH_CHANGED,
    Events.IMPERIAL_SPICE_MERCHANT_CHANGED,
    Events.COURT_MUSICIAN_CHANGED,
    Events.ANCIENT_LIBRARY_KEEPER_CHANGED,
    Events.WANDERING_CLOCKMAKER_CHANGED,
    Events.IMPERIAL_WEAPONSMITH_CHANGED,
    Events.WANDERING_STONEMASON_CHANGED,
    Events.IMPERIAL_DYE_MASTER_CHANGED,
    Events.RESOURCE_CHANGED,
  ];
  for (const ev of ENCOUNTER_EVENTS) on(ev, _render);

  let _ticks = 0;
  on(Events.TICK, () => { if (++_ticks % 4 === 0) _render(); });

  _panel.addEventListener('click', _handleClick);
  _render();
}
