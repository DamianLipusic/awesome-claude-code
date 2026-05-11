/**
 * EmpireOS — Main entry point.
 * Wires together core engine, systems, and UI on DOMContentLoaded.
 */

import { state, initState }              from './core/state.js';
import { emit, on, off, Events }         from './core/events.js';
import { registerSystem, startLoop, stopLoop, TICKS_PER_SECOND } from './core/tick.js';
import { resourceTick, recalcRates }     from './systems/resources.js';
import { researchTick }                  from './systems/research.js';
import { buildingsTick }                 from './systems/buildings.js';
import { populationTick }                from './systems/population.js';
import { moraleTick }                    from './systems/morale.js';
import { diplomacyTick, initDiplomacy }  from './systems/diplomacy.js';
import { combatTick }                    from './systems/combat.js';
import { randomEventTick }               from './systems/randomEvents.js';
import { questTick }                     from './systems/quests.js';
import { politicalEventTick }            from './systems/politicalEvents.js';
import { bountyTick }                    from './systems/bounty.js';
import { rebellionTick }                 from './systems/rebellion.js';
import { plagueTick }                    from './systems/plague.js';
import { pilgrimageTick }                from './systems/pilgrimages.js';
import { seasonTick, initSeasons, getCurrentSeason } from './systems/seasons.js';
import { weatherTick, initWeather }      from './systems/weather.js';
import { siegeTick }                     from './systems/siege.js';
import { tradeRouteTick }                from './systems/tradeRoutes.js';
import { mapFeatureTick }                from './systems/mapFeatures.js';
import { explorationTick }               from './systems/exploration.js';
import { heroTick, initHero }            from './systems/hero.js';
import { scholarTick }                   from './systems/scholars.js';
import { nobleTick }                     from './systems/nobles.js';
import { refugeeTick }                   from './systems/refugees.js';
import { celestialTick }                 from './systems/celestials.js';
import { ageChallengesTick }             from './systems/ageChallenges.js';
import { legacyTick, initLegacy }        from './systems/legacy.js';
import { spyTick }                       from './systems/spies.js';
import { merchantTick }                  from './systems/merchants.js';
import { alchemyTick }                   from './systems/alchemy.js';
import { militaryTick }                  from './systems/military.js';
import { siegeEngineTick }               from './systems/siegeEngines.js';
import { oracleTick }                    from './systems/oracle.js';
import { mythicCreatureTick }            from './systems/mythicCreatures.js';
import { epicHeroTick }                  from './systems/epicHeroes.js';
import { crisisTick, initCrisis }        from './systems/crisis.js';
import { emergencyTick }                 from './systems/emergency.js';
import { monumentTick }                  from './systems/monuments.js';
import { wonderTick }                    from './systems/wonders.js';
import { relicTick }                     from './systems/relics.js';
import { governanceTick }                from './systems/governance.js';
import { citizenRoleTick, initCitizenRoles } from './systems/citizenRoles.js';
import { fleetTick }                     from './systems/fleet.js';
import { academyTick }                   from './systems/academy.js';
import { manaTick }                      from './systems/mana.js';
import { spellTick }                     from './systems/spells.js';
import { popMilestoneTick }              from './systems/popMilestones.js';
import { inventoryTick }                 from './systems/inventory.js';
import { seasonalCropTick }              from './systems/seasonalCrops.js';
import { npcEmpireTick }                 from './systems/npcEmpires.js';
import { reputationTick }                from './systems/reputation.js';
import { fortuneTick }                   from './systems/fortune.js';
import { resourceSurgeTick }             from './systems/resourceSurge.js';
import { tributeTick }                   from './systems/tribute.js';
import { caravanTick }                   from './systems/caravans.js';
import { spyNetworkTick }                from './systems/spyNetwork.js';
import { courtTick }                     from './systems/court.js';
import { terrainBonusTick }              from './systems/terrainBonus.js';
import { knowledgeTick }                 from './systems/knowledge.js';
import { festivalTick }                  from './systems/festivals.js';
import { natureTick }                    from './systems/nature.js';
import { astronomyTick }                 from './systems/astronomy.js';
import { allianceTick }                  from './systems/alliances.js';
import { warfareTick }                   from './systems/warfare.js';
import { ancientRuinsTick }              from './systems/ancientRuins.js';
import { mercenaryTick }                 from './systems/mercenaries.js';
import { banditTick }                    from './systems/bandits.js';
import { npcRaidTick }                   from './systems/npcRaids.js';
import { cityWallTick }                  from './systems/cityWalls.js';
import { populationGrowthTick }          from './systems/populationGrowth.js';
import { legendaryHeroTick }             from './systems/legendaryHeroes.js';
import { populationEventTick }           from './systems/populationEvents.js';
import { difficultyTick }                from './systems/difficulty.js';
import { achievementTick }               from './systems/achievements.js';
import { mapExpansionTick }              from './systems/mapExpansion.js';
import { autoQueueTick, initAutoQueue }  from './systems/autoQueue.js';
import { resourceCapTick }               from './systems/resourceCaps.js';
import { cityProsperityTick, initCityProsperity } from './systems/cityProsperity.js'; // T235
import { imperialGamesTick, initImperialGames }   from './systems/imperialGames.js'; // T236
import { royalLoanTick, initRoyalLoan }           from './systems/royalLoan.js';     // T237
import { ancientVaultCacheTick, initAncientVaultCache } from './systems/ancientVaultCache.js'; // T238
import { initRecordsExchange }                    from './systems/recordsExchange.js'; // T239
import { nomadicTribeTick, initNomadicTribe }     from './systems/nomadicTribe.js';  // T240
import { prophetTick, initProphet }               from './systems/wanderingProphet.js'; // T241
import { artisanFairTick, initArtisanFair }       from './systems/artisanFair.js';   // T242
import { initEpithet }                            from './systems/epithet.js';        // T243
import { initCosmicAlignment, cosmicAlignmentTick } from './systems/cosmicAlignment.js'; // T244

