# Ordenação de lives da Kick por pontos

## Objetivo

Ordenar automaticamente os cards da Kick, dentro de cada conta, pelo saldo de pontos lido na interface da própria Kick.

## Escopo

- Ler o número exibido no botão de pontos da Kick pelos seletores documentados no userscript fornecido: `button[data-testid="channel-points-button"]` e `[data-testid="channel-points-value"]`.
- Observar mudanças sem polling e enviar somente canal e saldo numérico ao renderer do Hub.
- Manter a coleta dentro do próprio preload porque o sandbox do Electron não permite `require()` de módulos locais.
- Ordenar os cards Kick já autorizados/abertos por saldo decrescente, de forma isolada por conta. Valores não detectados ficam depois dos valores conhecidos; empates mantêm a ordem existente.
- Manter a Twitch e a escolha dos canais permitidos pelos limites/favoritos inalterados.

## Restrições e riscos

- A marcação HTML da Kick pode mudar; valores ausentes ou inválidos não devem ser inventados nem interpretados como zero.
- Não persistir saldos, cookies, mensagens de chat ou outros dados da sessão.
- Não fazer chamadas de rede adicionais nem alterar logins/partições.

## Critérios de aceite

- Ao mudar o saldo no webview da Kick, apenas a ordem visual dos cards Kick da mesma conta é recalculada.
- Uma conta não afeta a ordenação de outra conta; os cards Twitch mantêm posição relativa e dados.
- Saldo desconhecido fica após saldos conhecidos; empates preservam a ordem prévia.
- O detector valida canal e saldo e ignora valores inválidos.
- O preload continua encaminhando o clique do chat Kick sem dependência local que falhe no pacote sandboxado.

## Validação

- Testes unitários para a ordenação e detector de pontos.
- `node --check` nos arquivos JavaScript alterados, testes focados, suíte completa e `git diff --check`.
- A confirmação final dos seletores e do comportamento requer teste manual em uma sessão Kick autenticada; não usar credenciais nos testes automatizados.
