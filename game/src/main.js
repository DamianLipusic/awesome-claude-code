/**
 * EmpireOS — Main entry point.
 * Wires together core engine, systems, and UI on DOMContentLoaded.
 */

import { state, initState } from './core/state.js';
import { emit, on, Events } from './core/events.js';
import { registerSystem, startLoop, stopLoop } from './core/tick.js';
import { resourceTick, recalcRates } from './systems/resources.js';
import { researchTick } from './systems/research.js';
import { questTick } from './systems/quests.js';
import { buildingsTick } from './systems/buildings.js';
import { unitsTick } from './systems/units.js';
import { populationTick } from './systems/population.js';
import { moraleTick } from './systems/morale.js';
import { diplomacyTick } from './systems/diplomacy.js';
import { challengesTick } from './systems/challenges.js';
import { politicalEventsTick } from './systems/politicalEvents.js';
import { bountyTick } from './systems/bounty.js';
import { rebelsTick } from './systems/rebels.js'; // T151
import { plagueTick } from './systems/plague.js'; // T161
import { pilgrimageTick } from './systems/pilgrimages.js'; // T162
import { seasonTick, initSeasons } from './systems/seasons.js'; // T165
import { seasonalObjectivesTick } from './systems/seasonalObjectives.js'; // T170
import { manaProducerTick } from './systems/mana.js'; // T175
import { oracleTick, initOracle } from './systems/oracle.js'; // T193
import { epicQuestsTick, initEpicQuests } from './systems/epicQuests.js'; // T202
import { royalHuntTick } from './systems/royalHunt.js'; // T214
import { legendaryTick } from './systems/legendaryEncounters.js'; // T216
import { attritionTick } from './systems/attrition.js'; // T218
import { npcCombatTick } from './systems/npcCombat.js'; // T220
import { harvestTick } from './systems/harvest.js'; // T234
import { imperialGamesTick } from './systems/imperialGames.js'; // T236
import { tribeTick } from './systems/nomadicTribe.js'; // T240
import { prophetTick } from './systems/wanderingProphet.js'; // T241 (no init needed)
import { artisanFairTick } from './systems/artisanFair.js'; // T242
import { initEpithet } from './systems/epithet.js'; // T243
import { initCosmicAlignment, cosmicAlignmentTick } from './systems/cosmicAlignment.js'; // T244

import { initProphet } from './systems/wanderingProphet.js'; // T241
import { initArtisanFair } from './systems/artisanFair.js'; // T242

// Leaderboard localStorage key (shared with settingsPanel.js)
const LB_KEY = 'empireos-leaderboard';

// T097: Territorial expansion milestones — one-time rewards on tile-count thresholds
const EXPANSION_MILESTONES = [
  { tiles: 10,  gold: 50,  prestige: 20  },
  { tiles: 25,  gold: 100, prestige: 50  },
  { tiles: 50,  gold: 200, prestige: 100 },
  { tiles: 100, gold: 400, prestige: 200 },
  { tiles: 200, gold: 800, prestige: 400 },
];

// T119: Resource cache milestones — one-time gold bonus when stored resources reach thresholds
const RESOURCE_CACHE_MILESTONES = [
  { resource: 'food',  threshold: 500,  gold: 30  },
  { resource: 'food',  threshold: 2000, gold: 80  },
  { resource: 'wood',  threshold: 500,  gold: 30  },
  { resource: 'wood',  threshold: 2000, gold: 80  },
  { resource: 'stone', threshold: 500,  gold: 30  },
  { resource: 'stone', threshold: 2000, gold: 80  },
];

// T120: Trade milestones — one-time prestige bonus when total trade income reaches thresholds
const TRADE_MILESTONES = [
  { income: 100,   prestige: 20  },
  { income: 500,   prestige: 60  },
  { income: 2000,  prestige: 150 },
  { income: 10000, prestige: 400 },
];

