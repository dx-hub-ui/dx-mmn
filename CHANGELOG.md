# Changelog

## 2025-10-07

### Added
- Tela de login em `/sign-in` usando componentes @vibe/core, integração com Supabase OTP e suporte a `redirectTo`.
- Página `/auth/callback` para persistir a sessão após confirmação do link mágico.
- Dashboard protegido em `/dashboard` exibindo dados do usuário autenticado e suas memberships para validação de papéis.

### Changed
- Página inicial `/` agora apresenta diretamente o fluxo de login e redireciona para o dashboard após autenticação bem-sucedida.

### Documentation
- README atualizado com instruções para configurar e testar o fluxo de login via Magic Link.
