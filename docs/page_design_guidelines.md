# Guidelines para Desenvolvimento de Novas Páginas

> **Escopo:** este guia define como criar telas novas usando o nosso **AppShell** (Topbar + Sidebar fixos, Main rolável), mantendo consistência visual, acessibilidade e performance.

## 1) Layout & Estrutura
- **Use sempre o AppShell**: páginas devem ser renderizadas dentro de `src/app/(app)/layout.tsx` que injeta `<AppShell>...`.
- **Não altere Topbar/Sidebar**: respeite as APIs expostas (ex.: `isSidebarOpen`) e evite CSS que vaze para esses componentes.
- **Menu do usuário**: o avatar (`@vibe/core/Avatar` com `size="large"`) fica ancorado no canto direito da Topbar, encostado no padding externo da barra. O `MenuButton` precisa manter o avatar quadrado (40px) sem esticar e o menu deve abrir acima de qualquer outro overlay (`z-index` alto) garantindo que tooltips e dropdowns não fiquem atrás da Sidebar. O menu expõe "Minha conta", "Mudar tema" (Claro/Escuro/Noite com estado selecionado) e "Logout"; teclas de navegação/ESC precisam funcionar. **Sempre envolva submenus em `<Menu>`** (ex.: opções de tema) para cumprir a expectativa de `React.Children.only` do `@vibe/core/MenuItem` e evitar erros em runtime.
- **Modal "Minha conta"**: use `@vibe/core/Modal` com tabs "Visão geral" (IDs apenas leitura) e "Perfil" (inputs, textarea e upload de avatar). Valide client/server, mantenha o campo obrigatório de "Nome exibido" (display name) e emita telemetria (`profile/save_*`, `avatar/upload_*`).
- **Observabilidade**: capture exceções inesperadas do menu/modal com `captureException` (`@sentry/nextjs`) para manter o rastreio de falhas no cliente.
- **Temas suportados**: a `<html>` recebe classes `theme-light`, `theme-dark` ou `theme-night`; `body#main` combina com `light-app-theme`/`dark-app-theme`/`night-app-theme`. Sempre aplique alterações via helpers de `src/lib/theme.ts` para sincronizar `localStorage` e o Supabase.
- **Main rolável**: todo conteúdo da página vive dentro de `.main > .canvas`.
- **Canvas full-bleed**: o canvas deve ocupar 100% da largura/altura da área visível do main. Não adicione paddings externos ao `main`.

```tsx
// Exemplo de página Next (RSC ou Client conforme necessário)
export default function MinhaPagina() {
  return (
    <section aria-labelledby="titulo" className="page">
      <header className="pageHeader">
        <h1 id="titulo">Título da Página</h1>
        <p className="subtitle">Breve descrição opcional</p>
      </header>
      <div className="pageBody">{/* conteúdo */}</div>
    </section>
  );
}
```

## 2) Tokens de Design & CSS
- **Importe estilos base do Vibe** em `src/app/globals.css` com `@import "monday-ui-style/dist/index.css";` antes de qualquer declaração `@tailwind`, garantindo que o CSS seja carregado uma única vez sem gerar avisos de preload no navegador.
- **Variáveis globais** (definidas no tema):
  - Dimensões: `--dx-top-bar-height`, `--dx-sidebar-width`, `--dx-sidebar-collapsed-width`.
  - Cores: `--dx-bg`, `--dx-text`, `--dx-border`, `--surface-color`, etc.
- **Nunca** hardcode dimensões da Topbar/Sidebar. Use as variáveis.
- **Box-sizing**: garanta `box-sizing: border-box` ao criar containers.
- **Z-index**: respeite a hierarquia (Topbar 10001, Sidebar 10000, chevron 10100; overlays de Surface 10040/10050) e reserve `>=12000` para o dropdown/tooltip do menu do usuário para que ele apareça sobre a Sidebar.

## 3) Responsividade
- Grid fluido (CSS Grid/Flex) com **breakpoints semânticos**: `--bp-sm`, `--bp-md`, `--bp-lg` (se disponíveis no tema).
- Evitar valores fixos grandes; preferir `minmax()/clamp()`.
- Conteúdos horizontais largos devem **scrollar dentro da área** e não estourar a viewport.

```css
.pageBody{
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
```

## 4) Acessibilidade (A11y)
- **Navegação por teclado**: elementos interativos com `tabindex` adequado e estados de foco visíveis.
- **Landmarks**: use `main`, `section`, `nav`, `header`, `footer` quando fizer sentido.
- **rótulos ARIA**: para ícones/botões, defina `aria-label` descritivo; use `aria-labelledby` para títulos.
- Evite texto em imagens; se necessário, forneça `alt`.

