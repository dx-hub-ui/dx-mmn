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

## Sprint 2 — Editor, inscrições e ações

A segunda etapa entrega o editor visual completo, inscrições manuais e as server actions necessárias para publicar versões e
operar a sequência sem sair do DX Hub.

### Principais entregas

- **Editor de passos** `/sequences/[id]` com drag-and-drop, duplicação, ativação/desativação, modal rico e preview de due-date
  conforme janela de trabalho.
- **Regras & janela** configuráveis (fuso, dias úteis, início/fim, cooldown, estratégia de publicação e notas) com persistência via
  server action.
- **Inscrições manuais** com tabela administrativa, ações de pausar/retomar/encerrar e formulário rápido por tipo de alvo.
- **Server actions** para criar rascunhos, salvar passos, reordenar, publicar versões e gerenciar inscrições, com telemetria PostHog
  e breadcrumbs Sentry.
- **Sidebar atualizada** incluindo acessos diretos a “Sequências” e “Minhas tarefas”.

### Qualidade e testes

- Novos testes unitários para normalização do editor e cálculo de due-date com clamp.
- Spec E2E placeholder para o editor (skipado até configurarmos Supabase de testes).
- Documentação e changelog atualizados para acompanhar o avanço da sprint.

## Sprint 3 — Engine, notificações e tarefas

A terceira sprint conclui o núcleo operacional das sequências, automatizando assignments, notificações in-app e ações diárias
das reps via "Minhas tarefas".

### Principais entregas

- **Motor de sequências** publicado em `supabase/functions/sequences_engine`, gerando assignments conforme janela de trabalho,
  respeitando dependências/"pause until done", ajustando `overdue_at` e concluindo inscrições quando todos os passos são finalizados.
- **Notificações in-app** para inscrições (`sequence_paused`, `sequence_resumed`, `sequence_completed`, `sequence_removed`) via
  gatilho SQL e para tarefas (`assignment_created`, `due_today`, `overdue`, `assignment_snoozed`) pelo engine e pelas ações de
  usuário.
- **View `v_my_tasks` enriquecida** com descrição, prioridade e tags do passo, permitindo o modal detalhado reutilizar os dados
  sem consultas adicionais.
- **Ações de servidor para tarefas** (`completeAssignmentAction`, `snoozeAssignmentAction`) com revalidação automática, eventos
  PostHog e breadcrumbs Sentry contendo `org_id`, `sequence_id`, `version_id` e `enrollment_id`.
- **Modal de detalhes** em `/tasks/my` com resumo do passo, etiquetas, banner de erros acessível e formulário de adiamento com
  validação, além de feedback otimista na tabela.

### Qualidade e testes

- Novos testes Vitest (`validation.test.ts`) para a sanitização de datas de adiamento e ajustes nas specs de normalização.
- Atualização dos testes existentes para refletir os campos adicionais em `MyTaskItem`.
- Execução dos jobs de lint, typecheck e unit tests garantindo que os fluxos adicionados não quebram o build.
