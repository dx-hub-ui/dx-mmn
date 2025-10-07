# Changelog

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
