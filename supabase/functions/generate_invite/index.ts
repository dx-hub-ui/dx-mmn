import { serve } from "std/http/server";
import { createClient } from "@supabase/supabase-js";

type GenerateInviteBody = {
  organizationId: string;
  generatedByMembershipId: string;
  roleToAssign: "leader" | "rep";
  parentLeaderId?: string;
  maxUses?: number;
  expiresAt?: string;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: GenerateInviteBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { organizationId, generatedByMembershipId, roleToAssign, parentLeaderId, maxUses, expiresAt } = body ?? {};

  if (!organizationId || !generatedByMembershipId || !roleToAssign) {
    return new Response(JSON.stringify({ error: "organizationId, generatedByMembershipId and roleToAssign are required" }), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (roleToAssign !== "leader" && roleToAssign !== "rep") {
    return new Response(JSON.stringify({ error: "roleToAssign must be leader or rep" }), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: generator, error: generatorError } = await supabase
    .from("memberships")
    .select("id, organization_id, role, status")
    .eq("id", generatedByMembershipId)
    .eq("organization_id", organizationId)
    .single();

  if (generatorError || !generator) {
    console.error(generatorError);
    return new Response(JSON.stringify({ error: "Generator membership not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (generator.status !== "active") {
    return new Response(JSON.stringify({ error: "Membership is not active" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (generator.role !== "org" && generator.role !== "leader") {
    return new Response(JSON.stringify({ error: "Only org or leader can generate invites" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  let resolvedParentLeaderId: string | null = null;
  if (parentLeaderId) {
    const { data: parent, error: parentError } = await supabase
      .from("memberships")
      .select("id, organization_id, role, status")
      .eq("id", parentLeaderId)
      .maybeSingle();

    if (parentError) {
      console.error(parentError);
      return new Response(JSON.stringify({ error: "Failed to validate parent leader" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!parent || parent.organization_id !== organizationId) {
      return new Response(JSON.stringify({ error: "parentLeaderId must belong to the same organization" }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (parent.role !== "leader" || parent.status !== "active") {
      return new Response(JSON.stringify({ error: "parentLeaderId must reference an active leader" }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (roleToAssign === "leader") {
      return new Response(JSON.stringify({ error: "parentLeaderId cannot be provided when inviting a leader" }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (generator.role === "leader" && parent.id !== generator.id) {
      return new Response(JSON.stringify({ error: "Leaders can only assign reps to themselves" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    resolvedParentLeaderId = parent.id;
  } else if (roleToAssign === "rep" && generator.role === "leader") {
    resolvedParentLeaderId = generator.id;
  }

  if (typeof maxUses !== "undefined" && (!Number.isInteger(maxUses) || maxUses <= 0)) {
    return new Response(JSON.stringify({ error: "maxUses must be a positive integer" }), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });
  }

  let expiresAtIso: string | null = null;
  if (expiresAt) {
    const parsed = new Date(expiresAt);
    if (Number.isNaN(parsed.getTime())) {
      return new Response(JSON.stringify({ error: "expiresAt must be a valid date" }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      });
    }
    expiresAtIso = parsed.toISOString();
  }

  const token = generateToken();

  const { data: invite, error: inviteError } = await supabase
    .from("invite_links")
    .insert({
      organization_id: organizationId,
      generated_by_membership_id: generatedByMembershipId,
      role_to_assign: roleToAssign,
      parent_leader_id: resolvedParentLeaderId,
      token,
      max_uses: maxUses ?? 1,
      expires_at: expiresAtIso,
    })
    .select("token")
    .single();

  if (inviteError || !invite) {
    console.error(inviteError);
    return new Response(JSON.stringify({ error: "Failed to generate invite" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ token: invite.token }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
});
