# Capability Map: Lives por plataforma e conta

| Módulo | Responsabilidade | Depende de | Especificação |
|---|---|---|---|
| `live-account-platform-scope` | Favoritos e remoção de canais independentes por conta e plataforma. Remover em uma conta não altera as outras contas nem a plataforma de mesmo nome. | — | `SPEC-live-account-platform-scope.md` |
| `twitch-chat-cards` | Seção Twitch abaixo das lives Kick, recolhida inicialmente, com contagem por conta; ao expandir, mostrar cards com nome e chat, sem vídeo. | `live-account-platform-scope` | `SPEC-twitch-chat-cards.md` |
| `kick-points-order` | Ler o saldo de pontos Kick por conta e ordenar as lives automaticamente do maior para o menor, deixando saldos indisponíveis por último. | `live-account-platform-scope` | `SPEC-kick-points-order.md` |

## Ordem de implementação

1. `live-account-platform-scope`
2. `twitch-chat-cards` e `kick-points-order`, como fatias independentes

O monitor econômico Twitch permanece separado da exibição dos cards. A seção visual só cria os chats ao ser expandida; a coleta em segundo plano deve continuar conforme o modo econômico já configurado.
