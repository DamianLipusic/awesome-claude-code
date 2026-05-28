/**
 * EmpireOS — Main entry point.
 * Wires together core engine, systems, and UI.
 */

// ─── Core engine ───────────────────────────────────────────────────────────────────────────────
import { state, updateState }                  from './state.js';
import { initEngine, tick, registerSystem }    from './engine.js';
import { initUI, renderAll }                   from './ui.js';

// ─── Utility / shared ────────────────────────────────────────────────────────────────────────────
import { logMessage }                          from './systems/messageLog.js';
import { updateHUD }                           from './ui/hud.js';
import { openTab, getActiveTab }               from './ui/tabs.js';
import { showToast }                           from './ui/toast.js';
import { animateGoldGain }                     from './ui/animations.js';
import { applyTheme, initSettings }            from './systems/settings.js';
import { initMapCanvas, renderMap }            from './ui/mapCanvas.js';
import { initMinimap }                         from './ui/minimap.js';

// ─── Systems ───────────────────────────────────────────────────────────────────────────────
import { initResources, resourceTick }         from './systems/resources.js';
import { initBuildings, buildingsTick }        from './systems/buildings.js';
import { initResearch, researchTick }          from './systems/research.js';
import { initMilitary, militaryTick }          from './systems/military.js';
import { initDiplomacy, diplomacyTick }        from './systems/diplomacy.js';
import { initTrade, tradeTick }                from './systems/trade.js';
import { initEvents, eventsTick }              from './systems/events.js';
import { initQuests, questsTick }              from './systems/quests.js';
import { initAchievements, achievementsTick }  from './systems/achievements.js';
import { initSeasons, seasonsTick }            from './systems/seasons.js';
import { initAges, agesTick }                  from './systems/ages.js';
import { initStory, storyTick }                from './systems/story.js';
import { initMap, mapTick }                    from './systems/map.js';
import { initLeaderboard, leaderboardTick }    from './systems/leaderboard.js';
import { initSave }                            from './systems/save.js';
import { initPopulation, populationTick }      from './systems/population.js';
import { initMorale, moraleTick }              from './systems/morale.js';
import { initCorruption, corruptionTick }      from './systems/corruption.js';   // T203
import { initCombat, combatTick }              from './systems/combat.js';
import { initWeather, weatherTick }            from './systems/weather.js';
import { initRelics, relicsTick }              from './systems/relics.js';
import { initReligion, religionTick }          from './systems/religion.js';
import { initCulture, cultureTick }            from './systems/culture.js';
import { initEspionage, espionageTick }        from './systems/espionage.js';
import { initPiracy, piracyTick }              from './systems/piracy.js';
import { initNaturalDisasters, naturalDisastersTick } from './systems/naturalDisasters.js';
import { initRebellion, rebellionTick }        from './systems/rebellion.js';
import { initFamine, famineTick }              from './systems/famine.js';
import { initPlague, plagueTick }              from './systems/plague.js';
import { initEconomy, economyTick }            from './systems/economy.js';
import { initDynasty, dynastyTick }            from './systems/dynasty.js';
import { initChronicle, chronicleTick }        from './systems/chronicle.js';
import { initWonders, wondersTick }            from './systems/wonders.js';
import { initPolicies, policiesTick }          from './systems/policies.js';
import { initScience, scienceTick }            from './systems/science.js';
import { initArtisan, artisanTick }            from './systems/artisan.js';
import { initForeign, foreignTick }            from './systems/foreign.js';
import { initColony, colonyTick }              from './systems/colony.js';
import { initNavy, navyTick }                  from './systems/navy.js';
import { initExpedition, expeditionTick }      from './systems/expedition.js';
import { initPilgrimage, pilgrimageTick }      from './systems/pilgrimage.js';
import { initMercenaries, mercenariesTick }    from './systems/mercenaries.js';
import { initIntelligence, intelligenceTick }  from './systems/intelligence.js';
import { initHarvest, harvestTick }            from './systems/harvest.js';
import { initFestival, festivalTick }          from './systems/festival.js';
import { initTournament, tournamentTick }      from './systems/tournament.js';
import { initCavalry, cavalryTick }            from './systems/cavalry.js';
import { initSiege, siegeTick }                from './systems/siege.js';
import { initFortifications, fortificationsTick } from './systems/fortifications.js';
import { initCoastal, coastalTick }            from './systems/coastal.js';
import { initSpy, spyTick }                    from './systems/spy.js';
import { initAlchemy, alchemyTick }            from './systems/alchemy.js';  // T104
import { initTaxation, taxationTick }          from './systems/taxation.js'; // T105
import { initAstrology, astrologyTick }        from './systems/astrology.js'; // T106
import { initGuild, guildTick }                from './systems/guild.js'; // T107
import { initHerald, heraldTick }              from './systems/herald.js'; // T108
import { initCensus, censusTick }              from './systems/census.js'; // T109
import { initBanditry, banditryTick }          from './systems/banditry.js'; // T110
import { initCaravan, caravanTick }            from './systems/caravan.js'; // T111
import { initOracle, oracleTick }              from './systems/oracle.js'; // T112
import { initMessenger, messengerTick }        from './systems/messenger.js'; // T113
import { initForestry, forestryTick }          from './systems/forestry.js'; // T114
import { initMining, miningTick }              from './systems/mining.js'; // T115
import { initIrrigation, irrigationTick }      from './systems/irrigation.js'; // T116
import { initMasonry, masonryTick }            from './systems/masonry.js'; // T117
import { initTextile, textileTick }            from './systems/textile.js'; // T118
import { initPottery, potteryTick }            from './systems/pottery.js'; // T119
import { initLeather, leatherTick }            from './systems/leather.js'; // T120
import { initJewelry, jewelryTick }            from './systems/jewelry.js'; // T121
import { initGlass, glassTick }                from './systems/glass.js'; // T122
import { initPaper, paperTick }                from './systems/paper.js'; // T123
import { initInk, inkTick }                    from './systems/ink.js'; // T124
import { initCandle, candleTick }              from './systems/candle.js'; // T125
import { initSoap, soapTick }                  from './systems/soap.js'; // T126
import { initRope, ropeTick }                  from './systems/rope.js'; // T127
import { initSalt, saltTick }                  from './systems/salt.js'; // T128
import { initSpice, spiceTick }                from './systems/spice.js'; // T129
import { initSugar, sugarTick }                from './systems/sugar.js'; // T130
import { initCotton, cottonTick }              from './systems/cotton.js'; // T131
import { initSilk, silkTick }                  from './systems/silk.js'; // T132
import { initWool, woolTick }                  from './systems/wool.js'; // T133
import { initFur, furTick }                    from './systems/fur.js'; // T134
import { initAmber, amberTick }                from './systems/amber.js'; // T135
import { initIvory, ivoryTick }                from './systems/ivory.js'; // T136
import { initPearl, pearlTick }                from './systems/pearl.js'; // T137
import { initGem, gemTick }                    from './systems/gem.js'; // T138
import { initDye, dyeTick }                    from './systems/dye.js'; // T139
import { initPerfume, perfumeTick }            from './systems/perfume.js'; // T140
import { initMedicine, medicineTick }          from './systems/medicine.js'; // T141
import { initPoison, poisonTick }              from './systems/poison.js'; // T142
import { initExplosive, explosiveTick }        from './systems/explosive.js'; // T143
import { initStealth, stealthTick }            from './systems/stealth.js'; // T144
import { initDiplomaticMarriage, diplomaticMarriageTick } from './systems/diplomaticMarriage.js'; // T145
import { initRoyalDecree, royalDecreeTick }    from './systems/royalDecree.js'; // T146
import { initImperialEdicts, imperialEdictsTick } from './systems/imperialEdicts.js'; // T147
import { initPropaganda, propagandaTick }      from './systems/propaganda.js'; // T148
import { initCensorship, censorshipTick }      from './systems/censorship.js'; // T149
import { initCourt, courtTick }                from './systems/court.js'; // T150
import { initNobility, nobilityTick }          from './systems/nobility.js'; // T151
import { initSerfdom, serfdomTick }            from './systems/serfdom.js'; // T152
import { initSlavery, slaveryTick }            from './systems/slavery.js'; // T153
import { initConquest, conquestTick }          from './systems/conquest.js'; // T154
import { initAnnexation, annexationTick }      from './systems/annexation.js'; // T155
import { initTribute, tributeTick }            from './systems/tribute.js'; // T156
import { initSupplyDepot, supplyDepotTick }    from './systems/supplyDepot.js'; // T157
import { initClimateAdaptations, climateAdaptationsTick } from './systems/climateAdaptations.js'; // T158
import { initTradeEmbargo, tradeEmbargoTick }  from './systems/tradeEmbargo.js'; // T159
import { initLifetimeRecords, lifetimeRecordsTick } from './systems/lifetimeRecords.js'; // T160
import { initPlagueOutbreak, plagueOutbreakTick } from './systems/plagueOutbreak.js'; // T161
import { initPilgrimageSystem, pilgrimageSystemTick } from './systems/pilgrimageSystem.js'; // T162
import { initRoyalHunt, royalHuntTick }        from './systems/royalHunt.js'; // T214
import { initRovingWarlord, rovingWarlordTick } from './systems/rovingWarlord.js'; // T165
import { initTributeDemand, tributeDemandTick } from './systems/tributeDemand.js'; // T166
import { initBlackMarket, blackMarketTick }    from './systems/blackMarket.js'; // T167
import { initNobleCouncilDemand, nobleCouncilDemandTick } from './systems/nobleCouncilDemand.js'; // T168
import { initImperialVault, imperialVaultTick } from './systems/imperialVault.js'; // T173
import { initDiplomaticSummit, diplomaticSummitTick } from './systems/diplomaticSummit.js'; // T174
import { initAlmanac, almanacTick }            from './systems/almanac.js'; // T177
import { initCartographerSurvey, cartographerSurveyTick } from './systems/cartographerSurvey.js'; // T179
import { initRelicShrine, relicShrineTick }    from './systems/relicShrine.js'; // T180
import { initFortificationNetwork, fortificationNetworkTick } from './systems/fortificationNetwork.js'; // T183
import { initVeteranCohesion, veteranCohesionTick } from './systems/veteranCohesion.js'; // T184
import { initTradeRouteSpecializations, tradeRouteSpecializationsTick } from './systems/tradeRouteSpecializations.js'; // T185
import { initVictoryProgress, victoryProgressTick } from './systems/victoryProgress.js'; // T187
import { initSeasonalResearchAffinity, seasonalResearchAffinityTick } from './systems/seasonalResearchAffinity.js'; // T188
import { initLegendaryUnits, legendaryUnitsTick } from './systems/legendaryUnits.js'; // T189
import { initTradeGuildHall, tradeGuildHallTick } from './systems/tradeGuildHall.js'; // T190
import { initImperialMint, imperialMintTick }  from './systems/imperialMint.js'; // T191
import { initDiplomaticEnvoy, diplomaticEnvoyTick } from './systems/diplomaticEnvoy.js'; // T192
import { initOracleOfFate, oracleOfFateTick }  from './systems/oracleOfFate.js'; // T193
import { initArtisanGuilds, artisanGuildsTick } from './systems/artisanGuilds.js'; // T194
import { initGrandVizier, grandVizierTick }    from './systems/grandVizier.js'; // T195
import { initAnnualTradeFair, annualTradeFairTick } from './systems/annualTradeFair.js'; // T196
import { initTradeWindEvents, tradeWindEventsTick } from './systems/tradeWindEvents.js'; // T198
import { initImperialTaxCollector, imperialTaxCollectorTick } from './systems/imperialTaxCollector.js'; // T199
import { initWanderingArmy, wanderingArmyTick } from './systems/wanderingArmy.js'; // T200
import { initProvinceCouncil, provinceCouncilTick } from './systems/provinceCouncil.js'; // T201
import { initEpicQuestChains, epicQuestChainsTick } from './systems/epicQuestChains.js'; // T202
import { initGrandArena, grandArenaTick }      from './systems/grandArena.js'; // T204
import { initScoutReconnaissance, scoutReconnaissanceTick } from './systems/scoutReconnaissance.js'; // T207
import { initResourceExchangePact, resourceExchangePactTick } from './systems/resourceExchangePact.js'; // T208
import { initImperialCodex, imperialCodexTick } from './systems/imperialCodex.js'; // T215
import { initLegendaryEncounters, legendaryEncountersTick } from './systems/legendaryEncounters.js'; // T216
import { initRefugeeCrisis, refugeeCrisisTick } from './systems/refugeeCrisis.js'; // T217
import { initSilkRoad, silkRoadTick }          from './systems/silkRoad.js'; // T218
import { initImperialPropaganda, imperialPropagandaTick } from './systems/imperialPropaganda.js'; // T219
import { initMilitaryIntelligence, militaryIntelligenceTick } from './systems/militaryIntelligence.js'; // T220
import { initConstructionDrive, constructionDriveTick } from './systems/constructionDrive.js'; // T221
import { initPeaceOverture, peaceOvertureTick } from './systems/peaceOverture.js'; // T222
import { initBuildingNetworkBonuses, buildingNetworkBonusesTick } from './systems/buildingNetworkBonuses.js'; // T223
import { initArmyCompositionSynergies, armyCompositionSynergiesTick } from './systems/armyCompositionSynergies.js'; // T224
import { initRoyalForecast, royalForecastTick } from './systems/royalForecast.js'; // T225
import { initWarTrophyCollection, warTrophyCollectionTick } from './systems/warTrophyCollection.js'; // T226
import { initAlchemyWorkshop, alchemyWorkshopTick } from './systems/alchemyWorkshop.js'; // T227
import { initWartimeRationing, wartimeRationingTick } from './systems/wartimeRationing.js'; // T228
import { initPeasantMilitia, peasantMilitiaTick } from './systems/peasantMilitia.js'; // T229
import { initAncientPact, ancientPactTick }    from './systems/ancientPact.js'; // T230
import { initGrandLibrary, grandLibraryTick }  from './systems/grandLibrary.js'; // T231
import { initMarketPriceSurge, marketPriceSurgeTick } from './systems/marketPriceSurge.js'; // T232
import { initSeasonalHarvest, seasonalHarvestTick } from './systems/seasonalHarvest.js'; // T234
import { initImperialGames, imperialGamesTick } from './systems/imperialGames.js'; // T236
import { initRoyalLoan, royalLoanTick }        from './systems/royalLoan.js'; // T237
import { initImperialRecordsExchange, imperialRecordsExchangeTick } from './systems/imperialRecordsExchange.js'; // T239
import { initNomadicTribe, nomadicTribeTick }  from './systems/nomadicTribe.js'; // T240
import { initWanderingProphet, wanderingProphetTick } from './systems/wanderingProphet.js'; // T241
import { initArtisanFair, artisanFairTick }    from './systems/artisanFair.js'; // T242
import { initEmpireEpithet, empireEpithetTick } from './systems/empireEpithet.js'; // T243
import { initCosmicAlignment, cosmicAlignmentTick } from './systems/cosmicAlignment.js'; // T244
import { initMarketEconomyCycle, marketEconomyCycleTick } from './systems/marketEconomyCycle.js'; // T245
import { initVillageTributeCaravan, villageTributeCaravanTick } from './systems/villageTributeCaravan.js'; // T246
import { initAncientOreVein, ancientOreVeinTick } from './systems/ancientOreVein.js'; // T247
import { initWanderingHerbalist, wanderingHerbalistTick } from './systems/wanderingHerbalist.js'; // T248
import { initTravelingCircus, travelingCircusTick } from './systems/travelingCircus.js'; // T249
import { initSacredSpring, sacredSpringTick }  from './systems/sacredSpring.js'; // T250
import { initWanderingBard, wanderingBardTick } from './systems/wanderingBard.js'; // T251
import { initMasterArtisan, masterArtisanTick } from './systems/masterArtisan.js'; // T252
import { initMountainHermit, mountainHermitTick } from './systems/mountainHermit.js'; // T253
import { initImperialJubilee, imperialJubileeTick } from './systems/imperialJubilee.js'; // T254
import { initExiledPrince, exiledPrinceTick }  from './systems/exiledPrince.js'; // T255
import { initAncientGuardian, ancientGuardianTick } from './systems/ancientGuardian.js'; // T256
import { initDesertOasis, desertOasisTick }    from './systems/desertOasis.js'; // T257
import { initForeignDignitary, foreignDignitaryTick } from './systems/foreignDignitary.js'; // T258
import { initLostCaravan, lostCaravanTick }    from './systems/lostCaravan.js'; // T259
import { initNomadicScholar, nomadicScholarTick } from './systems/nomadicScholar.js'; // T260
import { initRoyalFeast, royalFeastTick }      from './systems/royalFeast.js'; // T261
import { initWanderingBlacksmith, wanderingBlacksmithTick } from './systems/wanderingBlacksmith.js'; // T262
import { initTravelingAstrologer, travelingAstrologerTick } from './systems/travelingAstrologer.js'; // T263
import { initMerchantPrince, merchantPrinceTick } from './systems/merchantPrince.js'; // T264
import { initWanderingSage, wanderingSageTick } from './systems/wanderingSage.js';       // T266
import { initMasterForester, masterForesterTick } from './systems/masterForester.js'; // T267
import { initForestSpirit, forestSpiritTick }   from './systems/forestSpirit.js';     // T268
import { initWanderingAlchemist, wanderingAlchemistTick } from './systems/wanderingAlchemist.js'; // T269
import { initSeafaringExplorer, seafaringExplorerTick }   from './systems/seafaringExplorer.js';  // T270
import { initTravelingMonk, travelingMonkTick }           from './systems/travelingMonk.js';        // T271
import { initImperialCartographer, imperialCartographerTick } from './systems/imperialCartographer.js'; // T272
import { initWanderingOracle, wanderingOracleTick }         from './systems/wanderingOracle.js';        // T273
import { initRoyalEmissary, royalEmissaryTick }             from './systems/royalEmissary.js';          // T274
import { initWanderingTinker, wanderingTinkerTick }         from './systems/wanderingTinker.js';         // T275
import { initWanderingPhysician, wanderingPhysicianTick }   from './systems/wanderingPhysician.js';      // T276
import { initWanderingCartomancer, wanderingCartomancerTick } from './systems/wanderingCartomancer.js';  // T277
import { initVillageElderVisit, villageElderVisitTick }       from './systems/villageElderVisit.js';     // T278
import { initWanderingScribe, wanderingScribeTick }           from './systems/wanderingScribe.js';        // T279
import { initDesertTrader, desertTraderTick }                 from './systems/desertTrader.js';           // T280
import { initWanderingGemcutter, wanderingGemcutterTick }     from './systems/wanderingGemcutter.js';     // T281
import { initForestWarden, forestWardenTick }                 from './systems/forestWarden.js';           // T282
import { initWanderingBeekeeper, wanderingBeekeeperTick }     from './systems/wanderingBeekeeper.js';     // T283
import { initStoneCarver, stoneCarverTick }                   from './systems/stoneCarver.js';             // T284
import { initWanderingGlassblower, wanderingGlassblowerTick } from './systems/wanderingGlassblower.js';     // T285
import { initRoyalAstronomer, royalAstronomerTick }           from './systems/royalAstronomer.js';          // T286
import { initImperialHerald, imperialHeraldTick }             from './systems/imperialHerald.js';            // T287
import { initTravelingPotter, travelingPotterTick }           from './systems/travelingPotter.js';           // T288
import { initWanderingDyer, wanderingDyerTick }               from './systems/wanderingDyer.js';             // T289
import { initFrontierScout, frontierScoutTick }               from './systems/frontierScout.js';             // T290
import { initWanderingShipwright, wanderingShipwrightTick }   from './systems/wanderingShipwright.js';        // T291
import { initMasterBrewer, masterBrewerTick }                 from './systems/masterBrewer.js';               // T292
import { initAncientManuscriptTrader, ancientManuscriptTraderTick } from './systems/ancientManuscriptTrader.js'; // T293
import { initImperialSiegeEngineer, imperialSiegeEngineerTick }     from './systems/imperialSiegeEngineer.js';   // T294
import { initWanderingWeaver, wanderingWeaverTick }                 from './systems/wanderingWeaver.js';         // T295
import { initTravelingArchitect, travelingArchitectTick }           from './systems/travelingArchitect.js';      // T296
import { initWanderingFalconer, wanderingFalconerTick }             from './systems/wanderingFalconer.js';       // T297
import { initRoamingBotanist, roamingBotanistTick }                 from './systems/roamingBotanist.js';         // T298
import { initWanderingJeweler, wanderingJewelerTick }               from './systems/wanderingJeweler.js';        // T299
import { initDesertNomadChief, desertNomadChiefTick }               from './systems/desertNomadChief.js';        // T300
import { initWanderingSculptor, wanderingSculptorTick }             from './systems/wanderingSculptor.js';       // T301
import { initRoyalVintner, royalVintnerTick }                       from './systems/royalVintner.js';            // T302
import { initWanderingMapmaker, wanderingMapmakerTick }             from './systems/wanderingMapmaker.js';       // T303
import { initRoyalPerfumer, royalPerfumerTick }                     from './systems/royalPerfumer.js';           // T304
import { initWanderingSilversmith, wanderingSilversmithTick }       from './systems/wanderingSilversmith.js';     // T305
import { initImperialSpiceMerchant, imperialSpiceMerchantTick }     from './systems/imperialSpiceMerchant.js';   // T306
import { initCourtMusician, courtMusicianTick }                     from './systems/courtMusician.js';           // T307
import { initAncientLibraryKeeper, ancientLibraryKeeperTick }       from './systems/ancientLibraryKeeper.js';    // T308
import { initWanderingClockmaker, wanderingClockmakerTick }         from './systems/wanderingClockmaker.js';     // T309
import { initImperialWeaponsmith, imperialWeaponsmithTick }         from './systems/imperialWeaponsmith.js';     // T310
import { initWanderingStonemason, wanderingStonemasonTick }         from './systems/wanderingStonemason.js';     // T311
import { initImperialDyeMaster, imperialDyeMasterTick }             from './systems/imperialDyeMaster.js';       // T312
import { initWanderingNavigator, wanderingNavigatorTick }           from './systems/wanderingNavigator.js';      // T313
import { initTravelingIlluminator, travelingIlluminatorTick }       from './systems/travelingIlluminator.js';    // T314
import { initAncientRitualLeader, ancientRitualLeaderTick }         from './systems/ancientRitualLeader.js';     // T315
import { initMountainProspector, mountainProspectorTick }           from './systems/mountainProspector.js';      // T316
import { initWanderingLeatherworker, wanderingLeatherworkerTick }   from './systems/wanderingLeatherworker.js';  // T317
import { initRoyalApothecary, royalApothecaryTick }                 from './systems/royalApothecary.js';         // T318
import { initWanderingFishmonger, wanderingFishmongerTick }         from './systems/wanderingFishmonger.js';     // T319
import { initImperialChandler, imperialChandlerTick }               from './systems/imperialChandler.js';        // T320
import { initRoyalLamplighter, royalLamplighterTick }               from './systems/royalLamplighter.js';        // T321
import { initWanderingCooper, wanderingCooperTick }                  from './systems/wanderingCooper.js';         // T322
import { initWanderingRopeMaker, wanderingRopeMakerTick }           from './systems/wanderingRopeMaker.js';      // T323
import { initImperialSaltMerchant, imperialSaltMerchantTick }       from './systems/imperialSaltMerchant.js';    // T324
import { initWanderingPuppeteer, wanderingPuppeteerTick }           from './systems/wanderingPuppeteer.js';      // T325
import { initAncientRuneCarver, ancientRuneCarverTick }             from './systems/ancientRuneCarver.js';       // T326
import { initWanderingCartwright, wanderingCartwrightTick }         from './systems/wanderingCartwright.js';     // T327
import { initImperialFarrier, imperialFarrierTick }                 from './systems/imperialFarrier.js';         // T328
import { initWanderingCobbler, wanderingCobblerTick }               from './systems/wanderingCobbler.js';         // T329
import { initImperialEngraver, imperialEngraverTick }               from './systems/imperialEngraver.js';         // T330
import { initWanderingTailor, wanderingTailorTick }                 from './systems/wanderingTailor.js';          // T331
import { initWanderingTinsmith, wanderingTinsmithTick }             from './systems/wanderingTinsmith.js';        // T332
import { initWanderingMiller, wanderingMillerTick }                 from './systems/wanderingMiller.js';          // T333
import { initImperialCourier, imperialCourierTick }                 from './systems/imperialCourier.js';          // T334
import { initWanderingBaker, wanderingBakerTick }                   from './systems/wanderingBaker.js';            // T335
import { initImperialArmorer, imperialArmorerTick }                 from './systems/imperialArmorer.js';           // T336
import { initWanderingWoodCarver, wanderingWoodCarverTick }         from './systems/wanderingWoodCarver.js';       // T337
import { initImperialRoadBuilder, imperialRoadBuilderTick }         from './systems/imperialRoadBuilder.js';       // T338
import { initWanderingEmbroiderer, wanderingEmbroidererTick }       from './systems/wanderingEmbroiderer.js';      // T339
import { initRoyalBookbinder, royalBookbinderTick }                 from './systems/royalBookbinder.js';           // T340
import { initWanderingBasketweaver, wanderingBasketweaverTick }     from './systems/wanderingBasketweaver.js';     // T341
import { initWanderingCharcoalMaker, wanderingCharcoalMakerTick }   from './systems/wanderingCharcoalMaker.js';   // T342
import { initWanderingTanner, wanderingTannerTick }                 from './systems/wanderingTanner.js';           // T343
import { initImperialGlassmaker, imperialGlassmakerTick }           from './systems/imperialGlassmaker.js';        // T344
import { initWanderingInkmaker, wanderingInkmakerTick }             from './systems/wanderingInkmaker.js';         // T345
import { initImperialDockmaster, imperialDockmasterTick }           from './systems/imperialDockmaster.js';        // T346
import { initWanderingStoryteller, wanderingStorytellerTick }       from './systems/wanderingStoryteller.js';      // T347
import { initImperialLoreMaster, imperialLoreMasterTick }           from './systems/imperialLoreMaster.js';        // T348
import { initWanderingToymaker, wanderingToymakerTick }             from './systems/wanderingToymaker.js';         // T349
import { initImperialFerryman, imperialFerrymanTick }               from './systems/imperialFerryman.js';          // T350
import { initWanderingMosaicMaker, wanderingMosaicMakerTick }       from './systems/wanderingMosaicMaker.js';       // T351
import { initImperialBathhouseBuilder, imperialBathhouseBuilderTick } from './systems/imperialBathhouseBuilder.js'; // T352
import { initWanderingBellFounder, wanderingBellFounderTick }         from './systems/wanderingBellFounder.js';       // T353
import { initImperialMarbleCutter, imperialMarbleCutterTick }         from './systems/imperialMarbleCutter.js';       // T354
import { initWanderingParchmentMaker, wanderingParchmentMakerTick }   from './systems/wanderingParchmentMaker.js'; // T355
import { initWanderingIncenseMaker, wanderingIncenseMakerTick }       from './systems/wanderingIncenseMaker.js';   // T356
import { initWanderingFurrier, wanderingFurrierTick }                 from './systems/wanderingFurrier.js';         // T357
import { initImperialWoolMerchant, imperialWoolMerchantTick }         from './systems/imperialWoolMerchant.js';     // T358
import { initWanderingHorseTrader, wanderingHorseTraderTick }         from './systems/wanderingHorseTrader.js';     // T359
import { initImperialSilkWeaver, imperialSilkWeaverTick }             from './systems/imperialSilkWeaver.js';       // T360
import { initWanderingGemMerchant, wanderingGemMerchantTick }         from './systems/wanderingGemMerchant.js';     // T361
import { initImperialSiegeMaster, imperialSiegeMasterTick }           from './systems/imperialSiegeMaster.js';      // T362
import { initWanderingHatMaker, wanderingHatMakerTick }               from './systems/wanderingHatMaker.js';         // T363
import { initImperialGoldsmith, imperialGoldsmithTick }               from './systems/imperialGoldsmith.js';         // T364
import { initWanderingOilMerchant, wanderingOilMerchantTick }         from './systems/wanderingOilMerchant.js';       // T365
import { initImperialQuarryman, imperialQuarrymanTick }               from './systems/imperialQuarryman.js';         // T366
import { initWanderingSoapMaker, wanderingSoapMakerTick }             from './systems/wanderingSoapMaker.js';         // T367
import { initImperialMetalcaster, imperialMetalcasterTick }           from './systems/imperialMetalcaster.js';       // T368
import { initWanderingGloveMaker, wanderingGloveMakerTick }           from './systems/wanderingGloveMaker.js';       // T369
import { initImperialTelescopeMaker, imperialTelescopeMakerTick }     from './systems/imperialTelescopeMaker.js';    // T370
import { initWanderingPaperMaker, wanderingPaperMakerTick }           from './systems/wanderingPaperMaker.js';        // T371
import { initImperialCoinMinter, imperialCoinMinterTick }             from './systems/imperialCoinMinter.js';         // T372
import { initWanderingCartographerGuild, wanderingCartographerGuildTick } from './systems/wanderingCartographerGuild.js'; // T373
import { initImperialSpymaster, imperialSpymasterTick }               from './systems/imperialSpymaster.js';          // T374
import { initWanderingGemPolisher, wanderingGemPolisherTick }         from './systems/wanderingGemPolisher.js';        // T375
import { initImperialAstrolabeMaker, imperialAstrolabeMakerTick }     from './systems/imperialAstrolabeMaker.js';      // T376
import { initWanderingLocksmith, wanderingLocksmithTick }             from './systems/wanderingLocksmith.js';          // T377
import { initImperialCalligrapher, imperialCalligrapherTick }         from './systems/imperialCalligrapher.js';        // T378
import { initWanderingCoppersmith, wanderingCoppersmithTick }         from './systems/wanderingCoppersmith.js';        // T379
import { initImperialScrivener, imperialScrivenerTick }               from './systems/imperialScrivener.js';           // T380
import { initWanderingMirrorMaker, wanderingMirrorMakerTick }         from './systems/wanderingMirrorMaker.js';        // T381
import { initImperialFlowerMerchant, imperialFlowerMerchantTick }     from './systems/imperialFlowerMerchant.js';      // T382
import { initWanderingDressmaker, wanderingDressmakertick }           from './systems/wanderingDressmaker.js';          // T383
import { initImperialTileSetter, imperialTileSetterTick }             from './systems/imperialTileSetter.js';           // T384
import { initImperialBannerWeaver, imperialBannerWeaverTick }         from './systems/imperialBannerWeaver.js';         // T385
import { initWanderingBoneCarver, wanderingBoneCarverTick }           from './systems/wanderingBoneCarver.js';          // T386
import { initWanderingTapestryMaker, wanderingTapestryMakerTick }     from './systems/wanderingTapestryMaker.js';       // T387
import { initImperialSiegeArchitect, imperialSiegeArchitectTick }     from './systems/imperialSiegeArchitect.js';       // T388
import { initWanderingLuteMaker, wanderingLuteMakerTick }             from './systems/wanderingLuteMaker.js';           // T389
import { initImperialStonecutterGuild, imperialStonecutterGuildTick } from './systems/imperialStonecutterGuild.js';     // T390
import { initWanderingCandlemaker, wanderingCandlemakerTick }         from './systems/wanderingCandlemaker.js';         // T391
import { initImperialGrainMerchant, imperialGrainMerchantTick }       from './systems/imperialGrainMerchant.js';        // T392
import { initWanderingFeltMaker, wanderingFeltMakerTick }             from './systems/wanderingFeltMaker.js';           // T393
import { initImperialVineyardMaster, imperialVineyardMasterTick }     from './systems/imperialVineyardMaster.js';       // T394
import { initWanderingHerbMerchant, wanderingHerbMerchantTick }       from './systems/wanderingHerbMerchant.js';        // T395
import { initImperialLanternMaker, imperialLanternMakerTick }         from './systems/imperialLanternMaker.js';         // T396
import { initWanderingInkMaster, wanderingInkMasterTick }             from './systems/wanderingInkMaster.js';           // T397
import { initWanderingSaltMerchant, wanderingSaltMerchantTick }       from './systems/wanderingSaltMerchant.js';        // T398
import { initWanderingBronzeSmith, wanderingBronzeSmithTick }         from './systems/wanderingBronzeSmith.js';          // T399
import { initImperialAqueductBuilder, imperialAqueductBuilderTick }   from './systems/imperialAqueductBuilder.js';      // T400
import { initWanderingGlassPainter, wanderingGlassPainterTick }       from './systems/wanderingGlassPainter.js';        // T401
import { initImperialSiegeCatapultEngineer, imperialSiegeCatapultEngineerTick } from './systems/imperialSiegeCatapultEngineer.js'; // T402
import { initWanderingWoolSpinner, wanderingWoolSpinnerTick }         from './systems/wanderingWoolSpinner.js';          // T403
import { initImperialAmberMerchant, imperialAmberMerchantTick }       from './systems/imperialAmberMerchant.js';         // T404
import { initWanderingSandglassMaker, wanderingSandglassMakerTick }   from './systems/wanderingSandglassMaker.js';        // T405
import { initImperialBridgeBuilder, imperialBridgeBuilderTick }       from './systems/imperialBridgeBuilder.js';         // T406
import { initWanderingChronicler, wanderingChroniclerTick }           from './systems/wanderingChronicler.js';            // T407
import { initImperialSurveyor, imperialSurveyorTick }                 from './systems/imperialSurveyor.js';               // T408
import { initWanderingTapestryRestorer, wanderingTapestryRestorerTick } from './systems/wanderingTapestryRestorer.js';     // T409
import { initImperialHarborMaster, imperialHarborMasterTick }          from './systems/imperialHarborMaster.js';           // T410
import { initWanderingBowMaker, wanderingBowMakerTick }               from './systems/wanderingBowMaker.js';              // T411
import { initImperialCheeseMerchant, imperialCheeseMerchantTick }     from './systems/imperialCheeseMerchant.js';         // T412
import { initWanderingThatcher, wanderingThatcherTick }               from './systems/wanderingThatcher.js';              // T413
import { initImperialMillstoneCutter, imperialMillstoneCutterTick }   from './systems/imperialMillstoneCutter.js';        // T414
import { initWanderingPeatCutter, wanderingPeatCutterTick }           from './systems/wanderingPeatCutter.js';            // T415
import { initImperialIconPainter, imperialIconPainterTick }           from './systems/imperialIconPainter.js';            // T416
import { initWanderingWaxTabletMaker, wanderingWaxTabletMakerTick }   from './systems/wanderingWaxTabletMaker.js';         // T417
import { initWanderingNetMaker, wanderingNetMakerTick }               from './systems/wanderingNetMaker.js';               // T418
import { initWanderingDrumMaker, wanderingDrumMakerTick }             from './systems/wanderingDrumMaker.js';               // T419
import { initImperialHerbariumKeeper, imperialHerbariumKeeperTick }   from './systems/imperialHerbariumKeeper.js';          // T420
import { initWanderingSpearMaker, wanderingSpearMakerTick }           from './systems/wanderingSpearMaker.js';              // T421
import { initImperialRobeMaker, imperialRobeMakerTick }               from './systems/imperialRobeMaker.js';                // T422
import { initWanderingFletcher, wanderingFletcherTick }               from './systems/wanderingFletcher.js';                // T423
import { initImperialKnifesmith, imperialKnifesmithTick }             from './systems/imperialKnifesmith.js';               // T424
import { initWanderingSailMaker, wanderingSailMakerTick }             from './systems/wanderingSailMaker.js';               // T425
import { initImperialChariotBuilder, imperialChariotBuilderTick }     from './systems/imperialChariotBuilder.js';           // T426
import { initWanderingSeedMerchant, wanderingSeedMerchantTick }       from './systems/wanderingSeedMerchant.js';             // T427
import { initImperialSilkscreenPainter, imperialSilkscreenPainterTick } from './systems/imperialSilkscreenPainter.js';      // T428
import { initWanderingWoodcutter, wanderingWoodcutterTick }           from './systems/wanderingWoodcutter.js';              // T429
import { initImperialMasonsGuild, imperialMasonsGuildTick }           from './systems/imperialMasonsGuild.js';              // T430
import { initWanderingKnifeSharpener, wanderingKnifeSharpenerTick }   from './systems/wanderingKnifeSharpener.js';          // T431
import { initImperialFrescoPainter, imperialFrescoPainterTick }       from './systems/imperialFrescoPainter.js';            // T432
import { initWanderingDyeMerchant, wanderingDyeMerchantTick }         from './systems/wanderingDyeMerchant.js';             // T433
import { initImperialCartographersAcademy, imperialCartographersAcademyTick } from './systems/imperialCartographersAcademy.js'; // T434

