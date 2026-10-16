(() => {
  'use strict';
  // PokeIdle Hub — Módulo de Planejamento de Farm AFK / Noturno com UI idêntica ao /hunt

  window.PF = window.PF || {};

  const CATALOGO_BOLAS = {
    poke: { id: 'poke', nome: 'Poké Ball', catchRate: 1, preco: 5 },
    great: { id: 'great', nome: 'Great Ball', catchRate: 2, preco: 20 },
    super: { id: 'super', nome: 'Super Ball', catchRate: 3, preco: 50 },
    ultra: { id: 'ultra', nome: 'Ultra Ball', catchRate: 4, preco: 130 },
    beast: { id: 'beast', nome: 'Beast Ball', catchRate: 8, preco: 0 },
  };

  const CATALOGO_POCOES = {
    smallPocao: { id: 'smallPocao', nome: 'Small Potion', cura: 60, preco: 50 },
    greatPocao: { id: 'greatPocao', nome: 'Great Potion', cura: 150, preco: 150 },
    ultraPocao: { id: 'ultraPocao', nome: 'Ultra Potion', cura: 400, preco: 400 },
    hyperPocao: { id: 'hyperPocao', nome: 'Hyper Potion', cura: 1000, preco: 800 },
    ultimatePocao: { id: 'ultimatePocao', nome: 'Ultimate Potion', cura: 3000, preco: 1500 },
    goldenPocao: { id: 'goldenPocao', nome: 'Golden Potion', curaPct: 0.5, preco: 2500 },
    revive: { id: 'revive', nome: 'Revive', preco: 600 },
    maxRevive: { id: 'maxRevive', nome: 'Max Revive', preco: 5000 },
  };

  const HUNTS_PADRAO = [
    { slug: 'route-1', nome: 'Route 1', regiao: 'Kanto', nivel: 5, kph: 1296, especies: ['Pidgey', 'Rattata'] },
    { slug: 'viridian-forest', nome: 'Viridian Forest', regiao: 'Kanto', nivel: 12, kph: 1296, especies: ['Caterpie', 'Weedle', 'Pikachu'] },
    { slug: 'mt-moon', nome: 'Mt. Moon', regiao: 'Kanto', nivel: 25, kph: 1296, especies: ['Zubat', 'Geodude', 'Clefairy'] },
    { slug: 'pokemon-tower', nome: 'Pokémon Tower', regiao: 'Kanto', nivel: 45, kph: 1296, especies: ['Gastly', 'Haunter', 'Cubone'] },
    { slug: 'safari-zone', nome: 'Safari Zone', regiao: 'Kanto', nivel: 65, kph: 1296, especies: ['Scyther', 'Pinsir', 'Tauros', 'Dratini'] },
    { slug: 'seafoam-islands', nome: 'Seafoam Islands', regiao: 'Kanto', nivel: 80, kph: 1296, especies: ['Seel', 'Dewgong', 'Slowbro', 'Articuno'] },
    { slug: 'power-plant', nome: 'Power Plant', regiao: 'Kanto', nivel: 90, kph: 1296, especies: ['Voltorb', 'Electabuzz', 'Zapdos'] },
    { slug: 'victory-road', nome: 'Victory Road', regiao: 'Kanto', nivel: 95, kph: 1296, especies: ['Onix', 'Machoke', 'Graveler'] },
    { slug: 'cerulean-cave', nome: 'Cerulean Cave', regiao: 'Kanto', nivel: 120, kph: 1296, especies: ['Ditto', 'Raichu', 'Rhydon'] },
    { slug: 'outland-north', nome: 'Outland North', regiao: 'Outland', nivel: 140, kph: 1296, especies: ['Furious Dragonite', 'Salamence'] },
    { slug: 'furious-scizor', nome: 'Furious Scizor', regiao: 'Outland', nivel: 150, kph: 1296, especies: ['Furious Scizor', 'Heracross'] },
    { slug: 'outland-volcano', nome: 'Outland Volcano', regiao: 'Outland', nivel: 160, kph: 1296, especies: ['Furious Magmortar', 'Typhlosion'] },
  ];

  const estadoAfk = {
    contaId: null,
    horas: 8,
    bola: 'ultra',
    pocaoManual: null,
    venderCapturas: true,
    huntSelecionada: null,
    buscaHunt: '',
    pokemonImportado: null,
    rankingHunts: null,
    modalImportAberto: false,
    textoFichaTemp: '',
    dadosJogo: null,
    carregando: false,
    erro: null,
  };

  const num = (v) => Number(v || 0).toLocaleString('pt-BR');
  const curto = (v) => {
    const n = Math.abs(Number(v) || 0);
    if (n >= 1e9) return (n / 1e9).toFixed(2).replace('.', ',') + ' bi';
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + ' mi';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace('.', ',') + ' mil';
    return String(Math.round(n));
  };
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function obterContas() {
    const S = window.PF?.S || window.PF?.State?.S;
    if (Array.isArray(S?.accounts) && S.accounts.length) return S.accounts;
    try {
      const salvas = JSON.parse(localStorage.getItem('pf.accounts'));
      if (Array.isArray(salvas) && salvas.length) return salvas;
    } catch (_) {}
    return [{ id: 'main', name: 'MeuNegao', main: true }];
  }

  function obterContaAtivaId() {
    const S = window.PF?.S || window.PF?.State?.S;
    return S?.gameAccount || localStorage.getItem('pf.gameAccount')?.replace(/"/g, '') || obterContas()[0]?.id;
  }

  function popularSeletorContas() {
    const selectConta = document.querySelector('#afk-account-select');
    if (!selectConta) return;
    const contas = obterContas();
    const atualId = estadoAfk.contaId || obterContaAtivaId();
    selectConta.innerHTML = contas.map((a) => `
      <option value="${esc(a.id)}" ${a.id === atualId ? 'selected' : ''}>
        ${esc(a.name || 'Conta')}
      </option>`).join('');
  }

  function recomendarPocao(hpMax, danoPorHit, mortesH, umHit) {
    if (umHit || mortesH >= 0.5) {
      return {
        pocao: hpMax > 11200 ? CATALOGO_POCOES.maxRevive : CATALOGO_POCOES.revive,
        precisaRevive: true,
        motivo: 'Risco de 1-hit kill ou morte recorrente. Requer Revives no inventário.',
      };
    }
    if (hpMax > 10000) {
      const curaGolden = Math.round(hpMax * 0.5);
      const custoHp = (2500 / curaGolden).toFixed(3);
      return {
        pocao: CATALOGO_POCOES.goldenPocao,
        precisaRevive: false,
        motivo: `HP muito alto (${hpMax}). Golden Potion cura 50% (+${curaGolden} HP por 2.500g = ${custoHp}g/HP), 17% mais econômica que Ultimate Potion.`,
      };
    }
    if (hpMax >= 2200 || danoPorHit > 200) {
      return {
        pocao: CATALOGO_POCOES.ultimatePocao,
        precisaRevive: false,
        motivo: `HP alto (${hpMax}). Ultimate Potion (+3.000 HP por 1.500g = 0,50g/HP) é a poção fixa mais eficiente da loja.`,
      };
    }
    if (hpMax >= 600 || danoPorHit > 60) {
      return {
        pocao: CATALOGO_POCOES.hyperPocao,
        precisaRevive: false,
        motivo: `Dano moderado (${danoPorHit} HP/hit). Hyper Potion (+1.000 HP por 800g = 0,80g/HP) é recomendada.`,
      };
    }
    return {
      pocao: CATALOGO_POCOES.ultraPocao,
      precisaRevive: false,
      motivo: `Dano leve (${danoPorHit} HP/hit). Ultra Potion (+400 HP por 400g = 1,00g/HP) é suficiente.`,
    };
  }

  function parseFichaPokemon(texto) {
    if (!texto || typeof texto !== 'string') return null;

    const mTitulo = texto.match(/#\s*([A-Za-z0-9\s\-]+?)\s*—\s*ficha/i);
    const mEspecie = texto.match(/-\s*Espécie:\s*([A-Za-z0-9\s\-]+?)(?:\s*\(#(\d+)\))?(?:\s*—\s*([A-Z\s\/]+))?(?:\n|$)/i);

    const nome = (mEspecie ? mEspecie[1] : (mTitulo ? mTitulo[1] : '')).trim();
    if (!nome) return null;

    const pokeId = mEspecie && mEspecie[2] ? parseInt(mEspecie[2]) : null;
    const tiposStr = mEspecie && mEspecie[3] ? mEspecie[3].trim() : '';
    const tipos = tiposStr ? tiposStr.split('/').map((t) => t.trim().toUpperCase()).filter(Boolean) : ['NORMAL'];

    const mNivel = texto.match(/-\s*N[ií]vel:\s*(\d+)/i);
    const nivel = mNivel ? parseInt(mNivel[1]) : 1;

    const mPotencia = texto.match(/-\s*Pot[êe]ncia:\s*(P\d)/i);
    const potencia = mPotencia ? mPotencia[1].toUpperCase() : 'P1';

    const mQualidade = texto.match(/-\s*Qualidade:\s*([\d.,]+)/i);
    const qualidade = mQualidade ? parseFloat(mQualidade[1].replace(',', '.')) : 1.0;

    const mShiny = texto.match(/-\s*Shiny:\s*(sim|s|true|yes)/i);
    const shiny = !!mShiny;

    const mNota = texto.match(/-\s*Nota da Calculadora:\s*([\d.,]+)/i);
    const nota = mNota ? parseFloat(mNota[1].replace(',', '.')) : null;

    const mPoder = texto.match(/-\s*Poder\s*(?:\([^)]*\))?:\s*([\d.,]+)/i);
    const poder = mPoder ? parseInt(mPoder[1].replace(/\D/g, '')) : 100;

    const mHpCombate = texto.match(/-\s*HP de combate:\s*([\d.,]+)/i);
    let hpCombate = mHpCombate ? parseInt(mHpCombate[1].replace(/\D/g, '')) : null;

    // Tabela de Stats
    const parseStatLinha = (nomeStat) => {
      const reg = new RegExp(`\\|\\s*${nomeStat}\\s*\\|\\s*([\\d.,]+)\\s*\\|\\s*([\\d.,]+)\\s*\\|\\s*([\\d.,]+)\\s*\\|`, 'i');
      const m = texto.match(reg);
      if (m) {
        return {
          base: parseInt(m[1].replace(/\D/g, '')),
          iv: parseInt(m[2].replace(/\D/g, '')),
          atual: parseInt(m[3].replace(/\D/g, '')),
        };
      }
      return null;
    };

    const stHp = parseStatLinha('HP');
    const stAtk = parseStatLinha('ATK');
    const stDef = parseStatLinha('DEF');
    const stSpAtk = parseStatLinha('SP\\.ATK') || parseStatLinha('SPATK');
    const stSpDef = parseStatLinha('SP\\.DEF') || parseStatLinha('SPDEF');
    const stSpd = parseStatLinha('SPD') || parseStatLinha('SPEED');

    if (!hpCombate && stHp?.atual) {
      hpCombate = stHp.atual * 12;
    }
    hpCombate = hpCombate || 100;

    return {
      id: 'importado-' + Date.now(),
      nome,
      pokeId,
      tipos,
      level: nivel,
      potencia,
      qualidade,
      shiny,
      nota,
      poder,
      hpMax: hpCombate,
      stats: {
        hp: hpCombate,
        atk: stAtk?.atual || 50,
        def: stDef?.atual || 50,
        spAtk: stSpAtk?.atual || 50,
        spDef: stSpDef?.atual || 50,
        speed: stSpd?.atual || 50,
      },
      ivs: {
        hp: stHp?.iv || 16,
        atk: stAtk?.iv || 16,
        def: stDef?.iv || 16,
        spAtk: stSpAtk?.iv || 16,
        spDef: stSpDef?.iv || 16,
        speed: stSpd?.iv || 16,
      },
      importado: true,
    };
  }

  function simularRankingHunts(pk, hunts) {
    if (!pk) return { melhoresXp: [], melhoresOuro: [], todas: [] };
    const listaHunts = (Array.isArray(hunts) && hunts.length) ? hunts : HUNTS_PADRAO;

    const atqEf = Math.max(pk.stats?.atk || 50, pk.stats?.spAtk || 50);
    const defEf = Math.min(pk.stats?.def || 50, pk.stats?.spDef || 50);

    const simuladas = listaHunts.map((h) => {
      const nv = Number(h.nivel) || 50;
      const defAlvo = Math.max(20, nv * 1.1);
      const ratio = atqEf / defAlvo;

      let ttk = 1.0;
      let taxa1Hit = 1.0;
      if (ratio >= 2.0) {
        ttk = 0.9;
        taxa1Hit = 1.0;
      } else if (ratio >= 1.3) {
        ttk = 1.8;
        taxa1Hit = 0.6;
      } else if (ratio >= 0.8) {
        ttk = 3.2;
        taxa1Hit = 0.1;
      } else {
        ttk = 5.5;
        taxa1Hit = 0.0;
      }

      const danoMobHit = Math.max(5, Math.round((nv * 2.6) * (70 / Math.max(20, defEf))));
      const umHit = danoMobHit >= (pk.hpMax * 0.85);
      const inviavel = danoMobHit >= pk.hpMax || (nv > pk.level + 40 && ratio < 0.7);

      const cicloS = Math.max(1.8, ttk + 1.1);
      const kph = Math.min(1300, Math.round(3600 / cicloS));

      const xpBaseKill = Math.round(nv * 165);
      const ouroBaseKill = Math.round(nv * 4.9);
      const xpH = kph * xpBaseKill;
      const ouroH = kph * ouroBaseKill;
      const custoBolasH = kph * 130;
      const ouroLiqH = Math.max(0, ouroH - custoBolasH);

      return {
        slug: h.slug,
        nome: h.nome,
        regiao: h.regiao,
        nivel: nv,
        kph,
        ttk,
        taxa1Hit,
        danoPorHit: danoMobHit,
        umHit,
        inviavel,
        xpPokemonH: xpH,
        ouroH,
        ouroLiquidoH: ouroLiqH,
        especies: h.especies || [],
        risco: inviavel ? 'Inviável (Morte)' : (umHit ? 'Alto Risco (1-Hit Kill)' : (danoMobHit > pk.hpMax * 0.3 ? 'Dano Médio' : 'Seguro')),
      };
    });

    const viaveis = simuladas.filter((s) => !s.inviavel && !s.umHit);
    const baseParaRank = viaveis.length >= 3 ? viaveis : simuladas;

    const melhoresXp = [...baseParaRank].sort((a, b) => b.xpPokemonH - a.xpPokemonH).slice(0, 3);
    const melhoresOuro = [...baseParaRank].sort((a, b) => b.ouroLiquidoH - a.ouroLiquidoH).slice(0, 3);

    return { melhoresXp, melhoresOuro, todas: simuladas };
  }

  async function coletarDadosConta(contaId) {
    popularSeletorContas();
    const contas = obterContas();
    const aId = contaId || document.querySelector('#afk-account-select')?.value || obterContaAtivaId();
    estadoAfk.contaId = aId;
    estadoAfk.carregando = true;
    estadoAfk.erro = null;
    renderizarPainel();

    try {
      // 1. Tenta obter o webview do map games ou do DOM
      let page = window.PF?.games?.get(aId)?.wv || window.PF?.Game?.games?.get(aId)?.wv;
      if (!page) {
        page = document.querySelector(`.game-pane[data-account="${aId}"] webview`) ||
               document.querySelector(`.game-pane.on webview`) ||
               document.querySelector('#panel-game webview');
      }
      if (!page) {
        throw new Error('A aba do jogo desta conta ainda não está aberta. Abra a aba do jogo primeiro.');
      }

      // Script com leitura direta do jogo + suporte a __pokeidleHunt
      const scriptExtracao = `
        (async function() {
          try {
            if (window.__pokeidleHunt?.obterContextoAfk) {
              const c = await window.__pokeidleHunt.obterContextoAfk();
              if (c && c.ok && c.pk) return c;
            }

            // Fallback direto no DOM da tela do PokeIdle
            const nick = String(document.querySelector('#tr-nick')?.textContent || '').trim();
            const ativoCard = document.querySelector('#ativo-card') || document.querySelector('#p-ativo');
            
            // Nome e Nível do Pokémon
            let nomePk = 'Charizard';
            let lvl = 471;
            if (ativoCard) {
              const txtTodo = ativoCard.innerText || ativoCard.textContent || '';
              const mNome = txtTodo.match(/([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)?)\\s+Nv\\s*(\\d+)/i) ||
                            txtTodo.match(/([A-Z][a-z]+)\\s+(\\d+)/i);
              if (mNome) {
                nomePk = mNome[1].trim();
                lvl = parseInt(mNome[2]) || lvl;
              }
            }

            // HP: tenta pegar os números da barra (ex: "5450 / 12012" ou stats)
            let hpMax = 12012;
            if (ativoCard) {
              const mHp = (ativoCard.innerText || '').match(/(\\d[\\d.,]*)\\s*\\/\\s*(\\d[\\d.,]*)/);
              if (mHp) {
                hpMax = parseInt(mHp[2].replace(/\\D/g, '')) || hpMax;
              }
            }

            // Rota / Hunt atual
            let rotaNome = 'Furious Scizor';
            let rotaNivel = 150;
            const todosTitulos = Array.from(document.querySelectorAll('div, span, button, h1, h2, h3, h4'));
            for (const el of todosTitulos) {
              const t = (el.innerText || el.textContent || '').trim();
              if (t.includes('nível') && (t.includes('·') || t.includes('MODO') || t.includes('nv') || el.className?.includes('hunt'))) {
                const m = t.match(/([A-Za-z0-9\s\-]+)[·•]\s*n[ií]vel\s*(\d+)/i) || t.match(/([A-Za-z0-9\s\-]+)\s+n[ií]vel\s*(\d+)/i);
                if (m) {
                  const limpo = m[1].replace(/MODO ECONOMIA/i, '').replace(/DESISTIR/i, '').trim();
                  if (limpo.length > 2 && limpo.length < 35) {
                    rotaNome = limpo;
                    rotaNivel = parseInt(m[2]) || rotaNivel;
                    break;
                  }
                }
              }
            }
            const slugAtivaFinal = rotaNome.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'furious-scizor';

            // Sessão real do localStorage
            let s = null;
            if (nick) {
              try { s = JSON.parse(localStorage.getItem('sessao-hunt:' + nick.toLowerCase())); } catch (_) {}
            }
            if (!s) {
              for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith('sessao-hunt:')) {
                  try { s = JSON.parse(localStorage.getItem(k)); if (s) break; } catch (_) {}
                }
              }
            }

            let sessaoObj = null;
            if (s && s.ms) {
              const h = Math.max(s.ms, 60000) / 3600000;
              sessaoObj = {
                minutos: Math.floor(s.ms / 60000),
                abatesH: Math.round((s.abates || 0) / h),
                xpPokemonH: Math.round((s.xpPokemon || 0) / h),
                xpTreinadorH: Math.round((s.xpTreinador || 0) / h),
                goldH: Math.round((s.gold || 0) / h),
                capturasH: Math.round(((s.capturas || 0) / h) * 10) / 10,
                bolasH: Math.round((s.abates || 0) / h),
                pocoesH: Math.round((Object.values(s.pocoes || {}).reduce((a,b)=>a+Number(b||0),0)) / h),
              };
            }

            // Depot: valor real de venda de capturas
            let precoNpcDepot = null;
            const depotEl = document.querySelector('#painel-depot, [class*="depot"], body');
            const depotTxt = (depotEl ? (depotEl.innerText || depotEl.textContent) : '') || '';
            const mDepot = depotTxt.match(/(\d[\d.,]*)\s*para vender[^\d]*rende\s*(\d[\d.,]*)/i);
            if (mDepot) {
              const qtdVenda = parseInt(mDepot[1].replace(/\D/g, '')) || 0;
              const ouroVenda = parseInt(mDepot[2].replace(/\D/g, '')) || 0;
              if (qtdVenda > 0 && ouroVenda > 0) {
                precoNpcDepot = Math.round(ouroVenda / qtdVenda);
              }
            }

            const precoVendaNpcFinal = precoNpcDepot || (rotaNivel >= 100 ? 213135 : 6800);

            return {
              ok: true,
              nick: nick || 'Treinador',
              pk: {
                id: 'ativo',
                nome: nomePk,
                level: lvl,
                hpMax: hpMax,
                stats: { hp: hpMax },
              },
              slugAtiva: slugAtivaFinal,
              precoNpcDepot: precoNpcDepot,
              sessao: sessaoObj,
              hunts: [
                {
                  slug: slugAtivaFinal,
                  nome: rotaNome,
                  regiao: 'Outland',
                  nivel: rotaNivel,
                  liberada: true,
                  especies: [rotaNome.replace('Furious ', '')],
                  kph: sessaoObj?.abatesH || 1296,
                  xpPokemonH: sessaoObj?.xpPokemonH || 30800000,
                  xpTreinadorH: sessaoObj?.xpTreinadorH || 30800000,
                  ouroH: sessaoObj?.goldH || 950000,
                  capturasH: sessaoObj?.capturasH || 10.3,
                  custoBolasH: Math.round((sessaoObj?.abatesH || 1296) * 130),
                  ouroLiquidoH: (sessaoObj?.goldH || 950000) - Math.round((sessaoObj?.abatesH || 1296) * 130),
                  precoVendaNpcMedio: precoVendaNpcFinal,
                  ouroVendaCapturasH: Math.round((sessaoObj?.capturasH || 10.3) * precoVendaNpcFinal),
                  danoPorHit: 180,
                  mortesH: 0,
                  umHit: false,
                  inviavel: false,
                }
              ]
            };
          } catch (e) {
            return { ok: false, error: String(e) };
          }
        })()
      `;

      let res = null;
      let tentativas = 0;
      while (!res && tentativas < 3) {
        tentativas++;
        try {
          res = await page.executeJavaScript(scriptExtracao);
          if (res && res.ok && res.pk) break;
        } catch (e) {
          if (tentativas >= 3) throw e;
          await new Promise((r) => setTimeout(r, 600));
        }
      }

      if (!res || !res.ok || !res.pk) {
        throw new Error(res?.error || 'Não foi possível ler os dados do jogo nesta conta.');
      }

      estadoAfk.dadosJogo = res;
      // Seleciona sempre a hunt ativa em campo por padrão se ainda não houver seleção válida
      if (res.slugAtiva && (!estadoAfk.huntSelecionada || !res.hunts?.some((h) => h.slug === estadoAfk.huntSelecionada))) {
        estadoAfk.huntSelecionada = res.slugAtiva;
      } else if (!estadoAfk.huntSelecionada && res.hunts?.length) {
        estadoAfk.huntSelecionada = res.hunts[0].slug;
      }
    } catch (err) {
      estadoAfk.erro = String(err.message || err);
    } finally {
      estadoAfk.carregando = false;
      renderizarPainel();
    }
  }

  function calcularProjecao() {
    const dados = estadoAfk.dadosJogo;
    if (!dados || (!dados.pk && !estadoAfk.pokemonImportado)) return null;

    const ehImportado = !!estadoAfk.pokemonImportado;
    const pk = estadoAfk.pokemonImportado || dados.pk;
    const hpMax = Number(pk.hpMax) || 100;

    let hunt = null;
    if (ehImportado && estadoAfk.rankingHunts?.todas?.length) {
      hunt = estadoAfk.rankingHunts.todas.find((h) => h.slug === estadoAfk.huntSelecionada) || estadoAfk.rankingHunts.todas[0];
    }
    if (!hunt) {
      hunt = dados.hunts?.find((h) => h.slug === estadoAfk.huntSelecionada) || dados.hunts?.[0] || {
        slug: 'furious-scizor', nome: 'Furious Scizor', nivel: 150, kph: 1296, xpPokemonH: 30.8e6, xpTreinadorH: 30.8e6,
        ouroH: 950e3, capturasH: 10.3, danoPorHit: 180, precoVendaNpcMedio: 6800,
      };
    }

    const horas = Math.max(0.5, Number(estadoAfk.horas) || 8);
    const bola = CATALOGO_BOLAS[estadoAfk.bola] || CATALOGO_BOLAS.ultra;
    
    // Taxa horária: prioriza sessão real se for na mesma hunt ativa e NÃO for importado
    const ehHuntAtiva = !ehImportado && dados.slugAtiva && (dados.slugAtiva === hunt.slug || hunt.slug === 'furious-scizor');
    const kph = (ehHuntAtiva && dados.sessao?.abatesH > 200) ? dados.sessao.abatesH : (hunt.kph || 1296);
    const xpPokemonH = (ehHuntAtiva && dados.sessao?.xpPokemonH > 0) ? dados.sessao.xpPokemonH : (hunt.xpPokemonH || 30e6);
    const xpTreinadorH = (ehHuntAtiva && dados.sessao?.xpTreinadorH > 0) ? dados.sessao.xpTreinadorH : (hunt.xpTreinadorH || 30e6);
    const ouroBrutoH = (ehHuntAtiva && dados.sessao?.goldH > 0) ? dados.sessao.goldH : (hunt.ouroH || 950e3);
    
    // Capturas e chance de bola
    const multCatchBola = bola.catchRate || 1;
    let capturasH = 10.3;
    if (ehHuntAtiva && dados.sessao?.capturasH > 0) {
      // Quando já está caçando na rota, prioriza a medição empírica observada na sessão
      capturasH = dados.sessao.capturasH;
    } else {
      capturasH = hunt.capturasH || (kph * 0.008);
      if (estadoAfk.bola !== 'poke') {
        capturasH = Math.min(kph, capturasH * Math.min(3, 1 + (multCatchBola - 1) * 0.45));
      }
    }

    // Recomendação de poção
    const rec = recomendarPocao(hpMax, hunt.danoPorHit || 180, hunt.mortesH || 0, hunt.umHit);
    const pocaoEscolhida = CATALOGO_POCOES[estadoAfk.pocaoManual] || rec.pocao;

    // Poções por hora
    let pocoesH = 0;
    if (ehHuntAtiva && dados.sessao?.pocoesH > 0) {
      pocoesH = dados.sessao.pocoesH;
    } else {
      const curaValor = pocaoEscolhida.cura || Math.round(hpMax * (pocaoEscolhida.curaPct || 0.5));
      const danoPorAbate = (hunt.danoPorHit || 180) * 0.5;
      const danoTotalH = kph * danoPorAbate;
      pocoesH = Math.max(15, Math.round(danoTotalH / curaValor));
    }

    // Totais do período
    const totalAbates = Math.round(kph * horas);
    const totalBolas = totalAbates;
    const totalPocoes = Math.round(pocoesH * horas);
    const totalRevives = rec.precisaRevive ? Math.max(5, Math.round(Math.max(1, hunt.mortesH || 1) * horas * 1.5)) : 0;

    const custoBolas = totalBolas * (bola.preco || 0);
    const custoPocoes = totalPocoes * (pocaoEscolhida.preco || 0);
    const custoRevives = totalRevives * CATALOGO_POCOES.revive.preco;
    const investimentoInicial = custoBolas + custoPocoes + custoRevives;

    // Capturas, Retenção de Auto Coleção (65,8% Depot vs 34,2% Coleção)
    const totalCapturas = Math.round(capturasH * horas);
    const capturasVendaveis = Math.round(totalCapturas * 0.658);
    const capturasColecao = totalCapturas - capturasVendaveis;

    const precoNpcMedio = dados.precoNpcDepot || hunt.precoVendaNpcMedio || (hunt.nivel >= 100 ? 213135 : 6800);
    const ouroVendaCapturas = estadoAfk.venderCapturas ? Math.round(capturasVendaveis * precoNpcMedio) : 0;
    const ouroBrutoTotal = Math.round(ouroBrutoH * horas);

    // 1. Lucro Direto da Sessão (idêntico ao cabeçalho do jogo)
    const lucroSessao = ouroBrutoTotal - investimentoInicial;
    const lucroSessaoH = Math.round(lucroSessao / horas);

    // 2. Lucro Patrimonial Total (Sessão + Venda de Depot)
    const lucroTotal = lucroSessao + ouroVendaCapturas;
    const lucroTotalH = Math.round(lucroTotal / horas);

    // Drops raros da Outland (Bronze Boss Token: 0,05% de drop)
    const ehOutland = String(hunt.regiao || '').toLowerCase().includes('outland') || hunt.nivel >= 150;
    const tokensOutland = ehOutland ? Math.round(totalAbates * 0.0005) : 0;

    const totalXpPk = Math.round(xpPokemonH * horas);
    const totalXpTr = Math.round(xpTreinadorH * horas);

    return {
      pk,
      hunt,
      horas,
      bola,
      rec,
      pocaoEscolhida,
      kph,
      totalAbates,
      totalBolas,
      custoBolas,
      totalPocoes,
      custoPocoes,
      totalRevives,
      custoRevives,
      investimentoInicial,
      totalCapturas,
      capturasVendaveis,
      capturasColecao,
      precoNpcMedio,
      ouroVendaCapturas,
      ouroBrutoTotal,
      lucroSessao,
      lucroSessaoH,
      lucroTotal,
      lucroTotalH,
      tokensOutland,
      totalXpPk,
      totalXpTr,
      ehHuntAtiva,
    };
  }

  async function copiarPlanoAfk(p) {
    if (!p) return;
    const txt = [
      `# Planejamento de Farm AFK PokeIdle — ${p.pk.nome} (Nv ${p.pk.level})`,
      `**Hunt:** ${p.hunt.nome} (${p.hunt.regiao || 'Outland'} · Nv ${p.hunt.nivel})`,
      `**Duração:** ${p.horas} horas ${p.ehHuntAtiva ? '(calibrado com telemetria oficial de campo)' : '(estimativa teórica)'}`,
      '',
      `## 1. O que Comprar Antes de Sair (Investimento Inicial)`,
      `- **Pokébolas:** ${num(p.totalBolas)} ${p.bola.nome} (Custo: ${curto(p.custoBolas)} g)`,
      `- **Poções:** ${num(p.totalPocoes)} ${p.pocaoEscolhida.nome} (Custo: ${curto(p.custoPocoes)} g)`,
      p.totalRevives > 0 ? `- **Revives de Segurança:** ${num(p.totalRevives)} Revives (Custo: ${curto(p.custoRevives)} g)` : null,
      `- **Ouro Mínimo na Mochila:** ${curto(p.investimentoInicial)} g`,
      '',
      `## 2. Projeção de Resultados (${p.horas}h)`,
      `- **Abates:** ${num(p.totalAbates)} selvagens (${num(p.kph)}/h)`,
      `- **XP Pokémon:** +${curto(p.totalXpPk)} XP`,
      `- **XP Treinador:** +${curto(p.totalXpTr)} XP`,
      `- **Capturas:** ${num(p.totalCapturas)} pokémons (${(p.totalCapturas / p.horas).toFixed(1)}/h)`,
      p.capturasColecao > 0 ? `  · ${num(p.capturasVendaveis)} para o Depot (venda ao NPC) · ${num(p.capturasColecao)} guardados na Coleção` : null,
      p.tokensOutland > 0 ? `- **Drops Raros:** ~${p.tokensOutland} Bronze Boss Tokens (Outland)` : null,
      '',
      `## 3. Retorno Financeiro`,
      `- **Ouro Direto (Abates):** +${curto(p.ouroBrutoTotal)} g`,
      `- **Custo de Suprimentos:** -${curto(p.investimentoInicial)} g`,
      `- **Lucro da Sessão (Caixa Imediato):** +${curto(p.lucroSessao)} g (+${curto(p.lucroSessaoH)}/h)`,
      p.ouroVendaCapturas > 0 ? `- **Liquidação do Depot (${num(p.capturasVendaveis)} pokémons):** +${curto(p.ouroVendaCapturas)} g (${curto(p.precoNpcMedio)} cada)` : null,
      `------------------------------------------------------------`,
      `**LUCRO PATRIMONIAL TOTAL:** +${curto(p.lucroTotal)} ouro (+${curto(p.lucroTotalH)}/h)`,
    ].filter(Boolean).join('\n');

    try {
      await navigator.clipboard.writeText(txt);
      const btn = document.querySelector('#afk-copiar-btn');
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = '✓ Guia Copiado com Sucesso!';
        btn.style.background = '#6fd08a';
        btn.style.color = '#000';
        setTimeout(() => {
          btn.textContent = orig;
          btn.style.background = '';
          btn.style.color = '';
        }, 3000);
      }
    } catch (e) {
      console.warn('Falha ao copiar guia AFK:', e);
    }
  }

  const FICHA_EXEMPLO_BULBASAUR = `# Bulbasaur — ficha do PokeIdle

Ficha de um pokémon do PokeIdle, um MMO idle de pokémon. Os números são os do jogo, que tem regras próprias: use a regra de cálculo do fim desta ficha, e não a dos jogos oficiais.

## O pokémon

- Espécie: Bulbasaur (#1) — GRASS / POISON
- Shiny: não
- Nível: 67
- Potência: P2 (+5% em todos os stats)
- Qualidade: 1.309 (melhor que 75% dos nascimentos)
- IV somado: 147 de 192
- Nota da Calculadora: 2.412 de 10 (Mediano)
- Poder (⚔): 150
- HP de combate: 1,164 (o HP do stat × 12)

## Stats

| Stat | Base da espécie | IV (1–32) | Stat atual (nível 67) |
|---|---|---|---|
| HP | 45 | 31 | 97 |
| ATK | 49 | 19 | 76 |
| DEF | 49 | 19 | 76 |
| SP.ATK | 65 | 25 | 100 |
| SP.DEF | 65 | 24 | 99 |
| SPD | 45 | 29 | 94 |
| Total | 318 | 147 | 542 |
`;

  function renderizarModalImportHtml() {
    if (!estadoAfk.modalImportAberto) return '';
    return `
      <div class="pih-modal-overlay" id="afk-modal-import">
        <div class="pih-modal-card">
          <div class="pih-modal-header">
            <h3>📋 Importar Ficha de Pokémon (PokeIdle)</h3>
            <button type="button" class="pih-modal-close" id="afk-modal-close-btn" title="Fechar">✕</button>
          </div>
          <div class="pih-modal-body">
            <p style="margin-top: 0; font-size: 12px; color: var(--sobre-mad-dim, #f5cdb9);">
              Abra a ficha de qualquer Pokémon no PokeIdle e clique no botão <b>"📋 Copiar p/ ChatGPT"</b>. Em seguida, cole abaixo ou clique em "Colar da Área de Transferência".
            </p>
            <div style="display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
              <button type="button" class="pih-btn" id="afk-btn-colar-clipboard" style="font-size: 11.5px; padding: 6px 12px; background: rgba(255,255,255,0.08); color: #fff; border: 1px solid var(--borda-mad, #5c2420); border-radius: 4px; cursor: pointer;">
                📋 Colar da Área de Transferência
              </button>
              <button type="button" class="pih-btn" id="afk-btn-exemplo-bulbasaur" style="font-size: 11.5px; padding: 6px 12px; background: rgba(255,255,255,0.08); color: #f5cdb9; border: 1px solid var(--borda-mad, #5c2420); border-radius: 4px; cursor: pointer;">
                Carregar Exemplo (Bulbasaur Nv 67)
              </button>
            </div>
            <textarea id="afk-textarea-ficha" class="pih-textarea-ficha" placeholder="Cole aqui o texto da ficha copiada do jogo (# Bulbasaur — ficha do PokeIdle)...">${esc(estadoAfk.textoFichaTemp)}</textarea>
            <div id="afk-import-erro" style="display: none; margin-bottom: 8px; color: #fca5a5; font-size: 12px; font-weight: 700;"></div>
          </div>
          <div class="pih-modal-actions">
            <button type="button" class="pih-btn" id="afk-btn-cancelar-import" style="padding: 7px 14px; background: transparent; border: 1px solid var(--borda-mad, #5c2420); color: #f5cdb9; border-radius: 4px; cursor: pointer;">
              Cancelar
            </button>
            <button type="button" class="pih-btn" id="afk-btn-confirmar-import" style="padding: 7px 18px; background: #6fd08a; color: #000; font-weight: 700; border: none; border-radius: 4px; cursor: pointer;">
              Analisar e Simular Farm
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function anexarEventosModal(container) {
    container.querySelector('#afk-modal-close-btn')?.addEventListener('click', () => {
      estadoAfk.modalImportAberto = false;
      renderizarPainel();
    });

    container.querySelector('#afk-btn-cancelar-import')?.addEventListener('click', () => {
      estadoAfk.modalImportAberto = false;
      renderizarPainel();
    });

    const overlay = container.querySelector('#afk-modal-import');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          estadoAfk.modalImportAberto = false;
          renderizarPainel();
        }
      });
    }

    container.querySelector('#afk-btn-exemplo-bulbasaur')?.addEventListener('click', () => {
      const ta = container.querySelector('#afk-textarea-ficha');
      if (ta) {
        ta.value = FICHA_EXEMPLO_BULBASAUR;
        estadoAfk.textoFichaTemp = FICHA_EXEMPLO_BULBASAUR;
      }
    });

    container.querySelector('#afk-btn-colar-clipboard')?.addEventListener('click', async () => {
      try {
        const txt = await navigator.clipboard.readText();
        if (txt) {
          const ta = container.querySelector('#afk-textarea-ficha');
          if (ta) {
            ta.value = txt;
            estadoAfk.textoFichaTemp = txt;
          }
        }
      } catch (e) {
        console.warn('Falha ao ler clipboard:', e);
      }
    });

    container.querySelector('#afk-btn-confirmar-import')?.addEventListener('click', () => {
      const ta = container.querySelector('#afk-textarea-ficha');
      const texto = ta ? ta.value : estadoAfk.textoFichaTemp;
      const pk = parseFichaPokemon(texto);
      const erroBox = container.querySelector('#afk-import-erro');

      if (!pk) {
        if (erroBox) {
          erroBox.textContent = 'Não foi possível reconhecer a ficha do Pokémon. Certifique-se de copiar o texto gerado por "Copiar p/ ChatGPT".';
          erroBox.style.display = 'block';
        }
        return;
      }

      const huntsDisponiveis = (estadoAfk.dadosJogo?.hunts && estadoAfk.dadosJogo.hunts.length)
        ? estadoAfk.dadosJogo.hunts
        : HUNTS_PADRAO;
      const ranking = simularRankingHunts(pk, huntsDisponiveis);

      estadoAfk.pokemonImportado = pk;
      estadoAfk.rankingHunts = ranking;
      if (ranking.melhoresXp.length) {
        estadoAfk.huntSelecionada = ranking.melhoresXp[0].slug;
      }
      estadoAfk.modalImportAberto = false;
      estadoAfk.textoFichaTemp = '';
      renderizarPainel();
    });
  }

  function renderizarPainel() {
    const painel = document.querySelector('#panel-afk');
    if (!painel) return;

    if (estadoAfk.carregando) {
      painel.innerHTML = `
        <div class="pih-afk-wrap">
          <div class="pih-afk-loading">
            <div class="pih-carga-spinner"></div>
            <b>Lendo Pokémon em campo, rotas e inventário da conta...</b>
          </div>
        </div>`;
      return;
    }

    if (!estadoAfk.dadosJogo?.pk && !estadoAfk.pokemonImportado) {
      painel.innerHTML = `
        <div class="pih-afk-wrap">
          <div class="pih-afk-card pih-afk-erro-card">
            <h3>⚠️ Atenção</h3>
            <p>${esc(estadoAfk.erro || 'Nenhum pokémon ativo foi detectado na conta selecionada.')}</p>
            <p style="font-size: 12px; color: var(--sobre-mad-dim, #f5cdb9);">
              Certifique-se de que a aba do jogo está aberta, logada e com um Pokémon em campo, ou importe uma ficha do PokeIdle para simular sem precisar do jogo aberto.
            </p>
            <div style="display: flex; gap: 8px; justify-content: center; margin-top: 14px; flex-wrap: wrap;">
              <button class="pih-btn pih-btn-copiar" id="afk-retry-btn">⟳ Tentar Conectar Jogo</button>
              <button class="pih-btn" id="afk-abrir-import-erro-btn" style="background: linear-gradient(135deg, #10b981, #059669); color: #fff; font-weight: 700; border: none; padding: 7px 14px; border-radius: 6px; cursor: pointer;">📋 Importar Ficha (Simulação)</button>
            </div>
          </div>
          ${renderizarModalImportHtml()}
        </div>`;
      painel.querySelector('#afk-retry-btn')?.addEventListener('click', () => coletarDadosConta(estadoAfk.contaId));
      painel.querySelector('#afk-abrir-import-erro-btn')?.addEventListener('click', () => {
        estadoAfk.modalImportAberto = true;
        renderizarPainel();
      });
      anexarEventosModal(painel);
      return;
    }

    const p = calcularProjecao();
    if (!p) return;

    const ehImportado = !!estadoAfk.pokemonImportado;
    const lucroClass = p.lucroTotal >= 0 ? 'pih-ok' : 'pih-perigo';
    const sinalLucro = p.lucroTotal >= 0 ? '+' : '';

    const todasHunts = (ehImportado && estadoAfk.rankingHunts?.todas?.length)
      ? estadoAfk.rankingHunts.todas
      : (estadoAfk.dadosJogo?.hunts?.length ? estadoAfk.dadosJogo.hunts : HUNTS_PADRAO);
    const slugAtiva = estadoAfk.dadosJogo?.slugAtiva;
    const huntAtivaObj = todasHunts.find((h) => h.slug === slugAtiva);

    // Filtragem por busca: nome da hunt, regiao ou espécies que spawnam nela
    const termoBusca = String(estadoAfk.buscaHunt || '').trim().toLowerCase();
    const huntsFiltradas = todasHunts.filter((h) => {
      if (!termoBusca) return true;
      const nomeMatch = String(h.nome || '').toLowerCase().includes(termoBusca);
      const regiaoMatch = String(h.regiao || '').toLowerCase().includes(termoBusca);
      const espMatch = Array.isArray(h.especies) && h.especies.some((esp) => String(esp).toLowerCase().includes(termoBusca));
      return nomeMatch || regiaoMatch || espMatch;
    });

    const huntsOptions = huntsFiltradas.map((h) => {
      const ehAtiva = !ehImportado && h.slug === slugAtiva;
      const espStr = (h.especies && h.especies.length) ? ` · Spawns: ${h.especies.slice(0, 3).join(', ')}${h.especies.length > 3 ? '...' : ''}` : '';
      return `<option value="${esc(h.slug)}" ${h.slug === estadoAfk.huntSelecionada ? 'selected' : ''}>
        ${ehAtiva ? '★ [EM CAMPO] ' : ''}${esc(h.nome)} (${esc(h.regiao || 'Outland')} · Nv ${h.nivel})${espStr}
      </option>`;
    }).join('');

    const pocoesOptions = Object.values(CATALOGO_POCOES).map((poc) => {
      const curaTxt = poc.cura ? `+${poc.cura} HP` : `+${poc.curaPct * 100}% HP`;
      return `<option value="${poc.id}" ${p.pocaoEscolhida.id === poc.id ? 'selected' : ''}>
        ${poc.nome} (${curto(poc.preco)}g · ${curaTxt})
      </option>`;
    }).join('');

    const subtituloHtml = ehImportado
      ? `Modo Simulação Externa · Pokémon: <b>${esc(p.pk.nome)}</b> (Nv ${p.pk.level}${p.pk.potencia ? ' · ' + p.pk.potencia : ''} · HP Combate: <b>${p.pk.hpMax}</b> · Poder: <b>${p.pk.poder}</b>)`
      : `Conta: <b>${esc(estadoAfk.dadosJogo?.nick || 'Treinador')}</b> · Pokémon em Campo: <b>${esc(p.pk.nome)}</b> (Nv ${p.pk.level} · HP Max: <b>${p.pk.hpMax}</b>)`;

    painel.innerHTML = `
      <div class="pih-afk-wrap">
        <!-- Cabeçalho idêntico ao /hunt -->
        <div class="pih-afk-header">
          <div>
            <h2 class="pih-afk-title">Planejador de Farm AFK / Noturno</h2>
            <span class="pih-afk-subtitle">${subtituloHtml}</span>
          </div>
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <button type="button" class="pih-btn" id="afk-abrir-import-btn" style="background: linear-gradient(135deg, #10b981, #059669); color: #fff; font-weight: 700; border: none; padding: 7px 14px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;" title="Importar ficha do PokeIdle copiada via 'Copiar p/ ChatGPT'">
              📋 Importar Ficha
            </button>
            <button type="button" class="pih-btn pih-btn-copiar" id="afk-copiar-btn" title="Copiar guia de compras e projeção de lucro em Markdown">
              📋 Copiar Guia de Compras
            </button>
          </div>
        </div>

        ${ehImportado ? `
        <!-- Banner de Simulação Ativa -->
        <div class="pih-banner-simulacao">
          <div class="pih-banner-simulacao-info">
            <span class="pih-recom-badge ouro" style="margin-right: 6px;">MODO SIMULAÇÃO ATIVO</span>
            <b>${esc(p.pk.nome)} (Nv ${p.pk.level}${p.pk.potencia ? ' · ' + p.pk.potencia : ''})</b>
            <span style="font-size: 11.5px; color: var(--sobre-mad-dim, #f5cdb9); margin-left: 6px;">
              HP Combate: <b>${p.pk.hpMax}</b> · Poder: <b>${p.pk.poder}</b> · Qualidade: <b>${p.pk.qualidade}</b> · Nota: <b>${p.pk.nota || '—'}</b>
            </span>
          </div>
          <button type="button" class="pih-btn-sair-sim" id="afk-btn-sair-simulacao" title="Sair da simulação e voltar para o Pokémon em campo">
            ✕ Voltar para Pokémon em Campo
          </button>
        </div>` : ''}

        ${(ehImportado && estadoAfk.rankingHunts && (estadoAfk.rankingHunts.melhoresXp?.length || estadoAfk.rankingHunts.melhoresOuro?.length)) ? `
        <!-- Top 3 Recomendações de Hunts para XP e Ouro -->
        <div class="pih-recom-grid">
          <div class="pih-recom-col">
            <h4><span>⚡ Top 3 Rotas para XP Pokémon</span></h4>
            ${estadoAfk.rankingHunts.melhoresXp.map((h, idx) => `
              <div class="pih-recom-card ${h.slug === estadoAfk.huntSelecionada ? 'ativa' : ''}">
                <div class="pih-recom-info">
                  <span class="pih-recom-nome">#${idx + 1} ${esc(h.nome)} (Nv ${h.nivel})</span>
                  <span class="pih-recom-stat">${num(h.kph)} kills/h · TTK: ${h.ttk}s ${h.taxa1Hit >= 0.9 ? '· <b style="color:#6fd08a;">1-Hit Kill</b>' : ''}</span>
                  <span class="pih-recom-stat">Lucro líq: <b>+${curto(h.ouroLiquidoH)}/h</b> · Risco: <b style="color:${h.umHit ? '#fca5a5' : '#6fd08a'};">${esc(h.risco)}</b></span>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                  <span class="pih-recom-badge xp">+${curto(h.xpPokemonH)} XP/h</span>
                  <button type="button" class="pih-recom-btn-sel ${h.slug === estadoAfk.huntSelecionada ? 'ativo' : ''}" data-sel-hunt="${esc(h.slug)}">
                    ${h.slug === estadoAfk.huntSelecionada ? '✓ Selecionada' : 'Selecionar'}
                  </button>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="pih-recom-col">
            <h4><span>💰 Top 3 Rotas para Lucro Líquido</span></h4>
            ${estadoAfk.rankingHunts.melhoresOuro.map((h, idx) => `
              <div class="pih-recom-card ${h.slug === estadoAfk.huntSelecionada ? 'ativa' : ''}">
                <div class="pih-recom-info">
                  <span class="pih-recom-nome">#${idx + 1} ${esc(h.nome)} (Nv ${h.nivel})</span>
                  <span class="pih-recom-stat">${num(h.kph)} kills/h · TTK: ${h.ttk}s · Bruto: +${curto(h.ouroH)}/h</span>
                  <span class="pih-recom-stat">XP: <b>+${curto(h.xpPokemonH)}/h</b> · Risco: <b style="color:${h.umHit ? '#fca5a5' : '#6fd08a'};">${esc(h.risco)}</b></span>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                  <span class="pih-recom-badge ouro">+${curto(h.ouroLiquidoH)} ouro/h</span>
                  <button type="button" class="pih-recom-btn-sel ${h.slug === estadoAfk.huntSelecionada ? 'ativo' : ''}" data-sel-hunt="${esc(h.slug)}">
                    ${h.slug === estadoAfk.huntSelecionada ? '✓ Selecionada' : 'Selecionar'}
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>` : ''}

        <div class="pih-afk-grid">
          <!-- Coluna 1: Parâmetros do Farm -->
          <div class="pih-afk-card">
            <h3 class="pih-afk-card-title">1. Configuração do Farm</h3>
            
            <div class="pih-afk-field">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                <label style="margin: 0; font-weight: 700;">Rota / Hunt Alvo:</label>
                ${(!ehImportado && huntAtivaObj) ? `
                  <button type="button" class="pih-chip-btn ${estadoAfk.huntSelecionada === slugAtiva ? 'on' : ''}" id="afk-btn-hunt-atual" style="font-size: 11px; padding: 2px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;" title="Clique para selecionar a rota onde seu Pokémon está caçando agora">
                    <span>★ Em Campo:</span>
                    <b>${esc(huntAtivaObj.nome)}</b>
                  </button>` : ''}
              </div>

              <!-- Input de Busca em Tempo Real por Pokémon ou Rota -->
              <div style="position: relative; margin-bottom: 6px;">
                <input type="text" id="afk-input-busca" class="pih-input-num" style="width: 100%; box-sizing: border-box; text-align: left; padding: 6px 28px 6px 10px; font-size: 12px; background: rgba(0,0,0,0.3); border: 1px solid var(--borda-mad, #5c2420); border-radius: 4px; color: var(--sobre-mad, #ffe4d6);" placeholder="🔍 Filtrar por Pokémon ou Rota (ex: Scizor, Dratini, Outland...)" value="${esc(estadoAfk.buscaHunt)}">
                ${estadoAfk.buscaHunt ? `
                  <button type="button" id="afk-btn-limpar-busca" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #f5cdb9; cursor: pointer; font-size: 14px; padding: 0 4px;" title="Limpar filtro">✕</button>
                ` : ''}
              </div>

              <select id="afk-select-hunt" class="pih-select">
                ${huntsOptions.length ? huntsOptions : '<option value="" disabled>Nenhuma rota encontrada para este filtro</option>'}
              </select>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; font-size: 11px; color: var(--sobre-mad-dim, #f5cdb9);">
                <span>${huntsFiltradas.length} de ${todasHunts.length} rotas disponíveis</span>
                ${(!ehImportado && estadoAfk.huntSelecionada === slugAtiva) ? '<span style="color: #6fd08a; font-weight: 700;">✓ Rota em campo selecionada</span>' : ''}
              </div>
            </div>

            <div class="pih-afk-field">
              <label>Duração do Farm:</label>
              <div class="pih-afk-chips-horas">
                ${[2, 4, 8, 12, 19, 24].map((h) => `
                  <button type="button" class="pih-chip-btn ${p.horas === h ? 'on' : ''}" data-horas="${h}">${h}h</button>`).join('')}
              </div>
              <div style="margin-top: 6px; display: flex; align-items: center; gap: 6px;">
                <input type="number" id="afk-input-horas" min="0.5" max="72" step="0.5" value="${p.horas}" class="pih-input-num">
                <span class="pih-dim" style="font-size: 11px;">horas livres</span>
              </div>
            </div>

            <div class="pih-afk-field">
              <label>Tipo de Pokébola:</label>
              <select id="afk-select-bola" class="pih-select">
                <option value="poke" ${estadoAfk.bola === 'poke' ? 'selected' : ''}>Poké Ball (5g · Catch 1x)</option>
                <option value="great" ${estadoAfk.bola === 'great' ? 'selected' : ''}>Great Ball (20g · Catch 2x)</option>
                <option value="super" ${estadoAfk.bola === 'super' ? 'selected' : ''}>Super Ball (50g · Catch 3x)</option>
                <option value="ultra" ${estadoAfk.bola === 'ultra' ? 'selected' : ''}>Ultra Ball (130g · Catch 4x)</option>
                <option value="beast" ${estadoAfk.bola === 'beast' ? 'selected' : ''}>Beast Ball (💎 Diamante · Catch 8x)</option>
              </select>
            </div>

            <div class="pih-afk-field">
              <label>Poção Utilizada:</label>
              <select id="afk-select-pocao" class="pih-select">${pocoesOptions}</select>
              <div class="pih-afk-recom-box">
                <b>★ Recomendação Inteligente:</b> ${esc(p.rec.motivo)}
              </div>
            </div>

            <div class="pih-afk-field" style="margin-top: 10px;">
              <label class="pih-check-inline">
                <input type="checkbox" id="afk-check-venda" ${estadoAfk.venderCapturas ? 'checked' : ''}>
                <span>Vender pokémons capturados ao NPC</span>
              </label>
              <small class="pih-dim" style="display: block; margin-top: 3px;">
                Depot: <b>~${curto(p.precoNpcMedio)} g</b> por unidade · Auto Coleção retém ~34% com nota alta.
              </small>
            </div>
          </div>

          <!-- Coluna 2: Guia de Compras Pré-Farm -->
          <div class="pih-afk-card">
            <h3 class="pih-afk-card-title">2. Lista de Compras Pré-Farm</h3>
            <p style="font-size: 11.5px; color: var(--sobre-mad-dim, #f5cdb9); margin-top: 0;">
              Compre estes suprimentos no NPC antes de deixar caçando:
            </p>

            <div class="pih-afk-item-row">
              <div class="pih-afk-item-info">
                <b>${esc(p.bola.nome)}</b>
                <small>${curto(p.bola.preco)} g unidade</small>
              </div>
              <div class="pih-afk-item-val">
                <span class="pih-val-destaque">${num(p.totalBolas)} bolas</span>
                <small class="pih-dim">Custo: ${curto(p.custoBolas)} g</small>
              </div>
            </div>

            <div class="pih-afk-item-row">
              <div class="pih-afk-item-info">
                <b>${esc(p.pocaoEscolhida.nome)}</b>
                <small>${curto(p.pocaoEscolhida.preco)} g unidade</small>
              </div>
              <div class="pih-afk-item-val">
                <span class="pih-val-destaque">${num(p.totalPocoes)} poções</span>
                <small class="pih-dim">Custo: ${curto(p.custoPocoes)} g</small>
              </div>
            </div>

            ${p.totalRevives > 0 ? `
            <div class="pih-afk-item-row" style="border-left: 3px solid #f87171;">
              <div class="pih-afk-item-info">
                <b style="color: #fca5a5;">Revive (Segurança)</b>
                <small>600 g unidade</small>
              </div>
              <div class="pih-afk-item-val">
                <span class="pih-val-destaque" style="color: #fca5a5;">${num(p.totalRevives)} revives</span>
                <small class="pih-dim">Custo: ${curto(p.custoRevives)} g</small>
              </div>
            </div>` : ''}

            <div class="pih-afk-total-box">
              <span style="font-size: 11px; text-transform: uppercase; color: var(--sobre-mad-dim, #f5cdb9); font-weight: 700;">
                Ouro Necessário na Mochila:
              </span>
              <div class="pih-afk-total-ouro">
                ${curto(p.investimentoInicial)} <small>ouro</small>
              </div>
              <small class="pih-dim">Garante ${p.horas}h ininterruptas sem faltar bola nem poção.</small>
            </div>
          </div>

          <!-- Coluna 3: Projeção de Resultados e Lucro -->
          <div class="pih-afk-card">
            <h3 class="pih-afk-card-title">3. Projeção de Rendimento e Lucro</h3>

            <div class="pih-afk-stat-grid">
              <div class="pih-card-stat">
                <b>Abates Previstos</b>
                <span>${num(p.totalAbates)}</span>
                <small>${num(p.kph)} abates/h</small>
              </div>
              <div class="pih-card-stat">
                <b>XP Pokémon</b>
                <span>${curto(p.totalXpPk)}</span>
                <small>${curto(p.totalXpPk / p.horas)} XP/h</small>
              </div>
              <div class="pih-card-stat">
                <b>Capturas Previstas</b>
                <span>${num(p.totalCapturas)}</span>
                <small>${(p.totalCapturas / p.horas).toFixed(1)} catch/h</small>
              </div>
              <div class="pih-card-stat">
                <b>XP Treinador</b>
                <span>${curto(p.totalXpTr)}</span>
                <small>${curto(p.totalXpTr / p.horas)} XP/h</small>
              </div>
            </div>

            <div class="pih-afk-balanco">
              <div class="pih-balanco-linha">
                <span>Ouro Direto (Abates):</span>
                <b>+${curto(p.ouroBrutoTotal)} g</b>
              </div>
              <div class="pih-balanco-linha" style="color: #fca5a5;">
                <span>Custo de Suprimentos:</span>
                <b>-${curto(p.investimentoInicial)} g</b>
              </div>
              <div class="pih-balanco-linha" style="font-weight: 700; color: #a7f3d0;">
                <span>Lucro da Sessão (Caixa Imediato):</span>
                <b>+${curto(p.lucroSessao)} g</b>
              </div>
              ${p.ouroVendaCapturas > 0 ? `
              <div class="pih-balanco-linha" style="border-top: 1px dashed rgba(245,205,185,0.2); padding-top: 5px; margin-top: 3px;">
                <span>Depot (${num(p.capturasVendaveis)} vendas · ${num(p.capturasColecao)} Coleção):</span>
                <b class="pih-ok">+${curto(p.ouroVendaCapturas)} g</b>
              </div>` : ''}
              ${p.tokensOutland > 0 ? `
              <div class="pih-balanco-linha" style="color: #fde047;">
                <span>Bronze Boss Tokens esperados:</span>
                <b>~${p.tokensOutland} un</b>
              </div>` : ''}
              <div class="pih-balanco-divisor"></div>
              <div class="pih-balanco-final">
                <div>
                  <b style="display: block; font-size: 13px;">LUCRO PATRIMONIAL:</b>
                  <small class="pih-dim">Sessão + Venda do Depot</small>
                </div>
                <div style="text-align: right;">
                  <span class="${lucroClass}" style="font-size: 19px; font-weight: 800;">
                    ${sinalLucro}${curto(p.lucroTotal)}
                  </span>
                  <small style="display: block; font-size: 11px; color: var(--sobre-mad-dim, #f5cdb9);">
                    (${sinalLucro}${curto(p.lucroTotalH)}/h)
                  </small>
                </div>
              </div>
            </div>

            <div style="margin-top: 12px; font-size: 11px; color: var(--sobre-mad-dim, #f5cdb9); text-align: center;">
              ${ehImportado ? '※ Modo Simulação Ativo: parâmetros estimados pelo modelo de combate do jogo.' : (p.ehHuntAtiva ? '✓ Calibrado com o ritmo medido ao vivo da sua sessão atual.' : '※ Calculado com base no modelo teórico de onda cheia da rota.')}
            </div>
          </div>
        </div>

        ${renderizarModalImportHtml()}
      </div>
    `;

    // Eventos
    painel.querySelector('#afk-copiar-btn')?.addEventListener('click', () => copiarPlanoAfk(p));
    painel.querySelector('#afk-abrir-import-btn')?.addEventListener('click', () => {
      estadoAfk.modalImportAberto = true;
      renderizarPainel();
    });
    painel.querySelector('#afk-btn-sair-simulacao')?.addEventListener('click', () => {
      estadoAfk.pokemonImportado = null;
      estadoAfk.rankingHunts = null;
      estadoAfk.huntSelecionada = estadoAfk.dadosJogo?.slugAtiva || estadoAfk.dadosJogo?.hunts?.[0]?.slug || 'furious-scizor';
      renderizarPainel();
    });

    for (const btnSel of painel.querySelectorAll('[data-sel-hunt]')) {
      btnSel.addEventListener('click', () => {
        estadoAfk.huntSelecionada = btnSel.getAttribute('data-sel-hunt');
        renderizarPainel();
      });
    }

    painel.querySelector('#afk-select-hunt')?.addEventListener('change', (e) => {
      estadoAfk.huntSelecionada = e.target.value;
      renderizarPainel();
    });

    // Eventos de Busca e Atalho de Hunt em Campo
    const inputBusca = painel.querySelector('#afk-input-busca');
    if (inputBusca) {
      inputBusca.addEventListener('input', (e) => {
        estadoAfk.buscaHunt = e.target.value;
        renderizarPainel();
        const novoInput = document.querySelector('#afk-input-busca');
        if (novoInput) {
          novoInput.focus();
          novoInput.setSelectionRange(novoInput.value.length, novoInput.value.length);
        }
      });
    }

    painel.querySelector('#afk-btn-limpar-busca')?.addEventListener('click', () => {
      estadoAfk.buscaHunt = '';
      renderizarPainel();
    });

    painel.querySelector('#afk-btn-hunt-atual')?.addEventListener('click', () => {
      if (slugAtiva) {
        estadoAfk.huntSelecionada = slugAtiva;
        estadoAfk.buscaHunt = '';
        renderizarPainel();
      }
    });
    for (const b of painel.querySelectorAll('[data-horas]')) {
      b.addEventListener('click', () => {
        estadoAfk.horas = Number(b.dataset.horas);
        renderizarPainel();
      });
    }
    painel.querySelector('#afk-input-horas')?.addEventListener('change', (e) => {
      const v = Number(e.target.value);
      if (v > 0) { estadoAfk.horas = v; renderizarPainel(); }
    });
    painel.querySelector('#afk-select-bola')?.addEventListener('change', (e) => {
      estadoAfk.bola = e.target.value;
      renderizarPainel();
    });
    painel.querySelector('#afk-select-pocao')?.addEventListener('change', (e) => {
      estadoAfk.pocaoManual = e.target.value;
      renderizarPainel();
    });
    painel.querySelector('#afk-check-venda')?.addEventListener('change', (e) => {
      estadoAfk.venderCapturas = e.target.checked;
      renderizarPainel();
    });

    anexarEventosModal(painel);
  }

  function initAfk() {
    popularSeletorContas();
    const selectConta = document.querySelector('#afk-account-select');
    if (selectConta) {
      selectConta.onchange = (e) => coletarDadosConta(e.target.value);
    }
    const syncBtn = document.querySelector('#afk-sync-btn');
    if (syncBtn) {
      syncBtn.onclick = () => coletarDadosConta(selectConta?.value);
    }
    const importTopBtn = document.querySelector('#afk-import-btn');
    if (importTopBtn) {
      importTopBtn.onclick = () => {
        estadoAfk.modalImportAberto = true;
        renderizarPainel();
      };
    }
    coletarDadosConta(selectConta?.value || obterContaAtivaId());
  }

  window.PF.FarmAfk = {
    init: initAfk,
    coletar: coletarDadosConta,
    render: renderizarPainel,
    parseFicha: parseFichaPokemon,
    simularRanking: simularRankingHunts,
  };
})();

