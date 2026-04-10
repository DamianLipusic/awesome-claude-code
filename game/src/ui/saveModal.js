/**
 * EmpireOS — Export / Import Save Modal.
 *
 * Provides base64-encoded JSON export and paste-to-import functionality via
 * a modal overlay.  Keeps save-payload logic local to avoid circular imports.
 *
 * Public API:
 *   initSaveModal(onImport)  — inject modal DOM, bind close handlers
 *   exportSave()             — encode current state → show copy modal
 *   importSave()             — show paste modal → decode → call onImport
 */

import { state } from '../core/state.js';

const MODAL_ID = 'save-modal';
const SAVE_VERSION = 8;

let _onImport = null;

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Mount the modal DOM and store the import callback.
 * @param {function} onImport  Called with the parsed save object on successful import.
 */
export function initSaveModal(onImport) {
  _onImport = onImport;

  const el = document.createElement('div');
  el.id = MODAL_ID;
  el.className = 'modal-overlay modal--hidden';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <span class="modal-title" id="save-modal-title"></span>
        <button class="modal-close" id="save-modal-close" aria-label="Close">✕</button>
      </div>
      <div class="modal-body">
        <p id="save-modal-desc" class="modal-desc"></p>
        <textarea
          id="save-modal-text"
          class="modal-textarea"
          spellcheck="false"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
        ></textarea>
        <div id="save-modal-error" class="modal-error" aria-live="polite"></div>
      </div>
      <div class="modal-footer">
        <button class="btn" id="save-modal-action"></button>
        <button class="btn btn--ghost" id="save-modal-cancel">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);

  document.getElementById('save-modal-close').addEventListener('click', _hide);
  document.getElementById('save-modal-cancel').addEventListener('click', _hide);
  // Click outside to close
  el.addEventListener('click', e => { if (e.target === el) _hide(); });
  // Esc to close
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !el.classList.contains('modal--hidden')) _hide();
  });
}

/**
 * Encode current state as base64 JSON and open the export modal.
 */
export function exportSave() {
  const encoded = _encode(_buildPayload());

  _openModal({
    title: '📤 Export Save',
    desc:  'Copy this code and store it somewhere safe. Paste it into "Import Save" to restore your game on any device.',
    text:  encoded,
    readOnly: true,
    actionLabel: '📋 Copy Code',
    onAction(btn) {
      const text = document.getElementById('save-modal-text').value;
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(() => _flashBtn(btn, '✓ Copied!'));
      } else {
        // Fallback for browsers without Clipboard API
        const ta = document.getElementById('save-modal-text');
        ta.select();
        document.execCommand('copy');
        _flashBtn(btn, '✓ Copied!');
      }
    },
  });
}

/**
 * Open the import modal. Decodes the pasted string and calls _onImport.
 */
export function importSave() {
  _openModal({
    title: '📥 Import Save',
    desc:  'Paste your exported save code below. WARNING: this will replace your current game progress.',
    text:  '',
    readOnly: false,
    actionLabel: '📥 Load Save',
    onAction() {
      const encoded = document.getElementById('save-modal-text').value.trim();
      const errEl   = document.getElementById('save-modal-error');
      errEl.textContent = '';

      if (!encoded) {
        errEl.textContent = '❌ Please paste a save code first.';
        return;
      }

      try {
        const save = _decode(encoded);
        if (!save || typeof save !== 'object' || !save.state) {
          throw new Error('Missing state field');
        }
        if (_onImport) _onImport(save);
        _hide();
      } catch {
        errEl.textContent = '❌ Invalid save code. Make sure you copied the full export string.';
      }
    },
  });
}

// ── Internal helpers ──────────────────────────────────────────────────────

function _openModal({ title, desc, text, readOnly, actionLabel, onAction }) {
  document.getElementById('save-modal-title').textContent = title;
  document.getElementById('save-modal-desc').textContent  = desc;

  const ta       = document.getElementById('save-modal-text');
  ta.value       = text;
  ta.readOnly    = readOnly;

  document.getElementById('save-modal-error').textContent = '';

  const btn    = document.getElementById('save-modal-action');
  btn.textContent = actionLabel;
  // Remove previous listener by replacing the node
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  newBtn.addEventListener('click', () => onAction(newBtn));

  _show();
  if (!readOnly) ta.focus();
}

function _show() {
  const el = document.getElementById(MODAL_ID);
  if (el) el.classList.remove('modal--hidden');
}

function _hide() {
  const el = document.getElementById(MODAL_ID);
  if (el) el.classList.add('modal--hidden');
}

function _flashBtn(btn, label) {
  const orig = btn.textContent;
  btn.textContent = label;
  setTimeout(() => { btn.textContent = orig; }, 2000);
}

/**
 * Build the same payload object that main.js._save() writes to localStorage.
 */
function _buildPayload() {
  return {
    version: SAVE_VERSION,
    ts: Date.now(),
    state: {
      empire:        state.empire,
      resources:     state.resources,
      rates:         state.rates,
      caps:          state.caps,
      buildings:     state.buildings,
      units:         state.units,
      techs:         state.techs,
      trainingQueue: state.trainingQueue,
      researchQueue: state.researchQueue,
      messages:      state.messages.slice(0, 20),
      map:           state.map,
      age:           state.age,
      randomEvents:  state.randomEvents,
      quests:        state.quests,
      story:         state.story,
      diplomacy:     state.diplomacy,
      season:        state.season,
      hero:          state.hero,
      stats:         state.stats,
      tick:          state.tick,
    },
  };
}

/**
 * Encode an object to a URL-safe base64 string (handles full Unicode).
 */
function _encode(obj) {
  const json = JSON.stringify(obj);
  // encodeURIComponent escapes non-ASCII chars; unescape maps %xx to raw bytes for btoa
  return btoa(unescape(encodeURIComponent(json)));
}

/**
 * Decode a base64 string back to an object.  Throws on malformed input.
 */
function _decode(str) {
  const json = decodeURIComponent(escape(atob(str)));
  return JSON.parse(json);
}
