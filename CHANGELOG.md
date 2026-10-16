# Changelog

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

## [Não publicado]

### Alterado
- Auditoria completa e higienização integral do repositório: eliminação de todas as menções, caminhos e chaves legadas em arquivos de código, configurações, módulos Electron, scripts de release e documentação técnica; reescrita completa do README.md com autoria atribuída a Atauan Lima (@Atauan).
- Estruturação completa para distribuição pública do **PokeIdle Hub**: renomeada a pasta interna da aplicação para `PokeIdle-Hub`, configurados os instaladores do Electron (`PokeIdle-Hub-Setup-*.exe`, `PokeIdle-Hub-Portable-*.exe`, `.dmg`, `.AppImage`, `.deb`) e atualizados os scripts de CI (`.github/workflows/pokeidle-hub.yml`, `.github/scripts/release.cjs`, `build.sh`) para publicação automatizada de releases oficiais.
- Transição de marca do aplicativo para **PokeIdle Hub**, com atualização do `package.json`, títulos de janela e rodapé da interface.
- Removidos do rodapé os botões de apoio a terceiros, mantendo a identificação e o botão de atualização oficial do PokeIdle Hub.

### Segurança
- Redirecionado o mecanismo de verificação periódica exclusivamente para as releases oficiais do PokeIdle Hub (`Atauan/PokeIdle-Hub`), garantindo integridade e distribuição segura de novos patches.

### Adicionado
- Seção de "Créditos e Reconhecimentos" no `README.md` e na tela "Sobre o app", prestando tributo e link de agradecimento aos desenvolvedores do projeto original PokeFarm pelo trabalho pioneiro compartilhado com a comunidade.
- Sistema de atualização integrado oficial do PokeIdle Hub: verificação periódica de novas versões e botão "Verificar atualizações" no rodapé com modal nativo de release conectado diretamente ao repositório oficial (`Atauan/PokeIdle-Hub`), permitindo que os usuários descubram e baixem novas versões com um clique.
- Modo Mosaico (Split View Multi-Contas) na aba de Jogo, permitindo visualizar todas as contas ativas do Pokeidle simultaneamente em grade CSS responsiva (`⊞ Ver Todas` / `🗖 Conta Única`), com cartões identificadores contendo status online, botão de foco em tela cheia (`[🗖 Focar]`) e recarga individual de cada sessão, mantendo todas as contas farmando ao vivo sem recarregamento.
- Botão "♥ Seguir Todos" na barra de lives (`#bar-lives`), permitindo seguir em lote todos os canais de lives abertos no momento na Twitch e no Kick de forma pontual (sob demanda), com espaçamento anti-bloqueio entre requisições, detecção de contas não logadas e preservação de canais já seguidos.
- Sistema de favoritos por conta e botão individual de seguir nos cards de lives (com referência em `docs/changes/2026-10-16-1740--favoritos-e-botao-seguir-individual-lives.md`), permitindo favoritar canais (`[☆]`/`[★]`) com fixação automática no topo da coluna e seguir canais sob demanda com validação de login e feedback imediato (`+ Seguir` -> `✓ Seguido`).
- Rolagem vertical independente e fim do espremimento das transmissões na Aba Lives (com referência em `docs/changes/2026-10-16-1733--rolagem-vertical-e-fim-espremimento-lives.md`), garantindo proporções nativas saudáveis 16:9 para os vídeos (altura mínima de 270px com chat), cabeçalhos de contas fixados no topo e colunas roláveis individualmente por perfil.
- Especificação técnica e guia de UI/UX da Aba Lives e arquitetura do PokeIdle Hub adicionados em `doc.md` (com referência detalhada em `docs/changes/2026-10-16-1655--especificacao-ui-ux-aba-lives-stitch.md`), mapeando exaustivamente todos os controles, botões, estados e comportamentos para modernização visual pelo Stitch.
- Importação direta de fichas do PokeIdle copiadas via "📋 Copiar p/ ChatGPT", habilitando modo de simulação com ranking das Top 3 rotas para XP e Top 3 para Lucro Líquido, calibragem de consumo de suprimentos (poções ideais pelo HP específico e pokébolas) e suporte a contas offline ou sem pokémon em campo.

