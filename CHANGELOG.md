# 2025-11-23

### Fixed
- Corrigimos a tipagem de `StepModal.onSubmit`, movendo a lógica de ancoragem para `state.position` e removendo duplicidades de import/export em `SequenceEditorPage.tsx`, eliminando os erros de build (`Expected ';'`, nomes redefinidos) identificados pela Vercel.

### Documentation
- Atualizamos `docs/sequences_module.md` para detalhar que o modal encaminha posicionamento e referência de etapa via `state.position`, evitando contratos duplicados (`anchorStepId`, `position`) e mantendo o editor alinhado ao design system.

# 2025-11-19

### Fixed
- Atualizamos os atalhos "Aprender mais" e "Enviar feedback" do manager de sequências para usar `IconButton.icon`, garantindo compatibilidade com o build Edge do Next.js e eliminando o erro de tipagem que impedia `pnpm run build`.
- Tipamos `SortableStep` como componente constante e destruturamos as props antes de chamar `useSortable`, evitando que o parser Edge reporte `Expression expected` ao anotar o parâmetro diretamente na assinatura.

### Documentation
- Registramos no guia de sequências que os atalhos do cabeçalho devem utilizar `IconButton.icon` em vez de filhos diretos, evitando regressões de tipagem no Edge runtime.
- Anotamos que o cartão arrastável do editor usa um tipo auxiliar para a função `SortableStep`, garantindo que o SWC do Edge interprete corretamente as props tipadas.

# 2025-11-18

### Fixed
- Corrigimos os chips de status na lista de sequências para usar `disabled` apenas quando o status for "Desativada", eliminando o erro de tipagem no build e mantendo o comportamento solicitado para estados arquivados.
- Atualizamos o sincronismo do painel de notas do editor para reagir diretamente à etapa selecionada, resolvendo o aviso do React Hooks durante o `pnpm run build`.

### Documentation
- Documentamos que o chip "Desativada" fica desabilitado na grade e que o painel de notas depende da etapa selecionada para preencher o rascunho automaticamente.

# 2025-11-17

### Changed
- Atualizamos `/sequences` para usar a tabela do `@vibe/core` com skeleton, ordenação em todos os cabeçalhos e chips de status, além de cabeçalho com tag “Beta”, ícones de ajuda/feedback e colunas de métricas com tooltips alinhadas aos tokens `--dx-font-text2-*`.
- Remodelamos `/sequences/[id]` com cabeçalho contextual (breadcrumb textual, toggle Inativa/Ativa e CTA “Salvar sequência”), cartões de etapas com menu contextual completo e painel de notas sobre `--allgrey-background-color`, incluindo textarea editável, toolbar (+, Aa, {}) e toggle “Pausar sequência até que a etapa seja marcada como concluída”.

### Documentation
- `docs/sequences_module.md` atualizado para refletir o novo cabeçalho da lista, a tabela com chips/ordenadores e o painel de edição com notas e toolbar no editor de sequências.
# 2025-11-22

### Added
- Sistema de notificações completo com sino na topbar, painel ancorado com abas/busca/filtro, modal de preferências e integração com menções em CRM (`queue_notification`).
- APIs REST (`/api/notifications/*`, `/api/user/preferences`, `/api/internal/notifications/weekly-digest`) com RLS e telemetria PostHog/Sentry.
- Digest semanal por e-mail usando `pg_cron`, webhook interno assinado e template `WeeklyMentionsDigest` em pt-BR.
- Testes unitários, integração e E2E (`notifications-panel.spec.ts`) cobrindo fluxo de leitura, mute e preferências.

### Fixed
- Substituímos o wrapper inexistente `Tabs` pelo `TabsContext` do `@vibe/core` no painel, garantindo build limpo e mantendo o foco/teclado funcionando nas abas.
- Declaramos `export const runtime = "nodejs"` em todos os handlers de notificações/preferências para impedir que o bundle Edge quebre ao importar o cliente do Supabase.
- Normalizamos a resposta do Supabase ao resolver a organização ativa no `AppShell`, lidando com payloads em array e evitando o erro de tipos "property 'id' does not exist on type" durante o build.
- Ajustamos o webhook `POST /api/internal/notifications/weekly-digest` para converter atores retornados como array pelo join do Supabase, impedindo o erro de tipos "Conversion of type '{ ... actor: { }[] }'" no build.
- Endurecemos a normalização de atores nos handlers de notificações para aceitar payloads `unknown`, verificando o shape antes de construir o DTO e evitando regressões quando o Supabase retornar objetos vazios.

