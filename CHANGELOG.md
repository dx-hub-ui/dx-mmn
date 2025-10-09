# Changelog

# 2025-11-10

### Fixed
- Ajustamos a página `/` para não mais chamar `supabase.auth.refreshSession` no servidor, evitando o erro "Cookies can only be modified in a Server Action or Route Handler" ao acessar a aplicação.

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

