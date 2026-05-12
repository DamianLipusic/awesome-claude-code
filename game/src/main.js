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
import { initEconomyCycle, economyCycleTick }           from './systems/economyCycle.js';                  // T245
import { initTributeCaravan, tributeCaravanTick }       from './systems/tributeCaravan.js';                // T246
import { initOreVein, oreVeinTick }                     from './systems/ancientOreVein.js';                  // T247
import { initHerbalist, herbalistTick }                 from './systems/wanderingHerbalist.js';              // T248
import { initCircus, circusTick }                       from './systems/travelingCircus.js';                  // T249
import { initSacredSpring, sacredSpringTick }           from './systems/sacredSpring.js';                     // T250
import { initWanderingBard, wanderingBardTick }         from './systems/wanderingBard.js';                    // T251
import { initMasterArtisan, masterArtisanTick }         from './systems/masterArtisan.js';                    // T252
import { initMountainHermit, mountainHermitTick }       from './systems/mountainHermit.js';                   // T253
import { initImperialJubilee, imperialJubileeTick }     from './systems/imperialJubilee.js';                  // T254
import { initExiledPrince, exiledPrinceTick }           from './systems/exiledPrince.js';                     // T255
import { initAncientGuardian, ancientGuardianTick }     from './systems/ancientGuardian.js';                  // T256
