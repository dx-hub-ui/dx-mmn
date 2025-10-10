export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { captureException } from "@sentry/nextjs";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureOrgMembership, HttpError } from "@/lib/notifications/server";
import { trackServerEvent } from "@/lib/telemetry.server";

const bodySchema = z.object({
  orgId: z.string().uuid(),
  tab: z.string().optional(),
  show: z.string().optional(),
  board: z.string().optional(),
});

const MAX_BATCH = 1000;

type FilterableQuery<T> = {
  eq(column: string, value: unknown): T;
  is(column: string, value: unknown): T;
};

function hasId(row: unknown): row is { id: string } {
  if (typeof row !== "object" || row === null) {
    return false;
  }

  const candidate = row as { id?: unknown };
  return typeof candidate.id === "string";
}

function selectWithBookmarks(select: string, tab: string) {
  return tab === "bookmarked" ? `${select},notification_bookmarks!inner()` : select;
}

function applyFilters<T extends FilterableQuery<T>>(
  query: T,
  params: { orgId: string; userId: string; tab?: string | null; board?: string | null }
) {
  let next = query.eq("org_id", params.orgId).eq("user_id", params.userId);

  if (params.tab === "mentions") {
    next = next.eq("type", "mention");
  } else if (params.tab === "bookmarked") {
    next = next
      .eq("notification_bookmarks.org_id", params.orgId)
      .eq("notification_bookmarks.user_id", params.userId);
  }

  if (params.board === "without") {
    next = next.is("board_id", null);
  } else if (params.board && params.board !== "all") {
    next = next.eq("board_id", params.board);
  }

  return next;
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();

  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
    }
    captureException(error);
    return NextResponse.json({ error: "Erro ao ler payload" }, { status: 400 });
  }

  const { orgId, tab = "all", board = "all" } = payload;
  const show = payload.show === "all" ? "all" : "unread";

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

  let selectQuery = applyFilters(
    supabase
      .from("v_user_updates")
      .select(selectWithBookmarks("id", tab))
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(MAX_BATCH),
    { orgId, userId, tab, board }
  );

  if (show === "unread") {
    selectQuery = selectQuery.eq("status", "unread");
  }

  const { data: rows, error: selectError } = await selectQuery;
  if (selectError) {
    captureException(selectError, { tags: { module: "inbox", stage: "select_batch" } });
    return NextResponse.json({ error: "Falha ao coletar itens" }, { status: 500 });
  }

  const ids: string[] = [];
  for (const row of rows ?? []) {
    if (hasId(row)) {
      ids.push(row.id);
    }
  }
  if (ids.length === 0) {
    const { data: counterData, error: counterError } = await supabase
      .from("notification_counters")
      .select("unread_count")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();

    if (counterError) {
      captureException(counterError, { tags: { module: "inbox", stage: "counter" } });
      return NextResponse.json({ error: "Falha ao carregar contador" }, { status: 500 });
    }

    return NextResponse.json({ unreadCount: counterData?.unread_count ?? 0 }, { headers: { "cache-control": "no-store" } });
  }

  const { error: updateError } = await supabase
    .from("notifications")
    .update({ status: "read", read_at: new Date().toISOString() })
    .in("id", ids)
    .eq("org_id", orgId)
    .eq("user_id", userId);

  if (updateError) {
    captureException(updateError, { tags: { module: "inbox", stage: "update_batch" } });
    return NextResponse.json({ error: "Falha ao atualizar" }, { status: 500 });
  }

  const { data: counterData, error: counterError } = await supabase
    .from("notification_counters")
    .select("unread_count")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (counterError) {
    captureException(counterError, { tags: { module: "inbox", stage: "counter" } });
    return NextResponse.json({ error: "Falha ao carregar contador" }, { status: 500 });
  }

  await trackServerEvent(
    "inbox.mark_all_read",
    { org_id: orgId, total: ids.length, tab },
    { distinctId: userId, groups: { orgId } }
  ).catch(() => undefined);

  return NextResponse.json({ unreadCount: counterData?.unread_count ?? 0 }, { headers: { "cache-control": "no-store" } });
}
