'use strict';

(() => {
  function createGamePaneHeader({
    account,
    webview,
    isMarket,
    createElement,
    selectAccount,
    setTab,
    getZoom,
    adjustZoom,
    setZoom,
    openCockpit,
    focusAccount,
    reloadWebview,
  }) {
    const el = createElement;
    return el('div', {
      class: 'game-pane-header',
      onclick: () => {
        selectAccount(account.id);
        setTab('game');
      },
    },
      el('div', { class: 'game-pane-info' },
        el('span', { class: 'game-pane-dot' }),
        el('span', { class: 'icon-svg icon-game game-pane-icon' }),
        el('span', { class: 'game-pane-name', text: account.name || 'Conta' }),
        isMarket ? el('span', { class: 'game-pane-tag', text: 'Principal' }) : null
      ),
      el('div', { class: 'game-pane-actions' },
        el('div', { class: 'game-pane-zoom-group', title: 'Ajuste de escala (Ctrl + - / Ctrl + + / Ctrl + Scroll)' },
          el('button', {
            class: 'game-pane-zoom-btn',
            title: 'Diminuir escala desta conta',
            onclick: (event) => {
              event.stopPropagation();
              adjustZoom(account.id, -0.05);
            },
          }, '−'),
          el('span', {
            class: 'game-pane-zoom-level',
            text: `${Math.round(getZoom(account.id) * 100)}%`,
            title: 'Clique para restaurar escala padrão de 100%',
            onclick: (event) => {
              event.stopPropagation();
              setZoom(account.id, 1.0);
            },
          }),
          el('button', {
            class: 'game-pane-zoom-btn',
            title: 'Aumentar escala desta conta',
            onclick: (event) => {
              event.stopPropagation();
              adjustZoom(account.id, 0.05);
            },
          }, '+')
        ),
        el('button', {
          class: 'game-pane-btn sniper',
          title: 'Abrir Cockpit Sniper desta conta',
          onclick: (event) => {
            event.stopPropagation();
            openCockpit(account.id, account.name);
          },
        }, el('span', { class: 'icon-svg icon-target' }), ' Sniper'),
        el('button', {
          class: 'game-pane-btn focus',
          title: 'Focar nesta conta em tela cheia',
          onclick: (event) => {
            event.stopPropagation();
            focusAccount(account.id);
          },
        }, el('span', { class: 'icon-svg icon-single' }), ' Focar'),
        el('button', {
          class: 'game-pane-btn reload',
          title: 'Recarregar esta conta',
          onclick: (event) => {
            event.stopPropagation();
            reloadWebview(webview);
          },
        }, el('span', { class: 'icon-svg icon-reload' }))
      )
    );
  }

  const api = Object.freeze({ createGamePaneHeader });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleGamePaneView = api;
})();
