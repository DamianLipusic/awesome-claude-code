/**
 * EmpireOS — Tiny pub/sub event bus.
 *
 * Usage:
 *   import { on, off, emit } from './events.js';
 *   on('tick', handler);
 *   emit('resourceChanged', { resource: 'gold' });
 */

const listeners = new Map();

export function on(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(handler);
}

export function off(event, handler) {
  listeners.get(event)?.delete(handler);
}

export function emit(event, data) {
  listeners.get(event)?.forEach(h => h(data));
}

// Well-known event names (for IDE autocomplete / documentation)
export const Events = Object.freeze({
  TICK:              'tick',
  STATE_CHANGED:     'stateChanged',
  RESOURCE_CHANGED:  'resourceChanged',
  BUILDING_CHANGED:  'buildingChanged',
  UNIT_CHANGED:      'unitChanged',
  TECH_CHANGED:      'techChanged',
  MESSAGE:           'message',
  GAME_STARTED:      'gameStarted',
  GAME_SAVED:        'gameSaved',
  GAME_LOADED:       'gameLoaded',
  MAP_CHANGED:        'mapChanged',
  COMBAT:             'combat',
  AGE_CHANGED:        'ageChanged',
  RANDOM_EVENT:       'randomEvent',
  QUEST_COMPLETED:    'questCompleted',
  DIPLOMACY_CHANGED:  'diplomacyChanged',
  SEASON_CHANGED:     'seasonChanged',
  HERO_CHANGED:       'heroChanged',
  GAME_OVER:          'gameOver',
  MARKET_CHANGED:     'marketChanged',
  ACHIEVEMENT_UNLOCKED: 'achievementUnlocked',
  DIFFICULTY_CHANGED:   'difficultyChanged',
  SPELL_CAST:           'spellCast',
  MORALE_CHANGED:       'moraleChanged',
  POPULATION_CHANGED:   'populationChanged',
  ESPIONAGE_EVENT:      'espionageEvent',
  CHALLENGE_UPDATED:    'challengeUpdated',
  CARAVAN_UPDATED:      'caravanUpdated',
  RELIC_DISCOVERED:     'relicDiscovered',
  POLICY_CHANGED:       'policyChanged',
  GARRISON_CHANGED:     'garrisonChanged',   // T068
  HERO_LEVEL_UP:        'heroLevelUp',       // T070: hero earned a skill choice
  MASTERY_UNLOCKED:     'masteryUnlocked',   // T071: a tech mastery group completed
  POLITICAL_EVENT:      'politicalEvent',    // T072: political crisis event fired/resolved
  COUNCIL_BOON_CHOSEN:  'councilBoonChosen', // T072b: player chose an age council boon
  MERCENARY_CHANGED:    'mercenaryChanged',   // T075: mercenary offer spawned/hired/expired
  ALLIANCE_GIFT:        'allianceGift',       // T076: allied empire sent a resource gift
  SYNERGY_UNLOCKED:     'synergyUnlocked',   // T077: both techs of a synergy pair researched
  WEATHER_CHANGED:      'weatherChanged',    // T078: weather event started or cleared
  BARBARIAN_SIEGE:      'barbarianSiege',   // T079: siege warning / resolved / repelled / struck
  PRESTIGE_CHANGED:     'prestigeChanged',  // T080: prestige score updated
  DECREE_USED:          'decreeUsed',       // T083: decree activated or expired
  CONTRACTS_CHANGED:    'contractsChanged', // T085: delivery contract offers spawned / accepted / completed
  HERO_EXPEDITION:      'heroExpedition',   // T086: hero departed on / returned from training expedition
  MERCHANT_CHANGED:     'merchantChanged',  // T087: wandering merchant arrived / departed / purchased
  BORDER_SKIRMISH:      'borderSkirmish',   // T088: AI vs AI border skirmish started / resolved
  LANDMARK_CAPTURED:    'landmarkCaptured', // T089: player captured a special map landmark
  BUILDING_SPECIALIZED:    'buildingSpecialized',   // T090: player specialized a building
  SEASONAL_EVENT:          'seasonalEvent',          // T092: mid-season special event fired
  FACTION_CAPITAL_CAPTURED: 'factionCapitalCaptured', // T093: player captured a faction capital tile
  CITIZEN_ROLES_CHANGED:    'citizenRolesChanged',    // T096: citizen role assignments updated
  CAPITAL_PLAN_CHOSEN:      'capitalPlanChosen',      // T100: player selected a capital development plan
  STREAK_CHANGED:           'streakChanged',           // T101: conquest streak count changed (win or reset)
  MILITARY_AID_CHANGED:     'militaryAidChanged',     // T102: alliance military aid requested / battle consumed / expired
  FESTIVAL_CHANGED:         'festivalChanged',         // T103: festival declared / expired / charge consumed
  RESOURCE_NODE_CHANGED:    'resourceNodeChanged',     // T104: resource node spawned / collected / expired
  TITLE_EARNED:             'titleEarned',             // T105: player earned a new empire title
  RUIN_EXCAVATED:           'ruinExcavated',           // T106: player excavated an ancient ruin
  UNIT_UPGRADED:            'unitUpgraded',            // T107: player upgraded a unit type's arsenal
  EXPLORATION_MILESTONE:    'explorationMilestone',    // T108: fog-of-war exploration milestone reached
  DUEL_CHANGED:             'duelChanged',             // T109: warlord duel challenged / accepted / declined / expired
  PIONEER_CHANGED:          'pioneerChanged',          // T110: pioneer expedition sent / completed
  NATURAL_DISASTER:         'naturalDisaster',         // T111: tile improvement damaged by natural disaster
  HERO_QUEST_CHANGED:       'heroQuestChanged',        // T112: hero legendary quest phase advanced
  ALLIANCE_FAVOR_CHANGED:   'allianceFavorChanged',    // T114: alliance favor gained or spent
  RESEARCH_INSPIRATION:     'researchInspiration',     // T116: inspiration event spawned/accepted/dismissed
  CRISIS_SPAWNED:           'crisisSpawned',            // T117: empire crisis appeared
  CRISIS_RESOLVED:          'crisisResolved',           // T117: crisis resolved or penalty applied
  HERO_ENSHRINED:           'heroEnshrined',            // T118: hero retired as a lasting legacy
  HERO_TRAIT_CHOSEN:        'heroTraitChosen',          // T119: commander trait chosen at recruitment
  CAP_UPGRADED:             'capUpgraded',              // T120: resource cap expanded via treasury upgrade
  CITY_FOUNDED:             'cityFounded',              // T121: player founded a city on a tile
  COMPANION_RECRUITED:      'companionRecruited',        // T122: hero companion joined
  FORGE_CHANGED:            'forgeChanged',             // T125: forge item crafted
  AUCTION_CHANGED:          'auctionChanged',           // T126: auction spawned/bid/expired
  RAID_CHANGED:             'raidChanged',              // T127: resource raid resolved (win/loss)
  PROCLAMATION_ISSUED:      'proclamationIssued',       // T131: proclamation issued or expired
  WONDER_CHANGED:           'wonderChanged',             // T133: wonder started or completed
  SCHOLAR_CHANGED:          'scholarChanged',            // T134: scholar arrived/dismissed/accepted
  BOUNTY_CHANGED:           'bountyChanged',             // T135: bounty posted / claimed / expired
  GREAT_PERSON:             'greatPerson',               // T136: great person appeared / used / expired
  QUEUE_CHANGED:            'queueChanged',              // T137: building auto-queue updated
  ALLIANCE_MISSION:         'allianceMission',           // T142: alliance mission assigned / completed / expired
  AGE_CHALLENGE_CHANGED:    'ageChallengeChanged',       // T143: age challenge started / won / lost
  INFLUENCE_CHANGED:        'influenceChanged',           // T145: cultural influence tile absorbed
  DISCOVERY_FOUND:          'discoveryFound',             // T146: hidden map discovery revealed
  RELIC_COMBO_UNLOCKED:     'relicComboUnlocked',         // T147: relic combination synergy unlocked
  POPULATION_MILESTONE:     'populationMilestone',        // T148: population choice milestone reached
  GRAND_THEORY_CHOSEN:      'grandTheoryChosen',          // T150: player selected a grand theory specialization
  REBEL_UPRISING:           'rebelUprising',              // T151: rebels seize player tiles
  REBELS_SUPPRESSED:        'rebelsSuppressed',           // T151: rebel tile reclaimed
  SUCCESSION_EVENT:         'successionEvent',            // T152: succession window opened
  HEIR_CHOSEN:              'heirChosen',                 // T152: heir selected (player or auto)
  CELESTIAL_WARNING:        'celestialWarning',           // T153: celestial event approaching (30s)
  CELESTIAL_ACTIVE:         'celestialActive',            // T153: celestial event has started
  CELESTIAL_CLEARED:        'celestialCleared',           // T153: celestial event has ended
  CAMPAIGN_STARTED:         'campaignStarted',            // T154: conquest campaign launched
  CAMPAIGN_WON:             'campaignWon',                // T154: campaign battle milestone reached
  CAMPAIGN_ENDED:           'campaignEnded',              // T154: campaign concluded (won or expired)
  BATTLEFIELD_CAPTURED:     'battlefieldCaptured',        // T156: player captured an ancient battlefield
  SUPPLY_CHANGED:           'supplyChanged',              // T157: surge provisions activated or expired
  WEATHER_ADAPTED:          'weatherAdapted',             // T158: empire adapted to a weather type
  EMBARGO_CHANGED:          'embargoChanged',             // T159: trade embargo declared / lifted / expired
  PLAGUE_STARTED:           'plagueStarted',              // T161: plague outbreak began
  PLAGUE_ENDED:             'plagueEnded',                // T161: plague ended (natural or quarantine)
  PILGRIMAGE_ARRIVED:       'pilgrimageArrived',          // T162: pilgrims arrive
  PILGRIMAGE_HOSTED:        'pilgrimageHosted',           // T162: player hosted pilgrims
  CONVERSION_CHANGED:       'conversionChanged',          // T164: resource conversion performed
  WARLORD_APPEARED:         'warlordAppeared',             // T165: roving warlord spawned
  WARLORD_DEFEATED:         'warlordDefeated',             // T165: warlord tile captured by player
  WARLORD_STRUCK:           'warlordStruck',               // T165: warlord timer expired, treasury raided
  TRIBUTE_CHANGED:          'tributeChanged',              // T166: tribute demanded / payment made / fulfilled
  BLACK_MARKET_CHANGED:     'blackMarketChanged',          // T167: black market deals refreshed / deal executed / seized
  NOBLE_DEMAND:             'nobleDemand',                 // T168: noble demand spawned / satisfied / failed
  ACADEMY_CHANGED:          'academyChanged',              // T169: battle drills activated / cooldown
  SEASONAL_OBJECTIVE:       'seasonalObjective',           // T170: seasonal map objective spawned / captured / expired
  CENSUS_COMPLETED:         'censusCompleted',             // T171: imperial census fired and gold awarded
  MARRIAGE_PROPOSED:        'marriageProposed',            // T172: dynastic marriage finalized with an allied empire
  VAULT_CHANGED:            'vaultChanged',                // T173: imperial vault deposit made / matured
  SUMMIT_CALLED:            'summitCalled',                // T174: diplomatic summit called by player
  WAR_EXHAUSTION_CHANGED:   'warExhaustionChanged',        // T175: war exhaustion level changed
  MONUMENT_DEDICATION:      'monumentDedication',          // T176: ancient monument dedication ceremony fired
});
