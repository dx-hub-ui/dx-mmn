import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type MembershipRow = {
  id: string;
  role: "org" | "leader" | "rep";
  status: string;
  created_at: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    country: string | null;
  } | null;
};

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  let user = session?.user ?? null;

  if (!user) {
    const {
      data: { user: fetchedUser },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    user = fetchedUser ?? null;
  }

  if (!user) {
    redirect(`/sign-in?redirectTo=${encodeURIComponent("/dashboard")}`);
  }

  const { data: membershipsData, error: membershipsError } = await supabase
    .from("memberships")
    .select(
      `id, role, status, created_at, organization:organizations (id, name, slug, country)`
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (membershipsError) {
    throw membershipsError;
  }

  const membershipRows = (membershipsData ?? []) as unknown as MembershipRow[];

  const memberships = membershipRows.map((membership) => ({
    id: membership.id,
    role: membership.role,
    status: membership.status,
    organization: membership.organization
      ? {
          id: membership.organization.id,
          name: membership.organization.name,
          slug: membership.organization.slug,
          country: membership.organization.country,
        }
      : null,
    createdAt: membership.created_at,
  }));

  return (
    <DashboardClient
      user={{
        id: user.id,
        email: user.email ?? null,
        fullName: (user.user_metadata?.full_name as string | null) ?? null,
      }}
      memberships={memberships}
    />
  );
}
