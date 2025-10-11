"use client";

import { useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  API as ApiIcon,
  Baseline as BaselineIcon,
  CheckList as CheckListIcon,
  Home as HomeIcon,
  Settings as SettingsIcon,
  Team as TeamIcon,
} from "@vibe/icons";
import styles from "./sidebar.module.css";

type Item = {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number | string }>;
};

const ITEMS: Item[] = [
  { id: "home", label: "Início", href: "/", icon: HomeIcon },
  { id: "sequences", label: "Sequências", href: "/sequences", icon: BaselineIcon },
  { id: "my-tasks", label: "Minhas tarefas", href: "/tasks/my", icon: CheckListIcon },
  { id: "crm", label: "Meus Contatos", href: "/crm", icon: TeamIcon },
  { id: "mcp", label: "Vibe MCP", href: "/mcp", icon: ApiIcon },
  { id: "settings", label: "Configurações", href: "/settings", icon: SettingsIcon },
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

  const [animating, setAnimating] = useState(false);
  const lastCollapsedRef = useRef<boolean>(collapsed);

  const beginToggle = useCallback(() => {
    if (animating) return; // evita duplo-toggle durante a transição
    setAnimating(true);
    onToggle();
  }, [animating, onToggle]);

  const handleTransitionEnd = (e: React.TransitionEvent<HTMLElement>) => {
    if (e.currentTarget !== e.target) return; // apenas a própria .sidebar
    if (e.propertyName !== "width") return;
    lastCollapsedRef.current = collapsed;
    setAnimating(false);
  };

  const activePath = useMemo(() => {
    if (!pathname) return "/";
    return pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
  }, [pathname]);

  const handleRootClick = () => {
    if (collapsed) beginToggle();
  };
  const handleRootKeyDown = (e: React.KeyboardEvent) => {
    if (!collapsed) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      beginToggle();
    }
  };
  const handleLinkClickWhenCollapsed = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (collapsed) {
      e.preventDefault();
      beginToggle();
    }
  };

  return (
    <div
      data-collapsed={collapsed ? "true" : "false"}
      data-animating={animating ? "true" : "false"}
    >
      <aside
        className={clsx(styles.sidebar, className)}
        aria-label="Main navigation"
        data-clickable={collapsed ? "true" : undefined}
        role={collapsed ? "button" : undefined}
        aria-expanded={!collapsed}
        tabIndex={collapsed ? 0 : -1}
        onClick={handleRootClick}
        onKeyDown={handleRootKeyDown}
        onTransitionEnd={handleTransitionEnd}
      >
        <div className={styles.sidebarInner}>
          <nav className={styles.nav} role="navigation" aria-label="Sidebar">
            {ITEMS.map(({ id, label, href, icon: Icon }) => {
              const isActive =
                activePath === href || (href !== "/" && activePath.startsWith(href));
              return (
                <Link
                  key={id}
                  href={href}
                  className={styles.navItem}
                  aria-current={isActive ? "page" : undefined}
                  data-selected={isActive ? "true" : undefined}
                  onClick={handleLinkClickWhenCollapsed}
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
