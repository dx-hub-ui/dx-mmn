# Sistema de notificações

## Visão geral

O sino no topo da aplicação exibe o contador de notificações não lidas em tempo real. Ao clicar, o painel ancorado mostra abas (Todas, Não lidas, Fui mencionado, Atribuídas a mim), busca com debounce de 250 ms, filtro por pessoas e ações rápidas. As notificações são agrupadas em "Últimos 7 dias" e "Mais antigas" e suportam infinite scroll.

A arquitetura é multi-tenant: todo acesso exige `org_id` explícito e a função `set_current_org` propaga o contexto para as políticas de RLS. O backend roda em Supabase (Postgres) com gatilhos que mantêm os contadores em `notification_counters` e emitem `pg_notify` para o canal `realtime:notifications:user_{user_id}`.

## Fluxos principais

1. **Carregamento do badge** – `GET /api/notifications/count?orgId=<uuid>` retorna `{ unreadCount }`. O componente usa SWR com refresh a cada 30 s e assina o canal realtime para incrementos instantâneos.
2. **Listagem** – `GET /api/notifications` aceita filtros `tab`, `q`, `people[]`, `cursor`. A resposta possui no máximo 20 itens e um `nextCursor` base64 para paginação.
3. **Marcar como lida** – `POST /api/notifications/read` recebe `{ orgId, ids, status }` e atualiza `status`/`read_at`. Triggers atualizam contadores.
4. **Marcar tudo como lido** – `POST /api/notifications/mark-all-read` aplica em lote para o usuário atual.
5. **Silenciar** – `POST /api/notifications/mute` insere em `notification_mutes` com `scope: "source" | "type"`. Novos inserts consultam `queue_notification` e respeitam mutes.
6. **Preferências** – `GET/PATCH /api/user/preferences` mantêm `email_on_mention_weekly` e `timezone`. O modal permite alterar o resumo semanal e o fuso utilizado nos e-mails.
7. **Resumo semanal** – `send_weekly_mentions_digest()` agrega menções nos últimos 7 dias, agenda via `pg_cron` (domingo 06:00) e dispara webhook interno `POST /api/internal/notifications/weekly-digest` com cabeçalho `x-internal-secret`. O endpoint consulta as notificações (`type='mention'`), agrupa por `source_type`, limita 10 itens por contexto e envia o e-mail `WeeklyMentionsDigest` via Resend/Brevo/noop. Eventos de PostHog: `notifications.weekly_digest_enqueued`, `..._sent`, `..._skipped_pref`.

## Estrutura de dados

- `notifications`: registros individuais. Índices em `(org_id, user_id, created_at DESC)` e `(source_type, source_id)` garantem SLA <150 ms.
- `notification_counters`: mantém `unread_count` por usuário/organização.
- `notification_mutes`: armazena mutes por origem (`scope='source'`) ou tipo (`scope='type'`).
- `user_preferences`: inclui `email_on_mention_weekly` e `timezone` (default `UTC`).
- `notification_digest_events`: histórico dos webhooks do digest, incluindo status e erro.

Todas as tabelas possuem RLS obrigando `org_id = current_org()` e `user_id = auth.uid()` quando aplicável. A função `queue_notification` roda com `SECURITY DEFINER`, valida visibilidade com `can_view_target` e ignora mutes antes de inserir.

## Payloads de API

```jsonc
// GET /api/notifications
{
  "items": [
    {
      "id": "uuid",
      "orgId": "uuid",
      "userId": "uuid",
      "type": "mention",
      "sourceType": "comment",
      "sourceId": "uuid",
      "actor": { "id": "uuid", "displayName": "Ana", "email": "ana@example.com", "avatarUrl": null },
      "title": "Ana comentou",
      "snippet": "@voce revise por favor",
      "link": "https://app.local/...",
      "status": "unread",
      "createdAt": "2024-05-20T12:00:00.000Z",
      "readAt": null
    }
  ],
  "nextCursor": null,
  "unreadCount": 3
}
```

```jsonc
// POST /api/notifications/read
{
  "orgId": "uuid",
  "ids": ["uuid"],
  "status": "read"
}
```

```jsonc
// POST /api/notifications/mute (scope=type)
{
  "orgId": "uuid",
  "scope": "type",
  "type": "mention"
}
```

```jsonc
// PATCH /api/user/preferences
{
  "orgId": "uuid",
  "email_on_mention_weekly": false,
  "timezone": "America/Sao_Paulo"
}
```

## Limites e comportamento

- A API de listagem retorna no máximo 20 itens por página; o badge exibe até "99+".
- O filtro de busca aceita `title` e `snippet` (`ILIKE` com `%term%`).
- Scroll virtualizado guarda posição por 5 minutos (`sessionStorage` em memória).
- A UI usa `TabsContext`, `TabList`, `TabPanels` do `@vibe/core`; o pacote não exporta um wrapper `Tabs`, portanto mantenha o contexto explícito para evitar falhas de build.
- Triggers `sync_notification_counters` garantem consistência mesmo com `DELETE` ou `status` alterado.
- `queue_notification` ignora auto-menções (`actor_id === user_id`) e fontes silenciadas.
- Realtime: payload `pg_notify` contém `{ event: 'notification.created', id, org_id }`.

## Métricas e telemetria

- PostHog eventos do cliente: `notifications.panel_open`, `notifications.tab_change`, `notifications.search`, `notifications.item_open`, `notifications.item_mark_read`, `notifications.mute_source`, `notifications.mark_all_read`, `notifications.realtime_receive`.
- Servidor: `notifications.read_api`, `notifications.mark_all_read_api`, `notifications.mute_api`, `notifications.preferences_updated`, `notifications.weekly_digest_*`.
- Sentry captura: falhas de Supabase (`captureException` em rotas), erros no modal/painel (`captureException` nos `catch`).

## Troubleshooting

| Sintoma | Possível causa | Ação |
| --- | --- | --- |
| Badge fica em 0 mesmo com registros | Falta de `set_current_org` na requisição | Verifique se `orgId` foi enviado e se a rota chamou `applyOrgContext` via `ensureOrgMembership`. |
| Painel carrega vazio | Consulta bloqueada por RLS | Confirme que o usuário é membro ativo (`memberships.status='active'`). |
| Digest semanal não dispara | `pg_cron` desabilitado ou webhook sem segredo | Verifique se `app.weekly_digest_webhook` e `app.internal_webhook_secret` estão configurados e se o job `notifications_weekly_digest` está ativo. |
| Rotas `/api/notifications/*` falham no build | Runtime Edge tentando importar `@supabase/supabase-js` | Forçamos `export const runtime = "nodejs"` em todos os handlers; mantenha a declaração ao criar novos endpoints. |
| Emails não enviados | Provider em modo noop | Veja `ENABLE_EMAIL_SEND` e as variáveis `RESEND_API_KEY`/`BREVO_API_KEY`. Logs em `notifications:email_failed` detalham a causa. |

## Referências rápidas

- Migração: `supabase/migrations/010_notifications_system.sql`
- Seeds demo: `supabase/seed.sql`
- Componentes React: `src/components/ui/topbar/NotificationsBell.tsx`, `src/components/notifications/*`
- APIs: `src/app/api/notifications/*`, `src/app/api/user/preferences/route.ts`, `src/app/api/internal/notifications/weekly-digest/route.ts`
- Pipelines de e-mail: `src/lib/notifications/pipeline.tsx`
