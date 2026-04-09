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

  // Current game tick count (increments every 250ms)
  tick: 0,

  // Whether the game loop is running
  running: false,
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
  state.tick           = 0;
  state.running        = false;
}
