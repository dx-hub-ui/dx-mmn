import { ContactInput, ContactRecord } from "../types";
import { validateContactInput } from "../validation/contact";
import { fetchContactById } from "./queries";
import { logContactEvents, ContactEventInsert } from "./contactEvents";
import { checkDuplicate, ensureReferral, SupabaseServerClient } from "./rules";

export type ContactUpsertResult =
  | { success: true; contact: ContactRecord }
  | { success: false; errors: { field: string; message: string; code: string }[] };

export async function createContact(
  supabase: SupabaseServerClient,
  organizationId: string,
  payload: ContactInput,
  actorMembershipId: string
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
    source: normalized.source,
    tags: normalized.tags ?? [],
    score: normalized.score,
    next_action_at: normalized.nextActionAt,
    next_action_note: normalized.nextActionNote,
    referred_by_contact_id: normalized.referredByContactId,
    lost_reason: normalized.lostReason,
    lost_review_at: normalized.lostReviewAt,
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

  const events: ContactEventInsert[] = [
    {
      contactId: contact.id,
      organizationId,
      type: "created",
      actorMembershipId,
      payload: {
        stage: contact.stage,
        ownerMembershipId: contact.ownerMembershipId,
      },
    },
  ];

  if (contact.nextActionAt || contact.nextActionNote) {
    events.push({
      contactId: contact.id,
      organizationId,
      type: "next_step_set",
      actorMembershipId,
      payload: {
        note: contact.nextActionNote,
        date: contact.nextActionAt,
      },
    });
  }

  await logContactEvents(supabase, events);

  return { success: true, contact };
}

export async function updateContact(
  supabase: SupabaseServerClient,
  organizationId: string,
  contactId: string,
  payload: ContactInput,
  actorMembershipId: string
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

  const previous = await fetchContactById(supabase, contactId);

  if (!previous) {
    return {
      success: false,
      errors: [{ field: "base", code: "not_found", message: "Contato não encontrado" }],
    };
  }

  const dbPayload = {
    owner_membership_id: normalized.ownerMembershipId,
    name: normalized.name,
    email: normalized.email,
    whatsapp: normalized.whatsapp,
    status: normalized.stage === "cadastrado" ? "ganho" : normalized.stage,
    source: normalized.source,
    tags: normalized.tags ?? [],
    score: normalized.score,
    next_action_at: normalized.nextActionAt,
    next_action_note: normalized.nextActionNote,
    referred_by_contact_id: normalized.referredByContactId,
    lost_reason: normalized.lostReason,
    lost_review_at: normalized.lostReviewAt,
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

  const events: ContactEventInsert[] = [];

  if (previous.stage !== contact.stage) {
    events.push({
      contactId: contact.id,
      organizationId,
      type: "stage_changed",
      actorMembershipId,
      payload: {
        from: previous.stage,
        to: contact.stage,
      },
    });
  }

  if (previous.ownerMembershipId !== contact.ownerMembershipId) {
    events.push({
      contactId: contact.id,
      organizationId,
      type: "owner_changed",
      actorMembershipId,
      payload: {
        from: previous.ownerMembershipId,
        to: contact.ownerMembershipId,
      },
    });
  }

  const nextStepChanged =
    previous.nextActionAt !== contact.nextActionAt || previous.nextActionNote !== contact.nextActionNote;

  if (nextStepChanged) {
    events.push({
      contactId: contact.id,
      organizationId,
      type: "next_step_set",
      actorMembershipId,
      payload: {
        fromNote: previous.nextActionNote,
        fromDate: previous.nextActionAt,
        note: contact.nextActionNote,
        date: contact.nextActionAt,
      },
    });
  }

  if (events.length > 0) {
    await logContactEvents(supabase, events);
  }

  return { success: true, contact };
}
