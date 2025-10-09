# Observability Platform

## Visão geral
A stack de observabilidade combina **Sentry** para monitoramento de erros, tracing e performance, e **PostHog** para analytics, feature flags e mapa de eventos. A inicialização dos SDKs é feita através dos arquivos `sentry.*.config.ts` e do `ObservabilityProvider`, garantindo cobertura em clientes, rotas server e middleware edge.

- **Sentry**: captura erros, exceções e traces. Replays estão habilitados para sessões selecionadas e o Profiling Node roda em APIs e server actions.
- **PostHog**: rastreia navegação, eventos de domínio e feature flags. Clientes edge apenas propagam o `x-request-id`; capturas de servidor acontecem via `trackServerEvent`.
- **Request context**: `lib/request-context.ts` gera e propaga `x-request-id`, além de anexar `user_id` e `org_id` às capturas.

## Releases e ambientes
O release utilizado é resolvido por `scripts/utils/release.js`, priorizando `SENTRY_RELEASE`, `VERCEL_GIT_COMMIT_SHA` e por fim `local`. A variável `SENTRY_ENVIRONMENT` define o ambiente (fallback para `NODE_ENV`). O upload de sourcemaps roda via `pnpm sentry:sourcemaps` somente quando:

- Ambiente = `production`
- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` e `SENTRY_PROJECT` estão presentes

## Catálogo de eventos
Os schemas tipados residem em `src/lib/analytics/events.ts`. Eventos inválidos falham em desenvolvimento e são descartados em produção com captura para Sentry.

| Evento | Campos principais |
| ------ | ----------------- |
| `auth:signup_started` | `method?` |
| `auth:signup_completed` | `method?` |
| `auth:login` | `method?` |
| `auth:logout` | — |
| `contacts:create` | `contact_id?`, `source?` |
| `contacts:update` | `contact_id?`, `changes?` |
| `contacts:status_changed` | `contact_id?`, `status` |
| `contacts:bulk_action` | `action`, `total` |
| `playbooks:create` | `playbook_id?`, `version_id?` |
| `playbooks:publish` | `playbook_id?`, `status?` |
| `playbooks:assign` | `playbook_id?`, `assignee_id?` |
| `sequences:create` | `sequence_id?`, `version_id?` |
| `sequences:version_publish` | `sequence_id?`, `status?` |
| `sequences:enroll_contact` | `sequence_id?`, `contact_id?` |
| `sequences:step_completed` | `sequence_id?`, `step_id?` |
| `microsites:create` | `microsite_id?` |
| `microsites:submission_received` | `microsite_id?`, `submission_id?` |
| `gamification:points_awarded` | `points?`, `badge?`, `reason?` |
| `gamification:badge_earned` | `badge?`, `reason?` |
| `notifications:email_queued` | `notification_id?`, `template?`, `provider?` |
| `notifications:email_sent` | `notification_id?`, `template?`, `provider?` |
| `notifications:email_failed` | `notification_id?`, `template?`, `provider?`, `error?` |
| `ui:theme_changed` | `surface?`, `value` |
| `ui:menu_opened` | `surface?` |
| `ui:modal_opened` | `surface?`, `value?` |
| `errors:client_runtime` | `module?`, `message?`, `request_id?` |
| `errors:server_exception` | `module?`, `message?`, `request_id?` |
| `api_request_failed` | `url?`, `method?`, `status?`, `message?` |

## Como adicionar um novo evento
1. Adicione o schema em `src/lib/analytics/events.ts` usando `zod`.
2. Atualize qualquer função de domínio para chamar `trackClientEvent` ou `trackServerEvent` com o payload validado.
3. Caso o evento seja emitido no servidor, considere complementar o contexto com `setServerRequestContext` antes da captura.
4. Documente o evento nesta página.

## Regras Edge vs Node
- **Edge (middleware)**: nunca importe `posthog-node`, `resend` ou dependências exclusivas de Node. Use apenas APIs Web (`crypto.randomUUID`, `fetch`).
- **Node**: APIs e server actions podem acessar `posthog-node`, `resend` e `@getbrevo/brevo`, desde que `export const runtime = 'nodejs'` esteja definido.
- **Client**: apenas `posthog-js` e Sentry browser são carregados. Use `ObservabilityProvider` e `useFeatureFlag` para leitura de flags.

## Rate & sampling
- `tracesSampleRate`: 0.2 por padrão (ajustável via `SENTRY_TRACES_SAMPLE_RATE`).
- `profilesSampleRate`: 0.1 por padrão.
- `replaysSessionSampleRate`: 0.1 e `replaysOnErrorSampleRate`: 1.0.
- PostHog captura navegações manualmente; reduza ruído filtrando eventos por `org_id` em queries.

## Troubleshooting
- **Eventos não chegam ao PostHog**: verifique `NEXT_PUBLIC_POSTHOG_KEY` e `POSTHOG_API_KEY`. Use `/api/health/observability` para confirmar configuração.
- **Sourcemap não aparece**: confirme `pnpm sentry:sourcemaps` no build de produção e se o release foi criado (`pnpm sentry:release`).
- **Request ID ausente**: confira se o middleware está ativo; as respostas devem conter cabeçalho `x-request-id`.
- **Erros edge**: verifique logs no Vercel. Lembre-se que libs Node não funcionam em middleware.
