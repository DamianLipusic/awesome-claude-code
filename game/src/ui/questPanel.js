/**
 * EmpireOS — Quest panel UI.
 * Renders milestone objectives and the active dynamic challenge.
 */

import { state } from '../core/state.js';
import { on, Events } from '../core/events.js';
import { QUESTS, setQuestPanelRenderer } from '../systems/quests.js';
import { getChallengeSecsLeft } from '../systems/challenges.js';
import { resolvePoliticalEvent, getPoliticalEventSecsLeft } from '../systems/politicalEvents.js';
import { getActiveBounty, getBountySecsLeft } from '../systems/bounty.js';
import { getActiveRebels } from '../systems/rebels.js'; // T151
import { getActivePlague, getPlagueSecsLeft, quarantinePlague, QUARANTINE_GOLD_COST, QUARANTINE_FOOD_COST } from '../systems/plague.js'; // T161
import { hostPilgrimage } from '../systems/pilgrimages.js'; // T162
import { getActiveSeasonalObjective } from '../systems/seasonalObjectives.js'; // T170
import { TICKS_PER_SECOND } from '../core/tick.js';
import { WIN_AGE, WIN_TILES, WIN_QUESTS, WIN_DIPLOMATIC_ALLIANCES, WIN_ECONOMIC_GOLD } from '../systems/victory.js'; // T187
import { getActiveOmen, getOmenSecsLeft, avertOmen, channelOmen } from '../systems/oracle.js'; // T193
import { EPIC_CHAINS, CHAIN_ORDER, getChainProgress } from '../systems/epicQuests.js'; // T202
import { getRoyalHuntStatus, launchRoyalHunt, HUNT_GOLD_COST, HUNT_FOOD_COST } from '../systems/royalHunt.js'; // T214
import { getActiveLegendary, getLegendarySecsLeft, getLegendaryHistory, LEGENDARY_TYPES } from '../systems/legendaryEncounters.js'; // T216
import { collectHarvest, isHarvestAvailable, getHarvestSecsLeft, getCurrentHarvestReward } from '../systems/harvest.js'; // T234
import { hostImperialGames, competeImperialGames, skipImperialGames, isImperialGamesPending, getImperialGamesSecsLeft } from '../systems/imperialGames.js'; // T236
import { acceptTribe, hireTribe, refuseTribe, getActiveTribeEncounter, getTribeSecsLeft, ACCEPT_FOOD_COST, HIRE_GOLD_COST } from '../systems/nomadicTribe.js'; // T240
import { heedProphet, tributeProphet, dismissProphet, getActiveProphetEncounter, getProphetSecsLeft, HEED_MANA_COST, TRIBUTE_GOLD_COST } from '../systems/wanderingProphet.js'; // T241
import { commissionArtisans, exportCrafts, declineArtisanFair, getActiveArtisanFair, getArtisanFairSecsLeft, COMMISSION_WOOD_COST, COMMISSION_STONE_COST, EXPORT_FOOD_COST } from '../systems/artisanFair.js'; // T242
import { observeAlignment, performRitual, ignoreAlignment, getActiveAlignment, getAlignmentSecsLeft, RITUAL_MANA_COST, RITUAL_PRESTIGE, RITUAL_MORALE } from '../systems/cosmicAlignment.js'; // T244
import { claimTribute, getActiveTributeCaravan, getTributeCaravanSecsLeft } from '../systems/tributeCaravan.js'; // T246
import { mineOreVein, commissionOreVein, sealOreVein, getActiveOreVein, getOreVeinSecsLeft, MINE_IRON_REWARD, MINE_STONE_REWARD, MINE_MORALE_PENALTY, COMMISSION_GOLD_COST, COMMISSION_IRON_REWARD, COMMISSION_STONE_REWARD, COMMISSION_PRESTIGE } from '../systems/ancientOreVein.js'; // T247
import { purchaseRemedies, learnHerbalTechniques, sendHerbalistAway, getActiveHerbalist, getHerbalistSecsLeft, PURCHASE_GOLD_COST, PURCHASE_FOOD_REWARD, PURCHASE_MORALE, LEARN_MANA_COST, LEARN_FOOD_RATE } from '../systems/wanderingHerbalist.js'; // T248
import { circusWelcomeShow, circusRecruitPerformers, dismissCircus, getActiveCircus, getCircusSecsLeft, SHOW_GOLD_COST, SHOW_MORALE_REWARD, SHOW_PRESTIGE_REWARD, RECRUIT_GOLD_COST, RECRUIT_MORALE_REWARD, RECRUIT_FOOD_RATE } from '../systems/travelingCircus.js'; // T249
import { blessSpringWaters, sellSpringWaterRights, protectSacredSpring, getActiveSacredSpring, getSacredSpringSecsLeft, BLESS_MANA_COST, BLESS_FOOD_REWARD, BLESS_MORALE_REWARD, BLESS_PRESTIGE_REWARD, SELL_PRESTIGE_COST, SELL_GOLD_REWARD, PROTECT_MORALE_REWARD, PROTECT_PRESTIGE_REWARD } from '../systems/sacredSpring.js'; // T250

