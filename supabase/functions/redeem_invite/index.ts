import { serve } from "std/http/server";
import { createClient } from "@supabase/supabase-js";

type RedeemInviteBody = {
  token: string;
  userId: string;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: RedeemInviteBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { token, userId } = body ?? {};
  if (!token || !userId) {
    return new Response(JSON.stringify({ error: "token and userId are required" }), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: invite, error: inviteError } = await supabase
    .from("invite_links")
    .select("id, organization_id, generated_by_membership_id, role_to_assign, parent_leader_id, max_uses, used_count, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (inviteError) {
    console.error(inviteError);
    return new Response(JSON.stringify({ error: "Failed to lookup invite" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!invite) {
    return new Response(JSON.stringify({ error: "Invite not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    return new Response(JSON.stringify({ error: "Invite has expired" }), {
      status: 410,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (invite.used_count >= invite.max_uses) {
    return new Response(JSON.stringify({ error: "Invite has been fully redeemed" }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: existingMembership, error: existingMembershipError } = await supabase
    .from("memberships")
    .select("id, role, status, parent_leader_id, invited_by")
    .eq("organization_id", invite.organization_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingMembershipError) {
    console.error(existingMembershipError);
    return new Response(JSON.stringify({ error: "Failed to check existing membership" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const updates: Record<string, unknown> = {};
  const desiredParentLeaderId = invite.role_to_assign === "rep" ? invite.parent_leader_id ?? null : null;
  let membershipId: string;

  if (existingMembership) {
    membershipId = existingMembership.id;
    if (existingMembership.role !== invite.role_to_assign) {
      updates.role = invite.role_to_assign;
    }
    if ((existingMembership.parent_leader_id ?? null) !== desiredParentLeaderId) {
      updates.parent_leader_id = desiredParentLeaderId;
    }
    if (existingMembership.status !== "active") {
      updates.status = "active";
    }
    if (!existingMembership.invited_by) {
      updates.invited_by = invite.generated_by_membership_id;
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from("memberships")
        .update(updates)
        .eq("id", existingMembership.id);

      if (updateError) {
        console.error(updateError);
        return new Response(JSON.stringify({ error: "Failed to update membership" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
  } else {
    const { data: newMembership, error: membershipError } = await supabase
      .from("memberships")
      .insert({
        organization_id: invite.organization_id,
        user_id: userId,
        role: invite.role_to_assign,
        parent_leader_id: desiredParentLeaderId,
        invited_by: invite.generated_by_membership_id,
        status: "active",
      })
      .select("id")
      .single();

    if (membershipError || !newMembership) {
      console.error(membershipError);
      return new Response(JSON.stringify({ error: "Failed to create membership" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    membershipId = newMembership.id;
  }

  const { error: incrementError } = await supabase
    .from("invite_links")
    .update({ used_count: invite.used_count + 1 })
    .eq("id", invite.id);

  if (incrementError) {
    console.error(incrementError);
    return new Response(JSON.stringify({ error: "Failed to update invite usage" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      organizationId: invite.organization_id,
      membershipId,
      role: invite.role_to_assign,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
});