import { initMap }                       from './systems/mapInit.js';
import { addMessage, initLog }           from './ui/log.js';
import { initBuildPanel }                from './ui/buildPanel.js';
import { initUnitsPanel }                from './ui/unitsPanel.js';
import { initMapPanel }                  from './ui/mapPanel.js';
import { initResearchPanel }             from './ui/researchPanel.js';
import { initDiplomacyPanel }            from './ui/diplomacyPanel.js';
import { initMarketPanel }               from './ui/marketPanel.js';
import { initQuestPanel }                from './ui/questPanel.js';
import { initStoryPanel }                from './ui/storyPanel.js';
import { initSettingsPanel }             from './ui/settingsPanel.js';
import { initSummaryPanel }              from './ui/summaryPanel.js';
import { initAlmanacPanel }              from './ui/almanacPanel.js';
import { switchTab }                     from './ui/tabSwitcher.js';

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
  registerSystem(questTick);
  registerSystem(buildingsTick);
  registerSystem(populationTick);
  registerSystem(moraleTick);
  registerSystem(diplomacyTick);
  registerSystem(combatTick);
  registerSystem(politicalEventTick);
  registerSystem(bountyTick);
  registerSystem(rebellionTick);
  registerSystem(plagueTick);
  registerSystem(pilgrimageTick);
  registerSystem(seasonTick);
  registerSystem(weatherTick);
  registerSystem(siegeTick);
  registerSystem(tradeRouteTick);
  registerSystem(mapFeatureTick);
  registerSystem(explorationTick);
  registerSystem(heroTick);
  registerSystem(scholarTick);
  registerSystem(nobleTick);
  registerSystem(refugeeTick);
  registerSystem(celestialTick);
  registerSystem(ageChallengesTick);
  registerSystem(legacyTick);
  registerSystem(spyTick);
  registerSystem(merchantTick);
  registerSystem(alchemyTick);
  registerSystem(militaryTick);
  registerSystem(siegeEngineTick);
  registerSystem(oracleTick);
  registerSystem(mythicCreatureTick);
  registerSystem(epicHeroTick);
  registerSystem(crisisTick);
  registerSystem(emergencyTick);
  registerSystem(monumentTick);
  registerSystem(wonderTick);
  registerSystem(relicTick);
  registerSystem(governanceTick);
  registerSystem(citizenRoleTick);
  registerSystem(fleetTick);
  registerSystem(academyTick);
  registerSystem(manaTick);
  registerSystem(spellTick);
  registerSystem(popMilestoneTick);
  registerSystem(inventoryTick);
  registerSystem(seasonalCropTick);
  registerSystem(npcEmpireTick);
  registerSystem(reputationTick);
  registerSystem(fortuneTick);
  registerSystem(resourceSurgeTick);
  registerSystem(tributeTick);
  registerSystem(caravanTick);
  registerSystem(spyNetworkTick);
  registerSystem(courtTick);
  registerSystem(terrainBonusTick);
  registerSystem(knowledgeTick);
  registerSystem(festivalTick);
  registerSystem(natureTick);
  registerSystem(astronomyTick);
  registerSystem(allianceTick);
  registerSystem(warfareTick);
  registerSystem(ancientRuinsTick);
  registerSystem(mercenaryTick);
  registerSystem(banditTick);
  registerSystem(npcRaidTick);
  registerSystem(cityWallTick);
  registerSystem(populationGrowthTick);
  registerSystem(legendaryHeroTick);
  registerSystem(populationEventTick);
  registerSystem(difficultyTick);
  registerSystem(achievementTick);
  registerSystem(mapExpansionTick);
  registerSystem(autoQueueTick);
  registerSystem(resourceCapTick);
  registerSystem(cityProsperityTick);    // T235: city prosperity
  registerSystem(imperialGamesTick);     // T236: imperial games
  registerSystem(royalLoanTick);         // T237: royal loan
  registerSystem(ancientVaultCacheTick); // T238: vault cache spawn/expiry
  registerSystem(nomadicTribeTick);      // T240: nomadic tribe encounter spawn/expiry
  registerSystem(prophetTick);           // T241: wandering prophet spawn/expiry
  registerSystem(artisanFairTick);       // T242: artisan fair spawn/expiry
  registerSystem(cosmicAlignmentTick);   // T244: cosmic alignment spawn/expiry

  // Init UI
  initLog();
  initBuildPanel();
  initUnitsPanel();
  initMapPanel();
  initResearchPanel();
  initDiplomacyPanel();
  initMarketPanel();
  initQuestPanel();
  initStoryPanel();
  initSettingsPanel();
  initSummaryPanel();
  initAlmanacPanel();

  // Init systems that need post-boot setup
  initDiplomacy();
  initHero();
  initLegacy();
  initCrisis();
  initCitizenRoles();
  initAutoQueue();
  initSeasons();
  initWeather();
  initCityProsperity();  // T235
  initImperialGames();   // T236
  initRoyalLoan();       // T237
  initAncientVaultCache(); // T238
  initRecordsExchange(); // T239
  initNomadicTribe();    // T240
  initProphet();         // T241
  initArtisanFair();     // T242
  initEpithet();         // T243: subscribe SEASON_CHANGED + initial calculation
  initCosmicAlignment(); // T244: cosmic alignment state init

  // Wire events
  on(Events.MAP_CHANGED,       _checkExpansionMilestones);
  on(Events.POPULATION_CHANGED, _showPopMilestoneModal);
  on(Events.TICK,              _maybeShowOfflineModal);
  on(Events.GAME_LOADED,       () => { _bindKeyboard(); _updateAllBadges(); });

  _bindKeyboard();
  _updateAllBadges();

  // Show pending offline modal after a short delay
  if (_pendingOffline) {
    setTimeout(() => _showOfflineModal(_pendingOffline), 400);
    _pendingOffline = null;
  }

  // Start tick loop
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
        map:           state.map,
        techs:         state.techs,
        population:    state.population,
        morale:        state.morale,
        diplomacy:     state.diplomacy,
        combat:        state.combat,
        quests:        state.quests,
        events:        state.events,
        bounty:        state.bounty,
        rebellion:     state.rebellion,
        plague:        state.plague,
        pilgrimages:   state.pilgrimages,
        seasons:       state.seasons,
        weather:       state.weather,
        siege:         state.siege,
        tradeRoutes:   state.tradeRoutes,
        mapFeatures:   state.mapFeatures,
        exploration:   state.exploration,
        hero:          state.hero,
        scholars:      state.scholars,
        nobles:        state.nobles,
        refugees:      state.refugees,
        celestials:    state.celestials,
        ageChallenges: state.ageChallenges,
        legacy:        state.legacy,
        spies:         state.spies,
        merchants:     state.merchants,
        alchemy:       state.alchemy,
        military:      state.military,
        siegeEngines:  state.siegeEngines,
        oracle:        state.oracle,
        mythicCreatures: state.mythicCreatures,
        epicHeroes:    state.epicHeroes,
        crisis:        state.crisis,
        emergency:     state.emergency,
        monuments:     state.monuments,
        wonders:       state.wonders,
        relics:        state.relics,
        governance:    state.governance,
        citizenRoles:  state.citizenRoles,
        fleet:         state.fleet,
        academy:       state.academy,
        mana:          state.mana,
        spells:        state.spells,
        popMilestones: state.popMilestones,
        inventory:     state.inventory,
        seasonalCrops: state.seasonalCrops,
        npcEmpires:    state.npcEmpires,
        reputation:    state.reputation,
        fortune:       state.fortune,
        resourceSurge: state.resourceSurge,
        tribute:       state.tribute,
        caravans:      state.caravans,
        spyNetwork:    state.spyNetwork,
        court:         state.court,
        knowledge:     state.knowledge,
        festivals:     state.festivals,
        nature:        state.nature,
        astronomy:     state.astronomy,
        alliances:     state.alliances,
        warfare:       state.warfare,
        ancientRuins:  state.ancientRuins,
        mercenaries:   state.mercenaries,
        bandits:       state.bandits,
        npcRaids:      state.npcRaids,
        cityWalls:     state.cityWalls,
        populationGrowth: state.populationGrowth,
        legendaryHeroes: state.legendaryHeroes,
        populationEvents: state.populationEvents,
        difficulty:    state.difficulty,
        achievements:  state.achievements,
        mapExpansion:  state.mapExpansion,
        autoQueue:     state.autoQueue,
        resourceCaps:  state.resourceCaps,
        cityProsperity:    state.cityProsperity,      // T235
        imperialGames:     state.imperialGames,       // T236
        royalLoan:         state.royalLoan,           // T237
        ancientVaultCache: state.ancientVaultCache,   // T238
        recordsExchange:   state.recordsExchange,     // T239
        nomadicTribe:      state.nomadicTribe,        // T240
        prophet:           state.prophet,             // T241
        artisanFair:       state.artisanFair,         // T242
        cosmicAlignment:   state.cosmicAlignment,     // T244
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
    const data = JSON.parse(raw);
    if (!data?.version) return null;
    return data;
  } catch {
    return null;
  }
}

