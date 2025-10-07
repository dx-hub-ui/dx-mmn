import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Server configuration missing" }, { status: 500 });
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    return NextResponse.json({ error: "Failed to retrieve session" }, { status: 500 });
  }

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token = body.token as string | undefined;

  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 422 });
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/redeem_invite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      token,
      userId: session.user.id,
    }),
  });

  const payload = await response.json().catch(() => ({ error: "Unknown error" }));

  if (!response.ok) {
    return NextResponse.json(payload, { status: response.status });
  }

  const organizationId = payload.organizationId as string | undefined;

  if (!organizationId) {
    return NextResponse.json({ error: "Invalid response from invite redemption" }, { status: 500 });
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("slug")
    .eq("id", organizationId)
    .single();

  if (organizationError || !organization) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const redirectUrl = new URL(`/app/${organization.slug}`, request.url);

  return NextResponse.redirect(redirectUrl, { status: 303 });
}
