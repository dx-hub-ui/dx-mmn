"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWRInfinite from "swr/infinite";
import {
  AlertBanner,
  Button,
  Menu,
  MenuButton,
  MenuItem,
  Search,
  Skeleton,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  TabsContext,
  Text,
} from "@vibe/core";
import { Filter, Retry, Settings } from "@vibe/icons";
import { captureException } from "@sentry/nextjs";
import NotificationItem from "./NotificationItem";
import NotificationPreferencesModal from "./NotificationPreferencesModal";
import styles from "./notifications-panel.module.css";
import type { NotificationItemDTO, NotificationResponse, NotificationTab } from "@/types/notifications";
import { groupNotifications } from "@/lib/notifications/utils";
import { trackEvent } from "@/lib/telemetry";

const listFetcher = async (url: string): Promise<NotificationResponse> => {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Falha ao carregar notificações (${response.status})`);
  }
  return response.json();
};

const scrollMemory = new Map<string, { top: number; timestamp: number }>();
const SCROLL_TTL = 5 * 60 * 1000;

const TAB_ORDER: NotificationTab[] = ["all", "unread", "mentions", "assigned"];
const TAB_LABELS: Record<NotificationTab, string> = {
  all: "Todas",
  unread: "Não lidas",
  mentions: "Fui mencionado",
  assigned: "Atribuídas a mim",
};

type NotificationsPanelProps = {
  orgId: string;
  orgName: string;
  initialUnreadCount: number;
  onClose: () => void;
  onUnreadCountChange: (nextCount: number) => void;
};

type ActorOption = {
  id: string;
  label: string;
};

export default function NotificationsPanel({
  orgId,
  orgName,
  initialUnreadCount,
  onClose,
  onUnreadCountChange,
}: NotificationsPanelProps) {
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const activeTab = TAB_ORDER[activeTabIndex];
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const bodyRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const trimmed = searchValue.trim();
      setDebouncedSearch(trimmed);
      if (trimmed) {
        trackEvent("notifications.search", { org_id: orgId, value: trimmed });
      }
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [orgId, searchValue]);

  const getKey = useCallback(
    (pageIndex: number, previousPage: NotificationResponse | null) => {
      if (!orgId) {
        return null;
      }
      if (previousPage && !previousPage.nextCursor) {
        return null;
      }
      const params = new URLSearchParams();
      params.set("orgId", orgId);
      params.set("tab", activeTab);
      if (debouncedSearch) {
        params.set("q", debouncedSearch);
      }
      if (previousPage?.nextCursor) {
        params.set("cursor", previousPage.nextCursor);
      }
      selectedPeople.forEach((id) => params.append("people[]", id));
      return `/api/notifications?${params.toString()}`;
    },
    [activeTab, debouncedSearch, orgId, selectedPeople]
  );

  const { data: pages, error, isValidating, setSize, mutate } = useSWRInfinite<NotificationResponse>(
    getKey,
    listFetcher,
    {
      revalidateFirstPage: true,
      revalidateOnFocus: true,
    }
  );

  const notifications = useMemo<NotificationItemDTO[]>(
    () => (pages ? pages.flatMap((page) => page.items) : []),
    [pages]
  );

  const actorOptions = useMemo<ActorOption[]>(() => {
    const map = new Map<string, ActorOption>();
    pages?.forEach((page) => {
      page.items.forEach((item) => {
        if (item.actor) {
          const label = item.actor.displayName || item.actor.email || "Pessoa";
          map.set(item.actor.id, { id: item.actor.id, label });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [pages]);

  const hasMore = Boolean(pages?.[pages.length - 1]?.nextCursor);
  const isInitialLoading = !pages && !error;
  const unreadFromServer = pages?.[0]?.unreadCount ?? initialUnreadCount;

  useEffect(() => {
    onUnreadCountChange(unreadFromServer);
  }, [onUnreadCountChange, unreadFromServer]);

  useEffect(() => {
    const container = bodyRef.current;
    if (!container) {
      return;
    }
    const memory = scrollMemory.get(orgId);
    if (memory && Date.now() - memory.timestamp < SCROLL_TTL) {
      container.scrollTop = memory.top;
    }
    return () => {
      scrollMemory.set(orgId, {
        top: container.scrollTop,
        timestamp: Date.now(),
      });
    };
  }, [orgId]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    const root = bodyRef.current;
    if (!sentinel || !root) {
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && hasMore && !isValidating) {
          setSize((current) => current + 1);
        }
      },
      { root, rootMargin: "120px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isValidating, setSize]);

  const grouped = useMemo(() => groupNotifications(notifications), [notifications]);

  const updatePending = useCallback((ids: string[], add: boolean) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => {
        if (add) {
          next.add(id);
        } else {
          next.delete(id);
        }
      });
      return next;
    });
  }, []);

  const applyMutationOptimistic = useCallback(
    (ids: string[], updater: (item: NotificationItemDTO) => NotificationItemDTO) => {
      mutate(
        (current) =>
          current?.map((page) => ({
            ...page,
            items: page.items.map((item) => (ids.includes(item.id) ? updater(item) : item)),
          })),
        { revalidate: false }
      );
    },
    [mutate]
  );

  const handleMarkStatus = useCallback(
    async (ids: string[], status: "read" | "unread") => {
      if (!ids.length) {
        return;
      }
      const delta = status === "read" ? -ids.length : ids.length;
      updatePending(ids, true);
      applyMutationOptimistic(ids, (item) => ({
        ...item,
        status,
        readAt: status === "read" ? new Date().toISOString() : null,
      }));
      onUnreadCountChange(Math.max(unreadFromServer + delta, 0));
      try {
        const response = await fetch("/api/notifications/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgId, ids, status }),
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error(`Falha ao atualizar status (${response.status})`);
        }
        trackEvent("notifications.item_mark_read", { org_id: orgId, tab: activeTab, status });
        await mutate();
      } catch (actionError) {
        captureException(actionError, { tags: { module: "notifications", action: "mark_status" } });
        setErrorBanner("Não foi possível atualizar o status. Tente novamente.");
        mutate();
      } finally {
        updatePending(ids, false);
      }
    },
    [activeTab, applyMutationOptimistic, mutate, onUnreadCountChange, orgId, unreadFromServer, updatePending]
  );

  const handleMarkAllRead = useCallback(async () => {
    const allIds = notifications.map((item) => item.id);
    if (!allIds.length) {
      return;
    }
    updatePending(allIds, true);
    applyMutationOptimistic(allIds, (item) => ({ ...item, status: "read", readAt: new Date().toISOString() }));
    onUnreadCountChange(0);
    try {
      const response = await fetch("/api/notifications/mark-all-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`Falha ao marcar todas como lidas (${response.status})`);
      }
      trackEvent("notifications.mark_all_read", { org_id: orgId, tab: activeTab });
      await mutate();
    } catch (actionError) {
      captureException(actionError, { tags: { module: "notifications", action: "mark_all_read" } });
      setErrorBanner("Não conseguimos marcar tudo como lido. Tente novamente.");
      mutate();
    } finally {
      updatePending(allIds, false);
    }
  }, [activeTab, applyMutationOptimistic, mutate, notifications, onUnreadCountChange, orgId, updatePending]);

  const handleMute = useCallback(
    async (item: NotificationItemDTO, scope: "source" | "type") => {
      const payload =
        scope === "source"
          ? { scope, source_type: item.sourceType, source_id: item.sourceId }
          : { scope, type: item.type };
      try {
        const response = await fetch("/api/notifications/mute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgId, ...payload }),
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error(`Falha ao silenciar (${response.status})`);
        }
        trackEvent("notifications.mute_source", { org_id: orgId, scope, source_type: item.sourceType, type: item.type });
        setErrorBanner(`Silenciamos novas notificações ${scope === "source" ? "desta origem" : "deste tipo"}.`);
      } catch (actionError) {
        captureException(actionError, { tags: { module: "notifications", action: "mute" } });
        setErrorBanner("Não foi possível silenciar. Tente novamente.");
      }
    },
    [orgId]
  );

  const handleOpenNotification = useCallback(
    (item: NotificationItemDTO) => {
      if (item.status === "unread") {
        onUnreadCountChange(Math.max(unreadFromServer - 1, 0));
        void handleMarkStatus([item.id], "read");
      }
      trackEvent("notifications.item_open", { org_id: orgId, tab: activeTab, type: item.type });
      if (item.link) {
        window.location.href = item.link;
      }
      onClose();
    },
    [activeTab, handleMarkStatus, onClose, onUnreadCountChange, orgId, unreadFromServer]
  );

  const handleTogglePerson = useCallback((personId: string) => {
    setSelectedPeople((prev) => {
      const next = new Set(prev);
      if (next.has(personId)) {
        next.delete(personId);
      } else {
        next.add(personId);
      }
      return Array.from(next);
    });
  }, []);

  const handleResetFilters = useCallback(() => {
    setSelectedPeople([]);
    setSearchValue("");
    setDebouncedSearch("");
  }, []);

  const handleRetry = useCallback(() => {
    setErrorBanner(null);
    mutate();
  }, [mutate]);

  const isItemMutating = useCallback((id: string) => pendingIds.has(id), [pendingIds]);
  const currentCount = notifications.length;

  return (
    <div className={styles.panel} role="dialog" aria-modal="false" aria-label={`Notificações de ${orgName}`}>
      <header className={styles.header}>
        <TabsContext activeTabId={activeTabIndex}>
          <TabList className={styles.tabBar} aria-label="Categorias de notificações">
            {TAB_ORDER.map((tabKey, index) => (
              <Tab
                key={tabKey}
                value={index}
                active={activeTabIndex === index}
                onClick={() => {
                  setActiveTabIndex(index);
                  trackEvent("notifications.tab_change", { org_id: orgId, tab: tabKey });
                }}
              >
                {TAB_LABELS[tabKey]}
              </Tab>
            ))}
          </TabList>
          <TabPanels activeTabId={activeTabIndex}>
            {TAB_ORDER.map((tabKey, index) => (
              <TabPanel key={tabKey} index={index} className={styles.controls}>
                <Search
                  className={styles.searchField}
                  placeholder="Pesquisar notificações"
                  value={searchValue}
                  onChange={setSearchValue}
                  aria-label="Pesquisar notificações"
                />
                <MenuButton
                  ariaLabel="Filtrar por pessoa"
                  size={MenuButton.sizes.SMALL}
                  tooltipContent="Filtrar por pessoa"
                  className={styles.peopleFilter}
                  closeMenuOnItemClick={false}
                  component={() => (
                    <Button
                      kind={selectedPeople.length > 0 ? Button.kinds.PRIMARY : Button.kinds.SECONDARY}
                      leftIcon={Filter}
                      size={Button.sizes.SMALL}
                    >
                      Pessoas
                    </Button>
                  )}
                >
                  <Menu>
                    {actorOptions.length === 0 ? (
                      <MenuItem disabled title="Nenhum ator identificado" />
                    ) : (
                      actorOptions.map((option) => (
                        <MenuItem
                          key={option.id}
                          title={option.label}
                          onClick={() => handleTogglePerson(option.id)}
                          selected={selectedPeople.includes(option.id)}
                        />
                      ))
                    )}
                    {selectedPeople.length > 0 ? (
                      <MenuItem title="Limpar filtros" onClick={() => setSelectedPeople([])} />
                    ) : null}
                  </Menu>
                </MenuButton>
                <Button
                  kind={Button.kinds.TERTIARY}
                  size={Button.sizes.SMALL}
                  leftIcon={Settings}
                  onClick={() => setPreferencesOpen(true)}
                >
                  Preferências
                </Button>
              </TabPanel>
            ))}
          </TabPanels>
        </TabsContext>
        {selectedPeople.length > 0 || debouncedSearch ? (
          <div className={styles.filterTagList}>
            {debouncedSearch ? <span className={styles.filterTag}>Busca: “{debouncedSearch}”</span> : null}
            {selectedPeople.map((personId) => {
              const option = actorOptions.find((actor) => actor.id === personId);
              return (
                <span key={personId} className={styles.filterTag}>
                  {option?.label ?? personId}
                </span>
              );
            })}
            <Button kind={Button.kinds.TERTIARY} size={Button.sizes.SMALL} onClick={handleResetFilters}>
              Limpar filtros
            </Button>
          </div>
        ) : null}
        {errorBanner ? (
          <AlertBanner className={styles.bannerArea} type={AlertBanner.types.DANGER} text={errorBanner} onClose={() => setErrorBanner(null)} />
        ) : null}
        {error ? (
          <AlertBanner
            className={styles.bannerArea}
            type={AlertBanner.types.DANGER}
            text="Não foi possível carregar as notificações."
            actionText="Tentar novamente"
            onAction={handleRetry}
            onClose={() => setErrorBanner(null)}
          />
        ) : null}
      </header>
      <div ref={bodyRef} className={styles.body} role="list" aria-live="polite">
        {isInitialLoading ? (
          <div className={styles.loadingRegion}>
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className={styles.loadingItem} />
            ))}
          </div>
        ) : currentCount === 0 ? (
          <div className={styles.emptyState}>
            <Text type={Text.types.TEXT2} weight={Text.weights.BOLD} className={styles.emptyTitle}>
              Nenhuma notificação por aqui
            </Text>
            <Text type={Text.types.TEXT3}>
              As novidades aparecem assim que alguém interagir com você ou atribuir um item.
            </Text>
            <Button kind={Button.kinds.SECONDARY} onClick={handleRetry} leftIcon={Retry}>
              Atualizar agora
            </Button>
          </div>
        ) : (
          <ul className={styles.list}>
            {grouped.map((group) => (
              <li key={group.label} className={styles.group}>
                <p className={styles.groupTitle}>{group.label}</p>
                <ul className={styles.list}>
                  {group.items.map((item) => (
                    <NotificationItem
                      key={item.id}
                      item={item}
                      onOpen={handleOpenNotification}
                      onToggleRead={(notification, nextStatus) => handleMarkStatus([notification.id], nextStatus)}
                      onMuteSource={handleMute}
                      isMutating={isItemMutating(item.id)}
                    />
                  ))}
                </ul>
              </li>
            ))}
            <div ref={loadMoreRef} />
          </ul>
        )}
      </div>
      <footer className={styles.footer}>
        <div className={styles.footerActions}>
          <Button kind={Button.kinds.SECONDARY} size={Button.sizes.SMALL} disabled={unreadFromServer === 0} onClick={handleMarkAllRead}>
            Marcar tudo como lido
          </Button>
          <Button kind={Button.kinds.TERTIARY} size={Button.sizes.SMALL} onClick={handleRetry} leftIcon={Retry}>
            Atualizar
          </Button>
        </div>
        <a className={styles.footerLink} href="/notifications">
          Abrir caixa de notificações
        </a>
      </footer>
      <NotificationPreferencesModal
        open={preferencesOpen}
        orgId={orgId}
        onClose={() => setPreferencesOpen(false)}
        onSaved={() => setPreferencesOpen(false)}
      />
    </div>
  );
}