### Corrigido
- Remoção definitiva da máscara de carregamento (*skeleton loader*): desativada a renderização dos cartões cinzas vazios via `.skeleton { display: none !important }`, fazendo com que a tela do jogo e das transmissões carregue diretamente sem bloquear a visualização do usuário.
- Migração automática de sessões e contas: adicionada rotina de auto-migração na inicialização que transfere as sessões salvas de Twitch, Kick e contas do Pokeidle para as partições oficiais do PokeIdle Hub (`pokeidlehub` e `pokeidlehub-acc-<id>`), restaurando o acesso de todos os perfis e contas sem perda de login ou histórico.
- Compatibilidade de autenticação: liberadas as requisições de validação de dispositivo da Kick (FingerprintJS) e implementada a sanitização dos cabeçalhos Client Hints (sec-ch-ua) do Chromium, permitindo login na Kick e autenticação social com contas Google no Pokeidle sem o bloqueio de "app ou dispositivo não seguro"; ajustada a URL de login da Kick para abrir diretamente em kick.com/login.
- Pré-carregados os canais parceiros da Twitch e Kick no catálogo padrão de inicialização e ativado o gerenciamento automático por padrão na interface, disparando consulta imediata na abertura do app; ampliado o timeout da checagem de lives para 15s e silenciados avisos ruidosos do Chromium (WebBluetooth desativado e bloqueio de rastreadores Facebook e TURN).
- Corrigida a descoberta dinâmica de canais parceiros da Twitch e Kick no Pokeidle: expandidos os seletores do DOM para capturar `.tw-canal[href]`, `.kk-canal[href]`, `.tw-canais a[href]`, `.kk-canais a[href]` e links diretos, corrigindo o seletor antigo que buscava um ID inexistente (`#tw-corpo`), além de universalizar a leitura de payloads WebSocket e garantir persistência imediata em `receiveGameChannels` e `importGameChannels`.
- Restaurado o motor de lives 100% fiel à versão 3.0.0 (agnóstico de contas, com canais únicos e checagem de rede limpa), separando a responsabilidade de multi-contas estritamente para a camada visual de projeção: lives online são detectadas de forma centralizada e projetadas nas colunas dedicadas de cada conta ativa (`MeuNegao`, `Lthaus`, `MeuNegao1`) com favoritos independentes no topo, eliminando de vez canais duplicados e abertura indevida de transmissões offline.
- Restaurada no módulo de lives a consulta da Kick usada pela versão 3.0.0: uma requisição por canal, até quatro em paralelo. A consulta de status agora usa o `fetch` do processo principal, sem depender da sessão Chromium dos players. Os canais continuam deduplicados entre perfis e cada resultado é aplicado às tiles dos três perfis; Twitch segue consultada em lote.
- Restaurada a janela de timeout compatível com o fluxo antigo: consultas por status têm até 15 s por requisição e o ciclo da Twitch pode completar a busca do identificador público e a consulta GraphQL em sequência. Falhas da API agora aparecem no painel Diagnóstico.
- O gerenciamento automático de lives agora inicia ligado. O PokeIdle Hub salva as tiles abertas por plataforma e perfil e as restaura ao iniciar; “Recarregar Twitch”, quando não há player Twitch aberto, tenta descobrir e verificar canais antes de recarregar.
- Clique em um canal no Pokeidle agora abre imediatamente sua tile em Lives com status provisório “sem confirmação”; a checagem automática atualiza o estado depois.
- A verificação manual de canais agora consulta todas as contas Pokeidle carregadas e replica canais descobertos como tiles independentes por perfil; o watchdog só recarrega vídeo em reprodução cujo tempo ficou parado, e a opção "Manter abertas" preserva tiles já abertos após respostas offline. Adicionadas ações para desconectar somente os cookies Twitch/Kick do perfil atual, sem limpar a sessão do Pokeidle.
- Restaurada a regra original da versão 3.0.0 em `live-state.js` para que lives fechadas só abram mediante confirmação estrita de `'online'` da API, impedindo que canais offline da Kick (`cogu`, `luccatv`, `clovaobengalalol`) abram na tela, e ajustado `syncTiles()` para fechar de imediato transmissões confirmadas como offline mesmo com o anti-queda ligado.
- Removido o catálogo fixo pré-colocado (`DEFAULT_GAME_CHANNELS`), retornando à inicialização limpa da versão 3.0.0 baseada nos canais do jogo e do armazenamento local com redistribuição multi-contas.
- Incluído `surskity11` e os streamers parceiros oficiais da Twitch no catálogo de inicialização e aprimorado `addChannels()` e `addFromGame()` para replicar imediatamente qualquer live clicada ou adicionada para todas as contas cadastradas (`MeuNegao`, `Lthaus`, `MeuNegao1`), abrindo as transmissões em todas as colunas correspondentes.
- Eliminado o travamento na checagem de lives ("Verificando canais…") através de `Promise.race` com timeout de 2.5s na leitura de canais do jogo e bloco `finally` garantido para resetar o status e atualizar o resumo de lives abertas.
- Restaurada a abertura imediata de transmissões através de inicialização híbrida de catálogo em `state.js`, permitindo que o app abra as lives mesmo antes de o usuário realizar o login no Pokeidle, sincronizando e redistribuindo as transmissões nas colunas verticais dedicadas de cada conta cadastrada.
- Tornado o botão "⟳ Recarregar Twitch" permanentemente visível e funcional na barra secundária de lives, permitindo recarregar tanto o chat econômico quanto as transmissões de vídeo da Twitch a qualquer momento.
- Restaurada a abertura de canais com status `unknown` em `live-state.js` (regra essencial do commit histórico `11d7dc4`), permitindo que transmissões da Kick abram de imediato mesmo quando a API JSON for bloqueada pelo Cloudflare, e reduzido o timeout de rede para 4s com fallback em `Promise.race` de 5s, destravando o botão "Verificar agora".
- Implementada proteção Anti-Drop no sincronizador de tiles (`syncTiles`), impedindo que transmissões abertas sejam fechadas/derrubadas de forma espúria quando as APIs da Twitch ou Kick sofrerem instabilidade ou timeouts transitórios.
- Corrigido conflito de escopo léxico global entre os módulos do renderer com encapsulamento IIFE, restaurando a exibição imediata das abas de contas e botões de login, e adicionado foco explícito em primeiro plano na abertura da janela de autenticação.
- Restaurados os controles de lives e a verificação de conexões que haviam sido revertidos no `index.html` e `app.js`, incluindo o botão "👁 Ocultar Vídeos", badges de status de conexão no menu "Entrar ▾" da barra de lives e sincronização automática de login por partição de perfil.