function _applySave(save) {
  const s = save.state;
  if (!s) return;

  // Restore all state fields
  state.empire              = s.empire              ?? state.empire;
  state.resources           = s.resources           ?? state.resources;
  state.rates               = s.rates               ?? state.rates;
  state.caps                = s.caps                ?? state.caps;
  state.buildings           = s.buildings           ?? state.buildings;
  state.units               = s.units               ?? state.units;
  state.map                 = s.map                 ?? state.map;
  state.techs               = s.techs               ?? state.techs;
  state.population          = s.population          ?? state.population;
  state.morale              = s.morale              ?? state.morale;
  state.diplomacy           = s.diplomacy           ?? state.diplomacy;
  state.combat              = s.combat              ?? state.combat;
  state.quests              = s.quests              ?? state.quests;
  state.events              = s.events              ?? state.events;
  state.bounty              = s.bounty              ?? state.bounty;
  state.rebellion           = s.rebellion           ?? state.rebellion;
  state.plague              = s.plague              ?? state.plague;
  state.pilgrimages         = s.pilgrimages         ?? state.pilgrimages;
  state.seasons             = s.seasons             ?? state.seasons;
  state.weather             = s.weather             ?? state.weather;
  state.siege               = s.siege               ?? state.siege;
  state.tradeRoutes         = s.tradeRoutes         ?? state.tradeRoutes;
  state.mapFeatures         = s.mapFeatures         ?? state.mapFeatures;
  state.exploration         = s.exploration         ?? state.exploration;
  state.hero                = s.hero                ?? state.hero;
  state.scholars            = s.scholars            ?? state.scholars;
  state.nobles              = s.nobles              ?? state.nobles;
  state.refugees            = s.refugees            ?? state.refugees;
  state.celestials          = s.celestials          ?? state.celestials;
  state.ageChallenges       = s.ageChallenges       ?? state.ageChallenges;
  state.legacy              = s.legacy              ?? state.legacy;
  state.spies               = s.spies               ?? state.spies;
  state.merchants           = s.merchants           ?? state.merchants;
  state.alchemy             = s.alchemy             ?? state.alchemy;
  state.military            = s.military            ?? state.military;
  state.siegeEngines        = s.siegeEngines        ?? state.siegeEngines;
  state.oracle              = s.oracle              ?? state.oracle;
  state.mythicCreatures     = s.mythicCreatures     ?? state.mythicCreatures;
  state.epicHeroes          = s.epicHeroes          ?? state.epicHeroes;
  state.crisis              = s.crisis              ?? state.crisis;
  state.emergency           = s.emergency           ?? state.emergency;
  state.monuments           = s.monuments           ?? state.monuments;
  state.wonders             = s.wonders             ?? state.wonders;
  state.relics              = s.relics              ?? state.relics;
  state.governance          = s.governance          ?? state.governance;
  state.citizenRoles        = s.citizenRoles        ?? null;  // T096 (null = initialise on first use)
  state.raiderFaction       = s.raiderFaction       ?? null;
  state.fleet               = s.fleet               ?? state.fleet;
  state.academy             = s.academy             ?? state.academy;
  state.mana                = s.mana                ?? state.mana;
  state.spells              = s.spells              ?? state.spells;
  state.popMilestones       = s.popMilestones       ?? state.popMilestones;
  state.inventory           = s.inventory           ?? state.inventory;
  state.seasonalCrops       = s.seasonalCrops       ?? state.seasonalCrops;
  state.npcEmpires          = s.npcEmpires          ?? state.npcEmpires;
  state.reputation          = s.reputation          ?? state.reputation;
  state.fortune             = s.fortune             ?? state.fortune;
  state.resourceSurge       = s.resourceSurge       ?? state.resourceSurge;
  state.tribute             = s.tribute             ?? state.tribute;
  state.caravans            = s.caravans            ?? state.caravans;
  state.spyNetwork          = s.spyNetwork          ?? state.spyNetwork;
  state.court               = s.court               ?? state.court;
  state.knowledge           = s.knowledge           ?? state.knowledge;
  state.festivals           = s.festivals           ?? state.festivals;
  state.nature              = s.nature              ?? state.nature;
  state.astronomy           = s.astronomy           ?? state.astronomy;
  state.alliances           = s.alliances           ?? state.alliances;
  state.warfare             = s.warfare             ?? state.warfare;
  state.ancientRuins        = s.ancientRuins        ?? state.ancientRuins;
  state.mercenaries         = s.mercenaries         ?? state.mercenaries;
  state.bandits             = s.bandits             ?? state.bandits;
  state.npcRaids            = s.npcRaids            ?? state.npcRaids;
  state.cityWalls           = s.cityWalls           ?? state.cityWalls;
  state.populationGrowth    = s.populationGrowth    ?? state.populationGrowth;
  state.legendaryHeroes     = s.legendaryHeroes     ?? state.legendaryHeroes;
  state.populationEvents    = s.populationEvents    ?? state.populationEvents;
  state.difficulty          = s.difficulty          ?? state.difficulty;
  state.achievements        = s.achievements        ?? state.achievements;
  state.mapExpansion        = s.mapExpansion        ?? state.mapExpansion;
  state.autoQueue           = s.autoQueue           ?? state.autoQueue;
  state.resourceCaps        = s.resourceCaps        ?? state.resourceCaps;
  state.diplomacy      ?? null;
  state.season         = s.season         ?? null;
  state.hero           = s.hero           ?? null;
  // T070: migrate hero from pre-skill-system saves
  if (state.hero?.rec) {
    delete state.hero.rec; // drop stale field from older saves
  }
  state.cityProsperity      = s.cityProsperity      ?? null; // T235
  state.imperialGames       = s.imperialGames       ?? null; // T236
  state.royalLoan           = s.royalLoan           ?? null; // T237
  state.ancientVaultCache   = s.ancientVaultCache   ?? null; // T238
  state.recordsExchange     = s.recordsExchange     ?? null; // T239
  state.nomadicTribe        = s.nomadicTribe        ?? null; // T240
  state.prophet             = s.prophet             ?? null; // T241
  state.artisanFair         = s.artisanFair         ?? null; // T242
  state.cosmicAlignment     = s.cosmicAlignment     ?? null; // T244
  // T086: migrate older saves — ensure hero.expedition exists
  if (state.hero?.recruited && !state.hero.expedition) {
    state.hero.expedition = { active: false, endsAt: 0 };
  }
  state.tick             = s.tick             ?? 0;
  recalcRates();

  // Offline progress
  const offlineTicks = Math.floor((Date.now() - (save.ts ?? Date.now())) / 250);
  if (offlineTicks > 4 * 30) { // more than 30 seconds offline
    const cap = 4 * 60 * 60; // max 1 hour offline
    const ticks = Math.min(offlineTicks, cap);
    _pendingOffline = { ticks, secs: Math.floor(ticks / 4) };
  }
}

