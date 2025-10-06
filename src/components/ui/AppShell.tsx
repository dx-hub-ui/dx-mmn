// src/components/ui/AppShell.tsx
"use client";

import { useState } from "react";
import clsx from "clsx";
import Topbar from "./topbar";
import Sidebar from "./sidebar";
import styles from "./app-shell.module.css";

export default function AppShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div
      className={clsx(styles.shell, className)}
      data-sidebar={isSidebarOpen ? "expanded" : "collapsed"}
    >
      <div className={styles.topbar}>
        <Topbar isSidebarOpen={isSidebarOpen} />
      </div>

      <div className={styles.sidebar}>
        <Sidebar
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen((v) => !v)}
        />
      </div>

      <main className={styles.content} role="main" id="main-content">
        {/* <- o “paper” grande do main */}
        <div className={styles.canvas}>
          {/* conteúdo da página vive aqui dentro */}
          <div className={styles.page}>{children}</div>
        </div>
      </main>
    </div>
  );
}