// -- Age definitions (T037) ---------------------------------------------------
const AGES = [
  { name: 'Stone Age',   icon: '🪨', requiredTiles: 0,  requiredTechs: 0 },
  { name: 'Bronze Age',  icon: '🛡️', requiredTiles: 3,  requiredTechs: 2 },
  { name: 'Iron Age',    icon: '⚔️',  requiredTiles: 8,  requiredTechs: 4 },
  { name: 'Classical',   icon: '🏛️', requiredTiles: 15, requiredTechs: 8 },
  { name: 'Medieval',    icon: '🏰', requiredTiles: 30, requiredTechs: 14 },
  { name: 'Renaissance', icon: '🔭', requiredTiles: 50, requiredTechs: 20 },
];

// ---- UI panels ---------------------------------------------------------------
import { initResourcePanel } from './ui/resourcePanel.js';
import { initMapPanel }      from './ui/mapPanel.js';
import { initBuildPanel }    from './ui/buildPanel.js';
import { initTechPanel }     from './ui/techPanel.js';
import { initUnitsPanel }    from './ui/unitsPanel.js';
import { initQuestPanel }    from './ui/questPanel.js';
import { initDiplomacyPanel } from './ui/diplomacyPanel.js';
import { initSummaryPanel }  from './ui/summaryPanel.js';
import { initSettingsPanel } from './ui/settingsPanel.js';

// ---- Entry point -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  _initGame();
});

function _initGame() {
  // ---- Register all tick systems (order matters) ----------------------------
  registerSystem(resourceTick);
  registerSystem(researchTick);
  registerSystem(questTick);
  registerSystem(buildingsTick);
  registerSystem(unitsTick);
  registerSystem(populationTick);
  registerSystem(moraleTick);
  registerSystem(diplomacyTick);
  registerSystem(challengesTick);
  registerSystem(politicalEventsTick);
  registerSystem(bountyTick);
  registerSystem(rebelsTick);
  registerSystem(plagueTick);
  registerSystem(pilgrimageTick);
  registerSystem(seasonTick);
  registerSystem(seasonalObjectivesTick);
  registerSystem(manaProducerTick);
  registerSystem(oracleTick);
  registerSystem(epicQuestsTick);
  registerSystem(royalHuntTick);
  registerSystem(legendaryTick);
  registerSystem(attritionTick);
  registerSystem(npcCombatTick);
  registerSystem(harvestTick);
  registerSystem(imperialGamesTick);
  registerSystem(tribeTick);
  registerSystem(prophetTick);
  registerSystem(artisanFairTick);
  registerSystem(cosmicAlignmentTick);   // T244: cosmic alignment spawn/expiry

  // ---- Init UI panels -------------------------------------------------------
  initResourcePanel();
  initMapPanel();
  initBuildPanel();
  initTechPanel();
  initUnitsPanel();
  initQuestPanel();
  initDiplomacyPanel();
  initSummaryPanel();
  initSettingsPanel();

  // ---- Wire tab switching ---------------------------------------------------
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`panel-${target}`)?.classList.add('active');
    });
  });

  // ---- Event-driven milestone checks ----------------------------------------
  on(Events.MAP_CHANGED,      _checkExpansionMilestones);
  on(Events.RESOURCE_CHANGED, _checkResourceCacheMilestones);
  on(Events.RESOURCE_CHANGED, _checkTradeMilestones);
  on(Events.AGE_CHANGED,      _checkAgeMilestones);

  // ---- Age advancement check on relevant changes ----------------------------
  on(Events.MAP_CHANGED,   _checkAgeAdvancement);
  on(Events.TECH_CHANGED,  _checkAgeAdvancement);

  // ---- Autosave every 30 seconds -------------------------------------------
  on(Events.TICK, _autosave);

  // ---- Load or start game --------------------------------------------------
  if (!_loadGame()) {
    _newGame();
  }

  // ---- Start the tick loop -------------------------------------------------
  startLoop();
}

