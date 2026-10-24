# Spec: Escopo de Lives por conta e plataforma

## Objetivo

Permitir que cada conta mantenha favoritos e remoções de canais separados por plataforma. Remover um canal em uma conta deve ocultá-lo somente naquela conta e naquele provedor. Um canal com o mesmo nome em outra conta ou na outra plataforma deve continuar disponível.

## Requisitos e limites

- A identidade de uma preferência é a combinação de conta, plataforma (`kick` ou `twitch`) e canal normalizado em minúsculas.
- Favoritar ou desfavoritar um canal atualiza somente os cards da mesma conta e plataforma.
- Remover um card registra uma exclusão para a conta e plataforma do card. Não remove o canal da lista global do provedor nem altera os cards de outras contas.
- A descoberta automática continua sendo a fonte global de canais por provedor. Um canal excluído de uma conta não deve reaparecer nela após uma nova descoberta.
- Adicionar manualmente um canal pelo controle global continua sendo uma ação global para o provedor, como hoje; a hipótese de migração é que ela também limpe as exclusões desse canal em todas as contas.
- Os controles existentes de limpar Kick, Twitch ou todas as lives continuam globais e mantêm seus efeitos atuais.
- As preferências e exclusões de uma conta devem ser removidas quando essa conta for removida.
- Dados existentes devem ser migrados sem perder favoritos. O formato legado de favoritos não contém plataforma; a hipótese é migrar cada favorito legado para Kick e Twitch, permitindo que o usuário os separe depois.
- A mudança não altera logins, cookies, partições Electron, conexões com provedores ou contas remotas.

## Stack

- Electron 44.7.0
- JavaScript sem framework no renderer e nos módulos CommonJS/IIFE existentes
- Testes com `node:test`
- Persistência local via chaves `localStorage` `pf.*`

## Comandos

Executados a partir do repositório:

```sh
npm --prefix PokeIdle-Hub test -- tests/live-account-preferences.test.js tests/live-account-preference-controller.test.js tests/live-channel-collection.test.js tests/live-tile-controller.test.js tests/live-grid-layout.test.js tests/game-account-lifecycle.test.js
npm --prefix PokeIdle-Hub test
```

Não há script de lint ou typecheck definido no `package.json`. Os arquivos JavaScript alterados também devem passar por `node --check`.

## Estrutura do projeto

- `PokeIdle-Hub/live-account-preferences.js`: regras puras de favoritos e limites por conta.
- `PokeIdle-Hub/renderer/live-account-preference-controller.js`: coordenação entre estado, persistência, cards e avisos.
- `PokeIdle-Hub/renderer/live-channel-collection.js`: descoberta, adição, remoção e limpeza das listas de canais.
- `PokeIdle-Hub/renderer/live-tile-controller.js` e `live-grid-layout.js`: seleção e ordenação dos cards por conta.
- `PokeIdle-Hub/renderer/app-state.js`: carregamento e persistência de preferências locais.
- `PokeIdle-Hub/renderer/live-tile-view.js` e `app.js`: criação do card e composição das dependências.
- `PokeIdle-Hub/tests/`: testes unitários e de contrato dos módulos ativos.

## Convenções de código

Preservar JavaScript simples, funções puras para regras de preferência e injeção de dependências nos controllers. Normalizar nomes na fronteira e não mutar o estado recebido por funções puras. A API de preferência deve receber explicitamente provedor, conta e canal, por exemplo:

```js
function isAccountFavorite(favorites, accountId, platform, channel) {
  if (!accountId || !PROVIDERS.includes(platform) || !channel) return false;
  return favorites?.[accountId]?.[platform]?.includes(channel.toLowerCase()) === true;
}
```

Usar os nomes e padrões existentes dos módulos; não adicionar dependências nem introduzir uma nova camada arquitetural.

## Estratégia de testes

- Testar favoritos idênticos em Kick e Twitch na mesma conta, garantindo que alternar um não altere o outro.
- Testar favoritos em contas diferentes, garantindo isolamento entre elas.
- Testar a migração dos favoritos legados, incluindo nomes iguais nas duas plataformas, dados inválidos e inicialização repetida.
- Testar remoção de um card sem excluir o mesmo canal de outra conta ou plataforma.
- Testar que a descoberta não reintroduz um canal removido apenas naquela conta e que a adição manual global o restaura conforme a regra aprovada.
- Testar que limpar uma plataforma continua global e não toca a outra plataforma.
- Testar a remoção de conta e a limpeza de suas preferências/exclusões.
- Executar os testes focados e a suíte completa. A validação visual da build Windows e a reprodução manual do fechamento cruzado dependem do aplicativo em execução.

## Limites

- Sempre: preservar as chaves locais e sessões que não fazem parte da mudança; validar conta, provedor e canal; manter os efeitos existentes de persistência e sincronização; adicionar cobertura para os limites entre contas e plataformas.
- Pedir definição antes de alterar: a semântica da adição global se houver conflito com exclusões por conta; mudanças em APIs públicas, novas dependências ou configuração de CI.
- Nunca: remover testes existentes para acomodar a implementação; limpar logins, cookies ou dados de sessão; transformar uma remoção de card em logout de provedor.

## Critérios de aceite

1. Favoritar `alpha` na Kick da conta A não favorita `alpha` na Twitch da conta A nem em nenhuma plataforma da conta B.
2. Remover `alpha` da Kick da conta A mantém `alpha` visível na Kick da conta B e na Twitch da conta A.
3. Uma atualização da descoberta automática não restaura `alpha` na Kick da conta A enquanto a exclusão estiver ativa.
4. A ação global de adicionar e os controles globais de limpar preservam a semântica especificada acima.
5. Favoritos legados continuam visíveis após migração e tornam-se independentes entre plataformas depois da migração.
6. A remoção de uma conta apaga suas preferências e exclusões locais sem alterar as demais contas.
7. Os testes focados e a suíte completa passam.

## Pontos a confirmar na revisão

- A adição manual permanece global e remove a exclusão do canal em todas as contas. Esta é a hipótese que melhor preserva o controle global existente.
- Favoritos legados são copiados para Kick e Twitch, pois o formato antigo não registra plataforma e atualmente marca ambos os cards quando os nomes coincidem.