### Adicionado
- Adicionado painel de diagnóstico de lives com catálogo acumulado, canais recebidos por cada conta Pokeidle nesta sessão, tiles distribuídas por perfil e status online/offline/sem confirmação por canal; o resumo agora separa tiles visíveis do total aberto quando há filtros ativos.
- Implementado sistema de favoritos (`⭐`) individual e independente por conta de usuário (`accountFavorites`), permitindo favoritar streamers especificamente para o perfil dono do tile sem afetar as demais contas.
- Implementado o layout Opção B (Colunas Dedicadas por Perfil): ao visualizar todas as contas com 2 ou mais perfis ativos, a tela se divide em colunas verticais exclusivas por conta (ex.: coluna esquerda para Conta 1, coluna direita para Conta 2) com os favoritos de cada conta fixados no topo de sua respectiva coluna.
- Adicionados controles de teto de lives por plataforma/conta (`Máx Twitch` e `Máx Kick`) e chave seletora "Manter abertas" na barra de ferramentas de lives.

### Alterado
- Modularizado o renderer do PokeIdle Hub no padrão Monólito Modular (`renderer/src/core/` e `renderer/src/modules/`), blindando o motor de Lives e Logins contra regressões colaterais e reduzindo o `app.js` de ~1.560 para ~260 linhas.
- Ajustada a interface do `/hunt for PokeIdle` para permitir rolagem vertical suave no painel (`overflow-y: auto`), permitindo visualizar todos os dados de consumíveis e histórico na aba Sessão.
- Integrada a resolução oficial de nomes e preços de poções e itens através do catálogo `items.json` e fallback dos IDs 201 a 206, exibindo nomes amigáveis em vez de IDs brutos como `Poção (201)`.
- Padronizada a nomenclatura de captura estritamente para `Catch` (removendo `Catch/h` ou `Capturas/h`).
- Reestruturada a ordenação no modo `Catch` para priorizar hunts do nível atual do Pokémon ativo em empates de taxa máxima de captura (em vez de rotas de Nv 1).

