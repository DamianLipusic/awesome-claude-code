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
import * as Navigator   from '../systems/wanderingNavigator.js';        // T313
import * as Illuminator   from '../systems/travelingIlluminator.js';    // T314
import * as RitualLeader  from '../systems/ancientRitualLeader.js';     // T315
import * as MtProspector  from '../systems/mountainProspector.js';      // T316
import * as Leatherworker from '../systems/wanderingLeatherworker.js'; // T317
import * as Apothecary    from '../systems/royalApothecary.js';        // T318
import * as Fishmonger   from '../systems/wanderingFishmonger.js';    // T319
import * as Chandler     from '../systems/imperialChandler.js';       // T320
import * as Lamplighter  from '../systems/royalLamplighter.js';       // T321
import * as Cooper       from '../systems/wanderingCooper.js';         // T322
import * as RopeMaker   from '../systems/wanderingRopeMaker.js';      // T323
import * as SaltMerchant from '../systems/imperialSaltMerchant.js';   // T324
import * as Puppeteer   from '../systems/wanderingPuppeteer.js';      // T325
import * as RuneCarver  from '../systems/ancientRuneCarver.js';        // T326
import * as Cartwright from '../systems/wanderingCartwright.js';      // T327
import * as Farrier    from '../systems/imperialFarrier.js';          // T328
import * as Cobbler   from '../systems/wanderingCobbler.js';         // T329
import * as Engraver  from '../systems/imperialEngraver.js';         // T330
import * as Tailor    from '../systems/wanderingTailor.js';          // T331
import * as Tinsmith  from '../systems/wanderingTinsmith.js';        // T332
import * as Miller    from '../systems/wanderingMiller.js';          // T333
import * as Courier   from '../systems/imperialCourier.js';          // T334
import * as Baker     from '../systems/wanderingBaker.js';           // T335
import * as Armorer   from '../systems/imperialArmorer.js';          // T336
import * as WoodCarver    from '../systems/wanderingWoodCarver.js';    // T337
import * as RoadBuilder   from '../systems/imperialRoadBuilder.js';   // T338
import * as Embroiderer   from '../systems/wanderingEmbroiderer.js';  // T339
import * as Bookbinder    from '../systems/royalBookbinder.js';       // T340
import * as Basketweaver  from '../systems/wanderingBasketweaver.js'; // T341
import * as CharcoalMaker from '../systems/wanderingCharcoalMaker.js'; // T342
import * as Tanner        from '../systems/wanderingTanner.js';        // T343
import * as IGlassmaker   from '../systems/imperialGlassmaker.js';     // T344
import * as Inkmaker      from '../systems/wanderingInkmaker.js';      // T345
import * as Dockmaster    from '../systems/imperialDockmaster.js';     // T346
import * as Storyteller  from '../systems/wanderingStoryteller.js';  // T347
import * as LoreMaster   from '../systems/imperialLoreMaster.js';    // T348
import * as Toymaker     from '../systems/wanderingToymaker.js';     // T349
import * as Ferryman     from '../systems/imperialFerryman.js';      // T350
import * as MosaicMaker  from '../systems/wanderingMosaicMaker.js';  // T351
import * as BHBuilder    from '../systems/imperialBathhouseBuilder.js'; // T352
import * as BellFounder  from '../systems/wanderingBellFounder.js';     // T353
import * as MarbleCutter    from '../systems/imperialMarbleCutter.js';     // T354
import * as ParchmentMaker from '../systems/wanderingParchmentMaker.js'; // T355
import * as IncenseMaker   from '../systems/wanderingIncenseMaker.js';   // T356
import * as Furrier        from '../systems/wanderingFurrier.js';         // T357
import * as WoolMerchant   from '../systems/imperialWoolMerchant.js';     // T358
import * as HorseTrader    from '../systems/wanderingHorseTrader.js';     // T359
import * as SilkWeaver     from '../systems/imperialSilkWeaver.js';       // T360
import * as GemMerchant    from '../systems/wanderingGemMerchant.js';     // T361
import * as SiegeMaster    from '../systems/imperialSiegeMaster.js';      // T362
import * as HatMaker       from '../systems/wanderingHatMaker.js';        // T363
import * as Goldsmith      from '../systems/imperialGoldsmith.js';        // T364
import * as OilMerchant   from '../systems/wanderingOilMerchant.js';     // T365
import * as Quarryman      from '../systems/imperialQuarryman.js';        // T366
import * as SoapMaker     from '../systems/wanderingSoapMaker.js';       // T367
import * as Metalcaster   from '../systems/imperialMetalcaster.js';      // T368
import * as GloveMaker    from '../systems/wanderingGloveMaker.js';      // T369
import * as TelescopeMkr  from '../systems/imperialTelescopeMaker.js';   // T370
import * as PaperMaker    from '../systems/wanderingPaperMaker.js';       // T371
import * as CoinMinter    from '../systems/imperialCoinMinter.js';        // T372
import * as CartGuild    from '../systems/wanderingCartographerGuild.js'; // T373
import * as Spymaster    from '../systems/imperialSpymaster.js';          // T374
import * as GemPolisher  from '../systems/wanderingGemPolisher.js';       // T375
import * as AstrolabeMkr from '../systems/imperialAstrolabeMaker.js';     // T376
import * as Locksmith      from '../systems/wanderingLocksmith.js';         // T377
import * as Calligrapher   from '../systems/imperialCalligrapher.js';       // T378
import * as Coppersmith    from '../systems/wanderingCoppersmith.js';       // T379
import * as Scrivener      from '../systems/imperialScrivener.js';          // T380
import * as MirrorMaker    from '../systems/wanderingMirrorMaker.js';       // T381
import * as FlowerMerchant from '../systems/imperialFlowerMerchant.js';     // T382
import * as Dressmaker    from '../systems/wanderingDressmaker.js';         // T383
import * as TileSetter    from '../systems/imperialTileSetter.js';          // T384
import * as BannerWeaver from '../systems/imperialBannerWeaver.js';        // T385
import * as BoneCarver      from '../systems/wanderingBoneCarver.js';         // T386
import * as TapestryMaker  from '../systems/wanderingTapestryMaker.js';      // T387
import * as SiegeArchitect from '../systems/imperialSiegeArchitect.js';      // T388
import * as LuteMaker     from '../systems/wanderingLuteMaker.js';           // T389
import * as SCGuild       from '../systems/imperialStonecutterGuild.js';     // T390
import * as Candlemaker   from '../systems/wanderingCandlemaker.js';         // T391
import * as GrainMerchant from '../systems/imperialGrainMerchant.js';        // T392
import * as FeltMaker     from '../systems/wanderingFeltMaker.js';           // T393
import * as VineyardMaster from '../systems/imperialVineyardMaster.js';      // T394
import * as HerbMerchant  from '../systems/wanderingHerbMerchant.js';        // T395
import * as LanternMaker  from '../systems/imperialLanternMaker.js';         // T396
import * as InkMaster     from '../systems/wanderingInkMaster.js';           // T397
import * as SaltMerchant  from '../systems/wanderingSaltMerchant.js';        // T398
import * as BronzeSmith   from '../systems/wanderingBronzeSmith.js';         // T399
import * as AqueductBld   from '../systems/imperialAqueductBuilder.js';      // T400
import * as GlassPainter  from '../systems/wanderingGlassPainter.js';        // T401
import * as CatapultEng   from '../systems/imperialSiegeCatapultEngineer.js'; // T402
import * as WoolSpinner   from '../systems/wanderingWoolSpinner.js';          // T403
import * as AmberMerchant   from '../systems/imperialAmberMerchant.js';         // T404
import * as SandglassMaker from '../systems/wanderingSandglassMaker.js';       // T405
import * as BridgeBuilder  from '../systems/imperialBridgeBuilder.js';         // T406
import * as Chronicler    from '../systems/wanderingChronicler.js';            // T407
import * as ImperialSurveyor from '../systems/imperialSurveyor.js';            // T408
import * as TapestryRestorer from '../systems/wanderingTapestryRestorer.js'; // T409
import * as HarborMaster     from '../systems/imperialHarborMaster.js';      // T410
import * as BowMaker         from '../systems/wanderingBowMaker.js';           // T411
import * as CheeseMerchant   from '../systems/imperialCheeseMerchant.js';      // T412
import * as Thatcher          from '../systems/wanderingThatcher.js';            // T413
import * as MillstoneCutter   from '../systems/imperialMillstoneCutter.js';      // T414
import * as PeatCutter        from '../systems/wanderingPeatCutter.js';          // T415
import * as IconPainter       from '../systems/imperialIconPainter.js';          // T416
import * as WaxTabletMaker   from '../systems/wanderingWaxTabletMaker.js';       // T417
import * as NetMaker         from '../systems/wanderingNetMaker.js';             // T418
import * as DrumMaker        from '../systems/wanderingDrumMaker.js';            // T419
import * as HerbariumKeeper  from '../systems/imperialHerbariumKeeper.js';       // T420
import * as SpearMaker       from '../systems/wanderingSpearMaker.js';           // T421
import * as RobeMaker        from '../systems/imperialRobeMaker.js';             // T422
import * as Fletcher         from '../systems/wanderingFletcher.js';             // T423
import * as Knifesmith       from '../systems/imperialKnifesmith.js';            // T424
import * as SailMaker        from '../systems/wanderingSailMaker.js';            // T425
import * as ChariotBuilder   from '../systems/imperialChariotBuilder.js';        // T426
import * as SeedMerchant     from '../systems/wanderingSeedMerchant.js';         // T427
import * as SilkPainter      from '../systems/imperialSilkscreenPainter.js';    // T428
import * as Woodcutter       from '../systems/wanderingWoodcutter.js';           // T429
import * as MasonsGuild      from '../systems/imperialMasonsGuild.js';           // T430

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
    _wanderingNavigatorSection(),
    _travelingIlluminatorSection(),
    _ancientRitualLeaderSection(),
    _mountainProspectorSection(),
    _wanderingLeatherworkerSection(),
    _royalApothecarySection(),
    _wanderingFishmongerSection(),
    _imperialChandlerSection(),
    _royalLamplighterSection(),
    _wanderingCooperSection(),
    _wanderingRopeMakerSection(),
    _imperialSaltMerchantSection(),
    _wanderingPuppeteerSection(),
    _ancientRuneCarverSection(),
    _wanderingCartwrightSection(),
    _imperialFarrierSection(),
    _wanderingCobblerSection(),
    _imperialEngraverSection(),
    _wanderingTailorSection(),
    _wanderingTinsmithSection(),
    _wanderingMillerSection(),
    _imperialCourierSection(),
    _wanderingBakerSection(),
    _imperialArmorerSection(),
    _wanderingWoodCarverSection(),
    _imperialRoadBuilderSection(),
    _wanderingEmbroidererSection(),
    _royalBookbinderSection(),
    _wanderingBasketweaverSection(),
    _wanderingCharcoalMakerSection(),
    _wanderingTannerSection(),
    _imperialGlassmakerSection(),
    _wanderingInkmakerSection(),
    _imperialDockmasterSection(),
    _wanderingStorytellerSection(),
    _imperialLoreMasterSection(),
    _wanderingToymakerSection(),
    _imperialFerrymanSection(),
    _wanderingMosaicMakerSection(),
    _imperialBathhouseBuilderSection(),
    _wanderingBellFounderSection(),
    _imperialMarbleCutterSection(),
    _wanderingParchmentMakerSection(),
    _wanderingIncenseMakerSection(),
    _wanderingFurrierSection(),
    _imperialWoolMerchantSection(),
    _wanderingHorseTraderSection(),
    _imperialSilkWeaverSection(),
    _wanderingGemMerchantSection(),
    _imperialSiegeMasterSection(),
    _wanderingHatMakerSection(),
    _imperialGoldsmithSection(),
    _wanderingOilMerchantSection(),
    _imperialQuarrymanSection(),
    _wanderingSoapMakerSection(),
    _imperialMetalcasterSection(),
    _wanderingGloveMakerSection(),
    _imperialTelescopeMakerSection(),
    _wanderingPaperMakerSection(),
    _imperialCoinMinterSection(),
    _wanderingCartographerGuildSection(),
    _imperialSpymasterSection(),
    _wanderingGemPolisherSection(),
    _imperialAstrolabeMakerSection(),
    _wanderingLocksmithSection(),
    _imperialCalligrapherSection(),
    _wanderingCoppersmithSection(),
    _imperialScrivenerSection(),
    _wanderingMirrorMakerSection(),
    _imperialFlowerMerchantSection(),
    _wanderingDressmakertSection(),
    _imperialTileSetterSection(),
    _imperialBannerWeaverSection(),
    _wanderingBoneCarverSection(),
    _wanderingTapestryMakerSection(),
    _imperialSiegeArchitectSection(),
    _wanderingLuteMakerSection(),
    _imperialStonecutterGuildSection(),
    _wanderingCandlemakerSection(),
    _imperialGrainMerchantSection(),
    _wanderingFeltMakerSection(),
    _imperialVineyardMasterSection(),
    _wanderingHerbMerchantSection(),
    _imperialLanternMakerSection(),
    _wanderingInkMasterSection(),
    _wanderingSaltMerchantSection(),
    _wanderingBronzeSmithSection(),
    _imperialAqueductBuilderSection(),
    _wanderingGlassPainterSection(),
    _imperialSiegeCatapultEngineerSection(),
    _wanderingWoolSpinnerSection(),
    _imperialAmberMerchantSection(),
    _wanderingSandglassMakerSection(),
    _imperialBridgeBuilderSection(),
    _wanderingChroniclerSection(),
    _imperialSurveyorSection(),
    _wanderingTapestryRestorerSection(),
    _imperialHarborMasterSection(),
    _wanderingBowMakerSection(),
    _imperialCheeseMerchantSection(),
    _wanderingThatcherSection(),
    _imperialMillstoneCutterSection(),
    _wanderingPeatCutterSection(),
    _imperialIconPainterSection(),
    _wanderingWaxTabletMakerSection(),
    _wanderingNetMakerSection(),
    _wanderingDrumMakerSection(),
    _imperialHerbariumKeeperSection(),
    _wanderingSpearMakerSection(),
    _imperialRobeMakerSection(),
    _wanderingFletcherSection(),
    _imperialKnifesmithSection(),
    _wanderingSailMakerSection(),
    _imperialChariotBuilderSection(),
    _wanderingSeedMerchantSection(),
    _imperialSilkscreenPainterSection(),
    _wanderingWoodcutterSection(),
    _imperialMasonsGuildSection(),
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

// ── T313 Wandering Navigator ─────────────────────────────────────────

function _wanderingNavigatorSection() {
  if (!Navigator.getActiveNavigator()) return '';
  const secs       = Navigator.getNavigatorSecsLeft();
  const wood       = Math.floor(state.resources.wood ?? 0);
  const gold       = Math.floor(state.resources.gold ?? 0);
  const mana       = Math.floor(state.resources.mana ?? 0);
  const canCharts  = wood >= Navigator.NAV_WOOD_COST && gold >= Navigator.NAV_GOLD_COST;
  const canSecrets = mana >= Navigator.SECRETS_MANA_COST;
  const urg = secs <= 15 ? ' navigator-timer--urgent' : '';
  return `
    <div class="navigator-section--active">
      <div class="navigator-header">
        <span class="navigator-title">🧭 Wandering Navigator</span>
        <span class="navigator-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="navigator-desc">A seasoned navigator arrives bearing hand-drawn sea charts and maritime secrets from uncharted shores, offering to share hard-won knowledge of coastal trade routes.</div>
      <div class="navigator-actions">
        <button class="btn--navigator-charts${canCharts ? '' : ' btn--disabled'}" data-action="navigator-charts" ${canCharts ? '' : 'disabled'}>
          🧭 Commission Sea Charts — ${Navigator.NAV_WOOD_COST}🪵 + ${Navigator.NAV_GOLD_COST}💰
          <span class="navigator-cost">→ +${Navigator.NAV_WOOD_RATE} wood/s (2.5 min) · +${Navigator.NAV_PRESTIGE_REWARD} prestige · +${Navigator.NAV_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--navigator-secrets${canSecrets ? '' : ' btn--disabled'}" data-action="navigator-secrets" ${canSecrets ? '' : 'disabled'}>
          🌊 Exchange Navigation Secrets — ${Navigator.SECRETS_MANA_COST}✨
          <span class="navigator-cost">→ +${Navigator.SECRETS_MANA_RATE} mana/s (2 min) · +${Navigator.SECRETS_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--navigator-away" data-action="navigator-away">
          🚶 Send Away
          <span class="navigator-cost">→ Navigator sails toward distant shores</span>
        </button>
      </div>
    </div>`;
}

// ── T314 Traveling Illuminator ─────────────────────────────────────────

function _travelingIlluminatorSection() {
  if (!Illuminator.getActiveIlluminator()) return '';
  const secs       = Illuminator.getIlluminatorSecsLeft();
  const mana       = Math.floor(state.resources.mana ?? 0);
  const gold       = Math.floor(state.resources.gold ?? 0);
  const canCodex   = mana >= Illuminator.CODEX_MANA_COST && gold >= Illuminator.CODEX_GOLD_COST;
  const canScripts = gold >= Illuminator.SCRIPTS_GOLD_COST;
  const urg = secs <= 15 ? ' illuminator-timer--urgent' : '';
  return `
    <div class="illuminator-section--active">
      <div class="illuminator-header">
        <span class="illuminator-title">📜 Traveling Illuminator</span>
        <span class="illuminator-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="illuminator-desc">A skilled illuminator arrives with gilded manuscripts and devotional codices adorned with gold leaf and lapis lazuli, offering to create illuminated records of the empire's greatest achievements.</div>
      <div class="illuminator-actions">
        <button class="btn--illuminator-codex${canCodex ? '' : ' btn--disabled'}" data-action="illuminator-codex" ${canCodex ? '' : 'disabled'}>
          📜 Commission Illuminated Codex — ${Illuminator.CODEX_MANA_COST}✨ + ${Illuminator.CODEX_GOLD_COST}💰
          <span class="illuminator-cost">→ +${Illuminator.CODEX_MANA_RATE} mana/s (2.5 min) · +${Illuminator.CODEX_PRESTIGE_REWARD} prestige · +${Illuminator.CODEX_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--illuminator-scripts${canScripts ? '' : ' btn--disabled'}" data-action="illuminator-scripts" ${canScripts ? '' : 'disabled'}>
          ✍️ Purchase Gilded Scripts — ${Illuminator.SCRIPTS_GOLD_COST}💰
          <span class="illuminator-cost">→ +${Illuminator.SCRIPTS_GOLD_RATE} gold/s (2 min) · +${Illuminator.SCRIPTS_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--illuminator-away" data-action="illuminator-away">
          🚶 Send Away
          <span class="illuminator-cost">→ Illuminator departs for another court</span>
        </button>
      </div>
    </div>`;
}

// ── T315 Ancient Ritual Leader ─────────────────────────────────────────

function _ancientRitualLeaderSection() {
  if (!RitualLeader.getActiveRitualLeader()) return '';
  const secs          = RitualLeader.getRitualLeaderSecsLeft();
  const mana          = Math.floor(state.resources.mana ?? 0);
  const food          = Math.floor(state.resources.food ?? 0);
  const canCeremony   = mana >= RitualLeader.CEREMONY_MANA_COST;
  const canDonation   = food >= RitualLeader.DONATION_FOOD_COST;
  const urg = secs <= 15 ? ' ritual-timer--urgent' : '';
  return `
    <div class="ritual-section--active">
      <div class="ritual-header">
        <span class="ritual-title">🔥 Ancient Ritual Leader</span>
        <span class="ritual-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="ritual-desc">An ancient ritual leader arrives bearing sacred ceremonial vestments and time-worn relics, offering to lead the empire in ancient rites of power and prosperity.</div>
      <div class="ritual-actions">
        <button class="btn--ritual-ceremony${canCeremony ? '' : ' btn--disabled'}" data-action="ritual-ceremony" ${canCeremony ? '' : 'disabled'}>
          🔥 Conduct Imperial Ceremony — ${RitualLeader.CEREMONY_MANA_COST}✨
          <span class="ritual-cost">→ +${RitualLeader.CEREMONY_MANA_RATE} mana/s (2.5 min) · +${RitualLeader.CEREMONY_PRESTIGE_REWARD} prestige · +${RitualLeader.CEREMONY_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--ritual-donation${canDonation ? '' : ' btn--disabled'}" data-action="ritual-donation" ${canDonation ? '' : 'disabled'}>
          🍖 Donate Sacred Relics — ${RitualLeader.DONATION_FOOD_COST}🌾
          <span class="ritual-cost">→ +${RitualLeader.DONATION_FOOD_RATE} food/s (2 min) · +${RitualLeader.DONATION_PRESTIGE_REWARD} prestige · +${RitualLeader.DONATION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--ritual-decline" data-action="ritual-decline">
          🚶 Decline Invitation
          <span class="ritual-cost">→ Ritual leader departs respectfully</span>
        </button>
      </div>
    </div>`;
}

// ── T316 Mountain Prospector ─────────────────────────────────────────

