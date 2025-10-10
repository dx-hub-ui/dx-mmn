# CRM de Contatos — Notas de Arquitetura

## Visão Geral
- A área `/crm` é servida via página `src/app/(app)/crm/page.tsx`, carregada dentro do AppShell padrão descrito em `page_design_guidelines.md`.
- O módulo utiliza o Supabase (RLS) para carregar contatos e memberships visíveis através das funções utilitárias `listContacts` e `fetchVisibleMemberships`.
- A listagem principal (`ContactsBoardPage`) usa componentes do Vibe (`Tabs`, `Table`) para alternar entre a visão em tabela e o Kanban. A tabela oferece ordenação por coluna, skeletons durante carregamentos e mantém a navegação por teclado acessível (`role="grid"`).

## Atualização de Junho/2025 — Kanban estilo monday.com
- O componente `ContactsKanban` recebeu cabeçalhos coloridos por estágio reutilizando as mesmas cores vibrantes dos badges de status da tabela. Os tons são definidos via `data-tone` em `contacts-kanban.module.css` para facilitar ajustes futuros.
- Cada coluna agora exibe menu de três pontos (`MenuButton` + `IconButton` com `MoreActions`) com atalhos "Adicionar novo contato" e "Definir limite da coluna" e um botão `+` dedicado que dispara `onAddContact(stageId)`.
- O estado vazio de coluna passou a exibir um botão de atalho para criação rápida quando `onAddContact` estiver disponível, alinhado ao comportamento esperado em monday.com.
- O drag and drop utiliza `closestCorners` e dados explícitos de estágio no `useDroppable`, resolvendo cenários em que o cartão não reconhecia o drop target e trazendo feedback visual com borda/acento ao arrastar.

## Atualização de Novembro/2025 — Toolbar simplificada e criação direta
- O cabeçalho da página foi reduzido ao título fixo **Meus Contatos**, com as ações de Relatórios e Importar migradas para um `MenuButton` (ícone `MoreActions`) no canto superior direito.
- A visão Tabela ganhou uma toolbar acima da grade com "Criar contato", "Filtros" e "Atualizar"; o botão de filtros abre um popover (`Dialog` + `DialogContentContainer`) com checkboxes de estágio/dono, campo de tags e intervalo de próximo passo.
- Substituímos os banners inline por toasts sólidos (verde, vermelho e laranja) posicionados no canto inferior esquerdo, acionados por salvamentos, erros ou bloqueios de ação.
- O Kanban passou a usar apenas cabeçalhos coloridos, corpo neutro (`--dark-background-color`) e cartões planos sem sombras; o placeholder de criação evita cliques enquanto o POST está em andamento.
- "Adicionar Contato" no Kanban cria o registro imediatamente (nome padrão "Novo contato N"), mantém o usuário na visão e sincroniza a Tabela após o retorno da API.
- Ajustamos o z-index dos cartões durante o arrastar para que permaneçam sobre as colunas e evitem a sobreposição invertida reportada anteriormente.
- O helper `createContactRequest` fica definido antes dos handlers React e é compartilhado pela tabela/Kanban para reaproveitar validações do `parseEditableContactForm` sem violar a ordem dos hooks.

## Atualização de Novembro/2026 — Cartões menores e movimentação instantânea
- Compactamos ainda mais o `ContactsKanban`, reduzindo colunas para `clamp(200px, 20vw, 236px)` e espaçamentos internos para aproximar do visual compacto do monday.com.
- Ajustamos os cartões para altura menor: badge de estágio mini, metadados com tipografia `text4` e botões terciários com `min-height: 26px`, deixando o grid legível mesmo com muitas oportunidades.
- A experiência de drag & drop agora aplica atualização otimista de estágio (`optimisticStages`), reposicionando o cartão imediatamente na coluna alvo enquanto a API responde; falhas revertidas removem o override automaticamente.
- O sensor de ponteiro dispara com deslocamento de 3px e o cartão original some (`opacity: 0`) ao arrastar, mantendo o preview do `DragOverlay` colado ao cursor.

