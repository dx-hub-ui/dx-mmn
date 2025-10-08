# Plataforma B2B2C com Supabase e Next.js

Este repositório contém a base de uma aplicação Next.js 14 (App Router) integrada ao Supabase com autenticação, multi-tenancy e controle de papéis (org, leader, rep) para um CRM de marketing multinível.

## Pré-requisitos

- [Supabase CLI](https://supabase.com/docs/guides/cli) 1.158+.
- Node.js 18+ com pnpm (ou npm/yarn/bun, adapte os comandos conforme necessário).
- Variáveis de ambiente configuradas no arquivo `.env.local` do Next.js e em `.env` das Edge Functions (ver seção [Variáveis de ambiente](#variáveis-de-ambiente)).

## Como rodar localmente

1. Inicie os serviços do Supabase:
   ```bash
   supabase start
   ```
2. Aplique as migrações e seeds de desenvolvimento:
   ```bash
   supabase db reset --use-migra --seed supabase/seed.sql
   ```
   > O reset executa todas as migrações e popula dados demo (organização ACME, um líder e dois representantes).
3. Opcional: sirva as Edge Functions localmente para testes integrados:
   ```bash
   supabase functions serve
   ```
4. Instale dependências do projeto e inicie o Next.js:
   ```bash
   pnpm install
   pnpm dev
   ```
5. A aplicação ficará disponível em `http://localhost:3000`.

## Configuração de autenticação (Email OTP / Magic Link)

1. No [dashboard do Supabase](https://app.supabase.com/), acesse **Authentication > Providers**.
2. Habilite **Email** e selecione **Magic Link** ou **OTP** conforme desejado.
3. Configure o domínio de envio de e-mails ou utilize o serviço padrão do Supabase em ambiente de desenvolvimento.
4. Atualize as variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` com os valores do projeto.
5. Defina `NEXT_PUBLIC_SITE_URL` com a URL pública do frontend (ex.: `http://localhost:3000` em desenvolvimento ou `https://app.dxhub.com.br` em produção). Ela é utilizada como base para gerar o `emailRedirectTo` enviado ao Supabase.
6. Para testar localmente, crie usuários via Magic Link ou usando o seed incluído (com emails `owner@example.com`, `leader@example.com`, etc.).

## Login via Magic Link

1. Acesse `http://localhost:3000/` (a tela de login também está disponível em `/sign-in` para links diretos) e, opcionalmente, informe `redirectTo` para personalizar o destino após o login (por padrão `/dashboard`).
2. Informe o email associado ao seu usuário e envie o formulário para receber um link mágico.
3. O Supabase redirecionará para `/auth/callback`. O callback chama `exchangeCodeForSession` para trocar códigos PKCE, tenta `verifyOtp` com `token_hash` ou `token` limitando-se aos tipos de OTP por email (`magiclink`, `signup`, `invite`, `recovery`, `email`, `email_change`) e, se necessário, aceita `setSession` com `access_token`/`refresh_token` encontrados no fragmento. Ao confirmar a sessão, forçamos `supabase.auth.setSession` no browser para persistir os tokens (com `persistSession` + `autoRefreshToken`) e só então sincronizamos os cookies HTTP-only via `/auth/sync` (requisição com `credentials: "include"`) antes de seguir para o destino `redirectTo` (padrão `/dashboard`). Esse fluxo ignora com segurança erros de `code_verifier` quando o link é aberto em outro dispositivo.
4. Se precisar reenviar o link, basta repetir o processo; a tela exibirá o status da solicitação e qualquer erro retornado pelo Supabase.

> **Dica:** durante o desenvolvimento, configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` com os valores do projeto para que o formulário fique ativo. Em ambientes de review, a interface informa quando as variáveis não estão configuradas.

## Dashboard protegido

- Após a autenticação, os usuários são direcionados para `/dashboard`, página inicial da área logada.
- A sidebar fixa destaca a entrada **Dashboard** (antiga "Home") como atalho principal para essa visão inicial.
- A tela lista os dados básicos do usuário logado (nome, email e UUID) para facilitar depuração.
- Também apresenta todos os vínculos (`memberships`) do usuário com as organizações, destacando o papel (`org`, `leader`, `rep`) e o status de cada associação para validar cenários de permissão.
- Utilize esta visualização para testar rapidamente como o conteúdo deverá variar conforme o papel em futuras implementações.

## Variáveis de ambiente

### Next.js (`.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=...        # URL do projeto Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # Chave pública (anon)
NEXT_PUBLIC_SITE_URL=...            # URL pública usada nos links mágicos
SUPABASE_URL=...                    # Mesma URL para chamadas a Edge Functions
SUPABASE_SERVICE_ROLE_KEY=...       # Chave service role (mantida somente no servidor)
```

> **Atenção:** `SUPABASE_SERVICE_ROLE_KEY` nunca deve ser exposta ao cliente. Ela é utilizada exclusivamente em rotas servidoras para chamar Edge Functions.

### Edge Functions (`supabase/functions/.env` ou variáveis de deploy)

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Quando publicar, configure as mesmas variáveis no Supabase para cada função.

## Fluxo funcional

1. **Login seguro** (`/` ou `/sign-in` + `/auth/callback` + `/dashboard`):
   - Usuários solicitam um link mágico de acesso na landing inicial da aplicação.
- Após confirmar o link recebido por email, o browser é redirecionado para `/auth/callback`, que chama `exchangeCodeForSession` para trocar códigos PKCE, tenta `verifyOtp` com `token_hash`/`token` apenas para tipos de OTP por email (magic link, signup, invite, recovery, email, email_change) e, em último caso, aceita `access_token`/`refresh_token`. Em seguida, forçamos `supabase.auth.setSession` para gravar a sessão persistente no browser e sincronizamos cookies HTTP-only via `/auth/sync` com `credentials: "include"`, garantindo que o usuário continue autenticado mesmo após fechar o navegador.
2. **Criação automática de organização** (`handle_new_user` + `memberships`):
   - Assim que um usuário confirma o cadastro via Supabase, o gatilho `handle_new_user` cria uma organização padrão, gera o membership com papel `org` e espelha os metadados em `public.profiles`.
   - A rota `POST /api/orgs/create` continua disponível para permitir que o usuário cadastre organizações adicionais com slug personalizado quando necessário.
3. **Geração de convite** (`POST /api/invites/generate`):
   - Somente `org` e `leader` ativos podem gerar convites para `leader` ou `rep`.
   - Pode-se amarrar um novo `rep` a um líder específico (hierarquia) através de `parentLeaderId`.
   - Edge Function `generate_invite` retorna apenas o token do convite; combine com sua URL pública para compartilhar.
4. **Resgate de convite** (`POST /api/invites/redeem`):
   - Usuário autenticado envia o token.
   - Edge Function `redeem_invite` valida uso/expiração, cria (ou ajusta) o membership e incrementa `used_count`.
   - A rota Next.js redireciona para `/app/:slug` da organização correspondente.

## Cenários de teste de RLS

Os dados seedados permitem validar a visibilidade no CRM (`public.contacts`):

1. **Representante (rep1@example.com):**
   - Faça login como rep1 e tente listar contatos (`SELECT * FROM public.contacts`).
   - Resultado esperado: apenas contatos com `owner_membership_id = cccc3333-cccc-3333-cccc-333333333333`.
   - Tentar atualizar um contato pertencente a outro rep deve falhar (violação de política RLS).
2. **Líder (leader@example.com):**
   - Deve conseguir ver os próprios contatos (`owner_membership_id = bbbb2222-...`) e os contatos de seus reps subordinados (`cccc...` e `dddd...`).
   - Inserir um novo contato para um rep subordinado é permitido desde que `owner_membership_id` pertença à subárvore.
3. **Org owner (owner@example.com):**
   - Consegue visualizar e inserir contatos para qualquer membership da organização.

Use o Supabase Studio com a opção **JWT override** ou tokens gerados via CLI (`supabase auth sign-in --email ...`) para simular cada usuário.

## Boas práticas e segurança

- Todas as mutações sensíveis (criação de organização, geração e resgate de convites) passam por Edge Functions com Service Role e validações de negócios.
- RLS está habilitado em `memberships`, `contacts` e `invite_links`. Apenas leituras necessárias são liberadas aos usuários autenticados.
- Função SQL `visible_membership_ids` calcula dinamicamente a subárvore de visibilidade, garantindo isolamento entre organizações e hierarquias.
- `public.profiles` permanece sincronizada com `auth.users` através dos gatilhos `handle_new_user` (espelhamento + criação da organização padrão) e `handle_deleted_user` (remoção automática de perfis órfãos). A política `memberships_select_visible` delega a verificação à função `can_access_membership` (security definer), que desativa temporariamente o RLS durante o cálculo para consultar `visible_membership_ids` sem provocar recursão.
- Não exponha a Service Role key no cliente; somente rotas servidoras ou funções no backend devem utilizá-la.
- Utilize HTTPS e configure domínios confiáveis de redirecionamento no Supabase para evitar abuso em convites.

## Referências úteis

- [Documentação do Supabase Auth](https://supabase.com/docs/guides/auth)
- [RLS no Supabase](https://supabase.com/docs/guides/auth/row-level-security)
- [Edge Functions](https://supabase.com/docs/guides/functions)
- [Next.js App Router](https://nextjs.org/docs/app)