### Documentation
- Criado `docs/notifications.md` com fluxos, payloads, métricas e troubleshooting do sistema de notificações multi-tenant.

# 2025-11-23

### Fixed
- Reestruturamos as linhas clicáveis da tabela de sequências com um wrapper acessível (`SequenceTableDataRow`) que replica o grid do Vibe e trata a navegação por teclado, eliminando o uso de props inexistentes (`tabIndex`) no `TableRow` e evitando novos erros no `pnpm run build`.
- Corrigimos a busca da lista de sequências para usar o atributo padrão `aria-label` do `@vibe/core/Search`, evitando novos erros de tipagem no `pnpm run build` e preservando a acessibilidade da barra de filtros.
- Adicionamos o `errorState` obrigatório ao `@vibe/core/Table` da lista de sequências com fallback acessível e CTA de recarregar, impedindo que o build volte a falhar por props ausentes.

### Documentation
- Atualizamos `docs/sequences_module.md` destacando que o `@vibe/core/Table` do manager deve receber `errorState` e um estado de erro acessível para manter o build saudável.

# 2025-11-22

### Fixed
- Ajustamos as larguras dos skeletons da tabela de sequências para números em pixels compatíveis com o `@vibe/core/Skeleton`, evitando que o build falhe ao interpretar porcentagens nas props `width`.

# 2025-11-21

### Fixed
- Ajustamos os estados de loading da tabela de sequências para usar apenas os tipos suportados pelo `@vibe/core/Table`, liberando o `pnpm run build` sem quebrar os skeletons responsivos das métricas.
- Atualizamos o skeleton personalizado das colunas numéricas para mapear o tipo `"rectangle"` do Vibe aos placeholders de métricas, evitando comparações com valores inexistentes como `"short-text"`/`"number"` durante o build.
# 2025-11-20

### Changed
- Editor de Sequências (`/sequences/[id]`) redesenhado com cabeçalho compacto, toggle "Inativa | Ativa" e CTA "Salvar sequência", cartões de etapas com menu contextual, painel de notas em `--allgrey-background-color` e rolagem independente entre lista e editor.
- Migração das inscrições da sequência para `@vibe/core/Table` com ordenação por cabeçalho, skeleton durante ações e manutenção das ações inline (pausar/retomar/encerrar) alinhadas ao design Monday.

### Fixed
- Ajustamos as colunas da tabela de inscrições para definir `loadingStateType` nativo do Vibe (ID/Tipo/Status como `"medium-text"`, data como `"long-text"` e ações como `"circle"`), eliminando o import ocioso de `Skeleton` e garantindo skeletons consistentes durante operações.

### Documentation
- Atualizamos `docs/sequences_module.md` com o novo layout do editor (toolbar de notas, menu contextual e rolagem independente) e com os requisitos da tabela de inscrições usando `@vibe/core/Table` com ordenação e skeletons.
# 2025-11-21

### Fixed
- Impedimos que o helper `createSupabaseServerClient` derrube o runtime quando o Next bloqueia `cookies().set`, encapsulando a mutação em `try/catch` e registrando um aviso somente em desenvolvimento.

### Documentation
- Documentamos no `README.md` que o helper ignora mutações de cookie fora de Server Actions/Route Handlers para evitar o erro "Cookies can only be modified in a Server Action or Route Handler".

# 2025-11-20

### Changed
- Página `/sequences`: reformulamos a lista com barra superior Monday-style (título + tag Beta + ações "Aprender mais"/"Feedback"), filtros em popover e tabela `@vibe/core/Table` com ordenação, skeleton inicial, chips de status do Vibe e colunas de métricas (inscrições e taxas) alinhadas à direita.

