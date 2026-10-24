# Capability Map: Melhorias do Rotom Sniper

## Objetivo

Separar as melhorias solicitadas em módulos independentes antes de produzir especificações detalhadas. A aplicação é uma extensão/cockpit JavaScript integrado ao estado e ao WebSocket do PokéIdle.

## Módulos

| Module id | Responsabilidade | Depende de |
|---|---|---|
| `account-vip` | Detectar o VIP no estado da conta do jogo e manter o resultado associado à conta correta, evitando que o VIP de uma conta altere os limites de outra. | — |
| `donation-ui` | Remover o botão e a interface “Me pague um café”, incluindo o modal Pix ligado a essa ação. | — |
| `oferendas-retirement` | Remover a aba de oferendas e os comandos/handlers que só existem para essa tela. | — |
| `pokemon-community-catalog` | Investigar a fonte disponível e, se houver dados comunitários suportados pelo jogo, exibir Pokémon no catálogo; preservar a visualização atual de itens. | `community-catalog-source` (verificação de disponibilidade da fonte) |

## Ordem proposta

1. `account-vip`
2. `donation-ui` e `oferendas-retirement` (independentes)
3. `pokemon-community-catalog`, condicionado à confirmação da fonte de dados

## Hipóteses e questões de escopo

- “VIP por conta” significa que cada janela/conta do PokéIdle deve ter seu próprio status; se o cockpit não puder identificar com segurança a conta ativa, deve mostrar estado desconhecido e não tratar ausência de sinal como confirmação de conta sem VIP.
- “Remover Me pague um café” significa remover também o modal Pix, QR Code e chave Pix atualmente acessíveis apenas pelo botão dessa ação. Confirmar se essa interpretação está correta.
- “Remover aba de Alterar de oferendas” significa remover a aba e a automação de oferendas conectada a ela, sem afetar a venda de Pokémon no depot nem a tela/ação de venda do mercado. Confirmar se essa interpretação está correta.
- “Catálogo da comunidade mostrar os Pokémons” pode significar (a) listar anúncios de Pokémon ativos e seus preços ou (b) mostrar um resumo comunitário por espécie, como o resumo atual de itens. A fonte atual observada envia `market` com aba `itens` e um `resumo` indexado por item; ainda não foi confirmada uma fonte equivalente para Pokémon.
- Para o catálogo de Pokémon, a primeira entrega deve ser uma avaliação da fonte e uma implementação somente se os dados existentes forem suficientes, sem criar scraping ou chamadas não documentadas. Se não houver fonte, entregar evidência e proposta de alternativa, sem inventar preços ou estatísticas.

## Evidência inicial do código

- VIP: `injected.js` verifica `window.estado.eu.loja` e atualiza `rotom_player_vip`; esse valor é um booleano único em `chrome.storage.local`, e `cockpit.js` usa o mesmo booleano para exibir os slots.
- Oferendas: `cockpit.html` declara a aba e a tela; `cockpit.js`, `content_script.js` e `injected.js` implementam a solicitação e execução em lote.
- Doação: o botão `btn-open-pix` abre o modal Pix, que também inclui QR Code e chave de pagamento.
- Catálogo: `injected.js` publica `packet.resumo` para a aba de itens do mercado; o catálogo atual monta cartões a partir da base local de itens.

## Aprovação necessária

Revisar os limites dos módulos e responder às questões de escopo acima. Depois da aprovação deste mapa, será escrita uma especificação por módulo antes do planejamento ou implementação.
