'use strict';
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'assets', 'addons', 'rotom-sniper');
const itemsDb = fs.readFileSync(path.join(dir, 'items_db.js'), 'utf8');
const shinyFlowMonitor = fs.readFileSync(path.join(dir, 'shiny-flow-monitor.js'), 'utf8');
const injected = fs.readFileSync(path.join(dir, 'injected.js'), 'utf8');

const combined = [
  '// Base de Itens e Dex do Rotom',
  itemsDb,
  '// Normalização limitada dos eventos shiny observados',
  shinyFlowMonitor,
  '// Motor Injetado do Rotom (WebSocket e Auto-Snipe)',
  injected
].join('\n;\n');

const fullRunnerScript = `(function() {
  if (window.__pfRotomLoaded) return;
  window.__pfRotomLoaded = true;

  ${combined}
  ;
  // Auto-inicialização com regras salvas no localStorage da conta
  try {
    let savedRules = [];
    let savedConfig = null;
    let savedEnabled = true;
    try {
      savedRules = JSON.parse(localStorage.getItem('rotom_sniper_rules') || '[]');
      savedConfig = JSON.parse(localStorage.getItem('rotom_sniper_config') || 'null');
      const en = localStorage.getItem('rotom_sniper_enabled');
      if (en !== null) savedEnabled = JSON.parse(en);
    } catch (_) {}

    window.postMessage({
      source: 'ROTOM_POPUP',
      type: 'INIT_SNIPER',
      enabled: savedEnabled,
      rules: savedRules,
      globalConfig: savedConfig || {
        snipeAnyShiny: false,
        maxPriceShinyGold: 50000,
        maxPriceShinyGems: 0,
        maxPriceShinyDiamonds: 0,
        snipeAnyP5: false,
        maxPriceP5Gold: 100000,
        maxPriceP5Gems: 0,
        maxPriceP5Diamonds: 0,
        snipeByNote: false,
        minNote: 7.0,
        maxPriceNoteGold: 50000,
        maxPriceNoteGems: 0,
        maxPriceNoteDiamonds: 0,
        maxActiveSlots: 5
      }
    }, '*');
  } catch (_) {}
})()`;

const code = `'use strict';
// PokeIdle Hub — Injetor autocontido do addon Sniper for PokeIdle
// Totalmente embutido, injeta items_db e injected engine no World 0 da webview

function installSniperEngine() {
  if (typeof window === 'undefined' || !/(^|\\.)pokeidle\\.io$/.test(window.location.hostname)) return;

  const runner = ${JSON.stringify(fullRunnerScript)};

  try {
    if (typeof process !== 'undefined' && process.versions?.electron && typeof require === 'function') {
      const { webFrame } = require('electron');
      if (webFrame && typeof webFrame.executeJavaScriptInIsolatedWorld === 'function') {
        webFrame.executeJavaScriptInIsolatedWorld(0, [{ code: runner }]).catch((err) => {
          console.error('[Sniper Addon] Erro ao injetar no World 0:', err);
        });
      } else if (webFrame && typeof webFrame.executeJavaScript === 'function') {
        webFrame.executeJavaScript(runner).catch((err) => {
          console.error('[Sniper Addon] Erro ao injetar runner:', err);
        });
      }
    } else {
      const fn = new Function(runner);
      fn();
    }
  } catch (e) {
    console.error('[Sniper Addon] Falha na injeção:', e);
  }

  // Ponte de comunicação: escuta mensagens do injected.js (World 0 -> Preload -> Host)
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== 'ROTOM_SNIPER') return;
    try {
      if (typeof require === 'function') {
        const { ipcRenderer } = require('electron');
        ipcRenderer.sendToHost('rotom-msg', event.data);
      }
    } catch (_) {}
  });

  // Escuta comandos vindos do Host (Host -> Preload -> World 0)
  try {
    if (typeof require === 'function') {
      const { ipcRenderer } = require('electron');
      ipcRenderer.on('rotom-cmd', (_event, cmd) => {
        if (!cmd || typeof cmd !== 'object') return;

        // Se for STORAGE_SET, também persiste no localStorage local do jogo
        if (cmd.type === 'STORAGE_SET' && cmd.data) {
          try {
            if (cmd.data.rotom_sniper_rules !== undefined) localStorage.setItem('rotom_sniper_rules', JSON.stringify(cmd.data.rotom_sniper_rules));
            if (cmd.data.rotom_sniper_config !== undefined) localStorage.setItem('rotom_sniper_config', JSON.stringify(cmd.data.rotom_sniper_config));
            if (cmd.data.rotom_sniper_enabled !== undefined) localStorage.setItem('rotom_sniper_enabled', JSON.stringify(cmd.data.rotom_sniper_enabled));
          } catch (_) {}

          if (cmd.data.rotom_sniper_enabled !== undefined) {
            window.postMessage({ source: 'ROTOM_POPUP', type: 'SET_SNIPER_ENABLED', enabled: Boolean(cmd.data.rotom_sniper_enabled) }, '*');
          }
          if (cmd.data.rotom_sniper_rules !== undefined) {
            window.postMessage({ source: 'ROTOM_POPUP', type: 'UPDATE_SNIPER_RULES', rules: cmd.data.rotom_sniper_rules }, '*');
          }
          if (cmd.data.rotom_sniper_config !== undefined) {
            window.postMessage({ source: 'ROTOM_POPUP', type: 'UPDATE_SNIPER_CONFIG', config: cmd.data.rotom_sniper_config }, '*');
          }
          if (cmd.data.rotom_action_fetch_oferendas) {
            const req = cmd.data.rotom_action_fetch_oferendas;
            window.postMessage({ source: 'ROTOM_POPUP', type: 'FETCH_OFERENDA_CANDIDATES', maxNota: req.maxNota, elemento: req.elemento }, '*');
          }
          if (cmd.data.rotom_action_execute_oferendas) {
            const req = cmd.data.rotom_action_execute_oferendas;
            window.postMessage({ source: 'ROTOM_POPUP', type: 'EXECUTE_OFERENDA_BATCH', pokemonIds: req.pokemonIds, pacingMs: req.pacingMs }, '*');
          }
          return;
        }

        // Se tiver action (chrome.runtime / tabs.sendMessage)
        if (cmd.action) {
          const type = cmd.action;
          window.postMessage({ source: 'ROTOM_POPUP', type, ...cmd }, '*');
          return;
        }

        window.postMessage({ source: 'ROTOM_POPUP', ...cmd }, '*');
      });
    }
  } catch (_) {}

  // Solicita estado inicial ao Host assim que a página estiver pronta
  const reqInit = () => {
    try {
      if (typeof require === 'function') {
        const { ipcRenderer } = require('electron');
        ipcRenderer.sendToHost('rotom-init-request');
      }
    } catch (_) {}
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', reqInit, { once: true });
  } else {
    setTimeout(reqInit, 500);
  }
}

if (typeof window !== 'undefined' && /(^|\\.)pokeidle\\.io$/.test(window.location.hostname)) {
  installSniperEngine();
}

if (typeof module !== 'undefined') {
  module.exports = { installSniperEngine };
}
`;

const dest = path.join(__dirname, '..', 'rotom-addon.js');
fs.writeFileSync(dest, code, 'utf8');
console.log('rotom-addon.js generated successfully. Size:', code.length);