// ─── UI panels ──────────────────────────────────────────────────────────────────────────────
import { renderBuildingsPanel }                from './ui/buildingsPanel.js';
import { renderResearchPanel }                 from './ui/researchPanel.js';
import { renderMilitaryPanel }                 from './ui/militaryPanel.js';
import { renderDiplomacyPanel }                from './ui/diplomacyPanel.js';
import { renderTradePanel }                    from './ui/tradePanel.js';
import { renderMapPanel }                      from './ui/mapPanel.js';
import { renderQuestPanel }                    from './ui/questPanel.js';
import { renderAchievementsPanel }             from './ui/achievementsPanel.js';
import { renderStoryPanel }                    from './ui/storyPanel.js';
import { renderSettingsPanel }                 from './ui/settingsPanel.js';
import { renderLeaderboardPanel }              from './ui/leaderboardPanel.js';
import { renderEmpireSummaryPanel }            from './ui/empireSummaryPanel.js';

// ─── Constants ───────────────────────────────────────────────────────────────────────────────
const TICK_MS          = 1000;
const AUTOSAVE_TICKS   = 60;

// ─── Module-level refs ───────────────────────────────────────────────────────────────────────────
let _tickInterval   = null;
let _tickCount      = 0;
let _paused         = false;
let _gameOver       = false;
let _saveSlot       = 'empireOS_save';