export function initQuestPanel() {
  const panel = document.getElementById('panel-quests');
  if (!panel) return;

  // Re-render on quest/challenge/state changes
  const events = [
    Events.BUILDING_CHANGED, Events.UNIT_CHANGED, Events.TECH_CHANGED,
    Events.AGE_CHANGED, Events.MAP_CHANGED, Events.QUEST_COMPLETED,
    Events.CHALLENGE_UPDATED, Events.POPULATION_CHANGED, Events.RESOURCE_CHANGED,
    Events.POLITICAL_EVENT, Events.BOUNTY_CHANGED,
    Events.REBEL_UPRISING, Events.REBELS_SUPPRESSED,  // T151
    Events.PLAGUE_STARTED, Events.PLAGUE_ENDED,        // T161
    Events.PILGRIMAGE_ARRIVED, Events.PILGRIMAGE_HOSTED, // T162
    Events.SEASONAL_OBJECTIVE,                          // T170
    Events.DIPLOMACY_CHANGED,                           // T187: victory progress alliance count
    Events.OMEN_APPEARED, Events.OMEN_AVERTED,          // T193: oracle omen state changes
    Events.OMEN_CHANNELED, Events.OMEN_FIRED,           // T193
    Events.EPIC_QUEST_PROGRESS,                         // T202: epic quest chain step/completion
    Events.HUNT_CHANGED,                                // T214: royal hunt state changes
    Events.LEGENDARY_CHANGED,                           // T216: legendary encounter spawned/defeated/expired
    Events.SEASON_CHANGED,                              // T234: reset harvest on season change
    Events.HARVEST_CHANGED,                             // T234: harvest window opened/collected/expired
    Events.IMPERIAL_GAMES_CHANGED,                      // T236: imperial games announced/resolved/expired
    Events.NOMADIC_TRIBE_CHANGED,                        // T240: nomadic tribe encounter
    Events.PROPHET_CHANGED,                              // T241: wandering prophet encounter
    Events.ARTISAN_FAIR_CHANGED,                         // T242: artisan fair encounter
    Events.COSMIC_ALIGNMENT_CHANGED,                     // T244: cosmic alignment encounter
    Events.TRIBUTE_CARAVAN_CHANGED,                      // T246: tribute caravan spawned / claimed / expired
    Events.ORE_VEIN_CHANGED,                             // T247: ore vein spawned / mined / commissioned / sealed / expired
    Events.HERBALIST_CHANGED,                            // T248: herbalist spawned / purchased / learned / dismissed / expired
    Events.CIRCUS_CHANGED,                               // T249: circus spawned / welcomed / recruited / dismissed / expired
    Events.SACRED_SPRING_CHANGED,                        // T250: sacred spring spawned / blessed / sold / protected / expired
  ];
  for (const ev of events) on(ev, render);

  // Refresh countdowns every second via TICK
  let _tickCount = 0;
  on(Events.TICK, () => {
    if (++_tickCount % TICKS_PER_SECOND === 0) {
      const ch = state.challenges?.active;
      const pe = state.politicalEvents?.pending;
      const bo = state.bounty?.current;
      const pl = state.plague?.active;
      const pi = state.pilgrimages?.pending;
      const om = state.oracle?.activeOmen;
      const rh  = state.royalHunt?.pending || state.royalHunt?.active;
      const leg = state.legendary?.current;
      const hv  = isHarvestAvailable();
      const ig  = isImperialGamesPending();
      const nt  = !!getActiveTribeEncounter();
      const pr  = !!getActiveProphetEncounter();
      const af  = !!getActiveArtisanFair();
      const ca  = !!getActiveAlignment();
      const tc  = !!getActiveTributeCaravan();
      const ov  = !!getActiveOreVein();
      const hb  = !!getActiveHerbalist();
      if (ch || pe || bo || pl || pi || om || rh || leg || hv || ig || nt || pr || af || ca || tc || ov || hb) render();
    }
  });

  // Delegate click events
  panel.addEventListener('click', (e) => {
    // Oracle omen actions (T193)
    if (e.target.closest('[data-action="avert-omen"]')) {
      const r = avertOmen();
      if (!r.ok) {
        const b = e.target.closest('[data-action="avert-omen"]');
        if (b) { b.textContent = r.reason; setTimeout(() => render(), 1500); }
      }
      return;
    }
    if (e.target.closest('[data-action="channel-omen"]')) {
      const r = channelOmen();
      if (!r.ok) {
        const b = e.target.closest('[data-action="channel-omen"]');
        if (b) { b.textContent = r.reason; setTimeout(() => render(), 1500); }
      }
      return;
    }
    // Political event choices
    const polBtn = e.target.closest('[data-pol-choice]');
    if (polBtn) {
      const choice = polBtn.dataset.polChoice;
      const result = resolvePoliticalEvent(choice);
      if (!result.ok) {
        polBtn.title = result.reason ?? 'Cannot choose that option.';
        polBtn.classList.add('btn--shake');
        setTimeout(() => polBtn.classList.remove('btn--shake'), 500);
      }
      return;
    }
    // Quarantine button (T161)
    if (e.target.closest('[data-action="quarantine-plague"]')) {
      const r = quarantinePlague();
      if (!r.ok) {
        const b = e.target.closest('[data-action="quarantine-plague"]');
        if (b) { b.textContent = r.reason; setTimeout(() => render(), 1500); }
      }
      return;
    }
    // Host pilgrimage button (T162)
    if (e.target.closest('[data-action="host-pilgrimage"]')) {
      const r = hostPilgrimage();
      if (!r.ok) {
        const b = e.target.closest('[data-action="host-pilgrimage"]');
        if (b) { b.textContent = r.reason; setTimeout(() => render(), 1500); }
      }
      return;
    }
    // Launch royal hunt button (T214)
    if (e.target.closest('[data-action="launch-hunt"]')) {
      const r = launchRoyalHunt();
      if (!r.ok) {
        const b = e.target.closest('[data-action="launch-hunt"]');
        if (b) { b.textContent = r.reason; setTimeout(() => render(), 1500); }
      }
    }
    // Collect seasonal harvest (T234)
    if (e.target.closest('[data-action="collect-harvest"]')) {
      const r = collectHarvest();
      if (!r.ok) {
        const b = e.target.closest('[data-action="collect-harvest"]');
        if (b) { b.textContent = r.reason; setTimeout(() => render(), 1500); }
      }
    }
    // Imperial Games actions (T236)
    if (e.target.closest('[data-action="games-host"]')) {
      const r = hostImperialGames();
      if (!r.ok) {
        const b = e.target.closest('[data-action="games-host"]');
        if (b) { b.textContent = r.reason; setTimeout(() => render(), 1500); }
      }
    }
    if (e.target.closest('[data-action="games-compete"]')) {
      const r = competeImperialGames();
      if (!r.ok) {
        const b = e.target.closest('[data-action="games-compete"]');
        if (b) { b.textContent = r.reason; setTimeout(() => render(), 1500); }
      }
    }
    if (e.target.closest('[data-action="games-skip"]')) {
      skipImperialGames();
    }
    // Nomadic tribe actions (T240)
    if (e.target.closest('[data-action="tribe-accept"]')) {
      const r = acceptTribe();
      if (!r.ok) {
        const b = e.target.closest('[data-action="tribe-accept"]');
        if (b) { b.textContent = r.reason; setTimeout(() => render(), 1500); }
      }
    }
    if (e.target.closest('[data-action="tribe-hire"]')) {
      const r = hireTribe();
      if (!r.ok) {
        const b = e.target.closest('[data-action="tribe-hire"]');
        if (b) { b.textContent = r.reason; setTimeout(() => render(), 1500); }
      }
    }
    if (e.target.closest('[data-action="tribe-refuse"]')) {
      refuseTribe();
    }
    // Wandering prophet actions (T241)
    if (e.target.closest('[data-action="prophet-heed"]')) {
      const r = heedProphet();
      if (!r.ok) {
        const b = e.target.closest('[data-action="prophet-heed"]');
        if (b) { b.textContent = r.reason; setTimeout(() => render(), 1500); }
      }
    }
    if (e.target.closest('[data-action="prophet-tribute"]')) {
      const r = tributeProphet();
      if (!r.ok) {
        const b = e.target.closest('[data-action="prophet-tribute"]');
        if (b) { b.textContent = r.reason; setTimeout(() => render(), 1500); }
      }
    }
    if (e.target.closest('[data-action="prophet-dismiss"]')) {
      dismissProphet();
    }
    // Artisan fair actions (T242)
    if (e.target.closest('[data-action="fair-commission"]')) {
      const r = commissionArtisans();
      if (!r.ok) {
        const b = e.target.closest('[data-action="fair-commission"]');
        if (b) { b.textContent = r.reason; setTimeout(() => render(), 1500); }
      }
    }
    if (e.target.closest('[data-action="fair-export"]')) {
      const r = exportCrafts();
      if (!r.ok) {
        const b = e.target.closest('[data-action="fair-export"]');
        if (b) { b.textContent = r.reason; setTimeout(() => render(), 1500); }
      }
    }
    if (e.target.closest('[data-action="fair-decline"]')) {
      declineArtisanFair();
    }
    // Cosmic alignment actions (T244)
    if (e.target.closest('[data-action="align-observe"]')) {
      const r = observeAlignment();
      if (!r.ok) {
        const b = e.target.closest('[data-action="align-observe"]');
        if (b) { b.textContent = r.reason; setTimeout(() => render(), 1500); }
      }
    }
    if (e.target.closest('[data-action="align-ritual"]')) {
      const r = performRitual();
      if (!r.ok) {
        const b = e.target.closest('[data-action="align-ritual"]');
        if (b) { b.textContent = r.reason; setTimeout(() => render(), 1500); }
      }
    }
    if (e.target.closest('[data-action="align-ignore"]')) {
      ignoreAlignment();
    }
    // Tribute caravan actions (T246)
    const tcBtn = e.target.closest('[data-action="tribute-claim"]');
    if (tcBtn) {
      const idx = parseInt(tcBtn.dataset.idx, 10);
      const r = claimTribute(idx);
      if (!r.ok) {
        tcBtn.textContent = r.reason;
        setTimeout(() => render(), 1500);
      }
    }
    // Ancient ore vein actions (T247)
    if (e.target.closest('[data-action="ore-mine"]')) {
      const r = mineOreVein();
      if (!r.ok) {
        const b = e.target.closest('[data-action="ore-mine"]');
        if (b) { b.textContent = r.reason; setTimeout(() => render(), 1500); }
      }
    }
    if (e.target.closest('[data-action="ore-commission"]')) {
      const r = commissionOreVein();
      if (!r.ok) {
        const b = e.target.closest('[data-action="ore-commission"]');
        if (b) { b.textContent = r.reason; setTimeout(() => render(), 1500); }
      }
    }
    if (e.target.closest('[data-action="ore-seal"]')) {
      sealOreVein();
    }
    // Wandering herbalist actions (T248)
    if (e.target.closest('[data-action="herbalist-purchase"]')) {
      const r = purchaseRemedies();
      if (!r.ok) {
        const b = e.target.closest('[data-action="herbalist-purchase"]');
        if (b) { b.textContent = r.reason; setTimeout(() => render(), 1500); }
      }
    }
    if (e.target.closest('[data-action="herbalist-learn"]')) {
      const r = learnHerbalTechniques();
      if (!r.ok) {
        const b = e.target.closest('[data-action="herbalist-learn"]');
        if (b) { b.textContent = r.reason; setTimeout(() => render(), 1500); }
      }
    }
    if (e.target.closest('[data-action="herbalist-away"]')) {
      sendHerbalistAway();
    }
    // Traveling circus actions (T249)
    if (e.target.closest('[data-action="circus-show"]')) {
      const r = circusWelcomeShow();
      if (!r.ok) {
        const b = e.target.closest('[data-action="circus-show"]');
        if (b) { b.textContent = r.reason; setTimeout(() => render(), 1500); }
      }
    }
    if (e.target.closest('[data-action="circus-recruit"]')) {
      const r = circusRecruitPerformers();
      if (!r.ok) {
        const b = e.target.closest('[data-action="circus-recruit"]');
        if (b) { b.textContent = r.reason; setTimeout(() => render(), 1500); }
      }
    }
    if (e.target.closest('[data-action="circus-dismiss"]')) {
      dismissCircus();
    }
    // Sacred spring actions (T250)
    if (e.target.closest('[data-action="spring-bless"]')) {
      const r = blessSpringWaters();
      if (!r.ok) {
        const b = e.target.closest('[data-action="spring-bless"]');
        if (b) { b.textContent = r.reason; setTimeout(() => render(), 1500); }
      }
    }
    if (e.target.closest('[data-action="spring-sell"]')) {
      sellSpringWaterRights();
    }
    if (e.target.closest('[data-action="spring-protect"]')) {
      protectSacredSpring();
    }
  });

  setQuestPanelRenderer(render);
  render();
}

