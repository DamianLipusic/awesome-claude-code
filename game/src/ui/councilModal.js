/**
 * EmpireOS — Age Council Boon picker modal (T072).
 *
 * showCouncilModal(age, offer, onChoose)
 *   age      — new age index (1=Bronze, 2=Iron, 3=Medieval)
 *   offer    — array of 3 boon definition objects to display
 *   onChoose — callback(boonId) called when the player confirms a choice
 *
 * The modal is dismissed by clicking a boon card, by pressing Escape (skip),
 * or by clicking a 'Skip' button. A skip forfeits the boon for that age.
 */

import { AGES } from '../data/ages.js';

let _modalEl = null;

// ── Public API ─────────────────────────────────────────────────────────────

export function showCouncilModal(age, offer, onChoose) {
  _createModal();

  const ageDef  = AGES[age] ?? { icon: '📜', name: `Age ${age}` };
  const ageName = `${ageDef.icon} ${ageDef.name} Age`;

  _modalEl.innerHTML = `
    <div class="council-box">
      <div class="council-header">📜 Age Council</div>
      <div class="council-sub">
        Your advisors present gifts as you enter the <strong>${ageName}</strong>.
        Choose one permanent boon:
      </div>
      <div class="council-boons">
        ${offer.map(b => `
          <button class="council-boon" data-boon-id="${b.id}">
            <div class="council-boon__icon">${b.icon}</div>
            <div class="council-boon__body">
              <div class="council-boon__name">${b.name}</div>
              <div class="council-boon__desc">${b.desc}</div>
            </div>
          </button>
        `).join('')}
      </div>
      <button id="council-skip" class="btn btn--sm btn--ghost council-skip">Skip — no reward</button>
    </div>
  `;

  // Delegated click: boon selection
  _modalEl.querySelector('.council-boons').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-boon-id]');
    if (!btn) return;
    const boonId = btn.dataset.boonId;
    _hide();
    onChoose(boonId);
  });

  // Skip button
  _modalEl.querySelector('#council-skip').addEventListener('click', _hide);

  // Escape key
  const _onKey = (e) => {
    if (e.key === 'Escape') {
      document.removeEventListener('keydown', _onKey);
      _hide();
    }
  };
  document.addEventListener('keydown', _onKey);

  _modalEl.classList.remove('council-modal--hidden');
}

// ── Internal helpers ───────────────────────────────────────────────────────

function _createModal() {
  const existing = document.getElementById('council-modal');
  if (existing) { _modalEl = existing; return; }

  _modalEl = document.createElement('div');
  _modalEl.id        = 'council-modal';
  _modalEl.className = 'council-modal council-modal--hidden';
  document.body.appendChild(_modalEl);
}

function _hide() {
  _modalEl?.classList.add('council-modal--hidden');
}
