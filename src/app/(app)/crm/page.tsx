import { redirect } from "next/navigation";
import SupabaseConfigNotice from "@/components/supabase/SupabaseConfigNotice";
import { isSupabaseConfigurationError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listContacts, fetchVisibleMemberships } from "@/features/crm/contacts/server/listContacts";
import ContactsBoardPage from "./ContactsBoardPage";
import { MembershipSummary } from "@/features/crm/contacts/types";

type MembershipWithOrganization = {
  id: string;
  organization_id: string;
  role: "org" | "leader" | "rep";
  user_id: string;
  parent_leader_id: string | null;
  status: string;
  organization: { id: string; name: string; slug: string } | null;
};

export default async function CRMPage() {
  let supabase;

  try {
    supabase = createSupabaseServerClient();
  } catch (error) {
    if (isSupabaseConfigurationError(error)) {
      return <SupabaseConfigNotice featureLabel="a área de contatos" documentationPath="docs/dev_setup_crm.md" />;
    }
    throw error;
  }
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    redirect(`/sign-in?redirectTo=${encodeURIComponent("/crm")}`);
  }

  const { data: membershipRow, error: membershipError } = await supabase
    .from("memberships")
    .select(
      `id, organization_id, role, user_id, parent_leader_id, status,
       organization:organizations (id, name, slug)`
    )
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }

  const membership = membershipRow as MembershipWithOrganization | null;

  if (!membership || !membership.organization) {
    return (
      <section className="page" aria-labelledby="contacts-empty">
        <header className="pageHeader">
          <h1 id="contacts-empty">Contatos</h1>
          <p>Nenhuma organização ativa vinculada ao usuário.</p>
        </header>
      </section>
    );
  }

  const organization = {
    id: membership.organization.id,
    name: membership.organization.name,
    slug: membership.organization.slug,
  };

  const [contacts, visibleMemberships] = await Promise.all([
    listContacts(supabase, organization.id),
    fetchVisibleMemberships(supabase, organization.id),
  ]);

  const currentMembership: MembershipSummary = {
    id: membership.id,
    organizationId: membership.organization_id,
    role: membership.role,
    userId: membership.user_id,
    parentLeaderId: membership.parent_leader_id,
    displayName:
      visibleMemberships.find((member) => member.id === membership.id)?.displayName ??
      user.user_metadata?.full_name ??
      user.email ??
      "",
    email: user.email ?? null,
    avatarUrl: null,
  };

  const membersMap = new Map(visibleMemberships.map((member) => [member.id, member] as const));
  if (!membersMap.has(currentMembership.id)) {
    membersMap.set(currentMembership.id, currentMembership);
    visibleMemberships.push(currentMembership);
  }

  return (
    <ContactsBoardPage
      organization={organization}
      currentMembership={currentMembership}
      memberships={visibleMemberships}
      initialContacts={contacts}
    />
  );
}
