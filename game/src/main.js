/**
 * EmpireOS — Main entry point.
 * Wires together core engine, systems, and UI on DOMContentLoaded.
 */

import { state, initState } from './core/state.js';
import { emit, on, Events } from './core/events.js';
import { registerSystem, startLoop, stopLoop } from './core/tick.js';
import { resourceTick, recalcRates } from './systems/resources.js';
import { researchTick } from './systems/research.js';
import { initMap } from './systems/map.js';
import { initRandomEvents, randomEventTick } from './systems/randomEvents.js';
import { initQuests } from './systems/quests.js';
import { initStory } from './systems/story.js';
import { initDiplomacy, diplomacyTick, MEDIATE_PRESTIGE } from './systems/diplomacy.js';
import { initSeasons, seasonTick, currentSeason, seasonTicksRemaining } from './systems/seasons.js';
import { initVictory, victoryTick } from './systems/victory.js';
import { initMarket, marketTick } from './systems/market.js';
import { initAchievements } from './systems/achievements.js';
import { initEnemyAI, enemyAITick } from './systems/enemyAI.js';
import { initSpells, spellTick } from './systems/spells.js';
import { initBarbarians, barbarianTick, getSiegeSecsLeft, bribeBarbarians, BRIBE_COST } from './systems/barbarianCamps.js';
import { initMorale, moraleTick, changeMorale } from './systems/morale.js';
import { initPopulation, populationTick, happinessTick } from './systems/population.js';
import { initEspionage } from './systems/espionage.js';
import { initChallenges, challengeTick } from './systems/challenges.js';
import { initCaravans, caravanTick } from './systems/caravans.js';
import { initPoliticalEvents, politicalEventTick } from './systems/politicalEvents.js';
import { initMercenaries, mercenaryTick } from './systems/mercenaries.js';
import { initWeather, weatherTick, getCurrentWeather, getWeatherSecsLeft } from './systems/weather.js';
import { initPrestige, awardPrestige, getPrestigeScore } from './systems/prestige.js';
import { initDecrees, decreesTick } from './systems/decrees.js';
import { initContracts, contractsTick } from './systems/contracts.js';
import { initMerchant, merchantTick } from './systems/merchant.js';
import { heroTick }        from './systems/heroSystem.js';
import { initMilitaryAid } from './systems/militaryAid.js';
import { initFestivals, festivalTick } from './systems/festivals.js';
import { initResourceNodes, resourceNodeTick } from './systems/resourceNodes.js';
import { initDuels, duelTick } from './systems/duels.js';                   // T109: warlord duels
import { initPioneers, pioneerTick } from './systems/pioneerExpeditions.js'; // T110: pioneer expeditions
import { initNaturalDisasters, naturalDisasterTick } from './systems/naturalDisasters.js'; // T111
import { initInspiration, inspirationTick } from './systems/researchInspiration.js';       // T116
import { initCrises, crisisTick, getActiveCrisis, resolveCrisis } from './systems/crises.js'; // T117
import { ENSHRINE_PRESTIGE } from './systems/heroSystem.js';                                  // T118
import { SEASONS, SEASON_BUILDING_LABELS, SEASON_UNIT_LABELS, SEASON_COMBAT_BUFF_LABELS } from './data/seasons.js';
import { AGES } from './data/ages.js';
import { BUILDINGS } from './data/buildings.js';
import { TICKS_PER_SECOND } from './core/tick.js';
import { initHUD } from './ui/hud.js';
import { initBuildingPanel } from './ui/buildingPanel.js';
import { initMessageLog } from './ui/messageLog.js';
import { initResearchPanel } from './ui/researchPanel.js';
import { initMilitaryPanel } from './ui/militaryPanel.js';
import { initMapPanel } from './ui/mapPanel.js';
import { initQuestPanel } from './ui/questPanel.js';
import { initStoryPanel } from './ui/storyPanel.js';
import { initSettingsPanel } from './ui/settingsPanel.js';
import { initMarketPanel } from './ui/marketPanel.js';
import { initSaveModal } from './ui/saveModal.js';
import { initGameOverPanel } from './ui/gameOverPanel.js';
import { initDiplomacyPanel } from './ui/diplomacyPanel.js';
import { initTabs, switchTab } from './ui/tabs.js';
import { initToasts } from './ui/toastManager.js';
import { initSummaryPanel } from './ui/summaryPanel.js';
import { showNewGameWizard } from './ui/newGameModal.js';
import { calcOfflineProgress, showOfflineModal } from './ui/offlineModal.js';
import { showCouncilModal } from './ui/councilModal.js';
import { AGE_BOON_POOLS } from './data/ageBoons.js';
import { chooseCouncilBoon } from './core/actions.js';
import { initMinimap, drawMinimap } from './ui/minimap.js';
import { addMessage } from './core/actions.js';
import { calcScore } from './utils/score.js';
import { TITLES, getCurrentTitle } from './data/titles.js';
import { initNotificationCenter } from './ui/notificationCenter.js'; // T123
import { loadLegacy, awardLegacyPoints, LEGACY_TRAITS } from './data/legacyTraits.js'; // T124
import { initAuction, auctionTick } from './systems/auction.js';                       // T126
import { initWonders, wonderTick } from './systems/wonders.js'; // T133
import { initScholars, scholarTick, acceptTeaching, dismissScholar } from './systems/scholars.js'; // T134
import { initBounty, bountyTick } from './systems/bounty.js'; // T135
import { initGreatPersons, greatPersonTick } from './systems/greatPersons.js'; // T136
import { addToBuildQueue, removeFromBuildQueue, BUILD_QUEUE_MAX, buildBuilding } from './core/actions.js'; // T137 (re-import build)
import { initAllianceMissions, allianceMissionTick, checkMissionProgress } from './systems/allianceMissions.js'; // T142
import { initAgeChallenges, ageChallengesTick, startAgeChallenge, getActiveChallengeProgress } from './systems/ageChallenges.js'; // T143
import { initInfluence, influenceTick } from './systems/influence.js'; // T145
import { initDiscoveries } from './systems/discoveries.js'; // T146
import { initRebels, rebelTick } from './systems/rebels.js'; // T151
import { initDynasty, dynastyTick, chooseHeir, HEIR_DEFS, getSuccessionSecsLeft } from './systems/dynasty.js'; // T152
import { initCelestial, celestialTick, getActiveCelestial, getCelestialSecsLeft, getPendingCelestial } from './systems/celestialEvents.js'; // T153
import { initCampaigns, campaignTick } from './systems/campaigns.js'; // T154
import { updateRecords } from './data/lifetimeRecords.js'; // T160
import { initPlague, plagueTick } from './systems/plague.js'; // T161
import { initPilgrimages, pilgrimageTick } from './systems/pilgrimages.js'; // T162
import { initWarlord, warlordTick } from './systems/rovingWarlord.js'; // T165
import { initTributes, tributeTick } from './systems/tributes.js';     // T166
import { initBlackMarket, blackMarketTick } from './systems/blackMarket.js'; // T167
import { initNobleDemands, nobleDemandsTick, satisfyDemand, refuseDemand, getDemandSecsLeft, canSatisfyDemand } from './systems/nobleDemands.js'; // T168
import { onSeasonChanged, getActiveSeasonalObjective } from './systems/seasonalObjectives.js'; // T170
import { initCensus, censusTick } from './systems/imperialCensus.js';                          // T171
import { initVault, vaultTick } from './systems/imperialVault.js';                             // T173
import { initWarExhaustion, warExhaustionTick, getExhaustionLevel, getExhaustionTier, EXHAUSTION_LABELS } from './systems/warExhaustion.js'; // T175
import { initMonument, monumentTick, onMonumentBuilt } from './systems/ancientMonument.js';    // T176
import { initAlmanac } from './ui/almanac.js';                                                 // T177
import { initAudio }   from './utils/audio.js';                                                // T178
import { initCartographer, cartographerTick } from './systems/cartographersGuild.js';          // T179
import { initRelicShrine, relicShrineTick } from './systems/relicShrine.js';                   // T180
import { initSeasonChronicle } from './systems/seasonChronicle.js';                            // T181
import { initFortificationNetwork } from './systems/fortificationNetwork.js';                  // T183
import { initTradeGuildHall, tradeGuildTick } from './systems/tradeGuildHall.js';              // T190
import { initImperialMint } from './systems/imperialMint.js';                                   // T191
import { initEnvoy, envoyTick } from './systems/envoy.js';                                       // T192
import { initOracle, oracleTick } from './systems/oracle.js';                                   // T193
import { initGuilds, guildTick } from './systems/artisanGuilds.js';                             // T194
import { initVizier } from './systems/vizier.js';                                               // T195
import { initTradeFair } from './systems/tradeFair.js';                                         // T196
import { initSeasonPerformance } from './systems/seasonPerformance.js';                          // T197
import { initTradeWinds } from './systems/tradeWinds.js';                                        // T198
import { initTaxCollection } from './systems/imperialTaxCollector.js';                           // T199
import { initWanderingArmy, wanderingArmyTick } from './systems/wanderingArmy.js';               // T200
import { initCouncil, councilTick } from './systems/provinceCouncil.js';                         // T201
import { initEpicQuests, epicQuestsTick } from './systems/epicQuests.js';                        // T202
import { initCorruption, corruptionTick } from './systems/corruptionSystem.js';                  // T203
import { initArena, arenaTick } from './systems/grandArena.js';                                  // T204
import { initBattleStandard } from './systems/battleStandard.js';                                 // T205
import { initGovernors } from './systems/regionalGovernors.js';                                   // T206
import { initScouts } from './systems/scoutMissions.js';                                          // T207
import { initResourcePact } from './systems/resourcePact.js';                                     // T208
import { initSupplyLines } from './systems/supplyLines.js';                                       // T209
import { initReparations } from './systems/warReparations.js';                                    // T210
import { initReputation } from './systems/reputation.js';                                         // T211
import { initCounteroffensive, counteroffensiveTick } from './systems/counteroffensive.js';       // T212
import { initRoyalHunt, huntTick } from './systems/royalHunt.js';                                  // T214
import { initCodex } from './systems/imperialCodex.js';                                            // T215
import { initLegendary, legendaryTick } from './systems/legendaryEncounters.js';                   // T216
import { initRefugees, refugeeTick, acceptRefugees, integrateRefugees, declineRefugees, getRefugeeSecsLeft, INTEGRATE_GOLD, INTEGRATE_FOOD } from './systems/refugeeCrisis.js'; // T217
import { initSilkRoad, silkRoadTick } from './systems/silkRoad.js';                               // T218
import { initPropaganda, propagandaTick } from './systems/propaganda.js';                         // T219
import { initMilitaryIntel, militaryIntelTick } from './systems/militaryIntel.js';                // T220
import { initConstructionDrive, constructionDriveTick } from './systems/constructionDrive.js';     // T221
import { initPeaceOvertures } from './systems/peaceOverture.js';                                   // T222
import { initForecast } from './systems/royalForecast.js';                                         // T225
import { initTrophies } from './systems/warTrophies.js';                                           // T226
import { initAlchemy, alchemyTick } from './systems/alchemy.js';                                   // T227
import { initRationing, rationingTick } from './systems/rationing.js';                             // T228
import { initMilitia, militiaTick } from './systems/militia.js';                                   // T229
import { initAncientPact, ancientPactTick } from './systems/ancientPact.js';                       // T230
import { initLibrary }                      from './systems/library.js';                            // T231
import { initPriceSurge, priceSurgeTick }   from './systems/priceSurge.js';                        // T232
import { initLostExpedition, lostExpeditionTick } from './systems/lostExpedition.js';               // T233
import { initHarvest, harvestTick }         from './systems/harvest.js';                            // T234
import { initCityProsperity, cityProsperityTick } from './systems/cityProsperity.js';               // T235
import { initImperialGames, imperialGamesTick } from './systems/imperialGames.js';                   // T236
import { initRoyalLoan, royalLoanTick }        from './systems/royalLoan.js';                        // T237
import { initAncientVaultCache, ancientVaultCacheTick } from './systems/ancientVaultCache.js';       // T238
import { initRecordsExchange }                          from './systems/recordsExchange.js';           // T239
import { initNomadicTribe, nomadicTribeTick }           from './systems/nomadicTribe.js';              // T240
import { initProphet, prophetTick }                     from './systems/wanderingProphet.js';           // T241
import { initArtisanFair, artisanFairTick }             from './systems/artisanFair.js';                // T242
import { initEpithet }                                  from './systems/epithet.js';                     // T243
import { initCosmicAlignment, cosmicAlignmentTick }     from './systems/cosmicAlignment.js';              // T244

