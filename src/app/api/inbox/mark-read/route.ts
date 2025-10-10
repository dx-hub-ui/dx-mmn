export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { captureException } from "@sentry/nextjs";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureOrgMembership, HttpError } from "@/lib/notifications/server";
import { trackServerEvent } from "@/lib/telemetry.server";

const bodySchema = z.object({
  orgId: z.string().uuid(),
  ids: z.array(z.string().uuid()).min(1),
});

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

  let userId: string;
  try {
    const { user } = await ensureOrgMembership(supabase, payload.orgId);
    userId = user.id;
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    captureException(error);
    return NextResponse.json({ error: "Erro inesperado" }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from("notifications")
    .update({ status: "read", read_at: new Date().toISOString() })
    .in("id", payload.ids)
    .eq("org_id", payload.orgId)
    .eq("user_id", userId);

  if (updateError) {
    captureException(updateError, { tags: { module: "inbox", action: "mark_read" } });
    return NextResponse.json({ error: "Não foi possível atualizar" }, { status: 500 });
  }

  const { data: counterData, error: counterError } = await supabase
    .from("notification_counters")
    .select("unread_count")
    .eq("org_id", payload.orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (counterError) {
    captureException(counterError, { tags: { module: "inbox", stage: "counter" } });
    return NextResponse.json({ error: "Falha ao carregar contador" }, { status: 500 });
  }

  await trackServerEvent(
    "inbox.mark_read",
    { org_id: payload.orgId, total: payload.ids.length },
    { distinctId: userId, groups: { orgId: payload.orgId } }
  ).catch(() => undefined);

  return NextResponse.json({ unreadCount: counterData?.unread_count ?? 0 }, { headers: { "cache-control": "no-store" } });
}
