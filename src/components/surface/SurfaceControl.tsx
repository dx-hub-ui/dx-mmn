"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef } from "react";
import styles from "./surface-control.module.css";

/**
 * Context expõe apenas refs (para eventuais portais) e o estado atual de largura da sidebar via CSS.
 * Hoje o que importa é a existência da camada visual (topbar & sidebar halo) acima do conteúdo.
 */
type SurfaceCtx = {
  topbar: HTMLDivElement | null;
  sidebarHalo: HTMLDivElement | null;
};
const SurfaceContext = createContext<SurfaceCtx>({ topbar: null, sidebarHalo: null });

export function useSurface() {
  return useContext(SurfaceContext);
}

/**
 * SurfaceControl:
 *  - Renderiza duas camadas fixas acima do app:
 *      • Topbar surface — uma faixa com background = var(--dx-surface-control-bg)
 *      • Sidebar surface — uma coluna do lado esquerdo, altura total
 *  - A largura da coluna acompanha a var CSS --sidebar-current (definida no AppShell)
 */
export default function SurfaceControl({ children }: { children: React.ReactNode }) {
  const topbarRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Evita “flash” em SSR: garante que as camadas só apareçam no client
  const mounted = useMemo(() => typeof window !== "undefined", []);
  useEffect(() => {
    if (!mounted) return;
  }, [mounted]);

  return (
    <SurfaceContext.Provider value={{ topbar: topbarRef.current, sidebarHalo: sidebarRef.current }}>
      {/* Camada fixa da TOPBAR por cima de tudo (apenas visual) */}
      <div
        ref={topbarRef}
        className={styles.surfaceTopbar}
        aria-hidden="true"
      />

      {/* Camada fixa da BORDA ESQUERDA (halo da sidebar) por cima do app */}
      <div
        ref={sidebarRef}
        className={styles.surfaceSidebar}
        aria-hidden="true"
      />

      {/* Conteúdo real do app */}
      {children}
    </SurfaceContext.Provider>
  );
}
