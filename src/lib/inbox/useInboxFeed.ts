"use client";

import { useCallback, useMemo } from "react";
import useSWRInfinite from "swr/infinite";
import { captureException } from "@sentry/nextjs";
import type { InboxResponse, InboxItemDTO } from "@/types/inbox";

const ENDPOINT = "/api/inbox";

type UseInboxFeedOptions = {
  orgId: string;
  tab: string;
  show: string;
  board: string;
};

type MarkReadFn = (ids: string[]) => Promise<void>;

type MarkAllFn = () => Promise<number>;

const fetcher = async (key: string): Promise<InboxResponse> => {
  const response = await fetch(key, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Falha ao carregar feed (${response.status})`);
  }
  return response.json();
};

export function useInboxFeed({ orgId, tab, show, board }: UseInboxFeedOptions) {
  const keyBuilder = useCallback(
    (pageIndex: number, previousPageData: InboxResponse | null) => {
      if (!orgId) {
        return null;
      }
      if (previousPageData && !previousPageData.nextCursor && pageIndex > 0) {
        return null;
      }
      const search = new URLSearchParams({
        orgId,
        tab,
        show,
        board,
      });
      if (pageIndex > 0 && previousPageData?.nextCursor) {
        search.set("cursor", previousPageData.nextCursor);
      }
      return `${ENDPOINT}?${search.toString()}`;
    },
    [board, orgId, show, tab]
  );

  const { data, error, isLoading, size, setSize, mutate, isValidating } = useSWRInfinite<InboxResponse>(keyBuilder, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  const pages = useMemo(() => data ?? [], [data]);

  const items = useMemo<InboxItemDTO[]>(() => pages.flatMap((page) => page.items), [pages]);
  const counts = pages[0]?.counts ?? { all: 0, without: 0 };
  const unreadCount = pages[0]?.unreadCount ?? 0;
  const hasMore = Boolean(pages.length > 0 && pages[pages.length - 1]?.nextCursor);

  const loadMore = useCallback(async () => {
    if (!hasMore) {
      return;
    }
    await setSize((current) => current + 1);
  }, [hasMore, setSize]);

  const markRead: MarkReadFn = useCallback(
    async (ids) => {
      if (!ids.length) {
        return;
      }
      try {
        const response = await fetch("/api/inbox/mark-read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ orgId, ids }),
        });
        if (!response.ok) {
          throw new Error(`Falha ao marcar como lido (${response.status})`);
        }
        await mutate();
      } catch (mutationError) {
        captureException(mutationError, { tags: { module: "inbox", action: "mark_read" } });
        throw mutationError;
      }
    },
    [mutate, orgId]
  );

  const markAllRead: MarkAllFn = useCallback(async () => {
    try {
      const response = await fetch("/api/inbox/mark-all-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orgId, tab, show, board }),
      });
      if (!response.ok) {
        throw new Error(`Falha ao marcar tudo (${response.status})`);
      }
      const payload = await response.json();
      await mutate();
      return payload.unreadCount ?? 0;
    } catch (mutationError) {
      captureException(mutationError, { tags: { module: "inbox", action: "mark_all_read" } });
      throw mutationError;
    }
  }, [board, mutate, orgId, show, tab]);

  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  return {
    items,
    counts,
    unreadCount,
    error: (error as Error | undefined) ?? null,
    isLoading,
    isValidating,
    hasMore,
    loadMore,
    mutate,
    size,
    markRead,
    markAllRead,
    refresh,
  };
}
