# Setup de Desenvolvimento — CRM de Contatos

## 1. Pré-requisitos
- Supabase CLI 1.158+ e Docker em execução (`supabase start` depende de containers locais).
- Node.js 18+ com pnpm (10.x recomendado).
- Arquivo `.env.local` configurado com as chaves do Supabase:
  ```env
  NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
  NEXT_PUBLIC_SUPABASE_ANON_KEY=...
  NEXT_PUBLIC_SITE_URL=http://localhost:3000
  SUPABASE_URL=http://127.0.0.1:54321
  SUPABASE_SERVICE_ROLE_KEY=...
  ```
  > Em desenvolvimento, você pode copiar os valores gerados pelo `supabase start` (arquivo `.env` na pasta `.supabase`).

## 2. Provisionar banco e dados demo
```bash
supabase start
supabase db reset --use-migra --seed supabase/seed.sql
```
Isso aplica todas as migrações (`000_*.sql`, `001_crm_contacts_extensions.sql`, `002_crm_contact_events.sql`) e popula contatos de exemplo com cadeias de indicação, eventos de timeline e próximos passos.

## 3. Instalar dependências
```bash
pnpm install
```

## 4. Rodar a aplicação
```bash
pnpm dev
```
A aplicação fica disponível em `http://localhost:3000`. Usuários seed: `owner@example.com`, `leader@example.com`, `rep1@example.com`, `rep2@example.com` (login via magic link/OTP).
> **Fluxo de login:** o callback `/auth/callback` aguarda `supabase.auth.initialize()` detectar a sessão PKCE/implicit, consulta `getSession()` e, se necessário, usa `verifyOtp` com `token_hash` legado antes de sincronizar os cookies via `/auth/sync`. O middleware (`src/middleware.ts`) agora delega a validação ao `createServerClient`, preservando os cookies emitidos pelo Supabase.

## 5. Scripts úteis
| Script | Descrição |
| --- | --- |
| `pnpm lint` | ESLint com preset Next.js. |
| `pnpm typecheck` | `tsc --noEmit` para validar tipos. |
| `pnpm test` | Testes unitários/funcionais via Vitest + Testing Library. |
| `pnpm test:watch` | Watch mode do Vitest. |
| `pnpm e2e` | Playwright com projeto Chromium. Requer Supabase rodando e variáveis `NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY`. |
| `pnpm build` | Build de produção do Next.js. |

## 6. Execução de testes
1. **Unit/component:**
   ```bash
   pnpm test
   ```
2. **Lint & Typecheck:**
   ```bash
   pnpm lint
   pnpm typecheck
   ```
3. **E2E (opcional, exige Supabase em execução e sessão válida):**
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
   NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
   pnpm e2e
   ```
   O teste `crm-board.spec.ts` é automaticamente ignorado caso as variáveis não estejam definidas.

## 7. Dados realistas
O seed inclui:
- Estágios distribuídos (`novo`, `contatado`, `qualificado`, `followup`, `cadastrado`, `perdido`).
- Scores (0-100) e próximos passos com datas futuras/passadas.
- Cadeia de indicações (`referred_by_contact_id`) para validar a coluna "Indicado por" e a view "Indicados por mim".
- Eventos de timeline (`contact_events`) simulando criação, mudança de estágio e atualização de próximo passo.
- Dedupe garantido por índices (`organization_id + whatsapp` e `organization_id + email`).

## 8. Telemetria e logs
- `src/lib/telemetry.ts` encaminha eventos para `window.analytics` ou `dataLayer`. Em desenvolvimento, caem em `console.debug`.
- Para depurar chamadas Supabase, use `supabase logs tail` em paralelo.

## 9. Fluxo de importação CSV
1. Gere um arquivo `.csv` com cabeçalho contendo ao menos `nome` (outros campos aceitos: `email`, `telefone`, `dono`, `estágio`, `tags`, `origem`, `próximo passo`, `próximo passo data`, `indicado por`, `motivo perda`, `revisar em`). Delimitadores `,` e `;` são suportados.
2. No board, clique em **Importar CSV** e envie o arquivo. O modal executa o *dry-run* automaticamente e apresenta a tabela de erros.
3. Resolva avisos (ex.: dono não encontrado, telefone inválido) e clique em **Aplicar importação** para persistir.
4. Para testes automatizados, use o comando Playwright (`pnpm e2e`) após iniciar o Supabase; a spec `crm-board.spec.ts` cobre abertura do modal de importação.

## 10. Checklist Sprint 1
- [x] Migração + seed atualizados.
- [x] Board com filtros, views salvas, agrupamento e virtualização.
- [x] Criação/edição inline com validação BR (telefone E.164) e dedupe.
- [x] Seleção persistente com telemetria.
- [x] Documentação (este arquivo + `docs/crm_readme.md`).

## 11. Checklist Sprint 2
- [x] Modal de contato com tabs (Atividades, Dados, Próximo passo, Indicações) e timeline baseada em `contact_events`.
- [x] Kanban de estágios com drag & drop (`@dnd-kit`), refletindo filtros/views ativos.
- [x] Telemetria adicionada (`crm/contact_modal_*`, `crm/contact_stage_changed`).
- [x] Testes atualizados (Vitest para modal/kanban + Playwright com troca de modo e modal).

## 12. Checklist Sprint 3
- [x] Barra de ações inferior com permissões por papel e telemetria (`crm/bulkbar_open`, `crm/bulk_action_execute`).
- [x] Fluxo completo de importação CSV (dry-run + aplicação) validado com dados realistas.
- [x] Relatórios Funil/Top Indicantes disponíveis na página e cobertos por testes de componente.
- [x] Eventos de telemetria para `crm/owner_changed`, `crm/next_step_set`, `crm/referral_linked` emitidos a partir das mutações.
