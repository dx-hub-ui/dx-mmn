import { BulkActionPayload, BulkActionResult, ContactRecord, MembershipSummary } from "../types";
import { contactRecordToInput } from "../utils/forms";
import {
  canAssignOwner,
  filterContactsByOwnership,
  normalizeTagsInput,
} from "../utils/permissions";
import { updateContact } from "./upsertContact";
import {
  CONTACTS_SELECT_CORE,
  CONTACTS_SELECT_WITH_REFERRER,
  ContactRow,
  mapContactRow,
} from "./listContacts";
import { fetchContactById } from "./queries";
import { SupabaseServerClient } from "./rules";

type PerformBulkActionParams = {
  supabase: SupabaseServerClient;
  organizationId: string;
  actor: MembershipSummary;
  contactIds: string[];
  action: BulkActionPayload;
  memberships: MembershipSummary[];
};

async function fetchContactsByIds(
  supabase: SupabaseServerClient,
  organizationId: string,
  ids: string[]
): Promise<ContactRecord[]> {
  if (ids.length === 0) {
    return [];
  }

  const buildQuery = (select: string) =>
    supabase
      .from("contacts")
      .select(select)
      .eq("organization_id", organizationId)
      .in("id", ids);

  let { data, error } = await buildQuery(CONTACTS_SELECT_WITH_REFERRER);

  if (error && error.code === "PGRST200") {
    const fallbackResult = await buildQuery(CONTACTS_SELECT_CORE);
    if (fallbackResult.error) {
      throw fallbackResult.error;
    }
    data = fallbackResult.data;
    error = null;
  } else if (error) {
    throw error;
  }

  const rows = (data ?? []) as unknown as ContactRow[];
  return rows.map((row) => mapContactRow(row));
}

function withStageMetadata(
  input: ReturnType<typeof contactRecordToInput>,
  action: Extract<BulkActionPayload, { type: "stage" | "mark_cadastrado" | "mark_perdido" }>
) {
  if (action.type === "mark_cadastrado") {
    input.stage = "cadastrado";
    input.lostReason = null;
    input.lostReviewAt = null;
  } else if (action.type === "mark_perdido") {
    input.stage = "perdido";
    input.lostReason = action.reason;
    input.lostReviewAt = action.reviewAt;
  } else {
    input.stage = action.stage;
    if (input.stage !== "perdido") {
      input.lostReason = null;
      input.lostReviewAt = null;
    } else if (action.lostReason) {
      input.lostReason = action.lostReason;
      input.lostReviewAt = action.lostReviewAt ?? null;
    }
  }
}

