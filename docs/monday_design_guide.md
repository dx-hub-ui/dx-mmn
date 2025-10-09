# Guia de Design Monday-like da Plataforma DX Hub

> **Objetivo**: alinhar o produto ao visual e às interações do monday.com, garantindo consistência entre páginas, modais, formulários e componentes compartilhados em toda a área autenticada.

## 1. Princípios de Experiência
- **Pessoas no centro**: priorize fluxos colaborativos (atribuição, atualizações, menções) e mantenha ações principais sempre a um clique de distância.
- **Estado sempre visível**: boards, cartões e formulários devem expor status, donos e próximas ações sem depender de cliques extras.
- **Edição inline**: sempre que possível, permita edição direta na linha/célula, mantendo os modais apenas para contextos avançados.
- **Feedback imediato**: cada ação retorna feedback visual (toasts, badges, banners) e atualiza a UI em tempo real.
- **Consistência cross-surface**: mantenha padrões idênticos entre tabela, Kanban, calendário e visão de formulário.

## 2. App Shell e Layout Base
- Utilize `AppShell` (`src/components/ui/AppShell.tsx`) como wrapper padrão. Ele já injeta Topbar fixa, Sidebar colapsável e Main rolável.
- O `SurfaceControl` gerencia temas e tokens de superfície, garantindo alinhamento ao gradiente Monday-like.
- Tokens críticos (definidos em `src/app/globals.css`) que **devem** ser reaproveitados:
  | Token | Uso | Valor padrão |
  | --- | --- | --- |
  | `--dx-top-bar-height` | Altura do topo fixo | `56px` |
  | `--dx-sidebar-width` / `--dx-sidebar-collapsed-width` | Larguras da navegação | `272px` / `64px` |
  | `--dx-radius-sm/md/lg` | Raios padrão | `8px / 12px / 16px` |
  | `--dx-primary` | Ação principal | `#0073EA` (ajustado por tema) |
  | `--application-background-color` / `--application-surface-color` | Fundo principal/canvas | Tema claro `#fff / #f6f7fb` |
- Canvas de páginas: aplique `min-height: calc(100dvh - var(--dx-top-bar-height))` e mantenha padding interno com `var(--page-padding-x/y)`.

## 3. Navegação & IA visual
- **Topbar**: usa gradiente suave (`--dx-topbar-bg`). Estrutura-se em três colunas: marca à esquerda, espaço livre central para futuros itens contextuais e, à direita, os atalhos (ex.: Inbox com `@vibe/core/IconButton` + `@vibe/icons/Inbox`) seguidos do menu do usuário (avatar grande).
- **Sidebar**: segmentos com agrupamentos (Workspace, Favoritos, Recents). Ícones `@vibe/icons` nos tamanhos 18/20px.
- Estados do menu: ativo (`--dx-primary-selected`), hover (`--dx-primary-selected-hover`), desabilitado (`--disabled-text-color`).
- Dropdowns de Workspaces devem abrir para a direita com largura mínima de 280px.

## 4. Tipografia & Ícones
- Fontes: `--font-family` para texto, `--title-font-family` para headings.
- Hierarquia sugerida:
  - H1: 24px / `--lh-32`, peso 600.
  - H2: 20px / `--lh-28`, peso 500.
  - Corpo: 14-16px, `line-height` 20-24px.
- Ícones via `@vibe/icons`; combine com texto usando espaçamento horizontal de `8px` (`--dx-space-2`).

## 5. Paleta & Temas
- Respeite as variáveis já definidas para light/dark (`body#main.light-app-theme`, `body#main.dark-app-theme`).
- Status de colunas estilo Monday:
  - **Done**: use `--positive-color` (`#00854d`).
  - **Stuck**: `--negative-color` (`#d83a52`).
  - **Working on it**: `--dx-primary`.
  - **Waiting for review**: `#ffcb00` (`--warning-color`).
- Bordas internas com `--ui-border-color` (divisórias) e cartões/tiles com sombra `--shadow-md` quando elevados.

## 6. Layouts de Página
- **Boards** (Tabela, Kanban, Calendar):
  - Toolbar fixa sob o header com filtros, Views, botões de automações.
  - Seções: `BoardHeader` (titulo, descrição, star, share), `BoardToolbar`, `BoardContent` (scroll independente).
  - Utilize `@tanstack/react-table` para tabela, com colunas reordenáveis e cabeçalho sticky.
- **Dashboards**:
  - Grid responsivo (`repeat(auto-fit, minmax(320px, 1fr))`). Cards com header (icone + título), KPI e footer com CTA.
- **Páginas de Configuração**:
  - Navegação secundária em tabs (horizontal) usando `@vibe/core` `Tabs`.
  - Conteúdo em seções com cards empilhados (Padding 24px, gap 20px).

## 7. Modais e Side Panels
- Dimensões: modais padrão 720px largura, `max-height: calc(100dvh - 96px)`; side panel 480px.
- Cabeçalho com título, subtexto opcional e botão close à direita (ícone `NavigationClose`).
- Body com padding 24px, separado por divisórias (`border-bottom: 1px solid var(--dx-border)` para seções).
- Footer fixo com botões primário/secondary (`@vibe/core` `Button`, `ButtonType.PRIMARY/SECONDARY`).
- Acessibilidade: foco inicial no primeiro elemento interativo, `Esc` fecha, `aria-modal="true"`.

