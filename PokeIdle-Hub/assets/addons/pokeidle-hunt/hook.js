// Escuta o WebSocket do jogo sem mexer em nada.
//
// Roda no contexto da página (world MAIN), antes do cliente do jogo abrir o socket. Só
// acrescenta um ouvinte de mensagem: nada é enviado, nada é alterado, o jogo continua
// recebendo exatamente o que recebia. O que chega é repassado ao barramento da extensão
// (`PIH.on`), que as outras partes (catálogo, geometria, tela) assinam.
(function (root) {
  'use strict';
  const PIH = (root.__pokeidleHunt ??= {});
  if (PIH.hookInstalado) return;
  PIH.hookInstalado = true;

  // ---- barramento de eventos -------------------------------------------------------------
  const ouvintes = new Map();
  // O último de cada tipo fica guardado: quem assina depois (a tela carrega mais tarde que o
  // welcome, às vezes) recebe na hora em vez de esperar o próximo.
  const ultimo = new Map();
  const RETIDOS = new Set(['welcome', 'estado']);

  PIH.on = (tipo, fn) => {
    if (!ouvintes.has(tipo)) ouvintes.set(tipo, new Set());
    ouvintes.get(tipo).add(fn);
    if (ultimo.has(tipo)) {
      try { fn(ultimo.get(tipo)); } catch (err) { console.error('[pokeidle-hunt]', err); }
    }
    return () => ouvintes.get(tipo)?.delete(fn);
  };
  PIH.emit = (tipo, dado) => {
    if (RETIDOS.has(tipo)) ultimo.set(tipo, dado);
    for (const fn of ouvintes.get(tipo) ?? []) {
      try { fn(dado); } catch (err) { console.error('[pokeidle-hunt]', err); }
    }
  };

  // ---- o estado chega em delta ------------------------------------------------------------
  // O jogo manda o quadro inteiro no welcome e depois só o que mudou. A remontagem é a do
  // próprio jogo (`shared/estado-delta.mjs`), importada ao vivo; até ela chegar, os pacotes
  // ficam na fila para não perder nenhum delta.
  let mesclar = null;
  const fila = [];
  import(`${location.origin}/shared/estado-delta.mjs`)
    .then((m) => {
      mesclar = m.criarMescladorDeEstado();
      for (const parcial of fila.splice(0)) entregarEstado(parcial);
    })
    .catch((err) => console.error('[pokeidle-hunt] estado-delta indisponível', err));

  function entregarEstado(parcial) {
    if (!mesclar) {
      if (fila.length < 100) fila.push(parcial);
      return;
    }
    const eu = mesclar(parcial);
    if (eu) PIH.emit('estado', eu);
  }

  function aoReceber(ev) {
    if (typeof ev.data !== 'string') return;
    // Só interessam quatro tipos; os pacotes `campo` são os mais frequentes (vários por
    // segundo) e são pequenos. Tudo o mais passa direto sem parse.
    const cab = ev.data.slice(0, 40);
    let tipo = null;
    if (cab.includes('"t":"welcome"')) tipo = 'welcome';
    else if (cab.includes('"t":"estado"')) tipo = 'estado';
    else if (cab.includes('"t":"campo.init"')) tipo = 'campo.init';
    else if (cab.includes('"t":"campo"')) tipo = 'campo';
    if (!tipo) return;
    let m;
    try { m = JSON.parse(ev.data); } catch { return; }
    if (tipo === 'welcome') {
      // O estado do welcome é o quadro completo (`cheio`): zera o mesclador antes.
      PIH.emit('welcome', m);
      if (m.estado) entregarEstado({ ...m.estado, cheio: true });
    } else if (tipo === 'estado') {
      if (m.estado) entregarEstado(m.estado);
    } else {
      PIH.emit(tipo, m);
    }
  }

  // ---- o socket ---------------------------------------------------------------------------
  const Original = root.WebSocket;
  function WebSocketObservado(...args) {
    const ws = new Original(...args);
    try {
      const alvo = new URL(String(args[0]), location.href);
      if (alvo.host === location.host) {
        PIH.ws = ws;
        ws.addEventListener('message', aoReceber);
      }
    } catch { /* URL estranha: não é o socket do jogo */ }
    return ws;
  }
  WebSocketObservado.prototype = Original.prototype;
  for (const k of ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']) WebSocketObservado[k] = Original[k];
  root.WebSocket = WebSocketObservado;

  // ---- catálogo e compra segura de poções e pokébolas -------------------------------------
  const ITENS_COMPRAVEIS = {
    bolas: [
      { id: 1, kind: 'ball', nome: 'Poké Ball', preco: 5, catchRate: 1 },
      { id: 2, kind: 'ball', nome: 'Great Ball', preco: 20, catchRate: 2 },
      { id: 3, kind: 'ball', nome: 'Super Ball', preco: 50, catchRate: 3 },
      { id: 4, kind: 'ball', nome: 'Ultra Ball', preco: 130, catchRate: 4 },
    ],
    pocoes: [
      { id: 200, kind: 'item', nome: 'Small Potion', preco: 50, cura: '+60 HP' },
      { id: 201, kind: 'item', nome: 'Great Potion', preco: 150, cura: '+150 HP' },
      { id: 202, kind: 'item', nome: 'Ultra Potion', preco: 400, cura: '+400 HP' },
      { id: 203, kind: 'item', nome: 'Hyper Potion', preco: 800, cura: '+1.000 HP' },
      { id: 204, kind: 'item', nome: 'Ultimate Potion', preco: 1500, cura: '+3.000 HP' },
      { id: 70070, kind: 'item', nome: 'Golden Potion', preco: 2500, cura: '50% HP' },
      { id: 205, kind: 'item', nome: 'Revive', preco: 600, cura: '10% HP' },
      { id: 206, kind: 'item', nome: 'Max Revive', preco: 2500, cura: '100% HP' },
    ],
  };
  PIH.ITENS_COMPRAVEIS = ITENS_COMPRAVEIS;

  let ultimoDisparoCompra = 0;

  PIH.comprarItem = function (kind, id, qty = 1) {
    const itemNum = Number(id);
    const qtdNum = Math.max(1, Math.min(9999, Math.floor(Number(qty) || 1)));
    const lista = kind === 'ball' ? ITENS_COMPRAVEIS.bolas : ITENS_COMPRAVEIS.pocoes;
    const itemInfo = lista.find((x) => x.id === itemNum);

    if (!itemInfo) {
      const err = `Item ${kind} #${itemNum} não encontrado no catálogo do NPC.`;
      console.warn('[PokeIdle Hunt]', err);
      return { ok: false, error: err };
    }

    if (!PIH.ws || PIH.ws.readyState !== 1) {
      const err = 'WebSocket do jogo não conectado no momento.';
      console.warn('[PokeIdle Hunt]', err);
      return { ok: false, error: err };
    }

    // Cooldown de segurança (mínimo de 3,5 segundos entre compras)
    const agora = Date.now();
    if (agora - ultimoDisparoCompra < 3500) {
      const restam = ((3500 - (agora - ultimoDisparoCompra)) / 1000).toFixed(1);
      const err = `Aguarde ${restam}s para nova compra (anti-spam de segurança).`;
      return { ok: false, error: err };
    }

    const eu = ultimo.get('estado');
    const custoTotal = itemInfo.preco * qtdNum;
    if (eu && typeof eu.gold === 'number' && eu.gold < custoTotal) {
      const err = `Ouro insuficiente (${eu.gold.toLocaleString('pt-BR')}g disponíveis, precisa de ${custoTotal.toLocaleString('pt-BR')}g).`;
      console.warn('[PokeIdle Hunt]', err);
      return { ok: false, error: err };
    }

    ultimoDisparoCompra = agora;
    const payload = { t: 'shop.buy', kind: kind === 'ball' ? 'ball' : 'item', id: itemNum, qty: qtdNum };
    PIH.ws.send(JSON.stringify(payload));

    const msg = `${qtdNum}x ${itemInfo.nome} compradas por ${custoTotal.toLocaleString('pt-BR')}g.`;
    console.info('[PokeIdle Hunt]', msg);
    return { ok: true, item: itemNum, kind, nome: itemInfo.nome, qty: qtdNum, custo: custoTotal, msg };
  };

  PIH.testarCompraPocao = function (id = 200, qty = 1) {
    return PIH.comprarItem('item', id, qty);
  };
  PIH.testarCompraBola = function (id = 1, qty = 1) {
    return PIH.comprarItem('ball', id, qty);
  };
})(globalThis);
