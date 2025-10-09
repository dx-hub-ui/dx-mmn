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
  const primaryResult = await supabase
    .from("contacts")
    .select(CONTACTS_SELECT_WITH_REFERRER)
    .eq("id", contactId)
    .maybeSingle();

  if (primaryResult.error?.code === "PGRST200") {
    const fallbackResult = await supabase
      .from("contacts")
      .select(CONTACTS_SELECT_CORE)
      .eq("id", contactId)
      .maybeSingle();

    if (fallbackResult.error) {
      throw fallbackResult.error;
    }

    if (!fallbackResult.data) {
      return null;
    }

    return mapContactRow({
      ...(fallbackResult.data as Record<string, unknown>),
      referred_by: null,
    } as ContactRow);
  }

  if (primaryResult.error) {
    throw primaryResult.error;
  }

  if (!primaryResult.data) {
    return null;
  }

  return mapContactRow(primaryResult.data as unknown as ContactRow);
}
