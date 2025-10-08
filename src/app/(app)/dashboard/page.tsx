import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

type SupabaseServerClient = ReturnType<typeof createSupabaseServerClient>;

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

type DashboardMembership = {
  id: string;
  role: "org" | "leader" | "rep";
  status: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    country: string | null;
  } | null;
  createdAt: string;
};

async function getAuthenticatedUser(
  supabase: SupabaseServerClient
): Promise<User | null> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    console.error("[dashboard] Falha ao recuperar a sessão atual", sessionError);
    return null;
  }

  if (session?.user) {
    return session.user;
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error("[dashboard] Falha ao buscar o usuário autenticado", userError);
    return null;
  }

  return user ?? null;
}

async function getMemberships(
  supabase: SupabaseServerClient,
  userId: string
): Promise<{ memberships: DashboardMembership[]; membershipsError: string | null }> {
  const { data, error } = await supabase
    .from("memberships")
    .select(
      `id, role, status, created_at, organization:organizations (id, name, slug, country)`
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[dashboard] Falha ao buscar memberships", error);
    return {
      memberships: [],
      membershipsError:
        "Não foi possível carregar suas organizações agora. Tente novamente em instantes.",
    };
  }

  const membershipRows = (data ?? []) as unknown as MembershipRow[];

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

  return { memberships, membershipsError: null };
}

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();

  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    redirect(`/sign-in?redirectTo=${encodeURIComponent("/dashboard")}`);
  }

  const { memberships, membershipsError } = await getMemberships(supabase, user.id);

  return (
    <DashboardClient
      user={{
        id: user.id,
        email: user.email ?? null,
        fullName: (user.user_metadata?.full_name as string | null) ?? null,
      }}
      memberships={memberships}
      membershipsError={membershipsError}
    />
  );
}
