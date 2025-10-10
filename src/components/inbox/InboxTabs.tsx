"use client";

import { useMemo } from "react";
import { Badge, Tab, TabList, TabPanel, TabPanels, TabsContext } from "@vibe/core";
import type { InboxTab } from "@/types/inbox";
import styles from "./inbox-tabs.module.css";

type InboxTabsProps = {
  value: InboxTab;
  onChange: (tab: InboxTab) => void;
};

const ORDER: InboxTab[] = ["all", "mentions", "bookmarked", "account", "scheduled", "new"];

const LABELS: Record<InboxTab, string> = {
  all: "Todas as atualizações",
  mentions: "Fui mencionado",
  bookmarked: "Favoritados",
  account: "Toda a conta",
  scheduled: "Agendadas",
  new: "Novas",
};

export default function InboxTabs({ value, onChange }: InboxTabsProps) {
  const activeIndex = useMemo(() => ORDER.findIndex((item) => item === value), [value]);

  return (
    <TabsContext activeTabId={activeIndex}>
      <TabList className={styles.tabList} aria-label="Categorias de atualizações">
        {ORDER.map((tabKey, index) => (
          <Tab key={tabKey} value={index} active={index === activeIndex} onClick={() => onChange(tabKey)}>
            <span className={styles.tabLabel}>{LABELS[tabKey]}</span>
            {tabKey === "new" ? (
              <Badge type={Badge.types.PILL} className={styles.newBadge}>
                Novo
              </Badge>
            ) : null}
          </Tab>
        ))}
      </TabList>
      <TabPanels activeTabId={activeIndex}>
        {ORDER.map((tabKey, index) => (
          <TabPanel key={tabKey} index={index} className={styles.panelPlaceholder}>
            {/* O conteúdo das abas é renderizado fora via InboxPanel */}
          </TabPanel>
        ))}
      </TabPanels>
    </TabsContext>
  );
}