### Documentation
- Atualizamos `docs/sequences_module.md` com o novo layout da lista de sequências, detalhando ações da barra superior, chips de status, tooltips das métricas e busca focada no nome.
- CRM Kanban remodelado para estilo monday.com com cabeçalhos coloridos, menu contextual e botão rápido de criação usando componentes `@vibe/core` (`IconButton`, `MenuButton`).

### Fixed
- Drag and drop do Kanban passa a usar `closestCorners` e `data` explícito no `useDroppable`, garantindo que cartões reconheçam o estágio alvo ao serem soltos.

### Documentation
- `docs/crm_readme.md` atualizado com a estratégia de cores por estágio, novos atalhos de criação e notas sobre o ajuste do drag and drop.

# 2025-11-18

### Changed
- Refatoramos `/tasks/my` para usar `@vibe/core/Table`, com shell monday-style, badges de status "tinted" e ações inline alinhadas aos tokens `--dx-*`.

### Documentation
- Acrescentada referência na seção de tabelas do guia Monday destacando `MyTasksPage` como implementação alinhada aos padrões de board.

### Fixed
- Corrigimos a configuração das colunas da tabela em `/tasks/my` para evitar erros de lint durante o build (remoção segura de metadata apenas visual do cabeçalho).

# 2025-11-17

### Documentation
- Added `docs/table_design_reference.md` consolidating monday.com-style table patterns, header behaviors, and skeleton guidance for developers.

# 2025-11-16

### Changed
- Tabela de sequências simplificada: removemos seleção em lote, eliminamos a indicação de versão abaixo do nome e aplicamos bordas completas com tipografia `var(--dx-font-text1-normal)` para todas as células.
- Botão de filtro agora abre um popover (`DialogType=popover`) com opções rápidas para status e alvo usando `DialogContentContainer`, mantendo a busca na barra principal.

### Documentation
- Atualizamos `docs/sequences_module.md` com o novo comportamento dos filtros por popover e a remoção do aviso de seleção em lote.

# 2025-11-15

### Changed
- Página `/sequences` atualizada para alinhar ao layout Monday.com com cabeçalho simplificado, painéis usando `--primary-background-color` e tabela remodelada exibindo o ícone `Open` ao lado do nome da sequência (visível apenas no hover) para abrir `/sequences/[id]` mesmo quando ativa.

### Documentation
- `docs/sequences_module.md` revisado com as diretrizes da nova lista de sequências (cabeçalho sem breadcrumbs/KPIs, ícone `Open` no hover e uso de `--primary-background-color`).

### Fixed
- Normalizamos o fallback de contatos para atribuir `referred_by` como `null` quando o relacionamento está ausente, garantindo que `pnpm run build` não volte a falhar por tipos incompletos durante leituras individuais (`fetchContactById`).
- Ajustamos o mapeamento de contatos para aceitar respostas do Supabase com `referred_by` como array ou objeto único, evitando futuras quebras caso a API altere o formato do relacionamento.

### Documentation
- `docs/crm_readme.md` atualizado com nota operacional cobrindo a normalização de `referred_by` no fallback para orientar incidentes em bancos restaurados.

# 2025-11-14

### Fixed
- Ajustamos a consulta principal de contatos para usar `const` e satisfazer o lint `prefer-const`, garantindo que o fallback sem relacionamento siga aprovando no `pnpm run build` mesmo quando o Supabase não possui `contacts_referred_by_contact_id_fkey`.
- Mantivemos `PostgrestFilterBuilder` importado de `@supabase/postgrest-js` e adicionamos o pacote como dependência direta, eliminando a quebra de build causada pela ausência do módulo nas pipelines.

### Documentation
- `docs/crm_readme.md` recebeu nota operacional explicando a dependência do lint `prefer-const` durante o fallback de contatos.
- Documentamos que `@supabase/postgrest-js` está presente no `package.json`, garantindo que os tipos de filtros permaneçam disponíveis durante o build.
# 2025-11-14

### Fixed
- Corrigimos o modal "Nova sequência" para manter `ModalHeader` como filho direto de `Modal`, eliminando os erros `React 422/425` e o aviso do helper de modais do Vibe no console das sequências.

