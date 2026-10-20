# Especificação: isolamento de dados locais de desenvolvimento

- Data: 2026-10-19
- Status: implementada; validação manual do Electron pendente
- Escopo: aplicação Electron do PokeIdle Hub
- Origem: requisitos e respostas do usuário nesta conversa

## Objetivo

Executar a aplicação em desenvolvimento sem reutilizar, consultar, copiar, migrar ou alterar os dados locais da instalação de produção. Permitir escolher, a cada execução de teste, entre preservar o perfil de desenvolvimento e reiniciá-lo completamente vazio.

O isolamento solicitado é de armazenamento e comportamento da aplicação, não uma barreira de permissões do sistema operacional. O código executado pelo mesmo usuário do sistema continua tecnicamente capaz de acessar outros arquivos; impedir isso exigiria outro usuário ou sandbox e fica fora deste escopo.

## Decisões confirmadas pelo usuário

1. Dados locais de dev e produção devem permanecer separados.
2. Dev pode acessar os serviços reais do Pokeidle, Twitch e Kick, utilizando contas de teste.
3. Comandos separados controlam a escolha: `dev` preserva; `dev:reset` limpa exclusivamente dev.
4. O reset remove todos os dados locais de dev, incluindo logins e configurações dos addons.

## Premissas propostas

- A alteração abrange Electron em Windows, macOS e Linux. A validação inicial disponível é Windows; a versão Swift nativa não será alterada.
- O executável empacotado mantém a localização e o comportamento de produção existentes.
- A execução direta por `electron .`, inclusive pelo atual `npm start`, também deve ficar isolada; a proteção não pode depender de o desenvolvedor lembrar de uma flag.
- A escolha de não resetar é o padrão. Não haverá limpeza automática na inicialização normal nem pergunta recorrente ao abrir dev.

## Estado atual confirmado no código

- `PokeIdle-Hub/main.js` atribui o mesmo nome à aplicação sem separar o perfil local por ambiente.
- Não há configuração explícita de `userData` e `sessionData` para desenvolvimento antes da inicialização.
- O bloqueio de instância é solicitado no início do processo.
- `migrateLegacySessions()` é chamada em `app.whenReady()` e procura perfis legados para copiar Local Storage e partições.
- A partição principal é `persist:pokeidlehub`; contas extras usam partições persistentes próprias. Seus dados dependem da raiz de armazenamento da sessão.
- Arquivos como `market-samples.jsonl` e `update-notifications.json` usam `app.getPath('userData')`.
- O cockpit Sniper mantém configurações em Local Storage da interface, além do estado do addon no jogo.
- `PokeIdle-Hub/package.json` tem `start` e scripts de empacotamento, mas não define `dev`, `dev:reset` ou testes.

Não foram abertos diretórios reais de perfil nem executada uma inicialização do aplicativo para elaborar esta especificação.

## Comportamento requerido

### 1. Seleção do ambiente

- Execução não empacotada deve usar desenvolvimento automaticamente, inclusive se `NODE_ENV` estiver ausente ou incorretamente definido.
- Produção empacotada não pode ativar reset de dev nem aceitar opções que redirecionem sua execução para um perfil de desenvolvimento.
- Não oferecer opção de execução local que use, importe ou copie o perfil de produção.
- Nome da janela, identificação da bandeja e identidade de notificação de dev devem ser distinguíveis de produção. A identidade visual deve continuar indicando `DEV` após mudanças de aba.

### 2. Armazenamento

- Utilizar uma raiz fixa e exclusiva por usuário do sistema, como `PokeIdle Hub Dev` sob o diretório de dados de aplicações do sistema operacional. No Windows, a proposta é `%APPDATA%\PokeIdle Hub Dev`.
- Configurar a raiz de dados da aplicação e a de sessões antes do evento `ready`, da criação de qualquer sessão ou janela e da aquisição do bloqueio de instância.
- Sessão padrão, partições do jogo, Twitch/Kick, popups de login e cockpit devem usar armazenamento de dev quando a aplicação estiver em dev.
- Cookies, Local Storage, IndexedDB, service workers, caches, registros locais da aplicação, arquivos de diagnóstico e estado local de atualizações devem ficar separados dos equivalentes de produção.
- Os arquivos de log, dumps e caches controlados pela aplicação devem permanecer dentro da raiz de dev. Dados mantidos por componentes do sistema operacional precisam ser identificados na validação, sem prometer isolamento de armazenamento externo que a aplicação não controla.
- Não aceitar caminhos arbitrários por argumento ou variável de ambiente para localizar perfis ou selecionar o alvo de reset.
- Se houver redirecionamento por link simbólico, junction ou caminho incompatível com a raiz esperada, interromper a execução. Não seguir um caminho redirecionado para outro perfil.
- Falhas de configuração, permissão ou criação do diretório devem encerrar a inicialização com erro claro, antes de acessar perfis. Não recorrer ao diretório padrão de produção como fallback.

### 3. Migração e importação

