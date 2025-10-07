# CRM de Contatos — Notas de Arquitetura

## Visão Geral
- A área `/crm` é servida via página `src/app/(app)/crm/page.tsx`, carregada dentro do AppShell padrão descrito em `page_design_guidelines.md`.
- O módulo utiliza o Supabase (RLS) para carregar contatos e memberships visíveis através das funções utilitárias `listContacts` e `fetchVisibleMemberships`.
- A listagem principal (`ContactsBoardPage`) é um componente client-side que combina filtros locais, views salvas e virtualização (`@tanstack/react-virtual`) para suportar coleções com 1k+ linhas mantendo acessibilidade (`role="grid"`, navegação por teclado, foco visível).

## Camadas e Pastas
- `src/features/crm/contacts/types.ts`: tipos compartilhados (estágios, filtros, metadados de membership) e eventos de telemetria.
- `src/features/crm/contacts/server/*`: utilitários server-side para leitura e escrita de contatos, incluindo validação, normalização BR (E.164) e deduplicação por organização.
- `src/features/crm/contacts/utils/savedViews.ts`: regras puras de filtros (Meus, Time, Hoje etc.) reaproveitáveis em testes.
- `src/features/crm/contacts/validation/*`: validações síncronas (telefone BR, payload de contato).
- `src/app/api/crm/contacts/*`: rotas REST (GET, POST, PATCH) com Supabase server client e respostas padronizadas.
- `src/lib/telemetry.ts`: wrapper simples que reusa provedores já existentes (`window.analytics` ou `dataLayer`), caindo em `console.debug` em dev.

## Modelo de Dados
- `contacts` ganhou colunas `score` (0-100), `referred_by_contact_id` (cadeia de indicações) e `next_action_note` (texto do próximo passo). Índices exclusivos garantem dedupe por telefone/e-mail normalizados.
- `status` foi renomeado de `ganho` para `cadastrado` para alinhar com a pipeline oficial (`Novo → Contato feito → Qualificado → Follow-up → Cadastrado → Perdido`).
- Seed (`supabase/seed.sql`) oferece dados com cadeias de indicações (até 1 nível), scores distribuídos e próximos passos realistas para validar filtros e views.

## Funcionalidades da Sprint 1
- Board com colunas exigidas (checkbox, Nome, Dono, Estágio, Último toque, Próximo passo, Indicado por, Telefone, Tags, Score, Ações).
- Filtros combináveis: estágio, dono, indicado por, tags, intervalo de próximo passo e busca global full-text (nome, email, telefone, tags, dono, indicado).
- Views salvas pré-configuradas e documentadas (Meus, Time, Hoje, Sem toque 7d, Novos da semana, Indicados por mim).
- Agrupamento dinâmico por estágio ou dono, com virtualização de linhas para manter performance.
- Edição inline com validações BR, dedupe pré-inserção/atualização, normalização E.164 e feedback de erro/sucesso inline.
- Criação rápida no topo da grade reutilizando as mesmas regras.
- Seleção persistente entre filtros e paginações virtuais com telemetria `crm/selection_changed`.

## Telemetria
- `crm/board_view_loaded`: enviado ao montar o board com `{ organizationId, total }`.
- `crm/filters_changed`: emitido ao alterar filtros ou view salva.
- `crm/selection_changed`: emitido quando o conjunto selecionado muda.
- Eventos futuros (modal, bulk actions, kanban) devem reutilizar `trackEvent`.

## Decisões & Gaps
- **@vibe/code indisponível**: não existe pacote público acessível, optamos por `@vibe/core` + CSS modules alinhados aos tokens globais; registrado aqui para futuras integrações caso o pacote seja disponibilizado.
- **Virtualização customizada**: `@tanstack/react-virtual` foi adotado para evitar dependência pesada; garante foco e semântica de grid.
- **Permissões**: RLS via Supabase garante owner visível; UI respeita roles (`Meus` usa membership atual, `Time` usa árvore via `visible_membership_ids`).
- **Importação/relatórios**: serão tratados nas sprints seguintes (documentado na DoD). Nenhuma funcionalidade placeholder foi exposta.

## Próximos Passos (Sprints 2 e 3)
1. Modal de contato com tabs (atividade, dados, tarefas, indicações) + telemetria `crm/contact_modal_*`.
2. Kanban com drag-and-drop usando a mesma fonte de dados (estágios) e eventos `crm/contact_stage_changed`.
3. Barra inferior para ações em lote + importação CSV e relatórios básicos (funil, top indicantes).
