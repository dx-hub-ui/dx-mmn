import { ContactInput, ContactRecord } from "../types";
import { validateContactInput } from "../validation/contact";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ContactRow, mapContactRow } from "./listContacts";

export type ContactUpsertResult =
  | { success: true; contact: ContactRecord }
  | { success: false; errors: { field: string; message: string; code: string }[] };

type SupabaseServerClient = ReturnType<typeof createSupabaseServerClient>;

type DuplicateCheck = {
  field: "whatsapp" | "email";
  contactId: string;
  contactName: string;
};

async function checkDuplicate(
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

async function ensureReferral(
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

async function fetchContactById(
  supabase: SupabaseServerClient,
  contactId: string
): Promise<ContactRecord | null> {
  const { data, error } = await supabase
    .from("contacts")
    .select(
      `id, organization_id, owner_membership_id, name, email, whatsapp, status, tags, score, last_touch_at, next_action_at, next_action_note, referred_by_contact_id, created_at, updated_at,
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

export async function createContact(
  supabase: SupabaseServerClient,
  organizationId: string,
  payload: ContactInput
): Promise<ContactUpsertResult> {
  const validation = validateContactInput(payload);

  if (validation.errors) {
    return { success: false, errors: validation.errors };
  }

  const normalized = validation.value!;

  if (normalized.referredByContactId) {
    try {
      await ensureReferral(supabase, organizationId, normalized.referredByContactId);
    } catch (error) {
      return {
        success: false,
        errors: [
          {
            field: "referredByContactId",
            code: "invalid_referral",
            message: error instanceof Error ? error.message : "Indicação inválida",
          },
        ],
      };
    }
  }

  const duplicate = await checkDuplicate(supabase, organizationId, {
    whatsapp: normalized.whatsapp,
    email: normalized.email ?? null,
  });

  if (duplicate) {
    return {
      success: false,
      errors: [
        {
          field: duplicate.field,
          code: "duplicate",
          message: duplicate.field === "whatsapp"
            ? "Telefone já existe na organização"
            : "E-mail já existe na organização",
        },
      ],
    };
  }

  const dbPayload = {
    organization_id: organizationId,
    owner_membership_id: normalized.ownerMembershipId,
    name: normalized.name,
    email: normalized.email,
    whatsapp: normalized.whatsapp,
    status: normalized.stage === "cadastrado" ? "ganho" : normalized.stage,
    tags: normalized.tags ?? [],
    score: normalized.score,
    next_action_at: normalized.nextActionAt,
    next_action_note: normalized.nextActionNote,
    referred_by_contact_id: normalized.referredByContactId,
  };

  const { data, error } = await supabase
    .from("contacts")
    .insert(dbPayload)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      success: false,
      errors: [{ field: "base", code: "server_error", message: error.message }],
    };
  }

  const contact = data ? await fetchContactById(supabase, data.id) : null;

  if (!contact) {
    return {
      success: false,
      errors: [{ field: "base", code: "not_found", message: "Contato não encontrado após criar" }],
    };
  }

  return { success: true, contact };
}

export async function updateContact(
  supabase: SupabaseServerClient,
  organizationId: string,
  contactId: string,
  payload: ContactInput
): Promise<ContactUpsertResult> {
  const validation = validateContactInput(payload);

  if (validation.errors) {
    return { success: false, errors: validation.errors };
  }

  const normalized = validation.value!;

  if (normalized.referredByContactId) {
    if (normalized.referredByContactId === contactId) {
      return {
        success: false,
        errors: [{ field: "referredByContactId", code: "invalid_referral", message: "Contato não pode indicar a si mesmo" }],
      };
    }
    try {
      await ensureReferral(supabase, organizationId, normalized.referredByContactId);
    } catch (error) {
      return {
        success: false,
        errors: [
          {
            field: "referredByContactId",
            code: "invalid_referral",
            message: error instanceof Error ? error.message : "Indicação inválida",
          },
        ],
      };
    }
  }

  const duplicate = await checkDuplicate(
    supabase,
    organizationId,
    { whatsapp: normalized.whatsapp, email: normalized.email ?? null },
    contactId
  );

  if (duplicate) {
    return {
      success: false,
      errors: [
        {
          field: duplicate.field,
          code: "duplicate",
          message:
            duplicate.field === "whatsapp"
              ? "Telefone já existe na organização"
              : "E-mail já existe na organização",
        },
      ],
    };
  }

  const dbPayload = {
    owner_membership_id: normalized.ownerMembershipId,
    name: normalized.name,
    email: normalized.email,
    whatsapp: normalized.whatsapp,
    status: normalized.stage === "cadastrado" ? "ganho" : normalized.stage,
    tags: normalized.tags ?? [],
    score: normalized.score,
    next_action_at: normalized.nextActionAt,
    next_action_note: normalized.nextActionNote,
    referred_by_contact_id: normalized.referredByContactId,
  };

  const { error } = await supabase.from("contacts").update(dbPayload).eq("id", contactId);

  if (error) {
    return {
      success: false,
      errors: [{ field: "base", code: "server_error", message: error.message }],
    };
  }

  const contact = await fetchContactById(supabase, contactId);

  if (!contact) {
    return {
      success: false,
      errors: [{ field: "base", code: "not_found", message: "Contato não encontrado" }],
    };
  }

  return { success: true, contact };
}
