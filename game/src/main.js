/**
 * EmpireOS — Main entry point.
 * Wires together core engine, systems, and UI on DOMContentLoaded.
 */

import { state, initState } from './core/state.js';
import { emit, on, Events } from './core/events.js';
import { registerSystem, startLoop, stopLoop, TICKS_PER_SECOND } from './core/tick.js';
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
import { initDecrees, decreeTick } from './systems/decrees.js';
import { initContracts, contractTick } from './systems/contracts.js';         // T085
import { initMerchant, merchantTick } from './systems/merchant.js';            // T087
import { initMilitaryAid, militaryAidTick } from './systems/militaryAid.js';  // T102
import { initFestivals, festivalTick } from './systems/festivals.js';          // T103
import { initResourceNodes, resourceNodeTick } from './systems/resourceNodes.js'; // T104
import { getCurrentTitle, TITLES } from './systems/titles.js';                  // T105
import { initDuels, duelTick } from './systems/duels.js';                       // T109
import { initPioneers, pioneerTick } from './systems/pioneers.js';              // T110
import { initNaturalDisasters, disasterTick } from './systems/naturalDisasters.js'; // T111
import { initInspiration, inspirationTick } from './systems/inspiration.js';   // T116
import { initCrises, crisisTick, getActiveCrisis, resolveCrisis } from './systems/crises.js'; // T117
import { drawMinimap } from './systems/minimap.js';                             // T120
import { loadLegacy, LEGACY_TRAITS, awardLegacyPoints } from './systems/legacy.js'; // T124
import { initAuction, auctionTick } from './systems/auction.js';               // T126
import { initWonders, wonderTick } from './systems/wonders.js';                // T133
import { initScholars, scholarTick, acceptTeaching, dismissScholar } from './systems/scholars.js'; // T134
import { initBounty, bountyTick } from './systems/bounty.js';                  // T135
import { initGreatPersons, greatPersonTick } from './systems/greatPersons.js'; // T136
import { initAllianceMissions, allianceMissionTick } from './systems/allianceMissions.js'; // T142
import { initAgeChallenges, ageChallengeTick, getActiveChallengeProgress } from './systems/ageChallenges.js'; // T143
import { initInfluence, influenceTick } from './systems/influence.js';         // T145
import { initDiscoveries, discoveryTick } from './systems/discoveries.js';     // T146
import { initRebels, rebelTick } from './systems/rebels.js';                   // T151
import { initDynasty, dynastyTick, chooseHeir, getSuccessionSecsLeft } from './systems/dynasty.js'; // T152
import { initCelestial, celestialTick, getActiveCelestial, getPendingCelestial, getCelestialSecsLeft } from './systems/celestialEvents.js'; // T153
import { initCampaigns, campaignTick } from './systems/campaigns.js';          // T154
import { initPlague, plagueTick } from './systems/plague.js';                  // T161
import { initPilgrimages, pilgrimageTick } from './systems/pilgrimages.js';    // T162
import { initWarlord, warlordTick } from './systems/warlord.js';               // T165
import { initTributes, tributeTick } from './systems/tributes.js';             // T166
import { initBlackMarket, blackMarketTick } from './systems/blackMarket.js';  // T167
import { initNobleDemands, nobleDemandTick, canSatisfyDemand, satisfyDemand, refuseDemand, getDemandSecsLeft } from './systems/nobleDemands.js'; // T168
import { initVault, vaultTick } from './systems/vault.js';                     // T173
import { initWarExhaustion, warExhaustionTick, getExhaustionTier, EXHAUSTION_LABELS } from './systems/warExhaustion.js'; // T175
import { initCartographer, cartographerTick } from './systems/cartographer.js'; // T179
import { initRelicShrine, relicShrineTick } from './systems/relicShrine.js';   // T180
import { initSeasonChronicle, seasonChronicleTick } from './systems/seasonChronicle.js'; // T181
import { initFortificationNetwork, fortificationNetworkTick } from './systems/fortificationNetwork.js'; // T183
import { initTradeGuildHall, tradeGuildHallTick } from './systems/tradeGuildHall.js'; // T190
import { initImperialMint, imperialMintTick } from './systems/imperialMint.js'; // T191
import { initEnvoy, envoyTick } from './systems/envoy.js';                     // T192
import { initOracle, oracleTick } from './systems/oracle.js';                  // T193
import { initGuilds, guildTick } from './systems/guilds.js';                   // T194
import { initVizier, vizierTick } from './systems/vizier.js';                  // T195
import { initTradeFair, tradeFairTick } from './systems/tradeFair.js';         // T196
import { initTradeWinds, tradeWindsTick } from './systems/tradeWinds.js';      // T198
import { initTaxCollection, taxCollectionTick } from './systems/taxCollection.js'; // T199
import { initWanderingArmy, wanderingArmyTick } from './systems/wanderingArmy.js'; // T200
import { initCouncil, councilTick } from './systems/council.js';               // T201
import { initEpicQuests, epicQuestTick } from './systems/epicQuests.js';       // T202
import { initCorruption, corruptionTick } from './systems/corruption.js';      // T203
import { initArena, arenaTick } from './systems/arena.js';                     // T204
import { initBattleStandard, battleStandardTick } from './systems/battleStandard.js'; // T205
import { initGovernors, governorTick } from './systems/governors.js';          // T206
import { initScouts, scoutTick } from './systems/scouts.js';                   // T207
import { initResourcePact, resourcePactTick } from './systems/resourcePact.js'; // T208
import { initSupplyLines, supplyLinesTick } from './systems/supplyLines.js';   // T209
import { initReparations, reparationsTick } from './systems/reparations.js';   // T210
import { initReputation, reputationTick } from './systems/reputation.js';      // T211
import { initCounteroffensive, counteroffensiveTick } from './systems/counteroffensive.js'; // T212
import { initRoyalHunt, royalHuntTick } from './systems/royalHunt.js';         // T214
import { initCodex, codexTick } from './systems/imperialCodex.js';             // T215
import { initLegendary, legendaryTick } from './systems/legendaryEncounters.js'; // T216
import { initRefugees, refugeesTick, acceptRefugees, integrateRefugees, declineRefugees, getRefugeeSecsLeft, INTEGRATE_GOLD, INTEGRATE_FOOD } from './systems/refugees.js'; // T217
import { initSilkRoad, silkRoadTick } from './systems/silkRoad.js';            // T218
import { initPropaganda, propagandaTick } from './systems/propaganda.js';      // T219
import { initMilitaryIntel, militaryIntelTick } from './systems/militaryIntel.js'; // T220
import { initConstructionDrive, constructionDriveTick } from './systems/constructionDrive.js'; // T221
import { initPeaceOvertures, peaceOvertureTick } from './systems/peaceOvertures.js'; // T222
import { initAlchemy, alchemyTick } from './systems/alchemy.js';               // T227
import { initRationing, rationingTick } from './systems/rationing.js';         // T228
import { initMilitia, militiaTick } from './systems/militia.js';               // T229
import { initAncientPact, ancientPactTick } from './systems/ancientPact.js';   // T230
import { initLibrary, libraryTick } from './systems/grandLibrary.js';          // T231
import { initPriceSurge, priceSurgeTick } from './systems/priceSurge.js';      // T232
import { initLostExpedition, lostExpeditionTick } from './systems/lostExpedition.js'; // T233
import { initHarvest, harvestTick } from './systems/harvest.js';               // T234
import { initCityProsperity, cityProsperityTick } from './systems/cityProsperity.js'; // T235
import { initImperialGames, imperialGamesTick } from './systems/imperialGames.js'; // T236
import { initRoyalLoan, royalLoanTick } from './systems/royalLoan.js';         // T237
import { initAncientVaultCache, ancientVaultCacheTick } from './systems/ancientVaultCache.js'; // T238
import { initRecordsExchange, recordsExchangeTick } from './systems/recordsExchange.js'; // T239
import { initNomadicTribe, nomadicTribeTick } from './systems/nomadicTribe.js'; // T240
import { initProphet, prophetTick } from './systems/wanderingProphet.js';      // T241
import { initArtisanFair, artisanFairTick } from './systems/artisanFair.js';   // T242
import { initEpithet, epithetTick } from './systems/epithet.js';               // T243
import { initCosmicAlignment, cosmicAlignmentTick }     from './systems/cosmicAlignment.js';              // T244
import { initEconomyCycle, economyCycleTick }           from './systems/economyCycle.js';                  // T245
import { initTributeCaravan, tributeCaravanTick }       from './systems/tributeCaravan.js';                // T246
import { initOreVein, oreVeinTick }                     from './systems/ancientOreVein.js';                // T247
import { initHerbalist, herbalistTick }                 from './systems/wanderingHerbalist.js';            // T248
import { initCircus, circusTick }                       from './systems/travelingCircus.js';               // T249
import { initSacredSpring, sacredSpringTick }           from './systems/sacredSpring.js';                  // T250
import { initWanderingBard, wanderingBardTick }         from './systems/wanderingBard.js';                 // T251
import { initMasterArtisan, masterArtisanTick }         from './systems/masterArtisan.js';                 // T252
import { initMountainHermit, mountainHermitTick }       from './systems/mountainHermit.js';                // T253
import { initImperialJubilee, imperialJubileeTick }     from './systems/imperialJubilee.js';               // T254
import { initExiledPrince, exiledPrinceTick }           from './systems/exiledPrince.js';                  // T255
import { initAncientGuardian, ancientGuardianTick }     from './systems/ancientGuardian.js';               // T256
import { initDesertOasis, desertOasisTick }             from './systems/desertOasis.js';                   // T257
import { initForeignDignitary, foreignDignitaryTick }   from './systems/foreignDignitary.js';              // T258
import { initLostCaravan, lostCaravanTick }             from './systems/lostCaravan.js';                   // T259
import { initNomadicScholar, nomadicScholarTick }       from './systems/nomadicScholar.js';                // T260
import { initRoyalFeast, royalFeastTick }               from './systems/royalFeast.js';                    // T261
import { initWanderingBlacksmith, wanderingBlacksmithTick } from './systems/wanderingBlacksmith.js';       // T262
import { initTravelingAstrologer, travelingAstrologerTick } from './systems/travelingAstrologer.js'; // T263
import { initMerchantPrince, merchantPrinceTick }           from './systems/merchantPrince.js';     // T264
import { initWanderingSage, wanderingSageTick }             from './systems/wanderingSage.js';       // T266

import { switchTab } from './ui/tabs.js';
import { initSummaryPanel } from './ui/summaryPanel.js';
import { initBuildingsPanel } from './ui/buildingsPanel.js';
import { initMilitaryPanel } from './ui/militaryPanel.js';
import { initMapPanel } from './ui/mapPanel.js';
import { initResearchPanel } from './ui/researchPanel.js';
import { initDiplomacyPanel } from './ui/diplomacyPanel.js';
import { initMarketPanel } from './ui/marketPanel.js';
import { initQuestPanel } from './ui/questPanel.js';
import { initStoryPanel } from './ui/storyPanel.js';
import { initSettingsPanel, showNewGameWizard } from './ui/settingsPanel.js';
import { initLogPanel } from './ui/logPanel.js';
import { initAlmanacPanel } from './ui/almanacPanel.js';
import { addMessage } from './core/actions.js';
import { calcScore } from './systems/score.js';
import { EXPANSION_MILESTONES } from './systems/milestones.js';
import { updateRecords } from './systems/records.js';  // T160