// ─── System registration ───────────────────────────────────────────────────────────────────────────
function _registerAllSystems() {
  registerSystem(resourceTick);
  registerSystem(buildingsTick);
  registerSystem(researchTick);
  registerSystem(populationTick);
  registerSystem(moraleTick);
  registerSystem(corruptionTick);         // T203
  registerSystem(militaryTick);
  registerSystem(combatTick);
  registerSystem(diplomacyTick);
  registerSystem(tradeTick);
  registerSystem(mapTick);
  registerSystem(weatherTick);
  registerSystem(seasonsTick);
  registerSystem(agesTick);
  registerSystem(eventsTick);
  registerSystem(questsTick);
  registerSystem(storyTick);
  registerSystem(chronicleTick);
  registerSystem(relicsTick);
  registerSystem(religionTick);
  registerSystem(cultureTick);
  registerSystem(espionageTick);
  registerSystem(piracyTick);
  registerSystem(naturalDisastersTick);
  registerSystem(rebellionTick);
  registerSystem(famineTick);
  registerSystem(plagueTick);
  registerSystem(economyTick);
  registerSystem(dynastyTick);
  registerSystem(wondersTick);
  registerSystem(policiesTick);
  registerSystem(scienceTick);
  registerSystem(artisanTick);
  registerSystem(foreignTick);
  registerSystem(colonyTick);
  registerSystem(navyTick);
  registerSystem(expeditionTick);
  registerSystem(pilgrimageTick);
  registerSystem(mercenariesTick);
  registerSystem(intelligenceTick);
  registerSystem(harvestTick);
  registerSystem(festivalTick);
  registerSystem(tournamentTick);
  registerSystem(cavalryTick);
  registerSystem(siegeTick);
  registerSystem(fortificationsTick);
  registerSystem(coastalTick);
  registerSystem(spyTick);
  registerSystem(alchemyTick);
  registerSystem(taxationTick);
  registerSystem(astrologyTick);
  registerSystem(guildTick);
  registerSystem(heraldTick);
  registerSystem(censusTick);
  registerSystem(banditryTick);
  registerSystem(caravanTick);
  registerSystem(oracleTick);
  registerSystem(messengerTick);
  registerSystem(forestryTick);
  registerSystem(miningTick);
  registerSystem(irrigationTick);
  registerSystem(masonryTick);
  registerSystem(textileTick);
  registerSystem(potteryTick);
  registerSystem(leatherTick);
  registerSystem(jewelryTick);
  registerSystem(glassTick);
  registerSystem(paperTick);
  registerSystem(inkTick);
  registerSystem(candleTick);
  registerSystem(soapTick);
  registerSystem(ropeTick);
  registerSystem(saltTick);
  registerSystem(spiceTick);
  registerSystem(sugarTick);
  registerSystem(cottonTick);
  registerSystem(silkTick);
  registerSystem(woolTick);
  registerSystem(furTick);
  registerSystem(amberTick);
  registerSystem(ivoryTick);
  registerSystem(pearlTick);
  registerSystem(gemTick);
  registerSystem(dyeTick);
  registerSystem(perfumeTick);
  registerSystem(medicineTick);
  registerSystem(poisonTick);
  registerSystem(explosiveTick);
  registerSystem(stealthTick);
  registerSystem(diplomaticMarriageTick);
  registerSystem(royalDecreeTick);
  registerSystem(imperialEdictsTick);
  registerSystem(propagandaTick);
  registerSystem(censorshipTick);
  registerSystem(courtTick);
  registerSystem(nobilityTick);
  registerSystem(serfdomTick);
  registerSystem(slaveryTick);
  registerSystem(conquestTick);
  registerSystem(annexationTick);
  registerSystem(tributeTick);
  registerSystem(supplyDepotTick);
  registerSystem(climateAdaptationsTick);
  registerSystem(tradeEmbargoTick);
  registerSystem(lifetimeRecordsTick);
  registerSystem(plagueOutbreakTick);
  registerSystem(pilgrimageSystemTick);
  registerSystem(royalHuntTick);          // T214
  registerSystem(rovingWarlordTick);
  registerSystem(tributeDemandTick);
  registerSystem(blackMarketTick);
  registerSystem(nobleCouncilDemandTick);
  registerSystem(imperialVaultTick);
  registerSystem(diplomaticSummitTick);
  registerSystem(almanacTick);
  registerSystem(cartographerSurveyTick);
  registerSystem(relicShrineTick);
  registerSystem(fortificationNetworkTick);
  registerSystem(veteranCohesionTick);
  registerSystem(tradeRouteSpecializationsTick);
  registerSystem(victoryProgressTick);
  registerSystem(seasonalResearchAffinityTick);
  registerSystem(legendaryUnitsTick);
  registerSystem(tradeGuildHallTick);
  registerSystem(imperialMintTick);
  registerSystem(diplomaticEnvoyTick);
  registerSystem(oracleOfFateTick);
  registerSystem(artisanGuildsTick);
  registerSystem(grandVizierTick);
  registerSystem(annualTradeFairTick);
  registerSystem(tradeWindEventsTick);
  registerSystem(imperialTaxCollectorTick);
  registerSystem(wanderingArmyTick);
  registerSystem(provinceCouncilTick);
  registerSystem(epicQuestChainsTick);
  registerSystem(grandArenaTick);
  registerSystem(scoutReconnaissanceTick);
  registerSystem(resourceExchangePactTick);
  registerSystem(imperialCodexTick);
  registerSystem(legendaryEncountersTick);
  registerSystem(refugeeCrisisTick);
  registerSystem(silkRoadTick);
  registerSystem(imperialPropagandaTick);
  registerSystem(militaryIntelligenceTick);
  registerSystem(constructionDriveTick);
  registerSystem(peaceOvertureTick);
  registerSystem(buildingNetworkBonusesTick);
  registerSystem(armyCompositionSynergiesTick);
  registerSystem(royalForecastTick);
  registerSystem(warTrophyCollectionTick);
  registerSystem(alchemyWorkshopTick);
  registerSystem(wartimeRationingTick);
  registerSystem(peasantMilitiaTick);
  registerSystem(ancientPactTick);
  registerSystem(grandLibraryTick);
  registerSystem(marketPriceSurgeTick);
  registerSystem(seasonalHarvestTick);
  registerSystem(imperialGamesTick);
  registerSystem(royalLoanTick);
  registerSystem(imperialRecordsExchangeTick);
  registerSystem(nomadicTribeTick);
  registerSystem(wanderingProphetTick);
  registerSystem(artisanFairTick);
  registerSystem(empireEpithetTick);
  registerSystem(cosmicAlignmentTick);
  registerSystem(marketEconomyCycleTick);
  registerSystem(villageTributeCaravanTick);
  registerSystem(ancientOreVeinTick);
  registerSystem(wanderingHerbalistTick);
  registerSystem(travelingCircusTick);
  registerSystem(sacredSpringTick);
  registerSystem(wanderingBardTick);
  registerSystem(masterArtisanTick);
  registerSystem(mountainHermitTick);
  registerSystem(imperialJubileeTick);
  registerSystem(exiledPrinceTick);
  registerSystem(ancientGuardianTick);
  registerSystem(desertOasisTick);
  registerSystem(foreignDignitaryTick);
  registerSystem(lostCaravanTick);
  registerSystem(nomadicScholarTick);
  registerSystem(royalFeastTick);
  registerSystem(wanderingBlacksmithTick);
  registerSystem(travelingAstrologerTick);
  registerSystem(merchantPrinceTick);
  registerSystem(wanderingSageTick);         // T266
  registerSystem(masterForesterTick);       // T267
  registerSystem(forestSpiritTick);         // T268
  registerSystem(wanderingAlchemistTick);   // T269
  registerSystem(seafaringExplorerTick);    // T270
  registerSystem(travelingMonkTick);        // T271
  registerSystem(imperialCartographerTick); // T272
  registerSystem(wanderingOracleTick);     // T273
  registerSystem(royalEmissaryTick);       // T274
  registerSystem(wanderingTinkerTick);       // T275
  registerSystem(wanderingPhysicianTick);    // T276
  registerSystem(wanderingCartomancerTick);  // T277
  registerSystem(villageElderVisitTick);     // T278
  registerSystem(wanderingScribeTick);       // T279
  registerSystem(desertTraderTick);          // T280
  registerSystem(wanderingGemcutterTick);    // T281
  registerSystem(forestWardenTick);          // T282
  registerSystem(wanderingBeekeeperTick);    // T283
  registerSystem(stoneCarverTick);           // T284
  registerSystem(wanderingGlassblowerTick); // T285
  registerSystem(royalAstronomerTick);      // T286
  registerSystem(imperialHeraldTick);       // T287
  registerSystem(travelingPotterTick);      // T288
  registerSystem(wanderingDyerTick);        // T289
  registerSystem(frontierScoutTick);        // T290
  registerSystem(wanderingShipwrightTick);  // T291
  registerSystem(masterBrewerTick);                    // T292
  registerSystem(ancientManuscriptTraderTick);        // T293
  registerSystem(imperialSiegeEngineerTick);          // T294
  registerSystem(wanderingWeaverTick);                // T295
  registerSystem(travelingArchitectTick);             // T296
  registerSystem(wanderingFalconerTick);              // T297
  registerSystem(roamingBotanistTick);                // T298
  registerSystem(wanderingJewelerTick);               // T299
  registerSystem(desertNomadChiefTick);               // T300
  registerSystem(wanderingSculptorTick);              // T301
  registerSystem(royalVintnerTick);                   // T302
  registerSystem(wanderingMapmakerTick);              // T303
  registerSystem(royalPerfumerTick);                  // T304
  registerSystem(wanderingSilversmithTick);           // T305
  registerSystem(imperialSpiceMerchantTick);          // T306
  registerSystem(courtMusicianTick);                  // T307
  registerSystem(ancientLibraryKeeperTick);           // T308
  registerSystem(wanderingClockmakerTick);            // T309
  registerSystem(imperialWeaponsmithTick);            // T310
  registerSystem(wanderingStonemasonTick);            // T311
  registerSystem(imperialDyeMasterTick);              // T312
  registerSystem(wanderingNavigatorTick);             // T313
  registerSystem(travelingIlluminatorTick);           // T314
  registerSystem(ancientRitualLeaderTick);            // T315
  registerSystem(mountainProspectorTick);             // T316
  registerSystem(wanderingLeatherworkerTick);         // T317
  registerSystem(royalApothecaryTick);                // T318
  registerSystem(wanderingFishmongerTick);            // T319
  registerSystem(imperialChandlerTick);               // T320
  registerSystem(royalLamplighterTick);               // T321
  registerSystem(wanderingCooperTick);                // T322
  registerSystem(wanderingRopeMakerTick);             // T323
  registerSystem(imperialSaltMerchantTick);           // T324
  registerSystem(wanderingPuppeteerTick);             // T325
  registerSystem(ancientRuneCarverTick);              // T326
  registerSystem(wanderingCartwrightTick);            // T327
  registerSystem(imperialFarrierTick);               // T328
  registerSystem(wanderingCobblerTick);              // T329
  registerSystem(imperialEngraverTick);              // T330
  registerSystem(wanderingTailorTick);               // T331
  registerSystem(wanderingTinsmithTick);             // T332
  registerSystem(wanderingMillerTick);               // T333
  registerSystem(imperialCourierTick);               // T334
  registerSystem(wanderingBakerTick);                // T335
  registerSystem(imperialArmorerTick);               // T336
  registerSystem(wanderingWoodCarverTick);           // T337
  registerSystem(imperialRoadBuilderTick);           // T338
  registerSystem(wanderingEmbroidererTick);          // T339
  registerSystem(royalBookbinderTick);               // T340
  registerSystem(wanderingBasketweaverTick);         // T341
  registerSystem(wanderingCharcoalMakerTick);        // T342
  registerSystem(wanderingTannerTick);               // T343
  registerSystem(imperialGlassmakerTick);            // T344
  registerSystem(wanderingInkmakerTick);             // T345
  registerSystem(imperialDockmasterTick);            // T346
  registerSystem(wanderingStorytellerTick);          // T347
  registerSystem(imperialLoreMasterTick);            // T348
  registerSystem(wanderingToymakerTick);             // T349
  registerSystem(imperialFerrymanTick);              // T350
  registerSystem(wanderingMosaicMakerTick);          // T351
  registerSystem(imperialBathhouseBuilderTick);      // T352
  registerSystem(wanderingBellFounderTick);          // T353
  registerSystem(imperialMarbleCutterTick);          // T354
  registerSystem(wanderingParchmentMakerTick);       // T355
  registerSystem(wanderingIncenseMakerTick);         // T356
  registerSystem(wanderingFurrierTick);              // T357
  registerSystem(imperialWoolMerchantTick);          // T358
  registerSystem(wanderingHorseTraderTick);          // T359
  registerSystem(imperialSilkWeaverTick);            // T360
  registerSystem(wanderingGemMerchantTick);          // T361
  registerSystem(imperialSiegeMasterTick);           // T362
  registerSystem(wanderingHatMakerTick);             // T363
  registerSystem(imperialGoldsmithTick);             // T364
  registerSystem(wanderingOilMerchantTick);          // T365
  registerSystem(imperialQuarrymanTick);             // T366
  registerSystem(wanderingSoapMakerTick);            // T367
  registerSystem(imperialMetalcasterTick);           // T368
  registerSystem(wanderingGloveMakerTick);           // T369
  registerSystem(imperialTelescopeMakerTick);        // T370
  registerSystem(wanderingPaperMakerTick);           // T371
  registerSystem(imperialCoinMinterTick);            // T372
  registerSystem(wanderingCartographerGuildTick);   // T373
  registerSystem(imperialSpymasterTick);            // T374
  registerSystem(wanderingGemPolisherTick);         // T375
  registerSystem(imperialAstrolabeMakerTick);       // T376
  registerSystem(wanderingLocksmithTick);           // T377
  registerSystem(imperialCalligrapherTick);         // T378
  registerSystem(wanderingCoppersmithTick);         // T379
  registerSystem(imperialScrivenerTick);            // T380
  registerSystem(wanderingMirrorMakerTick);         // T381
  registerSystem(imperialFlowerMerchantTick);       // T382
  registerSystem(wanderingDressmakertick);          // T383
  registerSystem(imperialTileSetterTick);           // T384
  registerSystem(imperialBannerWeaverTick);         // T385
  registerSystem(wanderingBoneCarverTick);          // T386
  registerSystem(wanderingTapestryMakerTick);       // T387
  registerSystem(imperialSiegeArchitectTick);       // T388
  registerSystem(wanderingLuteMakerTick);           // T389
  registerSystem(imperialStonecutterGuildTick);     // T390
  registerSystem(wanderingCandlemakerTick);         // T391
  registerSystem(imperialGrainMerchantTick);        // T392
  registerSystem(wanderingFeltMakerTick);           // T393
  registerSystem(imperialVineyardMasterTick);       // T394
  registerSystem(wanderingHerbMerchantTick);        // T395
  registerSystem(imperialLanternMakerTick);         // T396
  registerSystem(wanderingInkMasterTick);           // T397
  registerSystem(wanderingSaltMerchantTick);        // T398
  registerSystem(wanderingBronzeSmithTick);         // T399
  registerSystem(imperialAqueductBuilderTick);      // T400
  registerSystem(wanderingGlassPainterTick);        // T401
  registerSystem(imperialSiegeCatapultEngineerTick); // T402
  registerSystem(wanderingWoolSpinnerTick);          // T403
  registerSystem(imperialAmberMerchantTick);         // T404
  registerSystem(wanderingSandglassMakerTick);       // T405
  registerSystem(imperialBridgeBuilderTick);         // T406
  registerSystem(wanderingChroniclerTick);           // T407
  registerSystem(imperialSurveyorTick);              // T408
  registerSystem(wanderingTapestryRestorerTick);    // T409
  registerSystem(imperialHarborMasterTick);         // T410
  registerSystem(wanderingBowMakerTick);            // T411
  registerSystem(imperialCheeseMerchantTick);       // T412
  registerSystem(wanderingThatcherTick);            // T413
  registerSystem(imperialMillstoneCutterTick);      // T414
  registerSystem(wanderingPeatCutterTick);          // T415
  registerSystem(imperialIconPainterTick);          // T416
  registerSystem(wanderingWaxTabletMakerTick);      // T417
  registerSystem(wanderingNetMakerTick);            // T418
  registerSystem(wanderingDrumMakerTick);           // T419
  registerSystem(imperialHerbariumKeeperTick);      // T420
  registerSystem(wanderingSpearMakerTick);          // T421
  registerSystem(imperialRobeMakerTick);            // T422
  registerSystem(wanderingFletcherTick);            // T423
  registerSystem(imperialKnifesmithTick);           // T424
  registerSystem(wanderingSailMakerTick);           // T425
  registerSystem(imperialChariotBuilderTick);       // T426
  registerSystem(wanderingSeedMerchantTick);        // T427
  registerSystem(imperialSilkscreenPainterTick);    // T428
  registerSystem(wanderingWoodcutterTick);          // T429
  registerSystem(imperialMasonsGuildTick);          // T430
  registerSystem(wanderingKnifeSharpenerTick);      // T431
  registerSystem(imperialFrescoPainterTick);        // T432
  registerSystem(wanderingDyeMerchantTick);         // T433
  registerSystem(imperialCartographersAcademyTick); // T434
  registerSystem(achievementsTick);
  registerSystem(leaderboardTick);
}