### Adicionado
- Implementada a aba "Sessão" no addon `/hunt for PokeIdle` com dashboard ao vivo de abates, XP, ouro bruto, custos de consumíveis, lucro líquido real, detalhamento de Pokébolas e Poções/Revives gastas, histórico cronológico de hunts visitadas e botão "Copiar para ChatGPT". Adicionado suporte a métricas em 3 janelas temporais (Tempo Real, 10 minutos e Última hora) contextualizadas para cada aba (XP/h, Ouro/h e Catch) no card "Hunt atual".
- Implementada a Fase 3 de telemetria de sessão real, auto-calibração de ritmo e ETA de level up no addon `/hunt for PokeIdle`, sincronizando com `sessao-hunt:nick` do localStorage, comparando dados reais com o modelo teórico em campo e projetando tempo para o próximo nível com base na fórmula cúbica oficial de XP.
- Implementada a Fase 2 de refinamento de dano probabilístico e breakpoints OHKO/2-Hit no addon `/hunt for PokeIdle`, modelando a dispersão real de dano (0,85 a 1,00) contra IVs de selvagens, com ajuste no TTK e selos visuais de 1-hit kill.
- Implementada a Fase 1 de análise de captura (Catch Analysis) e Ouro Líquido no addon `/hunt for PokeIdle`, com ordenação por capturas/h, seletor de pokébolas, custo de bolas/h e cálculo baseado na fórmula oficial da Poképédia.
- Ativação do login de Twitch e Kick por perfil Pokeidle com checagem real de cookies na partição, indicador de status nas conexões e alerta nos blocos de lives desautenticados.
- Suporte a partição de conta ativa no modo Twitch econômico (`accountPartition`), permitindo conexão e autenticação para perfis secundários.
- Sincronização automática de canais oficiais e manuais para todas as contas cadastradas (`S.accounts`), prevenindo abas secundárias zeradas.
- Botão "Ocultar Vídeos" na barra de lives para alívio imediato de GPU/CPU, ocultando os players e preservando áudio, websockets e a barra de resgate de pontos dos chats.
- Filtro de plataformas (Todas, Apenas Twitch, Apenas Kick) e limites máximos de lives ativas por plataforma com priorização de canais favoritos.
- Botão de favoritar streamer (`⭐`) fixando o canal no topo da grade de pareamento.
- Pareamento de lives lado a lado por streamer (Opção 1) no modo geral, agrupando transmissões do mesmo canal entre perfis com 2 colunas simétricas.
- Tags visuais coloridas de perfil no cabeçalho de cada bloco (`profile-badge`) e botão de seguir/inscrever (`btn-follow`) com script direto sem loops.
- Filtro rápido de contas na barra primária de lives (`#live-account-filter`) com contadores em tempo real.
- Trava de prevenção contra canais duplicados na mesma conta de usuário.
- Opção de auto-follow configurável para Twitch e Kick, seguindo o canal ao abrir a live para garantir contabilização dos pontos.
- Seletor de conta para o monitor de mercado Pokeidle (Desativado ou conta específica), evitando varreduras redundantes em múltiplas contas.
- Suporte a multi-contas Twitch e Kick vinculadas por perfil de jogo Pokeidle com sessões isoladas (`accountPartition`), permitindo conexões independentes por aba e resgate de pontos.
- Otimização de visualização e decodificação de vídeo: modo de exibição compacta (ocultando contêineres de vídeo e reduzindo blocos para tiras de chat) e tetos configuráveis de slots de vídeo ativos por perfil e globalmente.
- Multi-instância para o modo Twitch econômico: cada perfil ativo com canais online opera em sua própria sessão de chat compartilhado.
- Evidência pontual de execução com uma conta, três chats Twitch e duas lives Kick: valores observados e plano de diagnóstico por processo, sem otimizações aplicadas.
- Auditoria completa com 22 achados sobre RAM, CPU, lives, GPU, `/hunt`, segurança e distribuição, incluindo prioridades e critérios de validação. Melhorias propostas, sem alterações funcionais.
- Integração da extensão `/hunt for PokeIdle` (análise de rotas de caça por XP/h e Gold/h) com controle liga/desliga na interface do jogo.
- Análise inicial de desempenho e consolidação das diretrizes de arquitetura do projeto.

