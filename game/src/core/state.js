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

  // Army morale (0–100). Drifts based on wars/alliances/season; changes on
  // combat outcomes. Affects attack power when at extremes.  Not reset by
  // initState so mid-game saves restore the correct level.
  morale: 50,

  // Population state — populated by systems/population.js initPopulation()
  // { count: number, cap: number }
  population: null,

  // Espionage state — populated by systems/espionage.js initEspionage()
  // { cooldownUntil: tick, log: [...], networkLevel: 0-3 (T113) }
  espionage: null,

  // Active timed challenge state — populated by systems/challenges.js initChallenges()
  // { active: { type, icon, label, desc, startValue, target, reward, expiresAt } | null,
  //   completed: [...], nextGenTick: number }
  challenges: null,

  // Empire archetype — persisted across new games (not reset by initState)
  // 'none' | 'conqueror' | 'merchant' | 'arcane'
  archetype: 'none',

  // Trade caravan state — populated by systems/caravans.js initCaravans()
  // { active: { x, y, offers, expiresAt } | null, nextSpawnTick: number }
  caravans: null,

  // Discovered ancient relics — populated by combat.js on tile capture
  // { discovered: { [relicId]: tick } }
  relics: null,

  // Active governance policy — persists across new games (player preference)
  // null | 'taxation' | 'agrarian' | 'martial_law'
  policy: null,

  // Tick when the policy was last changed (for cooldown enforcement)
  policyChangedAt: -999,

  // Garrison assignments — { ['x,y']: { unitId: string, count: number } }
  // Units are removed from state.units when garrisoned; returned on withdrawal.
  // null until first garrison action.
  garrisons: null,

  // Tech mastery bonuses — { [masteryId]: tick when unlocked }
  // Reset on new game; all 4 must be earned by completing tech groups each game.
  masteries: {},

  // Political events — populated by systems/politicalEvents.js initPoliticalEvents()
  // { pending: {…} | null, log: [], nextEventTick: number }
  politicalEvents: null,

  // T072b: Chosen age council boons — array of boon IDs, one per age (max 3).
  // Reset on new game.
  councilBoons: [],

  // T075: Mercenary offers — { current: { unitId, cost, expiresAt } | null, nextOfferTick }
  // Populated by systems/mercenaries.js initMercenaries()
  mercenaries: null,

  // T078: Weather state — populated by systems/weather.js initWeather()
  // { active: { type, icon, name, desc, modifiers, expiresAt } | null, nextWeatherTick: number }
  weather: null,

  // T080: Empire prestige — earned through victories, wonders, age advances, etc.
  // { score: number, milestones: number[] (list of threshold values reached) }
  prestige: null,

  // T083: Empire Decree state — populated by systems/decrees.js initDecrees()
  // { cooldowns: { [id]: tickExpiry }, harvestEdictExpires: number, warBannerCharges: number }
  decrees: null,

  // T087: Wandering merchant state — populated by systems/merchant.js initMerchant()
  // { offer: { items, expiresAt } | null, nextVisitTick, totalVisits, totalPurchases }
  merchant: null,

  // T089: Discovered map landmarks — { captured: { [landmarkId]: tick } }
  // null until first map with landmarks; landmarks are placed in map tiles as tile.landmark = id
  landmarks: null,

  // T090: Building specializations — { [buildingId]: specializationId }
  // One permanent specialization per building slot; persists until New Game.
  buildingSpecials: {},

  // T096: Citizen role assignments — persists across new games (player preference)
  // { scholars: n, merchants: n, workers: n, soldiers: n }
  // Each role slot = 100 citizens. Max total = floor(population / 100).
  citizenRoles: null,

  // T100: Capital Development Plan — one-time permanent upgrade per game
  // null | 'fortress' | 'commerce' | 'academy' | 'arcane_tower'
  capitalPlan: null,

  // T101: Conquest streak — consecutive battle wins without a loss
  // { count: number, lastWinTick: number }
  combatStreak: { count: 0, lastWinTick: 0 },

  // T102: Alliance Military Aid — temporary troop reinforcements from allied empires
  // { cooldowns: { [empireId]: tickExpiry }, active: { empireId, units, battlesLeft } | null }
  militaryAid: null,

  // T103: Empire Festivals — temporary production/combat boosts declared by the player
  // { active: { type, expiresAt? (timed), chargesLeft? (parade) } | null,
  //   cooldownUntil: tick, totalUsed: number }
  festivals: null,

  // T104: Resource Nodes — temporary glowing deposits on neutral tiles
  // { nodes: [{ x, y, terrain, resource, amount, expiresAt }], nextSpawnTick: number }
  resourceNodes: null,

  // T105: Title history — records when each title was earned this game
  // [{ titleId, tick }] — newest first; reset per game
  titleHistory: [],

  // T106: Ruins excavation state — { excavated: { [ruinId]: { tick, outcome } } }
  // null until first map; ruin positions stored as tile.hasRuin = ruinId in state.map.tiles
  ruins: null,

  // T107: Per-unit-type permanent attack upgrade levels (0–5). Each level adds +10% attack.
  // Cost scales as UNIT_UPGRADE_COST_BASE × (level+1) gold. Reset per game.
  unitUpgrades: {},

  // T108: Exploration milestone flags — { [pct]: true } when that % of map has been revealed.
  // Milestones: 50 / 75 / 90. The 90% milestone grants a permanent +0.8 gold/s bonus.
  explorationMilestones: {},

  // T109: Warlord duel state — populated by systems/duels.js initDuels()
  // { pending: { empireId, warlordName, deadline } | null, nextChallengeTick, cooldownUntil, history }
  duels: null,

  // T110: Pioneer expedition state — populated by systems/pioneerExpeditions.js initPioneers()
  // { active: { endsAt, cx, cy } | null, sent: number }
  pioneers: null,

  // T111: Natural disaster state — populated by systems/naturalDisasters.js initNaturalDisasters()
  // { nextSpawnTick: number, lastType: string|null, totalFired: number }
  naturalDisasters: null,

  // T116: Research inspiration event state — populated by systems/researchInspiration.js
  // { pending: { typeId, expiresAt } | null, workshopDiscount: bool, nextCheckTick: number }
  researchInspiration: null,

  // T117: Empire crisis state — populated by systems/crises.js initCrises()
  // { active: { typeId, expiresAt } | null, nextCrisisTick, resolved, failed }
  crises: null,

  // T118: Hero enshrinement legacy — accumulated from retired max-skill heroes
  // { enshrined: [{ name, skillIds, rates: {res→bonus} }], totalEnshrined: number }
  heroLegacy: null,

  // T120: Per-resource cap upgrade levels (0–5). Each level adds +250 to cap.
  // Cost: 150 × (level+1) gold. Reset on new game.
  capUpgrades: {},

  // T125: Forge system — { crafted: { [itemId]: tick } } when items are forged.
  // null until first forging action.
  forge: null,

  // T126: Resource auction — { current: { bundles, bids, expiresAt } | null, nextAuctionTick }
  // null until Market building is constructed.
  auction: null,

  // T127: Resource raid state — { cooldownUntil: tick, totalRaids: number }
  // null until first raid attempt.
  raids: null,

  // T131: Active proclamation — one strategic declaration per age; cleared on age advance.
  // null | { activeId: string|null, ageWhenIssued: number }
  proclamation: null,

  // T132: Siege engine cap flag — drives the 1-max constraint enforced in actions.js.
  // siege_engine count lives in state.units as normal; this comment documents the design.

  // T133: Wonder project state — one wonder per game.
  // { buildingId: string|null, startTick, endsAt, completedId: string|null }
  wonder: null,

  // T134: Wandering scholar event state.
  // { active: { teachingId, expiresAt, icon, name, desc } | null,
  //   nextScholarTick: number, totalAccepted: number,
  //   activeEffect: { type, expiresAt, chargesLeft } | null }
  scholar: null,

  // T135: Territory bounty system.
  // { current: { x, y, terrain, reward, expiresAt } | null,
  //   nextBountyTick: number, totalClaimed: number }
  bounty: null,

  // T136: Great person system — earn points every 10 min, at 3 points a person appears.
  // { points: number, nextPointTick: number,
  //   available: { id, type, icon, name, desc, expiresAt } | null,
  //   generalChargesLeft: number, totalUsed: number }
  greatPersons: null,

  // T137: Building auto-queue — list of buildingIds to auto-construct when affordable.
  // Max 3 items. Wonders are excluded. Processed on every RESOURCE_CHANGED event.
  buildQueue: [],

  // T141: Research tech milestone flags — { [threshold]: true } when that tech count was reached.
  // Thresholds: 4 / 8 / 12 / 'all' (16). The 12 and 'all' milestones grant permanent rate bonuses.
  techMilestones: {},

  // T142: Alliance mission state — populated by systems/allianceMissions.js
  // { [empireId]: { active: { type, target, baseline, expiresAt, goldReward } | null,
  //                 nextMissionTick: number, totalCompleted: number } }
  allianceMissions: null,

  // T143: Age milestone challenge state — populated by systems/ageChallenges.js
  // { results: { [age]: 'won' | 'lost' }, active: { … } | null }
  ageChallenges: null,

  // T144: Emergency Council — one-time crisis power (used once per game)
  // { used: boolean }
  emergencyCouncil: null,

  // T145: Cultural influence expansion — passive neutral tile absorption
  // { tiles: {'x,y': count}, totalConverted: 0 }
  influence: null,

  // T146: Map discoveries — hidden encounters spawned on fog reveal
  // { claimed: {'x,y': true} } — tile.discovery stores the type on the tile itself
  discoveries: null,
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
  state.morale         = 50;
  state.population     = null;
  state.espionage      = null;
  state.challenges     = null;
  state.caravans        = null;
  state.relics          = null;
  state.tick            = 0;
  state.running         = false;
  state.policy          = null;
  state.policyChangedAt = -999;
  state.garrisons       = null;
  state.masteries       = {};
  state.politicalEvents = null;
  state.councilBoons    = [];
  state.mercenaries     = null;
  state.weather         = null;
  state.prestige        = null;
  state.decrees         = null;
  state.contracts       = null;  // T085: delivery contracts
  state.merchant        = null;  // T087: wandering merchant
  state.landmarks       = null;  // T089: special map landmarks
  state.buildingSpecials = {};   // T090: building specializations
  state.capitalPlan      = null; // T100: capital development plan (reset per game)
  state.combatStreak     = { count: 0, lastWinTick: 0 }; // T101: reset streak each game
  state.militaryAid      = null; // T102: reset aid each game
  state.festivals        = null; // T103: reset festivals each game
  state.resourceNodes    = null; // T104: reset resource nodes each game
  state.titleHistory     = [];   // T105: title history resets per game
  state.ruins            = null; // T106: ruins reset per game
  state.unitUpgrades       = {}; // T107: arsenal upgrades reset per game
  state.explorationMilestones = {}; // T108: exploration milestones reset per game
  state.duels              = null;  // T109: duel events reset per game
  state.pioneers           = null;  // T110: pioneer expeditions reset per game
  state.naturalDisasters   = null;  // T111: natural disaster cooldown resets per game
  state.researchInspiration = null; // T116: inspiration events reset per game
  state.crises              = null; // T117: crisis system resets per game
  state.heroLegacy          = null; // T118: legacy resets per game
  state.capUpgrades         = {};   // T120: reset cap upgrades per game
  state.forge               = null; // T125: forge items reset per game
  state.auction             = null; // T126: auction state reset per game
  state.raids               = null; // T127: raid cooldown resets per game
  state.proclamation        = { activeId: null, ageWhenIssued: -1 }; // T131
  state.wonder              = null; // T133: wonder resets per game
  state.scholar             = null; // T134: scholar resets per game
  state.bounty              = null; // T135: bounty resets per game
  state.greatPersons        = null; // T136: great persons reset per game
  state.buildQueue          = [];   // T137: queue cleared on new game
  state.techMilestones      = {};   // T141: reset tech milestones per game
  state.allianceMissions    = null; // T142: reset alliance missions per game
  state.ageChallenges       = null; // T143: reset age challenges per game
  state.emergencyCouncil    = { used: false }; // T144: reset per game
  state.influence           = null; // T145: reset influence on new game
  state.discoveries         = null; // T146: reset discoveries on new game
  // Note: state.archetype is NOT reset here — it persists across new games
}
