"use client";

import { IconButton } from "@vibe/core";
import { Inbox } from "@vibe/icons";
import clsx from "clsx";
import styles from "./topbar.module.css";
import UserMenu from "./topbar/UserMenu";
import { useFeatureFlag } from "@/providers/ObservabilityProvider";
import NotificationsBell from "./topbar/NotificationsBell";
import type { AppShellActiveOrg } from "./AppShell";

export type TopbarProps = {
  isSidebarOpen: boolean;
  className?: string;
  activeOrg?: AppShellActiveOrg | null;
};

export default function Topbar({ isSidebarOpen, className, activeOrg }: TopbarProps) {
  const notificationsEnabled = useFeatureFlag("notifications_v1", false);
  return (
    <header className={clsx(styles.topbar, className)} data-sidebar={isSidebarOpen ? "expanded" : "collapsed"}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden />
          <span className={styles.productName}>monday-style Shell</span>
        </div>
        <div className={styles.middle} />
        <nav className={styles.nav} aria-label="Topbar actions">
          {notificationsEnabled && activeOrg ? (
            <NotificationsBell orgId={activeOrg.id} orgName={activeOrg.name} />
          ) : (
            <IconButton
              icon={Inbox}
              ariaLabel="Abrir inbox"
              tooltipContent="Inbox"
              size={IconButton.sizes.MEDIUM}
              kind={IconButton.kinds.TERTIARY}
            />
          )}
          <span className={styles.avatarDivider} aria-hidden="true">
            |
          </span>
          <UserMenu />
        </nav>
      </div>
    </header>
  );
}
