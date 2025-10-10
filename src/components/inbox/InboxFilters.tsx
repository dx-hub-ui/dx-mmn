"use client";

import { Button, Text } from "@vibe/core";
import type { InboxCounts } from "@/types/inbox";
import styles from "./inbox-filters.module.css";

type InboxFiltersProps = {
  value: string;
  counts: InboxCounts;
  onChange: (next: string) => void;
};

function formatCount(count: number) {
  if (count > 999) {
    return "999+";
  }
  return count.toString();
}

export default function InboxFilters({ value, counts, onChange }: InboxFiltersProps) {
  return (
    <aside className={styles.root} aria-label="Filtros do feed">
      <div className={styles.sectionHeader}>
        <Text type={Text.types.TEXT3} color={Text.colors.SECONDARY} weight={Text.weights.BOLD}>
          Filtrar por board
        </Text>
      </div>
      <nav className={styles.list} aria-label="Boards disponíveis">
        <button
          type="button"
          className={styles.item}
          data-active={value === "all"}
          onClick={() => onChange("all")}
        >
          <span>Todos os boards do meu feed</span>
          <span className={styles.count}>{formatCount(counts.all)}</span>
        </button>
        <button
          type="button"
          className={styles.item}
          data-active={value === "without"}
          onClick={() => onChange("without")}
        >
          <span>Atualizações sem board</span>
          <span className={styles.count}>{formatCount(counts.without)}</span>
        </button>
      </nav>
      <Button
        className={styles.settings}
        kind={Button.kinds.TERTIARY}
        size={Button.sizes.SMALL}
        onClick={() => {
          // TODO: abrir configurações
        }}
      >
        Configurações do feed
      </Button>
    </aside>
  );
}
