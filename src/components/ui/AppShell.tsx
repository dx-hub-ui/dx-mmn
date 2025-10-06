"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import Topbar from "./topbar";
import Sidebar from "./sidebar";
import styles from "./app-shell.module.css";

export default function AppShell({ children, className }: { children: React.ReactNode; className?: string }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div className={clsx(styles.shell, className)} data-sidebar={isSidebarOpen ? "expanded" : "collapsed"}>
      <Topbar className={styles.topbar} isSidebarOpen={isSidebarOpen} />
      <Sidebar className={styles.sidebar} isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(v => !v)} />
      <main className={styles.content}>{children}</main>
    </div>
  );
}
