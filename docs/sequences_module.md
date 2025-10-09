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
- Etiquetas de status utilizam `Label` do `@vibe/core` com a prop `text`, garantindo consistência tipográfica e compatibilidade com os tokens do design system.

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

## Novembro/2025 — Refinos de UI/UX

- **Lista de sequências** agora exibe barra superior Monday-style com título + tag Beta, botões "Aprender mais"/"Feedback", busca dedicada pelo nome e filtros agrupados em popover (`DialogType=popover`). A grade foi reconstruída com `@vibe/core/Table`, chips de status do Vibe, tag "Contatos" com ícone de equipe, colunas métricas alinhadas à direita (inscrições e taxas com tooltips "?") e skeleton inicial antes da hidratação.
- **Skeletons compatíveis** com o `@vibe/core/Table`, usando apenas os tipos `"long-text"`, `"medium-text"`, `"rectangle"` e `"circle"` para que o build não quebre quando a lista ainda está carregando. As colunas de métricas adotam `Skeleton.types.RECTANGLE`, eliminando comparações com variantes inexistentes como `"short-text"`.
- **Larguras fixas** para skeletons de texto médio/longos garantem que o componente aceite valores numéricos (pixels) esperados pelo Vibe, mantendo o visual proporcional sem depender de porcentagens que quebrariam o `pnpm run build`.
- **Busca focada** apenas no nome da sequência para simplificar a descoberta e alinhar com a barra de filtros principal.
- **Editor atualizado** com cabeçalho contextual, avatar inicial, tabs alinhadas ao Vibe e workspace em duas colunas: lista ordenável de passos à esquerda e painel detalhado com meta-informações, descrição e ações rápidas à direita.
- **Templates de passo** apresentados em cards reutilizáveis (“Tarefa geral”, “Tarefa de ligação”), facilitando a criação do primeiro passo e reforçando a arquitetura multicanal.
- **Formulário de regras & notificações** reorganizado em grid, com campos agrupados por contexto (janela de trabalho, cooldown, estratégia de publicação) e CTA fixo de salvar.
- **Inscrições** com estado vazio ilustrado (`EmptyState` do Vibe), formulário compacto e tabela com ações inline (pausar/retomar/encerrar) mantendo consistência visual com o manager.
- **Criação de sequência via modal** substitui o redirecionamento para `/sequences/new`, abrindo o fluxo diretamente na lista com validação e telemetria (`sequences/new_created_modal`).
- **Modal e cartões do manager** adotam submissão nativa e o token `--application-background-color`, mantendo compatibilidade com o `@vibe/core/Button` e o contraste adequado em todos os temas.
- **Compatibilidade com o Modal do Vibe** exige que `ModalHeader` continue como filho direto de `Modal`, evitando erros de console e garantindo que as validações internas do componente sejam satisfeitas.
- **Ação de editar** na tabela apresenta a mensagem "Desative para editar" vinculada via `aria-describedby`, garantindo o bloqueio quando a sequência estiver ativa sem recorrer a atributos não suportados pelo botão do Vibe.
- **Controle de ativação com Toggle** reposiciona o antigo botão “Publicar”, bloqueando edições enquanto `is_active` estiver verdadeiro e registrando eventos no PostHog (`sequences/toggle_active`).
