"use client";

import { useEffect, useMemo } from "react";
import { IconButton, Modal, ModalContent, Text } from "@vibe/core";
import { Close, Help, Inbox as InboxIcon } from "@vibe/icons";
import { captureException } from "@sentry/nextjs";
import { trackEvent } from "@/lib/telemetry";
import { getRequestContext } from "@/lib/request-context";
import { useInboxFeed } from "@/lib/inbox/useInboxFeed";
import type { InboxItemDTO, InboxTab } from "@/types/inbox";
import InboxTabs from "./InboxTabs";
import InboxFilters from "./InboxFilters";
import InboxShowBar from "./InboxShowBar";
import InboxPanel from "./InboxPanel";
import { useInboxPreferences } from "./useInboxPreferences";
import styles from "./inbox-modal.module.css";

type InboxModalProps = {
  open: boolean;
  orgId: string;
  initialTab: InboxTab;
  onClose: () => void;
};

export default function InboxModal({ open, orgId, initialTab, onClose }: InboxModalProps) {
  const context = getRequestContext();
  const { state, setState, saveScroll, readScroll } = useInboxPreferences(initialTab);

  const { items, counts, unreadCount, error, isLoading, isValidating, hasMore, loadMore, refresh, markRead, markAllRead } =
    useInboxFeed({ orgId, tab: state.tab, show: state.show, board: state.board });

  useEffect(() => {
    if (!open) {
      return;
    }
    trackEvent("inbox.open", {
      org_id: orgId,
      user_id: context?.userId ?? undefined,
      tab: state.tab,
      show: state.show,
      board: state.board,
    });
  }, [context?.userId, open, orgId, state.board, state.show, state.tab]);

  const initialScrollTop = useMemo(() => readScroll(), [readScroll]);

  const handleTabChange = (tab: InboxTab) => {
    setState((prev) => ({ ...prev, tab }));
    trackEvent("inbox.tab_change", { org_id: orgId, tab });
  };

  const handleShowChange = (value: "unread" | "all") => {
    setState((prev) => ({ ...prev, show: value }));
    trackEvent("inbox.show_change", { org_id: orgId, show: value });
  };

  const handleBoardChange = (board: string) => {
    setState((prev) => ({ ...prev, board }));
    trackEvent("inbox.filter_change", { org_id: orgId, board });
  };

  const handleMarkAll = async () => {
    try {
      const next = await markAllRead();
      trackEvent("inbox.mark_all_read", { org_id: orgId, show: state.show, board: state.board, tab: state.tab, unread: next });
    } catch (mutationError) {
      captureException(mutationError, { tags: { module: "inbox", action: "mark_all" } });
    }
  };

  const handleOpenItem = async (item: InboxItemDTO) => {
    if (item.isUnread) {
      await markRead([item.id]);
      trackEvent("inbox.mark_read", { org_id: orgId, count: 1, reason: "open" });
    }
    trackEvent("inbox.card_open", { org_id: orgId, notification_id: item.id });
    if (item.link) {
      window.open(item.link, "_blank", "noopener,noreferrer");
    }
  };

  const handleMarkSelection = async (ids: string[]) => {
    if (ids.length === 0) {
      return;
    }
    try {
      await markRead(ids);
      trackEvent("inbox.mark_read", { org_id: orgId, count: ids.length, reason: "bulk" });
    } catch (mutationError) {
      captureException(mutationError, { tags: { module: "inbox", action: "mark_selected" } });
    }
  };

  return (
    <Modal id="inbox-modal" show={open} onClose={onClose} zIndex={5200} title="Feed de atualizações">
      <ModalContent>
        <div className={styles.modal}>
          <header className={styles.header}>
            <div className={styles.titleGroup}>
              <span className={styles.iconWrapper} aria-hidden>
                <InboxIcon />
              </span>
              <div>
                <Text type={Text.types.TEXT1} weight={Text.weights.BOLD}>
                  Feed de atualizações
                </Text>
                <Text type={Text.types.TEXT3} color={Text.colors.SECONDARY}>
                  Acompanhe tudo que está acontecendo em tempo real.
                </Text>
              </div>
            </div>
            <div className={styles.actions}>
              <IconButton icon={Help} ariaLabel="Ajuda" tooltipContent="Ajuda" kind={IconButton.kinds.TERTIARY} />
              <IconButton
                icon={Close}
                ariaLabel="Fechar feed"
                tooltipContent="Fechar"
                kind={IconButton.kinds.TERTIARY}
                onClick={onClose}
              />
            </div>
          </header>
          <InboxTabs value={state.tab} onChange={handleTabChange} />
          <InboxShowBar value={state.show} onChange={handleShowChange} onMarkAll={handleMarkAll} disabled={isLoading} />
          <div className={styles.body}>
            <InboxFilters value={state.board} counts={counts} onChange={handleBoardChange} />
            <div className={styles.panelWrapper}>
              <InboxPanel
                items={items}
                isLoading={isLoading}
                isValidating={isValidating}
                error={error ?? null}
                hasMore={hasMore}
                loadMore={loadMore}
                onRetry={refresh}
                onOpenItem={handleOpenItem}
                onMarkSelection={handleMarkSelection}
                saveScroll={saveScroll}
                initialScrollTop={initialScrollTop}
              />
            </div>
          </div>
          <footer className={styles.footer}>
            <Text type={Text.types.TEXT3} color={Text.colors.SECONDARY}>
              {unreadCount > 0
                ? `${unreadCount} atualização${unreadCount > 1 ? "s" : ""} não lida${unreadCount > 1 ? "s" : ""}`
                : "Tudo lido por aqui"}
            </Text>
          </footer>
        </div>
      </ModalContent>
    </Modal>
  );
}
