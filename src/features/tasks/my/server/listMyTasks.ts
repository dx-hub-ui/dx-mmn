import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeMyTaskRow } from "../normalize";
import type { MyTaskItem, MyTaskRow } from "../types";

export async function listMyTasks(orgId: string, membershipId: string): Promise<MyTaskItem[]> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("v_my_tasks")
    .select(
      `assignment_id, org_id, sequence_id, sequence_version_id, sequence_step_id, sequence_enrollment_id,
       assignee_membership_id, status, due_at, snoozed_until, done_at, overdue_at, blocked_reason,
       is_overdue, is_snoozed, is_blocked, sequence_name, step_title, step_short_description, step_priority, step_tags,
       target_type, target_id, enrollment_status`
    )
    .eq("org_id", orgId)
    .eq("assignee_membership_id", membershipId)
    .order("due_at", { ascending: true });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as MyTaskRow[];
  return rows.map(normalizeMyTaskRow);
}