const LB_KEY = 'empireos-lb';

// ── Boot ──────────────────────────────────────────────────────────────────

function boot() {
  // ── Register all systems ────────────────────────────────────────────────
  registerSystem(resourceTick);
  registerSystem(researchTick);
  registerSystem(randomEventTick);
  registerSystem(seasonTick);
  registerSystem(diplomacyTick);
  registerSystem(victoryTick);
  registerSystem(marketTick);
  registerSystem(enemyAITick);
  registerSystem(spellTick);
  registerSystem(barbarianTick);
  registerSystem(moraleTick);
  registerSystem(populationTick);
  registerSystem(happinessTick);
  registerSystem(challengeTick);
  registerSystem(caravanTick);
  registerSystem(politicalEventTick);
  registerSystem(mercenaryTick);
  registerSystem(weatherTick);
  registerSystem(decreeTick);
  registerSystem(contractTick);       // T085
  registerSystem(merchantTick);       // T087
  registerSystem(militaryAidTick);    // T102
  registerSystem(festivalTick);       // T103
  registerSystem(resourceNodeTick);   // T104
  registerSystem(duelTick);           // T109
  registerSystem(pioneerTick);        // T110
  registerSystem(disasterTick);       // T111
  registerSystem(inspirationTick);    // T116
  registerSystem(crisisTick);         // T117
  registerSystem(auctionTick);        // T126
  registerSystem(wonderTick);         // T133
  registerSystem(scholarTick);        // T134
  registerSystem(bountyTick);         // T135
  registerSystem(greatPersonTick);    // T136
  registerSystem(allianceMissionTick); // T142
  registerSystem(ageChallengeTick);   // T143
  registerSystem(influenceTick);      // T145
  registerSystem(discoveryTick);      // T146
  registerSystem(rebelTick);          // T151
  registerSystem(dynastyTick);        // T152
  registerSystem(celestialTick);      // T153
  registerSystem(campaignTick);       // T154
  registerSystem(plagueTick);         // T161
  registerSystem(pilgrimageTick);     // T162
  registerSystem(warlordTick);        // T165
  registerSystem(tributeTick);        // T166
  registerSystem(blackMarketTick);   // T167
  registerSystem(nobleDemandTick);   // T168
  registerSystem(vaultTick);         // T173
  registerSystem(warExhaustionTick); // T175
  registerSystem(cartographerTick);   // T179
  registerSystem(relicShrineTick);    // T180
  registerSystem(seasonChronicleTick); // T181
  registerSystem(fortificationNetworkTick); // T183
  registerSystem(tradeGuildHallTick); // T190
  registerSystem(imperialMintTick);   // T191
  registerSystem(envoyTick);          // T192
  registerSystem(oracleTick);         // T193
  registerSystem(guildTick);          // T194
  registerSystem(vizierTick);         // T195
  registerSystem(tradeFairTick);      // T196
  registerSystem(tradeWindsTick);     // T198
  registerSystem(taxCollectionTick);  // T199
  registerSystem(wanderingArmyTick);  // T200
  registerSystem(councilTick);        // T201
  registerSystem(epicQuestTick);      // T202
  registerSystem(corruptionTick);     // T203
  registerSystem(arenaTick);          // T204
  registerSystem(battleStandardTick); // T205
  registerSystem(governorTick);       // T206
  registerSystem(scoutTick);          // T207
  registerSystem(resourcePactTick);   // T208
  registerSystem(supplyLinesTick);    // T209
  registerSystem(reparationsTick);    // T210
  registerSystem(reputationTick);     // T211
  registerSystem(counteroffensiveTick); // T212
  registerSystem(royalHuntTick);      // T214
  registerSystem(codexTick);          // T215
  registerSystem(legendaryTick);      // T216
  registerSystem(refugeesTick);       // T217
  registerSystem(silkRoadTick);       // T218
  registerSystem(propagandaTick);     // T219
  registerSystem(militaryIntelTick);  // T220
  registerSystem(constructionDriveTick); // T221
  registerSystem(peaceOvertureTick);  // T222
  registerSystem(alchemyTick);        // T227
  registerSystem(rationingTick);      // T228
  registerSystem(militiaTick);        // T229
  registerSystem(ancientPactTick);    // T230
  registerSystem(libraryTick);        // T231
  registerSystem(priceSurgeTick);     // T232
  registerSystem(lostExpeditionTick); // T233
  registerSystem(harvestTick);        // T234
  registerSystem(cityProsperityTick); // T235
  registerSystem(imperialGamesTick);  // T236
  registerSystem(royalLoanTick);      // T237
  registerSystem(ancientVaultCacheTick); // T238
  registerSystem(recordsExchangeTick); // T239
  registerSystem(nomadicTribeTick);   // T240
  registerSystem(prophetTick);        // T241
  registerSystem(artisanFairTick);    // T242
  registerSystem(epithetTick);        // T243
  registerSystem(cosmicAlignmentTick); // T244
  registerSystem(economyCycleTick);   // T245
  registerSystem(tributeCaravanTick); // T246
  registerSystem(oreVeinTick);        // T247
  registerSystem(herbalistTick);      // T248
  registerSystem(circusTick);         // T249
  registerSystem(sacredSpringTick);   // T250
  registerSystem(wanderingBardTick);  // T251
  registerSystem(masterArtisanTick);  // T252
  registerSystem(mountainHermitTick); // T253
  registerSystem(imperialJubileeTick); // T254
  registerSystem(exiledPrinceTick);   // T255
  registerSystem(ancientGuardianTick); // T256
  registerSystem(desertOasisTick);    // T257
  registerSystem(foreignDignitaryTick); // T258
  registerSystem(lostCaravanTick);    // T259
  registerSystem(nomadicScholarTick); // T260
  registerSystem(royalFeastTick);     // T261
  registerSystem(wanderingBlacksmithTick); // T262
  registerSystem(travelingAstrologerTick); // T263
  registerSystem(merchantPrinceTick); // T264
  registerSystem(wanderingSageTick);  // T266

  // ── Bind event listeners ─────────────────────────────────────────────────
  on(Events.TICK, () => {
    // Update all header badges every tick (cheap DOM checks)
    _updateSiegeBadge();
    _updatePrestigeBadge();
    _updateStreakBadge();
    _updateScoreBadge();
    _updateRepBadge();       // T211
    _checkTitle();           // T105

    // Crisis banner: update every tick (timer countdown)
    _updateCrisisBanner();   // T117

    // Scholar banner: update every tick (countdown)
    _updateScholarBanner();  // T134

    // Age challenge badge: update every tick
    _updateAgeChallengeBadge(); // T143

    // Emergency Council button: show/hide based on crisis/siege/starvation
    _updateEmergencyBtn();   // T144

    // Celestial events banner: update every tick
    _updateCelestialBanner(); // T153

    // Noble Council Demand banner: update every tick (countdown)
    _updateNobleBanner();    // T168

    // War Exhaustion badge: update every tick
    _updateExhaustionBadge(); // T175

    // Refugee Crisis banner: update every tick
    _updateRefugeeBanner();  // T217

    // Succession countdown: update every tick while modal is open
    _updateSuccessionCountdown(); // T152
  });

  on(Events.RESOURCE_CHANGED, () => {
    _updateSiegeBadge();
    _updateNobleBanner();    // T168: costs may now be affordable
    _updateRefugeeBanner();  // T217: costs may now be affordable
  });

  on(Events.MAP_CHANGED, () => {
    _checkExpansionMilestones(); // T097
    _checkExplorationMilestones(); // T108
    _updatePeakTerritory();
  });

  on(Events.TECH_CHANGED, () => {
    _checkTechMilestones(); // T141
    recalcRates();
  });

  on(Events.POPULATION_CHANGED, ({ milestone } = {}) => {
    if (milestone) _showPopMilestoneModal(milestone); // T148
  });

  on(Events.SUCCESSION_READY, () => {
    _showSuccessionModal(); // T152
  });

  // ── init all systems ───────────────────────────────────────────────────
  const raw = localStorage.getItem('empireos-save');
  if (raw) {
    try {
      const s = JSON.parse(raw);
      initState(s.empire?.name ?? 'My Empire');
      initMap();
      initRandomEvents();
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
      initContracts();     // T085
      initMerchant();      // T087
      initMilitaryAid();   // T102
      initFestivals();     // T103
      initResourceNodes(); // T104
      initDuels();         // T109
      initPioneers();      // T110
      initNaturalDisasters(); // T111
      initInspiration();   // T116
      initCrises();        // T117
      initAuction();       // T126
      initWonders();       // T133
      initScholars();      // T134
      initBounty();        // T135
      initGreatPersons();  // T136
      initAllianceMissions(); // T142
      initAgeChallenges(); // T143
      initInfluence();     // T145
      initDiscoveries();   // T146
      initRebels();        // T151
      initDynasty();       // T152
      initCelestial();     // T153
      initCampaigns();     // T154
      initPlague();        // T161
      initPilgrimages();   // T162
      initWarlord();       // T165
      initTributes();      // T166
      initBlackMarket();  // T167
      initNobleDemands(); // T168
      initVault();        // T173
      initWarExhaustion(); // T175
      initCartographer();  // T179
      initRelicShrine();   // T180
      initSeasonChronicle(); // T181
      initFortificationNetwork(); // T183
      initTradeGuildHall(); // T190
      initImperialMint();  // T191
      initEnvoy();         // T192
      initOracle();        // T193
      initGuilds();        // T194
      initVizier();        // T195
      initTradeFair();     // T196
      initTradeWinds();    // T198
      initTaxCollection(); // T199
      initWanderingArmy(); // T200
      initCouncil();       // T201
      initEpicQuests();    // T202
      initCorruption();    // T203
      initArena();         // T204
      initBattleStandard(); // T205
      initGovernors();     // T206
      initScouts();        // T207
      initResourcePact();  // T208
      initSupplyLines();   // T209
      initReparations();   // T210
      initReputation();    // T211
      initCounteroffensive(); // T212
      initRoyalHunt();     // T214
      initCodex();         // T215
      initLegendary();     // T216
      initRefugees();      // T217
      initSilkRoad();      // T218
      initPropaganda();    // T219
      initMilitaryIntel(); // T220
      initConstructionDrive(); // T221
      initPeaceOvertures(); // T222
      initAlchemy();       // T227
      initRationing();     // T228
      initMilitia();       // T229
      initAncientPact();   // T230
      initLibrary();       // T231
      initPriceSurge();    // T232
      initLostExpedition(); // T233
      initHarvest();       // T234
      initCityProsperity(); // T235
      initImperialGames(); // T236
      initRoyalLoan();     // T237
      initAncientVaultCache(); // T238
      initRecordsExchange(); // T239
      initNomadicTribe();  // T240
      initProphet();       // T241
      initArtisanFair();   // T242
      initEpithet();       // T243
      initCosmicAlignment(); // T244
      initEconomyCycle();  // T245
      initTributeCaravan(); // T246
      initOreVein();       // T247
      initHerbalist();     // T248
      initCircus();        // T249
      initSacredSpring();  // T250
      initWanderingBard(); // T251
      initMasterArtisan(); // T252
      initMountainHermit(); // T253
      initImperialJubilee(); // T254
      initExiledPrince();  // T255
      initAncientGuardian(); // T256
      initDesertOasis();   // T257
      initForeignDignitary(); // T258
      initLostCaravan();   // T259
      initNomadicScholar(); // T260
      initRoyalFeast();    // T261
      initWanderingBlacksmith(); // T262
      initTravelingAstrologer(); // T263
      initMerchantPrince(); // T264
      initWanderingSage();  // T266
      _applySave(s);
      addMessage('Save loaded.', 'info');
    } catch (e) {
      console.error('Save load failed:', e);
      _startFreshGame();
    }
  } else {
    _startFreshGame();
  }

  // ── Init UI panels ───────────────────────────────────────────────────────
  initSummaryPanel();
  initBuildingsPanel();
  initMilitaryPanel();
  initMapPanel();
  initResearchPanel();
  initDiplomacyPanel();
  initMarketPanel();
  initQuestPanel();
  initStoryPanel();
  initSettingsPanel();
  initLogPanel();
  initAlmanacPanel();

  _bindControls();

  // Restore the active tab (persisted in localStorage)
  const savedTab = localStorage.getItem('empireos-tab') ?? 'summary';
  switchTab(savedTab);

  // Kick off the main loop
  startLoop();

  // Initial UI sync
  emit(Events.RESOURCE_CHANGED, {});
  emit(Events.BUILDING_CHANGED, {});
  emit(Events.TECH_CHANGED, {});
  emit(Events.AGE_CHANGED, { age: state.age ?? 0 });
  emit(Events.MAP_CHANGED, {});
  emit(Events.HERO_CHANGED, {});

  // Reflect empire name in the title bar
  const nameEl = document.getElementById('empire-name');
  if (nameEl) nameEl.textContent = state.empire.name;

  // Refresh minimap thumbnail
  drawMinimap();

  _updateScoreBadge();
  _updatePrestigeBadge();
  _updateSiegeBadge();
  _updateStreakBadge();
  _updateTitleBadge();   // T105
  _updateRepBadge();     // T211

  _syncPauseUI();
}