## 8. Formulários & Campos
- Baseie-se em `@vibe/core`:
  - Inputs: `TextField`, `NumberInput`, `TextArea`, `Dropdown`, `AutoComplete`, `DatePicker`, `Tags`, `PeoplePicker`.
  - Use `@vibe/core` `Label` + `FormField` para layout consistente.
- Padrões Monday:
  - Colunas de board viram **campos** no modal (Status, Timeline, People, Numbers, Text, Tags, Files, Mirror).
  - Inline edit com `Editable` do `@vibe/core` + contorno `var(--dx-primary-selected)`.
  - Erros inline exibem texto 12px em `--negative-color` e ícone `Alert`.
  - Placeholders em cinza `--secondary-text-color`, com bordas `--ui-border-color`.
- Validação: síncrona (no blur) e assíncrona (no submit) com mensagens agregadas no topo quando houver múltiplos erros.
- Autocomplete e PeoplePicker exibem avatar 32px, label + função, highlight de match.

## 9. Atualizações (Update Feed)
- Padrão Monday: painel lateral com editor rich text, menções e uploads.
- Use `update-feed-overlay.tsx` como base e mantenha layout com lista cronológica, timeline com carimbo de data/hora e badges de status.
- Reagir a eventos do board (mudança de status, atribuição) com posts automáticos visíveis no feed.

## 10. Filtros, Views & Saved Filters
- Barra de filtros sempre abaixo do header, com chips (`@vibe/core` `Tag`) representando filtros ativos.
- Modal de `Save View` herdando tokens de modal padrão, guardando ícone, cor e visibilidade (private/share/team/workspace).
- Views suportadas: Main Table, Kanban, Calendar, Chart, Form, Dashboard widgets.
- Persistir preferências por usuário + board (`/api/crm/views`).

## 11. Tabelas & Boards
- Header sticky, zebra rows (`background: rgba(103,104,121,0.04)`).
- Resizing com handle `::after` 4px.
- Checkboxes `@vibe/core` para seleção múltipla, Bulk Actions bar flutuante inferior.
- Kanban: colunas com header (Status + contagem + SLA) e cards arrastáveis `@dnd-kit`.
- Calendário: estilo Monday `Timeline` com faixas coloridas (usando cor da coluna).

## 12. Experiência Mobile & Responsiva
- Breakpoints: `--bp-sm: 640px`, `--bp-md: 960px`, `--bp-lg: 1280px` (definir via CSS custom properties ou `clamp`).
- Sidebar colapsa automaticamente abaixo de 1280px; substitua por Drawer full-height (component `Dialog` do `@vibe/core`).
- Tabela vira cartões empilhados com seções colapsáveis. Toolbar vira menu "More".

## 13. Acessibilidade
- Navegação por teclado completa: `Tab`, `Shift+Tab`, `Arrow Keys` em boards, `Enter`/`Space` para abrir modais.
- `aria-live="polite"` para toasts (confirmação/erro).
- Contraste mínimo 4.5:1 para textos; teste variações dark mode.

## 14. Animações & Motion
- Duração padrão: `var(--dx-sidebar-anim, 320ms)` com `cubic-bezier(.4,0,.2,1)`.
- Aparecimento de dropdowns/modais com fade + slide 8px.
- Respeite `prefers-reduced-motion`; desabilite transições onde necessário.

## 15. Feedback & Estados
- **Loading**: skeletons com brilho (gradiente linear 90°). Use `@vibe/core` `Skeleton` onde disponível.
- **Empty state**: ilustração 120px, título, descrição e CTA primário.
- **Erro**: banners `@vibe/core` `Notification` com `status="danger"`.
- **Success**: toast `@vibe/core` `Toast` posicionado canto inferior esquerdo (padrão Monday).

## 16. Integrações & Automations
- Botão "Automate" abre modal com listagem de receitas (cards 360px) agrupadas por categoria. Use pill `Automations` com cor `var(--dx-primary)`.
- Integrações exibem badges com logo + cor da marca (ex.: Slack, Gmail). Cards 344x96px com call-to-action.

## 17. Multi-idioma
- Textos devem ser registrados no sistema de i18n. Mantenha placeholders com variáveis nomeadas (`{count}`) e evite concatenação direta.
- RTL: verifique alinhamentos em línguas de escrita direita-esquerda (hébraico/árabe) aproveitando fontes do token global.

## 18. Checklist de Implementação
- [ ] Usa `AppShell` e tokens globais sem duplicar valores mágicos.
- [ ] Componentes principais via `@vibe/core` e ícones `@vibe/icons`.
- [ ] Layout e espaçamentos seguindo `--dx-space-*`.
- [ ] Estados (loading/empty/error) previstos.
- [ ] Responsividade testada em breakpoints principais.
- [ ] Acessibilidade validada (foco, aria, contraste).
- [ ] Temas claro/escuro inspecionados.
- [ ] Telemetria/feedback conectado quando aplicável.

---

### Referências Complementares
- Tokens globais: `src/app/globals.css`.
- App Shell e navegação: `src/components/ui/AppShell.tsx`, `sidebar.tsx`, `topbar.tsx`.
- Update Feed / overlay: `src/components/ui/update-feed-overlay.tsx`.
- Módulo CRM atual: `docs/crm_readme.md` para entender estrutura de boards/contatos.