### Corrigido
- Corrigida a falha em tempo de execução `ctx.mod.analyser.efetividadeHunt is not a function` na extensão `/hunt for PokeIdle`, implementando cálculo autônomo com a ampliação oficial da hunt documentada na Poképédia e suporte resiliente aos módulos do jogo.
- Revertido throttling e descarte forçado de `<webview>` de vídeo da Fase 2 que quebrava o carregamento de streams, congelava os players no skeleton cinza e esmagava blocos em faixas de 72px com espaço preto abaixo.
- Restaurada grade 16:9 dinâmica completa (`autoColumns`) cobrindo toda a janela disponível, sem compressões forçadas ou bloqueios de layout.
- Removidas rotinas invasivas de auto-follow e hooks contínuos que causavam recargas e concorrência no player.
- Restaurada abertura imediata de todas as lives cadastradas sob a opção "Todas as contas", impedindo bloqueio indevido por flags de perfil inativo.
- Corrigida a captura de cliques em links de streamers oficiais dentro da modal de Bônus Twitch do Pokeidle, abrindo a live na grade imediatamente com confirmação em toast.
- Corrigido o início da interface com classe ativa estática em `panel-lives`, prevenindo abertura de tela preta e garantindo renderização instantânea.

### Alterado
- Otimização no Kick (Achado A01): cache do player e cancelamento do loop de busca do React Fiber assim que a qualidade 160p for ajustada, eliminando picos cíclicos de CPU a cada 3 segundos.
- Destruição real de elementos `<webview>` para canais excedentes do teto de vídeo (fila de espera), cessando a decodificação Chromium de vídeo e liberando processamento de GPU.
- Adicionada trava de limite de até 100 deltas na fila em memória do `/hunt` (Achado A02) durante carregamento assíncrono.
- Auditoria ampliada para 23 achados com limitação de sessões Twitch/Kick globais para múltiplas contas Pokeidle; plano de perfis isolados documentado, sem implementação ou alteração de logins.
- Diagnóstico da auditoria direcionado à página compartilhada Twitch após queda de CPU relatada ao reconectar, distinguindo 16% informados e 17,8% na captura; sem causa comprovada ou correção funcional.
- Auditoria atualizada com o cálculo do `/hunt` condicionado ao painel aberto e nova evidência de uso de GPU Video Decode; sem atribuir causa ao addon ou aplicar otimizações.
- Análise inicial de desempenho sinalizada como histórico: a auditoria atual distingue estimativas não medidas, otimizações já existentes e correções ainda pendentes, preservando o documento anterior.