### Documentation
- Atualizamos `docs/sequences_module.md` com a exigência de manter `ModalHeader` diretamente sob `Modal` para preservar a validação interna do componente do Vibe.

# 2025-11-13

### Fixed
- A API de contatos passou a fazer fallback automático quando o relacionamento `contacts_referred_by_contact_id_fkey` não está disponível no cache do Supabase, evitando o erro `PGRST200` ao carregar CRM e mantendo as ações em lote funcionais.

### Documentation
- `docs/crm_readme.md` atualizado com a mitigação para bancos sem o relacionamento de indicações, orientando o comportamento de fallback.
- Topbar agora expande as três colunas por toda a largura da barra, alinhando a coluna da marca à variável `var(--sidebar-current, 272px)` para respeitar o estado atual da Sidebar.

### Documentation
- `docs/monday_design_guide.md` documenta o alinhamento da coluna de marca da Topbar com a largura dinâmica da Sidebar.

# 2025-11-10

### Added
- Modal de criação de sequência em `/sequences`, reutilizando componentes do Vibe, validações e telemetria (`sequences/new_created_modal`) antes de redirecionar para o editor.

### Changed
- Editor de sequências atualizado com Toggle de ativação (`@vibe/core/Toggle`) no cabeçalho, bloqueando passos, regras e inscrições enquanto `is_active` estiver verdadeiro.
- Formulários de regras e inscrições passam a usar `fieldset` desabilitado, garantindo feedback visual consistente e impedindo salvamentos com a sequência ativa.
- Cartões, filtros e tabela do manager passaram a usar `--application-background-color`, garantindo contraste correto entre temas claro/escuro/noite.

### Fixed
- A modal "Nova sequência" voltou a usar submissão nativa dentro do próprio formulário, eliminando o uso do atributo `form` incompatível com `@vibe/core/Button` e destravando o build em produção.
- Botão "Editar" na lista de sequências agora exibe a dica "Desative para editar" via `aria-describedby`, removendo o atributo `title` não suportado pelo `@vibe/core/Button` e mantendo o bloqueio acessível quando a sequência está ativa.

### Documentation
- `docs/sequences_module.md` revisado com o novo fluxo de criação via modal, bloqueios por Toggle e o uso obrigatório de `--application-background-color` nos cartões do manager.

# Changelog

# 2025-11-12

### Fixed
- Reestruturamos a Topbar em três colunas para garantir o avatar ancorado à direita e adicionamos o atalho de Inbox usando `@vibe/core/IconButton` com o ícone `@vibe/icons/Inbox`.

### Documentation
- Atualizamos `docs/monday_design_guide.md` com a nova organização da Topbar e o posicionamento do atalho de Inbox antes do menu do usuário.

# 2025-11-11

### Fixed
- Corrigimos o submenu de tema do menu do usuário para renderizar um único elemento filho (`<Menu>`), eliminando o erro `React.Children.only` ao abrir o avatar na Topbar.
- Movemos o carregamento do CSS base do Vibe para `globals.css`, prevenindo o aviso de preload não utilizado emitido pelo navegador em produção.

### Documentation
- Atualizamos `docs/page_design_guidelines.md` com a orientação sobre envolver submenus em `<Menu>` e sobre o carregamento global do CSS do Vibe.

# 2025-11-10

### Fixed
- Ajustamos a página `/` para não mais chamar `supabase.auth.refreshSession` no servidor, evitando o erro "Cookies can only be modified in a Server Action or Route Handler" ao acessar a aplicação.
- Ajustamos o `FOREIGN KEY` de `public.memberships.user_id` para apontar a `public.profiles(id)` com `ON DELETE CASCADE`, permitindo que o Supabase exponha o relacionamento `profile:profiles` e eliminando o erro `PGRST200` ao carregar memberships com dados de perfil.
- A consulta de contatos da página `/crm` agora especifica o relacionamento `memberships!contacts_owner_membership_id_fkey`, removendo o erro `PGRST201` causado pela ambiguidade entre os vínculos `invited_by` e `owner_membership_id`.

