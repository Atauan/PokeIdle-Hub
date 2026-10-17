'use strict';

(() => {
  const status = document.getElementById('update-status');
  const check = document.getElementById('check-updates');
  const open = document.getElementById('open-update');
  const dialog = document.getElementById('update-dialog');
  const dismiss = document.getElementById('dismiss-update');
  const error = document.getElementById('update-error');

  const btnDownload = document.getElementById('btn-download-update');
  const btnCancel = document.getElementById('btn-cancel-download');
  const btnInstall = document.getElementById('btn-install-update');
  const btnOpenFolder = document.getElementById('btn-open-folder');
  const btnQuitHub = document.getElementById('btn-quit-hub');

  const progressContainer = document.getElementById('update-progress-container');
  const progressFill = document.getElementById('update-progress-fill');
  const progressText = document.getElementById('update-progress-text');
  const progressBytes = document.getElementById('update-progress-bytes');

  const completeContainer = document.getElementById('update-complete-container');
  const portableNotice = document.getElementById('update-portable-notice');
  const setupNotice = document.getElementById('update-setup-notice');

  const storageKey = 'pf.shownUpdateDialogs';
  let shown = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved)) shown = new Set(saved.filter(v => typeof v === 'string'));
  } catch (_) { /* mantém em memória */ }

  let downloadedFilePath = null;
  let isDownloading = false;

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

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function resetDialogState() {
    isDownloading = false;
    downloadedFilePath = null;
    if (progressContainer) progressContainer.hidden = true;
    if (completeContainer) completeContainer.hidden = true;
    if (portableNotice) portableNotice.hidden = true;
    if (setupNotice) setupNotice.hidden = true;
    if (btnCancel) btnCancel.hidden = true;
    if (btnInstall) btnInstall.hidden = true;
    if (btnOpenFolder) btnOpenFolder.hidden = true;
    if (btnQuitHub) btnQuitHub.hidden = true;
    if (error) error.hidden = true;
  }

  function render(state) {
    if (!state) return;
    const versionEl = document.getElementById('app-version');
    if (versionEl && state.currentVersion) versionEl.textContent = `PokeIdle Hub v${state.currentVersion}`;
    document.getElementById('update-title').textContent = state.release ? 'Nova versão disponível' : 'Atualizações do PokeIdle Hub';

    status.textContent = state.release
      ? `A versão ${state.release.version} já está disponível. Você está usando a ${state.currentVersion}.${state.status === 'error' ? ' A consulta está indisponível no momento, mas você pode baixar a versão encontrada.' : ''}`
      : messages[state.status] || '';

    if (!isDownloading && !downloadedFilePath) {
      if (btnDownload) btnDownload.hidden = !state.release;
      if (open) open.hidden = !state.release;
      if (dismiss) {
        dismiss.hidden = false;
        dismiss.textContent = state.release ? 'Agora não' : 'Fechar';
      }
    }

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

  if (window.pf?.onDownloadProgress) {
    window.pf.onDownloadProgress((data) => {
      if (!isDownloading) return;
      if (progressFill) progressFill.style.width = `${data.percent || 0}%`;
      if (progressText) progressText.textContent = `Baixando… ${data.percent || 0}%`;
      if (progressBytes) {
        const cur = formatBytes(data.downloadedBytes);
        const tot = formatBytes(data.totalBytes);
        progressBytes.textContent = tot ? `${cur} / ${tot}` : cur;
      }
    });
  }

  if (btnDownload) {
    btnDownload.addEventListener('click', async () => {
      resetDialogState();
      isDownloading = true;
      if (btnDownload) btnDownload.hidden = true;
      if (open) open.hidden = true;
      if (dismiss) dismiss.hidden = true;
      if (btnCancel) btnCancel.hidden = false;
      if (progressContainer) progressContainer.hidden = false;
      if (progressFill) progressFill.style.width = '0%';
      if (progressText) progressText.textContent = 'Iniciando download…';
      if (progressBytes) progressBytes.textContent = '';
      if (error) error.hidden = true;

      try {
        const res = await window.pf.downloadUpdate();
        isDownloading = false;
        if (progressContainer) progressContainer.hidden = true;
        if (btnCancel) btnCancel.hidden = true;

        if (res && res.ok && res.filePath) {
          downloadedFilePath = res.filePath;
          if (completeContainer) completeContainer.hidden = false;

          if (res.isPortable) {
            if (portableNotice) portableNotice.hidden = false;
            if (setupNotice) setupNotice.hidden = true;
            if (btnOpenFolder) btnOpenFolder.hidden = false;
            if (btnQuitHub) btnQuitHub.hidden = false;
            if (dismiss) {
              dismiss.hidden = false;
              dismiss.textContent = 'Fechar';
            }
            status.textContent = '✓ Download concluído! Arquivo salvo na pasta Downloads.';
          } else {
            if (portableNotice) portableNotice.hidden = true;
            if (setupNotice) setupNotice.hidden = false;
            if (btnInstall) btnInstall.hidden = false;
            if (dismiss) {
              dismiss.hidden = false;
              dismiss.textContent = 'Instalar depois';
            }
            status.textContent = '✓ Download concluído com sucesso!';
          }
        } else if (res?.aborted) {
          status.textContent = 'Download cancelado pelo usuário.';
          if (btnDownload) btnDownload.hidden = false;
          if (dismiss) dismiss.hidden = false;
        } else {
          throw new Error(res?.error || 'Falha ao baixar o arquivo.');
        }
      } catch (err) {
        isDownloading = false;
        if (progressContainer) progressContainer.hidden = true;
        if (btnCancel) btnCancel.hidden = true;
        if (btnDownload) btnDownload.hidden = false;
        if (dismiss) dismiss.hidden = false;
        if (error) {
          error.textContent = String(err.message || err);
          error.hidden = false;
        }
      }
    });
  }

  if (btnCancel) {
    btnCancel.addEventListener('click', async () => {
      try {
        await window.pf?.cancelDownloadUpdate();
      } catch (_) {}
      resetDialogState();
      if (btnDownload) btnDownload.hidden = false;
      if (dismiss) dismiss.hidden = false;
      if (status) status.textContent = 'Download cancelado.';
    });
  }

  if (btnInstall) {
    btnInstall.addEventListener('click', async () => {
      if (!downloadedFilePath) return;
      btnInstall.disabled = true;
      btnInstall.textContent = 'Iniciando instalador…';
      try {
        await window.pf?.installUpdate(downloadedFilePath);
      } catch (_) {
        btnInstall.disabled = false;
        btnInstall.textContent = 'Instalar e Reiniciar';
        if (error) {
          error.textContent = 'Não foi possível iniciar o instalador automaticamente. Abra o arquivo na pasta Downloads.';
          error.hidden = false;
        }
      }
    });
  }

  if (btnOpenFolder) {
    btnOpenFolder.addEventListener('click', () => {
      if (downloadedFilePath) window.pf?.showInFolder(downloadedFilePath);
    });
  }

  if (btnQuitHub) {
    btnQuitHub.addEventListener('click', () => {
      window.pf?.quitApp();
    });
  }

  if (check) {
    check.addEventListener('click', async () => {
      resetDialogState();
      showDialog();
      check.disabled = true;
      try { render(await window.pf.checkUpdates()); }
      catch (_) { if (status) status.textContent = messages.error; }
      finally { check.disabled = false; }
    });
  }

  if (dismiss) {
    dismiss.addEventListener('click', () => {
      if (isDownloading) {
        try { window.pf?.cancelDownloadUpdate(); } catch (_) {}
      }
      resetDialogState();
      dialog.close();
    });
  }

  if (dialog) {
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      if (isDownloading) {
        try { window.pf?.cancelDownloadUpdate(); } catch (_) {}
      }
      resetDialogState();
      dialog.close();
    });
  }

  if (open) {
    open.addEventListener('click', async () => {
      try {
        if (await window.pf.openUpdate()) { dialog.close(); return; }
      } catch (_) {}
      if (error) {
        error.textContent = 'Não foi possível abrir o navegador. Tente novamente.';
        error.hidden = false;
      }
    });
  }
})();
