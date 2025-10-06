// src/components/ui/AppShell.tsx
"use client";

import { useState } from "react";
import clsx from "clsx";
import Topbar from "./topbar";
import Sidebar from "./sidebar";
import styles from "./app-shell.module.css";

export default function AppShell({
  children,
  className
}: { children: React.ReactNode; className?: string }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div
      className={clsx(styles.shell, className)}
      data-sidebar={isSidebarOpen ? "expanded" : "collapsed"}
      role="application"
      aria-label="DX Hub shell"
    >
      <div className={styles.topbar}>
        <Topbar isSidebarOpen={isSidebarOpen} />
      </div>

      <div className={styles.sidebar}>
        <Sidebar
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(v => !v)}
        />
      </div>

      <main className={styles.content} role="main" id="main-content">
        {children}
      </main>
    </div>
  );
}
