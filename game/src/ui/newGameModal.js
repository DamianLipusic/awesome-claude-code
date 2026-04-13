/**
 * EmpireOS — New Game Wizard Modal.
 *
 * Presents a styled modal for configuring a new game:
 *   1. Empire name
 *   2. Difficulty (Easy / Normal / Hard)
 *   3. Archetype (Standard / Conqueror / Merchant / Arcane)
 *
 * Public API:
 *   showNewGameWizard(currentDifficulty, currentArchetype, onConfirm)
 *     Opens the modal. Calls onConfirm({ name, difficulty, archetype }) on submit.
 */

import { ARCHETYPES, ARCHETYPE_ORDER } from '../data/archetypes.js';

const MODAL_ID = 'new-game-modal';

const DIFF_DESCS = {
  easy:   '🌿 Bonus starting resources, weaker raids, slower enemy AI.',
  normal: '⚔️ Standard challenge — recommended for new players.',
  hard:   '💀 Reduced start, stronger raids, aggressive enemy AI.',
};

let _onConfirm = null;

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Open the wizard modal.
 * @param {string}   currentDifficulty  Active difficulty ('easy'|'normal'|'hard').
 * @param {string}   currentArchetype   Active archetype id.
 * @param {function} onConfirm          Called with { name, difficulty, archetype } on submit.
 */
export function showNewGameWizard(currentDifficulty, currentArchetype, onConfirm) {
  _onConfirm = onConfirm;

  let el = document.getElementById(MODAL_ID);
  if (!el) {
    el = _create();
    document.body.appendChild(el);
    _bindEvents(el);
  }

  // Reset name field each open
  const nameInput = el.querySelector('#ng-name');
  if (nameInput) nameInput.value = '';

  // Pre-select current difficulty
  const diff = currentDifficulty ?? 'normal';
  el.querySelectorAll('[data-diff]').forEach(btn => {
    btn.classList.toggle('btn--difficulty-active', btn.dataset.diff === diff);
  });
  const diffDescEl = el.querySelector('#ng-diff-desc');
  if (diffDescEl) diffDescEl.textContent = DIFF_DESCS[diff] ?? '';

  // Pre-select current archetype
  const arch = currentArchetype ?? 'none';
  el.querySelectorAll('[data-arch]').forEach(btn => {
    btn.classList.toggle('btn--arch-active', btn.dataset.arch === arch);
  });
  const archDescEl = el.querySelector('#ng-arch-desc');
  if (archDescEl) archDescEl.textContent = ARCHETYPES[arch]?.desc ?? '';

  _show(el);
  nameInput?.focus();
}

// ── Internal helpers ──────────────────────────────────────────────────────

function _create() {
  const archButtons = ARCHETYPE_ORDER.map(id => {
    const a = ARCHETYPES[id];
    return `<button class="btn btn--arch" data-arch="${id}">${a.icon} ${a.name}</button>`;
  }).join('');

  const el = document.createElement('div');
  el.id = MODAL_ID;
  el.className = 'modal-overlay modal--hidden';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.innerHTML = `
    <div class="modal-box ng-modal-box">
      <div class="modal-header">
        <span class="modal-title">⚔️ Found Your Empire</span>
        <button class="modal-close" id="ng-close" aria-label="Close">✕</button>
      </div>
      <div class="modal-body">
        <div class="ng-field">
          <label class="ng-label" for="ng-name">Empire Name</label>
          <input
            id="ng-name"
            class="ng-input"
            type="text"
            maxlength="40"
            placeholder="My Empire"
            autocomplete="off"
            spellcheck="false"
          />
        </div>
        <div class="ng-field">
          <label class="ng-label">Difficulty</label>
          <div class="difficulty-buttons">
            <button class="btn btn--difficulty" data-diff="easy">🌿 Easy</button>
            <button class="btn btn--difficulty" data-diff="normal">⚔️ Normal</button>
            <button class="btn btn--difficulty" data-diff="hard">💀 Hard</button>
          </div>
          <div class="ng-diff-desc" id="ng-diff-desc"></div>
        </div>
        <div class="ng-field">
          <label class="ng-label">Empire Archetype</label>
          <div class="arch-buttons">
            ${archButtons}
          </div>
          <div class="ng-arch-desc" id="ng-arch-desc"></div>
          <div class="ng-arch-bonuses" id="ng-arch-bonuses"></div>
        </div>
        <p class="ng-warning">⚠️ Starting a new game will erase your current progress.</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn--ng-start" id="ng-start">⚔️ Found Empire</button>
        <button class="btn btn--ghost" id="ng-cancel">Cancel</button>
      </div>
    </div>
  `;
  return el;
}

function _bindEvents(el) {
  const hide = () => _hide(el);

  el.querySelector('#ng-close').addEventListener('click', hide);
  el.querySelector('#ng-cancel').addEventListener('click', hide);
  el.addEventListener('click', e => { if (e.target === el) hide(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !el.classList.contains('modal--hidden')) hide();
  });

  // Difficulty buttons
  el.querySelectorAll('[data-diff]').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('[data-diff]').forEach(b => b.classList.remove('btn--difficulty-active'));
      btn.classList.add('btn--difficulty-active');
      const descEl = el.querySelector('#ng-diff-desc');
      if (descEl) descEl.textContent = DIFF_DESCS[btn.dataset.diff] ?? '';
    });
  });

  // Archetype buttons
  el.querySelectorAll('[data-arch]').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('[data-arch]').forEach(b => b.classList.remove('btn--arch-active'));
      btn.classList.add('btn--arch-active');
      const archId  = btn.dataset.arch;
      const archDef = ARCHETYPES[archId];
      const descEl   = el.querySelector('#ng-arch-desc');
      const bonusEl  = el.querySelector('#ng-arch-bonuses');
      if (descEl)  descEl.textContent  = archDef?.desc ?? '';
      if (bonusEl) bonusEl.innerHTML   = (archDef?.bonusLines ?? [])
        .map(b => `<div class="ng-arch-bonus-line">✦ ${b}</div>`)
        .join('');
    });
  });

  el.querySelector('#ng-start').addEventListener('click', () => _submit(el));
  el.querySelector('#ng-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') _submit(el);
  });
}

function _submit(el) {
  const nameInput  = el.querySelector('#ng-name');
  const name       = (nameInput?.value ?? '').trim() || 'My Empire';
  const activeBtn  = el.querySelector('[data-diff].btn--difficulty-active');
  const difficulty = activeBtn?.dataset.diff ?? 'normal';
  const archBtn    = el.querySelector('[data-arch].btn--arch-active');
  const archetype  = archBtn?.dataset.arch ?? 'none';
  _hide(el);
  if (_onConfirm) _onConfirm({ name, difficulty, archetype });
}

function _show(el) { el.classList.remove('modal--hidden'); }
function _hide(el) { el.classList.add('modal--hidden'); }