function render() {
  const panel = document.getElementById('panel-quests');
  if (!panel) return;

  const completed = state.quests?.completed ?? {};
  const doneCount = Object.keys(completed).length;
  const total     = QUESTS.length;
  const pct       = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  panel.innerHTML = `
    ${_legendarySection()}
    ${_oracleSection()}
    ${_plagueSection()}
    ${_pilgrimageSection()}
    ${_royalHuntSection()}
    ${_rebelSection()}
    ${_seasonalObjectiveSection()}
    ${_bountySection()}
    ${_politicalEventSection()}
    ${_challengeSection()}
    ${_tribeSection()}
    ${_prophetSection()}
    ${_artisanFairSection()}
    ${_cosmicAlignmentSection()}
    ${_tributeCaravanSection()}
    ${_oreVeinSection()}
    ${_herbalistSection()}
    ${_circusSection()}
    ${_sacredSpringSection()}
    ${_imperialGamesSection()}
    ${_harvestSection()}
    <div class="quest-header">
      <div class="quest-header__title">Quests &amp; Objectives</div>
      <div class="quest-header__meta">
        <span class="quest-header__count">${doneCount} / ${total}</span>
        <div class="progress-bar" style="width:160px">
          <div class="progress-bar__fill progress-bar__fill--quest" style="width:${pct}%"></div>
        </div>
      </div>
    </div>
    <div class="quest-list">
      ${QUESTS.map(q => _questCard(q, completed[q.id])).join('')}
    </div>
    ${_victoryProgressSection()}
    ${_epicChainsSection()}
  `;
}

// ── Oracle of Fate section (T193) ────────────────────────────────────────────

function _oracleSection() {
  if ((state.age ?? 0) < 1) return '';  // only from Bronze Age

  const omen = getActiveOmen();
  if (!omen) return '';

  const secsLeft = getOmenSecsLeft();
  const urgency  = secsLeft < 20 ? 'omen-card--urgent'
                 : secsLeft < 40 ? 'omen-card--warning' : '';

  const _costStr = (costs) =>
    Object.entries(costs).map(([r, v]) => `${v} ${r}`).join(' + ');

  return `
    <div class="omen-card ${urgency}">
      <div class="omen-card__header">
        <span class="omen-card__icon">${omen.icon}</span>
        <span class="omen-card__title">${omen.title}</span>
        <span class="omen-card__timer">${secsLeft}s</span>
      </div>
      <div class="omen-card__desc">${omen.desc}</div>
      <div class="omen-card__actions">
        <button class="btn btn--omen-avert" data-action="avert-omen"
                title="${omen.avertDesc}">
          🛡️ Avert (${_costStr(omen.avertCost)})
        </button>
        <button class="btn btn--omen-channel" data-action="channel-omen"
                title="${omen.channelDesc}">
          ✨ Channel (${_costStr(omen.channelCost)})
        </button>
      </div>
      <div class="omen-card__footer">Ignore: omen fires in ${secsLeft}s.</div>
    </div>`;
}

// ── Victory Progress section (T187) ────────────────────────────────────────────

function _victoryProgressSection() {
  if (!state.quests) return '';

  // ── Conquest progress ───────────────────────────────────────────────────────
  let playerTiles = 0;
  if (state.map) {
    for (const row of state.map.tiles) for (const t of row) if (t.owner === 'player') playerTiles++;
  }
  const currentAge   = state.age ?? 0;
  const questsDone   = Object.keys(state.quests?.completed ?? {}).length;
  const tilePct      = Math.min(100, Math.round((playerTiles / WIN_TILES) * 100));
  const agePct       = Math.min(100, Math.round((currentAge  / WIN_AGE)   * 100));
  const questPct     = Math.min(100, Math.round((questsDone  / WIN_QUESTS) * 100));
  const conquestPct  = Math.round((tilePct + agePct + questPct) / 3);

  // ── Diplomatic progress ──────────────────────────────────────────────────────
  const alliedCount  = state.diplomacy?.empires?.filter(e => e.relations === 'allied').length ?? 0;
  const diplomPct    = Math.min(100, Math.round((alliedCount / WIN_DIPLOMATIC_ALLIANCES) * 100));

  // ── Economic progress ──────────────────────────────────────────────────────
  const goldEarned   = state.stats?.goldEarned ?? 0;
  const hasTech      = !!state.techs?.economics;
  const goldPct      = Math.min(100, Math.round((goldEarned / WIN_ECONOMIC_GOLD) * 100));
  const econPct      = hasTech ? Math.round((goldPct + 100) / 2) : Math.round(goldPct / 2);

  function bar(pct, cls) {
    return `<div class="vp-bar-bg"><div class="vp-bar-fill ${cls}" style="width:${pct}%"></div></div>`;
  }

  return `
    <div class="victory-progress-section">
      <div class="victory-progress-header">🏆 Victory Paths</div>

      <div class="vp-card vp-card--conquest">
        <div class="vp-card__title">⚔️ Conquest <span class="vp-pct">${conquestPct}%</span></div>
        <div class="vp-row">
          <span class="vp-label">Territory</span>
          ${bar(tilePct, 'vp-bar-fill--conquest')}
          <span class="vp-val">${playerTiles}/${WIN_TILES}</span>
        </div>
        <div class="vp-row">
          <span class="vp-label">Age</span>
          ${bar(agePct, 'vp-bar-fill--conquest')}
          <span class="vp-val">${currentAge}/${WIN_AGE}</span>
        </div>
        <div class="vp-row">
          <span class="vp-label">Quests</span>
          ${bar(questPct, 'vp-bar-fill--conquest')}
          <span class="vp-val">${questsDone}/${WIN_QUESTS}</span>
        </div>
      </div>

      <div class="vp-card vp-card--diplomatic">
        <div class="vp-card__title">🤝 Diplomatic <span class="vp-pct">${diplomPct}%</span></div>
        <div class="vp-row">
          <span class="vp-label">Alliances</span>
          ${bar(diplomPct, 'vp-bar-fill--diplomatic')}
          <span class="vp-val">${alliedCount}/${WIN_DIPLOMATIC_ALLIANCES}</span>
        </div>
        <div class="vp-card__sub">Ally all ${WIN_DIPLOMATIC_ALLIANCES} rival empires simultaneously.</div>
      </div>

      <div class="vp-card vp-card--economic">
        <div class="vp-card__title">💰 Economic <span class="vp-pct">${econPct}%</span></div>
        <div class="vp-row">
          <span class="vp-label">Gold Earned</span>
          ${bar(goldPct, 'vp-bar-fill--economic')}
          <span class="vp-val">${Math.floor(goldEarned).toLocaleString()}/${WIN_ECONOMIC_GOLD.toLocaleString()}</span>
        </div>
        <div class="vp-row">
          <span class="vp-label">Economics Tech</span>
          <span class="vp-tech-status ${hasTech ? 'vp-tech-status--done' : ''}">${hasTech ? '✅ Researched' : '🔒 Not yet researched'}</span>
        </div>
      </div>
    </div>
  `;
}