// ─── Save / Load ──────────────────────────────────────────────────────────────────────────────
function _save() {
  const s = {
    version:              2,
    gold:                 state.gold,
    food:                 state.food,
    wood:                 state.wood,
    stone:                state.stone,
    iron:                 state.iron,
    population:           state.population,
    morale:               state.morale,
    corruption:           state.corruption,
    buildings:            state.buildings,
    research:             state.research,
    military:             state.military,
    diplomacy:            state.diplomacy,
    trade:                state.trade,
    map:                  state.map,
    quests:               state.quests,
    achievements:         state.achievements,
    events:               state.events,
    seasons:              state.seasons,
    ages:                 state.ages,
    story:                state.story,
    chronicle:            state.chronicle,
    leaderboard:          state.leaderboard,
    relics:               state.relics,
    religion:             state.religion,
    culture:              state.culture,
    espionage:            state.espionage,
    piracy:               state.piracy,
    naturalDisasters:     state.naturalDisasters,
    rebellion:            state.rebellion,
    famine:               state.famine,
    plague:               state.plague,
    economy:              state.economy,
    dynasty:              state.dynasty,
    wonders:              state.wonders,
    policies:             state.policies,
    science:              state.science,
    artisan:              state.artisan,
    foreign:              state.foreign,
    colony:               state.colony,
    navy:                 state.navy,
    expedition:           state.expedition,
    pilgrimage:           state.pilgrimage,
    mercenaries:          state.mercenaries,
    intelligence:         state.intelligence,
    harvest:              state.harvest,
    festival:             state.festival,
    tournament:           state.tournament,
    cavalry:              state.cavalry,
    siege:                state.siege,
    fortifications:       state.fortifications,
    coastal:              state.coastal,
    spy:                  state.spy,
    alchemy:              state.alchemy,
    taxation:             state.taxation,
    astrology:            state.astrology,
    guild:                state.guild,
    herald:               state.herald,
    census:               state.census,
    banditry:             state.banditry,
    caravan:              state.caravan,
    oracle:               state.oracle,
    messenger:            state.messenger,
    forestry:             state.forestry,
    mining:               state.mining,
    irrigation:           state.irrigation,
    masonry:              state.masonry,
    textile:              state.textile,
    pottery:              state.pottery,
    leather:              state.leather,
    jewelry:              state.jewelry,
    glass:                state.glass,
    paper:                state.paper,
    ink:                  state.ink,
    candle:               state.candle,
    soap:                 state.soap,
    rope:                 state.rope,
    salt:                 state.salt,
    spice:                state.spice,
    sugar:                state.sugar,
    cotton:               state.cotton,
    silk:                 state.silk,
    wool:                 state.wool,
    fur:                  state.fur,
    amber:                state.amber,
    ivory:                state.ivory,
    pearl:                state.pearl,
    gem:                  state.gem,
    dye:                  state.dye,
    perfume:              state.perfume,
    medicine:             state.medicine,
    poison:               state.poison,
    explosive:            state.explosive,
    stealth:              state.stealth,
    diplomaticMarriage:   state.diplomaticMarriage,
    royalDecree:          state.royalDecree,
    imperialEdicts:       state.imperialEdicts,
    propaganda:           state.propaganda,
    censorship:           state.censorship,
    court:                state.court,
    nobility:             state.nobility,
    serfdom:              state.serfdom,
    slavery:              state.slavery,
    conquest:             state.conquest,
    annexation:           state.annexation,
    tribute:              state.tribute,
    supplyDepot:          state.supplyDepot,
    climateAdaptations:   state.climateAdaptations,
    tradeEmbargo:         state.tradeEmbargo,
    lifetimeRecords:      state.lifetimeRecords,
    plagueOutbreak:       state.plagueOutbreak,
    pilgrimageSystem:     state.pilgrimageSystem,
    royalHunt:            state.royalHunt,      // T214
    rovingWarlord:        state.rovingWarlord,
    tributeDemand:        state.tributeDemand,
    blackMarket:          state.blackMarket,
    nobleCouncilDemand:   state.nobleCouncilDemand,
    imperialVault:        state.imperialVault,
    diplomaticSummit:     state.diplomaticSummit,
    almanac:              state.almanac,
    cartographerSurvey:   state.cartographerSurvey,
    relicShrine:          state.relicShrine,
    fortificationNetwork: state.fortificationNetwork,
    veteranCohesion:      state.veteranCohesion,
    tradeRouteSpecializations: state.tradeRouteSpecializations,
    victoryProgress:      state.victoryProgress,
    seasonalResearchAffinity: state.seasonalResearchAffinity,
    legendaryUnits:       state.legendaryUnits,
    tradeGuildHall:       state.tradeGuildHall,
    imperialMint:         state.imperialMint,
    diplomaticEnvoy:      state.diplomaticEnvoy,
    oracleOfFate:         state.oracleOfFate,
    artisanGuilds:        state.artisanGuilds,
    grandVizier:          state.grandVizier,
    annualTradeFair:      state.annualTradeFair,
    tradeWindEvents:      state.tradeWindEvents,
    imperialTaxCollector: state.imperialTaxCollector,
    wanderingArmy:        state.wanderingArmy,
    provinceCouncil:      state.provinceCouncil,
    epicQuestChains:      state.epicQuestChains,
    corruption:           state.corruption,     // T203
    grandArena:           state.grandArena,
    scoutReconnaissance:  state.scoutReconnaissance,
    resourceExchangePact: state.resourceExchangePact,
    imperialCodex:        state.imperialCodex,
    legendaryEncounters:  state.legendaryEncounters,
    refugeeCrisis:        state.refugeeCrisis,
    silkRoad:             state.silkRoad,
    imperialPropaganda:   state.imperialPropaganda,
    militaryIntelligence: state.militaryIntelligence,
    constructionDrive:    state.constructionDrive,
    peaceOverture:        state.peaceOverture,
    buildingNetworkBonuses: state.buildingNetworkBonuses,
    armyCompositionSynergies: state.armyCompositionSynergies,
    royalForecast:        state.royalForecast,
    warTrophyCollection:  state.warTrophyCollection,
    alchemyWorkshop:      state.alchemyWorkshop,
    wartimeRationing:     state.wartimeRationing,
    peasantMilitia:       state.peasantMilitia,
    ancientPact:          state.ancientPact,
    grandLibrary:         state.grandLibrary,
    marketPriceSurge:     state.marketPriceSurge,
    seasonalHarvest:      state.seasonalHarvest,
    imperialGames:        state.imperialGames,
    royalLoan:            state.royalLoan,
    imperialRecordsExchange: state.imperialRecordsExchange,
    nomadicTribe:         state.nomadicTribe,
    wanderingProphet:     state.wanderingProphet,
    artisanFair:          state.artisanFair,
    empireEpithet:        state.empireEpithet,
    cosmicAlignment:      state.cosmicAlignment,
    marketEconomyCycle:   state.marketEconomyCycle,
    villageTributeCaravan: state.villageTributeCaravan,
    ancientOreVein:       state.ancientOreVein,
    wanderingHerbalist:   state.wanderingHerbalist,
    travelingCircus:      state.travelingCircus,
    sacredSpring:         state.sacredSpring,
    wanderingBard:        state.wanderingBard,
    masterArtisan:        state.masterArtisan,
    mountainHermit:       state.mountainHermit,
    imperialJubilee:      state.imperialJubilee,
    exiledPrince:         state.exiledPrince,
    ancientGuardian:      state.ancientGuardian,
    desertOasis:          state.desertOasis,
    foreignDignitary:     state.foreignDignitary,
    lostCaravan:          state.lostCaravan,
    nomadicScholar:       state.nomadicScholar,
    royalFeast:           state.royalFeast,
    wanderingBlacksmith:  state.wanderingBlacksmith,
    travelingAstrologer:  state.travelingAstrologer,
    merchantPrince:       state.merchantPrince,
    wanderingSage:        state.wanderingSage,           // T266
    masterForester:       state.masterForester,         // T267
    forestSpirit:         state.forestSpirit,           // T268
    wanderingAlchemist:   state.wanderingAlchemist,     // T269
    seafaringExplorer:    state.seafaringExplorer,      // T270
    travelingMonk:        state.travelingMonk,          // T271
    imperialCartographer: state.imperialCartographer,   // T272
    wanderingOracle:      state.wanderingOracle,        // T273
    royalEmissary:        state.royalEmissary,          // T274
    wanderingTinker:       state.wanderingTinker,          // T275
    wanderingPhysician:    state.wanderingPhysician,       // T276
    wanderingCartomancer:  state.wanderingCartomancer,     // T277
    villageElderVisit:     state.villageElderVisit,        // T278
    wanderingScribe:       state.wanderingScribe,          // T279
    desertTrader:          state.desertTrader,             // T280
    wanderingGemcutter:    state.wanderingGemcutter,       // T281
    forestWarden:          state.forestWarden,             // T282
    wanderingBeekeeper:    state.wanderingBeekeeper,       // T283
    stoneCarver:           state.stoneCarver,              // T284
    wanderingGlassblower:  state.wanderingGlassblower,     // T285
    royalAstronomer:       state.royalAstronomer,          // T286
    imperialHerald:        state.imperialHerald,           // T287
    travelingPotter:       state.travelingPotter,          // T288
    wanderingDyer:         state.wanderingDyer,            // T289
    frontierScout:         state.frontierScout,            // T290
    wanderingShipwright:   state.wanderingShipwright,      // T291
    masterBrewer:               state.masterBrewer,               // T292
    ancientManuscriptTrader:    state.ancientManuscriptTrader,    // T293
    imperialSiegeEngineer:      state.imperialSiegeEngineer,      // T294
    wanderingWeaver:            state.wanderingWeaver,            // T295
    travelingArchitect:         state.travelingArchitect,         // T296
    wanderingFalconer:          state.wanderingFalconer,          // T297
    roamingBotanist:            state.roamingBotanist,            // T298
    wanderingJeweler:           state.wanderingJeweler,           // T299
    desertNomadChief:           state.desertNomadChief,           // T300
    wanderingSculptor:          state.wanderingSculptor,          // T301
    royalVintner:               state.royalVintner,               // T302
    wanderingMapmaker:          state.wanderingMapmaker,          // T303
    royalPerfumer:              state.royalPerfumer,              // T304
    wanderingSilversmith:       state.wanderingSilversmith,       // T305
    imperialSpiceMerchant:      state.imperialSpiceMerchant,      // T306
    courtMusician:              state.courtMusician,              // T307
    ancientLibraryKeeper:       state.ancientLibraryKeeper,       // T308
    wanderingClockmaker:        state.wanderingClockmaker,        // T309
    imperialWeaponsmith:        state.imperialWeaponsmith,        // T310
    wanderingStonemason:        state.wanderingStonemason,        // T311
    imperialDyeMaster:          state.imperialDyeMaster,          // T312
    wanderingNavigator:         state.wanderingNavigator,         // T313
    travelingIlluminator:       state.travelingIlluminator,       // T314
    ancientRitualLeader:        state.ancientRitualLeader,        // T315
    mountainProspector:         state.mountainProspector,         // T316
    wanderingLeatherworker:     state.wanderingLeatherworker,     // T317
    royalApothecary:            state.royalApothecary,            // T318
    wanderingFishmonger:        state.wanderingFishmonger,        // T319
    imperialChandler:           state.imperialChandler,           // T320
    royalLamplighter:           state.royalLamplighter,           // T321
    wanderingCooper:            state.wanderingCooper,            // T322
    wanderingRopeMaker:         state.wanderingRopeMaker,         // T323
    imperialSaltMerchant:       state.imperialSaltMerchant,       // T324
    wanderingPuppeteer:         state.wanderingPuppeteer,         // T325
    ancientRuneCarver:          state.ancientRuneCarver,          // T326
    wanderingCartwright:        state.wanderingCartwright,        // T327
    imperialFarrier:            state.imperialFarrier,            // T328
    wanderingCobbler:           state.wanderingCobbler,           // T329
    imperialEngraver:           state.imperialEngraver,           // T330
    wanderingTailor:            state.wanderingTailor,            // T331
    wanderingTinsmith:          state.wanderingTinsmith,          // T332
    wanderingMiller:            state.wanderingMiller,            // T333
    imperialCourier:            state.imperialCourier,            // T334
    wanderingBaker:             state.wanderingBaker,             // T335
    imperialArmorer:            state.imperialArmorer,            // T336
    wanderingWoodCarver:        state.wanderingWoodCarver,        // T337
    imperialRoadBuilder:        state.imperialRoadBuilder,        // T338
    wanderingEmbroiderer:       state.wanderingEmbroiderer,       // T339
    royalBookbinder:            state.royalBookbinder,            // T340
    wanderingBasketweaver:      state.wanderingBasketweaver,      // T341
    wanderingCharcoalMaker:     state.wanderingCharcoalMaker,     // T342
    wanderingTanner:            state.wanderingTanner,            // T343
    imperialGlassmaker:         state.imperialGlassmaker,         // T344
    wanderingInkmaker:          state.wanderingInkmaker,          // T345
    imperialDockmaster:         state.imperialDockmaster,         // T346
    wanderingStoryteller:       state.wanderingStoryteller,       // T347
    imperialLoreMaster:         state.imperialLoreMaster,         // T348
    wanderingToymaker:          state.wanderingToymaker,          // T349
    imperialFerryman:           state.imperialFerryman,           // T350
    wanderingMosaicMaker:       state.wanderingMosaicMaker,       // T351
    imperialBathhouseBuilder:   state.imperialBathhouseBuilder,   // T352
    wanderingBellFounder:       state.wanderingBellFounder,       // T353
    imperialMarbleCutter:       state.imperialMarbleCutter,       // T354
    wanderingParchmentMaker:    state.wanderingParchmentMaker,    // T355
    wanderingIncenseMaker:      state.wanderingIncenseMaker,      // T356
    wanderingFurrier:           state.wanderingFurrier,           // T357
    imperialWoolMerchant:       state.imperialWoolMerchant,       // T358
    wanderingHorseTrader:       state.wanderingHorseTrader,       // T359
    imperialSilkWeaver:         state.imperialSilkWeaver,         // T360
    wanderingGemMerchant:       state.wanderingGemMerchant,       // T361
    imperialSiegeMaster:        state.imperialSiegeMaster,        // T362
    wanderingHatMaker:          state.wanderingHatMaker,          // T363
    imperialGoldsmith:          state.imperialGoldsmith,          // T364
    wanderingOilMerchant:       state.wanderingOilMerchant,       // T365
    imperialQuarryman:          state.imperialQuarryman,          // T366
    wanderingSoapMaker:         state.wanderingSoapMaker,         // T367
    imperialMetalcaster:        state.imperialMetalcaster,        // T368
    wanderingGloveMaker:        state.wanderingGloveMaker,        // T369
    imperialTelescopeMaker:     state.imperialTelescopeMaker,     // T370
    wanderingPaperMaker:        state.wanderingPaperMaker,        // T371
    imperialCoinMinter:            state.imperialCoinMinter,            // T372
    wanderingCartographerGuild:    state.wanderingCartographerGuild,    // T373
    imperialSpymaster:             state.imperialSpymaster,             // T374
    wanderingGemPolisher:          state.wanderingGemPolisher,          // T375
    imperialAstrolabeMaker:        state.imperialAstrolabeMaker,        // T376
    wanderingLocksmith:            state.wanderingLocksmith,            // T377
    imperialCalligrapher:          state.imperialCalligrapher,          // T378
    wanderingCoppersmith:          state.wanderingCoppersmith,          // T379
    imperialScrivener:             state.imperialScrivener,             // T380
    wanderingMirrorMaker:          state.wanderingMirrorMaker,          // T381
    imperialFlowerMerchant:        state.imperialFlowerMerchant,        // T382
    wanderingDressmaker:           state.wanderingDressmaker,           // T383
    imperialTileSetter:            state.imperialTileSetter,            // T384
    imperialBannerWeaver:          state.imperialBannerWeaver,          // T385
    wanderingBoneCarver:           state.wanderingBoneCarver,           // T386
    wanderingTapestryMaker:        state.wanderingTapestryMaker,        // T387
    imperialSiegeArchitect:        state.imperialSiegeArchitect,        // T388
    wanderingLuteMaker:            state.wanderingLuteMaker,            // T389
    imperialStonecutterGuild:      state.imperialStonecutterGuild,      // T390
    wanderingCandlemaker:          state.wanderingCandlemaker,          // T391
    imperialGrainMerchant:         state.imperialGrainMerchant,         // T392
    wanderingFeltMaker:            state.wanderingFeltMaker,            // T393
    imperialVineyardMaster:        state.imperialVineyardMaster,        // T394
    wanderingHerbMerchant:         state.wanderingHerbMerchant,         // T395
    imperialLanternMaker:          state.imperialLanternMaker,          // T396
    wanderingInkMaster:            state.wanderingInkMaster,            // T397
    wanderingSaltMerchant:         state.wanderingSaltMerchant,         // T398
    wanderingBronzeSmith:          state.wanderingBronzeSmith,          // T399
    imperialAqueductBuilder:       state.imperialAqueductBuilder,       // T400
    wanderingGlassPainter:         state.wanderingGlassPainter,         // T401
    imperialSiegeCatapultEngineer: state.imperialSiegeCatapultEngineer, // T402
    wanderingWoolSpinner:          state.wanderingWoolSpinner,          // T403
    imperialAmberMerchant:         state.imperialAmberMerchant,         // T404
    wanderingSandglassMaker:       state.wanderingSandglassMaker,       // T405
    imperialBridgeBuilder:         state.imperialBridgeBuilder,         // T406
    wanderingChronicler:           state.wanderingChronicler,           // T407
    imperialSurveyor:              state.imperialSurveyor,              // T408
    wanderingTapestryRestorer:    state.wanderingTapestryRestorer,    // T409
    imperialHarborMaster:         state.imperialHarborMaster,         // T410
    wanderingBowMaker:            state.wanderingBowMaker,            // T411
    imperialCheeseMerchant:       state.imperialCheeseMerchant,       // T412
    wanderingThatcher:            state.wanderingThatcher,            // T413
    imperialMillstoneCutter:      state.imperialMillstoneCutter,      // T414
    wanderingPeatCutter:          state.wanderingPeatCutter,          // T415
    imperialIconPainter:          state.imperialIconPainter,          // T416
    wanderingWaxTabletMaker:      state.wanderingWaxTabletMaker,      // T417
    wanderingNetMaker:            state.wanderingNetMaker,            // T418
    wanderingDrumMaker:           state.wanderingDrumMaker,           // T419
    imperialHerbariumKeeper:      state.imperialHerbariumKeeper,      // T420
    wanderingSpearMaker:          state.wanderingSpearMaker,          // T421
    imperialRobeMaker:            state.imperialRobeMaker,            // T422
    wanderingFletcher:            state.wanderingFletcher,            // T423
    imperialKnifesmith:           state.imperialKnifesmith,           // T424
    wanderingSailMaker:           state.wanderingSailMaker,           // T425
    imperialChariotBuilder:       state.imperialChariotBuilder,       // T426
    wanderingSeedMerchant:        state.wanderingSeedMerchant,        // T427
    imperialSilkscreenPainter:    state.imperialSilkscreenPainter,    // T428
    wanderingWoodcutter:          state.wanderingWoodcutter,          // T429
    imperialMasonsGuild:          state.imperialMasonsGuild,          // T430
    wanderingKnifeSharpener:      state.wanderingKnifeSharpener,      // T431
    imperialFrescoPainter:        state.imperialFrescoPainter,        // T432
    wanderingDyeMerchant:         state.wanderingDyeMerchant,         // T433
    imperialCartographersAcademy: state.imperialCartographersAcademy, // T434
    ticker:               _tickCount,
    empireName:           state.empireName,
    rulerName:            state.rulerName,
    difficulty:           state.difficulty,
    gameStarted:          state.gameStarted,
  };
  try {
    localStorage.setItem(_saveSlot, JSON.stringify(s));
  } catch (e) {
    console.warn('Save failed:', e);
  }
}