export async function performBulkAction({
  supabase,
  organizationId,
  actor,
  contactIds,
  action,
  memberships,
}: PerformBulkActionParams): Promise<BulkActionResult> {
  const result: BulkActionResult = { updated: [], removedIds: [], errors: [] };

  if (contactIds.length === 0) {
    return result;
  }

  const records = await fetchContactsByIds(supabase, organizationId, contactIds);
  const accessible = filterContactsByOwnership(records, actor, memberships);
  const accessibleIds = new Set(accessible.map((contact) => contact.id));

  for (const id of contactIds) {
    if (!accessibleIds.has(id)) {
      result.errors.push({ contactId: id, message: "Sem permissão para alterar contato" });
    }
  }

  if (accessible.length === 0) {
    return result;
  }

  if (action.type === "merge") {
    if (contactIds.length !== 2) {
      result.errors.push({ contactId: contactIds[0], message: "Selecione exatamente dois contatos para mesclar" });
      return result;
    }

    const primaryId = action.primaryContactId;
    if (!accessibleIds.has(primaryId)) {
      result.errors.push({ contactId: primaryId, message: "Contato principal não permitido" });
      return result;
    }

    const primary = accessible.find((contact) => contact.id === primaryId);
    const secondary = accessible.find((contact) => contact.id !== primaryId);

    if (!primary || !secondary) {
      result.errors.push({ contactId: primaryId, message: "Contatos inválidos para mescla" });
      return result;
    }

    const input = contactRecordToInput(primary);
    if (!primary.whatsapp && secondary.whatsapp) {
      input.whatsapp = secondary.whatsapp;
    }
    if (!primary.email && secondary.email) {
      input.email = secondary.email;
    }
    input.tags = normalizeTagsInput([...(primary.tags ?? []), ...(secondary.tags ?? [])]);

    if ((!primary.nextActionAt || primary.nextActionAt > (secondary.nextActionAt ?? primary.nextActionAt)) && secondary.nextActionAt) {
      input.nextActionAt = secondary.nextActionAt;
      input.nextActionNote = secondary.nextActionNote ?? input.nextActionNote;
    }

    const update = await updateContact(supabase, organizationId, primary.id, input, actor.id);

    if (!update.success) {
      result.errors.push({ contactId: primary.id, message: update.errors[0]?.message ?? "Falha ao atualizar" });
      return result;
    }

    const { error: deleteError } = await supabase.from("contacts").delete().eq("id", secondary.id);
    if (deleteError) {
      result.errors.push({ contactId: secondary.id, message: deleteError.message });
      return result;
    }

    const refreshed = await fetchContactById(supabase, primary.id);
    if (refreshed) {
      result.updated.push(refreshed);
    }
    result.removedIds.push(secondary.id);
    return result;
  }

  for (const contact of accessible) {
    try {
      if (action.type === "archive") {
        const { error } = await supabase
          .from("contacts")
          .update({ archived_at: new Date().toISOString() })
          .eq("id", contact.id);
        if (error) {
          result.errors.push({ contactId: contact.id, message: error.message });
          continue;
        }
        const refreshed = await fetchContactById(supabase, contact.id);
        if (refreshed) {
          result.updated.push(refreshed);
        }
        continue;
      }

      if (action.type === "unarchive") {
        const { error } = await supabase.from("contacts").update({ archived_at: null }).eq("id", contact.id);
        if (error) {
          result.errors.push({ contactId: contact.id, message: error.message });
          continue;
        }
        const refreshed = await fetchContactById(supabase, contact.id);
        if (refreshed) {
          result.updated.push(refreshed);
        }
        continue;
      }

      if (action.type === "delete") {
        const { error } = await supabase.from("contacts").delete().eq("id", contact.id);
        if (error) {
          result.errors.push({ contactId: contact.id, message: error.message });
          continue;
        }
        result.removedIds.push(contact.id);
        continue;
      }

      if (action.type === "owner") {
        if (!canAssignOwner(actor, action.ownerMembershipId, memberships)) {
          result.errors.push({ contactId: contact.id, message: "Sem permissão para atribuir dono" });
          continue;
        }
      }

      const input = contactRecordToInput(contact);

      switch (action.type) {
        case "stage":
        case "mark_cadastrado":
        case "mark_perdido":
          withStageMetadata(input, action);
          break;
        case "owner":
          input.ownerMembershipId = action.ownerMembershipId;
          break;
        case "next_step":
          if (action.applyIfEmpty && contact.nextActionAt) {
            result.errors.push({ contactId: contact.id, message: "Contato já possui próximo passo" });
            continue;
          }
          input.nextActionNote = action.note;
          input.nextActionAt = action.date;
          break;
        case "referral":
          input.referredByContactId = action.referredByContactId;
          break;
        case "tags":
          if (action.mode === "add") {
            input.tags = normalizeTagsInput([...(input.tags ?? []), ...action.tags]);
          } else {
            const removeSet = new Set(action.tags.map((tag) => tag.toLowerCase()));
            input.tags = (input.tags ?? []).filter((tag) => !removeSet.has(tag.toLowerCase()));
          }
          break;
      }

      const update = await updateContact(supabase, organizationId, contact.id, input, actor.id);

      if (!update.success) {
        result.errors.push({ contactId: contact.id, message: update.errors[0]?.message ?? "Falha ao atualizar" });
        continue;
      }

      result.updated.push(update.contact);
    } catch (error) {
      result.errors.push({
        contactId: contact.id,
        message: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }

  return result;
}
