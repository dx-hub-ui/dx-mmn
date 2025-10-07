# Changelog

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