// ---- Age advancement --------------------------------------------------------

function _checkAgeAdvancement() {
  const current = state.age ?? 0;
  const next    = current + 1;
  if (next >= AGES.length) return; // Already at max age

  const nextAge = AGES[next];

  // Count player tiles
  let playerTiles = 0;
  if (state.map) {
    for (const row of state.map.tiles)
      for (const t of row)
        if (t.owner === 'player') playerTiles++;
  }

  // Count researched techs
  const techsDone = Object.keys(state.techs ?? {}).length;

  if (playerTiles >= nextAge.requiredTiles && techsDone >= nextAge.requiredTechs) {
    state.age = next;
    emit(Events.AGE_CHANGED, { age: next, name: nextAge.name });
  }
}

// ---- Milestone checks -------------------------------------------------------

function _checkExpansionMilestones() {
  if (!state.map) return;

  let playerTiles = 0;
  for (const row of state.map.tiles)
    for (const t of row)
      if (t.owner === 'player') playerTiles++;

  const reached = state.expansionMilestonesReached ?? {};

  for (const m of EXPANSION_MILESTONES) {
    if (!reached[m.tiles] && playerTiles >= m.tiles) {
      reached[m.tiles] = true;
      state.resources.gold     += m.gold;
      state.resources.prestige = (state.resources.prestige ?? 0) + m.prestige;
      emit(Events.RESOURCE_CHANGED);
    }
  }

  state.expansionMilestonesReached = reached;
}

function _checkResourceCacheMilestones() {
  const reached = state.resourceCacheMilestonesReached ?? {};

  for (const m of RESOURCE_CACHE_MILESTONES) {
    const key = `${m.resource}_${m.threshold}`;
    if (!reached[key] && (state.resources[m.resource] ?? 0) >= m.threshold) {
      reached[key] = true;
      state.resources.gold += m.gold;
      emit(Events.RESOURCE_CHANGED);
    }
  }

  state.resourceCacheMilestonesReached = reached;
}

function _checkTradeMilestones() {
  const reached = state.tradeMilestonesReached ?? {};
  const income  = state.stats?.tradeIncome ?? 0;

  for (const m of TRADE_MILESTONES) {
    if (!reached[m.income] && income >= m.income) {
      reached[m.income] = true;
      state.resources.prestige = (state.resources.prestige ?? 0) + m.prestige;
      emit(Events.RESOURCE_CHANGED);
    }
  }

  state.tradeMilestonesReached = reached;
}

function _checkAgeMilestones() {
  const age = state.age ?? 0;
  const reached = state.ageMilestonesReached ?? {};
  if (!reached[age]) {
    reached[age] = true;
    // Age advancement bonuses
    const bonuses = [
      { gold: 50,  prestige: 30  }, // Stone → Bronze
      { gold: 100, prestige: 60  }, // Bronze → Iron
      { gold: 200, prestige: 120 }, // Iron → Classical
      { gold: 400, prestige: 250 }, // Classical → Medieval
      { gold: 800, prestige: 500 }, // Medieval → Renaissance
    ];
    const b = bonuses[age - 1];
    if (b) {
      state.resources.gold     = (state.resources.gold     ?? 0) + b.gold;
      state.resources.prestige = (state.resources.prestige ?? 0) + b.prestige;
      emit(Events.RESOURCE_CHANGED);
    }
    state.ageMilestonesReached = reached;
  }
}

// ---- Autosave ---------------------------------------------------------------

let _autosaveTick = 0;
function _autosave() {
  if (++_autosaveTick % (4 * 30) !== 0) return; // every 30 seconds
  _saveGame();
}

// ---- Save / Load ------------------------------------------------------------

const SAVE_KEY = 'empireos-save';