// Leaderboard localStorage key (shared with settingsPanel.js)
const LB_KEY = 'empireos-leaderboard';

// T097: Territorial expansion milestones — one-time rewards on tile-count thresholds
const EXPANSION_MILESTONES = [
  { threshold: 10,  rewards: { gold: 100, food: 50 },               prestige: 25,  title: 'Expanding Borders'   },
  { threshold: 25,  rewards: { gold: 200, wood: 100, stone: 100 },  prestige: 50,  title: 'Growing Empire'      },
  { threshold: 50,  rewards: { gold: 100, iron: 150, mana: 80 },    prestige: 100, title: 'Territorial Power'   },
  { threshold: 75,  rewards: { gold: 300, food: 200 },              prestige: 150, title: 'Continental Force'   },
  { threshold: 100, rewards: { gold: 500, iron: 200, mana: 150 },   prestige: 250, title: 'World Conqueror'     },
];

// Offline progress calculated during _applySave(); shown after UI is ready
let _pendingOffline = null;

// ── Boot sequence ─────────────────────────────────────────────────────

function boot() {
  // Check for a saved game first
  const saved = _loadSave();
  if (saved) {
    _applySave(saved);
    // Generate fresh map if save predates map system
    if (!state.map) initMap();
    emit(Events.GAME_LOADED, {});
  } else {
    initState('My Empire');
    _applyDifficultyStart();
    _applyLegacyBonuses(); // T124: apply purchased legacy traits
    initMap();
    addMessage('Welcome to EmpireOS. Build your empire!', 'info');
    addMessage('Start by constructing Farms and Lumber Mills.', 'info');
    addMessage('Train soldiers and open the Map tab to expand your territory!', 'info');
  }

  // Register tick systems (order matters)
  registerSystem(resourceTick);
  registerSystem(researchTick);
  registerSystem(randomEventTick);
  registerSystem(diplomacyTick);
  registerSystem(seasonTick);
  registerSystem(victoryTick);
  registerSystem(marketTick);
  registerSystem(enemyAITick);
  registerSystem(spellTick);
  registerSystem(barbarianTick);
  registerSystem(moraleTick);
  registerSystem(populationTick);
  registerSystem(happinessTick);     // T140: population happiness
  registerSystem(challengeTick);
  registerSystem(caravanTick);
  registerSystem(politicalEventTick);
  registerSystem(mercenaryTick);
  registerSystem(weatherTick);
  registerSystem(decreesTick);
  registerSystem(contractsTick);  // T085: delivery contracts
  registerSystem(heroTick);        // T086: hero expedition tick
  registerSystem(merchantTick);    // T087: wandering merchant
  registerSystem(festivalTick);    // T103: festival expiry
  registerSystem(resourceNodeTick); // T104: resource node spawn/expire
  registerSystem(duelTick);         // T109: warlord duel challenge spawn/expire
  registerSystem(pioneerTick);      // T110: pioneer expedition completion
  registerSystem(naturalDisasterTick); // T111
  registerSystem(inspirationTick);     // T116: research inspiration events
  registerSystem(crisisTick);          // T117: empire crisis response
  registerSystem(auctionTick);         // T126: resource auction house
  registerSystem(wonderTick);          // T133: wonder project build timer
  registerSystem(scholarTick);         // T134: wandering scholar events
  registerSystem(bountyTick);          // T135: territory bounty system
  registerSystem(greatPersonTick);     // T136: great person system
  registerSystem(allianceMissionTick); // T142
  registerSystem(ageChallengesTick);  // T143
  registerSystem(influenceTick);      // T145: cultural influence expansion: age milestone challenges
  registerSystem(rebelTick);          // T151: rebel uprising system
  registerSystem(dynastyTick);        // T152: dynastic succession system
  registerSystem(celestialTick);      // T153: celestial events system
  registerSystem(campaignTick);       // T154: conquest campaign system
  registerSystem(plagueTick);         // T161: plague outbreak system
  registerSystem(pilgrimageTick);     // T162: pilgrimage system
  registerSystem(warlordTick);        // T165: roving warlord
  registerSystem(tributeTick);        // T166: tribute demand
  registerSystem(blackMarketTick);   // T167: black market
  registerSystem(nobleDemandsTick);  // T168: noble council demands
  registerSystem(censusTick);        // T171: imperial census
  registerSystem(vaultTick);         // T173: imperial vault
  registerSystem(warExhaustionTick);  // T175: war exhaustion decay
  registerSystem(monumentTick);       // T176: ancient monument dedication
  registerSystem(cartographerTick);   // T179: cartographer's guild passive reveal
  registerSystem(relicShrineTick);    // T180: relic shrine passive prestige
  registerSystem(tradeGuildTick);     // T190: trade guild boost expiry
  registerSystem(envoyTick);          // T192: diplomatic envoy arrival check
  registerSystem(oracleTick);         // T193: oracle omen lifecycle
  registerSystem(guildTick);          // T194: artisan guild expiry check
  registerSystem(wanderingArmyTick);  // T200: wandering army spawn/expire
  registerSystem(councilTick);        // T201: province council session check
  registerSystem(epicQuestsTick);     // T202: epic quest chain progress check
  registerSystem(corruptionTick);     // T203: corruption growth check
  registerSystem(arenaTick);          // T204: grand arena event spawn/expire
  registerSystem(counteroffensiveTick); // T212: prune expired counteroffensives
  registerSystem(huntTick);             // T214: royal hunt spawn/resolve
  registerSystem(legendaryTick);        // T216: legendary encounter spawn/expiry
  registerSystem(refugeeTick);          // T217: refugee crisis spawn/expiry
  registerSystem(silkRoadTick);         // T218: silk road window lifecycle
  registerSystem(propagandaTick);       // T219: propaganda campaign expiry
  registerSystem(militaryIntelTick);    // T220: military intelligence report generation
  registerSystem(constructionDriveTick); // T221: construction drive expiry check
  registerSystem(alchemyTick);           // T227: alchemy offer spawn/accept/expire
  registerSystem(rationingTick);         // T228: rationing expiry + morale drain
  registerSystem(militiaTick);           // T229: militia expiry check
  registerSystem(ancientPactTick);       // T230: ancient pact tier advancement
  registerSystem(priceSurgeTick);        // T232: market price surge spawn/expiry
  registerSystem(lostExpeditionTick);    // T233: lost expedition spawn/rescue/expiry
  registerSystem(harvestTick);           // T234: seasonal harvest window
  registerSystem(cityProsperityTick);   // T235: city prosperity windfall
  registerSystem(imperialGamesTick);    // T236: imperial games expiry check
  registerSystem(royalLoanTick);       // T237: royal loan repayment check
  registerSystem(ancientVaultCacheTick); // T238: vault cache spawn/expiry
  registerSystem(nomadicTribeTick);      // T240: nomadic tribe encounter spawn/expiry
  registerSystem(prophetTick);           // T241: wandering prophet spawn/expiry
  registerSystem(artisanFairTick);       // T242: artisan fair spawn/expiry
  registerSystem(cosmicAlignmentTick);   // T244: cosmic alignment spawn/expiry

  // Init event-driven systems
  initRandomEvents();
  initQuests();
  initStory();
  initDiplomacy();
  initSeasons();
  initVictory();
  initMarket();
  initAchievements();
  initEnemyAI();
  initSpells();
  initBarbarians();
  initMorale();
  initPopulation();
  initEspionage();
  initChallenges();
  initCaravans();
  initPoliticalEvents();
  initMercenaries();
  initWeather();
  initPrestige();
  initDecrees();
  initContracts();    // T085: delivery contracts
  initMerchant();     // T087: wandering merchant
  initMilitaryAid();  // T102: alliance military aid
  initFestivals();    // T103: empire festivals
  initResourceNodes(); // T104: resource nodes
  initDuels();        // T109: warlord duel events
  initPioneers();     // T110: pioneer expeditions
  initNaturalDisasters(); // T111: natural disaster system
  initInspiration();      // T116: research inspiration events
  initCrises();           // T117: empire crisis response
  initAuction();          // T126: resource auction house
  initWonders();          // T133: wonder projects
  initScholars();         // T134: wandering scholar events
  initBounty();           // T135: territory bounty system
  initGreatPersons();     // T136: great person system
  initAllianceMissions(); // T142: alliance missions
  initAgeChallenges();   // T143: age milestone challenges
  initInfluence();       // T145: cultural influence expansion
  initDiscoveries();     // T146: map discoveries
  initRebels();          // T151: rebel uprising system
  initDynasty();         // T152: dynastic succession system
  initCelestial();       // T153: celestial events system
  initCampaigns();       // T154: conquest campaign system
  initPlague();          // T161: plague outbreak system
  initPilgrimages();     // T162: pilgrimage system
  initWarlord();         // T165: roving warlord
  initTributes();        // T166: tribute demand
  initBlackMarket();    // T167: black market
  initNobleDemands();   // T168: noble council demands
  initCensus();         // T171: imperial census
  initVault();          // T173: imperial vault
  initWarExhaustion();  // T175: war exhaustion
  initCartographer();    // T179: cartographer's guild
  initRelicShrine();     // T180: relic shrine
  initSeasonChronicle();       // T181: season chronicle
  initFortificationNetwork();  // T183: fortification network defense bonus
  initTradeGuildHall();        // T190: trade guild hall boost state
  initImperialMint();          // T191: mint seasonal cooldown listener
  initEnvoy();                 // T192: envoy state init
  initOracle();                // T193: oracle omen state init
  initGuilds();                // T194: artisan guilds state init
  initVizier();                // T195: grand vizier state init
  initTradeFair();             // T196: trade fair state init + SEASON_CHANGED listener
  initSeasonPerformance();     // T197: season-end morale/prestige recap (subscribes after chronicle)
  initTradeWinds();            // T198: trade wind events state init + SEASON_CHANGED listener
  initTaxCollection();         // T199: imperial tax collector state init + SEASON_CHANGED listener
  initWanderingArmy();         // T200: wandering army state init
  initCouncil();               // T201: province council state init
  initEpicQuests();            // T202: epic quest chains state init
  initCorruption();            // T203: corruption system state init
  initArena();                 // T204: grand arena state init
  initBattleStandard();        // T205: battle standard state init
  initGovernors();             // T206: regional governors state init
  initScouts();                // T207: scout reconnaissance state init
  initResourcePact();          // T208: resource exchange pact state init + SEASON_CHANGED listener
  initSupplyLines();           // T209: supply lines state init
  initReparations();           // T210: war reparations state init + DIPLOMACY_CHANGED listener
  initReputation();            // T211: reputation system state init
  initCounteroffensive();      // T212: counteroffensive tracking state init
  initRoyalHunt();             // T214: royal hunt state init
  initCodex();               // T215: imperial codex state init
  initLegendary();           // T216: legendary encounters state init
  initRefugees();            // T217: refugee crisis state init
  initSilkRoad();            // T218: silk road state init
  initPropaganda();          // T219: propaganda campaigns state init
  initMilitaryIntel();       // T220: military intelligence state init
  initConstructionDrive();   // T221: construction drive state init
  initPeaceOvertures();      // T222: peace overture state init
  initForecast();            // T225: royal forecast state init + SEASON_CHANGED listener
  initTrophies();            // T226: war trophy state init + victory event listeners
  initAlchemy();             // T227: alchemy workshop state init
  initRationing();           // T228: wartime rationing state init
  initMilitia();             // T229: peasant militia state init
  initAncientPact();         // T230: ancient pact state init
  initLibrary();             // T231: grand library state init + event listeners
  initPriceSurge();          // T232: market price surge state init
  initLostExpedition();      // T233: lost expedition state init
  initHarvest();             // T234: seasonal harvest window state init
  initCityProsperity();      // T235: city prosperity windfall state init
  initImperialGames();       // T236: imperial games state init + SEASON_CHANGED listener
  initRoyalLoan();           // T237: royal loan state init
  initAncientVaultCache();   // T238: ancient vault cache state init
  initRecordsExchange();     // T239: imperial records exchange state init
  initNomadicTribe();        // T240: nomadic tribe encounter state init
  initProphet();             // T241: wandering prophet state init
  initArtisanFair();         // T242: artisan fair state init
  initEpithet();             // T243: subscribe SEASON_CHANGED + initial calculation
  initCosmicAlignment();     // T244: cosmic alignment state init
  // T176: monument init deferred — only activates when building is constructed

  // Init UI
  initHUD();
  initTabs();
  initBuildingPanel();
  initMilitaryPanel();
  initMapPanel();
  initResearchPanel();
  initQuestPanel();
  initStoryPanel();
  initSettingsPanel();
  initMarketPanel();
  initDiplomacyPanel();
  initMessageLog();
  initSaveModal(_applySave);
  initGameOverPanel(_newGame);
  initToasts();
  initSummaryPanel();
  initMinimap();
  initNotificationCenter(); // T123: notification center
  initAlmanac();            // T177: in-game almanac
  initAudio();              // T178: procedural sound effects

  // Show offline progress modal if the player was away when they last saved
  if (_pendingOffline) {
    showOfflineModal(_pendingOffline.elapsed, _pendingOffline.gains);
    _pendingOffline = null;
  }

  // Bind top-level controls
  _bindControls();

  // Track peak territory for leaderboard
  on(Events.MAP_CHANGED, _updatePeakTerritory);

  // T097: award expansion milestones on territory gains
  on(Events.MAP_CHANGED, _checkExpansionMilestones);

  // T108: award exploration milestones when fog of war clears
  on(Events.MAP_CHANGED, _checkExplorationMilestones);

  // T141: award tech milestone rewards when research count increases
  on(Events.TECH_CHANGED, _checkTechMilestones);

  // T142: check alliance mission progress when relevant game events fire
  on(Events.MAP_CHANGED,      () => checkMissionProgress('map'));
  on(Events.RESOURCE_CHANGED, () => checkMissionProgress('resource'));
  on(Events.TECH_CHANGED,     () => checkMissionProgress('tech'));

  // T143: start age challenge when age advances
  on(Events.AGE_CHANGED, (d) => startAgeChallenge(d?.age ?? state.age));

  // T143: age challenge badge — update on challenge events and periodic tick
  _updateAgeChallengeBadge();
  on(Events.AGE_CHALLENGE_CHANGED, _updateAgeChallengeBadge);
  let _acBadgeTick = 0;
  on(Events.TICK, () => { if (++_acBadgeTick % 4 === 0) _updateAgeChallengeBadge(); });

  // T144: emergency council — wire show/hide and modal click
  _updateEmergencyBtn();
  on(Events.CRISIS_SPAWNED,  _updateEmergencyBtn);
  on(Events.CRISIS_RESOLVED, _updateEmergencyBtn);
  on(Events.BARBARIAN_SIEGE, _updateEmergencyBtn);
  on(Events.RESOURCE_CHANGED, _updateEmergencyBtn);
  on(Events.AGE_CHALLENGE_CHANGED, _updateEmergencyBtn);

  // Update weather badge when weather starts/ends; also refresh every 4 ticks for countdown
  _updateWeatherBadge();
  on(Events.WEATHER_CHANGED, _updateWeatherBadge);
  let _weatherBadgeTick = 0;
  on(Events.TICK, () => { if (++_weatherBadgeTick % 4 === 0) _updateWeatherBadge(); });

  // T079: Update siege badge when siege state changes or on tick countdown
  _updateSiegeBadge();
  on(Events.BARBARIAN_SIEGE, _updateSiegeBadge);
  let _siegeBadgeTick = 0;
  on(Events.TICK, () => { if (++_siegeBadgeTick % 4 === 0) _updateSiegeBadge(); });

  // T080: Update prestige badge on changes
  _updatePrestigeBadge();
  on(Events.PRESTIGE_CHANGED, _updatePrestigeBadge);

  // T101: Update streak badge on streak changes
  _updateStreakBadge();
  on(Events.STREAK_CHANGED, _updateStreakBadge);

  // T211: Reputation badge — update on rep changes
  _updateRepBadge();
  on(Events.REPUTATION_CHANGED, _updateRepBadge);

  // T175: Update exhaustion badge on exhaustion changes
  _updateExhaustionBadge();
  on(Events.WAR_EXHAUSTION_CHANGED, _updateExhaustionBadge);

  // T105: Title system — check on territory and age changes
  _lastTitleLevel = getCurrentTitle(state).level;
  _updateTitleBadge();
  on(Events.MAP_CHANGED,  _checkTitle);
  on(Events.AGE_CHANGED,  _checkTitle);
  on(Events.TITLE_EARNED, _updateTitleBadge);

  // T080: Prestige event listeners (registered once — subscriptions persist across new games)
  on(Events.AGE_CHANGED, (d) => {
    const newAge = d?.age ?? 0;
    if (newAge > 0) awardPrestige(100 * newAge, `${AGES[newAge]?.name ?? 'new age'} reached`);
  });
  on(Events.MASTERY_UNLOCKED, () => awardPrestige(100, 'tech mastery completed'));
  on(Events.SYNERGY_UNLOCKED, (d) => awardPrestige(75, `synergy: ${d?.name ?? 'unlocked'}`));
  on(Events.QUEST_COMPLETED,  () => awardPrestige(30, 'quest completed'));
  on(Events.MAP_CHANGED, (d) => { if (d?.outcome === 'win') awardPrestige(5, 'battle victory'); });
  on(Events.BUILDING_CHANGED, (d) => {
    if (d?.id && BUILDINGS[d.id]?.wonder && (state.buildings[d.id] ?? 0) === 1) {
      awardPrestige(200, `${BUILDINGS[d.id].name} wonder constructed`);
    }
    // T176: Ancient Monument — award morale boost on first construction
    if (d?.id === 'ancientMonument' && (state.buildings.ancientMonument ?? 0) === 1) {
      onMonumentBuilt();
      changeMorale(5);
      addMessage('🏛️ Ancient Monument completed! +5 morale. Citizens are inspired by this great edifice.', 'windfall');
      awardPrestige(50, 'ancient monument completed');
    }
  });
  on(Events.DIPLOMACY_CHANGED, (d) => {
    if (d?.relations === 'allied') awardPrestige(50, 'new alliance formed');
  });
  on(Events.MARRIAGE_PROPOSED, () => awardPrestige(150, 'dynastic marriage forged')); // T172
  on(Events.SUMMIT_CALLED,     () => awardPrestige(100, 'diplomatic summit called')); // T174
  on(Events.BORDER_SKIRMISH, (d) => {
    if (d?.type === 'mediated') awardPrestige(MEDIATE_PRESTIGE, 'skirmish mediation');
  });
  on(Events.LANDMARK_CAPTURED, (d) => awardPrestige(150, `landmark captured: ${d?.landmarkId ?? ''}`));
  on(Events.FACTION_CAPITAL_CAPTURED, (d) => awardPrestige(150, `faction capital captured: ${d?.factionId ?? ''}`));
  on(Events.RUIN_EXCAVATED,        () => awardPrestige(80, 'ancient ruin excavated'));
  on(Events.BATTLEFIELD_CAPTURED,  () => awardPrestige(30, 'ancient battlefield captured')); // T156
  on(Events.HERO_QUEST_CHANGED, (d) => {
    if (d?.phase === 3) awardPrestige(200, 'legendary quest completed');  // T112: Supreme Commander unlocked
  });
  on(Events.HERO_ENSHRINED, () => awardPrestige(ENSHRINE_PRESTIGE, 'champion enshrined'));  // T118

  // T117: Crisis banner — update on crisis spawn/resolve and tick countdown
  _updateCrisisBanner();
  on(Events.CRISIS_SPAWNED,  _updateCrisisBanner);
  on(Events.CRISIS_RESOLVED, _updateCrisisBanner);
  let _crisisBadgeTick = 0;
  on(Events.TICK, () => { if (++_crisisBadgeTick % 4 === 0) _updateCrisisBanner(); });

  // T134: Scholar banner — update on scholar arrive/accept/dismiss and tick countdown
  _updateScholarBanner();
  on(Events.SCHOLAR_CHANGED, _updateScholarBanner);
  let _scholarBadgeTick = 0;
  on(Events.TICK, () => { if (++_scholarBadgeTick % 4 === 0) _updateScholarBanner(); });

  // T148: Population growth choice events — show modal when milestone event fires
  on(Events.POPULATION_MILESTONE, (d) => _showPopMilestoneModal(d?.threshold ?? 0));

  // T151: Rebel uprising — re-render map/quest when rebels spawn or are suppressed
  on(Events.REBEL_UPRISING,    () => {});  // toast already emitted by rebels.js
  on(Events.REBELS_SUPPRESSED, () => {});  // toast already emitted by rebels.js

  // T152: Dynastic succession — show modal when succession event fires
  on(Events.SUCCESSION_EVENT, _showSuccessionModal);

  // T153: Celestial events — update banner on warning/active/cleared + tick countdown
  _updateCelestialBanner();
  on(Events.CELESTIAL_WARNING, _updateCelestialBanner);
  on(Events.CELESTIAL_ACTIVE,  _updateCelestialBanner);
  on(Events.CELESTIAL_CLEARED, _updateCelestialBanner);
  let _celestialBadgeTick = 0;
  on(Events.TICK, () => { if (++_celestialBadgeTick % 4 === 0) _updateCelestialBanner(); });

  // T168: Noble demand banner — update on demand events and countdown tick
  _updateNobleBanner();
  on(Events.NOBLE_DEMAND,      _updateNobleBanner);
  on(Events.RESOURCE_CHANGED,  _updateNobleBanner);
  let _nobleBannerTick = 0;
  on(Events.TICK, () => { if (++_nobleBannerTick % 4 === 0) _updateNobleBanner(); });

  // T217: Refugee crisis banner — update on crisis events and countdown tick
  _updateRefugeeBanner();
  on(Events.REFUGEE_CRISIS,    _updateRefugeeBanner);
  on(Events.RESOURCE_CHANGED,  _updateRefugeeBanner);
  let _refugeeBannerTick = 0;
  on(Events.TICK, () => { if (++_refugeeBannerTick % 4 === 0) _updateRefugeeBanner(); });

  // T152: Update succession countdown every tick while pending
  let _successionTickCount = 0;
  on(Events.TICK, () => {
    if (state.dynasty?.pendingSuccession && ++_successionTickCount % TICKS_PER_SECOND === 0) {
      _updateSuccessionCountdown();
    }
  });

  // Update age badge on changes; also show council boon modal on advancement
  _updateAgeBadge();
  on(Events.AGE_CHANGED, (data) => {
    _updateAgeBadge();
    // T072: show council boon picker on Bronze/Iron/Medieval advancement (not Stone = age 0)
    const newAge = data?.age ?? state.age;
    if (newAge > 0) {
      const pool = AGE_BOON_POOLS[newAge];
      if (pool) {
        // Pick 3 random boons from the age pool
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        const offer    = shuffled.slice(0, 3);
        showCouncilModal(newAge, offer, chooseCouncilBoon);
      }
    }
    // T131: clear active proclamation on age advance
    if (state.proclamation?.activeId) {
      state.proclamation.activeId      = null;
      state.proclamation.ageWhenIssued = -1;
      recalcRates();
      addMessage('📜 Age proclamation has expired with the age transition.', 'info');
      emit(Events.PROCLAMATION_ISSUED, { id: null });
    }
  });

  // Update season badge on changes (also on TICK for countdown display)
  _updateSeasonBadge();
  on(Events.SEASON_CHANGED, _updateSeasonBadge);
  // T170: spawn seasonal map objective on season change
  on(Events.SEASON_CHANGED, d => onSeasonChanged(d?.index ?? state.season?.index ?? 0));
  // Refresh season badge every 4 ticks (~1 s) for countdown accuracy
  let _seasonBadgeTick = 0;
  on(Events.TICK, () => { if (++_seasonBadgeTick % 4 === 0) _updateSeasonBadge(); });

  // T137: auto-build queue — fire whenever resources change
  on(Events.RESOURCE_CHANGED, _processAutoQueue);

  // Update score badge on any score-affecting state change
  _updateScoreBadge();
  on(Events.RESOURCE_CHANGED,  _updateScoreBadge);
  on(Events.BUILDING_CHANGED,  _updateScoreBadge);
  on(Events.UNIT_CHANGED,      _updateScoreBadge);
  on(Events.TECH_CHANGED,      _updateScoreBadge);
  on(Events.AGE_CHANGED,       _updateScoreBadge);
  on(Events.MAP_CHANGED,       _updateScoreBadge);
  on(Events.QUEST_COMPLETED,      _updateScoreBadge);
  on(Events.MASTERY_UNLOCKED,     _updateScoreBadge);
  on(Events.PRESTIGE_CHANGED,     _updateScoreBadge);
  on(Events.CAPITAL_PLAN_CHOSEN,  _updateScoreBadge);
  on(Events.GRAND_THEORY_CHOSEN,  _updateScoreBadge);  // T150

  // T160: Update lifetime records whenever the game ends naturally
  on(Events.GAME_OVER, () => updateRecords());

  // Start auto-save every 60 seconds
  setInterval(_save, 60_000);

  // Start the game loop
  startLoop();

  emit(Events.GAME_STARTED, {});
}