## Atualização de Outubro/2026 — Kanban compacto e fallback de timeline
- O título e mensagens da página `/crm` passaram a falar apenas em **Contatos**, removendo a sigla CRM das cópias visíveis.
- `ContactsKanban` foi redesenhado para um layout mais estreito (`clamp(220px, 22vw, 260px)` por coluna), com cabeçalhos compactos e cartões que usam botões terciários pequenos para as ações de WhatsApp/e-mail.
- A renderização de drag & drop agora usa `DragOverlay`, evitando que o cartão arrastado fique atrás das colunas; o overlay recebe `box-shadow` suave para indicar que está em movimento.
- Tipamos o `KanbanCardView` com `forwardRef` baseado no elemento semântico `<article>`, evitando dependências de tipos inexistentes no Edge Runtime ao gerar builds Next.
- Cards menores: espaçamento reduzido, meta convertida em lista e badge de estágio enxuto, seguindo tokens da aplicação.
- Falhas ao inserir/consultar `contact_events` com erro `PGRST205` (banco sem migração) agora geram apenas um aviso e seguem com timeline vazia, mantendo salvamentos/edições funcionando.

## Atualização de Dezembro/2026 — Tabela com edição célula a célula e Kanban de altura total
- `ContactsKanban` agora ocupa toda a altura útil da página (`boardWrapper` + `columnBody` flex), mantendo cabeçalhos fixos e colunas alinhadas mesmo em telas altas. O botão “Adicionar contato” da coluna vazia foi reduzido ao tamanho de um cartão padrão para evitar confusão com a área de drop.
- O arraste dos cartões agora normaliza manualmente a string de `transform` (translate/scale/rotate) para eliminar o deslocamento que deixava o preview longe do cursor em navegadores desktop.
- A visão Tabela renomeou **Estágio** para **Status** e o chip virou um botão colorido de largura total (`StatusCell`) com popover (`MenuButton`) para alternar estágios reutilizando as mesmas tonalidades do Kanban.
- Cada célula da grade tornou-se editável por clique único: `InlineTextField`/`InlineSelectField` abrem inputs em contexto, fazem autosave on-blur e mostram erros/salvamento inline. O botão “Editar” foi removido; basta clicar no campo desejado.
- A grade recebeu bordas internas/externas consistentes (`styles.table`), combinando com o grid do monday.com e tornando a seleção visual mais nítida.

## Revisão de Bugs (Junho/2025)
- **Prioridade Alta — Geração de convites bloqueada:** a rota `POST /api/invites/generate` lia apenas a variável `SUPABASE_URL`. Em ambientes que expõem apenas `NEXT_PUBLIC_SUPABASE_URL` (setup recomendado no restante do app) o endpoint retornava "Server configuration missing" e nenhum convite podia ser criado. A correção passa a aceitar ambas as chaves e normaliza a URL antes de chamar a função Edge do Supabase.
- **Prioridade Média — Menu do usuário quebrado:** `GET /api/user/profile` lançava 500 quando a consulta de memberships retornava `permission denied` (códigos `PGRST301`/`42501`), impedindo o carregamento do avatar e das opções. A rota agora registra o incidente em telemetria e continua respondendo com os dados do perfil, retornando `org_id`/`member_id` nulos.
- **Prioridade Média — Indicações sem relacionamento:** ambientes com bancos restaurados antes da migração `contacts_referred_by_contact_id_fkey` quebravam toda leitura de contatos (`PGRST200`). A consulta agora tenta carregar o relacionamento `referred_by` e, caso o vínculo inexista, faz fallback automático para os campos básicos de contato, mantendo a listagem e ações em lote operacionais.
  - Observação operacional: o build de produção roda `pnpm run build`, que executa ESLint (`prefer-const`). Mantemos a consulta principal imutável (`const`) para que o fallback não volte a bloquear deploys quando o relacionamento estiver ausente.
  - Observação adicional: mantemos `@supabase/postgrest-js` como dependência direta para garantir que os tipos utilizados em `listContacts` estejam sempre disponíveis durante o `pnpm run build`.
  - Observação adicional 2: ao usar o fallback sem relacionamento, normalizamos o retorno para garantir que `referred_by` seja tratado como `null`, evitando regressões de build causadas por tipos incompletos na resposta do Supabase.

