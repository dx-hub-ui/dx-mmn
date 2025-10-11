import type { SupabaseClient } from "@supabase/supabase-js";

export type ActiveSequenceSummary = {
  id: string;
  name: string;
  updatedAt: string | null;
};

export async function listActiveContactSequences(
  supabase: SupabaseClient,
  organizationId: string
): Promise<ActiveSequenceSummary[]> {
  const { data, error } = await supabase
    .from("sequences")
    .select("id, name, status, is_active, default_target_type, active_version_id, updated_at")
    .eq("org_id", organizationId)
    .eq("default_target_type", "contact")
    .eq("status", "active")
    .eq("is_active", true)
    .not("active_version_id", "is", null)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    updatedAt: (row.updated_at as string | null) ?? null,
  }));
}