function _startFreshGame() {
  initState('My Empire');
  _applyDifficultyStart();
  _applyLegacyBonuses(); // T124
  initMap();
  initRandomEvents();
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
  initContracts();     // T085
  initMerchant();      // T087
  initMilitaryAid();   // T102
  initFestivals();     // T103
  initResourceNodes(); // T104
  initDuels();         // T109
  initPioneers();      // T110
  initNaturalDisasters(); // T111
  initInspiration();   // T116
  initCrises();        // T117
  initAuction();       // T126
  initWonders();       // T133
  initScholars();      // T134
  initBounty();        // T135
  initGreatPersons();  // T136
  initAllianceMissions(); // T142
  initAgeChallenges(); // T143
  initInfluence();     // T145
  initDiscoveries();   // T146
  initRebels();        // T151
  initDynasty();       // T152
  initCelestial();     // T153
  initCampaigns();     // T154
  initPlague();        // T161
  initPilgrimages();   // T162
  initWarlord();       // T165
  initTributes();      // T166
  initBlackMarket();  // T167
  initNobleDemands(); // T168
  initVault();        // T173
  initWarExhaustion(); // T175
  initCartographer();  // T179
  initRelicShrine();   // T180
  initSeasonChronicle(); // T181
  initFortificationNetwork(); // T183
  initTradeGuildHall(); // T190
  initImperialMint();  // T191
  initEnvoy();         // T192
  initOracle();        // T193
  initGuilds();        // T194
  initVizier();        // T195
  initTradeFair();     // T196
  initTradeWinds();    // T198
  initTaxCollection(); // T199
  initWanderingArmy(); // T200
  initCouncil();       // T201
  initEpicQuests();    // T202
  initCorruption();    // T203
  initArena();         // T204
  initBattleStandard(); // T205
  initGovernors();     // T206
  initScouts();        // T207
  initResourcePact();  // T208
  initSupplyLines();   // T209
  initReparations();   // T210
  initReputation();    // T211
  initCounteroffensive(); // T212
  initRoyalHunt();     // T214
  initCodex();         // T215
  initLegendary();     // T216
  initRefugees();      // T217
  initSilkRoad();      // T218
  initPropaganda();    // T219
  initMilitaryIntel(); // T220
  initConstructionDrive(); // T221
  initPeaceOvertures(); // T222
  initAlchemy();       // T227
  initRationing();     // T228
  initMilitia();       // T229
  initAncientPact();   // T230
  initLibrary();       // T231
  initPriceSurge();    // T232
  initLostExpedition(); // T233
  initHarvest();       // T234
  initCityProsperity(); // T235
  initImperialGames(); // T236
  initRoyalLoan();     // T237
  initAncientVaultCache(); // T238
  initRecordsExchange(); // T239
  initNomadicTribe();  // T240
  initProphet();       // T241
  initArtisanFair();   // T242
  initEpithet();       // T243
  initCosmicAlignment(); // T244
  initEconomyCycle();  // T245
  initTributeCaravan(); // T246
  initOreVein();       // T247
  initHerbalist();     // T248
  initCircus();        // T249
  initSacredSpring();  // T250
  initWanderingBard(); // T251
  initMasterArtisan(); // T252
  initMountainHermit(); // T253
  initImperialJubilee(); // T254
  initExiledPrince();  // T255
  initAncientGuardian(); // T256
  initDesertOasis();   // T257
  initForeignDignitary(); // T258
  initLostCaravan();   // T259
  initNomadicScholar(); // T260
  initRoyalFeast();    // T261
  initWanderingBlacksmith(); // T262
  initTravelingAstrologer(); // T263
  initMerchantPrince(); // T264
  initWanderingSage();  // T266
}

// ---------------------------------------------------------------------------
// Save / Load
// ---------------------------------------------------------------------------

const AUTOSAVE_INTERVAL = 60 * TICKS_PER_SECOND; // autosave every 60 s
let _lastAutoSave = 0;

function _save() {
  try {
    const s = {
      version: 100,
      tick: state.tick,
      empire: state.empire,
      difficulty: state.difficulty ?? 'normal',
      archetype:  state.archetype  ?? 'none',
      resources: state.resources,
      caps: state.caps,
      buildings: state.buildings,
      techs: state.techs,
      age: state.age,
      map: state.map,
      units: state.units,
      stats: state.stats,
      quests: state.quests,
      story: state.story,
      diplomacy: state.diplomacy,
      season: state.season,
      market: state.market,
      randomEvents: state.randomEvents,
      achievements: state.achievements,
      enemyAI: state.enemyAI,
      spells: state.spells,
      barbarians: state.barbarians,
      morale: state.morale,
      population: state.population,
      espionage: state.espionage,
      challenges: state.challenges,
      caravans: state.caravans,
      politicalEvents: state.politicalEvents,
      mercenaries: state.mercenaries,
      weather: state.weather,
      prestige: state.prestige,
      decrees: state.decrees,
      contracts: state.contracts,
      merchant: state.merchant,
      militaryAid: state.militaryAid,
      festivals: state.festivals,
      resourceNodes: state.resourceNodes,
      titleHistory: state.titleHistory,
      combatStreak: state.combatStreak,
      combatHistory: state.combatHistory,
      duels: state.duels,
      pioneers: state.pioneers,
      naturalDisasters: state.naturalDisasters,
      inspiration: state.inspiration,
      crises: state.crises,
      auction: state.auction,
      wonder: state.wonder,
      scholar: state.scholar,
      bounty: state.bounty,
      greatPersons: state.greatPersons,
      allianceMissions: state.allianceMissions,
      ageChallenges: state.ageChallenges,
      influence: state.influence,
      discoveries: state.discoveries,
      rebels: state.rebels,
      dynasty: state.dynasty,
      celestial: state.celestial,
      campaigns: state.campaigns,
      expansionMilestones: state.expansionMilestones,
      explorationMilestones: state.explorationMilestones,
      techMilestones: state.techMilestones,
      plague: state.plague,
      pilgrimages: state.pilgrimages,
      warlord: state.warlord,
      tributes: state.tributes,
      blackMarket: state.blackMarket,
      nobleDemands: state.nobleDemands,
      vault: state.vault,
      warExhaustion: state.warExhaustion,
      cartographer: state.cartographer,
      relicShrine: state.relicShrine,
      seasonChronicle: state.seasonChronicle,
      fortificationNetwork: state.fortificationNetwork,
      tradeGuildHall: state.tradeGuildHall,
      imperialMint: state.imperialMint,
      envoy: state.envoy,
      oracle: state.oracle,
      guilds: state.guilds,
      vizier: state.vizier,
      tradeFair: state.tradeFair,
      tradeWinds: state.tradeWinds,
      taxCollection: state.taxCollection,
      wanderingArmy: state.wanderingArmy,
      council: state.council,
      epicQuests: state.epicQuests,
      corruption: state.corruption,
      arena: state.arena,
      battleStandard: state.battleStandard,
      governors: state.governors,
      scouts: state.scouts,
      resourcePact: state.resourcePact,
      supplyLines: state.supplyLines,
      reparations: state.reparations,
      reputation: state.reputation,
      counteroffensive: state.counteroffensive,
      royalHunt: state.royalHunt,
      codex: state.codex,
      legendary: state.legendary,
      refugees: state.refugees,
      silkRoad: state.silkRoad,
      propaganda: state.propaganda,
      militaryIntel: state.militaryIntel,
      constructionDrive: state.constructionDrive,
      peaceOvertures: state.peaceOvertures,
      alchemy: state.alchemy,
      rationing: state.rationing,
      militia: state.militia,
      ancientPact: state.ancientPact,
      grandLibrary: state.grandLibrary,
      priceSurge: state.priceSurge,
      lostExpedition: state.lostExpedition,
      harvest: state.harvest,
      cityProsperity: state.cityProsperity,
      imperialGames: state.imperialGames,
      royalLoan: state.royalLoan,
      ancientVaultCache: state.ancientVaultCache,
      recordsExchange: state.recordsExchange,
      nomadicTribe: state.nomadicTribe,
      wanderingProphet: state.wanderingProphet,
      artisanFair: state.artisanFair,
      epithet: state.epithet,
      grandTheory: state.grandTheory,
      emergencyCouncil: state.emergencyCouncil,
      cosmicAlignment:     state.cosmicAlignment,     // T244
      economyCycle:        state.economyCycle,        // T245
      tributeCaravan:      state.tributeCaravan,      // T246
      oreVein:             state.oreVein,             // T247
      herbalist:           state.herbalist,           // T248
      circus:              state.circus,              // T249
      sacredSpring:        state.sacredSpring,        // T250
      wanderingBard:       state.wanderingBard,       // T251
      masterArtisan:       state.masterArtisan,       // T252
      mountainHermit:      state.mountainHermit,      // T253
      imperialJubilee:     state.imperialJubilee,     // T254
      exiledPrince:        state.exiledPrince,        // T255
      ancientGuardian:     state.ancientGuardian,     // T256
      desertOasis:         state.desertOasis,         // T257
      foreignDignitary:    state.foreignDignitary,    // T258
      lostCaravan:         state.lostCaravan,         // T259
      nomadicScholar:      state.nomadicScholar,      // T260
      royalFeast:          state.royalFeast,          // T261
      wanderingBlacksmith: state.wanderingBlacksmith, // T262
      travelingAstrologer: state.travelingAstrologer, // T263
      merchantPrince:      state.merchantPrince,      // T264
      wanderingSage:       state.wanderingSage,       // T266
    };
    localStorage.setItem('empireos-save', JSON.stringify(s));
  } catch (e) {
    console.error('Save failed:', e);
  }
}