function _applySave(s) {
  state.gold                  = s.gold                  ?? state.gold;
  state.food                  = s.food                  ?? state.food;
  state.wood                  = s.wood                  ?? state.wood;
  state.stone                 = s.stone                 ?? state.stone;
  state.iron                  = s.iron                  ?? state.iron;
  state.population            = s.population            ?? state.population;
  state.morale                = s.morale                ?? state.morale;
  state.corruption            = s.corruption            ?? state.corruption;
  state.buildings             = s.buildings             ?? state.buildings;
  state.research              = s.research              ?? state.research;
  state.military              = s.military              ?? state.military;
  state.diplomacy             = s.diplomacy             ?? state.diplomacy;
  state.trade                 = s.trade                 ?? state.trade;
  state.map                   = s.map                   ?? state.map;
  state.quests                = s.quests                ?? state.quests;
  state.achievements          = s.achievements          ?? state.achievements;
  state.events                = s.events                ?? state.events;
  state.seasons               = s.seasons               ?? state.seasons;
  state.ages                  = s.ages                  ?? state.ages;
  state.story                 = s.story                 ?? state.story;
  state.chronicle             = s.chronicle             ?? state.chronicle;
  state.leaderboard           = s.leaderboard           ?? state.leaderboard;
  state.relics                = s.relics                ?? state.relics;
  state.religion              = s.religion              ?? state.religion;
  state.culture               = s.culture               ?? state.culture;
  state.espionage             = s.espionage             ?? state.espionage;
  state.piracy                = s.piracy                ?? state.piracy;
  state.naturalDisasters      = s.naturalDisasters      ?? state.naturalDisasters;
  state.rebellion             = s.rebellion             ?? state.rebellion;
  state.famine                = s.famine                ?? state.famine;
  state.plague                = s.plague                ?? state.plague;
  state.economy               = s.economy               ?? state.economy;
  state.dynasty               = s.dynasty               ?? state.dynasty;
  state.wonders               = s.wonders               ?? state.wonders;
  state.policies              = s.policies              ?? state.policies;
  state.science               = s.science               ?? state.science;
  state.artisan               = s.artisan               ?? state.artisan;
  state.foreign               = s.foreign               ?? state.foreign;
  state.colony                = s.colony                ?? state.colony;
  state.navy                  = s.navy                  ?? state.navy;
  state.expedition            = s.expedition            ?? state.expedition;
  state.pilgrimage            = s.pilgrimage            ?? state.pilgrimage;
  state.mercenaries           = s.mercenaries           ?? state.mercenaries;
  state.intelligence          = s.intelligence          ?? state.intelligence;
  state.harvest               = s.harvest               ?? state.harvest;
  state.festival              = s.festival              ?? state.festival;
  state.tournament            = s.tournament            ?? state.tournament;
  state.cavalry               = s.cavalry               ?? state.cavalry;
  state.siege                 = s.siege                 ?? state.siege;
  state.fortifications        = s.fortifications        ?? state.fortifications;
  state.coastal               = s.coastal               ?? state.coastal;
  state.spy                   = s.spy                   ?? state.spy;
  state.alchemy               = s.alchemy               ?? state.alchemy;
  state.taxation              = s.taxation              ?? state.taxation;
  state.astrology             = s.astrology             ?? state.astrology;
  state.guild                 = s.guild                 ?? state.guild;
  state.herald                = s.herald                ?? state.herald;
  state.census                = s.census                ?? state.census;
  state.banditry              = s.banditry              ?? state.banditry;
  state.caravan               = s.caravan               ?? state.caravan;
  state.oracle                = s.oracle                ?? state.oracle;
  state.messenger             = s.messenger             ?? state.messenger;
  state.forestry              = s.forestry              ?? state.forestry;
  state.mining                = s.mining                ?? state.mining;
  state.irrigation            = s.irrigation            ?? state.irrigation;
  state.masonry               = s.masonry               ?? state.masonry;
  state.textile               = s.textile               ?? state.textile;
  state.pottery               = s.pottery               ?? state.pottery;
  state.leather               = s.leather               ?? state.leather;
  state.jewelry               = s.jewelry               ?? state.jewelry;
  state.glass                 = s.glass                 ?? state.glass;
  state.paper                 = s.paper                 ?? state.paper;
  state.ink                   = s.ink                   ?? state.ink;
  state.candle                = s.candle                ?? state.candle;
  state.soap                  = s.soap                  ?? state.soap;
  state.rope                  = s.rope                  ?? state.rope;
  state.salt                  = s.salt                  ?? state.salt;
  state.spice                 = s.spice                 ?? state.spice;
  state.sugar                 = s.sugar                 ?? state.sugar;
  state.cotton                = s.cotton                ?? state.cotton;
  state.silk                  = s.silk                  ?? state.silk;
  state.wool                  = s.wool                  ?? state.wool;
  state.fur                   = s.fur                   ?? state.fur;
  state.amber                 = s.amber                 ?? state.amber;
  state.ivory                 = s.ivory                 ?? state.ivory;
  state.pearl                 = s.pearl                 ?? state.pearl;
  state.gem                   = s.gem                   ?? state.gem;
  state.dye                   = s.dye                   ?? state.dye;
  state.perfume               = s.perfume               ?? state.perfume;
  state.medicine              = s.medicine              ?? state.medicine;
  state.poison                = s.poison                ?? state.poison;
  state.explosive             = s.explosive             ?? state.explosive;
  state.stealth               = s.stealth               ?? state.stealth;
  state.diplomaticMarriage    = s.diplomaticMarriage    ?? state.diplomaticMarriage;
  state.royalDecree           = s.royalDecree           ?? state.royalDecree;
  state.imperialEdicts        = s.imperialEdicts        ?? state.imperialEdicts;
  state.propaganda            = s.propaganda            ?? state.propaganda;
  state.censorship            = s.censorship            ?? state.censorship;
  state.court                 = s.court                 ?? state.court;
  state.nobility              = s.nobility              ?? state.nobility;
  state.serfdom               = s.serfdom               ?? state.serfdom;
  state.slavery               = s.slavery               ?? state.slavery;
  state.conquest              = s.conquest              ?? state.conquest;
  state.annexation            = s.annexation            ?? state.annexation;
  state.tribute               = s.tribute               ?? state.tribute;
  state.supplyDepot           = s.supplyDepot           ?? state.supplyDepot;
  state.climateAdaptations    = s.climateAdaptations    ?? state.climateAdaptations;
  state.tradeEmbargo          = s.tradeEmbargo          ?? state.tradeEmbargo;
  state.lifetimeRecords       = s.lifetimeRecords       ?? state.lifetimeRecords;
  state.plagueOutbreak        = s.plagueOutbreak        ?? state.plagueOutbreak;
  state.pilgrimageSystem      = s.pilgrimageSystem      ?? state.pilgrimageSystem;
  state.royalHunt             = s.royalHunt             ?? null; // T214
  state.rovingWarlord         = s.rovingWarlord         ?? state.rovingWarlord;
  state.tributeDemand         = s.tributeDemand         ?? state.tributeDemand;
  state.blackMarket           = s.blackMarket           ?? state.blackMarket;
  state.nobleCouncilDemand    = s.nobleCouncilDemand    ?? state.nobleCouncilDemand;
  state.imperialVault         = s.imperialVault         ?? state.imperialVault;
  state.diplomaticSummit      = s.diplomaticSummit      ?? state.diplomaticSummit;
  state.almanac               = s.almanac               ?? state.almanac;
  state.cartographerSurvey    = s.cartographerSurvey    ?? state.cartographerSurvey;
  state.relicShrine           = s.relicShrine           ?? state.relicShrine;
  state.fortificationNetwork  = s.fortificationNetwork  ?? state.fortificationNetwork;
  state.veteranCohesion       = s.veteranCohesion       ?? state.veteranCohesion;
  state.tradeRouteSpecializations = s.tradeRouteSpecializations ?? state.tradeRouteSpecializations;
  state.victoryProgress       = s.victoryProgress       ?? state.victoryProgress;
  state.seasonalResearchAffinity = s.seasonalResearchAffinity ?? state.seasonalResearchAffinity;
  state.legendaryUnits        = s.legendaryUnits        ?? state.legendaryUnits;
  state.tradeGuildHall        = s.tradeGuildHall        ?? state.tradeGuildHall;
  state.imperialMint          = s.imperialMint          ?? state.imperialMint;
  state.diplomaticEnvoy       = s.diplomaticEnvoy       ?? state.diplomaticEnvoy;
  state.oracleOfFate          = s.oracleOfFate          ?? state.oracleOfFate;
  state.artisanGuilds         = s.artisanGuilds         ?? state.artisanGuilds;
  state.grandVizier           = s.grandVizier           ?? state.grandVizier;
  state.annualTradeFair       = s.annualTradeFair       ?? state.annualTradeFair;
  state.tradeWindEvents       = s.tradeWindEvents       ?? state.tradeWindEvents;
  state.imperialTaxCollector  = s.imperialTaxCollector  ?? state.imperialTaxCollector;
  state.wanderingArmy         = s.wanderingArmy         ?? state.wanderingArmy;
  state.provinceCouncil       = s.provinceCouncil       ?? state.provinceCouncil;
  state.epicQuestChains       = s.epicQuestChains       ?? state.epicQuestChains;
  state.grandArena            = s.grandArena            ?? state.grandArena;
  state.scoutReconnaissance   = s.scoutReconnaissance   ?? state.scoutReconnaissance;
  state.resourceExchangePact  = s.resourceExchangePact  ?? state.resourceExchangePact;
  state.imperialCodex         = s.imperialCodex         ?? state.imperialCodex;
  state.legendaryEncounters   = s.legendaryEncounters   ?? state.legendaryEncounters;
  state.refugeeCrisis         = s.refugeeCrisis         ?? state.refugeeCrisis;
  state.silkRoad              = s.silkRoad              ?? state.silkRoad;
  state.imperialPropaganda    = s.imperialPropaganda    ?? state.imperialPropaganda;
  state.militaryIntelligence  = s.militaryIntelligence  ?? state.militaryIntelligence;
  state.constructionDrive     = s.constructionDrive     ?? state.constructionDrive;
  state.peaceOverture         = s.peaceOverture         ?? state.peaceOverture;
  state.buildingNetworkBonuses = s.buildingNetworkBonuses ?? state.buildingNetworkBonuses;
  state.armyCompositionSynergies = s.armyCompositionSynergies ?? state.armyCompositionSynergies;
  state.royalForecast         = s.royalForecast         ?? state.royalForecast;
  state.warTrophyCollection   = s.warTrophyCollection   ?? state.warTrophyCollection;
  state.alchemyWorkshop       = s.alchemyWorkshop       ?? state.alchemyWorkshop;
  state.wartimeRationing      = s.wartimeRationing      ?? state.wartimeRationing;
  state.peasantMilitia        = s.peasantMilitia        ?? state.peasantMilitia;
  state.ancientPact           = s.ancientPact           ?? state.ancientPact;
  state.grandLibrary          = s.grandLibrary          ?? state.grandLibrary;
  state.marketPriceSurge      = s.marketPriceSurge      ?? state.marketPriceSurge;
  state.seasonalHarvest       = s.seasonalHarvest       ?? state.seasonalHarvest;
  state.imperialGames         = s.imperialGames         ?? state.imperialGames;
  state.royalLoan             = s.royalLoan             ?? state.royalLoan;
  state.imperialRecordsExchange = s.imperialRecordsExchange ?? state.imperialRecordsExchange;
  state.nomadicTribe          = s.nomadicTribe          ?? state.nomadicTribe;
  state.wanderingProphet      = s.wanderingProphet      ?? state.wanderingProphet;
  state.artisanFair           = s.artisanFair           ?? state.artisanFair;
  state.empireEpithet         = s.empireEpithet         ?? state.empireEpithet;
  state.cosmicAlignment       = s.cosmicAlignment       ?? state.cosmicAlignment;
  state.marketEconomyCycle    = s.marketEconomyCycle    ?? state.marketEconomyCycle;
  state.villageTributeCaravan = s.villageTributeCaravan ?? state.villageTributeCaravan;
  state.ancientOreVein        = s.ancientOreVein        ?? state.ancientOreVein;
  state.wanderingHerbalist    = s.wanderingHerbalist    ?? state.wanderingHerbalist;
  state.travelingCircus       = s.travelingCircus       ?? state.travelingCircus;
  state.sacredSpring          = s.sacredSpring          ?? state.sacredSpring;
  state.wanderingBard         = s.wanderingBard         ?? state.wanderingBard;
  state.masterArtisan         = s.masterArtisan         ?? state.masterArtisan;
  state.mountainHermit        = s.mountainHermit        ?? state.mountainHermit;
  state.imperialJubilee       = s.imperialJubilee       ?? state.imperialJubilee;
  state.exiledPrince          = s.exiledPrince          ?? state.exiledPrince;
  state.ancientGuardian       = s.ancientGuardian       ?? state.ancientGuardian;
  state.desertOasis           = s.desertOasis           ?? state.desertOasis;
  state.foreignDignitary      = s.foreignDignitary      ?? state.foreignDignitary;
  state.lostCaravan           = s.lostCaravan           ?? state.lostCaravan;
  state.nomadicScholar        = s.nomadicScholar        ?? state.nomadicScholar;
  state.royalFeast            = s.royalFeast            ?? state.royalFeast;
  state.wanderingBlacksmith   = s.wanderingBlacksmith   ?? state.wanderingBlacksmith;
  state.travelingAstrologer   = s.travelingAstrologer   ?? state.travelingAstrologer;
  state.merchantPrince        = s.merchantPrince        ?? state.merchantPrince;
  state.wanderingSage         = s.wanderingSage ?? null;         // T266
  state.masterForester        = s.masterForester ?? null;       // T267
  state.forestSpirit          = s.forestSpirit ?? null;         // T268
  state.wanderingAlchemist    = s.wanderingAlchemist ?? null;   // T269
  state.seafaringExplorer     = s.seafaringExplorer ?? null;    // T270
  state.travelingMonk         = s.travelingMonk ?? null;        // T271
  state.imperialCartographer  = s.imperialCartographer ?? null; // T272
  state.wanderingOracle       = s.wanderingOracle ?? null;      // T273
  state.royalEmissary         = s.royalEmissary ?? null;        // T274
  state.wanderingTinker        = s.wanderingTinker ?? null;          // T275
  state.wanderingPhysician     = s.wanderingPhysician ?? null;       // T276
  state.wanderingCartomancer   = s.wanderingCartomancer ?? null;     // T277
  state.villageElderVisit      = s.villageElderVisit ?? null;        // T278
  state.wanderingScribe        = s.wanderingScribe ?? null;          // T279
  state.desertTrader           = s.desertTrader ?? null;             // T280
  state.wanderingGemcutter     = s.wanderingGemcutter ?? null;       // T281
  state.forestWarden           = s.forestWarden ?? null;             // T282
  state.wanderingBeekeeper     = s.wanderingBeekeeper ?? null;       // T283
  state.stoneCarver            = s.stoneCarver ?? null;              // T284
  state.wanderingGlassblower   = s.wanderingGlassblower ?? null;    // T285
  state.royalAstronomer        = s.royalAstronomer ?? null;         // T286
  state.imperialHerald         = s.imperialHerald ?? null;          // T287
  state.travelingPotter        = s.travelingPotter ?? null;         // T288
  state.wanderingDyer          = s.wanderingDyer ?? null;           // T289
  state.frontierScout          = s.frontierScout ?? null;           // T290
  state.wanderingShipwright    = s.wanderingShipwright ?? null;     // T291
  state.masterBrewer               = s.masterBrewer ?? null;               // T292
  state.ancientManuscriptTrader    = s.ancientManuscriptTrader ?? null;    // T293
  state.imperialSiegeEngineer      = s.imperialSiegeEngineer ?? null;      // T294
  state.wanderingWeaver            = s.wanderingWeaver ?? null;            // T295
  state.travelingArchitect         = s.travelingArchitect ?? null;         // T296
  state.wanderingFalconer          = s.wanderingFalconer ?? null;          // T297
  state.roamingBotanist            = s.roamingBotanist ?? null;            // T298
  state.wanderingJeweler           = s.wanderingJeweler ?? null;           // T299
  state.desertNomadChief           = s.desertNomadChief ?? null;           // T300
  state.wanderingSculptor          = s.wanderingSculptor ?? null;          // T301
  state.royalVintner               = s.royalVintner ?? null;               // T302
  state.wanderingMapmaker          = s.wanderingMapmaker ?? null;          // T303
  state.royalPerfumer              = s.royalPerfumer ?? null;              // T304
  state.wanderingSilversmith       = s.wanderingSilversmith ?? null;       // T305
  state.imperialSpiceMerchant      = s.imperialSpiceMerchant ?? null;      // T306
  state.courtMusician              = s.courtMusician ?? null;              // T307
  state.ancientLibraryKeeper       = s.ancientLibraryKeeper ?? null;       // T308
  state.wanderingClockmaker        = s.wanderingClockmaker ?? null;        // T309
  state.imperialWeaponsmith        = s.imperialWeaponsmith ?? null;        // T310
  state.wanderingStonemason        = s.wanderingStonemason ?? null;        // T311
  state.imperialDyeMaster          = s.imperialDyeMaster ?? null;          // T312
  state.wanderingNavigator         = s.wanderingNavigator ?? null;         // T313
  state.travelingIlluminator       = s.travelingIlluminator ?? null;       // T314
  state.ancientRitualLeader        = s.ancientRitualLeader ?? null;        // T315
  state.mountainProspector         = s.mountainProspector ?? null;         // T316
  state.wanderingLeatherworker     = s.wanderingLeatherworker ?? null;     // T317
  state.royalApothecary            = s.royalApothecary ?? null;            // T318
  state.wanderingFishmonger        = s.wanderingFishmonger ?? null;        // T319
  state.imperialChandler           = s.imperialChandler ?? null;           // T320
  state.royalLamplighter           = s.royalLamplighter ?? null;           // T321
  state.wanderingCooper            = s.wanderingCooper ?? null;            // T322
  state.wanderingRopeMaker         = s.wanderingRopeMaker ?? null;         // T323
  state.imperialSaltMerchant       = s.imperialSaltMerchant ?? null;       // T324
  state.wanderingPuppeteer         = s.wanderingPuppeteer ?? null;         // T325
  state.ancientRuneCarver          = s.ancientRuneCarver ?? null;          // T326
  state.wanderingCartwright        = s.wanderingCartwright ?? null;        // T327
  state.imperialFarrier            = s.imperialFarrier ?? null;            // T328
  state.wanderingCobbler           = s.wanderingCobbler ?? null;           // T329
  state.imperialEngraver           = s.imperialEngraver ?? null;           // T330
  state.wanderingTailor            = s.wanderingTailor ?? null;            // T331
  state.wanderingTinsmith          = s.wanderingTinsmith ?? null;          // T332
  state.wanderingMiller            = s.wanderingMiller ?? null;            // T333
  state.imperialCourier            = s.imperialCourier ?? null;            // T334
  state.wanderingBaker             = s.wanderingBaker ?? null;             // T335
  state.imperialArmorer            = s.imperialArmorer ?? null;            // T336
  state.wanderingWoodCarver        = s.wanderingWoodCarver ?? null;        // T337
  state.imperialRoadBuilder        = s.imperialRoadBuilder ?? null;        // T338
  state.wanderingEmbroiderer       = s.wanderingEmbroiderer ?? null;       // T339
  state.royalBookbinder            = s.royalBookbinder ?? null;            // T340
  state.wanderingBasketweaver      = s.wanderingBasketweaver ?? null;      // T341
  state.wanderingCharcoalMaker     = s.wanderingCharcoalMaker ?? null;     // T342
  state.wanderingTanner            = s.wanderingTanner ?? null;            // T343
  state.imperialGlassmaker         = s.imperialGlassmaker ?? null;         // T344
  state.wanderingInkmaker          = s.wanderingInkmaker ?? null;          // T345
  state.imperialDockmaster         = s.imperialDockmaster ?? null;         // T346
  state.wanderingStoryteller       = s.wanderingStoryteller ?? null;       // T347
  state.imperialLoreMaster         = s.imperialLoreMaster ?? null;         // T348
  state.wanderingToymaker          = s.wanderingToymaker ?? null;          // T349
  state.imperialFerryman           = s.imperialFerryman ?? null;           // T350
  state.wanderingMosaicMaker       = s.wanderingMosaicMaker ?? null;       // T351
  state.imperialBathhouseBuilder   = s.imperialBathhouseBuilder ?? null;   // T352
  state.wanderingBellFounder       = s.wanderingBellFounder ?? null;       // T353
  state.imperialMarbleCutter       = s.imperialMarbleCutter ?? null;       // T354
  state.wanderingParchmentMaker    = s.wanderingParchmentMaker ?? null;    // T355
  state.wanderingIncenseMaker      = s.wanderingIncenseMaker ?? null;      // T356
  state.wanderingFurrier           = s.wanderingFurrier ?? null;           // T357
  state.imperialWoolMerchant       = s.imperialWoolMerchant ?? null;       // T358
  state.wanderingHorseTrader       = s.wanderingHorseTrader ?? null;       // T359
  state.imperialSilkWeaver         = s.imperialSilkWeaver ?? null;         // T360
  state.wanderingGemMerchant       = s.wanderingGemMerchant ?? null;       // T361
  state.imperialSiegeMaster        = s.imperialSiegeMaster ?? null;        // T362
  state.wanderingHatMaker          = s.wanderingHatMaker ?? null;          // T363
  state.imperialGoldsmith          = s.imperialGoldsmith ?? null;          // T364
  state.wanderingOilMerchant       = s.wanderingOilMerchant ?? null;       // T365
  state.imperialQuarryman          = s.imperialQuarryman ?? null;          // T366
  state.wanderingSoapMaker         = s.wanderingSoapMaker ?? null;         // T367
  state.imperialMetalcaster        = s.imperialMetalcaster ?? null;        // T368
  state.wanderingGloveMaker        = s.wanderingGloveMaker ?? null;        // T369
  state.imperialTelescopeMaker     = s.imperialTelescopeMaker ?? null;     // T370
  state.wanderingPaperMaker        = s.wanderingPaperMaker ?? null;        // T371
  state.imperialCoinMinter         = s.imperialCoinMinter ?? null;         // T372
  state.wanderingCartographerGuild = s.wanderingCartographerGuild ?? null; // T373
  state.imperialSpymaster          = s.imperialSpymaster ?? null;          // T374
  state.wanderingGemPolisher       = s.wanderingGemPolisher ?? null;       // T375
  state.imperialAstrolabeMaker     = s.imperialAstrolabeMaker ?? null;     // T376
  state.wanderingLocksmith         = s.wanderingLocksmith ?? null;         // T377
  state.imperialCalligrapher       = s.imperialCalligrapher ?? null;       // T378
  state.wanderingCoppersmith       = s.wanderingCoppersmith ?? null;       // T379
  state.imperialScrivener          = s.imperialScrivener ?? null;          // T380
  state.wanderingMirrorMaker       = s.wanderingMirrorMaker ?? null;       // T381
  state.imperialFlowerMerchant     = s.imperialFlowerMerchant ?? null;     // T382
  state.wanderingDressmaker        = s.wanderingDressmaker ?? null;        // T383
  state.imperialTileSetter         = s.imperialTileSetter ?? null;         // T384
  state.imperialBannerWeaver       = s.imperialBannerWeaver ?? null;       // T385
  state.wanderingBoneCarver        = s.wanderingBoneCarver ?? null;        // T386
  state.wanderingTapestryMaker     = s.wanderingTapestryMaker ?? null;     // T387
  state.imperialSiegeArchitect     = s.imperialSiegeArchitect ?? null;     // T388
  state.wanderingLuteMaker         = s.wanderingLuteMaker ?? null;         // T389
  state.imperialStonecutterGuild   = s.imperialStonecutterGuild ?? null;   // T390
  state.wanderingCandlemaker       = s.wanderingCandlemaker ?? null;       // T391
  state.imperialGrainMerchant      = s.imperialGrainMerchant ?? null;      // T392
  state.wanderingFeltMaker         = s.wanderingFeltMaker ?? null;         // T393
  state.imperialVineyardMaster     = s.imperialVineyardMaster ?? null;     // T394
  state.wanderingHerbMerchant      = s.wanderingHerbMerchant ?? null;      // T395
  state.imperialLanternMaker       = s.imperialLanternMaker ?? null;       // T396
  state.wanderingInkMaster         = s.wanderingInkMaster ?? null;         // T397
  state.wanderingSaltMerchant      = s.wanderingSaltMerchant ?? null;      // T398
  state.wanderingBronzeSmith       = s.wanderingBronzeSmith ?? null;       // T399
  state.imperialAqueductBuilder    = s.imperialAqueductBuilder ?? null;    // T400
  state.wanderingGlassPainter      = s.wanderingGlassPainter ?? null;      // T401
  state.imperialSiegeCatapultEngineer = s.imperialSiegeCatapultEngineer ?? null; // T402
  state.wanderingWoolSpinner       = s.wanderingWoolSpinner ?? null;       // T403
  state.imperialAmberMerchant      = s.imperialAmberMerchant ?? null;      // T404
  state.wanderingSandglassMaker    = s.wanderingSandglassMaker ?? null;    // T405
  state.imperialBridgeBuilder      = s.imperialBridgeBuilder ?? null;      // T406
  state.wanderingChronicler        = s.wanderingChronicler ?? null;        // T407
  state.imperialSurveyor           = s.imperialSurveyor ?? null;           // T408
  state.wanderingTapestryRestorer = s.wanderingTapestryRestorer ?? null; // T409
  state.imperialHarborMaster      = s.imperialHarborMaster ?? null;      // T410
  state.wanderingBowMaker         = s.wanderingBowMaker ?? null;          // T411
  state.imperialCheeseMerchant    = s.imperialCheeseMerchant ?? null;     // T412
  state.wanderingThatcher         = s.wanderingThatcher ?? null;           // T413
  state.imperialMillstoneCutter   = s.imperialMillstoneCutter ?? null;     // T414
  state.wanderingPeatCutter       = s.wanderingPeatCutter ?? null;         // T415
  state.imperialIconPainter       = s.imperialIconPainter ?? null;         // T416
  state.wanderingWaxTabletMaker   = s.wanderingWaxTabletMaker ?? null;     // T417
  state.wanderingNetMaker         = s.wanderingNetMaker ?? null;           // T418
  state.wanderingDrumMaker        = s.wanderingDrumMaker ?? null;           // T419
  state.imperialHerbariumKeeper   = s.imperialHerbariumKeeper ?? null;      // T420
  state.wanderingSpearMaker       = s.wanderingSpearMaker ?? null;          // T421
  state.imperialRobeMaker         = s.imperialRobeMaker ?? null;            // T422
  state.wanderingFletcher         = s.wanderingFletcher ?? null;            // T423
  state.imperialKnifesmith        = s.imperialKnifesmith ?? null;           // T424
  state.wanderingSailMaker        = s.wanderingSailMaker ?? null;           // T425
  state.imperialChariotBuilder    = s.imperialChariotBuilder ?? null;       // T426
  state.wanderingSeedMerchant     = s.wanderingSeedMerchant ?? null;        // T427
  state.imperialSilkscreenPainter = s.imperialSilkscreenPainter ?? null;   // T428
  state.wanderingWoodcutter       = s.wanderingWoodcutter ?? null;         // T429
  state.imperialMasonsGuild       = s.imperialMasonsGuild ?? null;         // T430
  state.wanderingKnifeSharpener        = s.wanderingKnifeSharpener ?? null;         // T431
  state.imperialFrescoPainter          = s.imperialFrescoPainter ?? null;           // T432
  state.wanderingDyeMerchant           = s.wanderingDyeMerchant ?? null;            // T433
  state.imperialCartographersAcademy   = s.imperialCartographersAcademy ?? null;    // T434
  _tickCount                  = s.ticker                ?? 0;
  state.empireName            = s.empireName            ?? state.empireName;
  state.rulerName             = s.rulerName             ?? state.rulerName;
  state.difficulty            = s.difficulty            ?? state.difficulty;
  state.gameStarted           = s.gameStarted           ?? state.gameStarted;
}

