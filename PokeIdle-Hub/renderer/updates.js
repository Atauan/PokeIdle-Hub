'use strict';

(() => {
  const status = document.getElementById('update-status');
  const check = document.getElementById('check-updates');
  const open = document.getElementById('open-update');
  const dialog = document.getElementById('update-dialog');
  const dismiss = document.getElementById('dismiss-update');
  const error = document.getElementById('update-error');
  const storageKey = 'pf.shownUpdateDialogs';
  let shown = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved)) shown = new Set(saved.filter(v => typeof v === 'string'));
  } catch (_) { /* armazenamento indisponível: evita repetir nesta sessão */ }

  function showDialog() {
    if (!dialog.open) {
      error.hidden = true;
      dialog.showModal();
    }
  }

  const messages = {
    idle: 'Atualizações automáticas ligadas',
    checking: 'Verificando atualizações…',
    current: 'Você está na versão mais recente.',
    unpublished: 'Nenhuma release estável disponível.',
    error: 'Não foi possível verificar. Tente novamente mais tarde.',
  };

  function render(state) {
    if (!state) return;
    const versionEl = document.getElementById('app-version');
    if (versionEl && state.currentVersion) versionEl.textContent = `PokeIdle Hub v${state.currentVersion}`;
    document.getElementById('update-title').textContent = state.release ? 'Nova versão disponível' : 'Atualizações do PokeIdle Hub';
    status.textContent = state.release
      ? `A versão ${state.release.version} já está disponível. Você está usando a ${state.currentVersion}.${state.status === 'error' ? ' A consulta está indisponível no momento, mas você pode abrir a release já encontrada.' : ''}`
      : messages[state.status] || '';
    open.hidden = !state.release;
    dismiss.textContent = state.release ? 'Agora não' : 'Fechar';
    if (check) check.disabled = state.status === 'checking';
    if (state.release && !shown.has(state.release.version)) {
      showDialog();
      shown.add(state.release.version);
      try { localStorage.setItem(storageKey, JSON.stringify([...shown])); } catch (_) { /* mantém em memória */ }
    }
  }

  if (window.pf?.onUpdateState) {
    window.pf.onUpdateState(render);
    window.pf.updateState().then(render).catch(() => { if (status) status.textContent = messages.error; });
  }

  if (check) {
    check.addEventListener('click', async () => {
      showDialog();
      check.disabled = true;
      try { render(await window.pf.checkUpdates()); }
      catch (_) { if (status) status.textContent = messages.error; }
      finally { check.disabled = false; }
    });
  }

  if (dismiss) dismiss.addEventListener('click', () => dialog.close());
  if (dialog) {
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      dialog.close();
    });
  }

  if (open) {
    open.addEventListener('click', async () => {
      try {
        if (await window.pf.openUpdate()) { dialog.close(); return; }
      } catch (_) { /* informa no próprio modal */ }
      error.textContent = 'Não foi possível abrir o navegador. Tente novamente.';
      error.hidden = false;
    });
  }
})();
