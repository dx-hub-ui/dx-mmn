"use client";

import clsx from "clsx";
import styles from "./topbar.module.css";

export type TopbarProps = { isSidebarOpen: boolean; className?: string };

export default function Topbar({ isSidebarOpen, className }: TopbarProps) {
  return (
    <header className={clsx(styles.topbar, className)} data-sidebar={isSidebarOpen ? "expanded" : "collapsed"}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden />
          <span className={styles.productName}>monday-style Shell</span>
        </div>
        <div className={styles.middle} />
        <nav className={styles.nav} aria-label="Topbar actions" />
      </div>
    </header>
  );
}