### Documentation
- README e `docs/dev_setup_crm.md` atualizados com a nova relação `profiles ↔ memberships` e o impacto da migração `009_fix_memberships_profiles_fk.sql`.

# 2025-11-09

### Added
- Criamos o componente `SupabaseConfigNotice` para exibir um aviso reutilizável sempre que as variáveis públicas do Supabase não estiverem presentes.

### Fixed
- As páginas `/` (login) e `/crm` passaram a capturar a ausência de `NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY`, exibindo o aviso guiado em vez de quebrar o render da aplicação.
- O teste do `ContactModal` agora garante que o container é exposto como `role="dialog"` com `aria-modal="true"`, protegendo a regressão que impedia abrir os detalhes em modal.

### Documentation
- README e `docs/dev_setup_crm.md` atualizados com a orientação sobre o aviso de configuração pendente do Supabase.

# 2025-11-07

### Added
- Integração completa de observabilidade com `ObservabilityProvider`, request context, eventos tipados PostHog e nova API `/api/health/observability`.
- Abstração de provedores de e-mail (Resend, Brevo e modo no-op), templates transacionais e pipeline de notificações com telemetria.
- Scripts de fumaça (`pnpm test:smoke`) cobrindo Sentry, PostHog e e-mail, além dos endpoints `/api/health/email`.

### Changed
- Configurações do Sentry para clientes, servidor e edge agora incluem release automático, replays e profiling, com upload condicional de sourcemaps.
- Middleware passa a propagar `x-request-id` para edge/server e inicializa escopo do Sentry, garantindo correlação de requisições.

### Documentation
- Novos guias `docs/observability.md`, `docs/email.md` e runbooks em `docs/runbooks/*` detalhando operação e mitigação de incidentes.
# 2025-11-08

### Changed
- Página `/sequences` remodelada para o layout Monday-like com breadcrumbs, cartões de métricas, filtros via `@vibe/core` e tabela com badges de status e resumo do alvo padrão.
- Editor de sequências atualizado com cabeçalho contextual, experiência em duas colunas para passos, painel de detalhes enriquecido, formulários de regras reorganizados e estado vazio de inscrições alinhado ao Vibe.

### Fixed
- Ajustamos as etiquetas de status (`Label` do `@vibe/core`) do manager e do editor para usar a prop `text`, garantindo tipagem correta no build e mantendo a renderização alinhada ao design system.

### Documentation
- `docs/sequences_module.md` revisto com a nova hierarquia visual do manager e editor, destacando navegação por abas, templates de passos e resumo de métricas.
- Acrescentada orientação sobre o uso da prop `text` em `Label` para preservar consistência tipográfica nas etiquetas de status do módulo de sequências.

# 2025-11-07

### Changed
- Reestruturamos o layout interno da Topbar para que o menu do usuário fique encostado ao canto direito, respeitando apenas o padding lateral da barra.

### Fixed
- Avatar do menu do usuário volta a renderizar em formato quadrado (40px) sem esticar ao abrir o dropdown.
- Dropdown e tooltip do menu do usuário passam a usar `z-index` elevado (`>=12000`), garantindo que apareçam sobre a Sidebar.

### Documentation
- `docs/page_design_guidelines.md` atualizado com orientações sobre ancoragem do avatar e prioridade de `z-index` do menu do usuário.

# 2025-11-06

### Added
- Menu global do usuário na Topbar com avatar, submenu de tema (Claro/Escuro/Noite), modal "Minha conta" com edição completa de perfil e upload de avatar para o Vercel Blob, incluindo telemetria PostHog e integração com Supabase Auth.
- API `GET/PUT /api/user/profile` com validação, persistência de preferências (tema, dados pessoais) e atualização do JSON de metadados em `public.profiles` respeitando o RLS existente.

### Changed
- Menu do usuário reposicionado para a borda direita da Topbar usando `@vibe/core/Avatar` (`size="large"`) com `aria-label` baseado no display name do perfil e fallback de iniciais.
- A aba "Perfil" da modal "Minha conta" mantém o campo de display name obrigatório para sincronizar o nome exibido com o Supabase.