- Em dev, não executar `migrateLegacySessions()` nem varrer perfis de produção, perfis PokeFarm ou pastas `data` de versões portáteis.
- O bloqueio da migração deve ocorrer antes de qualquer consulta ao conteúdo ou à existência desses perfis.
- Um perfil de dev vazio deve permanecer vazio, mesmo que existam dados locais de produção e legados.
- Preservar a migração existente da aplicação de produção, sem limpar, mover ou renomear seus dados.

### 4. Preservação e reset

- `dev` preserva todos os dados do perfil de desenvolvimento entre execuções.
- `dev:reset` representa a solicitação explícita de apagar o perfil local de desenvolvimento e iniciar uma nova sessão vazia. A documentação e a execução devem informar claramente a perda dos logins locais de teste.
- O reset inclui cookies, logins, contas cadastradas na interface, preferências, históricos, regras, dados dos addons, caches, logs e demais arquivos mantidos dentro da raiz de dev. Não apaga contas ou dados nos servidores remotos.
- Durante o reset, preservar somente os arquivos de bloqueio de instância em uso pelo Electron (`SingletonCookie`, `SingletonLock`, `SingletonSocket` e `lockfile`); esses arquivos de runtime não são dados de conta e removê-los quebraria a exclusividade enquanto a aplicação ainda está executando.
- O reset deve ser concluído antes da criação de sessões e janelas. A aquisição de exclusividade deve impedir corrida com outro processo dev.
- Se já houver um processo dev ativo, o reset deve ser recusado antes de apagar qualquer dado; não encaminhar a solicitação ao processo de produção.
- Validar o alvo resolvido, sua relação com a raiz permitida e um marcador de perfil de desenvolvimento antes da remoção. A presença do marcador não substitui a validação de caminho e de redirecionamentos.
- Na primeira execução, criar somente o perfil e o marcador de dev. Um diretório não vazio sem marcador válido não pode ser apagado nem adotado silenciosamente.
- Perfil inexistente é tratado como primeira execução. Erro de leitura ou de validação não deve ser tratado como ausência de perfil.
- Se a limpeza falhar ou for parcial, não abrir o aplicativo sobre dados parcialmente removidos; encerrar com erro claro para investigação.
- A solicitação de reset em uma execução de produção deve ser recusada sem consultar ou alterar seus dados.

### 5. Execução simultânea e efeitos externos

- Dev e produção devem ter bloqueios de instância independentes e poder funcionar simultaneamente.
- Uma segunda execução normal de dev pode focar o dev já aberto, sem afetar a janela de produção.
- Em dev, desabilitar a busca automática e a instalação de atualizações de produção; os controles devem comunicar a indisponibilidade no ambiente de desenvolvimento.
- Os serviços remotos continuam reais. Um login manual com uma conta real permite operações nessa conta; a aplicação não consegue inferir que toda credencial digitada pertence a uma conta de teste.
- Reset local não deve enviar comandos de exclusão ou alteração de conta às plataformas.

## Stack e estrutura

Manter Electron, JavaScript/CommonJS e npm existentes. Usar recursos nativos do Node.js para os testes necessários, sem adicionar dependências por esta especificação.

Áreas relacionadas para o planejamento posterior:

- `PokeIdle-Hub/main.js`: inicialização, caminhos, bloqueios, migração, janelas e atualização.
- `PokeIdle-Hub/package.json`: comandos de execução.
- `PokeIdle-Hub/renderer/`: somente os controles e rótulos necessários à identificação do ambiente e atualização indisponível em dev.
- Testes da inicialização e do reset, em localização a definir no plano, junto da aplicação Electron.
- `README.md`, `AGENTS.md`, `CHANGELOG.md` e `docs/changes/`: instruções de uso e resultado real da implementação.

O planejamento decidirá a menor divisão de arquivos necessária. Não criar camadas ou reescrever o renderer para atender a esta mudança.

## Comandos

Todos os comandos abaixo partem da raiz do repositório.

| Comando | Estado atual / contrato |
| --- | --- |
| `npm --prefix PokeIdle-Hub run` | Existente; lista os scripts oficiais. |
| `npm --prefix PokeIdle-Hub start` | Existente; após implementação deverá iniciar dev isolado e preservar seus dados. Não executado nesta etapa. |
| `npm --prefix PokeIdle-Hub run dev` | Proposto; iniciar dev preservando seus dados. |
| `npm --prefix PokeIdle-Hub run dev:reset` | Proposto; reset completo exclusivamente do perfil dev e inicialização vazia. |
| `node --check PokeIdle-Hub/main.js` | Existente como verificação de sintaxe; não substitui testes de isolamento. |
| `node --test` dentro de `PokeIdle-Hub/` | Proposto para os testes nativos a introduzir; a suíte ainda não existe. |
| `npm --prefix PokeIdle-Hub run dist:win` | Existente; build Windows quando necessário à validação da compatibilidade de produção. |

## Estilo de código

