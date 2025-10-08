import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import MyTasksPage from "@/features/tasks/my/components/MyTasksPage";
import { listMyTasks } from "@/features/tasks/my/server/listMyTasks";

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

export default async function MyTasksRoute() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    redirect(`/sign-in?redirectTo=${encodeURIComponent("/tasks/my")}`);
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
      <section className="page" aria-labelledby="tasks-empty">
        <header className="pageHeader">
          <h1 id="tasks-empty">Minhas tarefas</h1>
          <p>Você ainda não possui acesso a uma organização com tarefas ativas.</p>
        </header>
      </section>
    );
  }

  const tasks = await listMyTasks(membership.organization_id, membership.id);

  return <MyTasksPage orgId={membership.organization_id} membershipId={membership.id} tasks={tasks} />;
}
