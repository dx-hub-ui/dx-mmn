"use client";

import { useState } from "react";
import { IconButton } from "@vibe/core";
import { Inbox, Notifications as NotificationsIcon } from "@vibe/icons";
import clsx from "clsx";
import styles from "./topbar.module.css";
import UserMenu from "./topbar/UserMenu";
import { useFeatureFlag } from "@/providers/ObservabilityProvider";
import NotificationsBell from "./topbar/NotificationsBell";
import type { AppShellActiveOrg } from "./AppShell";

// Optional: replace with your real modals
const NotificationsModal = ({ onClose }: { onClose: () => void }) => null;
const InboxModal = ({ onClose }: { onClose: () => void }) => null;

export type TopbarProps = {
  isSidebarOpen: boolean;
  className?: string;
  activeOrg?: AppShellActiveOrg | null;
};

export default function Topbar({ isSidebarOpen, className, activeOrg }: TopbarProps) {
  const notificationsEnabled = useFeatureFlag("notifications_v1", false);
  const [isNotificationsOpen, setNotificationsOpen] = useState(false);
  const [isInboxOpen, setInboxOpen] = useState(false);

  return (
    <header className={clsx(styles.topbar, className)} data-sidebar={isSidebarOpen ? "expanded" : "collapsed"}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden />
          <span className={styles.productName}>monday-style Shell</span>
        </div>

        <div className={styles.middle} />

        <nav className={styles.nav} aria-label="Topbar actions">
          {/* Notifications icon -> notifications modal */}
          {notificationsEnabled && activeOrg ? (
            <NotificationsBell orgId={activeOrg.id} orgName={activeOrg.name} />
          ) : (
            <IconButton
              icon={<NotificationsIcon />}
              ariaLabel="Abrir notificações"
              tooltipContent="Notificações"
              size={IconButton.sizes.MEDIUM}
              kind={IconButton.kinds.TERTIARY}
              onClick={() => setNotificationsOpen(true)}
            />
          )}

          {/* Inbox icon -> inbox modal */}
          <IconButton
            icon={<Inbox />}
            ariaLabel="Abrir inbox"
            tooltipContent="Inbox"
            size={IconButton.sizes.MEDIUM}
            kind={IconButton.kinds.TERTIARY}
            onClick={() => setInboxOpen(true)}
          />

          <span className={styles.avatarDivider} aria-hidden="true">|</span>
          <UserMenu />
        </nav>
      </div>

      {isNotificationsOpen && <NotificationsModal onClose={() => setNotificationsOpen(false)} />}
      {isInboxOpen && <InboxModal onClose={() => setInboxOpen(false)} />}
    </header>
  );
}