// ── New game helpers ──────────────────────────────────────────────────

function _applyDifficultyStart() {
  const d = state.difficulty?.level ?? 'normal';
  if (d === 'easy') {
    state.resources.gold  = (state.resources.gold  ?? 0) + 200;
    state.resources.food  = (state.resources.food  ?? 0) + 100;
    state.resources.wood  = (state.resources.wood  ?? 0) + 100;
    state.resources.stone = (state.resources.stone ?? 0) + 100;
  } else if (d === 'hard') {
    state.resources.gold  = Math.max(0, (state.resources.gold  ?? 0) - 50);
    state.resources.food  = Math.max(0, (state.resources.food  ?? 0) - 20);
  }
}

function _applyLegacyBonuses() {
  const traits = state.legacy?.purchasedTraits ?? [];
  for (const id of traits) {
    // Legacy trait application logic lives in legacy.js;
    // here we just emit so legacy.js can react
  }
  if (traits.length > 0) emit(Events.LEGACY_APPLIED, { traits });
}

// ── Expansion milestones ──────────────────────────────────────────────

function _checkExpansionMilestones() {
  const reached = state.expansionMilestonesReached ?? (state.expansionMilestonesReached = {});
  let playerTiles = 0;
  if (state.map?.tiles) {
    for (const row of state.map.tiles)
      for (const t of row)
        if (t.owner === 'player') playerTiles++;
  }
  for (const m of EXPANSION_MILESTONES) {
    if (!reached[m.threshold] && playerTiles >= m.threshold) {
      reached[m.threshold] = true;
      for (const [res, amt] of Object.entries(m.rewards)) {
        state.resources[res] = (state.resources[res] ?? 0) + amt;
      }
      state.resources.prestige = (state.resources.prestige ?? 0) + m.prestige;
      addMessage(`🏆 Milestone: ${m.title} — territory reached ${m.threshold} tiles!`, 'milestone');
      emit(Events.RESOURCE_CHANGED);
    }
  }
}