function _loadSave() {
  const raw = localStorage.getItem('empireos-save');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function _applySave(s) {
  if (!s) return;

  // ── Core ─────────────────────────────────────────────────────────────────
  state.tick       = s.tick       ?? 0;
  state.empire     = s.empire     ?? state.empire;
  state.difficulty = s.difficulty ?? 'normal';
  state.archetype  = s.archetype  ?? 'none';
  state.resources  = s.resources  ?? state.resources;
  state.caps       = s.caps       ?? state.caps;
  state.buildings  = s.buildings  ?? state.buildings;
  state.techs      = s.techs      ?? state.techs;
  state.age        = s.age        ?? 0;
  state.map        = s.map        ?? state.map;
  state.units      = s.units      ?? state.units;
  state.stats      = s.stats      ?? state.stats;
  state.quests     = s.quests     ?? state.quests;
  state.story      = s.story      ?? state.story;
  state.diplomacy  = s.diplomacy  ?? state.diplomacy;
  state.season     = s.season     ?? state.season;
  state.market     = s.market     ?? state.market;
  state.randomEvents    = s.randomEvents    ?? state.randomEvents;
  state.achievements    = s.achievements    ?? state.achievements;
  state.enemyAI         = s.enemyAI         ?? state.enemyAI;
  state.spells          = s.spells          ?? state.spells;
  state.barbarians      = s.barbarians      ?? state.barbarians;
  state.morale          = s.morale          ?? state.morale;
  state.population      = s.population      ?? state.population;
  state.espionage       = s.espionage       ?? state.espionage;
  state.challenges      = s.challenges      ?? state.challenges;
  state.caravans        = s.caravans        ?? state.caravans;
  state.politicalEvents = s.politicalEvents ?? state.politicalEvents;
  state.mercenaries     = s.mercenaries     ?? state.mercenaries;
  state.weather         = s.weather         ?? state.weather;
  state.prestige        = s.prestige        ?? state.prestige;
  state.decrees         = s.decrees         ?? state.decrees;
  state.contracts       = s.contracts       ?? null;
  state.merchant        = s.merchant        ?? null;
  state.militaryAid     = s.militaryAid     ?? null;
  state.festivals       = s.festivals       ?? null;
  state.resourceNodes   = s.resourceNodes   ?? null;
  state.titleHistory    = s.titleHistory    ?? [];
  state.combatStreak    = s.combatStreak    ?? null;
  state.combatHistory   = s.combatHistory   ?? [];
  state.duels           = s.duels           ?? null;
  state.pioneers        = s.pioneers        ?? null;
  state.naturalDisasters = s.naturalDisasters ?? null;
  state.inspiration     = s.inspiration     ?? null;
  state.crises          = s.crises          ?? null;
  state.auction         = s.auction         ?? null;
  state.wonder          = s.wonder          ?? null;
  state.scholar         = s.scholar         ?? null;
  state.bounty          = s.bounty          ?? null;
  state.greatPersons    = s.greatPersons    ?? null;
  state.allianceMissions = s.allianceMissions ?? null;
  state.ageChallenges   = s.ageChallenges   ?? null;
  state.influence       = s.influence       ?? null;
  state.discoveries     = s.discoveries     ?? null;
  state.rebels          = s.rebels          ?? null;
  state.dynasty         = s.dynasty         ?? null;
  state.celestial       = s.celestial       ?? null;
  state.campaigns       = s.campaigns       ?? null;
  state.expansionMilestones  = s.expansionMilestones  ?? {};
  state.explorationMilestones = s.explorationMilestones ?? {};
  state.techMilestones  = s.techMilestones  ?? {};
  state.plague          = s.plague          ?? null;
  state.pilgrimages     = s.pilgrimages     ?? null;
  state.warlord         = s.warlord         ?? null;
  state.tributes        = s.tributes        ?? null;
  state.blackMarket     = s.blackMarket     ?? null;
  state.nobleDemands    = s.nobleDemands    ?? null;
  state.vault           = s.vault           ?? null;
  state.warExhaustion   = s.warExhaustion   ?? null;
  state.cartographer    = s.cartographer    ?? null;
  state.relicShrine     = s.relicShrine     ?? null;
  state.seasonChronicle = s.seasonChronicle ?? null;
  state.fortificationNetwork = s.fortificationNetwork ?? null;
  state.tradeGuildHall  = s.tradeGuildHall  ?? null;
  state.imperialMint    = s.imperialMint    ?? null;
  state.envoy           = s.envoy           ?? null;
  state.oracle          = s.oracle          ?? null;
  state.guilds          = s.guilds          ?? null;
  state.vizier          = s.vizier          ?? null;
  state.tradeFair       = s.tradeFair       ?? null;
  state.tradeWinds      = s.tradeWinds      ?? null;
  state.taxCollection   = s.taxCollection   ?? null;
  state.wanderingArmy   = s.wanderingArmy   ?? null;
  state.council         = s.council         ?? null;
  state.epicQuests      = s.epicQuests      ?? null;
  state.corruption      = s.corruption      ?? null;
  state.arena           = s.arena           ?? null;
  state.battleStandard  = s.battleStandard  ?? null;
  state.governors       = s.governors       ?? null;
  state.scouts          = s.scouts          ?? null;
  state.resourcePact    = s.resourcePact    ?? null;
  state.supplyLines     = s.supplyLines     ?? null;
  state.reparations     = s.reparations     ?? null;
  state.reputation      = s.reputation      ?? null;
  state.counteroffensive = s.counteroffensive ?? null;
  state.royalHunt       = s.royalHunt       ?? null;
  state.codex           = s.codex           ?? null;
  state.legendary       = s.legendary       ?? null;
  state.refugees        = s.refugees        ?? null;
  state.silkRoad        = s.silkRoad        ?? null;
  state.propaganda      = s.propaganda      ?? null;
  state.militaryIntel   = s.militaryIntel   ?? null;
  state.constructionDrive = s.constructionDrive ?? null;
  state.peaceOvertures  = s.peaceOvertures  ?? null;
  state.alchemy         = s.alchemy         ?? null;
  state.rationing       = s.rationing       ?? null;
  state.militia         = s.militia         ?? null;
  state.ancientPact     = s.ancientPact     ?? null;
  state.grandLibrary    = s.grandLibrary    ?? null;
  state.priceSurge      = s.priceSurge      ?? null;
  state.lostExpedition  = s.lostExpedition  ?? null;
  state.harvest         = s.harvest         ?? null;
  state.cityProsperity  = s.cityProsperity  ?? null;
  state.imperialGames   = s.imperialGames   ?? null;
  state.royalLoan       = s.royalLoan       ?? null;
  state.ancientVaultCache = s.ancientVaultCache ?? null;
  state.recordsExchange = s.recordsExchange ?? null;
  state.nomadicTribe    = s.nomadicTribe    ?? null;
  state.wanderingProphet = s.wanderingProphet ?? null;
  state.artisanFair     = s.artisanFair     ?? null;
  state.epithet         = s.epithet         ?? null;
  state.grandTheory     = s.grandTheory     ?? null;
  state.emergencyCouncil = s.emergencyCouncil ?? null;
  state.cosmicAlignment      = s.cosmicAlignment      ?? null; // T244
  state.economyCycle         = s.economyCycle         ?? null; // T245
  state.tributeCaravan       = s.tributeCaravan       ?? null; // T246
  state.oreVein              = s.oreVein              ?? null; // T247
  state.herbalist            = s.herbalist            ?? null; // T248
  state.circus               = s.circus               ?? null; // T249
  state.sacredSpring         = s.sacredSpring         ?? null; // T250
  state.wanderingBard        = s.wanderingBard        ?? null; // T251
  state.masterArtisan        = s.masterArtisan        ?? null; // T252
  state.mountainHermit       = s.mountainHermit       ?? null; // T253
  state.imperialJubilee      = s.imperialJubilee      ?? null; // T254
  state.exiledPrince         = s.exiledPrince         ?? null; // T255
  state.ancientGuardian      = s.ancientGuardian      ?? null; // T256
  state.desertOasis          = s.desertOasis          ?? null; // T257
  state.foreignDignitary     = s.foreignDignitary     ?? null; // T258
  state.lostCaravan          = s.lostCaravan          ?? null; // T259
  state.nomadicScholar       = s.nomadicScholar       ?? null; // T260
  state.royalFeast           = s.royalFeast           ?? null; // T261
  state.wanderingBlacksmith  = s.wanderingBlacksmith  ?? null; // T262
  state.travelingAstrologer = s.travelingAstrologer ?? null; // T263
  state.merchantPrince      = s.merchantPrince      ?? null; // T264
  state.wanderingSage       = s.wanderingSage       ?? null; // T266

  // Restore last-title-level sentinel so _checkTitle() doesn't re-fire old titles
  _lastTitleLevel = getCurrentTitle(state).level;

  recalcRates();
  _updateCelestialBanner(); // T153: restore banner state
  _updateRefugeeBanner();   // T217: restore banner state
  emit(Events.STATE_CHANGED, {});
  emit(Events.RESOURCE_CHANGED, {});
  emit(Events.BUILDING_CHANGED, {});
  emit(Events.TECH_CHANGED, {});
  emit(Events.AGE_CHANGED, { age: state.age ?? 0 });
  _updateScoreBadge();
  _updatePrestigeBadge();
  _updateStreakBadge();
  _updateRepBadge();   // T211
  _updateTitleBadge(); // T105

  // Autosave: hook onto the tick loop
  on(Events.TICK, () => {
    if (state.tick - _lastAutoSave >= AUTOSAVE_INTERVAL) {
      _lastAutoSave = state.tick;
      _save();
    }
  });
}

// ---------------------------------------------------------------------------
// Badge / UI update helpers
// ---------------------------------------------------------------------------

// ── Weather badge ─────────────────────────────────────────────────────────

function _updateWeatherBadge() {
  const el = document.getElementById('weather-badge');
  if (!el) return;
  const w = getCurrentWeather();
  if (!w) { el.style.display = 'none'; return; }
  const secsLeft = getWeatherSecsLeft();
  el.textContent = `${w.icon} ${w.name} (${secsLeft}s)`;
  el.title = w.effect;
  el.style.display = '';
}

on(Events.WEATHER_CHANGED, _updateWeatherBadge);
on(Events.TICK, _updateWeatherBadge);

// ── Exhaustion badge (T175) ────────────────────────────────────────────────

function _updateExhaustionBadge() {
  const el = document.getElementById('exhaustion-badge');
  if (!el) return;
  const level = Math.round(state.warExhaustion?.level ?? 0);
  if (level <= 0) {
    el.style.display = 'none';
    el.textContent = '';
    el.className = 'exhaustion-badge';
    return;
  }
  const tier  = getExhaustionTier(level);
  const label = EXHAUSTION_LABELS[tier] || '';
  el.textContent = `😩 ${label} ${level}%`;
  el.className = `exhaustion-badge${tier >= 3 ? ' exhaustion-badge--severe' : ''}`;
  const penaltyDesc = tier >= 3
    ? '−1.5 gold/s, −1.0 food/s, −0.5 iron/s'
    : tier === 2 ? '−0.8 gold/s, −0.6 food/s'
    : '−0.3 gold/s';
  el.title = `War Exhaustion ${level}/100 (${label}): ${penaltyDesc}. Recovers with peace.`;
  el.style.display = '';
}

// ── Siege badge (T079) ────────────────────────────────────────────────────

function _updateSiegeBadge() {
  const el = document.getElementById('siege-badge');
  if (!el) return;
  const secsLeft = getSiegeSecsLeft();
  if (secsLeft <= 0) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }
  const canBribe = (state.resources?.gold ?? 0) >= BRIBE_COST;
  el.innerHTML = `⚔️ SIEGE in ${secsLeft}s&nbsp;<button class="btn btn--xs btn--siege-bribe${canBribe ? '' : ' btn--disabled'}" id="btn-siege-bribe"${canBribe ? '' : ' disabled'} title="Pay ${BRIBE_COST} gold to call off the siege">💰 ${BRIBE_COST}g</button>`;
  el.title = 'Barbarian Grand Siege incoming! Muster your forces or bribe the warlords.';
  el.style.display = '';
}

