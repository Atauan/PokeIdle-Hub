# PokeIdle Hub

Central definitiva de gestão multi-contas, automação de transmissões, telemetria de hunt em tempo real e planejamento de farm AFK para o MMO **Pokeidle**.

Desenvolvido por **Atauan Lima** ([@Atauan](https://github.com/Atauan)).

---

## Recursos Principais

### 1. Modo Mosaico Multi-Contas (Split View Dinâmico)
- **Visualização Simultânea**: Monitore e interaja com todas as suas contas do jogo (`Conta 1`, `Conta 2`, etc.) ao mesmo tempo em uma grade responsiva inteligente.
- **Controle Rápido e Foco**: Alterne entre a grade completa (`⊞ Ver Todas`) e a tela cheia (`🗖 Conta Única`) com um clique, ou foque instantaneamente em qualquer conta usando o botão `[🗖 Focar]`.
- **Zero Interrupção**: Transição de layout puramente visual via CSS Grid; nenhuma sessão é recarregada ou derrubada ao alternar modos.
- **Sessões e Logins Isolados**: Cada conta roda em partições Electron independentes com persistência segura de cookies e credenciais.

### 2. Central de Transmissões Twitch & Kick (Drops 24/7)
- **Descoberta e Abertura Automática**: Monitora os canais parceiros oficiais da Twitch e Kick em tempo real, abrindo as transmissões ativas para coleta de pontos e drops.
- **Botão "♥ Seguir Todos"**: Ação sob demanda que segue em lote todos os canais de lives abertos no momento, utilizando espaçamento anti-bloqueio entre requisições e detecção automática de login.
- **Modo Econômico de Vídeo**: Opção de ocultar reproduções de vídeo para poupar 100% da GPU/CPU, mantendo a conexão do chat, presença e drops ativos.
- **Projeção em Colunas Verticais**: Distribuição visual dos canais associados a cada uma das suas contas cadastradas com controle de favoritos no topo.

### 3. Planejador AFK Noturno & Simulador Preditivo
- **Projeção de Rendimento**: Calcule com precisão matemática os resultados de sessões noturnas ou prolongadas (XP/hora, Moedas, Drops raros e Lucro Líquido descontando custos).
- **Importação Direta de Fichas**: Cole o relatório do seu Pokémon (copiado no jogo via *"📋 Copiar p/ ChatGPT"*) para simular o desempenho exato em qualquer rota.
- **Ranking das Melhores Rotas**: Sugestão instantânea do Top 3 de rotas para ganho máximo de XP e Top 3 para Lucro Líquido.
- **Dimensionamento de Suprimentos**: Cálculo da poção mais eficiente com base no HP real do Pokémon e estimativa de consumo de Pokébolas por hora.

### 4. Telemetria Avançada de Hunt e Histórico de Capturas
- **Métricas em Tempo Real**: Monitoramento de encontros por minuto, tempo estimado para subir de nível (ETA), chances de captura e eficiência de OHKO (One-Hit K.O.).
- **Painel de Sessão Integrado**: Resumo detalhado das últimas capturas, shinies encontrados e ranking das 12 maiores notas de Pokémon obtidos.
- **Exportação para Análise**: Copie métricas consolidadas formatadas em Markdown com um clique para compartilhamento ou arquivamento.

### 5. Monitor do Community Market (Alertas em Tempo Real)
- **Vigilância Contínua**: Acompanhe o mercado do jogo em segundo plano a cada 30 ou 60 segundos.
- **Filtros Personalizados**: Crie regras por nome da espécie, preço máximo em moedas, gemas, desconto em relação à média e apenas shinies.
- **Notificações Instantâneas**: Notificações nativas do sistema operacional e alertas sonoros quando um Pokémon desejado for anunciado.

### 6. Background e Proteção de Sessão
- **Minimizar para a Bandeja (System Tray)**: Mantenha o app rodando silenciosamente na bandeja do sistema (Windows) ou barra de menus (macOS).
- **Prevenção de Suspensão de Energia**: O aplicativo impede que o computador entre em modo de suspensão durante o farm contínuo de lives e jogo.

---

## Instalação e Execução

### Pré-requisitos
- [Node.js](https://nodejs.org/) versão 20 ou superior.
- [npm](https://www.npmjs.com/) integrado ao Node.

### Executando Localmente

1. Clone o repositório:
```bash
git clone https://github.com/Atauan/PokeIdle-Hub.git
cd PokeIdle-Hub
```

2. Acesse a pasta da aplicação e instale as dependências:
```bash
cd PokeIdle-Hub
npm install
```

3. Inicie o aplicativo:
```bash
npm start
```

`npm start` e `npm run dev` executam a versão não empacotada com um perfil local separado da instalação de produção. O ambiente dev pode acessar Pokeidle, Twitch e Kick; use contas de teste.

Para preservar o perfil entre execuções, use:

```bash
npm run dev
```

Para apagar os dados locais de dev e começar com um perfil vazio, use:

```bash
npm run dev:reset
```

O reset remove logins, contas salvas, preferências, histórico, caches e configurações dos addons armazenados no perfil dev. Ele não apaga contas ou dados nos serviços remotos nem altera o perfil da versão de produção. Artefatos temporários do bloqueio de instância do Electron são preservados durante a execução. Se um reset falhar no meio, a inicialização normal permanece bloqueada até que `npm run dev:reset` termine.

---

## Compilação e Distribuição (Build Local)

Para gerar os instaladores e binários executáveis no seu sistema operacional, execute dentro da pasta `PokeIdle-Hub`:

### Windows
Gera instalador NSIS (`.exe`) e versão portátil (`Portable.exe`):
```bash
npm run dist:win
```
*Os arquivos serão gerados em `PokeIdle-Hub/dist/`.*

### macOS
Gera arquivos `.dmg` para Apple Silicon e processadores Intel:
```bash
npm run dist:mac
```

### Linux
Gera pacotes `AppImage` e `.deb`:
```bash
npm run dist:linux
```

---

## Integração Contínua e Releases (GitHub Actions)

O repositório inclui esteira automatizada configurada em [`.github/workflows/pokeidle-hub.yml`](.github/workflows/pokeidle-hub.yml):
- A cada `push` na branch `main`, o GitHub Actions prepara uma nova versão, compila os instaladores para **Windows**, **macOS** e **Linux** em matriz paralela e publica automaticamente uma release oficial com os checksums SHA-256 anexados.

---

## Estrutura do Projeto

```text
├── .agents/                      # Skills por projeto, referências e origem do pacote
├── AGENTS.md                     # Orientações para agentes no PokeIdle Hub
├── .github/
│   ├── scripts/release.cjs       # Automação de versionamento e release
│   └── workflows/pokeidle-hub.yml# Workflow de CI/CD para Electron e Swift
├── docs/                         # Documentação técnica, cálculos e changelogs
├── PokeIdle-Hub/                 # Código-fonte principal da aplicação Electron
│   ├── assets/                   # Ícones e recursos visuais
│   ├── renderer/                 # Interface do usuário (HTML, CSS, JS modular)
│   ├── main.js                   # Processo principal do Electron e janelas
│   ├── dev-profile.js            # Perfil local isolado e reset seguro de desenvolvimento
│   ├── tests/                    # Testes sintéticos de isolamento do perfil dev
│   ├── pokeidle-hunt.js          # Motor de telemetria matemática de hunt e AFK
│   ├── live-status.js            # Consulta e auditoria de canais Twitch e Kick
│   └── package.json              # Metadados e configuração do electron-builder
├── build.sh                      # Script de empacotamento universal
├── Info.plist                    # Metadados para bundle macOS
├── LICENSE                       # Licença MIT
└── README.md                     # Documentação geral do projeto
```

## Desenvolvimento com Agentes

As orientações específicas do projeto estão em [AGENTS.md](AGENTS.md). O pacote
[Agent Skills, de Addy Osmani](https://github.com/addyosmani/agent-skills) está
instalado em `.agents/skills/`, com 25 skills e referências compartilhadas em
`.agents/references/`. A versão e o commit importados estão em
[.agents/agent-skills.json](.agents/agent-skills.json).

Para preparar uma especificação, invoque `$spec-driven-development` em uma sessão
Codex aberta neste projeto. Também é possível pedir explicitamente a leitura de
[seu SKILL.md](.agents/skills/spec-driven-development/SKILL.md). A instalação por
projeto segue o diretório `.agents/skills/`; a descoberta das novas skills depende
da atualização do catálogo da sessão.

As skills complementam as instruções do usuário e do projeto. Instalar o pacote
não autoriza commits, publicação, deploy ou operações destrutivas. Algumas skills
dependem de ferramentas adicionais, que devem ser verificadas antes do uso.

## Créditos e Reconhecimentos

O **PokeIdle Hub** é um projeto independente de código aberto mantido por **Atauan Lima** ([@Atauan](https://github.com/Atauan)), desenvolvido e continuado a partir da base pioneira do projeto [PokeFarm](https://github.com/RaullPereira/PokeFarm), originalmente idealizado por [Raul Pereira](https://github.com/RaullPereira) e seus colaboradores.

Agradecemos aos criadores originais pela iniciativa pioneira e contribuição para a comunidade de jogadores do Pokeidle.

---

## Licença

Distribuído sob a licença **MIT**. Consulte o arquivo [LICENSE](LICENSE) para obter mais informações.

Desenvolvido e mantido por **Atauan Lima** ([@Atauan](https://github.com/Atauan)).