on(Events.MAP_CHANGED, _checkExpansionMilestones);

// ── Population milestone modal ─────────────────────────────────────────

const POP_MILESTONES = [100, 250, 500, 1000, 2500, 5000, 10000];

function _showPopMilestoneModal(threshold) {
  const el = document.getElementById('pop-milestone-modal');
  if (!el) return;
  el.querySelector('.pop-milestone__threshold').textContent = threshold.toLocaleString();
  el.classList.remove('modal--hidden');
}

function _applyPopMilestoneOption(option) {
  const el = document.getElementById('pop-milestone-modal');
  if (el) el.classList.add('modal--hidden');
  if (option === 'grow') {
    state.resources.food = (state.resources.food ?? 0) + 200;
    addMessage('🍞 Population Growth Bonus: +200 food.', 'info');
  } else if (option === 'culture') {
    state.resources.prestige = (state.resources.prestige ?? 0) + 50;
    addMessage('🎭 Population Culture Bonus: +50 prestige.', 'info');
  } else if (option === 'military') {
    state.units.soldiers = (state.units.soldiers ?? 0) + 10;
    addMessage('⚔️ Population Military Bonus: +10 soldiers.', 'info');
  }
  emit(Events.RESOURCE_CHANGED);
}

// Attach pop milestone modal buttons
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-pop-option]').forEach(btn => {
    btn.addEventListener('click', () => _applyPopMilestoneOption(btn.dataset.popOption));
  });
});

