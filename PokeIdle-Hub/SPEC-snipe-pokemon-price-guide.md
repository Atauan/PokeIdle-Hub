# Spec: Comparação de preço de Pokémon no Rotom Sniper

## Objetivo

Permitir que a pessoa selecione um Pokémon próprio e compare anúncios ativos da mesma espécie no mercado da comunidade, para entender sua posição entre exemplares mais fracos e mais fortes e obter uma referência de preço.

## Escopo

- Selecionar qualquer Pokémon da conta, esteja na equipe, no depósito ou na Coleção, sem exigir nota mínima. A nota e a localização permanecem visíveis quando os dados do jogo as fornecem.
- Reconstruir os pacotes delta com o remontador de estado do próprio jogo. A lista de todos os Pokémon vem de `estado.eu.pokemons`; a Coleção é identificada pelos IDs em `estado.eu.automation.pokemonTravado`.
- Manter compatibilidade com aliases de espécie usados em fichas/anúncios, incluindo `idEspecie`.
- Consultar anúncios ativos da mesma espécie no mercado.
- Exibir os anúncios do mais fraco ao mais forte, mostrando os atributos disponíveis: potência, qualidade, nota/IV, nível e características especiais.
- Destacar os anúncios mais próximos dos atributos do Pokémon selecionado.
- Apresentar uma faixa e um valor de referência separados por moeda (GP e Gemas), indicando quantos anúncios foram usados.
- Permitir mostrar Coins, Gemas ou ambas ao mesmo tempo, mantendo anúncios, ordenação, referências e posição do Pokémon próprio separados por moeda. Pelo menos uma moeda permanece selecionada.
- Filtrar a lista de Pokémon da própria conta por nota maior que 3,5, Shiny ou P5. Os critérios ligados são inclusivos: basta atender a um deles. Todos começam ligados; se todos forem desligados, a lista mostra todos os Pokémon da conta.
- Consultar anúncios ativos pelo nome do Pokémon no Mercado; confirmar localmente a espécie pelo ID quando disponível e pelo nome exato quando a listagem omitir o ID. Os filtros da lista da conta não alteram os anúncios consultados.
- Apresentar o Pokémon selecionado na posição correspondente à força dele entre os anúncios da moeda escolhida; distinguir o card próprio visualmente.
- Usar cards em lista vertical inspirados no Mercado oficial, com imagem quando o card do jogo já estiver desenhado, tipos, nível, potência, IV, qualidade, nota, preço e vendedor.
- Abrir uma ficha modal com os seis stats e seus IVs individuais quando o WebSocket fornecer esses valores; indicar claramente quando a ficha do anúncio não tiver detalhes.
- Comparar com todos os anúncios ativos da mesma espécie, sem aplicar os filtros da lista da conta aos anúncios.
- Tratar ausência de anúncios ou atributos incompletos com estado informativo, sem inventar preço.

## Restrições

- Usar os dados já recebidos pelo addon e a consulta de anúncios do mercado; não acessar endpoints privados nem enviar ações de compra/venda.
- A ferramenta é somente informativa: não altera anúncios nem define automaticamente o preço de venda.
- Não combinar GP e Gemas numa conversão inventada.
- Não tratar um índice calculado como valor oficial do jogo; manter atributos visíveis para que a ordenação seja compreensível.

## Hipóteses a validar na implementação

- O formato do estado foi confirmado em `docs/app.mjs`: o jogo remonta deltas antes de expor `estado.eu`; a Coleção da Bolsa não é uma lista separada.
- A sessão autenticada ainda precisa confirmar que os campos de nota e atributos necessários estão presentes no snapshot observado pelo addon.
- A resposta do mercado contém os atributos necessários para distinguir espécie e características especiais dos anúncios.
- A ordenação de força usará primeiro potência, depois qualidade e depois nota/IV e nível como desempates; os critérios serão explícitos na interface.
- A sugestão de preço usará até cinco anúncios mais próximos do Pokémon escolhido, separadamente por moeda, mostrando amostra, mediana e faixa observada. Exige três anúncios para apresentar sugestão conclusiva; com amostra menor, mostra apenas a faixa observada.

## Arquivos prováveis

- `assets/addons/rotom-sniper/injected.js`: selecionar dados próprios e solicitar anúncios comparáveis.
- `assets/addons/rotom-sniper/content_script.js`: encaminhar dados entre jogo e cockpit.
- `assets/addons/rotom-sniper/cockpit.html` e `cockpit.js`: interface de seleção, listagem ordenada e referência de preço.
- `tools/build-rotom.js` e `rotom-addon.js`: gerar e atualizar o bundle distribuído.
- Testes novos para ordenação, equivalência e cálculo de referência.

## Critérios de aceite

1. A pessoa consegue escolher qualquer Pokémon da conta que tenha identificador, independentemente da localização e da nota.
2. A comparação inclui todos os anúncios ativos da mesma espécie e separa moeda; os critérios de nota, Shiny e P5 filtram apenas o seletor dos Pokémon da conta.
3. O próprio Pokémon aparece na posição correspondente entre os anúncios da moeda escolhida, com destaque visual; os cards mostram seus atributos disponíveis.
4. Alternar Coins/Gemas mostra apenas anúncios e referência daquela moeda, sem conversão entre elas.
5. Os anúncios mais próximos em atributos são identificados e usados na referência de preço.
6. A interface mostra amostra e faixa observada, e não apresenta sugestão conclusiva quando não há dados suficientes.
7. A função não compra, vende, altera preços nem envia outras ações ao jogo.

## Validação

- Testes unitários para ordenação e seleção dos comparáveis, incluindo dados faltantes, espécies diferentes, shiny e moedas distintas.
- `node --check` nos arquivos JavaScript alterados.
- Gerar `rotom-addon.js` com `node PokeIdle-Hub/tools/build-rotom.js` e revisar o diff.
- Validar o fluxo no jogo requer execução do aplicativo autenticado; isso não pode ser confirmado apenas pelos testes locais.

## Riscos e pendências

- A resposta do mercado ainda precisa ser validada em sessão autenticada para confirmar atributos suficientes dos anúncios.
- As respostas do Mercado podem variar nos nomes dos arrays; o leitor aceita os campos de listagem conhecidos e informa quantas linhas chegaram antes de confirmar compatibilidade.
- Sprites são copiados do canvas oficial do card correspondente quando ele estiver renderizado na página do jogo; se não estiver disponível ou estiver vazio, o comparador omite a imagem e não usa um sprite aproximado.
- A consulta usa `pagina: 0`; até confirmar a paginação do protocolo, a sugestão se baseia nos anúncios retornados nessa consulta e pode não cobrir todo o mercado.
- A relação entre atributos e valor de mercado não é necessariamente linear; por isso a interface deve mostrar evidências observadas e não prometer preço de venda.
- Definir um mínimo de anúncios para liberar uma sugestão conclusiva durante a implementação, com fallback explícito para amostras pequenas.
