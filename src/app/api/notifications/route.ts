export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { captureException } from "@sentry/nextjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { decodeCursor, encodeCursor } from "@/lib/notifications/utils";
import { peopleSchema, tabSchema } from "@/lib/notifications/schema";
import type { NotificationItemDTO, NotificationStatus } from "@/types/notifications";
import { ensureOrgMembership, HttpError } from "@/lib/notifications/server";

type RawNotificationRow = {
  id: string;
  org_id: string;
  user_id: string;
  type: string;
  source_type: string;
  source_id: string;
  actor_id: string | null;
  title: string | null;
  snippet: string | null;
  link: string | null;
  status: string;
  created_at: string;
  read_at: string | null;
  actor: unknown;
};

type ActorRecord = {
  id: string;
  email: string | null;
  raw_user_meta_data: Record<string, unknown> | null;
};

type NormalizedNotificationRow = Omit<RawNotificationRow, "actor"> & {
  actor: ActorRecord | null;
};

function toActorRecord(value: unknown): ActorRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<ActorRecord> & { id?: string | null };
  if (!candidate.id) {
    return null;
  }
  return {
    id: candidate.id,
    email: candidate.email ?? null,
    raw_user_meta_data: candidate.raw_user_meta_data ?? null,
  };
}

function normalizeActor(actor: RawNotificationRow["actor"]): NormalizedNotificationRow["actor"] {
  if (!actor) {
    return null;
  }

  if (Array.isArray(actor)) {
    for (const value of actor) {
      const record = toActorRecord(value);
      if (record) {
        return record;
      }
    }
    return null;
  }

  return toActorRecord(actor);
}

function normalizeRows(data: unknown): NormalizedNotificationRow[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return (data as RawNotificationRow[]).map((row) => ({
    ...row,
    actor: normalizeActor(row.actor),
  }));
}

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { searchParams } = new URL(request.url);

  const orgId = searchParams.get("orgId");

  const tabResult = tabSchema.safeParse(searchParams.get("tab") ?? undefined);
  if (!tabResult.success) {
    return NextResponse.json({ error: "Aba inválida" }, { status: 400 });
  }
  const tab = tabResult.data;

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

  const cursor = decodeCursor(searchParams.get("cursor"));
  const search = searchParams.get("q")?.trim();
  const peopleResult = peopleSchema.safeParse(searchParams.getAll("people[]"));
  if (!peopleResult.success) {
    return NextResponse.json({ error: "Filtro de pessoa inválido" }, { status: 400 });
  }
  const people = peopleResult.data;

  let query = supabase
    .from("notifications")
    .select(
      `id, org_id, user_id, type, source_type, source_id, actor_id, title, snippet, link, status, created_at, read_at, actor:profiles!notifications_actor_id_fkey (id, email, raw_user_meta_data)`
    )
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(21);

  if (tab === "unread") {
    query = query.eq("status", "unread");
  } else if (tab === "mentions") {
    query = query.eq("type", "mention");
  } else if (tab === "assigned") {
    query = query.eq("type", "assignment");
  }

  if (search) {
    const term = `%${search}%`;
    query = query.or(`title.ilike.${term},snippet.ilike.${term}`);
  }

  if (people.length > 0) {
    query = query.in("actor_id", people);
  }

  if (cursor) {
    query = query.or(
      `and(created_at.lt.${cursor.createdAt}),and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
    );
  }

  const { data, error } = await query;
  if (error) {
    captureException(error);
    return NextResponse.json({ error: "Falha ao carregar notificações" }, { status: 500 });
  }

  const rows = normalizeRows(data);
  let nextCursor: string | undefined;
  if (rows.length > 20) {
    const last = rows.pop();
    if (last) {
      nextCursor = encodeCursor({ createdAt: last.created_at, id: last.id });
    }
  }

  const items: NotificationItemDTO[] = rows.map((row) => {
    const actorMeta = (row.actor?.raw_user_meta_data as Record<string, unknown> | null) ?? null;
    const displayName =
      (actorMeta?.full_name as string | undefined) ||
      (actorMeta?.name as string | undefined) ||
      row.actor?.email ||
      null;
    const avatarUrl = (actorMeta?.avatar_url as string | undefined) ?? null;

    return {
      id: row.id,
      orgId: row.org_id,
      userId: row.user_id,
      type: row.type,
      sourceType: row.source_type,
      sourceId: row.source_id,
      actor: row.actor
        ? {
            id: row.actor.id,
            displayName: displayName ?? "Usuário",
            email: row.actor.email,
            avatarUrl,
          }
        : null,
      title: row.title,
      snippet: row.snippet,
      link: row.link,
      status: row.status as NotificationStatus,
      createdAt: row.created_at,
      readAt: row.read_at,
    };
  });

  const { data: counter } = await supabase
    .from("notification_counters")
    .select("unread_count")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  return NextResponse.json({
    items,
    nextCursor,
    unreadCount: counter?.unread_count ?? 0,
  });
}
