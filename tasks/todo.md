# Tarefas: isolamento dos dados de desenvolvimento

## Tarefa 1: Criar módulo do perfil dev e testes sintéticos de caminho, marcador e reset

**Descrição:** Encapsular a resolução da raiz fixa de dev, a criação/verificação do marcador e a operação de reset em funções testáveis. Cobrir caminhos esperados, diretórios sem marcador, redirecionamentos, perfil inexistente e falhas de remoção usando somente pastas temporárias sintéticas.

**Critérios de aceite:**
- [x] Perfil inexistente cria raiz e marcador de dev; pasta não vazia sem marcador válido é recusada.
- [x] Reset aceita somente a raiz esperada e marcada, recusando symlink/junction ou caminho fora dela antes de remover arquivos.
- [x] Falhas e remoção parcial retornam erro explícito e não escolhem outro caminho como fallback.

**Verificação:** `node --test` — 16 testes passaram; fixtures sintéticas criadas e removidas sob diretórios temporários.

**Dependências:** Nenhuma.

**Arquivos prováveis:**
- `PokeIdle-Hub/dev-profile.js`
- `PokeIdle-Hub/tests/dev-profile.test.js`

**Escopo estimado:** Pequeno (2 arquivos de implementação e 2 arquivos de teste).

## Tarefa 2: Configurar caminhos e bloqueio antes de iniciar o Electron; separar dev da migração legada

**Descrição:** Integrar o perfil ao bootstrap do processo principal. Definir dev pela execução não empacotada, configurar `userData` e `sessionData` antes do bloqueio/sessões, manter bloqueios independentes e executar `migrateLegacySessions()` somente na produção empacotada. Auditar partições, janelas e caminhos locais atuais.

**Critérios de aceite:**
- [x] Dev resolve a raiz fixa antes de pedir bloqueio, criar sessão ou janela, falhando fechado diante de erro.
- [x] Nenhum caminho dev consulta perfis PokeFarm, diretório portátil ou qualquer perfil de produção.
- [x] Produção preserva identidade, caminhos e migração atuais; dev e produção usam nomes e userData separados.

**Verificação:** Testes do bootstrap simulado; `node --check main.js`; revisão da ordem no fluxo `ready`. Build e diff finais pendentes.

**Dependências:** Tarefa 1.

**Arquivos prováveis:**
- `PokeIdle-Hub/main.js`
- `PokeIdle-Hub/tests/dev-bootstrap.test.js`

**Escopo estimado:** Pequeno (2 arquivos de implementação e 1 arquivo de testes).

## Tarefa 3: Adicionar `dev` e `dev:reset` e garantir reset exclusivo antes de sessões e janelas

**Descrição:** Expor comandos npm explícitos. O fluxo normal mantém persistência; o fluxo reset valida `app.isPackaged`, obtém o bloqueio exclusivo do perfil dev e limpa apenas o diretório marcado antes da criação de qualquer sessão ou janela. A opção de reset é recusada pela produção.

**Critérios de aceite:**
- [x] `npm run dev` inicia o modo dev preservando seus dados; `npm run dev:reset` solicita reset local completo antes da abertura.
- [x] Reset em produção, sem marcador, após redirecionamento, com instância dev ativa ou diante de falha de limpeza é recusado sem apagar outro perfil.
- [x] Logins e addons locais entram no reset por estarem sob a raiz de sessão; nenhuma operação é enviada às contas remotas.

**Verificação:** 16 testes sintéticos; `node --check`; `npm run` confirma `dev`, `dev:reset` e `test`.

**Dependências:** Tarefas 1 e 2.

**Arquivos prováveis:**
- `PokeIdle-Hub/package.json`
- `PokeIdle-Hub/main.js`
- `PokeIdle-Hub/tests/dev-bootstrap.test.js`

**Escopo estimado:** Pequeno (3 arquivos).

## Tarefa 4: Identificar dev na interface e desativar atualizações de produção

**Descrição:** Tornar o modo dev visível de forma persistente em janela e bandeja. Desativar no processo principal consulta, download e instalação de atualizações de produção e informar na interface que atualização está indisponível em dev.

**Critérios de aceite:**
- [x] Título e identidade da bandeja distinguem dev de produção mesmo após trocar de aba.
- [x] Dev não inicia busca automática ou timer de atualização nem aceita download/instalação de pacote de produção.
- [x] Controles de atualização da interface exibem a indisponibilidade sem disparar IPC de produção.

**Verificação:** `node --check` dos JS alterados e revisão dos handlers; interface não aberta para evitar acessar perfil real preexistente, validação manual pendente.

**Dependências:** Tarefa 2.

**Arquivos prováveis:**
- `PokeIdle-Hub/main.js`
- `PokeIdle-Hub/renderer/index.html`
- `PokeIdle-Hub/renderer/updates.js`
- `PokeIdle-Hub/preload.js` somente se for necessário expor o modo com segurança

**Escopo estimado:** Médio (3–4 arquivos).

## Tarefa 5: Documentar comandos, confirmar compatibilidade de produção e revisar os critérios de aceite

**Descrição:** Atualizar instruções para executar e resetar dev, registrar o impacto de apagar logins locais e documentar o que realmente foi validado. Revisar o pacote Windows para garantir que qualquer módulo novo está incluído e a produção manteve a migração.

**Critérios de aceite:**
- [x] README e changelog descrevem comandos e alcance local/irreversível do reset; AGENTS registra os comandos oficiais.
- [x] Build Windows inclui o módulo do perfil e mantém o fluxo de produção.
- [x] Documento `docs/changes` registra arquivos, impacto, validações, rollback e pendências reais.

**Verificação:** `npm --prefix PokeIdle-Hub run`; 16 testes passaram; `node --check` nos JS alterados; `npm --prefix PokeIdle-Hub run dist:win` completado; `dev-profile.js` confirmado no ASAR. Nenhum teste usa perfis reais.

**Dependências:** Tarefas 1–4.

**Arquivos prováveis:**
- `PokeIdle-Hub/README.md`
- `PokeIdle-Hub/CHANGELOG.md`
- `PokeIdle-Hub/AGENTS.md`
- `PokeIdle-Hub/package.json` ou `PokeIdle-Hub/electron-builder.config.cjs` somente se necessário
- `docs/changes/YYYY-MM-DD-HHMM--isolamento-dados-dev.md`

**Escopo estimado:** Médio (4–5 arquivos relevantes).

## Ponto de verificação após tarefas 1–2

- [x] Testes de caminhos, marcador, redirecionamento e bootstrap passaram em fixtures temporárias.
- [x] Dev não executa migração nem consulta diretórios legados.
- [x] Produção mantém sua localização e migração atuais.
- [x] Reset foi validado somente com fixtures sintéticas.

## Ponto de verificação após tarefas 3–4

- [x] Comandos normal/reset têm comportamento distinto e seguro.
- [x] Reset ativo concorrente e reset empacotado são recusados antes de alterações.
- [x] Identidade visual dev e bloqueio de atualização de produção estão definidos no processo e renderer.
- [x] O armazenamento de cockpit e partições segue `sessionData`; persistência real de login permanece pendente de validação manual.

## Ponto de verificação final

- [x] Critérios de aceite atendidos ou limitações de validação registradas.
- [x] Testes e build Windows executados sem acessar perfis reais.
- [x] Diff revisado e documentação atualizada.
- [x] Nenhum commit criado automaticamente.