Preservar CommonJS, funções pequenas e validações explícitas. O código atual usa, por exemplo:

```js
const ACCOUNT_PARTITION = /^persist:pokeidlehub-acc-[a-z0-9-]{1,60}$/i;
```

Essa validação existente de nomes de partição não basta para autorizar remoção de diretórios. O reset precisa validar separadamente caminhos, propriedade do perfil, redirecionamentos e exclusividade. Não esconder erros de isolamento ou limpeza em `catch` vazio.

## Estratégia de testes

Os testes automatizados devem usar diretórios temporários sintéticos e instrumentação das operações de arquivos, sem acessar o perfil real do usuário.

| Cenário | Evidência necessária |
| --- | --- |
| Dev normal com perfil sintético de produção preenchido | Perfil dev próprio; nenhuma leitura, cópia, listagem ou escrita no perfil de produção. |
| Dados legados e variável de versão portátil presentes | Dev não consulta esses diretórios e não importa dados. |
| Reinício sem reset | Configurações, sessão e estado local de teste preservados. |
| Reset completo | Somente arquivos de dev removidos; perfil reiniciado vazio e dados sintéticos de produção intactos. |
| Perfil inexistente | Inicialização limpa com marcador válido. |
| Perfil não vazio sem marcador, caminho adulterado ou redirecionado | Operação recusada antes de remover arquivos ou criar sessões. |
| Falha de permissão ou remoção parcial | Inicialização abortada; sem fallback para outro perfil. |
| Produção recebendo opção de reset | Opção recusada; nenhuma remoção ou mudança de caminho de produção. |
| Dev já aberto e nova solicitação de reset | Reset recusado; dados e processo existentes preservados. |
| Identificação e atualização | `DEV` visível; instalação/busca automática de atualização de produção indisponível. |

Validar no Electron real, com contas de teste: persistência de login entre execuções dev, nova autenticação após reset, isolamento do cockpit e das partições e coexistência com a instalação de produção. Qualquer inspeção da produção deve respeitar a autorização do usuário e não copiar seus dados. Declarar explicitamente as plataformas e cenários não executados.

## Critérios de aceite

- [ ] Execução não empacotada sempre usa perfil exclusivo de dev, inclusive `npm start` e `electron .`.
- [ ] A seleção dos caminhos antecede sessões, janelas e bloqueio de instância.
- [ ] Nenhum fluxo de dev procura, importa ou usa arquivos dos perfis de produção ou legados.
- [ ] `dev` preserva dados entre execuções.
- [ ] `dev:reset` limpa integralmente apenas o perfil dev, incluindo logins e addons.
- [ ] Caminhos inválidos, redirecionamentos, concorrência e falhas de limpeza não provocam exclusão indevida nem fallback.
- [ ] Dev e produção funcionam simultaneamente com identidades e bloqueios separados.
- [ ] A aplicação empacotada mantém seus dados, migração e funcionamento de produção.
- [ ] Identificação `DEV` e atualização indisponível são verificáveis na interface.
- [ ] Testes automatizados demonstram o isolamento com perfis sintéticos, sem consultar perfis reais.
- [ ] A documentação distingue os comandos e explica o alcance destrutivo de `dev:reset`.

## Limites

- Sempre: preservar os dados de produção e interromper a execução se não for possível garantir o isolamento da aplicação.
- Pedir autorização específica antes de executar limpeza destrutiva de um perfil dev real durante a implementação ou validação. Aprovar esta especificação não autoriza executar o reset sobre dados já existentes.
- Nunca: usar perfil de produção como conveniência para dev, importar seus cookies ou copiar dados reais para fixtures.
- Não alterar a versão Swift, criar ambiente remoto de homologação, adicionar painel de reset, suporte a múltiplos perfis dev ou mecanismo de atualização automática de dev nesta entrega.

## Compatibilidade e rollback

A implementação não deverá migrar, renomear nem apagar dados da instalação de produção. A separação dos dados de dev deve permitir abandonar um build de desenvolvimento sem exigir recuperação de produção.

Reset completo de dev é irreversível sem backup externo; não há restauração automática dos logins apagados. Reverter código de isolamento não é motivo para voltar a executar dev com dados de produção: na presença de dúvida, manter a inicialização de dev bloqueada até restaurar a proteção.

## Implementação

O código e a validação automatizada estão registrados em `docs/changes/2026-10-19-1842--isolamento-dados-dev.md`. O plano e o estado das tarefas estão em `tasks/plan.md` e `tasks/todo.md`. Ainda falta validar a interface em execução real e persistência de login com contas de teste nas plataformas suportadas.

## Referências

- [Spec-Driven Development](.agents/skills/spec-driven-development/SKILL.md).
- [Diretórios e configuração do Electron](https://www.electronjs.org/docs/latest/api/app#appsetpathname-path): `sessionData` deve ser configurado antes de `ready`.
- [Processo principal atual](PokeIdle-Hub/main.js).
- [Scripts atuais](PokeIdle-Hub/package.json).