// ── Offline progress modal ────────────────────────────────────────────

function _showOfflineModal({ ticks, secs }) {
  const el = document.getElementById('offline-modal');
  if (!el) return;
  el.querySelector('.offline-modal__time').textContent =
    secs >= 3600 ? `${Math.floor(secs/3600)}h ${Math.floor((secs%3600)/60)}m`
    : secs >= 60  ? `${Math.floor(secs/60)}m ${secs%60}s`
    : `${secs}s`;
  el.classList.remove('modal--hidden');

  const btn = el.querySelector('[data-offline-dismiss]');
  if (btn) btn.onclick = () => el.classList.add('modal--hidden');

  // Apply offline ticks in background
  _processOfflineTicks(ticks);
}

let _maybeOfflineDone = false;
function _maybeShowOfflineModal() {
  if (_maybeOfflineDone) return;
  _maybeOfflineDone = true;
  if (_pendingOffline) {
    _showOfflineModal(_pendingOffline);
    _pendingOffline = null;
  }
}

function _processOfflineTicks(ticks) {
  // Run tick systems silently
  const batch = Math.min(ticks, 4 * 60 * 60); // max 1h
  let i = 0;
  function step() {
    const end = Math.min(i + 200, batch);
    for (; i < end; i++) {
      resourceTick();
      researchTick();
      populationTick();
      moraleTick();
      state.tick++;
    }
    if (i < batch) setTimeout(step, 0);
    else { recalcRates(); emit(Events.RESOURCE_CHANGED); }
  }
  step();
}