function _saveGame() {
  try {
    const save = {
      version: 89, // T243: empire epithet system; T244: cosmic alignment
      tick:    state.tick,
      age:     state.age,
      empire:  { ...state.empire },

      resources: { ...state.resources },
      rates:     { ...state.rates },

      buildings: { ...state.buildings },
      units:     { ...state.units },
      map:       {
        width:  state.map.width,
        height: state.map.height,
        tiles:  state.map.tiles.map(row => row.map(t => ({ ...t }))),
      },
      techs: { ...state.techs },

      population: { ...state.population },
      morale:     state.morale,
      prestige:   state.resources.prestige,

      diplomacy:  { ...state.diplomacy,
        empires: state.diplomacy.empires.map(e => ({ ...e })),
      },

      quests:     { ...state.quests,
        completed: { ...state.quests.completed },
      },

      challenges: state.challenges ? {
        active:       state.challenges.active ? { ...state.challenges.active } : null,
        completed:    [...(state.challenges.completed ?? [])],
        nextGenTick:  state.challenges.nextGenTick,
      } : null,

      politicalEvents: state.politicalEvents ? {
        pending:     state.politicalEvents.pending ? { ...state.politicalEvents.pending } : null,
        log:         [...(state.politicalEvents.log ?? [])],
        nextEventAt: state.politicalEvents.nextEventAt,
      } : null,

      bounty: state.bounty ? {
        current:       state.bounty.current ? { ...state.bounty.current } : null,
        nextBountyTick: state.bounty.nextBountyTick,
        completed:     state.bounty.completed ?? 0,
      } : null,

      rebels: state.rebels ? {
        tiles:         [...(state.rebels.tiles ?? [])].map(t => ({ ...t })),
        nextCheckTick: state.rebels.nextCheckTick,
      } : null,

      plague: state.plague ? {
        active:      state.plague.active,
        startTick:   state.plague.startTick,
        endTick:     state.plague.endTick,
        nextCheckAt: state.plague.nextCheckAt,
      } : null,

      pilgrimages: state.pilgrimages ? {
        pending:     state.pilgrimages.pending ? { ...state.pilgrimages.pending } : null,
        activeBonus: state.pilgrimages.activeBonus ? { ...state.pilgrimages.activeBonus } : null,
        nextAt:      state.pilgrimages.nextAt,
      } : null,

      seasons: state.seasons ? {
        current:   state.seasons.current,
        tickStart: state.seasons.tickStart,
        index:     state.seasons.index,
      } : null,

      seasonalObjectives: state.seasonalObjectives ? {
        current:    state.seasonalObjectives.current ? { ...state.seasonalObjectives.current } : null,
        completed:  { ...(state.seasonalObjectives.completed ?? {}) },
      } : null,

      mana: state.resources.mana,

      oracle: state.oracle ? {
        activeOmen:  state.oracle.activeOmen ? { ...state.oracle.activeOmen } : null,
        nextOmenAt:  state.oracle.nextOmenAt,
        history:     [...(state.oracle.history ?? [])],
      } : null,

      epicQuests: state.epicQuests ? {
        chains: Object.fromEntries(
          Object.entries(state.epicQuests.chains).map(([k, v]) => [k, { ...v }])
        ),
      } : null,

      royalHunt: state.royalHunt ? {
        pending:        state.royalHunt.pending ? { ...state.royalHunt.pending } : null,
        active:         state.royalHunt.active ? { ...state.royalHunt.active } : null,
        nextHuntAt:     state.royalHunt.nextHuntAt,
        totalLaunched:  state.royalHunt.totalLaunched ?? 0,
      } : null,

      legendary: state.legendary ? {
        current:       state.legendary.current ? { ...state.legendary.current } : null,
        nextSpawnAt:   state.legendary.nextSpawnAt,
        history:       [...(state.legendary.history ?? [])],
        totalDefeated: state.legendary.totalDefeated ?? 0,
      } : null,

      combatHistory: [...(state.combatHistory ?? [])],

      stats: { ...state.stats },

      harvest: state.harvest ? {
        collectedThisSeason: state.harvest.collectedThisSeason ?? false,
        lastCollectedSeason: state.harvest.lastCollectedSeason ?? -1,
        windowOpen:          state.harvest.windowOpen ?? false,
        windowOpenTick:      state.harvest.windowOpenTick ?? 0,
      } : null,

      imperialGames: state.imperialGames ? {
        pending:     state.imperialGames.pending,
        expiresAt:   state.imperialGames.expiresAt,
        nextGamesAt: state.imperialGames.nextGamesAt,
        seasonsSinceLastGames: state.imperialGames.seasonsSinceLastGames,
      } : null,

      nomadicTribe: state.nomadicTribe ? {
        encounter:   state.nomadicTribe.encounter ? { ...state.nomadicTribe.encounter } : null,
        nextAt:      state.nomadicTribe.nextAt,
      } : null,

      wanderingProphet: state.wanderingProphet ? {
        encounter:   state.wanderingProphet.encounter ? { ...state.wanderingProphet.encounter } : null,
        nextAt:      state.wanderingProphet.nextAt,
      } : null,

      artisanFair: state.artisanFair ? {
        encounter:   state.artisanFair.encounter ? { ...state.artisanFair.encounter } : null,
        nextAt:      state.artisanFair.nextAt,
      } : null,

      cosmicAlignment:     state.cosmicAlignment     ?? null,  // T244

      expansionMilestonesReached:     state.expansionMilestonesReached     ?? {},
      resourceCacheMilestonesReached: state.resourceCacheMilestonesReached ?? {},
      tradeMilestonesReached:         state.tradeMilestonesReached         ?? {},
      ageMilestonesReached:           state.ageMilestonesReached           ?? {},
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch (e) {
    console.error('Save failed:', e);
  }
}

function _loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;

    const s = JSON.parse(raw);
    if (!s || typeof s.version !== 'number') return false;

    // Version gate: incompatible saves
    if (s.version < 50) {
      console.warn('Save version too old, starting fresh.');
      return false;
    }

    state.tick      = s.tick      ?? 0;
    state.age       = s.age       ?? 0;
    state.empire    = { ...state.empire, ...(s.empire ?? {}) };

    state.resources = { ...state.resources, ...(s.resources ?? {}) };
    state.rates     = { ...state.rates,     ...(s.rates     ?? {}) };

    if (s.buildings) state.buildings = { ...state.buildings, ...s.buildings };
    if (s.units)     state.units     = { ...state.units,     ...s.units     };

    // Map
    if (s.map) {
      state.map = {
        width:  s.map.width,
        height: s.map.height,
        tiles:  s.map.tiles.map(row => row.map(t => ({ ...t }))),
      };
    }

    if (s.techs)      state.techs      = { ...s.techs };
    if (s.population) state.population = { ...state.population, ...s.population };
    if (s.morale !== undefined)   state.morale   = s.morale;
    if (s.prestige !== undefined) state.resources.prestige = s.prestige;

    // Diplomacy
    if (s.diplomacy) {
      state.diplomacy = {
        ...state.diplomacy,
        ...s.diplomacy,
        empires: (s.diplomacy.empires ?? []).map(e => ({ ...e })),
      };
    }

    // Quests
    if (s.quests) {
      state.quests = {
        ...state.quests,
        ...s.quests,
        completed: { ...(s.quests.completed ?? {}) },
      };
    }

    // Challenges
    if (s.challenges) {
      state.challenges = {
        active:      s.challenges.active ? { ...s.challenges.active } : null,
        completed:   [...(s.challenges.completed ?? [])],
        nextGenTick: s.challenges.nextGenTick,
      };
    }

    // Political events
    if (s.politicalEvents) {
      state.politicalEvents = {
        pending:     s.politicalEvents.pending ? { ...s.politicalEvents.pending } : null,
        log:         [...(s.politicalEvents.log ?? [])],
        nextEventAt: s.politicalEvents.nextEventAt,
      };
    }

    // Bounty
    if (s.bounty) {
      state.bounty = {
        current:        s.bounty.current ? { ...s.bounty.current } : null,
        nextBountyTick: s.bounty.nextBountyTick,
        completed:      s.bounty.completed ?? 0,
      };
    }

    // Rebels
    if (s.rebels) {
      state.rebels = {
        tiles:         (s.rebels.tiles ?? []).map(t => ({ ...t })),
        nextCheckTick: s.rebels.nextCheckTick,
      };
    }

    // Plague
    if (s.plague) {
      state.plague = {
        active:      s.plague.active      ?? false,
        startTick:   s.plague.startTick   ?? 0,
        endTick:     s.plague.endTick     ?? 0,
        nextCheckAt: s.plague.nextCheckAt ?? 0,
      };
    }

    // Pilgrimages
    if (s.pilgrimages) {
      state.pilgrimages = {
        pending:     s.pilgrimages.pending     ? { ...s.pilgrimages.pending } : null,
        activeBonus: s.pilgrimages.activeBonus ? { ...s.pilgrimages.activeBonus } : null,
        nextAt:      s.pilgrimages.nextAt      ?? 0,
      };
    }

    // Seasons
    if (s.seasons) {
      state.seasons = {
        current:   s.seasons.current   ?? 0,
        tickStart: s.seasons.tickStart ?? 0,
        index:     s.seasons.index     ?? 0,
      };
    }

    // Seasonal objectives
    if (s.seasonalObjectives) {
      state.seasonalObjectives = {
        current:   s.seasonalObjectives.current ? { ...s.seasonalObjectives.current } : null,
        completed: { ...(s.seasonalObjectives.completed ?? {}) },
      };
    }

    // Mana
    if (s.mana !== undefined) state.resources.mana = s.mana;

    // Oracle
    if (s.oracle) {
      state.oracle = {
        activeOmen: s.oracle.activeOmen ? { ...s.oracle.activeOmen } : null,
        nextOmenAt: s.oracle.nextOmenAt ?? 0,
        history:    [...(s.oracle.history ?? [])],
      };
    }

    // Epic quests
    if (s.epicQuests) {
      initEpicQuests();
      for (const [k, v] of Object.entries(s.epicQuests.chains ?? {})) {
        if (state.epicQuests.chains[k]) {
          state.epicQuests.chains[k] = { ...state.epicQuests.chains[k], ...v };
        }
      }
    }

    // Royal hunt
    if (s.royalHunt) {
      state.royalHunt = {
        pending:       s.royalHunt.pending       ? { ...s.royalHunt.pending } : null,
        active:        s.royalHunt.active        ? { ...s.royalHunt.active  } : null,
        nextHuntAt:    s.royalHunt.nextHuntAt    ?? 0,
        totalLaunched: s.royalHunt.totalLaunched ?? 0,
      };
    }

    // Legendary
    if (s.legendary) {
      state.legendary = {
        current:       s.legendary.current       ? { ...s.legendary.current } : null,
        nextSpawnAt:   s.legendary.nextSpawnAt   ?? 0,
        history:       [...(s.legendary.history  ?? [])],
        totalDefeated: s.legendary.totalDefeated ?? 0,
      };
    }

    // Combat history
    if (s.combatHistory) state.combatHistory = [...s.combatHistory];

    // Stats
    if (s.stats) state.stats = { ...state.stats, ...s.stats };

    // Harvest (T234)
    if (s.harvest) {
      state.harvest = {
        collectedThisSeason: s.harvest.collectedThisSeason ?? false,
        lastCollectedSeason: s.harvest.lastCollectedSeason ?? -1,
        windowOpen:          s.harvest.windowOpen          ?? false,
        windowOpenTick:      s.harvest.windowOpenTick      ?? 0,
      };
    }

    // Imperial Games (T236)
    if (s.imperialGames) {
      state.imperialGames = {
        pending:     s.imperialGames.pending     ?? false,
        expiresAt:   s.imperialGames.expiresAt   ?? 0,
        nextGamesAt: s.imperialGames.nextGamesAt ?? 0,
        seasonsSinceLastGames: s.imperialGames.seasonsSinceLastGames ?? 0,
      };
    }

    // Nomadic tribe (T240)
    if (s.nomadicTribe) {
      state.nomadicTribe = {
        encounter: s.nomadicTribe.encounter ? { ...s.nomadicTribe.encounter } : null,
        nextAt:    s.nomadicTribe.nextAt ?? 0,
      };
    }

    // Wandering prophet (T241)
    if (s.wanderingProphet) {
      state.wanderingProphet = {
        encounter: s.wanderingProphet.encounter ? { ...s.wanderingProphet.encounter } : null,
        nextAt:    s.wanderingProphet.nextAt ?? 0,
      };
    }

    // Artisan fair (T242)
    if (s.artisanFair) {
      state.artisanFair = {
        encounter: s.artisanFair.encounter ? { ...s.artisanFair.encounter } : null,
        nextAt:    s.artisanFair.nextAt ?? 0,
      };
    }

    state.cosmicAlignment      = s.cosmicAlignment      ?? null; // T244

    // Milestones
    state.expansionMilestonesReached     = s.expansionMilestonesReached     ?? {};
    state.resourceCacheMilestonesReached = s.resourceCacheMilestonesReached ?? {};
    state.tradeMilestonesReached         = s.tradeMilestonesReached         ?? {};
    state.ageMilestonesReached           = s.ageMilestonesReached           ?? {};

    // Re-init systems that need post-load setup
    recalcRates();
    initSeasons();
    initOracle();
    initEpithet();             // T243: subscribe SEASON_CHANGED + initial calculation
    initCosmicAlignment();     // T244: cosmic alignment state init

    console.log(`Game loaded (v${s.version}, tick ${state.tick})`);
    return true;
  } catch (e) {
    console.error('Load failed:', e);
    return false;
  }
}