## Camadas e Pastas
- `src/features/crm/contacts/types.ts`: tipos compartilhados (estágios, filtros, metadados de membership) e eventos de telemetria.
- `src/features/crm/contacts/server/*`: utilitários server-side para leitura e escrita de contatos, incluindo validação, normalização BR (E.164) e deduplicação por organização.
- `src/features/crm/contacts/utils/savedViews.ts`: regras puras de filtros (Meus, Time, Hoje etc.) reaproveitáveis em testes.
- `src/features/crm/contacts/validation/*`: validações síncronas (telefone BR, payload de contato).
- `src/app/api/crm/contacts/*`: rotas REST (GET, POST, PATCH) com Supabase server client e respostas padronizadas.
- `src/lib/telemetry.ts`: wrapper simples que reusa provedores já existentes (`window.analytics` ou `dataLayer`), caindo em `console.debug` em dev.

## Modelo de Dados
- `contacts` ganhou colunas `score` (0-100), `referred_by_contact_id` (cadeia de indicações), `next_action_note` (texto do próximo passo) e agora expõe `source` na API/board para sub-header do modal. Índices exclusivos garantem dedupe por telefone/e-mail normalizados.
- `status` foi renomeado de `ganho` para `cadastrado` para alinhar com a pipeline oficial (`Novo → Contato feito → Qualificado → Follow-up → Cadastrado → Perdido`).
- `contact_events` (nova tabela criada em `002_crm_contact_events.sql`) armazena timeline normalizada (`event_type`, `payload` JSON, `actor_membership_id`). Cada create/update relevante gera eventos automáticos: criação, mudança de estágio, troca de dono e atualização de próximo passo.
- Seed (`supabase/seed.sql`) oferece dados com cadeias de indicações (até 1 nível), eventos históricos e próximos passos realistas para validar filtros, timeline e views.

## Funcionalidades da Sprint 1
- Board com colunas exigidas (checkbox, Nome, Dono, Estágio, Último toque, Próximo passo, Indicado por, Telefone, Tags, Score, Ações).
- Busca global acompanhada de views salvas pré-configuradas (Meus, Time, Hoje, Sem toque 7d, Novos da semana, Indicados por mim) expostas como botões no topo da tabela.
- Ordenação por coluna e skeletons nativos da `@vibe/core/Table`, mantendo a leitura acessível enquanto dados são carregados.
- Edição inline com validações BR, dedupe pré-inserção/atualização, normalização E.164 e feedback de erro/sucesso inline.
- Criação rápida no topo da grade reutilizando as mesmas regras.
- Seleção persistente entre filtros e paginações virtuais com telemetria `crm/selection_changed`.

## Funcionalidades da Sprint 2
- **Modal de contato completo** (`ContactModal`): cabeçalho com estágio editável, atalhos (WhatsApp/ligar/e-mail), sub-header com origem/tags e tabs Atividades, Dados, Próximo passo e Indicações. A timeline consome `contact_events` com filtros contextuais e navegação com setas (`←/→`). Fechar com `Esc` retorna foco à linha; `O`/enter abre a partir do grid.
- **Edição completa dentro da modal** reaproveitando `EditableContactForm`, com validações compartilhadas e refresh da timeline pós-salvar. Telemetria adicionada: `crm/contact_modal_open`, `crm/contact_modal_save`, `crm/contact_modal_tab_change`.
- **Kanban de estágios** (`ContactsKanban`): colunas por estágio com drag & drop via `@dnd-kit`. Atualiza Supabase e timeline com feedback visual, respeitando filtros/views ativos. Telemetria `crm/contact_stage_changed` envia `{ contactId, from, to, source }`.
- **API GET `/api/crm/contacts/[id]`** retorna detalhe + timeline + referidos, mantendo autenticação Supabase.
- **Atualização de dados** ao mover estágio/trocar dono define eventos em lote e sincroniza board/modal.