// ── Plague section (T161) ──────────────────────────────────────────────────────────────

function _plagueSection() {
  if ((state.age ?? 0) < 1) return '';  // Bronze Age+ only

  const plague = getActivePlague();
  if (!plague) return '';

  const secsLeft = getPlagueSecsLeft();
  const canAfford = (state.resources?.gold ?? 0) >= QUARANTINE_GOLD_COST &&
                    (state.resources?.food ?? 0) >= QUARANTINE_FOOD_COST;
  const btnClass = canAfford ? 'btn btn--sm btn--quarantine' : 'btn btn--sm btn--quarantine btn--disabled';

  return `
    <div class="plague-section plague-section--active">
      <div class="plague-section__header">🦠 Plague Outbreak!</div>
      <div class="plague-section__desc">
        Food production −35%. Population slowly declining. Ends in <strong>${secsLeft}s</strong>.
      </div>
      <div class="plague-section__actions">
        <button class="${btnClass}" data-action="quarantine-plague"
          title="${canAfford ? `Quarantine the plague (${QUARANTINE_GOLD_COST}💰 ${QUARANTINE_FOOD_COST}🍞)` : `Need ${QUARANTINE_GOLD_COST}💰 + ${QUARANTINE_FOOD_COST}🍞`}">
          🏥 Quarantine (${QUARANTINE_GOLD_COST}💰 ${QUARANTINE_FOOD_COST}🍞)
        </button>
      </div>
    </div>`;
}

// ── Pilgrimage section (T162) ─────────────────────────────────────────────────────────────────

function _pilgrimageSection() {
  if ((state.age ?? 0) < 1) return '';  // Bronze Age+ only
  const pg = state.pilgrimages;
  if (!pg) return '';

  // Active bonus display
  const bonus = pg.activeBonus;
  if (bonus && state.tick < bonus.expiresAt) {
    const secsLeft = Math.max(0, Math.ceil((bonus.expiresAt - state.tick) / TICKS_PER_SECOND));
    const label = bonus.type === 'artists'  ? '+0.5 gold/s' :
                  bonus.type === 'scholars' ? '+15% research speed' : '+0.3 mana/s';
    return `
      <div class="pilgrimage-section pilgrimage-section--bonus">
        <div class="pilgrimage-section__header">${bonus.icon} Pilgrimage Blessing Active</div>
        <div class="pilgrimage-section__desc">${label} — expires in <strong>${secsLeft}s</strong></div>
      </div>`;
  }

  // Pending pilgrim visit
  const pending = pg.pending;
  if (!pending) return '';

  const secsLeft = Math.max(0, Math.ceil((pending.expiresAt - state.tick) / TICKS_PER_SECOND));
  const canAfford = (state.resources?.gold ?? 0) >= 20 && (state.resources?.food ?? 0) >= 30;
  const hasBuilding = (state.buildings?.[pending.buildingId] ?? 0) > 0;
  const canHost = canAfford && hasBuilding;
  const btnClass = `btn btn--sm btn--pilgrimage${canHost ? '' : ' btn--disabled'}`;
  const reason = !hasBuilding ? `Requires ${pending.buildingId}` :
                 !canAfford  ? 'Need 20💰 + 30🍞' : 'Host pilgrims';

  return `
    <div class="pilgrimage-section pilgrimage-section--pending">
      <div class="pilgrimage-section__header">${pending.icon} ${pending.name} Arrive!</div>
      <div class="pilgrimage-section__desc">${pending.desc} Expires in <strong>${secsLeft}s</strong>.</div>
      <div class="pilgrimage-section__actions">
        <button class="${btnClass}" data-action="host-pilgrimage" title="${reason}">
          🏛️ Host (20💰 30🍞)
        </button>
      </div>
    </div>`;
}

// ── Legendary Encounter section (T216) ───────────────────────────────────────────────

function _legendarySection() {
  const leg  = getActiveLegendary();
  const hist = getLegendaryHistory();
  if (!leg && hist.length === 0) return '';

  const totalDefeated = state.legendary?.totalDefeated ?? 0;

  let activeHtml = '';
  if (leg) {
    const def      = LEGENDARY_TYPES[leg.type];
    const secsLeft = getLegendarySecsLeft();
    activeHtml = `
      <div class="legendary-section">
        <div class="legendary-header">
          <span>${leg.icon} ${leg.name} Sighted!</span>
          <span class="legendary-countdown">${secsLeft}s remaining</span>
        </div>
        <div class="legendary-desc">${def.desc}</div>
        <div class="legendary-stats">
          <span>Defense boost: <span class="legendary-stat-val">×${def.defenseBoost}</span></span>
          <span>Reward: <span class="legendary-reward">${def.rewardDesc}</span></span>
        </div>
        <div class="legendary-hint">🗺️ Find the ${leg.icon} tile on the map and attack it!</div>
      </div>`;
  }

  let histHtml = '';
  if (hist.length > 0) {
    const rows = hist.map(h => {
      const ago = Math.floor((state.tick - h.tick) / (4 * 60));
      return `<div class="legendary-hist-entry">${h.icon} ${h.name} — ${h.reward} (${ago}m ago)</div>`;
    }).join('');
    histHtml = `
      <div class="legendary-history">
        <div class="legendary-history__label">Legendary Victories (${totalDefeated} total)</div>
        ${rows}
      </div>`;
  }

  return activeHtml + (histHtml ? `<div style="margin-top:6px">${histHtml}</div>` : '');
}

// ── Royal Hunt section (T214) ────────────────────────────────────────────────────────────────

function _royalHuntSection() {
  if ((state.age ?? 0) < 1) return '';  // Bronze Age+ only
  const hs = getRoyalHuntStatus();
  if (!hs.pending && !hs.active) return '';

  // Hunt underway
  if (hs.active) {
    return `
      <div class="hunt-section hunt-section--active">
        <div class="hunt-section__header">🦤 Royal Hunt Underway</div>
        <div class="hunt-section__desc">
          The hunting party is out in the field. Results in <strong>${hs.activeSecsLeft}s</strong>.
        </div>
      </div>`;
  }

  // Pending invitation
  const canAffordGold = (state.resources?.gold ?? 0) >= HUNT_GOLD_COST;
  const canAffordFood = (state.resources?.food ?? 0) >= HUNT_FOOD_COST;
  const canLaunch = canAffordGold && canAffordFood;
  const btnClass = `btn btn--sm btn--hunt${canLaunch ? '' : ' btn--disabled'}`;
  const reason = !canAffordGold ? `Need ${HUNT_GOLD_COST}💰`
               : !canAffordFood ? `Need ${HUNT_FOOD_COST}🍞`
               : 'Join the royal hunt';

  return `
    <div class="hunt-section hunt-section--pending">
      <div class="hunt-section__header">🦤 Royal Hunt Called!</div>
      <div class="hunt-section__desc">
        A hunting season has begun. Success grants +15 morale, +5 prestige, and a chance at iron.
        Expires in <strong>${hs.pendingSecsLeft}s</strong>.
      </div>
      <div class="hunt-section__actions">
        <button class="${btnClass}" data-action="launch-hunt" title="${reason}">
          🏹 Join Hunt (${HUNT_GOLD_COST}💰 ${HUNT_FOOD_COST}🍞)
        </button>
      </div>
    </div>`;
}

// ── Rebel section (T151) ───────────────────────────────────────────────────────────────────

function _rebelSection() {
  const rebels = getActiveRebels();
  if (rebels.length === 0) {
    // Show low-morale warning when morale is dangerously close to threshold
    const m = state.morale ?? 50;
    if (m >= 25 || state.age < 1) return '';
    return `
      <div class="rebel-section rebel-section--warning">
        <div class="rebel-section__header">⚠️ Unrest Warning</div>
        <div class="rebel-section__desc">Morale is critically low (${Math.round(m)}). If it stays below 25 a rebel uprising may occur!</div>
      </div>`;
  }

  const tileList = rebels.map(r => `(${r.x},${r.y})`).join(', ');
  return `
    <div class="rebel-section rebel-section--active">
      <div class="rebel-section__header">🔥 Rebel Uprising!</div>
      <div class="rebel-section__desc">${rebels.length} tile${rebels.length > 1 ? 's are' : ' is'} under rebel control: ${tileList}</div>
      <div class="rebel-section__hint">Open the Map tab and attack rebel tiles 🔥 to restore order. Each suppression grants +10 morale and +50 prestige.</div>
    </div>`;
}

