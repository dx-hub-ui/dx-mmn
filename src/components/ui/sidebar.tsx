"use client";

import Link from "next/link";
import clsx from "clsx";
import { IconButton } from "@vibe/core";
import {
  Home as HomeIcon,
  Settings as SettingsIcon,
  NavigationChevronLeft,
  NavigationChevronRight
} from "@vibe/icons";
import styles from "./sidebar.module.css";

type Item = { id: string; label: string; href: string; icon: React.ComponentType<{ size?: number | string }> };

const ITEMS: Item[] = [
  { id: "home",     label: "Home",     href: "/",         icon: HomeIcon },
  { id: "settings", label: "Settings", href: "/settings", icon: SettingsIcon }
];

export default function Sidebar({
  isOpen,
  onToggle,
  className
}: {
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const collapsed = !isOpen;

  return (
    <aside className={clsx(styles.sidebar, className)} data-collapsed={collapsed || undefined} aria-label="Main navigation">
      <div className={styles.sidebarInner}>
        <div className={styles.edgeToggle} aria-hidden="true">
          <IconButton
            icon={isOpen ? NavigationChevronLeft : NavigationChevronRight}
            size={IconButton.sizes.SMALL}
            ariaLabel={isOpen ? "Collapse navigation" : "Expand navigation"}
            className={styles.toggleButton}
            ariaExpanded={isOpen}
            onClick={onToggle}
          />
        </div>

        <nav className={styles.nav} role="navigation">
          {ITEMS.map(({ id, label, href, icon: Icon }) => (
            <Link key={id} href={href} className={styles.navItem}>
              <span className={clsx(styles.navIcon, styles.navIconSvg)} aria-hidden>
                <Icon size={18} />
              </span>
              <span className={styles.navLabel}>{label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}