## Funcionalidades da Sprint 3
- **Barra de ações em lote** (`BulkActionsBar`): ativada ao selecionar ≥1 contato, trazendo ações de estágio, dono, próximo passo, indicado por, tags, marcar `Cadastrado`/`Perdido`, mesclar duplicados, arquivar, reativar, excluir, exportar CSV e atalho "Mais…". Respeita papéis através de `filterContactsByOwnership` e utilitários em `utils/permissions.ts`, emitindo telemetria `crm/bulkbar_open`/`crm/bulk_action_execute`.
- **Fluxo de importação CSV** (`ImportContactsModal` + `/api/crm/import`): suporta dry-run com relatório de erros (telefone, dono, estágio, duplicados) e aplicação final com normalização BR, validação Supabase e retorno dos contatos inseridos. O parser aceita delimitadores `,` e `;`, campos entre aspas e múltiplas linhas.
- **Relatórios básicos** (`ReportsDialog`): mostra funil por estágio (considerando arquivados) e ranking de indicantes nos últimos 30 dias; diálogo acessível, com foco gerenciado e fechamento por `Esc`.
- **Regras de perda/arquivamento**: campos `lost_reason`, `lost_review_at` e `archived_at` são atualizados tanto em formulários individuais quanto em ações em lote, com mensagens de feedback e refresh automático da modal.
- **APIs complementares**: `/api/crm/contacts/bulk` e `/api/crm/import` encapsulam Supabase e validações, retornando contatos atualizados, IDs removidos e erros parciais para toasts resumirem falhas.

## Telemetria
- `crm/board_view_loaded`: enviado ao montar o board com `{ organizationId, total }`.
- `crm/filters_changed`: emitido ao alterar filtros ou view salva.
- `crm/selection_changed`: emitido quando o conjunto selecionado muda.
- `crm/contact_modal_open`, `crm/contact_modal_save`, `crm/contact_modal_tab_change`: instrumentam abertura, salvamento e troca de abas da modal.
- `crm/contact_stage_changed`: usado para board/modal/kanban/bulk ao alterar estágio.
- `crm/owner_changed`: disparado ao reatribuir dono (inline, modal ou bulk).
- `crm/next_step_set`: registra alterações do próximo passo, com payload `{ hasDate, hasNote, cleared, source }`.
- `crm/referral_linked`: emitido quando o vínculo de indicação é criado ou alterado.
- `crm/bulkbar_open`, `crm/bulk_action_execute`: acompanham abertura da barra inferior e execução de ações em lote.

## Decisões & Gaps
- **@vibe/code indisponível**: não existe pacote público acessível, optamos por `@vibe/core` + CSS modules alinhados aos tokens globais; registrado aqui para futuras integrações caso o pacote seja disponibilizado.
- **Skeleton local do board**: como `TableCellSkeleton` não é exportado por `@vibe/core`, mantemos um wrapper `TableLoadingSkeletonCell` baseado em `Skeleton` + `TableCell` dentro de `ContactsBoardPage` para preservar o layout do carregamento sem depender de caminhos internos do pacote.
- **Tabela usando @vibe/core**: adotamos `Tabs` + `Table` para alinhar a UI ao design Monday, com ordenação e skeletons nativos; removemos a virtualização customizada para simplificar o layout e reduzir CSS manual.
- **Permissões**: RLS via Supabase garante owner visível; UI respeita roles (`Meus` usa membership atual, `Time` usa árvore via `visible_membership_ids`).
- **Mutação autenticada**: rotas POST/PATCH (`/api/crm/contacts`) exigem `actorMembershipId` explícito para registrar eventos e validar hierarquias; requisições sem o campo respondem 400.
- **Parser CSV leve**: `parseCsv` implementado manualmente. Casos com delimitadores alternativos ou arquivos muito grandes devem ser validados em QA futuro.

## Próximos Passos
1. Validar parser CSV com arquivos grandes (10k+ linhas) e diferentes codificações/delimitadores.
2. Evoluir relatórios com métricas de conversão por origem/time e exportação filtrada.