function _loadSave() {
  try {
    const raw = localStorage.getItem(_saveSlot);
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!s || s.version !== 2) return false;
    _applySave(s);
    return true;
  } catch (e) {
    console.warn('Load failed:', e);
    return false;
  }
}

// ─── Game lifecycle ──────────────────────────────────────────────────────────────────────────────
function _startFreshGame() {
  // Reset state to defaults handled by each system's init.
  initResources();
  initBuildings();
  initResearch();
  initPopulation();
  initMorale();
  initCorruption();           // T203
  initMilitary();
  initCombat();
  initDiplomacy();
  initTrade();
  initMap();
  initWeather();
  initSeasons();
  initAges();
  initEvents();
  initQuests();
  initStory();
  initChronicle();
  initRelics();
  initReligion();
  initCulture();
  initEspionage();
  initPiracy();
  initNaturalDisasters();
  initRebellion();
  initFamine();
  initPlague();
  initEconomy();
  initDynasty();
  initWonders();
  initPolicies();
  initScience();
  initArtisan();
  initForeign();
  initColony();
  initNavy();
  initExpedition();
  initPilgrimage();
  initMercenaries();
  initIntelligence();
  initHarvest();
  initFestival();
  initTournament();
  initCavalry();
  initSiege();
  initFortifications();
  initCoastal();
  initSpy();
  initAlchemy();
  initTaxation();
  initAstrology();
  initGuild();
  initHerald();
  initCensus();
  initBanditry();
  initCaravan();
  initOracle();
  initMessenger();
  initForestry();
  initMining();
  initIrrigation();
  initMasonry();
  initTextile();
  initPottery();
  initLeather();
  initJewelry();
  initGlass();
  initPaper();
  initInk();
  initCandle();
  initSoap();
  initRope();
  initSalt();
  initSpice();
  initSugar();
  initCotton();
  initSilk();
  initWool();
  initFur();
  initAmber();
  initIvory();
  initPearl();
  initGem();
  initDye();
  initPerfume();
  initMedicine();
  initPoison();
  initExplosive();
  initStealth();
  initDiplomaticMarriage();
  initRoyalDecree();
  initImperialEdicts();
  initPropaganda();
  initCensorship();
  initCourt();
  initNobility();
  initSerfdom();
  initSlavery();
  initConquest();
  initAnnexation();
  initTribute();
  initSupplyDepot();
  initClimateAdaptations();
  initTradeEmbargo();
  initLifetimeRecords();
  initPlagueOutbreak();
  initPilgrimageSystem();
  initRoyalHunt();            // T214
  initRovingWarlord();
  initTributeDemand();
  initBlackMarket();
  initNobleCouncilDemand();
  initImperialVault();
  initDiplomaticSummit();
  initAlmanac();
  initCartographerSurvey();
  initRelicShrine();
  initFortificationNetwork();
  initVeteranCohesion();
  initTradeRouteSpecializations();
  initVictoryProgress();
  initSeasonalResearchAffinity();
  initLegendaryUnits();
  initTradeGuildHall();
  initImperialMint();
  initDiplomaticEnvoy();
  initOracleOfFate();
  initArtisanGuilds();
  initGrandVizier();
  initAnnualTradeFair();
  initTradeWindEvents();
  initImperialTaxCollector();
  initWanderingArmy();
  initProvinceCouncil();
  initEpicQuestChains();
  initGrandArena();
  initScoutReconnaissance();
  initResourceExchangePact();
  initImperialCodex();
  initLegendaryEncounters();
  initRefugeeCrisis();
  initSilkRoad();
  initImperialPropaganda();
  initMilitaryIntelligence();
  initConstructionDrive();
  initPeaceOverture();
  initBuildingNetworkBonuses();
  initArmyCompositionSynergies();
  initRoyalForecast();
  initWarTrophyCollection();
  initAlchemyWorkshop();
  initWartimeRationing();
  initPeasantMilitia();
  initAncientPact();
  initGrandLibrary();
  initMarketPriceSurge();
  initSeasonalHarvest();
  initImperialGames();
  initRoyalLoan();
  initImperialRecordsExchange();
  initNomadicTribe();
  initWanderingProphet();
  initArtisanFair();
  initEmpireEpithet();
  initCosmicAlignment();
  initMarketEconomyCycle();
  initVillageTributeCaravan();
  initAncientOreVein();
  initWanderingHerbalist();
  initTravelingCircus();
  initSacredSpring();
  initWanderingBard();
  initMasterArtisan();
  initMountainHermit();
  initImperialJubilee();
  initExiledPrince();
  initAncientGuardian();
  initDesertOasis();
  initForeignDignitary();
  initLostCaravan();
  initNomadicScholar();
  initRoyalFeast();
  initWanderingBlacksmith();
  initTravelingAstrologer();
  initMerchantPrince();
  initWanderingSage();           // T266
  initMasterForester();         // T267
  initForestSpirit();           // T268
  initWanderingAlchemist();     // T269
  initSeafaringExplorer();      // T270
  initTravelingMonk();          // T271
  initImperialCartographer();   // T272
  initWanderingOracle();        // T273
  initRoyalEmissary();          // T274
  initWanderingTinker();          // T275
  initWanderingPhysician();       // T276
  initWanderingCartomancer();     // T277
  initVillageElderVisit();        // T278
  initWanderingScribe();          // T279
  initDesertTrader();             // T280
  initWanderingGemcutter();       // T281
  initForestWarden();             // T282
  initWanderingBeekeeper();       // T283
  initStoneCarver();              // T284
  initWanderingGlassblower();     // T285
  initRoyalAstronomer();          // T286
  initImperialHerald();           // T287
  initTravelingPotter();          // T288
  initWanderingDyer();            // T289
  initFrontierScout();            // T290
  initWanderingShipwright();      // T291
  initMasterBrewer();                    // T292
  initAncientManuscriptTrader();        // T293
  initImperialSiegeEngineer();          // T294
  initWanderingWeaver();                // T295
  initTravelingArchitect();             // T296
  initWanderingFalconer();              // T297
  initRoamingBotanist();                // T298
  initWanderingJeweler();               // T299
  initDesertNomadChief();               // T300
  initWanderingSculptor();              // T301
  initRoyalVintner();                   // T302
  initWanderingMapmaker();              // T303
  initRoyalPerfumer();                  // T304
  initWanderingSilversmith();           // T305
  initImperialSpiceMerchant();          // T306
  initCourtMusician();                  // T307
  initAncientLibraryKeeper();           // T308
  initWanderingClockmaker();            // T309
  initImperialWeaponsmith();            // T310
  initWanderingStonemason();            // T311
  initImperialDyeMaster();              // T312
  initWanderingNavigator();             // T313
  initTravelingIlluminator();           // T314
  initAncientRitualLeader();            // T315
  initMountainProspector();             // T316
  initWanderingLeatherworker();         // T317
  initRoyalApothecary();                // T318
  initWanderingFishmonger();            // T319
  initImperialChandler();               // T320
  initRoyalLamplighter();               // T321
  initWanderingCooper();                // T322
  initWanderingRopeMaker();             // T323
  initImperialSaltMerchant();           // T324
  initWanderingPuppeteer();             // T325
  initAncientRuneCarver();              // T326
  initWanderingCartwright();            // T327
  initImperialFarrier();               // T328
  initWanderingCobbler();              // T329
  initImperialEngraver();              // T330
  initWanderingTailor();               // T331
  initWanderingTinsmith();             // T332
  initWanderingMiller();               // T333
  initImperialCourier();               // T334
  initWanderingBaker();                // T335
  initImperialArmorer();               // T336
  initWanderingWoodCarver();           // T337
  initImperialRoadBuilder();           // T338
  initWanderingEmbroiderer();          // T339
  initRoyalBookbinder();               // T340
  initWanderingBasketweaver();         // T341
  initWanderingCharcoalMaker();        // T342
  initWanderingTanner();               // T343
  initImperialGlassmaker();            // T344
  initWanderingInkmaker();             // T345
  initImperialDockmaster();            // T346
  initWanderingStoryteller();          // T347
  initImperialLoreMaster();            // T348
  initWanderingToymaker();             // T349
  initImperialFerryman();              // T350
  initWanderingMosaicMaker();          // T351
  initImperialBathhouseBuilder();      // T352
  initWanderingBellFounder();          // T353
  initImperialMarbleCutter();          // T354
  initWanderingParchmentMaker();       // T355
  initWanderingIncenseMaker();         // T356
  initWanderingFurrier();              // T357
  initImperialWoolMerchant();          // T358
  initWanderingHorseTrader();          // T359
  initImperialSilkWeaver();            // T360
  initWanderingGemMerchant();          // T361
  initImperialSiegeMaster();           // T362
  initWanderingHatMaker();             // T363
  initImperialGoldsmith();             // T364
  initWanderingOilMerchant();          // T365
  initImperialQuarryman();             // T366
  initWanderingSoapMaker();            // T367
  initImperialMetalcaster();           // T368
  initWanderingGloveMaker();           // T369
  initImperialTelescopeMaker();        // T370
  initWanderingPaperMaker();           // T371
  initImperialCoinMinter();            // T372
  initWanderingCartographerGuild();   // T373
  initImperialSpymaster();            // T374
  initWanderingGemPolisher();         // T375
  initImperialAstrolabeMaker();       // T376
  initWanderingLocksmith();           // T377
  initImperialCalligrapher();         // T378
  initWanderingCoppersmith();         // T379
  initImperialScrivener();            // T380
  initWanderingMirrorMaker();         // T381
  initImperialFlowerMerchant();       // T382
  initWanderingDressmaker();          // T383
  initImperialTileSetter();           // T384
  initImperialBannerWeaver();         // T385
  initWanderingBoneCarver();          // T386
  initWanderingTapestryMaker();       // T387
  initImperialSiegeArchitect();       // T388
  initWanderingLuteMaker();           // T389
  initImperialStonecutterGuild();     // T390
  initWanderingCandlemaker();         // T391
  initImperialGrainMerchant();        // T392
  initWanderingFeltMaker();           // T393
  initImperialVineyardMaster();       // T394
  initWanderingHerbMerchant();        // T395
  initImperialLanternMaker();         // T396
  initWanderingInkMaster();           // T397
  initWanderingSaltMerchant();        // T398
  initWanderingBronzeSmith();         // T399
  initImperialAqueductBuilder();      // T400
  initWanderingGlassPainter();        // T401
  initImperialSiegeCatapultEngineer(); // T402
  initWanderingWoolSpinner();          // T403
  initImperialAmberMerchant();         // T404
  initWanderingSandglassMaker();       // T405
  initImperialBridgeBuilder();         // T406
  initWanderingChronicler();           // T407
  initImperialSurveyor();              // T408
  initWanderingTapestryRestorer();    // T409
  initImperialHarborMaster();         // T410
  initWanderingBowMaker();            // T411
  initImperialCheeseMerchant();       // T412
  initWanderingThatcher();            // T413
  initImperialMillstoneCutter();      // T414
  initWanderingPeatCutter();          // T415
  initImperialIconPainter();          // T416
  initWanderingWaxTabletMaker();      // T417
  initWanderingNetMaker();            // T418
  initWanderingDrumMaker();           // T419
  initImperialHerbariumKeeper();      // T420
  initWanderingSpearMaker();          // T421
  initImperialRobeMaker();            // T422
  initWanderingFletcher();            // T423
  initImperialKnifesmith();           // T424
  initWanderingSailMaker();           // T425
  initImperialChariotBuilder();       // T426
  initWanderingSeedMerchant();        // T427
  initImperialSilkscreenPainter();    // T428
  initWanderingWoodcutter();          // T429
  initImperialMasonsGuild();          // T430
  initWanderingKnifeSharpener();      // T431
  initImperialFrescoPainter();        // T432
  initWanderingDyeMerchant();         // T433
  initImperialCartographersAcademy(); // T434
  initAchievements();
  initLeaderboard();
}

