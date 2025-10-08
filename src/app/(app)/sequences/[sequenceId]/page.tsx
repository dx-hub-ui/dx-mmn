import { notFound, redirect } from "next/navigation";
import SequenceEditorPage from "@/features/sequences/editor/components/SequenceEditorPage";
import { getSequenceEditorData } from "@/features/sequences/editor/server/getSequenceEditorData";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SequenceEditorRoute({
  params,
}: {
  params: { sequenceId: string };
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
    redirect(`/sign-in?redirectTo=${encodeURIComponent(`/sequences/${params.sequenceId}`)}`);
  }

  const { data: membershipRow, error: membershipError } = await supabase
    .from("memberships")
    .select("id, organization_id, role, status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }

  if (!membershipRow) {
    notFound();
  }

  const data = await getSequenceEditorData(params.sequenceId);

  if (data.sequence.orgId !== membershipRow.organization_id) {
    notFound();
  }

  return (
    <SequenceEditorPage
      orgId={membershipRow.organization_id}
      membershipId={membershipRow.id}
      membershipRole={membershipRow.role as "org" | "leader" | "rep"}
      data={data}
    />
  );
}
