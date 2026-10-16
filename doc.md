# Especificacao Tecnica e Guia de UI/UX do PokeIdle Hub

Documento de referencia para o design de interface (UI) e experiencia do usuario (UX).
Foco principal: Arquitetura do aplicativo e especificacao exaustiva da **Aba Lives** (controles, botoes, comportamentos, estados e fluxos).

---

## 1. Visao Geral do Aplicativo

### 1.1 O que e o PokeIdle Hub
O **PokeIdle Hub** e um aplicativo desktop em Electron desenvolvido para automatizar, monitorar e otimizar a jogabilidade do jogo idle para navegadores **Pokeidle** (pokeidle.net), permitindo simultaneamente:
- O gerenciamento de multiplas contas de jogo em paralelo (multi-accounting isolado por sessoes/cookies).
- A transmissao e monitoramento continuo de lives nas plataformas **Kick** e **Twitch**, garantindo ganho passivo de drops do jogo, moedas, itens e pontos de canal.
- Monitoramento de mercado (alertas e sniping no Community Market do Pokeidle).
- Planejamento matematico de rotas de captura e calculos de eficiencia (Farm AFK / Noturno).

### 1.2 O Problema que a UI/UX Atual Enfrenta
1. **Sobrecarga cognitiva no topo:** Atualmente, a tela divide a parte superior em quatro faixas verticais acumuladas:
   - Barra principal de abas de navegacao e contas.
   - Barra de acoes de canais e layout das lives.
   - Barra de automacao e monitoramento de status online/offline.
   - Barra de modos economicos (Twitch e Kick).
   Isso rouba espaco vertical precioso que deveria pertencer a exibicao dos videos e chats.
2. **Falta de agrupamento semantico:** Botoes de acao em lote (como "Silenciar todos", "Ocultar videos", "Seguir todos") estao misturados com seletores de visualizacao (colunas, qualidade) e inputs de canais.
3. **Cards de transmissao crus:** Os blocos de lives possuem controles minimos e alcas de redimensionamento discretas demais, dificultando a interacao tatil e visual.
4. **Distribuicao Multi-Contas:** Quando o usuario possui mais de uma conta do Pokeidle, o aplicativo gera colunas verticais correspondentes a cada conta. A integracao visual entre os logins de cada conta e suas respectivas lives precisa ser limpa, intuitiva e moderna.

---

## 2. Mapa Geral de Navegacao

O aplicativo conta com uma barra superior fixa (`#bar`) que comanda a alternancia de visoes:

| Identificador / Elemento | Nome / Rotulo | Papel no Sistema |
| :--- | :--- | :--- |
| `button[data-tab="lives"]` | **Lives** | Painel principal de transmissao e farming de canais Kick/Twitch. |
| `#account-tabs` (dinamico) | **Contas do Jogo** (`Conta 1`, `Conta 2`...) | Abas individuais para jogar Pokeidle em cada sessao isolada. |
| `#add-account` | **+ (Adicionar Conta)** | Cria uma nova conta com perfil de cookies isolado no Chromium. |
| `button[data-tab="alerts"]` | **Alertas** | Monitoramento de ofertas no mercado do Pokeidle (sniping de shinies/precos). |
| `button[data-tab="afk"]` | **Farm AFK** | Calculadora e simulador de rentabilidade, OHKO e rotas noturnas. |
| `#update-bar` (rodape) | **Atualizacoes** | Exibe versao atual e checagem de atualizacoes do aplicativo. |

---

## 3. Arquitetura Detalhada da Aba Lives

A Aba Lives e a area mais pesada e funcional do aplicativo. Ela e dividida logicamente em 4 zonas:
1. **Barra de Gestao de Canais e Grade (Header de Lives)**
2. **Barra de Automacao e Sincronizacao com o Jogo**
3. **Barra de Otimizacao e Modos Economicos de Hardware**
4. **Grade de Transmissoes (Tiles/Cards das Lives e Colunas por Conta)**

---

## 4. Catalogo de Botoes e Controles da Aba Lives

### 4.1 Zona 1: Barra de Gestao de Canais e Visualizacao

#### Seletor de Plataforma Padrao (`#target`)
- **Tipo:** Grupo segmentado de botoes (`Kick` | `Twitch`).
- **Comportamento:** Define a plataforma atribuida por padrao caso o usuario digite apenas o apelido do streamer no campo de texto (sem link completo).
- **Feedback visual:** O botao selecionado ganha destaque de fundo (`.on`).
- **Requisito para nova UI:** Segmented control compacto com icones e cores caracteristicas das marcas (Kick verde, Twitch roxo).