// ---- New Game ---------------------------------------------------------------

function _newGame() {
  initState();

  // Generate map
  state.map = _generateMap(12, 12);

  // Give player the center tile
  const cx = Math.floor(state.map.width  / 2);
  const cy = Math.floor(state.map.height / 2);
  state.map.tiles[cy][cx].owner = 'player';

  // Starting resources
  state.resources.food  = 50;
  state.resources.wood  = 30;
  state.resources.stone = 20;
  state.resources.gold  = 100;
  state.resources.iron  = 0;
  state.resources.mana  = 0;

  recalcRates();
  initSeasons();
  initOracle();
  initEpicQuests();
  initEpithet();             // T243: recalculate epithet for new empire
  initCosmicAlignment();     // T244: reset cosmic alignment state on new game
  initProphet();
  initArtisanFair();
}

// ---- Map generation ---------------------------------------------------------

const TERRAIN_TYPES = [
  { type: 'plains',   weight: 30, icon: '🌿', label: 'Plains',   foodBonus: 2, woodBonus: 0, stoneBonus: 0, goldBonus: 0, ironBonus: 0 },
  { type: 'forest',   weight: 25, icon: '🌲', label: 'Forest',   foodBonus: 1, woodBonus: 3, stoneBonus: 0, goldBonus: 0, ironBonus: 0 },
  { type: 'mountain', weight: 15, icon: '⛰️', label: 'Mountain', foodBonus: 0, woodBonus: 0, stoneBonus: 3, goldBonus: 1, ironBonus: 2 },
  { type: 'river',    weight: 15, icon: '💧', label: 'River',    foodBonus: 3, woodBonus: 1, stoneBonus: 0, goldBonus: 1, ironBonus: 0 },
  { type: 'desert',   weight: 10, icon: '🏜️', label: 'Desert',   foodBonus: 0, woodBonus: 0, stoneBonus: 1, goldBonus: 2, ironBonus: 1 },
  { type: 'tundra',   weight:  5, icon: '❄️', label: 'Tundra',   foodBonus: 0, woodBonus: 1, stoneBonus: 2, goldBonus: 0, ironBonus: 1 },
];

