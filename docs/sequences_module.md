# Módulo de Sequências – Sprint 1

A Sprint 1 estabelece as fundações do módulo de **Sequências de tarefas** no DX Hub. Esta etapa foca em infraestrutura de dados, listas iniciais e telemetria básica.

## Principais entregas

- **Estrutura de banco** completa para sequências, versões, passos, inscrições, tarefas e notificações com políticas de RLS por organização.
- **Views otimizadas** `v_sequence_manager` e `v_my_tasks` para consumo direto pelo frontend.
- **Páginas** `/sequences` e `/tasks/my` em português, com filtros, estados vazios e alinhamento visual ao monday.
- **Telemetria inicial** com PostHog (client + server helpers) e breadcrumbs Sentry (`sequence_manager_viewed`, `my_tasks_viewed`).
- **Testes automatizados** cobrindo normalizadores, filtros e smoke tests E2E.

## Considerações de design

- Reutilização do AppShell e tokens definidos em `globals.css`.
- Acessibilidade com navegação por teclado (tabs, checkboxes, aria-labels) e textos de apoio claros.
- Todos os textos apresentados ao usuário estão em português brasileiro.

## Próximos passos (Sprints futuras)

- Editor completo de passos com drag-and-drop e modal de configuração.
- Server actions para CRUD, publicação de versões e inscrição manual.
- Motor de assignments e notificações in-app conectados ao Supabase.