#### Campo de Entrada de Canais (`#channel-input`)
- **Tipo:** Campo de texto (`<input type="text">`).
- **Placeholder:** `Canal ou link (vários separados por vírgula)`.
- **Comportamento:** Aceita nomes simples (`xqc`), links completos (`kick.com/streamer`, `twitch.tv/streamer`) e listas separadas por virgula ou espaco. Ao pressionar `Enter`, aciona a inclusao imediata.

#### Botao Adicionar Canal (`#add-btn`)
- **Tipo:** Botao de acao primaria (`class="primary"`).
- **Comportamento:**
  - Extrai e higieniza os nomes inseridos.
  - Remove os canais da lista de canais ignorados (`S.ignoredGameChannels`).
  - Adiciona os canais na memoria persistente (`S.kick` ou `S.twitch`).
  - Forca o canal a abrir imediatamente como online na grade.
  - Limpa o campo de texto e agenda verificacao de status.

#### Seletor de Colunas (`#columns`)
- **Tipo:** Menu suspenso (`<select>`).
- **Opcoes:** `Auto (0)`, `1`, `2`, `3`, `4`, `5`, `6`, `7`, `8`.
- **Comportamento:** Define quantas colunas horizontais a grade deve calcular para distribuir os cards. Em modo `Auto`, calcula dinamicamente a melhor proporcao 16:9 baseada na largura e altura da janela.

#### Botao Reorganizar Layout (`#reset-layout`)
- **Tipo:** Botao de acao de icone (`▦`).
- **Tooltip:** `Reorganizar: volta todos os blocos para a grade (arraste o título para mover, bordas/canto para redimensionar)`.
- **Comportamento:** Limpa todas as coordenadas manuais personalizadas salvas pelo usuario (`S.frames = {}`) e reencaixa todos os blocos na distribuicao harmonica da grade.

#### Alternar Faixa de Chat (`#chat-toggle`)
- **Tipo:** Botao toggle de estado (`💬`).
- **Comportamento:** Liga ou desliga a exibicao da faixa inferior de 46px em cada card de live. Essa faixa e responsavel por exibir a area de resgate de pontos de canal da Twitch e bônus do Kick.
- **Feedback visual:** Botao recebe a classe `.on` quando ativo. Se desativado, o rodape do chat fica com altura `0px`.

#### Botao Ocultar/Mostrar Videos (`#toggle-video-view`)
- **Tipo:** Botao toggle de performance (`👁 Ocultar Vídeos` / `👁 Mostrar Vídeos`).
- **Comportamento:**
  - Oculta o elemento de video dos webviews sem fechar a conexao ou silenciar o audio.
  - Economiza drasticamente consumo de GPU (Video Decode) e renderizacao de tela, especialmente util quando o usuario roda 10 a 20 lives simultaneas.
  - Altera a altura dos cards na grade para um formato compacto tipo "barra de som".
- **Feedback visual:** O texto e o icone mudam entre "Ocultar Vídeos" e "Mostrar Vídeos", e o botao recebe a classe `.active`.

#### Seletor de Qualidade de Video (`#quality`)
- **Tipo:** Menu suspenso (`<select>`).
- **Opcoes:**
  - `Mínima (160p)` - Valor 160
  - `Baixa (360p)` - Valor 360
  - `Média (480p)` - Valor 480
  - `Automática` - Valor 0
- **Comportamento:** Injeta via script nas webviews a restricao de resolucao. Reduz uso de banda e uso de memoria RAM dos decodificadores de video.

#### Botao Silenciar Todos (`#mute-all`)
- **Tipo:** Botao de lote (`Silenciar todos`).
- **Comportamento:** Itera sobre todos os canais abertos e define o audio como mudo (`muted = true`). Aciona `setAudioMuted(true)` nas webviews do Electron. Garante que nao haja cacofonia sonora com multiplas lives abertas.

#### Botao Seguir Todos (`#follow-all`)
- **Tipo:** Botao de lote (`♥ Seguir Todos`).
- **Comportamento:**
  - Executa um loop sequencial com pausa de 250 ms entre cada transmissao aberta.
  - Na Twitch: checa se a conta ja segue o canal para nao dar unfollow; caso contrario, aciona o botao nativo de seguir.
  - Na Kick: dispara o botao de seguir no DOM ou envia requisicao autenticada na API da Kick com os cookies da particao da conta.
  - Feedback visual: O botao entra em estado de carregamento (`.loading`, texto `♥ Seguindo...` e desabilitado). Ao finalizar, emite uma notificacao toast informando quantos canais foram seguidos, quantos ja eram seguidos e se houve falha por ausencia de login.

