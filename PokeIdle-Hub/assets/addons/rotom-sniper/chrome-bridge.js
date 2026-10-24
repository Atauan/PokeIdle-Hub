'use strict';
// PokeIdle Hub — Camada de Compatibilidade Chrome Extension para o Cockpit Standalone
// Emula chrome.storage e chrome.runtime para cada conta isolada do Pokeidle

(() => {
  const params = new URLSearchParams(window.location.search);
  const accId = params.get('acc') || 'main';
  const accName = params.get('name') || 'Conta';

  document.title = `Sniper — Cockpit [${accName}]`;

  const storageKey = (k) => `rotom_${accId}_${k}`;

  const storageListeners = new Set();
  const runtimeListeners = new Set();

  function triggerStorageChanges(changes) {
    if (!changes || Object.keys(changes).length === 0) return;
    for (const fn of storageListeners) {
      try { fn(changes, 'local'); } catch (e) { console.error('[chrome-bridge]', e); }
    }
  }

  function triggerRuntimeMessage(msg) {
    if (!msg) return;
    for (const fn of runtimeListeners) {
      try { fn(msg, {}, () => {}); } catch (e) { console.error('[chrome-bridge]', e); }
    }
  }

  // API chrome.storage
  const storage = {
    local: {
      get(keys, cb) {
        const res = {};
        const keyList = Array.isArray(keys) ? keys : (typeof keys === 'string' ? [keys] : null);

        if (!keyList) {
          // Retorna todos os dados da conta
          for (let i = 0; i < localStorage.length; i++) {
            const rawKey = localStorage.key(i);
            const prefix = `rotom_${accId}_`;
            if (rawKey && rawKey.startsWith(prefix)) {
              const cleanKey = rawKey.slice(prefix.length);
              try { res[cleanKey] = JSON.parse(localStorage.getItem(rawKey)); } catch (_) {}
            }
          }
        } else {
          for (const k of keyList) {
            const raw = localStorage.getItem(storageKey(k));
            if (raw !== null && raw !== undefined) {
              try { res[k] = JSON.parse(raw); } catch (_) { res[k] = raw; }
            }
          }
        }

        if (typeof cb === 'function') setTimeout(() => cb(res), 0);
        return Promise.resolve(res);
      },

      set(data, cb) {
        const changes = {};
        if (data && typeof data === 'object') {
          for (const [k, v] of Object.entries(data)) {
            const sKey = storageKey(k);
            let oldVal = undefined;
            try { oldVal = JSON.parse(localStorage.getItem(sKey)); } catch (_) {}
            try {
              localStorage.setItem(sKey, JSON.stringify(v));
              changes[k] = { oldValue: oldVal, newValue: v };
            } catch (err) {
              console.warn('[chrome-bridge] Erro ao salvar storage:', err);
            }
          }
        }

        triggerStorageChanges(changes);

        // Notifica o jogo da conta via IPC se disponível
        if (window.rotomIpc && typeof window.rotomIpc.sendToGame === 'function') {
          window.rotomIpc.sendToGame(accId, { type: 'STORAGE_SET', data });
        }

        if (typeof cb === 'function') setTimeout(cb, 0);
        return Promise.resolve();
      },

      remove(keys, cb) {
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const k of keyList) {
          localStorage.removeItem(storageKey(k));
        }
        if (typeof cb === 'function') setTimeout(cb, 0);
        return Promise.resolve();
      }
    },

    onChanged: {
      addListener(fn) { storageListeners.add(fn); },
      removeListener(fn) { storageListeners.delete(fn); }
    }
  };

  // API chrome.runtime
  const runtime = {
    id: 'pokeidle-hub-rotom-addon',
    lastError: null,
    getURL(path) { return path; },
    sendMessage(msg, cb) {
      if (window.rotomIpc && typeof window.rotomIpc.sendToGame === 'function') {
        window.rotomIpc.sendToGame(accId, msg);
      }
      if (typeof cb === 'function') setTimeout(() => cb({ ok: true }), 0);
      return Promise.resolve({ ok: true });
    },
    onMessage: {
      addListener(fn) { runtimeListeners.add(fn); },
      removeListener(fn) { runtimeListeners.delete(fn); }
    }
  };

  // API chrome.tabs
  const tabs = {
    query(_q, cb) {
      const dummyTab = [{ id: 1, url: 'https://pokeidle.io/app' }];
      if (typeof cb === 'function') setTimeout(() => cb(dummyTab), 0);
      return Promise.resolve(dummyTab);
    },
    sendMessage(_tabId, message, cb) {
      if (window.rotomIpc && typeof window.rotomIpc.sendToGame === 'function') {
        window.rotomIpc.sendToGame(accId, message);
      }
      if (typeof cb === 'function') setTimeout(() => cb({ ok: true }), 0);
      return Promise.resolve({ ok: true });
    }
  };

  window.chrome = {
    storage,
    runtime,
    tabs
  };

  // Escuta dados vindos do jogo através do Electron IPC (rotomIpc)
  if (window.rotomIpc && typeof window.rotomIpc.onGameMessage === 'function') {
    window.rotomIpc.onGameMessage((data) => {
      if (!data || typeof data !== 'object') return;

      if (data.type === 'BALANCE_UPDATE') {
        const patch = {};
        if (typeof data.gold === 'number') patch.rotom_player_gold = data.gold;
        if (typeof data.orbs === 'number') patch.rotom_player_orbs = data.orbs;
        if (typeof data.diamonds === 'number') patch.rotom_player_diamonds = data.diamonds;
        storage.local.set(patch);
      } else if (data.type === 'SNIPER_LOG') {
        storage.local.get(['rotom_sniper_logs'], (res) => {
          const logs = res.rotom_sniper_logs || [];
          const updated = [data.log, ...logs].slice(0, 100);
          storage.local.set({ rotom_sniper_logs: updated });
        });
      } else if (data.type === 'SNIPER_BOUGHT') {
        storage.local.get(['rotom_sniper_rules'], (res) => {
          const rules = res.rotom_sniper_rules || [];
          let changed = false;
          rules.forEach((r) => {
            if (r.id === data.ruleId) {
              r.totalBought = (r.totalBought || 0) + (data.qty || 1);
              changed = true;
            }
          });
          if (changed) storage.local.set({ rotom_sniper_rules: rules });
        });
      } else if (data.type === 'MY_LISTINGS_UPDATE') {
        storage.local.set({ rotom_my_listings: data.listings || [] });
      } else if (data.type === 'POKEMON_PRICE_GUIDE_INVENTORY_UPDATE') {
        storage.local.set({
          rotom_price_guide_pokemons: data.pokemons || [],
          rotom_price_guide_inventory_request_id: data.requestId || null,
          rotom_price_guide_inventory_diagnostic: data.diagnostic || null,
          rotom_price_guide_inventory_timestamp: data.timestamp || Date.now()
        });
      } else if (data.type === 'POKEMON_PRICE_GUIDE_INVENTORY_DIAGNOSTIC') {
        storage.local.set({ rotom_price_guide_diagnostic: data });
      } else if (data.type === 'POKEMON_PRICE_GUIDE_OFFERS_UPDATE') {
        storage.local.set({
          rotom_price_guide_offers: {
            requestId: data.requestId,
            speciesId: data.speciesId,
            offers: data.offers || [],
            spriteDataUrl: typeof data.spriteDataUrl === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]{16,30000}$/.test(data.spriteDataUrl) ? data.spriteDataUrl : null,
            spriteDataUrls: {
              normal: typeof data.spriteDataUrls?.normal === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]{16,30000}$/.test(data.spriteDataUrls.normal) ? data.spriteDataUrls.normal : null,
              shiny: typeof data.spriteDataUrls?.shiny === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]{16,30000}$/.test(data.spriteDataUrls.shiny) ? data.spriteDataUrls.shiny : null
            },
            spriteVariant: data.spriteVariant === 'shiny' ? 'shiny' : data.spriteVariant === 'normal' ? 'normal' : null,
            currencyIconDataUrls: {
              gold: typeof data.currencyIconDataUrls?.gold === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]{16,30000}$/.test(data.currencyIconDataUrls.gold) ? data.currencyIconDataUrls.gold : null,
              orb: typeof data.currencyIconDataUrls?.orb === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]{16,30000}$/.test(data.currencyIconDataUrls.orb) ? data.currencyIconDataUrls.orb : null
            },
            types: Array.isArray(data.types) ? data.types.filter(type => typeof type === 'string' && /^[a-z0-9 -]{1,20}$/i.test(type)).slice(0, 2) : [],
            marketResponses: Number(data.marketResponses) || 0,
            marketRowsReceived: Number(data.marketRowsReceived) || 0,
            marketRowsMatchedById: Number(data.marketRowsMatchedById) || 0,
            marketRowsMatchedByName: Number(data.marketRowsMatchedByName) || 0,
            marketRowsAdded: Number(data.marketRowsAdded) || 0,
            marketRowsDuplicate: Number(data.marketRowsDuplicate) || 0,
            marketRowsInvalidPrice: Number(data.marketRowsInvalidPrice) || 0,
            marketRowsInvalidCurrency: Number(data.marketRowsInvalidCurrency) || 0,
            marketRowsMissingSpeciesInfo: Number(data.marketRowsMissingSpeciesInfo) || 0,
            marketRowsDifferentSpecies: Number(data.marketRowsDifferentSpecies) || 0,
            marketRowsParseErrors: Number(data.marketRowsParseErrors) || 0,
            marketRowsLastErrorType: String(data.marketRowsLastErrorType || '').slice(0, 32),
            marketRowsLastErrorIdentifier: String(data.marketRowsLastErrorIdentifier || '').slice(0, 64),
            timestamp: data.timestamp || Date.now()
          }
        });
      } else if (data.type === 'MARKET_CATALOG_UPDATE') {
        storage.local.set({ rotom_market_catalog: data.resumo || {} });
      } else if (data.type === 'ITEM_OFFERS_UPDATE') {
        storage.local.set({
          rotom_item_offers: {
            itemId: data.itemId,
            itemName: data.itemName,
            moeda: data.moeda,
            linhas: data.linhas || [],
            offers: data.linhas || [],
            timestamp: Date.now()
          }
        });
      } else if (data.type === 'DIAMOND_OFFERS_UPDATE') {
        storage.local.set({ rotom_diamond_offers: { offers: data.offers || [], timestamp: Date.now() } });
        triggerRuntimeMessage({ action: 'DIAMOND_OFFERS_UPDATE', offers: data.offers || [] });
      } else if (data.type === 'FARM_STATS_UPDATE') {
        const stats = data.stats || {};
        storage.local.set({ rotom_farm_stats: stats, rotom_hunts_telemetry: stats.hunts || {} });
        triggerRuntimeMessage({ action: 'FARM_STATS_UPDATE', stats });
      } else if (data.type === 'VIP_STATUS_UPDATE') {
        storage.local.set({ rotom_player_vip: Boolean(data.isVip) });
      } else if (data.type === 'OFERENDA_CANDIDATES_RESULT') {
        storage.local.set({
          rotom_oferenda_candidates: {
            candidates: data.candidates || [],
            protectedCount: data.protectedCount,
            totalDepot: data.totalDepot,
            timestamp: Date.now()
          }
        });
      } else if (data.type === 'OFERENDA_BATCH_PROGRESS') {
        storage.local.set({
          rotom_oferenda_progress: {
            batch: data.batch,
            totalBatches: data.totalBatches,
            sacrificed: data.sacrificed,
            timestamp: Date.now()
          }
        });
      } else if (data.type === 'OFERENDA_BATCH_COMPLETED') {
        storage.local.set({
          rotom_oferenda_completed: {
            totalSacrificed: data.totalSacrificed,
            batchesExecuted: data.batchesExecuted,
            stonesReceived: data.stonesReceived,
            timestamp: Date.now()
          }
        });
      }
    });
  }
})();
