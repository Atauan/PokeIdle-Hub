// PokéIdle Auto-Sniper — Cockpit Controller v1.4.0
// Interface Standalone baseada 100% no Design System Oficial do PokéIdle

document.addEventListener('DOMContentLoaded', () => {
  console.log('[PokéIdle Cockpit]: Inicializando Cockpit oficial...');

  // Tratador global seguro e em conformidade estrita com CSP (Manifest V3) para fallback de imagens
  document.addEventListener('error', (e) => {
    if (e.target && e.target.tagName === 'IMG') {
      const img = e.target;
      if (img.dataset.hasFallback) {
        img.style.display = 'none';
        return;
      }
      img.dataset.hasFallback = 'true';
      if (img.classList.contains('log-item-icon')) {
        img.style.display = 'none';
      } else if (img.classList.contains('hunt-poke-sprite')) {
        img.src = 'https://pokeidle.io/assets/site/assets/ui/ball-poke.png';
      } else if (img.classList.contains('stat-drop-icon')) {
        img.src = 'icons/ouro.png';
      } else {
        img.src = 'https://pokeidle.io/assets/site/assets/ui/ball-poke.png';
      }
    }
  }, true);

  // Top Bar & Telemetria
  const valCoins = document.getElementById('val-coins');
  const valGemas = document.getElementById('val-gemas');
  const valDiamantes = document.getElementById('val-diamantes');
  const btnOpenDiamantesModal = document.getElementById('btn-open-diamantes-modal');
  const valSlots = document.getElementById('val-slots');
  const toggleMasterSniper = document.getElementById('toggle-master-sniper');
  const footerStatus = document.getElementById('footer-status');

  // Modal de Diamantes
  const modalDiamantes = document.getElementById('modal-diamantes');
  const btnCloseDiamantesModal = document.getElementById('btn-close-diamantes-modal');
  const btnCloseDiamantesModalBottom = document.getElementById('btn-close-diamantes-modal-bottom');
  const tabDiamanteComprar = document.getElementById('tab-diamante-comprar');
  const tabDiamanteVender = document.getElementById('tab-diamante-vender');
  const tabDiamanteRecarga = document.getElementById('tab-diamante-recarga');
  const panelDiamanteComprar = document.getElementById('panel-diamante-comprar');
  const panelDiamanteVender = document.getElementById('panel-diamante-vender');
  const panelDiamanteRecarga = document.getElementById('panel-diamante-recarga');
  const containerDiamantesOffers = document.getElementById('container-diamantes-offers');
  const btnRefreshDiamantesMarket = document.getElementById('btn-refresh-diamantes-market');
  const btnFilterDiamondsAll = document.getElementById('btn-filter-diamonds-all');
  const btnFilterDiamondsGold = document.getElementById('btn-filter-diamonds-gold');
  const btnFilterDiamondsGems = document.getElementById('btn-filter-diamonds-gems');
  const inputSellDiamantesQtd = document.getElementById('input-sell-diamantes-qtd');
  const inputSellDiamantesPreco = document.getElementById('input-sell-diamantes-preco');
  const selectSellDiamantesMoeda = document.getElementById('select-sell-diamantes-moeda');
  const boxSellDiamantesResumo = document.getElementById('box-sell-diamantes-resumo');
  const btnSubmitSellDiamantes = document.getElementById('btn-submit-sell-diamantes');

  // Filtros de Categoria & Formulário de Nova Regra
  const chipButtons = document.querySelectorAll('.chip-btn');
  const inputSearchItem = document.getElementById('input-search-item');
  const dropdownSuggestions = document.getElementById('dropdown-suggestions');
  const boxSelectedPreview = document.getElementById('box-selected-preview');
  const imgSelectedItem = document.getElementById('img-selected-item');
  const lblSelectedName = document.getElementById('lbl-selected-name');
  const lblSelectedCat = document.getElementById('lbl-selected-cat');
  const btnClearSelection = document.getElementById('btn-clear-selection');

  const inputRuleCoins = document.getElementById('input-rule-coins');
  const inputRuleGemas = document.getElementById('input-rule-gemas');
  const inputRuleQty = document.getElementById('input-rule-qty');
  const btnAddRule = document.getElementById('btn-add-rule');

  // Radar Global de Pokémon
  const chkGlobalShiny = document.getElementById('chk-global-shiny');
  const cfgShinyCoins = document.getElementById('cfg-shiny-coins');
  const cfgShinyGemas = document.getElementById('cfg-shiny-gemas');

  const chkGlobalP5 = document.getElementById('chk-global-p5');
  const cfgP5Coins = document.getElementById('cfg-p5-coins');
  const cfgP5Gemas = document.getElementById('cfg-p5-gemas');

  const chkGlobalNote = document.getElementById('chk-global-note');
  const cfgNoteVal = document.getElementById('cfg-note-val');
  const cfgNoteCoins = document.getElementById('cfg-note-coins');
  const cfgNoteGemas = document.getElementById('cfg-note-gemas');

  const lblRadarSlotBadge = document.getElementById('lbl-radar-slot-badge');
  const lblRadarSlotStatus = document.getElementById('lbl-radar-slot-status');
  const badgeVipStatus = document.getElementById('badge-vip-status');

  // Quantidade Infinita
  const btnToggleInfiniteNew = document.getElementById('btn-toggle-infinite-new');
  const btnToggleInfiniteEdit = document.getElementById('btn-toggle-infinite-edit');
  const lblInputQtyTitle = document.getElementById('lbl-input-qty-title');
  const lblEditQtyTitle = document.getElementById('lbl-edit-qty-title');

  // Lista de Regras & Contadores
  const containerRulesList = document.getElementById('container-rules-list');
  const lblRulesCount = document.getElementById('lbl-rules-count');

  // Terminal de Logs
  const containerLogsList = document.getElementById('container-logs-list');
  const btnClearLogs = document.getElementById('btn-clear-logs');

  // Modal de Edição
  const modalEditRule = document.getElementById('modal-edit-rule');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCancelModal = document.getElementById('btn-cancel-modal');
  const btnSaveModal = document.getElementById('btn-save-modal');
  const editRuleName = document.getElementById('edit-rule-name');
  const editRuleCoins = document.getElementById('edit-rule-coins');
  const editRuleGemas = document.getElementById('edit-rule-gemas');
  const editRuleQty = document.getElementById('edit-rule-qty');
  const editRuleActive = document.getElementById('edit-rule-active');
  const lblEditBought = document.getElementById('lbl-edit-bought');
  const btnResetBought = document.getElementById('btn-reset-bought');

  // Constantes de Slots
  const MAX_BASIC_SLOTS = 5;
  const MAX_VIP_SLOTS = 15;
  const MAX_BASIC_QTY = 20;

  // Estado VIP e Infinito
  let isPlayerVip = false;
  let newRuleIsInfinite = false;
  let editRuleIsInfinite = false;

  function getMaxSlots() {
    return isPlayerVip ? MAX_VIP_SLOTS : MAX_BASIC_SLOTS;
  }

  // Estado Local
  let isSniperEnabled = true;
  let sniperRules = [];
  let sniperLogs = [];
  let selectedItemObj = null;
  let currentFilterCat = 'all';
  let editingRuleId = null;

  // Estado do Mercado da Comunidade
  let myListings = [];
  let communityCatalog = {};
  let currentItemOffersData = null;
  let currentMarketFilterCat = 'all';
  let currentOffersMoeda = 'gold';
  let selectedMarketItem = null;

  let globalConfig = {
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
    autoMaxAffordable: true
  };

  // Helpers de Slots da Versão Basic (Cada Auto-Snipe no Radar = 1 Slot)
  function getRadarSlotsCount() {
    let count = 0;
    const shinyOn = chkGlobalShiny ? chkGlobalShiny.checked : Boolean(globalConfig && globalConfig.snipeAnyShiny);
    const p5On = chkGlobalP5 ? chkGlobalP5.checked : Boolean(globalConfig && globalConfig.snipeAnyP5);
    const noteOn = chkGlobalNote ? chkGlobalNote.checked : Boolean(globalConfig && globalConfig.snipeByNote);

    if (shinyOn) count++;
    if (p5On) count++;
    if (noteOn) count++;
    return count;
  }

  function isRadarActive() {
    return getRadarSlotsCount() > 0;
  }

  function getActiveRulesCount() {
    return sniperRules.filter(r => r.active).length;
  }

  function getUsedSlotsCount() {
    return getActiveRulesCount() + getRadarSlotsCount();
  }

  function updateSlotsDisplay() {
    const maxSlots = getMaxSlots();
    const activeRules = getActiveRulesCount();
    const radarSlots = getRadarSlotsCount();
    const totalUsed = activeRules + radarSlots;

    if (badgeVipStatus) {
      badgeVipStatus.style.display = isPlayerVip ? 'inline-block' : 'none';
    }

    if (valSlots) {
      valSlots.textContent = `${totalUsed} / ${maxSlots} SLOTS ATIVOS${isPlayerVip ? ' (VIP)' : ''}`;
      if (totalUsed >= maxSlots) {
        valSlots.style.color = '#ffd166';
      } else {
        valSlots.style.color = 'var(--rx-luz)';
      }
    }

    if (lblRulesCount) {
      lblRulesCount.textContent = `${totalUsed} de ${maxSlots} slots utilizados`;
      if (totalUsed >= maxSlots) {
        lblRulesCount.style.color = 'var(--ouro)';
        lblRulesCount.style.fontWeight = '700';
      } else {
        lblRulesCount.style.color = 'var(--sobre-mad-dim)';
        lblRulesCount.style.fontWeight = '400';
      }
    }

    if (lblRadarSlotBadge) {
      lblRadarSlotBadge.textContent = `${radarSlots} / 3 Slots Usados`;
      lblRadarSlotBadge.style.color = radarSlots > 0 ? 'var(--ouro)' : 'var(--sobre-mad-dim)';
    }

    if (lblRadarSlotStatus) {
      if (radarSlots > 0) {
        lblRadarSlotStatus.textContent = `Ativo (${radarSlots} slot${radarSlots > 1 ? 's' : ''} em uso)`;
        lblRadarSlotStatus.style.color = 'var(--ouro)';
      } else {
        lblRadarSlotStatus.textContent = 'Inativo (0 slots)';
        lblRadarSlotStatus.style.color = 'var(--sobre-mad-dim)';
      }
    }

    // Atualiza botões infinitos conforme status VIP
    if (btnToggleInfiniteNew) {
      if (newRuleIsInfinite) {
        btnToggleInfiniteNew.classList.remove('apagado');
        btnToggleInfiniteNew.classList.add('btn-roxo', 'on');
        btnToggleInfiniteNew.textContent = '✓ ∞ Ativo';
      } else {
        btnToggleInfiniteNew.classList.remove('btn-roxo', 'on');
        btnToggleInfiniteNew.classList.add('apagado');
        btnToggleInfiniteNew.textContent = isPlayerVip ? '∞ Infinito' : '🔒 ∞';
      }
    }

    if (btnToggleInfiniteEdit) {
      if (editRuleIsInfinite) {
        btnToggleInfiniteEdit.classList.remove('apagado');
        btnToggleInfiniteEdit.classList.add('btn-roxo', 'on');
        btnToggleInfiniteEdit.textContent = '✓ ∞ Ativo';
      } else {
        btnToggleInfiniteEdit.classList.remove('btn-roxo', 'on');
        btnToggleInfiniteEdit.classList.add('apagado');
        btnToggleInfiniteEdit.textContent = isPlayerVip ? '∞ Infinito' : '🔒 ∞';
      }
    }

    if (lblInputQtyTitle) {
      lblInputQtyTitle.textContent = isPlayerVip
        ? (newRuleIsInfinite ? 'Quantidade: Infinita (Sem limite)' : 'Quantidade Máxima:')
        : 'Quantidade Máxima (Máx 20 un):';
    }

    if (lblEditQtyTitle) {
      lblEditQtyTitle.textContent = isPlayerVip
        ? (editRuleIsInfinite ? 'Quantidade: Infinita (Sem limite)' : 'Quantidade Máxima:')
        : 'Quantidade Máxima (Máx 20 un):';
    }
  }

  function setInfiniteNew(infinite) {
    if (infinite && !isPlayerVip) {
      alert('Benefício VIP PokéIdle!\n\nA compra de quantidade infinita é exclusiva para treinadores com VIP ativo no PokéIdle.\n\nNa versão Básica, o limite é de até 20 unidades por regra.');
      return;
    }
    newRuleIsInfinite = Boolean(infinite);
    if (inputRuleQty) {
      if (newRuleIsInfinite) {
        inputRuleQty.value = '99999';
        inputRuleQty.disabled = true;
        inputRuleQty.style.opacity = '0.5';
      } else {
        inputRuleQty.disabled = false;
        inputRuleQty.style.opacity = '1';
        if (inputRuleQty.value === '99999' || (!isPlayerVip && Number(inputRuleQty.value) > 20)) {
          inputRuleQty.value = '20';
        }
      }
    }
    updateSlotsDisplay();
  }

  function setInfiniteEdit(infinite) {
    if (infinite && !isPlayerVip) {
      alert('Benefício VIP PokéIdle!\n\nA compra de quantidade infinita é exclusiva para treinadores com VIP ativo no PokéIdle.\n\nNa versão Básica, o limite é de até 20 unidades por regra.');
      return;
    }
    editRuleIsInfinite = Boolean(infinite);
    if (editRuleQty) {
      if (editRuleIsInfinite) {
        editRuleQty.value = '99999';
        editRuleQty.disabled = true;
        editRuleQty.style.opacity = '0.5';
      } else {
        editRuleQty.disabled = false;
        editRuleQty.style.opacity = '1';
        if (editRuleQty.value === '99999' || (!isPlayerVip && Number(editRuleQty.value) > 20)) {
          editRuleQty.value = '20';
        }
      }
    }
    updateSlotsDisplay();
  }

  if (btnToggleInfiniteNew) {
    btnToggleInfiniteNew.addEventListener('click', () => {
      setInfiniteNew(!newRuleIsInfinite);
    });
  }

  if (btnToggleInfiniteEdit) {
    btnToggleInfiniteEdit.addEventListener('click', () => {
      setInfiniteEdit(!editRuleIsInfinite);
    });
  }

  // =========================================================================
  // 1. SALDO E CABEÇALHO
  // =========================================================================
  function updateBalanceDisplay(gold, gems, diamonds) {
    if (valCoins) {
      if (typeof gold === 'number' && gold >= 0) {
        valCoins.textContent = `${gold.toLocaleString()} GP`;
      } else {
        valCoins.textContent = '-- GP';
      }
    }
    if (valGemas) {
      if (typeof gems === 'number' && gems >= 0) {
        valGemas.textContent = `${gems.toLocaleString()} Gemas`;
      } else {
        valGemas.textContent = '-- Gemas';
      }
    }
    if (valDiamantes) {
      if (typeof diamonds === 'number' && diamonds >= 0) {
        valDiamantes.textContent = `${diamonds.toLocaleString()} Diamantes`;
      } else {
        valDiamantes.textContent = '-- Diamantes';
      }
    }
  }

  function updateFooter(msg) {
    if (footerStatus && msg) {
      footerStatus.textContent = msg;
    }
  }

  // =========================================================================
  // 2. FILTROS RÁPIDOS DE CATEGORIA & AUTOCOMPLETE
  // =========================================================================
  chipButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      chipButtons.forEach(b => {
        b.classList.remove('on');
        b.classList.add('apagado');
      });
      btn.classList.add('on');
      btn.classList.remove('apagado');
      currentFilterCat = btn.getAttribute('data-cat') || 'all';
      renderSuggestions(inputSearchItem ? inputSearchItem.value.trim() : '');
    });
  });

  function renderSuggestions(query) {
    if (!dropdownSuggestions) return;
    const q = (query || '').toLowerCase().trim();

    let items = [];
    if (typeof window.searchRotomItems === 'function') {
      items = window.searchRotomItems(q, currentFilterCat);
    }

    if (items.length === 0) {
      dropdownSuggestions.style.display = 'none';
      dropdownSuggestions.innerHTML = '';
      return;
    }

    dropdownSuggestions.innerHTML = '';
    items.slice(0, 80).forEach(it => {
      const row = document.createElement('div');
      row.className = 'sug-item';

      const iconUrl = typeof window.getItemIconUrl === 'function'
        ? window.getItemIconUrl(it)
        : (it.icon || '');

      row.innerHTML = `
        <img src="${iconUrl}" class="sug-img">
        <span class="sug-text">${it.name}</span>
        <span class="sug-cat">${it.categoryLabel || it.category || 'item'}</span>
      `;

      const sugImg = row.querySelector('.sug-img');
      if (sugImg) {
        sugImg.addEventListener('error', () => { sugImg.style.display = 'none'; });
      }

      row.addEventListener('click', () => {
        selectItem(it);
        dropdownSuggestions.style.display = 'none';
      });

      dropdownSuggestions.appendChild(row);
    });

    dropdownSuggestions.style.display = 'flex';
  }

  function selectItem(it) {
    selectedItemObj = it;
    if (inputSearchItem) inputSearchItem.value = it.name;
    if (boxSelectedPreview) boxSelectedPreview.style.display = 'flex';
    if (lblSelectedName) lblSelectedName.textContent = it.name;
    if (lblSelectedCat) lblSelectedCat.textContent = (it.categoryLabel || it.category || 'item').toUpperCase();

    if (imgSelectedItem) {
      imgSelectedItem.style.display = 'block';
      imgSelectedItem.src = typeof window.getItemIconUrl === 'function'
        ? window.getItemIconUrl(it)
        : (it.icon || '');
    }
  }

  if (btnClearSelection) {
    btnClearSelection.addEventListener('click', () => {
      selectedItemObj = null;
      if (inputSearchItem) inputSearchItem.value = '';
      if (boxSelectedPreview) boxSelectedPreview.style.display = 'none';
      if (dropdownSuggestions) dropdownSuggestions.style.display = 'none';
    });
  }

  if (inputSearchItem) {
    inputSearchItem.addEventListener('input', (e) => {
      renderSuggestions(e.target.value);
    });

    inputSearchItem.addEventListener('focus', (e) => {
      renderSuggestions(e.target.value);
    });

    document.addEventListener('click', (e) => {
      if (dropdownSuggestions && !dropdownSuggestions.contains(e.target) && e.target !== inputSearchItem) {
        dropdownSuggestions.style.display = 'none';
      }
    });
  }

  // =========================================================================
  // 3. CADASTRO DE NOVA REGRA
  // =========================================================================
  if (btnAddRule) {
    btnAddRule.addEventListener('click', () => {
      const rawName = inputSearchItem ? inputSearchItem.value.trim() : '';
      if (!selectedItemObj && !rawName) {
        alert('Por favor, selecione ou digite um item para cadastrar.');
        return;
      }

      const coins = inputRuleCoins ? (Number(inputRuleCoins.value) || 0) : 0;
      const gemas = inputRuleGemas ? (Number(inputRuleGemas.value) || 0) : 0;
      const rawQty = inputRuleQty ? inputRuleQty.value.trim() : '1';
      const maxSlots = getMaxSlots();
      let qty = newRuleIsInfinite ? 99999 : (Number(rawQty) || 1);

      if (!isPlayerVip && !newRuleIsInfinite && (qty <= 0 || qty > MAX_BASIC_QTY)) {
        alert(`Na versão Basic, a quantidade máxima permitida é de 1 a ${MAX_BASIC_QTY} unidades por regra.`);
        qty = Math.min(Math.max(qty, 1), MAX_BASIC_QTY);
        if (inputRuleQty) inputRuleQty.value = String(qty);
        return;
      }

      if (coins <= 0 && gemas <= 0) {
        alert('Defina ao menos um teto de preço (Coins ou Gemas).');
        return;
      }

      const totalUsed = getUsedSlotsCount();
      let ruleActive = true;
      if (totalUsed >= maxSlots) {
        ruleActive = false;
        alert(`Regra cadastrada como PAUSADA!\n\nVocê já está usando o limite de ${maxSlots} slots ativos. Desative uma regra ou o Radar de Pokémon para ativá-la.`);
      }

      let targetId = selectedItemObj ? selectedItemObj.id : 0;
      let targetName = selectedItemObj ? selectedItemObj.name : rawName;
      const targetType = (selectedItemObj && selectedItemObj.category === 'pokemon') ? 'pokemon' : 'item';

      const matchedDbItem = selectedItemObj || (typeof window.getRotomItem === 'function' ? (window.getRotomItem(targetId) || window.getRotomItem(targetName)) : null);
      if (!targetId && matchedDbItem) {
        targetId = matchedDbItem.id;
        targetName = matchedDbItem.name;
      }
      const targetIcon = (matchedDbItem && matchedDbItem.icon) ? matchedDbItem.icon : '';

      const newRule = {
        id: 'rule_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        targetType: targetType,
        targetId: targetId,
        targetName: targetName,
        icon: targetIcon,
        maxPriceGold: coins,
        maxPriceGems: gemas,
        maxPriceDiamonds: gemas, // Compatibilidade com pacotes legados
        infinite: Boolean(newRuleIsInfinite),
        maxQty: qty,
        totalBought: 0,
        active: ruleActive,
        createdAt: Date.now()
      };

      sniperRules.push(newRule);
      saveAndSyncRules();

      // Limpar campos
      setInfiniteNew(false);
      selectedItemObj = null;
      if (inputSearchItem) inputSearchItem.value = '';
      if (boxSelectedPreview) boxSelectedPreview.style.display = 'none';
      if (inputRuleCoins) inputRuleCoins.value = '';
      if (inputRuleGemas) inputRuleGemas.value = '';
      if (inputRuleQty) inputRuleQty.value = '1';
    });
  }

  // =========================================================================
  // 4. RENDERIZAÇÃO DA LISTA DE REGRAS
  // =========================================================================
  function renderRules() {
    if (!containerRulesList) return;
    updateSlotsDisplay();

    if (sniperRules.length === 0) {
      containerRulesList.innerHTML = `
        <div style="text-align: center; padding: 40px 10px; color: var(--sobre-mad-dim);">
          Nenhuma regra cadastrada. Cadastre até 5 regras no painel à esquerda.
        </div>
      `;
      return;
    }

    containerRulesList.innerHTML = '';
    sniperRules.forEach(rule => {
      const card = document.createElement('div');
      card.className = 'vao rule-card';

      const iconUrl = typeof window.getItemIconUrl === 'function'
        ? window.getItemIconUrl(rule)
        : '';

      const coinsText = rule.maxPriceGold > 0 ? `${rule.maxPriceGold.toLocaleString('pt-BR')} GP` : '';
      const gemasText = (rule.maxPriceGems > 0 || rule.maxPriceDiamonds > 0)
        ? `${(rule.maxPriceGems || rule.maxPriceDiamonds).toLocaleString('pt-BR')} Gemas`
        : '';
      const prices = [coinsText, gemasText].filter(Boolean).join(' | ') || 'Sem teto';

      const bought = rule.totalBought || 0;
      const isInf = Boolean(rule.infinite || rule.maxQty >= 99999);
      let pct = 0;
      let qtyText = '';

      if (isInf) {
        pct = 100;
        qtyText = `${bought} / ∞`;
      } else {
        const maxQ = (rule.maxQty !== undefined && rule.maxQty > 0) ? (isPlayerVip ? rule.maxQty : Math.min(rule.maxQty, MAX_BASIC_QTY)) : MAX_BASIC_QTY;
        pct = Math.min(100, Math.round((bought / maxQ) * 100));
        qtyText = `${bought} / ${maxQ}`;
      }

      card.innerHTML = `
        <div class="rule-card-top">
          <div class="rule-target-info">
            <img src="${iconUrl}" class="rule-icon">
            <div class="rule-name-box">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span class="rule-name">${rule.targetName}</span>
              </div>
              <span class="rule-meta">${prices}</span>
            </div>
          </div>
          <div class="rule-actions-group">
            <label style="display: flex; align-items: center; cursor: pointer;" title="Ativar ou pausar regra">
              <input type="checkbox" class="chk-rule-toggle chk-mini" ${rule.active ? 'checked' : ''}>
            </label>
          </div>
        </div>

        <div class="rule-card-bottom">
          <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
            <div class="rule-progress-bar">
              <div class="rule-progress-fill" style="width: ${pct}%; ${isInf ? 'background: linear-gradient(180deg, #9fe4ff, #2f8fc4);' : ''}"></div>
            </div>
            <span style="font-size: 9.5px; color: ${isInf ? 'var(--vip-luz, #9fe4ff)' : 'var(--sobre-mad-dim)'}; font-variant-numeric: tabular-nums; flex: none;">
              ${qtyText}
            </span>
          </div>

          <div style="display: flex; gap: 4px;">
            <button type="button" class="btn apagado btn-mini btn-edit-rule">Editar</button>
            <button type="button" class="btn apagado btn-mini btn-del-rule">Excluir</button>
          </div>
        </div>
      `;

      const rImg = card.querySelector('.rule-icon');
      if (rImg) {
        rImg.addEventListener('error', () => { rImg.style.display = 'none'; });
      }

      // Toggle ativo com verificação estrita de slots
      const chkToggle = card.querySelector('.chk-rule-toggle');
      if (chkToggle) {
        chkToggle.addEventListener('change', (e) => {
          const maxSlots = getMaxSlots();
          if (e.target.checked) {
            if (getUsedSlotsCount() >= maxSlots) {
              e.target.checked = false;
              rule.active = false;
              alert(`Limite de ${maxSlots} slots ativos atingido!\n\nDesative outra regra ou o Radar de Pokémon para liberar um slot.`);
              return;
            }
            rule.active = true;
          } else {
            rule.active = false;
          }
          saveAndSyncRules();
          updateSlotsDisplay();
        });
      }

      // Editar
      const btnEdit = card.querySelector('.btn-edit-rule');
      if (btnEdit) {
        btnEdit.addEventListener('click', () => {
          openEditModal(rule);
        });
      }

      // Excluir
      const btnDel = card.querySelector('.btn-del-rule');
      if (btnDel) {
        btnDel.addEventListener('click', () => {
          if (confirm(`Excluir regra de compra de ${rule.targetName}?`)) {
            sniperRules = sniperRules.filter(r => r.id !== rule.id);
            saveAndSyncRules();
          }
        });
      }

      containerRulesList.appendChild(card);
    });
  }

  // =========================================================================
  // 5. MODAL DE EDIÇÃO DE REGRA
  // =========================================================================
  function openEditModal(rule) {
    if (!modalEditRule) return;
    editingRuleId = rule.id;

    if (editRuleName) editRuleName.value = rule.targetName || '';
    if (editRuleCoins) editRuleCoins.value = rule.maxPriceGold || '';
    if (editRuleGemas) editRuleGemas.value = rule.maxPriceGems || rule.maxPriceDiamonds || '';
    
    const isInf = Boolean(rule.infinite || rule.maxQty >= 99999);
    setInfiniteEdit(isInf);
    if (!isInf && editRuleQty) {
      editRuleQty.value = (rule.maxQty !== undefined && rule.maxQty > 0) ? (isPlayerVip ? rule.maxQty : Math.min(rule.maxQty, MAX_BASIC_QTY)) : 1;
    }

    if (lblEditBought) lblEditBought.textContent = `${rule.totalBought || 0} unidades`;
    if (editRuleActive) editRuleActive.checked = Boolean(rule.active);

    modalEditRule.classList.add('open');
  }

  function closeEditModal() {
    if (!modalEditRule) return;
    editingRuleId = null;
    modalEditRule.classList.remove('open');
  }

  if (btnCloseModal) btnCloseModal.addEventListener('click', closeEditModal);
  if (btnCancelModal) btnCancelModal.addEventListener('click', closeEditModal);

  if (btnResetBought) {
    btnResetBought.addEventListener('click', () => {
      if (!editingRuleId) return;
      const rule = sniperRules.find(r => r.id === editingRuleId);
      if (rule) {
        rule.totalBought = 0;
        if (lblEditBought) lblEditBought.textContent = '0 unidades';
        saveAndSyncRules();
      }
    });
  }

  if (btnSaveModal) {
    btnSaveModal.addEventListener('click', () => {
      if (!editingRuleId) return;
      const rule = sniperRules.find(r => r.id === editingRuleId);
      if (!rule) return;

      const coins = editRuleCoins ? (Number(editRuleCoins.value) || 0) : 0;
      const gemas = editRuleGemas ? (Number(editRuleGemas.value) || 0) : 0;
      const rawQty = editRuleQty ? editRuleQty.value.trim() : '1';
      let qty = editRuleIsInfinite ? 99999 : (Number(rawQty) || 1);

      if (!isPlayerVip && !editRuleIsInfinite && (qty <= 0 || qty > MAX_BASIC_QTY)) {
        alert(`Na versão Basic, a quantidade máxima permitida é de 1 a ${MAX_BASIC_QTY} unidades.`);
        qty = Math.min(Math.max(qty, 1), MAX_BASIC_QTY);
        if (editRuleQty) editRuleQty.value = String(qty);
        return;
      }

      if (coins <= 0 && gemas <= 0) {
        alert('Defina ao menos um teto de preço (Coins ou Gemas).');
        return;
      }

      const wantActive = editRuleActive ? editRuleActive.checked : rule.active;
      const maxSlots = getMaxSlots();
      if (wantActive && !rule.active) {
        if (getUsedSlotsCount() >= maxSlots) {
          alert(`Limite de ${maxSlots} slots ativos atingido!\n\nDesative outra regra ou o Radar de Pokémon para ativar esta.`);
          if (editRuleActive) editRuleActive.checked = false;
          return;
        }
      }

      rule.maxPriceGold = coins;
      rule.maxPriceGems = gemas;
      rule.maxPriceDiamonds = gemas;
      rule.infinite = Boolean(editRuleIsInfinite);
      rule.maxQty = qty;
      rule.active = wantActive;

      saveAndSyncRules();
      renderRules();
      closeEditModal();
    });
  }

  // =========================================================================
  // 6. TERMINAL DE LOGS DO MERCADO
  // =========================================================================
  function renderLogs() {
    if (!containerLogsList) return;

    if (sniperLogs.length === 0) {
      containerLogsList.innerHTML = `
        <div style="text-align: center; padding: 30px 10px; color: var(--vao-dim); font-size: 10px;">
          Aguardando anúncios do mercado...
        </div>
      `;
      return;
    }

    containerLogsList.innerHTML = '';
    sniperLogs.slice(0, 50).forEach(l => {
      const row = document.createElement('div');
      row.className = 'log-row';

      const st = (l.status || '').toLowerCase();
      let statusClass = 'sucesso';
      if (st.includes('disparado') || st.includes('comprando')) statusClass = 'disparado';
      else if (st.includes('agendado') || st.includes('limite') || st.includes('slot')) statusClass = 'aviso';
      else if (st.includes('erro') || st.includes('falhou') || st.includes('rejeitado') || st.includes('recusado')) statusClass = 'erro';

      const d = new Date(l.timestamp || Date.now());
      const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;

      // 1. Resolução humanizada do nome do Item (corrige qualquer Item #ID legado se existir)
      let targetName = l.targetName || 'Item';
      if (targetName.startsWith('Item #')) {
        const matchId = targetName.match(/\d+/);
        if (matchId && typeof getRotomItem === 'function') {
          const found = getRotomItem(Number(matchId[0]));
          if (found && found.name) {
            targetName = found.name;
          }
        }
      }

      // 2. Extração do vendedor (campo seller direto ou parsing de log legado)
      let seller = String(l.seller || '').trim();
      if (!seller && l.details) {
        const sellerMatch = l.details.match(/de @([a-zA-Z0-9_-]+)/i) || l.details.match(/vendedor:?\s*@?([a-zA-Z0-9_-]+)/i);
        if (sellerMatch) seller = sellerMatch[1];
      }

      // 3. Formatação monetária limpa e humanizada
      const qtyNum = Number(l.qty || 1);
      const curr = String(l.currency || 'gold').toLowerCase();
      const isGemas = (curr === 'orb' || curr === 'orbs' || curr === 'gemas' || curr === 'gema');
      const currLabel = isGemas ? 'Gemas' : 'Coins';
      const unitPrice = Number(l.price || 0).toLocaleString('pt-BR');
      const totalPrice = (qtyNum * Number(l.price || 0)).toLocaleString('pt-BR');

      let priceSummary = '';
      if (l.price) {
        priceSummary = qtyNum > 1
          ? `${qtyNum}x a ${unitPrice} ${currLabel} (Total: ${totalPrice})`
          : `${unitPrice} ${currLabel}`;
      }

      // 4. Limpeza e humanização dos detalhes (remove jargões robóticos legados)
      let cleanDetails = String(l.details || '').trim();
      cleanDetails = cleanDetails.replace(/^Ordem enviada ao servidor via\s*/i, '');
      cleanDetails = cleanDetails.replace(/^Regra Item:\s*/i, 'Regra: ');
      cleanDetails = cleanDetails.replace(/^Regra Pokemon:\s*/i, 'Regra: ');

      // Ícone do item se existir no catálogo oficial
      let iconHtml = '';
      if (typeof getRotomItem === 'function') {
        const itemObj = getRotomItem(targetName);
        if (itemObj && typeof getItemIconUrl === 'function') {
          const iconUrl = getItemIconUrl(itemObj);
          if (iconUrl) {
            iconHtml = `<img src="${iconUrl}" class="log-item-icon" alt="">`;
          }
        }
      }

      row.innerHTML = `
        <div class="log-row-top">
          <div class="log-target-group">
            <span class="log-time">[${timeStr}]</span>
            ${iconHtml}
            <span class="log-target" title="${targetName}">${targetName}</span>
            ${seller ? `<span class="log-seller" title="Vendedor: ${seller}">de <b>@${seller}</b></span>` : ''}
          </div>
          <span class="log-status-tag ${statusClass}">${l.status || 'OK'}</span>
        </div>
        <div class="log-detail">
          ${priceSummary ? `<span class="log-price">${priceSummary}</span>` : ''}
          ${priceSummary && cleanDetails ? ' · ' : ''}
          <span class="log-desc">${cleanDetails}</span>
        </div>
      `;

      containerLogsList.appendChild(row);
    });
  }

  if (btnClearLogs) {
    btnClearLogs.addEventListener('click', () => {
      sniperLogs = [];
      renderLogs();
      sendToActiveTab({ action: 'CLEAR_SNIPER_LOGS' });
    });
  }

  // =========================================================================
  // 7. SINCRONIZAÇÃO COM CHROME STORAGE E ABA ATIVA
  // =========================================================================
  function saveAndSyncRules() {
    renderRules();
    sendToActiveTab({ action: 'UPDATE_SNIPER_RULES', rules: sniperRules });
  }

  function saveAndSyncConfig() {
    sendToActiveTab({ action: 'UPDATE_SNIPER_CONFIG', config: globalConfig });
  }

  function sendToActiveTab(message) {
    // 1. Salva imediatamente no chrome.storage.local (ativa reativamente o onChanged em todas as abas/janelas)
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      if (message.action === 'UPDATE_SNIPER_RULES') {
        chrome.storage.local.set({ rotom_sniper_rules: message.rules });
      } else if (message.action === 'UPDATE_SNIPER_CONFIG') {
        chrome.storage.local.set({ rotom_sniper_config: message.config });
      } else if (message.action === 'SET_SNIPER_ENABLED') {
        chrome.storage.local.set({ rotom_sniper_enabled: message.enabled });
      } else if (message.action === 'CLEAR_SNIPER_LOGS') {
        chrome.storage.local.set({ rotom_sniper_logs: [] });
      } else if (message.action === 'FETCH_OFERENDA_CANDIDATES') {
        chrome.storage.local.set({ rotom_action_fetch_oferendas: { ts: Date.now(), maxNota: message.maxNota, elemento: message.elemento } });
      } else if (message.action === 'EXECUTE_OFERENDA_BATCH') {
        chrome.storage.local.set({ rotom_action_execute_oferendas: { ts: Date.now(), pokemonIds: message.pokemonIds, pacingMs: message.pacingMs } });
      }
    }

    // 2. Dispara mensagem diretamente para TODAS as abas abertas do PokéIdle (independente de janela)
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({}, (tabs) => {
        if (Array.isArray(tabs)) {
          tabs.forEach(t => {
            const isPokeidle = t && t.url && (t.url.includes('pokeidle.io') || t.url.includes('pokeidle'));
            if (isPokeidle && t.id) {
              chrome.tabs.sendMessage(t.id, message, () => {
                if (chrome.runtime && chrome.runtime.lastError) {}
              });
            }
          });
        }
      });
    }
  }

  // Master Toggle
  if (toggleMasterSniper) {
    toggleMasterSniper.addEventListener('change', (e) => {
      isSniperEnabled = e.target.checked;
      updateFooter(isSniperEnabled ? 'Varrendo mercado da comunidade automaticamente...' : 'Auto-Sniper pausado pelo usuário.');
      sendToActiveTab({ action: 'SET_SNIPER_ENABLED', enabled: isSniperEnabled });
    });
  }

  // Configuração Global de Pokémon
  function bindGlobalConfig() {
    const bindRadarCheck = (el, prop) => {
      if (el) {
        el.addEventListener('change', (e) => {
          const willBeActive = e.target.checked;

          if (willBeActive) {
            const maxSlots = getMaxSlots();
            globalConfig[prop] = true;
            const futureTotal = getActiveRulesCount() + getRadarSlotsCount();
            if (futureTotal > maxSlots) {
              e.target.checked = false;
              globalConfig[prop] = false;
              alert(`Limite de ${maxSlots} slots atingido!\n\nCada auto-snipe do Radar consome 1 slot. Desative uma regra de compra ou outro filtro do Radar para poder ativar este.`);
              updateSlotsDisplay();
              return;
            }
          } else {
            globalConfig[prop] = false;
          }

          saveAndSyncConfig();
          updateSlotsDisplay();
        });
      }
    };

    const bindNum = (el, prop, propCompat) => {
      if (el) {
        const update = (e) => {
          const raw = String(e.target.value || '').trim();
          const val = raw === '' ? 0 : (Number(raw) || 0);
          globalConfig[prop] = val;
          if (propCompat) globalConfig[propCompat] = val;
          saveAndSyncConfig();
        };
        el.addEventListener('input', update);
        el.addEventListener('change', update);
      }
    };

    bindRadarCheck(chkGlobalShiny, 'snipeAnyShiny');
    bindNum(cfgShinyCoins, 'maxPriceShinyGold');
    bindNum(cfgShinyGemas, 'maxPriceShinyGems', 'maxPriceShinyDiamonds');

    bindRadarCheck(chkGlobalP5, 'snipeAnyP5');
    bindNum(cfgP5Coins, 'maxPriceP5Gold');
    bindNum(cfgP5Gemas, 'maxPriceP5Gems', 'maxPriceP5Diamonds');

    bindRadarCheck(chkGlobalNote, 'snipeByNote');
    bindNum(cfgNoteVal, 'minNote');
    bindNum(cfgNoteCoins, 'maxPriceNoteGold');
    bindNum(cfgNoteGemas, 'maxPriceNoteGems', 'maxPriceNoteDiamonds');

  }
  bindGlobalConfig();

  function applyConfigToUI(cfg) {
    if (!cfg) return;
    globalConfig = Object.assign(globalConfig, cfg);
    globalConfig.autoMaxAffordable = true; // Calibração nativa

    // Sanitização de migração de defaults legados (10 ou 25 gemas antigos herdados):
    if (globalConfig.maxPriceShinyGems === 10 && (!cfgShinyGemas || !cfgShinyGemas.value)) {
      globalConfig.maxPriceShinyGems = 0;
      globalConfig.maxPriceShinyDiamonds = 0;
    }
    if (globalConfig.maxPriceP5Gems === 25 && (!cfgP5Gemas || !cfgP5Gemas.value)) {
      globalConfig.maxPriceP5Gems = 0;
      globalConfig.maxPriceP5Diamonds = 0;
    }
    if (globalConfig.maxPriceNoteGems === 10 && (!cfgNoteGemas || !cfgNoteGemas.value)) {
      globalConfig.maxPriceNoteGems = 0;
      globalConfig.maxPriceNoteDiamonds = 0;
    }

    if (chkGlobalShiny) chkGlobalShiny.checked = Boolean(globalConfig.snipeAnyShiny);
    if (cfgShinyCoins) cfgShinyCoins.value = (globalConfig.maxPriceShinyGold > 0) ? globalConfig.maxPriceShinyGold : '';
    if (cfgShinyGemas) cfgShinyGemas.value = (globalConfig.maxPriceShinyGems > 0 ? globalConfig.maxPriceShinyGems : (globalConfig.maxPriceShinyDiamonds > 0 ? globalConfig.maxPriceShinyDiamonds : ''));

    if (chkGlobalP5) chkGlobalP5.checked = Boolean(globalConfig.snipeAnyP5);
    if (cfgP5Coins) cfgP5Coins.value = (globalConfig.maxPriceP5Gold > 0) ? globalConfig.maxPriceP5Gold : '';
    if (cfgP5Gemas) cfgP5Gemas.value = (globalConfig.maxPriceP5Gems > 0 ? globalConfig.maxPriceP5Gems : (globalConfig.maxPriceP5Diamonds > 0 ? globalConfig.maxPriceP5Diamonds : ''));

    if (chkGlobalNote) chkGlobalNote.checked = Boolean(globalConfig.snipeByNote);
    if (cfgNoteVal && globalConfig.minNote !== undefined) cfgNoteVal.value = globalConfig.minNote;
    if (cfgNoteCoins) cfgNoteCoins.value = (globalConfig.maxPriceNoteGold > 0) ? globalConfig.maxPriceNoteGold : '';
    if (cfgNoteGemas) cfgNoteGemas.value = (globalConfig.maxPriceNoteGems > 0 ? globalConfig.maxPriceNoteGems : (globalConfig.maxPriceNoteDiamonds > 0 ? globalConfig.maxPriceNoteDiamonds : ''));

    updateSlotsDisplay();
  }

  // Carregamento inicial do Storage
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get([
      'rotom_sniper_enabled',
      'rotom_sniper_rules',
      'rotom_sniper_config',
      'rotom_sniper_logs',
      'rotom_player_gold',
      'rotom_player_orbs',
      'rotom_player_diamonds',
      'rotom_player_vip',
      'rotom_my_listings',
      'rotom_market_catalog',
      'rotom_item_offers'
    ], (result) => {
      if (result.rotom_player_vip !== undefined) {
        isPlayerVip = Boolean(result.rotom_player_vip);
        updateSlotsDisplay();
      }
      if (result.rotom_sniper_enabled !== undefined) {
        isSniperEnabled = Boolean(result.rotom_sniper_enabled);
        if (toggleMasterSniper) toggleMasterSniper.checked = isSniperEnabled;
      }
      if (Array.isArray(result.rotom_sniper_rules)) {
        let needsSync = false;
        sniperRules = result.rotom_sniper_rules.map(r => {
          const isJunkIcon = !r.icon || r.icon.indexOf('icon16') !== -1 || r.icon.indexOf('icon48') !== -1 || r.icon.indexOf('icons/') !== -1;
          if (typeof window.getRotomItem === 'function') {
            const it = window.getRotomItem(r.targetId) || window.getRotomItem(r.targetName);
            if (it && it.icon && (isJunkIcon || r.icon !== it.icon)) {
              r.icon = it.icon;
              needsSync = true;
            }
          }

          // Garantia de separação estrita de moedas (Coins vs Gemas)
          if (r.maxPriceGold === undefined && r.maxPrice !== undefined) {
            const isLegacyOrb = (r.currency === 'orb' || r.currency === 'gemas' || r.currency === 'pontos');
            r.maxPriceGold = isLegacyOrb ? 0 : (Number(r.maxPrice) || 0);
            r.maxPriceGems = isLegacyOrb ? (Number(r.maxPrice) || 0) : 0;
            r.maxPriceDiamonds = r.maxPriceGems;
            needsSync = true;
          } else {
            r.maxPriceGold = Number(r.maxPriceGold) || 0;
            r.maxPriceGems = Number(r.maxPriceGems !== undefined ? r.maxPriceGems : (r.maxPriceDiamonds || 0));
            r.maxPriceDiamonds = r.maxPriceGems;
          }

          return r;
        });
        if (needsSync) {
          saveAndSyncRules();
        }
        renderRules();
      }
      if (result.rotom_sniper_config) {
        applyConfigToUI(result.rotom_sniper_config);
      }
      if (Array.isArray(result.rotom_sniper_logs)) {
        sniperLogs = result.rotom_sniper_logs;
        renderLogs();
      }
      const gold = result.rotom_player_gold;
      const gems = result.rotom_player_orbs !== undefined ? result.rotom_player_orbs : 0;
      const diamonds = result.rotom_player_diamonds !== undefined ? result.rotom_player_diamonds : 0;
      updateBalanceDisplay(gold, gems, diamonds);

      if (Array.isArray(result.rotom_my_listings)) {
        myListings = result.rotom_my_listings;
        renderMyListings();
      }
      if (result.rotom_market_catalog && typeof result.rotom_market_catalog === 'object') {
        communityCatalog = result.rotom_market_catalog;
        renderCommunityCatalog();
      }
      if (result.rotom_item_offers && typeof result.rotom_item_offers === 'object') {
        currentItemOffersData = result.rotom_item_offers;
        renderItemOffersModal();
      }
      if (result.rotom_diamond_offers && typeof result.rotom_diamond_offers === 'object') {
        renderDiamondOffers(result.rotom_diamond_offers.offers || []);
      }
      if (result.rotom_hunts_telemetry && typeof result.rotom_hunts_telemetry === 'object') {
        farmSessionData.hunts = { ...(farmSessionData.hunts || {}), ...result.rotom_hunts_telemetry };
      }
      if (result.rotom_farm_stats && typeof result.rotom_farm_stats === 'object') {
        farmSessionData = { ...farmSessionData, ...result.rotom_farm_stats };
        if (result.rotom_farm_stats.hunts) {
          farmSessionData.hunts = { ...(farmSessionData.hunts || {}), ...result.rotom_farm_stats.hunts };
        }
        updateFarmStatsUI();
      }
    });

    // Escuta alterações em tempo real no storage
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;

      if (changes.rotom_player_vip !== undefined) {
        isPlayerVip = Boolean(changes.rotom_player_vip.newValue);
        updateSlotsDisplay();
        renderRules();
      }
      if (changes.rotom_sniper_rules) {
        const raw = changes.rotom_sniper_rules.newValue || [];
        sniperRules = raw.map(r => {
          if (!r.icon && typeof window.getRotomItem === 'function') {
            const it = window.getRotomItem(r.targetId) || window.getRotomItem(r.targetName);
            if (it && it.icon) r.icon = it.icon;
          }
          return r;
        });
        renderRules();
      }
      if (changes.rotom_sniper_logs) {
        sniperLogs = changes.rotom_sniper_logs.newValue || [];
        renderLogs();
      }
      if (changes.rotom_player_gold || changes.rotom_player_orbs || changes.rotom_player_diamonds) {
        chrome.storage.local.get(['rotom_player_gold', 'rotom_player_orbs', 'rotom_player_diamonds'], (res) => {
          const gold = res.rotom_player_gold;
          const gems = res.rotom_player_orbs !== undefined ? res.rotom_player_orbs : 0;
          const diamonds = res.rotom_player_diamonds !== undefined ? res.rotom_player_diamonds : 0;
          updateBalanceDisplay(gold, gems, diamonds);
        });
      }
      if (changes.rotom_diamond_offers && changes.rotom_diamond_offers.newValue) {
        renderDiamondOffers(changes.rotom_diamond_offers.newValue.offers || []);
      }
      if (changes.rotom_hunts_telemetry) {
        if (changes.rotom_hunts_telemetry.newValue && typeof changes.rotom_hunts_telemetry.newValue === 'object') {
          farmSessionData.hunts = { ...(farmSessionData.hunts || {}), ...changes.rotom_hunts_telemetry.newValue };
        } else {
          farmSessionData.hunts = {};
        }
        if (typeof renderHuntStatsDashboard === 'function') renderHuntStatsDashboard();
      }
      if (changes.rotom_farm_stats) {
        if (changes.rotom_farm_stats.newValue && typeof changes.rotom_farm_stats.newValue === 'object') {
          farmSessionData = { ...farmSessionData, ...changes.rotom_farm_stats.newValue };
          if (changes.rotom_farm_stats.newValue.hunts) {
            farmSessionData.hunts = { ...(farmSessionData.hunts || {}), ...changes.rotom_farm_stats.newValue.hunts };
          }
        } else {
          farmSessionData = {
            startTime: Date.now(),
            kills: 0,
            catches: 0,
            captures: 0,
            ballAttempts: 0,
            trainerXp: 0,
            pokemonXp: 0,
            gold: 0,
            drops: {},
            shiniesSeen: 0,
            shiniesCaught: 0,
            activeHuntSlug: '',
            activeHuntName: '',
            hunts: {}
          };
        }
        updateFarmStatsUI();
      }
      if (changes.rotom_sniper_enabled && toggleMasterSniper) {
        isSniperEnabled = Boolean(changes.rotom_sniper_enabled.newValue);
        toggleMasterSniper.checked = isSniperEnabled;
      }
      if (changes.rotom_pix_config && changes.rotom_pix_config.newValue) {
        currentPixConfig = changes.rotom_pix_config.newValue;
        if (modalPix && modalPix.classList.contains('open')) {
          updatePixUI();
        }
      }
      if (changes.rotom_my_listings) {
        myListings = Array.isArray(changes.rotom_my_listings.newValue) ? changes.rotom_my_listings.newValue : [];
        renderMyListings();
      }
      if (changes.rotom_market_catalog) {
        communityCatalog = (changes.rotom_market_catalog.newValue && typeof changes.rotom_market_catalog.newValue === 'object')
          ? changes.rotom_market_catalog.newValue
          : {};
        renderCommunityCatalog();
      }
      if (changes.rotom_item_offers) {
        currentItemOffersData = changes.rotom_item_offers.newValue || null;
        renderItemOffersModal();
      }
    });

    // Escuta direta de mensagens runtime do background ou content script
    try {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.action === 'DIAMOND_OFFERS_UPDATE') {
          renderDiamondOffers(msg.offers || []);
        } else if (msg && msg.action === 'FARM_STATS_UPDATE') {
          if (msg.stats && typeof msg.stats === 'object') {
            farmSessionData = { ...farmSessionData, ...msg.stats };
            updateFarmStatsUI();
          }
        } else if (msg && msg.action === 'BOSSES_UPDATE') {
          if (typeof renderBosses === 'function' && currentHuntsSubtab === 'bosses') {
            renderBosses();
          }
        }
      });
    } catch (e) {}
  }

  // =========================================================================
  // 8. MODAL PIX (ME PAGUE UM CAFÉ & QR CODE NATIVO)
  // =========================================================================
  const btnOpenPix = document.getElementById('btn-open-pix');
  const modalPix = document.getElementById('modal-pix');
  const btnClosePix = document.getElementById('btn-close-pix');
  const btnPixFecharBottom = document.getElementById('btn-pix-fechar-bottom');
  const pixQrcodeContainer = document.getElementById('pix-qrcode-container');
  const pixKeyDisplay = document.getElementById('pix-key-display');
  const btnCopyPixKey = document.getElementById('btn-copy-pix-key');
  const btnCopyPixPayload = document.getElementById('btn-copy-pix-payload');

  const OFFICIAL_PIX_KEY = '46196ec9-a442-41d9-b350-d0d1123987a7';
  const currentPixConfig = {
    key: OFFICIAL_PIX_KEY,
    name: 'DEV POKEIDLE',
    city: 'BRASIL'
  };

  function crc16(data) {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
      crc ^= (data.charCodeAt(i) << 8);
      for (let j = 0; j < 8; j++) {
        if ((crc & 0x8000) !== 0) {
          crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
        } else {
          crc = (crc << 1) & 0xFFFF;
        }
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  function emvTlv(tag, value) {
    const val = String(value || '');
    const len = String(val.length).padStart(2, '0');
    return `${tag}${len}${val}`;
  }

  function generatePixPayload(key, name, city) {
    const cleanKey = String(key || OFFICIAL_PIX_KEY).trim();
    if (!cleanKey) return '';
    const cleanName = String(name || 'DEV POKEIDLE').trim().substring(0, 25).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const cleanCity = String(city || 'BRASIL').trim().substring(0, 15).normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const gui = emvTlv('00', 'br.gov.bcb.pix');
    const pixKey = emvTlv('01', cleanKey);
    const merchantAcc = emvTlv('26', gui + pixKey);
    const cat = emvTlv('52', '0000');
    const curr = emvTlv('53', '986');
    const country = emvTlv('58', 'BR');
    const mName = emvTlv('59', cleanName || 'DEV POKEIDLE');
    const mCity = emvTlv('60', cleanCity || 'BRASIL');
    const addData = emvTlv('62', emvTlv('05', '***'));

    const raw = emvTlv('00', '01') + emvTlv('01', '12') + merchantAcc + cat + curr + country + mName + mCity + addData + '6304';
    return raw + crc16(raw);
  }

  function updatePixUI() {
    const key = currentPixConfig.key || OFFICIAL_PIX_KEY;
    if (pixKeyDisplay) pixKeyDisplay.textContent = key;
    const payload = generatePixPayload(key, currentPixConfig.name, currentPixConfig.city);
    renderPixQrCode(payload || key);
  }

  function renderPixQrCode(payloadText) {
    if (!pixQrcodeContainer) return;
    if (!payloadText) return;

    try {
      if (typeof qrcode === 'function') {
        const qr = qrcode(0, 'M');
        qr.addData(payloadText);
        qr.make();
        const svgTag = qr.createSvgTag(4, 2);
        pixQrcodeContainer.innerHTML = svgTag;
        const svgEl = pixQrcodeContainer.querySelector('svg');
        if (svgEl) {
          svgEl.style.width = '170px';
          svgEl.style.height = '170px';
          svgEl.style.display = 'block';
        }
      }
    } catch (err) {
      console.error('[Rotom Cockpit]: Erro ao gerar QR Code do Pix:', err);
      pixQrcodeContainer.innerHTML = '<span style="color: #c00; font-size: 10px;">Erro ao gerar QR Code</span>';
    }
  }

  function copyTextWithFeedback(btn, text) {
    if (!text) return;
    const oldText = btn.textContent;
    const restore = () => {
      setTimeout(() => { btn.textContent = oldText; }, 1800);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = 'Copiado!';
        restore();
      }).catch(() => {
        fallbackCopy(text);
        btn.textContent = 'Copiado!';
        restore();
      });
    } else {
      fallbackCopy(text);
      btn.textContent = 'Copiado!';
      restore();
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }

  function openPixModal() {
    if (modalPix) modalPix.classList.add('open');
    updatePixUI();
  }

  function closePixModal() {
    if (modalPix) modalPix.classList.remove('open');
  }

  if (btnOpenPix) btnOpenPix.addEventListener('click', openPixModal);
  if (btnClosePix) btnClosePix.addEventListener('click', closePixModal);
  if (btnPixFecharBottom) btnPixFecharBottom.addEventListener('click', closePixModal);

  if (modalPix) {
    modalPix.addEventListener('click', (e) => {
      if (e.target === modalPix) closePixModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalPix && modalPix.classList.contains('open')) {
      closePixModal();
    }
  });

  if (btnCopyPixKey) {
    btnCopyPixKey.addEventListener('click', () => {
      copyTextWithFeedback(btnCopyPixKey, currentPixConfig.key);
    });
  }

  if (btnCopyPixPayload) {
    btnCopyPixPayload.addEventListener('click', () => {
      const payload = generatePixPayload(currentPixConfig.key, currentPixConfig.name, currentPixConfig.city) || currentPixConfig.key;
      copyTextWithFeedback(btnCopyPixPayload, payload);
    });
  }

  // =========================================================================
  // 9. MERCADO DA COMUNIDADE & MEUS ANÚNCIOS (CENTRAL STANDALONE)
  // =========================================================================
  const viewSniper = document.getElementById('view-sniper');
  const viewMarket = document.getElementById('view-market');
  const viewStats = document.getElementById('view-stats');
  const viewHunts = document.getElementById('view-hunts');
  const viewOferendas = document.getElementById('view-oferendas');

  const tabNavSniper = document.getElementById('tab-nav-sniper');
  const tabNavMarket = document.getElementById('tab-nav-market');
  const tabNavStats = document.getElementById('tab-nav-stats');
  const tabNavHunts = document.getElementById('tab-nav-hunts');
  const tabNavOferendas = document.getElementById('tab-nav-oferendas');

  const subtabMyListings = document.getElementById('subtab-my-listings');
  const subtabCommunityItems = document.getElementById('subtab-community-items');
  const panelMyListings = document.getElementById('panel-my-listings');
  const panelCommunityItems = document.getElementById('panel-community-items');
  const btnRefreshMarket = document.getElementById('btn-refresh-market');

  const lblMyListingsSummary = document.getElementById('lbl-my-listings-summary');
  const containerMyListingsList = document.getElementById('container-my-listings-list');

  const inputSearchMarket = document.getElementById('input-search-market');
  const marketCatButtons = document.querySelectorAll('.market-cat-btn');
  const containerCommunityItemsList = document.getElementById('container-community-items-list');

  const modalItemOffers = document.getElementById('modal-item-offers');
  const offersModalIcon = document.getElementById('offers-modal-icon');
  const offersModalTitle = document.getElementById('offers-modal-title');
  const offersModalSub = document.getElementById('offers-modal-sub');
  const btnOffersGold = document.getElementById('btn-offers-gold');
  const btnOffersGems = document.getElementById('btn-offers-gems');
  const btnQuickCreateRule = document.getElementById('btn-quick-create-rule');
  const containerOffersSellers = document.getElementById('container-offers-sellers');
  const btnCloseOffersModal = document.getElementById('btn-close-offers-modal');
  const btnCloseOffersBottom = document.getElementById('btn-close-offers-bottom');

  // --- NAVEGAÇÃO PRINCIPAL ENTRE AS 5 ABAS ---
  function switchMainView(view) {
    const tabs = [
      { id: 'sniper', btn: tabNavSniper, el: viewSniper, display: 'grid' },
      { id: 'market', btn: tabNavMarket, el: viewMarket, display: 'flex' },
      { id: 'stats', btn: tabNavStats, el: viewStats, display: 'flex' },
      { id: 'hunts', btn: tabNavHunts, el: viewHunts, display: 'flex' },
      { id: 'oferendas', btn: tabNavOferendas, el: viewOferendas, display: 'flex' }
    ];

    tabs.forEach(t => {
      const active = (t.id === view);
      if (t.btn) {
        t.btn.classList.toggle('on', active);
        t.btn.classList.toggle('apagado', !active);
      }
      if (t.el) {
        t.el.style.display = active ? t.display : 'none';
      }
    });

    if (view === 'market') {
      if (!myListings || myListings.length === 0) {
        sendToActiveTab({ action: 'FETCH_MY_LISTINGS' });
      }
      if (!communityCatalog || Object.keys(communityCatalog).length === 0) {
        sendToActiveTab({ action: 'FETCH_COMMUNITY_CATALOG' });
      }
    } else if (view === 'stats') {
      sendToActiveTab({ action: 'FETCH_FARM_STATS' });
      if (typeof updateFarmStatsUI === 'function') updateFarmStatsUI();
    } else if (view === 'hunts') {
      if (typeof initHuntsView === 'function') initHuntsView();
    } else if (view === 'oferendas') {
      if (typeof requestOferendaDepot === 'function') requestOferendaDepot();
    }
  }

  if (tabNavSniper) tabNavSniper.addEventListener('click', () => switchMainView('sniper'));
  if (tabNavMarket) tabNavMarket.addEventListener('click', () => switchMainView('market'));
  if (tabNavStats) tabNavStats.addEventListener('click', () => switchMainView('stats'));
  if (tabNavHunts) tabNavHunts.addEventListener('click', () => switchMainView('hunts'));
  if (tabNavOferendas) tabNavOferendas.addEventListener('click', () => switchMainView('oferendas'));

  // --- SUB-NAVEGAÇÃO DO MERCADO ---
  function switchMarketSubtab(sub) {
    if (sub === 'catalog') {
      if (subtabMyListings) { subtabMyListings.classList.remove('on'); subtabMyListings.classList.add('apagado'); }
      if (subtabCommunityItems) { subtabCommunityItems.classList.add('on'); subtabCommunityItems.classList.remove('apagado'); }
      if (panelMyListings) panelMyListings.style.display = 'none';
      if (panelCommunityItems) panelCommunityItems.style.display = 'flex';
      renderCommunityCatalog();
    } else {
      if (subtabCommunityItems) { subtabCommunityItems.classList.remove('on'); subtabCommunityItems.classList.add('apagado'); }
      if (subtabMyListings) { subtabMyListings.classList.add('on'); subtabMyListings.classList.remove('apagado'); }
      if (panelCommunityItems) panelCommunityItems.style.display = 'none';
      if (panelMyListings) panelMyListings.style.display = 'flex';
      renderMyListings();
    }
  }

  if (subtabMyListings) subtabMyListings.addEventListener('click', () => switchMarketSubtab('my'));
  if (subtabCommunityItems) subtabCommunityItems.addEventListener('click', () => switchMarketSubtab('catalog'));

  if (btnRefreshMarket) {
    btnRefreshMarket.addEventListener('click', () => {
      const origText = btnRefreshMarket.textContent;
      btnRefreshMarket.textContent = '🔄 Atualizando...';
      btnRefreshMarket.disabled = true;

      sendToActiveTab({ action: 'FETCH_MY_LISTINGS' });
      sendToActiveTab({ action: 'FETCH_COMMUNITY_CATALOG' });

      setTimeout(() => {
        btnRefreshMarket.textContent = origText;
        btnRefreshMarket.disabled = false;
      }, 1200);
    });
  }

  // --- MEUS ANÚNCIOS À VENDA ---
  function renderMyListings() {
    if (!containerMyListingsList) return;

    if (lblMyListingsSummary) {
      const count = myListings ? myListings.length : 0;
      lblMyListingsSummary.textContent = `${count} anúncio${count === 1 ? '' : 's'} ativo${count === 1 ? '' : 's'}`;
    }

    if (!myListings || myListings.length === 0) {
      containerMyListingsList.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px 10px; color: var(--sobre-mad-dim);">
          <p style="font-size: 11px; margin: 0 0 6px 0;">Você não possui nenhum anúncio ativo no mercado da comunidade.</p>
          <span style="font-size: 9.5px; opacity: 0.75;">Quando colocar itens ou Pokémons à venda no jogo, eles aparecerão aqui organizados com opção de cancelamento imediato.</span>
        </div>
      `;
      return;
    }

    containerMyListingsList.innerHTML = '';
    myListings.forEach(an => {
      const card = document.createElement('div');
      card.className = 'my-listing-card';

      // Identificação inteligente: Pokémon vs Item vs Caixa Especial vs Diamante
      let itemName = 'Item Desconhecido';
      let itemIcon = 'icons/ouro.png';
      let badgeExtra = '';
      let categorySub = '';

      const f = an.ficha || an.poke || an.item || {};
      const isPoke = an.tipo === 'pokemon' || Boolean(f.speciesId || f.pokemonId || f.pId || f.level !== undefined || f.ivTotal || f.qualidade || f.quality);

      if (isPoke) {
        itemName = f.nome || f.name || an.nome || 'Pokémon';
        const isShiny = Boolean(f.shiny);
        itemIcon = (typeof window.getRotomPokemonSprite === 'function')
          ? window.getRotomPokemonSprite(f, isShiny)
          : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${isShiny ? 'shiny/' : ''}${f.speciesId || f.pokemonId || 1}.png`;

        if (isShiny) badgeExtra += '<span class="shiny-tag" style="font-size: 8px; padding: 1px 4px; background: #e6b800; color: #000; font-weight: 900; border-radius: 0px;">★ SHINY</span> ';
        if (f.level) categorySub += `Nv. ${f.level} `;

        // Atributos Oficiais do PokéIdle: P, Q, IV e N
        if (typeof window.getRotomPokemonAttributesHtml === 'function') {
          badgeExtra += window.getRotomPokemonAttributesHtml(f, { compacto: true });
        } else {
          if (f.potencia && f.potencia >= 5) badgeExtra += '<span class="p5-tag" style="font-size: 8px; padding: 1px 4px; background: #9b5de5; color: #fff; font-weight: 900; border-radius: 0px;">P5</span> ';
          else if (f.potencia) badgeExtra += `<span style="font-size: 8px; color: var(--rx-luz); font-weight: 700;">P${f.potencia}</span> `;
          if (f.nota) categorySub += `· Nota ${Number(f.nota).toFixed(1)}`;
        }
      } else if (an.tipo === 'diamante') {
        itemName = 'Diamantes';
        itemIcon = 'https://pokeidle.io/img/moeda-diamante.png';
        categorySub = 'Mercado de Câmbio';
      } else {
        // Item ou Caixa
        const itemId = Number(an.itemId || f.id || 0);

        if (f.caixaTipo || f.caixaId) {
          itemName = f.caixaTipo === 'founder' ? 'Founder Box' : (f.caixaTipo === 'cofounder' ? 'Co-Founder Box' : (f.nome || 'Box Especial'));
          itemIcon = f.caixaTipo === 'founder' ? 'https://pokeidle.io/img/itens/caixa-fundador.png' : 'https://pokeidle.io/img/itens/caixa-cofundador.png';
          categorySub = 'Caixa Especial';
          if (f.serie) badgeExtra += `<span style="font-size: 8px; color: var(--ouro); font-weight: 700;">#${f.serie}</span>`;
        } else {
          let rotomIt = null;
          if (typeof window.getRotomItem === 'function') {
            rotomIt = window.getRotomItem(itemId) || window.getRotomItem(f.nome || an.itemNome);
          }
          if (rotomIt) {
            itemName = rotomIt.name;
            itemIcon = typeof window.getItemIconUrl === 'function' ? window.getItemIconUrl(rotomIt) : (rotomIt.icon || 'icons/ouro.png');
            categorySub = rotomIt.categoryLabel || rotomIt.category || 'Item';
            if (rotomIt.type) badgeExtra += `<span style="font-size: 7.5px; padding: 1px 4px; background: rgba(255,255,255,0.15); border-radius: 0px;">${rotomIt.type}</span>`;
          } else {
            itemName = f.nome || an.itemNome || `Item #${itemId || '?'}`;
            itemIcon = typeof window.getItemIconUrl === 'function' ? window.getItemIconUrl(itemId) : 'icons/ouro.png';
            categorySub = 'Item';
          }
        }
      }

      const isGemas = (an.moeda === 'orb' || an.moeda === 'gems' || an.moeda === 'diamonds');
      const moedaIcon = isGemas ? 'icons/orbe.png' : 'icons/ouro.png';
      const moedaNome = isGemas ? 'Gemas' : 'GP';
      const precoUnit = Number(an.preco || an.unitPrice || 0);
      const qtd = Number(an.qtd || an.quantidade || 1);
      const precoTotal = precoUnit * qtd;

      card.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="vao" style="width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; padding: 2px; border-radius: 0px;">
            <img src="${itemIcon}" style="max-width: 40px; max-height: 40px; object-fit: contain;" alt="${itemName}">
          </div>
          <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;">
            <span style="color: #fff; font-weight: 700; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${itemName}">${itemName}</span>
            <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
              ${categorySub ? `<span style="font-size: 8px; color: var(--sobre-mad-dim);">${categorySub}</span>` : ''}
              ${badgeExtra}
            </div>
            <span style="font-size: 8.5px; color: var(--sobre-mad);">Qtd: <b style="color: #fff;">${qtd.toLocaleString()}</b> un</span>
          </div>
        </div>

        <div class="vao" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; border-radius: 0px;">
          <div style="display: flex; flex-direction: column; gap: 1px;">
            <span style="font-size: 8px; color: var(--vao-dim); text-transform: uppercase;">Preço Unit / Total:</span>
            <div style="display: flex; align-items: center; gap: 4px; font-size: 9.5px; color: ${isGemas ? 'var(--gemas)' : 'var(--coins)'}; font-variant-numeric: tabular-nums;">
              <img src="${moedaIcon}" style="width: 12px; height: 12px; object-fit: contain;">
              <b>${precoUnit.toLocaleString()}</b> ${moedaNome}
              <span style="color: var(--vao-dim); font-size: 8px;">(Total: ${precoTotal.toLocaleString()})</span>
            </div>
          </div>
          <button type="button" class="btn btn-cancelar btn-mini btn-cancel-listing" data-id="${an.id}" title="Cancelar anúncio e devolver para o inventário">
            Cancelar
          </button>
        </div>
      `;

      const btnCancel = card.querySelector('.btn-cancel-listing');
      if (btnCancel) {
        btnCancel.addEventListener('click', () => {
          const anId = btnCancel.getAttribute('data-id');
          if (!anId) return;

          btnCancel.textContent = 'Cancelando...';
          btnCancel.disabled = true;
          sendToActiveTab({ action: 'CANCEL_MARKET_OFFER', id: anId });
        });
      }

      containerMyListingsList.appendChild(card);
    });
  }

  // --- CATÁLOGO DA COMUNIDADE ---
  if (marketCatButtons) {
    marketCatButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        marketCatButtons.forEach(b => {
          b.classList.remove('on');
          b.classList.add('apagado');
        });
        btn.classList.add('on');
        btn.classList.remove('apagado');
        currentMarketFilterCat = btn.getAttribute('data-cat') || 'all';
        renderCommunityCatalog();
      });
    });
  }

  if (inputSearchMarket) {
    inputSearchMarket.addEventListener('input', () => {
      renderCommunityCatalog();
    });
  }

  function renderCommunityCatalog() {
    if (!containerCommunityItemsList) return;

    let allItems = [];
    if (typeof window.getAllRotomItems === 'function') {
      allItems = window.getAllRotomItems();
    } else if (window.POKEIDLE_ITEMS_DB && Array.isArray(window.POKEIDLE_ITEMS_DB)) {
      allItems = window.POKEIDLE_ITEMS_DB;
    } else if (window.ROTOM_ITEMS_DB && Array.isArray(window.ROTOM_ITEMS_DB)) {
      allItems = window.ROTOM_ITEMS_DB;
    }

    const filterText = (inputSearchMarket ? inputSearchMarket.value : '').toLowerCase().trim();

    // Filtra itens conforme categoria e busca
    let filtered = allItems.filter(it => {
      // Filtro de Categoria
      if (currentMarketFilterCat !== 'all') {
        const cat = (it.category || '').toLowerCase();
        if (currentMarketFilterCat === 'stone') {
          if (cat !== 'stone' && cat !== 'evolution_stone') return false;
        } else if (currentMarketFilterCat === 'tm') {
          if (cat !== 'tm') return false;
        } else if (currentMarketFilterCat === 'rare_loot') {
          if (cat !== 'rare_loot' && cat !== 'loot') return false;
        } else if (currentMarketFilterCat === 'box') {
          if (cat !== 'box') return false;
        } else if (currentMarketFilterCat === 'beast') {
          if (cat !== 'beast' && cat !== 'ball') return false;
        } else if (currentMarketFilterCat === 'casa') {
          if (cat !== 'casa' && cat !== 'house') return false;
        } else if (currentMarketFilterCat === 'diamante') {
          if (cat !== 'diamante' && it.id !== 999999) return false;
        } else if (currentMarketFilterCat === 'bicicleta') {
          if (cat !== 'bicicleta' && cat !== 'bike') return false;
        }
      }

      // Filtro de Texto
      if (filterText) {
        const nameMatch = (it.name || '').toLowerCase().includes(filterText);
        const catMatch = (it.categoryLabel || it.category || '').toLowerCase().includes(filterText);
        const typeMatch = (it.type || '').toLowerCase().includes(filterText);
        if (!nameMatch && !catMatch && !typeMatch) return false;
      }

      return true;
    });

    if (filtered.length === 0) {
      containerCommunityItemsList.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px 10px; color: var(--sobre-mad-dim);">
          Nenhum item encontrado com os filtros selecionados.
        </div>
      `;
      return;
    }

    containerCommunityItemsList.innerHTML = '';

    // Se estiver em "Todas" e sem filtro de texto, exibe com seções visuais magníficas
    const SECTIONS_ORDER = [
      { id: 'stone', title: '💎 Pedras de Evolução & Shiny Stones' },
      { id: 'tm', title: '💿 TMs & Discos de Ataque' },
      { id: 'rare_loot', title: '🏆 Loots Raros & Fragmentos de Boss' },
      { id: 'box', title: '🎁 Boxes Especiais (Founder & Co-Founder)' },
      { id: 'beast', title: '🔮 Pokébolas Especiais (Beast Ball)' },
      { id: 'casa', title: '🏡 Casas' },
      { id: 'bicicleta', title: '🚲 Bicicletas' }
    ];

    if (currentMarketFilterCat === 'all' && !filterText) {
      SECTIONS_ORDER.forEach(sec => {
        const sectionItems = filtered.filter(it => it.category === sec.id);
        if (sectionItems.length > 0) {
          const header = document.createElement('div');
          header.className = 'catalog-section-title';
          header.innerHTML = `<span>${sec.title}</span><span style="font-size: 8.5px; opacity: 0.75;">${sectionItems.length} itens</span>`;
          containerCommunityItemsList.appendChild(header);

          sectionItems.forEach(it => {
            containerCommunityItemsList.appendChild(createCommunityItemCard(it));
          });
        }
      });
    } else {
      // Ordenação: Itens que possuem dados no communityCatalog vêm primeiro
      filtered.sort((a, b) => {
        const dataA = communityCatalog[a.id];
        const dataB = communityCatalog[b.id];
        const hasA = dataA && (dataA.minGold || dataA.minOrb || dataA.total || dataA.anuncios);
        const hasB = dataB && (dataB.minGold || dataB.minOrb || dataB.total || dataB.anuncios);
        if (hasA && !hasB) return -1;
        if (!hasA && hasB) return 1;
        return (a.name || '').localeCompare(b.name || '');
      });

      filtered.forEach(it => {
        containerCommunityItemsList.appendChild(createCommunityItemCard(it));
      });
    }
  }

  function createCommunityItemCard(it) {
    const card = document.createElement('div');
    card.className = 'community-item-card';

    const iconUrl = typeof window.getItemIconUrl === 'function'
      ? window.getItemIconUrl(it)
      : (it.icon || 'icons/ouro.png');

    const data = communityCatalog[it.id] || {};
    const minGold = Number(data.minGold || data.gold || 0);
    const minOrb = Number(data.minOrb || data.gems || data.orb || 0);
    const totalOffers = Number(data.anuncios || data.total || data.count || 0);

    const goldDisplay = minGold > 0 ? `${minGold.toLocaleString()} GP` : '—';
    const gemsDisplay = minOrb > 0 ? `${minOrb.toLocaleString()} Gemas` : '—';

    let typeTag = '';
    if (it.type) {
      typeTag = `<span style="font-size: 7.5px; padding: 1px 5px; background: rgba(0,0,0,0.35); border: 1px solid var(--mad-linha); color: var(--ouro); font-weight: 700;">${it.type}</span>`;
    }

    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div class="vao" style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; padding: 2px;">
          <img src="${iconUrl}" style="max-width: 34px; max-height: 34px; object-fit: contain;" alt="${it.name}">
        </div>
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;">
          <span style="color: #fff; font-weight: 700; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${it.name}">${it.name}</span>
          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="font-size: 8px; color: var(--sobre-mad-dim);">${it.categoryLabel || it.category || 'Item'}</span>
            ${typeTag}
          </div>
        </div>
      </div>

      <div class="vao" style="padding: 5px 8px; display: flex; flex-direction: column; gap: 3px; border-radius: 0px;">
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 9px;">
          <span style="color: var(--vao-dim); display: flex; align-items: center; gap: 3px;">
            <img src="icons/ouro.png" style="width: 11px; height: 11px; object-fit: contain;"> Menor em Coins:
          </span>
          <b style="color: ${minGold > 0 ? 'var(--coins)' : 'var(--vao-dim)'}; font-variant-numeric: tabular-nums;">${goldDisplay}</b>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 9px;">
          <span style="color: var(--vao-dim); display: flex; align-items: center; gap: 3px;">
            <img src="icons/orbe.png" style="width: 11px; height: 11px; object-fit: contain;"> Menor em Gemas:
          </span>
          <b style="color: ${minOrb > 0 ? 'var(--gemas)' : 'var(--vao-dim)'}; font-variant-numeric: tabular-nums;">${gemsDisplay}</b>
        </div>
      </div>

      <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; padding-top: 2px;">
        <span style="font-size: 8.5px; ${totalOffers > 0 ? 'color: var(--verde); font-weight: 700;' : 'color: var(--sobre-mad-dim);'}">
          ${totalOffers > 0 ? `🟢 ${totalOffers} oferta${totalOffers > 1 ? 's' : ''}` : '⚪ Sem ofertas'}
        </span>
        <div style="display: flex; gap: 4px;">
          <button type="button" class="btn btn-roxo btn-mini btn-open-item-offers" data-id="${it.id}" style="font-size: 8px; padding: 0 6px; height: 20px;" title="Ver ofertas deste item na comunidade">
            Ver Ofertas
          </button>
          <button type="button" class="btn apagado btn-mini btn-quick-sniper-rule" data-id="${it.id}" style="font-size: 8px; padding: 0 6px; height: 20px;" title="Criar regra de sniper no painel">
            + Sniper
          </button>
        </div>
      </div>
    `;

    const btnOffers = card.querySelector('.btn-open-item-offers');
    if (btnOffers) {
      btnOffers.addEventListener('click', (e) => {
        e.stopPropagation();
        openItemOffersModal(it);
      });
    }

    const btnQuick = card.querySelector('.btn-quick-sniper-rule');
    if (btnQuick) {
      btnQuick.addEventListener('click', (e) => {
        e.stopPropagation();
        configureSniperRuleFromItem(it, minGold, minOrb);
      });
    }

    return card;
  }

  // --- CONFIGURAR REGRA DE SNIPER A PARTIR DO ITEM DO CATÁLOGO ---
  function configureSniperRuleFromItem(it, minGold, minOrb) {
    if (!it) return;

    // Volta para o Painel Sniper
    switchMainView('sniper');

    // Seleciona o item no form
    if (typeof selectItemForNewRule === 'function') {
      selectItemForNewRule(it);
    } else {
      selectedItemObj = it;
      if (lblSelectedName) lblSelectedName.textContent = it.name;
      if (lblSelectedCat) lblSelectedCat.textContent = it.categoryLabel || it.category || 'item';
      if (imgSelectedItem) {
        imgSelectedItem.src = typeof window.getItemIconUrl === 'function' ? window.getItemIconUrl(it) : (it.icon || '');
      }
      if (boxSelectedPreview) boxSelectedPreview.style.display = 'flex';
      if (inputSearchItem) inputSearchItem.value = it.name;
    }

    // Preenche com o menor preço do mercado se disponível
    if (inputRuleCoins && minGold > 0) inputRuleCoins.value = minGold;
    if (inputRuleGemas && minOrb > 0) inputRuleGemas.value = minOrb;

    // Rola até o topo e foca o campo de quantidade
    if (inputRuleQty) inputRuleQty.focus();
  }

  // --- MODAL DE OFERTAS DO ITEM ESPECÍFICO ---
  function openItemOffersModal(it) {
    if (!it) return;
    if (it.id === 999999 || it.category === 'diamante') {
      openDiamantesModal('comprar');
      return;
    }
    if (!modalItemOffers) return;
    selectedMarketItem = it;

    if (offersModalIcon) {
      offersModalIcon.src = typeof window.getItemIconUrl === 'function' ? window.getItemIconUrl(it) : (it.icon || 'icons/ouro.png');
    }
    if (offersModalTitle) offersModalTitle.textContent = it.name;
    if (offersModalSub) offersModalSub.textContent = `Categoria: ${it.categoryLabel || it.category || 'Item'}`;

    currentOffersMoeda = 'gold';
    if (btnOffersGold) { btnOffersGold.classList.add('on'); btnOffersGold.classList.remove('apagado'); }
    if (btnOffersGems) { btnOffersGems.classList.remove('on'); btnOffersGems.classList.add('apagado'); }

    modalItemOffers.classList.add('open');

    // Busca ofertas de Coins de imediato
    fetchItemOffers(it.id, 'gold');
  }

  function closeItemOffersModal() {
    if (modalItemOffers) modalItemOffers.classList.remove('open');
  }

  if (btnCloseOffersModal) btnCloseOffersModal.addEventListener('click', closeItemOffersModal);
  if (btnCloseOffersBottom) btnCloseOffersBottom.addEventListener('click', closeItemOffersModal);

  if (modalItemOffers) {
    modalItemOffers.addEventListener('click', (e) => {
      if (e.target === modalItemOffers) closeItemOffersModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalItemOffers && modalItemOffers.classList.contains('open')) {
      closeItemOffersModal();
    }
  });

  if (btnOffersGold) {
    btnOffersGold.addEventListener('click', () => {
      currentOffersMoeda = 'gold';
      btnOffersGold.classList.add('on');
      btnOffersGold.classList.remove('apagado');
      if (btnOffersGems) {
        btnOffersGems.classList.remove('on');
        btnOffersGems.classList.add('apagado');
      }
      if (selectedMarketItem) fetchItemOffers(selectedMarketItem.id, 'gold');
    });
  }

  if (btnOffersGems) {
    btnOffersGems.addEventListener('click', () => {
      currentOffersMoeda = 'orb';
      btnOffersGems.classList.add('on');
      btnOffersGems.classList.remove('apagado');
      if (btnOffersGold) {
        btnOffersGold.classList.remove('on');
        btnOffersGold.classList.add('apagado');
      }
      if (selectedMarketItem) fetchItemOffers(selectedMarketItem.id, 'orb');
    });
  }

  if (btnQuickCreateRule) {
    btnQuickCreateRule.addEventListener('click', () => {
      if (!selectedMarketItem) return;
      closeItemOffersModal();
      configureSniperRuleFromItem(selectedMarketItem, 0, 0);
    });
  }

  function fetchItemOffers(itemId, moeda) {
    if (!containerOffersSellers) return;
    const cleanMoeda = (moeda === 'gems' || moeda === 'orb') ? 'orb' : 'gold';
    currentOffersMoeda = cleanMoeda;
    const moedaLabel = cleanMoeda === 'orb' ? 'Gemas' : 'Coins (GP)';

    containerOffersSellers.innerHTML = `<div style="text-align: center; padding: 25px; color: var(--vao-dim); font-size: 10px;">Buscando ofertas em ${moedaLabel}...</div>`;
    sendToActiveTab({ action: 'FETCH_ITEM_OFFERS', itemId: Number(itemId), moeda: cleanMoeda });
  }

  function renderItemOffersModal() {
    if (!containerOffersSellers || !modalItemOffers || !modalItemOffers.classList.contains('open')) return;
    if (!selectedMarketItem) return;

    if (!currentItemOffersData) {
      containerOffersSellers.innerHTML = '<div style="text-align: center; padding: 25px; color: var(--vao-dim); font-size: 10px;">Aguardando ofertas do mercado...</div>';
      return;
    }

    // Se as ofertas forem de outro item, aguarda o pacote do item atual
    if (currentItemOffersData.itemId && Number(currentItemOffersData.itemId) !== Number(selectedMarketItem.id)) {
      return;
    }

    const offers = currentItemOffersData.linhas || currentItemOffersData.offers || [];
    const isGemas = (currentOffersMoeda === 'gems' || currentOffersMoeda === 'orb');
    const moedaIcon = isGemas ? 'icons/orbe.png' : 'icons/ouro.png';
    const moedaLabel = isGemas ? 'Gemas' : 'GP';

    if (!Array.isArray(offers) || offers.length === 0) {
      containerOffersSellers.innerHTML = `
        <div style="text-align: center; padding: 25px; color: var(--vao-dim); font-size: 10px;">
          Nenhum vendedor ofertando este item em ${moedaLabel} no momento.
        </div>
      `;
      return;
    }

    containerOffersSellers.innerHTML = '';
    offers.forEach(off => {
      const row = document.createElement('div');
      row.className = 'vao';
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.padding = '6px 8px';
      row.style.borderRadius = '0px';

      const vendedor = off.vendedor || off.seller || 'Vendedor Anônimo';
      const qtd = Number(off.qtd || off.quantidade || 1);
      const preco = Number(off.preco || off.price || 0);
      const precoTotal = preco * qtd;

      row.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 10px; font-weight: 700; color: #fff;">${vendedor}</span>
            <span style="font-size: 8px; color: var(--sobre-mad-dim);">Qtd: <b style="color: #fff;">${qtd.toLocaleString()}</b> un</span>
          </div>
          <div style="display: flex; align-items: center; gap: 4px; font-size: 9.5px; color: ${isGemas ? 'var(--gemas)' : 'var(--coins)'}; font-variant-numeric: tabular-nums;">
            <img src="${moedaIcon}" style="width: 12px; height: 12px; object-fit: contain;">
            <b>${preco.toLocaleString()}</b> ${moedaLabel} / un
            ${qtd > 1 ? `<span style="font-size: 8px; color: var(--vao-dim);">(Total: ${precoTotal.toLocaleString()})</span>` : ''}
          </div>
        </div>

        <button type="button" class="btn btn-roxo btn-mini btn-buy-offer" data-id="${off.id}" style="font-size: 8.5px; height: 24px; padding: 0 8px;">
          Comprar
        </button>
      `;

      const btnBuy = row.querySelector('.btn-buy-offer');
      if (btnBuy) {
        btnBuy.addEventListener('click', () => {
          btnBuy.textContent = 'Comprando...';
          btnBuy.disabled = true;

          sendToActiveTab({
            action: 'BUY_MANUAL_OFFER',
            offerId: off.id,
            qty: qtd,
            price: preco,
            moeda: currentOffersMoeda === 'orb' ? 'orb' : 'gold',
            targetName: selectedMarketItem ? selectedMarketItem.name : '',
            seller: vendedor
          });

          setTimeout(() => {
            btnBuy.textContent = 'Enviado!';
            if (selectedMarketItem) {
              fetchItemOffers(selectedMarketItem.id, currentOffersMoeda);
            }
          }, 1000);
        });
      }

      containerOffersSellers.appendChild(row);
    });
  }

  // =========================================================================
  // 10. MODAL DE COMPRA & VENDA DE DIAMANTES
  // =========================================================================
  let cachedDiamondOffers = [];
  let currentDiamondFilter = 'all';

  function openDiamantesModal(defaultTab) {
    if (!modalDiamantes) return;
    modalDiamantes.classList.add('open');
    switchDiamanteTab(defaultTab || 'comprar');

    // Recupera dados já existentes no storage para renderização imediata
    chrome.storage.local.get(['rotom_diamond_offers'], (res) => {
      if (res.rotom_diamond_offers && Array.isArray(res.rotom_diamond_offers.offers) && res.rotom_diamond_offers.offers.length > 0) {
        renderDiamondOffers(res.rotom_diamond_offers.offers);
      } else if (containerDiamantesOffers) {
        containerDiamantesOffers.innerHTML = `
          <div style="text-align: center; padding: 30px 10px; color: var(--sobre-mad-dim); font-size: 10.5px;">
            Buscando ofertas de Diamantes no mercado...
          </div>
        `;
      }
    });

    fetchDiamondMarketOffers();

    // Fallback de segurança: se após 3 segundos não receber resposta nova, encerra o loading
    setTimeout(() => {
      chrome.storage.local.get(['rotom_diamond_offers'], (res) => {
        const offs = res.rotom_diamond_offers?.offers;
        if (Array.isArray(offs)) {
          renderDiamondOffers(offs);
        } else {
          renderDiamondOffers([]);
        }
      });
    }, 3200);
  }

  function closeDiamantesModal() {
    if (!modalDiamantes) return;
    modalDiamantes.classList.remove('open');
  }

  function switchDiamanteTab(tab) {
    if (tab === 'vender') {
      if (tabDiamanteComprar) { tabDiamanteComprar.classList.remove('on'); tabDiamanteComprar.classList.add('apagado'); }
      if (tabDiamanteRecarga) { tabDiamanteRecarga.classList.remove('on'); tabDiamanteRecarga.classList.add('apagado'); }
      if (tabDiamanteVender) { tabDiamanteVender.classList.add('on'); tabDiamanteVender.classList.remove('apagado'); }
      if (panelDiamanteComprar) panelDiamanteComprar.style.display = 'none';
      if (panelDiamanteRecarga) panelDiamanteRecarga.style.display = 'none';
      if (panelDiamanteVender) panelDiamanteVender.style.display = 'flex';
      updateSellDiamantesResumo();
    } else if (tab === 'recarga') {
      if (tabDiamanteComprar) { tabDiamanteComprar.classList.remove('on'); tabDiamanteComprar.classList.add('apagado'); }
      if (tabDiamanteVender) { tabDiamanteVender.classList.remove('on'); tabDiamanteVender.classList.add('apagado'); }
      if (tabDiamanteRecarga) { tabDiamanteRecarga.classList.add('on'); tabDiamanteRecarga.classList.remove('apagado'); }
      if (panelDiamanteComprar) panelDiamanteComprar.style.display = 'none';
      if (panelDiamanteVender) panelDiamanteVender.style.display = 'none';
      if (panelDiamanteRecarga) panelDiamanteRecarga.style.display = 'flex';
    } else {
      if (tabDiamanteVender) { tabDiamanteVender.classList.remove('on'); tabDiamanteVender.classList.add('apagado'); }
      if (tabDiamanteRecarga) { tabDiamanteRecarga.classList.remove('on'); tabDiamanteRecarga.classList.add('apagado'); }
      if (tabDiamanteComprar) { tabDiamanteComprar.classList.add('on'); tabDiamanteComprar.classList.remove('apagado'); }
      if (panelDiamanteVender) panelDiamanteVender.style.display = 'none';
      if (panelDiamanteRecarga) panelDiamanteRecarga.style.display = 'none';
      if (panelDiamanteComprar) panelDiamanteComprar.style.display = 'flex';
    }
  }

  function fetchDiamondMarketOffers() {
    if (containerDiamantesOffers && cachedDiamondOffers.length === 0) {
      containerDiamantesOffers.innerHTML = `
        <div style="text-align: center; padding: 30px 10px; color: var(--sobre-mad-dim); font-size: 10.5px;">
          Buscando ofertas de Diamantes no mercado...
        </div>
      `;
    }
    sendToActiveTab({ action: 'FETCH_DIAMOND_OFFERS' });
  }

  function renderDiamondOffers(offers) {
    if (!containerDiamantesOffers) return;
    if (Array.isArray(offers)) {
      cachedDiamondOffers = offers;
    }

    let list = cachedDiamondOffers.slice();
    if (currentDiamondFilter === 'gold') {
      list = list.filter(o => o.moeda === 'gold');
    } else if (currentDiamondFilter === 'orb') {
      list = list.filter(o => o.moeda === 'orb' || o.moeda === 'gems');
    }

    if (!list || list.length === 0) {
      const msgFilter = currentDiamondFilter === 'gold' ? ' em Coins (GP)' : (currentDiamondFilter === 'orb' ? ' em Gemas' : '');
      containerDiamantesOffers.innerHTML = `
        <div style="text-align: center; padding: 30px 10px; color: var(--sobre-mad-dim); font-size: 10.5px;">
          Nenhum jogador anunciando Diamantes${msgFilter} no momento.<br>
          <span style="font-size: 9px; opacity: 0.8;">Use a aba "Anunciar à Venda" para criar uma oferta pública de Diamantes.</span>
        </div>
      `;
      return;
    }

    containerDiamantesOffers.innerHTML = '';
    list.forEach(off => {
      const row = document.createElement('div');
      row.className = 'vao';
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.padding = '8px 10px';
      row.style.borderRadius = '0px';

      const isGemas = off.moeda === 'orb' || off.moeda === 'gems';
      const moedaNome = isGemas ? 'Gemas' : 'GP';
      const moedaIcon = isGemas ? 'icons/orbe.png' : 'icons/ouro.png';
      const precoUnit = Number(off.preco || off.unitPrice || 0);
      const qtd = Number(off.qtd || off.quantidade || 1);
      const precoTotal = precoUnit * qtd;

      row.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <img src="https://pokeidle.io/img/moeda-diamante.png" style="width: 22px; height: 22px; object-fit: contain;">
          <div style="display: flex; flex-direction: column;">
            <span style="font-size: 11px; color: #fff; font-weight: 700;">${qtd.toLocaleString()} Diamantes</span>
            <span style="font-size: 8.5px; color: var(--sobre-mad-dim);">Vendedor: <b>${off.vendedor || 'Comunidade'}</b></span>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="text-align: right;">
            <div style="font-size: 10.5px; color: ${isGemas ? 'var(--gemas)' : 'var(--coins)'}; font-weight: 800; display: flex; align-items: center; gap: 3px; justify-content: flex-end;">
              <img src="${moedaIcon}" style="width: 12px; height: 12px; object-fit: contain;">
              ${precoUnit.toLocaleString()} ${moedaNome} / un
            </div>
            <span style="font-size: 8.5px; color: var(--vao-dim);">Total: ${precoTotal.toLocaleString()} ${moedaNome}</span>
          </div>

          <button type="button" class="btn btn-ouro btn-mini btn-buy-diamond-offer" style="border-radius: 0px; padding: 4px 10px;" data-id="${off.id}">
            Comprar
          </button>
        </div>
      `;

      const btnBuy = row.querySelector('.btn-buy-diamond-offer');
      if (btnBuy) {
        btnBuy.addEventListener('click', () => {
          btnBuy.textContent = 'Enviando...';
          btnBuy.disabled = true;
          sendToActiveTab({
            action: 'BUY_MANUAL_OFFER',
            offerId: off.id,
            qty: qtd,
            price: precoUnit,
            moeda: off.moeda || 'gold',
            targetName: `${qtd} Diamantes`,
            seller: off.vendedor || ''
          });
          setTimeout(() => {
            btnBuy.textContent = 'Ordem Enviada!';
            fetchDiamondMarketOffers();
          }, 1000);
        });
      }

      containerDiamantesOffers.appendChild(row);
    });
  }

  function setDiamondFilter(filter) {
    currentDiamondFilter = filter;
    if (btnFilterDiamondsAll) {
      btnFilterDiamondsAll.classList.toggle('on', filter === 'all');
      btnFilterDiamondsAll.classList.toggle('apagado', filter !== 'all');
    }
    if (btnFilterDiamondsGold) {
      btnFilterDiamondsGold.classList.toggle('on', filter === 'gold');
      btnFilterDiamondsGold.classList.toggle('apagado', filter !== 'gold');
    }
    if (btnFilterDiamondsGems) {
      btnFilterDiamondsGems.classList.toggle('on', filter === 'orb');
      btnFilterDiamondsGems.classList.toggle('apagado', filter !== 'orb');
    }
    renderDiamondOffers(cachedDiamondOffers);
  }

  if (btnFilterDiamondsAll) btnFilterDiamondsAll.addEventListener('click', () => setDiamondFilter('all'));
  if (btnFilterDiamondsGold) btnFilterDiamondsGold.addEventListener('click', () => setDiamondFilter('gold'));
  if (btnFilterDiamondsGems) btnFilterDiamondsGems.addEventListener('click', () => setDiamondFilter('orb'));

  function updateSellDiamantesResumo() {
    if (!boxSellDiamantesResumo) return;
    const qtd = Number(inputSellDiamantesQtd?.value) || 0;
    const preco = Number(inputSellDiamantesPreco?.value) || 0;
    const moeda = selectSellDiamantesMoeda?.value === 'orb' ? 'Gemas' : 'GP';
    const total = qtd * preco;
    boxSellDiamantesResumo.innerHTML = `Total a receber por ${qtd.toLocaleString()} Diamantes: <b style="color: #fff;">${total.toLocaleString()} ${moeda}</b>`;
  }

  if (inputSellDiamantesQtd) inputSellDiamantesQtd.addEventListener('input', updateSellDiamantesResumo);
  if (inputSellDiamantesPreco) inputSellDiamantesPreco.addEventListener('input', updateSellDiamantesResumo);
  if (selectSellDiamantesMoeda) selectSellDiamantesMoeda.addEventListener('change', updateSellDiamantesResumo);

  if (btnOpenDiamantesModal) btnOpenDiamantesModal.addEventListener('click', () => openDiamantesModal('comprar'));
  if (btnCloseDiamantesModal) btnCloseDiamantesModal.addEventListener('click', closeDiamantesModal);
  if (btnCloseDiamantesModalBottom) btnCloseDiamantesModalBottom.addEventListener('click', closeDiamantesModal);

  if (tabDiamanteComprar) tabDiamanteComprar.addEventListener('click', () => switchDiamanteTab('comprar'));
  if (tabDiamanteVender) tabDiamanteVender.addEventListener('click', () => switchDiamanteTab('vender'));
  if (tabDiamanteRecarga) tabDiamanteRecarga.addEventListener('click', () => switchDiamanteTab('recarga'));
  if (btnRefreshDiamantesMarket) btnRefreshDiamantesMarket.addEventListener('click', fetchDiamondMarketOffers);

  if (btnSubmitSellDiamantes) {
    btnSubmitSellDiamantes.addEventListener('click', () => {
      const qtd = Number(inputSellDiamantesQtd?.value) || 0;
      const preco = Number(inputSellDiamantesPreco?.value) || 0;
      const moeda = selectSellDiamantesMoeda?.value === 'orb' ? 'orb' : 'gold';

      if (qtd <= 0) {
        alert('Informe uma quantidade válida de Diamantes.');
        return;
      }
      if (preco <= 0) {
        alert('Informe um preço unitário válido.');
        return;
      }

      btnSubmitSellDiamantes.textContent = 'Publicando no Mercado...';
      btnSubmitSellDiamantes.disabled = true;

      sendToActiveTab({
        action: 'CREATE_MARKET_LISTING',
        tipo: 'diamante',
        qtd: qtd,
        preco: preco,
        moeda: moeda
      });

      setTimeout(() => {
        btnSubmitSellDiamantes.textContent = '📢 Publicar Anúncio de Diamantes';
        btnSubmitSellDiamantes.disabled = false;
        alert(`Anúncio de ${qtd} Diamantes por ${preco.toLocaleString()} ${moeda === 'orb' ? 'Gemas' : 'GP'} cada enviado ao mercado com sucesso!`);
        closeDiamantesModal();
        sendToActiveTab({ action: 'FETCH_MY_LISTINGS' });
      }, 1000);
    });
  }

  // =========================================================================
  // 10. ESTATÍSTICAS DE FARM AO VIVO & TAXAS (XP/H, GP/H, KILLS/MIN)
  // =========================================================================
  const statsSessionTimer = document.getElementById('stats-session-timer');
  const btnResetFarmStats = document.getElementById('btn-reset-farm-stats');

  const statKillsTotal = document.getElementById('stat-kills-total');
  const statKillsRate = document.getElementById('stat-kills-rate');
  const statCatchesTotal = document.getElementById('stat-catches-total');
  const statCatchesRate = document.getElementById('stat-catches-rate');
  const statTrainerXp = document.getElementById('stat-trainer-xp');
  const statTrainerXpRate = document.getElementById('stat-trainer-xp-rate');
  const statPokeXp = document.getElementById('stat-poke-xp');
  const statPokeXpRate = document.getElementById('stat-poke-xp-rate');
  const statGoldTotal = document.getElementById('stat-gold-total');
  const statGoldRate = document.getElementById('stat-gold-rate');
  const statShiniesTotal = document.getElementById('stat-shinies-total');
  const statShiniesSub = document.getElementById('stat-shinies-sub');

  const statDropsCount = document.getElementById('stat-drops-count');
  const containerFarmDrops = document.getElementById('container-farm-drops');

  // Elementos do Dashboard de Rendimento por Hunt
  const statHuntsCount = document.getElementById('stat-hunts-count');
  const btnResetHuntsStats = document.getElementById('btn-reset-hunts-stats');
  const activeHuntName = document.getElementById('active-hunt-name');
  const activeHuntTierBadge = document.getElementById('active-hunt-tier-badge');
  const activeHuntTimer = document.getElementById('active-hunt-timer');
  const activeHuntLiveXp = document.getElementById('active-hunt-live-xp');
  const activeHuntLiveGp = document.getElementById('active-hunt-live-gp');
  const activeHuntLiveCatches = document.getElementById('active-hunt-live-catches');
  const activeHuntLiveShinies = document.getElementById('active-hunt-live-shinies');
  const containerHuntsDashboard = document.getElementById('container-hunts-dashboard');
  const huntSortBtns = document.querySelectorAll('.hunt-sort-btn');

  let currentHuntSort = 'xp';

  let farmSessionData = {
    startTime: Date.now(),
    kills: 0,
    catches: 0,
    captures: 0,
    ballAttempts: 0,
    trainerXp: 0,
    pokemonXp: 0,
    gold: 0,
    drops: {},
    shiniesSeen: 0,
    shiniesCaught: 0,
    activeHuntSlug: '',
    activeHuntName: '',
    inCenter: false,
    hunts: {}
  };

  function formatHuntDuration(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    if (h > 0) return `${h}h ${pad(m)}m ${pad(s)}s`;
    return `${pad(m)}m ${pad(s)}s`;
  }

  function renderHuntStatsDashboard() {
    const huntsObj = farmSessionData.hunts || {};
    const huntEntries = Object.entries(huntsObj);
    const activeSlug = farmSessionData.activeHuntSlug || '';
    const activeHunt = huntsObj[activeSlug] || null;

    // Atualiza Banner de Hunt Ativa no Topo do Quadro
    if (farmSessionData.inCenter) {
      if (activeHuntName) {
        activeHuntName.textContent = '🏥 Centro Pokémon (Descansando / Curando)';
        activeHuntName.style.color = '#9fe4ff';
      }
      if (activeHuntTierBadge) activeHuntTierBadge.style.display = 'none';
      if (activeHuntTimer) activeHuntTimer.textContent = '⏱️ Pausado';
      if (activeHuntLiveXp) activeHuntLiveXp.textContent = '🐾 0 XP/h';
      if (activeHuntLiveGp) activeHuntLiveGp.textContent = '🪙 0 GP/h';
      if (activeHuntLiveCatches) activeHuntLiveCatches.textContent = '🎯 0 capturas';
      if (activeHuntLiveShinies) activeHuntLiveShinies.textContent = '✨ 0 vistos (0 capt.)';
    } else {
      if (activeHuntName) {
        activeHuntName.style.color = '#fff';
        if (activeHunt || farmSessionData.activeHuntName) {
          activeHuntName.textContent = (activeHunt && activeHunt.name) || farmSessionData.activeHuntName || 'Hunt Desconhecida';
          if (activeHuntTierBadge) {
            const tier = (activeHunt && activeHunt.outlandTier) || 0;
            if (tier > 0) {
              activeHuntTierBadge.textContent = `T${tier}`;
              activeHuntTierBadge.style.display = 'inline-block';
            } else {
              activeHuntTierBadge.style.display = 'none';
            }
          }
        } else {
          activeHuntName.textContent = 'Aguardando batalha...';
          if (activeHuntTierBadge) activeHuntTierBadge.style.display = 'none';
        }
      }

      if (activeHunt) {
        const aSec = Math.max(1, Math.floor((activeHunt.durationMs || 0) / 1000));
        const aHours = Math.max(0.005, aSec / 3600);
        const aXpRate = Math.round((activeHunt.pokemonXp || 0) / aHours);
        const aGpRate = Math.round((activeHunt.gold || 0) / aHours);
        const aCatches = Number(activeHunt.captures ?? activeHunt.catches) || 0;
        const aShiniesSeen = Number(activeHunt.shiniesSeen) || 0;
        const aShiniesCaught = Number(activeHunt.shiniesCaught) || 0;

        if (activeHuntTimer) activeHuntTimer.textContent = `⏱️ ${formatHuntDuration(activeHunt.durationMs || 0)}`;
        if (activeHuntLiveXp) activeHuntLiveXp.textContent = `🐾 ${aXpRate >= 1000000 ? (aXpRate / 1000000).toFixed(1) + 'M' : (aXpRate >= 1000 ? (aXpRate / 1000).toFixed(0) + 'k' : aXpRate)} XP/h`;
        if (activeHuntLiveGp) activeHuntLiveGp.textContent = `🪙 ${aGpRate >= 1000000 ? (aGpRate / 1000000).toFixed(1) + 'M' : (aGpRate >= 1000 ? (aGpRate / 1000).toFixed(0) + 'k' : aGpRate)} GP/h`;
        if (activeHuntLiveCatches) activeHuntLiveCatches.textContent = `🎯 ${aCatches} ${aCatches === 1 ? 'captura' : 'capturas'}`;
        if (activeHuntLiveShinies) activeHuntLiveShinies.textContent = `✨ ${aShiniesSeen} ${aShiniesSeen === 1 ? 'visto' : 'vistos'} (${aShiniesCaught} capt.)`;
      } else {
        if (activeHuntTimer) activeHuntTimer.textContent = '⏱️ 00:00';
        if (activeHuntLiveXp) activeHuntLiveXp.textContent = '🐾 0 XP/h';
        if (activeHuntLiveGp) activeHuntLiveGp.textContent = '🪙 0 GP/h';
        if (activeHuntLiveCatches) activeHuntLiveCatches.textContent = '🎯 0 capturas';
        if (activeHuntLiveShinies) activeHuntLiveShinies.textContent = '✨ 0 vistos (0 capt.)';
      }
    }

    // Contador de Hunts Catalogadas
    if (statHuntsCount) {
      statHuntsCount.textContent = `${huntEntries.length} ${huntEntries.length === 1 ? 'hunt' : 'hunts'}`;
    }

    if (!containerHuntsDashboard) return;

    if (huntEntries.length === 0) {
      containerHuntsDashboard.innerHTML = `
        <div style="text-align: center; padding: 35px 10px; color: var(--sobre-mad-dim); font-size: 11px;">
          Nenhuma hunt registrada nesta sessão ainda.<br>
          <span style="font-size: 9px; opacity: 0.8;">Inicie batalhas em qualquer hunt do PokéIdle para ver as médias de XP/h, GP/h, capturas e shinies.</span>
        </div>
      `;
      return;
    }

    // Enriquecimento e cálculo de médias por hunt
    const enrichedList = huntEntries.map(([slug, h]) => {
      const durMs = Math.max(1000, Number(h.durationMs) || 1000);
      const hours = Math.max(0.005, durMs / 3600000);
      const pokeXp = Number(h.pokemonXp) || 0;
      const gold = Number(h.gold) || 0;
      const kills = Number(h.kills) || 0;
      const catches = Number(h.captures ?? h.catches) || 0;
      const attempts = Number(h.attempts ?? h.ballAttempts) || 0;
      const shiniesSeen = Number(h.shiniesSeen) || 0;
      const shiniesCaught = Number(h.shiniesCaught) || 0;

      const xpHour = Math.round(pokeXp / hours);
      const gpHour = Math.round(gold / hours);
      const killsHour = Math.round(kills / hours);
      const catchRatePctNum = attempts > 0 ? (catches / attempts) * 100 : (kills > 0 ? (catches / (catches + kills)) * 100 : 0);

      return {
        slug,
        name: h.name || slug,
        outlandTier: Number(h.outlandTier) || 0,
        durationMs: durMs,
        hours,
        pokeXp,
        gold,
        kills,
        catches,
        attempts,
        shiniesSeen,
        shiniesCaught,
        xpHour,
        gpHour,
        killsHour,
        catchRatePctNum,
        catchRatePct: catchRatePctNum.toFixed(1) + '%',
        isActive: slug === activeSlug && !farmSessionData.inCenter
      };
    });

    // Identificação dos líderes de rendimento para badges de honra
    const maxXp = Math.max(...enrichedList.map(e => e.xpHour));
    const maxGp = Math.max(...enrichedList.map(e => e.gpHour));
    const maxKills = Math.max(...enrichedList.map(e => e.killsHour));
    const maxCatch = Math.max(...enrichedList.map(e => e.catchRatePctNum));

    // Ordenação dinâmica pelo filtro selecionado
    enrichedList.sort((a, b) => {
      if (currentHuntSort === 'xp') return b.xpHour - a.xpHour;
      if (currentHuntSort === 'gp') return b.gpHour - a.gpHour;
      if (currentHuntSort === 'kills') return b.killsHour - a.killsHour;
      if (currentHuntSort === 'catch') return b.catchRatePctNum - a.catchRatePctNum;
      if (currentHuntSort === 'shinies') {
        const scoreB = (b.shiniesSeen * 100) + b.shiniesCaught;
        const scoreA = (a.shiniesSeen * 100) + a.shiniesCaught;
        return scoreB - scoreA || b.shiniesSeen - a.shiniesSeen;
      }
      if (currentHuntSort === 'time') return b.durationMs - a.durationMs;
      return b.xpHour - a.xpHour;
    });

    containerHuntsDashboard.innerHTML = '';

    enrichedList.forEach(h => {
      const card = document.createElement('div');
      card.className = `stat-hunt-card ${h.isActive ? 'active-hunt-highlight' : ''}`;

      const xpDisplay = h.xpHour >= 1000000 ? `${(h.xpHour / 1000000).toFixed(2)}M` : `${h.xpHour.toLocaleString()}`;
      const gpDisplay = h.gpHour >= 1000000 ? `${(h.gpHour / 1000000).toFixed(2)}M` : `${h.gpHour.toLocaleString()}`;

      // Badges comemorativas
      let badgesHtml = '';
      if (h.outlandTier > 0) {
        badgesHtml += `<span class="stat-hunt-pill" style="background: var(--roxo); color: #fff;">T${h.outlandTier}</span>`;
      }
      if (h.isActive) {
        badgesHtml += `<span class="stat-hunt-pill" style="background: var(--verde-luz); color: #000;">⚡ ATIVA AGORA</span>`;
      }
      if (h.shiniesCaught > 0) {
        badgesHtml += `<span class="stat-hunt-pill" style="background: #ffd700; color: #000; font-weight: 800;">✨ ${h.shiniesCaught} ${h.shiniesCaught === 1 ? 'SHINY CAPTURADO' : 'SHINIES CAPTURADOS'}</span>`;
      } else if (h.shiniesSeen > 0) {
        badgesHtml += `<span class="stat-hunt-pill" style="background: rgba(255, 215, 0, 0.2); color: #ffd700; box-shadow: inset 0 0 0 1px #ffd700;">✨ ${h.shiniesSeen} ${h.shiniesSeen === 1 ? 'SHINY VISTO' : 'SHINIES VISTOS'}</span>`;
      }
      if (h.xpHour >= maxXp && maxXp > 0) {
        badgesHtml += `<span class="stat-hunt-pill" style="background: #9333ea; color: #fff;">👑 TOP XP</span>`;
      }
      if (h.gpHour >= maxGp && maxGp > 0) {
        badgesHtml += `<span class="stat-hunt-pill" style="background: var(--ouro); color: #000;">🪙 TOP GP</span>`;
      }
      if (h.killsHour >= maxKills && maxKills > 0) {
        badgesHtml += `<span class="stat-hunt-pill" style="background: #ef4444; color: #fff;">⚔️ TOP KILLS</span>`;
      }
      if (h.catchRatePctNum >= maxCatch && maxCatch > 0 && h.catches > 0) {
        badgesHtml += `<span class="stat-hunt-pill" style="background: var(--azul-luz); color: #000;">🎯 TOP CAPTURA</span>`;
      }

      card.innerHTML = `
        <div class="stat-hunt-card-header">
          <div style="display: flex; align-items: center; gap: 6px; min-width: 0;">
            <span style="font-size: 11px; font-weight: 800; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${h.name}
            </span>
            <div class="stat-hunt-badges-row">
              ${badgesHtml}
            </div>
          </div>
          <span style="font-size: 9px; font-weight: 700; color: var(--ouro); font-family: var(--fonte-mono, monospace); flex-shrink: 0;">
            ⏱️ ${formatHuntDuration(h.durationMs)}
          </span>
        </div>

        <div class="stat-hunt-grid">
          <div class="stat-hunt-col">
            <span class="stat-hunt-col-label">XP / h</span>
            <span class="stat-hunt-col-val" style="color: #c084fc;">${xpDisplay}</span>
            <span class="stat-hunt-col-sub">+${h.pokeXp.toLocaleString()} XP</span>
          </div>
          <div class="stat-hunt-col">
            <span class="stat-hunt-col-label">GP / h</span>
            <span class="stat-hunt-col-val" style="color: var(--coins);">${gpDisplay}</span>
            <span class="stat-hunt-col-sub">+${h.gold.toLocaleString()} GP</span>
          </div>
          <div class="stat-hunt-col">
            <span class="stat-hunt-col-label">Kills / h</span>
            <span class="stat-hunt-col-val" style="color: #fff;">${h.killsHour.toLocaleString()}</span>
            <span class="stat-hunt-col-sub">${h.kills.toLocaleString()} abates</span>
          </div>
          <div class="stat-hunt-col">
            <span class="stat-hunt-col-label">Taxa Captura</span>
            <span class="stat-hunt-col-val" style="color: var(--verde-luz);">${h.catchRatePct}</span>
            <span class="stat-hunt-col-sub">${h.catches} un / ${h.attempts || h.catches} bolas</span>
          </div>
        </div>

        ${(h.shiniesSeen > 0 || h.shiniesCaught > 0) ? `
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 9.5px; color: #ffd700; background: rgba(255, 215, 0, 0.12); padding: 4px 8px; box-shadow: inset 0 0 0 1px rgba(255, 215, 0, 0.35); font-weight: 700;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span>✨ Shinies na Hunt:</span>
              <span style="color: #fff;">👁️ <b>${h.shiniesSeen}</b> ${h.shiniesSeen === 1 ? 'visto' : 'vistos'}</span>
              <span>•</span>
              <span style="color: var(--verde-luz);">🎯 <b>${h.shiniesCaught}</b> ${h.shiniesCaught === 1 ? 'capturado' : 'capturados'}</span>
            </div>
            <span style="font-family: var(--fonte-mono, monospace); font-size: 8.5px; opacity: 0.9;">
              Taxa de Captura: ${h.shiniesSeen > 0 ? ((h.shiniesCaught / h.shiniesSeen) * 100).toFixed(0) : 0}%
            </span>
          </div>
        ` : `
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 8.5px; color: var(--sobre-mad-dim); background: rgba(0, 0, 0, 0.25); padding: 3px 8px; box-shadow: inset 0 0 0 1px var(--mad-linha);">
            <span>✨ Shinies na Hunt: 0 vistos • 0 capturados</span>
            <span style="opacity: 0.6;">Nenhum shiny avistado ainda</span>
          </div>
        `}
      `;

      containerHuntsDashboard.appendChild(card);
    });
  }

  function updateFarmStatsUI() {
    const now = Date.now();
    const start = Number(farmSessionData.startTime) || now;
    const elapsedMs = Math.max(1000, now - start);

    // Formatação de Tempo (HH:MM:SS)
    const totalSec = Math.floor(elapsedMs / 1000);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    if (statsSessionTimer) {
      statsSessionTimer.textContent = `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }

    // Cálculo de Taxas Globais
    const minutes = elapsedMs / 60000;
    const hours = elapsedMs / 3600000;

    const killsVal = Number(farmSessionData.kills) || 0;
    const catchesVal = Number(farmSessionData.catches ?? farmSessionData.captures) || 0;
    const trainerXpVal = Number(farmSessionData.trainerXp) || 0;
    const pokeXpVal = Number(farmSessionData.pokemonXp) || 0;
    const goldVal = Number(farmSessionData.gold) || 0;
    const shiniesSeenVal = Number(farmSessionData.shiniesSeen) || 0;
    const shiniesCaughtVal = Number(farmSessionData.shiniesCaught) || 0;

    const killsPerMin = minutes > 0.05 ? (killsVal / minutes).toFixed(1) : '0.0';
    const catchesPerHour = hours > 0.01 ? Math.round(catchesVal / hours) : 0;
    const trainerXpPerHour = hours > 0.01 ? Math.round(trainerXpVal / hours) : 0;
    const pokeXpPerHour = hours > 0.01 ? Math.round(pokeXpVal / hours) : 0;
    const goldPerHour = hours > 0.01 ? Math.round(goldVal / hours) : 0;

    if (statKillsTotal) statKillsTotal.textContent = killsVal.toLocaleString();
    if (statKillsRate) statKillsRate.textContent = `${killsPerMin} / min`;

    if (statCatchesTotal) statCatchesTotal.textContent = catchesVal.toLocaleString();
    if (statCatchesRate) statCatchesRate.textContent = `${catchesPerHour.toLocaleString()} / h`;

    if (statTrainerXp) statTrainerXp.textContent = trainerXpVal.toLocaleString();
    if (statTrainerXpRate) statTrainerXpRate.textContent = `${trainerXpPerHour.toLocaleString()} XP / h`;

    if (statPokeXp) statPokeXp.textContent = pokeXpVal.toLocaleString();
    if (statPokeXpRate) statPokeXpRate.textContent = `${pokeXpPerHour.toLocaleString()} XP / h`;

    if (statGoldTotal) statGoldTotal.textContent = `${goldVal.toLocaleString()} GP`;
    if (statGoldRate) statGoldRate.textContent = `${goldPerHour.toLocaleString()} GP / h`;

    if (statShiniesTotal) statShiniesTotal.textContent = shiniesSeenVal.toLocaleString();
    if (statShiniesSub) statShiniesSub.textContent = `${shiniesCaughtVal.toLocaleString()} Capturados`;

    // Renderiza o Dashboard Comparativo de Hunts
    renderHuntStatsDashboard();

    // Renderização dos Drops Acumulados
    if (containerFarmDrops) {
      const dropsObj = farmSessionData.drops || {};
      const dropEntries = Object.entries(dropsObj);

      if (statDropsCount) {
        statDropsCount.textContent = `${dropEntries.length} ${dropEntries.length === 1 ? 'item dropado' : 'tipos de itens'}`;
      }

      if (dropEntries.length === 0) {
        containerFarmDrops.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 40px 10px; color: var(--sobre-mad-dim); font-size: 11px;">
            Nenhum drop registrado nesta sessão ainda.<br>
            <span style="font-size: 9px; opacity: 0.8;">Bata em monstros e complete hunts no jogo para acumular loots.</span>
          </div>
        `;
      } else {
        // Ordena por quantidade descrescente
        dropEntries.sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0));

        containerFarmDrops.innerHTML = '';
        dropEntries.forEach(([itemName, itemQty]) => {
          let rotomIt = null;
          if (typeof window.getRotomItem === 'function') {
            rotomIt = window.getRotomItem(itemName);
          }
          const iconUrl = rotomIt && typeof window.getItemIconUrl === 'function'
            ? window.getItemIconUrl(rotomIt)
            : 'icons/ouro.png';

          const card = document.createElement('div');
          card.className = 'stat-drop-card';
          card.innerHTML = `
            <img src="${iconUrl}" class="stat-drop-icon" alt="${itemName}">
            <div style="flex: 1; min-width: 0; display: flex; flex-direction: column;">
              <span style="font-size: 11px; color: #fff; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${itemName}">${itemName}</span>
              <span style="font-size: 9px; color: var(--ouro); font-weight: 800;">${Number(itemQty).toLocaleString()} un</span>
            </div>
            ${rotomIt ? `<button type="button" class="btn btn-mini btn-roxo btn-snipe-this-drop" style="font-size: 8px; padding: 2px 6px; border-radius: 0px;" title="Criar regra de compra no mercado">🎯 Snipe</button>` : ''}
          `;

          const btnSnipe = card.querySelector('.btn-snipe-this-drop');
          if (btnSnipe && rotomIt) {
            btnSnipe.addEventListener('click', () => {
              configureSniperRuleFromItem(rotomIt, 0, 0);
              switchMainView('sniper');
            });
          }

          containerFarmDrops.appendChild(card);
        });
      }
    }
  }

  // Cronômetro contínuo a cada segundo
  setInterval(() => {
    const start = Number(farmSessionData.startTime);
    if (start && start > 0) {
      updateFarmStatsUI();
    }
  }, 1000);

  // Botões de ordenação do Dashboard de Hunts
  if (huntSortBtns && huntSortBtns.length > 0) {
    huntSortBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        huntSortBtns.forEach(b => {
          b.classList.remove('on');
          b.classList.add('apagado');
        });
        btn.classList.add('on');
        btn.classList.remove('apagado');
        currentHuntSort = btn.getAttribute('data-sort') || 'xp';
        renderHuntStatsDashboard();
      });
    });
  }

  // Reset exclusivo do histórico de hunts
  if (btnResetHuntsStats) {
    btnResetHuntsStats.addEventListener('click', () => {
      if (!confirm('Deseja limpar o histórico de rendimento por hunt?')) return;
      if (farmSessionData) farmSessionData.hunts = {};
      renderHuntStatsDashboard();
      sendToActiveTab({ action: 'RESET_HUNTS_STATS' });
    });
  }

  if (btnResetFarmStats) {
    btnResetFarmStats.addEventListener('click', () => {
      if (!confirm('Deseja reiniciar a sessão atual de telemetria de farm?')) return;
      const curSlug = farmSessionData.activeHuntSlug || '';
      const curName = farmSessionData.activeHuntName || '';
      farmSessionData = {
        startTime: Date.now(),
        kills: 0,
        catches: 0,
        captures: 0,
        ballAttempts: 0,
        trainerXp: 0,
        pokemonXp: 0,
        gold: 0,
        drops: {},
        shiniesSeen: 0,
        shiniesCaught: 0,
        activeHuntSlug: curSlug,
        activeHuntName: curName,
        hunts: {}
      };
      updateFarmStatsUI();
      sendToActiveTab({ action: 'RESET_FARM_STATS' });
    });
  }

  // =========================================================================
  // 11. ENCICLOPÉDIA DE HUNTS & BOSSES
  // =========================================================================
  const subtabHuntsList = document.getElementById('subtab-hunts-list');
  const subtabBossesList = document.getElementById('subtab-bosses-list');

  const panelHuntsList = document.getElementById('panel-hunts-list');
  const panelBossesList = document.getElementById('panel-bosses-list');

  const boxHuntsFilters = document.getElementById('box-hunts-filters');
  const inputSearchHunts = document.getElementById('input-search-hunts');
  const huntLvlFilters = document.querySelectorAll('.hunt-lvl-filter');
  const huntTypeFilters = document.querySelectorAll('.hunt-type-filter');
  const containerHuntsGrid = document.getElementById('container-hunts-grid');
  const containerBossesGrid = document.getElementById('container-bosses-grid');
  const lblHuntsCounter = document.getElementById('lbl-hunts-counter');
  const lblBossesCounter = document.getElementById('lbl-bosses-counter');

  // Calculadora Probabilística de Boss Tokens & Drops Canônicos
  const bossCalcSelect = document.getElementById('boss-calc-select');
  const bossCalcReward = document.getElementById('boss-calc-reward');
  const bossCalcTargetQty = document.getElementById('boss-calc-target-qty');
  const bossCalcDropChance = document.getElementById('boss-calc-drop-chance');
  const btnRunBossCalc = document.getElementById('btn-run-boss-calc');
  const bossCalcDetailsTxt = document.getElementById('boss-calc-details-txt');
  const bossCalcEntryCost = document.getElementById('boss-calc-entry-cost');
  const resBossExpected = document.getElementById('res-boss-expected');
  const resBossExpectedGp = document.getElementById('res-boss-expected-gp');
  const resBossLucky = document.getElementById('res-boss-lucky');
  const resBossSafe = document.getElementById('res-boss-safe');
  const resBossDays = document.getElementById('res-boss-days');
  const bossFilterFocusBtns = document.querySelectorAll('.boss-filter-focus');

  let currentHuntsSubtab = 'hunts'; // 'hunts' | 'bosses'
  let currentBossFocus = 'all'; // 'all' | 'aoe' | 'tm'
  let currentHuntLvlFilter = 'all';
  let currentHuntTypeFilter = 'all';
  let currentHuntSearchQuery = '';
  let huntsViewInitialized = false;

  const POKEMON_TYPE_COLORS = {
    BUG: '#92BC2C',
    DARK: '#595761',
    DRAGON: '#0C69C8',
    ELECTRIC: '#F2D94E',
    FAIRY: '#EE90E6',
    FIGHTING: '#D3425F',
    FIRE: '#FBA54C',
    FLYING: '#A1BBEC',
    GHOST: '#5F6DBC',
    GRASS: '#5FBD58',
    GROUND: '#DA7C4D',
    ICE: '#75D0C1',
    NORMAL: '#A0A29F',
    POISON: '#B763CF',
    PSYCHIC: '#FA8581',
    ROCK: '#C9BB8A',
    STEEL: '#5695A3',
    WATER: '#539DDF'
  };

  function initHuntsView() {
    if (!huntsViewInitialized) {
      huntsViewInitialized = true;
      renderHunts();
      populateBossSelect();
      renderBosses();
    }
  }

  function switchHuntsSubtab(sub) {
    currentHuntsSubtab = sub;
    const isHunts = (sub === 'hunts');
    const isBosses = (sub === 'bosses');

    if (subtabHuntsList) { subtabHuntsList.classList.toggle('on', isHunts); subtabHuntsList.classList.toggle('apagado', !isHunts); }
    if (subtabBossesList) { subtabBossesList.classList.toggle('on', isBosses); subtabBossesList.classList.toggle('apagado', !isBosses); }

    if (panelHuntsList) panelHuntsList.style.display = isHunts ? 'flex' : 'none';
    if (panelBossesList) panelBossesList.style.display = isBosses ? 'flex' : 'none';

    // Oculta os filtros de nível/fraqueza quando estiver nos Bosses
    if (boxHuntsFilters) {
      boxHuntsFilters.style.display = isHunts ? 'flex' : 'none';
    }

    if (isBosses) {
      populateBossSelect();
      renderBosses();
      runBossProbabilityCalculation();
    } else {
      renderHunts();
    }
  }

  if (subtabHuntsList) subtabHuntsList.addEventListener('click', () => switchHuntsSubtab('hunts'));
  if (subtabBossesList) subtabBossesList.addEventListener('click', () => switchHuntsSubtab('bosses'));

  // --- POPULA O SELECT DE BOSSES CANÔNICOS ---
  function populateBossSelect(preselectKey) {
    if (!bossCalcSelect) return;
    const db = window.ROTOM_BOSSES_DB || [];
    
    // Filtro por foco: 'all' | 'aoe' | 'tm'
    const filtered = db.filter(b => {
      if (currentBossFocus === 'all') return true;
      const drops = b.drops || [];
      const isAoe = drops.some(d => (d.n || '').toLowerCase().includes('aoe'));
      if (currentBossFocus === 'aoe') return isAoe;
      if (currentBossFocus === 'tm') return !isAoe;
      return true;
    });

    const previousVal = preselectKey || bossCalcSelect.value;
    bossCalcSelect.innerHTML = '';

    filtered.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.k;
      const dropSummary = (b.drops || []).map(d => `${d.n} (${Number(d.c).toFixed(1)}%)`).join(', ');
      const lvlStr = b.lvl ? Number(b.lvl).toLocaleString() : 'Boss';
      opt.textContent = `${b.n} (Nv. ${lvlStr} • ${dropSummary})`;
      bossCalcSelect.appendChild(opt);
    });

    if (filtered.some(b => b.k === previousVal)) {
      bossCalcSelect.value = previousVal;
    } else if (filtered.length > 0) {
      bossCalcSelect.value = filtered[0].k;
    }

    updateBossRewardOptions();
  }

  // --- ATUALIZA OS DROPS DO CHEFE SELECIONADO NA CALCULADORA ---
  function updateBossRewardOptions() {
    if (!bossCalcReward || !bossCalcSelect) return;
    const db = window.ROTOM_BOSSES_DB || [];
    const selectedBossKey = bossCalcSelect.value;
    const boss = db.find(b => b.k === selectedBossKey);

    bossCalcReward.innerHTML = '';
    if (!boss) {
      if (bossCalcDetailsTxt) bossCalcDetailsTxt.textContent = 'Nenhum chefe selecionado.';
      return;
    }

    // Atualiza banner de detalhes
    if (bossCalcDetailsTxt) {
      const types = [boss.t1, boss.t2].filter(Boolean).join('/');
      const teamReq = boss.teamLevel ? ` • Req. Time Nv. ${Number(boss.teamLevel).toLocaleString()}` : '';
      bossCalcDetailsTxt.innerHTML = `<span style="color: var(--ouro); font-weight: 800;">${boss.n}</span> (Nv. ${Number(boss.lvl || 0).toLocaleString()} • Tipo ${types}${teamReq})`;
    }
    if (bossCalcEntryCost) {
      bossCalcEntryCost.textContent = `Entrada: ${boss.ent || '1× Bronze Boss Token'}`;
    }

    const drops = boss.drops || [];
    drops.forEach((d, idx) => {
      const opt = document.createElement('option');
      opt.value = String(d.itemId || d.n);
      opt.setAttribute('data-chance', String(d.c));
      opt.setAttribute('data-name', d.n);
      opt.textContent = `${d.n} — ${Number(d.c).toFixed(1)}% por run`;
      if (idx === 0) opt.selected = true;
      bossCalcReward.appendChild(opt);
    });

    if (drops.length > 0 && bossCalcDropChance) {
      bossCalcDropChance.value = Number(drops[0].c).toFixed(1);
    }

    // Se for peça de TM (10 peças para montar 1 TM completo), sugerir 10
    if (drops.length > 0 && (drops[0].n.includes('Piece') || drops[0].n.includes('Disk'))) {
      if (bossCalcTargetQty && (!bossCalcTargetQty.value || Number(bossCalcTargetQty.value) <= 1)) {
        bossCalcTargetQty.value = 10;
      }
    }

    runBossProbabilityCalculation();
  }

  // --- CALCULADORA PROBABILÍSTICA OFICIAL DE BOSS TOKENS ---
  function runBossProbabilityCalculation() {
    const targetQty = Math.max(1, Number(bossCalcTargetQty?.value) || 10);
    const dropChancePct = Math.max(0.01, Number(bossCalcDropChance?.value) || 1.0);
    const p = dropChancePct / 100.0;

    // 1. Média Esperada E[N] = k / p
    const expectedRuns = Math.round(targetQty / p);

    // 2. Desvio Padrão da Binomial Negativa: sqrt(k * (1-p) / p^2)
    const stdDev = Math.sqrt(targetQty * (1 - p) / (p * p));

    // 3. Cenário Sorte Alta (Percentil 25% ~ Z = -0.675)
    const luckyRuns = Math.max(targetQty, Math.round(expectedRuns - 0.675 * stdDev));

    // 4. Cenário de Segurança 90% (Percentil 90% ~ Z = +1.282)
    const safeRuns = Math.max(expectedRuns, Math.round(expectedRuns + 1.282 * stdDev));

    // 5. Custo em GP no Mercado (Preço de referência do Bronze Boss Token: ~70.000 GP)
    const TOKEN_AVG_PRICE_GP = 70000;
    const totalCostGp = expectedRuns * TOKEN_AVG_PRICE_GP;
    let costGpFormatted = '';
    if (totalCostGp >= 1000000) {
      costGpFormatted = `~ ${(totalCostGp / 1000000).toFixed(1)}M GP no mercado`;
    } else {
      costGpFormatted = `~ ${(totalCostGp / 1000).toFixed(0)}k GP no mercado`;
    }

    // 6. Entradas Diárias (1 grátis por dia)
    const freeDailyDays = expectedRuns;

    if (resBossExpected) resBossExpected.textContent = `~ ${expectedRuns.toLocaleString()} Tokens`;
    if (resBossExpectedGp) resBossExpectedGp.textContent = costGpFormatted;
    if (resBossLucky) resBossLucky.textContent = `~ ${luckyRuns.toLocaleString()} Tokens`;
    if (resBossSafe) resBossSafe.textContent = `~ ${safeRuns.toLocaleString()} Tokens`;
    if (resBossDays) resBossDays.textContent = `~ ${freeDailyDays.toLocaleString()} Dias`;
  }

  if (btnRunBossCalc) {
    btnRunBossCalc.addEventListener('click', runBossProbabilityCalculation);
  }

  if (bossCalcReward) {
    bossCalcReward.addEventListener('change', () => {
      const selected = bossCalcReward.options[bossCalcReward.selectedIndex];
      const ch = selected?.getAttribute('data-chance');
      if (ch && bossCalcDropChance) {
        bossCalcDropChance.value = Number(ch).toFixed(1);
      }
      runBossProbabilityCalculation();
    });
  }

  if (bossCalcSelect) {
    bossCalcSelect.addEventListener('change', () => {
      updateBossRewardOptions();
    });
  }

  // Filtros de Foco de Boss (Todos / AoE TM / TM Piece)
  if (bossFilterFocusBtns) {
    bossFilterFocusBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        bossFilterFocusBtns.forEach(b => { b.classList.remove('on'); b.classList.add('apagado'); });
        btn.classList.add('on');
        btn.classList.remove('apagado');
        currentBossFocus = btn.getAttribute('data-focus') || 'all';
        populateBossSelect();
        renderBosses();
      });
    });
  }

  // Filtros de Nível
  if (huntLvlFilters) {
    huntLvlFilters.forEach(btn => {
      btn.addEventListener('click', () => {
        huntLvlFilters.forEach(b => { b.classList.remove('on'); b.classList.add('apagado'); });
        btn.classList.add('on');
        btn.classList.remove('apagado');
        currentHuntLvlFilter = btn.getAttribute('data-lvl') || 'all';
        renderHunts();
      });
    });
  }

  // Filtros de Fraqueza
  if (huntTypeFilters) {
    huntTypeFilters.forEach(btn => {
      btn.addEventListener('click', () => {
        huntTypeFilters.forEach(b => { b.classList.remove('on'); b.classList.add('apagado'); });
        btn.classList.add('on');
        btn.classList.remove('apagado');
        currentHuntTypeFilter = btn.getAttribute('data-type') || 'all';
        renderHunts();
      });
    });
  }

  // Busca textual
  let huntSearchDebounce = null;
  if (inputSearchHunts) {
    inputSearchHunts.addEventListener('input', () => {
      clearTimeout(huntSearchDebounce);
      huntSearchDebounce = setTimeout(() => {
        currentHuntSearchQuery = (inputSearchHunts.value || '').trim().toLowerCase();
        if (currentHuntsSubtab === 'bosses') {
          renderBosses();
        } else {
          renderHunts();
        }
      }, 150);
    });
  }

  function renderHunts() {
    if (!containerHuntsGrid) return;
    const db = window.ROTOM_HUNTS_DB || [];

    let list = db.filter(h => {
      // Filtro de Nível
      if (currentHuntLvlFilter !== 'all') {
        const lvl = Number(h.lvl) || 1;
        if (currentHuntLvlFilter === '1-20' && (lvl < 1 || lvl > 20)) return false;
        if (currentHuntLvlFilter === '21-40' && (lvl < 21 || lvl > 40)) return false;
        if (currentHuntLvlFilter === '41-60' && (lvl < 41 || lvl > 60)) return false;
        if (currentHuntLvlFilter === '61-80' && (lvl < 61 || lvl > 80)) return false;
        if (currentHuntLvlFilter === '81-100' && (lvl < 81 || lvl > 100)) return false;
        if (currentHuntLvlFilter === '100+' && lvl <= 100) return false;
      }

      // Filtro de Fraqueza Elemental
      if (currentHuntTypeFilter !== 'all') {
        const t = currentHuntTypeFilter.toUpperCase();
        const has4x = Array.isArray(h.w4x) && h.w4x.includes(t);
        const has2x = Array.isArray(h.w2x) && h.w2x.includes(t);
        if (!has4x && !has2x) return false;
      }

      // Busca por Texto
      if (currentHuntSearchQuery) {
        const q = currentHuntSearchQuery;
        const nomeMatch = (h.nome || '').toLowerCase().includes(q);
        const regMatch = (h.reg || '').toLowerCase().includes(q);
        const typesMatch = Array.isArray(h.types) && h.types.some(tp => tp.toLowerCase().includes(q));
        const dropsMatch = Array.isArray(h.drops) && h.drops.some(d => (d.n || '').toLowerCase().includes(q));
        if (!nomeMatch && !regMatch && !typesMatch && !dropsMatch) return false;
      }

      return true;
    });

    if (lblHuntsCounter) {
      lblHuntsCounter.textContent = `${list.length} criatura${list.length === 1 ? '' : 's'} encontrada${list.length === 1 ? '' : 's'}`;
    }

    if (list.length === 0) {
      containerHuntsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px 10px; color: var(--sobre-mad-dim); font-size: 11px;">
          Nenhuma hunt encontrada com os filtros selecionados.<br>
          <span style="font-size: 9px; opacity: 0.8;">Tente selecionar outra faixa de nível ou limpar a busca.</span>
        </div>
      `;
      return;
    }

    // Ordenação e paginação leve (primeiros 90 itens para render suave)
    list.sort((a, b) => (a.lvl - b.lvl) || a.nome.localeCompare(b.nome));
    const renderList = list.slice(0, 90);

    containerHuntsGrid.innerHTML = '';
    renderList.forEach(h => {
      const card = document.createElement('div');
      card.className = 'hunt-card';

      const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${h.pid}.png`;

      // Renderiza tipos do Pokémon
      const typesHtml = (h.types || []).map(tp => {
        const bg = POKEMON_TYPE_COLORS[tp] || '#4b5563';
        return `<span class="hunt-type-badge" style="background: ${bg};">${tp}</span>`;
      }).join(' ');

      // Renderiza fraquezas 4x e 2x
      const w4xChips = (h.w4x || []).map(tp => `<span class="hunt-weak-chip-4x" title="Fraqueza Crítica 4x">${tp} 4x</span>`).join(' ');
      const w2xChips = (h.w2x || []).map(tp => `<span class="hunt-weak-chip-2x" title="Fraqueza 2x">${tp} 2x</span>`).join(' ');

      // Renderiza drops
      const dropsRows = (h.drops || []).map(d => {
        let rotomIt = null;
        if (typeof window.getRotomItem === 'function') {
          rotomIt = window.getRotomItem(d.n);
        }
        return `
          <div class="hunt-drop-row">
            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; ${rotomIt ? 'cursor: pointer; text-decoration: underline;' : ''}" class="hunt-drop-name" data-item="${d.n}">
              ${d.n}
            </span>
            <span class="hunt-drop-chance">${Number(d.c).toFixed(1)}%</span>
          </div>
        `;
      }).join('');

      card.innerHTML = `
        <div class="hunt-card-top">
          <img src="${spriteUrl}" class="hunt-poke-sprite" alt="${h.nome}">
          <div class="hunt-poke-info">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
              <span class="hunt-poke-name">${h.nome}</span>
              <span style="font-size: 9px; color: var(--ouro); font-weight: 800; background: var(--vao); padding: 1px 5px; border-radius: 0px;">Nv. ${h.lvl}</span>
            </div>
            <div class="hunt-poke-meta">
              <span>${h.reg || 'Kanto'}</span>
              ${h.out ? '<span style="color: #c084fc; font-weight: 700;">[Outland]</span>' : ''}
              <div style="display: flex; gap: 2px; margin-left: auto;">${typesHtml}</div>
            </div>
          </div>
        </div>

        <!-- Fraquezas Elementais -->
        <div class="hunt-weak-row">
          <span style="font-size: 8.5px; color: var(--sobre-mad-dim); font-weight: 700;">Fraquezas:</span>
          ${w4xChips}
          ${w2xChips}
          ${(!w4xChips && !w2xChips) ? '<span style="font-size: 8.5px; color: var(--vao-dim);">Nenhuma destacada</span>' : ''}
        </div>

        <!-- Barra de Rendimento Base -->
        <div class="hunt-yield-bar">
          <span style="color: #9fe4ff;">XP: <b>+${Number(h.xp || 0).toLocaleString()}</b></span>
          <span style="color: var(--coins);">GP: <b>+${Number(h.gp || 0).toLocaleString()}</b></span>
        </div>

        <!-- Lista de Drops e Loots -->
        <div class="hunt-drops-container">
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 8px; color: var(--vao-dim); text-transform: uppercase; font-weight: 800; padding-bottom: 2px; border-bottom: 1px solid rgba(255,255,255,0.06);">
            <span>Item / Loot</span>
            <span>Chance</span>
          </div>
          ${dropsRows || '<span style="font-size: 8.5px; color: var(--sobre-mad-dim); text-align: center;">Sem drops catalogados</span>'}
        </div>
      `;

      // Event listener para abrir regra no Sniper ao clicar em item conhecido
      card.querySelectorAll('.hunt-drop-name').forEach(el => {
        const dropName = el.getAttribute('data-item');
        if (dropName && typeof window.getRotomItem === 'function') {
          const it = window.getRotomItem(dropName);
          if (it) {
            el.addEventListener('click', (e) => {
              e.stopPropagation();
              configureSniperRuleFromItem(it, 0, 0);
              switchMainView('sniper');
            });
          }
        }
      });

      containerHuntsGrid.appendChild(card);
    });

    if (list.length > 90) {
      const moreTip = document.createElement('div');
      moreTip.style.gridColumn = '1 / -1';
      moreTip.style.textAlign = 'center';
      moreTip.style.padding = '10px';
      moreTip.style.fontSize = '10px';
      moreTip.style.color = 'var(--ouro)';
      moreTip.textContent = `Mostrando as 90 primeiras criaturas de ${list.length}. Use o campo de busca ou os filtros de nível/tipo para refinar.`;
      containerHuntsGrid.appendChild(moreTip);
    }
  }

  function renderBosses() {
    if (!containerBossesGrid) return;
    const db = window.ROTOM_BOSSES_DB || [];

    let list = db.filter(b => {
      // Filtro de foco
      if (currentBossFocus !== 'all') {
        const drops = b.drops || [];
        const isAoe = drops.some(d => (d.n || '').toLowerCase().includes('aoe'));
        if (currentBossFocus === 'aoe' && !isAoe) return false;
        if (currentBossFocus === 'tm' && isAoe) return false;
      }

      // Busca por texto
      if (currentHuntSearchQuery) {
        const q = currentHuntSearchQuery;
        const nomeMatch = (b.n || '').toLowerCase().includes(q);
        const typesMatch = [b.t1, b.t2].filter(Boolean).some(tp => tp.toLowerCase().includes(q));
        const dropsMatch = Array.isArray(b.drops) && b.drops.some(d => {
          const name = typeof d === 'string' ? d : (d.n || '');
          return name.toLowerCase().includes(q);
        });
        if (!nomeMatch && !typesMatch && !dropsMatch) return false;
      }
      return true;
    });

    if (lblBossesCounter) {
      lblBossesCounter.textContent = `${list.length} chefe${list.length === 1 ? '' : 's'} oficial${list.length === 1 ? '' : 'is'} catalogado${list.length === 1 ? '' : 's'}`;
    }

    if (list.length === 0) {
      containerBossesGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px 10px; color: var(--sobre-mad-dim); font-size: 11px;">
          Nenhum chefe oficial encontrado com os filtros selecionados.<br>
          <span style="font-size: 9px; opacity: 0.8;">Tente mudar o filtro de foco (AoE / TM) ou limpar a busca.</span>
        </div>
      `;
      return;
    }

    containerBossesGrid.innerHTML = '';
    list.forEach(b => {
      const card = document.createElement('div');
      card.className = 'hunt-card';

      const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${b.pid}.png`;

      const t1Badge = b.t1 ? `<span class="hunt-type-badge" style="background: ${POKEMON_TYPE_COLORS[b.t1] || '#4b5563'};">${b.t1}</span>` : '';
      const t2Badge = b.t2 ? `<span class="hunt-type-badge" style="background: ${POKEMON_TYPE_COLORS[b.t2] || '#4b5563'};">${b.t2}</span>` : '';

      const dropsRows = (b.drops || []).map(d => {
        const dName = typeof d === 'string' ? d : d.n;
        const dChance = typeof d === 'object' && d.c !== undefined ? Number(d.c).toFixed(1) + '%' : 'Raro';
        const isAoe = dName.toLowerCase().includes('aoe');
        const badgeColor = isAoe ? '#38bdf8' : '#a78bfa';

        let rotomIt = null;
        if (typeof window.getRotomItem === 'function') {
          rotomIt = window.getRotomItem(dName);
        }

        return `
          <div class="hunt-drop-row" style="padding: 2px 0;">
            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 700; ${rotomIt ? 'cursor: pointer; text-decoration: underline;' : ''}" class="hunt-drop-name" data-item="${dName}">
              ${isAoe ? '⚡' : '💿'} ${dName}
            </span>
            <span class="hunt-drop-chance" style="color: ${badgeColor}; font-weight: 800; background: rgba(255,255,255,0.06); padding: 1px 6px; border-radius: 0px;">${dChance}</span>
          </div>
        `;
      }).join('');

      card.innerHTML = `
        <div class="hunt-card-top">
          <img src="${spriteUrl}" class="hunt-poke-sprite" alt="${b.n}">
          <div class="hunt-poke-info">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
              <span class="hunt-poke-name" style="color: var(--ouro);">${b.n}</span>
              <span style="font-size: 9px; color: #fff; font-weight: 800; background: var(--rx); padding: 1px 5px; border-radius: 0px;">Nv. ${Number(b.lvl || 0).toLocaleString()}</span>
            </div>
            <div class="hunt-poke-meta">
              <span>Time Req: <b>Nv. ${Number(b.teamLevel || b.lvl).toLocaleString()}</b></span>
              <div style="display: flex; gap: 2px; margin-left: auto;">${t1Badge} ${t2Badge}</div>
            </div>
          </div>
        </div>

        <!-- Custo de Entrada -->
        <div style="font-size: 8.5px; color: var(--sobre-mad-dim); background: rgba(0,0,0,0.25); padding: 3px 6px; border-radius: 0px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.06);">
          <span>🎟️ Custo por Entrada:</span>
          <span style="color: var(--ouro); font-weight: 700;">${b.ent || '1× Bronze Boss Token'}</span>
        </div>

        <!-- Tabela de Drops Oficiais de Chefes -->
        <div class="hunt-drops-container">
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 8px; color: var(--vao-dim); text-transform: uppercase; font-weight: 800; padding-bottom: 2px; border-bottom: 1px solid rgba(255,255,255,0.06);">
            <span>Drop Oficial</span>
            <span>Chance</span>
          </div>
          ${dropsRows || '<span style="font-size: 8.5px; color: var(--sobre-mad-dim); text-align: center;">Tabela indisponível</span>'}
        </div>

        <!-- Botão de Ação: Simular Tokens deste Boss -->
        <button type="button" class="btn btn-ouro btn-simulate-boss" data-boss="${b.k}" style="width: 100%; height: 22px; font-size: 9px; font-weight: 800; border-radius: 0px; margin-top: 4px;">
          🎲 Simular Tokens deste Chefe
        </button>
      `;

      // Event listener para abrir regra no Sniper ao clicar em item conhecido
      card.querySelectorAll('.hunt-drop-name').forEach(el => {
        const dropName = el.getAttribute('data-item');
        if (dropName && typeof window.getRotomItem === 'function') {
          const it = window.getRotomItem(dropName);
          if (it) {
            el.addEventListener('click', (e) => {
              e.stopPropagation();
              configureSniperRuleFromItem(it, 0, 0);
              switchMainView('sniper');
            });
          }
        }
      });

      // Event listener para simular este chefe diretamente na calculadora
      const btnSimulate = card.querySelector('.btn-simulate-boss');
      if (btnSimulate) {
        btnSimulate.addEventListener('click', () => {
          if (bossCalcSelect) {
            bossCalcSelect.value = b.k;
            updateBossRewardOptions();
            const banner = document.getElementById('boss-calc-info-banner');
            if (banner) banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        });
      }

      containerBossesGrid.appendChild(card);
    });
  }

  // =========================================================================
  // 12. ALTAR PRO — OFERENDA EM LOTE TURBO
  // =========================================================================
  let ofrNotaMax = 5.0;
  let ofrSelectedType = 'ALL';
  let ofrMaxBatches = 0;
  let ofrActiveCandidates = [];
  let ofrIsRunning = false;
  let ofrPacingMs = 800;

  const btnRefreshOferendaDepot = document.getElementById('btn-refresh-oferenda-depot');
  const ofrNotaFilters = document.querySelectorAll('.ofr-nota-filter');
  const inputOferendaNotaManual = document.getElementById('input-oferenda-nota-manual');
  const selectOferendaTipo = document.getElementById('select-oferenda-tipo');
  const selectOferendaMaxBatches = document.getElementById('select-oferenda-max-batches');
  const selectOferendaPacing = document.getElementById('select-oferenda-pacing');
  const btnRunOferendaBatch = document.getElementById('btn-run-oferenda-batch');

  const lblOfrCandidatos = document.getElementById('lbl-ofr-candidatos');
  const lblOfrPedras = document.getElementById('lbl-ofr-pedras');
  const lblOfrProtegidos = document.getElementById('lbl-ofr-protegidos');
  const lblOfrSobra = document.getElementById('lbl-ofr-sobra');
  const containerOferendaPreviewGrid = document.getElementById('container-oferenda-preview-grid');

  const ofrProgressBarContainer = document.getElementById('ofr-progress-bar-container');
  const ofrProgressStatusTxt = document.getElementById('ofr-progress-status-txt');
  const ofrProgressCountTxt = document.getElementById('ofr-progress-count-txt');
  const ofrProgressFill = document.getElementById('ofr-progress-fill');

  const ofrResultSummaryBox = document.getElementById('ofr-result-summary-box');
  const ofrResultTotalsTxt = document.getElementById('ofr-result-totals-txt');
  const ofrResultStonesChips = document.getElementById('ofr-result-stones-chips');

  function requestOferendaDepot() {
    sendToActiveTab({
      action: 'FETCH_OFERENDA_CANDIDATES',
      maxNota: ofrNotaMax,
      notaMax: ofrNotaMax,
      elemento: ofrSelectedType,
      tipo: ofrSelectedType
    });
  }

  // Leitura inicial de candidatos do storage se já existirem
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['rotom_oferenda_candidates'], (res) => {
      if (res && res.rotom_oferenda_candidates) {
        const d = res.rotom_oferenda_candidates;
        updateOferendaUI(d.candidates, d.protectedCount, d.totalDepot);
      }
    });
  }

  function updateOferendaUI(candidates, protectedCount, totalDepot) {
    ofrActiveCandidates = candidates || [];
    let total = ofrActiveCandidates.length;
    if (ofrMaxBatches > 0 && total > ofrMaxBatches * 5) {
      total = ofrMaxBatches * 5;
    }
    const safeCount = total - (total % 5);
    const batchesCount = Math.floor(safeCount / 5);
    const displayed = ofrActiveCandidates.slice(0, safeCount);
    const leftover = Math.max(0, (totalDepot || 0) - safeCount);

    if (lblOfrCandidatos) lblOfrCandidatos.textContent = safeCount;
    if (lblOfrPedras) lblOfrPedras.textContent = `${batchesCount} Pedras`;
    if (lblOfrProtegidos) lblOfrProtegidos.textContent = protectedCount || 0;
    if (lblOfrSobra) lblOfrSobra.textContent = leftover;

    if (btnRunOferendaBatch) {
      btnRunOferendaBatch.disabled = (safeCount < 5 || ofrIsRunning);
      btnRunOferendaBatch.textContent = ofrIsRunning
        ? '⏳ Sacrificando em Lote...'
        : `🔮 Executar Oferenda em Lote (${batchesCount} Pedras Garantidas)`;
    }

    if (containerOferendaPreviewGrid) {
      containerOferendaPreviewGrid.innerHTML = '';
      if (displayed.length === 0) {
        containerOferendaPreviewGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 40px 10px; color: var(--sobre-mad-dim); font-size: 11px;">
            Nenhum Pokémon elegível encontrado para oferenda com os filtros atuais.<br>
            <span style="font-size: 9px; color: var(--vao-dim);">Tente aumentar a nota de corte ou selecionar Todos os Tipos.</span>
          </div>
        `;
        return;
      }

      displayed.forEach((pk, idx) => {
        const card = document.createElement('div');
        card.className = 'community-item-card';
        card.style.padding = '6px 8px';
        card.style.gap = '4px';

        const pDexId = Number(pk.speciesId || pk.pokemonId || pk.pId || 1);
        const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pDexId}.png`;
        const notaFmt = Number(pk.nota || 0).toFixed(1);

        card.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
            <div style="display: flex; align-items: center; gap: 5px; min-width: 0; overflow: hidden;">
              <img src="${spriteUrl}" style="width: 24px; height: 24px; image-rendering: pixelated; object-fit: contain; flex-shrink: 0;" onerror="this.src='https://pokeidle.io/assets/site/assets/ui/ball-poke.png';">
              <span style="font-size: 10px; font-weight: 800; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${pk.nome}">
                ${pk.nome}
              </span>
            </div>
            <span style="font-size: 8px; color: var(--sobre-mad-dim); font-weight: 700; white-space: nowrap;">#Lote ${Math.floor(idx / 5) + 1}</span>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 9px; background: rgba(0,0,0,0.3); padding: 2px 5px; border-radius: 0px;">
            <span style="color: var(--vao-dim);">Nv. ${pk.level || 1}</span>
            <span style="color: var(--ouro); font-weight: 800;">Nota ${notaFmt}</span>
          </div>
        `;
        containerOferendaPreviewGrid.appendChild(card);
      });
    }
  }

  // Filtro de Nota Manual com Debounce
  let ofrNotaDebounce = null;
  if (inputOferendaNotaManual) {
    inputOferendaNotaManual.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && val >= 0 && val <= 10) {
        ofrNotaMax = val;
        ofrNotaFilters.forEach(b => {
          const bVal = parseFloat(b.getAttribute('data-nota'));
          const isMatch = Math.abs(bVal - val) < 0.05;
          b.classList.toggle('on', isMatch);
          b.classList.toggle('apagado', !isMatch);
        });
        clearTimeout(ofrNotaDebounce);
        ofrNotaDebounce = setTimeout(() => requestOferendaDepot(), 250);
      }
    });
  }

  // Filtros de Nota Presets
  ofrNotaFilters.forEach(btn => {
    btn.addEventListener('click', () => {
      ofrNotaFilters.forEach(b => { b.classList.remove('on'); b.classList.add('apagado'); });
      btn.classList.remove('apagado');
      btn.classList.add('on');
      ofrNotaMax = Number(btn.getAttribute('data-nota')) || 5.0;
      if (inputOferendaNotaManual) inputOferendaNotaManual.value = ofrNotaMax.toFixed(1);
      requestOferendaDepot();
    });
  });

  if (selectOferendaTipo) {
    selectOferendaTipo.addEventListener('change', (e) => {
      ofrSelectedType = e.target.value;
      requestOferendaDepot();
    });
  }

  if (selectOferendaMaxBatches) {
    selectOferendaMaxBatches.addEventListener('change', (e) => {
      ofrMaxBatches = Number(e.target.value) || 0;
      requestOferendaDepot();
    });
  }

  if (selectOferendaPacing) {
    selectOferendaPacing.addEventListener('change', (e) => {
      ofrPacingMs = Number(e.target.value) || 800;
    });
  }

  if (btnRefreshOferendaDepot) {
    btnRefreshOferendaDepot.addEventListener('click', () => {
      requestOferendaDepot();
    });
  }

  if (btnRunOferendaBatch) {
    btnRunOferendaBatch.addEventListener('click', () => {
      let total = ofrActiveCandidates.length;
      if (ofrMaxBatches > 0 && total > ofrMaxBatches * 5) {
        total = ofrMaxBatches * 5;
      }
      const safeCount = total - (total % 5);
      if (safeCount < 5 || ofrIsRunning) return;

      const ids = ofrActiveCandidates.slice(0, safeCount).map(p => Number(p.id));
      ofrIsRunning = true;
      if (btnRunOferendaBatch) {
        btnRunOferendaBatch.disabled = true;
        btnRunOferendaBatch.textContent = '⏳ Sacrificando em Lote...';
      }

      if (ofrProgressBarContainer) ofrProgressBarContainer.style.display = 'flex';
      if (ofrResultSummaryBox) ofrResultSummaryBox.style.display = 'none';

      sendToActiveTab({
        action: 'EXECUTE_OFERENDA_BATCH',
        pokemonIds: ids,
        pacingMs: ofrPacingMs || 800
      });
    });
  }

  // Listener para atualizações de candidatos e progresso vindas da aba do jogo
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.rotom_oferenda_candidates && changes.rotom_oferenda_candidates.newValue) {
        const d = changes.rotom_oferenda_candidates.newValue;
        updateOferendaUI(d.candidates, d.protectedCount, d.totalDepot);
      }
      if (changes.rotom_oferenda_progress && changes.rotom_oferenda_progress.newValue) {
        const p = changes.rotom_oferenda_progress.newValue;
        if (ofrProgressBarContainer) ofrProgressBarContainer.style.display = 'flex';
        if (ofrProgressCountTxt) ofrProgressCountTxt.textContent = `Lote ${p.batch} / ${p.totalBatches} (${p.sacrificed} Pokémons)`;
        if (ofrProgressFill) {
          const pct = Math.min(100, Math.round((p.batch / (p.totalBatches || 1)) * 100));
          ofrProgressFill.style.width = pct + '%';
        }
      }
      if (changes.rotom_oferenda_completed && changes.rotom_oferenda_completed.newValue) {
        const c = changes.rotom_oferenda_completed.newValue;
        ofrIsRunning = false;
        if (ofrProgressBarContainer) ofrProgressBarContainer.style.display = 'none';
        if (ofrResultSummaryBox) ofrResultSummaryBox.style.display = 'flex';
        if (ofrResultTotalsTxt) {
          ofrResultTotalsTxt.textContent = `${c.totalSacrificed} Pokémons sacrificados em ${c.batchesExecuted} giros`;
        }
        if (ofrResultStonesChips) {
          ofrResultStonesChips.innerHTML = '';
          const entries = Object.entries(c.stonesReceived || {});
          if (entries.length === 0) {
            ofrResultStonesChips.innerHTML = '<span style="font-size: 10px; color: var(--ouro);">Pedras adicionadas à bolsa com sucesso!</span>';
          } else {
            entries.forEach(([stone, qtd]) => {
              const chip = document.createElement('span');
              chip.className = 'slot-pill';
              chip.style.padding = '3px 8px';
              chip.style.fontSize = '10px';
              chip.style.fontWeight = '800';
              chip.textContent = `${stone}: +${qtd}`;
              ofrResultStonesChips.appendChild(chip);
            });
          }
        }
        requestOferendaDepot();
      }
    });
  }

  // Verifica se foi aberto com intenção de ir para uma aba específica (ex: URL ?tab=oferendas ou storage)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const targetTab = urlParams.get('tab');
    if (targetTab && ['sniper', 'market', 'stats', 'hunts', 'oferendas'].includes(targetTab)) {
      switchMainView(targetTab);
    } else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['rotom_pending_cockpit_tab'], (res) => {
        if (res && res.rotom_pending_cockpit_tab) {
          const tab = res.rotom_pending_cockpit_tab;
          chrome.storage.local.remove('rotom_pending_cockpit_tab');
          if (['sniper', 'market', 'stats', 'hunts', 'oferendas'].includes(tab)) {
            switchMainView(tab);
          }
        }
      });
    }
  } catch (e) {}
});
