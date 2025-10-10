export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { captureException } from "@sentry/nextjs";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureOrgMembership, HttpError } from "@/lib/notifications/server";
import { trackServerEvent } from "@/lib/telemetry.server";

const bodySchema = z.object({
  orgId: z.string().uuid(),
  id: z.string().uuid(),
  on: z.boolean(),
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

  if (payload.on) {
    const { error: insertError } = await supabase.from("notification_bookmarks").insert({
      org_id: payload.orgId,
      user_id: userId,
      notification_id: payload.id,
    });
    if (insertError && insertError.code !== "23505") {
      captureException(insertError, { tags: { module: "inbox", action: "bookmark_on" } });
      return NextResponse.json({ error: "Falha ao favoritar" }, { status: 500 });
    }
    await trackServerEvent(
      "inbox.bookmark_on",
      { org_id: payload.orgId, notification_id: payload.id },
      { distinctId: userId, groups: { orgId: payload.orgId } }
    ).catch(() => undefined);
  } else {
    const { error: deleteError } = await supabase
      .from("notification_bookmarks")
      .delete()
      .eq("org_id", payload.orgId)
      .eq("user_id", userId)
      .eq("notification_id", payload.id);

    if (deleteError) {
      captureException(deleteError, { tags: { module: "inbox", action: "bookmark_off" } });
      return NextResponse.json({ error: "Falha ao remover favorito" }, { status: 500 });
    }
    await trackServerEvent(
      "inbox.bookmark_off",
      { org_id: payload.orgId, notification_id: payload.id },
      { distinctId: userId, groups: { orgId: payload.orgId } }
    ).catch(() => undefined);
  }

  return NextResponse.json({ success: true }, { headers: { "cache-control": "no-store" } });
}
