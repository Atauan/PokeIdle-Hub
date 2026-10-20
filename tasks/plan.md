# Plano de implementação: isolamento dos dados de desenvolvimento

## Visão geral

Configurar toda execução não empacotada do Electron para usar um perfil local próprio, com caminhos fixos e validação antes de iniciar sessões. A execução normal preserva esse perfil; `dev:reset` adquire exclusividade, valida o perfil marcado como dev, remove somente seus dados e inicia vazio. O modo de desenvolvimento será identificado na interface e não consultará nem instalará atualizações de produção. A migração e os caminhos atuais do aplicativo empacotado precisam continuar preservados.

## Decisões de arquitetura

- Determinar o ambiente por `app.isPackaged`: Electron não empacotado sempre é dev, mesmo sem `NODE_ENV`; o pacote mantém produção.
- Usar uma raiz fixa por usuário (`PokeIdle Hub Dev` sob `appData`) e configurar `userData` e `sessionData` antes do bloqueio de instância, da sessão e do evento `ready`.
- Extrair validações e operações do perfil para um módulo pequeno, testável com diretórios temporários. A remoção exige raiz resolvida esperada, marcador válido, ausência de redirecionamento e exclusividade do processo.
- Fazer `dev:reset` chegar ao processo Electron como opção explícita; recusar a opção quando empacotado ou quando já existir um processo dev com o bloqueio.
- Preservar durante o reset somente os arquivos de bloqueio de instância que o Electron usa em `userData`; um marcador `resetting` impede a abertura do app após limpeza parcial.
- Recusar argumentos de linha de comando que redirecionem userData, cache, logs ou crash dumps.
- Não dar ao dev acesso de importação aos perfis legados. Manter `migrateLegacySessions()` apenas no fluxo empacotado.
- Preservar CommonJS, Electron e Node existentes. Não adicionar dependências.
- Confirmar nas referências oficiais do Electron o comportamento do bloqueio de instância e das opções de linha de comando antes de fechar a implementação; a especificação já registra a exigência de `sessionData` antes de `ready`.

## Ordem de tarefas

### Fase 1: Perfil seguro e início isolado

- [ ] Tarefa 1: Criar módulo do perfil dev e testes sintéticos de caminho, marcador e reset
- [ ] Tarefa 2: Configurar caminhos e bloqueio antes de iniciar o Electron; separar dev da migração legada

### Ponto de verificação: isolamento básico

- [ ] Testes do perfil usam somente diretórios temporários e cobrem reset permitido e recusas.
- [ ] A inicialização não empacotada define seus caminhos antes de solicitar bloqueio ou criar sessões.
- [ ] O dev não consulta existência, conteúdo ou lista dos diretórios legados.
- [ ] A migração de produção continua no fluxo empacotado.

### Fase 2: Comandos e experiência de desenvolvimento

- [ ] Tarefa 3: Adicionar `dev` e `dev:reset` e garantir reset exclusivo antes de sessões e janelas
- [ ] Tarefa 4: Identificar dev na interface e desativar atualizações de produção

### Ponto de verificação: fluxo de uso

- [ ] `dev` preserva o perfil; `dev:reset` limpa o perfil sintético marcado e inicia vazio.
- [ ] Produção não aceita reset; uma segunda instância dev não apaga os dados da primeira.
- [ ] Janelas, bandeja, sessões persistentes, popups de login e cockpit permanecem no perfil correspondente.
- [ ] A interface indica `DEV`; busca e instalação de atualizações de produção não são iniciadas.

### Fase 3: Compatibilidade e entrega

- [ ] Tarefa 5: Documentar comandos, confirmar compatibilidade de produção e revisar os critérios de aceite

### Ponto de verificação: conclusão

- [ ] Testes e verificações focadas aprovados, sem acessar perfis reais.
- [ ] Build Windows confirma inclusão de todo novo módulo nos arquivos empacotados.
- [ ] Documentação descreve alcance e perda local causada por `dev:reset`.
- [ ] Critérios da especificação atendidos ou limitações de validação listadas para o usuário.

## Riscos e mitigação

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| `userData`, `sessionData` ou o bloqueio serem configurados tarde | Uma sessão pode abrir no perfil de produção | Centralizar bootstrap antes do pedido de bloqueio e testar a ordem com stub do Electron. |
| Resolver um caminho por symlink/junction ou adotar pasta desconhecida | Reset poderia atingir dados que não pertencem ao dev | Validar caminho real, entradas redirecionadas e marcador antes de qualquer remoção; recusar diretório não vazio sem marcador. |
| Concorrência entre reset e instância dev ativa | Apagamento de arquivos em uso ou estado inconsistente | Obter primeiro o bloqueio independente de dev; rejeitar reset quando ele não for obtido. |
| Regressão na migração da instalação empacotada | Usuários de produção perderiam a migração existente | Preservar o fluxo atual no modo empacotado e validar build Windows sem tocar no perfil instalado. |
| Outros caminhos de armazenamento escaparem da raiz | Cookies, addon ou cockpit poderiam vazar entre ambientes | Auditar cada `session.fromPartition`, janela auxiliar, `app.getPath` e caminho de log/cache durante a implementação. |
| Atualizador ou argumentos serem aceitos em produção/dev indevidamente | Instalação de versão errada ou reset fora do alvo | Validar modo empacotado antes de tratar reset; bloquear checagem automática e ações de download/instalação em dev no processo principal. |

## Questões em aberto

- Confirmar o contrato oficial do Electron para `requestSingleInstanceLock` em conjunto com `app.setPath('userData')` e nomes de ambiente; ajustar a proposta se o bloqueio não ficar isolado como esperado.
- Windows é a plataforma inicial disponível. macOS/Linux precisam de execução própria antes de afirmar validação nelas.
- A especificação prevê pedido de autorização separado antes de executar `dev:reset` sobre perfil dev real; implementação e testes devem usar diretórios sintéticos.

## Arquivos prováveis

- `PokeIdle-Hub/main.js`
- `PokeIdle-Hub/package.json`
- `PokeIdle-Hub/<módulo pequeno de perfil dev>.js`
- `PokeIdle-Hub/tests/<testes do perfil e bootstrap>.test.js`
- `PokeIdle-Hub/renderer/index.html`, `PokeIdle-Hub/renderer/updates.js` e, somente se necessário, preload/estilos já existentes
- `PokeIdle-Hub/README.md`, `PokeIdle-Hub/CHANGELOG.md`, `PokeIdle-Hub/AGENTS.md`
- `PokeIdle-Hub/electron-builder.config.cjs` ou lista `build.files` em `package.json` se o novo módulo precisar ser incluído explicitamente
- `docs/changes/YYYY-MM-DD-HHMM--isolamento-dados-dev.md` (documentação local ignorada pelo Git conforme regra vigente)

## Critério de escopo

Não alterar a versão Swift, contas ou dados remotos, atualizações remotas do projeto, nem os dados reais de produção. Não executar reset real durante implementação ou validação sem autorização específica.