function _generateMap(width, height) {
  const totalWeight = TERRAIN_TYPES.reduce((s, t) => s + t.weight, 0);
  const tiles = [];

  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      let r = Math.random() * totalWeight;
      let terrain = TERRAIN_TYPES[0];
      for (const t of TERRAIN_TYPES) {
        r -= t.weight;
        if (r <= 0) { terrain = t; break; }
      }
      row.push({
        x, y,
        type:       terrain.type,
        icon:       terrain.icon,
        label:      terrain.label,
        foodBonus:  terrain.foodBonus,
        woodBonus:  terrain.woodBonus,
        stoneBonus: terrain.stoneBonus,
        goldBonus:  terrain.goldBonus,
        ironBonus:  terrain.ironBonus,
        owner:      'neutral',
        npcOwner:   null,
        def:        0,
      });
    }
    tiles.push(row);
  }

  // Seed NPC empires at tile edges
  const empires = state.diplomacy?.empires ?? [];
  const edgeTiles = [];
  for (let x = 0; x < width; x++) { edgeTiles.push(tiles[0][x]); edgeTiles.push(tiles[height-1][x]); }
  for (let y = 1; y < height-1; y++) { edgeTiles.push(tiles[y][0]); edgeTiles.push(tiles[y][width-1]); }

  const shuffled = edgeTiles.sort(() => Math.random() - 0.5);
  empires.forEach((emp, i) => {
    if (shuffled[i]) {
      shuffled[i].owner    = 'npc';
      shuffled[i].npcOwner = emp.id;
    }
  });

  return { width, height, tiles };
}

