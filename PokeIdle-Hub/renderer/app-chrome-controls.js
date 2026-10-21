'use strict';

(() => {
  function createAppChromeControls({ query, queryAll, save, load, getTab, layout, documentObject }) {
    const barIds = ['#bar', '#update-bar', '#game-actions-bar', '#lives-actions-bar'];

    function setSidebarCollapsed(collapsed) {
      const sidebar = query('#sidebar');
      const toggle = query('#sidebar-toggle');
      sidebar?.classList.toggle('collapsed', collapsed);
      if (toggle) {
        toggle.textContent = collapsed ? '▶' : '◀';
        toggle.title = collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral';
      }
      save('pf.sidebarCollapsed', collapsed);
      if (getTab() === 'lives') layout();
    }

    function setBarsCollapsed(collapsed) {
      for (const selector of barIds) query(selector)?.classList.toggle('bar-collapsed', collapsed);
      const restore = query('#bars-floating-restore');
      if (restore) restore.hidden = !collapsed;
      save('pf.barsCollapsed', collapsed);
      if (getTab() === 'lives') layout();
    }

    function bind() {
      const sidebar = query('#sidebar');
      query('#sidebar-toggle')?.addEventListener('click', () => {
        setSidebarCollapsed(!sidebar?.classList.contains('collapsed'));
      });
      if (load('pf.sidebarCollapsed', false)) setSidebarCollapsed(true);

      const bar = query('#bar');
      query('#btn-toggle-bars')?.addEventListener('click', () => {
        setBarsCollapsed(!bar?.classList.contains('bar-collapsed'));
      });
      query('#btn-collapse-topbar')?.addEventListener('click', () => setBarsCollapsed(true));
      query('#bars-floating-restore')?.addEventListener('click', () => setBarsCollapsed(false));
      if (load('pf.barsCollapsed', false)) setBarsCollapsed(true);

      documentObject.addEventListener('keydown', event => {
        if (event.key !== 'F10') return;
        event.preventDefault();
        setBarsCollapsed(!bar?.classList.contains('bar-collapsed'));
      });

      queryAll('.menu').forEach(menu => {
        menu.querySelector('.menu-btn')?.addEventListener('click', event => {
          event.stopPropagation();
          const open = !menu.classList.contains('open');
          queryAll('.menu').forEach(item => item.classList.remove('open'));
          menu.classList.toggle('open', open);
        });
        menu.querySelector('.menu-list')?.addEventListener('click', event => event.stopPropagation());
      });
      documentObject.addEventListener('click', () => queryAll('.menu').forEach(menu => menu.classList.remove('open')));
    }

    return Object.freeze({ bind, setSidebarCollapsed, setBarsCollapsed });
  }

  const api = Object.freeze({ createAppChromeControls });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleAppChromeControls = api;
})();
