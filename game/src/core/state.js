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

  // T189: Legendary Units — { [unitId]: { name, immortalizedAt, bonus } }
  // Elite units can be immortalized once per game for a +8% army-wide attack mult.
  legendaryUnits: {},

  // T190: Trade Guild Hall — { boosts: { [empireId]: expiresAtTick } }
  // null until Trade Guild Hall is built.
  tradeGuild: null,

  // T191: Imperial Mint — { usedThisSeason: bool, totalConverted: number }
  // null until mint is built; usedThisSeason resets on SEASON_CHANGED.
  mint: null,

  // T192: Diplomatic Envoy — { active: {empireId, arrivalTick, sentAtTick}|null, totalDispatched, totalArrived }
  envoy: null,

  // T198: Trade Wind Events — periodic economic environment shifts lasting one season
  // { active: { id, icon, name, desc, goldBonus, ironBonus, foodBonus, endsAtSeason, startSeasonName }|null,
  //   nextWindSeason: number, history: [{id, icon, name, seasonName}], totalEvents: number } | null
  tradeWind: null,

  // T199: Imperial Tax Collector — once-per-season manual gold collection from territory
  // { usedThisSeason: bool, lastRate: string|null, totalCollected: number } | null
  taxCollection: null,

  // T200: Wandering Army — periodic mercenary band offer (Bronze Age+)
  // { current: { unitId, count, goldCost, foodCost, expiresAt, icon, name,
  //              negotiateCost, negotiateCount } | null,
  //   nextSpawnTick: number, totalHired: number } | null
  wanderingArmy: null,

  // T201: Province Council — recurring governance sessions every 15 min (10+ tiles)
  // { nextSessionTick, active: {options:[...], expiresAt}|null,
  //   totalSessions, prodBonusExpires, drillBonusExpires } | null
  council: null,

  // T202: Epic Quest Chains — 3 multi-step quest chains with permanent rewards
  // { chains: { conqueror: {step, completed}, scholar: {step, completed}, merchant: {step, completed} },
  //   bonuses: { conqueror: bool, scholar: bool, merchant: bool } } | null
  epicQuests: null,

  // T203: Corruption & Reform System — governance quality metric that grows with territory
  // { level: number (0-100), totalReforms: number } | null
  corruption: null,

  // T204: Grand Arena Events — periodic Bronze Age+ arena competitions for units
  // { nextEventTick: number, current: {type, icon, name, desc, unitId, unitCost, minToWin,
  //   prize: {gold, prestige, morale}, expiresAt} | null,
  //   eventsWon: number, eventsLost: number, totalEntered: number } | null
  arena: null,

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

  // T148: Population growth choice milestones — tracks which choice events have been offered
  // { [threshold]: true }  e.g. { 500: true, 1000: true }
  populationMilestones: {},

  // T150: Grand Theory — one-time empire-wide specialization chosen at Iron Age + 8 techs.
  // Stores the chosen theory id string, or null if not yet chosen.
  grandTheory: null,

  // T151: Rebel uprising state — populated by systems/rebels.js initRebels()
  // { active: [{x, y, spawnedAt}], lowMoraleStart: tick|null, cooldownUntil: tick, totalSuppressed }
  rebels: null,

  // T152: Dynastic succession state — populated by systems/dynasty.js initDynasty()
  // { generation, currentHeir: 'warrior'|'diplomat'|'scholar'|null, nextSuccessionTick,
  //   pendingSuccession, successionDeadline, regencyUntil, totalSuccessions }
  dynasty: null,

  // T153: Celestial event state — populated by systems/celestialEvents.js initCelestial()
  // { nextEventTick, pending: {type, fireAt}|null, active: {type, expiresAt}|null, history: [] }
  celestial: null,

  // T154: Conquest campaign state — populated by systems/campaigns.js initCampaigns()
  // { active: {empireId, empireLabel, startTick, endsAt, wins}|null, cooldownUntil, totalWon }
  campaigns: null,

  // T156: Ancient battlefield sites — { captured: { [key: 'x,y']: tick } }
  // null until first map; positions stored as tile.ancientBattlefield = true
  battlefields: null,

  // T157: Supply Depot logistics building state
  // { surgeExpiresAt: tick, surgeCooldownUntil: tick, totalSurges: number }
  supplyDepot: null,

  // T158: Weather memory — tracks occurrence counts and adaptations per weather type
  // { counts: { [typeId]: number }, adaptations: { [typeId]: true } }
  weatherMemory: null,

  // T161: Plague outbreak state — populated by systems/plague.js initPlague()
  // { active: { expiresAt: tick } | null, immuneUntil: tick, nextCheckTick: tick, totalPlagued: number }
  plague: null,

  // T162: Pilgrimage system — populated by systems/pilgrimages.js initPilgrimages()
  // { pending: { type, buildingId, icon, name, expiresAt, bonus } | null,
  //   nextPilgrimageTick: tick, totalHosted: number,
  //   activeBonus: { type, expiresAt } | null }
  pilgrimages: null,

  // T164: Resource conversion workshop state
  // { cooldownUntil: tick, totalConverted: number }
  conversions: null,

  // T165: Roving Warlord state — populated by systems/rovingWarlord.js initWarlord()
  // { active: { name, x, y, originalDefense, strikesAt } | null, nextSpawnTick, totalDefeated }
  warlord: null,

  // T166: Tribute Demand state — populated by systems/tributes.js initTributes()
  // { capturedCapitals: { [empireId]: tick }, demanded: { [empireId]: { nextPaymentTick, paymentsLeft, totalPaid } } }
  tributes: null,

  // T167: Black Market state — populated by systems/blackMarket.js initBlackMarket()
  // { deals: [{id, type, fromRes, fromAmt, toRes, toAmt}], nextRefreshTick, totalTrades, seizedCount }
  blackMarket: null,

  // T168: Noble Council Demands — populated by systems/nobleDemands.js initNobleDemands()
  // { active: {type, icon, title, desc, req, deadline, startTick}|null,
  //   nextDemandTick, totalSatisfied, totalRefused, debuffUntil }
  nobleDemands: null,

  // T169: Military Academy — battle drills command state
  // { drillCooldownUntil: tick, totalDrills: number }
  academy: null,

  // T170: Seasonal Map Objectives — one per season, spawned on SEASON_CHANGED
  // { current: { x, y, seasonIdx, icon, name, reward } | null, captured: [seasonIdx,...] }
  seasonalObjectives: null,

  // T171: Imperial Census — periodic empire-wide census every 15 min that awards gold
  // { nextCensusTick: number, lastSnapshot: { tiles, buildings, techs, goldEarned }|null, totalCompleted: number }
  census: null,

  // T172: Dynastic Marriage — permanent alliance bond with one allied empire (Medieval+)
  // { partnerId: string } | null
  dynasticMarriage: null,

  // T173: Imperial Vault — secure gold investment banking
  // { locked: { amount: number, unlocksAt: tick } | null, cooldownUntil: tick, totalDeposits: number } | null
  vault: null,

  // T174: Diplomatic Summit — once-per-age grand diplomatic ceremony (Medieval+)
  // { usedAtAge: number | null, totalSummits: number } | null
  summit: null,

  // T175: War Exhaustion — tracks combat intensity; penalises overextended empires
  // { level: 0-100, totalBattles: number } | null
  warExhaustion: null,

  // T176: Ancient Monument — periodic dedication ceremony when unique building is built
  // { nextDedicationTick: number, totalDedications: number } | null
  monument: null,

  // T179: Cartographer's Guild — passive fog reveal + periodic terrain survey system
  // { nextRevealTick, nextSurveyTick, totalRevealed, lastSurvey: {lines, generatedAt}|null } | null
  cartographer: null,

  // T180: Relic Shrine — passive prestige from relics + commune ability
  // { nextPrestigeTick, communeCooldownUntil, totalCommunions, totalPrestigeAwarded } | null
  relicShrine: null,

  // T181: Season Chronicle — rolling history of per-season statistics
  // { completed: [recap...], current: { seasonIndex, seasonName, seasonIcon,
  //   battlesWon, battlesLost, built, techs, quests, tilesGained, startTick, endTick } } | null
  seasonChronicle: null,

  // T182: Combat Surge — one-shot attack boost with resource cost and cooldown
  // { cooldownUntil: tick, totalSurges: number } | null
  surge: null,

  // T205: Battle Standard — unique banner granting one unit type +20% attack power
  // { equippedUnit: string|null, transferCooldownUntil: tick, totalTransfers: number } | null
  battleStandard: null,

  // T206: Regional Governors — appoint governors to territory sectors for passive income
  // { north: bool, east: bool, south: bool, totalAppointed: number } | null
  governors: null,

  // T207: Scout Reconnaissance — manual frontier reveal + field report action (Bronze Age+)
  // { cooldownUntil: tick, totalMissions: number,
  //   lastReport: { tilesRevealed, enemyTiles, fogRemaining, terrains: string[] } | null } | null
  scouts: null,

  // T208: Resource Exchange Pact — seasonal resource exchange with an allied empire
  // { active: { empireId, empireLabel, empireIcon, offeredRes, offeredAmt,
  //             receivedRes, receivedAmt, seasonsLeft } | null,
  //   totalPacts: number,
  //   history: [{ empireId, empireLabel, empireIcon, offeredRes, offeredAmt,
  //               receivedRes, receivedAmt }] } | null
  resourcePact: null,

  // T209: Military Supply Lines — forward outposts extending attack supply range
  // { outposts: [{ x, y }], totalPlaced: number } | null
  supplyLines: null,

  // T210: War Reparations — demand gold from an empire after sustained combat success
  // { demanded: { [empireId]: true }, angryBonusUntil: tick, totalReceived: number } | null
  reparations: null,

  // T211: Imperial Reputation — 0-100 honor/fear score
  // { score: number, history: [{tick,delta,reason}] } | null
  reputation: null,

  // T212: Dynamic Enemy Counteroffensive — faction retaliation for rapid tile captures
  // { recentCaptures: { [factionId]: [{tick}] },
  //   active: { [factionId]: { expiresAt, launchedAt } },
  //   totalLaunched: number } | null
  counteroffensives: null,

  // T214: Royal Hunt Event — periodic Bronze Age+ hunt opportunity
  // { pending: bool, pendingUntil: tick,
  //   active: { resolvesAt: tick } | null,
  //   nextSpawn: tick, totalHunts: number } | null
  royalHunt: null,

  // T215: Imperial Codex — cross-system knowledge fragment collection
  // { fragments: number, milestones: string[], codexGoldRate: number, codexProdMult: number } | null
  codex: null,

  // T216: Legendary Encounters — rare creature map events
  // { current: { type, x, y, icon, name, boostedDefense, expiresAt } | null,
  //   nextSpawnTick: number, totalDefeated: number } | null
  legendary: null,

  // T217: Refugee Crisis — periodic displaced persons event (Bronze Age+)
  // { current: {count, sourceFactionId, sourceName, expiresAt, integrateCost, integrateBonus}|null,
  //   nextCrisisTick, totalAccepted, totalIntegrated,
  //   skillBonus: {gold,food,wood,stone,iron,mana}, debuffUntil } | null
  refugees: null,

  // T218: Silk Road Trade Window — periodic exotic goods market (Iron Age+)
  // { current: {goods:[{id,icon,name,desc,cost,purchased}], expiresAt, boughtCount}|null,
  //   nextWindowTick, totalPurchases, permanentGoldRate } | null
  silkRoad: null,

  // T219: Imperial Propaganda Campaigns
  // { activeCampaign: {type, expiresAt}|null, cooldownUntil, totalLaunched } | null
  propaganda: null,

  // T220: Military Intelligence Reports
  // { reports: {[empireId]: {tileTrend, powerTier, threatLevel, generatedAt}},
  //   nextReportTick, totalReports } | null
  intel: null,

  // T221: Imperial Construction Drive — temporary production boost via stone+wood expenditure
  // { active: { expiresAt: number } | null, cooldownUntil: number, totalDrives: number } | null
  constructionDrive: null,

  // T222: Peace Overtures — one formal overture per war per empire
  // { attempted: { [empireId]: true } } | null
  peaceOvertures: null,
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
  state.legendaryUnits = {};                  // T189: reset legendary units each game
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
  state.populationMilestones = {};  // T148: reset pop choice milestones per game
  state.grandTheory          = null; // T150: reset grand theory per game
  state.rebels               = null; // T151: reset rebel state per game
  state.dynasty              = null; // T152: reset dynasty state per game
  state.celestial            = null; // T153: reset celestial events per game
  state.campaigns            = null; // T154: reset campaigns per game
  state.battlefields         = null; // T156: reset battlefields per game
  state.supplyDepot          = null; // T157: reset surge state per game
  state.weatherMemory        = null; // T158: reset weather memory per game
  state.plague               = null; // T161: reset plague state per game
  state.pilgrimages          = null; // T162: reset pilgrimages per game
  state.conversions          = null; // T164: reset conversion state per game
  state.warlord              = null; // T165: reset warlord state per game
  state.tributes             = null; // T166: reset tributes per game
  state.blackMarket          = null; // T167: reset black market per game
  state.nobleDemands         = null; // T168: reset noble demands per game
  state.academy              = null; // T169: reset academy state per game
  state.seasonalObjectives   = null; // T170: reset seasonal objectives per game
  state.census               = null; // T171: reset census state per game
  state.dynasticMarriage     = null; // T172: reset marriage per game
  state.vault                = null; // T173: reset vault state per game
  state.summit               = null; // T174: reset summit state per game
  state.warExhaustion        = null; // T175: reset war exhaustion per game
  state.monument             = null; // T176: reset monument state per game
  state.cartographer         = null; // T179: reset cartographer state per game
  state.relicShrine          = null; // T180: reset relic shrine state per game
  state.seasonChronicle      = null; // T181: reset season chronicle per game
  state.surge                = null; // T182: reset surge state per game
  state.mint                 = null; // T191: reset mint state per game
  state.envoy                = null; // T192: reset envoy state per game
  state.tradeWind            = null; // T198: reset trade wind state per game
  state.taxCollection        = null; // T199: reset tax collection state per game
  state.wanderingArmy        = null; // T200: reset wandering army state per game
  state.council              = null; // T201: reset province council per game
  state.epicQuests           = null; // T202: reset epic quest chains per game
  state.corruption           = null; // T203: reset corruption per game
  state.arena                = null; // T204: reset arena per game
  state.battleStandard       = null; // T205: reset battle standard per game
  state.governors            = null; // T206: reset governors per game
  state.scouts               = null; // T207: reset scouts per game
  state.resourcePact         = null; // T208: reset resource pact per game
  state.supplyLines          = null; // T209: reset supply lines per game
  state.reparations          = null; // T210: reset war reparations per game
  state.reputation           = null; // T211: reset reputation per game
  state.counteroffensives    = null; // T212: reset counteroffensives per game
  state.royalHunt            = null; // T214: reset royal hunt per game
  state.codex                = null; // T215: reset codex per game
  state.legendary            = null; // T216: reset legendary encounters per game
  state.refugees             = null; // T217: reset refugee crisis per game
  state.silkRoad             = null; // T218: reset silk road per game
  state.propaganda           = null; // T219: reset propaganda campaigns per game
  state.intel                = null; // T220: reset military intel per game
  state.constructionDrive    = null; // T221: reset construction drive per game
  state.peaceOvertures       = null; // T222: reset peace overtures per game
  // Note: state.archetype is NOT reset here — it persists across new games
}
