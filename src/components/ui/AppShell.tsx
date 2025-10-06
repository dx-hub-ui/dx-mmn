// src/components/ui/AppShell.tsx
"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import SurfaceControl, { useSurface } from "@/components/surface/SurfaceControl";
import Topbar from "./topbar";
import Sidebar from "./sidebar";
import styles from "./app-shell.module.css";

/** Mounts Topbar into the surface-control “topbar” slot (above the app canvas). */
function SurfaceTopbarMount({ isSidebarOpen }: { isSidebarOpen: boolean }) {
  const { topbar } = useSurface();
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(Boolean(topbar)), [topbar]);
  if (!ready || !topbar) return null;

  return createPortal(<Topbar isSidebarOpen={isSidebarOpen} />, topbar);
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <SurfaceControl>
      <SurfaceTopbarMount isSidebarOpen={isSidebarOpen} />

      {/* Normal app stack under the fixed surface layer */}
      <div className={styles.shell} data-sidebar={isSidebarOpen ? "expanded" : "collapsed"}>
        <aside className={styles.sidebarWrap}>
          <Sidebar
            isOpen={isSidebarOpen}
            onToggle={() => setIsSidebarOpen((v) => !v)}
            className={styles.sidebar}
          />
        </aside>

        <main id="main-content" tabIndex={-1} className={styles.main} role="main" aria-label="Main content">
          <div className={styles.canvas}>
            <div className={styles.page}>{children}</div>
          </div>
        </main>
      </div>
    </SurfaceControl>
  );
}