#### Botao Recarregar Tudo (`#reload-all`)
- **Tipo:** Botao de acao de icone (`⟳`).
- **Comportamento:** Recarrega o player e o chat de todos os cards de lives abertos, alem de reiniciar a conexao das sessoes economicas.

#### Menu Limpar Canais (`.menu` com `.menu-btn` "Limpar ▾")
- **Tipo:** Menu dropdown suspenso.
- **Opcoes:**
  - `Kick`: Fecha e remove todas as lives da Kick da lista.
  - `Twitch`: Fecha e remove todas as lives da Twitch.
  - `Tudo`: Limpa todas as lives do aplicativo.
- **Comportamento:** Os canais removidos sao registrados em `S.ignoredGameChannels` para que o jogo Pokeidle nao os readicione automaticamente na proxima checagem.

---

### 4.2 Zona 2: Barra de Automacao e Sincronizacao

#### Checkbox Gerenciar Lives Automaticamente (`#auto-lives`)
- **Tipo:** Caixa de selecao com label (`Gerenciar lives automaticamente`).
- **Comportamento:** Quando marcado, ativa o motor em background que consulta periodicamente os canais parceiros do jogo Pokeidle e verifica quais estao transmitindo ao vivo.
  - Abre automaticamente as lives que entraram online.
  - Fecha automaticamente as lives que ficaram offline.
  - Quando desmarcado, preserva a grade atual estatica, sem abrir nem fechar nada sozinho.

#### Intervalo de Verificacao (`#live-poll`)
- **Tipo:** Menu suspenso (`<select>`).
- **Opcoes:** `30 s`, `1 min`, `2 min`, `5 min`.
- **Comportamento:** Determina a frequencia em que o cronometro do aplicativo dispara a verificacao de status das lives nas APIs.

#### Resumo de Status das Lives (`#live-summary`)
- **Tipo:** Texto de status (`<span role="status">`).
- **Comportamento dinamico:**
  - `Verificando canais…` (durante checagens de rede).
  - `Abra o Pokeidle para carregar os canais` (se nenhum canal foi descoberto pelo jogo ainda).
  - `X abertas · Y sem confirmação` (estado normal de operacao).
  - `Automático desligado · X abertas` (quando a chave automatica esta desligada).

#### Botao Verificar Agora (`#check-lives`)
- **Tipo:** Botao de acao manual (`Verificar agora`).
- **Comportamento:**
  - Faz uma leitura imediata dos canais de streamers recomendados na aba ativa do jogo Pokeidle (`window.__pfReadGameChannels()`).
  - Limpa a lista de canais ignorados pelo usuario.
  - Dispara requisicao em lote para as APIs da Kick e da Twitch para testar o status de transmissao.
  - Atualiza a grade com as lives online detectadas.
  - Fica desabilitado (`disabled`) enquanto uma checagem esta em andamento.

---

### 4.3 Zona 3: Barra de Otimizacao e Modos Economicos

#### Checkbox Twitch Economica (`#twitch-economy`)
- **Tipo:** Caixa de selecao (`Twitch econômica (experimental)`).
- **Comportamento:**
  - Destroi todos os webviews de video da Twitch na grade visual.
  - Cria um unico webview invisivel de chat compartilhado (`pf-economy=1`) conectado a ate 100 canais da Twitch simultaneamente.
  - Permite pontuar no jogo Pokeidle sem renderizar nenhum video ou chat pesado na tela.
  - Economiza centenas de megabytes de memoria RAM e quase 100% do consumo de GPU.

#### Checkbox Kick Economica (`#kick-economy`)
- **Tipo:** Caixa de selecao (`Kick econômica`).
- **Comportamento:**
  - Forca resolucao 160p no player do Kick.
  - Oculta as mensagens comuns de chat na faixa de pontos, mantendo apenas botoes e indicadores de bônus, reduzindo processamento da CPU.

#### Status da Twitch Economica (`#twitch-economy-status`)
- **Tipo:** Texto informativo em tempo real.
- **Exibicoes possiveis:**
  - `Aguardando canais online`
  - `Conectando aos chats das contas…`
  - `X/Y chats conectados · sem vídeo`
  - `Sem login — entre na Twitch e clique em Reconectar Twitch`

