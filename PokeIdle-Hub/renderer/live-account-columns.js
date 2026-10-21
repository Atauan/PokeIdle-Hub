'use strict';

(() => {
  function createAccountLimitControls({ el, getAccountLimits, onChangeLimit }) {
    function render(account, header, counts = {}) {
      let limitsWrap = header.querySelector('.account-col-limits');
      if (!limitsWrap) {
        limitsWrap = el('div', { class: 'account-col-limits' });
        header.append(limitsWrap);
      }
      const limits = getAccountLimits(account.id);
      const createStepper = (provider, label, value, open) => el('div', {
        class: `limit-stepper ${provider}`,
        title: `Limite ${label}: ${value} (abertas nesta conta: ${open})`,
      },
      el('span', { class: `limit-tag ${provider}`, text: provider === 'kick' ? 'K' : 'T' }),
      el('button', {
        class: 'btn-limit-step',
        'aria-label': `Diminuir limite ${label}`,
        text: '−',
        onclick: event => {
          event.stopPropagation();
          onChangeLimit(account.id, provider, -1);
        },
      }),
      el('span', { class: 'limit-val', text: String(value) }),
      el('button', {
        class: 'btn-limit-step',
        'aria-label': `Aumentar limite ${label}`,
        text: '+',
        onclick: event => {
          event.stopPropagation();
          onChangeLimit(account.id, provider, 1);
        },
      }));

      limitsWrap.replaceChildren(
        el('span', { class: 'account-col-limits-label', text: 'Máx lives:' }),
        createStepper('kick', 'Kick', limits.kick, counts.kick ?? 0),
        createStepper('twitch', 'Twitch', limits.twitch, counts.twitch ?? 0),
      );
    }

    return Object.freeze({ render });
  }

  function createLiveAccountColumns({ el, getGrid, renderBadges, renderLimits }) {
    const columns = new Map();

    function sync(accounts, visibleChannels, countsByAccount) {
      const activeAccountIds = new Set(accounts.map(account => account.id));
      for (const [accountId, column] of columns) {
        if (!activeAccountIds.has(accountId) || !visibleChannels.length) {
          column.col.remove();
          columns.delete(accountId);
        }
      }
      if (!visibleChannels.length) return;

      const grid = getGrid();
      for (const account of accounts) {
        let column = columns.get(account.id);
        if (!column) {
          const topRow = el('div', { class: 'account-col-top' },
            el('div', { class: 'account-col-info' },
              el('span', { class: 'icon-svg icon-game account-col-icon' }),
              el('span', { class: 'account-col-name', text: account.name || 'Conta' }),
            ),
            el('div', { class: 'account-col-badges' }),
          );
          const limitsRow = el('div', { class: 'account-col-limits' });
          const header = el('div', { class: 'account-col-header' }, topRow, limitsRow);
          const body = el('div', { class: 'account-col-body' });
          const col = el('div', { class: 'account-column', 'data-acc-id': account.id }, header, body);
          grid.append(col);
          column = { col, header, body };
          columns.set(account.id, column);
        } else {
          const name = column.header.querySelector('.account-col-name');
          if (name) name.textContent = account.name || 'Conta';
        }
        renderBadges(account, column.header);
        renderLimits(account, column.header, countsByAccount.get(account.id));
      }
    }

    return Object.freeze({
      get: accountId => columns.get(accountId),
      getBody: accountId => columns.get(accountId)?.body,
      getHeader: accountId => columns.get(accountId)?.header,
      sync,
      values: () => [...columns.values()],
    });
  }

  const api = { createAccountLimitControls, createLiveAccountColumns };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.PokeIdleLiveAccountColumns = api;
})();