### Fixed
- O menu global e a modal de conta agora registram falhas no Sentry, garantindo rastreabilidade quando carregamentos, troca de tema ou salvamento do perfil falham no cliente.
- Corrigida a ausência da dependência `@supabase/supabase-js` no `package.json`, evitando falhas de build na página de dashboard e mantendo o lockfile sincronizado.

### Documentation
- `docs/page_design_guidelines.md` atualizado com orientações sobre o novo menu global, posicionamento do avatar e comportamento esperado do modal de conta.

# 2025-11-05

### Added
- Função edge `supabase/functions/sequences_engine` processando inscrições ativas, gerando assignments com clamp de janela de
  trabalho, notificações (`assignment_created`, `due_today`, `overdue`) e concluindo inscrições automaticamente.
- Ações de servidor para tarefas (`completeAssignmentAction`, `snoozeAssignmentAction`) com telemetria PostHog, breadcrumbs do
  Sentry e notificações `assignment_snoozed`.
- Modal de detalhes em "Minhas tarefas" com adiar/ concluir, atualizações otimistas e banner de erros acessível.
- Migração `007_sequences_engine.sql` atualizando a view `v_my_tasks` com metadados de passo e gatilho para notificar mudanças de
  status nas inscrições.

### Documentation
- `docs/sequences_module.md` atualizado com o relatório da Sprint 3, cobrindo motor de assignments, notificações e melhorias de
  UX em tarefas.

# 2025-11-04

### Added
- Editor de Sequências (Sprint 2) com páginas `/sequences/new` e `/sequences/[id]`, drag-and-drop de passos, modal completo,
  configuração de regras, inscrições manuais e publicação de versões com telemetria PostHog/Sentry.
- Server actions centralizadas (`src/app/(app)/sequences/actions.ts`) cobrindo criação de rascunhos, CRUD de passos, reordenação,
  duplicação, publicação e gestão de inscrições.
- Helpers do editor (`normalize`, `dates`) e testes Vitest para normalização de dados e cálculo de due-date com clamp.
- Sidebar atualizada para destacar "Sequências" e "Minhas tarefas", além de spec Playwright (`sequences-editor.spec.ts`) como
  placeholder para o fluxo do editor.

### Documentation
- `docs/sequences_module.md` ampliado com o relatório da Sprint 2, detalhando entregas, qualidade e próximos passos.

# 2025-11-03

### Added
- Módulo de Sequências (Sprint 1) com migrations `006_sequences_fundamentos.sql`, enums dedicadas, tabelas, views `v_sequence_manager`/`v_my_tasks` e políticas de RLS por organização.
- Páginas `/sequences` e `/tasks/my` consumindo as novas views, com filtros, ações em lote desabilitadas, estados vazios e telemetria PostHog + breadcrumbs Sentry.
- Testes Vitest para normalizadores/filtros de sequências e tarefas, além de smoke tests Playwright (`sequences-manager`, `my-tasks`).
- Inicialização de PostHog e Sentry via providers/configs (`PostHogProvider`, `sentry.*.config.ts`) e helpers de telemetria server-side.

### Documentation
- Novo guia `docs/sequences_module.md` descrevendo as entregas da Sprint 1 e próximos passos.

# 2025-11-02

### Fixed
- `/auth/callback` agora troca códigos PKCE via `exchangeCodeForSession`, ignora erros de `code_verifier` em links abertos em outro dispositivo, usa `verifyOtp` tolerante a `token_hash`/`token` (magic link, signup, invite, recovery, email) e só recorre a `setSession` com `access_token`/`refresh_token` ao final, eliminando o erro "Link inválido ou expirado" após login ou cadastro.
- Ajustamos o fallback `verifyOtp` para limitar-se aos tipos de OTP por email (magiclink, signup, invite, recovery, email, email_change), evitando tentativas inválidas que geravam erros de compilação durante o build e garantindo que o magic link continue funcionando mesmo sem `code_verifier`.
- `can_access_membership` (security definer) passou a desativar temporariamente o RLS enquanto consulta `visible_membership_ids`, removendo o erro `42P17 infinite recursion detected in policy for relation "memberships"` ao carregar o dashboard.