// ── Crisis banner (T117) ──────────────────────────────────────────────────

function _updateCrisisBanner() {
  const banner = document.getElementById('crisis-banner');
  if (!banner) return;

  const crisis = getActiveCrisis();
  if (!crisis) {
    banner.style.display = 'none';
    banner.innerHTML = '';
    return;
  }

  const { def, secsLeft, canResolve } = crisis;
  const costStr = Object.entries(def.resolveCost)
    .map(([res, amt]) => `${amt} ${res}`)
    .join(' + ');
  const mins = Math.floor(secsLeft / 60);
  const secs = secsLeft % 60;
  const timeStr = mins > 0 ? `${mins}m ${String(secs).padStart(2, '0')}s` : `${secsLeft}s`;

  banner.innerHTML = `
    <div class="crisis-banner__icon">${def.icon}</div>
    <div class="crisis-banner__body">
      <div class="crisis-banner__title">⚠️ CRISIS: ${def.name}</div>
      <div class="crisis-banner__desc">${def.desc}</div>
    </div>
    <div class="crisis-banner__actions">
      <div class="crisis-banner__timer">Expires in ${timeStr}</div>
      <button class="btn btn--sm btn--crisis-resolve ${canResolve ? '' : 'btn--disabled'}"
        id="btn-crisis-resolve"
        ${canResolve ? '' : 'disabled'}
        title="Cost: ${costStr}">
        Resolve (${costStr})
      </button>
    </div>`;
  banner.style.display = 'flex';
}

// ── Scholar banner (T134) ─────────────────────────────────────────────────

function _updateScholarBanner() {
  const banner = document.getElementById('scholar-banner');
  if (!banner) return;

  const active = state.scholar?.active;
  if (!active || state.tick >= active.expiresAt) {
    banner.style.display = 'none';
    banner.innerHTML = '';
    return;
  }

  const secsLeft = Math.max(0, Math.ceil((active.expiresAt - state.tick) / TICKS_PER_SECOND));

  banner.innerHTML = `
    <div class="scholar-banner__icon">${active.icon}</div>
    <div class="scholar-banner__body">
      <div class="scholar-banner__title">📚 Wandering Scholar: ${active.name}</div>
      <div class="scholar-banner__desc">${active.desc}</div>
    </div>
    <div class="scholar-banner__actions">
      <div class="scholar-banner__timer">Departs in ${secsLeft}s</div>
      <button class="btn btn--sm btn--scholar-accept" id="btn-scholar-accept">Accept</button>
      <button class="btn btn--sm btn--scholar-dismiss" id="btn-scholar-dismiss">Dismiss</button>
    </div>`;
  banner.style.display = 'flex';
}

// ── Noble Council Demand banner (T168) ───────────────────────────────────

function _updateNobleBanner() {
  const banner = document.getElementById('noble-banner');
  if (!banner) return;

  const demand = state.nobleDemands?.active;
  if (!demand) {
    banner.style.display = 'none';
    banner.innerHTML = '';
    return;
  }

  const secsLeft = getDemandSecsLeft();
  const mins     = Math.floor(secsLeft / 60);
  const secs     = secsLeft % 60;
  const timeStr  = secsLeft >= 60 ? `${mins}m ${String(secs).padStart(2, '0')}s` : `${secsLeft}s`;
  const canSat   = canSatisfyDemand();
  const urgent   = secsLeft <= 30;

  banner.className = `noble-banner${urgent ? ' noble-banner--urgent' : ''}`;
  banner.innerHTML = `
    <div class="noble-banner__icon">${demand.icon}</div>
    <div class="noble-banner__body">
      <div class="noble-banner__title">👑 ${demand.title}</div>
      <div class="noble-banner__desc">${demand.desc}</div>
    </div>
    <div class="noble-banner__actions">
      <div class="noble-banner__timer">Expires in ${timeStr}</div>
      <button class="btn btn--sm btn--noble-satisfy ${canSat ? '' : 'btn--disabled'}"
        id="btn-noble-satisfy"
        ${canSat ? '' : 'disabled'}
        title="${canSat ? 'Satisfy this demand' : 'Requirements not met'}">
        Satisfy
      </button>
      <button class="btn btn--sm btn--noble-refuse" id="btn-noble-refuse">Refuse</button>
    </div>`;
  banner.style.display = 'flex';
}

// ── Refugee Crisis banner (T217) ─────────────────────────────────────────

function _updateRefugeeBanner() {
  const banner = document.getElementById('refugee-banner');
  if (!banner) return;

  const crisis = state.refugees?.current;
  if (!crisis) {
    banner.style.display = 'none';
    banner.innerHTML = '';
    return;
  }

  const secsLeft = getRefugeeSecsLeft();
  const timeStr  = secsLeft >= 60
    ? `${Math.floor(secsLeft / 60)}m ${String(secsLeft % 60).padStart(2, '0')}s`
    : `${secsLeft}s`;

  const gold = Math.floor(state.resources.gold ?? 0);
  const food = Math.floor(state.resources.food ?? 0);
  const canIntegrate = gold >= INTEGRATE_GOLD && food >= INTEGRATE_FOOD;

  banner.innerHTML = `
    <div class="refugee-banner__icon">🏚️</div>
    <div class="refugee-banner__body">
      <div class="refugee-banner__title">Refugee Crisis — ${crisis.count} displaced from ${crisis.sourceName}</div>
      <div class="refugee-banner__desc">
        Accept (free · +${crisis.count} pop · food strained 2 min) ·
        Integrate (💰${INTEGRATE_GOLD} + 🍞${INTEGRATE_FOOD} · +0.15 ${crisis.integrateBonus}/s permanently) ·
        Decline (displeases ${crisis.sourceName})
      </div>
    </div>
    <div class="refugee-banner__actions">
      <div class="refugee-banner__timer">Expires in ${timeStr}</div>
      <button class="btn btn--sm btn--refugee-accept" id="btn-refugee-accept">Accept</button>
      <button class="btn btn--sm btn--refugee-integrate ${canIntegrate ? '' : 'btn--disabled'}"
        id="btn-refugee-integrate" ${canIntegrate ? '' : 'disabled'}
        title="${canIntegrate ? 'Integrate for permanent bonus' : `Need ${INTEGRATE_GOLD}g + ${INTEGRATE_FOOD} food`}">
        Integrate
      </button>
      <button class="btn btn--sm btn--refugee-decline" id="btn-refugee-decline">Decline</button>
    </div>`;
  banner.style.display = 'flex';
}

// ── Celestial Events banner (T153) ───────────────────────────────────────

function _updateCelestialBanner() {
  const banner = document.getElementById('celestial-banner');
  if (!banner) return;

  const active  = getActiveCelestial();
  const pending = getPendingCelestial();

  if (active) {
    const secsLeft = getCelestialSecsLeft();
    const mins = Math.floor(secsLeft / 60);
    const secs = secsLeft % 60;
    const timeStr = mins > 0 ? `${mins}m${String(secs).padStart(2,'0')}s` : `${secsLeft}s`;
    banner.className = 'celestial-banner';
    banner.innerHTML = `
      <div class="celestial-banner__icon">${active.icon}</div>
      <div class="celestial-banner__body">
        <div class="celestial-banner__title">${active.icon} ${active.name}</div>
        <div class="celestial-banner__desc">${active.desc}</div>
      </div>
      <div class="celestial-banner__timer">Ends in ${timeStr}</div>`;
    banner.style.display = 'flex';
    return;
  }

  if (pending) {
    const def = pending.def;
    banner.className = 'celestial-banner celestial-banner--warning';
    banner.innerHTML = `
      <div class="celestial-banner__icon">${def.icon}</div>
      <div class="celestial-banner__body">
        <div class="celestial-banner__title">Approaching: ${def.name}</div>
        <div class="celestial-banner__desc">${def.desc}</div>
      </div>
      <div class="celestial-banner__timer">In ${pending.secsLeft}s</div>`;
    banner.style.display = 'flex';
    return;
  }

  banner.style.display = 'none';
  banner.innerHTML = '';
}

// ── Age challenge badge (T143) ────────────────────────────────────────────

function _updateAgeChallengeBadge() {
  const el = document.getElementById('age-challenge-badge');
  if (!el) return;
  const prog = getActiveChallengeProgress();
  if (!prog) {
    el.style.display = 'none';
    el.textContent   = '';
    return;
  }
  const mins    = Math.floor(prog.secsLeft / 60);
  const secs    = prog.secsLeft % 60;
  const timeStr = mins > 0 ? `${mins}m${String(secs).padStart(2, '0')}s` : `${prog.secsLeft}s`;
  el.textContent = `${prog.icon} ${prog.label} ${prog.current}/${prog.target} (${timeStr})`;
  el.title       = `${prog.desc} — Complete to earn: ${prog.bonusLabel}`;
  el.style.display = '';
}

// ── Emergency Council (T144) ──────────────────────────────────────────────

