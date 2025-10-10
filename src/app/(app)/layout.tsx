// src/app/(app)/layout.tsx
export const dynamic = "force-dynamic";

import AppShell, { type AppShellActiveOrg } from "@/components/ui/AppShell";
import { isSupabaseConfigurationError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { setServerRequestContext } from "@/lib/request-context";

async function resolveActiveOrg(): Promise<AppShellActiveOrg | null> {
  let supabase;

  try {
    supabase = createSupabaseServerClient();
  } catch (error) {
    if (isSupabaseConfigurationError(error)) {
      return null;
    }
    throw error;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data } = await supabase
    .from("memberships")
    .select("organization:organizations(id, name, slug)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  type OrganizationRow = {
    id: string;
    name: string;
    slug: string;
  };

  const organizationPayload = data?.organization;
  const organization: OrganizationRow | undefined = Array.isArray(organizationPayload)
    ? organizationPayload[0]
    : organizationPayload ?? undefined;
  if (!organization) {
    return null;
  }

  const active: AppShellActiveOrg = {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
  };

  setServerRequestContext({ orgId: active.id });
  return active;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const activeOrg = await resolveActiveOrg();
  return <AppShell activeOrg={activeOrg}>{children}</AppShell>;
}
