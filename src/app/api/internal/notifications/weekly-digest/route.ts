import { NextRequest, NextResponse } from "next/server";
import { captureException } from "@sentry/nextjs";
import { ZodError, z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { trackServerEvent } from "@/lib/telemetry.server";
import { sendWeeklyMentionDigestEmail, type WeeklyDigestSection } from "@/lib/notifications/pipeline";

const requestSchema = z.object({
  payload: z.object({
    org_id: z.string().uuid(),
    user_id: z.string().uuid(),
    timezone: z.string().min(1),
    email: z.string().email(),
    full_name: z.string().min(1),
  }),
});

type DigestRequest = z.infer<typeof requestSchema>;

type NotificationRow = {
  id: string;
  type: string;
  source_type: string;
  source_id: string;
  title: string | null;
  snippet: string | null;
  link: string | null;
  created_at: string;
  actor: {
    id: string;
    email: string | null;
    raw_user_meta_data: Record<string, unknown> | null;
  } | null;
};

function resolveActorName(row: NotificationRow["actor"]): string {
  if (!row) {
    return "Alguém";
  }
  const meta = row.raw_user_meta_data ?? {};
  const fullName = (meta["full_name"] as string | undefined) ?? (meta["name"] as string | undefined);
  return fullName ?? row.email ?? "Alguém";
}

function resolveSectionLabel(sourceType: string) {
  switch (sourceType) {
    case "comment":
      return "Comentários";
    case "card":
      return "Cards";
    case "sequence":
      return "Sequências";
    case "playbook":
      return "Playbooks";
    default:
      return sourceType.charAt(0).toUpperCase() + sourceType.slice(1);
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.INTERNAL_WEBHOOK_SECRET;
  if (!secret) {
    captureException(new Error("INTERNAL_WEBHOOK_SECRET não configurada"));
    return NextResponse.json({ error: "Configuração ausente" }, { status: 500 });
  }

  const providedSecret = request.headers.get("x-internal-secret");
  if (providedSecret !== secret) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let body: DigestRequest;
  try {
    body = requestSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
    }
    captureException(error);
    return NextResponse.json({ error: "Falha ao processar payload" }, { status: 400 });
  }

  const {
    payload: { org_id: orgId, user_id: userId, timezone, email, full_name: fullName },
  } = body;

  await trackServerEvent(
    "notifications.weekly_digest_enqueued",
    { org_id: orgId },
    { distinctId: userId, groups: { orgId } }
  ).catch(() => undefined);

  const supabase = createSupabaseServiceClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("notifications")
    .select(
      `id, type, source_type, source_id, title, snippet, link, created_at,
       actor:profiles!notifications_actor_id_fkey (id, email, raw_user_meta_data)`
    )
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .eq("type", "mention")
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (error) {
    captureException(error, { tags: { module: "notifications", action: "weekly_digest_query" } });
    return NextResponse.json({ error: "Falha ao consultar notificações" }, { status: 500 });
  }

  const rows = (data as NotificationRow[] | null) ?? [];

  if (rows.length === 0) {
    await trackServerEvent(
      "notifications.weekly_digest_skipped_pref",
      { org_id: orgId, reason: "empty" },
      { distinctId: userId, groups: { orgId } }
    ).catch(() => undefined);
    return NextResponse.json({ skipped: true, reason: "empty" });
  }

  const sections = new Map<string, WeeklyDigestSection>();

  for (const row of rows) {
    if (!sections.has(row.source_type)) {
      sections.set(row.source_type, { label: resolveSectionLabel(row.source_type), items: [] });
    }
    const section = sections.get(row.source_type)!;
    if (section.items.length >= 10) {
      continue;
    }
    section.items.push({
      id: row.id,
      title: row.title,
      snippet: row.snippet,
      link: row.link,
      actorName: resolveActorName(row.actor),
      createdAt: row.created_at,
    });
  }

  if (sections.size === 0) {
    await trackServerEvent(
      "notifications.weekly_digest_skipped_pref",
      { org_id: orgId, reason: "filtered" },
      { distinctId: userId, groups: { orgId } }
    ).catch(() => undefined);
    return NextResponse.json({ skipped: true, reason: "filtered" });
  }

  try {
    await sendWeeklyMentionDigestEmail({
      to: { email, name: fullName },
      orgId,
      userId,
      timezone,
      sections: Array.from(sections.values()).map((section) => ({
        label: section.label,
        items: section.items,
      })),
    });
  } catch (sendError) {
    captureException(sendError, { tags: { module: "notifications", action: "weekly_digest_send" } });
    return NextResponse.json({ error: "Falha ao enviar digest" }, { status: 500 });
  }

  await trackServerEvent(
    "notifications.weekly_digest_sent",
    { org_id: orgId, total_sections: sections.size },
    { distinctId: userId, groups: { orgId } }
  ).catch(() => undefined);

  return NextResponse.json({ delivered: true });
}