#### Botao Reconectar Twitch (`#twitch-economy-reload`)
- **Tipo:** Botao auxiliar visivel apenas quando a Twitch Economica esta ativa.
- **Comportamento:** Reinicia a sessao oculta do chat compartilhado caso ocorra desconexao ou apos o usuario fazer login na Twitch.

---

### 4.4 Zona 4: Grade de Transmissoes e Cards Individuais (Tiles)

#### Estrutura do Card de Live (`.tile`)
Cada transmissao aberta na grade e representada por um card independente com a seguinte estrutura:

1. **Cabecalho do Card (`.hdr`):**
   - **Alca de arraste (`data-drag="move"`):** O usuario clica e arrasta para posicionar a live livremente pela tela.
   - **Indicador de plataforma (`.dot`):** Circulo verde para Kick, roxo para Twitch.
   - **Nome do canal (`.name`):** Nome do streamer.
   - **Botao Silenciar Individual (`t.muteBtn`):** Alterna o som daquela live especifica (`🔇` mutado / `🔊` com som).
   - **Botao Recarregar (`⟳`):** Recarrega o player de video e a conexao de chat apenas deste canal.
   - **Botao Abrir no Edge (`🌐`):** Abre a pagina oficial do streamer no navegador padrao do sistema operacional.
   - **Botao Fechar/Remover (`✕`):** Fecha o bloco, remove da lista de canais monitorados e adiciona na lista de ignorados.

2. **Area do Video (`.player`):**
   - Webview com a transmissao do streamer.
   - Skeleton animado de carregamento enquanto o player inicializa.
   - Watchdog automatico: Se o video travar por 3 minutos consecutivos, o sistema recarrega a webview automaticamente.

3. **Faixa Compacta de Chat (`.chat`):**
   - Altura padrao de 46px.
   - Exibe a porcao inferior da pagina de chat onde residem os pontos do canal e o botao de resgate.
   - **Clique para expandir:** Ao clicar na faixa de chat, o sistema abre o chat completo em um modal flutuante centralizado de 440px com fundo escurecido (`#chat-backdrop`), permitindo resgatar recompensas manuais com facilidade.
   - **Fechar chat expandido:** Pressionando `Esc` ou clicando no fundo escuro (`#chat-backdrop`).

4. **Alcas de Redimensionamento:**
   - Borda direita (`.grip-r`): Redimensiona a largura do card.
   - Borda inferior (`.grip-b`): Redimensiona a altura do card.
   - Canto inferior direito (`.grip-c`): Redimensiona largura e altura simultaneamente na diagonal.

---

### 4.5 Zona Especial: Cabecalhos de Contas na Grade (`.account-col-header`)

Quando o usuario possui contas cadastradas no PokeIdle Hub:
- A tela organiza as lives em **colunas verticais dedicadas a cada conta**.
- No topo de cada coluna de lives, e exibido um cabecalho com:
  - Icone e nome da conta (`Conta 1`, `Conta Secundária`...).
  - **Badge de Status Twitch:**
    - Se conectada: Exibe `Twitch [OK]` em verde.
    - Se nao conectada: Exibe o botao `+ Twitch`. Ao clicar, abre um popup de login isolado na particao daquela conta.
  - **Badge de Status Kick:**
    - Se conectada: Exibe `Kick [OK]` em verde.
    - Se nao conectada: Exibe o botao `+ Kick` para login direto.
- Cada transmissao dentro daquela coluna roda na particao correspondente a conta (`persist:account_<id>`), garantindo que os drops e pontos sejam creditados na conta correta.

---

## 5. Dores Atuais de UI/UX e Oportunidades de Melhoria para o Stitch

O designer Stitch deve focar na resolucao dos seguintes problemas ergonômicos e visuais:

### 5.1 Reducao de Altura e Consolidacao de Barras
- **Problema:** Atualmente ha 4 barras empilhadas no topo da aplicacao (`#tabs`, `#bar-lives`, `#live-controls`, `#twitch-economy-controls`).
- **Proposta:**
  - Criar um **Header Principal Unificado** moderno.
  - Consolidar as configuracoes de automacao (`#auto-lives`, `#live-poll`) e os modos economicos em um painel lateral retratil (Drawer / Sidebar), em um menu popover suspenso de configuracoes ou em uma barra de ferramentas colapsavel.
  - Deixar na barra visivel apenas as acoes essenciais: input de adicionar canal, alternador de video/chat, botoes de lote ("Silenciar todos", "Seguir todos", "Recarregar") e o status resumido.