// ── Auto-queue tick helper ───────────────────────────────────────────

function _processAutoQueue() {
  // Delegated to autoQueue system
}

// ── Badge / banner updates ───────────────────────────────────────────

function _updateAllBadges() {
  _updateAgeBadge();
  _updateSeasonBadge();
  _updateWeatherBadge();
  _updateExhaustionBadge();
  _updateSiegeBadge();
  _updateCrisisBanner();
  _updateScholarBanner();
  _updateNobleBanner();
  _updateRefugeeBanner();
  _updateCelestialBanner();
  _updateAgeChallengeBadge();
  _updateEmergencyBtn();
}

on(Events.AGE_CHANGED,    _updateAgeBadge);
on(Events.SEASON_CHANGED, _updateSeasonBadge);
on(Events.TICK,           () => {
  // Update badges every second (4 ticks)
  if (state.tick % 4 === 0) _updateAllBadges();
});

function _updateAgeBadge() {
  const el = document.getElementById('age-badge');
  if (!el) return;
  const AGES = ['Stone Age', 'Bronze Age', 'Iron Age', 'Classical', 'Medieval', 'Renaissance'];
  const ICONS = ['🪨', '🛡️', '⚔️', '🏛️', '🏰', '🔭'];
  const a = state.age ?? 0;
  el.textContent = `${ICONS[a] ?? ''} ${AGES[a] ?? 'Unknown'}`;
}

function _updateSeasonBadge() {
  const el = document.getElementById('season-badge');
  if (!el) return;
  const season = getCurrentSeason();
  el.textContent = season ? `${season.icon} ${season.name}` : '';
}

function _updateWeatherBadge() {
  const el = document.getElementById('weather-badge');
  if (!el) return;
  const w = state.weather?.current;
  el.textContent = w ? `${w.icon} ${w.name}` : '';
}

function _updateExhaustionBadge() {
  const el = document.getElementById('exhaustion-badge');
  if (!el) return;
  const ex = state.military?.exhaustion ?? 0;
  el.classList.toggle('badge--hidden', ex < 20);
  el.textContent = ex >= 20 ? `💤 ${ex}% Tired` : '';
}

function _updateSiegeBadge() {
  const el = document.getElementById('siege-badge');
  if (!el) return;
  const s = state.siege?.active;
  el.classList.toggle('badge--hidden', !s);
  el.textContent = s ? `🏹 Siege Active` : '';
}

