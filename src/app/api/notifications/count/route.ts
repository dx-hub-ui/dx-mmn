import { NextRequest, NextResponse } from "next/server";
import { captureException } from "@sentry/nextjs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureOrgMembership, HttpError } from "@/lib/notifications/server";

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
    .from("notification_counters")
    .select("unread_count")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    captureException(error, { tags: { module: "notifications", action: "count" } });
    return NextResponse.json({ error: "Falha ao carregar contador" }, { status: 500 });
  }

  return NextResponse.json(
    { unreadCount: data?.unread_count ?? 0 },
    {
      headers: {
        "cache-control": "no-store",
      },
    }
  );
}
