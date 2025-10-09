import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeSequenceManagerRow } from "../normalize";
import type { SequenceManagerItem, SequenceManagerRow } from "../types";

export async function listSequencesByOrg(orgId: string): Promise<SequenceManagerItem[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("v_sequence_manager")
    .select(
      `sequence_id, org_id, name, status, is_active, default_target_type, active_version_number,
       steps_total, active_enrollments, completion_rate, last_activation_at, updated_at, created_at`
    )
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as SequenceManagerRow[];
  return rows.map(normalizeSequenceManagerRow);
}