### 5.2 Agrupamento Logico de Botoes
- **Problema:** Botoes de acoes distintas estao misturados horizontalmente.
- **Proposta de Agrupamento:**
  1. **Grupo de Entrada:** Input de canal + Seletor Kick/Twitch + Botao Adicionar.
  2. **Grupo de Exibicao:** Seletor de Colunas + Toggle de Chat + Ocultar Videos + Qualidade.
  3. **Grupo de Acoes em Massa:** Silenciar Todos + Seguir Todos + Recarregar Tudo + Dropdown Limpar.
  4. **Status e Automacao:** Indicador visual (badge pulsante) de status online/offline com botao compacto de checagem manual.

### 5.3 Modernizacao dos Cards de Live (Tiles)
- **Problema:** Cabecalho dos cards escuro e generico, botoes pequenos e alcas de redimensionamento pouco perceptiveis.
- **Proposta:**
  - Cabecalho translucido com blur suave (glassmorphism discreto).
  - Badges de plataforma elegantes e legiveis.
  - Botoes de controle no card (mute, reload, edge, close) com iconografia moderna e tooltips claros.
  - Indicador visual sutil no canto do card demonstrando que ele pode ser redimensionado.
  - Estado quando os videos estao ocultos: transformar o card em um banner horizontal elegante com o nome do streamer, indicador de som, status de conexao e botao de chat.

### 5.4 Overlay do Chat Expandido
- **Problema:** O backdrop atual escurece a tela toda de forma bruta e sem animacao fluida.
- **Proposta:**
  - Modal com animacao suave de escala e fade-in.
  - Botao de fechar claro no topo do modal de chat, alem do atalho por `Esc`.
  - Destaque claro na area de resgate de pontos para o usuario nao se perder na pagina de chat.

### 5.5 Visual de Estado Vazio (Empty State)
- **Problema:** Quando nao ha lives abertas, a mensagem no meio da tela e simples e sem apelo visual.
- **Proposta:**
  - Ilustracao/icone estilizado.
  - Mensagem de orientacao explicando que os canais sao detectados automaticamente do Pokeidle ou que o usuario pode colar links acima.
  - Botoes de atalho rapido ("Abrir canais recomendados", "Checar agora").

---

## 6. Restricoes Tecnicas e Regras Inegociaveis da Implementacao

Ao desenhar a interface, o Stitch deve considerar as seguintes restricoes da arquitetura Electron do aplicativo:

1. **Webviews capturam eventos de mouse:** Quando o usuario clica e arrasta um card de live, se o cursor passar por cima de uma webview, o Electron entrega os eventos para dentro da pagina web externa, travando o arraste. Por isso, a interface ativa uma camada invisivel de protecao (`#shield`) durante movimentos de drag/resize.
2. **Espaco minimo para o chat da Twitch e Kick:** A faixa compacta precisa ter pelo menos 46px para mostrar o botao de bonus. O modal expandido precisa de pelo menos 400px de largura e 500px de altura para que os popups nativos de resgate de pontos das plataformas caibam na tela.
3. **Consumo de memoria com multiplos webviews:** Cada live e um processo isolado do Chromium. Qualquer elemento visual extra na interface deve ser leve em CSS (evitar animacoes pesadas continuas que concorram com a decodificacao de video).
4. **Isolamento de sessoes por conta:** As credenciais de cada conta sao estritamente separadas por particoes de sessao (`persist:account_<id>`). A interface nao pode misturar controles de login entre colunas diferentes.

---

## 7. Proximos Passos Recomendados

1. **Prototipacao da Aba Lives:** O Stitch desenhara as telas contemplando:
   - Estado padrao com 4 a 8 lives abertas em grade.
   - Estado com videos ocultos (modo compacto de audio/drops).
   - Estado multi-contas (com 2 a 3 colunas de contas e cabecalhos de conexao Twitch/Kick).
   - Painel/Drawer unificado de configuracoes e modos economicos.
   - Card individual de live detalhado e modal de chat expandido.
2. **Revisao e Validacao:** Alinhamento das propostas visuais com as funcoes existentes.
3. **Implementacao:** Ajuste modular nos arquivos `renderer/index.html`, `renderer/styles.css` e `renderer/src/modules/lives.js`.
