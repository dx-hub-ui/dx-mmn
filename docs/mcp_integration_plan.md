# Vibe MCP Integration Analysis & Rollout Plan

## Summary of MCP capabilities
- The Vibe MCP server exposes a suite of Model Context Protocol tools tailored for Vibe consumers. Core discovery endpoints like `get-vibe-component-metadata`, `list-vibe-public-components` and `get-vibe-component-examples` provide up-to-date APIs, best practices and React snippets for each component, while `get-vibe-component-accessibility` surfaces compliance guidance.
- Design system resources include `list-vibe-icons` (270+ icons with filtering, usage samples and import statements) and `list-vibe-tokens` (color, spacing, border radius, motion timing tokens) to keep implementations aligned with Monday's visual language.
- Migration helpers (`v3-migration`, `dropdown-migration`) scan entire projects, flag breaking changes and output codemod commands plus file-specific recommendations, easing the transition from legacy components.
- Installation is lightweight: both Cursor and VS Code clients can point to an `npx -y @vibe/mcp` command via their MCP configuration files, enabling assistants to spin up the server on demand.
- Typical workflows described in the documentation include component development, icon discovery, token lookup and guided migrations, each driven by natural-language prompts that the MCP tools fulfill programmatically.

## Fit assessment for this repository
- Our CRM surface already leans heavily on `@vibe/core` primitives (`Tabs`, `Table`, Kanban tooling) and Monday-aligned design tokens, as captured in `docs/crm_readme.md`. Embedding MCP-powered assistants would shorten the learning curve for new contributors when they need canonical props, accessibility notes or example code.
- The project depends on `@vibe/core`/`@vibe/icons` packages (see `package.json`), so the MCP's component metadata and icon catalog are immediately relevant to the widgets rendered across `/crm`, `/inbox` and `/sequences`.
- We maintain extensive internal documentation (see `docs/*.md`). MCP's migration tooling can act as an automated audit when we adopt `@vibe/core/next` releases or upgrade long-lived modules like `ContactsKanban`, ensuring parity between code and design guidance.
- The MCP server is distributed as a CLI (`npx -y @vibe/mcp`). Because our engineering workflow already tolerates Node-based tooling and we have automation scripts in place, hosting or invoking the server during development and CI is viable.
- No sensitive tenant data needs to be shared: MCP only reads Vibe assets. This keeps our Supabase-backed CRM footprint isolated while still benefiting from AI-assisted queries.

## Implementation plan

> **Atualização:** a Fase 1 foi concluída com o workspace `/mcp`, handlers `GET /api/mcp/*` e script `pnpm mcp:dev`. Consulte [docs/mcp_runtime.md](mcp_runtime.md) para detalhes operacionais.

### Phase 1 — Foundations (1 sprint)
1. **Pilot environment**: add optional MCP server bootstrap scripts to the dev tooling (e.g., `pnpm run mcp:dev` invoking `npx -y @vibe/mcp`) and document MCP setup in the onboarding guide.
2. **Assistant wiring**: configure our preferred AI assistants (Cursor, VS Code MCP extension) to register the Vibe server using the documented JSON snippets; validate authentication scopes if any tokens are required.
3. **Knowledge capture**: map our most frequent component, icon and token questions to the MCP toolset. Curate a baseline of prompts that replicate flows described in the documentation (component development, icon discovery, token lookup, migration planning).
4. **Security review**: confirm the MCP process runs locally without connecting to internal Supabase endpoints. Document safe usage practices in the security section of the README.

### Phase 2 — Development integration (1–2 sprints)
1. **DX automation**: embed MCP checks into pull-request templates or CI jobs that surface migration findings (e.g., run `v3-migration` weekly and publish reports to the repo).
2. **Component scaffolding**: augment our `@vibe/code` storybook or component generators to call `get-vibe-component-examples` when developers scaffold new UI, ensuring parity with design tokens and accessibility guidance.
3. **Documentation sync**: create a living page in `docs/` that aggregates MCP-driven insights (e.g., recommended props per component, recently added icons) so tribal knowledge is preserved even when assistants are offline.
4. **Telemetry alignment**: extend our instrumentation (`src/lib/telemetry.ts`) to log when MCP-recommended migrations are applied, enabling us to measure adoption and payback.

### Phase 3 — Adoption & scaling (ongoing)
1. **Training**: host internal workshops demonstrating MCP-powered workflows and how they map to our CRM modules.
2. **Feedback loop**: track friction points, submit upstream issues or PRs to the open-source MCP repo when gaps emerge, and request new tools tailored to our needs.
3. **Governance**: schedule quarterly reviews comparing our `docs/` guidance with MCP outputs, ensuring divergence is caught early.
4. **Expansion**: once stable for CRM, replicate the integration for other Monday-inspired workstreams (notifications, sequences) and consider bundling the MCP bootstrap with containerized dev environments.

## Risks & mitigations
- **Assistant dependency**: If AI integrations fail, developers should still rely on the documented prompts and manual Storybook navigation. Keep critical MCP insights mirrored in version-controlled docs.
- **Version drift**: Align MCP updates with our dependency upgrade cycle. Pin MCP server versions during CI runs and validate against staging components before rolling out to all developers.
- **Onboarding overhead**: Provide ready-to-import MCP config files and short tutorials so new hires can enable the assistant without manual JSON editing.

## Success metrics
- Reduced time-to-first-PR for designers/developers new to Vibe components.
- Fewer documentation mismatches reported during code review thanks to codemod guidance.
- Increased adoption of consistent icon/token usage across CRM and associated modules.
