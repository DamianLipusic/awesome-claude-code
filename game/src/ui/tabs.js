/**
 * EmpireOS — Tab switcher for main content panels.
 */

export function initTabs() {
  const tabBar = document.getElementById('tab-bar');
  if (!tabBar) return;

  tabBar.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;

    const target = btn.dataset.tab;

    // Toggle active tab button
    tabBar.querySelectorAll('[data-tab]').forEach(b =>
      b.classList.toggle('tab--active', b.dataset.tab === target)
    );

    // Toggle visible panels
    document.querySelectorAll('[data-panel]').forEach(p =>
      p.classList.toggle('panel--hidden', p.dataset.panel !== target)
    );
  });

  // Activate the first tab by default
  tabBar.querySelector('[data-tab]')?.click();
}
