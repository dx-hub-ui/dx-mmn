# Runbook: Observabilidade

## 1. Pico de erros 5xx no backend
1. Consulte o dashboard de erros no Sentry filtrando por `environment` e `release` atuais.
2. Use o cabeçalho `x-request-id` para correlacionar logs (Vercel) e traces.
3. Valide a saúde dos provedores via `/api/health/observability`.
4. Identifique módulos afetados pelos tags `module` adicionados nas capturas (`errors:server_exception`).
5. Acione rollback via Vercel se o release corrente estiver impactado e não houver hotfix disponível.
6. Após estabilizar, crie issue com links das ocorrências e proponha ajuste de `tracesSampleRate` caso a carga esteja alta.

## 2. Aumento de erros de cliente (Sentry + PostHog)
1. Cheque o feed de `errors:client_runtime` no PostHog para entender padrões de navegação.
2. Utilize replays do Sentry para visualizar sessão.
3. Se a origem for uma feature flag, desative-a no PostHog e comunique squads impactados.
4. Verifique se há quedas de rede generalizadas (falhas de fetch registradas por `api_request_failed`).

## 3. PostHog fora do ar
1. Falhas na captura aparecerão nos logs do smoke script (`pnpm test:smoke`).
2. Ajuste dashboards para modo degradado e notifique stakeholders que métricas estarão incompletas.
3. Desative feature flags críticas (mantenha fallback local via `useFeatureFlag`).
4. Após restabelecimento, reprocessar eventos manualmente se necessário utilizando `trackServerEvent` a partir de logs.

## Ajuste de amostragem e mitigação
- Reduza `SENTRY_TRACES_SAMPLE_RATE` para 0.05 temporariamente se os limites de ingestão estiverem próximos do teto.
- Ajuste `SENTRY_REPLAYS_SESSION_SAMPLE_RATE` para 0.02 em caso de custo elevado.
- Para PostHog, utilize filtros por `org_id` nos dashboards para focar clientes críticos.

## Comunicação
- Enviar atualização inicial ao canal #incident-observability em até 10 minutos.
- Registrar timeline em doc compartilhado com os carimbos de `request_id` relevantes.
