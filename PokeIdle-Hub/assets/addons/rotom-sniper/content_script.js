// PokéIdle Rotom Sniper - Content Script v1.4.3
// Faz a ponte entre a página oficial (injected.js) e o Cockpit/Background

(function() {
  console.log('[PokéIdle Rotom Sniper]: Inicializando Content Script v1.4.3...');

  // Verifica com segurança se o contexto da extensão ainda está ativo no Chrome
  function isExtensionContextValid() {
    try {
      return Boolean(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  // Wrapper seguro para leitura do chrome.storage.local
  function safeStorageGet(keys, callback) {
    if (!isExtensionContextValid()) return;
    try {
      chrome.storage.local.get(keys, (res) => {
        try {
          if (!isExtensionContextValid()) return;
          if (chrome.runtime && chrome.runtime.lastError) return;
          if (callback) callback(res || {});
        } catch (err) {}
      });
    } catch (err) {}
  }

  // Wrapper seguro para escrita no chrome.storage.local
  function safeStorageSet(data, callback) {
    if (!isExtensionContextValid()) return;
    try {
      chrome.storage.local.set(data, () => {
        try {
          if (!isExtensionContextValid()) return;
          if (chrome.runtime && chrome.runtime.lastError) return;
          if (callback) callback();
        } catch (err) {}
      });
    } catch (err) {}
  }

  function injectScript(file, callback) {
    if (!isExtensionContextValid()) return;
    try {
      const s = document.createElement('script');
      s.src = chrome.runtime.getURL(file);
      s.onload = function() {
        if (callback) callback();
      };
      (document.head || document.documentElement).appendChild(s);
    } catch (err) {}
  }

  // Injeta os helpers antes do hook do jogo para manter a ordem determinística.
  injectScript('items_db.js', () => {
    injectScript('shiny-flow-monitor.js', () => {
      injectScript('injected.js', () => {
        safeStorageGet(['rotom_sniper_rules', 'rotom_sniper_config', 'rotom_sniper_enabled'], (res) => {
          window.postMessage({
            source: 'ROTOM_POPUP',
            type: 'INIT_SNIPER',
            enabled: res.rotom_sniper_enabled !== undefined ? Boolean(res.rotom_sniper_enabled) : true,
            rules: res.rotom_sniper_rules || [],
            globalConfig: res.rotom_sniper_config || {
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
        });
      });
    });
  });

  // Escuta mensagens do injected.js com auto-desvinculação quando o contexto for invalidado
  function handleWindowMessage(event) {
    if (event.source !== window || !event.data || event.data.source !== 'ROTOM_SNIPER') return;

    // Se o contexto da extensão foi descarregado/recarregado no Chrome, desvincula o listener imediatamente
    if (!isExtensionContextValid()) {
      window.removeEventListener('message', handleWindowMessage);
      return;
    }

    try {
      if (event.data.type === 'SNIPER_LOG') {
        safeStorageGet(['rotom_sniper_logs'], (res) => {
          const logs = res.rotom_sniper_logs || [];
          const updatedLogs = [event.data.log, ...logs].slice(0, 100);
          safeStorageSet({ rotom_sniper_logs: updatedLogs });
        });
      } else if (event.data.type === 'SNIPER_BOUGHT') {
        const { ruleId, offerId, qty } = event.data;
        safeStorageGet(['rotom_sniper_rules'], (res) => {
          const rules = res.rotom_sniper_rules || [];
          let changed = false;
          rules.forEach(r => {
            if (r.id === ruleId) {
              r.totalBought = (r.totalBought || 0) + (qty || 1);
              changed = true;
            }
          });
          if (changed) {
            safeStorageSet({ rotom_sniper_rules: rules });
          }
        });
      } else if (event.data.type === 'BALANCE_UPDATE') {
        const { gold, diamonds, orbs } = event.data;
        const patch = {};
        if (typeof gold === 'number' && gold >= 0) patch.rotom_player_gold = gold;
        if (typeof diamonds === 'number' && diamonds >= 0) patch.rotom_player_diamonds = diamonds;
        if (typeof orbs === 'number' && orbs >= 0) patch.rotom_player_orbs = orbs;
        safeStorageSet(patch);
      } else if (event.data.type === 'VIP_STATUS_UPDATE') {
        const isVip = Boolean(event.data.isVip);
        safeStorageSet({ rotom_player_vip: isVip });
      } else if (event.data.type === 'MY_LISTINGS_UPDATE') {
        safeStorageSet({ rotom_my_listings: event.data.listings || [] });
      } else if (event.data.type === 'MARKET_CATALOG_UPDATE') {
        safeStorageSet({ rotom_market_catalog: event.data.resumo || {} });
      } else if (event.data.type === 'ITEM_OFFERS_UPDATE') {
        safeStorageSet({
          rotom_item_offers: {
            itemId: event.data.itemId,
            itemName: event.data.itemName,
            moeda: event.data.moeda,
            linhas: event.data.linhas || [],
            offers: event.data.linhas || [],
            timestamp: Date.now()
          }
        });
      } else if (event.data.type === 'DIAMOND_OFFERS_UPDATE') {
        const diamondPayload = {
          offers: event.data.offers || [],
          timestamp: Date.now()
        };
        safeStorageSet({ rotom_diamond_offers: diamondPayload });
        try {
          chrome.runtime.sendMessage({
            action: 'DIAMOND_OFFERS_UPDATE',
            offers: event.data.offers || []
          }).catch(() => {});
        } catch (e) {}
      } else if (event.data.type === 'FARM_STATS_UPDATE') {
        const stats = event.data.stats || {};
        safeStorageSet({
          rotom_farm_stats: stats,
          rotom_hunts_telemetry: stats.hunts || {}
        });
        try {
          chrome.runtime.sendMessage({
            action: 'FARM_STATS_UPDATE',
            stats: stats
          }).catch(() => {});
        } catch (e) {}
      } else if (event.data.type === 'BOSSES_UPDATE') {
        safeStorageSet({
          rotom_bosses_jogaveis: event.data.bossesJogaveis || null,
          rotom_bosses_catalogo: event.data.bossesCatalogo || null
        });
        try {
          chrome.runtime.sendMessage({
            action: 'BOSSES_UPDATE',
            bossesJogaveis: event.data.bossesJogaveis || null,
            bossesCatalogo: event.data.bossesCatalogo || null
          }).catch(() => {});
        } catch (e) {}
      } else if (event.data.type === 'OFERENDA_CANDIDATES_RESULT') {
        safeStorageSet({ rotom_oferenda_candidates: event.data });
      } else if (event.data.type === 'OFERENDA_BATCH_PROGRESS') {
        safeStorageSet({ rotom_oferenda_progress: event.data });
      } else if (event.data.type === 'OFERENDA_BATCH_COMPLETED') {
        safeStorageSet({ rotom_oferenda_completed: event.data });
      }
    } catch (err) {
      if (!isExtensionContextValid()) {
        window.removeEventListener('message', handleWindowMessage);
      }
    }
  }

  window.addEventListener('message', handleWindowMessage);

  // Sincronização reativa instantânea via chrome.storage.onChanged (funciona entre todas as janelas/abas)
  if (isExtensionContextValid() && chrome.storage && chrome.storage.onChanged) {
    try {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local' || !isExtensionContextValid()) return;

        if (changes.rotom_sniper_enabled !== undefined) {
          const enabled = Boolean(changes.rotom_sniper_enabled.newValue);
          window.postMessage({ source: 'ROTOM_POPUP', type: 'SET_SNIPER_ENABLED', enabled }, '*');
        }

        if (changes.rotom_sniper_rules !== undefined) {
          const rules = Array.isArray(changes.rotom_sniper_rules.newValue) ? changes.rotom_sniper_rules.newValue : [];
          window.postMessage({ source: 'ROTOM_POPUP', type: 'UPDATE_SNIPER_RULES', rules }, '*');
        }

        if (changes.rotom_sniper_config !== undefined) {
          const config = changes.rotom_sniper_config.newValue || {};
          window.postMessage({ source: 'ROTOM_POPUP', type: 'UPDATE_SNIPER_CONFIG', config }, '*');
        }

        if (changes.rotom_action_fetch_oferendas && changes.rotom_action_fetch_oferendas.newValue) {
          const req = changes.rotom_action_fetch_oferendas.newValue;
          window.postMessage({
            source: 'ROTOM_POPUP',
            type: 'FETCH_OFERENDA_CANDIDATES',
            maxNota: req.maxNota,
            elemento: req.elemento
          }, '*');
        }

        if (changes.rotom_action_execute_oferendas && changes.rotom_action_execute_oferendas.newValue) {
          const req = changes.rotom_action_execute_oferendas.newValue;
          window.postMessage({
            source: 'ROTOM_POPUP',
            type: 'EXECUTE_OFERENDA_BATCH',
            pokemonIds: req.pokemonIds,
            pacingMs: req.pacingMs
          }, '*');
        }
      });
    } catch (e) {}
  }

  // Escuta comandos diretos enviados via runtime.sendMessage / tabs.sendMessage
  if (isExtensionContextValid() && chrome.runtime && chrome.runtime.onMessage) {
    try {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (!isExtensionContextValid()) return;
        try {
          if (request.action === 'SET_SNIPER_ENABLED') {
            safeStorageSet({ rotom_sniper_enabled: request.enabled });
            sendResponse({ ok: true });
          } else if (request.action === 'UPDATE_SNIPER_RULES') {
            safeStorageSet({ rotom_sniper_rules: request.rules });
            sendResponse({ ok: true });
          } else if (request.action === 'UPDATE_SNIPER_CONFIG') {
            safeStorageSet({ rotom_sniper_config: request.config });
            sendResponse({ ok: true });
          } else if (request.action === 'CLEAR_SNIPER_LOGS') {
            safeStorageSet({ rotom_sniper_logs: [] });
            sendResponse({ ok: true });
          } else if (request.action === 'FETCH_MY_LISTINGS') {
            window.postMessage({ source: 'ROTOM_POPUP', type: 'FETCH_MY_LISTINGS' }, '*');
            sendResponse({ ok: true });
          } else if (request.action === 'CANCEL_MARKET_OFFER') {
            window.postMessage({ source: 'ROTOM_POPUP', type: 'CANCEL_MARKET_OFFER', offerId: request.offerId }, '*');
            sendResponse({ ok: true });
          } else if (request.action === 'FETCH_COMMUNITY_CATALOG') {
            window.postMessage({ source: 'ROTOM_POPUP', type: 'FETCH_COMMUNITY_CATALOG' }, '*');
            sendResponse({ ok: true });
          } else if (request.action === 'FETCH_ITEM_OFFERS') {
            window.postMessage({ source: 'ROTOM_POPUP', type: 'FETCH_ITEM_OFFERS', itemId: request.itemId, moeda: request.moeda }, '*');
            sendResponse({ ok: true });
          } else if (request.action === 'BUY_MANUAL_OFFER') {
            window.postMessage({
              source: 'ROTOM_POPUP',
              type: 'BUY_MANUAL_OFFER',
              offerId: request.offerId,
              qty: request.qty,
              price: request.price,
              moeda: request.moeda,
              targetName: request.targetName,
              seller: request.seller
            }, '*');
            sendResponse({ ok: true });
          } else if (request.action === 'FETCH_DIAMOND_OFFERS') {
            window.postMessage({
              source: 'ROTOM_POPUP',
              type: 'FETCH_DIAMOND_OFFERS',
              moeda: request.moeda
            }, '*');
            sendResponse({ ok: true });
          } else if (request.action === 'CREATE_MARKET_LISTING') {
            window.postMessage({
              source: 'ROTOM_POPUP',
              type: 'CREATE_MARKET_LISTING',
              tipo: request.tipo,
              itemId: request.itemId,
              pokemonId: request.pokemonId,
              qtd: request.qtd,
              preco: request.preco,
              moeda: request.moeda,
              dias: request.dias
            }, '*');
            sendResponse({ ok: true });
          } else if (request.action === 'FETCH_FARM_STATS') {
            window.postMessage({ source: 'ROTOM_POPUP', type: 'FETCH_FARM_STATS' }, '*');
            sendResponse({ ok: true });
          } else if (request.action === 'RESET_FARM_STATS') {
            window.postMessage({ source: 'ROTOM_POPUP', type: 'RESET_FARM_STATS' }, '*');
            safeStorageSet({ rotom_farm_stats: null, rotom_hunts_telemetry: null });
            sendResponse({ ok: true });
          } else if (request.action === 'RESET_SHINY_FLOW') {
            window.postMessage({ source: 'ROTOM_POPUP', type: 'RESET_SHINY_FLOW' }, '*');
            sendResponse({ ok: true });
          } else if (request.action === 'RESET_HUNTS_STATS') {
            window.postMessage({ source: 'ROTOM_POPUP', type: 'RESET_HUNTS_STATS' }, '*');
            safeStorageSet({ rotom_hunts_telemetry: null });
            sendResponse({ ok: true });
          } else if (request.action === 'FETCH_OFERENDA_CANDIDATES') {
            window.postMessage({
              source: 'ROTOM_POPUP',
              type: 'FETCH_OFERENDA_CANDIDATES',
              maxNota: request.maxNota !== undefined ? request.maxNota : request.notaMax,
              elemento: request.elemento !== undefined ? request.elemento : request.tipo
            }, '*');
            sendResponse({ ok: true });
          } else if (request.action === 'EXECUTE_OFERENDA_BATCH') {
            window.postMessage({
              source: 'ROTOM_POPUP',
              type: 'EXECUTE_OFERENDA_BATCH',
              pokemonIds: request.pokemonIds,
              pacingMs: request.pacingMs
            }, '*');
            sendResponse({ ok: true });
          }
        } catch (err) {}
        return true;
      });
    } catch (e) {}
  }
})();