function _mountainProspectorSection() {
  if (!MtProspector.getActiveMountainProspector()) return '';
  const secs            = MtProspector.getMountainProspectorSecsLeft();
  const gold            = Math.floor(state.resources.gold ?? 0);
  const stone           = Math.floor(state.resources.stone ?? 0);
  const canExpedition   = gold >= MtProspector.EXPEDITION_GOLD_COST;
  const canMaps         = stone >= MtProspector.MAPS_STONE_COST;
  const urg = secs <= 15 ? ' prospector-timer--urgent' : '';
  return `
    <div class="prospector-section--active">
      <div class="prospector-header">
        <span class="prospector-title">⛏️ Mountain Prospector</span>
        <span class="prospector-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="prospector-desc">A weathered mountain prospector arrives with ore samples and geological surveys of rich mineral deposits in the nearby highlands, seeking imperial backing for a major mining expedition.</div>
      <div class="prospector-actions">
        <button class="btn--prospector-expedition${canExpedition ? '' : ' btn--disabled'}" data-action="prospector-expedition" ${canExpedition ? '' : 'disabled'}>
          ⛏️ Fund Mining Expedition — ${MtProspector.EXPEDITION_GOLD_COST}💰
          <span class="prospector-cost">→ +${MtProspector.EXPEDITION_IRON_RATE} iron/s (2.5 min) · +${MtProspector.EXPEDITION_PRESTIGE_REWARD} prestige · +${MtProspector.EXPEDITION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--prospector-maps${canMaps ? '' : ' btn--disabled'}" data-action="prospector-maps" ${canMaps ? '' : 'disabled'}>
          🗺️ Share Ore Maps — ${MtProspector.MAPS_STONE_COST}🪨
          <span class="prospector-cost">→ +${MtProspector.MAPS_STONE_RATE} stone/s (2 min) · +${MtProspector.MAPS_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--prospector-away" data-action="prospector-away">
          🚶 Send Away
          <span class="prospector-cost">→ Prospector returns to the highlands</span>
        </button>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// T317 — Wandering Leatherworker
// ---------------------------------------------------------------------------

function _wanderingLeatherworkerSection() {
  if (!Leatherworker.getActiveWanderingLeatherworker()) return '';
  const secs        = Leatherworker.getWanderingLeatherworkerSecsLeft();
  const food        = Math.floor(state.resources.food ?? 0);
  const gold        = Math.floor(state.resources.gold ?? 0);
  const canSaddles  = food >= Leatherworker.SADDLES_FOOD_COST && gold >= Leatherworker.SADDLES_GOLD_COST;
  const canLeather  = food >= Leatherworker.LEATHER_FOOD_COST;
  const urg = secs <= 15 ? ' leatherworker-timer--urgent' : '';
  return `
    <div class="leatherworker-section--active">
      <div class="leatherworker-header">
        <span class="leatherworker-title">🐎 Wandering Leatherworker</span>
        <span class="leatherworker-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="leatherworker-desc">A skilled leatherworker arrives with supple hides, ornate saddles, and finely crafted leather goods. They offer their expertise to the imperial household.</div>
      <div class="leatherworker-actions">
        <button class="btn--leatherworker-saddles${canSaddles ? '' : ' btn--disabled'}" data-action="leatherworker-saddles" ${canSaddles ? '' : 'disabled'}>
          🐎 Commission Imperial Saddles — ${Leatherworker.SADDLES_FOOD_COST}🍎 + ${Leatherworker.SADDLES_GOLD_COST}💰
          <span class="leatherworker-cost">→ +${Leatherworker.SADDLES_FOOD_RATE} food/s (2.5 min) · +${Leatherworker.SADDLES_PRESTIGE_REWARD} prestige · +${Leatherworker.SADDLES_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--leatherworker-trade${canLeather ? '' : ' btn--disabled'}" data-action="leatherworker-trade" ${canLeather ? '' : 'disabled'}>
          🛒 Trade for Leather Goods — ${Leatherworker.LEATHER_FOOD_COST}🍎
          <span class="leatherworker-cost">→ +${Leatherworker.LEATHER_GOLD_RATE} gold/s (2 min) · +${Leatherworker.LEATHER_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--leatherworker-away" data-action="leatherworker-away">
          🚶 Send Away
          <span class="leatherworker-cost">→ Leatherworker continues on the trade road</span>
        </button>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// T318 — Royal Apothecary
// ---------------------------------------------------------------------------

function _royalApothecarySection() {
  if (!Apothecary.getActiveRoyalApothecary()) return '';
  const secs         = Apothecary.getRoyalApothecarySecsLeft();
  const mana         = Math.floor(state.resources.mana ?? 0);
  const gold         = Math.floor(state.resources.gold ?? 0);
  const food         = Math.floor(state.resources.food ?? 0);
  const canRemedies  = mana >= Apothecary.REMEDIES_MANA_COST && gold >= Apothecary.REMEDIES_GOLD_COST;
  const canPotions   = food >= Apothecary.POTIONS_FOOD_COST;
  const urg = secs <= 15 ? ' apothecary-timer--urgent' : '';
  return `
    <div class="apothecary-section--active">
      <div class="apothecary-header">
        <span class="apothecary-title">⚗️ Royal Apothecary</span>
        <span class="apothecary-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="apothecary-desc">A renowned royal apothecary arrives bearing rare alchemical preparations, exotic remedies, and mystical potions gathered from distant lands.</div>
      <div class="apothecary-actions">
        <button class="btn--apothecary-remedies${canRemedies ? '' : ' btn--disabled'}" data-action="apothecary-remedies" ${canRemedies ? '' : 'disabled'}>
          ⚗️ Commission Imperial Remedies — ${Apothecary.REMEDIES_MANA_COST}✨ + ${Apothecary.REMEDIES_GOLD_COST}💰
          <span class="apothecary-cost">→ +${Apothecary.REMEDIES_MANA_RATE} mana/s (2.5 min) · +${Apothecary.REMEDIES_PRESTIGE_REWARD} prestige · +${Apothecary.REMEDIES_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--apothecary-potions${canPotions ? '' : ' btn--disabled'}" data-action="apothecary-potions" ${canPotions ? '' : 'disabled'}>
          🌿 Purchase Exotic Potions — ${Apothecary.POTIONS_FOOD_COST}🍎
          <span class="apothecary-cost">→ +${Apothecary.POTIONS_FOOD_RATE} food/s (2 min) · +${Apothecary.POTIONS_PRESTIGE_REWARD} prestige · +${Apothecary.POTIONS_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--apothecary-away" data-action="apothecary-away">
          🚶 Send Away
          <span class="apothecary-cost">→ Apothecary departs to other noble courts</span>
        </button>
      </div>
    </div>`;
}

// ── T319 Wandering Fishmonger ────────────────────────────────────────

function _wanderingFishmongerSection() {
  if (!Fishmonger.getActiveWanderingFishmonger()) return '';
  const secs        = Fishmonger.getWanderingFishmongerSecsLeft();
  const gold        = Math.floor(state.resources.gold ?? 0);
  const wood        = Math.floor(state.resources.wood ?? 0);
  const canPurchase = gold >= Fishmonger.PURCHASE_GOLD_COST;
  const canTrade    = wood >= Fishmonger.TRADE_WOOD_COST;
  const urg = secs <= 15 ? ' fishmonger-timer--urgent' : '';
  return `
    <div class="fishmonger-section--active">
      <div class="fishmonger-header">
        <span class="fishmonger-title">🐟 Wandering Fishmonger</span>
        <span class="fishmonger-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="fishmonger-desc">A wandering fishmonger arrives with laden baskets of fresh river fish and expertly cured dried seafood from distant waterways.</div>
      <div class="fishmonger-actions">
        <button class="btn--fishmonger-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="fishmonger-purchase" ${canPurchase ? '' : 'disabled'}>
          🐟 Purchase Fresh Catch — ${Fishmonger.PURCHASE_GOLD_COST}💰
          <span class="fishmonger-cost">→ +${Fishmonger.PURCHASE_FOOD_RATE} food/s (2.5 min) · +${Fishmonger.PURCHASE_PRESTIGE_REWARD} prestige · +${Fishmonger.PURCHASE_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--fishmonger-trade${canTrade ? '' : ' btn--disabled'}" data-action="fishmonger-trade" ${canTrade ? '' : 'disabled'}>
          🐠 Trade for Dried Fish — ${Fishmonger.TRADE_WOOD_COST}🌲
          <span class="fishmonger-cost">→ +${Fishmonger.TRADE_FOOD_RATE} food/s (2 min) · +${Fishmonger.TRADE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--fishmonger-away" data-action="fishmonger-away">
          🚶 Send Away
          <span class="fishmonger-cost">→ Fishmonger continues down the road</span>
        </button>
      </div>
    </div>`;
}

// ── T320 Imperial Chandler ───────────────────────────────────────────

function _imperialChandlerSection() {
  if (!Chandler.getActiveImperialChandler()) return '';
  const secs           = Chandler.getImperialChandlerSecsLeft();
  const wood           = Math.floor(state.resources.wood ?? 0);
  const food           = Math.floor(state.resources.food ?? 0);
  const gold           = Math.floor(state.resources.gold ?? 0);
  const canCommission  = wood >= Chandler.COMMISSION_WOOD_COST && food >= Chandler.COMMISSION_FOOD_COST;
  const canPurchase    = gold >= Chandler.PURCHASE_GOLD_COST;
  const urg = secs <= 15 ? ' chandler-timer--urgent' : '';
  return `
    <div class="chandler-section--active">
      <div class="chandler-header">
        <span class="chandler-title">🕯️ Imperial Chandler</span>
        <span class="chandler-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="chandler-desc">An imperial chandler arrives bearing exquisitely crafted beeswax candles and luminous lanterns of unparalleled quality to illuminate the empire.</div>
      <div class="chandler-actions">
        <button class="btn--chandler-commission${canCommission ? '' : ' btn--disabled'}" data-action="chandler-commission" ${canCommission ? '' : 'disabled'}>
          🕯️ Commission Candle Works — ${Chandler.COMMISSION_WOOD_COST}🌲 + ${Chandler.COMMISSION_FOOD_COST}🍎
          <span class="chandler-cost">→ +${Chandler.COMMISSION_FOOD_RATE} food/s (2.5 min) · +${Chandler.COMMISSION_PRESTIGE_REWARD} prestige · +${Chandler.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--chandler-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="chandler-purchase" ${canPurchase ? '' : 'disabled'}>
          💛 Purchase Fine Candles — ${Chandler.PURCHASE_GOLD_COST}💰
          <span class="chandler-cost">→ +${Chandler.PURCHASE_GOLD_RATE} gold/s (2 min) · +${Chandler.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--chandler-away" data-action="chandler-away">
          🚶 Send Away
          <span class="chandler-cost">→ Chandler departs to other noble patrons</span>
        </button>
      </div>
    </div>`;
}

// ── T321 Royal Lamplighter ───────────────────────────────────────────

function _royalLamplighterSection() {
  if (!Lamplighter.getActiveRoyalLamplighter()) return '';
  const secs      = Lamplighter.getRoyalLamplighterSecsLeft();
  const wood      = Math.floor(state.resources.wood ?? 0);
  const gold      = Math.floor(state.resources.gold ?? 0);
  const canEstablish = wood >= Lamplighter.ESTABLISH_WOOD_COST && gold >= Lamplighter.ESTABLISH_GOLD_COST;
  const canPurchase  = gold >= Lamplighter.PURCHASE_GOLD_COST;
  const urg = secs <= 15 ? ' lamplighter-timer--urgent' : '';
  return `
    <div class="lamplighter-section--active">
      <div class="lamplighter-header">
        <span class="lamplighter-title">🏮 Royal Lamplighter</span>
        <span class="lamplighter-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="lamplighter-desc">A royal lamplighter arrives bearing exquisite oil lanterns and a proposal to illuminate the imperial city streets with warm golden light.</div>
      <div class="lamplighter-actions">
        <button class="btn--lamplighter-establish${canEstablish ? '' : ' btn--disabled'}" data-action="lamplighter-establish" ${canEstablish ? '' : 'disabled'}>
          🏮 Establish Lamp District — ${Lamplighter.ESTABLISH_WOOD_COST}🌲 + ${Lamplighter.ESTABLISH_GOLD_COST}💰
          <span class="lamplighter-cost">→ +${Lamplighter.ESTABLISH_WOOD_RATE} wood/s (2.5 min) · +${Lamplighter.ESTABLISH_PRESTIGE_REWARD} prestige · +${Lamplighter.ESTABLISH_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--lamplighter-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="lamplighter-purchase" ${canPurchase ? '' : 'disabled'}>
          💡 Purchase Street Lanterns — ${Lamplighter.PURCHASE_GOLD_COST}💰
          <span class="lamplighter-cost">→ +${Lamplighter.PURCHASE_GOLD_RATE} gold/s (2 min) · +${Lamplighter.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--lamplighter-away" data-action="lamplighter-away">
          🚶 Send Away
          <span class="lamplighter-cost">→ Lamplighter departs to illuminate other districts</span>
        </button>
      </div>
    </div>`;
}

// ── T322 Wandering Cooper ────────────────────────────────────────────

function _wanderingCooperSection() {
  if (!Cooper.getActiveWanderingCooper()) return '';
  const secs        = Cooper.getWanderingCooperSecsLeft();
  const wood        = Math.floor(state.resources.wood ?? 0);
  const food        = Math.floor(state.resources.food ?? 0);
  const gold        = Math.floor(state.resources.gold ?? 0);
  const canCommission = wood >= Cooper.COMMISSION_WOOD_COST && food >= Cooper.COMMISSION_FOOD_COST;
  const canPurchase   = gold >= Cooper.PURCHASE_GOLD_COST;
  const urg = secs <= 15 ? ' cooper-timer--urgent' : '';
  return `
    <div class="cooper-section--active">
      <div class="cooper-header">
        <span class="cooper-title">🪣 Wandering Cooper</span>
        <span class="cooper-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="cooper-desc">A wandering cooper arrives bearing a wagon of expertly crafted storage barrels, casks, and tuns, ready to expand the empire's storage capacity.</div>
      <div class="cooper-actions">
        <button class="btn--cooper-commission${canCommission ? '' : ' btn--disabled'}" data-action="cooper-commission" ${canCommission ? '' : 'disabled'}>
          🪣 Commission Storage Barrels — ${Cooper.COMMISSION_WOOD_COST}🌲 + ${Cooper.COMMISSION_FOOD_COST}🍎
          <span class="cooper-cost">→ +${Cooper.COMMISSION_FOOD_RATE} food/s (2.5 min) · +${Cooper.COMMISSION_PRESTIGE_REWARD} prestige · +${Cooper.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--cooper-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="cooper-purchase" ${canPurchase ? '' : 'disabled'}>
          📜 Purchase Cooperage Secrets — ${Cooper.PURCHASE_GOLD_COST}💰
          <span class="cooper-cost">→ +${Cooper.PURCHASE_WOOD_RATE} wood/s (2 min) · +${Cooper.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--cooper-away" data-action="cooper-away">
          🚶 Send Away
          <span class="cooper-cost">→ Cooper continues down the road to the next settlement</span>
        </button>
      </div>
    </div>`;
}

// ── T323 Wandering Rope Maker ─────────────────────────────────────────────

function _wanderingRopeMakerSection() {
  if (!RopeMaker.getActiveWanderingRopeMaker()) return '';
  const secs         = RopeMaker.getWanderingRopeMakerSecsLeft();
  const wood         = Math.floor(state.resources.wood ?? 0);
  const food         = Math.floor(state.resources.food ?? 0);
  const gold         = Math.floor(state.resources.gold ?? 0);
  const canCommission = wood >= RopeMaker.COMMISSION_WOOD_COST && food >= RopeMaker.COMMISSION_FOOD_COST;
  const canPurchase   = gold >= RopeMaker.PURCHASE_GOLD_COST;
  const urg = secs <= 15 ? ' ropemaker-timer--urgent' : '';
  return `
    <div class="ropemaker-section--active">
      <div class="ropemaker-header">
        <span class="ropemaker-title">🪢 Wandering Rope Maker</span>
        <span class="ropemaker-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="ropemaker-desc">A wandering rope maker arrives bearing coils of expertly braided hemp, flax, and silk rope, offering to craft ship rigging or share ancient rope-making lore with the empire.</div>
      <div class="ropemaker-actions">
        <button class="btn--ropemaker-commission${canCommission ? '' : ' btn--disabled'}" data-action="ropemaker-commission" ${canCommission ? '' : 'disabled'}>
          🪢 Commission Ship Rigging — ${RopeMaker.COMMISSION_WOOD_COST}🪵 + ${RopeMaker.COMMISSION_FOOD_COST}🌾
          <span class="ropemaker-cost">→ +${RopeMaker.COMMISSION_WOOD_RATE} wood/s (2.5 min) · +${RopeMaker.COMMISSION_PRESTIGE_REWARD} prestige · +${RopeMaker.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--ropemaker-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="ropemaker-purchase" ${canPurchase ? '' : 'disabled'}>
          📜 Purchase Rope-Making Lore — ${RopeMaker.PURCHASE_GOLD_COST}💰
          <span class="ropemaker-cost">→ +${RopeMaker.PURCHASE_FOOD_RATE} food/s (2 min) · +${RopeMaker.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--ropemaker-away" data-action="ropemaker-away">
          🚶 Send Away
          <span class="ropemaker-cost">→ Rope maker sets off toward the harbour district</span>
        </button>
      </div>
    </div>`;
}

// ── T324 Imperial Salt Merchant ───────────────────────────────────────────

function _imperialSaltMerchantSection() {
  if (!SaltMerchant.getActiveImperialSaltMerchant()) return '';
  const secs      = SaltMerchant.getImperialSaltMerchantSecsLeft();
  const food      = Math.floor(state.resources.food ?? 0);
  const gold      = Math.floor(state.resources.gold ?? 0);
  const canRoute  = food >= SaltMerchant.ROUTE_FOOD_COST && gold >= SaltMerchant.ROUTE_GOLD_COST;
  const canBuy    = gold >= SaltMerchant.RESERVES_GOLD_COST;
  const urg = secs <= 15 ? ' salt-timer--urgent' : '';
  return `
    <div class="salt-section--active">
      <div class="salt-header">
        <span class="salt-title">🧂 Imperial Salt Merchant</span>
        <span class="salt-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="salt-desc">An imperial salt merchant arrives with a caravan of salt-filled casks from coastal mines and inland deposits, offering a lucrative trade route or premium salt reserves.</div>
      <div class="salt-actions">
        <button class="btn--salt-route${canRoute ? '' : ' btn--disabled'}" data-action="salt-route" ${canRoute ? '' : 'disabled'}>
          🧂 Establish Salt Trade Route — ${SaltMerchant.ROUTE_FOOD_COST}🌾 + ${SaltMerchant.ROUTE_GOLD_COST}💰
          <span class="salt-cost">→ +${SaltMerchant.ROUTE_FOOD_RATE} food/s (2.5 min) · +${SaltMerchant.ROUTE_PRESTIGE_REWARD} prestige · +${SaltMerchant.ROUTE_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--salt-reserves${canBuy ? '' : ' btn--disabled'}" data-action="salt-reserves" ${canBuy ? '' : 'disabled'}>
          💰 Purchase Salt Reserves — ${SaltMerchant.RESERVES_GOLD_COST}💰
          <span class="salt-cost">→ +${SaltMerchant.RESERVES_GOLD_RATE} gold/s (2 min) · +${SaltMerchant.RESERVES_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--salt-away" data-action="salt-away">
          🚶 Send Away
          <span class="salt-cost">→ Merchant departs for other trading partners</span>
        </button>
      </div>
    </div>`;
}

// ── T325 Wandering Puppeteer ──────────────────────────────────────────────

function _wanderingPuppeteerSection() {
  if (!Puppeteer.getActiveWanderingPuppeteer()) return '';
  const secs         = Puppeteer.getWanderingPuppeteerSecsLeft();
  const gold         = Math.floor(state.resources.gold ?? 0);
  const canPageant   = gold >= Puppeteer.PAGEANT_GOLD_COST;
  const urg = secs <= 15 ? ' puppet-timer--urgent' : '';
  return `
    <div class="puppet-section--active">
      <div class="puppet-header">
        <span class="puppet-title">🎭 Wandering Puppeteer</span>
        <span class="puppet-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="puppet-desc">A skilled wandering puppeteer arrives with elaborate marionettes and shadow-play apparatus, offering breathtaking performances for the empire's entertainment.</div>
      <div class="puppet-actions">
        <button class="btn--puppet-pageant${canPageant ? '' : ' btn--disabled'}" data-action="puppet-pageant" ${canPageant ? '' : 'disabled'}>
          🎭 Commission Imperial Pageant — ${Puppeteer.PAGEANT_GOLD_COST}💰
          <span class="puppet-cost">→ +${Puppeteer.PAGEANT_GOLD_RATE} gold/s (2.5 min) · +${Puppeteer.PAGEANT_PRESTIGE_REWARD} prestige · +${Puppeteer.PAGEANT_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--puppet-show" data-action="puppet-show">
          🎪 Host Village Performance — Free
          <span class="puppet-cost">→ +${Puppeteer.PERFORMANCE_MORALE_REWARD} morale · +${Puppeteer.PERFORMANCE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--puppet-away" data-action="puppet-away">
          🚶 Send Away
          <span class="puppet-cost">→ Puppeteer moves on to the next kingdom</span>
        </button>
      </div>
    </div>`;
}

// ── T326 Ancient Rune Carver ──────────────────────────────────────────────

function _ancientRuneCarverSection() {
  if (!RuneCarver.getActiveAncientRuneCarver()) return '';
  const secs           = RuneCarver.getAncientRuneCarverSecsLeft();
  const stone          = Math.floor(state.resources.stone ?? 0);
  const mana           = Math.floor(state.resources.mana  ?? 0);
  const canInscribe    = stone >= RuneCarver.INSCRIPTIONS_STONE_COST && mana >= RuneCarver.INSCRIPTIONS_MANA_COST;
  const canStudy       = mana  >= RuneCarver.LORE_MANA_COST;
  const urg = secs <= 15 ? ' rune-timer--urgent' : '';
  return `
    <div class="rune-section--active">
      <div class="rune-header">
        <span class="rune-title">🪨 Ancient Rune Carver</span>
        <span class="rune-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="rune-desc">A mysterious rune carver bearing worn stone tablets etched with forgotten inscriptions offers to strengthen the empire's stoneworks or share their arcane knowledge.</div>
      <div class="rune-actions">
        <button class="btn--rune-inscribe${canInscribe ? '' : ' btn--disabled'}" data-action="rune-inscribe" ${canInscribe ? '' : 'disabled'}>
          🪨 Commission Runic Inscriptions — ${RuneCarver.INSCRIPTIONS_STONE_COST}🪨 + ${RuneCarver.INSCRIPTIONS_MANA_COST}✨
          <span class="rune-cost">→ +${RuneCarver.INSCRIPTIONS_STONE_RATE} stone/s (2.5 min) · +${RuneCarver.INSCRIPTIONS_PRESTIGE_REWARD} prestige · +${RuneCarver.INSCRIPTIONS_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--rune-lore${canStudy ? '' : ' btn--disabled'}" data-action="rune-lore" ${canStudy ? '' : 'disabled'}>
          📜 Learn Rune Lore — ${RuneCarver.LORE_MANA_COST}✨
          <span class="rune-cost">→ +${RuneCarver.LORE_MANA_RATE} mana/s (2 min) · +${RuneCarver.LORE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--rune-away" data-action="rune-away">
          🚶 Send Away
          <span class="rune-cost">→ Rune carver departs with their forgotten knowledge</span>
        </button>
      </div>
    </div>`;
}

// ── T327 Wandering Cartwright ────────────────────────────────────────────────

function _wanderingCartwrightSection() {
  if (!Cartwright.getActiveWanderingCartwright()) return '';
  const secs         = Cartwright.getCartwrightSecsLeft();
  const wood         = Math.floor(state.resources.wood ?? 0);
  const food         = Math.floor(state.resources.food ?? 0);
  const gold         = Math.floor(state.resources.gold ?? 0);
  const canCommission = wood >= Cartwright.COMMISSION_WOOD_COST && food >= Cartwright.COMMISSION_FOOD_COST;
  const canLearn     = gold >= Cartwright.PURCHASE_GOLD_COST;
  const urg = secs <= 15 ? ' cartwright-timer--urgent' : '';
  return `
    <div class="cartwright-section--active">
      <div class="cartwright-header">
        <span class="cartwright-title">🛒 Wandering Cartwright</span>
        <span class="cartwright-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="cartwright-desc">A skilled wandering cartwright arrives bearing finely crafted wagon wheels and trade cart designs. Their expertise could boost imperial commerce and timber transport.</div>
      <div class="cartwright-actions">
        <button class="btn--cartwright-commission${canCommission ? '' : ' btn--disabled'}" data-action="cartwright-commission" ${canCommission ? '' : 'disabled'}>
          🛒 Commission Trade Wagons — ${Cartwright.COMMISSION_WOOD_COST}\u{1FAB5} + ${Cartwright.COMMISSION_FOOD_COST}\u{1F33E}
          <span class="cartwright-cost">→ +${Cartwright.COMMISSION_WOOD_RATE} wood/s (2.5 min) · +${Cartwright.COMMISSION_PRESTIGE_REWARD} prestige · +${Cartwright.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--cartwright-learn${canLearn ? '' : ' btn--disabled'}" data-action="cartwright-learn" ${canLearn ? '' : 'disabled'}>
          📜 Learn Wheel-Making Craft — ${Cartwright.PURCHASE_GOLD_COST}\u{1F4B0}
          <span class="cartwright-cost">→ +${Cartwright.PURCHASE_GOLD_RATE} gold/s (2 min) · +${Cartwright.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--cartwright-away" data-action="cartwright-away">
          🚶 Send Away
          <span class="cartwright-cost">→ Cartwright trundles off to other settlements</span>
        </button>
      </div>
    </div>`;
}

// ── T328 Imperial Farrier ────────────────────────────────────────────────────

function _imperialFarrierSection() {
  if (!Farrier.getActiveImperialFarrier()) return '';
  const secs         = Farrier.getFarrierSecsLeft();
  const iron         = Math.floor(state.resources.iron ?? 0);
  const food         = Math.floor(state.resources.food ?? 0);
  const gold         = Math.floor(state.resources.gold ?? 0);
  const canCommission = iron >= Farrier.COMMISSION_IRON_COST && food >= Farrier.COMMISSION_FOOD_COST;
  const canPurchase  = gold >= Farrier.PURCHASE_GOLD_COST;
  const urg = secs <= 15 ? ' farrier-timer--urgent' : '';
  return `
    <div class="farrier-section--active">
      <div class="farrier-header">
        <span class="farrier-title">🐴 Imperial Farrier</span>
        <span class="farrier-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="farrier-desc">A renowned imperial farrier arrives bearing a portable forge and a collection of precision horseshoes. Their skills could strengthen the cavalry or improve imperial livestock health.</div>
      <div class="farrier-actions">
        <button class="btn--farrier-commission${canCommission ? '' : ' btn--disabled'}" data-action="farrier-commission" ${canCommission ? '' : 'disabled'}>
          🐴 Commission Cavalry Horseshoes — ${Farrier.COMMISSION_IRON_COST}⚙️ + ${Farrier.COMMISSION_FOOD_COST}\u{1F33E}
          <span class="farrier-cost">→ +${Farrier.COMMISSION_IRON_RATE} iron/s (2.5 min) · +${Farrier.COMMISSION_PRESTIGE_REWARD} prestige · +${Farrier.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--farrier-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="farrier-purchase" ${canPurchase ? '' : 'disabled'}>
          📜 Purchase Farriery Secrets — ${Farrier.PURCHASE_GOLD_COST}\u{1F4B0}
          <span class="farrier-cost">→ +${Farrier.PURCHASE_FOOD_RATE} food/s (2 min) · +${Farrier.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--farrier-away" data-action="farrier-away">
          🚶 Send Away
          <span class="farrier-cost">→ Farrier departs to other imperial courts</span>
        </button>
      </div>
    </div>`;
}

// ── T329 Wandering Cobbler ────────────────────────────────────────────────────

function _wanderingCobblerSection() {
  if (!Cobbler.getActiveWanderingCobbler()) return '';
  const secs         = Cobbler.getCobblerSecsLeft();
  const food         = Math.floor(state.resources.food ?? 0);
  const wood         = Math.floor(state.resources.wood ?? 0);
  const gold         = Math.floor(state.resources.gold ?? 0);
  const canCommission = food >= Cobbler.COMMISSION_FOOD_COST && wood >= Cobbler.COMMISSION_WOOD_COST;
  const canPurchase  = gold >= Cobbler.PURCHASE_GOLD_COST;
  const urg = secs <= 15 ? ' cobbler-timer--urgent' : '';
  return `
    <div class="cobbler-section--active">
      <div class="cobbler-header">
        <span class="cobbler-title">👞 Wandering Cobbler</span>
        <span class="cobbler-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="cobbler-desc">A skilled wandering cobbler arrives bearing a workbench of fine tools and expertly crafted boots. Their mastery of footwear could boost imperial productivity or enrich the imperial treasury.</div>
      <div class="cobbler-actions">
        <button class="btn--cobbler-commission${canCommission ? '' : ' btn--disabled'}" data-action="cobbler-commission" ${canCommission ? '' : 'disabled'}>
          👞 Craft Imperial Footwear — ${Cobbler.COMMISSION_FOOD_COST}🌾 + ${Cobbler.COMMISSION_WOOD_COST}🪵
          <span class="cobbler-cost">→ +${Cobbler.COMMISSION_FOOD_RATE} food/s (2.5 min) · +${Cobbler.COMMISSION_PRESTIGE_REWARD} prestige · +${Cobbler.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--cobbler-learn${canPurchase ? '' : ' btn--disabled'}" data-action="cobbler-learn" ${canPurchase ? '' : 'disabled'}>
          📜 Share Cobbling Craft — ${Cobbler.PURCHASE_GOLD_COST}💰
          <span class="cobbler-cost">→ +${Cobbler.PURCHASE_GOLD_RATE} gold/s (2 min) · +${Cobbler.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--cobbler-away" data-action="cobbler-away">
          🚶 Send Away
          <span class="cobbler-cost">→ Cobbler sets off to other imperial settlements</span>
        </button>
      </div>
    </div>`;
}

// ── T330 Imperial Engraver ────────────────────────────────────────────────────

function _imperialEngraverSection() {
  if (!Engraver.getActiveImperialEngraver()) return '';
  const secs         = Engraver.getEngraverSecsLeft();
  const iron         = Math.floor(state.resources.iron ?? 0);
  const gold         = Math.floor(state.resources.gold ?? 0);
  const stone        = Math.floor(state.resources.stone ?? 0);
  const canCommission = iron >= Engraver.COMMISSION_IRON_COST && gold >= Engraver.COMMISSION_GOLD_COST;
  const canPurchase  = stone >= Engraver.PURCHASE_STONE_COST;
  const urg = secs <= 15 ? ' engraver-timer--urgent' : '';
  return `
    <div class="engraver-section--active">
      <div class="engraver-header">
        <span class="engraver-title">🪙 Imperial Engraver</span>
        <span class="engraver-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="engraver-desc">A master imperial engraver arrives bearing precision gravers and sample medallions of breathtaking artistry. Their skills could elevate the imperial currency or advance the stonecutting arts.</div>
      <div class="engraver-actions">
        <button class="btn--engraver-commission${canCommission ? '' : ' btn--disabled'}" data-action="engraver-commission" ${canCommission ? '' : 'disabled'}>
          🪙 Commission Coin Engravings — ${Engraver.COMMISSION_IRON_COST}⚙️ + ${Engraver.COMMISSION_GOLD_COST}💰
          <span class="engraver-cost">→ +${Engraver.COMMISSION_IRON_RATE} iron/s (2.5 min) · +${Engraver.COMMISSION_PRESTIGE_REWARD} prestige · +${Engraver.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--engraver-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="engraver-purchase" ${canPurchase ? '' : 'disabled'}>
          📜 Purchase Engraving Secrets — ${Engraver.PURCHASE_STONE_COST}🪨
          <span class="engraver-cost">→ +${Engraver.PURCHASE_STONE_RATE} stone/s (2 min) · +${Engraver.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--engraver-away" data-action="engraver-away">
          🚶 Send Away
          <span class="engraver-cost">→ Engraver departs to seek other worthy commissions</span>
        </button>
      </div>
    </div>`;
}

// ── T331 Wandering Tailor ────────────────────────────────────────────────────

function _wanderingTailorSection() {
  if (!Tailor.getActiveWanderingTailor()) return '';
  const secs          = Tailor.getTailorSecsLeft();
  const food          = Math.floor(state.resources.food ?? 0);
  const wood          = Math.floor(state.resources.wood ?? 0);
  const gold          = Math.floor(state.resources.gold ?? 0);
  const canCommission = food >= Tailor.COMMISSION_FOOD_COST && wood >= Tailor.COMMISSION_WOOD_COST;
  const canPurchase   = gold >= Tailor.PURCHASE_GOLD_COST;
  const urg = secs <= 15 ? ' tailor-timer--urgent' : '';
  return `
    <div class="tailor-section--active">
      <div class="tailor-header">
        <span class="tailor-title">🧵 Wandering Tailor</span>
        <span class="tailor-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="tailor-desc">A skilled wandering tailor arrives bearing bolts of fine cloth, precision needles, and imperial garment patterns. Their mastery of tailoring could clothe the realm in prestige or enrich the imperial treasury.</div>
      <div class="tailor-actions">
        <button class="btn--tailor-sew${canCommission ? '' : ' btn--disabled'}" data-action="tailor-sew" ${canCommission ? '' : 'disabled'}>
          🧵 Sew Imperial Garments — ${Tailor.COMMISSION_FOOD_COST}🌾 + ${Tailor.COMMISSION_WOOD_COST}🪵
          <span class="tailor-cost">→ +${Tailor.COMMISSION_FOOD_RATE} food/s (2.5 min) · +${Tailor.COMMISSION_PRESTIGE_REWARD} prestige · +${Tailor.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--tailor-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="tailor-purchase" ${canPurchase ? '' : 'disabled'}>
          📜 Purchase Tailoring Craft — ${Tailor.PURCHASE_GOLD_COST}💰
          <span class="tailor-cost">→ +${Tailor.PURCHASE_GOLD_RATE} gold/s (2 min) · +${Tailor.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--tailor-away" data-action="tailor-away">
          🚶 Send Away
          <span class="tailor-cost">→ Tailor heads off to other imperial settlements</span>
        </button>
      </div>
    </div>`;
}

// ── T332 Wandering Tinsmith ──────────────────────────────────────────────────

function _wanderingTinsmithSection() {
  if (!Tinsmith.getActiveWanderingTinsmith()) return '';
  const secs          = Tinsmith.getTinsmithSecsLeft();
  const iron          = Math.floor(state.resources.iron ?? 0);
  const gold          = Math.floor(state.resources.gold ?? 0);
  const wood          = Math.floor(state.resources.wood ?? 0);
  const canCommission = iron >= Tinsmith.COMMISSION_IRON_COST && gold >= Tinsmith.COMMISSION_GOLD_COST;
  const canPurchase   = wood >= Tinsmith.PURCHASE_WOOD_COST;
  const urg = secs <= 15 ? ' tinsmith-timer--urgent' : '';
  return `
    <div class="tinsmith-section--active">
      <div class="tinsmith-header">
        <span class="tinsmith-title">🔧 Wandering Tinsmith</span>
        <span class="tinsmith-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="tinsmith-desc">A skilled wandering tinsmith arrives bearing gleaming tin vessels, soldering tools, and alloy samples. Their craft could advance the imperial metalworks or inspire more efficient use of timber and resources.</div>
      <div class="tinsmith-actions">
        <button class="btn--tinsmith-commission${canCommission ? '' : ' btn--disabled'}" data-action="tinsmith-commission" ${canCommission ? '' : 'disabled'}>
          🔧 Commission Tin Vessels — ${Tinsmith.COMMISSION_IRON_COST}⚙️ + ${Tinsmith.COMMISSION_GOLD_COST}💰
          <span class="tinsmith-cost">→ +${Tinsmith.COMMISSION_IRON_RATE} iron/s (2.5 min) · +${Tinsmith.COMMISSION_PRESTIGE_REWARD} prestige · +${Tinsmith.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--tinsmith-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="tinsmith-purchase" ${canPurchase ? '' : 'disabled'}>
          📜 Purchase Tinsmithing Craft — ${Tinsmith.PURCHASE_WOOD_COST}🪵
          <span class="tinsmith-cost">→ +${Tinsmith.PURCHASE_WOOD_RATE} wood/s (2 min) · +${Tinsmith.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--tinsmith-away" data-action="tinsmith-away">
          🚶 Send Away
          <span class="tinsmith-cost">→ Tinsmith departs to seek other commissions</span>
        </button>
      </div>
    </div>`;
}

// ── T333 Wandering Miller ────────────────────────────────────────────────────

function _wanderingMillerSection() {
  if (!Miller.getActiveWanderingMiller()) return '';
  const secs          = Miller.getMillerSecsLeft();
  const food          = Math.floor(state.resources.food ?? 0);
  const gold          = Math.floor(state.resources.gold ?? 0);
  const canCommission = food >= Miller.COMMISSION_FOOD_COST;
  const canPurchase   = gold >= Miller.PURCHASE_GOLD_COST;
  const urg = secs <= 15 ? ' miller-timer--urgent' : '';
  return `
    <div class="miller-section--active">
      <div class="miller-header">
        <span class="miller-title">🌾 Wandering Miller</span>
        <span class="miller-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="miller-desc">A skilled wandering miller arrives bearing heavy millstones, fine grain sieves, and ancient recipes for producing the finest flour and grains. Their craft could greatly improve the empire's food production.</div>
      <div class="miller-actions">
        <button class="btn--miller-commission${canCommission ? '' : ' btn--disabled'}" data-action="miller-commission" ${canCommission ? '' : 'disabled'}>
          🌾 Commission Grain Milling — ${Miller.COMMISSION_FOOD_COST}🌾
          <span class="miller-cost">→ +${Miller.COMMISSION_FOOD_RATE} food/s (2.5 min) · +${Miller.COMMISSION_PRESTIGE_REWARD} prestige · +${Miller.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--miller-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="miller-purchase" ${canPurchase ? '' : 'disabled'}>
          📜 Purchase Milling Secrets — ${Miller.PURCHASE_GOLD_COST}💰
          <span class="miller-cost">→ +${Miller.PURCHASE_GOLD_RATE} gold/s (2 min) · +${Miller.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--miller-away" data-action="miller-away">
          🚶 Send Away
          <span class="miller-cost">→ Miller departs to seek other settlements</span>
        </button>
      </div>
    </div>`;
}

// ── T334 Imperial Courier ────────────────────────────────────────────────────

function _imperialCourierSection() {
  if (!Courier.getActiveImperialCourier()) return '';
  const secs          = Courier.getCourierSecsLeft();
  const gold          = Math.floor(state.resources.gold ?? 0);
  const mana          = Math.floor(state.resources.mana ?? 0);
  const canEstablish  = gold >= Courier.ESTABLISH_GOLD_COST;
  const canExchange   = mana >= Courier.EXCHANGE_MANA_COST;
  const urg = secs <= 15 ? ' courier-timer--urgent' : '';
  return `
    <div class="courier-section--active">
      <div class="courier-header">
        <span class="courier-title">📮 Imperial Courier</span>
        <span class="courier-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="courier-desc">An experienced imperial courier arrives bearing sealed diplomatic dispatches, route maps, and offers to establish a swift messenger network connecting every corner of the realm.</div>
      <div class="courier-actions">
        <button class="btn--courier-establish${canEstablish ? '' : ' btn--disabled'}" data-action="courier-establish" ${canEstablish ? '' : 'disabled'}>
          📮 Establish Postal Routes — ${Courier.ESTABLISH_GOLD_COST}💰
          <span class="courier-cost">→ +${Courier.ESTABLISH_GOLD_RATE} gold/s (2.5 min) · +${Courier.ESTABLISH_PRESTIGE_REWARD} prestige · +${Courier.ESTABLISH_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--courier-exchange${canExchange ? '' : ' btn--disabled'}" data-action="courier-exchange" ${canExchange ? '' : 'disabled'}>
          🔮 Exchange Intelligence Packets — ${Courier.EXCHANGE_MANA_COST}✨
          <span class="courier-cost">→ +${Courier.EXCHANGE_MANA_RATE} mana/s (2 min) · +${Courier.EXCHANGE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--courier-away" data-action="courier-away">
          🚶 Send Away
          <span class="courier-cost">→ Courier departs to continue their appointed rounds</span>
        </button>
      </div>
    </div>`;
}

// ── T335 Wandering Baker ─────────────────────────────────────────────────────

function _wanderingBakerSection() {
  if (!Baker.getActiveWanderingBaker()) return '';
  const secs       = Baker.getBakerSecsLeft();
  const food       = Math.floor(state.resources.food ?? 0);
  const gold       = Math.floor(state.resources.gold ?? 0);
  const canBake    = food >= Baker.BAKE_FOOD_COST;
  const canShare   = gold >= Baker.SHARE_GOLD_COST;
  const urg = secs <= 15 ? ' baker-timer--urgent' : '';
  return `
    <div class="baker-section--active">
      <div class="baker-header">
        <span class="baker-title">🥖 Wandering Baker</span>
        <span class="baker-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="baker-desc">A wandering baker arrives bearing heavy flour sacks, carved proving baskets, and ancient family recipes for breads and pastries beloved across many kingdoms. Their craft could nourish and enrich the empire.</div>
      <div class="baker-actions">
        <button class="btn--baker-bake${canBake ? '' : ' btn--disabled'}" data-action="baker-bake" ${canBake ? '' : 'disabled'}>
          🥖 Bake Imperial Bread — ${Baker.BAKE_FOOD_COST}🌾
          <span class="baker-cost">→ +${Baker.BAKE_FOOD_RATE} food/s (2.5 min) · +${Baker.BAKE_PRESTIGE_REWARD} prestige · +${Baker.BAKE_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--baker-share${canShare ? '' : ' btn--disabled'}" data-action="baker-share" ${canShare ? '' : 'disabled'}>
          📜 Share Baking Secrets — ${Baker.SHARE_GOLD_COST}💰
          <span class="baker-cost">→ +${Baker.SHARE_GOLD_RATE} gold/s (2 min) · +${Baker.SHARE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--baker-away" data-action="baker-away">
          🚶 Send Away
          <span class="baker-cost">→ Baker departs to seek other settlements on their circuit</span>
        </button>
      </div>
    </div>`;
}

// ── T336 Imperial Armorer ────────────────────────────────────────────────────

function _imperialArmorerSection() {
  if (!Armorer.getActiveImperialArmorer()) return '';
  const secs        = Armorer.getArmorerSecsLeft();
  const iron        = Math.floor(state.resources.iron ?? 0);
  const wood        = Math.floor(state.resources.wood ?? 0);
  const stone       = Math.floor(state.resources.stone ?? 0);
  const canForge    = iron >= Armorer.FORGE_IRON_COST && wood >= Armorer.FORGE_WOOD_COST;
  const canTech     = stone >= Armorer.TECHNIQUES_STONE_COST;
  const urg = secs <= 15 ? ' armorer-timer--urgent' : '';
  return `
    <div class="armorer-section--active">
      <div class="armorer-header">
        <span class="armorer-title">⚔️ Imperial Armorer</span>
        <span class="armorer-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="armorer-desc">A master imperial armorer arrives bearing expertly crafted plate armor, intricate chainmail patterns, and offers to forge premium protective gear for the empire's forces and military infrastructure.</div>
      <div class="armorer-actions">
        <button class="btn--armorer-forge${canForge ? '' : ' btn--disabled'}" data-action="armorer-forge" ${canForge ? '' : 'disabled'}>
          ⚔️ Forge Imperial Armor — ${Armorer.FORGE_IRON_COST}🔩 + ${Armorer.FORGE_WOOD_COST}🪵
          <span class="armorer-cost">→ +${Armorer.FORGE_IRON_RATE} iron/s (2.5 min) · +${Armorer.FORGE_PRESTIGE_REWARD} prestige · +${Armorer.FORGE_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--armorer-tech${canTech ? '' : ' btn--disabled'}" data-action="armorer-tech" ${canTech ? '' : 'disabled'}>
          🪨 Share Armor Techniques — ${Armorer.TECHNIQUES_STONE_COST}🪨
          <span class="armorer-cost">→ +${Armorer.TECHNIQUES_STONE_RATE} stone/s (2 min) · +${Armorer.TECHNIQUES_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--armorer-away" data-action="armorer-away">
          🚶 Send Away
          <span class="armorer-cost">→ Armorer departs to serve border garrisons</span>
        </button>
      </div>
    </div>`;
}

// ── T337 Wandering Wood Carver ───────────────────────────────────────────────

function _wanderingWoodCarverSection() {
  if (!WoodCarver.getActiveWanderingWoodCarver()) return '';
  const secs           = WoodCarver.getWoodCarverSecsLeft();
  const wood           = Math.floor(state.resources.wood ?? 0);
  const gold           = Math.floor(state.resources.gold ?? 0);
  const canCommission  = wood >= WoodCarver.COMMISSION_WOOD_COST;
  const canPurchase    = gold >= WoodCarver.PURCHASE_GOLD_COST;
  const urg = secs <= 15 ? ' woodcarver-timer--urgent' : '';
  return `
    <div class="woodcarver-section--active">
      <div class="woodcarver-header">
        <span class="woodcarver-title">🪵 Wandering Wood Carver</span>
        <span class="woodcarver-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="woodcarver-desc">A skilled wood carver arrives bearing fine chisels, hand gouges, and beautiful examples of decorative relief panels, figurines, and ornamental carvings crafted from rare hardwoods. Their artistry could enrich the empire's halls and markets.</div>
      <div class="woodcarver-actions">
        <button class="btn--woodcarver-commission${canCommission ? '' : ' btn--disabled'}" data-action="woodcarver-commission" ${canCommission ? '' : 'disabled'}>
          🪵 Commission Decorative Carvings — ${WoodCarver.COMMISSION_WOOD_COST}🪵
          <span class="woodcarver-cost">→ +${WoodCarver.COMMISSION_WOOD_RATE} wood/s (2.5 min) · +${WoodCarver.COMMISSION_PRESTIGE_REWARD} prestige · +${WoodCarver.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--woodcarver-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="woodcarver-purchase" ${canPurchase ? '' : 'disabled'}>
          📜 Purchase Carving Templates — ${WoodCarver.PURCHASE_GOLD_COST}💰
          <span class="woodcarver-cost">→ +${WoodCarver.PURCHASE_GOLD_RATE} gold/s (2 min) · +${WoodCarver.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--woodcarver-away" data-action="woodcarver-away">
          🚶 Send Away
          <span class="woodcarver-cost">→ Carver departs to continue their circuit through other settlements</span>
        </button>
      </div>
    </div>`;
}

// ── T338 Imperial Road Builder ───────────────────────────────────────────────

function _imperialRoadBuilderSection() {
  if (!RoadBuilder.getActiveImperialRoadBuilder()) return '';
  const secs         = RoadBuilder.getRoadBuilderSecsLeft();
  const stone        = Math.floor(state.resources.stone ?? 0);
  const iron         = Math.floor(state.resources.iron ?? 0);
  const gold         = Math.floor(state.resources.gold ?? 0);
  const canBuild     = stone >= RoadBuilder.BUILD_STONE_COST && iron >= RoadBuilder.BUILD_IRON_COST;
  const canExchange  = gold >= RoadBuilder.EXCHANGE_GOLD_COST;
  const urg = secs <= 15 ? ' roadbuilder-timer--urgent' : '';
  return `
    <div class="roadbuilder-section--active">
      <div class="roadbuilder-header">
        <span class="roadbuilder-title">🛤️ Imperial Road Builder</span>
        <span class="roadbuilder-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="roadbuilder-desc">A master imperial road builder arrives bearing precision survey rods, rolled parchment blueprints, and detailed topographic maps. They offer to commission stone-paved roads across the empire or share their road-building expertise.</div>
      <div class="roadbuilder-actions">
        <button class="btn--roadbuilder-build${canBuild ? '' : ' btn--disabled'}" data-action="roadbuilder-build" ${canBuild ? '' : 'disabled'}>
          🛤️ Commission Imperial Roads — ${RoadBuilder.BUILD_STONE_COST}🪨 + ${RoadBuilder.BUILD_IRON_COST}🔩
          <span class="roadbuilder-cost">→ +${RoadBuilder.BUILD_STONE_RATE} stone/s (2.5 min) · +${RoadBuilder.BUILD_PRESTIGE_REWARD} prestige · +${RoadBuilder.BUILD_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--roadbuilder-exchange${canExchange ? '' : ' btn--disabled'}" data-action="roadbuilder-exchange" ${canExchange ? '' : 'disabled'}>
          🗺️ Exchange Road Maps — ${RoadBuilder.EXCHANGE_GOLD_COST}💰
          <span class="roadbuilder-cost">→ +${RoadBuilder.EXCHANGE_GOLD_RATE} gold/s (2 min) · +${RoadBuilder.EXCHANGE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--roadbuilder-away" data-action="roadbuilder-away">
          🚶 Send Away
          <span class="roadbuilder-cost">→ Builder departs to survey road opportunities in other territories</span>
        </button>
      </div>
    </div>`;
}

// ── T339 Wandering Embroiderer ───────────────────────────────────────────────

function _wanderingEmbroidererSection() {
  if (!Embroiderer.getActiveWanderingEmbroiderer()) return '';
  const secs         = Embroiderer.getEmbroidererSecsLeft();
  const food         = Math.floor(state.resources.food ?? 0);
  const wood         = Math.floor(state.resources.wood ?? 0);
  const gold         = Math.floor(state.resources.gold ?? 0);
  const canEmbroider = food >= Embroiderer.EMBROIDER_FOOD_COST && wood >= Embroiderer.EMBROIDER_WOOD_COST;
  const canPurchase  = gold >= Embroiderer.PURCHASE_GOLD_COST;
  const urg = secs <= 15 ? ' embroiderer-timer--urgent' : '';
  return `
    <div class="embroiderer-section--active">
      <div class="embroiderer-header">
        <span class="embroiderer-title">🪡 Wandering Embroiderer</span>
        <span class="embroiderer-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="embroiderer-desc">A skilled embroiderer arrives bearing silk-work frames, skeins of gold and silver thread, and stunning examples of ornate heraldic banners and royal ceremonial garments. Their artistry could adorn the empire's halls and standards.</div>
      <div class="embroiderer-actions">
        <button class="btn--embroiderer-embroider${canEmbroider ? '' : ' btn--disabled'}" data-action="embroiderer-embroider" ${canEmbroider ? '' : 'disabled'}>
          🪡 Embroider Imperial Banners — ${Embroiderer.EMBROIDER_FOOD_COST}🍞 + ${Embroiderer.EMBROIDER_WOOD_COST}🪵
          <span class="embroiderer-cost">→ +${Embroiderer.EMBROIDER_FOOD_RATE} food/s (2.5 min) · +${Embroiderer.EMBROIDER_PRESTIGE_REWARD} prestige · +${Embroiderer.EMBROIDER_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--embroiderer-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="embroiderer-purchase" ${canPurchase ? '' : 'disabled'}>
          📜 Purchase Needlework Patterns — ${Embroiderer.PURCHASE_GOLD_COST}💰
          <span class="embroiderer-cost">→ +${Embroiderer.PURCHASE_GOLD_RATE} gold/s (2 min) · +${Embroiderer.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--embroiderer-away" data-action="embroiderer-away">
          🚶 Send Away
          <span class="embroiderer-cost">→ Embroiderer departs to continue their circuit through other settlements</span>
        </button>
      </div>
    </div>`;
}

// ── T340 Royal Bookbinder ────────────────────────────────────────────────────

function _royalBookbinderSection() {
  if (!Bookbinder.getActiveRoyalBookbinder()) return '';
  const secs          = Bookbinder.getBookbinderSecsLeft();
  const mana          = Math.floor(state.resources.mana ?? 0);
  const gold          = Math.floor(state.resources.gold ?? 0);
  const stone         = Math.floor(state.resources.stone ?? 0);
  const canCommission = mana >= Bookbinder.COMMISSION_MANA_COST && gold >= Bookbinder.COMMISSION_GOLD_COST;
  const canPurchase   = stone >= Bookbinder.PURCHASE_STONE_COST;
  const urg = secs <= 15 ? ' bookbinder-timer--urgent' : '';
  return `
    <div class="bookbinder-section--active">
      <div class="bookbinder-header">
        <span class="bookbinder-title">📚 Royal Bookbinder</span>
        <span class="bookbinder-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="bookbinder-desc">A master royal bookbinder arrives bearing tooled leather covers, gilded spine-plates, and fine parchment quires. They offer to bind illuminated codices and imperial law books into lasting magnificent volumes for the royal scriptorium.</div>
      <div class="bookbinder-actions">
        <button class="btn--bookbinder-commission${canCommission ? '' : ' btn--disabled'}" data-action="bookbinder-commission" ${canCommission ? '' : 'disabled'}>
          📚 Commission Illuminated Binding — ${Bookbinder.COMMISSION_MANA_COST}✨ + ${Bookbinder.COMMISSION_GOLD_COST}💰
          <span class="bookbinder-cost">→ +${Bookbinder.COMMISSION_MANA_RATE} mana/s (2.5 min) · +${Bookbinder.COMMISSION_PRESTIGE_REWARD} prestige · +${Bookbinder.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--bookbinder-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="bookbinder-purchase" ${canPurchase ? '' : 'disabled'}>
          🪨 Purchase Binding Materials — ${Bookbinder.PURCHASE_STONE_COST}🪨
          <span class="bookbinder-cost">→ +${Bookbinder.PURCHASE_STONE_RATE} stone/s (2 min) · +${Bookbinder.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--bookbinder-away" data-action="bookbinder-away">
          🚶 Send Away
          <span class="bookbinder-cost">→ Bookbinder departs to serve other imperial courts along the circuit</span>
        </button>
      </div>
    </div>`;
}

function _wanderingBasketweaverSection() {
  if (!Basketweaver.getActiveWanderingBasketweaver()) return '';
  const secs       = Basketweaver.getBasketweaverSecsLeft();
  const wood       = Math.floor(state.resources.wood ?? 0);
  const gold       = Math.floor(state.resources.gold ?? 0);
  const canWeave   = wood >= Basketweaver.WEAVE_WOOD_COST;
  const canPurchase = gold >= Basketweaver.PURCHASE_GOLD_COST;
  const urg = secs <= 15 ? ' basketweaver-timer--urgent' : '';
  return `
    <div class="basketweaver-section--active">
      <div class="basketweaver-header">
        <span class="basketweaver-title">🧺 Wandering Basketweaver</span>
        <span class="basketweaver-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="basketweaver-desc">A wandering basketweaver arrives bearing bundles of river reeds, dyed wood strips, and ancient family weaving patterns. Their craft could furnish the empire with sturdy storage baskets and boost commerce with artisan wicker goods.</div>
      <div class="basketweaver-actions">
        <button class="btn--basketweaver-weave${canWeave ? '' : ' btn--disabled'}" data-action="basketweaver-weave" ${canWeave ? '' : 'disabled'}>
          🧺 Weave Imperial Baskets — ${Basketweaver.WEAVE_WOOD_COST}🪵
          <span class="basketweaver-cost">→ +${Basketweaver.WEAVE_WOOD_RATE} wood/s (2.5 min) · +${Basketweaver.WEAVE_PRESTIGE_REWARD} prestige · +${Basketweaver.WEAVE_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--basketweaver-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="basketweaver-purchase" ${canPurchase ? '' : 'disabled'}>
          📜 Purchase Weaving Patterns — ${Basketweaver.PURCHASE_GOLD_COST}💰
          <span class="basketweaver-cost">→ +${Basketweaver.PURCHASE_GOLD_RATE} gold/s (2 min) · +${Basketweaver.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--basketweaver-away" data-action="basketweaver-away">
          🚶 Send Away
          <span class="basketweaver-cost">→ Basketweaver departs to seek other settlements on their craft circuit</span>
        </button>
      </div>
    </div>`;
}

function _wanderingCharcoalMakerSection() {
  if (!CharcoalMaker.getActiveWanderingCharcoalMaker()) return '';
  const secs           = CharcoalMaker.getCharcoalMakerSecsLeft();
  const wood           = Math.floor(state.resources.wood ?? 0);
  const food           = Math.floor(state.resources.food ?? 0);
  const gold           = Math.floor(state.resources.gold ?? 0);
  const canCommission  = wood >= CharcoalMaker.COMMISSION_WOOD_COST && food >= CharcoalMaker.COMMISSION_FOOD_COST;
  const canPurchase    = gold >= CharcoalMaker.PURCHASE_GOLD_COST;
  const urg = secs <= 15 ? ' charcoal-timer--urgent' : '';
  return `
    <div class="charcoal-section--active">
      <div class="charcoal-header">
        <span class="charcoal-title">🪵 Wandering Charcoal Maker</span>
        <span class="charcoal-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="charcoal-desc">A wandering charcoal maker arrives bearing sacks of high-grade charcoal, blackened iron tongs, and ancient kiln-building secrets. Their slow-burning kilns can supercharge imperial forges and smelters to dramatically increase iron output.</div>
      <div class="charcoal-actions">
        <button class="btn--charcoal-commission${canCommission ? '' : ' btn--disabled'}" data-action="charcoal-commission" ${canCommission ? '' : 'disabled'}>
          🪵 Commission Charcoal Works — ${CharcoalMaker.COMMISSION_WOOD_COST}🪵 + ${CharcoalMaker.COMMISSION_FOOD_COST}🌾
          <span class="charcoal-cost">→ +${CharcoalMaker.COMMISSION_IRON_RATE} iron/s (2.5 min) · +${CharcoalMaker.COMMISSION_PRESTIGE_REWARD} prestige · +${CharcoalMaker.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--charcoal-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="charcoal-purchase" ${canPurchase ? '' : 'disabled'}>
          📜 Purchase Char-Burning Lore — ${CharcoalMaker.PURCHASE_GOLD_COST}💰
          <span class="charcoal-cost">→ +${CharcoalMaker.PURCHASE_FOOD_RATE} food/s (2 min) · +${CharcoalMaker.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--charcoal-away" data-action="charcoal-away">
          🚶 Send Away
          <span class="charcoal-cost">→ Charcoal maker departs to supply the next forge settlement on their long route</span>
        </button>
      </div>
    </div>`;
}

function _wanderingTannerSection() {
  if (!Tanner.getActiveWanderingTanner()) return '';
  const secs        = Tanner.getTannerSecsLeft();
  const food        = Math.floor(state.resources.food ?? 0);
  const wood        = Math.floor(state.resources.wood ?? 0);
  const gold        = Math.floor(state.resources.gold ?? 0);
  const canCommission = food >= Tanner.COMMISSION_FOOD_COST && wood >= Tanner.COMMISSION_WOOD_COST;
  const canPurchase   = gold >= Tanner.PURCHASE_GOLD_COST;
  const urg = secs <= 15 ? ' tanner-timer--urgent' : '';
  return `
    <div class="tanner-section--active">
      <div class="tanner-header">
        <span class="tanner-title">🦬 Wandering Tanner</span>
        <span class="tanner-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="tanner-desc">A wandering tanner arrives bearing cured hides, bark-tanning vats, and generations of leatherworking knowledge. Their premium leather can supply armourers and traders across the empire with exceptional goods that fetch higher prices at market.</div>
      <div class="tanner-actions">
        <button class="btn--tanner-commission${canCommission ? '' : ' btn--disabled'}" data-action="tanner-commission" ${canCommission ? '' : 'disabled'}>
          🦬 Commission Imperial Leatherworks — ${Tanner.COMMISSION_FOOD_COST}🌾 + ${Tanner.COMMISSION_WOOD_COST}🪵
          <span class="tanner-cost">→ +${Tanner.COMMISSION_FOOD_RATE} food/s (2.5 min) · +${Tanner.COMMISSION_PRESTIGE_REWARD} prestige · +${Tanner.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--tanner-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="tanner-purchase" ${canPurchase ? '' : 'disabled'}>
          📜 Purchase Tanning Secrets — ${Tanner.PURCHASE_GOLD_COST}💰
          <span class="tanner-cost">→ +${Tanner.PURCHASE_GOLD_RATE} gold/s (2 min) · +${Tanner.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--tanner-away" data-action="tanner-away">
          🚶 Send Away
          <span class="tanner-cost">→ Tanner departs to seek other settlements on their trade route</span>
        </button>
      </div>
    </div>`;
}

function _imperialGlassmakerSection() {
  if (!IGlassmaker.getActiveImperialGlassmaker()) return '';
  const secs        = IGlassmaker.getGlassmakerSecsLeft();
  const iron        = Math.floor(state.resources.iron  ?? 0);
  const stone       = Math.floor(state.resources.stone ?? 0);
  const gold        = Math.floor(state.resources.gold  ?? 0);
  const canCommission = iron >= IGlassmaker.COMMISSION_IRON_COST && stone >= IGlassmaker.COMMISSION_STONE_COST;
  const canPurchase   = gold >= IGlassmaker.PURCHASE_GOLD_COST;
  const urg = secs <= 15 ? ' glassmaker-timer--urgent' : '';
  return `
    <div class="glassmaker-section--active">
      <div class="glassmaker-header">
        <span class="glassmaker-title">🔮 Imperial Glassmaker</span>
        <span class="glassmaker-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="glassmaker-desc">A renowned imperial glassmaker arrives bearing hand-blown crystal vessels, coloured glass samples, and the closely guarded secrets of the master furnace. Their crystal workshop can unlock remarkable metalworking efficiencies, while glass formulas improve stone quarrying techniques.</div>
      <div class="glassmaker-actions">
        <button class="btn--glassmaker-commission${canCommission ? '' : ' btn--disabled'}" data-action="glassmaker-commission" ${canCommission ? '' : 'disabled'}>
          🔮 Commission Crystal Workshop — ${IGlassmaker.COMMISSION_IRON_COST}⚙ + ${IGlassmaker.COMMISSION_STONE_COST}🪨
          <span class="glassmaker-cost">→ +${IGlassmaker.COMMISSION_IRON_RATE} iron/s (2.5 min) · +${IGlassmaker.COMMISSION_PRESTIGE_REWARD} prestige · +${IGlassmaker.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--glassmaker-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="glassmaker-purchase" ${canPurchase ? '' : 'disabled'}>
          📜 Purchase Glass Formulas — ${IGlassmaker.PURCHASE_GOLD_COST}💰
          <span class="glassmaker-cost">→ +${IGlassmaker.PURCHASE_STONE_RATE} stone/s (2 min) · +${IGlassmaker.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--glassmaker-away" data-action="glassmaker-away">
          🚶 Send Away
          <span class="glassmaker-cost">→ Glassmaker departs for distant courts that may better appreciate their craft</span>
        </button>
      </div>
    </div>`;
}

function _wanderingInkmakerSection() {
  if (!Inkmaker.getActiveWanderingInkmaker()) return '';
  const secs        = Inkmaker.getInkmakerSecsLeft();
  const mana        = Math.floor(state.resources.mana ?? 0);
  const gold        = Math.floor(state.resources.gold ?? 0);
  const wood        = Math.floor(state.resources.wood ?? 0);
  const canCommission = mana >= Inkmaker.COMMISSION_MANA_COST && gold >= Inkmaker.COMMISSION_GOLD_COST;
  const canPurchase   = wood >= Inkmaker.PURCHASE_WOOD_COST;
  const urg = secs <= 15 ? ' inkmaker-timer--urgent' : '';
  return `
    <div class="inkmaker-section--active">
      <div class="inkmaker-header">
        <span class="inkmaker-title">🖊️ Wandering Inkmaker</span>
        <span class="inkmaker-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="inkmaker-desc">A wandering inkmaker arrives bearing rare lapis-lazuli pigments, oak-gall writing ink, and illuminated script samples from distant monastic scriptoria. Their expertise can inspire the imperial scholars or improve woodland harvesting techniques.</div>
      <div class="inkmaker-actions">
        <button class="btn--inkmaker-commission${canCommission ? '' : ' btn--disabled'}" data-action="inkmaker-commission" ${canCommission ? '' : 'disabled'}>
          🖊️ Commission Illuminated Scripts — ${Inkmaker.COMMISSION_MANA_COST}✨ + ${Inkmaker.COMMISSION_GOLD_COST}💰
          <span class="inkmaker-cost">→ +${Inkmaker.COMMISSION_MANA_RATE} mana/s (2.5 min) · +${Inkmaker.COMMISSION_PRESTIGE_REWARD} prestige · +${Inkmaker.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--inkmaker-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="inkmaker-purchase" ${canPurchase ? '' : 'disabled'}>
          📜 Purchase Ink Formulas — ${Inkmaker.PURCHASE_WOOD_COST}🪵
          <span class="inkmaker-cost">→ +${Inkmaker.PURCHASE_WOOD_RATE} wood/s (2 min) · +${Inkmaker.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--inkmaker-away" data-action="inkmaker-away">
          🚶 Send Away
          <span class="inkmaker-cost">→ Inkmaker departs to supply the next imperial scriptorium on their trade route</span>
        </button>
      </div>
    </div>`;
}

function _imperialDockmasterSection() {
  if (!Dockmaster.getActiveImperialDockmaster()) return '';
  const secs          = Dockmaster.getDockmasterSecsLeft();
  const wood          = Math.floor(state.resources.wood ?? 0);
  const gold          = Math.floor(state.resources.gold ?? 0);
  const iron          = Math.floor(state.resources.iron ?? 0);
  const canEstablish  = wood >= Dockmaster.ESTABLISH_WOOD_COST && gold >= Dockmaster.ESTABLISH_GOLD_COST;
  const canCommission = iron >= Dockmaster.COMMISSION_IRON_COST;
  const urg = secs <= 15 ? ' dockmaster-timer--urgent' : '';
  return `
    <div class="dockmaster-section--active">
      <div class="dockmaster-header">
        <span class="dockmaster-title">⚓ Imperial Dockmaster</span>
        <span class="dockmaster-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="dockmaster-desc">A seasoned imperial dockmaster arrives bearing detailed harbor charts and dock-building blueprints. They offer to establish full trading docks to boost timber imports, or commission iron-reinforced harbor works to attract heavier ore barges to the imperial waterfront.</div>
      <div class="dockmaster-actions">
        <button class="btn--dockmaster-establish${canEstablish ? '' : ' btn--disabled'}" data-action="dockmaster-establish" ${canEstablish ? '' : 'disabled'}>
          ⚓ Establish Trading Docks — ${Dockmaster.ESTABLISH_WOOD_COST}🪵 + ${Dockmaster.ESTABLISH_GOLD_COST}💰
          <span class="dockmaster-cost">→ +${Dockmaster.ESTABLISH_WOOD_RATE} wood/s (2.5 min) · +${Dockmaster.ESTABLISH_PRESTIGE_REWARD} prestige · +${Dockmaster.ESTABLISH_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--dockmaster-commission${canCommission ? '' : ' btn--disabled'}" data-action="dockmaster-commission" ${canCommission ? '' : 'disabled'}>
          ⚙️ Commission Harbor Works — ${Dockmaster.COMMISSION_IRON_COST}⚙
          <span class="dockmaster-cost">→ +${Dockmaster.COMMISSION_IRON_RATE} iron/s (2 min) · +${Dockmaster.COMMISSION_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--dockmaster-away" data-action="dockmaster-away">
          🚶 Send Away
          <span class="dockmaster-cost">→ Dockmaster departs to inspect the next imperial port on the survey circuit</span>
        </button>
      </div>
    </div>`;
}

function _wanderingStorytellerSection() {
  if (!Storyteller.getActiveWanderingStoryteller()) return '';
  const secs         = Storyteller.getStorytellerSecsLeft();
  const gold         = Math.floor(state.resources.gold ?? 0);
  const canChronicle = gold >= Storyteller.CHRONICLE_GOLD_COST;
  const urg = secs <= 15 ? ' storyteller-timer--urgent' : '';
  return `
    <div class="storyteller-section--active">
      <div class="storyteller-header">
        <span class="storyteller-title">📖 Wandering Storyteller</span>
        <span class="storyteller-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="storyteller-desc">A wandering storyteller arrives bearing hand-illustrated chronicles of fallen kingdoms and legendary heroes. They offer to compose a grand epic chronicle of your empire's deeds, or simply share ancient tales to inspire your people.</div>
      <div class="storyteller-actions">
        <button class="btn--storyteller-chronicle${canChronicle ? '' : ' btn--disabled'}" data-action="storyteller-chronicle" ${canChronicle ? '' : 'disabled'}>
          📜 Commission Epic Chronicle — ${Storyteller.CHRONICLE_GOLD_COST}💰
          <span class="storyteller-cost">→ +${Storyteller.CHRONICLE_GOLD_RATE} gold/s (2.5 min) · +${Storyteller.CHRONICLE_PRESTIGE_REWARD} prestige · +${Storyteller.CHRONICLE_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--storyteller-listen" data-action="storyteller-listen">
          📖 Listen to Ancient Tales — free
          <span class="storyteller-cost">→ +${Storyteller.TALES_MORALE_REWARD} morale · +${Storyteller.TALES_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--storyteller-away" data-action="storyteller-away">
          🚶 Send Away
          <span class="storyteller-cost">→ Storyteller departs to share tales in other kingdoms</span>
        </button>
      </div>
    </div>`;
}

function _imperialLoreMasterSection() {
  if (!LoreMaster.getActiveImperialLoreMaster()) return '';
  const secs      = LoreMaster.getLoreMasterSecsLeft();
  const mana      = Math.floor(state.resources.mana ?? 0);
  const gold      = Math.floor(state.resources.gold ?? 0);
  const canCodex  = mana >= LoreMaster.CODEX_MANA_COST && gold >= LoreMaster.CODEX_GOLD_COST;
  const canScrolls = gold >= LoreMaster.SCROLLS_GOLD_COST;
  const urg = secs <= 15 ? ' loremaster-timer--urgent' : '';
  return `
    <div class="loremaster-section--active">
      <div class="loremaster-header">
        <span class="loremaster-title">📚 Imperial Lore Master</span>
        <span class="loremaster-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="loremaster-desc">A revered imperial lore master arrives bearing ancient codices, forbidden knowledge scrolls, and mystical lore from across the known world. They offer to commission a grand codex collection to amplify arcane energies, or sell rare scrolls with hidden trade secrets.</div>
      <div class="loremaster-actions">
        <button class="btn--loremaster-codex${canCodex ? '' : ' btn--disabled'}" data-action="loremaster-codex" ${canCodex ? '' : 'disabled'}>
          📚 Commission Imperial Codex Collection — ${LoreMaster.CODEX_MANA_COST}✨ + ${LoreMaster.CODEX_GOLD_COST}💰
          <span class="loremaster-cost">→ +${LoreMaster.CODEX_MANA_RATE} mana/s (2.5 min) · +${LoreMaster.CODEX_PRESTIGE_REWARD} prestige · +${LoreMaster.CODEX_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--loremaster-scrolls${canScrolls ? '' : ' btn--disabled'}" data-action="loremaster-scrolls" ${canScrolls ? '' : 'disabled'}>
          🗝️ Purchase Ancient Lore Scrolls — ${LoreMaster.SCROLLS_GOLD_COST}💰
          <span class="loremaster-cost">→ +${LoreMaster.SCROLLS_GOLD_RATE} gold/s (2 min) · +${LoreMaster.SCROLLS_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--loremaster-away" data-action="loremaster-away">
          🚶 Send Away
          <span class="loremaster-cost">→ Lore master departs to another imperial seat of learning</span>
        </button>
      </div>
    </div>`;
}

function _wanderingToymakerSection() {
  if (!Toymaker.getActiveWanderingToymaker()) return '';
  const secs      = Toymaker.getToymakerSecsLeft();
  const wood      = state.resources.wood ?? 0;
  const gold      = state.resources.gold ?? 0;
  const urg       = secs <= 15 ? ' toymaker-timer--urgent' : '';
  const canToys   = wood >= Toymaker.TOYS_WOOD_COST;
  const canPat    = gold >= Toymaker.PATTERNS_GOLD_COST;
  return `
    <div class="toymaker-section--active">
      <div class="toymaker-header">
        <span class="toymaker-title">🪀 Wandering Toymaker</span>
        <span class="toymaker-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="toymaker-desc">A wandering toymaker arrives with a cart of beautifully carved wooden toys, painted figurines, and clever mechanical curiosities. They offer to craft a royal toy collection or share intricate crafting patterns with imperial workshops.</div>
      <div class="toymaker-actions">
        <button class="btn--toymaker-toys${canToys ? '' : ' btn--disabled'}" data-action="toymaker-toys" ${canToys ? '' : 'disabled'}>
          🪀 Commission Royal Toys — ${Toymaker.TOYS_WOOD_COST}🪵
          <span class="toymaker-cost">→ +${Toymaker.TOYS_WOOD_RATE} wood/s (2.5 min) · +${Toymaker.TOYS_PRESTIGE_REWARD} prestige · +${Toymaker.TOYS_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--toymaker-patterns${canPat ? '' : ' btn--disabled'}" data-action="toymaker-patterns" ${canPat ? '' : 'disabled'}>
          🎁 Share Crafting Patterns — ${Toymaker.PATTERNS_GOLD_COST}💰
          <span class="toymaker-cost">→ +${Toymaker.PATTERNS_GOLD_RATE} gold/s (2 min) · +${Toymaker.PATTERNS_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--toymaker-away" data-action="toymaker-away">
          🚶 Send Away
          <span class="toymaker-cost">→ Toymaker departs to delight another village with crafted wonders</span>
        </button>
      </div>
    </div>`;
}

function _imperialFerrymanSection() {
  if (!Ferryman.getActiveImperialFerryman()) return '';
  const secs       = Ferryman.getFerrymanSecsLeft();
  const wood       = state.resources.wood ?? 0;
  const gold       = state.resources.gold ?? 0;
  const urg        = secs <= 15 ? ' ferryman-timer--urgent' : '';
  const canRoutes  = wood >= Ferryman.ROUTES_WOOD_COST && gold >= Ferryman.ROUTES_GOLD_COST;
  const canCharts  = gold >= Ferryman.CHARTS_GOLD_COST;
  return `
    <div class="ferryman-section--active">
      <div class="ferryman-header">
        <span class="ferryman-title">⛵ Imperial Ferryman</span>
        <span class="ferryman-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="ferryman-desc">An imperial ferryman arrives bearing river charts, tide tables, and navigational wisdom from the empire's waterways. They offer to establish efficient ferry crossing routes or sell detailed charts of hidden channels and secret harbours.</div>
      <div class="ferryman-actions">
        <button class="btn--ferryman-routes${canRoutes ? '' : ' btn--disabled'}" data-action="ferryman-routes" ${canRoutes ? '' : 'disabled'}>
          ⛵ Establish Ferry Routes — ${Ferryman.ROUTES_WOOD_COST}🪵 + ${Ferryman.ROUTES_GOLD_COST}💰
          <span class="ferryman-cost">→ +${Ferryman.ROUTES_WOOD_RATE} wood/s (2.5 min) · +${Ferryman.ROUTES_PRESTIGE_REWARD} prestige · +${Ferryman.ROUTES_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--ferryman-charts${canCharts ? '' : ' btn--disabled'}" data-action="ferryman-charts" ${canCharts ? '' : 'disabled'}>
          🗺️ Purchase River Charts — ${Ferryman.CHARTS_GOLD_COST}💰
          <span class="ferryman-cost">→ +${Ferryman.CHARTS_GOLD_RATE} gold/s (2 min) · +${Ferryman.CHARTS_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--ferryman-away" data-action="ferryman-away">
          🚶 Send Away
          <span class="ferryman-cost">→ Ferryman poles back into the river and continues their journey</span>
        </button>
      </div>
    </div>`;
}

// ── T351 Wandering Mosaic Maker ────────────────────────────────────────

function _wanderingMosaicMakerSection() {
  if (!MosaicMaker.getActiveWanderingMosaicMaker()) return '';
  const secs         = MosaicMaker.getMosaicMakerSecsLeft();
  const stone        = state.resources.stone ?? 0;
  const gold         = state.resources.gold  ?? 0;
  const urg          = secs <= 15 ? ' mosaic-timer--urgent' : '';
  const canCommission = stone >= MosaicMaker.COMMISSION_STONE_COST && gold >= MosaicMaker.COMMISSION_GOLD_COST;
  const canExchange   = gold  >= MosaicMaker.EXCHANGE_GOLD_COST;
  return `
    <div class="mosaic-section--active">
      <div class="mosaic-header">
        <span class="mosaic-title">🎨 Wandering Mosaic Maker</span>
        <span class="mosaic-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="mosaic-desc">A wandering mosaic maker arrives with carts of coloured stone tesserae and decades of craft expertise, proposing to adorn the empire's public spaces with magnificent stone mosaics or to share hard-won pattern lore.</div>
      <div class="mosaic-actions">
        <button class="btn--mosaic-commission${canCommission ? '' : ' btn--disabled'}" data-action="mosaic-commission" ${canCommission ? '' : 'disabled'}>
          🎨 Commission Imperial Mosaic — ${MosaicMaker.COMMISSION_STONE_COST}🪨 + ${MosaicMaker.COMMISSION_GOLD_COST}💰
          <span class="mosaic-cost">→ +${MosaicMaker.COMMISSION_STONE_RATE} stone/s (2.5 min) · +${MosaicMaker.COMMISSION_PRESTIGE_REWARD} prestige · +${MosaicMaker.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--mosaic-exchange${canExchange ? '' : ' btn--disabled'}" data-action="mosaic-exchange" ${canExchange ? '' : 'disabled'}>
          📜 Exchange Pattern Lore — ${MosaicMaker.EXCHANGE_GOLD_COST}💰
          <span class="mosaic-cost">→ +${MosaicMaker.EXCHANGE_GOLD_RATE} gold/s (2 min) · +${MosaicMaker.EXCHANGE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--mosaic-away" data-action="mosaic-away">
          🚶 Send Away
          <span class="mosaic-cost">→ Mosaic maker packs the tesserae and departs</span>
        </button>
      </div>
    </div>`;
}

// ── T352 Imperial Bathhouse Builder ───────────────────────────────────

function _imperialBathhouseBuilderSection() {
  if (!BHBuilder.getActiveImperialBathhouseBuilder()) return '';
  const secs         = BHBuilder.getBathhouseBuilderSecsLeft();
  const stone        = state.resources.stone ?? 0;
  const gold         = state.resources.gold  ?? 0;
  const mana         = state.resources.mana  ?? 0;
  const urg          = secs <= 15 ? ' bathhouse-timer--urgent' : '';
  const canConstruct = stone >= BHBuilder.CONSTRUCT_STONE_COST && gold >= BHBuilder.CONSTRUCT_GOLD_COST;
  const canPlans     = mana  >= BHBuilder.PLANS_MANA_COST;
  return `
    <div class="bathhouse-section--active">
      <div class="bathhouse-header">
        <span class="bathhouse-title">🏛️ Imperial Bathhouse Builder</span>
        <span class="bathhouse-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="bathhouse-desc">A celebrated imperial bathhouse builder arrives bearing detailed engineering drawings for grand heated public bathhouses, proposing either full construction or the sharing of advanced hydraulic engineering plans.</div>
      <div class="bathhouse-actions">
        <button class="btn--bathhouse-construct${canConstruct ? '' : ' btn--disabled'}" data-action="bathhouse-construct" ${canConstruct ? '' : 'disabled'}>
          🏛️ Construct Bathhouse Complex — ${BHBuilder.CONSTRUCT_STONE_COST}🪨 + ${BHBuilder.CONSTRUCT_GOLD_COST}💰
          <span class="bathhouse-cost">→ +${BHBuilder.CONSTRUCT_STONE_RATE} stone/s (2.5 min) · +${BHBuilder.CONSTRUCT_PRESTIGE_REWARD} prestige · +${BHBuilder.CONSTRUCT_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--bathhouse-plans${canPlans ? '' : ' btn--disabled'}" data-action="bathhouse-plans" ${canPlans ? '' : 'disabled'}>
          📐 Share Engineering Plans — ${BHBuilder.PLANS_MANA_COST}✨
          <span class="bathhouse-cost">→ +${BHBuilder.PLANS_MANA_RATE} mana/s (2 min) · +${BHBuilder.PLANS_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--bathhouse-away" data-action="bathhouse-away">
          🚶 Send Away
          <span class="bathhouse-cost">→ Builder rolls up the drawings and seeks another patron</span>
        </button>
      </div>
    </div>`;
}

// ── T353 Wandering Bell Founder ───────────────────────────────────────

function _wanderingBellFounderSection() {
  if (!BellFounder.getActiveWanderingBellFounder()) return '';
  const secs       = BellFounder.getBellFounderSecsLeft();
  const iron       = state.resources.iron  ?? 0;
  const stone      = state.resources.stone ?? 0;
  const gold       = state.resources.gold  ?? 0;
  const urg        = secs <= 15 ? ' bellfdr-timer--urgent' : '';
  const canBells   = iron >= BellFounder.BELLS_IRON_COST && stone >= BellFounder.BELLS_STONE_COST;
  const canSecrets = gold >= BellFounder.SECRETS_GOLD_COST;
  return `
    <div class="bellfdr-section--active">
      <div class="bellfdr-header">
        <span class="bellfdr-title">🔔 Wandering Bell Founder</span>
        <span class="bellfdr-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="bellfdr-desc">A wandering bell founder arrives with a portable smelting forge and intricate sand moulds, offering to cast magnificent ceremonial bells for the empire or to share closely-guarded alloy secrets.</div>
      <div class="bellfdr-actions">
        <button class="btn--bellfdr-bells${canBells ? '' : ' btn--disabled'}" data-action="bellfdr-bells" ${canBells ? '' : 'disabled'}>
          🔔 Commission Temple Bells — ${BellFounder.BELLS_IRON_COST}⚙️ + ${BellFounder.BELLS_STONE_COST}🪨
          <span class="bellfdr-cost">→ +${BellFounder.BELLS_IRON_RATE} iron/s (2.5 min) · +${BellFounder.BELLS_PRESTIGE_REWARD} prestige · +${BellFounder.BELLS_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--bellfdr-secrets${canSecrets ? '' : ' btn--disabled'}" data-action="bellfdr-secrets" ${canSecrets ? '' : 'disabled'}>
          📜 Purchase Bell-Casting Secrets — ${BellFounder.SECRETS_GOLD_COST}💰
          <span class="bellfdr-cost">→ +${BellFounder.SECRETS_GOLD_RATE} gold/s (2 min) · +${BellFounder.SECRETS_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--bellfdr-away" data-action="bellfdr-away">
          🚶 Send Away
          <span class="bellfdr-cost">→ Bell founder loads the forge and departs</span>
        </button>
      </div>
    </div>`;
}

// ── T354 Imperial Marble Cutter ───────────────────────────────────────

function _imperialMarbleCutterSection() {
  if (!MarbleCutter.getActiveImperialMarbleCutter()) return '';
  const secs          = MarbleCutter.getMarbleCutterSecsLeft();
  const stone         = state.resources.stone ?? 0;
  const iron          = state.resources.iron  ?? 0;
  const gold          = state.resources.gold  ?? 0;
  const urg           = secs <= 15 ? ' marble-timer--urgent' : '';
  const canCommission = stone >= MarbleCutter.COMMISSION_STONE_COST && iron >= MarbleCutter.COMMISSION_IRON_COST;
  const canExchange   = gold  >= MarbleCutter.EXCHANGE_GOLD_COST;
  return `
    <div class="marble-section--active">
      <div class="marble-header">
        <span class="marble-title">🏛️ Imperial Marble Cutter</span>
        <span class="marble-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="marble-desc">An imperial marble cutter arrives bearing polished sample columns and precision diamond-tipped saws, proposing either grand marble columns for the empire's buildings or the sharing of revolutionary stone-cutting techniques.</div>
      <div class="marble-actions">
        <button class="btn--marble-commission${canCommission ? '' : ' btn--disabled'}" data-action="marble-commission" ${canCommission ? '' : 'disabled'}>
          🏛️ Commission Marble Columns — ${MarbleCutter.COMMISSION_STONE_COST}🪨 + ${MarbleCutter.COMMISSION_IRON_COST}⚙️
          <span class="marble-cost">→ +${MarbleCutter.COMMISSION_STONE_RATE} stone/s (2.5 min) · +${MarbleCutter.COMMISSION_PRESTIGE_REWARD} prestige · +${MarbleCutter.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--marble-exchange${canExchange ? '' : ' btn--disabled'}" data-action="marble-exchange" ${canExchange ? '' : 'disabled'}>
          ⚒️ Exchange Cutting Techniques — ${MarbleCutter.EXCHANGE_GOLD_COST}💰
          <span class="marble-cost">→ +${MarbleCutter.EXCHANGE_IRON_RATE} iron/s (2 min) · +${MarbleCutter.EXCHANGE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--marble-away" data-action="marble-away">
          🚶 Send Away
          <span class="marble-cost">→ Marble cutter loads the tools and departs</span>
        </button>
      </div>
    </div>`;
}

function _wanderingParchmentMakerSection() {
  if (!ParchmentMaker.getActiveWanderingParchmentMaker()) return '';
  const secs           = ParchmentMaker.getParchmentMakerSecsLeft();
  const wood           = state.resources.wood ?? 0;
  const mana           = state.resources.mana ?? 0;
  const gold           = state.resources.gold ?? 0;
  const urg            = secs <= 15 ? ' parchment-timer--urgent' : '';
  const canCommission  = wood >= ParchmentMaker.COMMISSION_WOOD_COST && mana >= ParchmentMaker.COMMISSION_MANA_COST;
  const canPurchase    = gold >= ParchmentMaker.PURCHASE_GOLD_COST;
  return `
    <div class="parchment-section--active">
      <div class="parchment-header">
        <span class="parchment-title">📜 Wandering Parchment Maker</span>
        <span class="parchment-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="parchment-desc">A wandering parchment maker arrives bearing stretching frames, scrapers, and lime-water barrels — ready to produce the finest vellum sheets for imperial correspondence and illuminated manuscripts.</div>
      <div class="parchment-actions">
        <button class="btn--parchment-commission${canCommission ? '' : ' btn--disabled'}" data-action="parchment-commission" ${canCommission ? '' : 'disabled'}>
          📜 Commission Royal Parchments — ${ParchmentMaker.COMMISSION_WOOD_COST}🪵 + ${ParchmentMaker.COMMISSION_MANA_COST}✨
          <span class="parchment-cost">→ +${ParchmentMaker.COMMISSION_MANA_RATE} mana/s (2.5 min) · +${ParchmentMaker.COMMISSION_PRESTIGE_REWARD} prestige · +${ParchmentMaker.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--parchment-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="parchment-purchase" ${canPurchase ? '' : 'disabled'}>
          ✍️ Purchase Writing Materials — ${ParchmentMaker.PURCHASE_GOLD_COST}💰
          <span class="parchment-cost">→ +${ParchmentMaker.PURCHASE_GOLD_RATE} gold/s (2 min) · +${ParchmentMaker.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--parchment-away" data-action="parchment-away">
          🚶 Send Away
          <span class="parchment-cost">→ Parchment maker packs the frames and departs</span>
        </button>
      </div>
    </div>`;
}

function _wanderingIncenseMakerSection() {
  if (!IncenseMaker.getActiveWanderingIncenseMaker()) return '';
  const secs        = IncenseMaker.getIncenseMakerSecsLeft();
  const food        = state.resources.food ?? 0;
  const mana        = state.resources.mana ?? 0;
  const gold        = state.resources.gold ?? 0;
  const urg         = secs <= 15 ? ' incense-timer--urgent' : '';
  const canIncense  = food >= IncenseMaker.INCENSE_FOOD_COST && mana >= IncenseMaker.INCENSE_MANA_COST;
  const canPurchase = gold >= IncenseMaker.PURCHASE_GOLD_COST;
  return `
    <div class="incense-section--active">
      <div class="incense-header">
        <span class="incense-title">🕯️ Wandering Incense Maker</span>
        <span class="incense-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="incense-desc">A wandering incense maker arrives with dried herbs, fragrant resins, and a portable brazier — blending ceremonial incense used in temples throughout the known world.</div>
      <div class="incense-actions">
        <button class="btn--incense-prepare${canIncense ? '' : ' btn--disabled'}" data-action="incense-prepare" ${canIncense ? '' : 'disabled'}>
          🕯️ Prepare Sacred Incense — ${IncenseMaker.INCENSE_FOOD_COST}🌾 + ${IncenseMaker.INCENSE_MANA_COST}✨
          <span class="incense-cost">→ +${IncenseMaker.INCENSE_FOOD_RATE} food/s (2.5 min) · +${IncenseMaker.INCENSE_PRESTIGE_REWARD} prestige · +${IncenseMaker.INCENSE_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--incense-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="incense-purchase" ${canPurchase ? '' : 'disabled'}>
          🌿 Purchase Aromatic Blends — ${IncenseMaker.PURCHASE_GOLD_COST}💰
          <span class="incense-cost">→ +${IncenseMaker.PURCHASE_GOLD_RATE} gold/s (2 min) · +${IncenseMaker.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--incense-away" data-action="incense-away">
          🚶 Send Away
          <span class="incense-cost">→ Incense maker extinguishes the brazier and departs</span>
        </button>
      </div>
    </div>`;
}

function _wanderingFurrierSection() {
  if (!Furrier.getActiveWanderingFurrier()) return '';
  const secs           = Furrier.getFurrierSecsLeft();
  const food           = state.resources.food ?? 0;
  const gold           = state.resources.gold ?? 0;
  const urg            = secs <= 15 ? ' furrier-timer--urgent' : '';
  const canCommission  = food >= Furrier.COMMISSION_FOOD_COST;
  const canPurchase    = gold >= Furrier.PURCHASE_GOLD_COST;
  return `
    <div class="furrier-section--active">
      <div class="furrier-header">
        <span class="furrier-title">🦊 Wandering Furrier</span>
        <span class="furrier-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="furrier-desc">A wandering furrier arrives with wolf pelts, fox furs, beaver hides, and cured rabbit skins — fine materials for noble wardrobes and warm winter cloaks.</div>
      <div class="furrier-actions">
        <button class="btn--furrier-commission${canCommission ? '' : ' btn--disabled'}" data-action="furrier-commission" ${canCommission ? '' : 'disabled'}>
          🦊 Commission Royal Pelt Works — ${Furrier.COMMISSION_FOOD_COST}🌾
          <span class="furrier-cost">→ +${Furrier.COMMISSION_FOOD_RATE} food/s (2.5 min) · +${Furrier.COMMISSION_PRESTIGE_REWARD} prestige · +${Furrier.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--furrier-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="furrier-purchase" ${canPurchase ? '' : 'disabled'}>
          💰 Purchase Pelt Collection — ${Furrier.PURCHASE_GOLD_COST}💰
          <span class="furrier-cost">→ +${Furrier.PURCHASE_GOLD_RATE} gold/s (2 min) · +${Furrier.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--furrier-away" data-action="furrier-away">
          🚶 Send Away
          <span class="furrier-cost">→ Furrier packs the pelts and departs</span>
        </button>
      </div>
    </div>`;
}

function _imperialWoolMerchantSection() {
  if (!WoolMerchant.getActiveImperialWoolMerchant()) return '';
  const secs        = WoolMerchant.getWoolMerchantSecsLeft();
  const food        = state.resources.food ?? 0;
  const wood        = state.resources.wood ?? 0;
  const gold        = state.resources.gold ?? 0;
  const urg         = secs <= 15 ? ' wool-timer--urgent' : '';
  const canTrade    = food >= WoolMerchant.TRADE_FOOD_COST && wood >= WoolMerchant.TRADE_WOOD_COST;
  const canPurchase = gold >= WoolMerchant.PURCHASE_GOLD_COST;
  return `
    <div class="wool-section--active">
      <div class="wool-header">
        <span class="wool-title">🐑 Imperial Wool Merchant</span>
        <span class="wool-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="wool-desc">A traveling wool merchant arrives with bales of raw fleece, spun yarn, and undyed woollen cloth — the raw material of warm cloaks, farmers' tunics, and soldiers' winter gear.</div>
      <div class="wool-actions">
        <button class="btn--wool-trade${canTrade ? '' : ' btn--disabled'}" data-action="wool-trade" ${canTrade ? '' : 'disabled'}>
          🐑 Trade Wool Supplies — ${WoolMerchant.TRADE_FOOD_COST}🌾 + ${WoolMerchant.TRADE_WOOD_COST}🪵
          <span class="wool-cost">→ +${WoolMerchant.TRADE_FOOD_RATE} food/s (2.5 min) · +${WoolMerchant.TRADE_PRESTIGE_REWARD} prestige · +${WoolMerchant.TRADE_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--wool-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="wool-purchase" ${canPurchase ? '' : 'disabled'}>
          🪵 Purchase Wool Goods — ${WoolMerchant.PURCHASE_GOLD_COST}💰
          <span class="wool-cost">→ +${WoolMerchant.PURCHASE_WOOD_RATE} wood/s (2 min) · +${WoolMerchant.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--wool-away" data-action="wool-away">
          🚶 Send Away
          <span class="wool-cost">→ Wool merchant loads the cart and departs</span>
        </button>
      </div>
    </div>`;
}

function _wanderingHorseTraderSection() {
  if (!HorseTrader.getActiveWanderingHorseTrader()) return '';
  const secs         = HorseTrader.getHorseTraderSecsLeft();
  const iron         = state.resources.iron ?? 0;
  const food         = state.resources.food ?? 0;
  const gold         = state.resources.gold ?? 0;
  const urg          = secs <= 15 ? ' horse-timer--urgent' : '';
  const canPurchase  = gold >= HorseTrader.PURCHASE_GOLD_COST;
  const canTrade     = iron >= HorseTrader.TRADE_IRON_COST && food >= HorseTrader.TRADE_FOOD_COST;
  return `
    <div class="horse-section--active">
      <div class="horse-header">
        <span class="horse-title">🐴 Wandering Horse Trader</span>
        <span class="horse-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="horse-desc">A skilled horse trader arrives with a magnificent string of stallions and mares bred on distant plains for speed, endurance, and battlefield courage.</div>
      <div class="horse-actions">
        <button class="btn--horse-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="horse-purchase" ${canPurchase ? '' : 'disabled'}>
          🐴 Purchase Prize Stallions — ${HorseTrader.PURCHASE_GOLD_COST}💰
          <span class="horse-cost">→ +${HorseTrader.PURCHASE_GOLD_RATE} gold/s (2.5 min) · +${HorseTrader.PURCHASE_PRESTIGE_REWARD} prestige · +${HorseTrader.PURCHASE_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--horse-trade${canTrade ? '' : ' btn--disabled'}" data-action="horse-trade" ${canTrade ? '' : 'disabled'}>
          ⚔️ Trade Saddle Equipment — ${HorseTrader.TRADE_IRON_COST}⚙️ + ${HorseTrader.TRADE_FOOD_COST}🌾
          <span class="horse-cost">→ +${HorseTrader.TRADE_IRON_RATE} iron/s (2 min) · +${HorseTrader.TRADE_PRESTIGE_REWARD} prestige · +${HorseTrader.TRADE_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--horse-away" data-action="horse-away">
          🚶 Send Away
          <span class="horse-cost">→ Horse trader gathers the string and rides on</span>
        </button>
      </div>
    </div>`;
}

function _imperialSilkWeaverSection() {
  if (!SilkWeaver.getActiveImperialSilkWeaver()) return '';
  const secs          = SilkWeaver.getSilkWeaverSecsLeft();
  const mana          = state.resources.mana ?? 0;
  const food          = state.resources.food ?? 0;
  const gold          = state.resources.gold ?? 0;
  const urg           = secs <= 15 ? ' silk-timer--urgent' : '';
  const canCommission = mana >= SilkWeaver.COMMISSION_MANA_COST && gold >= SilkWeaver.COMMISSION_GOLD_COST;
  const canPurchase   = food >= SilkWeaver.PURCHASE_FOOD_COST;
  return `
    <div class="silk-section--active">
      <div class="silk-header">
        <span class="silk-title">🧵 Imperial Silk Weaver</span>
        <span class="silk-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="silk-desc">A master silk weaver arrives bearing exquisite bolts of hand-dyed silk and embroidered tapestries worthy of the finest imperial courts.</div>
      <div class="silk-actions">
        <button class="btn--silk-commission${canCommission ? '' : ' btn--disabled'}" data-action="silk-commission" ${canCommission ? '' : 'disabled'}>
          🧵 Commission Silk Tapestries — ${SilkWeaver.COMMISSION_MANA_COST}✨ + ${SilkWeaver.COMMISSION_GOLD_COST}💰
          <span class="silk-cost">→ +${SilkWeaver.COMMISSION_MANA_RATE} mana/s (2.5 min) · +${SilkWeaver.COMMISSION_PRESTIGE_REWARD} prestige · +${SilkWeaver.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--silk-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="silk-purchase" ${canPurchase ? '' : 'disabled'}>
          🌾 Purchase Silk Bolts — ${SilkWeaver.PURCHASE_FOOD_COST}🌾
          <span class="silk-cost">→ +${SilkWeaver.PURCHASE_FOOD_RATE} food/s (2 min) · +${SilkWeaver.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--silk-away" data-action="silk-away">
          🚶 Send Away
          <span class="silk-cost">→ Silk weaver closes the lacquered case and departs</span>
        </button>
      </div>
    </div>`;
}

function _wanderingGemMerchantSection() {
  if (!GemMerchant.getActiveWanderingGemMerchant()) return '';
  const secs       = GemMerchant.getGemMerchantSecsLeft();
  const stone      = state.resources.stone ?? 0;
  const gold       = state.resources.gold  ?? 0;
  const urg        = secs <= 15 ? ' gem-timer--urgent' : '';
  const canTrade   = stone >= GemMerchant.TRADE_STONE_COST && gold >= GemMerchant.TRADE_GOLD_COST;
  const canPurchase = gold >= GemMerchant.PURCHASE_GOLD_COST;
  return `
    <div class="gem-section--active">
      <div class="gem-header">
        <span class="gem-title">💎 Wandering Gem Merchant</span>
        <span class="gem-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="gem-desc">A gem merchant arrives with a lacquered case of rubies, sapphires, and exotic stones from distant mountain ranges, offering trade partnerships or direct purchase.</div>
      <div class="gem-actions">
        <button class="btn--gem-trade${canTrade ? '' : ' btn--disabled'}" data-action="gem-trade" ${canTrade ? '' : 'disabled'}>
          💎 Trade Precious Gems — ${GemMerchant.TRADE_STONE_COST}🪨 + ${GemMerchant.TRADE_GOLD_COST}💰
          <span class="gem-cost">→ +${GemMerchant.TRADE_STONE_RATE} stone/s (2.5 min) · +${GemMerchant.TRADE_PRESTIGE_REWARD} prestige · +${GemMerchant.TRADE_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--gem-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="gem-purchase" ${canPurchase ? '' : 'disabled'}>
          💰 Purchase Gem Collection — ${GemMerchant.PURCHASE_GOLD_COST}💰
          <span class="gem-cost">→ +${GemMerchant.PURCHASE_GOLD_RATE} gold/s (2 min) · +${GemMerchant.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--gem-away" data-action="gem-away">
          🚶 Send Away
          <span class="gem-cost">→ Gem merchant closes the lacquered case and departs</span>
        </button>
      </div>
    </div>`;
}

function _imperialSiegeMasterSection() {
  if (!SiegeMaster.getActiveImperialSiegeMaster()) return '';
  const secs          = SiegeMaster.getSiegeMasterSecsLeft();
  const iron          = state.resources.iron ?? 0;
  const wood          = state.resources.wood ?? 0;
  const gold          = state.resources.gold ?? 0;
  const urg           = secs <= 15 ? ' siege-timer--urgent' : '';
  const canCommission = iron >= SiegeMaster.COMMISSION_IRON_COST && wood >= SiegeMaster.COMMISSION_WOOD_COST;
  const canPurchase   = gold >= SiegeMaster.PURCHASE_GOLD_COST;
  return `
    <div class="siege-section--active">
      <div class="siege-header">
        <span class="siege-title">⚔️ Imperial Siege Master</span>
        <span class="siege-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="siege-desc">A legendary siege master arrives bearing blueprints for advanced war engines and fortifications refined over decades of campaigns, offering to oversee construction or sell the plans.</div>
      <div class="siege-actions">
        <button class="btn--siege-commission${canCommission ? '' : ' btn--disabled'}" data-action="siege-commission" ${canCommission ? '' : 'disabled'}>
          ⚔️ Commission War Engines — ${SiegeMaster.COMMISSION_IRON_COST}⚙️ + ${SiegeMaster.COMMISSION_WOOD_COST}🪵
          <span class="siege-cost">→ +${SiegeMaster.COMMISSION_IRON_RATE} iron/s (2.5 min) · +${SiegeMaster.COMMISSION_PRESTIGE_REWARD} prestige · +${SiegeMaster.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--siege-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="siege-purchase" ${canPurchase ? '' : 'disabled'}>
          📜 Purchase Siege Plans — ${SiegeMaster.PURCHASE_GOLD_COST}💰
          <span class="siege-cost">→ +${SiegeMaster.PURCHASE_GOLD_RATE} gold/s (2 min) · +${SiegeMaster.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--siege-away" data-action="siege-away">
          🚶 Send Away
          <span class="siege-cost">→ Siege master rolls up the blueprints and departs</span>
        </button>
      </div>
    </div>`;
}

function _wanderingHatMakerSection() {
  if (!HatMaker.getActiveWanderingHatMaker()) return '';
  const secs          = HatMaker.getHatMakerSecsLeft();
  const food          = state.resources.food ?? 0;
  const wood          = state.resources.wood ?? 0;
  const gold          = state.resources.gold ?? 0;
  const urg           = secs <= 15 ? ' hatmaker-timer--urgent' : '';
  const canCommission = food >= HatMaker.COMMISSION_FOOD_COST && wood >= HatMaker.COMMISSION_WOOD_COST;
  const canPurchase   = gold >= HatMaker.PURCHASE_GOLD_COST;
  return `
    <div class="hatmaker-section--active">
      <div class="hatmaker-header">
        <span class="hatmaker-title">🎩 Wandering Hat Maker</span>
        <span class="hatmaker-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="hatmaker-desc">A wandering hat maker arrives with a wagon heaped with fine felt caps, feathered hats, and rolled patterns for royal crowns — offering to craft a grand collection of imperial headwear or share their craft secrets.</div>
      <div class="hatmaker-actions">
        <button class="btn--hatmaker-commission${canCommission ? '' : ' btn--disabled'}" data-action="hatmaker-commission" ${canCommission ? '' : 'disabled'}>
          🎩 Commission Royal Headwear — ${HatMaker.COMMISSION_FOOD_COST}🌾 + ${HatMaker.COMMISSION_WOOD_COST}🪵
          <span class="hatmaker-cost">→ +${HatMaker.COMMISSION_FOOD_RATE} food/s (2.5 min) · +${HatMaker.COMMISSION_PRESTIGE_REWARD} prestige · +${HatMaker.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--hatmaker-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="hatmaker-purchase" ${canPurchase ? '' : 'disabled'}>
          📜 Purchase Hat-Making Craft — ${HatMaker.PURCHASE_GOLD_COST}💰
          <span class="hatmaker-cost">→ +${HatMaker.PURCHASE_GOLD_RATE} gold/s (2 min) · +${HatMaker.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--hatmaker-away" data-action="hatmaker-away">
          🚶 Send Away
          <span class="hatmaker-cost">→ Hat maker tips their cap and departs</span>
        </button>
      </div>
    </div>`;
}

function _imperialGoldsmithSection() {
  if (!Goldsmith.getActiveImperialGoldsmith()) return '';
  const secs          = Goldsmith.getGoldsmithSecsLeft();
  const iron          = state.resources.iron ?? 0;
  const gold          = state.resources.gold ?? 0;
  const stone         = state.resources.stone ?? 0;
  const urg           = secs <= 15 ? ' goldsmith-timer--urgent' : '';
  const canCommission = iron >= Goldsmith.COMMISSION_IRON_COST && gold >= Goldsmith.COMMISSION_GOLD_COST;
  const canPurchase   = stone >= Goldsmith.PURCHASE_STONE_COST;
  return `
    <div class="goldsmith-section--active">
      <div class="goldsmith-header">
        <span class="goldsmith-title">🥇 Imperial Goldsmith</span>
        <span class="goldsmith-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="goldsmith-desc">A master imperial goldsmith arrives bearing exquisite golden crowns, scepters, and ceremonial vessels forged with ancient techniques — offering to craft golden regalia or share precious metalworking secrets.</div>
      <div class="goldsmith-actions">
        <button class="btn--goldsmith-commission${canCommission ? '' : ' btn--disabled'}" data-action="goldsmith-commission" ${canCommission ? '' : 'disabled'}>
          🥇 Commission Golden Regalia — ${Goldsmith.COMMISSION_IRON_COST}⚙️ + ${Goldsmith.COMMISSION_GOLD_COST}💰
          <span class="goldsmith-cost">→ +${Goldsmith.COMMISSION_IRON_RATE} iron/s (2.5 min) · +${Goldsmith.COMMISSION_PRESTIGE_REWARD} prestige · +${Goldsmith.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--goldsmith-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="goldsmith-purchase" ${canPurchase ? '' : 'disabled'}>
          📜 Purchase Gold Crafting Secrets — ${Goldsmith.PURCHASE_STONE_COST}🪨
          <span class="goldsmith-cost">→ +${Goldsmith.PURCHASE_STONE_RATE} stone/s (2 min) · +${Goldsmith.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--goldsmith-away" data-action="goldsmith-away">
          🚶 Send Away
          <span class="goldsmith-cost">→ Goldsmith departs with quiet dignity</span>
        </button>
      </div>
    </div>`;
}

function _wanderingOilMerchantSection() {
  if (!OilMerchant.getActiveWanderingOilMerchant()) return '';
  const secs        = OilMerchant.getOilMerchantSecsLeft();
  const food        = state.resources.food ?? 0;
  const wood        = state.resources.wood ?? 0;
  const gold        = state.resources.gold ?? 0;
  const urg         = secs <= 15 ? ' oilmerchant-timer--urgent' : '';
  const canPurchase = food >= OilMerchant.PURCHASE_FOOD_COST;
  const canTrade    = wood >= OilMerchant.TRADE_WOOD_COST && gold >= OilMerchant.TRADE_GOLD_COST;
  return `
    <div class="oilmerchant-section--active">
      <div class="oilmerchant-header">
        <span class="oilmerchant-title">🫙 Wandering Oil Merchant</span>
        <span class="oilmerchant-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="oilmerchant-desc">A wandering oil merchant arrives with barrels of fine olive oil and brass lamp supplies from distant sun-drenched groves — offering premium olive oil reserves or superior lamp supplies for the palace treasury.</div>
      <div class="oilmerchant-actions">
        <button class="btn--oilmerchant-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="oilmerchant-purchase" ${canPurchase ? '' : 'disabled'}>
          🫙 Purchase Olive Oil Reserves — ${OilMerchant.PURCHASE_FOOD_COST}🌾
          <span class="oilmerchant-cost">→ +${OilMerchant.PURCHASE_FOOD_RATE} food/s (2.5 min) · +${OilMerchant.PURCHASE_PRESTIGE_REWARD} prestige · +${OilMerchant.PURCHASE_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--oilmerchant-trade${canTrade ? '' : ' btn--disabled'}" data-action="oilmerchant-trade" ${canTrade ? '' : 'disabled'}>
          🔦 Trade Oil Lamp Supplies — ${OilMerchant.TRADE_WOOD_COST}🪵 + ${OilMerchant.TRADE_GOLD_COST}💰
          <span class="oilmerchant-cost">→ +${OilMerchant.TRADE_GOLD_RATE} gold/s (2 min) · +${OilMerchant.TRADE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--oilmerchant-away" data-action="oilmerchant-away">
          🚶 Send Away
          <span class="oilmerchant-cost">→ Oil merchant loads up the cart and departs</span>
        </button>
      </div>
    </div>`;
}

function _imperialQuarrymanSection() {
  if (!Quarryman.getActiveImperialQuarryman()) return '';
  const secs          = Quarryman.getQuarrymanSecsLeft();
  const stone         = state.resources.stone ?? 0;
  const gold          = state.resources.gold ?? 0;
  const iron          = state.resources.iron ?? 0;
  const urg           = secs <= 15 ? ' quarryman-timer--urgent' : '';
  const canCommission = stone >= Quarryman.COMMISSION_STONE_COST && gold >= Quarryman.COMMISSION_GOLD_COST;
  const canExchange   = iron >= Quarryman.EXCHANGE_IRON_COST;
  return `
    <div class="quarryman-section--active">
      <div class="quarryman-header">
        <span class="quarryman-title">🪨 Imperial Quarryman</span>
        <span class="quarryman-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="quarryman-desc">A master imperial quarryman arrives with survey plans, precision iron chisels, and quarrying charts mapping the finest stone deposits — offering to oversee grand stone works or share advanced quarrying techniques.</div>
      <div class="quarryman-actions">
        <button class="btn--quarryman-commission${canCommission ? '' : ' btn--disabled'}" data-action="quarryman-commission" ${canCommission ? '' : 'disabled'}>
          🪨 Commission Stone Works — ${Quarryman.COMMISSION_STONE_COST}🪨 + ${Quarryman.COMMISSION_GOLD_COST}💰
          <span class="quarryman-cost">→ +${Quarryman.COMMISSION_STONE_RATE} stone/s (2.5 min) · +${Quarryman.COMMISSION_PRESTIGE_REWARD} prestige · +${Quarryman.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--quarryman-exchange${canExchange ? '' : ' btn--disabled'}" data-action="quarryman-exchange" ${canExchange ? '' : 'disabled'}>
          ⛏️ Exchange Quarrying Techniques — ${Quarryman.EXCHANGE_IRON_COST}⚙️
          <span class="quarryman-cost">→ +${Quarryman.EXCHANGE_IRON_RATE} iron/s (2 min) · +${Quarryman.EXCHANGE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--quarryman-away" data-action="quarryman-away">
          🚶 Send Away
          <span class="quarryman-cost">→ Quarryman rolls up the plans and departs</span>
        </button>
      </div>
    </div>`;
}

function _wanderingSoapMakerSection() {
  if (!SoapMaker.getActiveWanderingSoapMaker()) return '';
  const secs          = SoapMaker.getSoapMakerSecsLeft();
  const food          = state.resources.food ?? 0;
  const wood          = state.resources.wood ?? 0;
  const gold          = state.resources.gold ?? 0;
  const urg           = secs <= 15 ? ' soapmaker-timer--urgent' : '';
  const canCommission = food >= SoapMaker.COMMISSION_FOOD_COST && wood >= SoapMaker.COMMISSION_WOOD_COST;
  const canPurchase   = gold >= SoapMaker.PURCHASE_GOLD_COST;
  return `
    <div class="soapmaker-section--active">
      <div class="soapmaker-header">
        <span class="soapmaker-title">🧼 Wandering Soap Maker</span>
        <span class="soapmaker-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="soapmaker-desc">A wandering soap maker arrives bearing fragrant herbal soaps, ash lye crocks, and aromatic oils gathered from distant market towns — offering to establish an imperial soap works or sell artisan soaps to the court.</div>
      <div class="soapmaker-actions">
        <button class="btn--soapmaker-commission${canCommission ? '' : ' btn--disabled'}" data-action="soapmaker-commission" ${canCommission ? '' : 'disabled'}>
          🧼 Commission Imperial Soap Works — ${SoapMaker.COMMISSION_FOOD_COST}🌾 + ${SoapMaker.COMMISSION_WOOD_COST}🪵
          <span class="soapmaker-cost">→ +${SoapMaker.COMMISSION_FOOD_RATE} food/s (2.5 min) · +${SoapMaker.COMMISSION_PRESTIGE_REWARD} prestige · +${SoapMaker.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--soapmaker-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="soapmaker-purchase" ${canPurchase ? '' : 'disabled'}>
          🌿 Purchase Aromatic Soaps — ${SoapMaker.PURCHASE_GOLD_COST}💰
          <span class="soapmaker-cost">→ +${SoapMaker.PURCHASE_GOLD_RATE} gold/s (2 min) · +${SoapMaker.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--soapmaker-away" data-action="soapmaker-away">
          🚶 Send Away
          <span class="soapmaker-cost">→ Soap maker packs up and departs</span>
        </button>
      </div>
    </div>`;
}

function _imperialMetalcasterSection() {
  if (!Metalcaster.getActiveImperialMetalcaster()) return '';
  const secs          = Metalcaster.getMetalcasterSecsLeft();
  const iron          = state.resources.iron ?? 0;
  const stone         = state.resources.stone ?? 0;
  const gold          = state.resources.gold ?? 0;
  const urg           = secs <= 15 ? ' metalcaster-timer--urgent' : '';
  const canCommission = iron >= Metalcaster.COMMISSION_IRON_COST && stone >= Metalcaster.COMMISSION_STONE_COST;
  const canPurchase   = gold >= Metalcaster.PURCHASE_GOLD_COST;
  return `
    <div class="metalcaster-section--active">
      <div class="metalcaster-header">
        <span class="metalcaster-title">🔩 Imperial Metalcaster</span>
        <span class="metalcaster-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="metalcaster-desc">A renowned imperial metalcaster arrives bearing gleaming bronze casting moulds, precision iron tongs, and furnace designs capable of producing magnificent decorative sculptures and refined metal goods — offering foundry expertise or fine cast-metal wares.</div>
      <div class="metalcaster-actions">
        <button class="btn--metalcaster-commission${canCommission ? '' : ' btn--disabled'}" data-action="metalcaster-commission" ${canCommission ? '' : 'disabled'}>
          🔩 Commission Metal Sculptures — ${Metalcaster.COMMISSION_IRON_COST}⚙️ + ${Metalcaster.COMMISSION_STONE_COST}🪨
          <span class="metalcaster-cost">→ +${Metalcaster.COMMISSION_IRON_RATE} iron/s (2.5 min) · +${Metalcaster.COMMISSION_PRESTIGE_REWARD} prestige · +${Metalcaster.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--metalcaster-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="metalcaster-purchase" ${canPurchase ? '' : 'disabled'}>
          🪙 Purchase Cast Metal Goods — ${Metalcaster.PURCHASE_GOLD_COST}💰
          <span class="metalcaster-cost">→ +${Metalcaster.PURCHASE_GOLD_RATE} gold/s (2 min) · +${Metalcaster.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--metalcaster-away" data-action="metalcaster-away">
          🚶 Send Away
          <span class="metalcaster-cost">→ Metalcaster loads the moulds and departs</span>
        </button>
      </div>
    </div>`;
}

function _wanderingGloveMakerSection() {
  if (!GloveMaker.getActiveWanderingGloveMaker()) return '';
  const secs       = GloveMaker.getGloveMakerSecsLeft();
  const food       = state.resources.food ?? 0;
  const wood       = state.resources.wood ?? 0;
  const gold       = state.resources.gold ?? 0;
  const urg        = secs <= 15 ? ' glovemaker-timer--urgent' : '';
  const canCraft   = food >= GloveMaker.CRAFT_FOOD_COST && wood >= GloveMaker.CRAFT_WOOD_COST;
  const canPurchase = gold >= GloveMaker.PURCHASE_GOLD_COST;
  return `
    <div class="glovemaker-section--active">
      <div class="glovemaker-header">
        <span class="glovemaker-title">🧤 Wandering Glove Maker</span>
        <span class="glovemaker-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="glovemaker-desc">A wandering glove maker arrives bearing supple calf leather, linen padding, and coloured stitching thread — offering to craft fine riding gloves for the imperial cavalry or sell artisan leather gloves to the court.</div>
      <div class="glovemaker-actions">
        <button class="btn--glovemaker-craft${canCraft ? '' : ' btn--disabled'}" data-action="glovemaker-craft" ${canCraft ? '' : 'disabled'}>
          🧤 Craft Riding Gloves — ${GloveMaker.CRAFT_FOOD_COST}🌾 + ${GloveMaker.CRAFT_WOOD_COST}🪵
          <span class="glovemaker-cost">→ +${GloveMaker.CRAFT_FOOD_RATE} food/s (2.5 min) · +${GloveMaker.CRAFT_PRESTIGE_REWARD} prestige · +${GloveMaker.CRAFT_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--glovemaker-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="glovemaker-purchase" ${canPurchase ? '' : 'disabled'}>
          🪡 Purchase Leather Gloves — ${GloveMaker.PURCHASE_GOLD_COST}💰
          <span class="glovemaker-cost">→ +${GloveMaker.PURCHASE_GOLD_RATE} gold/s (2 min) · +${GloveMaker.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--glovemaker-away" data-action="glovemaker-away">
          🚶 Send Away
          <span class="glovemaker-cost">→ Glove maker packs up and departs</span>
        </button>
      </div>
    </div>`;
}

function _imperialTelescopeMakerSection() {
  if (!TelescopeMkr.getActiveImperialTelescopeMaker()) return '';
  const secs          = TelescopeMkr.getTelescopeMakerSecsLeft();
  const iron          = state.resources.iron ?? 0;
  const mana          = state.resources.mana ?? 0;
  const gold          = state.resources.gold ?? 0;
  const urg           = secs <= 15 ? ' telescope-timer--urgent' : '';
  const canCommission = iron >= TelescopeMkr.COMMISSION_IRON_COST && mana >= TelescopeMkr.COMMISSION_MANA_COST;
  const canPurchase   = gold >= TelescopeMkr.PURCHASE_GOLD_COST;
  return `
    <div class="telescope-section--active">
      <div class="telescope-header">
        <span class="telescope-title">🔭 Imperial Telescope Maker</span>
        <span class="telescope-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="telescope-desc">A renowned imperial telescope maker arrives bearing finely ground glass lenses, polished brass tubes, and celestial charts — offering to craft a precision naval telescope for the imperial fleet or sell their finest astronomical lens to the court scholars.</div>
      <div class="telescope-actions">
        <button class="btn--telescope-commission${canCommission ? '' : ' btn--disabled'}" data-action="telescope-commission" ${canCommission ? '' : 'disabled'}>
          🔭 Commission Naval Telescope — ${TelescopeMkr.COMMISSION_IRON_COST}⚙️ + ${TelescopeMkr.COMMISSION_MANA_COST}✨
          <span class="telescope-cost">→ +${TelescopeMkr.COMMISSION_IRON_RATE} iron/s (2.5 min) · +${TelescopeMkr.COMMISSION_PRESTIGE_REWARD} prestige · +${TelescopeMkr.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--telescope-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="telescope-purchase" ${canPurchase ? '' : 'disabled'}>
          🌌 Purchase Celestial Lens — ${TelescopeMkr.PURCHASE_GOLD_COST}💰
          <span class="telescope-cost">→ +${TelescopeMkr.PURCHASE_MANA_RATE} mana/s (2 min) · +${TelescopeMkr.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--telescope-away" data-action="telescope-away">
          🚶 Send Away
          <span class="telescope-cost">→ Telescope maker packs the lenses and departs</span>
        </button>
      </div>
    </div>`;
}

function _wanderingPaperMakerSection() {
  if (!PaperMaker.getActiveWanderingPaperMaker()) return '';
  const secs           = PaperMaker.getPaperMakerSecsLeft();
  const wood           = state.resources.wood ?? 0;
  const mana           = state.resources.mana ?? 0;
  const gold           = state.resources.gold ?? 0;
  const urg            = secs <= 15 ? ' papermaker-timer--urgent' : '';
  const canCommission  = wood >= PaperMaker.COMMISSION_WOOD_COST && mana >= PaperMaker.COMMISSION_MANA_COST;
  const canPurchase    = gold >= PaperMaker.PURCHASE_GOLD_COST;
  return `
    <div class="papermaker-section--active">
      <div class="papermaker-header">
        <span class="papermaker-title">📜 Wandering Paper Maker</span>
        <span class="papermaker-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="papermaker-desc">A wandering paper maker arrives at court laden with bundles of finely pressed linen sheets, smooth reed parchment, and vials of shimmering iron gall ink — offering to illuminate writing sheets for the imperial scriptorium or sell quality paper stock to the court scholars.</div>
      <div class="papermaker-actions">
        <button class="btn--papermaker-commission${canCommission ? '' : ' btn--disabled'}" data-action="papermaker-commission" ${canCommission ? '' : 'disabled'}>
          📜 Commission Illuminated Sheets — ${PaperMaker.COMMISSION_WOOD_COST}🪵 + ${PaperMaker.COMMISSION_MANA_COST}✨
          <span class="papermaker-cost">→ +${PaperMaker.COMMISSION_MANA_RATE} mana/s (2.5 min) · +${PaperMaker.COMMISSION_PRESTIGE_REWARD} prestige · +${PaperMaker.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--papermaker-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="papermaker-purchase" ${canPurchase ? '' : 'disabled'}>
          📄 Purchase Fine Paper — ${PaperMaker.PURCHASE_GOLD_COST}💰
          <span class="papermaker-cost">→ +${PaperMaker.PURCHASE_GOLD_RATE} gold/s (2 min) · +${PaperMaker.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--papermaker-away" data-action="papermaker-away">
          🚶 Send Away
          <span class="papermaker-cost">→ Paper maker bundles the sheets and departs</span>
        </button>
      </div>
    </div>`;
}

function _imperialCoinMinterSection() {
  if (!CoinMinter.getActiveImperialCoinMinter()) return '';
  const secs           = CoinMinter.getCoinMinterSecsLeft();
  const iron           = state.resources.iron ?? 0;
  const gold           = state.resources.gold ?? 0;
  const stone          = state.resources.stone ?? 0;
  const urg            = secs <= 15 ? ' coinminter-timer--urgent' : '';
  const canCommission  = iron >= CoinMinter.COMMISSION_IRON_COST && gold >= CoinMinter.COMMISSION_GOLD_COST;
  const canPurchase    = stone >= CoinMinter.PURCHASE_STONE_COST;
  return `
    <div class="coinminter-section--active">
      <div class="coinminter-header">
        <span class="coinminter-title">🪙 Imperial Coin Minter</span>
        <span class="coinminter-timer${urg}">⏱ ${secs}s</span>
      </div>
      <div class="coinminter-desc">An imperial coin minter arrives at the palace treasury bearing polished iron dies engraved with the imperial crest, bronze blanks, and precision engraving tools — offering to strike a commemorative run of golden imperial coins or teach master minting techniques to the palace craftsmen.</div>
      <div class="coinminter-actions">
        <button class="btn--coinminter-commission${canCommission ? '' : ' btn--disabled'}" data-action="coinminter-commission" ${canCommission ? '' : 'disabled'}>
          🪙 Commission Golden Coins — ${CoinMinter.COMMISSION_IRON_COST}⚙️ + ${CoinMinter.COMMISSION_GOLD_COST}💰
          <span class="coinminter-cost">→ +${CoinMinter.COMMISSION_IRON_RATE} iron/s (2.5 min) · +${CoinMinter.COMMISSION_PRESTIGE_REWARD} prestige · +${CoinMinter.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--coinminter-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="coinminter-purchase" ${canPurchase ? '' : 'disabled'}>
          🔨 Purchase Minting Secrets — ${CoinMinter.PURCHASE_STONE_COST}🪨
          <span class="coinminter-cost">→ +${CoinMinter.PURCHASE_STONE_RATE} stone/s (2 min) · +${CoinMinter.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--coinminter-away" data-action="coinminter-away">
          🚶 Send Away
          <span class="coinminter-cost">→ Coin minter wraps the dies and departs</span>
        </button>
      </div>
    </div>`;
}

function _wanderingCartographerGuildSection() {
  if (!CartGuild.getActiveCartographerGuild()) return '';
  const secs           = CartGuild.getCartographerGuildSecsLeft();
  const urgent         = secs <= 15;
  const gold           = state.resources.gold  ?? 0;
  const wood           = state.resources.wood  ?? 0;
  const canSurvey      = wood >= CartGuild.SURVEY_WOOD_COST && gold >= CartGuild.SURVEY_GOLD_COST;
  const canPurchase    = gold >= CartGuild.PURCHASE_GOLD_COST;
  return `
    <div class="cartguild-section--active">
      <div class="cartguild-header">
        <span class="cartguild-title">🗺️ Wandering Cartographer's Guild</span>
        <span class="cartguild-timer${urgent ? ' cartguild-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="cartguild-desc">A guild of cartographers arrives bearing rolled parchment surveys and brass instruments, offering to chart the surrounding territory or sell their precision surveying tools.</div>
      <div class="cartguild-actions">
        <button class="btn--cartguild-survey${canSurvey ? '' : ' btn--disabled'}" data-action="cartguild-survey" ${canSurvey ? '' : 'disabled'}>
          🗺️ Commission Regional Survey — ${CartGuild.SURVEY_WOOD_COST}🪵 + ${CartGuild.SURVEY_GOLD_COST}💰
          <span class="cartguild-cost">→ +${CartGuild.SURVEY_WOOD_RATE} wood/s (2.5 min) · +${CartGuild.SURVEY_PRESTIGE_REWARD} prestige · +${CartGuild.SURVEY_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--cartguild-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="cartguild-purchase" ${canPurchase ? '' : 'disabled'}>
          🔭 Purchase Surveying Instruments — ${CartGuild.PURCHASE_GOLD_COST}💰
          <span class="cartguild-cost">→ +${CartGuild.PURCHASE_GOLD_RATE} gold/s (2 min) · +${CartGuild.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--cartguild-away" data-action="cartguild-away">
          🚶 Send Away
          <span class="cartguild-cost">→ Guild departs with their instruments</span>
        </button>
      </div>
    </div>`;
}

function _imperialSpymasterSection() {
  if (!Spymaster.getActiveImperialSpymaster()) return '';
  const secs           = Spymaster.getSpymasterSecsLeft();
  const urgent         = secs <= 15;
  const iron           = state.resources.iron ?? 0;
  const gold           = state.resources.gold ?? 0;
  const mana           = state.resources.mana ?? 0;
  const canCommission  = iron >= Spymaster.COMMISSION_IRON_COST && gold >= Spymaster.COMMISSION_GOLD_COST;
  const canPurchase    = mana >= Spymaster.PURCHASE_MANA_COST;
  return `
    <div class="spymaster-section--active">
      <div class="spymaster-header">
        <span class="spymaster-title">🕵️ Imperial Spymaster</span>
        <span class="spymaster-timer${urgent ? ' spymaster-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="spymaster-desc">A cloaked spymaster slips through the servants' entrance bearing intelligence dossiers and cipher tablets, offering to establish a hidden network or sell advanced cipher codes.</div>
      <div class="spymaster-actions">
        <button class="btn--spymaster-network${canCommission ? '' : ' btn--disabled'}" data-action="spymaster-network" ${canCommission ? '' : 'disabled'}>
          🕵️ Commission Intelligence Network — ${Spymaster.COMMISSION_IRON_COST}⚙️ + ${Spymaster.COMMISSION_GOLD_COST}💰
          <span class="spymaster-cost">→ +${Spymaster.COMMISSION_IRON_RATE} iron/s (2.5 min) · +${Spymaster.COMMISSION_PRESTIGE_REWARD} prestige · +${Spymaster.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--spymaster-cipher${canPurchase ? '' : ' btn--disabled'}" data-action="spymaster-cipher" ${canPurchase ? '' : 'disabled'}>
          📜 Purchase Cipher Codes — ${Spymaster.PURCHASE_MANA_COST}✨
          <span class="spymaster-cost">→ +${Spymaster.PURCHASE_MANA_RATE} mana/s (2 min) · +${Spymaster.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--spymaster-away" data-action="spymaster-away">
          🚶 Send Away
          <span class="spymaster-cost">→ Spymaster slips back into the shadows</span>
        </button>
      </div>
    </div>`;
}

function _wanderingGemPolisherSection() {
  if (!GemPolisher.getActiveWanderingGemPolisher()) return '';
  const secs          = GemPolisher.getGemPolisherSecsLeft();
  const urgent        = secs <= 15;
  const iron          = state.resources.iron  ?? 0;
  const stone         = state.resources.stone ?? 0;
  const gold          = state.resources.gold  ?? 0;
  const canCommission = iron >= GemPolisher.COMMISSION_IRON_COST && stone >= GemPolisher.COMMISSION_STONE_COST;
  const canPurchase   = gold >= GemPolisher.PURCHASE_GOLD_COST;
  return `
    <div class="gempolisher-section--active">
      <div class="gempolisher-header">
        <span class="gempolisher-title">💎 Wandering Gem Polisher</span>
        <span class="gempolisher-timer${urgent ? ' gempolisher-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="gempolisher-desc">A skilled gem polisher arrives carrying a velvet-lined case of uncut stones, polishing wheels of finest emery cloth, and a portfolio of finished royal gems.</div>
      <div class="gempolisher-actions">
        <button class="btn--gempolisher-commission${canCommission ? '' : ' btn--disabled'}" data-action="gempolisher-commission" ${canCommission ? '' : 'disabled'}>
          💎 Commission Royal Gem Collection — ${GemPolisher.COMMISSION_IRON_COST}⚙️ + ${GemPolisher.COMMISSION_STONE_COST}🪨
          <span class="gempolisher-cost">→ +${GemPolisher.COMMISSION_IRON_RATE} iron/s (2.5 min) · +${GemPolisher.COMMISSION_PRESTIGE_REWARD} prestige · +${GemPolisher.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--gempolisher-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="gempolisher-purchase" ${canPurchase ? '' : 'disabled'}>
          🔬 Purchase Polishing Techniques — ${GemPolisher.PURCHASE_GOLD_COST}💰
          <span class="gempolisher-cost">→ +${GemPolisher.PURCHASE_STONE_RATE} stone/s (2 min) · +${GemPolisher.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--gempolisher-away" data-action="gempolisher-away">
          🚶 Send Away
          <span class="gempolisher-cost">→ Polisher departs with their velvet case</span>
        </button>
      </div>
    </div>`;
}

function _imperialAstrolabeMakerSection() {
  if (!AstrolabeMkr.getActiveImperialAstrolabeMaker()) return '';
  const secs          = AstrolabeMkr.getAstrolabeMakerSecsLeft();
  const urgent        = secs <= 15;
  const iron          = state.resources.iron ?? 0;
  const mana          = state.resources.mana ?? 0;
  const gold          = state.resources.gold ?? 0;
  const canCommission = iron >= AstrolabeMkr.COMMISSION_IRON_COST && mana >= AstrolabeMkr.COMMISSION_MANA_COST;
  const canPurchase   = gold >= AstrolabeMkr.PURCHASE_GOLD_COST;
  return `
    <div class="astrolabe-section--active">
      <div class="astrolabe-header">
        <span class="astrolabe-title">🌐 Imperial Astrolabe Maker</span>
        <span class="astrolabe-timer${urgent ? ' astrolabe-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="astrolabe-desc">A master astrolabe maker arrives bearing intricately engraved brass astrolabes, celestial sphere models, and hand-drawn star charts of the observable heavens.</div>
      <div class="astrolabe-actions">
        <button class="btn--astrolabe-commission${canCommission ? '' : ' btn--disabled'}" data-action="astrolabe-commission" ${canCommission ? '' : 'disabled'}>
          🌐 Commission Navigation Astrolabe — ${AstrolabeMkr.COMMISSION_IRON_COST}⚙️ + ${AstrolabeMkr.COMMISSION_MANA_COST}✨
          <span class="astrolabe-cost">→ +${AstrolabeMkr.COMMISSION_MANA_RATE} mana/s (2.5 min) · +${AstrolabeMkr.COMMISSION_PRESTIGE_REWARD} prestige · +${AstrolabeMkr.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--astrolabe-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="astrolabe-purchase" ${canPurchase ? '' : 'disabled'}>
          🗺️ Purchase Celestial Charts — ${AstrolabeMkr.PURCHASE_GOLD_COST}💰
          <span class="astrolabe-cost">→ +${AstrolabeMkr.PURCHASE_GOLD_RATE} gold/s (2 min) · +${AstrolabeMkr.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--astrolabe-away" data-action="astrolabe-away">
          🚶 Send Away
          <span class="astrolabe-cost">→ Maker departs with the brass instruments</span>
        </button>
      </div>
    </div>`;
}

function _wanderingLocksmithSection() {
  if (!Locksmith.getActiveWanderingLocksmith()) return '';
  const secs       = Locksmith.getLocksmithSecsLeft();
  const urgent     = secs <= 15;
  const iron       = state.resources.iron  ?? 0;
  const stone      = state.resources.stone ?? 0;
  const gold       = state.resources.gold  ?? 0;
  const canForge   = iron >= Locksmith.FORGE_IRON_COST && stone >= Locksmith.FORGE_STONE_COST;
  const canShare   = gold >= Locksmith.SHARE_GOLD_COST;
  return `
    <div class="locksmith-section--active">
      <div class="locksmith-header">
        <span class="locksmith-title">🔐 Wandering Locksmith</span>
        <span class="locksmith-timer${urgent ? ' locksmith-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="locksmith-desc">A master locksmith arrives bearing a leather satchel of precision-crafted iron picks, tumblers, and intricate vault mechanisms from distant workshops.</div>
      <div class="locksmith-actions">
        <button class="btn--locksmith-forge${canForge ? '' : ' btn--disabled'}" data-action="locksmith-forge" ${canForge ? '' : 'disabled'}>
          🔐 Craft Imperial Vault Locks — ${Locksmith.FORGE_IRON_COST}⚙️ + ${Locksmith.FORGE_STONE_COST}🪨
          <span class="locksmith-cost">→ +${Locksmith.FORGE_IRON_RATE} iron/s (2.5 min) · +${Locksmith.FORGE_PRESTIGE_REWARD} prestige · +${Locksmith.FORGE_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--locksmith-share${canShare ? '' : ' btn--disabled'}" data-action="locksmith-share" ${canShare ? '' : 'disabled'}>
          🗝️ Share Lock-Making Craft — ${Locksmith.SHARE_GOLD_COST}💰
          <span class="locksmith-cost">→ +${Locksmith.SHARE_GOLD_RATE} gold/s (2 min) · +${Locksmith.SHARE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--locksmith-away" data-action="locksmith-away">
          🚶 Send Away
          <span class="locksmith-cost">→ Locksmith departs with the iron tumblers</span>
        </button>
      </div>
    </div>`;
}

function _imperialCalligrapherSection() {
  if (!Calligrapher.getActiveImperialCalligrapher()) return '';
  const secs            = Calligrapher.getCalligrapherSecsLeft();
  const urgent          = secs <= 15;
  const mana            = state.resources.mana ?? 0;
  const gold            = state.resources.gold ?? 0;
  const canCommission   = mana >= Calligrapher.COMMISSION_MANA_COST && gold >= Calligrapher.COMMISSION_GOLD_COST;
  const canPurchase     = gold >= Calligrapher.PURCHASE_GOLD_COST;
  return `
    <div class="calligrapher-section--active">
      <div class="calligrapher-header">
        <span class="calligrapher-title">✒️ Imperial Calligrapher</span>
        <span class="calligrapher-timer${urgent ? ' calligrapher-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="calligrapher-desc">A renowned imperial calligrapher arrives bearing ornate brushes, hand-ground ink stones, and rolls of finest vellum for inscribing elaborate imperial decrees in gilded script.</div>
      <div class="calligrapher-actions">
        <button class="btn--calligrapher-commission${canCommission ? '' : ' btn--disabled'}" data-action="calligrapher-commission" ${canCommission ? '' : 'disabled'}>
          ✒️ Commission Imperial Decrees — ${Calligrapher.COMMISSION_MANA_COST}✨ + ${Calligrapher.COMMISSION_GOLD_COST}💰
          <span class="calligrapher-cost">→ +${Calligrapher.COMMISSION_MANA_RATE} mana/s (2.5 min) · +${Calligrapher.COMMISSION_PRESTIGE_REWARD} prestige · +${Calligrapher.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--calligrapher-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="calligrapher-purchase" ${canPurchase ? '' : 'disabled'}>
          📜 Purchase Script Collection — ${Calligrapher.PURCHASE_GOLD_COST}💰
          <span class="calligrapher-cost">→ +${Calligrapher.PURCHASE_GOLD_RATE} gold/s (2 min) · +${Calligrapher.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--calligrapher-away" data-action="calligrapher-away">
          🚶 Send Away
          <span class="calligrapher-cost">→ Calligrapher departs with the ink stones</span>
        </button>
      </div>
    </div>`;
}

function _wanderingCoppersmithSection() {
  if (!Coppersmith.getActiveWanderingCoppersmith()) return '';
  const secs          = Coppersmith.getCoppersmithSecsLeft();
  const urgent        = secs <= 15;
  const iron          = state.resources.iron  ?? 0;
  const gold          = state.resources.gold  ?? 0;
  const stone         = state.resources.stone ?? 0;
  const canCommission = iron >= Coppersmith.COMMISSION_IRON_COST && gold >= Coppersmith.COMMISSION_GOLD_COST;
  const canPurchase   = stone >= Coppersmith.PURCHASE_STONE_COST;
  return `
    <div class="coppersmith-section--active">
      <div class="coppersmith-header">
        <span class="coppersmith-title">🔧 Wandering Coppersmith</span>
        <span class="coppersmith-timer${urgent ? ' coppersmith-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="coppersmith-desc">A skilled coppersmith arrives bearing a portable forge, hammers, and gleaming copper ingots — offering to craft imperial tools or share ancient coppersmithing secrets with the palace artisans.</div>
      <div class="coppersmith-actions">
        <button class="btn--coppersmith-commission${canCommission ? '' : ' btn--disabled'}" data-action="coppersmith-commission" ${canCommission ? '' : 'disabled'}>
          🔧 Commission Copper Tools — ${Coppersmith.COMMISSION_IRON_COST}⚙️ + ${Coppersmith.COMMISSION_GOLD_COST}💰
          <span class="coppersmith-cost">→ +${Coppersmith.COMMISSION_IRON_RATE} iron/s (2.5 min) · +${Coppersmith.COMMISSION_PRESTIGE_REWARD} prestige · +${Coppersmith.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--coppersmith-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="coppersmith-purchase" ${canPurchase ? '' : 'disabled'}>
          🪙 Purchase Coppersmith Secrets — ${Coppersmith.PURCHASE_STONE_COST}🪨
          <span class="coppersmith-cost">→ +${Coppersmith.PURCHASE_STONE_RATE} stone/s (2 min) · +${Coppersmith.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--coppersmith-away" data-action="coppersmith-away">
          🚶 Send Away
          <span class="coppersmith-cost">→ Coppersmith departs with the copper ingots</span>
        </button>
      </div>
    </div>`;
}

function _imperialScrivenerSection() {
  if (!Scrivener.getActiveImperialScrivener()) return '';
  const secs          = Scrivener.getScrivenerSecsLeft();
  const urgent        = secs <= 15;
  const mana          = state.resources.mana ?? 0;
  const gold          = state.resources.gold ?? 0;
  const wood          = state.resources.wood ?? 0;
  const canCommission = mana >= Scrivener.COMMISSION_MANA_COST && gold >= Scrivener.COMMISSION_GOLD_COST;
  const canPurchase   = wood >= Scrivener.PURCHASE_WOOD_COST;
  return `
    <div class="scrivener-section--active">
      <div class="scrivener-header">
        <span class="scrivener-title">📋 Imperial Scrivener</span>
        <span class="scrivener-timer${urgent ? ' scrivener-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="scrivener-desc">A master scrivener arrives bearing a portable writing desk, quill pens, and blank vellum sheets — offering to inscribe royal scrolls with official proclamations or share advanced papermaking techniques.</div>
      <div class="scrivener-actions">
        <button class="btn--scrivener-commission${canCommission ? '' : ' btn--disabled'}" data-action="scrivener-commission" ${canCommission ? '' : 'disabled'}>
          📋 Commission Royal Scrolls — ${Scrivener.COMMISSION_MANA_COST}✨ + ${Scrivener.COMMISSION_GOLD_COST}💰
          <span class="scrivener-cost">→ +${Scrivener.COMMISSION_MANA_RATE} mana/s (2.5 min) · +${Scrivener.COMMISSION_PRESTIGE_REWARD} prestige · +${Scrivener.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--scrivener-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="scrivener-purchase" ${canPurchase ? '' : 'disabled'}>
          📚 Purchase Scrivener's Compendium — ${Scrivener.PURCHASE_WOOD_COST}🪵
          <span class="scrivener-cost">→ +${Scrivener.PURCHASE_WOOD_RATE} wood/s (2 min) · +${Scrivener.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--scrivener-away" data-action="scrivener-away">
          🚶 Send Away
          <span class="scrivener-cost">→ Scrivener departs with the writing desk</span>
        </button>
      </div>
    </div>`;
}

function _wanderingMirrorMakerSection() {
  if (!MirrorMaker.getActiveWanderingMirrorMaker()) return '';
  const secs          = MirrorMaker.getMirrorMakerSecsLeft();
  const urgent        = secs <= 15;
  const iron          = state.resources.iron  ?? 0;
  const stone         = state.resources.stone ?? 0;
  const gold          = state.resources.gold  ?? 0;
  const canCommission = iron >= MirrorMaker.COMMISSION_IRON_COST && stone >= MirrorMaker.COMMISSION_STONE_COST;
  const canPurchase   = gold >= MirrorMaker.PURCHASE_GOLD_COST;
  return `
    <div class="mirror-section--active">
      <div class="mirror-header">
        <span class="mirror-title">🪞 Wandering Mirror Maker</span>
        <span class="mirror-timer${urgent ? ' mirror-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="mirror-desc">A skilled mirror maker arrives bearing a portable polishing wheel, hammered tin sheets, and gleaming bronze discs — offering to commission exquisite palace mirrors or share the ancient art of mirror-making with the palace workshops.</div>
      <div class="mirror-actions">
        <button class="btn--mirror-commission${canCommission ? '' : ' btn--disabled'}" data-action="mirror-commission" ${canCommission ? '' : 'disabled'}>
          🪞 Commission Polished Mirrors — ${MirrorMaker.COMMISSION_IRON_COST}⚙️ + ${MirrorMaker.COMMISSION_STONE_COST}🪨
          <span class="mirror-cost">→ +${MirrorMaker.COMMISSION_IRON_RATE} iron/s (2.5 min) · +${MirrorMaker.COMMISSION_PRESTIGE_REWARD} prestige · +${MirrorMaker.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--mirror-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="mirror-purchase" ${canPurchase ? '' : 'disabled'}>
          ✨ Purchase Mirror-Making Craft — ${MirrorMaker.PURCHASE_GOLD_COST}💰
          <span class="mirror-cost">→ +${MirrorMaker.PURCHASE_GOLD_RATE} gold/s (2 min) · +${MirrorMaker.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--mirror-away" data-action="mirror-away">
          🚶 Send Away
          <span class="mirror-cost">→ Mirror maker departs with the bronze discs</span>
        </button>
      </div>
    </div>`;
}

function _imperialFlowerMerchantSection() {
  if (!FlowerMerchant.getActiveImperialFlowerMerchant()) return '';
  const secs          = FlowerMerchant.getFlowerMerchantSecsLeft();
  const urgent        = secs <= 15;
  const food          = state.resources.food ?? 0;
  const gold          = state.resources.gold ?? 0;
  const canArrange    = food >= FlowerMerchant.ARRANGE_FOOD_COST && gold >= FlowerMerchant.ARRANGE_GOLD_COST;
  const canPurchase   = food >= FlowerMerchant.PURCHASE_FOOD_COST;
  return `
    <div class="flower-section--active">
      <div class="flower-header">
        <span class="flower-title">🌸 Imperial Flower Merchant</span>
        <span class="flower-timer${urgent ? ' flower-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="flower-desc">A renowned flower merchant arrives bearing fragrant garlands, rare seed packets, and a cart of exotic seasonal blooms — offering to arrange a magnificent imperial garden or sell prized seasonal flowers to the court gardeners.</div>
      <div class="flower-actions">
        <button class="btn--flower-arrange${canArrange ? '' : ' btn--disabled'}" data-action="flower-arrange" ${canArrange ? '' : 'disabled'}>
          🌸 Arrange Imperial Gardens — ${FlowerMerchant.ARRANGE_FOOD_COST}🌾 + ${FlowerMerchant.ARRANGE_GOLD_COST}💰
          <span class="flower-cost">→ +${FlowerMerchant.ARRANGE_FOOD_RATE} food/s (2.5 min) · +${FlowerMerchant.ARRANGE_PRESTIGE_REWARD} prestige · +${FlowerMerchant.ARRANGE_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--flower-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="flower-purchase" ${canPurchase ? '' : 'disabled'}>
          🌺 Purchase Seasonal Blooms — ${FlowerMerchant.PURCHASE_FOOD_COST}🌾
          <span class="flower-cost">→ +${FlowerMerchant.PURCHASE_FOOD_RATE} food/s (2 min) · +${FlowerMerchant.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--flower-away" data-action="flower-away">
          🚶 Send Away
          <span class="flower-cost">→ Flower merchant departs with the seasonal blooms</span>
        </button>
      </div>
    </div>`;
}

function _wanderingDressmakertSection() {
  if (!Dressmaker.getActiveWanderingDressmaker()) return '';
  const secs     = Dressmaker.getDressmakertSecsLeft();
  const urgent   = secs <= 20;
  const { food = 0, wood = 0, gold = 0 } = state.resources ?? {};
  const canSew      = food >= Dressmaker.SEW_FOOD_COST && wood >= Dressmaker.SEW_WOOD_COST;
  const canPurchase = gold >= Dressmaker.PURCHASE_GOLD_COST;
  return `
    <div class="dress-section--active">
      <div class="dress-header">
        <span class="dress-title">👗 Wandering Dressmaker</span>
        <span class="dress-timer${urgent ? ' dress-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="dress-desc">A skilled wandering dressmaker arrives carrying bolts of fine fabric, silver needles, and ornate thread — offering to sew imperial gowns for the palace household, or to share prized dressmaking patterns with the court seamstresses.</div>
      <div class="dress-actions">
        <button class="btn--dress-sew${canSew ? '' : ' btn--disabled'}" data-action="dress-sew" ${canSew ? '' : 'disabled'}>
          👗 Sew Imperial Gowns — ${Dressmaker.SEW_FOOD_COST}🌾 + ${Dressmaker.SEW_WOOD_COST}🪵
          <span class="dress-cost">→ +${Dressmaker.SEW_FOOD_RATE} food/s (2.5 min) · +${Dressmaker.SEW_PRESTIGE_REWARD} prestige · +${Dressmaker.SEW_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--dress-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="dress-purchase" ${canPurchase ? '' : 'disabled'}>
          🧵 Purchase Dressmaking Patterns — ${Dressmaker.PURCHASE_GOLD_COST}💰
          <span class="dress-cost">→ +${Dressmaker.PURCHASE_GOLD_RATE} gold/s (2 min) · +${Dressmaker.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--dress-away" data-action="dress-away">
          🚶 Send Away
          <span class="dress-cost">→ Dressmaker departs with the bolts of fabric</span>
        </button>
      </div>
    </div>`;
}

function _imperialTileSetterSection() {
  if (!TileSetter.getActiveImperialTileSetter()) return '';
  const secs     = TileSetter.getTileSetterSecsLeft();
  const urgent   = secs <= 20;
  const { stone = 0, gold = 0, iron = 0 } = state.resources ?? {};
  const canCommission = stone >= TileSetter.COMMISSION_STONE_COST && gold >= TileSetter.COMMISSION_GOLD_COST;
  const canPurchase   = iron >= TileSetter.PURCHASE_IRON_COST;
  return `
    <div class="tileset-section--active">
      <div class="tileset-header">
        <span class="tileset-title">🏛️ Imperial Tile Setter</span>
        <span class="tileset-timer${urgent ? ' tileset-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="tileset-desc">A master imperial tile setter arrives bearing hand-painted ceramic tiles, geometric pattern templates, and fine grout tools — offering to commission breathtaking mosaic tilework throughout the palace, or to share rare tile-laying techniques with the construction teams.</div>
      <div class="tileset-actions">
        <button class="btn--tileset-commission${canCommission ? '' : ' btn--disabled'}" data-action="tileset-commission" ${canCommission ? '' : 'disabled'}>
          🏛️ Commission Imperial Tilework — ${TileSetter.COMMISSION_STONE_COST}🪨 + ${TileSetter.COMMISSION_GOLD_COST}💰
          <span class="tileset-cost">→ +${TileSetter.COMMISSION_STONE_RATE} stone/s (2.5 min) · +${TileSetter.COMMISSION_PRESTIGE_REWARD} prestige · +${TileSetter.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--tileset-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="tileset-purchase" ${canPurchase ? '' : 'disabled'}>
          🎨 Purchase Tile Patterns — ${TileSetter.PURCHASE_IRON_COST}⚙️
          <span class="tileset-cost">→ +${TileSetter.PURCHASE_IRON_RATE} iron/s (2 min) · +${TileSetter.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--tileset-away" data-action="tileset-away">
          🚶 Send Away
          <span class="tileset-cost">→ Tile setter departs with the ceramic samples</span>
        </button>
      </div>
    </div>`;
}

function _imperialBannerWeaverSection() {
  if (!BannerWeaver.getActiveImperialBannerWeaver()) return '';
  const secs     = BannerWeaver.getBannerWeaverSecsLeft();
  const urgent   = secs <= 20;
  const { wood = 0, gold = 0 } = state.resources ?? {};
  const canWeave    = wood >= BannerWeaver.WEAVE_WOOD_COST && gold >= BannerWeaver.WEAVE_GOLD_COST;
  const canPurchase = gold >= BannerWeaver.PURCHASE_GOLD_COST;
  return `
    <div class="banner-section--active">
      <div class="banner-header">
        <span class="banner-title">🏴 Imperial Banner Weaver</span>
        <span class="banner-timer${urgent ? ' banner-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="banner-desc">A master imperial banner weaver arrives bearing bolts of crimson silk, spools of golden thread, and heraldic pattern books — offering to weave imperial battle banners for the palace halls and legions, or to share rare heraldic design patterns with the royal artisans.</div>
      <div class="banner-actions">
        <button class="btn--banner-weave${canWeave ? '' : ' btn--disabled'}" data-action="banner-weave" ${canWeave ? '' : 'disabled'}>
          🏴 Weave Imperial Battle Banners — ${BannerWeaver.WEAVE_WOOD_COST}🪵 + ${BannerWeaver.WEAVE_GOLD_COST}💰
          <span class="banner-cost">→ +${BannerWeaver.WEAVE_WOOD_RATE} wood/s (2.5 min) · +${BannerWeaver.WEAVE_PRESTIGE_REWARD} prestige · +${BannerWeaver.WEAVE_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--banner-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="banner-purchase" ${canPurchase ? '' : 'disabled'}>
          📜 Purchase Heraldic Patterns — ${BannerWeaver.PURCHASE_GOLD_COST}💰
          <span class="banner-cost">→ +${BannerWeaver.PURCHASE_GOLD_RATE} gold/s (2 min) · +${BannerWeaver.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--banner-away" data-action="banner-away">
          🚶 Send Away
          <span class="banner-cost">→ Banner weaver departs with the crimson silk</span>
        </button>
      </div>
    </div>`;
}

function _wanderingBoneCarverSection() {
  if (!BoneCarver.getActiveWanderingBoneCarver()) return '';
  const secs     = BoneCarver.getBoneCarverSecsLeft();
  const urgent   = secs <= 20;
  const { food = 0, stone = 0, gold = 0 } = state.resources ?? {};
  const canCommission = food >= BoneCarver.COMMISSION_FOOD_COST && stone >= BoneCarver.COMMISSION_STONE_COST;
  const canPurchase   = gold >= BoneCarver.PURCHASE_GOLD_COST;
  return `
    <div class="bone-section--active">
      <div class="bone-header">
        <span class="bone-title">🦴 Wandering Bone Carver</span>
        <span class="bone-timer${urgent ? ' bone-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="bone-desc">A wandering bone carver arrives carrying a satchel of polished animal bones, carved antler pieces, and fine flint tools — offering to commission ancestral carved totems for the palace shrines, or to sell rare bone carving patterns and ancient craft techniques.</div>
      <div class="bone-actions">
        <button class="btn--bone-commission${canCommission ? '' : ' btn--disabled'}" data-action="bone-commission" ${canCommission ? '' : 'disabled'}>
          🦴 Commission Ancestral Carvings — ${BoneCarver.COMMISSION_FOOD_COST}🌾 + ${BoneCarver.COMMISSION_STONE_COST}🪨
          <span class="bone-cost">→ +${BoneCarver.COMMISSION_FOOD_RATE} food/s (2.5 min) · +${BoneCarver.COMMISSION_PRESTIGE_REWARD} prestige · +${BoneCarver.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--bone-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="bone-purchase" ${canPurchase ? '' : 'disabled'}>
          🗿 Purchase Carved Artifacts — ${BoneCarver.PURCHASE_GOLD_COST}💰
          <span class="bone-cost">→ +${BoneCarver.PURCHASE_STONE_RATE} stone/s (2 min) · +${BoneCarver.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--bone-away" data-action="bone-away">
          🚶 Send Away
          <span class="bone-cost">→ Bone carver departs with the carved bones</span>
        </button>
      </div>
    </div>`;
}

// ── T387 Wandering Tapestry Maker ────────────────────────────────────────
function _wanderingTapestryMakerSection() {
  if (!TapestryMaker.getActiveWanderingTapestryMaker()) return '';
  const secs   = TapestryMaker.getTapestryMakerSecsLeft();
  const urgent = secs <= 20;
  const { wood = 0, gold = 0 } = state.resources ?? {};
  const canCommission = wood >= TapestryMaker.COMMISSION_WOOD_COST && gold >= TapestryMaker.COMMISSION_GOLD_COST;
  const canPurchase   = gold >= TapestryMaker.PURCHASE_GOLD_COST;
  return `
    <div class="tapestry-section--active">
      <div class="tapestry-header">
        <span class="tapestry-title">🧶 Wandering Tapestry Maker</span>
        <span class="tapestry-timer${urgent ? ' tapestry-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="tapestry-desc">A wandering tapestry maker arrives carrying bolts of richly dyed wool, intricate loom patterns, and finely carved wooden shuttles — offering to weave a magnificent imperial tapestry for the throne room, or to share rare weaving patterns and craft techniques.</div>
      <div class="tapestry-actions">
        <button class="btn--tapestry-commission${canCommission ? '' : ' btn--disabled'}" data-action="tapestry-commission" ${canCommission ? '' : 'disabled'}>
          🧶 Commission Imperial Tapestry — ${TapestryMaker.COMMISSION_WOOD_COST}🪵 + ${TapestryMaker.COMMISSION_GOLD_COST}💰
          <span class="tapestry-cost">→ +${TapestryMaker.COMMISSION_WOOD_RATE} wood/s (2.5 min) · +${TapestryMaker.COMMISSION_PRESTIGE_REWARD} prestige · +${TapestryMaker.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--tapestry-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="tapestry-purchase" ${canPurchase ? '' : 'disabled'}>
          🎨 Purchase Tapestry Patterns — ${TapestryMaker.PURCHASE_GOLD_COST}💰
          <span class="tapestry-cost">→ +${TapestryMaker.PURCHASE_GOLD_RATE} gold/s (2 min) · +${TapestryMaker.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--tapestry-away" data-action="tapestry-away">
          🚶 Send Away
          <span class="tapestry-cost">→ Tapestry maker departs with the wool bolts</span>
        </button>
      </div>
    </div>`;
}

// ── T388 Imperial Siege Architect ────────────────────────────────────────
function _imperialSiegeArchitectSection() {
  if (!SiegeArchitect.getActiveImperialSiegeArchitect()) return '';
  const secs   = SiegeArchitect.getSiegeArchitectSecsLeft();
  const urgent = secs <= 20;
  const { iron = 0, stone = 0, gold = 0 } = state.resources ?? {};
  const canCommission = iron >= SiegeArchitect.COMMISSION_IRON_COST && stone >= SiegeArchitect.COMMISSION_STONE_COST;
  const canStudy      = gold >= SiegeArchitect.PURCHASE_GOLD_COST;
  return `
    <div class="sarch-section--active">
      <div class="sarch-header">
        <span class="sarch-title">🏰 Imperial Siege Architect</span>
        <span class="sarch-timer${urgent ? ' sarch-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="sarch-desc">A renowned imperial siege architect arrives bearing detailed engineering blueprints for advanced siege towers and fortification designs — offering to commission a set of powerful siege tower constructions, or to share classified fortification design secrets with the engineers.</div>
      <div class="sarch-actions">
        <button class="btn--sarch-commission${canCommission ? '' : ' btn--disabled'}" data-action="sarch-commission" ${canCommission ? '' : 'disabled'}>
          🏰 Commission Siege Towers — ${SiegeArchitect.COMMISSION_IRON_COST}⚙️ + ${SiegeArchitect.COMMISSION_STONE_COST}🪨
          <span class="sarch-cost">→ +${SiegeArchitect.COMMISSION_IRON_RATE} iron/s (2.5 min) · +${SiegeArchitect.COMMISSION_PRESTIGE_REWARD} prestige · +${SiegeArchitect.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--sarch-study${canStudy ? '' : ' btn--disabled'}" data-action="sarch-study" ${canStudy ? '' : 'disabled'}>
          📐 Study Fortification Designs — ${SiegeArchitect.PURCHASE_GOLD_COST}💰
          <span class="sarch-cost">→ +${SiegeArchitect.PURCHASE_STONE_RATE} stone/s (2 min) · +${SiegeArchitect.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--sarch-away" data-action="sarch-away">
          🚶 Send Away
          <span class="sarch-cost">→ Architect departs with the blueprints</span>
        </button>
      </div>
    </div>`;
}

// ── T389 Wandering Lute Maker ─────────────────────────────────────────────
function _wanderingLuteMakerSection() {
  if (!LuteMaker.getActiveWanderingLuteMaker()) return '';
  const secs = LuteMaker.getLuteMakerSecsLeft();
  const urgent = secs <= 20;
  const wood = state.resources.wood ?? 0;
  const gold = state.resources.gold ?? 0;
  const canCommission = wood >= LuteMaker.COMMISSION_WOOD_COST && gold >= LuteMaker.COMMISSION_GOLD_COST;
  const canPurchase   = gold >= LuteMaker.PURCHASE_GOLD_COST;
  return `
    <div class="lute-section--active">
      <div class="lute-header">
        <span class="lute-title">🎸 Wandering Lute Maker</span>
        <span class="lute-timer${urgent ? ' lute-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="lute-desc">A wandering lute maker arrives carrying handcrafted wooden instruments, fine gut strings, and decorative inlay patterns — offering to commission a set of court lutes for the imperial musicians, or to share rare instrument patterns and woodworking techniques.</div>
      <div class="lute-actions">
        <button class="btn--lute-commission${canCommission ? '' : ' btn--disabled'}" data-action="lute-commission" ${canCommission ? '' : 'disabled'}>
          🎸 Commission Court Lutes — ${LuteMaker.COMMISSION_WOOD_COST}🪵 + ${LuteMaker.COMMISSION_GOLD_COST}💰
          <span class="lute-cost">→ +${LuteMaker.COMMISSION_WOOD_RATE} wood/s (2.5 min) · +${LuteMaker.COMMISSION_PRESTIGE_REWARD} prestige · +${LuteMaker.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--lute-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="lute-purchase" ${canPurchase ? '' : 'disabled'}>
          🎵 Purchase Instrument Patterns — ${LuteMaker.PURCHASE_GOLD_COST}💰
          <span class="lute-cost">→ +${LuteMaker.PURCHASE_GOLD_RATE} gold/s (2 min) · +${LuteMaker.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--lute-away" data-action="lute-away">
          🚶 Send Away
          <span class="lute-cost">→ Lute maker departs with the instruments</span>
        </button>
      </div>
    </div>`;
}

// ── T390 Imperial Stonecutter's Guild ─────────────────────────────────────
function _imperialStonecutterGuildSection() {
  if (!SCGuild.getActiveImperialStonecutterGuild()) return '';
  const secs = SCGuild.getStonecutterGuildSecsLeft();
  const urgent = secs <= 20;
  const stone = state.resources.stone ?? 0;
  const gold  = state.resources.gold  ?? 0;
  const iron  = state.resources.iron  ?? 0;
  const canCommission = stone >= SCGuild.COMMISSION_STONE_COST && gold >= SCGuild.COMMISSION_GOLD_COST;
  const canPurchase   = iron  >= SCGuild.PURCHASE_IRON_COST;
  return `
    <div class="scguild-section--active">
      <div class="scguild-header">
        <span class="scguild-title">⛏️ Imperial Stonecutter's Guild</span>
        <span class="scguild-timer${urgent ? ' scguild-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="scguild-desc">A delegation from the imperial stonecutter's guild arrives bearing master-cut stone samples, quarrying diagrams, and guild commission contracts — offering to commission grand precision stoneworks for the realm's infrastructure, or to share rare stonecutting lore and master quarrying techniques.</div>
      <div class="scguild-actions">
        <button class="btn--scguild-commission${canCommission ? '' : ' btn--disabled'}" data-action="scguild-commission" ${canCommission ? '' : 'disabled'}>
          ⛏️ Commission Grand Stoneworks — ${SCGuild.COMMISSION_STONE_COST}🪨 + ${SCGuild.COMMISSION_GOLD_COST}💰
          <span class="scguild-cost">→ +${SCGuild.COMMISSION_STONE_RATE} stone/s (2.5 min) · +${SCGuild.COMMISSION_PRESTIGE_REWARD} prestige · +${SCGuild.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--scguild-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="scguild-purchase" ${canPurchase ? '' : 'disabled'}>
          📜 Purchase Stonecutting Lore — ${SCGuild.PURCHASE_IRON_COST}⚙️
          <span class="scguild-cost">→ +${SCGuild.PURCHASE_IRON_RATE} iron/s (2 min) · +${SCGuild.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--scguild-away" data-action="scguild-away">
          🚶 Send Away
          <span class="scguild-cost">→ Guild delegation departs with the contracts</span>
        </button>
      </div>
    </div>`;
}

// ── T391 Wandering Candlemaker ───────────────────────────────────────────────

function _wanderingCandlemakerSection() {
  if (!Candlemaker.getActiveWanderingCandlemaker()) return '';
  const secs = Candlemaker.getCandlemakerSecsLeft();
  const urgent = secs <= 20;
  const food = state.resources.food ?? 0;
  const wood = state.resources.wood ?? 0;
  const gold = state.resources.gold ?? 0;
  const canCommission = food >= Candlemaker.COMMISSION_FOOD_COST && wood >= Candlemaker.COMMISSION_WOOD_COST;
  const canPurchase   = gold >= Candlemaker.PURCHASE_GOLD_COST;
  return `
    <div class="candlemaker-section--active">
      <div class="candlemaker-header">
        <span class="candlemaker-title">🕯️ Wandering Candlemaker</span>
        <span class="candlemaker-timer${urgent ? ' candlemaker-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="candlemaker-desc">A wandering candlemaker arrives carrying bundles of fine beeswax candles, ornate tallow moulds, and fragrant wicking cords — offering to commission royal ceremonial candles for the palace halls, or to share rare wax-blending formulas and wick-crafting secrets.</div>
      <div class="candlemaker-actions">
        <button class="btn--candlemaker-commission${canCommission ? '' : ' btn--disabled'}" data-action="candlemaker-commission" ${canCommission ? '' : 'disabled'}>
          🕯️ Commission Royal Candles — ${Candlemaker.COMMISSION_FOOD_COST}🌾 + ${Candlemaker.COMMISSION_WOOD_COST}🪵
          <span class="candlemaker-cost">→ +${Candlemaker.COMMISSION_FOOD_RATE} food/s (2.5 min) · +${Candlemaker.COMMISSION_PRESTIGE_REWARD} prestige · +${Candlemaker.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--candlemaker-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="candlemaker-purchase" ${canPurchase ? '' : 'disabled'}>
          📜 Purchase Wax Formulas — ${Candlemaker.PURCHASE_GOLD_COST}💰
          <span class="candlemaker-cost">→ +${Candlemaker.PURCHASE_GOLD_RATE} gold/s (2 min) · +${Candlemaker.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--candlemaker-away" data-action="candlemaker-away">
          🚶 Send Away
          <span class="candlemaker-cost">→ Candlemaker departs with the candles</span>
        </button>
      </div>
    </div>`;
}

// ── T392 Imperial Grain Merchant ─────────────────────────────────────────────

function _imperialGrainMerchantSection() {
  if (!GrainMerchant.getActiveImperialGrainMerchant()) return '';
  const secs = GrainMerchant.getGrainMerchantSecsLeft();
  const urgent = secs <= 20;
  const food = state.resources.food ?? 0;
  const gold = state.resources.gold ?? 0;
  const wood = state.resources.wood ?? 0;
  const canCommission = food >= GrainMerchant.COMMISSION_FOOD_COST && gold >= GrainMerchant.COMMISSION_GOLD_COST;
  const canPurchase   = wood >= GrainMerchant.PURCHASE_WOOD_COST;
  return `
    <div class="grain-section--active">
      <div class="grain-header">
        <span class="grain-title">🌾 Imperial Grain Merchant</span>
        <span class="grain-timer${urgent ? ' grain-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="grain-desc">An imperial grain merchant arrives accompanied by a long train of ox-carts laden with prime winter wheat, barley, and millet — offering to establish long-term grain stores for the imperial granaries, or to sell exclusive milling rights and grain-drying techniques.</div>
      <div class="grain-actions">
        <button class="btn--grain-establish${canCommission ? '' : ' btn--disabled'}" data-action="grain-establish" ${canCommission ? '' : 'disabled'}>
          🌾 Establish Grain Stores — ${GrainMerchant.COMMISSION_FOOD_COST}🌾 + ${GrainMerchant.COMMISSION_GOLD_COST}💰
          <span class="grain-cost">→ +${GrainMerchant.COMMISSION_FOOD_RATE} food/s (2.5 min) · +${GrainMerchant.COMMISSION_PRESTIGE_REWARD} prestige · +${GrainMerchant.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--grain-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="grain-purchase" ${canPurchase ? '' : 'disabled'}>
          🪵 Purchase Milling Rights — ${GrainMerchant.PURCHASE_WOOD_COST}🪵
          <span class="grain-cost">→ +${GrainMerchant.PURCHASE_WOOD_RATE} wood/s (2 min) · +${GrainMerchant.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--grain-away" data-action="grain-away">
          🚶 Send Away
          <span class="grain-cost">→ Grain merchant departs with the carts</span>
        </button>
      </div>
    </div>`;
}

function _wanderingFeltMakerSection() {
  if (!FeltMaker.getActiveWanderingFeltMaker()) return '';
  const secs   = FeltMaker.getFeltMakerSecsLeft();
  const urgent = secs <= 15;
  const food   = state.resources?.food ?? 0;
  const wood   = state.resources?.wood ?? 0;
  const gold   = state.resources?.gold ?? 0;
  const canCommission = food >= FeltMaker.COMMISSION_FOOD_COST && wood >= FeltMaker.COMMISSION_WOOD_COST;
  const canPurchase   = gold >= FeltMaker.PURCHASE_GOLD_COST;
  return `
    <div class="feltmaker-section--active">
      <div class="feltmaker-header">
        <span class="feltmaker-title">🧶 Wandering Felt Maker</span>
        <span class="feltmaker-timer${urgent ? ' feltmaker-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="feltmaker-desc">A wandering felt maker arrives carrying rolls of fine compressed wool felt, bone needles, and carding combs — offering to commission thick felt carpets for the imperial halls and barracks, or to share rare felting and wool-pressing techniques.</div>
      <div class="feltmaker-actions">
        <button class="btn--feltmaker-commission${canCommission ? '' : ' btn--disabled'}" data-action="feltmaker-commission" ${canCommission ? '' : 'disabled'}>
          🧶 Commission Felt Carpets — ${FeltMaker.COMMISSION_FOOD_COST}🌾 + ${FeltMaker.COMMISSION_WOOD_COST}🪵
          <span class="feltmaker-cost">→ +${FeltMaker.COMMISSION_FOOD_RATE} food/s (2.5 min) · +${FeltMaker.COMMISSION_PRESTIGE_REWARD} prestige · +${FeltMaker.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--feltmaker-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="feltmaker-purchase" ${canPurchase ? '' : 'disabled'}>
          📜 Purchase Felting Techniques — ${FeltMaker.PURCHASE_GOLD_COST}💰
          <span class="feltmaker-cost">→ +${FeltMaker.PURCHASE_GOLD_RATE} gold/s (2 min) · +${FeltMaker.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--feltmaker-away" data-action="feltmaker-away">
          🚶 Send Away
          <span class="feltmaker-cost">→ Felt maker departs with the rolls</span>
        </button>
      </div>
    </div>`;
}

function _imperialVineyardMasterSection() {
  if (!VineyardMaster.getActiveImperialVineyardMaster()) return '';
  const secs   = VineyardMaster.getVineyardMasterSecsLeft();
  const urgent = secs <= 15;
  const food   = state.resources?.food ?? 0;
  const gold   = state.resources?.gold ?? 0;
  const wood   = state.resources?.wood ?? 0;
  const canCommission = food >= VineyardMaster.COMMISSION_FOOD_COST && gold >= VineyardMaster.COMMISSION_GOLD_COST;
  const canPurchase   = wood >= VineyardMaster.PURCHASE_WOOD_COST;
  return `
    <div class="vineyard-section--active">
      <div class="vineyard-header">
        <span class="vineyard-title">🍇 Imperial Vineyard Master</span>
        <span class="vineyard-timer${urgent ? ' vineyard-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="vineyard-desc">An imperial vineyard master arrives bearing clay amphoras of fine aged wine, pruning tools, and pressed grape samples — offering to commission a grand wine cellar for the imperial palace, or to share rare viticulture secrets and vine-cultivation techniques.</div>
      <div class="vineyard-actions">
        <button class="btn--vineyard-commission${canCommission ? '' : ' btn--disabled'}" data-action="vineyard-commission" ${canCommission ? '' : 'disabled'}>
          🍇 Commission Wine Cellar — ${VineyardMaster.COMMISSION_FOOD_COST}🌾 + ${VineyardMaster.COMMISSION_GOLD_COST}💰
          <span class="vineyard-cost">→ +${VineyardMaster.COMMISSION_FOOD_RATE} food/s (2.5 min) · +${VineyardMaster.COMMISSION_PRESTIGE_REWARD} prestige · +${VineyardMaster.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--vineyard-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="vineyard-purchase" ${canPurchase ? '' : 'disabled'}>
          📜 Purchase Vineyard Secrets — ${VineyardMaster.PURCHASE_WOOD_COST}🪵
          <span class="vineyard-cost">→ +${VineyardMaster.PURCHASE_WOOD_RATE} wood/s (2 min) · +${VineyardMaster.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--vineyard-away" data-action="vineyard-away">
          🚶 Send Away
          <span class="vineyard-cost">→ Vineyard master departs with the amphoras</span>
        </button>
      </div>
    </div>`;
}

function _wanderingHerbMerchantSection() {
  if (!HerbMerchant.getActiveWanderingHerbMerchant()) return '';
  const secs   = HerbMerchant.getHerbMerchantSecsLeft();
  const urgent = secs <= 15;
  const food   = state.resources?.food ?? 0;
  const gold   = state.resources?.gold ?? 0;
  const canCommission = food >= HerbMerchant.COMMISSION_FOOD_COST;
  const canPurchase   = gold >= HerbMerchant.PURCHASE_GOLD_COST;
  return `
    <div class="herbmerchant-section--active">
      <div class="herbmerchant-header">
        <span class="herbmerchant-title">🌿 Wandering Herb Merchant</span>
        <span class="herbmerchant-timer${urgent ? ' herbmerchant-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="herbmerchant-desc">A wandering herb merchant arrives carrying wicker baskets overflowing with dried herbs, medicinal roots, aromatic bundles, and pressed botanical remedies — offering to prepare restorative herbal remedies for the empire, or to share ancient herb-cultivation and medicinal brewing lore.</div>
      <div class="herbmerchant-actions">
        <button class="btn--herbmerchant-commission${canCommission ? '' : ' btn--disabled'}" data-action="herbmerchant-commission" ${canCommission ? '' : 'disabled'}>
          🌿 Commission Herbal Remedies — ${HerbMerchant.COMMISSION_FOOD_COST}🌾
          <span class="herbmerchant-cost">→ +${HerbMerchant.COMMISSION_FOOD_RATE} food/s (2.5 min) · +${HerbMerchant.COMMISSION_PRESTIGE_REWARD} prestige · +${HerbMerchant.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--herbmerchant-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="herbmerchant-purchase" ${canPurchase ? '' : 'disabled'}>
          📜 Purchase Herb Lore — ${HerbMerchant.PURCHASE_GOLD_COST}💰
          <span class="herbmerchant-cost">→ +${HerbMerchant.PURCHASE_GOLD_RATE} gold/s (2 min) · +${HerbMerchant.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--herbmerchant-away" data-action="herbmerchant-away">
          🚶 Send Away
          <span class="herbmerchant-cost">→ Herb merchant departs with the baskets</span>
        </button>
      </div>
    </div>`;
}

function _imperialLanternMakerSection() {
  if (!LanternMaker.getActiveImperialLanternMaker()) return '';
  const secs   = LanternMaker.getLanternMakerSecsLeft();
  const urgent = secs <= 15;
  const mana   = state.resources?.mana ?? 0;
  const gold   = state.resources?.gold ?? 0;
  const wood   = state.resources?.wood ?? 0;
  const canCommission = mana >= LanternMaker.COMMISSION_MANA_COST && gold >= LanternMaker.COMMISSION_GOLD_COST;
  const canPurchase   = wood >= LanternMaker.PURCHASE_WOOD_COST;
  return `
    <div class="lantern-section--active">
      <div class="lantern-header">
        <span class="lantern-title">🏮 Imperial Lantern Maker</span>
        <span class="lantern-timer${urgent ? ' lantern-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="lantern-desc">An imperial lantern maker arrives at court carrying hand-painted paper lanterns, gilded iron frames, coloured glass panels, and finely-crafted wick mechanisms — offering to commission magnificent festival lanterns to illuminate the capital, or to share refined lantern-crafting and glasswork techniques.</div>
      <div class="lantern-actions">
        <button class="btn--lantern-commission${canCommission ? '' : ' btn--disabled'}" data-action="lantern-commission" ${canCommission ? '' : 'disabled'}>
          🏮 Commission Festival Lanterns — ${LanternMaker.COMMISSION_MANA_COST}✨ + ${LanternMaker.COMMISSION_GOLD_COST}💰
          <span class="lantern-cost">→ +${LanternMaker.COMMISSION_MANA_RATE} mana/s (2.5 min) · +${LanternMaker.COMMISSION_PRESTIGE_REWARD} prestige · +${LanternMaker.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--lantern-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="lantern-purchase" ${canPurchase ? '' : 'disabled'}>
          📜 Purchase Lantern Craft — ${LanternMaker.PURCHASE_WOOD_COST}🪵
          <span class="lantern-cost">→ +${LanternMaker.PURCHASE_WOOD_RATE} wood/s (2 min) · +${LanternMaker.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--lantern-away" data-action="lantern-away">
          🚶 Send Away
          <span class="lantern-cost">→ Lantern maker departs with the lanterns</span>
        </button>
      </div>
    </div>`;
}

function _wanderingInkMasterSection() {
  if (!InkMaster.getActiveWanderingInkMaster()) return '';
  const secs   = InkMaster.getInkMasterSecsLeft();
  const urgent = secs <= 15;
  const mana   = state.resources?.mana ?? 0;
  const gold   = state.resources?.gold ?? 0;
  const wood   = state.resources?.wood ?? 0;
  const canCommission = mana >= InkMaster.COMMISSION_MANA_COST && gold >= InkMaster.COMMISSION_GOLD_COST;
  const canPurchase   = wood >= InkMaster.PURCHASE_WOOD_COST;
  return `
    <div class="inkmaster-section--active">
      <div class="inkmaster-header">
        <span class="inkmaster-title">🖋️ Wandering Ink Master</span>
        <span class="inkmaster-timer${urgent ? ' inkmaster-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="inkmaster-desc">A wandering ink master arrives at court bearing lacquered writing cases, fine brushes, and vials of rare pigment-infused inks — offering to commission extraordinary imperial scrollwork and illuminated edicts for the palace archives, or to share closely-guarded formulas for rare mineral inks with the imperial scribes.</div>
      <div class="inkmaster-actions">
        <button class="btn--inkmaster-commission${canCommission ? '' : ' btn--disabled'}" data-action="inkmaster-commission" ${canCommission ? '' : 'disabled'}>
          🖋️ Commission Imperial Scrollwork — ${InkMaster.COMMISSION_MANA_COST}✨ + ${InkMaster.COMMISSION_GOLD_COST}💰
          <span class="inkmaster-cost">→ +${InkMaster.COMMISSION_MANA_RATE} mana/s (2.5 min) · +${InkMaster.COMMISSION_PRESTIGE_REWARD} prestige · +${InkMaster.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--inkmaster-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="inkmaster-purchase" ${canPurchase ? '' : 'disabled'}>
          📜 Purchase Rare Ink Formulas — ${InkMaster.PURCHASE_WOOD_COST}🪵
          <span class="inkmaster-cost">→ +${InkMaster.PURCHASE_WOOD_RATE} wood/s (2 min) · +${InkMaster.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--inkmaster-away" data-action="inkmaster-away">
          🚶 Send Away
          <span class="inkmaster-cost">→ Ink master departs with the writing cases</span>
        </button>
      </div>
    </div>`;
}

function _wanderingSaltMerchantSection() {
  if (!SaltMerchant.getActiveWanderingSaltMerchant()) return '';
  const secs   = SaltMerchant.getSaltMerchantSecsLeft();
  const urgent = secs <= 15;
  const food   = state.resources?.food  ?? 0;
  const gold   = state.resources?.gold  ?? 0;
  const stone  = state.resources?.stone ?? 0;
  const canCommission = food >= SaltMerchant.COMMISSION_FOOD_COST && gold >= SaltMerchant.COMMISSION_GOLD_COST;
  const canPurchase   = stone >= SaltMerchant.PURCHASE_STONE_COST;
  return `
    <div class="saltmerchant-section--active">
      <div class="saltmerchant-header">
        <span class="saltmerchant-title">🧂 Wandering Salt Merchant</span>
        <span class="saltmerchant-timer${urgent ? ' saltmerchant-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="saltmerchant-desc">A wandering salt merchant arrives at the imperial gates hauling heavy canvas sacks and sealed clay amphorae packed with high-quality mineral salts, sea-harvested crystals, and dried salt cakes — offering to establish abundant imperial salt stores or to exchange surplus reserves for mineral stockpiles.</div>
      <div class="saltmerchant-actions">
        <button class="btn--saltmerchant-commission${canCommission ? '' : ' btn--disabled'}" data-action="saltmerchant-commission" ${canCommission ? '' : 'disabled'}>
          🧂 Establish Salt Stores — ${SaltMerchant.COMMISSION_FOOD_COST}🌾 + ${SaltMerchant.COMMISSION_GOLD_COST}💰
          <span class="saltmerchant-cost">→ +${SaltMerchant.COMMISSION_FOOD_RATE} food/s (2.5 min) · +${SaltMerchant.COMMISSION_PRESTIGE_REWARD} prestige · +${SaltMerchant.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--saltmerchant-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="saltmerchant-purchase" ${canPurchase ? '' : 'disabled'}>
          ⛏️ Purchase Salt Reserves — ${SaltMerchant.PURCHASE_STONE_COST}🪨
          <span class="saltmerchant-cost">→ +${SaltMerchant.PURCHASE_STONE_RATE} stone/s (2 min) · +${SaltMerchant.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--saltmerchant-away" data-action="saltmerchant-away">
          🚶 Send Away
          <span class="saltmerchant-cost">→ Salt merchant departs with the sacks</span>
        </button>
      </div>
    </div>`;
}

function _wanderingBronzeSmithSection() {
  if (!BronzeSmith.getActiveWanderingBronzeSmith()) return '';
  const secs   = BronzeSmith.getBronzeSmithSecsLeft();
  const urgent = secs <= 15;
  const iron   = state.resources?.iron  ?? 0;
  const gold   = state.resources?.gold  ?? 0;
  const stone  = state.resources?.stone ?? 0;
  const canCommission = iron >= BronzeSmith.COMMISSION_IRON_COST && gold >= BronzeSmith.COMMISSION_GOLD_COST;
  const canPurchase   = stone >= BronzeSmith.PURCHASE_STONE_COST;
  return `
    <div class="bronzesmith-section--active">
      <div class="bronzesmith-header">
        <span class="bronzesmith-title">🔱 Wandering Bronze Smith</span>
        <span class="bronzesmith-timer${urgent ? ' bronzesmith-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="bronzesmith-desc">A wandering bronze smith arrives at the imperial forge district carrying a heavy bronze-bound tool chest, leather bellows, and finely hammered copper-tin alloy samples — offering to commission extraordinary imperial bronze works and armaments, or to share alloying formulas with the imperial ore workers.</div>
      <div class="bronzesmith-actions">
        <button class="btn--bronzesmith-commission${canCommission ? '' : ' btn--disabled'}" data-action="bronzesmith-commission" ${canCommission ? '' : 'disabled'}>
          🔱 Commission Imperial Bronze Works — ${BronzeSmith.COMMISSION_IRON_COST}⚙️ + ${BronzeSmith.COMMISSION_GOLD_COST}💰
          <span class="bronzesmith-cost">→ +${BronzeSmith.COMMISSION_IRON_RATE} iron/s (2.5 min) · +${BronzeSmith.COMMISSION_PRESTIGE_REWARD} prestige · +${BronzeSmith.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--bronzesmith-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="bronzesmith-purchase" ${canPurchase ? '' : 'disabled'}>
          🪨 Purchase Alloy Techniques — ${BronzeSmith.PURCHASE_STONE_COST}🪨
          <span class="bronzesmith-cost">→ +${BronzeSmith.PURCHASE_STONE_RATE} stone/s (2 min) · +${BronzeSmith.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--bronzesmith-away" data-action="bronzesmith-away">
          🚶 Send Away
          <span class="bronzesmith-cost">→ Bronze smith departs with the tool chest</span>
        </button>
      </div>
    </div>`;
}

function _imperialAqueductBuilderSection() {
  if (!AqueductBld.getActiveImperialAqueductBuilder()) return '';
  const secs   = AqueductBld.getAqueductBuilderSecsLeft();
  const urgent = secs <= 15;
  const stone  = state.resources?.stone ?? 0;
  const gold   = state.resources?.gold  ?? 0;
  const iron   = state.resources?.iron  ?? 0;
  const canCommission = stone >= AqueductBld.COMMISSION_STONE_COST && gold >= AqueductBld.COMMISSION_GOLD_COST;
  const canStudy      = iron >= AqueductBld.STUDY_IRON_COST;
  return `
    <div class="aqueduct-section--active">
      <div class="aqueduct-header">
        <span class="aqueduct-title">🌊 Imperial Aqueduct Builder</span>
        <span class="aqueduct-timer${urgent ? ' aqueduct-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="aqueduct-desc">An imperial aqueduct builder arrives bearing rolled architectural parchments, surveying instruments, and detailed hydraulic diagrams — offering to commission a magnificent grand aqueduct channelling fresh water through the imperial city, or to share hydraulic engineering principles with the imperial stonemasons and military engineers.</div>
      <div class="aqueduct-actions">
        <button class="btn--aqueduct-commission${canCommission ? '' : ' btn--disabled'}" data-action="aqueduct-commission" ${canCommission ? '' : 'disabled'}>
          🌊 Commission Grand Aqueduct — ${AqueductBld.COMMISSION_STONE_COST}🪨 + ${AqueductBld.COMMISSION_GOLD_COST}💰
          <span class="aqueduct-cost">→ +${AqueductBld.COMMISSION_FOOD_RATE} food/s (2.5 min) · +${AqueductBld.COMMISSION_PRESTIGE_REWARD} prestige · +${AqueductBld.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--aqueduct-study${canStudy ? '' : ' btn--disabled'}" data-action="aqueduct-study" ${canStudy ? '' : 'disabled'}>
          ⚙️ Study Hydraulic Engineering — ${AqueductBld.STUDY_IRON_COST}⚙️
          <span class="aqueduct-cost">→ +${AqueductBld.STUDY_IRON_RATE} iron/s (2 min) · +${AqueductBld.STUDY_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--aqueduct-away" data-action="aqueduct-away">
          🚶 Send Away
          <span class="aqueduct-cost">→ Aqueduct builder departs with the parchments</span>
        </button>
      </div>
    </div>`;
}

function _wanderingGlassPainterSection() {
  if (!GlassPainter.getActiveWanderingGlassPainter()) return '';
  const secs   = GlassPainter.getGlassPainterSecsLeft();
  const urgent = secs <= 15;
  const stone  = state.resources?.stone ?? 0;
  const gold   = state.resources?.gold  ?? 0;
  const mana   = state.resources?.mana  ?? 0;
  const canCommission = stone >= GlassPainter.COMMISSION_STONE_COST && gold >= GlassPainter.COMMISSION_GOLD_COST;
  const canPurchase   = mana >= GlassPainter.PURCHASE_MANA_COST;
  return `
    <div class="glasspainter-section--active">
      <div class="glasspainter-header">
        <span class="glasspainter-title">🎨 Wandering Glass Painter</span>
        <span class="glasspainter-timer${urgent ? ' glasspainter-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="glasspainter-desc">A wandering glass painter arrives carrying a leather satchel of coloured glass fragments, lead soldering tools, and rolled cartoons depicting luminous heraldic symbols — offering to commission magnificent stained glass windows for the imperial great hall, or to share refined glass painting techniques with the palace craftsmen.</div>
      <div class="glasspainter-actions">
        <button class="btn--glasspainter-commission${canCommission ? '' : ' btn--disabled'}" data-action="glasspainter-commission" ${canCommission ? '' : 'disabled'}>
          🎨 Commission Stained Glass Windows — ${GlassPainter.COMMISSION_STONE_COST}🪨 + ${GlassPainter.COMMISSION_GOLD_COST}💰
          <span class="glasspainter-cost">→ +${GlassPainter.COMMISSION_STONE_RATE} stone/s (2.5 min) · +${GlassPainter.COMMISSION_PRESTIGE_REWARD} prestige · +${GlassPainter.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--glasspainter-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="glasspainter-purchase" ${canPurchase ? '' : 'disabled'}>
          🪟 Purchase Painting Techniques — ${GlassPainter.PURCHASE_MANA_COST}✨
          <span class="glasspainter-cost">→ +${GlassPainter.PURCHASE_MANA_RATE} mana/s (2 min) · +${GlassPainter.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--glasspainter-away" data-action="glasspainter-away">
          🚶 Send Away
          <span class="glasspainter-cost">→ Glass painter departs with the coloured fragments</span>
        </button>
      </div>
    </div>`;
}

function _imperialSiegeCatapultEngineerSection() {
  if (!CatapultEng.getActiveImperialSiegeCatapultEngineer()) return '';
  const secs   = CatapultEng.getSiegeCatapultEngineerSecsLeft();
  const urgent = secs <= 15;
  const iron   = state.resources?.iron  ?? 0;
  const wood   = state.resources?.wood  ?? 0;
  const stone  = state.resources?.stone ?? 0;
  const canCommission = iron >= CatapultEng.COMMISSION_IRON_COST && wood >= CatapultEng.COMMISSION_WOOD_COST;
  const canStudy      = stone >= CatapultEng.STUDY_STONE_COST;
  return `
    <div class="catapulteng-section--active">
      <div class="catapulteng-header">
        <span class="catapulteng-title">⚔️ Imperial Siege Catapult Engineer</span>
        <span class="catapulteng-timer${urgent ? ' catapulteng-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="catapulteng-desc">An imperial siege catapult engineer arrives bearing detailed technical drawings of onagers, trebuchets, and torsion-powered bolt-throwers — offering to commission a full war machine arsenal for the imperial siege corps, or to share advanced torsion physics and mechanical leverage principles with the imperial engineers.</div>
      <div class="catapulteng-actions">
        <button class="btn--catapulteng-commission${canCommission ? '' : ' btn--disabled'}" data-action="catapulteng-commission" ${canCommission ? '' : 'disabled'}>
          ⚔️ Commission War Machines — ${CatapultEng.COMMISSION_IRON_COST}⚙️ + ${CatapultEng.COMMISSION_WOOD_COST}🪵
          <span class="catapulteng-cost">→ +${CatapultEng.COMMISSION_IRON_RATE} iron/s (2.5 min) · +${CatapultEng.COMMISSION_PRESTIGE_REWARD} prestige · +${CatapultEng.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--catapulteng-study${canStudy ? '' : ' btn--disabled'}" data-action="catapulteng-study" ${canStudy ? '' : 'disabled'}>
          📐 Study Torsion Physics — ${CatapultEng.STUDY_STONE_COST}🪨
          <span class="catapulteng-cost">→ +${CatapultEng.STUDY_STONE_RATE} stone/s (2 min) · +${CatapultEng.STUDY_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--catapulteng-away" data-action="catapulteng-away">
          🚶 Send Away
          <span class="catapulteng-cost">→ Siege catapult engineer departs with the technical drawings</span>
        </button>
      </div>
    </div>`;
}

function _wanderingWoolSpinnerSection() {
  if (!WoolSpinner.getActiveWanderingWoolSpinner()) return '';
  const secs   = WoolSpinner.getWoolSpinnerSecsLeft();
  const urgent = secs <= 15;
  const food   = state.resources?.food ?? 0;
  const gold   = state.resources?.gold ?? 0;
  const wood   = state.resources?.wood ?? 0;
  const canCommission = food >= WoolSpinner.COMMISSION_FOOD_COST && gold >= WoolSpinner.COMMISSION_GOLD_COST;
  const canPurchase   = wood >= WoolSpinner.PURCHASE_WOOD_COST;
  return `
    <div class="woolspinner-section--active">
      <div class="woolspinner-header">
        <span class="woolspinner-title">🐑 Wandering Wool Spinner</span>
        <span class="woolspinner-timer${urgent ? ' woolspinner-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="woolspinner-desc">A wandering wool spinner arrives bearing a drop spindle, fleece-filled baskets, and dyed skeins of fine wool — offering to commission a supply of royal wool cloth for the imperial wardrobe, or to share ancient spinning and dyeing techniques with the palace weavers.</div>
      <div class="woolspinner-actions">
        <button class="btn--woolspinner-commission${canCommission ? '' : ' btn--disabled'}" data-action="woolspinner-commission" ${canCommission ? '' : 'disabled'}>
          🐑 Commission Royal Wool Cloth — ${WoolSpinner.COMMISSION_FOOD_COST}🍖 + ${WoolSpinner.COMMISSION_GOLD_COST}💰
          <span class="woolspinner-cost">→ +${WoolSpinner.COMMISSION_FOOD_RATE} food/s (2.5 min) · +${WoolSpinner.COMMISSION_PRESTIGE_REWARD} prestige · +${WoolSpinner.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--woolspinner-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="woolspinner-purchase" ${canPurchase ? '' : 'disabled'}>
          🧵 Purchase Spinning Techniques — ${WoolSpinner.PURCHASE_WOOD_COST}🪵
          <span class="woolspinner-cost">→ +${WoolSpinner.PURCHASE_WOOD_RATE} wood/s (2 min) · +${WoolSpinner.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--woolspinner-away" data-action="woolspinner-away">
          🚶 Send Away
          <span class="woolspinner-cost">→ Wool spinner departs with the fleece and spindles</span>
        </button>
      </div>
    </div>`;
}

function _imperialAmberMerchantSection() {
  if (!AmberMerchant.getActiveImperialAmberMerchant()) return '';
  const secs   = AmberMerchant.getAmberMerchantSecsLeft();
  const urgent = secs <= 15;
  const food   = state.resources?.food  ?? 0;
  const gold   = state.resources?.gold  ?? 0;
  const stone  = state.resources?.stone ?? 0;
  const canArrange  = food >= AmberMerchant.ARRANGE_FOOD_COST && gold >= AmberMerchant.ARRANGE_GOLD_COST;
  const canPurchase = stone >= AmberMerchant.PURCHASE_STONE_COST;
  return `
    <div class="ambermerchant-section--active">
      <div class="ambermerchant-header">
        <span class="ambermerchant-title">🟡 Imperial Amber Merchant</span>
        <span class="ambermerchant-timer${urgent ? ' ambermerchant-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="ambermerchant-desc">An imperial amber merchant arrives bearing lacquered display cases of translucent Baltic amber chunks, insect-inclusion specimens, and polished amber amulets — offering to arrange an exclusive Baltic amber trade route for the imperial treasury, or to sell curated specimens to the palace gem-cutters.</div>
      <div class="ambermerchant-actions">
        <button class="btn--ambermerchant-arrange${canArrange ? '' : ' btn--disabled'}" data-action="ambermerchant-arrange" ${canArrange ? '' : 'disabled'}>
          🟡 Arrange Baltic Amber Trade — ${AmberMerchant.ARRANGE_FOOD_COST}🍖 + ${AmberMerchant.ARRANGE_GOLD_COST}💰
          <span class="ambermerchant-cost">→ +${AmberMerchant.ARRANGE_GOLD_RATE} gold/s (2.5 min) · +${AmberMerchant.ARRANGE_PRESTIGE_REWARD} prestige · +${AmberMerchant.ARRANGE_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--ambermerchant-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="ambermerchant-purchase" ${canPurchase ? '' : 'disabled'}>
          💎 Purchase Amber Specimens — ${AmberMerchant.PURCHASE_STONE_COST}🪨
          <span class="ambermerchant-cost">→ +${AmberMerchant.PURCHASE_STONE_RATE} stone/s (2 min) · +${AmberMerchant.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--ambermerchant-away" data-action="ambermerchant-away">
          🚶 Send Away
          <span class="ambermerchant-cost">→ Amber merchant departs with the Baltic collection</span>
        </button>
      </div>
    </div>`;
}

function _wanderingSandglassMakerSection() {
  if (!SandglassMaker.getActiveWanderingSandglassMaker()) return '';
  const secs   = SandglassMaker.getSandglassMakerSecsLeft();
  const urgent = secs <= 15;
  const stone  = state.resources?.stone ?? 0;
  const gold   = state.resources?.gold  ?? 0;
  const iron   = state.resources?.iron  ?? 0;
  const canCommission = stone >= SandglassMaker.COMMISSION_STONE_COST && gold >= SandglassMaker.COMMISSION_GOLD_COST;
  const canPurchase   = iron  >= SandglassMaker.PURCHASE_IRON_COST;
  return `
    <div class="sandglass-section--active">
      <div class="sandglass-header">
        <span class="sandglass-title">⏳ Wandering Sandglass Maker</span>
        <span class="sandglass-timer${urgent ? ' sandglass-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="sandglass-desc">A wandering sandglass maker arrives carrying delicate blown-glass hourglasses filled with fine sea-sand, river silt, and crushed crystal — offering to craft imperial hourglasses for the palace timekeepers, or to share the arcane secrets of glass-sand measurement and fine abrasive compounding.</div>
      <div class="sandglass-actions">
        <button class="btn--sandglass-commission${canCommission ? '' : ' btn--disabled'}" data-action="sandglass-commission" ${canCommission ? '' : 'disabled'}>
          ⏳ Commission Imperial Hourglasses — ${SandglassMaker.COMMISSION_STONE_COST}🪨 + ${SandglassMaker.COMMISSION_GOLD_COST}💰
          <span class="sandglass-cost">→ +${SandglassMaker.COMMISSION_STONE_RATE} stone/s (2.5 min) · +${SandglassMaker.COMMISSION_PRESTIGE_REWARD} prestige · +${SandglassMaker.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--sandglass-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="sandglass-purchase" ${canPurchase ? '' : 'disabled'}>
          🪨 Purchase Glass-Sand Lore — ${SandglassMaker.PURCHASE_IRON_COST}⚙️
          <span class="sandglass-cost">→ +${SandglassMaker.PURCHASE_IRON_RATE} iron/s (2 min) · +${SandglassMaker.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--sandglass-away" data-action="sandglass-away">
          🚶 Send Away
          <span class="sandglass-cost">→ Sandglass maker departs with the hourglass collection</span>
        </button>
      </div>
    </div>`;
}

function _imperialBridgeBuilderSection() {
  if (!BridgeBuilder.getActiveImperialBridgeBuilder()) return '';
  const secs   = BridgeBuilder.getBridgeBuilderSecsLeft();
  const urgent = secs <= 15;
  const stone  = state.resources?.stone ?? 0;
  const gold   = state.resources?.gold  ?? 0;
  const iron   = state.resources?.iron  ?? 0;
  const canCommission = stone >= BridgeBuilder.COMMISSION_STONE_COST && gold >= BridgeBuilder.COMMISSION_GOLD_COST;
  const canStudy      = iron  >= BridgeBuilder.STUDY_IRON_COST;
  return `
    <div class="bridgebld-section--active">
      <div class="bridgebld-header">
        <span class="bridgebld-title">🌉 Imperial Bridge Builder</span>
        <span class="bridgebld-timer${urgent ? ' bridgebld-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="bridgebld-desc">An imperial bridge builder arrives bearing detailed parchment plans for stone arch bridges, timber trestle crossings, and rope suspension spans — offering to commission a grand network of imperial bridges across the river crossings and ravines of the empire, or to sell the latest engineering drawings for bridge foundations and load-bearing arch calculations.</div>
      <div class="bridgebld-actions">
        <button class="btn--bridgebld-commission${canCommission ? '' : ' btn--disabled'}" data-action="bridgebld-commission" ${canCommission ? '' : 'disabled'}>
          🌉 Commission Imperial Bridges — ${BridgeBuilder.COMMISSION_STONE_COST}🪨 + ${BridgeBuilder.COMMISSION_GOLD_COST}💰
          <span class="bridgebld-cost">→ +${BridgeBuilder.COMMISSION_STONE_RATE} stone/s (2.5 min) · +${BridgeBuilder.COMMISSION_PRESTIGE_REWARD} prestige · +${BridgeBuilder.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--bridgebld-study${canStudy ? '' : ' btn--disabled'}" data-action="bridgebld-study" ${canStudy ? '' : 'disabled'}>
          📐 Study Bridge Engineering — ${BridgeBuilder.STUDY_IRON_COST}⚙️
          <span class="bridgebld-cost">→ +${BridgeBuilder.STUDY_IRON_RATE} iron/s (2 min) · +${BridgeBuilder.STUDY_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--bridgebld-away" data-action="bridgebld-away">
          🚶 Send Away
          <span class="bridgebld-cost">→ Bridge builder departs with the engineering plans</span>
        </button>
      </div>
    </div>`;
}

function _wanderingChroniclerSection() {
  if (!Chronicler.getActiveWanderingChronicler()) return '';
  const secs   = Chronicler.getChroniclerSecsLeft();
  const urgent = secs <= 15;
  const mana   = state.resources?.mana ?? 0;
  const gold   = state.resources?.gold ?? 0;
  const canCommission = mana >= Chronicler.COMMISSION_MANA_COST && gold >= Chronicler.COMMISSION_GOLD_COST;
  const canPurchase   = gold >= Chronicler.PURCHASE_GOLD_COST;
  return `
    <div class="chronicler-section--active">
      <div class="chronicler-header">
        <span class="chronicler-title">📜 Wandering Chronicler</span>
        <span class="chronicler-timer${urgent ? ' chronicler-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="chronicler-desc">A wandering chronicler arrives bearing leather-bound volumes of illustrated histories, annotated campaign maps, and gilded dynastic records — offering to compile a lavish imperial chronicle celebrating the empire's greatest deeds and ages, or to sell a rare compendium of historical trade records and merchant ledgers for economic insight.</div>
      <div class="chronicler-actions">
        <button class="btn--chronicler-commission${canCommission ? '' : ' btn--disabled'}" data-action="chronicler-commission" ${canCommission ? '' : 'disabled'}>
          📜 Commission Imperial Chronicle — ${Chronicler.COMMISSION_MANA_COST}✨ + ${Chronicler.COMMISSION_GOLD_COST}💰
          <span class="chronicler-cost">→ +${Chronicler.COMMISSION_MANA_RATE} mana/s (2.5 min) · +${Chronicler.COMMISSION_PRESTIGE_REWARD} prestige · +${Chronicler.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--chronicler-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="chronicler-purchase" ${canPurchase ? '' : 'disabled'}>
          💰 Purchase Historical Compendium — ${Chronicler.PURCHASE_GOLD_COST}💰
          <span class="chronicler-cost">→ +${Chronicler.PURCHASE_GOLD_RATE} gold/s (2 min) · +${Chronicler.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--chronicler-away" data-action="chronicler-away">
          🚶 Send Away
          <span class="chronicler-cost">→ Chronicler departs with the illustrated volumes</span>
        </button>
      </div>
    </div>`;
}

function _imperialSurveyorSection() {
  if (!ImperialSurveyor.getActiveImperialSurveyor()) return '';
  const secs   = ImperialSurveyor.getSurveyorSecsLeft();
  const urgent = secs <= 15;
  const stone  = state.resources?.stone ?? 0;
  const gold   = state.resources?.gold  ?? 0;
  const iron   = state.resources?.iron  ?? 0;
  const canCommission = stone >= ImperialSurveyor.COMMISSION_STONE_COST && gold >= ImperialSurveyor.COMMISSION_GOLD_COST;
  const canStudy      = iron  >= ImperialSurveyor.STUDY_IRON_COST;
  return `
    <div class="surveyor-section--active">
      <div class="surveyor-header">
        <span class="surveyor-title">📏 Imperial Surveyor</span>
        <span class="surveyor-timer${urgent ? ' surveyor-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="surveyor-desc">An imperial surveyor arrives bearing long brass theodolites, wooden measuring rods, and rolled parchment survey maps — offering to conduct a comprehensive land survey identifying new quarry sites and road alignments that maximise stone extraction, or to sell engineering drawings explaining advanced survey instruments and load-bearing frame calculations.</div>
      <div class="surveyor-actions">
        <button class="btn--surveyor-commission${canCommission ? '' : ' btn--disabled'}" data-action="surveyor-commission" ${canCommission ? '' : 'disabled'}>
          📏 Commission Land Survey — ${ImperialSurveyor.COMMISSION_STONE_COST}🪨 + ${ImperialSurveyor.COMMISSION_GOLD_COST}💰
          <span class="surveyor-cost">→ +${ImperialSurveyor.COMMISSION_STONE_RATE} stone/s (2.5 min) · +${ImperialSurveyor.COMMISSION_PRESTIGE_REWARD} prestige · +${ImperialSurveyor.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--surveyor-study${canStudy ? '' : ' btn--disabled'}" data-action="surveyor-study" ${canStudy ? '' : 'disabled'}>
          ⚙️ Study Survey Methods — ${ImperialSurveyor.STUDY_IRON_COST}⚙️
          <span class="surveyor-cost">→ +${ImperialSurveyor.STUDY_IRON_RATE} iron/s (2 min) · +${ImperialSurveyor.STUDY_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--surveyor-away" data-action="surveyor-away">
          🚶 Send Away
          <span class="surveyor-cost">→ Surveyor departs with the theodolites and maps</span>
        </button>
      </div>
    </div>`;
}

function _wanderingTapestryRestorerSection() {
  if (!TapestryRestorer.getActiveWanderingTapestryRestorer()) return '';
  const secs   = TapestryRestorer.getTapestryRestorerSecsLeft();
  const urgent = secs <= 15;
  const wood   = state.resources?.wood ?? 0;
  const food   = state.resources?.food ?? 0;
  const mana   = state.resources?.mana ?? 0;
  const canCommission = wood >= TapestryRestorer.COMMISSION_WOOD_COST && food >= TapestryRestorer.COMMISSION_FOOD_COST;
  const canLearn      = mana >= TapestryRestorer.LEARN_MANA_COST;
  return `
    <div class="taprest-section--active">
      <div class="taprest-header">
        <span class="taprest-title">🧵 Wandering Tapestry Restorer</span>
        <span class="taprest-timer${urgent ? ' taprest-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="taprest-desc">A wandering tapestry restorer arrives bearing rolled linen canvases, embroidery frames, silk thread spools, and aged re-dyeing pigments — offering to restore the imperial tapestry collection depicting legendary conquests and dynastic allegories, or to teach the palace artisans advanced needle-work and mordant-dyeing techniques.</div>
      <div class="taprest-actions">
        <button class="btn--taprest-commission${canCommission ? '' : ' btn--disabled'}" data-action="taprest-commission" ${canCommission ? '' : 'disabled'}>
          🧵 Commission Tapestry Restoration — ${TapestryRestorer.COMMISSION_WOOD_COST}🪵 + ${TapestryRestorer.COMMISSION_FOOD_COST}🌾
          <span class="taprest-cost">→ +${TapestryRestorer.COMMISSION_WOOD_RATE} wood/s (2.5 min) · +${TapestryRestorer.COMMISSION_PRESTIGE_REWARD} prestige · +${TapestryRestorer.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--taprest-learn${canLearn ? '' : ' btn--disabled'}" data-action="taprest-learn" ${canLearn ? '' : 'disabled'}>
          🎨 Learn Restoration Arts — ${TapestryRestorer.LEARN_MANA_COST}✨
          <span class="taprest-cost">→ +${TapestryRestorer.LEARN_MANA_RATE} mana/s (2 min) · +${TapestryRestorer.LEARN_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--taprest-away" data-action="taprest-away">
          🚶 Send Away
          <span class="taprest-cost">→ Restorer departs with the embroidery frames and silk threads</span>
        </button>
      </div>
    </div>`;
}

function _imperialHarborMasterSection() {
  if (!HarborMaster.getActiveImperialHarborMaster()) return '';
  const secs   = HarborMaster.getHarborMasterSecsLeft();
  const urgent = secs <= 15;
  const wood   = state.resources?.wood  ?? 0;
  const gold   = state.resources?.gold  ?? 0;
  const stone  = state.resources?.stone ?? 0;
  const canCommission = wood >= HarborMaster.COMMISSION_WOOD_COST && gold >= HarborMaster.COMMISSION_GOLD_COST;
  const canStudy      = stone >= HarborMaster.STUDY_STONE_COST;
  return `
    <div class="harbormaster-section--active">
      <div class="harbormaster-header">
        <span class="harbormaster-title">⚓ Imperial Harbor Master</span>
        <span class="harbormaster-timer${urgent ? ' harbormaster-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="harbormaster-desc">An imperial harbor master arrives bearing rolled nautical charts, timber-gauge calipers, iron anchor-chain samples, and dock-tariff ledgers — offering to oversee construction of new deep-water berths and cargo cranes to expand maritime trade capacity, or to share a comprehensive study of maritime law and tidal almanacs to maximise stone quarry barge efficiency.</div>
      <div class="harbormaster-actions">
        <button class="btn--harbormaster-commission${canCommission ? '' : ' btn--disabled'}" data-action="harbormaster-commission" ${canCommission ? '' : 'disabled'}>
          ⚓ Commission Harbor Works — ${HarborMaster.COMMISSION_WOOD_COST}🪵 + ${HarborMaster.COMMISSION_GOLD_COST}💰
          <span class="harbormaster-cost">→ +${HarborMaster.COMMISSION_WOOD_RATE} wood/s (2.5 min) · +${HarborMaster.COMMISSION_PRESTIGE_REWARD} prestige · +${HarborMaster.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--harbormaster-study${canStudy ? '' : ' btn--disabled'}" data-action="harbormaster-study" ${canStudy ? '' : 'disabled'}>
          📖 Study Maritime Law — ${HarborMaster.STUDY_STONE_COST}🪨
          <span class="harbormaster-cost">→ +${HarborMaster.STUDY_STONE_RATE} stone/s (2 min) · +${HarborMaster.STUDY_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--harbormaster-away" data-action="harbormaster-away">
          🚶 Send Away
          <span class="harbormaster-cost">→ Harbor master departs with the nautical charts and dock ledgers</span>
        </button>
      </div>
    </div>`;
}

// ── T411 Wandering Bow Maker ─────────────────────────────────────────────────

function _wanderingBowMakerSection() {
  if (!BowMaker.getActiveWanderingBowMaker()) return '';
  const secs   = BowMaker.getBowMakerSecsLeft();
  const urgent = secs <= 15;
  const wood   = state.resources?.wood ?? 0;
  const iron   = state.resources?.iron ?? 0;
  const gold   = state.resources?.gold ?? 0;
  const canCommission = wood >= BowMaker.COMMISSION_WOOD_COST && iron >= BowMaker.COMMISSION_IRON_COST;
  const canPurchase   = gold >= BowMaker.PURCHASE_GOLD_COST;
  return `
    <div class="bowmaker-section--active">
      <div class="bowmaker-header">
        <span class="bowmaker-title">🏹 Wandering Bow Maker</span>
        <span class="bowmaker-timer${urgent ? ' bowmaker-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="bowmaker-desc">A wandering bow maker arrives bearing long-stave yew blanks, ox-horn tip laminates, waxed linen strings, and a kit of drawknives and fletching jigs — offering to craft war-grade composite longbows for the imperial archer corps, or to share specialist stave-selection, moisture-tempering, and tension-calibration secrets.</div>
      <div class="bowmaker-actions">
        <button class="btn--bowmaker-commission${canCommission ? '' : ' btn--disabled'}" data-action="bowmaker-commission" ${canCommission ? '' : 'disabled'}>
          🏹 Commission Imperial Longbows — ${BowMaker.COMMISSION_WOOD_COST}🪵 + ${BowMaker.COMMISSION_IRON_COST}⚙️
          <span class="bowmaker-cost">→ +${BowMaker.COMMISSION_WOOD_RATE} wood/s (2.5 min) · +${BowMaker.COMMISSION_PRESTIGE_REWARD} prestige · +${BowMaker.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--bowmaker-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="bowmaker-purchase" ${canPurchase ? '' : 'disabled'}>
          🪵 Purchase Bowyer Secrets — ${BowMaker.PURCHASE_GOLD_COST}💰
          <span class="bowmaker-cost">→ +${BowMaker.PURCHASE_IRON_RATE} iron/s (2 min) · +${BowMaker.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--bowmaker-away" data-action="bowmaker-away">
          🚶 Send Away
          <span class="bowmaker-cost">→ Bow maker departs with the yew blanks and fletching jigs</span>
        </button>
      </div>
    </div>`;
}

// ── T412 Imperial Cheese Merchant ────────────────────────────────────────────

function _imperialCheeseMerchantSection() {
  if (!CheeseMerchant.getActiveImperialCheeseMerchant()) return '';
  const secs   = CheeseMerchant.getCheeseMerchantSecsLeft();
  const urgent = secs <= 15;
  const food   = state.resources?.food ?? 0;
  const gold   = state.resources?.gold ?? 0;
  const canEstablish = food >= CheeseMerchant.ESTABLISH_FOOD_COST && gold >= CheeseMerchant.ESTABLISH_GOLD_COST;
  const canPurchase  = food >= CheeseMerchant.PURCHASE_FOOD_COST;
  return `
    <div class="cheesemerchant-section--active">
      <div class="cheesemerchant-header">
        <span class="cheesemerchant-title">🧀 Imperial Cheese Merchant</span>
        <span class="cheesemerchant-timer${urgent ? ' cheesemerchant-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="cheesemerchant-desc">An imperial cheese merchant arrives bearing waxed rounds of aged hard cheese, ceramic crocks of brine-cured soft varieties, and dairy-guild production contracts — offering to establish a permanent imperial dairy supplying palace kitchens and garrison mess halls, or to sell a curated selection of aged varieties from renowned provincial pastures.</div>
      <div class="cheesemerchant-actions">
        <button class="btn--cheesemerchant-establish${canEstablish ? '' : ' btn--disabled'}" data-action="cheesemerchant-establish" ${canEstablish ? '' : 'disabled'}>
          🧀 Establish Imperial Dairy — ${CheeseMerchant.ESTABLISH_FOOD_COST}🌾 + ${CheeseMerchant.ESTABLISH_GOLD_COST}💰
          <span class="cheesemerchant-cost">→ +${CheeseMerchant.ESTABLISH_FOOD_RATE} food/s (2.5 min) · +${CheeseMerchant.ESTABLISH_PRESTIGE_REWARD} prestige · +${CheeseMerchant.ESTABLISH_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--cheesemerchant-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="cheesemerchant-purchase" ${canPurchase ? '' : 'disabled'}>
          🥛 Purchase Aged Varieties — ${CheeseMerchant.PURCHASE_FOOD_COST}🌾
          <span class="cheesemerchant-cost">→ +${CheeseMerchant.PURCHASE_FOOD_RATE} food/s (2 min) · +${CheeseMerchant.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--cheesemerchant-away" data-action="cheesemerchant-away">
          🚶 Send Away
          <span class="cheesemerchant-cost">→ Cheese merchant departs with the waxed rounds and crocks</span>
        </button>
      </div>
    </div>`;
}

// ── T413 Wandering Thatcher ───────────────────────────────────────────────────

function _wanderingThatcherSection() {
  if (!Thatcher.getActiveWanderingThatcher()) return '';
  const secs   = Thatcher.getThatcherSecsLeft();
  const urgent = secs <= 15;
  const wood   = state.resources?.wood ?? 0;
  const food   = state.resources?.food ?? 0;
  const gold   = state.resources?.gold ?? 0;
  const canThatch   = wood >= Thatcher.THATCH_WOOD_COST && food >= Thatcher.THATCH_FOOD_COST;
  const canPurchase = gold >= Thatcher.PURCHASE_GOLD_COST;
  return `
    <div class="thatcher-section--active">
      <div class="thatcher-header">
        <span class="thatcher-title">🌾 Wandering Thatcher</span>
        <span class="thatcher-timer${urgent ? ' thatcher-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="thatcher-desc">A wandering thatcher arrives bearing bundles of long water-reed, rye straw, and prepared sedge grass — offering to thatch the imperial halls, granary roofs, and garrison longhouses with tight weatherproof layers, or to share centuries-old thatching techniques for selecting and layering the finest water-reed to produce roofs that last a generation.</div>
      <div class="thatcher-actions">
        <button class="btn--thatcher-thatch${canThatch ? '' : ' btn--disabled'}" data-action="thatcher-thatch" ${canThatch ? '' : 'disabled'}>
          🌾 Thatch Imperial Halls — ${Thatcher.THATCH_WOOD_COST}🪵 + ${Thatcher.THATCH_FOOD_COST}🌾
          <span class="thatcher-cost">→ +${Thatcher.THATCH_WOOD_RATE} wood/s (2.5 min) · +${Thatcher.THATCH_PRESTIGE_REWARD} prestige · +${Thatcher.THATCH_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--thatcher-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="thatcher-purchase" ${canPurchase ? '' : 'disabled'}>
          🏠 Purchase Thatching Craft — ${Thatcher.PURCHASE_GOLD_COST}💰
          <span class="thatcher-cost">→ +${Thatcher.PURCHASE_FOOD_RATE} food/s (2 min) · +${Thatcher.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--thatcher-away" data-action="thatcher-away">
          🚶 Send Away
          <span class="thatcher-cost">→ Thatcher departs with the water-reed bundles</span>
        </button>
      </div>
    </div>`;
}

// ── T414 Imperial Millstone Cutter ────────────────────────────────────────────

function _imperialMillstoneCutterSection() {
  if (!MillstoneCutter.getActiveImperialMillstoneCutter()) return '';
  const secs   = MillstoneCutter.getMillstoneCutterSecsLeft();
  const urgent = secs <= 15;
  const stone  = state.resources?.stone ?? 0;
  const gold   = state.resources?.gold  ?? 0;
  const iron   = state.resources?.iron  ?? 0;
  const canCommission = stone >= MillstoneCutter.COMMISSION_STONE_COST && gold >= MillstoneCutter.COMMISSION_GOLD_COST;
  const canPurchase   = iron  >= MillstoneCutter.PURCHASE_IRON_COST;
  return `
    <div class="millstone-section--active">
      <div class="millstone-header">
        <span class="millstone-title">⚙️ Imperial Millstone Cutter</span>
        <span class="millstone-timer${urgent ? ' millstone-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="millstone-desc">An imperial millstone cutter arrives bearing dressed gritstone and sandstone millstone pairs, iron-fitted runner and bedstone sets, and mill-house blueprint designs — offering to commission precision-balanced millstones for every grain mill and ore crusher in the realm, or to sell stone-dressing and furrow-cutting techniques for peak grinding efficiency.</div>
      <div class="millstone-actions">
        <button class="btn--millstone-commission${canCommission ? '' : ' btn--disabled'}" data-action="millstone-commission" ${canCommission ? '' : 'disabled'}>
          ⚙️ Commission Grinding Millstones — ${MillstoneCutter.COMMISSION_STONE_COST}🪨 + ${MillstoneCutter.COMMISSION_GOLD_COST}💰
          <span class="millstone-cost">→ +${MillstoneCutter.COMMISSION_STONE_RATE} stone/s (2.5 min) · +${MillstoneCutter.COMMISSION_PRESTIGE_REWARD} prestige · +${MillstoneCutter.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--millstone-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="millstone-purchase" ${canPurchase ? '' : 'disabled'}>
          🪨 Purchase Milling Designs — ${MillstoneCutter.PURCHASE_IRON_COST}⚙️
          <span class="millstone-cost">→ +${MillstoneCutter.PURCHASE_IRON_RATE} iron/s (2 min) · +${MillstoneCutter.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--millstone-away" data-action="millstone-away">
          🚶 Send Away
          <span class="millstone-cost">→ Millstone cutter departs with the gritstone pairs</span>
        </button>
      </div>
    </div>`;
}

// ── T415 Wandering Peat Cutter ────────────────────────────────────────────

function _wanderingPeatCutterSection() {
  if (!PeatCutter.getActiveWanderingPeatCutter()) return '';
  const secs   = PeatCutter.getPeatCutterSecsLeft();
  const urgent = secs <= 15;
  const food   = state.resources?.food ?? 0;
  const wood   = state.resources?.wood ?? 0;
  const gold   = state.resources?.gold ?? 0;
  const canCommission = food >= PeatCutter.COMMISSION_FOOD_COST && wood >= PeatCutter.COMMISSION_WOOD_COST;
  const canPurchase   = gold >= PeatCutter.PURCHASE_GOLD_COST;
  return `
    <div class="peatcutter-section--active">
      <div class="peatcutter-header">
        <span class="peatcutter-title">🪵 Wandering Peat Cutter</span>
        <span class="peatcutter-timer${urgent ? ' peatcutter-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="peatcutter-desc">A wandering peat cutter arrives bearing iron-shod peat spades, curved breast-spades, and stacked blocks of air-dried blanket peat from high moorland bogs — offering to commission peat hearths across the imperial granaries, barracks, and longhouses, or to share centuries-old peat-cutting techniques for harvesting and stacking prime-grade sphagnum peat.</div>
      <div class="peatcutter-actions">
        <button class="btn--peatcutter-commission${canCommission ? '' : ' btn--disabled'}" data-action="peatcutter-commission" ${canCommission ? '' : 'disabled'}>
          🪵 Commission Peat Hearths — ${PeatCutter.COMMISSION_FOOD_COST}🌾 + ${PeatCutter.COMMISSION_WOOD_COST}🪵
          <span class="peatcutter-cost">→ +${PeatCutter.COMMISSION_FOOD_RATE} food/s (2.5 min) · +${PeatCutter.COMMISSION_PRESTIGE_REWARD} prestige · +${PeatCutter.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--peatcutter-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="peatcutter-purchase" ${canPurchase ? '' : 'disabled'}>
          🌿 Purchase Peat-Cutting Lore — ${PeatCutter.PURCHASE_GOLD_COST}💰
          <span class="peatcutter-cost">→ +${PeatCutter.PURCHASE_WOOD_RATE} wood/s (2 min) · +${PeatCutter.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--peatcutter-away" data-action="peatcutter-away">
          🚶 Send Away
          <span class="peatcutter-cost">→ Peat cutter departs with the blanket peat blocks</span>
        </button>
      </div>
    </div>`;
}

// ── T416 Imperial Icon Painter ────────────────────────────────────────────

function _imperialIconPainterSection() {
  if (!IconPainter.getActiveImperialIconPainter()) return '';
  const secs   = IconPainter.getIconPainterSecsLeft();
  const urgent = secs <= 15;
  const mana   = state.resources?.mana  ?? 0;
  const gold   = state.resources?.gold  ?? 0;
  const stone  = state.resources?.stone ?? 0;
  const canCommission = mana >= IconPainter.COMMISSION_MANA_COST && gold >= IconPainter.COMMISSION_GOLD_COST;
  const canPurchase   = stone >= IconPainter.PURCHASE_STONE_COST;
  return `
    <div class="iconpainter-section--active">
      <div class="iconpainter-header">
        <span class="iconpainter-title">🎨 Imperial Icon Painter</span>
        <span class="iconpainter-timer${urgent ? ' iconpainter-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="iconpainter-desc">An imperial icon painter arrives carrying gilded oak boards, ground lapis lazuli and malachite pigments, gold-leaf booklets, and fine squirrel-hair brushes — offering to commission sacred icons for every chapel, throne hall, and officer's quarters in the empire, or to sell the gilded iconography pattern book with canonical proportions and gold-leaf burnishing techniques.</div>
      <div class="iconpainter-actions">
        <button class="btn--iconpainter-commission${canCommission ? '' : ' btn--disabled'}" data-action="iconpainter-commission" ${canCommission ? '' : 'disabled'}>
          🎨 Commission Sacred Icons — ${IconPainter.COMMISSION_MANA_COST}✨ + ${IconPainter.COMMISSION_GOLD_COST}💰
          <span class="iconpainter-cost">→ +${IconPainter.COMMISSION_MANA_RATE} mana/s (2.5 min) · +${IconPainter.COMMISSION_PRESTIGE_REWARD} prestige · +${IconPainter.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--iconpainter-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="iconpainter-purchase" ${canPurchase ? '' : 'disabled'}>
          📖 Purchase Gilded Iconography — ${IconPainter.PURCHASE_STONE_COST}🪨
          <span class="iconpainter-cost">→ +${IconPainter.PURCHASE_STONE_RATE} stone/s (2 min) · +${IconPainter.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--iconpainter-away" data-action="iconpainter-away">
          🚶 Send Away
          <span class="iconpainter-cost">→ Icon painter departs with the gilded boards and pigments</span>
        </button>
      </div>
    </div>`;
}

// ── T417 Wandering Wax Tablet Maker ──────────────────────────────────────

function _wanderingWaxTabletMakerSection() {
  if (!WaxTabletMaker.getActiveWanderingWaxTabletMaker()) return '';
  const secs   = WaxTabletMaker.getWaxTabletMakerSecsLeft();
  const urgent = secs <= 15;
  const mana   = state.resources?.mana  ?? 0;
  const gold   = state.resources?.gold  ?? 0;
  const stone  = state.resources?.stone ?? 0;
  const canCommission = mana >= WaxTabletMaker.COMMISSION_MANA_COST && gold >= WaxTabletMaker.COMMISSION_GOLD_COST;
  const canPurchase   = stone >= WaxTabletMaker.PURCHASE_STONE_COST;
  return `
    <div class="waxtablet-section--active">
      <div class="waxtablet-header">
        <span class="waxtablet-title">📋 Wandering Wax Tablet Maker</span>
        <span class="waxtablet-timer${urgent ? ' waxtablet-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="waxtablet-desc">A wandering wax tablet maker arrives carrying freshly cast beeswax tablets in carved boxwood frames, bronze styli, and ivory spatulas — offering to commission imperial administrative records for every chancery and treasury office, or to sell the wax-tablet lore compendium detailing beeswax-to-resin ratios, stylus techniques, and storage-temperature guidance.</div>
      <div class="waxtablet-actions">
        <button class="btn--waxtablet-commission${canCommission ? '' : ' btn--disabled'}" data-action="waxtablet-commission" ${canCommission ? '' : 'disabled'}>
          📋 Commission Imperial Wax Records — ${WaxTabletMaker.COMMISSION_MANA_COST}✨ + ${WaxTabletMaker.COMMISSION_GOLD_COST}💰
          <span class="waxtablet-cost">→ +${WaxTabletMaker.COMMISSION_MANA_RATE} mana/s (2.5 min) · +${WaxTabletMaker.COMMISSION_PRESTIGE_REWARD} prestige · +${WaxTabletMaker.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--waxtablet-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="waxtablet-purchase" ${canPurchase ? '' : 'disabled'}>
          📖 Purchase Wax Tablet Lore — ${WaxTabletMaker.PURCHASE_STONE_COST}🪨
          <span class="waxtablet-cost">→ +${WaxTabletMaker.PURCHASE_STONE_RATE} stone/s (2 min) · +${WaxTabletMaker.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--waxtablet-away" data-action="waxtablet-away">
          🚶 Send Away
          <span class="waxtablet-cost">→ Wax tablet maker departs with the boxwood frames and styli</span>
        </button>
      </div>
    </div>`;
}

// ── T418 Wandering Net Maker ──────────────────────────────────────────────

function _wanderingNetMakerSection() {
  if (!NetMaker.getActiveWanderingNetMaker()) return '';
  const secs   = NetMaker.getNetMakerSecsLeft();
  const urgent = secs <= 15;
  const wood   = state.resources?.wood ?? 0;
  const food   = state.resources?.food ?? 0;
  const gold   = state.resources?.gold ?? 0;
  const canCommission = wood >= NetMaker.COMMISSION_WOOD_COST && food >= NetMaker.COMMISSION_FOOD_COST;
  const canPurchase   = gold >= NetMaker.PURCHASE_GOLD_COST;
  return `
    <div class="netmaker-section--active">
      <div class="netmaker-header">
        <span class="netmaker-title">🎣 Wandering Net Maker</span>
        <span class="netmaker-timer${urgent ? ' netmaker-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="netmaker-desc">A wandering net maker arrives with bolts of twisted linen cordage, wooden netting needles, mesh gauges, and lead sinkers — offering to commission imperial fishing nets for every river fishery and coastal harbour, or to sell the net-making secrets compendium detailing knot sequences, mesh-gauge selection, and cordage-soaking schedules.</div>
      <div class="netmaker-actions">
        <button class="btn--netmaker-commission${canCommission ? '' : ' btn--disabled'}" data-action="netmaker-commission" ${canCommission ? '' : 'disabled'}>
          🎣 Commission Imperial Fishing Nets — ${NetMaker.COMMISSION_WOOD_COST}🪵 + ${NetMaker.COMMISSION_FOOD_COST}🌾
          <span class="netmaker-cost">→ +${NetMaker.COMMISSION_FOOD_RATE} food/s (2.5 min) · +${NetMaker.COMMISSION_PRESTIGE_REWARD} prestige · +${NetMaker.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--netmaker-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="netmaker-purchase" ${canPurchase ? '' : 'disabled'}>
          📖 Purchase Net-Making Secrets — ${NetMaker.PURCHASE_GOLD_COST}💰
          <span class="netmaker-cost">→ +${NetMaker.PURCHASE_GOLD_RATE} gold/s (2 min) · +${NetMaker.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--netmaker-away" data-action="netmaker-away">
          🚶 Send Away
          <span class="netmaker-cost">→ Net maker departs with the cordage bolts and netting needles</span>
        </button>
      </div>
    </div>`;
}

// ── T419 Wandering Drum Maker ─────────────────────────────────────────────

function _wanderingDrumMakerSection() {
  if (!DrumMaker.getActiveWanderingDrumMaker()) return '';
  const secs   = DrumMaker.getDrumMakerSecsLeft();
  const urgent = secs <= 15;
  const wood   = state.resources?.wood ?? 0;
  const food   = state.resources?.food ?? 0;
  const gold   = state.resources?.gold ?? 0;
  const canCommission = wood >= DrumMaker.COMMISSION_WOOD_COST && food >= DrumMaker.COMMISSION_FOOD_COST;
  const canPurchase   = gold >= DrumMaker.PURCHASE_GOLD_COST;
  return `
    <div class="drummaker-section--active">
      <div class="drummaker-header">
        <span class="drummaker-title">🥁 Wandering Drum Maker</span>
        <span class="drummaker-timer${urgent ? ' drummaker-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="drummaker-desc">A wandering drum maker arrives with seasoned oak stave-drums, double goat-hide heads, carved bone tensioning pegs, and padded willow beaters — offering to commission ceremonial drums for the palace courtyard and garrison parade ground, or to sell the drum-making craft compendium detailing stave-selection, hide-soaking, and tension-tuning techniques.</div>
      <div class="drummaker-actions">
        <button class="btn--drummaker-commission${canCommission ? '' : ' btn--disabled'}" data-action="drummaker-commission" ${canCommission ? '' : 'disabled'}>
          🥁 Commission Ceremonial Drums — ${DrumMaker.COMMISSION_WOOD_COST}🪵 + ${DrumMaker.COMMISSION_FOOD_COST}🌾
          <span class="drummaker-cost">→ +${DrumMaker.COMMISSION_WOOD_RATE} wood/s (2.5 min) · +${DrumMaker.COMMISSION_PRESTIGE_REWARD} prestige · +${DrumMaker.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--drummaker-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="drummaker-purchase" ${canPurchase ? '' : 'disabled'}>
          📖 Purchase Drum-Making Craft — ${DrumMaker.PURCHASE_GOLD_COST}💰
          <span class="drummaker-cost">→ +${DrumMaker.PURCHASE_GOLD_RATE} gold/s (2 min) · +${DrumMaker.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--drummaker-away" data-action="drummaker-away">
          🚶 Send Away
          <span class="drummaker-cost">→ Drum maker departs with the oak stave-drums and goat-hide heads</span>
        </button>
      </div>
    </div>`;
}

// ── T420 Imperial Herbarium Keeper ────────────────────────────────────────

function _imperialHerbariumKeeperSection() {
  if (!HerbariumKeeper.getActiveImperialHerbariumKeeper()) return '';
  const secs   = HerbariumKeeper.getHerbariumKeeperSecsLeft();
  const urgent = secs <= 15;
  const mana   = state.resources?.mana ?? 0;
  const gold   = state.resources?.gold ?? 0;
  const food   = state.resources?.food ?? 0;
  const canCommission = mana >= HerbariumKeeper.COMMISSION_MANA_COST && gold >= HerbariumKeeper.COMMISSION_GOLD_COST;
  const canPurchase   = food >= HerbariumKeeper.PURCHASE_FOOD_COST;
  return `
    <div class="herbarium-section--active">
      <div class="herbarium-header">
        <span class="herbarium-title">🌿 Imperial Herbarium Keeper</span>
        <span class="herbarium-timer${urgent ? ' herbarium-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="herbarium-desc">An imperial herbarium keeper arrives with pressed-plant folios, copper-topped specimen vials, dried root bundles, and illustrated botanical charts — offering to commission a complete herbal compendium for the palace physic garden and apothecary stores, or to sell a curated selection of medicinal plants including valerian, yarrow, marsh-mallow, and elderflower.</div>
      <div class="herbarium-actions">
        <button class="btn--herbarium-commission${canCommission ? '' : ' btn--disabled'}" data-action="herbarium-commission" ${canCommission ? '' : 'disabled'}>
          🌿 Commission Herbal Compendium — ${HerbariumKeeper.COMMISSION_MANA_COST}✨ + ${HerbariumKeeper.COMMISSION_GOLD_COST}💰
          <span class="herbarium-cost">→ +${HerbariumKeeper.COMMISSION_MANA_RATE} mana/s (2.5 min) · +${HerbariumKeeper.COMMISSION_PRESTIGE_REWARD} prestige · +${HerbariumKeeper.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--herbarium-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="herbarium-purchase" ${canPurchase ? '' : 'disabled'}>
          🌱 Purchase Medicinal Plants — ${HerbariumKeeper.PURCHASE_FOOD_COST}🌾
          <span class="herbarium-cost">→ +${HerbariumKeeper.PURCHASE_FOOD_RATE} food/s (2 min) · +${HerbariumKeeper.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--herbarium-away" data-action="herbarium-away">
          🚶 Send Away
          <span class="herbarium-cost">→ Herbarium keeper departs with the calfskin folios and specimen vials</span>
        </button>
      </div>
    </div>`;
}

// ── T421 Wandering Spear Maker ────────────────────────────────────────────

function _wanderingSpearMakerSection() {
  if (!SpearMaker.getActiveWanderingSpearMaker()) return '';
  const secs   = SpearMaker.getSpearMakerSecsLeft();
  const urgent = secs <= 15;
  const wood   = state.resources?.wood ?? 0;
  const food   = state.resources?.food ?? 0;
  const gold   = state.resources?.gold ?? 0;
  const canCommission = wood >= SpearMaker.COMMISSION_WOOD_COST && food >= SpearMaker.COMMISSION_FOOD_COST;
  const canPurchase   = gold >= SpearMaker.PURCHASE_GOLD_COST;
  return `
    <div class="spearmaker-section--active">
      <div class="spearmaker-header">
        <span class="spearmaker-title">🏹 Wandering Spear Maker</span>
        <span class="spearmaker-timer${urgent ? ' spearmaker-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="spearmaker-desc">A wandering spear maker arrives carrying fire-hardened ash shafts, iron-tipped hunting points, balanced throwing spears, and short thrusting spears — offering to commission a full set of hunting implements for the empire's frontier hunters and garrison troops, or to share the spear-crafting lore that keeps every workshop stocked with well-balanced hunting spears.</div>
      <div class="spearmaker-actions">
        <button class="btn--spearmaker-commission${canCommission ? '' : ' btn--disabled'}" data-action="spearmaker-commission" ${canCommission ? '' : 'disabled'}>
          🏹 Commission Hunting Spears — ${SpearMaker.COMMISSION_WOOD_COST}🪵 + ${SpearMaker.COMMISSION_FOOD_COST}🌾
          <span class="spearmaker-cost">→ +${SpearMaker.COMMISSION_FOOD_RATE} food/s (2.5 min) · +${SpearMaker.COMMISSION_PRESTIGE_REWARD} prestige · +${SpearMaker.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--spearmaker-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="spearmaker-purchase" ${canPurchase ? '' : 'disabled'}>
          📖 Purchase Spear-Crafting Lore — ${SpearMaker.PURCHASE_GOLD_COST}💰
          <span class="spearmaker-cost">→ +${SpearMaker.PURCHASE_GOLD_RATE} gold/s (2 min) · +${SpearMaker.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--spearmaker-away" data-action="spearmaker-away">
          🚶 Send Away
          <span class="spearmaker-cost">→ Spear maker re-bundles the ash poles and departs the settlement</span>
        </button>
      </div>
    </div>`;
}

// ── T422 Imperial Robe Maker ──────────────────────────────────────────────

function _imperialRobeMakerSection() {
  if (!RobeMaker.getActiveImperialRobeMaker()) return '';
  const secs   = RobeMaker.getRobeMakerSecsLeft();
  const urgent = secs <= 15;
  const mana   = state.resources?.mana ?? 0;
  const gold   = state.resources?.gold ?? 0;
  const food   = state.resources?.food ?? 0;
  const canCommission = mana >= RobeMaker.COMMISSION_MANA_COST && gold >= RobeMaker.COMMISSION_GOLD_COST;
  const canPurchase   = food >= RobeMaker.PURCHASE_FOOD_COST;
  return `
    <div class="robemaker-section--active">
      <div class="robemaker-header">
        <span class="robemaker-title">🎭 Imperial Robe Maker</span>
        <span class="robemaker-timer${urgent ? ' robemaker-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="robemaker-desc">An imperial robe maker arrives with bolts of richly dyed woollen cloth, silk brocade trimmed with northern fur, embroidered ceremonial mantles stitched with gold and silver thread, and fitted court robes lined with fine linen — offering to commission a full ceremonial collection for the palace court, or to sell a bolt of fine fabric that raises the morale of palace workers and courtiers.</div>
      <div class="robemaker-actions">
        <button class="btn--robemaker-commission${canCommission ? '' : ' btn--disabled'}" data-action="robemaker-commission" ${canCommission ? '' : 'disabled'}>
          🎭 Commission Imperial Robes — ${RobeMaker.COMMISSION_MANA_COST}✨ + ${RobeMaker.COMMISSION_GOLD_COST}💰
          <span class="robemaker-cost">→ +${RobeMaker.COMMISSION_MANA_RATE} mana/s (2.5 min) · +${RobeMaker.COMMISSION_PRESTIGE_REWARD} prestige · +${RobeMaker.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--robemaker-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="robemaker-purchase" ${canPurchase ? '' : 'disabled'}>
          🧵 Purchase Fine Fabrics — ${RobeMaker.PURCHASE_FOOD_COST}🌾
          <span class="robemaker-cost">→ +${RobeMaker.PURCHASE_FOOD_RATE} food/s (2 min) · +${RobeMaker.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--robemaker-away" data-action="robemaker-away">
          🚶 Send Away
          <span class="robemaker-cost">→ Robe maker re-folds the silk brocade and departs the palace</span>
        </button>
      </div>
    </div>`;
}

// ── T423 Wandering Fletcher ───────────────────────────────────────────────

function _wanderingFletcherSection() {
  if (!Fletcher.getActiveWanderingFletcher()) return '';
  const secs   = Fletcher.getFletcherSecsLeft();
  const urgent = secs <= 15;
  const wood   = state.resources?.wood ?? 0;
  const food   = state.resources?.food ?? 0;
  const gold   = state.resources?.gold ?? 0;
  const canCommission = wood >= Fletcher.COMMISSION_WOOD_COST && food >= Fletcher.COMMISSION_FOOD_COST;
  const canPurchase   = gold >= Fletcher.PURCHASE_GOLD_COST;
  return `
    <div class="fletcher-section--active">
      <div class="fletcher-header">
        <span class="fletcher-title">🏹 Wandering Fletcher</span>
        <span class="fletcher-timer${urgent ? ' fletcher-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="fletcher-desc">A wandering fletcher arrives carrying bundled straight ash shafts, goose-feather flights split and trimmed to matching width, iron-tipped hunting points, finished arrow bundles bound in waxed thread, and pattern gauges — offering to commission a full supply of hunting arrows for the settlement's bow hunters and garrison archers, or to share the fletching craft that keeps every workshop producing flight-stable arrows.</div>
      <div class="fletcher-actions">
        <button class="btn--fletcher-commission${canCommission ? '' : ' btn--disabled'}" data-action="fletcher-commission" ${canCommission ? '' : 'disabled'}>
          🏹 Commission Arrow Bundles — ${Fletcher.COMMISSION_WOOD_COST}🪵 + ${Fletcher.COMMISSION_FOOD_COST}🌾
          <span class="fletcher-cost">→ +${Fletcher.COMMISSION_FOOD_RATE} food/s (2.5 min) · +${Fletcher.COMMISSION_PRESTIGE_REWARD} prestige · +${Fletcher.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--fletcher-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="fletcher-purchase" ${canPurchase ? '' : 'disabled'}>
          📖 Purchase Fletching Craft — ${Fletcher.PURCHASE_GOLD_COST}💰
          <span class="fletcher-cost">→ +${Fletcher.PURCHASE_GOLD_RATE} gold/s (2 min) · +${Fletcher.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--fletcher-away" data-action="fletcher-away">
          🚶 Send Away
          <span class="fletcher-cost">→ Fletcher re-bundles the arrows in oiled linen and departs the settlement</span>
        </button>
      </div>
    </div>`;
}

// ── T424 Imperial Knifesmith ──────────────────────────────────────────────

function _imperialKnifesmithSection() {
  if (!Knifesmith.getActiveImperialKnifesmith()) return '';
  const secs   = Knifesmith.getKnifesmithSecsLeft();
  const urgent = secs <= 15;
  const iron   = state.resources?.iron ?? 0;
  const gold   = state.resources?.gold ?? 0;
  const stone  = state.resources?.stone ?? 0;
  const canCommission = iron >= Knifesmith.COMMISSION_IRON_COST && gold >= Knifesmith.COMMISSION_GOLD_COST;
  const canPurchase   = stone >= Knifesmith.PURCHASE_STONE_COST;
  return `
    <div class="knifesmith-section--active">
      <div class="knifesmith-header">
        <span class="knifesmith-title">⚔️ Imperial Knifesmith</span>
        <span class="knifesmith-timer${urgent ? ' knifesmith-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="knifesmith-desc">An imperial knifesmith arrives with a presentation case of folded-iron hunting blades with bone and antler handles, skinning knives with hollow-ground bevels, butchering blades with broad stock, garrison utility knives with clip-point tips, and a grinding wheel for edge-dressing — offering to commission a full blade collection for the palace hunters and garrison, or to share blade-craft that keeps every smithy producing sharp-edged cutting tools from standard iron stocks.</div>
      <div class="knifesmith-actions">
        <button class="btn--knifesmith-commission${canCommission ? '' : ' btn--disabled'}" data-action="knifesmith-commission" ${canCommission ? '' : 'disabled'}>
          ⚔️ Commission Blade Collection — ${Knifesmith.COMMISSION_IRON_COST}⚙️ + ${Knifesmith.COMMISSION_GOLD_COST}💰
          <span class="knifesmith-cost">→ +${Knifesmith.COMMISSION_IRON_RATE} iron/s (2.5 min) · +${Knifesmith.COMMISSION_PRESTIGE_REWARD} prestige · +${Knifesmith.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--knifesmith-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="knifesmith-purchase" ${canPurchase ? '' : 'disabled'}>
          📖 Purchase Blade Craft — ${Knifesmith.PURCHASE_STONE_COST}🪨
          <span class="knifesmith-cost">→ +${Knifesmith.PURCHASE_STONE_RATE} stone/s (2 min) · +${Knifesmith.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--knifesmith-away" data-action="knifesmith-away">
          🚶 Send Away
          <span class="knifesmith-cost">→ Knifesmith closes the presentation case and departs the palace workshop</span>
        </button>
      </div>
    </div>`;
}

// ── T425 Wandering Sail Maker ─────────────────────────────────────────────

function _wanderingSailMakerSection() {
  if (!SailMaker.getActiveWanderingSailMaker()) return '';
  const secs   = SailMaker.getSailMakerSecsLeft();
  const urgent = secs <= 15;
  const wood   = state.resources?.wood ?? 0;
  const food   = state.resources?.food ?? 0;
  const gold   = state.resources?.gold ?? 0;
  const canCommission = wood >= SailMaker.COMMISSION_WOOD_COST && food >= SailMaker.COMMISSION_FOOD_COST;
  const canPurchase   = gold >= SailMaker.PURCHASE_GOLD_COST;
  return `
    <div class="sailmaker-section--active">
      <div class="sailmaker-header">
        <span class="sailmaker-title">⛵ Wandering Sail Maker</span>
        <span class="sailmaker-timer${urgent ? ' sailmaker-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="sailmaker-desc">A wandering sail maker arrives carrying bolts of tallow-and-beeswax-dressed heavy linen canvas, rolls of ripstop weave for river-barge canopies, coils of tarred hemp rope for bolt-ropes, brass sail-rings for corner patches, and sail-panel layout patterns for the empire's river-barge and coastal fishing-boat mast configurations — offering to commission a full supply of rigged sails for the waterway fleet, or to share sail-making craft that keeps every workshop producing durable wind-tight canvas.</div>
      <div class="sailmaker-actions">
        <button class="btn--sailmaker-commission${canCommission ? '' : ' btn--disabled'}" data-action="sailmaker-commission" ${canCommission ? '' : 'disabled'}>
          ⛵ Commission Sailing Canvas — ${SailMaker.COMMISSION_WOOD_COST}🪵 + ${SailMaker.COMMISSION_FOOD_COST}🌾
          <span class="sailmaker-cost">→ +${SailMaker.COMMISSION_WOOD_RATE} wood/s (2.5 min) · +${SailMaker.COMMISSION_PRESTIGE_REWARD} prestige · +${SailMaker.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--sailmaker-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="sailmaker-purchase" ${canPurchase ? '' : 'disabled'}>
          📖 Purchase Sail-Making Lore — ${SailMaker.PURCHASE_GOLD_COST}💰
          <span class="sailmaker-cost">→ +${SailMaker.PURCHASE_GOLD_RATE} gold/s (2 min) · +${SailMaker.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--sailmaker-away" data-action="sailmaker-away">
          🚶 Send Away
          <span class="sailmaker-cost">→ Sail maker re-rolls the canvas bolts and departs along the riverside path</span>
        </button>
      </div>
    </div>`;
}

// ── T426 Imperial Chariot Builder ─────────────────────────────────────────

function _imperialChariotBuilderSection() {
  if (!ChariotBuilder.getActiveImperialChariotBuilder()) return '';
  const secs   = ChariotBuilder.getChariotBuilderSecsLeft();
  const urgent = secs <= 15;
  const wood   = state.resources?.wood ?? 0;
  const iron   = state.resources?.iron ?? 0;
  const gold   = state.resources?.gold ?? 0;
  const canCommission = wood >= ChariotBuilder.COMMISSION_WOOD_COST && iron >= ChariotBuilder.COMMISSION_IRON_COST;
  const canPurchase   = gold >= ChariotBuilder.PURCHASE_GOLD_COST;
  return `
    <div class="chariotbld-section--active">
      <div class="chariotbld-header">
        <span class="chariotbld-title">🏇 Imperial Chariot Builder</span>
        <span class="chariotbld-timer${urgent ? ' chariotbld-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="chariotbld-desc">An imperial chariot builder arrives at the palace stable-yard carrying bent-wood wheel rims shaped to exact radius, elm spoke blanks dressed to a uniform taper, bronze-bushed wheel hubs, a lightweight wicker-sided fighting platform on a bronze axle bar, and joinery templates for the pole, yoke, and floor-frame joints — offering to commission a full fleet of war chariots for the palace cavalry and chariot-archer corps, or to share chariot-building designs allowing every workshop to produce fighting vehicles from existing stocks.</div>
      <div class="chariotbld-actions">
        <button class="btn--chariotbld-commission${canCommission ? '' : ' btn--disabled'}" data-action="chariotbld-commission" ${canCommission ? '' : 'disabled'}>
          🏇 Commission War Chariots — ${ChariotBuilder.COMMISSION_WOOD_COST}🪵 + ${ChariotBuilder.COMMISSION_IRON_COST}⚙️
          <span class="chariotbld-cost">→ +${ChariotBuilder.COMMISSION_IRON_RATE} iron/s (2.5 min) · +${ChariotBuilder.COMMISSION_PRESTIGE_REWARD} prestige · +${ChariotBuilder.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--chariotbld-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="chariotbld-purchase" ${canPurchase ? '' : 'disabled'}>
          📖 Purchase Chariot Designs — ${ChariotBuilder.PURCHASE_GOLD_COST}💰
          <span class="chariotbld-cost">→ +${ChariotBuilder.PURCHASE_GOLD_RATE} gold/s (2 min) · +${ChariotBuilder.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--chariotbld-away" data-action="chariotbld-away">
          🚶 Send Away
          <span class="chariotbld-cost">→ Chariot builder packs the wheel-rim forms and departs the palace stable-yard</span>
        </button>
      </div>
    </div>`;
}

// ── T427 Wandering Seed Merchant ──────────────────────────────────────────

function _wanderingSeedMerchantSection() {
  if (!SeedMerchant.getActiveWanderingSeedMerchant()) return '';
  const secs        = SeedMerchant.getSeedMerchantSecsLeft();
  const urgent      = secs <= 15;
  const food        = state.resources?.food ?? 0;
  const gold        = state.resources?.gold ?? 0;
  const canPurchase = food >= SeedMerchant.PURCHASE_FOOD_COST;
  const canExchange = gold >= SeedMerchant.EXCHANGE_GOLD_COST;
  return `
    <div class="seedmerchant-section--active">
      <div class="seedmerchant-header">
        <span class="seedmerchant-title">🌱 Wandering Seed Merchant</span>
        <span class="seedmerchant-timer${urgent ? ' seedmerchant-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="seedmerchant-desc">A wandering seed merchant arrives carrying linen pouches of cultivated grain varieties selected over many growing seasons — emmer and einkorn wheats with large full kernels, hulled barley strains with tight husks, a nitrogen-fixing lentil variety yielding two to three times the planted volume, and short-season broad bean stock — offering to sell the rare seed collection that replenishes and improves the empire's agricultural stock, or to share accumulated crop cultivation lore from farmers across the wider region.</div>
      <div class="seedmerchant-actions">
        <button class="btn--seedmerchant-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="seedmerchant-purchase" ${canPurchase ? '' : 'disabled'}>
          🌱 Purchase Rare Seed Collection — ${SeedMerchant.PURCHASE_FOOD_COST}🌾
          <span class="seedmerchant-cost">→ +${SeedMerchant.PURCHASE_FOOD_RATE} food/s (2.5 min) · +${SeedMerchant.PURCHASE_PRESTIGE_REWARD} prestige · +${SeedMerchant.PURCHASE_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--seedmerchant-exchange${canExchange ? '' : ' btn--disabled'}" data-action="seedmerchant-exchange" ${canExchange ? '' : 'disabled'}>
          📖 Exchange Crop Cultivation Lore — ${SeedMerchant.EXCHANGE_GOLD_COST}💰
          <span class="seedmerchant-cost">→ +${SeedMerchant.EXCHANGE_GOLD_RATE} gold/s (2 min) · +${SeedMerchant.EXCHANGE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--seedmerchant-away" data-action="seedmerchant-away">
          🚶 Send Away
          <span class="seedmerchant-cost">→ Seed merchant closes the travelling chest and departs along the field-track</span>
        </button>
      </div>
    </div>`;
}

// ── T428 Imperial Silkscreen Painter ─────────────────────────────────────

function _imperialSilkscreenPainterSection() {
  if (!SilkPainter.getActiveImperialSilkscreenPainter()) return '';
  const secs          = SilkPainter.getSilkscreenPainterSecsLeft();
  const urgent        = secs <= 15;
  const mana          = state.resources?.mana ?? 0;
  const gold          = state.resources?.gold ?? 0;
  const wood          = state.resources?.wood ?? 0;
  const canCommission = mana >= SilkPainter.COMMISSION_MANA_COST && gold >= SilkPainter.COMMISSION_GOLD_COST;
  const canPurchase   = wood >= SilkPainter.PURCHASE_WOOD_COST;
  return `
    <div class="silkpaint-section--active">
      <div class="silkpaint-header">
        <span class="silkpaint-title">🎨 Imperial Silkscreen Painter</span>
        <span class="silkpaint-timer${urgent ? ' silkpaint-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="silkpaint-desc">An imperial silkscreen painter arrives at the palace carrying fine-mesh silk screens stretched over hardwood frames — each hand-drawn with a linseed oil and pine resin pattern resist, together with powdered mineral pigments from lapis lazuli, malachite, cinnabar, and white lead oxide mixed into colour-fast paste that transfers through the mesh in a single squeegee pass — offering to commission a full set of painted panels for the throne room and banqueting hall, or to share pigment formulas and screen-cutting methods allowing every workshop to produce consistent high-quality decoration.</div>
      <div class="silkpaint-actions">
        <button class="btn--silkpaint-commission${canCommission ? '' : ' btn--disabled'}" data-action="silkpaint-commission" ${canCommission ? '' : 'disabled'}>
          🎨 Commission Painted Screen Panels — ${SilkPainter.COMMISSION_MANA_COST}✨ + ${SilkPainter.COMMISSION_GOLD_COST}💰
          <span class="silkpaint-cost">→ +${SilkPainter.COMMISSION_MANA_RATE} mana/s (2.5 min) · +${SilkPainter.COMMISSION_PRESTIGE_REWARD} prestige · +${SilkPainter.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--silkpaint-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="silkpaint-purchase" ${canPurchase ? '' : 'disabled'}>
          🖌️ Purchase Painting Pigment Formulas — ${SilkPainter.PURCHASE_WOOD_COST}🪵
          <span class="silkpaint-cost">→ +${SilkPainter.PURCHASE_WOOD_RATE} wood/s (2 min) · +${SilkPainter.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--silkpaint-away" data-action="silkpaint-away">
          🚶 Send Away
          <span class="silkpaint-cost">→ Silkscreen painter wraps the frames and departs the palace workshop</span>
        </button>
      </div>
    </div>`;
}

// ── T429 Wandering Woodcutter ─────────────────────────────────────────────

function _wanderingWoodcutterSection() {
  if (!Woodcutter.getActiveWanderingWoodcutter()) return '';
  const secs          = Woodcutter.getWoodcutterSecsLeft();
  const urgent        = secs <= 15;
  const wood          = state.resources?.wood ?? 0;
  const gold          = state.resources?.gold ?? 0;
  const canCommission = wood >= Woodcutter.COMMISSION_WOOD_COST;
  const canPurchase   = gold >= Woodcutter.PURCHASE_GOLD_COST;
  return `
    <div class="woodcutter-section--active">
      <div class="woodcutter-header">
        <span class="woodcutter-title">🪓 Wandering Woodcutter</span>
        <span class="woodcutter-timer${urgent ? ' woodcutter-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="woodcutter-desc">A wandering woodcutter arrives carrying a broad-bladed felling axe worn smooth by years of daily swinging through oak, ash, elm, and coppiced hazel — the felled trunks limbed, crosscut, and bundled into faggots stacked for minimal lifting, together with a splitting maul that parts billets cleanly along the grain into flat-faced firewood that stacks tightly and seasons quickly — offering to commission a full run of firewood bundles from the current standing timber, or to share the accumulated forest management lore allowing every settlement woodward to select the right species, cut cycle, and stacking method.</div>
      <div class="woodcutter-actions">
        <button class="btn--woodcutter-commission${canCommission ? '' : ' btn--disabled'}" data-action="woodcutter-commission" ${canCommission ? '' : 'disabled'}>
          🪓 Commission Firewood Bundles — ${Woodcutter.COMMISSION_WOOD_COST}🪵
          <span class="woodcutter-cost">→ +${Woodcutter.COMMISSION_WOOD_RATE} wood/s (2.5 min) · +${Woodcutter.COMMISSION_PRESTIGE_REWARD} prestige · +${Woodcutter.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--woodcutter-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="woodcutter-purchase" ${canPurchase ? '' : 'disabled'}>
          📖 Purchase Forest Management Lore — ${Woodcutter.PURCHASE_GOLD_COST}💰
          <span class="woodcutter-cost">→ +${Woodcutter.PURCHASE_GOLD_RATE} gold/s (2 min) · +${Woodcutter.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--woodcutter-away" data-action="woodcutter-away">
          🚶 Send Away
          <span class="woodcutter-cost">→ Woodcutter shoulders the axe and departs along the woodland track</span>
        </button>
      </div>
    </div>`;
}

// ── T430 Imperial Mason's Guild ───────────────────────────────────────────

function _imperialMasonsGuildSection() {
  if (!MasonsGuild.getActiveImperialMasonsGuild()) return '';
  const secs          = MasonsGuild.getMasonsGuildSecsLeft();
  const urgent        = secs <= 15;
  const stone         = state.resources?.stone ?? 0;
  const gold          = state.resources?.gold ?? 0;
  const iron          = state.resources?.iron ?? 0;
  const canCommission = stone >= MasonsGuild.COMMISSION_STONE_COST && gold >= MasonsGuild.COMMISSION_GOLD_COST;
  const canPurchase   = iron >= MasonsGuild.PURCHASE_IRON_COST;
  return `
    <div class="masonsguild-section--active">
      <div class="masonsguild-header">
        <span class="masonsguild-title">🏛️ Imperial Mason's Guild</span>
        <span class="masonsguild-timer${urgent ? ' masonsguild-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="masonsguild-desc">A delegation from the imperial mason's guild arrives carrying master drawings on vellum — elevation sections through the full wall thickness from rubble core to dressed ashlar face, mortar joint profiles with exact aggregate grading and lime-to-sand ratios, voussoir templates for arches and vault ribs, and a bound ledger of stone performance records — offering to commission a complete stone masonry expansion of the imperial fortifications using guild labour and current stone stockpile, or to purchase the guild's complete masonry secrets for mortar preparation, ashlar dressing, and arch construction.</div>
      <div class="masonsguild-actions">
        <button class="btn--masonsguild-commission${canCommission ? '' : ' btn--disabled'}" data-action="masonsguild-commission" ${canCommission ? '' : 'disabled'}>
          🏛️ Commission Stone Masonry Works — ${MasonsGuild.COMMISSION_STONE_COST}🪨 + ${MasonsGuild.COMMISSION_GOLD_COST}💰
          <span class="masonsguild-cost">→ +${MasonsGuild.COMMISSION_STONE_RATE} stone/s (2.5 min) · +${MasonsGuild.COMMISSION_PRESTIGE_REWARD} prestige · +${MasonsGuild.COMMISSION_MORALE_REWARD} morale</span>
        </button>
        <button class="btn--masonsguild-purchase${canPurchase ? '' : ' btn--disabled'}" data-action="masonsguild-purchase" ${canPurchase ? '' : 'disabled'}>
          📐 Purchase Guild Masonry Secrets — ${MasonsGuild.PURCHASE_IRON_COST}⚙️
          <span class="masonsguild-cost">→ +${MasonsGuild.PURCHASE_IRON_RATE} iron/s (2 min) · +${MasonsGuild.PURCHASE_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn--masonsguild-away" data-action="masonsguild-away">
          🚶 Send Away
          <span class="masonsguild-cost">→ Guild delegation rolls up the master drawings and departs the palace</span>
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

  'navigator-charts':        () => Navigator.commissionSeaCharts(),
  'navigator-secrets':       () => Navigator.exchangeNavigationSecrets(),
  'navigator-away':          () => Navigator.sendNavigatorAway(),

  'illuminator-codex':       () => Illuminator.commissionIlluminatedCodex(),
  'illuminator-scripts':     () => Illuminator.purchaseGildedScripts(),
  'illuminator-away':        () => Illuminator.sendIlluminatorAway(),

  'ritual-ceremony':         () => RitualLeader.conductImperialCeremony(),
  'ritual-donation':         () => RitualLeader.donateSacredRelics(),
  'ritual-decline':          () => RitualLeader.declineRitualInvitation(),

  'prospector-expedition':   () => MtProspector.fundMiningExpedition(),
  'prospector-maps':         () => MtProspector.shareOreMaps(),
  'prospector-away':         () => MtProspector.sendProspectorAway(),
  'leatherworker-saddles':   () => Leatherworker.commissionImperialSaddles(),
  'leatherworker-trade':     () => Leatherworker.tradeForLeatherGoods(),
  'leatherworker-away':      () => Leatherworker.sendLeatherworkerAway(),
  'apothecary-remedies':     () => Apothecary.commissionImperialRemedies(),
  'apothecary-potions':      () => Apothecary.purchaseExoticPotions(),
  'apothecary-away':         () => Apothecary.sendApothecaryAway(),
  'fishmonger-purchase':     () => Fishmonger.purchaseFreshCatch(),
  'fishmonger-trade':        () => Fishmonger.tradeForDriedFish(),
  'fishmonger-away':         () => Fishmonger.sendFishmongerAway(),
  'chandler-commission':     () => Chandler.commissionCandleWorks(),
  'chandler-purchase':       () => Chandler.purchaseFineCandles(),
  'chandler-away':           () => Chandler.sendChandlerAway(),

  'lamplighter-establish':   () => Lamplighter.establishLampDistrict(),
  'lamplighter-purchase':    () => Lamplighter.purchaseStreetLanterns(),
  'lamplighter-away':        () => Lamplighter.sendLamplighterAway(),

  'cooper-commission':       () => Cooper.commissionStorageBarrels(),
  'cooper-purchase':         () => Cooper.purchaseCooperageSecrets(),
  'cooper-away':             () => Cooper.sendCooperAway(),

  'ropemaker-commission':    () => RopeMaker.commissionShipRigging(),
  'ropemaker-purchase':      () => RopeMaker.purchaseRopeMakingLore(),
  'ropemaker-away':          () => RopeMaker.sendRopeMakerAway(),

  'salt-route':              () => SaltMerchant.establishSaltTradeRoute(),
  'salt-reserves':           () => SaltMerchant.purchaseSaltReserves(),
  'salt-away':               () => SaltMerchant.sendSaltMerchantAway(),

  'puppet-pageant':          () => Puppeteer.commissionImperialPageant(),
  'puppet-show':             () => Puppeteer.hostVillagePerformance(),
  'puppet-away':             () => Puppeteer.sendPuppeteerAway(),

  'rune-inscribe':           () => RuneCarver.commissionRunicInscriptions(),
  'rune-lore':               () => RuneCarver.learnRuneLore(),
  'rune-away':               () => RuneCarver.sendRuneCarverAway(),

  'cartwright-commission':   () => Cartwright.commissionTradeWagons(),
  'cartwright-learn':        () => Cartwright.learnWheelMakingCraft(),
  'cartwright-away':         () => Cartwright.sendCartwrightAway(),

  'farrier-commission':      () => Farrier.commissionCavalryHorseshoes(),
  'farrier-purchase':        () => Farrier.purchaseFarrierysSecrets(),
  'farrier-away':            () => Farrier.sendFarrierAway(),

  'cobbler-commission':      () => Cobbler.craftImperialFootwear(),
  'cobbler-learn':           () => Cobbler.shareCobblingCraft(),
  'cobbler-away':            () => Cobbler.sendCobblerAway(),

  'engraver-commission':     () => Engraver.commissionCoinEngravings(),
  'engraver-purchase':       () => Engraver.purchaseEngravingSecrets(),
  'engraver-away':           () => Engraver.sendEngraverAway(),

  'tailor-sew':              () => Tailor.sewImperialGarments(),
  'tailor-purchase':         () => Tailor.purchaseTailoringCraft(),
  'tailor-away':             () => Tailor.sendTailorAway(),

  'tinsmith-commission':     () => Tinsmith.commissionTinVessels(),
  'tinsmith-purchase':       () => Tinsmith.purchaseTinsmithingCraft(),
  'tinsmith-away':           () => Tinsmith.sendTinsmithAway(),

  'miller-commission':       () => Miller.commissionGrainMilling(),
  'miller-purchase':         () => Miller.purchaseMillingSecrets(),
  'miller-away':             () => Miller.sendMillerAway(),

  'courier-establish':       () => Courier.establishPostalRoutes(),
  'courier-exchange':        () => Courier.exchangeIntelligencePackets(),
  'courier-away':            () => Courier.sendCourierAway(),

  'baker-bake':              () => Baker.bakeImperialBread(),
  'baker-share':             () => Baker.shareBakingSecrets(),
  'baker-away':              () => Baker.sendBakerAway(),

  'armorer-forge':           () => Armorer.forgeImperialArmor(),
  'armorer-tech':            () => Armorer.shareArmorTechniques(),
  'armorer-away':            () => Armorer.sendArmorerAway(),

  'woodcarver-commission':   () => WoodCarver.commissionDecorativeCarvings(),
  'woodcarver-purchase':     () => WoodCarver.purchaseCarvingTemplates(),
  'woodcarver-away':         () => WoodCarver.sendWoodCarverAway(),

  'roadbuilder-build':       () => RoadBuilder.commissionImperialRoads(),
  'roadbuilder-exchange':    () => RoadBuilder.exchangeRoadMaps(),
  'roadbuilder-away':        () => RoadBuilder.sendRoadBuilderAway(),

  'embroiderer-embroider':   () => Embroiderer.embroiderImperialBanners(),
  'embroiderer-purchase':    () => Embroiderer.purchaseNeedleworkPatterns(),
  'embroiderer-away':        () => Embroiderer.sendEmbroidererAway(),

  'bookbinder-commission':   () => Bookbinder.commissionIlluminatedBinding(),
  'bookbinder-purchase':     () => Bookbinder.purchaseBindingMaterials(),
  'bookbinder-away':         () => Bookbinder.sendBookbinderAway(),

  'basketweaver-weave':      () => Basketweaver.weaveImperialBaskets(),
  'basketweaver-purchase':   () => Basketweaver.purchaseWeavingPatterns(),
  'basketweaver-away':       () => Basketweaver.sendBasketweaverAway(),

  'charcoal-commission':     () => CharcoalMaker.commissionCharcoalWorks(),
  'charcoal-purchase':       () => CharcoalMaker.purchaseCharBurningLore(),
  'charcoal-away':           () => CharcoalMaker.sendCharcoalMakerAway(),

  'tanner-commission':       () => Tanner.commissionLeatherworks(),
  'tanner-purchase':         () => Tanner.purchaseTanningSecrets(),
  'tanner-away':             () => Tanner.sendTannerAway(),

  'glassmaker-commission':   () => IGlassmaker.commissionCrystalWorkshop(),
  'glassmaker-purchase':     () => IGlassmaker.purchaseGlassFormulas(),
  'glassmaker-away':         () => IGlassmaker.sendGlassMakerAway(),

  'inkmaker-commission':     () => Inkmaker.commissionIlluminatedScripts(),
  'inkmaker-purchase':       () => Inkmaker.purchaseInkFormulas(),
  'inkmaker-away':           () => Inkmaker.sendInkmakerAway(),

  'dockmaster-establish':    () => Dockmaster.establishTradingDocks(),
  'dockmaster-commission':   () => Dockmaster.commissionHarborWorks(),
  'dockmaster-away':         () => Dockmaster.sendDockmasterAway(),

  'storyteller-chronicle':   () => Storyteller.commissionEpicChronicle(),
  'storyteller-listen':      () => Storyteller.listenToAncientTales(),
  'storyteller-away':        () => Storyteller.sendStorytellerAway(),

  'loremaster-codex':        () => LoreMaster.commissionImperialCodexCollection(),
  'loremaster-scrolls':      () => LoreMaster.purchaseAncientLoreScrolls(),
  'loremaster-away':         () => LoreMaster.sendLoreMasterAway(),
  'toymaker-toys':           () => Toymaker.commissionRoyalToys(),
  'toymaker-patterns':       () => Toymaker.shareCraftingPatterns(),
  'toymaker-away':           () => Toymaker.sendToymakerAway(),
  'ferryman-routes':         () => Ferryman.establishFerryRoutes(),
  'ferryman-charts':         () => Ferryman.purchaseRiverCharts(),
  'ferryman-away':           () => Ferryman.sendFerrymanAway(),
  'mosaic-commission':       () => MosaicMaker.commissionImperialMosaic(),
  'mosaic-exchange':         () => MosaicMaker.exchangePatternLore(),
  'mosaic-away':             () => MosaicMaker.sendMosaicMakerAway(),
  'bathhouse-construct':     () => BHBuilder.constructBathhouseComplex(),
  'bathhouse-plans':         () => BHBuilder.shareEngineeringPlans(),
  'bathhouse-away':          () => BHBuilder.sendBathhouseBuilderAway(),

  'bellfdr-bells':           () => BellFounder.commissionTempleBells(),
  'bellfdr-secrets':         () => BellFounder.purchaseBellCastingSecrets(),
  'bellfdr-away':            () => BellFounder.sendBellFounderAway(),

  'marble-commission':       () => MarbleCutter.commissionMarbleColumns(),
  'marble-exchange':         () => MarbleCutter.exchangeCuttingTechniques(),
  'marble-away':             () => MarbleCutter.sendMarbleCutterAway(),

  'parchment-commission':    () => ParchmentMaker.commissionRoyalParchments(),
  'parchment-purchase':      () => ParchmentMaker.purchaseWritingMaterials(),
  'parchment-away':          () => ParchmentMaker.sendParchmentMakerAway(),

  'incense-prepare':         () => IncenseMaker.prepareSacredIncense(),
  'incense-purchase':        () => IncenseMaker.purchaseAromaticBlends(),
  'incense-away':            () => IncenseMaker.sendIncenseMakerAway(),

  'furrier-commission':      () => Furrier.commissionRoyalPeltWorks(),
  'furrier-purchase':        () => Furrier.purchasePeltCollection(),
  'furrier-away':            () => Furrier.sendFurrierAway(),

  'wool-trade':              () => WoolMerchant.tradeWoolSupplies(),
  'wool-purchase':           () => WoolMerchant.purchaseWoolGoods(),
  'wool-away':               () => WoolMerchant.sendWoolMerchantAway(),

  'horse-purchase':          () => HorseTrader.purchasePrizeStallions(),
  'horse-trade':             () => HorseTrader.tradeSaddleEquipment(),
  'horse-away':              () => HorseTrader.sendHorseTraderAway(),

  'silk-commission':         () => SilkWeaver.commissionSilkTapestries(),
  'silk-purchase':           () => SilkWeaver.purchaseSilkBolts(),
  'silk-away':               () => SilkWeaver.sendSilkWeaverAway(),

  'gem-trade':               () => GemMerchant.tradeGemConsignment(),
  'gem-purchase':            () => GemMerchant.purchaseGemCollection(),
  'gem-away':                () => GemMerchant.sendGemMerchantAway(),

  'siege-commission':        () => SiegeMaster.commissionWarEngines(),
  'siege-purchase':          () => SiegeMaster.purchaseSiegePlans(),
  'siege-away':              () => SiegeMaster.sendSiegeMasterAway(),

  'hatmaker-commission':     () => HatMaker.commissionRoyalHeadwear(),
  'hatmaker-purchase':       () => HatMaker.purchaseHatMakingCraft(),
  'hatmaker-away':           () => HatMaker.sendHatMakerAway(),

  'goldsmith-commission':    () => Goldsmith.commissionGoldenRegalia(),
  'goldsmith-purchase':      () => Goldsmith.purchaseGoldCraftingSecrets(),
  'goldsmith-away':          () => Goldsmith.sendGoldsmithAway(),

  'oilmerchant-purchase':    () => OilMerchant.purchaseOliveOilReserves(),
  'oilmerchant-trade':       () => OilMerchant.tradeOilLampSupplies(),
  'oilmerchant-away':        () => OilMerchant.sendOilMerchantAway(),

  'quarryman-commission':    () => Quarryman.commissionStoneWorks(),
  'quarryman-exchange':      () => Quarryman.exchangeQuarryingTechniques(),
  'quarryman-away':          () => Quarryman.sendQuarrymanAway(),

  'soapmaker-commission':    () => SoapMaker.commissionSoapWorks(),
  'soapmaker-purchase':      () => SoapMaker.purchaseAromaticSoaps(),
  'soapmaker-away':          () => SoapMaker.sendSoapMakerAway(),

  'metalcaster-commission':  () => Metalcaster.commissionMetalSculptures(),
  'metalcaster-purchase':    () => Metalcaster.purchaseCastMetalGoods(),
  'metalcaster-away':        () => Metalcaster.sendMetalcasterAway(),

  'glovemaker-craft':        () => GloveMaker.craftRidingGloves(),
  'glovemaker-purchase':     () => GloveMaker.purchaseLeatherGloves(),
  'glovemaker-away':         () => GloveMaker.sendGloveMakerAway(),

  'telescope-commission':    () => TelescopeMkr.commissionNavalTelescope(),
  'telescope-purchase':      () => TelescopeMkr.purchaseCelestialLens(),
  'telescope-away':          () => TelescopeMkr.sendTelescopeMakerAway(),

  'papermaker-commission':   () => PaperMaker.commissionIlluminatedSheets(),
  'papermaker-purchase':     () => PaperMaker.purchaseFinePaper(),
  'papermaker-away':         () => PaperMaker.sendPaperMakerAway(),

  'coinminter-commission':   () => CoinMinter.commissionGoldenCoins(),
  'coinminter-purchase':     () => CoinMinter.purchaseMintingSecrets(),
  'coinminter-away':         () => CoinMinter.sendCoinMinterAway(),

  'cartguild-survey':    () => CartGuild.commissionRegionalSurvey(),
  'cartguild-purchase':  () => CartGuild.purchaseSurveyingInstruments(),
  'cartguild-away':      () => CartGuild.sendCartographerGuildAway(),

  'spymaster-network':   () => Spymaster.commissionIntelligenceNetwork(),
  'spymaster-cipher':    () => Spymaster.purchaseCipherCodes(),
  'spymaster-away':      () => Spymaster.sendSpymasterAway(),

  'gempolisher-commission': () => GemPolisher.commissionRoyalGemCollection(),
  'gempolisher-purchase':   () => GemPolisher.purchasePolishingTechniques(),
  'gempolisher-away':       () => GemPolisher.sendGemPolisherAway(),

  'astrolabe-commission': () => AstrolabeMkr.commissionNavigationAstrolabe(),
  'astrolabe-purchase':   () => AstrolabeMkr.purchaseCelestialCharts(),
  'astrolabe-away':       () => AstrolabeMkr.sendAstrolabeMakerAway(),

  'locksmith-forge':  () => Locksmith.craftImperialVaultLocks(),
  'locksmith-share':  () => Locksmith.shareLockMakingCraft(),
  'locksmith-away':   () => Locksmith.sendLocksmithAway(),

  'calligrapher-commission': () => Calligrapher.commissionImperialDecrees(),
  'calligrapher-purchase':   () => Calligrapher.purchaseScriptCollection(),
  'calligrapher-away':       () => Calligrapher.sendCalligrapherAway(),

  'coppersmith-commission': () => Coppersmith.commissionCopperTools(),
  'coppersmith-purchase':   () => Coppersmith.purchaseCoppersmithSecrets(),
  'coppersmith-away':       () => Coppersmith.sendCoppersmithAway(),

  'scrivener-commission': () => Scrivener.commissionRoyalScrolls(),
  'scrivener-purchase':   () => Scrivener.purchaseScrivenersCompendium(),
  'scrivener-away':       () => Scrivener.sendScrivenerAway(),

  'mirror-commission': () => MirrorMaker.commissionPolishedMirrors(),
  'mirror-purchase':   () => MirrorMaker.purchaseMirrorMakingCraft(),
  'mirror-away':       () => MirrorMaker.sendMirrorMakerAway(),

  'flower-arrange':  () => FlowerMerchant.arrangeImperialGardens(),
  'flower-purchase': () => FlowerMerchant.purchaseSeasonalBlooms(),
  'flower-away':     () => FlowerMerchant.sendFlowerMerchantAway(),

  'dress-sew':      () => Dressmaker.sewImperialGowns(),
  'dress-purchase': () => Dressmaker.purchaseDressmakingPatterns(),
  'dress-away':     () => Dressmaker.sendDressmakertAway(),

  'tileset-commission': () => TileSetter.commissionImperialTilework(),
  'tileset-purchase':   () => TileSetter.purchaseTilePatterns(),
  'tileset-away':       () => TileSetter.sendTileSetterAway(),

  'banner-weave':    () => BannerWeaver.weaveImperialBattleBanners(),
  'banner-purchase': () => BannerWeaver.purchaseHeraldicPatterns(),
  'banner-away':     () => BannerWeaver.sendBannerWeaverAway(),

  'bone-commission': () => BoneCarver.commissionAncestralCarvings(),
  'bone-purchase':   () => BoneCarver.purchaseCarvedArtifacts(),
  'bone-away':       () => BoneCarver.sendBoneCarverAway(),

  'tapestry-commission': () => TapestryMaker.commissionImperialTapestry(),
  'tapestry-purchase':   () => TapestryMaker.purchaseTapestryPatterns(),
  'tapestry-away':       () => TapestryMaker.sendTapestryMakerAway(),

  'sarch-commission': () => SiegeArchitect.commissionSiegeTowers(),
  'sarch-study':      () => SiegeArchitect.studyFortificationDesigns(),
  'sarch-away':       () => SiegeArchitect.sendSiegeArchitectAway(),

  'lute-commission': () => LuteMaker.commissionCourtLutes(),
  'lute-purchase':   () => LuteMaker.purchaseInstrumentPatterns(),
  'lute-away':       () => LuteMaker.sendLuteMakerAway(),

  'scguild-commission': () => SCGuild.commissionGrandStoneworks(),
  'scguild-purchase':   () => SCGuild.purchaseStonecuttingLore(),
  'scguild-away':       () => SCGuild.sendStonecutterGuildAway(),

  'candlemaker-commission': () => Candlemaker.commissionRoyalCandles(),
  'candlemaker-purchase':   () => Candlemaker.purchaseWaxFormulas(),
  'candlemaker-away':       () => Candlemaker.sendCandlemakerAway(),

  'grain-establish': () => GrainMerchant.establishGrainStores(),
  'grain-purchase':  () => GrainMerchant.purchaseMillingRights(),
  'grain-away':      () => GrainMerchant.sendGrainMerchantAway(),

  'feltmaker-commission': () => FeltMaker.commissionFeltCarpets(),
  'feltmaker-purchase':   () => FeltMaker.purchaseFeltingTechniques(),
  'feltmaker-away':       () => FeltMaker.sendFeltMakerAway(),

  'vineyard-commission': () => VineyardMaster.commissionWineCellar(),
  'vineyard-purchase':   () => VineyardMaster.purchaseVineyardSecrets(),
  'vineyard-away':       () => VineyardMaster.sendVineyardMasterAway(),

  'herbmerchant-commission': () => HerbMerchant.commissionHerbalRemedies(),
  'herbmerchant-purchase':   () => HerbMerchant.purchaseHerbLore(),
  'herbmerchant-away':       () => HerbMerchant.sendHerbMerchantAway(),

  'lantern-commission': () => LanternMaker.commissionFestivalLanterns(),
  'lantern-purchase':   () => LanternMaker.purchaseLanternCraft(),
  'lantern-away':       () => LanternMaker.sendLanternMakerAway(),

  'inkmaster-commission': () => InkMaster.commissionImperialScrollwork(),
  'inkmaster-purchase':   () => InkMaster.purchaseRareInkFormulas(),
  'inkmaster-away':       () => InkMaster.sendInkMasterAway(),

  'saltmerchant-commission': () => SaltMerchant.establishSaltStores(),
  'saltmerchant-purchase':   () => SaltMerchant.purchaseSaltReserves(),
  'saltmerchant-away':       () => SaltMerchant.sendSaltMerchantAway(),

  'bronzesmith-commission': () => BronzeSmith.commissionImperialBronzeWorks(),
  'bronzesmith-purchase':   () => BronzeSmith.purchaseAlloyTechniques(),
  'bronzesmith-away':       () => BronzeSmith.sendBronzeSmithAway(),

  'aqueduct-commission': () => AqueductBld.commissionGrandAqueduct(),
  'aqueduct-study':      () => AqueductBld.studyHydraulicEngineering(),
  'aqueduct-away':       () => AqueductBld.sendAqueductBuilderAway(),

  'glasspainter-commission': () => GlassPainter.commissionStainedGlassWindows(),
  'glasspainter-purchase':   () => GlassPainter.purchasePaintingTechniques(),
  'glasspainter-away':       () => GlassPainter.sendGlassPainterAway(),

  'catapulteng-commission': () => CatapultEng.commissionWarMachines(),
  'catapulteng-study':      () => CatapultEng.studyTorsionPhysics(),
  'catapulteng-away':       () => CatapultEng.sendSiegeCatapultEngineerAway(),

  'woolspinner-commission': () => WoolSpinner.commissionRoyalWoolCloth(),
  'woolspinner-purchase':   () => WoolSpinner.purchaseSpinningTechniques(),
  'woolspinner-away':       () => WoolSpinner.sendWoolSpinnerAway(),

  'ambermerchant-arrange':  () => AmberMerchant.arrangeBalticAmberTrade(),
  'ambermerchant-purchase': () => AmberMerchant.purchaseAmberSpecimens(),
  'ambermerchant-away':     () => AmberMerchant.sendAmberMerchantAway(),

  'sandglass-commission': () => SandglassMaker.commissionImperialHourglasses(),
  'sandglass-purchase':   () => SandglassMaker.purchaseGlassSandLore(),
  'sandglass-away':       () => SandglassMaker.sendSandglassMakerAway(),

  'bridgebld-commission': () => BridgeBuilder.commissionImperialBridges(),
  'bridgebld-study':      () => BridgeBuilder.studyBridgeEngineering(),
  'bridgebld-away':       () => BridgeBuilder.sendBridgeBuilderAway(),

  'chronicler-commission': () => Chronicler.commissionImperialChronicle(),
  'chronicler-purchase':   () => Chronicler.purchaseHistoricalCompendium(),
  'chronicler-away':       () => Chronicler.sendChroniclerAway(),

  'surveyor-commission': () => ImperialSurveyor.commissionLandSurvey(),
  'surveyor-study':      () => ImperialSurveyor.studySurveyMethods(),
  'surveyor-away':       () => ImperialSurveyor.sendSurveyorAway(),

  'taprest-commission': () => TapestryRestorer.commissionTapestryRestoration(),
  'taprest-learn':      () => TapestryRestorer.learnRestorationArts(),
  'taprest-away':       () => TapestryRestorer.sendTapestryRestorerAway(),

  'harbormaster-commission': () => HarborMaster.commissionHarborWorks(),
  'harbormaster-study':      () => HarborMaster.studyMaritimeLaw(),
  'harbormaster-away':       () => HarborMaster.sendHarborMasterAway(),

  'bowmaker-commission': () => BowMaker.commissionImperialLongbows(),
  'bowmaker-purchase':   () => BowMaker.purchaseBoyerSecrets(),
  'bowmaker-away':       () => BowMaker.sendBowMakerAway(),

  'cheesemerchant-establish': () => CheeseMerchant.establishImperialDairy(),
  'cheesemerchant-purchase':  () => CheeseMerchant.purchaseAgedVarieties(),
  'cheesemerchant-away':      () => CheeseMerchant.sendCheeseMerchantAway(),

  'thatcher-thatch':   () => Thatcher.thatchImperialHalls(),
  'thatcher-purchase': () => Thatcher.purchaseThatchingCraft(),
  'thatcher-away':     () => Thatcher.sendThatcherAway(),

  'millstone-commission': () => MillstoneCutter.commissionGrindingMillstones(),
  'millstone-purchase':   () => MillstoneCutter.purchaseMillingDesigns(),
  'millstone-away':       () => MillstoneCutter.sendMillstoneCutterAway(),

  'peatcutter-commission': () => PeatCutter.commissionPeatHearths(),
  'peatcutter-purchase':   () => PeatCutter.purchasePeatCuttingLore(),
  'peatcutter-away':       () => PeatCutter.sendPeatCutterAway(),

  'iconpainter-commission': () => IconPainter.commissionSacredIcons(),
  'iconpainter-purchase':   () => IconPainter.purchaseGildedIconography(),
  'iconpainter-away':       () => IconPainter.sendIconPainterAway(),

  'waxtablet-commission': () => WaxTabletMaker.commissionImperialWaxRecords(),
  'waxtablet-purchase':   () => WaxTabletMaker.purchaseWaxTabletLore(),
  'waxtablet-away':       () => WaxTabletMaker.sendWaxTabletMakerAway(),

  'netmaker-commission': () => NetMaker.commissionImperialFishingNets(),
  'netmaker-purchase':   () => NetMaker.purchaseNetMakingSecrets(),
  'netmaker-away':       () => NetMaker.sendNetMakerAway(),
  'drummaker-commission': () => DrumMaker.commissionCeremonialDrums(),
  'drummaker-purchase':   () => DrumMaker.purchaseDrumMakingCraft(),
  'drummaker-away':       () => DrumMaker.sendDrumMakerAway(),
  'herbarium-commission': () => HerbariumKeeper.commissionHerbalCompendium(),
  'herbarium-purchase':   () => HerbariumKeeper.purchaseMedicinalPlants(),
  'herbarium-away':       () => HerbariumKeeper.sendHerbariumKeeperAway(),

  'spearmaker-commission': () => SpearMaker.commissionHuntingSpears(),
  'spearmaker-purchase':   () => SpearMaker.purchaseSpearCraftingLore(),
  'spearmaker-away':       () => SpearMaker.sendSpearMakerAway(),

  'robemaker-commission': () => RobeMaker.commissionImperialRobes(),
  'robemaker-purchase':   () => RobeMaker.purchaseFineFabrics(),
  'robemaker-away':       () => RobeMaker.sendRobeMakerAway(),

  'fletcher-commission':  () => Fletcher.commissionArrowBundles(),
  'fletcher-purchase':    () => Fletcher.purchaseFletchingCraft(),
  'fletcher-away':        () => Fletcher.sendFletcherAway(),

  'knifesmith-commission': () => Knifesmith.commissionBladeCollection(),
  'knifesmith-purchase':   () => Knifesmith.purchaseBladeCraft(),
  'knifesmith-away':       () => Knifesmith.sendKnifesmithAway(),

  'sailmaker-commission':  () => SailMaker.commissionSailingCanvas(),
  'sailmaker-purchase':    () => SailMaker.purchaseSailMakingLore(),
  'sailmaker-away':        () => SailMaker.sendSailMakerAway(),

  'chariotbld-commission': () => ChariotBuilder.commissionWarChariots(),
  'chariotbld-purchase':   () => ChariotBuilder.purchaseChariotDesigns(),
  'chariotbld-away':       () => ChariotBuilder.sendChariotBuilderAway(),

  'seedmerchant-purchase': () => SeedMerchant.purchaseRareSeeds(),
  'seedmerchant-exchange': () => SeedMerchant.exchangeCropLore(),
  'seedmerchant-away':     () => SeedMerchant.sendSeedMerchantAway(),

  'silkpaint-commission':  () => SilkPainter.commissionPaintedScreenPanels(),
  'silkpaint-purchase':    () => SilkPainter.purchasePaintingPigmentFormulas(),
  'silkpaint-away':        () => SilkPainter.sendSilkscreenPainterAway(),

  'woodcutter-commission': () => Woodcutter.commissionFirewoodBundles(),
  'woodcutter-purchase':   () => Woodcutter.purchaseForestManagementLore(),
  'woodcutter-away':       () => Woodcutter.sendWoodcutterAway(),

  'masonsguild-commission': () => MasonsGuild.commissionStoneMasonryWorks(),
  'masonsguild-purchase':   () => MasonsGuild.purchaseGuildMasonrySecrets(),
  'masonsguild-away':       () => MasonsGuild.sendMasonsGuildAway(),
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
    Events.WANDERING_NAVIGATOR_CHANGED,
    Events.TRAVELING_ILLUMINATOR_CHANGED,
    Events.ANCIENT_RITUAL_LEADER_CHANGED,
    Events.MOUNTAIN_PROSPECTOR_CHANGED,
    Events.WANDERING_LEATHERWORKER_CHANGED,
    Events.ROYAL_APOTHECARY_CHANGED,
    Events.WANDERING_FISHMONGER_CHANGED,
    Events.IMPERIAL_CHANDLER_CHANGED,
    Events.ROYAL_LAMPLIGHTER_CHANGED,
    Events.WANDERING_COOPER_CHANGED,
    Events.WANDERING_ROPE_MAKER_CHANGED,
    Events.IMPERIAL_SALT_MERCHANT_CHANGED,
    Events.WANDERING_PUPPETEER_CHANGED,
    Events.ANCIENT_RUNE_CARVER_CHANGED,
    Events.WANDERING_CARTWRIGHT_CHANGED,
    Events.IMPERIAL_FARRIER_CHANGED,
    Events.WANDERING_COBBLER_CHANGED,
    Events.IMPERIAL_ENGRAVER_CHANGED,
    Events.WANDERING_TAILOR_CHANGED,
    Events.WANDERING_TINSMITH_CHANGED,
    Events.WANDERING_MILLER_CHANGED,
    Events.IMPERIAL_COURIER_CHANGED,
    Events.WANDERING_BAKER_CHANGED,
    Events.IMPERIAL_ARMORER_CHANGED,
    Events.WANDERING_WOOD_CARVER_CHANGED,
    Events.IMPERIAL_ROAD_BUILDER_CHANGED,
    Events.WANDERING_EMBROIDERER_CHANGED,
    Events.ROYAL_BOOKBINDER_CHANGED,
    Events.WANDERING_BASKETWEAVER_CHANGED,
    Events.WANDERING_CHARCOAL_MAKER_CHANGED,
    Events.WANDERING_TANNER_CHANGED,
    Events.IMPERIAL_GLASSMAKER_CHANGED,
    Events.WANDERING_INKMAKER_CHANGED,
    Events.IMPERIAL_DOCKMASTER_CHANGED,
    Events.WANDERING_STORYTELLER_CHANGED,
    Events.IMPERIAL_LORE_MASTER_CHANGED,
    Events.WANDERING_TOYMAKER_CHANGED,
    Events.IMPERIAL_FERRYMAN_CHANGED,
    Events.WANDERING_MOSAIC_MAKER_CHANGED,
    Events.IMPERIAL_BATHHOUSE_BUILDER_CHANGED,
    Events.WANDERING_BELL_FOUNDER_CHANGED,
    Events.IMPERIAL_MARBLE_CUTTER_CHANGED,
    Events.WANDERING_PARCHMENT_MAKER_CHANGED,
    Events.WANDERING_INCENSE_MAKER_CHANGED,
    Events.WANDERING_FURRIER_CHANGED,
    Events.IMPERIAL_WOOL_MERCHANT_CHANGED,
    Events.WANDERING_HORSE_TRADER_CHANGED,
    Events.IMPERIAL_SILK_WEAVER_CHANGED,
    Events.WANDERING_GEM_MERCHANT_CHANGED,
    Events.IMPERIAL_SIEGE_MASTER_CHANGED,
    Events.WANDERING_HAT_MAKER_CHANGED,
    Events.IMPERIAL_GOLDSMITH_CHANGED,
    Events.WANDERING_OIL_MERCHANT_CHANGED,
    Events.IMPERIAL_QUARRYMAN_CHANGED,
    Events.WANDERING_SOAP_MAKER_CHANGED,
    Events.IMPERIAL_METALCASTER_CHANGED,
    Events.WANDERING_GLOVE_MAKER_CHANGED,
    Events.IMPERIAL_TELESCOPE_MAKER_CHANGED,
    Events.WANDERING_PAPER_MAKER_CHANGED,
    Events.IMPERIAL_COIN_MINTER_CHANGED,
    Events.WANDERING_CARTOGRAPHER_GUILD_CHANGED,
    Events.IMPERIAL_SPYMASTER_CHANGED,
    Events.WANDERING_GEM_POLISHER_CHANGED,
    Events.IMPERIAL_ASTROLABE_MAKER_CHANGED,
    Events.WANDERING_LOCKSMITH_CHANGED,
    Events.IMPERIAL_CALLIGRAPHER_CHANGED,
    Events.WANDERING_COPPERSMITH_CHANGED,
    Events.IMPERIAL_SCRIVENER_CHANGED,
    Events.WANDERING_MIRROR_MAKER_CHANGED,
    Events.IMPERIAL_FLOWER_MERCHANT_CHANGED,
    Events.WANDERING_DRESSMAKER_CHANGED,
    Events.IMPERIAL_TILE_SETTER_CHANGED,
    Events.IMPERIAL_BANNER_WEAVER_CHANGED,
    Events.WANDERING_BONE_CARVER_CHANGED,
    Events.WANDERING_TAPESTRY_MAKER_CHANGED,
    Events.IMPERIAL_SIEGE_ARCHITECT_CHANGED,
    Events.WANDERING_LUTE_MAKER_CHANGED,
    Events.IMPERIAL_STONECUTTER_GUILD_CHANGED,
    Events.WANDERING_CANDLEMAKER_CHANGED,
    Events.IMPERIAL_GRAIN_MERCHANT_CHANGED,
    Events.WANDERING_FELT_MAKER_CHANGED,
    Events.IMPERIAL_VINEYARD_MASTER_CHANGED,
    Events.WANDERING_HERB_MERCHANT_CHANGED,
    Events.IMPERIAL_LANTERN_MAKER_CHANGED,
    Events.WANDERING_INK_MASTER_CHANGED,
    Events.WANDERING_SALT_MERCHANT_CHANGED,
    Events.WANDERING_BRONZE_SMITH_CHANGED,
    Events.IMPERIAL_AQUEDUCT_BUILDER_CHANGED,
    Events.WANDERING_GLASS_PAINTER_CHANGED,
    Events.IMPERIAL_SIEGE_CATAPULT_ENGINEER_CHANGED,
    Events.WANDERING_WOOL_SPINNER_CHANGED,
    Events.IMPERIAL_AMBER_MERCHANT_CHANGED,
    Events.WANDERING_SANDGLASS_MAKER_CHANGED,
    Events.IMPERIAL_BRIDGE_BUILDER_CHANGED,
    Events.WANDERING_CHRONICLER_CHANGED,
    Events.IMPERIAL_SURVEYOR_CHANGED,
    Events.WANDERING_TAPESTRY_RESTORER_CHANGED,
    Events.IMPERIAL_HARBOR_MASTER_CHANGED,
    Events.WANDERING_BOW_MAKER_CHANGED,
    Events.IMPERIAL_CHEESE_MERCHANT_CHANGED,
    Events.WANDERING_THATCHER_CHANGED,
    Events.IMPERIAL_MILLSTONE_CUTTER_CHANGED,
    Events.WANDERING_PEAT_CUTTER_CHANGED,
    Events.IMPERIAL_ICON_PAINTER_CHANGED,
    Events.WANDERING_WAX_TABLET_MAKER_CHANGED,
    Events.WANDERING_NET_MAKER_CHANGED,
    Events.WANDERING_DRUM_MAKER_CHANGED,
    Events.IMPERIAL_HERBARIUM_KEEPER_CHANGED,
    Events.WANDERING_SPEAR_MAKER_CHANGED,
    Events.IMPERIAL_ROBE_MAKER_CHANGED,
    Events.WANDERING_FLETCHER_CHANGED,
    Events.IMPERIAL_KNIFESMITH_CHANGED,
    Events.WANDERING_SAIL_MAKER_CHANGED,
    Events.IMPERIAL_CHARIOT_BUILDER_CHANGED,
    Events.WANDERING_SEED_MERCHANT_CHANGED,
    Events.IMPERIAL_SILKSCREEN_PAINTER_CHANGED,
    Events.WANDERING_WOODCUTTER_CHANGED,
    Events.IMPERIAL_MASONS_GUILD_CHANGED,
    Events.RESOURCE_CHANGED,
  ];
  for (const ev of ENCOUNTER_EVENTS) on(ev, _render);

  let _ticks = 0;
  on(Events.TICK, () => { if (++_ticks % 4 === 0) _render(); });

  _panel.addEventListener('click', _handleClick);
  _render();
}