// ── Bounty section (T135) ───────────────────────────────────────────────────────────────────

// ── Seasonal Objective section (T170) ────────────────────────────────────────────────────────────────

function _seasonalObjectiveSection() {
  const obj = getActiveSeasonalObjective();
  if (!obj) return '';

  const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];
  const seasonName   = SEASON_NAMES[obj.seasonIdx] ?? 'Season';

  return `
    <div class="seasonal-obj-section">
      <div class="seasonal-obj-header">${obj.icon} Seasonal Objective — ${seasonName}</div>
      <div class="seasonal-obj-card">
        <div class="seasonal-obj-card__top">
          <span class="seasonal-obj-card__icon">${obj.icon}</span>
          <span class="seasonal-obj-card__label">${obj.name}</span>
          <span class="seasonal-obj-card__coords">(${obj.x}, ${obj.y})</span>
        </div>
        <div class="seasonal-obj-card__desc">${obj.desc}</div>
        <div class="seasonal-obj-card__reward">Reward: ${obj.rewardDesc}</div>
        <div class="seasonal-obj-card__hint">Combat-capture this tile before the season ends!</div>
      </div>
    </div>`;
}

function _bountySection() {
  if (state.age < 1) return '';   // Bronze Age+ only

  const bounty = getActiveBounty();

  if (!bounty) {
    const b = state.bounty;
    if (!b) return '';
    const ticksLeft = (b.nextBountyTick ?? 0) - state.tick;
    if (ticksLeft <= 0) return '';
    const secsLeft = Math.ceil(ticksLeft / TICKS_PER_SECOND);
    const mins = Math.floor(secsLeft / 60);
    const secs = secsLeft % 60;
    const nextStr = mins > 0 ? `${mins}m ${String(secs).padStart(2,'0')}s` : `${secsLeft}s`;
    return `
      <div class="bounty-section">
        <div class="bounty-header">⭐ Territory Bounty</div>
        <div class="bounty-waiting">No active bounty. Next bounty in ~${nextStr}.</div>
      </div>`;
  }

  const secsLeft = getBountySecsLeft();
  const mins = Math.floor(secsLeft / 60);
  const secs = secsLeft % 60;
  const timeStr = mins > 0 ? `${mins}m ${String(secs).padStart(2,'0')}s` : `${secsLeft}s`;
  const urgent  = secsLeft <= 45;
  const rewardParts = Object.entries(bounty.reward).map(([r, a]) => `${a} ${r}`).join(' + ');

  return `
    <div class="bounty-section">
      <div class="bounty-header">⭐ Territory Bounty</div>
      <div class="bounty-card">
        <div class="bounty-card__top">
          <span class="bounty-card__icon">⭐</span>
          <span class="bounty-card__label">Capture (${bounty.x}, ${bounty.y})</span>
          <span class="bounty-card__timer${urgent ? ' bounty-card__timer--urgent' : ''}">
            ${timeStr}
          </span>
        </div>
        <div class="bounty-card__terrain">Terrain: ${bounty.terrain}</div>
        <div class="bounty-card__reward">Reward: ${rewardParts} + 60 prestige</div>
        <div class="bounty-card__hint">Combat-capture this tile to claim the bounty automatically!</div>
      </div>
    </div>`;
}

// ── Political event section ────────────────────────────────────────────────────────────────────

function _politicalEventSection() {
  const pe = state.politicalEvents;
  if (!pe) return '';

  const pending = pe.pending;

  // Show recent log even if no pending event
  const logHtml = pe.log.length > 0 ? `
    <div class="pol-event-log">
      <div class="pol-event-log__header">Recent Decisions</div>
      ${pe.log.slice(0, 4).map(e => `
        <div class="pol-event-log__entry">
          ${e.icon} <strong>${_escHtml(e.title)}</strong>:
          ${_escHtml(e.choiceLabel)} — ${_escHtml(e.effect)}
        </div>
      `).join('')}
    </div>` : '';

  if (!pending) {
    if (pe.log.length === 0) return ''; // nothing to show at all
    return `<div class="pol-event-section">
      <div class="pol-event-header">👑 Political Events</div>
      <div class="pol-event-waiting">No active event. Next event within 5–10 min.</div>
      ${logHtml}
    </div>`;
  }

  const secsLeft  = getPoliticalEventSecsLeft();
  const minsLeft  = Math.floor(secsLeft / 60);
  const sLeft     = secsLeft % 60;
  const timeStr   = minsLeft > 0
    ? `${minsLeft}m ${String(sLeft).padStart(2, '0')}s`
    : `${sLeft}s`;
  const urgent    = secsLeft < 30;

  // Check affordability of each choice
  const canAffordA = Object.entries(pending.choiceA.cost ?? {}).every(
    ([r, a]) => (state.resources[r] ?? 0) >= a,
  );
  const canAffordB = Object.entries(pending.choiceB.cost ?? {}).every(
    ([r, a]) => (state.resources[r] ?? 0) >= a,
  );

  return `
    <div class="pol-event-section">
      <div class="pol-event-header">
        <span>👑 Political Event</span>
        <span class="pol-event-timer ${urgent ? 'pol-event-timer--urgent' : ''}">
          ⏱ ${timeStr} left
        </span>
      </div>
      <div class="pol-event-card">
        <div class="pol-event-title">${pending.icon} ${_escHtml(pending.title)}</div>
        <div class="pol-event-desc">${_escHtml(pending.desc)}</div>
        <div class="pol-event-choices">
          <div class="pol-event-choice">
            <span class="pol-event-choice__label">${_escHtml(pending.choiceA.label)}</span>
            <span class="pol-event-choice__effect">${_escHtml(pending.choiceA.effect)}</span>
            <button class="btn--pol-choice" data-pol-choice="a"
                    ${canAffordA ? '' : 'disabled'}>Choose A</button>
          </div>
          <div class="pol-event-choice">
            <span class="pol-event-choice__label">${_escHtml(pending.choiceB.label)}</span>
            <span class="pol-event-choice__effect">${_escHtml(pending.choiceB.effect)}</span>
            <button class="btn--pol-choice" data-pol-choice="b"
                    ${canAffordB ? '' : 'disabled'}>Choose B</button>
          </div>
        </div>
      </div>
      ${logHtml}
    </div>`;
}

// ── Challenge section ────────────────────────────────────────────────────────────────────────

