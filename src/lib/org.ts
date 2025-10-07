import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Organization = {
  id: string;
  slug: string;
  name: string;
  country: string;
  created_by: string | null;
  created_at: string;
};

export type Membership = {
  id: string;
  organization_id: string;
  user_id: string;
  role: "org" | "leader" | "rep";
  invited_by: string | null;
  parent_leader_id: string | null;
  status: string;
  created_at: string;
};

export async function getOrgBySlug(slug: string): Promise<Organization> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("organizations")
    .select("id, slug, name, country, created_by, created_at")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    notFound();
  }

  return data;
}

export async function getMyMembership(orgId: string): Promise<Membership> {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const { data, error } = await supabase
    .from("memberships")
    .select("id, organization_id, user_id, role, invited_by, parent_leader_id, status, created_at")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    notFound();
  }

  if (data.status !== "active") {
    notFound();
  }

  return data as Membership;
}
