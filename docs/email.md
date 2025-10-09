# Email Platform

## Arquitetura
Os provedores de e-mail são abstratos pela camada `src/lib/email`. O `getMailProvider()` escolhe automaticamente o provedor ativo seguindo a ordem:

1. `Resend` (quando `RESEND_API_KEY` está configurada)
2. `Brevo` (quando `BREVO_API_KEY` está configurada)
3. `Noop` (quando nenhum provider está disponível ou quando o envio está desativado)

Envios reais só ocorrem quando `VERCEL_ENV === "production"` ou `ENABLE_EMAIL_SEND === "true"`. Em ambientes preview, o provedor no-op apenas registra no console.

## Templates
Os templates vivem na pasta `/emails`. Utilize o layout `TransactionalLayout` para manter identidade visual e responsividade. Para criar um novo template:

1. Adicione um componente React em `/emails` retornando o conteúdo dentro de `TransactionalLayout`.
2. Importe o template no pipeline (`src/lib/notifications/pipeline.ts`) e chame `renderEmail` para gerar o HTML.
3. Atualize os testes de fumaça se quiser validar o novo template.

### Atualizar templates existentes
- Garanta que o texto esteja em português e não inclua dados sensíveis.
- O layout tem largura fixa de 600px; mantenha estrutura com `<p>` e links com `https`.
- Evite CSS externo: use estilos inline para máxima compatibilidade.

## Entregabilidade
- **SPF/DKIM**: configure registros DNS para os domínios usados (`RESEND_FROM`). Consulte a documentação do provedor escolhido.
- **DMARC**: recomenda-se política `p=quarantine` ou `p=reject` após monitoramento inicial.
- **Reputação**: monitore taxas de bounce e spam via dashboards dos provedores.

## Testes locais
- Execute `pnpm test:smoke` para renderizar o template `TestPingEmail` e exibir o provedor detectado sem enviar e-mails.
- Utilize `ENABLE_EMAIL_SEND=true pnpm test:smoke` para simular seleção de provider em ambientes não produtivos.

## Salvaguardas de produção
- `getEmailProviderSummary()` retorna status e é usado em `/api/health/email`.
- Cabeçalhos e tags são suportados por ambos os provedores; use `tags` para rastrear campanhas ou métricas de sucesso.
- Erros de envio disparam evento `notifications:email_failed` e são capturados pelo Sentry.
