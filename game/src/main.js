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

// ── Boot sequence ─────────────────────────────────────────────────────────

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

// ── Save / Load ───────────────────────────────────────────────────────────

function _save() {
  try {
    localStorage.setItem('empireos-save', JSON.stringify({
      version: 62, // T191: imperial mint; T192: diplomatic envoy
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

// ── T137: Building auto-queue ─────────────────────────────────────────────

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

// ── Age badge ─────────────────────────────────────────────────────────────

function _updateAgeBadge() {
  const el  = document.getElementById('age-badge');
  if (!el) return;
  const age = AGES[state.age ?? 0];
  el.textContent = age ? `${age.icon} ${age.name}` : '';
}

// ── Season badge ──────────────────────────────────────────────────────────

function _updateSeasonBadge() {
  const el = document.getElementById('season-badge');
  if (!el) return;
  const s = currentSeason();
  const remaining = seasonTicksRemaining();
  const secsLeft  = Math.ceil(remaining / TICKS_PER_SECOND);
  const mins = Math.floor(secsLeft / 60);
  const secs = secsLeft % 60;
  const timeStr = mins > 0 ? `${mins}m${String(secs).padStart(2,'0')}s` : `${secs}s`;
  const buildingLabel   = SEASON_BUILDING_LABELS[state.season?.index ?? 0] ?? '';
  const unitLabel       = SEASON_UNIT_LABELS[state.season?.index ?? 0] ?? '';
  const combatBuffLabel = SEASON_COMBAT_BUFF_LABELS[state.season?.index ?? 0] ?? '';
  el.textContent = `${s.icon} ${s.name}`;
  el.title = `${s.name}: ${s.desc} — Changes in ${timeStr}\n🏗️ Building bonus: ${buildingLabel}\n⚔️ Unit discount: ${unitLabel}\n⚡ Combat buff: ${combatBuffLabel}`;
}

// ── Weather badge ─────────────────────────────────────────────────────────

function _updateWeatherBadge() {
  const el = document.getElementById('weather-badge');
  if (!el) return;
  const w = getCurrentWeather();
  if (!w) {
    el.textContent = '';
    el.title = '';
    el.style.display = 'none';
    return;
  }
  const secsLeft = getWeatherSecsLeft();
  const mins = Math.floor(secsLeft / 60);
  const secs = secsLeft % 60;
  const timeStr = mins > 0 ? `${mins}m${String(secs).padStart(2,'0')}s` : `${secsLeft}s`;
  el.textContent = `${w.icon} ${w.name}`;
  el.title = `${w.name}: ${w.desc} — Clears in ${timeStr}`;
  el.style.display = '';
}

// ── War Exhaustion badge (T175) ───────────────────────────────────────────

function _updateExhaustionBadge() {
  const el = document.getElementById('exhaustion-badge');
  if (!el) return;
  const level = getExhaustionLevel();
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
  _updateCelestialBanner(); // T153: hide banner on new game
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
