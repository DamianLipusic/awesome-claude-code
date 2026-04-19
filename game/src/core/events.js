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
});
