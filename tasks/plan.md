# Plano de Implementação: Escopo de Lives por Conta e Plataforma

Especificação aprovada: `SPEC-live-account-platform-scope.md`.

## Visão geral

Favoritos e remoções de canais passam a respeitar conta e plataforma. Remover uma live de uma conta a oculta apenas naquela conta, sem remover o canal da fonte global do provedor ou afetar outro serviço com o mesmo nome. A descoberta e os controles globais existentes continuam globais.

## Decisões de implementação

1. Migrar favoritos legados por conta para uma estrutura por conta e plataforma. Como o estado antigo não guarda provedor, copiar cada favorito para Kick e Twitch preserva o comportamento que o usuário vê hoje; depois da migração, alternar em uma plataforma não altera a outra.
2. Manter listas globais de canais por provedor e guardar as remoções individuais em exclusões por conta, provedor e canal normalizado. A política de recursos filtra essas exclusões antes de criar tiles.
3. Uma adição manual continua global e limpa exclusões do canal em todas as contas. Os controles de limpar canais continuam globais por provedor.
4. Remover uma conta também remove suas preferências e exclusões locais.
5. Não alterar sessões, logins, cookies, conexão Twitch/Kick ou dependências.

## Sequência de tarefas

### Fase 1: Estado e migração

- [x] Tarefa 1: migrar favoritos e persistir exclusões por conta.

### Fase 2: Cards e política de recursos

- [x] Tarefa 2: aplicar favoritos por conta/plataforma nos cards.
- [x] Tarefa 3: filtrar exclusões por conta antes de aplicar limites e criar tiles.
- [x] Tarefa 4: ordenar visualmente favoritos pela conta e plataforma corretas.

### Ponto de verificação: estado e planejamento

- [x] Testes focados de estado, política e tiles passam.
- [x] Remoção e favorito de mesmo nome em provedores diferentes ficam independentes.

### Fase 3: Remoção e ciclo de vida da conta

- [x] Tarefa 5: remover canais somente da conta selecionada e preservar a ação global de adicionar.
- [x] Tarefa 6: limpar preferências e exclusões da conta removida.

### Fase 4: Validação e registro

- [x] Tarefa 7: executar testes focados, suíte completa, verificar sintaxe e registrar a alteração.
- [ ] Confirmar manualmente na UI que remover uma tile preserva o mesmo canal nas outras contas e plataforma.

## Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| Favoritos antigos não identificam a plataforma | Favorito pode sumir após atualização | Migrar para as duas plataformas, preservando o estado visual atual, e testar migração repetida |
| Descoberta automática pode reintroduzir canal removido | Remoção por conta parece não funcionar | Persistir exclusão por conta e aplicar filtro antes do planejamento de recursos |
| Alteração no planejamento de tiles pode interferir nos limites | Conta recebe tiles diferentes | Cobrir limites, favoritos, recursos e exclusões com testes unitários de política |
| Adição manual global restaura canal em contas previamente excluídas | Pode ser inesperado | Preservar a semântica do botão global, explicitar em teste e revisar em smoke manual |

## Verificação

- Testes focados: `npm --prefix PokeIdle-Hub test -- tests/live-account-preferences.test.js tests/app-state.test.js tests/live-account-preference-controller.test.js tests/live-tile-view.test.js tests/live-policy.test.js tests/live-tile-controller.test.js tests/live-grid-layout.test.js tests/live-channel-collection.test.js tests/game-account-lifecycle.test.js`
- Suíte completa: `npm --prefix PokeIdle-Hub test`
- Sintaxe: `node --check` em cada arquivo JavaScript alterado.
- Validação visual final em dev/build Windows; não reiniciar nem apagar o perfil real do usuário durante testes.

## Lista de tarefas

Detalhes e critérios de aceite: `tasks/todo.md`.
