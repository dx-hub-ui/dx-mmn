import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SupabaseServerClient = ReturnType<typeof createSupabaseServerClient>;

export type DuplicateCheck = {
  field: "whatsapp" | "email";
  contactId: string;
  contactName: string;
};

export async function checkDuplicate(
  supabase: SupabaseServerClient,
  organizationId: string,
  normalized: { whatsapp: string | null; email: string | null },
  excludeContactId?: string
): Promise<DuplicateCheck | null> {
  if (normalized.whatsapp) {
    let query = supabase
      .from("contacts")
      .select("id, name")
      .eq("organization_id", organizationId)
      .eq("whatsapp", normalized.whatsapp)
      .limit(1);
    if (excludeContactId) {
      query = query.neq("id", excludeContactId);
    }
    const { data } = await query;
    const duplicate = data?.[0];
    if (duplicate) {
      return { field: "whatsapp", contactId: duplicate.id, contactName: duplicate.name };
    }
  }

  if (normalized.email) {
    let query = supabase
      .from("contacts")
      .select("id, name")
      .eq("organization_id", organizationId)
      .eq("email", normalized.email)
      .limit(1);
    if (excludeContactId) {
      query = query.neq("id", excludeContactId);
    }
    const { data } = await query;
    const duplicate = data?.[0];
    if (duplicate) {
      return { field: "email", contactId: duplicate.id, contactName: duplicate.name };
    }
  }

  return null;
}

export async function ensureReferral(
  supabase: SupabaseServerClient,
  organizationId: string,
  referredByContactId: string
) {
  const { data, error } = await supabase
    .from("contacts")
    .select("id, organization_id")
    .eq("id", referredByContactId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Contato indicante não encontrado");
  }

  if (data.organization_id !== organizationId) {
    throw new Error("Indicação deve ser da mesma organização");
  }
}