// ── Save / Load ─────────────────────────────────────────────────────

function _save() {
  try {
    localStorage.setItem('empireos-save', JSON.stringify({
      version: 89, // T243: empire epithet system; T244: cosmic alignment
      ts: Date.now(),
      state: {
        empire:        state.empire,
        resources:     state.resources,
        rates:         state.rates,
        caps:          state.caps,
        buildings:     state.buildings,
        units:         state.units,
        techs:         state.techs,
        trainingQueue: state.trainingQueue,
        researchQueue: state.researchQueue,
        messages:      state.messages.slice(0, 20),
        map:           state.map,
        age:           state.age,
        randomEvents:  state.randomEvents,
        quests:        state.quests,
        story:         state.story,
        diplomacy:     state.diplomacy,
        season:        state.season,
        hero:          state.hero,
        stats:         state.stats,
        market:        state.market,
        enemyAI:       state.enemyAI,
        unitXP:        state.unitXP,
        unitRanks:     state.unitRanks,
        difficulty:    state.difficulty,
        alerts:        state.alerts ?? {},
        combatHistory: state.combatHistory ?? [],
        formation:     state.formation ?? 'balanced',
        spells:        state.spells,
        barbarians:    state.barbarians,
        morale:        state.morale ?? 50,
        population:    state.population,
        espionage:     state.espionage,
        challenges:    state.challenges,
        caravans:      state.caravans,
        relics:        state.relics,
        archetype:        state.archetype        ?? 'none',
        policy:           state.policy           ?? null,
        policyChangedAt:  state.policyChangedAt  ?? -999,
        garrisons:        state.garrisons        ?? null,
        masteries:        state.masteries        ?? {},
        politicalEvents:  state.politicalEvents  ?? null,
        councilBoons:     state.councilBoons     ?? [],
        mercenaries:      state.mercenaries      ?? null,
        weather:          state.weather          ?? null,
        prestige:         state.prestige         ?? null,
        decrees:          state.decrees          ?? null,
        contracts:        state.contracts        ?? null,  // T085
        merchant:         state.merchant         ?? null,  // T087
        landmarks:        state.landmarks        ?? null,  // T089
        buildingSpecials: state.buildingSpecials ?? {},    // T090
        citizenRoles:        state.citizenRoles        ?? null,  // T096
        rallyState:          state.rallyState          ?? null,  // T098
        expansionMilestones: state.expansionMilestones ?? {},    // T097
        capitalPlan:         state.capitalPlan         ?? null,  // T100
        combatStreak:        state.combatStreak        ?? { count: 0, lastWinTick: 0 }, // T101
        militaryAid:         state.militaryAid         ?? null,  // T102
        festivals:           state.festivals           ?? null,  // T103
        resourceNodes:       state.resourceNodes       ?? null,  // T104
        titleHistory:        state.titleHistory        ?? [],    // T105
        ruins:               state.ruins               ?? null,  // T106
        unitUpgrades:        state.unitUpgrades        ?? {},    // T107
        explorationMilestones: state.explorationMilestones ?? {}, // T108
        duels:               state.duels               ?? null,  // T109
        pioneers:            state.pioneers            ?? null,  // T110
        naturalDisasters:    state.naturalDisasters    ?? null,  // T111
        researchInspiration: state.researchInspiration ?? null,  // T116
        crises:              state.crises              ?? null,  // T117
        heroLegacy:          state.heroLegacy          ?? null,  // T118
        capUpgrades:         state.capUpgrades         ?? {},    // T120
        forge:               state.forge               ?? null,  // T125
        auction:             state.auction             ?? null,  // T126
        raids:               state.raids               ?? null,  // T127
        proclamation:        state.proclamation        ?? null,  // T131
        wonder:              state.wonder              ?? null,  // T133
        scholar:             state.scholar             ?? null,  // T134
        bounty:              state.bounty              ?? null,  // T135
        greatPersons:        state.greatPersons        ?? null,  // T136
        buildQueue:          state.buildQueue          ?? [],    // T137
        techMilestones:      state.techMilestones      ?? {},    // T141
        allianceMissions:    state.allianceMissions    ?? null,  // T142
        ageChallenges:       state.ageChallenges       ?? null,  // T143
        emergencyCouncil:    state.emergencyCouncil    ?? null,  // T144
        influence:           state.influence           ?? null,  // T145
        discoveries:         state.discoveries         ?? null,  // T146
        populationMilestones: state.populationMilestones ?? {},   // T148
        grandTheory:         state.grandTheory         ?? null,  // T150
        rebels:              state.rebels              ?? null,  // T151
        dynasty:             state.dynasty             ?? null,  // T152
        celestial:           state.celestial           ?? null,  // T153
        campaigns:           state.campaigns           ?? null,  // T154
        battlefields:        state.battlefields        ?? null,  // T156
        supplyDepot:         state.supplyDepot         ?? null,  // T157
        weatherMemory:       state.weatherMemory       ?? null,  // T158
        plague:              state.plague              ?? null,  // T161
        pilgrimages:         state.pilgrimages         ?? null,  // T162
        conversions:         state.conversions         ?? null,  // T164
        warlord:             state.warlord             ?? null,  // T165
        tributes:            state.tributes            ?? null,  // T166
        blackMarket:         state.blackMarket         ?? null,  // T167
        nobleDemands:        state.nobleDemands        ?? null,  // T168
        academy:             state.academy             ?? null,  // T169
        seasonalObjectives:  state.seasonalObjectives  ?? null,  // T170
        census:              state.census              ?? null,  // T171
        dynasticMarriage:    state.dynasticMarriage    ?? null,  // T172
        vault:               state.vault               ?? null,  // T173
        summit:              state.summit              ?? null,  // T174
        warExhaustion:       state.warExhaustion       ?? null,  // T175
        monument:            state.monument            ?? null,  // T176
        cartographer:        state.cartographer        ?? null,  // T179
        relicShrine:         state.relicShrine         ?? null,  // T180
        seasonChronicle:     state.seasonChronicle     ?? null,  // T181
        surge:               state.surge               ?? null,  // T182
        legendaryUnits:      state.legendaryUnits      ?? {},    // T189
        tradeGuild:          state.tradeGuild          ?? null,  // T190
        mint:                state.mint                ?? null,  // T191
        envoy:               state.envoy               ?? null,  // T192
        oracle:              state.oracle              ?? null,  // T193
        guilds:              state.guilds              ?? null,  // T194
        vizier:              state.vizier              ?? null,  // T195
        tradeFair:           state.tradeFair           ?? null,  // T196
        tradeWind:           state.tradeWind           ?? null,  // T198
        taxCollection:       state.taxCollection       ?? null,  // T199
        wanderingArmy:       state.wanderingArmy       ?? null,  // T200
        council:             state.council             ?? null,  // T201
        epicQuests:          state.epicQuests          ?? null,  // T202
        corruption:          state.corruption          ?? null,  // T203
        arena:               state.arena               ?? null,  // T204
        battleStandard:      state.battleStandard      ?? null,  // T205
        governors:           state.governors           ?? null,  // T206
        scouts:              state.scouts              ?? null,  // T207
        resourcePact:        state.resourcePact        ?? null,  // T208
        supplyLines:         state.supplyLines         ?? null,  // T209
        reparations:         state.reparations         ?? null,  // T210
        reputation:          state.reputation          ?? null,  // T211
        counteroffensives:   state.counteroffensives   ?? null,  // T212
        royalHunt:           state.royalHunt           ?? null,  // T214
        codex:               state.codex               ?? null,  // T215
        legendary:           state.legendary           ?? null,  // T216
        refugees:            state.refugees            ?? null,  // T217
        silkRoad:            state.silkRoad            ?? null,  // T218
        propaganda:          state.propaganda          ?? null,  // T219
        intel:               state.intel               ?? null,  // T220
        constructionDrive:   state.constructionDrive   ?? null,  // T221
        peaceOvertures:      state.peaceOvertures      ?? null,  // T222
        forecast:            state.forecast            ?? null,  // T225
        trophies:            state.trophies            ?? null,  // T226
        alchemy:             state.alchemy             ?? null,  // T227
        rationing:           state.rationing           ?? null,  // T228
        militia:             state.militia             ?? null,  // T229
        ancientPact:         state.ancientPact         ?? null,  // T230
        library:             state.library             ?? null,  // T231
        priceSurge:          state.priceSurge          ?? null,  // T232
        lostExpedition:      state.lostExpedition      ?? null,  // T233
        harvest:             state.harvest             ?? null,  // T234
        cityProsperity:      state.cityProsperity      ?? null,  // T235
        imperialGames:       state.imperialGames       ?? null,  // T236
        royalLoan:           state.royalLoan           ?? null,  // T237
        ancientVaultCache:   state.ancientVaultCache   ?? null,  // T238
        recordsExchange:     state.recordsExchange     ?? null,  // T239
        nomadicTribe:        state.nomadicTribe        ?? null,  // T240
        prophet:             state.prophet             ?? null,  // T241
        artisanFair:         state.artisanFair         ?? null,  // T242
        cosmicAlignment:     state.cosmicAlignment     ?? null,  // T244
        tick:          state.tick,
      }
    }));
    emit(Events.GAME_SAVED, {});
  } catch (e) {
    console.error('[save error]', e);
  }
}