// ---- Leaderboard ------------------------------------------------------------

export function submitScore(empireData) {
  try {
    const lb = JSON.parse(localStorage.getItem(LB_KEY) ?? '[]');
    lb.push({
      name:     empireData.name,
      score:    empireData.score,
      age:      empireData.age,
      tiles:    empireData.tiles,
      ticks:    empireData.ticks,
      date:     new Date().toISOString(),
    });
    lb.sort((a, b) => b.score - a.score);
    localStorage.setItem(LB_KEY, JSON.stringify(lb.slice(0, 50)));
    emit(Events.LEADERBOARD_UPDATED);
  } catch (e) {
    console.error('Leaderboard save failed:', e);
  }
}

export function getLeaderboard() {
  try {
    return JSON.parse(localStorage.getItem(LB_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function clearLeaderboard() {
  localStorage.removeItem(LB_KEY);
  emit(Events.LEADERBOARD_UPDATED);
}

// ---- Manual save/load (for Settings panel) ----------------------------------

export function manualSave() {
  _saveGame();
}

export function manualLoad() {
  stopLoop();
  if (_loadGame()) {
    startLoop();
    return true;
  }
  startLoop();
  return false;
}

export function deleteSave() {
  localStorage.removeItem(SAVE_KEY);
}

export function hasSave() {
  return !!localStorage.getItem(SAVE_KEY);
}

// ---- New game (for Settings panel) ------------------------------------------

export function startNewGame() {
  stopLoop();
  localStorage.removeItem(SAVE_KEY);
  _newGame();
  startLoop();
  // Re-render all UI
  emit(Events.RESOURCE_CHANGED);
  emit(Events.MAP_CHANGED);
  emit(Events.BUILDING_CHANGED);
  emit(Events.UNIT_CHANGED);
  emit(Events.TECH_CHANGED);
  emit(Events.AGE_CHANGED, { age: state.age, name: AGES[state.age]?.name ?? '' });
  emit(Events.QUEST_COMPLETED);
  emit(Events.DIPLOMACY_CHANGED);
}
