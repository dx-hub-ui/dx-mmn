"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import clsx from "clsx";
import SurfaceControl from "@/components/surface/SurfaceControl";
import Topbar from "./topbar";
import Sidebar from "./sidebar";
import styles from "./app-shell.module.css";
import { NavigationChevronLeft, NavigationChevronRight } from "@vibe/icons";

export type AppShellActiveOrg = {
  id: string;
  name: string;
  slug: string;
};

type AppShellProps = {
  children: React.ReactNode;
  className?: string;
  activeOrg?: AppShellActiveOrg | null;
};

export default function AppShell({ children, className, activeOrg }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // trava o body scroll (padrão monday)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Larguras padrão (tokens)
  const SIDEBAR_EXPANDED = "272px";
  const SIDEBAR_COLLAPSED = "30px";

  // Duração/curva padrão
  const SIDEBAR_ANIM = "320ms";
  const SIDEBAR_EASE = "cubic-bezier(.4,0,.2,1)";

  // Var compartilhada para layout/overlays
  const sidebarCurrent = useMemo(
    () => (isSidebarOpen ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED),
    [isSidebarOpen]
  );

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen((v) => !v);
  }, []);

  return (
    <SurfaceControl>
      <div
        className={clsx(styles.shell, className)}
        data-sidebar={isSidebarOpen ? "expanded" : "collapsed"}
        style={
          {
            ["--dx-sidebar-width" as any]: SIDEBAR_EXPANDED,
            ["--dx-sidebar-collapsed-width" as any]: SIDEBAR_COLLAPSED,
            ["--sidebar-current" as any]: sidebarCurrent,
            ["--dx-sidebar-anim" as any]: SIDEBAR_ANIM,
            ["--dx-sidebar-ease" as any]: SIDEBAR_EASE
          } as React.CSSProperties
        }
      >
        {/* Topbar fixa */}
        <header className={styles.topbar} role="banner">
          <Topbar isSidebarOpen={isSidebarOpen} activeOrg={activeOrg ?? null} />
        </header>

        {/* Sidebar fixa */}
        <aside className={styles.sidebarWrap} aria-label="Primary">
          <Sidebar isOpen={isSidebarOpen} onToggle={handleToggleSidebar} />
        </aside>

        {/* Chevron fora da Sidebar, com z-index alto */}
        <div className={styles.edgeToggleShell}>
          <button
            type="button"
            aria-label={isSidebarOpen ? "Collapse navigation" : "Expand navigation"}
            className={styles.edgeToggleBtn}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleToggleSidebar();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleToggleSidebar();
            }}
          >
            {isSidebarOpen ? <NavigationChevronLeft size={16} /> : <NavigationChevronRight size={16} />}
          </button>
        </div>

        {/* Main rolável */}
        <main id="main-content" tabIndex={-1} className={styles.main} role="main">
          <div className={styles.canvas}>{children}</div>
        </main>
      </div>
    </SurfaceControl>
  );
}
