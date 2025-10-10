export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { captureException } from "@sentry/nextjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureOrgMembership, HttpError } from "@/lib/notifications/server";
import { parseInboxQuery } from "@/lib/inbox/schema";
import { decodeCursor, encodeCursor } from "@/lib/inbox/cursor";
import { mapInboxRow, type InboxViewRow } from "@/lib/inbox/mapper";
import type { InboxResponse } from "@/types/inbox";

const SELECT_FIELDS =
  "id, org_id, user_id, type, source_type, source_id, actor_id, title, snippet, link, status, created_at, read_at, board_id, board_label, actor_email, actor_meta, actor_display_name, actor_avatar_url";

function selectWithBookmarks(select: string, tab: string) {
  return tab === "bookmarked" ? `${select},notification_bookmarks!inner()` : select;
}

function isInboxRow(row: unknown): row is InboxViewRow {
  if (typeof row !== "object" || row === null) {
    return false;
  }

  const candidate = row as Partial<InboxViewRow>;
  return typeof candidate.id === "string" && typeof candidate.org_id === "string" && typeof candidate.user_id === "string";
}

type FilterableQuery = {
  eq(column: string, value: unknown): FilterableQuery;
  is(column: string, value: unknown): FilterableQuery;
};

function applyCommonFilters<T>(query: T, params: {
  orgId: string;
  userId: string;
  tab: string;
  show: string;
}) {
  let nextQuery = (query as unknown as FilterableQuery)
    .eq("org_id", params.orgId)
    .eq("user_id", params.userId);

  if (params.tab === "mentions") {
    nextQuery = nextQuery.eq("type", "mention");
  } else if (params.tab === "bookmarked") {
    nextQuery = nextQuery
      .eq("notification_bookmarks.org_id", params.orgId)
      .eq("notification_bookmarks.user_id", params.userId);
  }

  if (params.show === "unread") {
    nextQuery = nextQuery.eq("status", "unread");
  }

  return nextQuery as unknown as T;
}

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("orgId");

  const queryInput = parseInboxQuery(searchParams);

  let userId: string;
  try {
    const { user } = await ensureOrgMembership(supabase, orgId);
    userId = user.id;
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    captureException(error);
    return NextResponse.json({ error: "Erro inesperado" }, { status: 500 });
  }

  if (!orgId) {
    return NextResponse.json({ error: "orgId é obrigatório" }, { status: 400 });
  }

  const { tab, show, board, cursor, limit } = queryInput;

  if (tab !== "all" && tab !== "mentions" && tab !== "bookmarked") {
    const empty: InboxResponse = {
      items: [],
      counts: { all: 0, without: 0 },
      unreadCount: 0,
    };
    return NextResponse.json(empty, { headers: { "cache-control": "no-store" } });
  }

  let listQuery = applyCommonFilters(
    supabase
      .from("v_user_updates")
      .select(selectWithBookmarks(SELECT_FIELDS, tab))
      .order("created_at", { ascending: false })
      .order("id", { ascending: false }),
    { orgId, userId, tab, show }
  ).limit(limit + 1);

  if (board === "without") {
    listQuery = listQuery.is("board_id", null);
  } else if (board !== "all") {
    listQuery = listQuery.eq("board_id", board);
  }

  const decodedCursor = decodeCursor(cursor);
  if (decodedCursor) {
    listQuery = listQuery.or(
      `and(created_at.lt.${decodedCursor.createdAt}),and(created_at.eq.${decodedCursor.createdAt},id.lt.${decodedCursor.id})`
    );
  }

  const { data, error } = await listQuery;
  if (error) {
    captureException(error, { tags: { module: "inbox", stage: "list" } });
    return NextResponse.json({ error: "Falha ao carregar feed" }, { status: 500 });
  }

  const rows: InboxViewRow[] = [];
  for (const row of data ?? []) {
    if (isInboxRow(row)) {
      rows.push(row);
    }
  }

  let nextCursor: string | undefined;
  if (rows.length > limit) {
    const last = rows.pop();
    if (last) {
      nextCursor = encodeCursor({ createdAt: last.created_at, id: last.id });
    }
  }

  const ids = rows.map((row) => row.id);

  const [bookmarkResult, countAllResult, countWithoutResult, unreadCountResult] = await Promise.all([
    ids.length
      ? supabase
          .from("notification_bookmarks")
          .select("notification_id")
          .eq("org_id", orgId)
          .eq("user_id", userId)
          .in("notification_id", ids)
      : Promise.resolve({ data: [] as { notification_id: string }[], error: null }),
    applyCommonFilters(
      supabase
        .from("v_user_updates")
        .select(selectWithBookmarks("id", tab), { head: true, count: "exact" }),
      { orgId, userId, tab, show }
    ),
    applyCommonFilters(
      supabase
        .from("v_user_updates")
        .select(selectWithBookmarks("id", tab), { head: true, count: "exact" })
        .is("board_id", null),
      { orgId, userId, tab, show }
    ),
    supabase
      .from("notification_counters")
      .select("unread_count")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (bookmarkResult.error) {
    captureException(bookmarkResult.error, { tags: { module: "inbox", stage: "bookmark_lookup" } });
    return NextResponse.json({ error: "Falha ao carregar favoritos" }, { status: 500 });
  }
  if (countAllResult.error) {
    captureException(countAllResult.error, { tags: { module: "inbox", stage: "count_all" } });
    return NextResponse.json({ error: "Falha ao carregar contagem" }, { status: 500 });
  }
  if (countWithoutResult.error) {
    captureException(countWithoutResult.error, { tags: { module: "inbox", stage: "count_without" } });
    return NextResponse.json({ error: "Falha ao carregar contagem" }, { status: 500 });
  }
  if (unreadCountResult.error) {
    captureException(unreadCountResult.error, { tags: { module: "inbox", stage: "unread_count" } });
    return NextResponse.json({ error: "Falha ao carregar contagem" }, { status: 500 });
  }

  const bookmarkSet = new Set((bookmarkResult.data ?? []).map((row) => row.notification_id));

  const items = rows.map((row) => mapInboxRow(row, bookmarkSet.has(row.id)));

  const response: InboxResponse = {
    items,
    counts: {
      all: countAllResult.count ?? 0,
      without: countWithoutResult.count ?? 0,
    },
    nextCursor,
    unreadCount: unreadCountResult.data?.unread_count ?? 0,
  };

  return NextResponse.json(response, { headers: { "cache-control": "no-store" } });
}
