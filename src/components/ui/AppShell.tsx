// src/components/ui/AppShell.tsx
"use client";
import SurfaceControl, { useSurface } from "@/components/surface/SurfaceControl";
import Topbar from "./Topbar";
import Sidebar from "./Sidebar";
import styles from "./app-shell.module.css";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

function SurfaceTopbarMount() {
  const { topbar } = useSurface();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(Boolean(topbar)), [topbar]);
  if (!ready || !topbar) return null;
  return createPortal(<Topbar />, topbar);
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SurfaceControl>
      <SurfaceTopbarMount />

      {/* your normal stack under the overlay */}
      <div className={styles.shell}>
        <aside className={styles.sidebarWrap}>
          <Sidebar /* ... */ />
        </aside>
        <main id="main-content" tabIndex={-1} className={styles.main}>
          <div className={styles.canvas}>{children}</div>
        </main>
      </div>
    </SurfaceControl>
  );
}
