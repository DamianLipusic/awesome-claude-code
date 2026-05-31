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
  DYNASTY_SUCCESSION:       'dynastySuccession',          // T152: succession crisis appeared
  DYNASTY_HEIR_CHOSEN:      'dynastyHeirChosen',          // T152: player chose their heir
  CELESTIAL_EVENT:          'celestialEvent',             // T153: celestial event appeared / resolved
  CELESTIAL_RESOLVED:       'celestialResolved',          // T153: celestial event resolved
  CAMPAIGN_CHANGED:         'campaignChanged',            // T154: campaign assigned / progressed / completed
  PLAGUE_STARTED:           'plagueStarted',              // T161: plague outbreak began
  PLAGUE_ENDED:             'plagueEnded',                // T161: plague cured or expired
  PILGRIMAGE_ARRIVED:       'pilgrimageArrived',          // T162: pilgrims arrived for hosting
  PILGRIMAGE_HOSTED:        'pilgrimageHosted',           // T162: pilgrimage successfully hosted
  WARLORD_ARRIVED:          'warlordArrived',             // T165: roving warlord appeared
  WARLORD_DEPARTED:         'warlordDeparted',            // T165: warlord left
  TRIBUTE_DEMANDED:         'tributeDemanded',            // T166: empire demanded tribute
  TRIBUTE_PAID:             'tributePaid',                // T166: tribute paid
  BLACK_MARKET_CHANGED:     'blackMarketChanged',         // T167: black market offer spawned/accepted/expired
  NOBLE_DEMAND_CHANGED:     'nobleDemandChanged',         // T168: noble demand issued/satisfied/refused/expired
  SEASONAL_OBJECTIVE:       'seasonalObjective',          // T170: seasonal objective assigned or completed
  CENSUS_CHANGED:           'censusChanged',              // T171: census result published
  VAULT_CHANGED:            'vaultChanged',               // T173: vault deposit/withdrawal/bonus
  EXHAUSTION_CHANGED:       'exhaustionChanged',          // T175: war exhaustion level changed
  MONUMENT_BUILT:           'monumentBuilt',              // T176: ancient monument construction started
  MONUMENT_COMPLETED:       'monumentCompleted',          // T176: ancient monument completed
  CARTOGRAPHER_CHANGED:     'cartographerChanged',        // T179: cartographer offer spawned/accepted/expired
  RELIC_SHRINE_CHANGED:     'relicShrineChanged',         // T180: relic shrine offer spawned/accepted/expired
  TRADE_GUILD_CHANGED:      'tradeGuildChanged',          // T190: trade guild boost applied
  ENVOY_CHANGED:            'envoyChanged',               // T192: envoy dispatched/arrived/returned
  GUILD_CHANGED:            'guildChanged',               // T194: artisan guild task assigned/completed
  VIZIER_CHANGED:           'vizierChanged',               // T195: vizier advice event
  TRADE_FAIR_CHANGED:       'tradeFairChanged',            // T196: trade fair season event
  SEASON_PERFORMANCE:       'seasonPerformance',           // T197: end-of-season performance review
  TRADE_WIND_CHANGED:       'tradeWindChanged',            // T198: trade wind started/ended
  TAX_COLLECTION_CHANGED:   'taxCollectionChanged',        // T199: tax collection triggered/reset
  WANDERING_ARMY_CHANGED:   'wanderingArmyChanged',        // T200: wandering army offer spawned/hired/negotiated/expired
  COUNCIL_SESSION_CHANGED:  'councilSessionChanged',       // T201: province council session opened/closed
  EPIC_QUEST_PROGRESS:      'epicQuestProgress',           // T202: epic quest chain step/completion
  CORRUPTION_CHANGED:       'corruptionChanged',           // T203: corruption level changed
  ARENA_CHANGED:            'arenaChanged',                // T204: grand arena event started/resolved
  BATTLE_STANDARD_CHANGED:  'battleStandardChanged',       // T205: battle standard raised/expired
  GOVERNORS_CHANGED:        'governorsChanged',            // T206: regional governor assignment changed
  SCOUTS_CHANGED:           'scoutsChanged',               // T207: scout mission sent/completed
  RESOURCE_PACT_CHANGED:    'resourcePactChanged',         // T208: resource pact signed/expired
  SUPPLY_LINES_CHANGED:     'supplyLinesChanged',          // T209: supply line status changed
  REPARATIONS_CHANGED:      'reparationsChanged',          // T210: war reparations paid/received
  REPUTATION_CHANGED:       'reputationChanged',           // T211: empire reputation tier changed
  COUNTEROFFENSIVE_CHANGED: 'counteroffensiveChanged',     // T212: counteroffensive launched/resolved
  HUNT_CHANGED:             'huntChanged',                 // T214: royal hunt status changed
  CODEX_CHANGED:            'codexChanged',                // T215: imperial codex entry unlocked
  LEGENDARY_CHANGED:        'legendaryChanged',            // T216: legendary encounter spawned/defeated/expired
  REFUGEE_CHANGED:          'refugeeChanged',              // T217: refugee crisis spawned/resolved
  SILK_ROAD_CHANGED:        'silkRoadChanged',             // T218: silk road event spawned/expired
  PROPAGANDA_CHANGED:       'propagandaChanged',           // T219: propaganda campaign launched/expired
  MILITARY_INTEL_CHANGED:   'militaryIntelChanged',        // T220: military intel gathered
  CONSTRUCTION_DRIVE_CHANGED: 'constructionDriveChanged',  // T221: construction drive started/completed
  PEACE_OVERTURE_CHANGED:   'peaceOvertureChanged',        // T222: peace overture sent/accepted/rejected
  FORECAST_CHANGED:         'forecastChanged',             // T225: royal forecast revealed
  TROPHIES_CHANGED:         'trophiesChanged',             // T226: war trophy earned
  ALCHEMY_CHANGED:          'alchemyChanged',              // T227: alchemy conversion performed
  RATIONING_CHANGED:        'rationingChanged',            // T228: rationing policy changed
  MILITIA_CHANGED:          'militiaChanged',              // T229: militia raised/disbanded
  ANCIENT_PACT_CHANGED:     'ancientPactChanged',          // T230: ancient pact activated/expired
  LIBRARY_CHANGED:          'libraryChanged',              // T231: library scroll acquired/used
  PRICE_SURGE_CHANGED:      'priceSurgeChanged',           // T232: price surge spawned/expired
  LOST_EXPEDITION_CHANGED:  'lostExpeditionChanged',       // T233: lost expedition found/resolved
  HARVEST_CHANGED:          'harvestChanged',              // T234: seasonal harvest collected
  CITY_PROSPERITY_CHANGED:  'cityProsperityChanged',       // T235: city prosperity tier changed
  IMPERIAL_GAMES_CHANGED:   'imperialGamesChanged',        // T236: imperial games announced/resolved
  ROYAL_LOAN_CHANGED:       'royalLoanChanged',            // T237: royal loan issued/repaid
  VAULT_CACHE_CHANGED:      'vaultCacheChanged',           // T238: ancient vault cache discovered/claimed
  RECORDS_EXCHANGE_CHANGED: 'recordsExchangeChanged',      // T239: records exchange bonus applied
  NOMADIC_TRIBE_CHANGED:    'nomadicTribeChanged',         // T240: nomadic tribe encounter
  PROPHET_CHANGED:             'prophetChanged',                // T241: wandering prophet spawned / heeded / tributed / dismissed / expired
  ARTISAN_FAIR_CHANGED:        'artisanFairChanged',            // T242: artisan fair spawned / commissioned / exported / declined / expired
  COSMIC_ALIGNMENT_CHANGED:   'cosmicAlignmentChanged',        // T244: cosmic alignment spawned / observed / ritualed / ignored / expired
  ECONOMY_CYCLE_CHANGED:      'economyCycleChanged',            // T245: economy cycle phase started or ended
  TRIBUTE_CARAVAN_CHANGED:    'tributeCaravanChanged',          // T246: tribute caravan spawned / claimed / expired
  ORE_VEIN_CHANGED:           'oreVeinChanged',                 // T247: ancient ore vein spawned / mined / commissioned / sealed / expired
  HERBALIST_CHANGED:          'herbalistChanged',               // T248: wandering herbalist spawned / purchased / learned / dismissed / expired
  CIRCUS_CHANGED:             'circusChanged',                  // T249: traveling circus spawned / welcomed / recruited / dismissed / expired
  SACRED_SPRING_CHANGED:      'sacredSpringChanged',            // T250: sacred spring spawned / blessed / sold / protected / expired
  WANDERING_BARD_CHANGED:     'wanderingBardChanged',           // T251: wandering bard spawned / commissioned / listened / dismissed / expired
  MASTER_ARTISAN_CHANGED:     'masterArtisanChanged',           // T252: master artisan spawned / hired / commissioned / dismissed / expired
  MOUNTAIN_HERMIT_CHANGED:    'mountainHermitChanged',           // T253: mountain hermit spawned / counseled / tributed / dismissed / expired
  IMPERIAL_JUBILEE_CHANGED:   'imperialJubileeChanged',          // T254: imperial jubilee spawned / parade / feast / ceremony / expired
  EXILED_PRINCE_CHANGED:      'exiledPrinceChanged',             // T255: exiled prince spawned / granted / advisor / dismissed / expired
  ANCIENT_GUARDIAN_CHANGED:   'ancientGuardianChanged',          // T256: guardian spawned / tributed / ritual / firm / expired
  DESERT_OASIS_CHANGED:       'desertOasisChanged',               // T257: oasis spawned / traded / watered / offered / expired
  FOREIGN_DIGNITARY_CHANGED:  'foreignDignitaryChanged',          // T258: dignitary spawned / reception / welcomed / gifted / expired
  LOST_CARAVAN_CHANGED:       'lostCaravanChanged',                // T259: caravan spawned / sheltered / hired / turned away / expired
  NOMADIC_SCHOLAR_CHANGED:    'nomadicScholarChanged',             // T260: scholar spawned / commissioned / purchased / dismissed / expired
  ROYAL_FEAST_CHANGED:        'royalFeastChanged',                 // T261: feast spawned / grand / modest / holiday / expired
  BLACKSMITH_CHANGED:         'blacksmithChanged',                 // T262: blacksmith spawned / commissioned / forged / lodged / expired
  ASTROLOGER_CHANGED:         'astrologerChanged',                 // T263: astrologer spawned / commissioned / consulted / refreshed / expired
  MERCHANT_PRINCE_CHANGED:    'merchantPrinceChanged',             // T264: merchant prince spawned / deal / exchanged / reception / expired
  WANDERING_SAGE_CHANGED:     'wanderingSageChanged',              // T266: wandering sage spawned / edict / studied / hosted / expired
  MASTER_FORESTER_CHANGED:    'masterForesterChanged',             // T267: master forester spawned / commissioned / learned / lodged / expired
  FOREST_SPIRIT_CHANGED:      'forestSpiritChanged',               // T268: forest spirit spawned / pact / wisdom / tribute / expired
  WANDERING_ALCHEMIST_CHANGED: 'wanderingAlchemistChanged',        // T269: alchemist spawned / transmuted / arts / lab / expired
  SEAFARING_EXPLORER_CHANGED:  'seafaringExplorerChanged',         // T270: explorer spawned / funded / charts / provisioned / expired
  TRAVELING_MONK_CHANGED:      'travelingMonkChanged',             // T271: monk spawned / guidance / donated / dismissed / expired
  IMPERIAL_CARTOGRAPHER_CHANGED: 'imperialCartographerChanged',   // T272: cartographer spawned / surveyed / exchanged / dismissed / expired
  WANDERING_ORACLE_CHANGED:      'wanderingOracleChanged',         // T273: oracle spawned / consulted / purchased / dismissed / expired
  ROYAL_EMISSARY_CHANGED:        'royalEmissaryChanged',           // T274: emissary spawned / received / exchanged / dismissed / expired
  WANDERING_TINKER_CHANGED:      'wanderingTinkerChanged',          // T275: tinker spawned / commissioned / purchased / dismissed / expired
  WANDERING_PHYSICIAN_CHANGED:   'wanderingPhysicianChanged',       // T276: physician spawned / treated / learned / dismissed / expired
  WANDERING_CARTOMANCER_CHANGED: 'wanderingCartomancerChanged',     // T277: cartomancer spawned / mapped / exchanged / dismissed / expired
  VILLAGE_ELDER_VISIT_CHANGED:   'villageElderVisitChanged',        // T278: elder spawned / wisdom / hospitality / dismissed / expired
  WANDERING_SCRIBE_CHANGED:      'wanderingScribeChanged',           // T279: scribe spawned / codex / manuscripts / dismissed / expired
  DESERT_TRADER_CHANGED:         'desertTraderChanged',              // T280: trader spawned / deal / exchanged / dismissed / expired
  WANDERING_GEMCUTTER_CHANGED:   'wanderingGemcutterChanged',        // T281: gemcutter spawned / commissioned / purchased / dismissed / expired
  FOREST_WARDEN_CHANGED:         'forestWardenChanged',              // T282: warden spawned / stewardship / lore / dismissed / expired
  WANDERING_BEEKEEPER_CHANGED:   'wanderingBeekeeperChanged',         // T283: beekeeper spawned / apiary / traded / dismissed / expired
  STONE_CARVER_CHANGED:          'stoneCarverChanged',                // T284: carver spawned / commission / exchange / dismissed / expired
  WANDERING_GLASSBLOWER_CHANGED: 'wanderingGlassblowerChanged',       // T285: glassblower spawned / commissioned / learned / dismissed / expired
  ROYAL_ASTRONOMER_CHANGED:      'royalAstronomerChanged',            // T286: astronomer spawned / survey / almanac / dismissed / expired
  IMPERIAL_HERALD_CHANGED:       'imperialHeraldChanged',             // T287: herald spawned / proclaimed / announced / dismissed / expired
  TRAVELING_POTTER_CHANGED:      'travelingPotterChanged',            // T288: potter spawned / commissioned / learned / dismissed / expired
  WANDERING_DYER_CHANGED:        'wanderingDyerChanged',              // T289: dyer spawned / dyed / learned / dismissed / expired
  FRONTIER_SCOUT_CHANGED:        'frontierScoutChanged',              // T290: scout spawned / commissioned / exchanged / dismissed / expired
  WANDERING_SHIPWRIGHT_CHANGED:  'wanderingShipwrightChanged',        // T291: shipwright spawned / commissioned / purchased / dismissed / expired
  MASTER_BREWER_CHANGED:              'masterBrewerChanged',               // T292: brewer spawned / commissioned / learned / dismissed / expired
  ANCIENT_MANUSCRIPT_TRADER_CHANGED: 'ancientManuscriptTraderChanged',    // T293: trader spawned / codex / secrets / dismissed / expired
  IMPERIAL_SIEGE_ENGINEER_CHANGED:   'imperialSiegeEngineerChanged',      // T294: engineer spawned / fortified / designed / dismissed / expired
  WANDERING_WEAVER_CHANGED:         'wanderingWeaverChanged',            // T295: weaver spawned / tapestry / patterns / dismissed / expired
  TRAVELING_ARCHITECT_CHANGED:      'travelingArchitectChanged',         // T296: architect spawned / blueprint / design / dismissed / expired
  WANDERING_FALCONER_CHANGED:       'wanderingFalconerChanged',          // T297: falconer spawned / hunt / falconry / dismissed / expired
  ROAMING_BOTANIST_CHANGED:         'roamingBotanistChanged',            // T298: botanist spawned / garden / lore / dismissed / expired
  WANDERING_JEWELER_CHANGED:        'wanderingJewelerChanged',           // T299: jeweler spawned / regalia / gems / dismissed / expired
  DESERT_NOMAD_CHIEF_CHANGED:       'desertNomadChiefChanged',           // T300: chief spawned / alliance / trade / dismissed / expired
  WANDERING_SCULPTOR_CHANGED:       'wanderingSculptorChanged',          // T301: sculptor spawned / commissioned / lesson / dismissed / expired
  ROYAL_VINTNER_CHANGED:            'royalVintnerChanged',               // T302: vintner spawned / vintage / knowledge / dismissed / expired
  WANDERING_MAPMAKER_CHANGED:       'wanderingMapmakerChanged',           // T303: mapmaker spawned / atlas / survey / dismissed / expired
  ROYAL_PERFUMER_CHANGED:           'royalPerfumerChanged',               // T304: perfumer spawned / fragrance / herbs / dismissed / expired
  WANDERING_SILVERSMITH_CHANGED:    'wanderingSilversmithChanged',         // T305: silversmith spawned / artifacts / jewelry / dismissed / expired
  IMPERIAL_SPICE_MERCHANT_CHANGED:  'imperialSpiceMerchantChanged',        // T306: spice merchant spawned / trade / purchase / dismissed / expired
  COURT_MUSICIAN_CHANGED:           'courtMusicianChanged',                 // T307: musician spawned / commission / performance / dismissed / expired
  ANCIENT_LIBRARY_KEEPER_CHANGED:   'ancientLibraryKeeperChanged',          // T308: keeper spawned / archive / manuscripts / dismissed / expired
  WANDERING_CLOCKMAKER_CHANGED:     'wanderingClockmakerChanged',            // T309: clockmaker spawned / clock / timepiece / dismissed / expired
  IMPERIAL_WEAPONSMITH_CHANGED:     'imperialWeaponsmithChanged',            // T310: weaponsmith spawned / armory / techniques / dismissed / expired
  WANDERING_STONEMASON_CHANGED:     'wanderingStonemasonChanged',            // T311: stonemason spawned / stoneworks / techniques / dismissed / expired
  IMPERIAL_DYE_MASTER_CHANGED:      'imperialDyeMasterChanged',              // T312: dye master spawned / dyeWorks / formulas / dismissed / expired
  WANDERING_NAVIGATOR_CHANGED:      'wanderingNavigatorChanged',              // T313: navigator spawned / charts / secrets / dismissed / expired
  TRAVELING_ILLUMINATOR_CHANGED:    'travelingIlluminatorChanged',            // T314: illuminator spawned / codex / scripts / dismissed / expired
  ANCIENT_RITUAL_LEADER_CHANGED:    'ancientRitualLeaderChanged',             // T315: ritual leader spawned / ceremony / donation / dismissed / expired
  MOUNTAIN_PROSPECTOR_CHANGED:      'mountainProspectorChanged',              // T316: prospector spawned / expedition / maps / dismissed / expired
  WANDERING_LEATHERWORKER_CHANGED:  'wanderingLeatherworkerChanged',          // T317: leatherworker spawned / saddles / leather / dismissed / expired
  ROYAL_APOTHECARY_CHANGED:         'royalApothecaryChanged',                 // T318: apothecary spawned / remedies / potions / dismissed / expired
  WANDERING_FISHMONGER_CHANGED:     'wanderingFishmongerChanged',             // T319: fishmonger spawned / purchased / traded / dismissed / expired
  IMPERIAL_CHANDLER_CHANGED:        'imperialChandlerChanged',                // T320: chandler spawned / commissioned / purchased / dismissed / expired
  ROYAL_LAMPLIGHTER_CHANGED:        'royalLamplighterChanged',                // T321: lamplighter spawned / established / purchased / dismissed / expired
  WANDERING_COOPER_CHANGED:         'wanderingCooperChanged',                 // T322: cooper spawned / commissioned / purchased / dismissed / expired
  WANDERING_ROPE_MAKER_CHANGED:     'wanderingRopeMakerChanged',              // T323: rope maker spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_SALT_MERCHANT_CHANGED:   'imperialSaltMerchantChanged',            // T324: salt merchant spawned / route / purchased / dismissed / expired
  WANDERING_PUPPETEER_CHANGED:      'wanderingPuppeteerChanged',              // T325: puppeteer spawned / pageant / performance / dismissed / expired
  ANCIENT_RUNE_CARVER_CHANGED:      'ancientRuneCarverChanged',               // T326: rune carver spawned / commissioned / studied / dismissed / expired
  WANDERING_CARTWRIGHT_CHANGED:     'wanderingCartwrightChanged',             // T327: cartwright spawned / commissioned / learned / dismissed / expired
  IMPERIAL_FARRIER_CHANGED:         'imperialFarrierChanged',                 // T328: farrier spawned / commissioned / purchased / dismissed / expired
  WANDERING_COBBLER_CHANGED:        'wanderingCobblerChanged',                // T329: cobbler spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_ENGRAVER_CHANGED:        'imperialEngraverChanged',                // T330: engraver spawned / commissioned / purchased / dismissed / expired
  WANDERING_TAILOR_CHANGED:         'wanderingTailorChanged',                 // T331: tailor spawned / commissioned / purchased / dismissed / expired
  WANDERING_TINSMITH_CHANGED:       'wanderingTinsmithChanged',               // T332: tinsmith spawned / commissioned / purchased / dismissed / expired
  WANDERING_MILLER_CHANGED:         'wanderingMillerChanged',                 // T333: miller spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_COURIER_CHANGED:         'imperialCourierChanged',                 // T334: courier spawned / established / exchanged / dismissed / expired
  WANDERING_BAKER_CHANGED:          'wanderingBakerChanged',                   // T335: baker spawned / baked / shared / dismissed / expired
  IMPERIAL_ARMORER_CHANGED:         'imperialArmorerChanged',                  // T336: armorer spawned / forged / shared / dismissed / expired
  WANDERING_WOOD_CARVER_CHANGED:    'wanderingWoodCarverChanged',               // T337: wood carver spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_ROAD_BUILDER_CHANGED:    'imperialRoadBuilderChanged',               // T338: road builder spawned / built / exchanged / dismissed / expired
  WANDERING_EMBROIDERER_CHANGED:    'wanderingEmbroidererChanged',              // T339: embroiderer spawned / embroidered / purchased / dismissed / expired
  ROYAL_BOOKBINDER_CHANGED:         'royalBookbinderChanged',                   // T340: bookbinder spawned / commissioned / purchased / dismissed / expired
  WANDERING_BASKETWEAVER_CHANGED:   'wanderingBasketweaverChanged',             // T341: basketweaver spawned / woven / purchased / dismissed / expired
  WANDERING_CHARCOAL_MAKER_CHANGED: 'wanderingCharcoalMakerChanged',            // T342: charcoal maker spawned / commissioned / purchased / dismissed / expired
  WANDERING_TANNER_CHANGED:         'wanderingTannerChanged',                   // T343: tanner spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_GLASSMAKER_CHANGED:      'imperialGlassmakerChanged',                // T344: glassmaker spawned / commissioned / purchased / dismissed / expired
  WANDERING_INKMAKER_CHANGED:       'wanderingInkmakerChanged',                 // T345: inkmaker spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_DOCKMASTER_CHANGED:      'imperialDockmasterChanged',                // T346: dockmaster spawned / established / commissioned / dismissed / expired
  WANDERING_STORYTELLER_CHANGED:   'wanderingStorytellerChanged',              // T347: storyteller spawned / chronicled / listened / dismissed / expired
  IMPERIAL_LORE_MASTER_CHANGED:    'imperialLoreMasterChanged',                // T348: lore master spawned / codex / scrolls / dismissed / expired
  WANDERING_TOYMAKER_CHANGED:      'wanderingToymakerChanged',                 // T349: toymaker spawned / toys / patterns / dismissed / expired
  IMPERIAL_FERRYMAN_CHANGED:       'imperialFerrymanChanged',                  // T350: ferryman spawned / routes / charts / dismissed / expired
  WANDERING_MOSAIC_MAKER_CHANGED:  'wanderingMosaicMakerChanged',              // T351: mosaic maker spawned / commission / exchange / dismissed / expired
  IMPERIAL_BATHHOUSE_BUILDER_CHANGED: 'imperialBathhouseBuilderChanged',       // T352: bathhouse builder spawned / construct / plans / dismissed / expired
  WANDERING_BELL_FOUNDER_CHANGED:     'wanderingBellFounderChanged',             // T353: bell founder spawned / bells / secrets / dismissed / expired
  IMPERIAL_MARBLE_CUTTER_CHANGED:     'imperialMarbleCutterChanged',             // T354: marble cutter spawned / commission / exchange / dismissed / expired
  WANDERING_PARCHMENT_MAKER_CHANGED:  'wanderingParchmentMakerChanged',          // T355: parchment maker spawned / commission / purchase / dismissed / expired
  WANDERING_INCENSE_MAKER_CHANGED:    'wanderingIncenseMakerChanged',             // T356: incense maker spawned / incense / purchase / dismissed / expired
  WANDERING_FURRIER_CHANGED:          'wanderingFurrierChanged',                   // T357: furrier spawned / commission / purchase / dismissed / expired
  IMPERIAL_WOOL_MERCHANT_CHANGED:     'imperialWoolMerchantChanged',               // T358: wool merchant spawned / trade / purchase / dismissed / expired
  WANDERING_HORSE_TRADER_CHANGED:     'wanderingHorseTraderChanged',               // T359: horse trader spawned / purchase / trade / dismissed / expired
  IMPERIAL_SILK_WEAVER_CHANGED:       'imperialSilkWeaverChanged',                 // T360: silk weaver spawned / commission / purchase / dismissed / expired
  WANDERING_GEM_MERCHANT_CHANGED:     'wanderingGemMerchantChanged',               // T361: gem merchant spawned / trade / purchase / dismissed / expired
  IMPERIAL_SIEGE_MASTER_CHANGED:      'imperialSiegeMasterChanged',                // T362: siege master spawned / commission / purchase / dismissed / expired
  WANDERING_HAT_MAKER_CHANGED:        'wanderingHatMakerChanged',                  // T363: hat maker spawned / commission / purchase / dismissed / expired
  IMPERIAL_GOLDSMITH_CHANGED:         'imperialGoldsmithChanged',                  // T364: goldsmith spawned / commission / purchase / dismissed / expired
  WANDERING_OIL_MERCHANT_CHANGED:    'wanderingOilMerchantChanged',               // T365: oil merchant spawned / purchase / trade / dismissed / expired
  IMPERIAL_QUARRYMAN_CHANGED:        'imperialQuarrymanChanged',                  // T366: quarryman spawned / commission / exchange / dismissed / expired
  WANDERING_SOAP_MAKER_CHANGED:     'wanderingSoapMakerChanged',                 // T367: soap maker spawned / commission / purchase / dismissed / expired
  IMPERIAL_METALCASTER_CHANGED:     'imperialMetalcasterChanged',                // T368: metalcaster spawned / commission / purchase / dismissed / expired
  WANDERING_GLOVE_MAKER_CHANGED:    'wanderingGloveMakerChanged',                // T369: glove maker spawned / craft / purchase / dismissed / expired
  IMPERIAL_TELESCOPE_MAKER_CHANGED: 'imperialTelescopeMakerChanged',             // T370: telescope maker spawned / commission / purchase / dismissed / expired
  WANDERING_PAPER_MAKER_CHANGED:    'wanderingPaperMakerChanged',                // T371: paper maker spawned / commission / purchase / dismissed / expired
  IMPERIAL_COIN_MINTER_CHANGED:              'imperialCoinMinterChanged',                       // T372: coin minter spawned / commission / purchase / dismissed / expired
  WANDERING_CARTOGRAPHER_GUILD_CHANGED:      'wanderingCartographerGuildChanged',               // T373: guild spawned / surveyed / purchased / dismissed / expired
  IMPERIAL_SPYMASTER_CHANGED:                'imperialSpymasterChanged',                        // T374: spymaster spawned / commissioned / purchased / dismissed / expired
  WANDERING_GEM_POLISHER_CHANGED:           'wanderingGemPolisherChanged',                     // T375: gem polisher spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_ASTROLABE_MAKER_CHANGED:         'imperialAstrolabeMakerChanged',                   // T376: astrolabe maker spawned / commissioned / purchased / dismissed / expired
  WANDERING_LOCKSMITH_CHANGED:              'wanderingLocksmithChanged',                        // T377: locksmith spawned / forged / shared / dismissed / expired
  IMPERIAL_CALLIGRAPHER_CHANGED:            'imperialCalligrapherChanged',                      // T378: calligrapher spawned / commissioned / purchased / dismissed / expired
  WANDERING_COPPERSMITH_CHANGED:            'wanderingCoppersmithChanged',                      // T379: coppersmith spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_SCRIVENER_CHANGED:               'imperialScrivenerChanged',                         // T380: scrivener spawned / commissioned / purchased / dismissed / expired
  WANDERING_MIRROR_MAKER_CHANGED:           'wanderingMirrorMakerChanged',                      // T381: mirror maker spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_FLOWER_MERCHANT_CHANGED:         'imperialFlowerMerchantChanged',                    // T382: flower merchant spawned / arranged / purchased / dismissed / expired
  WANDERING_DRESSMAKER_CHANGED:             'wanderingDressmakertChanged',                       // T383: dressmaker spawned / sewn / purchased / dismissed / expired
  IMPERIAL_TILE_SETTER_CHANGED:             'imperialTileSetterChanged',                         // T384: tile setter spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_BANNER_WEAVER_CHANGED:           'imperialBannerWeaverChanged',                        // T385: banner weaver spawned / woven / purchased / dismissed / expired
  WANDERING_BONE_CARVER_CHANGED:            'wanderingBoneCarverChanged',                          // T386: bone carver spawned / commissioned / purchased / dismissed / expired
  WANDERING_TAPESTRY_MAKER_CHANGED:         'wanderingTapestryMakerChanged',                        // T387: tapestry maker spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_SIEGE_ARCHITECT_CHANGED:         'imperialSiegeArchitectChanged',                        // T388: siege architect spawned / commissioned / studied / dismissed / expired
  WANDERING_LUTE_MAKER_CHANGED:             'wanderingLuteMakerChanged',                             // T389: lute maker spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_STONECUTTER_GUILD_CHANGED:       'imperialStonecutterGuildChanged',                       // T390: stonecutter guild spawned / commissioned / purchased / dismissed / expired
  WANDERING_CANDLEMAKER_CHANGED:            'wanderingCandlemakerChanged',                            // T391: candlemaker spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_GRAIN_MERCHANT_CHANGED:          'imperialGrainMerchantChanged',                           // T392: grain merchant spawned / established / purchased / dismissed / expired
  WANDERING_FELT_MAKER_CHANGED:             'wanderingFeltMakerChanged',                               // T393: felt maker spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_VINEYARD_MASTER_CHANGED:         'imperialVineyardMasterChanged',                           // T394: vineyard master spawned / commissioned / purchased / dismissed / expired
  WANDERING_HERB_MERCHANT_CHANGED:          'wanderingHerbMerchantChanged',                            // T395: herb merchant spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_LANTERN_MAKER_CHANGED:           'imperialLanternMakerChanged',                             // T396: lantern maker spawned / commissioned / purchased / dismissed / expired
  WANDERING_INK_MASTER_CHANGED:            'wanderingInkMasterChanged',                               // T397: ink master spawned / commissioned / purchased / dismissed / expired
  WANDERING_SALT_MERCHANT_CHANGED:         'wanderingSaltMerchantChanged',                            // T398: salt merchant spawned / commissioned / purchased / dismissed / expired
  WANDERING_BRONZE_SMITH_CHANGED:          'wanderingBronzeSmithChanged',                              // T399: bronze smith spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_AQUEDUCT_BUILDER_CHANGED:       'imperialAqueductBuilderChanged',                           // T400: aqueduct builder spawned / commissioned / studied / dismissed / expired
  WANDERING_GLASS_PAINTER_CHANGED:         'wanderingGlassPainterChanged',                              // T401: glass painter spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_SIEGE_CATAPULT_ENGINEER_CHANGED: 'imperialSiegeCatapultEngineerChanged',                    // T402: siege catapult engineer spawned / commissioned / studied / dismissed / expired
  WANDERING_WOOL_SPINNER_CHANGED:           'wanderingWoolSpinnerChanged',                               // T403: wool spinner spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_AMBER_MERCHANT_CHANGED:          'imperialAmberMerchantChanged',                              // T404: amber merchant spawned / arranged / purchased / dismissed / expired
  WANDERING_SANDGLASS_MAKER_CHANGED:        'wanderingSandglassMakerChanged',                            // T405: sandglass maker spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_BRIDGE_BUILDER_CHANGED:          'imperialBridgeBuilderChanged',                              // T406: bridge builder spawned / commissioned / studied / dismissed / expired
  WANDERING_CHRONICLER_CHANGED:             'wanderingChroniclerChanged',                                // T407: chronicler spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_SURVEYOR_CHANGED:                'imperialSurveyorChanged',                                   // T408: surveyor spawned / commissioned / studied / dismissed / expired
  WANDERING_TAPESTRY_RESTORER_CHANGED:      'wanderingTapestryRestorerChanged',                           // T409: tapestry restorer spawned / commissioned / learned / dismissed / expired
  IMPERIAL_HARBOR_MASTER_CHANGED:           'imperialHarborMasterChanged',                                // T410: harbor master spawned / commissioned / studied / dismissed / expired
  WANDERING_BOW_MAKER_CHANGED:              'wanderingBowMakerChanged',                                   // T411: bow maker spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_CHEESE_MERCHANT_CHANGED:         'imperialCheeseMerchantChanged',                              // T412: cheese merchant spawned / established / purchased / dismissed / expired
  WANDERING_THATCHER_CHANGED:              'wanderingThatcherChanged',                                    // T413: thatcher spawned / thatched / purchased / dismissed / expired
  IMPERIAL_MILLSTONE_CUTTER_CHANGED:       'imperialMillstoneCutterChanged',                              // T414: millstone cutter spawned / commissioned / purchased / dismissed / expired
  WANDERING_PEAT_CUTTER_CHANGED:           'wanderingPeatCutterChanged',                                  // T415: peat cutter spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_ICON_PAINTER_CHANGED:           'imperialIconPainterChanged',                                  // T416: icon painter spawned / commissioned / purchased / dismissed / expired
  WANDERING_WAX_TABLET_MAKER_CHANGED:      'wanderingWaxTabletMakerChanged',                               // T417: wax tablet maker spawned / commissioned / purchased / dismissed / expired
  WANDERING_NET_MAKER_CHANGED:             'wanderingNetMakerChanged',                                     // T418: net maker spawned / commissioned / purchased / dismissed / expired
  WANDERING_DRUM_MAKER_CHANGED:            'wanderingDrumMakerChanged',                                    // T419: drum maker spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_HERBARIUM_KEEPER_CHANGED:       'imperialHerbariumKeeperChanged',                               // T420: herbarium keeper spawned / commissioned / purchased / dismissed / expired
  WANDERING_SPEAR_MAKER_CHANGED:           'wanderingSpearMakerChanged',                                    // T421: spear maker spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_ROBE_MAKER_CHANGED:             'imperialRobeMakerChanged',                                      // T422: robe maker spawned / commissioned / purchased / dismissed / expired
  WANDERING_FLETCHER_CHANGED:              'wanderingFletcherChanged',                                       // T423: fletcher spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_KNIFESMITH_CHANGED:             'imperialKnifesmithChanged',                                      // T424: knifesmith spawned / commissioned / purchased / dismissed / expired
  WANDERING_SAIL_MAKER_CHANGED:            'wanderingSailMakerChanged',                                      // T425: sail maker spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_CHARIOT_BUILDER_CHANGED:        'imperialChariotBuilderChanged',                                  // T426: chariot builder spawned / commissioned / purchased / dismissed / expired
  WANDERING_SEED_MERCHANT_CHANGED:         'wanderingSeedMerchantChanged',                                   // T427: seed merchant spawned / purchased / exchanged / dismissed / expired
  IMPERIAL_SILKSCREEN_PAINTER_CHANGED:     'imperialSilkscreenPainterChanged',                               // T428: silkscreen painter spawned / commissioned / purchased / dismissed / expired
  WANDERING_WOODCUTTER_CHANGED:            'wanderingWoodcutterChanged',                                     // T429: woodcutter spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_MASONS_GUILD_CHANGED:           'imperialMasonsGuildChanged',                                     // T430: mason's guild spawned / commissioned / purchased / dismissed / expired
  WANDERING_KNIFE_SHARPENER_CHANGED:       'wanderingKnifeSharpenerChanged',                                  // T431: knife sharpener spawned / sharpened / purchased / dismissed / expired
  IMPERIAL_FRESCO_PAINTER_CHANGED:         'imperialFrescoPainterChanged',                                    // T432: fresco painter spawned / commissioned / purchased / dismissed / expired
  WANDERING_DYE_MERCHANT_CHANGED:          'wanderingDyeMerchantChanged',                                     // T433: dye merchant spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_CARTOGRAPHERS_ACADEMY_CHANGED:  'imperialCartographersAcademyChanged',                             // T434: cartographer's academy spawned / commissioned / studied / dismissed / expired
  WANDERING_FLAX_WEAVER_CHANGED:           'wanderingFlaxWeaverChanged',                                      // T435: flax weaver spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_OILPRESS_MASTER_CHANGED:        'imperialOilpressMasterChanged',                                   // T436: oilpress master spawned / commissioned / purchased / dismissed / expired
  WANDERING_LIME_BURNER_CHANGED:           'wanderingLimeBurnerChanged',                                       // T437: lime burner spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_MOSAIC_MASTER_CHANGED:          'imperialMosaicMasterChanged',                                      // T438: mosaic master spawned / commissioned / purchased / dismissed / expired
  WANDERING_TAR_MAKER_CHANGED:             'wanderingTarMakerChanged',                                         // T439: tar maker spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_GRANARY_MASTER_CHANGED:         'imperialGranaryMasterChanged',                                     // T440: granary master spawned / commissioned / purchased / dismissed / expired
  WANDERING_WICKER_WEAVER_CHANGED:         'wanderingWickerWeaverChanged',                                     // T441: wicker weaver spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_WELL_BUILDER_CHANGED:           'imperialWellBuilderChanged',                                       // T442: well builder spawned / commissioned / purchased / dismissed / expired
  WANDERING_BRICKMAKER_CHANGED:            'wanderingBrickmakerChanged',                                        // T443: brickmaker spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_THREAD_MERCHANT_CHANGED:        'imperialThreadMerchantChanged',                                     // T444: thread merchant spawned / commissioned / purchased / dismissed / expired
  WANDERING_HORN_CARVER_CHANGED:           'wanderingHornCarverChanged',                                        // T445: horn carver spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_REED_MERCHANT_CHANGED:          'imperialReedMerchantChanged',                                       // T446: reed merchant spawned / commissioned / purchased / dismissed / expired
  WANDERING_BELLOWS_MAKER_CHANGED:         'wanderingBellowsMakerChanged',                                      // T447: bellows maker spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_OLIVE_GROVE_MASTER_CHANGED:     'imperialOliveGroveMasterChanged',                                   // T448: olive grove master spawned / commissioned / purchased / dismissed / expired
  WANDERING_AMBER_CARVER_CHANGED:          'wanderingAmberCarverChanged',                                       // T449: amber carver spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_SILK_DYER_CHANGED:              'imperialSilkDyerChanged',                                           // T450: silk dyer spawned / commissioned / purchased / dismissed / expired
  WANDERING_PITCH_MAKER_CHANGED:           'wanderingPitchMakerChanged',                                        // T451: pitch maker spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_WEIGH_MASTER_CHANGED:           'imperialWeighMasterChanged',                                        // T452: weigh master spawned / commissioned / purchased / dismissed / expired
  WANDERING_FLAX_SPINNER_CHANGED:          'wanderingFlaxSpinnerChanged',                                       // T453: flax spinner spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_SALT_WORKS_MASTER_CHANGED:      'imperialSaltWorksMasterChanged',                                    // T454: salt works master spawned / commissioned / purchased / dismissed / expired
  WANDERING_CLOTH_MERCHANT_CHANGED:        'wanderingClothMerchantChanged',                                     // T455: cloth merchant spawned / purchased / traded / dismissed / expired
  IMPERIAL_COPPER_MERCHANT_CHANGED:        'imperialCopperMerchantChanged',                                     // T456: copper merchant spawned / traded / purchased / dismissed / expired
  WANDERING_PEARL_DIVER_CHANGED:           'wanderingPearlDiverChanged',                                        // T457: pearl diver spawned / traded / purchased / dismissed / expired
  IMPERIAL_CARPET_MAKER_CHANGED:           'imperialCarpetMakerChanged',                                        // T458: carpet maker spawned / commissioned / purchased / dismissed / expired
  WANDERING_PIGMENT_MERCHANT_CHANGED:      'wanderingPigmentMerchantChanged',                                   // T459: pigment merchant spawned / arranged / purchased / dismissed / expired
  IMPERIAL_MILLWRIGHT_CHANGED:             'imperialMillwrightChanged',                                         // T460: millwright spawned / commissioned / purchased / dismissed / expired
  WANDERING_TALLOW_CHANDLER_CHANGED:       'wanderingTallowChandlerChanged',                                     // T461: tallow chandler spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_ROPE_WALK_MASTER_CHANGED:       'imperialRopeWalkMasterChanged',                                      // T462: rope walk master spawned / commissioned / purchased / dismissed / expired
  WANDERING_CANOE_BUILDER_CHANGED:         'wanderingCanoeBuilderChanged',                                       // T463: canoe builder spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_MARBLE_POLISHER_CHANGED:        'imperialMarblePolisherChanged',                                      // T464: marble polisher spawned / commissioned / exchanged / dismissed / expired
  WANDERING_CHARCOAL_BURNER_CHANGED:       'wanderingCharcoalBurnerChanged',                                     // T465: charcoal burner spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_COURIER_MASTER_CHANGED:         'imperialCourierMasterChanged',                                       // T466: courier master spawned / established / purchased / dismissed / expired
  WANDERING_LACE_MAKER_CHANGED:           'wanderingLaceMakerChanged',                                          // T467: lace maker spawned / commissioned / purchased / dismissed / expired
  IMPERIAL_GLASSWORKS_MASTER_CHANGED:     'imperialGlassworksMasterChanged',                                    // T468: glassworks master spawned / commissioned / purchased / dismissed / expired
});
