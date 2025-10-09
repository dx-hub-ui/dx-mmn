import { NextRequest, NextResponse } from "next/server";
import { captureException } from "@sentry/nextjs";
import { ZodError, type z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureOrgMembership, HttpError } from "@/lib/notifications/server";
import { markStatusBodySchema } from "@/lib/notifications/schema";
import { trackServerEvent } from "@/lib/telemetry.server";

type MarkStatusPayload = z.infer<typeof markStatusBodySchema>;

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();

  let parsedBody: MarkStatusPayload;
  try {
    const body = await request.json();
    parsedBody = markStatusBodySchema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
    }
    captureException(error);
    return NextResponse.json({ error: "Não foi possível processar o corpo da requisição" }, { status: 400 });
  }

  const { orgId, ids, status } = parsedBody;

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

  const updatePayload = {
    status: status === "read" ? "read" : "unread",
    read_at: status === "read" ? new Date().toISOString() : null,
  };

  const { error } = await supabase
    .from("notifications")
    .update(updatePayload)
    .in("id", ids)
    .eq("org_id", orgId)
    .eq("user_id", userId);

  if (error) {
    captureException(error, { tags: { module: "notifications", action: "mark_read" } });
    return NextResponse.json({ error: "Falha ao atualizar notificações" }, { status: 500 });
  }

  await trackServerEvent("notifications.read_api", {
    total_ids: ids.length,
    status,
  }, {
    distinctId: userId,
    groups: { orgId },
  }).catch(() => undefined);

  return NextResponse.json({ updated: ids.length }, { headers: { "cache-control": "no-store" } });
}
