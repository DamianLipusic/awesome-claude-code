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
import { initBarbarians, barbarianTick, getSiegeSecsLeft } from './systems/barbarianCamps.js';
import { initMorale, moraleTick } from './systems/morale.js';
import { initPopulation, populationTick } from './systems/population.js';
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
import { SEASONS } from './data/seasons.js';
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
  registerSystem(inspirationTick);     // T116: research inspiration events: natural disaster tile damage

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
  });
  on(Events.DIPLOMACY_CHANGED, (d) => {
    if (d?.relations === 'allied') awardPrestige(50, 'new alliance formed');
  });
  on(Events.BORDER_SKIRMISH, (d) => {
    if (d?.type === 'mediated') awardPrestige(MEDIATE_PRESTIGE, 'skirmish mediation');
  });
  on(Events.LANDMARK_CAPTURED, (d) => awardPrestige(150, `landmark captured: ${d?.landmarkId ?? ''}`));
  on(Events.FACTION_CAPITAL_CAPTURED, (d) => awardPrestige(150, `faction capital captured: ${d?.factionId ?? ''}`));
  on(Events.RUIN_EXCAVATED, () => awardPrestige(80, 'ancient ruin excavated'));
  on(Events.HERO_QUEST_CHANGED, (d) => {
    if (d?.phase === 3) awardPrestige(200, 'legendary quest completed');  // T112: Supreme Commander unlocked
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
  });

  // Update season badge on changes (also on TICK for countdown display)
  _updateSeasonBadge();
  on(Events.SEASON_CHANGED, _updateSeasonBadge);
  // Refresh season badge every 4 ticks (~1 s) for countdown accuracy
  let _seasonBadgeTick = 0;
  on(Events.TICK, () => { if (++_seasonBadgeTick % 4 === 0) _updateSeasonBadge(); });

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
      version: 34,
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
  el.textContent = `${s.icon} ${s.name}`;
  el.title = `${s.name}: ${s.desc} — Changes in ${timeStr}`;
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

// ── Siege badge (T079) ────────────────────────────────────────────────────

function _updateSiegeBadge() {
  const el = document.getElementById('siege-badge');
  if (!el) return;
  const secsLeft = getSiegeSecsLeft();
  if (secsLeft <= 0) {
    el.style.display = 'none';
    el.textContent = '';
    return;
  }
  el.textContent = `⚔️ SIEGE in ${secsLeft}s`;
  el.title = 'Barbarian Grand Siege incoming! Muster your forces to repel the horde.';
  el.style.display = '';
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

// ── New Game ──────────────────────────────────────────────────────────────

/**
 * Reset all state and start a fresh game.
 * @param {object} [opts]             Optional overrides from the wizard modal.
 * @param {string} [opts.name]        Empire name; defaults to 'My Empire'.
 * @param {string} [opts.difficulty]  'easy'|'normal'|'hard'; persists in state.
 * @param {string} [opts.archetype]   'none'|'conqueror'|'merchant'|'arcane'; persists in state.
 */
function _newGame(opts = {}) {
  _saveToLeaderboard();
  localStorage.removeItem('empireos-save');
  // Apply difficulty + archetype before initState (both persist across new games)
  if (opts.difficulty) state.difficulty = opts.difficulty;
  if (opts.archetype)  state.archetype  = opts.archetype;
  initState(opts.name ?? 'My Empire');
  _applyDifficultyStart();
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
