import type { SupabaseClient } from "@supabase/supabase-js";

export async function applyOrgContext(client: SupabaseClient, orgId: string) {
  const { error } = await client.rpc("set_current_org", { p_org_id: orgId });
  if (error) {
    throw error;
  }
}
