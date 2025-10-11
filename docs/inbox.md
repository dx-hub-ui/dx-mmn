# Feed de atualizações

O feed de atualizações reúne menções e notificações da tabela `notifications` em uma experiência de duas colunas.

## Abertura

O botão de inbox fica no topo do aplicativo, ao lado do sino de notificações. Ao clicar, abrimos o modal `InboxModal` já com a aba "Todas as atualizações".

## Estrutura do modal

- **Header** com título, atalho para ajuda e ação de fechar.
- **Abas** controladas por `InboxTabs`, permitindo navegar entre categorias. Somente "Todas as atualizações" e "Fui mencionado" retornam dados por enquanto.
- **Barra de exibição** (`InboxShowBar`) alterna entre mostrar apenas não lidas ou todas, além da ação de marcar tudo como lido.
- **Coluna esquerda** (`InboxFilters`) mostra filtros por board e o link para configurações.
- **Coluna direita** (`InboxPanel`) lista os cartões (`InboxCard`) com virtualização via `@tanstack/react-virtual`, seleção em massa e infinite scroll.

## API

Os dados vêm das rotas em `/api/inbox`:

- `GET /api/inbox` aplica filtros por aba, status (lido/não lido), board e cursor.
- `POST /api/inbox/mark-read` marca itens selecionados como lidos.
- `POST /api/inbox/mark-all-read` aplica a ação em lote respeitando os filtros atuais.
- `POST /api/inbox/bookmark` liga/desliga favoritos por item.

Todas as rotas exigem `orgId` e aproveitam a view `public.v_user_updates` criada para expor metadados do feed.

### Notas de manutenção

- O modal do feed agora usa `<Modal>` do `@vibe/core`, com `ModalContent` dedicado e `zIndex` elevado, garantindo sobreposição total sobre o app (incluindo a sidebar fixa) e preservando o layout em duas colunas.
- O `ModalContent` herda os estilos globais das classes `.ReactModal__Overlay` e `.ReactModal__Content`, garantindo a mesma largura/altura dos outros modais do app independentemente dos estilos locais.
- Sempre defina a prop `title` no `<Modal>` quando usar um header customizado dentro do `ModalContent`; sem isso o `@vibe/core` lança o erro de runtime "Title prop is mandatory for Modal when HeaderModal isn't provided".
- Simplificamos o `SELECT` do `GET /api/inbox` para colunas presentes em produção, evitando erros 500 quando a view `v_user_updates` ainda não expõe metadados opcionais como `actor_meta`.
- O endpoint `mark-all-read` aplica os filtros ativos (aba, board e estado "Mostrar") diretamente no Supabase. Corrigimos um bug em que a opção "Mostrar ▾ Todas as atualizações" ainda retornava apenas itens não lidos ao marcar tudo como lido.
- A mesma rota agora também força o `inner join` com `notification_bookmarks` quando a aba "Favoritos" está ativa, garantindo que somente atualizações salvas sejam marcadas como lidas.
- Após a adoção do join de favoritos, tipamos o helper de filtros com um genérico explícito para evitar dependência do tipo `this` e manter o build da Vercel estável.
- Blindamos a coleta de IDs nas rotas do inbox iterando manualmente pelas linhas, aplicando um type guard que ignora payloads sem `id` e impede que respostas parcialmente tipadas (`GenericStringError`) derrubem o build quando o Supabase retorna erros em forma de linha.
- Envolvemos o selo "Novo" dentro do label da aba correspondente para manter compatibilidade com os tipos do `@vibe/core/Tab` durante o build.
- Dentro dos banners de erro usamos `AlertBannerButton` para o CTA de tentar novamente, evitando o erro de runtime "Alert banner child is not supported" disparado ao usar `Button` diretamente.
- A rotina de persistência de scroll copia a ref do container antes de registrar o cleanup do efeito para que o React Hooks não acuse dependências instáveis durante o build (`react-hooks/exhaustive-deps`).

## Telemetria

As interações relevantes disparam eventos PostHog com prefixo `inbox.*`, preservando o ID da organização e do usuário atual.

## Scroll e preferências

Preferências de aba, exibição e filtro ficam persistidas em `localStorage`. A posição de scroll é salva em `sessionStorage` por 5 minutos para que o usuário retome o feed no mesmo ponto.

## Screenshot

No ambiente padrão de CI a captura automática ficou bloqueada pela tela de configuração do Supabase (variáveis de ambiente ausentes). Assim que o app rodar com Supabase provisionado, capture o modal pelo botão de inbox para atualizar esta seção.
