export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { captureException } from "@sentry/nextjs";
import { ZodError, type z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureOrgMembership, HttpError } from "@/lib/notifications/server";
import { preferencesPatchSchema } from "@/lib/notifications/schema";
import { trackServerEvent } from "@/lib/telemetry.server";

const DEFAULT_PREFERENCES = {
  email_on_mention_weekly: true,
  timezone: "UTC",
};

type PreferencesPayload = z.infer<typeof preferencesPatchSchema>;

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("orgId");

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

  const { data, error } = await supabase
    .from("user_preferences")
    .select("email_on_mention_weekly, timezone")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    captureException(error, { tags: { module: "notifications", action: "preferences_get" } });
    return NextResponse.json({ error: "Falha ao carregar preferências" }, { status: 500 });
  }

  return NextResponse.json(data ?? DEFAULT_PREFERENCES, { headers: { "cache-control": "no-store" } });
}

export async function PATCH(request: NextRequest) {
  const supabase = createSupabaseServerClient();

  let payload: PreferencesPayload;
  try {
    payload = preferencesPatchSchema.parse(await request.json());
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

  const updateValues: { email_on_mention_weekly?: boolean; timezone?: string } = {};

  if (payload.email_on_mention_weekly !== undefined) {
    updateValues.email_on_mention_weekly = payload.email_on_mention_weekly;
  }

  if (payload.timezone !== undefined) {
    updateValues.timezone = payload.timezone;
  }

  const upsertPayload = {
    org_id: payload.orgId,
    user_id: userId,
    ...DEFAULT_PREFERENCES,
    ...updateValues,
  };

  const { data, error } = await supabase
    .from("user_preferences")
    .upsert(upsertPayload, { onConflict: "org_id,user_id" })
    .select("email_on_mention_weekly, timezone")
    .maybeSingle();

  if (error) {
    captureException(error, { tags: { module: "notifications", action: "preferences_patch" } });
    return NextResponse.json({ error: "Não foi possível salvar preferências" }, { status: 500 });
  }

  await trackServerEvent(
    "notifications.preferences_updated",
    {
      email_weekly: data?.email_on_mention_weekly ?? upsertPayload.email_on_mention_weekly,
      timezone: data?.timezone ?? upsertPayload.timezone,
    },
    { distinctId: userId, groups: { orgId: payload.orgId } }
  ).catch(() => undefined);

  return NextResponse.json(data ?? upsertPayload, { headers: { "cache-control": "no-store" } });
}
