// PokéIdle Rotom Sniper - Injected Script v1.4.3 (Executa no contexto real da página)
// Módulos: Interceptador WebSocket, Monitoramento Autônomo de Mercado, Auto-Snipe e HUD Toasts

(function() {
  console.log('[PokéIdle Rotom Sniper]: Inicializando Injected Engine v1.4.3...');

  let activeWebSocket = null;
  let lastDiamondRequestTime = 0;
  let accumulatedDiamondOffers = [];
  const OriginalWebSocket = window.WebSocket;
  const originalProtoSend = OriginalWebSocket.prototype.send;
  const originalProtoAddEventListener = OriginalWebSocket.prototype.addEventListener;

  let playerPokemonsCache = [];
  let oferendaStonesAccumulator = {};
  let isOferendaBatchRunning = false;

  function hookWebSocketInstance(ws) {
    if (!ws) return;
    activeWebSocket = ws;
    window.__activeGameWs = ws;
    if (ws.__rotomHooked) return;
    ws.__rotomHooked = true;

    try {
      ws.addEventListener('message', function(event) {
        if (typeof event.data === 'string') {
          try {
            const packet = JSON.parse(event.data);
            handleMarketPacket(packet);
          } catch (e) {}
        }
      });
    } catch (e) {}
  }

  // Hook no construtor WebSocket para capturar a conexão do jogo
  try {
    window.WebSocket = function(...args) {
      const ws = new OriginalWebSocket(...args);
      hookWebSocketInstance(ws);
      return ws;
    };
    window.WebSocket.prototype = OriginalWebSocket.prototype;
    window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
    window.WebSocket.OPEN = OriginalWebSocket.OPEN;
    window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
    window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;
  } catch (e) {}

  // Hook de segurança no prototype.send para capturar instâncias existentes
  try {
    OriginalWebSocket.prototype.send = function(...args) {
      hookWebSocketInstance(this);
      return originalProtoSend.apply(this, args);
    };
  } catch (e) {}

  // Hook de segurança no addEventListener
  try {
    OriginalWebSocket.prototype.addEventListener = function(type, listener, options) {
      if (type === 'message') {
        hookWebSocketInstance(this);
      }
      return originalProtoAddEventListener.call(this, type, listener, options);
    };
  } catch (e) {}

  function getGameWs() {
    if (activeWebSocket && activeWebSocket.readyState === WebSocket.OPEN) {
      hookWebSocketInstance(activeWebSocket);
      return activeWebSocket;
    }
    if (window.estado && window.estado.ws && window.estado.ws.readyState === WebSocket.OPEN) {
      activeWebSocket = window.estado.ws;
      hookWebSocketInstance(activeWebSocket);
      return activeWebSocket;
    }
    if (window.__activeGameWs && window.__activeGameWs.readyState === WebSocket.OPEN) {
      activeWebSocket = window.__activeGameWs;
      hookWebSocketInstance(activeWebSocket);
      return activeWebSocket;
    }
    return null;
  }

  function sendRaw(payloadObj) {
    const ws = getGameWs();
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('[Rotom Sniper]: WebSocket indisponível ou fechado.');
      return false;
    }
    const str = typeof payloadObj === 'string' ? payloadObj : JSON.stringify(payloadObj);
    try {
      ws.send(str);
      return true;
    } catch (e) {
      try {
        originalProtoSend.call(ws, str);
        return true;
      } catch (err) {
        return false;
      }
    }
  }

  // =========================================================================
  // 1. ROTOM IN-GAME HUD TOAST (Alertas Visuais Cyberdeck no Próprio Jogo)
  // =========================================================================
  function ensureRotomToastContainer() {
    let container = document.getElementById('rotom-hud-toasts');
    if (!container) {
      container = document.createElement('div');
      container.id = 'rotom-hud-toasts';
      container.style.cssText = [
        'position: fixed',
        'top: 14px',
        'right: 14px',
        'z-index: 9999999',
        'display: flex',
        'flex-direction: column',
        'gap: 6px',
        'pointer-events: none',
        'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        'max-width: 330px',
        'width: 100%'
      ].join(';');
      document.body.appendChild(container);
    }
    return container;
  }

  // =========================================================================
  // =========================================================================
  // TELEMETRIA DA SESSÃO DE FARM DO JOGADOR AO VIVO (XP/H, GOLD/H, DROPS)
  // E DASHBOARD DE RENDIMENTO POR HUNT COM MÉDIAS E PERSISTÊNCIA
  // =========================================================================
  let farmSession = {
    startTime: Date.now(),
    trainerXp: 0,
    pokemonXp: 0,
    gold: 0,
    kills: 0,
    captures: 0,
    catches: 0,
    ballAttempts: 0,
    shiniesSeen: 0,
    shiniesCaught: 0,
    bossTokens: 0,
    keyFragments: 0,
    shinyFragments: 0,
    bikeFragments: 0,
    dropsCount: 0,
    drops: {},
    activeHuntSlug: '',
    activeHuntName: '',
    inCenter: false,
    hunts: {} // { [slug]: { slug, name, durationMs, kills, captures, catches, attempts, pokemonXp, trainerXp, gold, dropsCount, drops: {}, shiniesSeen, shiniesCaught, lastSeen } }
  };

  let playerInPokemonCenter = false;
  const seenWildShiniesMap = new Map(); // key -> timestamp
  const recentCapturesMap = new Map();
  let lastBattleEventTs = 0;

  function formatHuntName(slug) {
    if (!slug) return 'Hunt Geral';
    if (typeof window.ROTOM_HUNTS_DB !== 'undefined' && Array.isArray(window.ROTOM_HUNTS_DB)) {
      const found = window.ROTOM_HUNTS_DB.find(h => h.slug === slug || (h.nome || '').toLowerCase().replace(/[\s-]+/g, '_') === slug);
      if (found) return found.nome;
    }
    return slug
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  function getOrCreateHuntStat(slug, name) {
    if (!slug || slug === 'centro_pokemon') return null;
    if (!farmSession.hunts) farmSession.hunts = {};
    if (!farmSession.hunts[slug]) {
      farmSession.hunts[slug] = {
        slug: slug,
        name: name || formatHuntName(slug),
        durationMs: 0,
        kills: 0,
        captures: 0,
        catches: 0,
        attempts: 0,
        pokemonXp: 0,
        trainerXp: 0,
        gold: 0,
        dropsCount: 0,
        drops: {},
        shiniesSeen: 0,
        shiniesCaught: 0,
        lastSeen: Date.now()
      };
    }
    if (name && farmSession.hunts[slug].name !== name && !farmSession.hunts[slug].name.includes('Tier')) {
      farmSession.hunts[slug].name = name;
    }
    farmSession.hunts[slug].lastSeen = Date.now();
    return farmSession.hunts[slug];
  }

  // Ticker a cada 1s para contabilizar tempo ativo na hunt atual enquanto o combate estiver acontecendo
  setInterval(() => {
    const now = Date.now();
    if (now - lastBattleEventTs < 15000 && farmSession.activeHuntSlug && !playerInPokemonCenter) {
      const currentHunt = getOrCreateHuntStat(farmSession.activeHuntSlug, farmSession.activeHuntName);
      if (currentHunt) {
        currentHunt.durationMs = (currentHunt.durationMs || 0) + 1000;
      }
    }
  }, 1000);

  try {
    const savedFarm = localStorage.getItem('rotom_farm_session');
    if (savedFarm) {
      const parsed = JSON.parse(savedFarm);
      if (parsed && typeof parsed === 'object') {
        farmSession = Object.assign(farmSession, parsed);
        if (!farmSession.hunts) farmSession.hunts = {};
      }
    }
  } catch (e) {}

  let farmStatsEmitDebounce = null;
  function emitFarmStats() {
    clearTimeout(farmStatsEmitDebounce);
    farmStatsEmitDebounce = setTimeout(() => {
      try {
        localStorage.setItem('rotom_farm_session', JSON.stringify(farmSession));
        window.postMessage({
          source: 'ROTOM_SNIPER',
          type: 'FARM_STATS_UPDATE',
          stats: farmSession
        }, '*');
      } catch (e) {}
    }, 120);
  }

  let lastToastKey = '';
  let lastToastTime = 0;

  function showRotomHudToast(title, message, type) {
    try {
      const now = Date.now();
      const toastKey = `${title}::${message}`;
      if (toastKey === lastToastKey && (now - lastToastTime) < 1500) {
        return; // Ignora toast idêntico disparado repetidamente
      }
      lastToastKey = toastKey;
      lastToastTime = now;

      const container = ensureRotomToastContainer();
      const toast = document.createElement('div');
      
      let badgeTag = '[SNIPER]';
      let tagBg = '#ba5ad1';
      let tagColor = '#fff';

      if (type === 'success' || type === 'confirmed') {
        badgeTag = '[SUCESSO]';
        tagBg = '#4e9c62';
      } else if (type === 'warning' || type === 'slot_limit' || type === 'scheduled') {
        badgeTag = '[AVISO]';
        tagBg = '#f0a03c';
        tagColor = '#4a3608';
      } else if (type === 'error' || type === 'rejected') {
        badgeTag = '[ERRO]';
        tagBg = '#d8574a';
      } else if (type === 'shiny') {
        badgeTag = '[SHINY]';
        tagBg = '#e2a93f';
        tagColor = '#4a3608';
      }

      toast.style.cssText = [
        'background: linear-gradient(180deg, #914850 0 8px, #bd6951 8px calc(100% - 8px), #df824c calc(100% - 8px) 100%)',
        'box-shadow: inset 0 0 0 2px #480e1e, inset 0 0 0 4px #f1d3b7, 0 4px 0 #722c3f, 0 10px 30px rgba(0, 0, 0, 0.75)',
        'color: #fff6ef',
        'padding: 8px 12px',
        'font-family: Tahoma, Verdana, "Segoe UI", sans-serif',
        'font-weight: 700',
        'font-size: 11px',
        'pointer-events: auto',
        'border-radius: 6px',
        'transition: all 0.2s ease',
        'display: flex',
        'flex-direction: column',
        'gap: 4px'
      ].join(';');

      toast.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(72,14,30,0.4); padding-bottom: 3px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="background: ${tagBg}; color: ${tagColor}; font-size: 8px; padding: 1px 4px; border-radius: 3px; box-shadow: inset 0 0 0 1px #480e1e; font-weight: 900; letter-spacing: 0.5px;">${badgeTag}</span>
            <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #fff; text-shadow: -1px -1px 0 #722c3f, 1px -1px 0 #722c3f, -1px 1px 0 #722c3f, 1px 1px 0 #722c3f;">${title}</span>
          </div>
          <span style="font-size: 8px; color: #f5cdb9; text-transform: uppercase; letter-spacing: 0.5px;">AUTO-SNIPER</span>
        </div>
        <div style="font-size: 10.5px; line-height: 1.35; color: #fff6ef; text-shadow: 0 1px 1px rgba(0,0,0,0.5);">
          ${message}
        </div>
      `;

      container.appendChild(toast);

      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-6px)';
        setTimeout(() => toast.remove(), 250);
      }, 4500);
    } catch (e) {
      console.error('[Rotom Toast Error]', e);
    }
  }

  // =========================================================================
  // 2. ESTADO E ENGINE DO AUTO-SNIPE
  // =========================================================================
  const sniperState = {
    enabled: false,
    rules: [],
    globalConfig: {
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
      maxActiveSlots: 5,
      autoMaxAffordable: true // Calibração por Saldo (Eficiência Máxima de Coins)
    },
    playerGold: -1,
    playerDiamonds: -1,
    playerOrbs: -1,
    isPlayerVip: false,
    boughtOffers: {},      // offerId -> timestamp
    scheduledOffers: {},   // offerId -> timeoutId ou array de timers
    confirmedOffers: {},   // offerId -> bool (compra confirmada)
    knownItems: {},        // itemId -> itemObj
    lastBuyAttempt: null   // { offerId, targetName, timestamp }
  };

  function clearOfferTimers(offerId) {
    if (sniperState.scheduledOffers[offerId]) {
      const timers = Array.isArray(sniperState.scheduledOffers[offerId])
        ? sniperState.scheduledOffers[offerId]
        : [sniperState.scheduledOffers[offerId]];
      timers.forEach(t => clearTimeout(t));
      delete sniperState.scheduledOffers[offerId];
    }
  }

  // Carrega catálogo canônico
  if (typeof window.POKEIDLE_ITEMS_DB !== 'undefined' && Array.isArray(window.POKEIDLE_ITEMS_DB)) {
    window.POKEIDLE_ITEMS_DB.forEach(it => {
      sniperState.knownItems[it.id] = it;
    });
  }

  function updatePlayerBalance(gold, diamonds, orbs) {
    let changed = false;
    if (typeof gold === 'number' && !isNaN(gold) && gold >= 0 && gold !== sniperState.playerGold) {
      sniperState.playerGold = gold;
      changed = true;
    }
    if (typeof diamonds === 'number' && !isNaN(diamonds) && diamonds >= 0 && diamonds !== sniperState.playerDiamonds) {
      sniperState.playerDiamonds = diamonds;
      changed = true;
    }
    if (typeof orbs === 'number' && !isNaN(orbs) && orbs >= 0 && orbs !== sniperState.playerOrbs) {
      sniperState.playerOrbs = orbs;
      changed = true;
    }

    if (changed) {
      try {
        window.postMessage({
          source: 'ROTOM_SNIPER',
          type: 'BALANCE_UPDATE',
          gold: sniperState.playerGold,
          diamonds: sniperState.playerDiamonds,
          orbs: sniperState.playerOrbs,
          gems: sniperState.playerOrbs
        }, '*');
      } catch (e) {}
    }
  }

  function checkPlayerVip() {
    try {
      if (window.estado && window.estado.eu && window.estado.eu.loja) {
        const l = window.estado.eu.loja;
        if (l.vip) return true;
        if (l.vipAte && l.vipAte > Date.now()) return true;
      }
    } catch (e) {}
    try {
      if (document.querySelector('.loja-selo.vip, .pvp-auto-selo, .selo-vip')) return true;
    } catch (e) {}
    return false;
  }

  function updatePlayerVipStatus() {
    const isVip = checkPlayerVip();
    if (sniperState.isPlayerVip !== isVip) {
      sniperState.isPlayerVip = isVip;
      try {
        window.postMessage({
          source: 'ROTOM_SNIPER',
          type: 'VIP_STATUS_UPDATE',
          isVip: isVip
        }, '*');
      } catch (e) {}
      console.log('[Rotom Sniper]: Status VIP do PokéIdle atualizado:', isVip ? 'ATIVO (15 Slots)' : 'BÁSICO (5 Slots)');
    }
    return isVip;
  }

  function getPlayerGold() {
    // 1. Leitura direta no DOM do PokéIdle (#tr-gold)
    try {
      const el = document.getElementById('tr-gold') || document.querySelector('#tr-gold');
      if (el && el.textContent) {
        const clean = el.textContent.replace(/[^\d]/g, '');
        if (clean.length > 0) {
          const val = parseInt(clean, 10);
          if (!isNaN(val) && val >= 0) {
            if (val !== sniperState.playerGold) {
              sniperState.playerGold = val;
              updatePlayerBalance(val, sniperState.playerDiamonds, sniperState.playerOrbs);
            }
            return val;
          }
        }
      }
    } catch (e) {}

    // 2. Leitura via objeto de estado em memória
    try {
      if (typeof window !== 'undefined') {
        const est = window.estado || (window.__estado && window.__estado.eu) || null;
        if (est) {
          const g = (est.eu && typeof est.eu.gold === 'number') ? est.eu.gold : (typeof est.gold === 'number' ? est.gold : null);
          if (typeof g === 'number' && g >= 0) {
            sniperState.playerGold = g;
            return g;
          }
        }
      }
    } catch (e) {}

    // 3. Fallback do último valor recebido via WebSocket
    if (typeof sniperState.playerGold === 'number' && sniperState.playerGold >= 0) {
      return sniperState.playerGold;
    }
    return -1;
  }

  function getPlayerGems() {
    // 1. Leitura direta no DOM do PokéIdle (#tr-gemas)
    try {
      const el = document.getElementById('tr-gemas') || document.querySelector('#tr-gemas');
      if (el && el.textContent) {
        const clean = el.textContent.replace(/[^\d]/g, '');
        if (clean.length > 0) {
          const val = parseInt(clean, 10);
          if (!isNaN(val) && val >= 0) {
            if (val !== sniperState.playerOrbs) {
              sniperState.playerOrbs = val;
              updatePlayerBalance(sniperState.playerGold, sniperState.playerDiamonds, val);
            }
            return val;
          }
        }
      }
    } catch (e) {}

    // 2. Leitura via objeto de estado em memória
    try {
      if (typeof window !== 'undefined') {
        const est = window.estado || (window.__estado && window.__estado.eu) || null;
        if (est) {
          const o = (est.eu && typeof est.eu.orbs === 'number') ? est.eu.orbs : (typeof est.orbs === 'number' ? est.orbs : (est.eu && typeof est.eu.gemas === 'number' ? est.eu.gemas : null));
          if (typeof o === 'number' && o >= 0) {
            sniperState.playerOrbs = o;
            return o;
          }
        }
      }
    } catch (e) {}

    // 3. Fallback do último valor recebido via WebSocket
    if (typeof sniperState.playerOrbs === 'number' && sniperState.playerOrbs >= 0) {
      return sniperState.playerOrbs;
    }
    return -1;
  }

  function getPlayerDiamonds() {
    // 1. Leitura direta no DOM do PokéIdle (#tr-diamantes)
    try {
      const el = document.getElementById('tr-diamantes') || document.querySelector('#tr-diamantes');
      if (el && el.textContent) {
        const clean = el.textContent.replace(/[^\d]/g, '');
        if (clean.length > 0) {
          const val = parseInt(clean, 10);
          if (!isNaN(val) && val >= 0) {
            if (val !== sniperState.playerDiamonds) {
              sniperState.playerDiamonds = val;
              updatePlayerBalance(sniperState.playerGold, val, sniperState.playerOrbs);
            }
            return val;
          }
        }
      }
    } catch (e) {}

    // 2. Leitura via objeto de estado em memória
    try {
      if (typeof window !== 'undefined') {
        const est = window.estado || (window.__estado && window.__estado.eu) || null;
        if (est) {
          const d = (est.eu && typeof est.eu.diamonds === 'number') ? est.eu.diamonds : (typeof est.diamonds === 'number' ? est.diamonds : null);
          if (typeof d === 'number' && d >= 0) {
            sniperState.playerDiamonds = d;
            return d;
          }
        }
      }
    } catch (e) {}

    // 3. Fallback do último valor recebido via WebSocket
    if (typeof sniperState.playerDiamonds === 'number' && sniperState.playerDiamonds >= 0) {
      return sniperState.playerDiamonds;
    }
    return -1;
  }

  function hasSufficientBalance(preco, qty, moeda) {
    const unitPrice = Number(preco) || 0;
    const count = Number(qty) || 1;
    const totalCost = unitPrice * count;
    if (totalCost <= 0) return true;

    const mClean = String(moeda || 'gold').toLowerCase();
    const isGold = (mClean === 'gold' || mClean === 'coins' || mClean === 'coin');
    const isGems = (mClean === 'orb' || mClean === 'orbs' || mClean === 'gemas' || mClean === 'gema' || mClean === 'gems' || mClean === 'pontos');
    const isDiamonds = (mClean === 'diamante' || mClean === 'diamantes' || mClean === 'diamonds');

    let currentBalance = -1;
    if (isGold) currentBalance = getPlayerGold();
    else if (isGems) currentBalance = getPlayerGems();
    else if (isDiamonds) currentBalance = getPlayerDiamonds();

    // Se o saldo for conhecido e menor que o preço unitário (não paga nem 1), bloqueia imediatamente!
    if (currentBalance >= 0 && currentBalance < unitPrice) {
      return false;
    }
    return currentBalance >= 0 ? (currentBalance >= totalCost) : true;
  }

  function emitSniperLog(logObj) {
    try {
      window.postMessage({
        source: 'ROTOM_SNIPER',
        type: 'SNIPER_LOG',
        log: logObj
      }, '*');
    } catch (e) {}
  }

  function emitSniperBought(ruleId, offerId, qty) {
    try {
      window.postMessage({
        source: 'ROTOM_SNIPER',
        type: 'SNIPER_BOUGHT',
        ruleId,
        offerId,
        qty
      }, '*');
    } catch (e) {}
  }

  function executeBuyOrder(offerId, buyQty, preco, moeda, targetName, ruleId, ruleDesc, seller, isRetry = false) {
    if (!sniperState.enabled) {
      console.log(`[Rotom Sniper]: Compra cancelada para #${offerId} (${targetName}): Auto-Sniper está desativado.`);
      return;
    }
    if (sniperState.confirmedOffers[offerId]) return;

    // VALIDAÇÃO FINAL ESTREITA CONTRA GASTO INDEVIDO DE GEMAS:
    const mClean = String(moeda || 'gold').toLowerCase();
    const isOrderGems = (mClean === 'orb' || mClean === 'orbs' || mClean === 'gemas' || mClean === 'gema' || mClean === 'gems' || mClean === 'pontos' || mClean === 'diamante');
    if (isOrderGems) {
      let allowedGemsCeiling = 0;
      if (ruleId && sniperState.rules && sniperState.rules.length > 0) {
        const foundRule = sniperState.rules.find(r => String(r.id) === String(ruleId) || r.targetName === targetName);
        if (foundRule) {
          allowedGemsCeiling = Number(foundRule.maxPriceGems !== undefined ? foundRule.maxPriceGems : (foundRule.maxPriceDiamonds || 0));
        }
      } else {
        // Radar Global de Pokémon:
        const gCfg = sniperState.globalConfig;
        const shinyGems = gCfg.snipeAnyShiny ? Number(gCfg.maxPriceShinyGems !== undefined ? gCfg.maxPriceShinyGems : (gCfg.maxPriceShinyDiamonds || 0)) : 0;
        const p5Gems = gCfg.snipeAnyP5 ? Number(gCfg.maxPriceP5Gems !== undefined ? gCfg.maxPriceP5Gems : (gCfg.maxPriceP5Diamonds || 0)) : 0;
        const noteGems = gCfg.snipeByNote ? Number(gCfg.maxPriceNoteGems !== undefined ? gCfg.maxPriceNoteGems : (gCfg.maxPriceNoteDiamonds || 0)) : 0;
        allowedGemsCeiling = Math.max(shinyGems, p5Gems, noteGems);
      }

      if (allowedGemsCeiling <= 0 || preco > allowedGemsCeiling) {
        console.warn(`[Rotom Sniper]: 🛑 ORDEM DESCARTADA: Preço em Gemas (${preco}) excede teto configurado (${allowedGemsCeiling}) para #${offerId} (${targetName}).`);
        return;
      }
    }

    // REGRA DE PROTEÇÃO DE SALDO (Só envia se o jogador tiver a moeda suficiente):
    const unitPrice = Number(preco) || 0;
    let orderQty = Number(buyQty) || 1;
    let currentBalance = -1;
    let moedaLabel = 'Coins';

    if (isOrderGems) {
      currentBalance = getPlayerGems();
      moedaLabel = 'Gemas';
    } else if (mClean === 'gold' || mClean === 'coins' || mClean === 'coin') {
      currentBalance = getPlayerGold();
      moedaLabel = 'Coins';
    } else {
      currentBalance = getPlayerDiamonds();
      moedaLabel = 'Diamantes';
    }

    if (unitPrice > 0) {
      // Se o saldo for conhecido e menor que o preço unitário (não paga nem 1), cancela imediatamente!
      if (currentBalance >= 0 && currentBalance < unitPrice) {
        console.warn(`[Rotom Sniper]: 🛑 COMPRA ABORTADA: Saldo insuficiente em ${moedaLabel} (Saldo: ${currentBalance.toLocaleString('pt-BR')} / Preço Unitário: ${unitPrice.toLocaleString('pt-BR')}) para #${offerId} (${targetName}).`);
        showRotomHudToast(
          'SALDO INSUFICIENTE',
          `Snipe de ${targetName} abortado. Saldo: ${currentBalance.toLocaleString('pt-BR')} ${moedaLabel} (Preço: ${unitPrice.toLocaleString('pt-BR')}).`,
          'warning'
        );
        emitSniperLog({
          id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          timestamp: Date.now(),
          ruleId: ruleId || '',
          targetName: targetName,
          seller: seller || '',
          offerId: offerId,
          price: unitPrice,
          qty: orderQty,
          currency: moeda,
          status: 'SALDO_INSUFICIENTE',
          details: `Saldo insuficiente em ${moedaLabel}: ${currentBalance.toLocaleString('pt-BR')} (Preço: ${unitPrice.toLocaleString('pt-BR')})`
        });
        return;
      }

      // Se o total excede o saldo, calibra para o máximo que o saldo suporta
      if (currentBalance >= unitPrice && currentBalance < (unitPrice * orderQty)) {
        const maxAffordable = Math.floor(currentBalance / unitPrice);
        if (maxAffordable <= 0) return;
        orderQty = maxAffordable;
      }
    }
    buyQty = orderQty;

    if (ruleId && sniperState.rules && sniperState.rules.length > 0) {
      const foundRule = sniperState.rules.find(r => String(r.id) === String(ruleId) || r.targetName === targetName);
      if (foundRule && !foundRule.active) {
        console.log(`[Rotom Sniper]: Compra cancelada para #${offerId} (${targetName}): A regra está pausada.`);
        return;
      }
    }

    sniperState.boughtOffers[offerId] = Date.now();
    sniperState.lastBuyAttempt = {
      offerId: offerId,
      targetName: targetName,
      seller: seller || '',
      timestamp: Date.now()
    };

    const payload = {
      t: 'market.comprar',
      id: Number(offerId),
      qtd: Number(buyQty) || 1,
      preco: Number(preco),
      moeda: String(moeda || 'gold')
    };

    console.log(`[Rotom Sniper]: DISPARANDO COMPRA #${offerId} (${targetName}${seller ? ' de @' + seller : ''}):`, payload);
    const sent = sendRaw(payload);

    if (sent) {
      if (!isRetry) {
        // Otimização Preventiva de Saldo: decrementa preventivamente para evitar estouro em compras simultâneas apenas no primeiro disparo
        const mClean = String(moeda || 'gold').toLowerCase();
        if ((mClean === 'gold' || mClean === 'coins' || mClean === 'coin') && sniperState.playerGold >= 0) {
          sniperState.playerGold = Math.max(0, sniperState.playerGold - (Number(buyQty) * Number(preco)));
          updatePlayerBalance(sniperState.playerGold, sniperState.playerDiamonds, sniperState.playerOrbs);
        } else if ((mClean === 'orb' || mClean === 'orbs' || mClean === 'gemas' || mClean === 'gema' || mClean === 'gems' || mClean === 'pontos' || mClean === 'diamante') && sniperState.playerOrbs >= 0) {
          sniperState.playerOrbs = Math.max(0, sniperState.playerOrbs - (Number(buyQty) * Number(preco)));
          updatePlayerBalance(sniperState.playerGold, sniperState.playerDiamonds, sniperState.playerOrbs);
        }

        const sellerStr = seller ? ` de @${seller}` : '';
        const moedaNome = (mClean === 'orb' || mClean === 'orbs' || mClean === 'gemas' || mClean === 'gema') ? 'Gemas' : 'Coins';
        const precoFmt = Number(preco).toLocaleString('pt-BR');

        showRotomHudToast(
          'DISPARANDO COMPRA',
          `Comprando ${buyQty}x ${targetName}${sellerStr} por ${precoFmt} ${moedaNome} (#${offerId})`,
          'success'
        );

        const logEntry = {
          id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          timestamp: Date.now(),
          ruleId: ruleId || '',
          targetName: targetName,
          seller: seller || '',
          offerId: offerId,
          price: preco,
          qty: buyQty,
          currency: moeda,
          status: 'DISPARADO',
          details: ruleDesc || 'Ordem enviada'
        };

        emitSniperLog(logEntry);
        if (ruleId) {
          emitSniperBought(ruleId, offerId, buyQty);
        }
      } else {
        console.log(`[Rotom Sniper]: 🔁 Ordem de reforço #${offerId} enviada ao servidor dentro da janela de 3s.`);
      }
    } else {
      showRotomHudToast(
        'ERRO AO DISPARAR',
        `Não foi possível enviar a ordem de compra para #${offerId}. WebSocket desconectado.`,
        'error'
      );
    }
  }

  function processMarketAnuncios(anunciosList) {
    if (!sniperState.enabled || !Array.isArray(anunciosList) || anunciosList.length === 0) return;

    const now = Date.now();
    const activeRules = sniperState.rules.filter(r => r.active);
    const isVip = updatePlayerVipStatus();
    const maxSlots = isVip ? 15 : (sniperState.globalConfig.maxActiveSlots || 5);

    for (let i = 0; i < anunciosList.length; i++) {
      const an = anunciosList[i];
      if (!an) continue;

      const offerId = Number(an.id);
      if (!offerId || isNaN(offerId)) continue;

      // Evita compras duplicadas na mesma oferta se já confirmada, agendada ou comprada
      if (sniperState.confirmedOffers[offerId]) continue;
      if (sniperState.scheduledOffers[offerId]) continue;
      if (sniperState.boughtOffers[offerId] && (now - sniperState.boughtOffers[offerId] < 20000)) continue;
      if (an.estado && an.estado !== 'aberto') continue;
      // Blindagem estrita: Se o registro possui comprador ou data de liquidação 'em' sem preco ativo, é histórico
      if (an.comprador) continue;
      if (an.em && !an.preco && (an.bruto || an.valor)) continue;

      const seller = String(an.vendedor || an.vendedorNome || an.seller || an.dono || '').trim();
      const preco = Number(an.preco) || 0;
      const qtd = Number(an.qtd) || 1;
      const moeda = String(an.moeda || 'gold').toLowerCase();
      const isGold = (moeda === 'gold' || moeda === 'coins' || moeda === 'coin');
      const isGems = (moeda === 'orb' || moeda === 'orbs' || moeda === 'gemas' || moeda === 'gema' || moeda === 'gems' || moeda === 'pontos' || moeda === 'diamante');
      const ficha = an.ficha || null;

      // Identificação robusta do Item
      const itemId = Number(an.itemId || (ficha && ficha.itemId) || 0);
      const rotomDbItem = (typeof window.getRotomItem === 'function' && itemId > 0) ? window.getRotomItem(itemId) : null;
      let itemName = String(
        (rotomDbItem && rotomDbItem.name) ||
        (an.itemNome && !an.itemNome.startsWith('Item #') ? an.itemNome : '') ||
        (an.nome && !an.nome.startsWith('Item #') ? an.nome : '') ||
        (sniperState.knownItems[itemId] && sniperState.knownItems[itemId].name) ||
        ''
      );
      const isItem = Boolean(itemId > 0 || an.itemNome || an.tipo === 'item' || an.tipoItem === 'item');

      // Identificação robusta de Pokémon
      const isPokemon = !isItem && Boolean(an.pokemonNome || (ficha && ficha.speciesId) || an.tipo === 'pokemon' || an.tipoItem === 'pokemon');
      const pokeName = String(an.pokemonNome || (ficha && ficha.nome) || an.nome || '');

      let matched = false;
      let matchedRule = null;
      let matchedDesc = '';
      let targetDisplayName = '';

      // --- A. REGRAS CUSTOMIZADAS DE ITENS CONFIGURADAS PELO JOGADOR ---
      for (let r = 0; r < activeRules.length; r++) {
        const rule = activeRules[r];
        if (rule.maxQty > 0 && (rule.totalBought || 0) >= rule.maxQty) continue;

        if (rule.targetType === 'item' || !rule.targetType) {
          let itemMatches = false;
          if (rule.targetId && Number(rule.targetId) === itemId) {
            itemMatches = true;
          } else if (rule.targetName) {
            const tLower = rule.targetName.toLowerCase().trim();
            const iLower = itemName.toLowerCase().trim();
            if (iLower && (iLower === tLower || iLower.includes(tLower))) {
              itemMatches = true;
            }
          }

          if (itemMatches) {
            const maxGold = Number(rule.maxPriceGold || 0);
            const maxGems = Number(rule.maxPriceGems !== undefined ? rule.maxPriceGems : (rule.maxPriceDiamonds || 0));

            let priceOk = false;
            if (isGold && maxGold > 0 && preco <= maxGold) priceOk = true;
            else if (isGems && maxGems > 0 && preco <= maxGems) priceOk = true;

            if (priceOk) {
              matched = true;
              matchedRule = rule;
              targetDisplayName = (rotomDbItem && rotomDbItem.name) || rule.targetName || itemName || `Item #${itemId}`;
              const tetoStr = isGold
                ? maxGold.toLocaleString('pt-BR') + ' Coins'
                : maxGems.toLocaleString('pt-BR') + ' Gemas';
              matchedDesc = `Regra: ${rule.targetName} (Teto: ${tetoStr})`;
              break;
            }
          }
        }

        // Regra Customizada de Pokémon por Espécie
        if (rule.targetType === 'pokemon' && isPokemon) {
          let pokeMatches = false;
          if (rule.targetId && ficha && Number(ficha.speciesId) === Number(rule.targetId)) {
            pokeMatches = true;
          } else if (rule.targetName && pokeName) {
            const tLower = rule.targetName.toLowerCase().trim();
            const pLower = pokeName.toLowerCase().trim();
            if (pLower === tLower || pLower.includes(tLower)) {
              pokeMatches = true;
            }
          }

          if (pokeMatches) {
            const maxGold = Number(rule.maxPriceGold || 0);
            const maxGems = Number(rule.maxPriceGems !== undefined ? rule.maxPriceGems : (rule.maxPriceDiamonds || 0));

            let priceOk = false;
            if (isGold && maxGold > 0 && preco <= maxGold) priceOk = true;
            else if (isGems && maxGems > 0 && preco <= maxGems) priceOk = true;

            if (priceOk) {
              matched = true;
              matchedRule = rule;
              const tetoStr = isGold
                ? maxGold.toLocaleString('pt-BR') + ' Coins'
                : maxGems.toLocaleString('pt-BR') + ' Gemas';
              matchedDesc = `Regra: ${rule.targetName} (Teto: ${tetoStr})`;
              targetDisplayName = pokeName || rule.targetName;
              break;
            }
          }
        }
      }

      // --- B. REGRAS GLOBAIS DE POKÉMON (Shiny, P5 e Nota) ---
      if (!matched && isPokemon && pokeName) {
        const isShiny = Boolean(
          an.shiny || an.isShiny || an.lookShiny ||
          (ficha && (ficha.shiny || ficha.isShiny || ficha.lookShiny)) ||
          pokeName.toLowerCase().includes('shiny')
        );

        let potencia = Number(an.potencia || (ficha && ficha.potencia) || 1);
        let nota = Number((ficha && ficha.nota) || an.nota || 0);

        const gCfg = sniperState.globalConfig;
        const maxShinyGold = Number(gCfg.maxPriceShinyGold || 0);
        const maxShinyGems = Number(gCfg.maxPriceShinyGems !== undefined ? gCfg.maxPriceShinyGems : (gCfg.maxPriceShinyDiamonds || 0));
        const maxP5Gold = Number(gCfg.maxPriceP5Gold || 0);
        const maxP5Gems = Number(gCfg.maxPriceP5Gems !== undefined ? gCfg.maxPriceP5Gems : (gCfg.maxPriceP5Diamonds || 0));
        const maxNoteGold = Number(gCfg.maxPriceNoteGold || 0);
        const maxNoteGems = Number(gCfg.maxPriceNoteGems !== undefined ? gCfg.maxPriceNoteGems : (gCfg.maxPriceNoteDiamonds || 0));

        // 1. Match Qualquer Shiny
        if (gCfg.snipeAnyShiny && isShiny) {
          let shinyPriceOk = false;
          if (isGold && maxShinyGold > 0 && preco <= maxShinyGold) shinyPriceOk = true;
          else if (isGems && maxShinyGems > 0 && preco <= maxShinyGems) shinyPriceOk = true;

          if (shinyPriceOk) {
            matched = true;
            const tetoStr = isGold ? maxShinyGold.toLocaleString('pt-BR') + ' Coins' : maxShinyGems.toLocaleString('pt-BR') + ' Gemas';
            matchedDesc = `Shiny Global (Teto: ${tetoStr})`;
            targetDisplayName = `✨ Shiny ${pokeName}`;
          }
        }

        // 2. Match Qualquer P5 (Potência 5)
        if (!matched && gCfg.snipeAnyP5 && potencia >= 5) {
          let p5PriceOk = false;
          if (isGold && maxP5Gold > 0 && preco <= maxP5Gold) p5PriceOk = true;
          else if (isGems && maxP5Gems > 0 && preco <= maxP5Gems) p5PriceOk = true;

          if (p5PriceOk) {
            matched = true;
            const tetoStr = isGold ? maxP5Gold.toLocaleString('pt-BR') + ' Coins' : maxP5Gems.toLocaleString('pt-BR') + ' Gemas';
            matchedDesc = `P5 Global (Teto: ${tetoStr})`;
            targetDisplayName = `⚡ P5 ${pokeName}`;
          }
        }

        // 3. Match Por Nota Mínima
        if (!matched && gCfg.snipeByNote && gCfg.minNote > 0 && nota >= gCfg.minNote) {
          let notePriceOk = false;
          if (isGold && maxNoteGold > 0 && preco <= maxNoteGold) notePriceOk = true;
          else if (isGems && maxNoteGems > 0 && preco <= maxNoteGems) notePriceOk = true;

          if (notePriceOk) {
            matched = true;
            const tetoStr = isGold ? Number(gCfg.maxPriceNoteGold).toLocaleString('pt-BR') + ' Coins' : Number(maxNoteGems).toLocaleString('pt-BR') + ' Gemas';
            matchedDesc = `Nota Oficial >= ${gCfg.minNote} (Teto: ${tetoStr})`;
            targetDisplayName = `★ Nota ${nota.toFixed(1)} ${pokeName}`;
          }
        }
      }

      // Se deu match, executa compra ou agenda pré-fire
      if (matched) {
        // Salvaguarda de slots de regras
        if (activeRules.length > maxSlots && matchedRule) {
          showRotomHudToast(
            'SLOTS LOTADOS',
            `${targetDisplayName} avistado por ${preco} ${moeda}, mas o limite de ${maxSlots} slots está ativo.`,
            'slot_limit'
          );
          emitSniperLog({
            id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            timestamp: Date.now(),
            targetName: targetDisplayName,
            seller: seller || '',
            offerId: offerId,
            price: preco,
            qty: qtd,
            currency: moeda,
            status: 'SLOTS_LOTADOS',
            details: `Limite de ${maxSlots} slots atingido. Não comprado.`
          });
          continue;
        }

        // Limite de compra: VIP permite quantidade infinita ou customizada; Básico limita em 20
        let buyQty = qtd;
        if (matchedRule) {
          const isInfinite = Boolean(matchedRule.infinite || matchedRule.maxQty <= 0 || matchedRule.maxQty >= 99999);
          if (isVip && isInfinite) {
            buyQty = qtd; // Modo Infinito VIP: compra todo o estoque do anúncio (respeitando saldo)
          } else if (isVip && matchedRule.maxQty > 0) {
            const rem = Math.max(0, matchedRule.maxQty - (matchedRule.totalBought || 0));
            buyQty = Math.min(qtd, rem);
          } else {
            // Versão Basic: Máximo de 20 unidades por regra
            const effectiveRuleMax = (matchedRule.maxQty !== undefined && matchedRule.maxQty > 0)
              ? Math.min(matchedRule.maxQty, 20)
              : 20;
            const rem = Math.max(0, effectiveRuleMax - (matchedRule.totalBought || 0));
            buyQty = Math.min(qtd, rem);
          }
        } else {
          // Radar Global de Pokémon
          buyQty = 1;
        }

        if (buyQty <= 0) continue;

        // REGRA DE PROTEÇÃO DE SALDO E CALIBRAÇÃO (Só snipa se a pessoa tiver a moeda suficiente):
        if (preco > 0) {
          let currentBalance = -1;
          let moedaNome = 'Coins';
          if (isGold) {
            currentBalance = getPlayerGold();
            moedaNome = 'Coins';
          } else if (isGems) {
            currentBalance = getPlayerGems();
            moedaNome = 'Gemas';
          } else if (isDiamonds) {
            currentBalance = getPlayerDiamonds();
            moedaNome = 'Diamantes';
          }

          // Se o saldo for conhecido e menor que o preço unitário (não paga nem 1), descarta o snipe!
          if (currentBalance >= 0 && currentBalance < preco) {
            console.log(`[Rotom Sniper]: 🛑 Snipe descartado por saldo insuficiente em ${moedaNome} para #${offerId} (${targetDisplayName}): saldo ${currentBalance.toLocaleString('pt-BR')}, preço unitário ${preco.toLocaleString('pt-BR')}.`);
            continue; // Evita ordem rejeitada pelo servidor por falta de saldo
          }

          if (currentBalance >= preco) {
            const maxAffordable = Math.floor(currentBalance / preco);
            if (buyQty > maxAffordable) {
              console.log(`[Rotom Sniper]: Calibração por Saldo #${offerId} (${targetDisplayName}): ajustando compra de ${buyQty} para ${maxAffordable} unidades (Saldo: ${currentBalance.toLocaleString('pt-BR')} ${moedaNome}).`);
              buyQty = maxAffordable;
              matchedDesc += ` [Saldo máx: ${buyQty}x]`;
            }
          }
        }

        if (buyQty <= 0) continue;

        // Checa carência / cooldown antes de liberar o anúncio:
        const compravelEm = Number(an.compravelEm || an.compravelEmMs || 0);
        const isFutureCooldown = compravelEm > (now + 50);

        if (isFutureCooldown) {
          // O anúncio ainda está no cooldown ANTES de liberar.
          // NÃO DISPARAR ANTES! Quem tenta comprar antes cai em sorteio ou é recusado.
          // O disparo é agendado para LOGO APÓS A LIBERAÇÃO (+100ms) e mantido dentro dos 3s posteriores.
          const releaseDelayMs = Math.max(50, (compravelEm - now) + 100);
          const waitSec = Math.ceil((compravelEm - now) / 1000);
          const sellerStr = seller ? ` de @${seller}` : '';
          console.log(`[Rotom Sniper]: ⏳ Anúncio #${offerId} (${targetDisplayName}${sellerStr}) em cooldown. Disparo pós-liberação garantido em ${releaseDelayMs}ms.`);

          showRotomHudToast(
            'DISPARO AGENDADO',
            `${targetDisplayName}${sellerStr} agendado para compra logo após liberação (${waitSec}s)! (#${offerId})`,
            'scheduled'
          );

          emitSniperLog({
            id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            timestamp: Date.now(),
            targetName: targetDisplayName,
            seller: seller || '',
            offerId: offerId,
            price: preco,
            qty: buyQty,
            currency: moeda,
            status: 'AGENDADO',
            details: `Cooldown ativo (${waitSec}s) · Disparo garantido após liberação · ${matchedDesc}`
          });

          const timers = [];

          // 1º Disparo: +100ms após a liberação (garante que o anúncio já está liberado no servidor e front)
          timers.push(setTimeout(() => {
            executeBuyOrder(offerId, buyQty, preco, moeda, targetDisplayName, matchedRule ? matchedRule.id : '', matchedDesc, seller, false);
          }, releaseDelayMs));

          // 2º Disparo (Garantia dentro dos 3s): +700ms após liberação se ainda não confirmado
          timers.push(setTimeout(() => {
            if (!sniperState.confirmedOffers[offerId]) {
              console.log(`[Rotom Sniper]: 🔄 Reforço de compra pós-liberação #${offerId} (+700ms)...`);
              executeBuyOrder(offerId, buyQty, preco, moeda, targetDisplayName, matchedRule ? matchedRule.id : '', matchedDesc, seller, true);
            }
          }, releaseDelayMs + 600));

          // 3º Disparo (Reforço final dentro dos 3s): +1500ms após liberação se ainda não confirmado
          timers.push(setTimeout(() => {
            if (!sniperState.confirmedOffers[offerId]) {
              console.log(`[Rotom Sniper]: 🔄 Reforço final de compra pós-liberação #${offerId} (+1500ms)...`);
              executeBuyOrder(offerId, buyQty, preco, moeda, targetDisplayName, matchedRule ? matchedRule.id : '', matchedDesc, seller, true);
            }
            clearOfferTimers(offerId);
          }, releaseDelayMs + 1400));

          sniperState.scheduledOffers[offerId] = timers;

        } else {
          // Anúncio JÁ ESTÁ LIBERADO! (compravelEm <= now ou sem carência)
          // Compra imediata e reforço de garantia dentro da janela de 3s
          executeBuyOrder(offerId, buyQty, preco, moeda, targetDisplayName, matchedRule ? matchedRule.id : '', matchedDesc, seller, false);

          const timers = [];
          timers.push(setTimeout(() => {
            if (!sniperState.confirmedOffers[offerId]) {
              executeBuyOrder(offerId, buyQty, preco, moeda, targetDisplayName, matchedRule ? matchedRule.id : '', matchedDesc, seller, true);
            }
          }, 700));
          timers.push(setTimeout(() => {
            if (!sniperState.confirmedOffers[offerId]) {
              executeBuyOrder(offerId, buyQty, preco, moeda, targetDisplayName, matchedRule ? matchedRule.id : '', matchedDesc, seller, true);
            }
            clearOfferTimers(offerId);
          }, 1500));

          sniperState.scheduledOffers[offerId] = timers;
        }
      }
    }
  }

  function handleMarketPacket(packet) {
    if (!packet || typeof packet !== 'object') return;
    const t = packet.t || '';

    // Detecção de Centro Pokémon e Hunt a partir de pacotes de mapa
    if (t === 'campo' || t === 'campo.init') {
      const isCentro = Boolean(packet.centro || (packet.campo && packet.campo.centro) || packet.slug === 'centro_pokemon' || (packet.campo && packet.campo.slug === 'centro_pokemon'));
      playerInPokemonCenter = isCentro;
      farmSession.inCenter = isCentro;
      if (!isCentro) {
        const cSlug = packet.slug || (packet.campo && packet.campo.slug);
        if (cSlug && cSlug !== 'centro_pokemon') {
          farmSession.activeHuntSlug = cSlug;
          farmSession.activeHuntName = formatHuntName(cSlug);
          getOrCreateHuntStat(cSlug, farmSession.activeHuntName);
        }
      }
    }

    // Limpeza de criaturas que saíram da tela no mapa de shinies vistos
    const foraList = packet.fora || (packet.campo && packet.campo.fora);
    if (Array.isArray(foraList)) {
      for (const fSlot of foraList) {
        for (const key of seenWildShiniesMap.keys()) {
          if (key.startsWith(`${fSlot}_`)) {
            seenWildShiniesMap.delete(key);
          }
        }
      }
    }

    // Atualiza saldo e pokémons em tempo real a partir de qualquer pacote de estado ou envelope
    const est = packet.estado || (packet.payload && packet.payload.estado) || (t === 'estado' ? packet : null);
    if (est) {
      updatePlayerBalance(est.gold, est.diamonds, est.orbs);
      if (est.noCentro || est.huntSlug === 'centro_pokemon') {
        playerInPokemonCenter = true;
        farmSession.inCenter = true;
      } else if (est.huntSlug) {
        playerInPokemonCenter = false;
        farmSession.inCenter = false;
        farmSession.activeHuntSlug = est.huntSlug;
        const tierTxt = est.outlandTier ? ` [Tier ${est.outlandTier}]` : '';
        farmSession.activeHuntName = formatHuntName(est.huntSlug) + tierTxt;
        getOrCreateHuntStat(farmSession.activeHuntSlug, farmSession.activeHuntName);
      }
    } else if (typeof packet.gold === 'number') {
      updatePlayerBalance(packet.gold, packet.diamonds, packet.orbs);
    }

    // Captura GLOBAL e IMEDIATA de Pokémons do Jogador (welcome, estado ou envelopes)
    const rawPks = (est && Array.isArray(est.pokemons)) ? est.pokemons :
                   (packet.pokemons && Array.isArray(packet.pokemons)) ? packet.pokemons :
                   (packet.depot && Array.isArray(packet.depot)) ? packet.depot : null;
    if (rawPks && rawPks.length > 0) {
      playerPokemonsCache = rawPks;
      window.__rotomPlayerPokemons = rawPks;
    }

    // Captura bosses oficiais do servidor (welcome, estado ou envelopes)
    const serverBossesJogaveis = packet.bossesJogaveis || (packet.payload && packet.payload.bossesJogaveis);
    const serverBossesCatalogo = packet.bossesCatalogo || (packet.payload && packet.payload.bossesCatalogo);
    if (Array.isArray(serverBossesJogaveis) || Array.isArray(serverBossesCatalogo)) {
      try {
        window.postMessage({
          source: 'ROTOM_SNIPER',
          type: 'BOSSES_UPDATE',
          bossesJogaveis: serverBossesJogaveis || null,
          bossesCatalogo: serverBossesCatalogo || null
        }, '*');
      } catch (e) {}
    }

    // 1. Catálogo inicial no Welcome
    if (t === 'welcome') {
      if (Array.isArray(packet.itensNossos)) {
        packet.itensNossos.forEach(it => {
          if (it && it.id) sniperState.knownItems[it.id] = it;
        });
      }
      if (packet.mercado && Array.isArray(packet.mercado.catalogo)) {
        packet.mercado.catalogo.forEach(it => {
          if (it && it.id) sniperState.knownItems[it.id] = it;
        });
      }
      return;
    }

    // 2. Pacote market vindo do servidor
    if (t === 'market') {
      const aba = packet.aba || '';

      // Blindagem contra Histórico: Nunca processar históricoGlobal, historicoCompras ou historico como compras ativas
      if (aba.startsWith('historico') || aba === 'historico') {
        return;
      }

      // Meus Anúncios (o que o jogador botou pra vender)
      if (aba === 'meus') {
        const myList = Array.isArray(packet.linhas) ? packet.linhas : [];
        try {
          window.postMessage({
            source: 'ROTOM_SNIPER',
            type: 'MY_LISTINGS_UPDATE',
            listings: myList
          }, '*');
        } catch (e) {}
        return;
      }

      // Anúncio cancelado com sucesso
      if (aba === 'cancelado' || packet.cancelado) {
        showRotomHudToast('ANÚNCIO CANCELADO', 'Seu anúncio foi removido do mercado e devolvido ao depot.', 'confirmed');
        sendRaw({ t: 'market.meus' });
        return;
      }

      // Resumo de todos os itens do mercado
      if (aba === 'itens' && packet.resumo) {
        try {
          window.postMessage({
            source: 'ROTOM_SNIPER',
            type: 'MARKET_CATALOG_UPDATE',
            resumo: packet.resumo
          }, '*');
        } catch (e) {}

        if (sniperState.enabled) {
        const activeRules = sniperState.rules.filter(r => r.active && (r.targetType === 'item' || !r.targetType));
        for (let r = 0; r < activeRules.length; r++) {
          const rule = activeRules[r];
          if (rule.maxQty > 0 && (rule.totalBought || 0) >= rule.maxQty) continue;

          let itId = Number(rule.targetId);
          if (!itId && rule.targetName && typeof window.getRotomItem === 'function') {
            const it = window.getRotomItem(rule.targetName);
            if (it && it.id) itId = it.id;
          }
          if (!itId) continue;

          const resumoItem = packet.resumo[itId] || packet.resumo[String(itId)];
          if (resumoItem) {
            const minGold = Number(resumoItem.minGold || 0);
            const minOrb = Number(resumoItem.minOrb || 0);

            let shouldFetch = false;
            let fetchMoeda = 'gold';

            const maxGold = Number(rule.maxPriceGold || 0);
            const maxGems = Number(rule.maxPriceGems !== undefined ? rule.maxPriceGems : (rule.maxPriceDiamonds || 0));

            if (maxGold > 0 && minGold > 0 && minGold <= maxGold) {
              shouldFetch = true;
              fetchMoeda = 'gold';
            } else if (maxGems > 0 && minOrb > 0 && minOrb <= maxGems) {
              shouldFetch = true;
              fetchMoeda = 'orb';
            }

            if (shouldFetch) {
              sendRaw({
                t: 'market.item',
                itemId: itId,
                moeda: fetchMoeda
              });
            }
          }
        }
        }
        return;
      }

      // Vendedores de um item específico (m.aba === 'item')
      if (aba === 'item' && Array.isArray(packet.linhas)) {
        const itemId = Number(packet.itemId || 0);
        const moeda = String(packet.moeda || 'gold');
        const rotomItem = (typeof window.getRotomItem === 'function' && window.getRotomItem(itemId)) || sniperState.knownItems[itemId];
        const itemName = (rotomItem && rotomItem.name) || (sniperState.knownItems[itemId] && sniperState.knownItems[itemId].name) || `Item #${itemId}`;

        const enrichedLinhas = packet.linhas.map(line => ({
          ...line,
          itemId: itemId,
          itemNome: (rotomItem && rotomItem.name) || line.itemNome || itemName,
          moeda: line.moeda || moeda
        }));

        try {
          window.postMessage({
            source: 'ROTOM_SNIPER',
            type: 'ITEM_OFFERS_UPDATE',
            itemId: itemId,
            itemName: itemName,
            moeda: moeda,
            linhas: enrichedLinhas,
            offers: enrichedLinhas
          }, '*');
        } catch (e) {}

        processMarketAnuncios(enrichedLinhas);
        return;
      }

      // Lista geral (Pokémons, diamantes ou listagem paginada)
      let list = [];
      if (Array.isArray(packet.anuncios)) list = list.concat(packet.anuncios);
      if (Array.isArray(packet.itens)) list = list.concat(packet.itens);
      if (Array.isArray(packet.linhas)) list = list.concat(packet.linhas);
      if (packet.anuncio && typeof packet.anuncio === 'object') list.push(packet.anuncio);

      // Detecção precisa de resposta de ofertas de diamantes
      const isDiamondPacket = (Date.now() - lastDiamondRequestTime < 4500) ||
                              packet.tipo === 'diamante' ||
                              aba === 'diamantes' ||
                              (list.length > 0 && list.some(a => a && (a.tipo === 'diamante' || a?.ficha?.diamante || a.itemId === 999999)));

      if (isDiamondPacket) {
        const diamondRows = list.map(a => ({
          id: a.id,
          vendedor: a.vendedor || 'Comunidade',
          vendedorId: a.vendedorId,
          qtd: Number(a.qtd || a.quantidade || 1),
          preco: Number(a.preco || a.unitPrice || 0),
          moeda: a.moeda || 'gold',
          tipo: 'diamante',
          expiraEm: a.expiraEm,
          compravelEm: a.compravelEm
        }));

        for (const row of diamondRows) {
          if (!accumulatedDiamondOffers.some(o => o.id === row.id)) {
            accumulatedDiamondOffers.push(row);
          }
        }

        try {
          window.postMessage({
            source: 'ROTOM_SNIPER',
            type: 'DIAMOND_OFFERS_UPDATE',
            offers: accumulatedDiamondOffers.slice()
          }, '*');
        } catch (e) {}

        if (list.length > 0) processMarketAnuncios(list);
        return;
      }

      if (list.length > 0) {
        processMarketAnuncios(list);
      }
      return;
    }

    // 3. Processamento de Batalha & Telemetria de Farm ao Vivo
    if (t === 'batalha' && Array.isArray(packet.ev)) {
      lastBattleEventTs = Date.now();
      let statsChanged = false;

      for (const e of packet.ev) {
        if (!e) continue;
        const evKey = String(e.k || e.t || '');

        if (evKey === 'marketComprado') {
          const desc = e.descricao || 'Item entregue na mochila/depot!';
          if (sniperState.lastBuyAttempt && sniperState.lastBuyAttempt.offerId) {
            const offId = sniperState.lastBuyAttempt.offerId;
            sniperState.confirmedOffers[offId] = true;
            clearOfferTimers(offId);
          }
          showRotomHudToast('COMPRA CONFIRMADA!', desc, 'confirmed');
          emitSniperLog({
            id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            timestamp: Date.now(),
            targetName: desc,
            status: 'CONFIRMADO',
            details: `✅ Confirmado pelo servidor: ${desc}`
          });
        }

        // Se ainda não temos slug de hunt ativa, inferir pelo monstro
        if (!farmSession.activeHuntSlug && e.nome) {
          const inferredSlug = String(e.nome).toLowerCase().replace(/[\s-]+/g, '_');
          farmSession.activeHuntSlug = inferredSlug;
          farmSession.activeHuntName = e.nome;
          getOrCreateHuntStat(inferredSlug, e.nome);
        }

        // Tentativas de captura com Pokébola
        if (evKey === 'bola') {
          farmSession.ballAttempts = (farmSession.ballAttempts || 0) + 1;
          const currentHunt = getOrCreateHuntStat(farmSession.activeHuntSlug, farmSession.activeHuntName);
          currentHunt.attempts = (currentHunt.attempts || 0) + 1;
          statsChanged = true;
        }

        // Capturas de Pokémon (k: "capturado", k: "bola" com sucesso, ou k: "captura"/"catch")
        const isCapturado = (evKey === 'capturado');
        const isBolaSucesso = (evKey === 'bola' && (e.sucesso === true || e.sucesso === 1 || e.success));
        const isCatchKey = (evKey === 'captura' || evKey === 'catch');

        if (isCapturado || isBolaSucesso || isCatchKey) {
          const catchId = (e.pokemon && e.pokemon.id) ? 'pk_' + e.pokemon.id : (e.slot ? 'slot_' + e.slot : null);
          const now = Date.now();
          let duplicate = false;

          if (catchId) {
            const lastTs = recentCapturesMap.get(catchId);
            if (lastTs && (now - lastTs) < 4000) {
              duplicate = true;
            } else {
              recentCapturesMap.set(catchId, now);
              if (recentCapturesMap.size > 200) {
                for (const [k, ts] of recentCapturesMap.entries()) {
                  if (now - ts > 10000) recentCapturesMap.delete(k);
                }
              }
            }
          }

          if (!duplicate) {
            farmSession.captures = (farmSession.captures || 0) + 1;
            farmSession.catches = farmSession.captures;

            const isShiny = Boolean(e.shiny || e.isShiny || e.lookShiny || (e.pokemon && (e.pokemon.shiny || e.pokemon.isShiny)));
            if (isShiny) {
              farmSession.shiniesCaught = (farmSession.shiniesCaught || 0) + 1;
            }

            const currentHunt = getOrCreateHuntStat(farmSession.activeHuntSlug, farmSession.activeHuntName);
            if (currentHunt) {
              currentHunt.captures = (currentHunt.captures || 0) + 1;
              currentHunt.catches = currentHunt.captures;
              if (isShiny) {
                currentHunt.shiniesCaught = (currentHunt.shiniesCaught || 0) + 1;
                if ((currentHunt.shiniesSeen || 0) < currentHunt.shiniesCaught) {
                  currentHunt.shiniesSeen = currentHunt.shiniesCaught;
                }
              }
            }
            if (isShiny && (farmSession.shiniesSeen || 0) < farmSession.shiniesCaught) {
              farmSession.shiniesSeen = farmSession.shiniesCaught;
            }

            const pokeNome = (e.pokemon && e.pokemon.nome) || e.nome || 'Pokémon';
            showRotomHudToast(isShiny ? '🌟 SHINY CAPTURADO!' : '🎯 CAPTURA REALIZADA!', `${pokeNome}${isShiny ? ' Shiny' : ''} capturado com sucesso!`, 'confirmed');
            statsChanged = true;
          }
        }

        // Kills / Derrotas de monstros selvagens
        if (evKey === 'morte' || evKey === 'kill' || evKey === 'derrota' || evKey === 'monstro_morto') {
          farmSession.kills = (farmSession.kills || 0) + 1;
          const currentHunt = getOrCreateHuntStat(farmSession.activeHuntSlug, farmSession.activeHuntName);
          if (currentHunt) {
            currentHunt.kills = (currentHunt.kills || 0) + 1;
          }
          statsChanged = true;

          if (e.shiny || e.isShiny) {
            const mobSlot = e.slot || e.s;
            const mobKey = mobSlot ? `${mobSlot}_${e.nome || ''}` : null;
            if (!mobKey || !seenWildShiniesMap.has(mobKey)) {
              if (mobKey) seenWildShiniesMap.set(mobKey, Date.now());
              farmSession.shiniesSeen = (farmSession.shiniesSeen || 0) + 1;
              if (currentHunt) {
                currentHunt.shiniesSeen = (currentHunt.shiniesSeen || 0) + 1;
              }
            }
          }

          // XP embutido no evento de morte
          const xpVal = Number(e.xp || e.qtd || e.valor || 0);
          if (xpVal > 0) {
            farmSession.pokemonXp += xpVal;
            farmSession.trainerXp += Math.round(xpVal * 0.5);
            currentHunt.pokemonXp = (currentHunt.pokemonXp || 0) + xpVal;
            currentHunt.trainerXp = (currentHunt.trainerXp || 0) + Math.round(xpVal * 0.5);
          }

          // Ouro embutido no evento de morte
          const ouroVal = Number(e.ouro || e.gold || 0);
          if (ouroVal > 0) {
            farmSession.gold += ouroVal;
            currentHunt.gold = (currentHunt.gold || 0) + ouroVal;
          }

          // Drops embutidos no evento de morte
          if (Array.isArray(e.drops)) {
            for (const d of e.drops) {
              if (!d) continue;
              let dNome = d.nome || d.name || '';
              if (!dNome && d.itemId && typeof window.getRotomItem === 'function') {
                const rIt = window.getRotomItem(d.itemId);
                if (rIt) dNome = rIt.name;
              }
              if (!dNome) dNome = `Item #${d.itemId || '?'}`;
              const dQtd = Number(d.qtd || d.quantidade || 1);

              farmSession.dropsCount += dQtd;
              farmSession.drops[dNome] = (farmSession.drops[dNome] || 0) + dQtd;

              currentHunt.dropsCount = (currentHunt.dropsCount || 0) + dQtd;
              if (!currentHunt.drops) currentHunt.drops = {};
              currentHunt.drops[dNome] = (currentHunt.drops[dNome] || 0) + dQtd;

              const nLower = dNome.toLowerCase();
              if (nLower.includes('boss token')) farmSession.bossTokens += dQtd;
              if (nLower.includes('key fragment') || nLower.includes('fragmento de chave')) farmSession.keyFragments += dQtd;
              if (nLower.includes('shiny stone') || nLower.includes('fragmento de shiny')) farmSession.shinyFragments += dQtd;
              if (nLower.includes('bicicleta') || nLower.includes('bike')) farmSession.bikeFragments += dQtd;
            }
          }
        }

        // Ganho de XP avulso
        if (evKey === 'xp') {
          const val = Number(e.qtd || e.valor || e.xp || 0);
          if (val > 0) {
            const currentHunt = getOrCreateHuntStat(farmSession.activeHuntSlug, farmSession.activeHuntName);
            if (e.tipo === 'treinador' || e.dest === 'treinador') {
              farmSession.trainerXp += val;
              currentHunt.trainerXp = (currentHunt.trainerXp || 0) + val;
            } else {
              farmSession.pokemonXp += val;
              currentHunt.pokemonXp = (currentHunt.pokemonXp || 0) + val;
            }
            statsChanged = true;
          }
        }

        // Ganho de Gold avulso
        if (evKey === 'gold' || evKey === 'ouro') {
          const val = Number(e.qtd || e.valor || e.gold || e.ouro || 0);
          if (val > 0) {
            farmSession.gold += val;
            const currentHunt = getOrCreateHuntStat(farmSession.activeHuntSlug, farmSession.activeHuntName);
            currentHunt.gold = (currentHunt.gold || 0) + val;
            statsChanged = true;
          }
        }

        // Drops avulsos
        if (evKey === 'drop' || evKey === 'item') {
          let nomeItem = e.nome || e.itemNome || '';
          if (!nomeItem && e.itemId && typeof window.getRotomItem === 'function') {
            const rItem = window.getRotomItem(e.itemId);
            if (rItem) nomeItem = rItem.name;
          }
          if (!nomeItem) nomeItem = `Item #${e.itemId || '?'}`;
          const qtd = Number(e.qtd || e.quantidade || 1);

          farmSession.dropsCount += qtd;
          farmSession.drops[nomeItem] = (farmSession.drops[nomeItem] || 0) + qtd;

          const currentHunt = getOrCreateHuntStat(farmSession.activeHuntSlug, farmSession.activeHuntName);
          currentHunt.dropsCount = (currentHunt.dropsCount || 0) + qtd;
          if (!currentHunt.drops) currentHunt.drops = {};
          currentHunt.drops[nomeItem] = (currentHunt.drops[nomeItem] || 0) + qtd;

          const nLower = nomeItem.toLowerCase();
          if (nLower.includes('boss token')) farmSession.bossTokens += qtd;
          if (nLower.includes('key fragment') || nLower.includes('fragmento de chave')) farmSession.keyFragments += qtd;
          if (nLower.includes('shiny stone') || nLower.includes('fragmento de shiny')) farmSession.shinyFragments += qtd;
          if (nLower.includes('bicicleta') || nLower.includes('bike')) farmSession.bikeFragments += qtd;

          statsChanged = true;
        }
      }

      if (statsChanged) {
        emitFarmStats();
      }
    }

    // Shinies selvagens avistados no mapa (pacote campo, campo.init ou envelope)
    // CRÍTICO: No Centro Pokémon, TODOS os mobs pertencem a outros jogadores ou NPCs, NUNCA selvagens.
    if (!playerInPokemonCenter) {
      const monstrosList = packet.mobs || (packet.campo && packet.campo.mobs) || packet.monstros || (packet.campo && packet.campo.monstros);
      if (Array.isArray(monstrosList)) {
        let sawShiny = false;
        const now = Date.now();
        for (const m of monstrosList) {
          if (!m) continue;
          // Ignora monstro de treinador/jogador (m.tr > 0) ou cadáver (m.x > 0)
          const isTrainerMob = Boolean((m.tr && m.tr > 0) || (m.Tr && m.Tr > 0) || m.jogador || m.player);
          const isDead = Boolean((m.x && m.x > 0) || (m.X && m.X > 0) || m.morto);
          const slot = Number(m.s !== undefined ? m.s : (m.slot !== undefined ? m.slot : -1));
          // Criaturas selvagens ocupam slots 5 em diante no PokéIdle
          const isWild = !isTrainerMob && !isDead && (slot >= 5 || slot === -1);
          const isShiny = Boolean(m.sh === 1 || m.Sh === 1 || m.shiny || m.isShiny || m.lookShiny === 1 || m.LookShiny === 1);

          if (isWild && isShiny) {
            const mobKey = `${slot}_${m.n || m.nome || 'poke'}_${m.nv || m.level || 0}`;
            if (!seenWildShiniesMap.has(mobKey)) {
              seenWildShiniesMap.set(mobKey, now);
              farmSession.shiniesSeen = (farmSession.shiniesSeen || 0) + 1;
              if (farmSession.activeHuntSlug && farmSession.activeHuntSlug !== 'centro_pokemon') {
                const currentHunt = getOrCreateHuntStat(farmSession.activeHuntSlug, farmSession.activeHuntName);
                if (currentHunt) {
                  currentHunt.shiniesSeen = (currentHunt.shiniesSeen || 0) + 1;
                }
              }
              sawShiny = true;
              showRotomHudToast('✨ SHINY SELVAGEM!', `${m.n || m.nome || 'Pokémon'} Shiny apareceu na hunt!`, 'confirmed');
            }
          }
        }
        if (sawShiny) emitFarmStats();

        // Limpeza periódica do mapa de slots se crescer muito
        if (seenWildShiniesMap.size > 200) {
          for (const [k, ts] of seenWildShiniesMap.entries()) {
            if (now - ts > 180000) seenWildShiniesMap.delete(k);
          }
        }
      }
    }

    // Captura de Pokémon Herói Ativo (pacote estado, welcome ou envelope)
    const pks = packet.pokemons || (packet.estado && packet.estado.pokemons) || (packet.payload && packet.payload.estado && packet.payload.estado.pokemons) || (packet.depot && Array.isArray(packet.depot) ? packet.depot : null);
    if (Array.isArray(pks) && pks.length > 0) {
      playerPokemonsCache = pks;
      const actId = packet.activeId || (packet.estado && packet.estado.activeId) || (packet.payload && packet.payload.estado && packet.payload.estado.activeId);
      const activePk = pks.find(p => p && p.id === actId) || pks[0];
      if (activePk) {
        farmSession.activePokemon = {
          id: activePk.id,
          speciesId: activePk.speciesId || activePk.pokemonId || activePk.pId || 1,
          nome: activePk.nome || activePk.name || 'Pokémon',
          level: Number(activePk.level || activePk.lvl || 1),
          shiny: Boolean(activePk.shiny),
          potencia: Number(activePk.potencia || 1),
          qualidade: Number(activePk.qualidade || activePk.quality || 0),
          ivTotal: Number(activePk.ivTotal || 0),
          nota: Number(activePk.nota || 0)
        };
        emitFarmStats();
      }
    }

    // Evento de Oferenda Executada no Servidor Oficial
    if (t === 'oferenda') {
      const pedraObj = packet.pedra || packet.item || {};
      const pedraNome = pedraObj.nome || pedraObj.name || (pedraObj.id ? `Pedra #${pedraObj.id}` : 'Pedra Evolutiva');
      oferendaStonesAccumulator[pedraNome] = (oferendaStonesAccumulator[pedraNome] || 0) + 1;
      showRotomHudToast('OFERENDA REALIZADA', `Obteve: ${pedraNome}`, 'success');
    }

    // 4. Tratamento de Erros e Recusas do Servidor
    if (t === 'erro') {
      const errMsg = packet.msg || packet.chave || 'Operação recusada pelo servidor';
      if (errMsg.includes('Devagar')) {
        showRotomHudToast('AVISO ANTI-FLOOD', 'O servidor pediu para desacelerar as mensagens.', 'warning');
      } else if (sniperState.lastBuyAttempt && (Date.now() - sniperState.lastBuyAttempt.timestamp < 12000)) {
        // Se houve uma tentativa de compra recente, reportar a recusa exata
        const last = sniperState.lastBuyAttempt;
        delete sniperState.boughtOffers[last.offerId];
        delete sniperState.confirmedOffers[last.offerId];
        showRotomHudToast('COMPRA RECUSADA', `${last.targetName}: ${errMsg}`, 'error');
        emitSniperLog({
          id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          timestamp: Date.now(),
          targetName: last.targetName,
          offerId: last.offerId,
          status: 'RECUSADO',
          details: `❌ Recusado pelo servidor: ${errMsg}`
        });
      }
    }
  }

  // =========================================================================
  // 3. LOOP DE MONITORAMENTO AUTÔNOMO EM SEGUNDO PLANO (SEM ABRIR JANELA)
  // =========================================================================
  let scanCycle = 0;
  setInterval(() => {
    if (!sniperState.enabled) return;
    const ws = getGameWs();
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    scanCycle++;

    // Mantém leitura de VIP e saldo atualizada continuamente
    updatePlayerVipStatus();
    getPlayerGold();
    getPlayerGems();
    getPlayerDiamonds();

    const activeRules = sniperState.rules.filter(r => r.active);
    const hasItemRules = activeRules.some(r => r.targetType === 'item' || !r.targetType);
    const gCfg = sniperState.globalConfig;
    const hasPokeRules = gCfg.snipeAnyShiny || gCfg.snipeAnyP5 || gCfg.snipeByNote || activeRules.some(r => r.targetType === 'pokemon');

    // 1. Varredura de Itens (a cada 3s)
    if (hasItemRules) {
      sendRaw({ t: 'market.itens' });
    }

    // 2. Varredura de Pokémons (alternando ordenações para pegar novidades)
    if (hasPokeRules) {
      setTimeout(() => {
        if (!sniperState.enabled) return;
        switch (scanCycle % 3) {
          case 0:
            sendRaw({ t: 'market.listar', tipo: 'pokemon', ordem: 'recentes', moeda: '', busca: '', criterios: [], elemento: '' });
            break;
          case 1:
            sendRaw({ t: 'market.listar', tipo: 'pokemon', ordem: 'menor_preco', moeda: 'gold', busca: '', criterios: [], elemento: '' });
            break;
          case 2:
            sendRaw({ t: 'market.listar', tipo: 'pokemon', ordem: 'menor_preco', moeda: 'orb', busca: '', criterios: [], elemento: '' });
            break;
        }
      }, 700);
    }
  }, 3000);

  // =========================================================================
  // 4. INTERCEPTAÇÃO DE WEBSOCKET
  // =========================================================================
  WebSocket.prototype.send = function(data) {
    hookWebSocketInstance(this);
    return originalProtoSend.apply(this, arguments);
  };

  window.WebSocket = function(url, protocols) {
    const ws = new OriginalWebSocket(url, protocols);
    hookWebSocketInstance(ws);
    console.log('[PokéIdle Rotom Sniper]: Conexão WebSocket interceptada:', url);
    return ws;
  };

  window.WebSocket.prototype = OriginalWebSocket.prototype;
  window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
  window.WebSocket.OPEN = OriginalWebSocket.OPEN;
  window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
  window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;

  // =========================================================================
  // 5. ESCUTAR COMANDOS DO POPUP
  // =========================================================================
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== 'ROTOM_POPUP') return;

    if (event.data.type === 'INIT_SNIPER') {
      sniperState.enabled = Boolean(event.data.enabled);
      if (Array.isArray(event.data.rules)) sniperState.rules = event.data.rules;
      if (event.data.globalConfig) sniperState.globalConfig = Object.assign(sniperState.globalConfig, event.data.globalConfig);
      console.log('[Rotom Sniper]: Inicializado. Ativo:', sniperState.enabled, 'Regras:', sniperState.rules.length);
    } else if (event.data.type === 'SET_SNIPER_ENABLED') {
      const newEnabled = Boolean(event.data.enabled);
      if (sniperState.enabled === newEnabled) return; // Deduplicação: não repete se já estiver no mesmo estado
      sniperState.enabled = newEnabled;
      if (!sniperState.enabled) {
        // Cancela todos os disparos agendados e limpa a fila
        Object.keys(sniperState.scheduledOffers).forEach(clearOfferTimers);
        sniperState.scheduledOffers = {};
      }
      showRotomHudToast(
        sniperState.enabled ? 'AUTO-SNIPE ATIVADO' : 'AUTO-SNIPE PAUSADO',
        sniperState.enabled ? 'Varrendo mercado da comunidade automaticamente a cada 3s.' : 'Compras automáticas temporariamente suspensas.',
        sniperState.enabled ? 'success' : 'warning'
      );
    } else if (event.data.type === 'UPDATE_SNIPER_RULES') {
      sniperState.rules = Array.isArray(event.data.rules) ? event.data.rules : [];
      // Se não há regras ativas de itens, limpa agendamentos
      const activeRuleIds = new Set(sniperState.rules.filter(r => r.active).map(r => r.id));
      if (activeRuleIds.size === 0 && !sniperState.globalConfig.snipeAnyShiny && !sniperState.globalConfig.snipeAnyP5 && !sniperState.globalConfig.snipeByNote) {
        Object.keys(sniperState.scheduledOffers).forEach(clearOfferTimers);
        sniperState.scheduledOffers = {};
      }
      console.log('[Rotom Sniper]: Regras atualizadas:', sniperState.rules.length);
    } else if (event.data.type === 'UPDATE_SNIPER_CONFIG') {
      if (event.data.config) {
        sniperState.globalConfig = Object.assign(sniperState.globalConfig, event.data.config);
      }
    } else if (event.data.type === 'FETCH_MY_LISTINGS') {
      sendRaw({ t: 'market.meus' });
    } else if (event.data.type === 'CANCEL_MARKET_OFFER') {
      sendRaw({ t: 'market.cancelar', id: Number(event.data.offerId || event.data.id) });
    } else if (event.data.type === 'FETCH_COMMUNITY_CATALOG') {
      sendRaw({ t: 'market.itens', elemento: '', categoria: '' });
    } else if (event.data.type === 'FETCH_ITEM_OFFERS') {
      sendRaw({ t: 'market.item', itemId: Number(event.data.itemId), moeda: event.data.moeda || 'gold' });
    } else if (event.data.type === 'BUY_MANUAL_OFFER') {
      executeBuyOrder(event.data.offerId, event.data.qty || 1, event.data.price, event.data.moeda, event.data.targetName, '', 'Compra manual pelo Cockpit', event.data.seller);
    } else if (event.data.type === 'FETCH_DIAMOND_OFFERS') {
      lastDiamondRequestTime = Date.now();
      accumulatedDiamondOffers = [];
      const moedaReq = event.data.moeda;
      if (moedaReq === 'orb' || moedaReq === 'gold') {
        sendRaw({
          t: 'market.listar',
          tipo: 'diamante',
          moeda: moedaReq,
          ordem: 'baratos',
          pagina: 0,
          busca: '',
          criterios: [],
          elemento: '',
          categoria: '',
          soShiny: false,
          soP5: false
        });
      } else {
        // Envia requisições para Coins e Gemas cobrindo todas as ofertas ativas
        sendRaw({
          t: 'market.listar',
          tipo: 'diamante',
          moeda: 'gold',
          ordem: 'baratos',
          pagina: 0,
          busca: '',
          criterios: [],
          elemento: '',
          categoria: '',
          soShiny: false,
          soP5: false
        });
        setTimeout(() => {
          sendRaw({
            t: 'market.listar',
            tipo: 'diamante',
            moeda: 'orb',
            ordem: 'baratos',
            pagina: 0,
            busca: '',
            criterios: [],
            elemento: '',
            categoria: '',
            soShiny: false,
            soP5: false
          });
        }, 120);
      }
    } else if (event.data.type === 'CREATE_MARKET_LISTING') {
      sendRaw({
        t: 'market.criar',
        tipo: event.data.tipo || 'item',
        itemId: event.data.itemId ? Number(event.data.itemId) : undefined,
        pokemonId: event.data.pokemonId ? Number(event.data.pokemonId) : undefined,
        qtd: Number(event.data.qtd) || 1,
        preco: Number(event.data.preco) || 1,
        moeda: event.data.moeda || 'gold',
        dias: event.data.dias ? Number(event.data.dias) : null
      });
      showRotomHudToast('ANÚNCIO PUBLICADO', 'Sua oferta foi enviada ao mercado da comunidade.', 'confirmed');
      setTimeout(() => { sendRaw({ t: 'market.meus' }); }, 600);
    } else if (event.data.type === 'FETCH_FARM_STATS') {
      emitFarmStats();
    } else if (event.data.type === 'RESET_FARM_STATS') {
      const curSlug = farmSession.activeHuntSlug || '';
      const curName = farmSession.activeHuntName || '';
      farmSession = {
        startTime: Date.now(),
        trainerXp: 0,
        pokemonXp: 0,
        gold: 0,
        kills: 0,
        catches: 0,
        captures: 0,
        ballAttempts: 0,
        shiniesSeen: 0,
        shiniesCaught: 0,
        bossTokens: 0,
        keyFragments: 0,
        shinyFragments: 0,
        bikeFragments: 0,
        dropsCount: 0,
        drops: {},
        activeHuntSlug: curSlug,
        activeHuntName: curName,
        hunts: {}
      };
      emitFarmStats();
      showRotomHudToast('SESSÃO REINICIADA', 'Os contadores de farm e histórico de hunts foram zerados.', 'info');
    } else if (event.data.type === 'RESET_HUNTS_STATS') {
      farmSession.hunts = {};
      emitFarmStats();
      showRotomHudToast('HUNTS RESETADAS', 'O histórico de rendimento por hunt foi zerado.', 'info');
    } else if (event.data.type === 'FETCH_OFERENDA_CANDIDATES') {
      const maxNota = typeof event.data.maxNota === 'number' ? event.data.maxNota : 5.0;
      const elemFilter = (event.data.elemento || '').toLowerCase().trim();
      processOferendaCandidates(maxNota, elemFilter, 0);
    } else if (event.data.type === 'EXECUTE_OFERENDA_BATCH') {
      if (isOferendaBatchRunning) return;
      const ids = Array.isArray(event.data.pokemonIds) ? event.data.pokemonIds : [];
      const pacingMs = Math.max(250, Number(event.data.pacingMs || 800));
      if (ids.length < 5) {
        showRotomHudToast('ALTAR DE OFERENDAS', 'Selecione ao menos 5 Pokémons para oferenda.', 'warning');
        return;
      }

      isOferendaBatchRunning = true;
      oferendaStonesAccumulator = {};

      const batches = [];
      for (let i = 0; i + 4 < ids.length; i += 5) {
        batches.push(ids.slice(i, i + 5));
      }

      const totalBatches = batches.length;
      let currentBatchIdx = 0;

      showRotomHudToast('ALTAR DE OFERENDAS', `Iniciando oferenda em lote: ${totalBatches * 5} Pokémons em ${totalBatches} giros.`, 'info');

      function runNextBatch() {
        if (currentBatchIdx >= totalBatches) {
          isOferendaBatchRunning = false;
          window.postMessage({
            source: 'ROTOM_SNIPER',
            type: 'OFERENDA_BATCH_COMPLETED',
            totalSacrificed: totalBatches * 5,
            batchesExecuted: totalBatches,
            stonesReceived: oferendaStonesAccumulator
          }, '*');
          showRotomHudToast('ALTAR CONCLUÍDO', `${totalBatches * 5} Pokémons sacrificados com sucesso!`, 'confirmed');
          return;
        }

        const chunk = batches[currentBatchIdx];
        currentBatchIdx++;

        window.postMessage({
          source: 'ROTOM_SNIPER',
          type: 'OFERENDA_BATCH_PROGRESS',
          batch: currentBatchIdx,
          totalBatches: totalBatches,
          sacrificed: currentBatchIdx * 5
        }, '*');

        sendRaw({ t: 'oferenda.girar', pokemonIds: chunk });

        setTimeout(runNextBatch, pacingMs);
      }

      runNextBatch();
    }
  });

  function getPlayerAllPokemons() {
    if (Array.isArray(playerPokemonsCache) && playerPokemonsCache.length > 0) {
      return playerPokemonsCache;
    }
    if (Array.isArray(window.__rotomPlayerPokemons) && window.__rotomPlayerPokemons.length > 0) {
      return window.__rotomPlayerPokemons;
    }
    if (window.estado && window.estado.eu && Array.isArray(window.estado.eu.pokemons) && window.estado.eu.pokemons.length > 0) {
      return window.estado.eu.pokemons;
    }
    if (window.estado && Array.isArray(window.estado.pokemons) && window.estado.pokemons.length > 0) {
      return window.estado.pokemons;
    }
    if (window.estado && window.estado.depot && Array.isArray(window.estado.depot)) {
      return window.estado.depot;
    }
    return [];
  }

  function processOferendaCandidates(maxNota, elemFilter, retryCount = 0) {
    let allPks = getPlayerAllPokemons();

    // Se estiver vazio e temos conexão ativa, tenta forçar envio de estado pelo servidor
    if ((!allPks || allPks.length === 0) && retryCount < 3) {
      sendRaw({ t: 'auto.set' });
      setTimeout(() => {
        processOferendaCandidates(maxNota, elemFilter, retryCount + 1);
      }, 350);
      return;
    }

    const cleanFilter = elemFilter ? elemFilter.toLowerCase().trim() : '';
    const isFilterAll = !cleanFilter || cleanFilter === 'all' || cleanFilter === 'todos' || cleanFilter === 'qualquer';

    let depotCount = 0;
    let protectedCount = 0;
    const candidates = [];

    for (let i = 0; i < allPks.length; i++) {
      const pk = allPks[i];
      if (!pk) continue;

      const inTeam = pk.slot !== undefined && pk.slot !== null && pk.slot !== '' && Number(pk.slot) >= 0;
      if (inTeam) continue;

      depotCount++;

      const isShiny = Boolean(pk.shiny);
      const isP5 = Number(pk.potencia || 1) >= 5;
      const isLocked = Boolean(pk.travado || pk.lock || pk.locked || pk.pokemonTravado);
      const hasRefinement = Number(pk.refino || pk.refinement || 0) > 0;
      const hasTm = Boolean(pk.tm || pk.tm1 || pk.tm2);
      const isStarter = Boolean(pk.inicial || pk.starter);

      if (isShiny || isP5 || isLocked || hasRefinement || hasTm || isStarter) {
        protectedCount++;
        continue;
      }

      let pkNota = (pk.nota !== undefined && pk.nota !== null && !isNaN(Number(pk.nota))) ? Number(pk.nota) : -1;
      if (pkNota < 0) {
        const ivTot = Object.values(pk.ivs || {}).reduce((s, v) => s + Number(v || 0), 0);
        const qual = Number(pk.qualidade || pk.quality || 0);
        pkNota = Number(((ivTot / 192) * 5 + (qual / 100) * 5).toFixed(1));
      }
      if (isNaN(pkNota) || pkNota < 0) pkNota = 0;

      if (maxNota < 10.0 && pkNota > maxNota) {
        protectedCount++;
        continue;
      }

      if (!isFilterAll) {
        const tipos = Array.isArray(pk.tipos) ? pk.tipos.map(t => String(t).toLowerCase()) : [];
        const t1 = String(pk.tipo1 || pk.elemento || pk.tipo || '').toLowerCase();
        const t2 = String(pk.tipo2 || '').toLowerCase();
        const match = tipos.some(t => t.includes(cleanFilter)) || t1.includes(cleanFilter) || t2.includes(cleanFilter);
        if (!match) {
          continue;
        }
      }

      candidates.push({
        id: pk.id,
        speciesId: pk.speciesId || pk.pokemonId || pk.pId || 1,
        nome: pk.nome || pk.name || 'Pokémon',
        nota: pkNota,
        level: Number(pk.level || pk.lvl || 1),
        potencia: Number(pk.potencia || 1),
        qualidade: Number(pk.qualidade || pk.quality || 0),
        tipo1: pk.tipo1 || pk.elemento || (Array.isArray(pk.tipos) ? pk.tipos[0] : '') || '',
        tipo2: pk.tipo2 || (Array.isArray(pk.tipos) && pk.tipos.length > 1 ? pk.tipos[1] : '') || ''
      });
    }

    candidates.sort((a, b) => a.nota - b.nota);

    window.postMessage({
      source: 'ROTOM_SNIPER',
      type: 'OFERENDA_CANDIDATES_RESULT',
      candidates: candidates,
      protectedCount: protectedCount,
      totalDepot: depotCount
    }, '*');
  }

  console.log('[PokéIdle Rotom Sniper]: Motor de Auto-Snipe e Telemetria pronto!');
})();