import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import SequenceManagerPage from "@/features/sequences/manager/components/SequenceManagerPage";
import { listSequencesByOrg } from "@/features/sequences/manager/server/listSequences";

type MembershipRow = {
  id: string;
  organization_id: string;
  role: "org" | "leader" | "rep";
  status: string;
  organization: {
    id: string;
    name: string;
  } | null;
};

export default async function SequencesPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    redirect(`/sign-in?redirectTo=${encodeURIComponent("/sequences")}`);
  }

  const { data: membershipRow, error: membershipError } = await supabase
    .from("memberships")
    .select(`id, organization_id, role, status, organization:organizations (id, name)`)
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }

  const membership = membershipRow as MembershipRow | null;

  if (!membership || !membership.organization) {
    return (
      <section className="page" aria-labelledby="sequences-empty">
        <header className="pageHeader">
          <h1 id="sequences-empty">Sequências de Tarefas</h1>
          <p>Você ainda não faz parte de nenhuma organização ativa.</p>
        </header>
      </section>
    );
  }

  const sequences = await listSequencesByOrg(membership.organization_id);
  const openNewModal = (typeof searchParams?.nova === "string" && searchParams.nova === "1") ||
    (Array.isArray(searchParams?.nova) && searchParams?.nova.includes("1"));

  return (
    <SequenceManagerPage
      sequences={sequences}
      orgId={membership.organization_id}
      membershipRole={membership.role}
      autoOpenNewModal={openNewModal}
    />
  );
}
