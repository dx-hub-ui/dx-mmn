import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ContactRecord } from "../types";
import { ContactRow, mapContactRow } from "./listContacts";

type SupabaseServerClient = ReturnType<typeof createSupabaseServerClient>;

export async function fetchContactById(
  supabase: SupabaseServerClient,
  contactId: string
): Promise<ContactRecord | null> {
  const { data, error } = await supabase
    .from("contacts")
    .select(
      `id, organization_id, owner_membership_id, name, email, whatsapp, status, source, tags, score, last_touch_at, next_action_at, next_action_note, referred_by_contact_id, created_at, updated_at,
       lost_reason, lost_review_at, archived_at,
       owner:memberships (id, organization_id, role, user_id, parent_leader_id, profile:profiles (id, email, raw_user_meta_data)),
       referred_by:contacts!contacts_referred_by_contact_id_fkey (id, name)`
    )
    .eq("id", contactId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapContactRow(data as unknown as ContactRow);
}
