import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const allowedRoles = new Set(["leader", "rep"]);

export async function POST(request: NextRequest) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? null;
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

  const organizationId = body.organizationId as string | undefined;
  const roleToAssign = body.roleToAssign as string | undefined;
  const parentLeaderId = body.parentLeaderId as string | undefined;
  const maxUses = body.maxUses as number | undefined;
  const expiresAt = body.expiresAt as string | undefined;

  if (!organizationId || !roleToAssign) {
    return NextResponse.json({ error: "organizationId and roleToAssign are required" }, { status: 422 });
  }

  if (!allowedRoles.has(roleToAssign)) {
    return NextResponse.json({ error: "roleToAssign must be leader or rep" }, { status: 422 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("id, role, status")
    .eq("organization_id", organizationId)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (membershipError) {
    return NextResponse.json({ error: "Failed to verify membership" }, { status: 500 });
  }

  if (!membership || membership.status !== "active") {
    return NextResponse.json({ error: "Membership not found" }, { status: 404 });
  }

  if (membership.role !== "org" && membership.role !== "leader") {
    return NextResponse.json({ error: "Only org or leader can generate invites" }, { status: 403 });
  }

  const generatedByMembershipId = (body.generatedByMembershipId as string | undefined) ?? membership.id;

  if (generatedByMembershipId !== membership.id) {
    return NextResponse.json({ error: "generatedByMembershipId must match the caller membership" }, { status: 403 });
  }

  const baseUrl = supabaseUrl.replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/functions/v1/generate_invite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      organizationId,
      generatedByMembershipId,
      roleToAssign,
      parentLeaderId,
      maxUses,
      expiresAt,
    }),
  });

  const payload = await response.json().catch(() => ({ error: "Unknown error" }));

  return NextResponse.json(payload, { status: response.status });
}