function _startLoadedGame(savedData) {
  // Apply save data, then re-init systems that need the data to be present
  _applySave(savedData);
  initResources();
  initBuildings();
  initResearch();
  initPopulation();
  initMorale();
  initCorruption();           // T203
  initMilitary();
  initCombat();
  initDiplomacy();
  initTrade();
  initMap();
  initWeather();
  initSeasons();
  initAges();
  initEvents();
  initQuests();
  initStory();
  initChronicle();
  initRelics();
  initReligion();
  initCulture();
  initEspionage();
  initPiracy();
  initNaturalDisasters();
  initRebellion();
  initFamine();
  initPlague();
  initEconomy();
  initDynasty();
  initWonders();
  initPolicies();
  initScience();
  initArtisan();
  initForeign();
  initColony();
  initNavy();
  initExpedition();
  initPilgrimage();
  initMercenaries();
  initIntelligence();
  initHarvest();
  initFestival();
  initTournament();
  initCavalry();
  initSiege();
  initFortifications();
  initCoastal();
  initSpy();
  initAlchemy();
  initTaxation();
  initAstrology();
  initGuild();
  initHerald();
  initCensus();
  initBanditry();
  initCaravan();
  initOracle();
  initMessenger();
  initForestry();
  initMining();
  initIrrigation();
  initMasonry();
  initTextile();
  initPottery();
  initLeather();
  initJewelry();
  initGlass();
  initPaper();
  initInk();
  initCandle();
  initSoap();
  initRope();
  initSalt();
  initSpice();
  initSugar();
  initCotton();
  initSilk();
  initWool();
  initFur();
  initAmber();
  initIvory();
  initPearl();
  initGem();
  initDye();
  initPerfume();
  initMedicine();
  initPoison();
  initExplosive();
  initStealth();
  initDiplomaticMarriage();
  initRoyalDecree();
  initImperialEdicts();
  initPropaganda();
  initCensorship();
  initCourt();
  initNobility();
  initSerfdom();
  initSlavery();
  initConquest();
  initAnnexation();
  initTribute();
  initSupplyDepot();
  initClimateAdaptations();
  initTradeEmbargo();
  initLifetimeRecords();
  initPlagueOutbreak();
  initPilgrimageSystem();
  initRoyalHunt();            // T214
  initRovingWarlord();
  initTributeDemand();
  initBlackMarket();
  initNobleCouncilDemand();
  initImperialVault();
  initDiplomaticSummit();
  initAlmanac();
  initCartographerSurvey();
  initRelicShrine();
  initFortificationNetwork();
  initVeteranCohesion();
  initTradeRouteSpecializations();
  initVictoryProgress();
  initSeasonalResearchAffinity();
  initLegendaryUnits();
  initTradeGuildHall();
  initImperialMint();
  initDiplomaticEnvoy();
  initOracleOfFate();
  initArtisanGuilds();
  initGrandVizier();
  initAnnualTradeFair();
  initTradeWindEvents();
  initImperialTaxCollector();
  initWanderingArmy();
  initProvinceCouncil();
  initEpicQuestChains();
  initGrandArena();
  initScoutReconnaissance();
  initResourceExchangePact();
  initImperialCodex();
  initLegendaryEncounters();
  initRefugeeCrisis();
  initSilkRoad();
  initImperialPropaganda();
  initMilitaryIntelligence();
  initConstructionDrive();
  initPeaceOverture();
  initBuildingNetworkBonuses();
  initArmyCompositionSynergies();
  initRoyalForecast();
  initWarTrophyCollection();
  initAlchemyWorkshop();
  initWartimeRationing();
  initPeasantMilitia();
  initAncientPact();
  initGrandLibrary();
  initMarketPriceSurge();
  initSeasonalHarvest();
  initImperialGames();
  initRoyalLoan();
  initImperialRecordsExchange();
  initNomadicTribe();
  initWanderingProphet();
  initArtisanFair();
  initEmpireEpithet();
  initCosmicAlignment();
  initMarketEconomyCycle();
  initVillageTributeCaravan();
  initAncientOreVein();
  initWanderingHerbalist();
  initTravelingCircus();
  initSacredSpring();
  initWanderingBard();
  initMasterArtisan();
  initMountainHermit();
  initImperialJubilee();
  initExiledPrince();
  initAncientGuardian();
  initDesertOasis();
  initForeignDignitary();
  initLostCaravan();
  initNomadicScholar();
  initRoyalFeast();
  initWanderingBlacksmith();
  initTravelingAstrologer();
  initMerchantPrince();
  initWanderingSage();           // T266
  initMasterForester();         // T267
  initForestSpirit();           // T268
  initWanderingAlchemist();     // T269
  initSeafaringExplorer();      // T270
  initTravelingMonk();          // T271
  initImperialCartographer();   // T272
  initWanderingOracle();        // T273
  initRoyalEmissary();          // T274
  initWanderingTinker();          // T275
  initWanderingPhysician();       // T276
  initWanderingCartomancer();     // T277
  initVillageElderVisit();        // T278
  initWanderingScribe();          // T279
  initDesertTrader();             // T280
  initWanderingGemcutter();       // T281
  initForestWarden();             // T282
  initWanderingBeekeeper();       // T283
  initStoneCarver();              // T284
  initWanderingGlassblower();     // T285
  initRoyalAstronomer();          // T286
  initImperialHerald();           // T287
  initTravelingPotter();          // T288
  initWanderingDyer();            // T289
  initFrontierScout();            // T290
  initWanderingShipwright();      // T291
  initMasterBrewer();                    // T292
  initAncientManuscriptTrader();        // T293
  initImperialSiegeEngineer();          // T294
  initWanderingWeaver();                // T295
  initTravelingArchitect();             // T296
  initWanderingFalconer();              // T297
  initRoamingBotanist();                // T298
  initWanderingJeweler();               // T299
  initDesertNomadChief();               // T300
  initWanderingSculptor();              // T301
  initRoyalVintner();                   // T302
  initWanderingMapmaker();              // T303
  initRoyalPerfumer();                  // T304
  initWanderingSilversmith();           // T305
  initImperialSpiceMerchant();          // T306
  initCourtMusician();                  // T307
  initAncientLibraryKeeper();           // T308
  initWanderingClockmaker();            // T309
  initImperialWeaponsmith();            // T310
  initWanderingStonemason();            // T311
  initImperialDyeMaster();              // T312
  initWanderingNavigator();             // T313
  initTravelingIlluminator();           // T314
  initAncientRitualLeader();            // T315
  initMountainProspector();             // T316
  initWanderingLeatherworker();         // T317
  initRoyalApothecary();                // T318
  initWanderingFishmonger();            // T319
  initImperialChandler();               // T320
  initRoyalLamplighter();               // T321
  initWanderingCooper();                // T322
  initWanderingRopeMaker();             // T323
  initImperialSaltMerchant();           // T324
  initWanderingPuppeteer();             // T325
  initAncientRuneCarver();              // T326
  initWanderingCartwright();            // T327
  initImperialFarrier();               // T328
  initWanderingCobbler();              // T329
  initImperialEngraver();              // T330
  initWanderingTailor();               // T331
  initWanderingTinsmith();             // T332
  initWanderingMiller();               // T333
  initImperialCourier();               // T334
  initWanderingBaker();                // T335
  initImperialArmorer();               // T336
  initWanderingWoodCarver();           // T337
  initImperialRoadBuilder();           // T338
  initWanderingEmbroiderer();          // T339
  initRoyalBookbinder();               // T340
  initWanderingBasketweaver();         // T341
  initWanderingCharcoalMaker();        // T342
  initWanderingTanner();               // T343
  initImperialGlassmaker();            // T344
  initWanderingInkmaker();             // T345
  initImperialDockmaster();            // T346
  initWanderingStoryteller();          // T347
  initImperialLoreMaster();            // T348
  initWanderingToymaker();             // T349
  initImperialFerryman();              // T350
  initWanderingMosaicMaker();          // T351
  initImperialBathhouseBuilder();      // T352
  initWanderingBellFounder();          // T353
  initImperialMarbleCutter();          // T354
  initWanderingParchmentMaker();       // T355
  initWanderingIncenseMaker();         // T356
  initWanderingFurrier();              // T357
  initImperialWoolMerchant();          // T358
  initWanderingHorseTrader();          // T359
  initImperialSilkWeaver();            // T360
  initWanderingGemMerchant();          // T361
  initImperialSiegeMaster();           // T362
  initWanderingHatMaker();             // T363
  initImperialGoldsmith();             // T364
  initWanderingOilMerchant();          // T365
  initImperialQuarryman();             // T366
  initWanderingSoapMaker();            // T367
  initImperialMetalcaster();           // T368
  initWanderingGloveMaker();           // T369
  initImperialTelescopeMaker();        // T370
  initWanderingPaperMaker();           // T371
  initImperialCoinMinter();            // T372
  initWanderingCartographerGuild();   // T373
  initImperialSpymaster();            // T374
  initWanderingGemPolisher();         // T375
  initImperialAstrolabeMaker();       // T376
  initWanderingLocksmith();           // T377
  initImperialCalligrapher();         // T378
  initWanderingCoppersmith();         // T379
  initImperialScrivener();            // T380
  initWanderingMirrorMaker();         // T381
  initImperialFlowerMerchant();       // T382
  initWanderingDressmaker();          // T383
  initImperialTileSetter();           // T384
  initImperialBannerWeaver();         // T385
  initWanderingBoneCarver();          // T386
  initWanderingTapestryMaker();       // T387
  initImperialSiegeArchitect();       // T388
  initWanderingLuteMaker();           // T389
  initImperialStonecutterGuild();     // T390
  initWanderingCandlemaker();         // T391
  initImperialGrainMerchant();        // T392
  initWanderingFeltMaker();           // T393
  initImperialVineyardMaster();       // T394
  initWanderingHerbMerchant();        // T395
  initImperialLanternMaker();         // T396
  initWanderingInkMaster();           // T397
  initWanderingSaltMerchant();        // T398
  initWanderingBronzeSmith();         // T399
  initImperialAqueductBuilder();      // T400
  initWanderingGlassPainter();        // T401
  initImperialSiegeCatapultEngineer(); // T402
  initWanderingWoolSpinner();          // T403
  initImperialAmberMerchant();         // T404
  initWanderingSandglassMaker();       // T405
  initImperialBridgeBuilder();         // T406
  initWanderingChronicler();           // T407
  initImperialSurveyor();              // T408
  initWanderingTapestryRestorer();    // T409
  initImperialHarborMaster();         // T410
  initWanderingBowMaker();            // T411
  initImperialCheeseMerchant();       // T412
  initWanderingThatcher();            // T413
  initImperialMillstoneCutter();      // T414
  initWanderingPeatCutter();          // T415
  initImperialIconPainter();          // T416
  initWanderingWaxTabletMaker();      // T417
  initWanderingNetMaker();            // T418
  initWanderingDrumMaker();           // T419
  initImperialHerbariumKeeper();      // T420
  initWanderingSpearMaker();          // T421
  initImperialRobeMaker();            // T422
  initWanderingFletcher();            // T423
  initImperialKnifesmith();           // T424
  initWanderingSailMaker();           // T425
  initImperialChariotBuilder();       // T426
  initWanderingSeedMerchant();        // T427
  initImperialSilkscreenPainter();    // T428
  initWanderingWoodcutter();          // T429
  initImperialMasonsGuild();          // T430
  initWanderingKnifeSharpener();      // T431
  initImperialFrescoPainter();        // T432
  initWanderingDyeMerchant();         // T433
  initImperialCartographersAcademy(); // T434
  initAchievements();
  initLeaderboard();
}

