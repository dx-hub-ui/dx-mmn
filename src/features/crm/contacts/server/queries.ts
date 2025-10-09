import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ContactRecord } from "../types";
import {
  CONTACTS_SELECT_CORE,
  CONTACTS_SELECT_WITH_REFERRER,
  ContactRow,
  mapContactRow,
} from "./listContacts";

type SupabaseServerClient = ReturnType<typeof createSupabaseServerClient>;

export async function fetchContactById(
  supabase: SupabaseServerClient,
  contactId: string
): Promise<ContactRecord | null> {
  let { data, error } = await supabase
    .from("contacts")
    .select(CONTACTS_SELECT_WITH_REFERRER)
    .eq("id", contactId)
    .maybeSingle();

  if (error && error.code === "PGRST200") {
    const fallbackResult = await supabase
      .from("contacts")
      .select(CONTACTS_SELECT_CORE)
      .eq("id", contactId)
      .maybeSingle();

    if (fallbackResult.error) {
      throw fallbackResult.error;
    }

    data = fallbackResult.data;
    error = null;
  } else if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapContactRow(data as unknown as ContactRow);
}
