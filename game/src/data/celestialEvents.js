/**
 * EmpireOS — Celestial Events data (T153).
 *
 * Four astronomical events that fire every ~15 minutes with a 30-second warning.
 * Each has a unique time-limited effect on gameplay systems.
 */

export const CELESTIAL_EVENTS = {
  solar_eclipse: {
    id:       'solar_eclipse',
    icon:     '🌑',
    name:     'Solar Eclipse',
    desc:     'The sun goes dark. Mana flows freely, but combat vision is impaired.',
    duration: 480,   // 2 min at 4 ticks/s
    effects: {
      manaMult:   2.0,   // mana generation ×2 in resources.js
      combatMult: 0.85,  // −15% all attack power in combat.js
    },
    warningMsg: '🌑 A solar eclipse approaches! In 30 seconds the sun will go dark — prepare your mages.',
    activeMsg:  '🌑 Solar Eclipse begins! Arcane energies surge: mana generation ×2 for 2 min. Combat power −15%.',
    endMsg:     '🌑 The eclipse has passed. Sunlight returns to the realm.',
  },

  meteor_shower: {
    id:       'meteor_shower',
    icon:     '☄️',
    name:     'Meteor Shower',
    desc:     'Cosmic metals rain down, inspiring warriors and filling coffers.',
    duration: 360,   // 90 s
    effects: {
      combatMult: 1.10,               // +10% attack in combat.js
      lootBonus:  { gold: 150, iron: 100 }, // instant bonus on start
    },
    warningMsg: '☄️ Meteors streak across the sky! A shower of cosmic metal approaches in 30 seconds.',
    activeMsg:  '☄️ Meteor Shower! +150 gold, +100 iron from the sky. Combat power +10% for 90s.',
    endMsg:     '☄️ The meteor shower ends. The skies are clear once more.',
  },

  comet: {
    id:       'comet',
    icon:     '🌠',
    name:     'Great Comet',
    desc:     'A brilliant comet inspires scholars and lifts the spirits of your people.',
    duration: 720,   // 3 min
    effects: {
      researchMult: 2.0,  // ×2 research rate in research.js researchTick()
      moraleBonus:  15,   // instant +15 morale on start
    },
    warningMsg: '🌠 A brilliant comet blazes across the sky! Scholars ready their instruments.',
    activeMsg:  '🌠 Great Comet overhead! Research speed ×2 and +15 morale for 3 minutes.',
    endMsg:     '🌠 The comet fades into the void. Scholars return to their work.',
  },

  blue_moon: {
    id:       'blue_moon',
    icon:     '🌕',
    name:     'Blue Moon',
    desc:     'A rare azure moon bathes the land in celestial light, granting abundance.',
    duration: 480,   // 2 min
    effects: {
      allRateBonus: 1.0,  // +1/s flat to every resource in resources.js
      freeSpells:   true, // mana cost set to 0 in spells.js
    },
    warningMsg: '🌕 A blue moon is rising! Prepare for celestial abundance — it appears in 30 seconds.',
    activeMsg:  '🌕 Blue Moon! +1/s to all resources and free spell casting for 2 minutes.',
    endMsg:     '🌕 The blue moon sets. The blessing of the cosmos fades.',
  },
};

export const CELESTIAL_ORDER = ['solar_eclipse', 'meteor_shower', 'comet', 'blue_moon'];
