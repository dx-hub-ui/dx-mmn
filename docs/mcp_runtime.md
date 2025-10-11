# Workspace MCP integrado ao app

## Visão geral

O app agora expõe uma área dedicada em `/mcp` que consome o servidor **Vibe MCP** para entregar:

- Catálogo pesquisável de componentes (`list-vibe-public-components`) com detalhes, props e exemplos oficiais.
- Painel de tokens (`list-vibe-tokens`) com descrições e valores para aplicar aos estilos do CRM.
- Biblioteca de ícones (`list-vibe-icons`) com tags e caminhos de import para acelerar o design.

A página usa componentes `@vibe/core`, tokens de aplicação (`--dx-*`) e telemetria (`mcp.component_selected` / `mcp.component_metadata_viewed`) para medir adoção.

## Pré-requisitos

1. Tenha Node 18+ instalado e as dependências do projeto resolvidas (`pnpm install`).
2. Execute o servidor MCP localmente:
   ```bash
   pnpm mcp:dev
   ```
   O script chama `npx -y @vibe/mcp` e expõe o endpoint padrão em `http://127.0.0.1:8848/invoke`.
3. Opcional: defina variáveis de ambiente para apontar para outra origem ou injetar token de acesso:
   ```env
   VIBE_MCP_BASE_URL=http://127.0.0.1:8848
   VIBE_MCP_API_TOKEN=... # se o servidor exigir autenticação Bearer
   ```
   Reinicie o Next.js após alterar esses valores.

## Fluxo de dados

- Os route handlers `GET /api/mcp/*` atuam como BFF, encapsulando chamadas ao MCP e padronizando erros.
- O client `src/lib/mcp/client.ts` valida as respostas com `zod` antes de repassar para o front.
- A UI consome os endpoints via SWR com debounce de 300 ms, mantendo a navegação fluida.

## Telemetria

| Evento                           | Disparo                                       | Payload           |
|----------------------------------|-----------------------------------------------|-------------------|
| `mcp.component_selected`        | Usuário seleciona um item no catálogo         | `{ componentId }` |
| `mcp.component_metadata_viewed` | Usuário confirma a leitura do painel detalhado | `{ componentId }` |

## Troubleshooting

| Sintoma                                               | Ação sugerida |
|-------------------------------------------------------|---------------|
| Lista vazia / erro 502 em `/api/mcp/*`                | Confirme se o servidor MCP está ativo e se `VIBE_MCP_BASE_URL` aponta para a URL correta. |
| Props retornam vazias                                 | Execute `pnpm mcp:dev` com a versão mais recente do pacote `@vibe/mcp`. |
| Telemetria não aparece no PostHog/Segment             | Verifique se `window.posthog` ou `window.analytics` está configurado no ambiente de teste. |