function _challengeSection() {
  const ch = state.challenges;
  if (!ch) return '';

  const secsLeft = getChallengeSecsLeft();
  const minsLeft = Math.floor(secsLeft / 60);
  const sLeft    = secsLeft % 60;
  const timeStr  = minsLeft > 0
    ? `${minsLeft}m ${String(sLeft).padStart(2, '0')}s`
    : `${sLeft}s`;

  const nextSecs = !ch.active && ch.nextGenTick !== undefined
    ? Math.max(0, Math.ceil((ch.nextGenTick - (state.tick ?? 0)) / TICKS_PER_SECOND))
    : null;

  const recentDone = (ch.completed ?? []).slice(0, 5);

  return `
    <div class="challenge-section">
      <div class="challenge-header">
        <span class="challenge-header__title">🎯 Active Challenge</span>
      </div>

      ${ch.active ? `
        <div class="challenge-card challenge-card--active">
          <div class="challenge-card__top">
            <span class="challenge-card__icon">${ch.active.icon}</span>
            <span class="challenge-card__label">${_escHtml(ch.active.label)}</span>
            <span class="challenge-card__timer ${secsLeft < 30 ? 'challenge-card__timer--urgent' : ''}">
              ⏱️ ${timeStr}
            </span>
          </div>
          <div class="challenge-card__desc">${_escHtml(ch.active.desc)}</div>
          <div class="challenge-card__reward">
            Reward: <span class="challenge-reward-text">${_rewardStr(ch.active.reward)}</span>
          </div>
          ${_progressBar(ch.active)}
        </div>
      ` : `
        <div class="challenge-card challenge-card--waiting">
          <div class="challenge-card__waiting-text">
            ${nextSecs !== null && nextSecs > 0
              ? `⏳ Next challenge in ${nextSecs}s…`
              : '⏳ Generating next challenge…'
            }
          </div>
        </div>
      `}

      ${recentDone.length > 0 ? `
        <div class="challenge-completed">
          <div class="challenge-completed__header">Completed (${recentDone.length})</div>
          ${recentDone.map(c => `
            <div class="challenge-completed__entry">
              <span>${c.icon} ${_escHtml(c.label)}</span>
              <span class="challenge-completed__reward">${_rewardStr(c.reward)}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

function _progressBar(active) {
  const tpl = _metricFor(active.type);
  if (!tpl) return '';

  const cur    = tpl();
  const start  = active.startValue ?? 0;
  const target = active.target;
  const range  = target - start;

  // For absolute types (territory, gold, population, mana) measure from startValue
  const progress = range > 0 ? Math.min(1, Math.max(0, (cur - start) / range)) : (cur >= target ? 1 : 0);
  const pct      = Math.round(progress * 100);

  return `
    <div class="challenge-progress">
      <div class="progress-bar">
        <div class="progress-bar__fill progress-bar__fill--challenge" style="width:${pct}%"></div>
      </div>
      <span class="challenge-progress__label">${pct}%</span>
    </div>
  `;
}

// Map challenge type to a live metric snapshot function
function _metricFor(type) {
  switch (type) {
    case 'territory':
      return () => {
        if (!state.map) return 0;
        let c = 0;
        for (const row of state.map.tiles) for (const t of row) if (t.owner === 'player') c++;
        return c;
      };
    case 'gold':       return () => Math.floor(state.resources?.gold  ?? 0);
    case 'combat':     return () => state.combatHistory?.filter(h => h.outcome === 'win').length ?? 0;
    case 'population': return () => Math.floor(state.population?.count ?? 0);
    case 'mana':       return () => Math.floor(state.resources?.mana  ?? 0);
    default:           return null;
  }
}

function _rewardStr(reward) {
  return Object.entries(reward ?? {}).map(([r, a]) => `+${a} ${r}`).join(', ');
}

function _escHtml(str) {
  return (str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Quest cards ────────────────────────────────────────────────────────────────────────────

// ── T202: Epic Quest Chains section ────────────────────────────────────────────────────────────────

function _epicChainsSection() {
  if (!state.epicQuests) return '';

  const chainCards = CHAIN_ORDER.map(id => {
    const chain    = EPIC_CHAINS[id];
    const progress = state.epicQuests.chains[id];
    const pct      = Math.round(getChainProgress(id) * 100);
    const step     = progress.step;
    const completed = progress.completed;

    const steps = chain.steps.map((s, i) => {
      let cls = 'epic-chain__step';
      if (i < step)  cls += ' epic-chain__step--done';
      else if (i === step && !completed) cls += ' epic-chain__step--active';
      return `<li class="${cls}">${_escHtml(s.label)}</li>`;
    }).join('');

    const badgeHtml = completed
      ? `<div class="epic-chain__bonus-badge">✅ ${_escHtml(chain.rewardDesc)}</div>`
      : `<div class="epic-chain__reward">🏆 Reward: ${_escHtml(chain.rewardDesc)}</div>`;

    return `
      <div class="epic-chain ${completed ? 'epic-chain--completed' : ''}">
        <div class="epic-chain__header">
          <span>${chain.icon}</span>
          <span>${_escHtml(chain.name)}</span>
        </div>
        ${badgeHtml}
        <ul class="epic-chain__steps">${steps}</ul>
        <div class="epic-chain__progress-bar">
          <div class="epic-chain__progress-fill" style="width:${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="epic-chains-section">
      <div class="quest-header">
        <div class="quest-header__title">⚗️ Epic Quest Chains</div>
      </div>
      ${chainCards}
    </div>
  `;
}

function _questCard(q, completedTick) {
  const done      = completedTick !== undefined;
  const rewardStr = Object.entries(q.reward).map(([r, a]) => `+${a} ${r}`).join(', ');

  return `
    <div class="quest-card ${done ? 'quest-card--done' : 'quest-card--pending'}">
      <div class="quest-card__header">
        <span class="quest-card__icon">${q.icon}</span>
        <span class="quest-card__title">${q.title}</span>
        ${done ? '<span class="quest-card__check">✓</span>' : ''}
      </div>
      <div class="quest-card__desc">${q.desc}</div>
      <div class="quest-card__reward">Reward: <span class="quest-reward-text">${rewardStr}</span></div>
    </div>
  `;
}

// ── T236: Imperial Games ────────────────────────────────────────────────────────────────────

function _imperialGamesSection() {
  if (!isImperialGamesPending()) return '';
  const secs = getImperialGamesSecsLeft();
  return `
    <div class="igames-section igames-section--active">
      <div class="igames-header">
        <span class="igames-icon">🏟️</span>
        <span class="igames-title">Imperial Games</span>
        <span class="igames-timer">${secs}s</span>
      </div>
      <div class="igames-desc">Once every 3 seasons, the world watches. Choose your role:</div>
      <div class="igames-actions">
        <button class="btn btn--games-host" data-action="games-host">
          🏆 Host <span class="igames-cost">−100💰 −50🪨 → +60 prestige, +8 morale</span>
        </button>
        <button class="btn btn--games-compete" data-action="games-compete">
          ⚔️ Compete <span class="igames-cost">−25 soldiers → +30 prestige, +4 morale</span>
        </button>
        <button class="btn btn--games-skip" data-action="games-skip">Skip</button>
      </div>
    </div>
  `;
}

// ── T234: Seasonal Harvest Window ─────────────────────────────────────────────────────────────────

function _harvestSection() {
  const available = isHarvestAvailable();
  const reward    = getCurrentHarvestReward();
  const collected = state.harvest?.collectedThisSeason ?? false;
  const secsLeft  = getHarvestSecsLeft();

  const rewardStr = Object.entries(reward.resources)
    .map(([r, v]) => `+${v} ${r}`)
    .join(', ') + `, +${reward.prestige} prestige`;

  if (available) {
    return `
      <div class="harvest-section harvest-section--active">
        <div class="harvest-header">
          <span class="harvest-icon">${reward.icon}</span>
          <span class="harvest-title">${reward.season} Harvest</span>
          <span class="harvest-timer">${secsLeft}s</span>
        </div>
        <div class="harvest-rewards">${rewardStr}</div>
        <button class="btn btn--harvest" data-action="collect-harvest">🌾 Collect Harvest</button>
      </div>
    `;
  }

  if (collected) {
    return `
      <div class="harvest-section harvest-section--done">
        <div class="harvest-header">
          <span class="harvest-icon">${reward.icon}</span>
          <span class="harvest-title">${reward.season} Harvest</span>
          <span class="harvest-badge harvest-badge--done">✓ Collected</span>
        </div>
        <div class="harvest-desc">Harvest collected. Next opens at 70% through the next season.</div>
      </div>
    `;
  }

  // Window not yet open this season
  return `
    <div class="harvest-section">
      <div class="harvest-header">
        <span class="harvest-icon">${reward.icon}</span>
        <span class="harvest-title">${reward.season} Harvest</span>
        <span class="harvest-badge">Pending</span>
      </div>
      <div class="harvest-desc">Opens at 70% through the season. Collect: ${rewardStr}</div>
    </div>
  `;
}

// ── T240: Nomadic Tribe Encounter ─────────────────────────────────────────────────────────────────

function _tribeSection() {
  const encounter = getActiveTribeEncounter();
  if (!encounter) return '';

  const secs     = getTribeSecsLeft();
  const urgent   = secs < 20;
  const gold     = state.resources?.gold ?? 0;
  const food     = state.resources?.food ?? 0;
  const canAccept = food >= ACCEPT_FOOD_COST;
  const canHire   = gold >= HIRE_GOLD_COST;

  return `
    <div class="tribe-section tribe-section--active">
      <div class="tribe-header">
        <span class="tribe-icon">🏕️</span>
        <span class="tribe-title">Nomadic Tribe</span>
        <span class="tribe-timer${urgent ? ' tribe-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="tribe-desc">A nomadic tribe arrives at your borders. How do you respond?</div>
      <div class="tribe-actions">
        <button class="btn btn--tribe-accept${canAccept ? '' : ' btn--disabled'}"
                data-action="tribe-accept"
                ${canAccept ? '' : 'disabled'}
                title="${canAccept ? `Settle: −${ACCEPT_FOOD_COST} food → +80 food, +50 wood, +5 morale` : `Need ${ACCEPT_FOOD_COST} food`}">
          🤝 Accept <span class="tribe-cost">−${ACCEPT_FOOD_COST}🍞</span>
        </button>
        <button class="btn btn--tribe-hire${canHire ? '' : ' btn--disabled'}"
                data-action="tribe-hire"
                ${canHire ? '' : 'disabled'}
                title="${canHire ? `Hire: −${HIRE_GOLD_COST} gold → +0.5 gold/s for 4 min` : `Need ${HIRE_GOLD_COST} gold`}">
          ⚔️ Hire <span class="tribe-cost">−${HIRE_GOLD_COST}💰</span>
        </button>
        <button class="btn btn--tribe-refuse" data-action="tribe-refuse">
          ✕ Refuse
        </button>
      </div>
    </div>
  `;
}

// ── T241: Wandering Prophet ───────────────────────────────────────────────────────────────────────

function _prophetSection() {
  const encounter = getActiveProphetEncounter();
  if (!encounter) return '';

  const secs       = getProphetSecsLeft();
  const urgent     = secs < 20;
  const mana       = state.resources?.mana ?? 0;
  const gold       = state.resources?.gold ?? 0;
  const canHeed    = mana >= HEED_MANA_COST;
  const canTribute = gold >= TRIBUTE_GOLD_COST;

  return `
    <div class="prophet-section prophet-section--active">
      <div class="prophet-header">
        <span class="prophet-icon">🔮</span>
        <span class="prophet-title">Wandering Prophet</span>
        <span class="prophet-timer${urgent ? ' prophet-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="prophet-desc">A wandering prophet stands at your gates bearing divine wisdom. How do you respond?</div>
      <div class="prophet-actions">
        <button class="btn btn--prophet-heed${canHeed ? '' : ' btn--disabled'}"
                data-action="prophet-heed"
                ${canHeed ? '' : 'disabled'}
                title="${canHeed ? `Heed: −${HEED_MANA_COST} mana → +0.5 gold/s for 4 min` : `Need ${HEED_MANA_COST} mana`}">
          🌟 Heed <span class="prophet-cost">−${HEED_MANA_COST}✨</span>
        </button>
        <button class="btn btn--prophet-tribute${canTribute ? '' : ' btn--disabled'}"
                data-action="prophet-tribute"
                ${canTribute ? '' : 'disabled'}
                title="${canTribute ? `Tribute: −${TRIBUTE_GOLD_COST} gold → +80 prestige, +8 morale` : `Need ${TRIBUTE_GOLD_COST} gold`}">
          🙏 Tribute <span class="prophet-cost">−${TRIBUTE_GOLD_COST}💰</span>
        </button>
        <button class="btn btn--prophet-dismiss" data-action="prophet-dismiss">
          ✕ Dismiss
        </button>
      </div>
    </div>
  `;
}

// ── T242: Artisan Fair ────────────────────────────────────────────────────────────────────────────

function _artisanFairSection() {
  const fair = getActiveArtisanFair();
  if (!fair) return '';

  const secs          = getArtisanFairSecsLeft();
  const urgent        = secs < 20;
  const wood          = state.resources?.wood  ?? 0;
  const stone         = state.resources?.stone ?? 0;
  const food          = state.resources?.food  ?? 0;
  const canCommission = wood >= COMMISSION_WOOD_COST && stone >= COMMISSION_STONE_COST;
  const canExport     = food >= EXPORT_FOOD_COST;

  return `
    <div class="fair-section fair-section--active">
      <div class="fair-header">
        <span class="fair-icon">🎪</span>
        <span class="fair-title">Artisan Fair</span>
        <span class="fair-timer${urgent ? ' fair-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="fair-desc">Local artisans display their crafts in your market square. How do you engage?</div>
      <div class="fair-actions">
        <button class="btn btn--fair-commission${canCommission ? '' : ' btn--disabled'}"
                data-action="fair-commission"
                ${canCommission ? '' : 'disabled'}
                title="${canCommission ? `Commission: −${COMMISSION_WOOD_COST} wood −${COMMISSION_STONE_COST} stone → +150 gold, +10 morale` : `Need ${COMMISSION_WOOD_COST} wood + ${COMMISSION_STONE_COST} stone`}">
          🏺 Commission <span class="fair-cost">−${COMMISSION_WOOD_COST}🪵−${COMMISSION_STONE_COST}🪨</span>
        </button>
        <button class="btn btn--fair-export${canExport ? '' : ' btn--disabled'}"
                data-action="fair-export"
                ${canExport ? '' : 'disabled'}
                title="${canExport ? `Export: −${EXPORT_FOOD_COST} food → +100 wood, +80 stone, +30 prestige` : `Need ${EXPORT_FOOD_COST} food`}">
          📦 Export <span class="fair-cost">−${EXPORT_FOOD_COST}🍞</span>
        </button>
        <button class="btn btn--fair-decline" data-action="fair-decline">
          ✕ Decline
        </button>
      </div>
    </div>
  `;
}

// ── T244: Cosmic Alignment ──────────────────────────────────────────────────────────────────────────

function _cosmicAlignmentSection() {
  const alignment = getActiveAlignment();
  if (!alignment) return '';

  const secs       = getAlignmentSecsLeft();
  const urgent     = secs < 20;
  const mana       = state.resources?.mana ?? 0;
  const canRitual  = mana >= RITUAL_MANA_COST;

  return `
    <div class="cosmic-section cosmic-section--active">
      <div class="cosmic-header">
        <span class="cosmic-icon">${alignment.icon}</span>
        <span class="cosmic-title">${alignment.name}</span>
        <span class="cosmic-timer${urgent ? ' cosmic-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="cosmic-desc">${alignment.desc}</div>
      <div class="cosmic-actions">
        <button class="btn btn--cosmic-observe"
                data-action="align-observe"
                title="Observe: free → +20 prestige, reveal 3 tiles">
          🔭 Observe <span class="cosmic-cost">free → +20 prestige, 3 tiles</span>
        </button>
        <button class="btn btn--cosmic-ritual${canRitual ? '' : ' btn--disabled'}"
                data-action="align-ritual"
                ${canRitual ? '' : 'disabled'}
                title="${canRitual ? `Ritual: −${RITUAL_MANA_COST} mana → +${RITUAL_PRESTIGE} prestige, +${RITUAL_MORALE} morale` : `Need ${RITUAL_MANA_COST} mana`}">
          🕯️ Ritual <span class="cosmic-cost">−${RITUAL_MANA_COST}✨</span>
        </button>
        <button class="btn btn--cosmic-ignore" data-action="align-ignore">
          ✕ Ignore
        </button>
      </div>
    </div>
  `;
}

function _tributeCaravanSection() {
  const caravan = getActiveTributeCaravan();
  if (!caravan) return '';

  const secs   = getTributeCaravanSecsLeft();
  const urgent = secs < 20;

  const optionCards = caravan.options.map((opt, idx) => {
    const rewardStr = Object.entries(opt.reward)
      .map(([r, a]) => `+${a} ${r}`)
      .join(', ');
    return `
      <button class="btn btn--tribute-option" data-action="tribute-claim" data-idx="${idx}">
        <span class="tribute-option__icon">${opt.icon}</span>
        <span class="tribute-option__body">
          <span class="tribute-option__title">${opt.title}</span>
          <span class="tribute-option__reward">${rewardStr}</span>
        </span>
      </button>`;
  }).join('');

  return `
    <div class="tribute-section tribute-section--active">
      <div class="tribute-header">
        <span class="tribute-icon">🐪</span>
        <span class="tribute-title">Village Tribute Caravan</span>
        <span class="tribute-timer${urgent ? ' tribute-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="tribute-desc">Villagers from the outer settlements have sent tribute to your capital. Choose one gift to accept.</div>
      <div class="tribute-options">${optionCards}</div>
    </div>`;
}

// ── Ancient Ore Vein section (T247) ──────────────────────────────────────────────────────────────────

function _oreVeinSection() {
  const vein = getActiveOreVein();
  if (!vein) return '';

  const secs   = getOreVeinSecsLeft();
  const urgent = secs < 20;

  const canAffordCommission = (state.resources?.gold ?? 0) >= COMMISSION_GOLD_COST;
  const commissionClass = canAffordCommission ? 'btn btn--ore-commission' : 'btn btn--ore-commission btn--disabled';

  return `
    <div class="ore-section ore-section--active">
      <div class="ore-header">
        <span class="ore-icon">⛏️</span>
        <span class="ore-title">Ancient Ore Vein Discovered!</span>
        <span class="ore-timer${urgent ? ' ore-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="ore-desc">Imperial miners have struck a rich ancient ore vein deep beneath your territory. How will you proceed?</div>
      <div class="ore-actions">
        <button class="btn btn--ore-mine" data-action="ore-mine">
          ⛏️ Mine Intensively
          <span class="ore-cost">Free · +${MINE_IRON_REWARD} iron, +${MINE_STONE_REWARD} stone, ${MINE_MORALE_PENALTY} morale</span>
        </button>
        <button class="${commissionClass}" data-action="ore-commission"
                title="${canAffordCommission ? `Commission expert miners (${COMMISSION_GOLD_COST}💰)` : `Need ${COMMISSION_GOLD_COST} gold`}">
          👷 Commission Miners
          <span class="ore-cost">${COMMISSION_GOLD_COST}💰 · +${COMMISSION_IRON_REWARD} iron, +${COMMISSION_STONE_REWARD} stone, +${COMMISSION_PRESTIGE} prestige</span>
        </button>
        <button class="btn btn--ore-seal" data-action="ore-seal">
          🚫 Seal It
        </button>
      </div>
    </div>`;
}

// ── Wandering Herbalist section (T248) ─────────────────────────────────────────────────────────────────────

function _herbalistSection() {
  const herbalist = getActiveHerbalist();
  if (!herbalist) return '';

  const secs   = getHerbalistSecsLeft();
  const urgent = secs < 20;

  const canAffordPurchase = (state.resources?.gold ?? 0) >= PURCHASE_GOLD_COST;
  const canAffordLearn    = (state.resources?.mana ?? 0) >= LEARN_MANA_COST;
  const purchaseClass = canAffordPurchase ? 'btn btn--herb-purchase' : 'btn btn--herb-purchase btn--disabled';
  const learnClass    = canAffordLearn    ? 'btn btn--herb-learn'    : 'btn btn--herb-learn btn--disabled';

  return `
    <div class="herb-section herb-section--active">
      <div class="herb-header">
        <span class="herb-icon">🌿</span>
        <span class="herb-title">Wandering Herbalist</span>
        <span class="herb-timer${urgent ? ' herb-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="herb-desc">A wandering herbalist has arrived at the gates bearing natural remedies and ancient cultivation knowledge.</div>
      <div class="herb-actions">
        <button class="${purchaseClass}" data-action="herbalist-purchase"
                title="${canAffordPurchase ? `Purchase remedies (${PURCHASE_GOLD_COST}💰)` : `Need ${PURCHASE_GOLD_COST} gold`}">
          🌿 Purchase Remedies
          <span class="herb-cost">${PURCHASE_GOLD_COST}💰 · +${PURCHASE_FOOD_REWARD} food, +${PURCHASE_MORALE} morale</span>
        </button>
        <button class="${learnClass}" data-action="herbalist-learn"
                title="${canAffordLearn ? `Learn techniques (${LEARN_MANA_COST}✨)` : `Need ${LEARN_MANA_COST} mana`}">
          📖 Learn Techniques
          <span class="herb-cost">${LEARN_MANA_COST}✨ · +${LEARN_FOOD_RATE} food/s for 3 min</span>
        </button>
        <button class="btn btn--herb-away" data-action="herbalist-away">
          🚶 Send Away
        </button>
      </div>
    </div>`;
}

// ── Traveling Circus section (T249) ─────────────────────────────────────────

function _circusSection() {
  const circus = getActiveCircus();
  if (!circus) return '';

  const secs   = getCircusSecsLeft();
  const urgent = secs < 20;

  const canAffordShow    = (state.resources?.gold ?? 0) >= SHOW_GOLD_COST;
  const canAffordRecruit = (state.resources?.gold ?? 0) >= RECRUIT_GOLD_COST;
  const showClass    = canAffordShow    ? 'btn btn--circus-show'    : 'btn btn--circus-show btn--disabled';
  const recruitClass = canAffordRecruit ? 'btn btn--circus-recruit' : 'btn btn--circus-recruit btn--disabled';

  return `
    <div class="circus-section circus-section--active">
      <div class="circus-header">
        <span class="circus-icon">🎪</span>
        <span class="circus-title">Traveling Circus</span>
        <span class="circus-timer${urgent ? ' circus-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="circus-desc">A colorful traveling circus has arrived at the empire gates with acrobats, exotic animals, and dazzling performers!</div>
      <div class="circus-actions">
        <button class="${showClass}" data-action="circus-show"
                title="${canAffordShow ? `Welcome Show (${SHOW_GOLD_COST}💰)` : `Need ${SHOW_GOLD_COST} gold`}">
          🎪 Welcome Show
          <span class="circus-cost">${SHOW_GOLD_COST}💰 · +${SHOW_MORALE_REWARD} morale, +${SHOW_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="${recruitClass}" data-action="circus-recruit"
                title="${canAffordRecruit ? `Recruit Performers (${RECRUIT_GOLD_COST}💰)` : `Need ${RECRUIT_GOLD_COST} gold`}">
          🤹 Recruit Performers
          <span class="circus-cost">${RECRUIT_GOLD_COST}💰 · +${RECRUIT_MORALE_REWARD} morale, +${RECRUIT_FOOD_RATE} food/s for 2 min</span>
        </button>
        <button class="btn btn--circus-dismiss" data-action="circus-dismiss">
          👋 Dismiss Circus
        </button>
      </div>
    </div>`;
}

// ── Sacred Spring Discovery section (T250) ───────────────────────────────────

function _sacredSpringSection() {
  const spring = getActiveSacredSpring();
  if (!spring) return '';

  const secs   = getSacredSpringSecsLeft();
  const urgent = secs < 20;

  const canAffordBless = (state.resources?.mana ?? 0) >= BLESS_MANA_COST;
  const blessClass = canAffordBless ? 'btn btn--spring-bless' : 'btn btn--spring-bless btn--disabled';

  return `
    <div class="spring-section spring-section--active">
      <div class="spring-header">
        <span class="spring-icon">🌊</span>
        <span class="spring-title">Sacred Spring Discovery</span>
        <span class="spring-timer${urgent ? ' spring-timer--urgent' : ''}">${secs}s</span>
      </div>
      <div class="spring-desc">Scouts have discovered a sacred spring hidden within the empire's territory. Its waters are said to carry divine blessings from the gods.</div>
      <div class="spring-actions">
        <button class="${blessClass}" data-action="spring-bless"
                title="${canAffordBless ? `Bless the Waters (${BLESS_MANA_COST}✨)` : `Need ${BLESS_MANA_COST} mana`}">
          🌊 Bless the Waters
          <span class="spring-cost">${BLESS_MANA_COST}✨ · +${BLESS_FOOD_REWARD} food, +${BLESS_MORALE_REWARD} morale, +${BLESS_PRESTIGE_REWARD} prestige</span>
        </button>
        <button class="btn btn--spring-sell" data-action="spring-sell"
                title="Sell water rights to merchants (−${SELL_PRESTIGE_COST} prestige)">
          💰 Sell Water Rights
          <span class="spring-cost">−${SELL_PRESTIGE_COST} prestige · +${SELL_GOLD_REWARD} gold</span>
        </button>
        <button class="btn btn--spring-protect" data-action="spring-protect">
          🌿 Protect the Spring
          <span class="spring-cost">Free · +${PROTECT_MORALE_REWARD} morale, +${PROTECT_PRESTIGE_REWARD} prestige</span>
        </button>
      </div>
    </div>`;
}