function _updateEmergencyBtn() {
  const btn = document.getElementById('btn-emergency');
  if (!btn) return;
  if (state.emergencyCouncil?.used) {
    btn.style.display = 'none';
    return;
  }
  const crisisActive   = !!state.crises?.active;
  const siegeActive    = getSiegeSecsLeft() > 0;
  const starvationRisk = (state.resources?.food ?? 0) <= 0 && (state.rates?.food ?? 0) < 0;
  btn.style.display = (crisisActive || siegeActive || starvationRisk) ? '' : 'none';
}

function _applyEmergencyOption(option) {
  if (state.emergencyCouncil?.used) return;

  if (option === 'levy') {
    state.resources.gold = Math.min(state.caps.gold ?? 500, (state.resources.gold ?? 0) + 400);
    changeMorale(-10);
    addMessage('💰 Emergency Levy: 400 gold collected. The citizenry grumbles, morale drops.', 'info');
  } else if (option === 'supply') {
    state.resources.food  = Math.min(state.caps.food  ?? 500, (state.resources.food  ?? 0) + 300);
    state.resources.wood  = Math.min(state.caps.wood  ?? 500, (state.resources.wood  ?? 0) + 150);
    state.resources.stone = Math.min(state.caps.stone ?? 500, (state.resources.stone ?? 0) + 150);
    if (state.prestige) state.prestige.score = Math.max(0, (state.prestige.score ?? 0) - 50);
    addMessage('🍞 Supply Redistribution: Royal stores opened. +300 food, +150 wood, +150 stone. Prestige falls.', 'info');
    emit(Events.PRESTIGE_CHANGED, { score: state.prestige?.score ?? 0 });
  } else if (option === 'rally') {
    changeMorale(20);
    awardPrestige(100, 'emergency council rally');
    if (state.population) {
      state.population.happiness = Math.max(0, (state.population.happiness ?? 50) - 10);
      recalcRates();
    }
    addMessage('⚔️ Rally the Troops! Your stirring speech lifts morale. +20 morale, +100 prestige.', 'quest');
  }

  if (!state.emergencyCouncil) state.emergencyCouncil = {};
  state.emergencyCouncil.used = true;
  emit(Events.RESOURCE_CHANGED, {});
  document.getElementById('emergency-modal')?.classList.add('emergency-modal--hidden');
  _updateEmergencyBtn();
}

// ── Population Growth Choice (T148) ──────────────────────────────────────

function _showPopMilestoneModal(threshold) {
  const modal = document.getElementById('pop-milestone-modal');
  const desc  = document.getElementById('pop-milestone-desc');
  if (!modal) return;
  if (desc) {
    desc.textContent = `Your empire has reached ${threshold.toLocaleString()} citizens! Choose a benefit to celebrate this milestone.`;
  }
  modal.classList.remove('pop-milestone-modal--hidden');
  addMessage(`🏘️ Population milestone: ${threshold.toLocaleString()} citizens! Choose your reward.`, 'quest');
}

function _applyPopMilestoneOption(option) {
  const modal = document.getElementById('pop-milestone-modal');
  modal?.classList.add('pop-milestone-modal--hidden');

  if (option === 'boom') {
    if (state.population) {
      state.population.count = Math.min(
        state.population.cap ?? 200,
        (state.population.count ?? 0) + 100,
      );
      recalcRates();
    }
    addMessage('👶 Baby Boom! +100 citizens have joined your empire.', 'windfall');
  } else if (option === 'artisans') {
    // 5-minute +20% all-resource rate modifier via randomEvents modifier system
    const expiresAt = state.tick + 5 * 60 * 4; // 5 min × 60 s × 4 ticks/s
    if (!state.randomEvents) state.randomEvents = { nextEventTick: 0, activeModifiers: [] };
    if (!state.randomEvents.activeModifiers) state.randomEvents.activeModifiers = [];
    // Apply once per resource key as a 1.20× multiplier modifier
    const RESOURCE_KEYS = ['gold', 'food', 'wood', 'stone', 'iron', 'mana'];
    for (const res of RESOURCE_KEYS) {
      state.randomEvents.activeModifiers.push({
        id: `artisans_${res}`,
        resource: res,
        rateMult: 1.20,
        expiresAt,
      });
    }
    recalcRates();
    addMessage('🛠️ Skilled Artisans! All resource production +20% for 5 minutes.', 'windfall');
  } else if (option === 'volunteers') {
    if (!state.units) state.units = {};
    state.units.soldier = (state.units.soldier ?? 0) + 5;
    state.units.archer  = (state.units.archer  ?? 0) + 5;
    recalcRates();
    emit(Events.UNIT_CHANGED, {});
    addMessage('⚔️ Military Volunteers! +5 soldiers and +5 archers have joined your cause.', 'windfall');
  }

  emit(Events.RESOURCE_CHANGED, {});
}

// ── Dynastic Succession modal (T152) ─────────────────────────────────────

function _showSuccessionModal() {
  const modal = document.getElementById('succession-modal');
  const desc  = document.getElementById('succession-desc');
  if (!modal) return;
  const gen = state.dynasty?.generation ?? 1;
  if (desc) {
    desc.textContent = `Generation ${gen + 1} begins. Name your heir to lead the empire into the future.`;
  }
  _updateSuccessionCountdown();
  modal.classList.remove('succession-modal--hidden');
  addMessage(`👑 Imperial Succession! Name your heir within 30 seconds or face a regency crisis.`, 'achievement');
}

function _updateSuccessionCountdown() {
  const el = document.getElementById('succession-countdown');
  if (el) el.textContent = String(getSuccessionSecsLeft());
}

function _applySuccessionChoice(heirType) {
  const modal = document.getElementById('succession-modal');
  modal?.classList.add('succession-modal--hidden');
  chooseHeir(heirType);
}

// ── Prestige badge (T080) ─────────────────────────────────────────────────

function _updatePrestigeBadge() {
  const el = document.getElementById('prestige-badge');
  if (!el) return;
  const score = getPrestigeScore();
  el.textContent = `✨ ${score.toLocaleString()}`;
  const next = _nextPrestigeMilestone(score);
  el.title = next
    ? `Empire Prestige: ${score} — Next milestone at ${next.threshold} (${next.name})`
    : `Empire Prestige: ${score} — All milestones achieved!`;
}

function _nextPrestigeMilestone(score) {
  // Inline thresholds to avoid importing PRESTIGE_MILESTONES (circular concern)
  const milestones = [
    { threshold: 500,  name: 'Renowned Kingdom' },
    { threshold: 1000, name: 'Great Power' },
    { threshold: 2000, name: 'Dominant Empire' },
    { threshold: 3500, name: 'Continental Hegemon' },
    { threshold: 5000, name: 'World Wonder' },
  ];
  return milestones.find(m => score < m.threshold) ?? null;
}

// ── Streak badge (T101) ───────────────────────────────────────────────────

function _updateStreakBadge() {
  const el = document.getElementById('streak-badge');
  if (!el) return;
  const count = state.combatStreak?.count ?? 0;
  if (count < 2) {
    el.style.display = 'none';
    return;
  }
  const tier = count >= 10 ? 3 : count >= 6 ? 2 : count >= 3 ? 1 : 0;
  const TIER_LABELS = ['⚔️', '🔥 Momentum', '⚡ Fury', '💥 Unstoppable'];
  const TIER_DESC   = ['', '+10% ATK', '+20% ATK', '+35% ATK, ×2 loot'];
  el.textContent = `${TIER_LABELS[tier]} ×${count}`;
  el.className   = `streak-badge streak-badge--t${tier}`;
  el.title       = `Conquest Streak: ${count} wins${tier > 0 ? ` — ${TIER_DESC[tier]}` : ''}`;
  el.style.display = '';
}

// ── Reputation badge (T211) ─────────────────────────────────────────────

function _updateRepBadge() {
  const el = document.getElementById('rep-badge');
  if (!el) return;
  const score = state.reputation?.score ?? 50;
  if (score >= 70) {
    el.textContent = `⭐ Noble ${score}`;
    el.className = 'rep-badge rep-badge--noble';
    el.title = `Imperial Reputation: Noble (${score}/100) — +8% market sell prices`;
    el.style.display = '';
  } else if (score <= 30) {
    el.textContent = `☠️ Feared ${score}`;
    el.className = 'rep-badge rep-badge--feared';
    el.title = `Imperial Reputation: Feared (${score}/100) — +15% raid loot, faster barbarian spawns`;
    el.style.display = '';
  } else {
    el.style.display = 'none';
  }
}

// ── Title badge (T105) ───────────────────────────────────────────────────

let _lastTitleLevel = 0;

function _checkTitle() {
  const title = getCurrentTitle(state);
  if (title.level > _lastTitleLevel) {
    // Earn titles we've skipped past (shouldn't happen normally but guard it)
    for (let lvl = _lastTitleLevel + 1; lvl <= title.level; lvl++) {
      const earned = TITLES[lvl];
      if (!earned) continue;
      state.titleHistory.push({ titleId: earned.id, tick: state.tick });
      addMessage(`👑 New title earned: ${earned.icon} ${earned.name}! ${earned.bonusDesc}`, 'achievement');
      emit(Events.TITLE_EARNED, { titleId: earned.id, level: lvl });
    }
    _lastTitleLevel = title.level;
    _updateTitleBadge();
    recalcRates();
  }
}

function _updateTitleBadge() {
  const el = document.getElementById('title-badge');
  if (!el) return;
  const title = getCurrentTitle(state);
  el.textContent = `${title.icon} ${title.name}`;
  el.title = `Empire Title: ${title.name} — ${title.bonusDesc}`;
}

// ── Score badge ───────────────────────────────────────────────────────────

function _updateScoreBadge() {
  const el = document.getElementById('score-badge');
  if (!el) return;
  const s = calcScore();
  el.textContent = `⭐ ${s.toLocaleString()}`;
  el.title = `Empire Score: ${s.toLocaleString()} — see breakdown in the Empire tab`;
}

// ── Leaderboard ───────────────────────────────────────────────────────────

/**
 * Persist the current session's stats to the shared leaderboard in localStorage.
 * Called before wiping state on New Game.
 * Only records if the player has done something meaningful (tick > 0).
 */
function _saveToLeaderboard() {
  if (!state.tick || state.tick < 40) return; // ignore trivially-short sessions
  try {
    const raw = localStorage.getItem(LB_KEY);
    const lb  = (raw ? JSON.parse(raw) : null) ?? { scores: [] };

    const quests = Object.keys(state.quests?.completed ?? {}).length;
    lb.scores.push({
      name:       state.empire.name,
      territory:  state.stats?.peakTerritory ?? 0,
      goldEarned: Math.round(state.stats?.goldEarned ?? 0),
      age:        state.age ?? 0,
      quests,
      score:      calcScore(),
      tick:       state.tick,
      date:       new Date().toLocaleDateString(),
    });

    // Keep top 10 ranked by territory (primary) then gold (secondary)
    lb.scores.sort((a, b) =>
      b.territory !== a.territory
        ? b.territory - a.territory
        : b.goldEarned - a.goldEarned
    );
    lb.scores = lb.scores.slice(0, 10);

    localStorage.setItem(LB_KEY, JSON.stringify(lb));

    // T124: Award legacy points based on final score
    const pts = awardLegacyPoints(calcScore());
    if (pts > 0) {
      console.info(`[legacy] +${pts} legacy points awarded`);
    }
  } catch (e) {
    console.error('[leaderboard save error]', e);
  }
}