### Documentation
- README e `docs/dev_setup_crm.md` atualizados com o fluxo revisado (`exchangeCodeForSession` + fallback OTP) e com a observação sobre a desativação temporária de RLS em `can_access_membership`.

# 2025-11-01

### Fixed
- Corrigimos o callback `/auth/callback` para priorizar `verifyOtp` com `token`/`token_hash`, sincronizar cookies apenas após uma sessão válida e limpar o hash da URL antes de redirecionar, evitando erros de "link expirado".

### Added
- Automatizamos a criação de organizações e memberships com papel `org` para novos usuários através do gatilho `handle_new_user`, além de remover perfis órfãos com o novo gatilho `handle_deleted_user`.

### Documentation
- README e `docs/dev_setup_crm.md` atualizados com o fluxo revisado do callback, a atribuição automática de organizações e as regras para remoção de perfis quando usuários são excluídos.

# 2025-10-31

### Fixed
- Reestruturamos `/auth/callback` para processar manualmente `code`, `token_hash` e tokens `access/refresh`, tolerando erros de PKCE e impedindo que o magic link expire ao chegar ao usuário.

### Changed
- O cliente Supabase no browser agora mantém `detectSessionInUrl` desativado, entregando ao callback o tratamento dos parâmetros e evitando que o SDK consuma o token antes da sincronização de cookies.

### Documentation
- README e `docs/dev_setup_crm.md` atualizados com o passo a passo do callback manual, incluindo fallback PKCE/OTP e dicas de troubleshooting para links abertos em outro dispositivo.

# 2025-10-30

### Fixed
- Corrigimos o callback de autenticação para aguardar `supabase.auth.initialize()`, reaproveitar a sessão detectada automaticamente e validar tokens legados com `verifyOtp`, eliminando o erro "code verifier" e os loops de retorno ao `/sign-in`.

### Changed
- Middleware agora usa `createServerClient` para validar usuários autenticados e propagar cookies do Supabase, substituindo o fetch manual que ignorava os cookies PKCE.

### Documentation
- Atualizamos o guia de login para detalhar a ordem do callback (inicialização, validação de sessão, fallback `token_hash`, sincronização) e registrar o novo middleware baseado no cliente do Supabase.

# 2025-10-29

### Fixed
- Fluxo de callback do Supabase realiza `exchangeCodeForSession` ao receber `code` de PKCE e mantém o fallback de `token_hash`, evitando que os usuários sejam redirecionados de volta para `/sign-in` após clicar no magic link.

### Changed
- Formulário de login respeita o parâmetro `redirectTo` recebido via query string e gera `emailRedirectTo` usando `NEXT_PUBLIC_SITE_URL`, suportando múltiplos ambientes sem alterar o código.

### Documentation
- README e `docs/dev_setup_crm.md` atualizados com a variável `NEXT_PUBLIC_SITE_URL` e a descrição do fluxo de troca PKCE no callback.

# 2025-10-28

### Added
- Barra de ações inferior (`BulkActionsBar`) com ações completas (estágio, dono, próximo passo, indicado por, tags, cadastrado/perdido, mesclar, arquivar, reativar, excluir, exportar) e telemetria `crm/bulkbar_open`/`crm/bulk_action_execute`.
- Fluxo de importação CSV com dry-run, validações de estágio/dono/telefone e API `/api/crm/import`, além de parser tolerante a aspas e delimitadores `,`/`;`.
- Relatórios Funil e Top Indicantes disponíveis no board, mais testes Vitest cobrindo bulk actions e parser CSV.

### Changed
- `ContactsBoardPage` agora emite telemetria granular (`crm/owner_changed`, `crm/next_step_set`, `crm/referral_linked`) ao atualizar contatos (modal, kanban, inline ou bulk) e fornece feedback específico para estágio/próximo passo.
- `performBulkAction` recebeu cobertura de testes e suporte a arquivar/reativar/excluir mantendo permissões.