// ─── Tick loop ───────────────────────────────────────────────────────────────────────────────
function _tickLoop() {
  if (_paused || _gameOver) return;

  _tickCount++;
  tick();           // runs all registered system ticks
  renderAll();      // re-renders all panels
  updateHUD();      // updates the top HUD bar

  if (_tickCount % AUTOSAVE_TICKS === 0) {
    _save();
  }
}

// ─── Pause / Resume ──────────────────────────────────────────────────────────────────────────────
function _setPaused(paused) {
  _paused = paused;
  document.getElementById('pause-overlay')?.classList.toggle('hidden', !paused);
}

export function pauseGame()  { _setPaused(true);  }
export function resumeGame() { _setPaused(false); }
export function isPaused()   { return _paused; }

// ─── Game Over ───────────────────────────────────────────────────────────────────────────────
export function triggerGameOver(reason = 'Your empire has fallen.') {
  if (_gameOver) return;
  _gameOver = true;
  _paused   = true;
  clearInterval(_tickInterval);
  const overlay = document.getElementById('game-over-overlay');
  if (overlay) {
    overlay.querySelector('.game-over-reason').textContent = reason;
    overlay.classList.remove('hidden');
  }
  logMessage(`GAME OVER: ${reason}`, 'error');
}

// ─── New Game wizard ──────────────────────────────────────────────────────────────────────────────
function _showNewGameWizard() {
  const wizard = document.getElementById('new-game-wizard');
  if (wizard) wizard.classList.remove('hidden');
}

function _hideNewGameWizard() {
  const wizard = document.getElementById('new-game-wizard');
  if (wizard) wizard.classList.add('hidden');
}

export function startNewGame({ empireName, rulerName, difficulty }) {
  updateState({ empireName, rulerName, difficulty, gameStarted: true });
  _hideNewGameWizard();
  _startFreshGame();
  renderAll();
  updateHUD();
  logMessage(`Welcome, ${rulerName}! Your empire of ${empireName} begins.`, 'success');
}

// ─── Continue from save ─────────────────────────────────────────────────────────────────────────────
export function continueSave() {
  const raw = localStorage.getItem(_saveSlot);
  if (!raw) return;
  try {
    const s = JSON.parse(raw);
    _hideNewGameWizard();
    _startLoadedGame(s);
    renderAll();
    updateHUD();
    logMessage('Game loaded successfully.', 'success');
  } catch (e) {
    console.warn('Continue failed:', e);
  }
}

// ─── Manual save / load UI helpers ─────────────────────────────────────────────────────────────────────────
export function manualSave() {
  _save();
  showToast('Game saved!');
}

export function deleteSave() {
  localStorage.removeItem(_saveSlot);
  showToast('Save deleted. Refresh to start over.');
}

// ─── Settings ────────────────────────────────────────────────────────────────────────────────────
export function applySettings(settings) {
  applyTheme(settings.theme);
  // speed setting
  if (settings.speed) {
    clearInterval(_tickInterval);
    const ms = settings.speed === 'fast' ? 500 : settings.speed === 'slow' ? 2000 : TICK_MS;
    _tickInterval = setInterval(_tickLoop, ms);
  }
}

// ─── Tab navigation ───────────────────────────────────────────────────────────────────────────────
export function navigateTo(tabId) {
  openTab(tabId);
  renderAll();
}

// ─── Boot ──────────────────────────────────────────────────────────────────────────────────────
function boot() {
  // 1. Apply persisted settings (theme, etc.) before anything renders
  initSettings();

  // 2. Initialise the core engine
  initEngine();

  // 3. Register all system tick functions
  _registerAllSystems();

  // 4. Initialise the UI scaffolding (creates panels, event listeners, etc.)
  initUI();
  initMapCanvas();
  initMinimap();

  // 5. Wire save-system helpers
  initSave({
    onSave:   manualSave,
    onDelete: deleteSave,
  });

  // 6. Attempt to load an existing save
  const hasSave = !!localStorage.getItem(_saveSlot);
  if (hasSave) {
    // Show "Continue" button active in wizard
    const continueBtn = document.getElementById('btn-continue');
    if (continueBtn) continueBtn.disabled = false;
  }

  // 7. Show the New-Game wizard (player clicks Start or Continue)
  _showNewGameWizard();

  // 8. Start the tick loop
  _tickInterval = setInterval(_tickLoop, TICK_MS);

  // 9. Wire global keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (_paused) resumeGame();
      else         pauseGame();
    }
  });

  // 10. Initial render (even before a game starts, populate static UI)
  renderAll();
  updateHUD();
}

// ─── Entry point ────────────────────────────────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}