import { NextRequest, NextResponse } from "next/server";
import { captureException } from "@sentry/nextjs";
import { ZodError, type z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureOrgMembership, HttpError } from "@/lib/notifications/server";
import { muteBodySchema } from "@/lib/notifications/schema";
import { trackServerEvent } from "@/lib/telemetry.server";

type MutePayload = z.infer<typeof muteBodySchema>;

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();

  let payload: MutePayload;
  try {
    payload = muteBodySchema.parse(await request.json());
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

  const filters = supabase.from("notification_mutes").select("id").eq("org_id", payload.orgId).eq("user_id", userId);

  if (payload.scope === "source") {
    filters.eq("scope", "source").eq("source_type", payload.source_type).eq("source_id", payload.source_id);
  } else {
    filters.eq("scope", "type").eq("type", payload.type);
  }

  const { data: existing, error: existingError } = await filters.maybeSingle();

  if (existingError) {
    captureException(existingError, { tags: { module: "notifications", action: "mute_lookup" } });
    return NextResponse.json({ error: "Falha ao verificar mutes existentes" }, { status: 500 });
  }

  if (existing) {
    return NextResponse.json({ success: true, id: existing.id }, { headers: { "cache-control": "no-store" } });
  }

  const insertPayload =
    payload.scope === "source"
      ? {
          scope: "source" as const,
          org_id: payload.orgId,
          user_id: userId,
          source_type: payload.source_type,
          source_id: payload.source_id,
        }
      : {
          scope: "type" as const,
          org_id: payload.orgId,
          user_id: userId,
          type: payload.type,
        };

  const { data, error } = await supabase
    .from("notification_mutes")
    .insert(insertPayload)
    .select("id")
    .maybeSingle();

  if (error) {
    captureException(error, { tags: { module: "notifications", action: "mute_insert" } });
    return NextResponse.json({ error: "Não foi possível silenciar notificações" }, { status: 500 });
  }

  await trackServerEvent(
    "notifications.mute_api",
    {
      scope: payload.scope,
      source_type: payload.scope === "source" ? payload.source_type : undefined,
      type: payload.scope === "type" ? payload.type : undefined,
    },
    { distinctId: userId, groups: { orgId: payload.orgId } }
  ).catch(() => undefined);

  return NextResponse.json({ success: true, id: data?.id ?? null }, { headers: { "cache-control": "no-store" } });
}