/**
 * T097: Award one-time resource + prestige rewards when player territory
 * crosses predefined tile-count milestones. Safe to call on every MAP_CHANGED.
 */
function _checkExpansionMilestones() {
  if (!state.map) return;
  if (!state.expansionMilestones) state.expansionMilestones = {};

  let playerTiles = 0;
  for (const row of state.map.tiles) {
    for (const t of row) {
      if (t.owner === 'player') playerTiles++;
    }
  }

  for (const m of EXPANSION_MILESTONES) {
    if (state.expansionMilestones[m.threshold]) continue;  // already awarded
    if (playerTiles < m.threshold) continue;

    state.expansionMilestones[m.threshold] = true;

    const lootParts = [];
    for (const [res, amt] of Object.entries(m.rewards)) {
      const cap = state.caps[res] ?? 500;
      state.resources[res] = Math.min(cap, (state.resources[res] ?? 0) + amt);
      lootParts.push(`+${amt} ${res}`);
    }

    awardPrestige(m.prestige, `expansion milestone: ${playerTiles} tiles`);
    addMessage(
      `🗺️ Milestone: "${m.title}" — ${playerTiles} territories! ${lootParts.join(', ')}. +${m.prestige} prestige.`,
      'windfall',
    );
    emit(Events.RESOURCE_CHANGED, {});
  }
}

// T108: Map exploration milestones (fog-of-war reveal %)
const EXPLORATION_MILESTONE_DEFS = [
  { pct: 50, rewards: { gold: 100 },              prestige: 80,  label: 'Half the World Revealed'   },
  { pct: 75, rewards: { gold: 150, mana: 50 },    prestige: 120, label: 'Great Explorer'             },
  { pct: 90, rewards: { gold: 200, mana: 100 },   prestige: 150, label: 'Cartographer' },
];

/**
 * Award one-time resource + prestige rewards when the player has revealed
 * 50 / 75 / 90 % of map tiles. The 90% milestone also grants a permanent
 * +0.8 gold/s bonus via resources.js (tied to state.explorationMilestones[90]).
 */
function _checkExplorationMilestones() {
  if (!state.map) return;
  if (!state.explorationMilestones) state.explorationMilestones = {};

  const tiles = state.map.tiles;
  let total = 0, revealed = 0;
  for (const row of tiles) {
    for (const t of row) {
      total++;
      if (t.revealed) revealed++;
    }
  }
  if (total === 0) return;

  const exploredPct = Math.round(revealed / total * 100);

  for (const m of EXPLORATION_MILESTONE_DEFS) {
    if (state.explorationMilestones[m.pct]) continue;
    if (exploredPct < m.pct) continue;

    state.explorationMilestones[m.pct] = true;

    const lootParts = [];
    for (const [res, amt] of Object.entries(m.rewards)) {
      const cap = state.caps[res] ?? 500;
      state.resources[res] = Math.min(cap, (state.resources[res] ?? 0) + amt);
      lootParts.push(`+${amt} ${res}`);
    }

    if (m.pct === 90) recalcRates();  // apply permanent +0.8 gold/s

    awardPrestige(m.prestige, `exploration milestone: ${m.pct}% revealed`);
    addMessage(
      `🗺️ Exploration: "${m.label}" — ${m.pct}% of the world revealed! ${lootParts.join(', ')}${m.pct === 90 ? ', permanent +0.8 gold/s' : ''}. +${m.prestige} prestige.`,
      'windfall',
    );
    emit(Events.RESOURCE_CHANGED, {});
    emit(Events.EXPLORATION_MILESTONE, { pct: m.pct });
  }
}

// T141: Tech milestone rewards — one-time bonuses at tech-count thresholds
const TECH_MILESTONE_DEFS = [
  { threshold: 4,     rewards: { gold: 200, mana: 50 },        prestige: 0,   permanent: null,         label: 'Curious Scholar'   },
  { threshold: 8,     rewards: { gold: 400, mana: 100 },       prestige: 50,  permanent: null,         label: 'Learned Sage'      },
  { threshold: 12,    rewards: { gold: 600 },                  prestige: 200, permanent: '+1.5 gold/s', label: 'Master Scholar'    },
  { threshold: 'all', rewards: {},                              prestige: 300, permanent: '+10% all rates', label: 'Omniscient'   },
];
const TOTAL_TECHS = 16; // agriculture/masonry/metalworking/tradeRoutes/warcraft/tactics/steel/engineering/arcane/navigation/alchemy/siege_craft/fortification/economics/divine_favor/espionage

/**
 * Award one-time resource + prestige rewards when researched tech count hits 4/8/12/all.
 * The 12 and 'all' milestones also grant permanent rate bonuses via resources.js.
 */
function _checkTechMilestones() {
  if (!state.techMilestones) state.techMilestones = {};
  const techCount = Object.keys(state.techs).length;

  for (const m of TECH_MILESTONE_DEFS) {
    const key = m.threshold === 'all' ? 'all' : m.threshold;
    if (state.techMilestones[key]) continue;  // already awarded
    const needed = m.threshold === 'all' ? TOTAL_TECHS : m.threshold;
    if (techCount < needed) continue;

    state.techMilestones[key] = true;

    const lootParts = [];
    for (const [res, amt] of Object.entries(m.rewards)) {
      const cap = state.caps[res] ?? 500;
      state.resources[res] = Math.min(cap, (state.resources[res] ?? 0) + amt);
      lootParts.push(`+${amt} ${res}`);
    }

    // Permanent bonuses require rate recalculation
    if (m.permanent) recalcRates();

    const lootStr = lootParts.length ? ` ${lootParts.join(', ')}.` : '';
    const permStr = m.permanent ? ` 🌟 Permanent: ${m.permanent}!` : '';
    const prestigeStr = m.prestige > 0 ? ` +${m.prestige} prestige.` : '';
    if (m.prestige > 0) awardPrestige(m.prestige, `tech milestone: ${techCount} techs`);
    addMessage(
      `📚 Research Milestone: "${m.label}" — ${techCount} technologies mastered!${lootStr}${permStr}${prestigeStr}`,
      'windfall',
    );
    emit(Events.RESOURCE_CHANGED, {});
  }
}

/**
 * Keep state.stats.peakTerritory up to date after every map change.
 */
function _updatePeakTerritory() {
  if (!state.stats || !state.map) return;
  let count = 0;
  for (const row of state.map.tiles) {
    for (const tile of row) {
      if (tile.owner === 'player') count++;
    }
  }
  if (count > state.stats.peakTerritory) state.stats.peakTerritory = count;
}

// ── Difficulty ────────────────────────────────────────────────────────────

/**
 * Apply a starting-resource bonus/penalty based on the current difficulty setting.
 * Called once at the start of every new game, after initState() has set base values.
 * Easy  → ×1.5 gold/food/wood  (floor: 10 each)
 * Hard  → ×0.75 gold/food/wood (floor: 10 each)
 */
function _applyDifficultyStart() {
  const d = state.difficulty ?? 'normal';
  if (d === 'normal') return;
  const mult = d === 'easy' ? 1.5 : 0.75;
  for (const res of ['gold', 'food', 'wood']) {
    state.resources[res] = Math.max(10, Math.round((state.resources[res] ?? 0) * mult));
  }
}

// ── T124: Legacy Traits ────────────────────────────────────────────────────

/**
 * Apply all owned legacy traits to the current (freshly-initialised) state.
 * Called immediately after initState() + _applyDifficultyStart() in both the
 * first-boot new-game path and every subsequent _newGame() call.
 */
function _applyLegacyBonuses() {
  const legacy = loadLegacy();
  for (const traitId of legacy.owned) {
    const def = LEGACY_TRAITS[traitId];
    if (def?.apply) {
      try { def.apply(state); } catch (e) { console.warn('[legacy]', traitId, e); }
    }
  }
}

// ── New Game ──────────────────────────────────────────────────────────────

/**
 * Reset all state and start a fresh game.
 * @param {object} [opts]             Optional overrides from the wizard modal.
 * @param {string} [opts.name]        Empire name; defaults to 'My Empire'.
 * @param {string} [opts.difficulty]  'easy'|'normal'|'hard'; persists in state.
 * @param {string} [opts.archetype]   'none'|'conqueror'|'merchant'|'arcane'; persists in state.
 */
