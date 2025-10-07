import { serve } from "std/http/server";
import { createClient } from "@supabase/supabase-js";

type CreateOrgBody = {
  slug: string;
  name: string;
  country?: string;
  ownerUserId: string;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: CreateOrgBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { slug, name, country, ownerUserId } = body ?? {};
  if (!slug || !name || !ownerUserId) {
    return new Response(JSON.stringify({ error: "slug, name and ownerUserId are required" }), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });
  }

  const normalizedSlug = normalizeSlug(slug);
  if (!normalizedSlug) {
    return new Response(JSON.stringify({ error: "slug is invalid after normalization" }), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });
  }

  const existing = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", normalizedSlug)
    .maybeSingle();

  if (existing.error) {
    console.error(existing.error);
    return new Response(JSON.stringify({ error: "Failed to verify organization slug" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (existing.data) {
    return new Response(JSON.stringify({ error: "Organization slug already exists" }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .insert({
      slug: normalizedSlug,
      name,
      country: country ?? "BR",
      created_by: ownerUserId,
    })
    .select("*")
    .single();

  if (orgError || !organization) {
    console.error(orgError);
    return new Response(JSON.stringify({ error: "Failed to create organization" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .insert({
      organization_id: organization.id,
      user_id: ownerUserId,
      role: "org",
      status: "active",
    })
    .select("*")
    .single();

  if (membershipError || !membership) {
    console.error(membershipError);
    return new Response(JSON.stringify({ error: "Failed to create owner membership" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ organization, membership }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
});
