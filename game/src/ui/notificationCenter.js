/**
 * EmpireOS — Notification Center (T123)
 *
 * Tracks the last 25 important game events in a module-level ring buffer and
 * exposes a 🔔 bell button in the title bar. Clicking the bell toggles a
 * dropdown drawer with the event history. An unread-count badge appears on the
 * bell when new events arrive while the drawer is closed.
 *
 * Important event types tracked (subset of MESSAGE events):
 *   quest, achievement, age, raid, windfall, disaster, hero, barbarian,
 *   crisis, duel, relic, landmark, ruin, prestige, title, pioneer, siege,
 *   espionage, festival, treaty, synergy, mastery, boon, companion
 */

import { on, Events } from '../core/events.js';
import { state } from '../core/state.js';

const MAX_NOTIFICATIONS = 25;

// Types that are important enough to surface in the notification center
const TRACKED_TYPES = new Set([
  'quest', 'achievement', 'age', 'raid', 'windfall', 'disaster',
  'hero', 'barbarian', 'crisis', 'duel', 'relic', 'landmark',
  'ruin', 'prestige', 'title', 'pioneer', 'siege', 'espionage',
  'festival', 'treaty', 'synergy', 'mastery', 'boon', 'companion',
]);

const TYPE_ICON = {
  quest:       '🏆',
  achievement: '🎖️',
  age:         '⚡',
  raid:        '⚔️',
  windfall:    '💰',
  disaster:    '⚠️',
  hero:        '🦸',
  barbarian:   '💀',
  crisis:      '🆘',
  duel:        '🤺',
  relic:       '🏺',
  landmark:    '🗺️',
  ruin:        '🏛️',
  prestige:    '✨',
  title:       '👑',
  pioneer:     '🚀',
  siege:       '🔥',
  espionage:   '🕵️',
  festival:    '🎉',
  treaty:      '📜',
  synergy:     '🔗',
  mastery:     '🎓',
  boon:        '🌟',
  companion:   '🐾',
};

// Module-level state (not persisted — resets on page load / new game)
let _notifications = [];
let _unreadCount   = 0;
let _isOpen        = false;
let _bellEl        = null;
let _badgeEl       = null;
let _drawerEl      = null;
let _initialised   = false;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function initNotificationCenter() {
  if (_initialised) return;
  _initialised = true;

  _buildDOM();

  // Subscribe to all MESSAGE events and filter by type
  on(Events.MESSAGE, _onMessage);

  // Reset on new game
  on(Events.GAME_STARTED, _reset);
}

// ---------------------------------------------------------------------------
// DOM construction
// ---------------------------------------------------------------------------

function _buildDOM() {
  // Inject bell button into title bar, before the score-badge
  const scoreBadge = document.getElementById('score-badge');
  if (!scoreBadge) return;

  const bell = document.createElement('button');
  bell.id        = 'notif-bell';
  bell.className = 'notif-bell';
  bell.title     = 'Notification history';
  bell.innerHTML =
    '🔔 <span id="notif-badge" class="notif-badge notif-badge--hidden">0</span>';
  scoreBadge.parentNode.insertBefore(bell, scoreBadge);

  _bellEl  = bell;
  _badgeEl = document.getElementById('notif-badge');

  // Build the dropdown drawer, appended to body so z-index is unrestricted
  const drawer = document.createElement('div');
  drawer.id        = 'notif-drawer';
  drawer.className = 'notif-drawer notif-drawer--hidden';
  drawer.innerHTML = `
    <div class="notif-drawer__header">
      <span class="notif-drawer__title">📢 Notifications</span>
      <button class="notif-clear btn btn--xs" id="notif-clear">Clear all</button>
    </div>
    <div class="notif-list" id="notif-list">
      <div class="notif-empty">No notifications yet.</div>
    </div>
  `;
  document.body.appendChild(drawer);
  _drawerEl = drawer;

  // Event wiring
  bell.addEventListener('click', (e) => { e.stopPropagation(); _toggle(); });

  document.getElementById('notif-clear').addEventListener('click', (e) => {
    e.stopPropagation();
    _reset();
  });

  // Click outside to close
  document.addEventListener('click', () => { if (_isOpen) _close(); });
  drawer.addEventListener('click', (e) => e.stopPropagation());
}

// ---------------------------------------------------------------------------
// Event handler
// ---------------------------------------------------------------------------

function _onMessage(data) {
  if (!data || !TRACKED_TYPES.has(data.type)) return;

  _notifications.unshift({
    tick: state.tick,
    text: data.text,
    type: data.type,
    icon: TYPE_ICON[data.type] ?? '📢',
  });

  if (_notifications.length > MAX_NOTIFICATIONS) {
    _notifications.length = MAX_NOTIFICATIONS;
  }

  if (_isOpen) {
    _renderList();
  } else {
    _unreadCount++;
    _updateBadge();
  }
}

// ---------------------------------------------------------------------------
// Toggle / open / close
// ---------------------------------------------------------------------------

function _toggle() { _isOpen ? _close() : _open(); }

function _open() {
  _isOpen      = true;
  _unreadCount = 0;
  _updateBadge();
  _renderList();

  // Position the drawer below the bell button
  _positionDrawer();

  _drawerEl.classList.remove('notif-drawer--hidden');
  _bellEl.classList.add('notif-bell--open');
}

function _close() {
  _isOpen = false;
  _drawerEl.classList.add('notif-drawer--hidden');
  _bellEl.classList.remove('notif-bell--open');
}

function _positionDrawer() {
  if (!_bellEl || !_drawerEl) return;
  const rect = _bellEl.getBoundingClientRect();
  _drawerEl.style.top   = `${rect.bottom + 4}px`;
  // Align right edge of drawer with right edge of bell (or keep in viewport)
  const drawerW = 300;
  const left    = Math.max(4, Math.min(rect.right - drawerW, window.innerWidth - drawerW - 4));
  _drawerEl.style.left  = `${left}px`;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function _renderList() {
  const list = document.getElementById('notif-list');
  if (!list) return;

  if (_notifications.length === 0) {
    list.innerHTML = '<div class="notif-empty">No notifications yet.</div>';
    return;
  }

  list.innerHTML = _notifications
    .map(n => `
      <div class="notif-item notif-item--${n.type}">
        <span class="notif-icon">${n.icon}</span>
        <div class="notif-body">
          <div class="notif-text">${_esc(n.text)}</div>
          <div class="notif-time">${_relTime(n.tick)}</div>
        </div>
      </div>
    `)
    .join('');
}

function _updateBadge() {
  if (!_badgeEl) return;
  if (_unreadCount > 0) {
    _badgeEl.textContent = _unreadCount > 9 ? '9+' : String(_unreadCount);
    _badgeEl.classList.remove('notif-badge--hidden');
  } else {
    _badgeEl.classList.add('notif-badge--hidden');
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _reset() {
  _notifications = [];
  _unreadCount   = 0;
  _updateBadge();
  if (_isOpen) _renderList();
}

function _relTime(tick) {
  const delta = Math.max(0, state.tick - tick);
  if (delta < 4)   return 'just now';
  const secs = Math.floor(delta / 4);
  if (secs < 60)   return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60)   return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
