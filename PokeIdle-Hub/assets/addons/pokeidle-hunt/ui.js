// A tela: o botão /hunt ao lado do nome do pokémon em campo e o painel "Onde caçar?".
//
// O card "Em campo" do jogo (`#ativo-card`) é redesenhado inteiro a cada atualização do
// estado. Por isso a barra /hunt NÃO mora dentro dele: fica no painel em volta (`#p-ativo`),
// que não é redesenhado, logo antes do card — no fluxo, acima do pokémon, na largura da caixa.
//
// Ao abrir o jogo, a extensão confere onde está o pokémon ativo. Se o card não estiver onde
// esperamos (layout novo do jogo), ela pede um clique nele e lembra a escolha.
(function (root) {
  'use strict';
  const PIH = (root.__pokeidleHunt ??= {});
  if (!PIH.on || !PIH.engine) return;

  const CHAVE_PREFS = 'pokeidle-hunt:prefs:v1';
  const CHAVE_ALVO = 'pokeidle-hunt:alvo:v1';
  const POR_PAGINA = 25;

  const lerJson = (k, padrao) => { try { return JSON.parse(localStorage.getItem(k)) ?? padrao; } catch { return padrao; } };
  const gravarJson = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } };

  let prefs = { ordem: 'xp', soLiberadas: true, comPocao: true, bola: 'poke', ...lerJson(CHAVE_PREFS, {}) };
  if (prefs.ordem === 'capturas') prefs.ordem = 'catch';
  let welcome = null;
  let eu = null;
  let huntAtivaSlug = null;
  let sessaoAtual = null;
  let historicoAtual = [];
  PIH.on?.('campo.init', (m) => {
    huntAtivaSlug = (m?.slug && !m.centro && !m.pvp && m.casa == null) ? m.slug : null;
  });
  const obterHuntAtiva = () => huntAtivaSlug || eu?.huntSlug || eu?.hunt || PIH.geo?.huntAtiva?.() || null;

  const CHAVE_AMOSTRAS = 'pokeidle-hunt:telemetria:amostras:v1';
  const CHAVE_HIST_HUNTS = 'pokeidle-hunt:telemetria:hunts:v1';
  const CHAVE_MARCO_SESSAO = 'pokeidle-hunt:telemetria:marco:v1';

  const NOMES_BOLAS = {
    '1': 'Poké Ball', '2': 'Great Ball', '3': 'Super Ball', '4': 'Ultra Ball', '5': 'Beast Ball',
    poke: 'Poké Ball', great: 'Great Ball', super: 'Super Ball', ultra: 'Ultra Ball', beast: 'Beast Ball',
  };
  const PRECOS_BOLAS = {
    '1': 5, '2': 20, '3': 50, '4': 130, '5': 0,
    poke: 5, great: 20, super: 50, ultra: 130, beast: 0,
  };
  const NOMES_POCOES = {
    '201': 'Poção', '202': 'Super Poção', '203': 'Hyper Poção', '204': 'Max Poção',
    '205': 'Revive', '206': 'Max Revive',
    pocao: 'Poção', superPocao: 'Super Poção', hyperPocao: 'Hyper Poção', maxPocao: 'Max Poção',
    revive: 'Revive', maxRevive: 'Max Revive',
  };
  const PRECOS_POCOES = {
    '201': 20, '202': 60, '203': 150, '204': 300,
    '205': 250, '206': 500,
    pocao: 20, superPocao: 60, hyperPocao: 150, maxPocao: 300,
    revive: 250, maxRevive: 500,
  };
  const NOMES_DROPS = {
    bossTokens: 'Boss Tokens', fragChave: 'Frag. de Chave', fragShiny: 'Frag. Shiny Stone',
    fragBicicleta: 'Frag. de Bicicleta', fragMega: 'Frag. Mega Stone',
    fragMegaShiny: 'Frag. Mega Shiny', tmPeca: 'Peças de TM', tmPecaAoe: 'Peças TM AoE',
    ticketMistico: 'Tickets Místicos', fragOvoShiny: 'Frag. Ovo Shiny',
  };

  function detalharConsumo(s, precoItem, horas, nomeItemPorId, precoItemPorId) {
    const bolasItens = [];
    let bolasCustoTotal = 0;
    let bolastotalCount = 0;
    if (s.bolas && typeof s.bolas === 'object') {
      for (const [id, countRaw] of Object.entries(s.bolas)) {
        const count = Number(countRaw) || 0;
        if (count <= 0) continue;
        const sId = String(id);
        const nome = NOMES_BOLAS[sId] || NOMES_BOLAS[id] || nomeItemPorId?.get(sId) || `Bola #${id}`;
        const preco = PRECOS_BOLAS[sId] ?? PRECOS_BOLAS[id] ?? precoItemPorId?.get(sId) ?? (precoItem?.get(nome) || 0);
        const custo = count * preco;
        bolasCustoTotal += custo;
        bolastotalCount += count;
        bolasItens.push({
          id,
          nome,
          count,
          countH: Math.round(count / horas),
          preco,
          custo,
          custoH: Math.round(custo / horas),
        });
      }
    }

    const pocoesItens = [];
    let pocoesCustoTotal = 0;
    let pocoestotalCount = 0;
    for (const grupo of ['pocoes', 'revives']) {
      if (s[grupo] && typeof s[grupo] === 'object') {
        for (const [id, countRaw] of Object.entries(s[grupo])) {
          const count = Number(countRaw) || 0;
          if (count <= 0) continue;
          const sId = String(id);
          const nome = NOMES_POCOES[sId] || NOMES_POCOES[id] || nomeItemPorId?.get(sId) || (grupo === 'revives' ? 'Revive' : 'Poção');
          const preco = PRECOS_POCOES[sId] ?? PRECOS_POCOES[id] ?? precoItemPorId?.get(sId) ?? (precoItem?.get(nome) || 50);
          const custo = count * preco;
          pocoesCustoTotal += custo;
          pocoestotalCount += count;
          pocoesItens.push({
            id,
            nome,
            count,
            countH: Math.round(count / horas),
            preco,
            custo,
            custoH: Math.round(custo / horas),
          });
        }
      }
    }

    const drops = [];
    for (const [k, nome] of Object.entries(NOMES_DROPS)) {
      const count = Number(s[k]) || 0;
      if (count > 0) drops.push({ key: k, nome, count, countH: Math.round((count / horas) * 10) / 10 });
    }

    return {
      bolas: {
        totalCount: bolastotalCount,
        totalCountH: Math.round(bolastotalCount / horas),
        custoTotal: bolasCustoTotal,
        custoH: Math.round(bolasCustoTotal / horas),
        itens: bolasItens,
      },
      pocoes: {
        totalCount: pocoestotalCount,
        totalCountH: Math.round(pocoestotalCount / horas),
        custoTotal: pocoesCustoTotal,
        custoH: Math.round(pocoesCustoTotal / horas),
        itens: pocoesItens,
      },
      drops,
    };
  }

  function registrarAmostraTelemetria(s) {
    if (!s || !s.ms) return [];
    let amostras = lerJson(CHAVE_AMOSTRAS, []);
    const agora = Date.now();
    const ultima = amostras[amostras.length - 1];
    if (!ultima || agora - ultima.t >= 20000) {
      amostras.push({
        t: agora,
        ms: s.ms,
        abates: s.abates,
        gold: s.gold,
        xpPokemon: s.xpPokemon,
        xpTreinador: s.xpTreinador,
        capturas: s.capturas,
        bolas: s.bolas?.totalCount || 0,
        pocoes: s.pocoes?.totalCount || 0,
        custoConsumiveis: (s.bolas?.custoTotal || 0) + (s.pocoes?.custoTotal || 0),
      });
      amostras = amostras.filter((a) => agora - a.t <= 70 * 60000);
      gravarJson(CHAVE_AMOSTRAS, amostras);
    }
    return amostras;
  }

  function calcularTaxaJanela(amostras, atual, minutosJanela) {
    if (!amostras || !amostras.length || !atual) return null;
    const agora = Date.now();
    const limiteMs = minutosJanela * 60000;
    let base = amostras[0];
    for (let i = amostras.length - 1; i >= 0; i--) {
      if (agora - amostras[i].t >= limiteMs) {
        base = amostras[i];
        break;
      }
    }
    const deltaMs = agora - base.t;
    if (deltaMs < 25000) {
      return {
        abatesH: atual.abatesH,
        xpPokemonH: atual.xpPokemonH,
        xpTreinadorH: atual.xpTreinadorH,
        goldH: atual.goldH,
        capturasH: atual.capturasH,
        bolasH: atual.bolas?.totalCountH || 0,
        pocoesH: atual.pocoes?.totalCountH || 0,
        custoConsumiveisH: (atual.bolas?.custoH || 0) + (atual.pocoes?.custoH || 0),
        lucroLiquidoH: atual.lucroLiquidoH,
      };
    }
    const horas = deltaMs / 3600000;
    const goldH = Math.max(0, Math.round((atual.gold - base.gold) / horas));
    const deltaBolas = Math.max(0, (atual.bolas?.totalCount || 0) - (base.bolas || 0));
    const deltaPocoes = Math.max(0, (atual.pocoes?.totalCount || 0) - (base.pocoes || 0));
    const deltaCusto = Math.max(0, ((atual.bolas?.custoTotal || 0) + (atual.pocoes?.custoTotal || 0)) - (base.custoConsumiveis || 0));
    const custoConsumiveisH = Math.round(deltaCusto / horas);

    return {
      abatesH: Math.max(0, Math.round((atual.abates - base.abates) / horas)),
      xpPokemonH: Math.max(0, Math.round((atual.xpPokemon - base.xpPokemon) / horas)),
      xpTreinadorH: Math.max(0, Math.round((atual.xpTreinador - base.xpTreinador) / horas)),
      goldH,
      capturasH: Math.max(0, Math.round(((atual.capturas - base.capturas) / horas) * 10) / 10),
      bolasH: Math.max(0, Math.round(deltaBolas / horas)),
      pocoesH: Math.max(0, Math.round(deltaPocoes / horas)),
      custoConsumiveisH,
      lucroLiquidoH: goldH - custoConsumiveisH,
    };
  }

  let huntAnteriorTracker = null;
  function atualizarHistoricoHunts(s, slugAtual, nomeHuntAtual) {
    if (!s || !s.ms) return lerJson(CHAVE_HIST_HUNTS, []);
    let hist = lerJson(CHAVE_HIST_HUNTS, []);
    const agora = Date.now();
    const bolasAtual = s.bolas?.totalCount || 0;
    const pocoesAtual = s.pocoes?.totalCount || 0;
    const custoAtual = (s.bolas?.custoTotal || 0) + (s.pocoes?.custoTotal || 0);

    if (!huntAnteriorTracker) {
      if (slugAtual) {
        huntAnteriorTracker = {
          slug: slugAtual,
          nome: nomeHuntAtual || slugAtual,
          inicio: agora,
          abates: s.abates,
          gold: s.gold,
          xpPk: s.xpPokemon,
          xpTr: s.xpTreinador,
          capturas: s.capturas,
          bolas: bolasAtual,
          pocoes: pocoesAtual,
          custoConsumiveis: custoAtual,
        };
      }
    } else if (huntAnteriorTracker.slug !== slugAtual) {
      const ms = Math.max(10000, agora - huntAnteriorTracker.inicio);
      const abates = Math.max(0, s.abates - huntAnteriorTracker.abates);
      if (abates > 0 || ms >= 60000) {
        const horas = ms / 3600000;
        const gold = Math.max(0, s.gold - huntAnteriorTracker.gold);
        const goldH = Math.round(gold / horas);
        const bolas = Math.max(0, bolasAtual - (huntAnteriorTracker.bolas || 0));
        const pocoes = Math.max(0, pocoesAtual - (huntAnteriorTracker.pocoes || 0));
        const custoConsumiveis = Math.max(0, custoAtual - (huntAnteriorTracker.custoConsumiveis || 0));
        const custoH = Math.round(custoConsumiveis / horas);

        hist.unshift({
          slug: huntAnteriorTracker.slug,
          nome: huntAnteriorTracker.nome,
          inicio: huntAnteriorTracker.inicio,
          fim: agora,
          ms,
          minutos: Math.max(1, Math.round(ms / 60000)),
          abates,
          abatesH: Math.round(abates / horas),
          xpPk: Math.max(0, s.xpPokemon - huntAnteriorTracker.xpPk),
          xpTr: Math.max(0, s.xpTreinador - huntAnteriorTracker.xpTr),
          gold,
          goldH,
          capturas: Math.max(0, s.capturas - huntAnteriorTracker.capturas),
          bolas,
          bolasH: Math.round(bolas / horas),
          pocoes,
          custoConsumiveis,
          custoH,
          lucroLiquidoH: goldH - custoH,
        });
        hist = hist.slice(0, 15);
        gravarJson(CHAVE_HIST_HUNTS, hist);
      }
      huntAnteriorTracker = slugAtual ? {
        slug: slugAtual,
        nome: nomeHuntAtual || slugAtual,
        inicio: agora,
        abates: s.abates,
        gold: s.gold,
        xpPk: s.xpPokemon,
        xpTr: s.xpTreinador,
        capturas: s.capturas,
        bolas: bolasAtual,
        pocoes: pocoesAtual,
        custoConsumiveis: custoAtual,
      } : null;
    }
    return hist;
  }

  function obterHistoricoHunts(s, slugAtual, nomeHuntAtual) {
    const hist = atualizarHistoricoHunts(s, slugAtual, nomeHuntAtual);
    const lista = [...hist];
    if (huntAnteriorTracker && slugAtual) {
      const ms = Math.max(10000, Date.now() - huntAnteriorTracker.inicio);
      const horas = ms / 3600000;
      const abates = Math.max(0, s.abates - huntAnteriorTracker.abates);
      const gold = Math.max(0, s.gold - huntAnteriorTracker.gold);
      const goldH = Math.round(gold / horas);
      const bolasAtual = s.bolas?.totalCount || 0;
      const pocoesAtual = s.pocoes?.totalCount || 0;
      const custoAtual = (s.bolas?.custoTotal || 0) + (s.pocoes?.custoTotal || 0);
      const bolas = Math.max(0, bolasAtual - (huntAnteriorTracker.bolas || 0));
      const pocoes = Math.max(0, pocoesAtual - (huntAnteriorTracker.pocoes || 0));
      const custoConsumiveis = Math.max(0, custoAtual - (huntAnteriorTracker.custoConsumiveis || 0));
      const custoH = Math.round(custoConsumiveis / horas);

      lista.unshift({
        slug: huntAnteriorTracker.slug,
        nome: nomeHuntAtual || huntAnteriorTracker.nome,
        aoVivo: true,
        inicio: huntAnteriorTracker.inicio,
        fim: null,
        ms,
        minutos: Math.max(1, Math.round(ms / 60000)),
        abates,
        abatesH: Math.round(abates / horas),
        xpPk: Math.max(0, s.xpPokemon - huntAnteriorTracker.xpPk),
        xpTr: Math.max(0, s.xpTreinador - huntAnteriorTracker.xpTr),
        gold,
        goldH,
        capturas: Math.max(0, s.capturas - huntAnteriorTracker.capturas),
        bolas,
        bolasH: Math.round(bolas / horas),
        pocoes,
        custoConsumiveis,
        custoH,
        lucroLiquidoH: goldH - custoH,
      });
    }
    return lista;
  }

  function lerSessaoJogo(usuario, precoItem, nomeItemPorId, precoItemPorId) {
    const nick = String(usuario?.nick || document.querySelector('#tr-nick')?.textContent || '').trim().toLowerCase();
    if (!nick || nick === '—') return null;
    const s = lerJson('sessao-hunt:' + nick, null);
    if (!s || typeof s !== 'object' || !s.ms) return null;
    const horas = Math.max(s.ms, 60000) / 3600000;
    const abates = Number(s.abates) || 0;
    const capturas = Number(s.capturas) || 0;
    const gold = Number(s.gold) || 0;
    const xpTreinador = Number(s.xpTreinador) || 0;
    const xpPokemon = Number(s.xpPokemon) || 0;
    const shinies = Number(s.shinies) || 0;
    const shiniesVistos = Number(s.shiniesVistos) || 0;

    const consumo = detalharConsumo(s, precoItem, horas, nomeItemPorId, precoItemPorId);
    const goldH = Math.round(gold / horas);
    const lucroLiquidoH = goldH - consumo.bolas.custoH - consumo.pocoes.custoH;

    const baseObj = {
      ms: s.ms,
      minutos: Math.floor(s.ms / 60000),
      horas,
      abates,
      capturas,
      gold,
      xpTreinador,
      xpPokemon,
      shinies,
      shiniesVistos,
      abatesH: Math.round(abates / horas),
      capturasH: Math.round((capturas / horas) * 10) / 10,
      goldH,
      xpTreinadorH: Math.round(xpTreinador / horas),
      xpPokemonH: Math.round(xpPokemon / horas),
      lucroLiquidoH,
      bolas: consumo.bolas,
      pocoes: consumo.pocoes,
      drops: consumo.drops,
    };

    const amostras = registrarAmostraTelemetria(baseObj);
    baseObj.janela10m = calcularTaxaJanela(amostras, baseObj, 10);
    baseObj.janela1h = calcularTaxaJanela(amostras, baseObj, 60);

    return baseObj;
  }

  function xpTotal(L) {
    if (L <= 1) return 0;
    return Math.round((50 / 3) * (Math.pow(L, 3) - 6 * Math.pow(L, 2) + 17 * L - 12));
  }

  function calcularXpFaltando(xpAtual, nivelAtual) {
    const L = Math.max(1, Number(nivelAtual) || 1);
    const xpInicio = xpTotal(L);
    const xpFim = xpTotal(L + 1);
    const xpNecessario = Math.max(1, xpFim - xpInicio);
    const atual = Number(xpAtual) || 0;
    if (atual >= 0 && atual < xpNecessario) {
      return Math.max(0, xpNecessario - atual);
    }
    if (atual >= xpInicio) {
      return Math.max(0, xpFim - atual);
    }
    return xpNecessario;
  }

  function formatarEta(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return 'pronto';
    const min = Math.round(ms / 60000);
    if (min < 1) return '< 1 min';
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h < 24) return m ? `${h}h ${m}min` : `${h}h`;
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return rh ? `${d}d ${rh}h` : `${d}d`;
  }

  // ---- formatação ------------------------------------------------------------------------
  const nf = new Intl.NumberFormat('pt-BR');
  const nfc = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
  const num = (v) => nf.format(Math.round(v));
  const curto = (v) => (Math.abs(v) >= 10000 ? nfc.format(v) : num(v));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const REGIAO = { kanto: 'Kanto', johto: 'Johto', outland: 'Outland', orre: 'Orre', hoenn: 'Hoenn', sinnoh: 'Sinnoh', unova: 'Unova', kalos: 'Kalos', alola: 'Alola', galar: 'Galar', paldea: 'Paldea' };
  const regiao = (r) => REGIAO[r] ?? (r ? r[0].toUpperCase() + r.slice(1) : '');
  const segundos = (s) => (s < 1 ? '<1 s' : s < 60 ? `${s.toFixed(1).replace('.', ',')} s` : `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`);

  const pkAtivo = () => eu?.pokemons?.find((p) => p.id === eu.activeId) ?? null;

  // ---- o botão ---------------------------------------------------------------------------
  function criarBotao(extra = '') {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `pih-btn ${extra}`.trim();
    b.textContent = '/hunt';
    return b;
  }

  const botao = criarBotao('pih-barra');
  botao.title = 'Onde caçar? — as melhores hunts para o seu pokémon em campo';
  botao.setAttribute('aria-label', botao.title);
  botao.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    alternarPainel();
  });

  let alvoManual = lerJson(CHAVE_ALVO, null); // seletor escolhido pelo jogador, se o padrão falhar

  function ancora() {
    if (alvoManual) {
      const el = document.querySelector(alvoManual);
      if (el) return { modo: 'manual', el };
    }
    const card = document.getElementById('ativo-card') || document.querySelector('#p-ativo .card, #p-ativo > div:not(.pih-btn)');
    const painel = document.getElementById('p-ativo') || card?.parentElement;
    const nome = card?.querySelector('.ativo-nome') || card?.querySelector('[class*="nome"]') || card?.querySelector('b, strong, span');
    if (card && painel) return { modo: 'padrao', card, nome: nome || card };
    return null;
  }

  function posicionarBotao() {
    const a = ancora();
    if (!a) { botao.hidden = true; return; }
    botao.hidden = false;
    if (a.modo === 'padrao') {
      botao.classList.remove('pih-fixo');
      botao.classList.add('pih-barra');
      botao.style.left = botao.style.top = botao.style.width = '';
      if (a.card && a.card.previousElementSibling !== botao) {
        a.card.before(botao);
      }
    } else {
      // Reserva: flutua logo acima do ponto que o jogador apontou.
      botao.classList.remove('pih-barra');
      botao.classList.add('pih-fixo');
      if (botao.parentElement !== document.body) document.body.appendChild(botao);
      const r = a.el.getBoundingClientRect();
      botao.style.left = `${r.left}px`;
      botao.style.top = `${Math.max(4, r.top - botao.offsetHeight - 6)}px`;
    }
  }

  function vigiarCard() {
    posicionarBotao();
    const painel = document.getElementById('p-ativo') ?? document.body;
    new MutationObserver(() => {
      const card = document.getElementById('ativo-card');
      if (card && card.previousElementSibling !== botao) {
        posicionarBotao();
      }
    }).observe(painel, { childList: true, subtree: false });
    addEventListener('resize', posicionarBotao);
    addEventListener('scroll', posicionarBotao, true);
    // Rede de segurança para mudanças de layout que não mexem no card (abrir/fechar painéis).
    setInterval(posicionarBotao, 2000);
  }

  // ---- verificação: onde está o pokémon ativo? -------------------------------------------
  let aviso = null;
  function mostrarAviso(html, { fechaEm = 0, acao = null } = {}) {
    aviso?.remove();
    aviso = document.createElement('div');
    aviso.className = 'pih-aviso';
    aviso.append(criarBotao());
    const txt = document.createElement('div');
    txt.innerHTML = html;
    aviso.append(txt);
    if (acao) aviso.append(acao);
    const x = document.createElement('button');
    x.className = 'pih-x';
    x.textContent = '×';
    x.onclick = () => { aviso?.remove(); aviso = null; pararMira(); };
    aviso.append(x);
    document.body.append(aviso);
    if (fechaEm) setTimeout(() => { if (aviso?.contains(txt)) { aviso.remove(); aviso = null; } }, fechaEm);
  }

  let verificado = false;
  function verificar(tentativa = 0) {
    if (verificado) return;
    const pk = pkAtivo();
    const a = ancora();
    if (a) {
      posicionarBotao();
      if (pk) {
        const texto = a.modo === 'padrao' ? (a.nome?.textContent || '') : (a.el?.textContent || '');
        if (texto.includes(pk.nome)) {
          verificado = true;
          mostrarAviso(`Pokémon em campo encontrado: <b>${esc(pk.nome)}</b>. O <b>/hunt</b> está logo acima dele.`, { fechaEm: 4500 });
          return;
        }
      }
    }
    if (!pk && !eu) {
      if (tentativa < 20) { setTimeout(() => verificar(tentativa + 1), 1000); return; }
      return;
    }
    if (tentativa < 12) { setTimeout(() => verificar(tentativa + 1), 500); return; }
    if (pk && !a) {
      const mirar = document.createElement('button');
      mirar.className = 'pih-mais';
      mirar.style.width = 'auto';
      mirar.textContent = 'Apontar';
      mirar.onclick = iniciarMira;
      mostrarAviso(`<b>Onde está seu Pokémon ativo?</b><br>Não achei o card de <b>${esc(pk.nome)}</b>. Clique em “Apontar” e depois no nome dele.`, { acao: mirar });
    }
  }

  let mirando = null;
  function iniciarMira() {
    document.documentElement.classList.add('pih-mirando');
    let marcado = null;
    const sobre = (ev) => {
      marcado?.classList.remove('pih-alvo');
      marcado = ev.target instanceof Element && !ev.target.closest('.pih-aviso') ? ev.target : null;
      marcado?.classList.add('pih-alvo');
    };
    const clique = (ev) => {
      if (!marcado) return;
      ev.preventDefault();
      ev.stopPropagation();
      alvoManual = seletorDe(marcado);
      gravarJson(CHAVE_ALVO, alvoManual);
      pararMira();
      verificado = true;
      posicionarBotao();
      mostrarAviso('Pronto: o <b>/hunt</b> vai ficar logo acima deste ponto.', { fechaEm: 4000 });
    };
    addEventListener('mouseover', sobre, true);
    addEventListener('click', clique, true);
    mirando = () => {
      removeEventListener('mouseover', sobre, true);
      removeEventListener('click', clique, true);
      marcado?.classList.remove('pih-alvo');
    };
  }
  function pararMira() {
    document.documentElement.classList.remove('pih-mirando');
    mirando?.();
    mirando = null;
  }
  function seletorDe(el) {
    const partes = [];
    while (el && el !== document.body) {
      if (el.id) { partes.unshift(`#${CSS.escape(el.id)}`); break; }
      const i = [...el.parentElement.children].indexOf(el) + 1;
      partes.unshift(`${el.tagName.toLowerCase()}:nth-child(${i})`);
      el = el.parentElement;
    }
    return partes.join(' > ');
  }

  // ---- o painel --------------------------------------------------------------------------
  let painel = null;
  let mostrando = POR_PAGINA;
  let assinatura = '';

  function alternarPainel() {
    if (painel) return fecharPainel();
    painel = document.createElement('div');
    painel.className = 'pih-painel';
    painel.setAttribute('role', 'dialog');
    painel.setAttribute('aria-label', 'Onde caçar?');
    document.body.append(painel);
    mostrando = POR_PAGINA;
    posicionarPainel();
    desenhar();
    addEventListener('keydown', aoTeclar, true);
    setTimeout(() => addEventListener('pointerdown', aoClicarFora, true));
  }
  function fecharPainel() {
    painel?.remove();
    painel = null;
    assinatura = '';
    removeEventListener('keydown', aoTeclar, true);
    removeEventListener('pointerdown', aoClicarFora, true);
  }
  const aoTeclar = (ev) => { if (ev.key === 'Escape') fecharPainel(); };
  const aoClicarFora = (ev) => { if (painel && !painel.contains(ev.target) && ev.target !== botao) fecharPainel(); };

  function posicionarPainel() {
    if (!painel) return;
    const base = document.getElementById('p-ativo')?.getBoundingClientRect() ?? botao.getBoundingClientRect();
    const larg = painel.offsetWidth || 640;
    let left = base.right + 10;
    if (left + larg > innerWidth - 8) left = Math.max(8, innerWidth - larg - 8);
    const top = Math.min(Math.max(8, base.top - 60), Math.max(8, innerHeight - painel.offsetHeight - 8));
    painel.style.left = `${left}px`;
    painel.style.top = `${top}px`;
  }

  function cabecalho(pk) {
    const q = Number(pk?.quality ?? pk?.qualidade);
    const iv = pk?.ivs ? Object.values(pk.ivs).reduce((s, x) => s + (Number(x) || 0), 0) : null;
    const sub = pk
      ? [esc(pk.nome), `Nv ${num(pk.level)}`, `P${pk.potencia ?? 1}`, Number.isFinite(q) ? `Q ${q.toFixed(3).replace('.', ',')}` : '', iv != null ? `IV ${iv}` : '',
        PIH.engine._interno.temAoe(pk) ? 'TM AoE' : '']
        .filter(Boolean).join(' · ')
      : 'nenhum pokémon em campo';
    return `<div class="pih-cab">
      <span class="pih-btn" aria-hidden="true">/hunt</span>
      <div class="pih-titulo"><h3>Onde caçar? <span class="pih-credito">Lthaus</span></h3><small>${sub}</small></div>
      <button type="button" class="pih-fechar" data-acao="fechar" title="Fechar (Esc)">×</button>
    </div>`;
  }

  function blocoStats(pk) {
    if (!pk?.stats) return '';
    const rot = [['hp', 'HP'], ['atk', 'ATK'], ['def', 'DEF'], ['spAtk', 'SP.ATK'], ['spDef', 'SP.DEF'], ['speed', 'SPD']];
    return `<div class="pih-vao pih-stats">${rot.map(([k, r]) => `
      <div class="pih-stat"><b>${r}</b><span>${num(pk.stats[k] ?? 0)}</span>${pk.ivs?.[k] != null ? `<i>IV ${pk.ivs[k]}</i>` : ''}</div>`).join('')}
    </div>`;
  }

  /** Os bônus de XP que entraram na conta (multiplicam-se, como no jogo). */
  function blocoBonus(b) {
    if (!b) return '';
    const x = (v) => `×${v.toFixed(2).replace('.', ',')}`;
    const fmt = (i) => `${esc(i.nome)} ${i.mult >= 2 ? x(i.mult) : `+${(Math.round((i.mult - 1) * 1000) / 10).toString().replace('.', ',')}%`}`;
    const lista = b.itens.length ? b.itens.map(fmt).join(' · ') : 'nenhum bônus ativo';
    const iguais = Math.abs(b.pokemon - b.treinador) < 1e-6;
    return `<div class="pih-vao pih-bonus" title="Os bônus se multiplicam entre si (Pokepédia → Níveis e XP)">
      <b>Bônus de XP:</b> ${lista}
      <span class="pih-bonus-total">${iguais ? x(b.pokemon) : `pokémon ${x(b.pokemon)} · treinador ${x(b.treinador)}`}</span>
    </div>`;
  }

  function blocoEta(pk, r, sessao, slugAtiva) {
    if (!pk) return '';
    const top = r?.linhas?.find((l) => !l.inviavel);
    const huntAtivaLinha = slugAtiva ? r?.linhas?.find((l) => l.slug === slugAtiva) : null;

    const taxaPk = (huntAtivaLinha && sessao?.xpPokemonH > 0)
      ? sessao.xpPokemonH
      : (huntAtivaLinha?.xpPokemonH || top?.xpPokemonH || 0);

    const taxaTr = (huntAtivaLinha && sessao?.xpTreinadorH > 0)
      ? sessao.xpTreinadorH
      : (huntAtivaLinha?.xpTreinadorH || top?.xpTreinadorH || 0);

    const faltaPk = (pk.xpProximo ? Math.max(0, pk.xpProximo - (pk.xp || 0)) : calcularXpFaltando(pk.xp, pk.level));
    const faltaTr = (eu?.xpProximo ? Math.max(0, eu.xpProximo - (eu.xp || 0)) : calcularXpFaltando(eu?.xp, eu?.level || 1));

    const etaPk = taxaPk > 0 ? formatarEta((faltaPk / taxaPk) * 3600000) : '—';
    const etaTr = taxaTr > 0 ? formatarEta((faltaTr / taxaTr) * 3600000) : '—';

    const fonte = (huntAtivaLinha && sessao?.xpPokemonH > 0) ? 'sessão ao vivo' : (huntAtivaLinha ? 'hunt em campo' : 'top 1');

    return `<div class="pih-vao pih-eta" title="Tempo estimado para o próximo nível (${fonte}). Faltam ${num(faltaPk)} XP no pokémon e ${num(faltaTr)} XP no treinador.">
      <b>Próximo nível:</b> Pokémon <b>Nv ${num(pk.level + 1)}</b> em <b>${etaPk}</b> <span class="pih-dim">(${curto(taxaPk)} XP/h)</span> · Treinador <b>Nv ${num((eu?.level || 1) + 1)}</b> em <b>${etaTr}</b> <span class="pih-dim">(${curto(taxaTr)} XP/h)</span>
    </div>`;
  }

  function blocoSessaoReal(linhaAtiva, sessao, ordem) {
    if (!linhaAtiva || !sessao || sessao.minutos < 1) return '';
    const pct = Math.round((sessao.abatesH / Math.max(1, linhaAtiva.kph)) * 100);
    const corPct = (pct >= 85 && pct <= 115) ? 'pih-ok' : (pct < 85 ? 'pih-alerta' : 'pih-ok');
    const j10 = sessao.janela10m || sessao;
    const j1h = sessao.janela1h || sessao;

    let linhaMetrica = '';
    if (ordem === 'ouro') {
      linhaMetrica = `<div style="margin-top: 3px; font-size: 11.5px;">
        <b>Ouro/h:</b> Tempo real: <b>${curto(sessao.goldH)}</b> · 10 min: <b>${curto(j10.goldH)}</b> · 1h: <b>${curto(j1h.goldH)}</b>
        <span class="pih-dim" style="margin-left: 6px;">(total ganho: ${num(sessao.gold)} ouro · líq: ${curto(sessao.lucroLiquidoH)}/h)</span>
      </div>`;
    } else if (ordem === 'catch') {
      const taxaConv = sessao.abates > 0 ? ((sessao.capturas / sessao.abates) * 100).toFixed(1) : '0,0';
      linhaMetrica = `<div style="margin-top: 3px; font-size: 11.5px;">
        <b>Catch:</b> Tempo real: <b>${sessao.capturasH.toFixed(1).replace('.', ',')}</b> · 10 min: <b>${j10.capturasH.toFixed(1).replace('.', ',')}</b> · 1h: <b>${j1h.capturasH.toFixed(1).replace('.', ',')}</b>
        <span class="pih-dim" style="margin-left: 6px;">(conversão real: ${taxaConv.replace('.', ',')}% · ${sessao.capturas} capturas / ${sessao.abates} abates)</span>
      </div>`;
    } else {
      linhaMetrica = `<div style="margin-top: 3px; font-size: 11.5px;">
        <b>XP Pokémon/h:</b> Tempo real: <b>${curto(sessao.xpPokemonH)}</b> · 10 min: <b>${curto(j10.xpPokemonH)}</b> · 1h: <b>${curto(j1h.xpPokemonH)}</b>
        <span class="pih-dim" style="margin-left: 6px;">(treinador: ${curto(sessao.xpTreinadorH)} XP/h)</span>
      </div>`;
    }

    return `<div class="pih-vao pih-sessao-real" title="Métricas em tempo real da hunt atual com recortes de 10 minutos e última hora">
      <div style="display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: baseline;">
        <span class="pih-sessao-tag">📍 Hunt atual: ${esc(linhaAtiva.nome)} (${sessao.minutos} min):</span>
        <b>${num(sessao.abatesH)} abates/h reais</b> <span class="${corPct}">(${pct}% da estimativa teórica de ${num(linhaAtiva.kph)}/h)</span>
      </div>
      ${linhaMetrica}
    </div>`;
  }

  function controles() {
    return `<div class="pih-ctrl">
      <span class="pih-seg">
        <button type="button" data-ordem="xp" class="${prefs.ordem === 'xp' ? 'on' : ''}">XP/h</button>
        <button type="button" data-ordem="ouro" class="${prefs.ordem === 'ouro' ? 'on' : ''}">Ouro/h</button>
        <button type="button" data-ordem="catch" class="${prefs.ordem === 'catch' ? 'on' : ''}">Catch</button>
        <button type="button" data-ordem="sessao" class="${prefs.ordem === 'sessao' ? 'on' : ''}">Sessão</button>
      </span>
      ${prefs.ordem === 'catch' ? `
      <label style="margin-left: 2px;">Bola:
        <select data-pref-select="bola" style="background: var(--vao2, #462b39); color: var(--sobre-mad, #fff6ef); border: 0; border-radius: 4px; padding: 2px 5px; font: 700 11px system-ui; cursor: pointer;">
          <option value="poke" ${prefs.bola === 'poke' ? 'selected' : ''}>Poké Ball (5g)</option>
          <option value="great" ${prefs.bola === 'great' ? 'selected' : ''}>Great Ball (20g)</option>
          <option value="super" ${prefs.bola === 'super' ? 'selected' : ''}>Super Ball (50g)</option>
          <option value="ultra" ${prefs.bola === 'ultra' ? 'selected' : ''}>Ultra Ball (130g)</option>
          <option value="beast" ${prefs.bola === 'beast' ? 'selected' : ''}>Beast Ball (💎)</option>
        </select>
      </label>` : ''}
      ${prefs.ordem !== 'sessao' ? `
      <label><input type="checkbox" data-pref="soLiberadas" ${prefs.soLiberadas ? 'checked' : ''}> só hunts liberadas</label>
      <label title="Com a automação de poção ligada, só morre quem leva um golpe maior que o HP inteiro"><input type="checkbox" data-pref="comPocao" ${prefs.comPocao ? 'checked' : ''}> poção automática</label>` : ''}
      ${prefs.ordem === 'ouro' ? '<button type="button" class="pih-ajuda" data-acao="ajuda-ouro" aria-expanded="false" aria-controls="pih-dica-ouro" title="O que entra no ouro/h">?</button>' : ''}
      ${prefs.ordem === 'catch' ? '<button type="button" class="pih-ajuda" data-acao="ajuda-captura" aria-expanded="false" aria-controls="pih-dica-captura" title="Como funciona a estimativa de captura">?</button>' : ''}
    </div>
    ${prefs.ordem === 'ouro' ? `<div class="pih-vao pih-dica" id="pih-dica-ouro" hidden>
      O ouro/h soma o <b>ouro de cada abate</b> e o <b>loot</b> vendido ao NPC.
      A <b>venda dos pokémon capturados</b> não entra no cálculo.
    </div>` : ''}
    ${prefs.ordem === 'catch' ? `<div class="pih-vao pih-dica" id="pih-dica-captura" hidden>
      Chance no corpo caído segundo a Poképédia (log do preço NPC e eficiência da bola).
      <b>Ouro Líq.</b> desconta o preço das pokébolas consumidas do ouro bruto de drops e abates.
    </div>` : ''}`;
  }

  function risco(l) {
    if (l.umHit) return '<span class="pih-perigo" title="Um golpe do selvagem passa do seu HP">☠ 1 hit</span>';
    if (l.mortesH >= 0.5) return `<span class="pih-perigo" title="Mortes estimadas por hora">☠ ${l.mortesH.toFixed(1).replace('.', ',')}/h</span>`;
    const pct = Math.round(l.hitPct * 100);
    const oque = l.engajados > 1.2
      ? `O pior momento (o golpe mais forte de um selvagem mais o golpe médio dos outros ${(l.engajados - 1).toFixed(1).replace('.', ',')} que o AoE segura em você) tira ${pct}% do seu HP`
      : `O pior golpe do selvagem tira ${pct}% do seu HP`;
    if (pct >= 50) return `<span class="pih-alerta" title="${oque}">⚠ ${pct}%</span>`;
    return `<span class="pih-ok" title="${oque}">✓ ${pct}%</span>`;
  }

  function linhaHtml(l, i, slugAtiva, sessao) {
    const isAtiva = slugAtiva && l.slug === slugAtiva;
    const medido = l.kphMedido != null ? ` · você fez ${num(l.kphMedido)} abates/h aqui com este pokémon (referência; não muda o ranking)` : '';
    const aprox = l.aoe
      ? `<span class="pih-aprox" title="Estimativa com o TM AoE: ${l.engajados.toFixed(1).replace('.', ',')} selvagens em você ao mesmo tempo${l.geoMedida ? '' : '; geometria padrão'}${medido}">≈AoE</span>`
      : l.geoMedida
        ? (medido ? `<span class="pih-medido" title="Geometria medida em ondas cheias${medido}">●</span>` : '')
        : `<span class="pih-aprox" title="Geometria padrão (sem onda cheia medida nesta hunt)${medido}">≈</span>`;
    const cls = [i === 0 && !l.inviavel ? 'pih-top' : '', isAtiva ? 'pih-em-campo' : '', l.liberada ? '' : 'pih-bloq'].filter(Boolean).join(' ');
    const golpe = l.melhorGolpe ? `${esc(l.melhorGolpe.nome)} ×${l.efetividade.toFixed(2).replace('.', ',')}` : '';
    const tagCampo = isAtiva ? '<span class="pih-tag-campo" title="Você está caçando nesta área agora">📍 em campo</span>' : '';

    if (l.inviavel) {
      return `<tr class="${cls}"><td class="pih-pos">${i + 1}</td>
        <td class="pih-hunt"><b>${esc(l.nome)}</b>${tagCampo}<small>${regiao(l.regiao)} · Nv ${num(l.nivel)}</small></td>
        <td colspan="5"><span class="pih-perigo">não mata o selvagem</span></td></tr>`;
    }

    if (prefs.ordem === 'catch') {
      const sinalLiq = l.ouroLiquidoH >= 0 ? '+' : '';
      const corLiq = l.ouroLiquidoH >= 0 ? 'pih-ok' : 'pih-perigo';
      let catchCell = `<b>${l.capturasH.toFixed(1).replace('.', ',')}/h</b>`;
      if (isAtiva && sessao && sessao.minutos >= 1 && sessao.capturasH > 0) {
        catchCell = `<span title="Estimativa teórica: ${l.capturasH.toFixed(1)}/h | Sessão real: ${sessao.capturasH.toFixed(1)}/h"><b>${sessao.capturasH.toFixed(1).replace('.', ',')}/h</b> <small class="pih-dim">(${l.capturasH.toFixed(1).replace('.', ',')})</small></span>`;
      }
      return `<tr class="${cls}" title="${esc(golpe)}">
        <td class="pih-pos">${i + 1}</td>
        <td class="pih-hunt"><b>${esc(l.nome)}</b>${tagCampo}<small>${regiao(l.regiao)} · Nv ${num(l.nivel)}${l.liberada ? '' : ' · 🔒'}</small></td>
        <td>${catchCell}</td>
        <td>${(l.chanceCapturaMedia * 100).toFixed(1).replace('.', ',')}%</td>
        <td>${curto(l.custoBolasH)}</td>
        <td><span class="${corLiq}">${sinalLiq}${curto(l.ouroLiquidoH)}</span></td>
        <td>${curto(l.xpPokemonH)}</td>
      </tr>`;
    }

    let mataEmHtml = segundos(l.ttk);
    if (l.taxa1Hit >= 0.999) {
      mataEmHtml = '<span class="pih-ok" title="100% de chance de abate no 1º hit (mesmo na pior rolagem de dano 0,85)">⚡ 1 hit</span>';
    } else if (l.taxa1Hit >= 0.50) {
      mataEmHtml = `<span class="pih-alerta" title="${Math.round(l.taxa1Hit * 100)}% de chance de matar no 1º hit. Na rolagem baixa de dano precisa de 2 hits.">${segundos(l.ttk)} <small>(${Math.round(l.taxa1Hit * 100)}% 1-hit)</small></span>`;
    }

    let abatesCell = `${aprox}${num(l.kph)}`;
    let valorPrincipal = curto(prefs.ordem === 'ouro' ? l.ouroH : l.xpPokemonH);
    if (isAtiva && sessao && sessao.minutos >= 1) {
      if (sessao.abatesH > 0) {
        abatesCell = `<span title="Estimativa teórica: ${num(l.kph)}/h | Sessão real: ${num(sessao.abatesH)}/h (${Math.round((sessao.abatesH / l.kph) * 100)}%)">${aprox}<b>${num(sessao.abatesH)}</b> <small class="pih-dim">(${num(l.kph)})</small></span>`;
      }
      if (prefs.ordem === 'ouro' && sessao.goldH > 0) {
        valorPrincipal = `<span title="Estimativa teórica: ${curto(l.ouroH)}/h | Sessão real: ${curto(sessao.goldH)}/h"><b>${curto(sessao.goldH)}</b> <small class="pih-dim">(${curto(l.ouroH)})</small></span>`;
      } else if (prefs.ordem === 'xp' && sessao.xpPokemonH > 0) {
        valorPrincipal = `<span title="Estimativa teórica: ${curto(l.xpPokemonH)}/h | Sessão real: ${curto(sessao.xpPokemonH)}/h"><b>${curto(sessao.xpPokemonH)}</b> <small class="pih-dim">(${curto(l.xpPokemonH)})</small></span>`;
      }
    }

    return `<tr class="${cls}" title="${esc(golpe)}">
      <td class="pih-pos">${i + 1}</td>
      <td class="pih-hunt"><b>${esc(l.nome)}</b>${tagCampo}<small>${regiao(l.regiao)} · Nv ${num(l.nivel)}${l.liberada ? '' : ' · 🔒'}</small></td>
      <td>${valorPrincipal}</td>
      <td>${abatesCell}</td>
      <td>${mataEmHtml}</td>
      <td>${risco(l)}</td>
      <td>${curto(prefs.ordem === 'ouro' ? l.xpPokemonH : l.ouroH)}</td>
    </tr>`;
  }

  function corpoSessao(r, jogo, pk, sessao, slugAtiva, historico) {
    if (!sessao) {
      return '<div class="pih-erro">Nenhuma sessão ativa encontrada para este personagem.</div>';
    }

    const lucroCor = sessao.lucroLiquidoH >= 0 ? 'pih-ok' : 'pih-perigo';
    const taxaConv = sessao.abates > 0 ? ((sessao.capturas / sessao.abates) * 100).toFixed(1) : '0,0';

    const bolasHtml = sessao.bolas.itens.length
      ? `<div class="pih-consumo-chips">${sessao.bolas.itens.map((b) => `
          <div class="pih-chip"><b>${esc(b.nome)}:</b> ${num(b.count)} gastas (${num(b.countH)}/h) · ${curto(b.custo)} g (${curto(b.custoH)} ouro/h)</div>`).join('')}</div>`
      : '<span class="pih-dim">Nenhuma bola utilizada na sessão.</span>';

    const pocoesHtml = sessao.pocoes.itens.length
      ? `<div class="pih-consumo-chips">${sessao.pocoes.itens.map((p) => `
          <div class="pih-chip"><b>${esc(p.nome)}:</b> ${num(p.count)} usadas (${num(p.countH)}/h) · ${curto(p.custo)} g (${curto(p.custoH)} ouro/h)</div>`).join('')}</div>`
      : '<span class="pih-dim">Nenhuma poção ou revive utilizado.</span>';

    const dropsHtml = sessao.drops.length
      ? `<div class="pih-consumo-chips">${sessao.drops.map((d) => `
          <div class="pih-chip"><b>${esc(d.nome)}:</b> ${num(d.count)} (${d.countH}/h)</div>`).join('')}</div>`
      : '<span class="pih-dim">Nenhum drop raro registrado.</span>';

    const marco = lerJson(CHAVE_MARCO_SESSAO, null);
    let marcoHtml = '';
    if (marco && marco.ms) {
      const deltaMs = Math.max(0, sessao.ms - marco.ms);
      const deltaMin = Math.round(deltaMs / 60000);
      const deltaHoras = Math.max(deltaMs, 60000) / 3600000;
      const deltaAbates = Math.max(0, sessao.abates - marco.abates);
      const deltaAbatesH = Math.round(deltaAbates / deltaHoras);
      const deltaXpPk = Math.max(0, sessao.xpPokemon - marco.xpPokemon);
      const deltaXpPkH = Math.round(deltaXpPk / deltaHoras);
      const deltaGold = Math.max(0, sessao.gold - marco.gold);
      const deltaGoldH = Math.round(deltaGold / deltaHoras);
      const deltaBolas = Math.max(0, sessao.bolas.totalCount - (marco.bolasCount || 0));
      const deltaBolasH = Math.round(deltaBolas / deltaHoras);
      const deltaCusto = Math.max(0, (sessao.bolas.custoTotal + sessao.pocoes.custoTotal) - (marco.custoConsumiveis || 0));
      const deltaCustoH = Math.round(deltaCusto / deltaHoras);
      const deltaLucroLiqH = deltaGoldH - deltaCustoH;

      marcoHtml = `<div class="pih-comparativo-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <b style="color: var(--laranja, #f0a03c);">📌 Marco Salvo (${deltaMin} min decorridos desde as ${esc(marco.dataHora || '')})</b>
          <div style="display: flex; gap: 4px;">
            <button type="button" class="pih-btn-mini" data-acao="copiar-marco" title="Copiar relatório comparativo deste intervalo">📋 Copiar Delta</button>
            <button type="button" class="pih-btn-mini" data-acao="limpar-marco" title="Excluir marco salvo">✕ Limpar</button>
          </div>
        </div>
        <div style="font-size: 11px; line-height: 1.45; color: var(--sobre-mad-dim, #f5cdb9);">
          <b>Progresso no intervalo:</b> ${num(deltaAbates)} abates (${num(deltaAbatesH)}/h) · ${curto(deltaXpPk)} XP (${curto(deltaXpPkH)}/h) · ${curto(deltaGold)} ouro (${curto(deltaGoldH)} ouro/h) · ${num(deltaBolas)} bolas (${num(deltaBolasH)} bolas/h) · Custo: ${curto(deltaCusto)} g (${curto(deltaCustoH)} ouro/h) · Lucro líq: ${curto(deltaLucroLiqH)}/h
        </div>
      </div>`;
    }

    const histRows = historico.length
      ? historico.map((h, idx) => `
        <tr>
          <td><b>${esc(h.nome)}</b>${h.aoVivo ? ' <span class="pih-tag-campo">ao vivo</span>' : ''}</td>
          <td>${h.minutos} min</td>
          <td>${num(h.abates)} <small class="pih-dim">(${num(h.abatesH)}/h)</small></td>
          <td>${curto(h.xpPk)}</td>
          <td>${curto(h.gold)} <small class="pih-dim">(${curto(h.goldH || 0)}/h)</small></td>
          <td>${num(h.bolas || 0)} <small class="pih-dim">(${num(h.bolasH || 0)}/h)</small></td>
          <td><button type="button" class="pih-btn-mini" data-acao="copiar-hunt-item" data-index="${idx}" title="Copiar relatório em Markdown desta hunt">📋 Copiar</button></td>
        </tr>`).join('')
      : `<tr><td colspan="7" class="pih-dim" style="text-align: center; padding: 12px;">Nenhum histórico registrado nesta sessão ainda.</td></tr>`;

    return `<div class="pih-sessao-container">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; gap: 6px; flex-wrap: wrap;">
        <span style="font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: .3px;">Sessão Geral (${sessao.minutos} min)</span>
        <div style="display: flex; gap: 6px; align-items: center;">
          <button type="button" class="pih-btn pih-btn-copiar" data-acao="salvar-marco" title="Salva uma foto desta sessão para comparar o progresso posterior">📌 Salvar Marco</button>
          <button type="button" class="pih-btn pih-btn-copiar" data-acao="copiar-chatgpt" title="Copiar relatório formatado em Markdown para colar no ChatGPT">📋 Copiar para ChatGPT</button>
        </div>
      </div>

      ${marcoHtml}

      <div class="pih-grid-sessao">
        <div class="pih-card-stat"><b>Abates</b><span>${num(sessao.abates)}</span><small>${num(sessao.abatesH)} abates/h</small></div>
        <div class="pih-card-stat"><b>XP Pokémon</b><span>${curto(sessao.xpPokemon)}</span><small>${curto(sessao.xpPokemonH)} XP/h</small></div>
        <div class="pih-card-stat"><b>XP Treinador</b><span>${curto(sessao.xpTreinador)}</span><small>${curto(sessao.xpTreinadorH)} XP/h</small></div>
        <div class="pih-card-stat"><b>Ouro Ganho</b><span>${num(sessao.gold)}</span><small>${curto(sessao.goldH)} ouro/h</small></div>
        <div class="pih-card-stat"><b>Custo Consumíveis</b><span>${curto(sessao.bolas.custoTotal + sessao.pocoes.custoTotal)}</span><small>${curto(sessao.bolas.custoH + sessao.pocoes.custoH)} ouro/h</small></div>
        <div class="pih-card-stat"><b>Lucro Líquido Real</b><span class="${lucroCor}">${curto(sessao.lucroLiquidoH)} ouro/h</span><small>${curto(sessao.gold - sessao.bolas.custoTotal - sessao.pocoes.custoTotal)} total</small></div>
        <div class="pih-card-stat"><b>Capturas</b><span>${num(sessao.capturas)}</span><small>${sessao.capturasH.toFixed(1).replace('.', ',')}/h (taxa ${taxaConv.replace('.', ',')}%)</small></div>
        <div class="pih-card-stat"><b>Shinies</b><span>${sessao.shinies}</span><small>${sessao.shiniesVistos} vistos</small></div>
        <div class="pih-card-stat"><b>Tempo Decorrido</b><span>${sessao.minutos} min</span><small>${segundos(sessao.ms / 1000)}</small></div>
      </div>

      <div class="pih-vao pih-sessao-secao">
        <h4>Consumo de Pokébolas (${num(sessao.bolas.totalCount)} bolas · ${num(sessao.bolas.totalCountH)} bolas/h · custo: ${curto(sessao.bolas.custoTotal)} · ${curto(sessao.bolas.custoH)} ouro/h)</h4>
        ${bolasHtml}
      </div>

      <div class="pih-vao pih-sessao-secao">
        <h4>Consumo de Poções e Revives (${num(sessao.pocoes.totalCount)} itens · ${num(sessao.pocoes.totalCountH)} itens/h · custo: ${curto(sessao.pocoes.custoTotal)} · ${curto(sessao.pocoes.custoH)} ouro/h)</h4>
        ${pocoesHtml}
      </div>

      <div class="pih-vao pih-sessao-secao">
        <h4>Drops Especiais da Sessão</h4>
        ${dropsHtml}
      </div>

      <div class="pih-vao pih-sessao-secao" style="padding: 0; overflow: auto; max-height: 200px;">
        <table class="pih-hist-tab">
          <thead>
            <tr>
              <th>Hunt</th>
              <th>Duração</th>
              <th>Abates</th>
              <th>XP Pk</th>
              <th>Ouro</th>
              <th>Bolas</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            ${histRows}
          </tbody>
        </table>
      </div>

      <div class="pih-rodape">Dados sincronizados em tempo real com sessao-hunt:${esc(eu?.nick || 'jogador')}</div>
    </div>`;
  }

  function salvarMarcoSessao(sessao) {
    if (!sessao) return;
    gravarJson(CHAVE_MARCO_SESSAO, {
      t: Date.now(),
      dataHora: new Date().toLocaleTimeString('pt-BR'),
      ms: sessao.ms,
      minutos: sessao.minutos,
      abates: sessao.abates,
      gold: sessao.gold,
      xpPokemon: sessao.xpPokemon,
      xpTreinador: sessao.xpTreinador,
      capturas: sessao.capturas,
      bolasCount: sessao.bolas?.totalCount || 0,
      pocoesCount: sessao.pocoes?.totalCount || 0,
      custoConsumiveis: (sessao.bolas?.custoTotal || 0) + (sessao.pocoes?.custoTotal || 0),
    });
    desenhar();
  }

  function limparMarcoSessao() {
    try { localStorage.removeItem(CHAVE_MARCO_SESSAO); } catch (_) {}
    desenhar();
  }

  async function copiarMarcoSessao(sessao) {
    const marco = lerJson(CHAVE_MARCO_SESSAO, null);
    if (!marco || !sessao) return;
    const deltaMs = Math.max(0, sessao.ms - marco.ms);
    const deltaMin = Math.round(deltaMs / 60000);
    const deltaHoras = Math.max(deltaMs, 60000) / 3600000;
    const deltaAbates = Math.max(0, sessao.abates - marco.abates);
    const deltaAbatesH = Math.round(deltaAbates / deltaHoras);
    const deltaXpPk = Math.max(0, sessao.xpPokemon - marco.xpPokemon);
    const deltaXpPkH = Math.round(deltaXpPk / deltaHoras);
    const deltaGold = Math.max(0, sessao.gold - marco.gold);
    const deltaGoldH = Math.round(deltaGold / deltaHoras);
    const deltaBolas = Math.max(0, sessao.bolas.totalCount - (marco.bolasCount || 0));
    const deltaBolasH = Math.round(deltaBolas / deltaHoras);
    const deltaCusto = Math.max(0, (sessao.bolas.custoTotal + sessao.pocoes.custoTotal) - (marco.custoConsumiveis || 0));
    const deltaCustoH = Math.round(deltaCusto / deltaHoras);
    const deltaLucroLiqH = deltaGoldH - deltaCustoH;

    const txt = [
      `# Relatório de Comparação de Intervalo (Marco PokeIdle)`,
      `**Intervalo:** ${deltaMin} minutos decorridos (das ${marco.dataHora} até agora)`,
      `- **Abates no Intervalo:** ${num(deltaAbates)} (${num(deltaAbatesH)} abates/h)`,
      `- **XP Pokémon no Intervalo:** ${curto(deltaXpPk)} (${curto(deltaXpPkH)} XP/h)`,
      `- **Ouro Ganho no Intervalo:** ${curto(deltaGold)} (${curto(deltaGoldH)} ouro/h)`,
      `- **Bolas Gastas no Intervalo:** ${num(deltaBolas)} (${num(deltaBolasH)} bolas/h · custo ${curto(deltaCusto)} g)`,
      `- **Lucro Líquido Real do Intervalo:** ${curto(deltaLucroLiqH)} ouro/h`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(txt);
      const btn = painel?.querySelector('[data-acao="copiar-marco"]');
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = '✓ Copiado!';
        setTimeout(() => { btn.textContent = orig; }, 2000);
      }
    } catch (e) {
      console.warn('Falha ao copiar marco:', e);
    }
  }

  async function copiarHuntItem(historico, idx) {
    const h = historico?.[idx];
    if (!h) return;
    const txt = [
      `# Relatório de Hunt — ${h.nome}${h.aoVivo ? ' (ao vivo)' : ''}`,
      `- **Duração:** ${h.minutos} min`,
      `- **Abates:** ${num(h.abates)} (${num(h.abatesH)} abates/h)`,
      `- **XP Pokémon:** ${curto(h.xpPk)}`,
      `- **XP Treinador:** ${curto(h.xpTr)}`,
      `- **Ouro Ganho:** ${curto(h.gold)} (${curto(h.goldH || 0)} ouro/h)`,
      `- **Bolas Gastas:** ${num(h.bolas || 0)} (${num(h.bolasH || 0)} bolas/h · custo ${curto(h.custoConsumiveis || 0)} g)`,
      `- **Lucro Líquido Estimado:** ${curto(h.lucroLiquidoH || 0)} ouro/h`,
      `- **Capturas:** ${h.capturas}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(txt);
      const btn = painel?.querySelector(`[data-acao="copiar-hunt-item"][data-index="${idx}"]`);
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = '✓';
        setTimeout(() => { btn.textContent = orig; }, 2000);
      }
    } catch (e) {
      console.warn('Falha ao copiar item de hunt:', e);
    }
  }

  async function copiarRelatorioChatGpt() {
    const pk = pkAtivo();
    const jogo = await PIH.carregarJogo();
    const precoItem = new Map(jogo.precoItem);
    for (const i of welcome.itensNossos ?? []) {
      if (i?.name && Number(i.npcPrice) > 0) precoItem.set(i.name, Number(i.npcPrice));
    }
    const sessao = lerSessaoJogo(eu, precoItem, jogo.nomeItemPorId, jogo.precoItemPorId);
    if (!pk || !sessao) return;
    const slugAtiva = obterHuntAtiva();
    const huntAtivaObj = (welcome?.hunts ?? []).find((h) => h.slug === slugAtiva);
    const nomeHuntAtiva = huntAtivaObj?.nome || slugAtiva;
    const historico = obterHistoricoHunts(sessao, slugAtiva, nomeHuntAtiva);
    const r = PIH.engine?.analisar ? PIH.engine.analisar(pk, contexto(jogo, pk), prefs) : null;
    const q = Number(pk.quality ?? pk.qualidade);
    const ivTotal = pk.ivs ? Object.values(pk.ivs).reduce((s, x) => s + (Number(x) || 0), 0) : null;
    const top = r?.linhas?.find((l) => !l.inviavel);
    const huntAtiva = r?.linhas?.find((l) => l.slug === slugAtiva);

    const txt = [
      `# Relatório de Sessão PokeIdle — ${eu?.nick ?? 'Treinador'}`,
      `**Data/Hora:** ${new Date().toLocaleString('pt-BR')}`,
      '',
      `## 1. Pokémon Ativo em Campo`,
      `- **Nome:** ${pk.nome}`,
      `- **Nível:** ${pk.level} (P${pk.potencia ?? 1}${Number.isFinite(q) ? `, Q ${q.toFixed(3)}` : ''}${ivTotal != null ? `, IV ${ivTotal}` : ''})`,
      `- **Stats:** HP ${pk.stats?.hp ?? '-'}, ATK ${pk.stats?.atk ?? '-'}, DEF ${pk.stats?.def ?? '-'}, SP.ATK ${pk.stats?.spAtk ?? '-'}, SP.DEF ${pk.stats?.spDef ?? '-'}, SPD ${pk.stats?.speed ?? '-'}`,
      `- **TMs:** ${pk.tmElemental ? `TM Elemental (${pk.tmElemental})` : 'Nenhum'} · ${pk.tmAoe ? 'TM AoE Ativo' : 'Sem AoE'}`,
      '',
      `## 2. Resumo da Sessão Geral (${sessao.minutos} minutos decorridos)`,
      `- **Abates:** ${num(sessao.abates)} (${num(sessao.abatesH)} abates/h)`,
      `- **XP Pokémon:** ${curto(sessao.xpPokemon)} (${curto(sessao.xpPokemonH)} XP/h)`,
      `- **XP Treinador:** ${curto(sessao.xpTreinador)} (${curto(sessao.xpTreinadorH)} XP/h)`,
      `- **Ouro Ganho (Bruto):** ${num(sessao.gold)} (${curto(sessao.goldH)} ouro/h)`,
      `- **Custo de Pokébolas:** ${curto(sessao.bolas.custoTotal)} (${curto(sessao.bolas.custoH)} ouro/h · ${num(sessao.bolas.totalCountH)} bolas/h)`,
      `- **Custo de Poções/Revives:** ${curto(sessao.pocoes.custoTotal)} (${curto(sessao.pocoes.custoH)} ouro/h · ${num(sessao.pocoes.totalCountH)} itens/h)`,
      `- **Lucro Líquido Real:** ${curto(sessao.lucroLiquidoH)} ouro/h`,
      `- **Catch:** ${sessao.capturas} (${sessao.capturasH.toFixed(1)}/h · taxa de conversão: ${sessao.abates > 0 ? (sessao.capturas / sessao.abates * 100).toFixed(1) : 0}%)`,
      `- **Shinies:** ${sessao.shinies} capturados / ${sessao.shiniesVistos} vistos`,
      '',
      `## 3. Hunt Atual`,
      huntAtiva ? [
        `- **Hunt:** ${huntAtiva.nome} (${regiao(huntAtiva.regiao)} · Nv ${huntAtiva.nivel})`,
        `- **Desempenho Real vs Teórico:** ${sessao.abatesH} abates/h reais vs ${num(huntAtiva.kph)} teóricos (${Math.round((sessao.abatesH / huntAtiva.kph) * 100)}% de precisão)`,
        `- **Janelas em Tempo Real:**`,
        `  - **10 min:** ${curto(sessao.janela10m?.xpPokemonH ?? sessao.xpPokemonH)} XP/h · ${num(sessao.janela10m?.abatesH ?? sessao.abatesH)} abates/h · ${curto(sessao.janela10m?.goldH ?? sessao.goldH)} ouro/h (líquido: ${curto(sessao.janela10m?.lucroLiquidoH ?? sessao.lucroLiquidoH)} ouro/h) · ${num(sessao.janela10m?.bolasH ?? sessao.bolas.totalCountH)} bolas/h`,
        `  - **1 hora:** ${curto(sessao.janela1h?.xpPokemonH ?? sessao.xpPokemonH)} XP/h · ${num(sessao.janela1h?.abatesH ?? sessao.abatesH)} abates/h · ${curto(sessao.janela1h?.goldH ?? sessao.goldH)} ouro/h (líquido: ${curto(sessao.janela1h?.lucroLiquidoH ?? sessao.lucroLiquidoH)} ouro/h) · ${num(sessao.janela1h?.bolasH ?? sessao.bolas.totalCountH)} bolas/h`,
      ].join('\n') : `- Sem hunt ativa no momento`,
      '',
      `## 4. Histórico de Hunts na Sessão`,
      ...(historico.length ? historico.map((h, i) => `${i + 1}. **${h.nome}**${h.aoVivo ? ' (ao vivo)' : ''} (${h.minutos} min): ${num(h.abates)} abates (${num(h.abatesH)}/h) · ${curto(h.xpPk)} XP · ${curto(h.gold)} ouro · ${num(h.bolas || 0)} bolas (${num(h.bolasH || 0)}/h · custo ${curto(h.custoConsumiveis || 0)} g) · ${h.capturas} capturas`) : ['- Apenas a hunt atual registrada nesta sessão']),
      '',
      `## 5. Recomendação de Otimização (/hunt)`,
      top ? `- **Melhor Rota Teórica:** ${top.nome} (${curto(top.xpPokemonH)} XP/h pokémon, ${curto(top.ouroH)} ouro/h, ${top.capturasH.toFixed(1)} catch/h)` : '- Nenhuma',
    ].join('\n');

    try {
      await navigator.clipboard.writeText(txt);
      const avisoBtn = painel?.querySelector('[data-acao="copiar-chatgpt"]');
      if (avisoBtn) {
        const original = avisoBtn.textContent;
        avisoBtn.textContent = '✓ Copiado com sucesso!';
        avisoBtn.style.background = '#6fd08a';
        avisoBtn.style.color = '#000';
        setTimeout(() => {
          avisoBtn.textContent = original;
          avisoBtn.style.background = '';
          avisoBtn.style.color = '';
        }, 3000);
      }
    } catch (e) {
      console.warn('Falha ao copiar:', e);
    }
  }

  function corpo(r, jogo, pk, sessao, slugAtiva, historico) {
    if (prefs.ordem === 'sessao') {
      return corpoSessao(r, jogo, pk, sessao, slugAtiva, historico);
    }

    const linhas = r.linhas;
    if (!linhas.length) return '<div class="pih-erro">Nenhuma hunt liberada para o seu nível de treinador.</div>';
    const top = linhas.find((l) => !l.inviavel);
    const ths = prefs.ordem === 'catch'
      ? '<th>#</th><th>Hunt</th><th>Catch</th><th>Taxa</th><th>Custo Bolas</th><th>Ouro Líq.</th><th>XP/h</th>'
      : `<th>#</th><th>Hunt</th><th>${prefs.ordem === 'ouro' ? 'Ouro/h' : 'XP/h'}</th><th>Abates/h</th><th>Mata em</th><th>Risco</th><th>${prefs.ordem === 'ouro' ? 'XP/h' : 'Ouro/h'}</th>`;

    const linhaAtiva = slugAtiva ? linhas.find((l) => l.slug === slugAtiva) : null;
    const sessaoHtml = blocoSessaoReal(linhaAtiva, sessao, prefs.ordem);

    let resumo = '';
    if (top) {
      const badge1Hit = top.taxa1Hit >= 0.999
        ? ' · ⚡ 100% 1-hit kill'
        : top.taxa1Hit >= 0.50
          ? ` · ⚡ ${Math.round(top.taxa1Hit * 100)}% 1-hit`
          : '';
      if (prefs.ordem === 'catch') {
        const sinalLiq = top.ouroLiquidoH >= 0 ? '+' : '';
        resumo = `<div class="pih-vao pih-melhor">
          <span class="pih-coroa">👑</span>
          <div><strong>${esc(top.nome)}</strong> <span class="pih-dim">${regiao(top.regiao)} · Nv ${num(top.nivel)}</span><br>
          <b>${top.capturasH.toFixed(1).replace('.', ',')} Catch</b> (${(top.chanceCapturaMedia * 100).toFixed(1).replace('.', ',')}%) · Ouro líq: ${sinalLiq}${curto(top.ouroLiquidoH)}/h (custo bolas: ${curto(top.custoBolasH)}/h) · ${num(top.kph)} abates/h${badge1Hit}</div>
        </div>`;
      } else {
        resumo = `<div class="pih-vao pih-melhor">
          <span class="pih-coroa">👑</span>
          <div><strong>${esc(top.nome)}</strong> <span class="pih-dim">${regiao(top.regiao)} · Nv ${num(top.nivel)}</span><br>
          ${curto(top.xpPokemonH)} XP/h do pokémon · ${curto(top.xpTreinadorH)} XP/h do treinador · ${curto(top.ouroH)} ouro/h · ${num(top.kph)} abates/h${top.melhorGolpe ? ` · ${esc(top.melhorGolpe.nome)}` : ''}${badge1Hit}</div>
        </div>`;
      }
    }

    return `${resumo}${sessaoHtml}
      <div class="pih-vao pih-lista"><table class="pih-tab">
        <thead><tr>${ths}</tr></thead>
        <tbody>${linhas.slice(0, mostrando).map((l, i) => linhaHtml(l, i, slugAtiva, sessao)).join('')}</tbody>
      </table>
      ${linhas.length > mostrando ? `<button type="button" class="pih-mais" data-acao="mais">mostrar mais (${linhas.length - mostrando})</button>` : ''}
      </div>
      <div class="pih-rodape">Dados do jogo ${jogo.versao ? `v${esc(jogo.versao)}` : 'no ar'} · ${r.linhas.length} de ${r.total} hunts · cálculo em ${r.ms} ms · ranking com ondas cheias · geometria medida em ${PIH.geo?.huntsMedidas?.() ?? 0} hunts (≈ = padrão · ● = você já caçou aqui, passe o mouse)${r.aoe ? ` · TM AoE: ${r.aoe.alvosPorGolpe.toFixed(1).replace('.', ',')} alvos/golpe (${r.aoe.calibradoEm ? `calibrado em ${r.aoe.calibradoEm} hunt${r.aoe.calibradoEm > 1 ? 's' : ''} suas` : 'padrão, até você caçar 10+ min com ele'})` : ''}</div>`;
  }

  async function desenhar() {
    if (!painel) return;
    const pk = pkAtivo();
    if (!welcome || !eu) {
      painel.innerHTML = `${cabecalho(pk)}<div class="pih-carga">Esperando o jogo conectar…</div>`;
      ligarEventos();
      return;
    }
    if (!pk) {
      painel.innerHTML = `${cabecalho(null)}<div class="pih-erro">Coloque um pokémon em campo para ver onde caçar.</div>`;
      ligarEventos();
      return;
    }
    painel.innerHTML = `${cabecalho(pk)}${blocoStats(pk)}${controles()}<div class="pih-carga">Lendo o jogo…</div>`;
    ligarEventos();
    posicionarPainel();
    try {
      const jogo = await PIH.carregarJogo();
      if (!painel) return;
      const precoItem = new Map(jogo.precoItem);
      for (const i of welcome.itensNossos ?? []) {
        if (i?.name && Number(i.npcPrice) > 0) precoItem.set(i.name, Number(i.npcPrice));
      }
      const sessao = lerSessaoJogo(eu, precoItem, jogo.nomeItemPorId, jogo.precoItemPorId);
      const slugAtiva = obterHuntAtiva();
      const huntAtivaObj = (welcome?.hunts ?? []).find((h) => h.slug === slugAtiva);
      const nomeHuntAtiva = huntAtivaObj?.nome || slugAtiva;
      const historico = sessao ? obterHistoricoHunts(sessao, slugAtiva, nomeHuntAtiva) : [];
      sessaoAtual = sessao;
      historicoAtual = historico;

      // Auto-calibração com ritmo da sessão real quando atingir 10+ min e 50+ abates
      if (slugAtiva && sessao && sessao.minutos >= 10 && sessao.abates >= 50) {
        const chavePk = PIH.geo?.chaveDoPokemon(pk);
        if (chavePk && PIH.geo?.gravarRitmo) {
          PIH.geo.gravarRitmo(slugAtiva, chavePk, sessao.abatesH, Math.max(600, Math.round(sessao.ms / 1000)));
        }
      }

      const r = PIH.engine.analisar(pk, contexto(jogo, pk), prefs);
      painel.innerHTML = `${cabecalho(r.pokemon)}${blocoStats(r.pokemon)}${blocoBonus(r.bonusXp)}${blocoEta(r.pokemon, r, sessao, slugAtiva)}${controles()}${corpo(r, jogo, r.pokemon, sessao, slugAtiva, historico)}`;
      assinatura = assinaturaDe(pk);
    } catch (err) {
      console.error('[pokeidle-hunt]', err);
      if (!painel) return;
      painel.innerHTML = `${cabecalho(pk)}<div class="pih-erro">Não consegui calcular: ${esc(err.message)}</div>`;
    }
    ligarEventos();
    posicionarPainel();
  }

  function contexto(jogo, pk) {
    const chave = PIH.geo?.chaveDoPokemon(pk);
    const precoItem = new Map(jogo.precoItem);
    for (const i of welcome.itensNossos ?? []) {
      if (i?.name && Number(i.npcPrice) > 0) precoItem.set(i.name, Number(i.npcPrice));
    }
    return {
      mod: jogo.mod,
      especies: jogo.especies,
      precoItem,
      hunts: welcome.hunts ?? [],
      consts: {
        tabelaTipos: welcome.tabelaTipos,
        ampliacaoHunt: welcome.ampliacaoHunt,
        multHpSelvagem: welcome.multHpSelvagem,
        multDanoSelvagem: welcome.multDanoSelvagem,
        tiposBoost: welcome.tiposBoost,
        captura: welcome.captura,
        catalogoBolas: welcome.catalogoBolas,
      },
      eu,
      geo: (slug) => PIH.geo?.daHunt(slug) ?? null,
      ritmoMedido: (slug) => (chave ? PIH.geo?.ritmoMedido(slug, chave) ?? null : null),
    };
  }

  function ligarEventos() {
    if (!painel) return;
    painel.querySelector('[data-acao="fechar"]')?.addEventListener('click', fecharPainel);
    painel.querySelector('[data-acao="mais"]')?.addEventListener('click', () => { mostrando += POR_PAGINA; desenhar(); });
    painel.querySelector('[data-acao="salvar-marco"]')?.addEventListener('click', (ev) => {
      ev.preventDefault();
      salvarMarcoSessao(sessaoAtual);
    });
    painel.querySelector('[data-acao="limpar-marco"]')?.addEventListener('click', (ev) => {
      ev.preventDefault();
      limparMarcoSessao();
    });
    painel.querySelector('[data-acao="copiar-marco"]')?.addEventListener('click', (ev) => {
      ev.preventDefault();
      copiarMarcoSessao(sessaoAtual);
    });
    for (const btn of painel.querySelectorAll('[data-acao="copiar-hunt-item"]')) {
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        const idx = Number(btn.dataset.index);
        copiarHuntItem(historicoAtual, idx);
      });
    }
    painel.querySelector('[data-acao="copiar-chatgpt"]')?.addEventListener('click', (ev) => {
      ev.preventDefault();
      copiarRelatorioChatGpt();
    });
    const ajuda = painel.querySelector('[data-acao="ajuda-ouro"]');
    ajuda?.addEventListener('click', () => {
      const dica = painel.querySelector('#pih-dica-ouro');
      if (dica) {
        dica.hidden = !dica.hidden;
        ajuda.setAttribute('aria-expanded', String(!dica.hidden));
      }
    });
    const ajudaCap = painel.querySelector('[data-acao="ajuda-captura"]');
    ajudaCap?.addEventListener('click', () => {
      const dica = painel.querySelector('#pih-dica-captura');
      if (dica) {
        dica.hidden = !dica.hidden;
        ajudaCap.setAttribute('aria-expanded', String(!dica.hidden));
      }
    });
    for (const b of painel.querySelectorAll('[data-ordem]')) {
      b.addEventListener('click', () => { prefs.ordem = b.dataset.ordem; gravarJson(CHAVE_PREFS, prefs); desenhar(); });
    }
    for (const c of painel.querySelectorAll('[data-pref]')) {
      c.addEventListener('change', () => { prefs[c.dataset.pref] = c.checked; gravarJson(CHAVE_PREFS, prefs); desenhar(); });
    }
    for (const s of painel.querySelectorAll('[data-pref-select]')) {
      s.addEventListener('change', () => { prefs[s.dataset.prefSelect] = s.value; gravarJson(CHAVE_PREFS, prefs); desenhar(); });
    }
  }

  // Recalcula com o painel aberto só quando muda o que entra na conta (outro pokémon, nível
  // novo, refino, TM) — não a cada golpe recebido.
  const assinaturaDe = (pk) => (pk ? `${pk.id}|${pk.level}|${pk.tmElemental ?? ''}|${pk.tmAoe ?? ''}|${JSON.stringify(pk.stats)}` : '');

  // ---- ligação com o jogo ----------------------------------------------------------------
  function preaquecer() {
    const ocioso = root.requestIdleCallback ?? ((fn) => setTimeout(fn, 1500));
    ocioso(() => PIH.carregarJogo().catch((err) => console.warn('[pokeidle-hunt] pré-carga falhou', err)));
  }

  PIH.on('welcome', (m) => {
    welcome = m;
    preaquecer();
  });
  PIH.on('estado', (e) => {
    const primeiro = !eu;
    eu = e;
    posicionarBotao();
    if (primeiro) setTimeout(() => verificar(0), 800);
    if (painel && assinatura && assinaturaDe(pkAtivo()) !== assinatura) desenhar();
  });

  PIH.obterContextoAfk = async function() {
    try {
      const pk = pkAtivo();
      const slugAtiva = obterHuntAtiva();
      const jogo = await PIH.carregarJogo();
      const precoItem = new Map(jogo.precoItem);
      for (const i of welcome?.itensNossos ?? []) {
        if (i?.name && Number(i.npcPrice) > 0) precoItem.set(i.name, Number(i.npcPrice));
      }
      const sessao = lerSessaoJogo(eu, precoItem, jogo.nomeItemPorId, jogo.precoItemPorId);
      const r = (pk && PIH.engine?.analisar) ? PIH.engine.analisar(pk, contexto(jogo, pk), prefs) : null;
      return {
        ok: true,
        nick: eu?.nick || null,
        pk: pk ? {
          id: pk.id,
          nome: pk.nome,
          level: pk.level,
          hpMax: pk.stats?.hp || 100,
          stats: pk.stats,
          tmElemental: pk.tmElemental,
          tmAoe: pk.tmAoe,
        } : null,
        slugAtiva,
        sessao: sessao ? {
          minutos: sessao.minutos,
          abatesH: sessao.abatesH,
          xpPokemonH: sessao.xpPokemonH,
          xpTreinadorH: sessao.xpTreinadorH,
          goldH: sessao.goldH,
          capturasH: sessao.capturasH,
          bolasH: sessao.bolas?.totalCountH || 0,
          pocoesH: sessao.pocoes?.totalCountH || 0,
          custoBolasH: sessao.bolas?.custoH || 0,
          custoPocoesH: sessao.pocoes?.custoH || 0,
          lucroLiquidoH: sessao.lucroLiquidoH,
        } : null,
        hunts: (r?.linhas || []).map((l) => {
          const espNomes = (l.hunt?.especies || []).map((e) => {
            const esp = jogo.especies?.get(e.pokeId);
            return esp?.name || null;
          }).filter(Boolean);
          return {
            slug: l.slug,
            nome: l.nome,
            regiao: l.regiao,
            nivel: l.nivel,
            liberada: l.liberada,
            especies: espNomes,
            kph: l.kph,
            xpPokemonH: l.xpPokemonH,
            xpTreinadorH: l.xpTreinadorH,
            ouroH: l.ouroH,
            capturasH: l.capturasH,
            custoBolasH: l.custoBolasH,
            ouroLiquidoH: l.ouroLiquidoH,
            precoVendaNpcMedio: l.precoVendaNpcMedio || 0,
            ouroVendaCapturasH: l.ouroVendaCapturasH || 0,
            hitPct: l.hitPct,
            danoPorHit: Math.round((pk?.stats?.hp || 100) * (l.hitPct || 0)),
            mortesH: l.mortesH || 0,
            umHit: !!l.umHit,
            inviavel: !!l.inviavel,
          };
        }),
      };
    } catch (err) {
      return { ok: false, error: String(err?.message || err) };
    }
  };

  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', vigiarCard, { once: true });
  else vigiarCard();
})(globalThis);