function _updateCrisisBanner() {
  const el = document.getElementById('crisis-banner');
  if (!el) return;
  const c = state.crisis?.active;
  el.classList.toggle('banner--hidden', !c);
  if (c) el.querySelector('.crisis-banner__text').textContent = `⚠️ ${c.label}`;
}

function _updateScholarBanner() {
  const el = document.getElementById('scholar-banner');
  if (!el) return;
  const s = state.scholars?.active;
  el.classList.toggle('banner--hidden', !s);
}

function _updateNobleBanner() {
  const el = document.getElementById('noble-banner');
  if (!el) return;
  const n = state.nobles?.unrest;
  el.classList.toggle('banner--hidden', !n);
}

function _updateRefugeeBanner() {
  const el = document.getElementById('refugee-banner');
  if (!el) return;
  const r = state.refugees?.wave;
  el.classList.toggle('banner--hidden', !r);
}

function _updateCelestialBanner() {
  const el = document.getElementById('celestial-banner');
  if (!el) return;
  const c = state.celestials?.active;
  el.classList.toggle('banner--hidden', !c);
  if (c) el.querySelector('.celestial-banner__text').textContent = `✨ ${c.name}`;
}

function _updateAgeChallengeBadge() {
  const el = document.getElementById('age-challenge-badge');
  if (!el) return;
  const a = state.ageChallenges?.current;
  el.classList.toggle('badge--hidden', !a);
}

function _updateEmergencyBtn() {
  const el = document.getElementById('emergency-btn');
  if (!el) return;
  const e = state.emergency?.available;
  el.classList.toggle('btn--hidden', !e);
}

function _applyEmergencyOption(option) {
  emit(Events.EMERGENCY_CHOSEN, { option });
}

// Attach emergency button
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('emergency-btn');
  if (btn) btn.addEventListener('click', () => {
    const modal = document.getElementById('emergency-modal');
    if (modal) modal.classList.remove('modal--hidden');
  });
  document.querySelectorAll('[data-emergency-option]').forEach(b => {
    b.addEventListener('click', () => {
      _applyEmergencyOption(b.dataset.emergencyOption);
      document.getElementById('emergency-modal')?.classList.add('modal--hidden');
    });
  });
});

// ── New Game (called from Settings panel) ──────────────────────────────

export function newGame(empireName = 'My Empire') {
  stopLoop();
  localStorage.removeItem('empireos-save');
  initState(empireName);
  _applyDifficultyStart();
  _applyLegacyBonuses();
  initMap();

  initDiplomacy();
  initHero();
  initLegacy();
  initCrisis();
  initCitizenRoles();
  initAutoQueue();
  initSeasons();
  initWeather();
  initCityProsperity();  // T235
  initImperialGames();   // T236
  initRoyalLoan();       // T237
  initAncientVaultCache(); // T238
  initRecordsExchange(); // T239
  initNomadicTribe();    // T240: reset nomadic tribe state on new game
  initProphet();         // T241: reset wandering prophet state on new game
  initArtisanFair();     // T242: reset artisan fair state on new game
  initEpithet();         // T243: recalculate epithet for new empire
  initCosmicAlignment(); // T244: reset cosmic alignment state on new game
  _updateCelestialBanner(); // T153: hide banner on new game
  _updateRefugeeBanner();   // T217: hide refugee banner on new game
  recalcRates();
  startLoop();  // restart loop in case it was stopped by game-over

  addMessage('New empire founded. Good luck!', 'info');
  emit(Events.RESOURCE_CHANGED);
  emit(Events.MAP_CHANGED);
  emit(Events.AGE_CHANGED, { age: 0 });
}

// ── Pause / Resume ───────────────────────────────────────────────────

let _paused = false;

export function isPaused() { return _paused; }

function _togglePause() {
  _paused = !_paused;
  if (_paused) stopLoop(); else startLoop();
  _updatePauseUI();
}

function _updatePauseUI() {
  const btn     = document.getElementById('pause-btn');
  const overlay = document.getElementById('pause-overlay');
  if (btn) {
    btn.classList.toggle('btn--paused', _paused);
  }
  if (overlay) {
    overlay.classList.toggle('pause-overlay--hidden', !_paused);
    overlay.setAttribute('aria-hidden', String(!_paused));
  }
}

// ── Keyboard shortcuts ────────────────────────────────────────────

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

// ── Start ─────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