## 5) Performance
- **Server Components** quando possível; marque como `"use client"` só se precisar de estado/efeitos.
- **Code-splitting**: importe lazy componentes pesados (`next/dynamic`).
- **Memorização**: `useMemo/useCallback` para listas grandes e renders frequentes.
- **Lista virtualizada**: para >100 linhas/itens, use virtualização.
- **Imagens**: usar `next/image` com tamanhos corretos.

## 6) Estado & Dados
- **Data fetching** em RSC (`async` page/loader) ou hooks de dados (SWR/React Query) se client-side.
- **Erros & loading**: forneça estados explícitos (`error.tsx`, `loading.tsx` ou skeleton local).
- **Idempotência**: ações devem ser reexecutáveis (retry) e exibir feedback (toasts/inline).

## 7) Interações & Animações
- Tempo padrão: `var(--dx-sidebar-anim, 320ms)` e `cubic-bezier(.4,0,.2,1)`.
- **Evite** animações pesadas; prefira transform/opacidade.
- Respeitar `prefers-reduced-motion` para reduzir/omitir efeitos.

```css
@media (prefers-reduced-motion: reduce){
  * { animation: none !important; transition: none !important; }
}
```

## 8) Componentização
- Reutilize componentes em `src/components/ui/*` e `src/components/surface/*`.
- Ícones via `@vibe/icons` (siga o tamanho padrão do design: 16/18/20px).
- **Não** duplique estilos de Sidebar/Topbar; consuma as classes/variáveis públicas.

## 9) Navegação & URLs
- Use `next/link` e `usePathname()` para estados ativos.
- URLs devem ser **semânticas** e estáveis (`/contacts`, `/settings/profile`, etc.).
- Evite query strings para layout; use segmentos.

## 10) Estados Vazios, Erros e Sem Permissão
- **Empty state**: mensagem clara, call-to-action primário e/ou link de ajuda.
- **Erro**: título, detalhe técnico opcional, opção de **tentar novamente**.
- **Sem permissão**: explique concisamente e ofereça caminho de solicitação.

## 11) Conteúdo que Rola
- O **scroll acontece no `.main`**. Dentro da página, crie wrappers que respeitem altura disponível: `height: 100%; min-height: 100%;`.
- Para cabeçalhos fixos da página, calcule o espaço do restante com `calc(100% - <alturaHeader>)`.

```css
.page{
  display: grid;
  grid-template-rows: auto 1fr;
  height: calc(100dvh - var(--dx-top-bar-height));
}
.pageHeader{ padding: 12px 16px; border-bottom: 1px solid var(--dx-border); }
.pageBody{ overflow: auto; padding: 16px; }
```

## 12) Segurança
- Sanitizar HTML externo; evitar `dangerouslySetInnerHTML`.
- Inputs com validação (client + server) e mensagens acessíveis.
- **Nunca** exponha tokens/secrets no cliente.

## 13) i18n / L10n
- Todo texto deve ser extraído para i18n quando aplicável.
- Evite concatenar strings traduzíveis com variáveis sem placeholders.

## 14) Testes & Qualidade
- **Unit** (Jest/RTL) para componentes puros.
- **E2E** (Playwright/Cypress) para fluxos críticos.
- Lint/Format: ESLint + Prettier + Stylelint (se aplicável) no CI.

## 15) Checklist de PR
- [ ] Usa AppShell corretamente (sem mexer em Topbar/Sidebar)
- [ ] Canvas preenche 100% da área do Main
- [ ] Acessibilidade básica ok (foco, aria, landmarks)
- [ ] Loading/Erro/Empty state cobertos
- [ ] Sem regressões de responsividade
- [ ] Sem estilos “vazando” globalmente
- [ ] Cobertura mínima de testes (se aplicável)

---

### Snippets úteis
**Container full height dentro do Main**
```css
.fullHeight{
  height: calc(100dvh - var(--dx-top-bar-height));
}
```

**Seção com cabeçalho fixo e conteúdo rolável**
```css
.section{
  display: grid;
  grid-template-rows: auto 1fr;
  min-height: calc(100dvh - var(--dx-top-bar-height));
}
.sectionBody{ overflow: auto; }
```

**Botão ícone acessível**
```tsx
<button type="button" aria-label="Adicionar contato">
  <IconPlus size={16} aria-hidden />
</button>
```

**Componente Client só quando necessário**
```tsx
"use client";
import { useState } from "react";
export default function Toggle(){
  const [on,setOn] = useState(false);
  return <button onClick={()=>setOn(v=>!v)}>{on?"On":"Off"}</button>;
}
```