### Documentation
- `docs/crm_readme.md` e `docs/dev_setup_crm.md` atualizados com funcionalidades da Sprint 3, instruções de importação e checklist final.

# 2025-10-21

### Added
- Modal de contato (`ContactModal`) com tabs (Atividades, Dados, Próximo passo, Indicações), timeline baseada em `contact_events` e navegação por teclado.
- API `GET /api/crm/contacts/[id]` retornando detalhe completo (contato, timeline, indicações) reutilizada pelo board/modal.
- Kanban de estágios (`ContactsKanban`) com drag & drop via `@dnd-kit`, sincronizado com filtros/views do board.
- Migração `002_crm_contact_events.sql` e seeds atualizados para popular eventos históricos realistas.
- Testes unitários (Vitest) cobrindo modal/kanban e cenário Playwright para alternância board/kanban e abertura da modal.

### Changed
- Board passa a usar botões acessíveis para abrir modal (`Enter`/`O`/duplo clique) e alternar modo (Tabela/Kanban).
- `submitContactForm` centraliza atualizações com dedupe/telemetria; alterações de estágio criam eventos e atualizam timeline automaticamente.
- `package.json` inclui dependências `@dnd-kit/core` e `@dnd-kit/sortable` para drag & drop.

### Fixed
- Tipagem das rotas POST/PATCH ajustada para exigir `actorMembershipId` e testes de modal/Kanban atualizados para refletir a semântica acessível das abas e cards.

### Telemetry
- Novos eventos: `crm/contact_modal_open`, `crm/contact_modal_save`, `crm/contact_modal_tab_change` e `crm/contact_stage_changed`.

### Documentation
- `docs/crm_readme.md` e `docs/dev_setup_crm.md` atualizados com arquitetura da modal, tabela `contact_events`, checklist da Sprint 2 e instruções de testes.

## 2025-10-14

### Added
- Módulo `/crm` com board virtualizado, filtros combináveis, views salvas e agrupamento por estágio/dono.
- APIs REST de contatos (`GET/POST/PATCH`) com validação BR (telefone em E.164), deduplicação por organização e telemetria básica.
- Validação/utilitários reutilizáveis (`src/features/crm/contacts/*`), incluindo normalização de telefone e filtros salvos.
- Migração `001_crm_contacts_extensions` adicionando `score`, `referred_by_contact_id`, `next_action_note` e índices de dedupe.
- Testes Vitest e Playwright baseados em dados seed, além de documentação dedicada (`docs/crm_readme.md`, `docs/dev_setup_crm.md`).

### Changed
- Seed (`supabase/seed.sql`) atualizado com pipeline completa, scores, cadeias de indicação e próximos passos realistas.
- `package.json` com scripts padronizados (`typecheck`, `test`, `test:watch`, `e2e`) e dependências de QA/virtualização.

### Telemetry
- Novos eventos `crm/board_view_loaded`, `crm/filters_changed` e `crm/selection_changed` enviados via `src/lib/telemetry.ts`.

## 2025-10-07

### Added
- Tela de login em `/sign-in` usando componentes @vibe/core, integração com Supabase OTP e suporte a `redirectTo`.
- Página `/auth/callback` para persistir a sessão após confirmação do link mágico.
- Dashboard protegido em `/dashboard` exibindo dados do usuário autenticado e suas memberships para validação de papéis.

### Changed
- Página inicial `/` agora apresenta diretamente o fluxo de login e redireciona para o dashboard após autenticação bem-sucedida.

### Documentation
- README atualizado com instruções para configurar e testar o fluxo de login via Magic Link.
## 2025-10-15

### Fixed
- Corrigimos a troca de código PKCE em `/auth/callback` para usar a assinatura correta de `exchangeCodeForSession`, evitando falhas de build no fluxo de login por Magic Link.
- Quando o Supabase não encontra `code_verifier` (ex.: link aberto em outro dispositivo), o callback agora ignora o erro e cai no `token_hash`, evitando o loop de autenticação ao validar magic links.
- Ajustamos o componente `SortableStep` no editor de sequências para inicializar as props antes do hook `useSortable`, eliminando o erro de sintaxe que quebrava o build na Vercel.

