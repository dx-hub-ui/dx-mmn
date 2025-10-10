"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertBanner,
  AlertBannerButton,
  AlertBannerText,
  Button,
  Loader,
  Text,
} from "@vibe/core";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { InboxItemDTO } from "@/types/inbox";
import InboxCard from "./InboxCard";
import styles from "./inbox-panel.module.css";

type InboxPanelProps = {
  items: InboxItemDTO[];
  isLoading: boolean;
  isValidating: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
  onRetry: () => void;
  onOpenItem: (item: InboxItemDTO) => void;
  onMarkSelection: (ids: string[]) => Promise<void>;
  saveScroll: (position: number) => void;
  initialScrollTop: number;
};

export default function InboxPanel({
  items,
  isLoading,
  isValidating,
  error,
  hasMore,
  loadMore,
  onRetry,
  onOpenItem,
  onMarkSelection,
  saveScroll,
  initialScrollTop,
}: InboxPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const totalCount = items.length;
  const virtualCount = hasMore ? totalCount + 1 : totalCount;

  const rowVirtualizer = useVirtualizer({
    count: virtualCount,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 148,
    overscan: 6,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    if (initialScrollTop > 0) {
      containerRef.current.scrollTop = initialScrollTop;
    }
  }, [initialScrollTop]);

  useEffect(() => {
    const node = containerRef.current;
    return () => {
      if (node) {
        saveScroll(node.scrollTop);
      }
    };
  }, [saveScroll]);

  useEffect(() => {
    if (!hasMore) {
      return;
    }
    const last = virtualItems[virtualItems.length - 1];
    if (last && last.index >= totalCount && !isLoading && !isValidating) {
      loadMore();
    }
  }, [virtualItems, hasMore, loadMore, totalCount, isLoading, isValidating]);

  const toggleSelection = useCallback((id: string, next: boolean) => {
    setSelectedIds((prev) => {
      if (next) {
        if (prev.includes(id)) {
          return prev;
        }
        return [...prev, id];
      }
      return prev.filter((value) => value !== id);
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const handleMarkSelected = useCallback(async () => {
    if (selectedIds.length === 0) {
      return;
    }
    await onMarkSelection(selectedIds);
    clearSelection();
  }, [clearSelection, onMarkSelection, selectedIds]);

  const selectionLabel = useMemo(() => {
    if (selectedIds.length === 0) {
      return "";
    }
    return `${selectedIds.length} selecionada${selectedIds.length > 1 ? "s" : ""}`;
  }, [selectedIds.length]);

  return (
    <section className={styles.root} aria-label="Lista de atualizações">
      {selectedIds.length > 0 ? (
        <div className={styles.selectionBar}>
          <Text type={Text.types.TEXT2}>{selectionLabel}</Text>
          <div className={styles.selectionActions}>
            <Button kind={Button.kinds.SECONDARY} size={Button.sizes.SMALL} onClick={clearSelection}>
              Cancelar
            </Button>
            <Button kind={Button.kinds.PRIMARY} size={Button.sizes.SMALL} onClick={handleMarkSelected}>
              Marcar como lidas
            </Button>
          </div>
        </div>
      ) : null}
      {error ? (
        <AlertBanner className={styles.banner} backgroundColor={AlertBanner.backgroundColors.NEGATIVE}>
          <AlertBannerText text="Não foi possível carregar as atualizações." />
          <AlertBannerButton
            kind={Button.kinds.TERTIARY}
            size={Button.sizes.SMALL}
            onClick={onRetry}
            isDarkBackground
          >
            Tentar novamente
          </AlertBannerButton>
        </AlertBanner>
      ) : null}
      <div ref={containerRef} className={styles.scrollArea}>
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
          {virtualItems.map((virtualRow) => {
            const isLoaderRow = virtualRow.index >= totalCount;
            const top = virtualRow.start;
            const item = items[virtualRow.index];
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                style={{
                  position: "absolute",
                  top,
                  left: 0,
                  width: "100%",
                }}
              >
                {isLoaderRow ? (
                  hasMore ? (
                    <div className={styles.loaderRow}>
                      <Loader size={Loader.sizes.SMALL} />
                    </div>
                  ) : null
                ) : item ? (
                  <InboxCard
                    item={item}
                    selected={selectedIds.includes(item.id)}
                    onSelectChange={(next) => toggleSelection(item.id, next)}
                    onOpen={onOpenItem}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
        {!isLoading && items.length === 0 ? (
          <div className={styles.emptyState}>
            <Text type={Text.types.TEXT2} weight={Text.weights.BOLD}>
              Nenhuma atualização por aqui
            </Text>
            <Text type={Text.types.TEXT3} color={Text.colors.SECONDARY}>
              Assim que alguém publicar algo novo, você verá por aqui.
            </Text>
          </div>
        ) : null}
        {isLoading && items.length === 0 ? (
          <div className={styles.loaderRow}>
            <Loader size={Loader.sizes.SMALL} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