function _newGame(opts = {}) {
  updateRecords(); // T160: snapshot records before state wipe
  _saveToLeaderboard();
  localStorage.removeItem('empireos-save');
  // Apply difficulty + archetype before initState (both persist across new games)
  if (opts.difficulty) state.difficulty = opts.difficulty;
  if (opts.archetype)  state.archetype  = opts.archetype;
  initState(opts.name ?? 'My Empire');
  _applyDifficultyStart();
  _applyLegacyBonuses(); // T124: apply purchased legacy traits
  initMap();
  initRandomEvents();
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
  initContracts();    // T085
  initMerchant();     // T087
  initMilitaryAid();  // T102
  initFestivals();    // T103
  initResourceNodes(); // T104
  initDuels();            // T109
  initPioneers();         // T110
  initNaturalDisasters(); // T111
  initInspiration();      // T116
  initCrises();           // T117
  initAuction();          // T126
  initWonders();          // T133
  initScholars();         // T134
  initBounty();           // T135
  initGreatPersons();     // T136
  initAllianceMissions(); // T142
  initAgeChallenges();   // T143
  initInfluence();       // T145: reset influence state on new game
  initDiscoveries();     // T146: reset discoveries state on new game
  document.getElementById('pop-milestone-modal')?.classList.add('pop-milestone-modal--hidden'); // T148
  initRebels();          // T151: reset rebel state on new game
  initDynasty();         // T152: reset dynasty state on new game
  document.getElementById('succession-modal')?.classList.add('succession-modal--hidden'); // T152
  initCelestial();       // T153: reset celestial events on new game
  initCampaigns();       // T154: reset campaigns on new game
  initPlague();          // T161: reset plague state on new game
  initPilgrimages();     // T162: reset pilgrimages on new game
  initWarlord();         // T165: reset warlord state on new game
  initTributes();        // T166: reset tributes on new game
  initBlackMarket();    // T167: reset black market on new game
  initNobleDemands();   // T168: reset noble demands on new game
  initVault();          // T173: reset vault state on new game
  initWarExhaustion();  // T175: reset war exhaustion on new game
  initCartographer();    // T179: reset cartographer state on new game
  initRelicShrine();     // T180: reset relic shrine state on new game
  initSeasonChronicle();       // T181: reset season chronicle on new game
  initFortificationNetwork();  // T183: recompute network on new game map
  initTradeGuildHall();        // T190: reset trade guild boost state on new game
  initImperialMint();          // T191: reset mint state on new game
  initEnvoy();                 // T192: reset envoy state on new game
  initOracle();                // T193: reset oracle state on new game
  initGuilds();                // T194: reset guild state on new game
  initVizier();                // T195: reset vizier state on new game
  initTradeFair();             // T196: reset trade fair state on new game
  initTradeWinds();            // T198: reset trade wind state on new game
  initTaxCollection();         // T199: reset tax collection state on new game
  initWanderingArmy();         // T200: reset wandering army state on new game
  initCouncil();               // T201: reset province council state on new game
  initEpicQuests();            // T202: reset epic quest chains on new game
  initCorruption();            // T203: reset corruption state on new game
  initArena();                 // T204: reset arena state on new game
  initBattleStandard();        // T205: reset battle standard on new game
  initGovernors();             // T206: reset governors on new game
  initScouts();                // T207: reset scout state on new game
  initResourcePact();          // T208: reset resource pact on new game
  initSupplyLines();           // T209: reset supply lines on new game
  initReparations();           // T210: reset war reparations on new game
  initReputation();            // T211: reset reputation on new game
  initCounteroffensive();      // T212: reset counteroffensives on new game
  initRoyalHunt();             // T214: reset royal hunt on new game
  initCodex();               // T215: reset imperial codex on new game
  initLegendary();           // T216: reset legendary encounters on new game
  initRefugees();            // T217: reset refugee crisis on new game
  initSilkRoad();            // T218: reset silk road on new game
  initPropaganda();          // T219: reset propaganda campaigns on new game
  initMilitaryIntel();       // T220: reset military intel on new game
  initConstructionDrive();   // T221: reset construction drive on new game
  initPeaceOvertures();      // T222: reset peace overtures on new game
  initAlchemy();             // T227: reset alchemy state on new game
  initRationing();           // T228: reset rationing state on new game
  initMilitia();             // T229: reset militia state on new game
  initAncientPact();         // T230: reset ancient pact state on new game
  initLibrary();             // T231: reset grand library state on new game
  initPriceSurge();          // T232: reset price surge state on new game
  initLostExpedition();      // T233: reset lost expedition state on new game
  initHarvest();             // T234: reset seasonal harvest state on new game
  initCityProsperity();      // T235: reset city prosperity state on new game
  initImperialGames();       // T236: reset imperial games state on new game
  initRoyalLoan();           // T237: reset royal loan state on new game
  initAncientVaultCache();   // T238: reset ancient vault cache state on new game
  initRecordsExchange();     // T239: reset records exchange state on new game
  initNomadicTribe();        // T240: reset nomadic tribe state on new game
  initProphet();             // T241: reset wandering prophet state on new game
  initArtisanFair();         // T242: reset artisan fair state on new game
  initEpithet();             // T243: recalculate epithet for new empire
  initCosmicAlignment();     // T244: reset cosmic alignment state on new game
  initEconomyCycle();        // T245: reset economy cycle state on new game
  initTributeCaravan();      // T246: reset tribute caravan state on new game
  initOreVein();             // T247: reset ore vein state on new game
  initHerbalist();           // T248: reset herbalist state on new game
  initCircus();              // T249: reset traveling circus state on new game
  initSacredSpring();        // T250: reset sacred spring state on new game
  initWanderingBard();       // T251: reset wandering bard state on new game
  initMasterArtisan();       // T252: reset master artisan state on new game
  initMountainHermit();    // T253: reset mountain hermit state on new game
  initImperialJubilee();      // T254: reset imperial jubilee state on new game
  initRoyalFeast();           // T261: reset royal feast state on new game
  initWanderingBlacksmith();  // T262: reset wandering blacksmith state on new game
  initTravelingAstrologer();  // T263: reset traveling astrologer state on new game
  initMerchantPrince();       // T264: reset merchant prince state on new game
  _updateCelestialBanner(); // T153: hide banner on new game
  _updateRefugeeBanner();   // T217: hide refugee banner on new game
  recalcRates();
  startLoop();  // restart loop in case it was stopped by game-over
  _syncPauseUI();  // ensure pause overlay is hidden on new game
  emit(Events.MAP_CHANGED, {});
  emit(Events.HERO_CHANGED, {});
  // Reflect the new empire name in the title bar
  const nameEl = document.getElementById('empire-name');
  if (nameEl) nameEl.textContent = state.empire.name;

  // Refresh minimap thumbnail for the new game's map
  drawMinimap();
  addMessage(`New game started. Long live the ${state.empire.name}!`, 'info');
  emit(Events.STATE_CHANGED, {});
  emit(Events.RESOURCE_CHANGED, {});
  emit(Events.BUILDING_CHANGED, {});
  emit(Events.TECH_CHANGED, {});
  emit(Events.AGE_CHANGED, { age: 0 });
  _updateScoreBadge();
  _updatePrestigeBadge();
  _updateSiegeBadge();
  _updateStreakBadge();
  _updateRepBadge();        // T211: reset rep badge on new game
  _lastTitleLevel = 0;
  _updateTitleBadge();
}

// ── UI Controls ───────────────────────────────────────────────────────────

function _bindControls() {
  document.getElementById('btn-save')?.addEventListener('click', () => {
    _save();
    addMessage('Game saved.', 'info');
  });

  // New Game: open wizard modal instead of native confirm/prompt
  document.getElementById('btn-new-game')?.addEventListener('click', () => {
    showNewGameWizard(state.difficulty, state.archetype ?? 'none', (opts) => _newGame(opts));
  });

  // Rename empire: inline prompt on title-bar name span (fixed: was using wrong id)
  document.getElementById('empire-name')?.addEventListener('click', () => {
    const name = prompt('Enter your empire name:', state.empire.name);
    if (name && name.trim()) {
      state.empire.name = name.trim();
      const el = document.getElementById('empire-name');
      if (el) el.textContent = state.empire.name;
    }
  });

  // Pause button
  document.getElementById('btn-pause')?.addEventListener('click', _togglePause);

  // T117: Crisis resolve button (delegated — banner content is dynamic)
  document.getElementById('crisis-banner')?.addEventListener('click', (e) => {
    if (e.target.closest('#btn-crisis-resolve')) {
      const result = resolveCrisis();
      if (!result.ok) addMessage(result.reason, 'info');
      _updateCrisisBanner();
    }
  });

  // T139: Barbarian bribe button (delegated — badge content is dynamic)
  document.getElementById('siege-badge')?.addEventListener('click', (e) => {
    if (e.target.closest('#btn-siege-bribe')) {
      const result = bribeBarbarians();
      if (!result.ok) addMessage(result.reason, 'info');
      _updateSiegeBadge();
    }
  });

  // T134: Scholar banner accept/dismiss
  document.getElementById('scholar-banner')?.addEventListener('click', (e) => {
    if (e.target.closest('#btn-scholar-accept')) {
      acceptTeaching();
      _updateScholarBanner();
    } else if (e.target.closest('#btn-scholar-dismiss')) {
      dismissScholar();
      _updateScholarBanner();
    }
  });

  // T144: Emergency Council — open/close modal and handle option choices
  document.getElementById('btn-emergency')?.addEventListener('click', () => {
    document.getElementById('emergency-modal')?.classList.remove('emergency-modal--hidden');
  });
  document.getElementById('btn-emergency-cancel')?.addEventListener('click', () => {
    document.getElementById('emergency-modal')?.classList.add('emergency-modal--hidden');
  });
  document.getElementById('emergency-modal')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-ec-option]');
    if (btn) _applyEmergencyOption(btn.dataset.ecOption);
  });

  // T148: Population growth choice modal
  document.getElementById('pop-milestone-modal')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pm-option]');
    if (btn) _applyPopMilestoneOption(btn.dataset.pmOption);
  });

  // T152: Dynastic succession modal — heir choice buttons
  document.getElementById('succession-modal')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-heir]');
    if (btn) _applySuccessionChoice(btn.dataset.heir);
  });

  // T168: Noble demand banner — satisfy / refuse buttons
  document.getElementById('noble-banner')?.addEventListener('click', (e) => {
    if (e.target.closest('#btn-noble-satisfy')) {
      const result = satisfyDemand();
      if (!result.ok && result.reason) addMessage(`👑 ${result.reason}`, 'info');
      _updateNobleBanner();
    } else if (e.target.closest('#btn-noble-refuse')) {
      refuseDemand();
      _updateNobleBanner();
    }
  });

  // T217: Refugee crisis banner — accept / integrate / decline buttons
  document.getElementById('refugee-banner')?.addEventListener('click', (e) => {
    let result;
    if (e.target.closest('#btn-refugee-accept')) {
      result = acceptRefugees();
    } else if (e.target.closest('#btn-refugee-integrate')) {
      result = integrateRefugees();
    } else if (e.target.closest('#btn-refugee-decline')) {
      result = declineRefugees();
    }
    if (result && !result.ok && result.reason) addMessage(`🏚️ ${result.reason}`, 'info');
    _updateRefugeeBanner();
  });

  _bindKeyboard();
}

// ── Pause ─────────────────────────────────────────────────────────────────

/**
 * Toggle the game loop and synchronise all pause-state UI indicators.
 */
function _togglePause() {
  if (state.running) {
    stopLoop();
    addMessage('⏸ Game paused. Press Space, P, or the Pause button to resume.', 'info');
  } else {
    startLoop();
    addMessage('▶ Game resumed.', 'info');
  }
  _syncPauseUI();
}

/**
 * Sync the pause button label and the pause overlay to match state.running.
 * Safe to call before the DOM is ready (guards with optional chaining).
 */
function _syncPauseUI() {
  const btn     = document.getElementById('btn-pause');
  const overlay = document.getElementById('pause-overlay');
  const paused  = !state.running;

  if (btn) {
    btn.textContent = paused ? '▶ Resume' : '⏸ Pause';
    btn.classList.toggle('btn--paused', paused);
  }
  if (overlay) {
    overlay.classList.toggle('pause-overlay--hidden', !paused);
    overlay.setAttribute('aria-hidden', String(!paused));
  }
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────

/**
 * Map number/symbol keys to tab panel ids.
 * Mirrors the tab order in index.html.
 */
const _TAB_KEYS = {
  '1': 'summary',
  '2': 'buildings',
  '3': 'military',
  '4': 'map',
  '5': 'research',
  '6': 'diplomacy',
  '7': 'market',
  '8': 'quests',
  '9': 'story',
  '0': 'settings',
  '-': 'log',
  '=': 'almanac',
};

function _bindKeyboard() {
  document.addEventListener('keydown', (e) => {
    // Never fire shortcuts when the user is typing in a form element
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;

    // Skip if any system modifier is held (keeps browser shortcuts intact)
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    // Tab switching: 1-0 and -
    if (_TAB_KEYS[e.key] !== undefined) {
      e.preventDefault();
      switchTab(_TAB_KEYS[e.key]);
      return;
    }

    switch (e.key) {
      // Pause / resume
      case ' ':
      case 'p':
      case 'P':
        e.preventDefault();
        _togglePause();
        break;

      // Quick save
      case 's':
      case 'S':
        e.preventDefault();
        _save();
        addMessage('💾 Game saved. [S]', 'info');
        break;

      // Close the save/export modal if open
      case 'Escape': {
        const modal = document.getElementById('save-modal');
        if (modal && !modal.classList.contains('modal--hidden')) {
          document.getElementById('save-modal-close')?.click();
        }
        break;
      }
    }
  });
}

// ── Start ─────────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
