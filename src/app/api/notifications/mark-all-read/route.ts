export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { captureException } from "@sentry/nextjs";
import { ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureOrgMembership, HttpError } from "@/lib/notifications/server";
import { markAllBodySchema } from "@/lib/notifications/schema";
import { trackServerEvent } from "@/lib/telemetry.server";

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();

  let payload: { orgId: string };
  try {
    payload = markAllBodySchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
    }
    captureException(error);
    return NextResponse.json({ error: "Não foi possível processar a requisição" }, { status: 400 });
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

  const { error } = await supabase
    .from("notifications")
    .update({ status: "read", read_at: new Date().toISOString() })
    .eq("org_id", payload.orgId)
    .eq("user_id", userId)
    .eq("status", "unread");

  if (error) {
    captureException(error, { tags: { module: "notifications", action: "mark_all_read" } });
    return NextResponse.json({ error: "Falha ao marcar notificações como lidas" }, { status: 500 });
  }

  await trackServerEvent(
    "notifications.mark_all_read_api",
    { org_id: payload.orgId },
    { distinctId: userId, groups: { orgId: payload.orgId } }
  ).catch(() => undefined);

  return NextResponse.json({ success: true }, { headers: { "cache-control": "no-store" } });
}
