"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { IconButton } from "@vibe/core";
import {
  Home as HomeIcon,
  Settings as SettingsIcon,
  NavigationChevronLeft,
  NavigationChevronRight
} from "@vibe/icons";
import styles from "./sidebar.module.css";

type Item = {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number | string }>;
};

const ITEMS: Item[] = [
  { id: "home",     label: "Home",     href: "/",         icon: HomeIcon },
  { id: "tables",   label: "Tables",   href: "/tables",   icon: HomeIcon },
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
  const pathname = usePathname();
  const collapsed = !isOpen;

  // normalize pathname to match hrefs without trailing slash issues
  const activePath = useMemo(() => (pathname?.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname) ?? "/", [pathname]);

  return (
    // wrapper com data-collapsed para casar com os seletores do CSS
    <div data-collapsed={collapsed ? "true" : "false"}>
      <aside
        className={clsx(styles.sidebar, className)}
        aria-label="Main navigation"
      >
        {/* fog opcional (para o fade do rodapé da sidebar) */}
        <div className={styles.sidebarFog} />

        <div className={styles.sidebarInner}>
          {/* Toggle de borda (igual monday) */}
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

          {/* Navegação */}
          <nav className={styles.nav} role="navigation" aria-label="Sidebar">
            {/* Exemplo de rótulo de grupo (opcional) */}
            {/* <div className={styles.navGroupLabel}>Favorites</div> */}

            {ITEMS.map(({ id, label, href, icon: Icon }) => {
              const isActive =
                activePath === href ||
                (href !== "/" && activePath?.startsWith(href));

              return (
                <Link
                  key={id}
                  href={href}
                  className={styles.navItem}
                  aria-current={isActive ? "page" : undefined}
                  data-selected={isActive ? "true" : undefined}
                >
                  <span className={clsx(styles.navIcon)} aria-hidden>
                    <Icon size={18} />
                  </span>
                  <span className={styles.navLabel}>{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
    </div>
  );
}
