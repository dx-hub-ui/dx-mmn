// src/components/ui/sidebar.tsx
"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
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

  // normaliza pathname para bater com href sem barra final
  const activePath = useMemo(() => {
    if (!pathname) return "/";
    if (pathname !== "/" && pathname.endsWith("/")) return pathname.slice(0, -1);
    return pathname;
  }, [pathname]);

  return (
    // o data-collapsed controla os estilos colapsados via CSS
    <div data-collapsed={collapsed ? "true" : "false"}>
      <aside className={clsx(styles.sidebar, className)} aria-label="Main navigation">
        {/* neblina/gradient opcional no rodapé da sidebar */}
        <div className={styles.sidebarFog} />

        <div className={styles.sidebarInner}>
          {/* Chevron “meio a meio”, sem tooltip, acima de tudo */}
          <div className={styles.edgeToggle}>
            <button
              type="button"
              aria-label={isOpen ? "Collapse navigation" : "Expand navigation"}
              onClick={onToggle}
              className={styles.toggleButton}
            >
              {isOpen ? <NavigationChevronLeft size={16} /> : <NavigationChevronRight size={16} />}
            </button>
          </div>

          {/* Navegação */}
          <nav className={styles.nav} role="navigation" aria-label="Sidebar">
            {ITEMS.map(({ id, label, href, icon: Icon }) => {
              const isActive = activePath === href || (href !== "/" && activePath.startsWith(href));
              return (
                <Link
                  key={id}
                  href={href}
                  className={styles.navItem}
                  aria-current={isActive ? "page" : undefined}
                  data-selected={isActive ? "true" : undefined}
                >
                  <span className={styles.navIcon} aria-hidden>
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
