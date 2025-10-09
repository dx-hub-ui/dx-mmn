# Runbook: Pipeline de E-mail

## 1. Provedor indisponível
1. Confirme status via `/api/health/email` (verifique `provider` e `enabled`).
2. Caso o provedor ativo esteja fora, ajuste `ENABLE_EMAIL_SEND=true` + variável do provedor alternativo e redeploy.
3. Atualize `getMailProviderSummary()` para refletir mudança e comunique a squads de CRM/Notificações.
4. Execute `pnpm test:smoke` após a troca para validar renderização e seleção de provider.

## 2. Alta taxa de bounce
1. Revise relatórios do provedor (Resend/Brevo) e identifique domínios específicos.
2. Aplique supressão temporária de listas afetadas na base (desabilitar envios via feature flag se disponível).
3. Ajuste conteúdo das mensagens para remover anexos ou links suspeitos.
4. Reforçe autenticação SPF/DKIM no domínio remetente.

## 3. Throttling ou limites de API
1. Monitore erros `notifications:email_failed` com mensagem contendo `429` ou `rate limit`.
2. Adicione retentativas exponenciais na função chamadora (server action) e reduza batch size.
3. Se o cenário persistir, pause envios não críticos (playbooks ou campanhas) e mantenha apenas transacionais.

## 4. Troca de provedor
1. Garanta que as chaves do novo provedor estejam no Vercel (`BREVO_API_KEY` ou `RESEND_API_KEY`).
2. Ajuste `ENABLE_EMAIL_SEND` conforme a estratégia (produção ou contingência).
3. Atualize templates caso o provedor exija campos específicos (por exemplo, tags adicionais).
4. Execute smoke tests e confirme que `provider` correto aparece no log.
5. Documente a mudança no `CHANGELOG.md` e comunique stakeholders.

## Monitoramento contínuo
- Acompanhe eventos `notifications:email_sent` no PostHog com filtros por `provider` e `template`.
- Configure alertas no Sentry para erros `notifications:email_failed` com taxa acima de 1%.
- Agende revisões mensais de métricas de entregabilidade (open rate, bounce) com marketing.