function _loadSave() {
  try {
    const raw = localStorage.getItem('empireos-save');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function _applySave(save) {
  const s = save.state;
  Object.assign(state.empire,        s.empire        ?? {});
  Object.assign(state.resources,     s.resources     ?? {});
  Object.assign(state.caps,          s.caps          ?? {});
  Object.assign(state.buildings,     s.buildings     ?? {});
  Object.assign(state.units,         s.units         ?? {});
  Object.assign(state.techs,         s.techs         ?? {});
  state.trainingQueue  = s.trainingQueue  ?? [];
  state.researchQueue  = s.researchQueue  ?? [];
  state.messages       = s.messages       ?? [];
  state.map            = s.map            ?? null;
  state.age            = s.age            ?? 0;
  state.randomEvents   = s.randomEvents   ?? null;
  state.quests         = s.quests         ?? null;
  state.story          = s.story          ?? [];
  state.diplomacy      = s.diplomacy      ?? null;
  state.season         = s.season         ?? null;
  state.hero           = s.hero           ?? null;
  // T070: migrate hero from pre-skill-system saves
  if (state.hero?.recruited) {
    if (!state.hero.skills)            state.hero.skills            = [];
    if (!state.hero.combatWins)        state.hero.combatWins        = 0;
    if (state.hero.pendingSkillOffer === undefined) state.hero.pendingSkillOffer = null;
    // T112: migrate hero from pre-legendary-quest saves
    if (state.hero.legendaryAttack  === undefined) state.hero.legendaryAttack  = 0;
    if (state.hero.cdReduction      === undefined) state.hero.cdReduction      = false;
    if (state.hero.supremeCommander === undefined) state.hero.supremeCommander = false;
    // legendaryQuest stays null for saves where it hasn't unlocked yet — that's correct
    // T119: migrate hero from pre-trait saves — old heroes get no trait (legacy, no penalty)
    if (state.hero.trait         === undefined) state.hero.trait         = null;
    if (state.hero.pendingTrait  === undefined) state.hero.pendingTrait  = false;
    if (state.hero.traitOffer    === undefined) state.hero.traitOffer    = null;
    // T122: migrate hero from pre-companion saves
    if (state.hero.companion      === undefined) state.hero.companion      = null;
    if (state.hero.companionOffer === undefined) state.hero.companionOffer = false;
  }
  state.stats          = s.stats          ?? { goldEarned: 0, peakTerritory: 0 };
  state.market         = s.market         ?? null;
  state.enemyAI        = s.enemyAI        ?? null;
  state.unitXP         = s.unitXP         ?? {};
  state.unitRanks      = s.unitRanks      ?? {};
  state.difficulty     = s.difficulty     ?? 'normal';
  state.alerts         = s.alerts         ?? {};
  state.combatHistory  = s.combatHistory  ?? [];
  state.formation      = s.formation      ?? 'balanced';
  state.spells         = s.spells         ?? null;
  state.barbarians     = s.barbarians     ?? null;
  state.morale         = s.morale         ?? 50;
  state.population     = s.population     ?? null;
  state.espionage      = s.espionage      ?? null;
  state.challenges     = s.challenges     ?? null;
  state.caravans       = s.caravans       ?? null;
  state.relics         = s.relics         ?? null;
  state.archetype        = s.archetype        ?? 'none';
  state.policy           = s.policy           ?? null;
  state.policyChangedAt  = s.policyChangedAt  ?? -999;
  state.garrisons        = s.garrisons        ?? null;
  state.masteries        = s.masteries        ?? {};
  state.politicalEvents  = s.politicalEvents  ?? null;
  state.councilBoons     = s.councilBoons     ?? [];
  state.mercenaries      = s.mercenaries      ?? null;
  state.weather          = s.weather          ?? null;
  state.prestige         = s.prestige         ?? null;
  state.decrees          = s.decrees          ?? null;
  state.contracts        = s.contracts        ?? null;  // T085
  state.merchant         = s.merchant         ?? null;  // T087
  state.landmarks        = s.landmarks        ?? null;  // T089
  state.buildingSpecials = s.buildingSpecials ?? {};    // T090
  state.citizenRoles       = s.citizenRoles       ?? null;  // T096 (null = initialise on first use)
  state.rallyState         = s.rallyState         ?? null;  // T098
  state.expansionMilestones = s.expansionMilestones ?? {};  // T097
  state.capitalPlan        = s.capitalPlan        ?? null;  // T100
  state.combatStreak       = s.combatStreak       ?? { count: 0, lastWinTick: 0 }; // T101
  state.militaryAid        = s.militaryAid        ?? null;  // T102
  state.festivals          = s.festivals          ?? null;  // T103
  state.resourceNodes      = s.resourceNodes      ?? null;  // T104
  state.titleHistory       = s.titleHistory       ?? [];    // T105
  state.ruins              = s.ruins              ?? null;  // T106
  state.unitUpgrades       = s.unitUpgrades       ?? {};    // T107
  state.explorationMilestones = s.explorationMilestones ?? {}; // T108
  state.duels                = s.duels                ?? null;  // T109
  state.pioneers             = s.pioneers             ?? null;  // T110
  state.naturalDisasters     = s.naturalDisasters     ?? null;  // T111
  state.researchInspiration  = s.researchInspiration  ?? null;  // T116
  state.crises               = s.crises               ?? null;  // T117
  state.heroLegacy           = s.heroLegacy           ?? null;  // T118
  state.capUpgrades          = s.capUpgrades          ?? {};    // T120
  state.forge                = s.forge                ?? null;  // T125
  state.auction              = s.auction              ?? null;  // T126
  state.raids                = s.raids                ?? null;  // T127
  state.proclamation         = s.proclamation         ?? { activeId: null, ageWhenIssued: -1 }; // T131
  state.wonder               = s.wonder               ?? null;  // T133
  state.scholar              = s.scholar              ?? null;  // T134
  state.bounty               = s.bounty               ?? null;  // T135
  state.greatPersons         = s.greatPersons         ?? null;  // T136
  state.buildQueue           = s.buildQueue           ?? [];    // T137
  state.techMilestones       = s.techMilestones       ?? {};   // T141
  state.allianceMissions     = s.allianceMissions     ?? null; // T142
  state.ageChallenges        = s.ageChallenges        ?? null; // T143
  state.emergencyCouncil     = s.emergencyCouncil     ?? { used: false }; // T144
  state.influence            = s.influence            ?? null; // T145
  state.discoveries          = s.discoveries          ?? null; // T146
  state.populationMilestones = s.populationMilestones ?? {};   // T148
  state.grandTheory          = s.grandTheory          ?? null; // T150
  state.rebels               = s.rebels               ?? null; // T151
  state.dynasty              = s.dynasty              ?? null; // T152
  state.celestial            = s.celestial            ?? null; // T153
  state.campaigns            = s.campaigns            ?? null; // T154
  state.battlefields         = s.battlefields         ?? null; // T156
  state.supplyDepot          = s.supplyDepot          ?? null; // T157
  state.weatherMemory        = s.weatherMemory        ?? null; // T158
  state.plague               = s.plague               ?? null; // T161
  state.pilgrimages          = s.pilgrimages          ?? null; // T162
  state.conversions          = s.conversions          ?? null; // T164
  state.warlord              = s.warlord              ?? null; // T165
  state.tributes             = s.tributes             ?? null; // T166
  state.blackMarket          = s.blackMarket          ?? null; // T167
  state.nobleDemands         = s.nobleDemands         ?? null; // T168
  state.academy              = s.academy              ?? null; // T169
  state.seasonalObjectives   = s.seasonalObjectives   ?? null; // T170
  state.census               = s.census               ?? null; // T171
  state.dynasticMarriage     = s.dynasticMarriage     ?? null; // T172
  state.vault                = s.vault                ?? null; // T173
  state.summit               = s.summit               ?? null; // T174
  state.warExhaustion        = s.warExhaustion        ?? null; // T175
  state.monument             = s.monument             ?? null; // T176
  state.cartographer         = s.cartographer         ?? null; // T179
  state.relicShrine          = s.relicShrine          ?? null; // T180
  state.seasonChronicle      = s.seasonChronicle      ?? null; // T181
  state.surge                = s.surge                ?? null; // T182
  state.legendaryUnits       = s.legendaryUnits       ?? {};   // T189
  state.tradeGuild           = s.tradeGuild           ?? null; // T190
  state.mint                 = s.mint                 ?? null; // T191
  state.envoy                = s.envoy                ?? null; // T192
  state.oracle               = s.oracle               ?? null; // T193
  state.guilds               = s.guilds               ?? null; // T194
  state.vizier               = s.vizier               ?? null; // T195
  state.tradeFair            = s.tradeFair            ?? null; // T196
  state.tradeWind            = s.tradeWind            ?? null; // T198
  state.taxCollection        = s.taxCollection        ?? null; // T199
  state.wanderingArmy        = s.wanderingArmy        ?? null; // T200
  state.council              = s.council              ?? null; // T201
  state.epicQuests           = s.epicQuests           ?? null; // T202
  state.corruption           = s.corruption           ?? null; // T203
  state.arena                = s.arena                ?? null; // T204
  state.battleStandard       = s.battleStandard       ?? null; // T205
  state.governors            = s.governors            ?? null; // T206
  state.scouts               = s.scouts               ?? null; // T207
  state.resourcePact         = s.resourcePact         ?? null; // T208
  state.supplyLines          = s.supplyLines          ?? null; // T209
  state.reparations          = s.reparations          ?? null; // T210
  state.reputation           = s.reputation           ?? null; // T211
  state.counteroffensives    = s.counteroffensives    ?? null; // T212
  state.royalHunt            = s.royalHunt            ?? null; // T214
  state.codex                = s.codex                ?? null; // T215
  state.legendary            = s.legendary            ?? null; // T216
  state.refugees             = s.refugees             ?? null; // T217
  state.silkRoad             = s.silkRoad             ?? null; // T218
  state.propaganda           = s.propaganda           ?? null; // T219
  state.intel                = s.intel                ?? null; // T220
  state.constructionDrive    = s.constructionDrive    ?? null; // T221
  state.peaceOvertures       = s.peaceOvertures       ?? null; // T222
  state.forecast             = s.forecast             ?? null; // T225
  state.trophies             = s.trophies             ?? null; // T226
  state.alchemy              = s.alchemy              ?? null; // T227
  state.rationing            = s.rationing            ?? null; // T228
  state.militia              = s.militia              ?? null; // T229
  state.ancientPact          = s.ancientPact          ?? null; // T230
  state.library              = s.library              ?? null; // T231
  state.priceSurge           = s.priceSurge           ?? null; // T232
  state.lostExpedition       = s.lostExpedition       ?? null; // T233
  state.harvest              = s.harvest              ?? null; // T234
  state.cityProsperity       = s.cityProsperity       ?? null; // T235
  state.imperialGames        = s.imperialGames        ?? null; // T236
  state.royalLoan            = s.royalLoan            ?? null; // T237
  state.ancientVaultCache    = s.ancientVaultCache    ?? null; // T238
  state.recordsExchange      = s.recordsExchange      ?? null; // T239
  state.nomadicTribe         = s.nomadicTribe         ?? null; // T240
  state.prophet              = s.prophet              ?? null; // T241
  state.artisanFair          = s.artisanFair          ?? null; // T242
  state.cosmicAlignment      = s.cosmicAlignment      ?? null; // T244
  // T086: migrate older saves — ensure hero.expedition exists
  if (state.hero?.recruited && !state.hero.expedition) {
    state.hero.expedition = { active: false, endsAt: 0 };
  }
  state.tick             = s.tick             ?? 0;
  recalcRates();

  // Calculate offline resource progress (applies gains to state.resources in-place).
  // Stored so we can show the modal after UI panels are ready.
  _pendingOffline = calcOfflineProgress(save.ts, state.rates, state.resources, state.caps);

  addMessage('Game loaded.', 'info');
}

// ── T137: Building auto-queue ────────────────────────────────────────────────

function _processAutoQueue() {
  const queue = state.buildQueue;
  if (!queue || queue.length === 0) return;
  const id = queue[0];
  const result = buildBuilding(id);
  if (result.ok) {
    queue.splice(0, 1);
    emit(Events.QUEUE_CHANGED, { autoBuilt: id });
  }
}

// ── Age badge ────────────────────────────────────────────────────────────

function _updateAgeBadge() {
  const el  = document.getElementById('age-badge');
  if (!el) return;
  const age = AGES[state.age ?? 0];
  el.textContent = age ? `${age.icon} ${age.name}` : '';
}
