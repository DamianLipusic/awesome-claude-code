/**
 * EmpireOS — Central game state.
 * All mutations happen through actions.js.
 * This module exports the live state object and an initialiser.
 */

export const state = {
  empire: {
    name: 'New Empire',
    founded: null,     // set on game start
  },

  resources: {
    gold:  100,
    food:  50,
    wood:  50,
    stone: 0,
    iron:  0,
    mana:  0,
  },

  // net per-second rates (recalculated each tick from buildings + techs)
  rates: {
    gold:  1,
    food:  1,
    wood:  0,
    stone: 0,
    iron:  0,
    mana:  0,
  },

  // resource caps (expanded by storage buildings)
  caps: {
    gold:  500,
    food:  500,
    wood:  500,
    stone: 500,
    iron:  500,
    mana:  500,
  },

  // { [buildingId]: count }
  buildings: {},

  // { [unitId]: count }
  units: {},

  // { [techId]: true }
  techs: {},

  // Training queue entries: { unitId, remaining (ticks) }
  trainingQueue: [],

  // Research queue entries: { techId, remaining (ticks) }
  researchQueue: [],

  // Recent messages for the event log (max 50)
  messages: [],

  // Map state — populated by systems/map.js initMap()
  // { width, height, tiles: [[{type,owner,revealed,defense,loot}]], capital }
  map: null,

  // Current age (0=Stone, 1=Bronze, 2=Iron, 3=Medieval)
  age: 0,

  // Random event state — populated by systems/randomEvents.js initRandomEvents()
  // { nextEventTick, activeModifiers: [{id, resource, rateMult, expiresAt}] }
  randomEvents: null,

  // Quest state — populated by systems/quests.js initQuests()
  // { completed: { [questId]: tick } }
  quests: null,

  // Empire story entries — populated by systems/story.js initStory()
  // [{ milestoneId, tick, icon, title, desc, type }]  newest first
  story: [],

  // Diplomacy state — populated by systems/diplomacy.js initDiplomacy()
  // { empires: [{ id, relations, tradeRoutes, nextAITick, nextWarRaidTick }] }
  diplomacy: null,

  // Season state — populated by systems/seasons.js initSeasons()
  // { index: 0-3 (Spring/Summer/Autumn/Winter), tick: elapsed ticks in season }
  season: null,

  // Hero state — null until recruited via recruitHero()
  // { recruited: true,
  //   abilityCooldowns: { battleCry, inspire, siege } — tick when cooldown expires,
  //   activeEffects: { battleCry: bool, inspire: tickExpiry, siege: bool } }
  hero: null,

  // Session statistics for the leaderboard
  // { goldEarned: number, peakTerritory: number }
  stats: null,

  // Game-over state: null while playing, set when win/lose triggered
  // { outcome: 'win'|'lose', reason: string, tick: number }
  gameOver: null,

  // Market state — populated by systems/market.js initMarket()
  // { prices: {res→mult}, trends: {res→ -1|0|1}, lastUpdateTick, totalTrades }
  market: null,

  // Enemy AI state — populated by systems/enemyAI.js initEnemyAI()
  // { nextExpansionTick: number, nextAttackTick: number }
  enemyAI: null,

  // Unit experience tracking — { [unitId]: xpCount }
  // XP gained per victory; thresholds: 3=veteran, 6=elite
  unitXP: {},

  // Unit rank promotion state — { [unitId]: 'veteran'|'elite' }
  // Promoted units deal 1.5× (veteran) or 2.0× (elite) attack damage
  unitRanks: {},

  // Difficulty setting — persisted across new games (not reset by initState)
  // 'easy' | 'normal' | 'hard'
  difficulty: 'normal',

  // Resource shortage alert thresholds — persisted across new games (user preference)
  // { [resId]: thresholdValue }  — HUD cell pulses red when resource ≤ threshold
  // null/undefined entry means alert is disabled for that resource
  alerts: {},

  // Combat history — last 20 battles, newest first
  // [{ tick, outcome:'win'|'loss', terrain, x, y, power, defense, loot, lost }]
  combatHistory: [],

  // Current game tick count (increments every 250ms)
  tick: 0,

  // Whether the game loop is running
  running: false,

  // Battle formation stance — persisted across new games (tactical preference)
  // 'defensive' | 'balanced' | 'aggressive'
  formation: 'balanced',

  // Mana spells state — populated by systems/spells.js initSpells()
  // { activeEffects: { blessing: expiresAtTick, aegis: expiresAtTick, manaBolt: bool },
  //   cooldowns: { vision, blessing, aegis, manaBolt } — tick when CD expires }
  spells: null,

  // Barbarian encampment state — populated by systems/barbarianCamps.js
  // { nextSpawnTick: number }  — camp data lives in tile.owner === 'barbarian'
  barbarians: null,
};

/**
 * Initialise (or re-initialise) state for a new game.
 */
export function initState(empireName = 'My Empire') {
  state.empire.name    = empireName;
  state.empire.founded = new Date().toISOString();

  state.resources = { gold: 100, food: 50, wood: 50, stone: 0, iron: 0, mana: 0 };
  state.rates     = { gold: 1,  food: 1,  wood: 0,  stone: 0, iron: 0, mana: 0 };
  state.caps      = { gold: 500, food: 500, wood: 500, stone: 500, iron: 500, mana: 500 };

  state.buildings      = {};
  state.units          = {};
  state.techs          = {};
  state.trainingQueue  = [];
  state.researchQueue  = [];
  state.messages       = [];
  state.map            = null;
  state.age            = 0;
  state.randomEvents   = null;
  state.quests         = null;
  state.story          = [];
  state.diplomacy      = null;
  state.season         = null;
  state.hero           = null;
  state.stats          = { goldEarned: 0, peakTerritory: 0 };
  state.gameOver       = null;
  state.market         = null;
  state.enemyAI        = null;
  state.unitXP         = {};
  state.unitRanks      = {};
  state.combatHistory  = [];
  state.spells         = null;
  state.barbarians     = null;
  state.tick           = 0;
  state.running        = false;
}
