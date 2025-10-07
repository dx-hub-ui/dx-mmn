import { ContactInput } from "../types";
import { normalizeBrazilPhone } from "./phone";

export type ContactValidationErrorCode =
  | "name_required"
  | "email_invalid"
  | "phone_invalid"
  | "stage_invalid"
  | "owner_required"
  | "score_invalid";

export type ContactValidationError = {
  field: keyof ContactInput | "whatsapp";
  code: ContactValidationErrorCode;
  message: string;
};

export type NormalizedContactInput = Omit<ContactInput, "whatsapp"> & {
  whatsapp: string | null;
  normalizedPhone: string | null;
};

const emailPattern = /.+@.+\..+/i;

const allowedStages = new Set(["novo", "contatado", "followup", "qualificado", "cadastrado", "perdido"]);

export function validateContactInput(payload: ContactInput): {
  value?: NormalizedContactInput;
  errors?: ContactValidationError[];
} {
  const errors: ContactValidationError[] = [];

  const trimmedName = payload.name?.trim();
  if (!trimmedName) {
    errors.push({ field: "name", code: "name_required", message: "Nome é obrigatório" });
  }

  if (payload.email) {
    const email = payload.email.trim().toLowerCase();
    if (!emailPattern.test(email)) {
      errors.push({ field: "email", code: "email_invalid", message: "E-mail inválido" });
    }
  }

  let normalizedPhone: string | null = null;
  if (payload.whatsapp) {
    const result = normalizeBrazilPhone(payload.whatsapp);
    if (!result.success) {
      errors.push({ field: "whatsapp", code: "phone_invalid", message: "Telefone inválido" });
    } else {
      normalizedPhone = result.e164;
    }
  }

  if (!allowedStages.has(payload.stage)) {
    errors.push({ field: "stage", code: "stage_invalid", message: "Estágio inválido" });
  }

  if (!payload.ownerMembershipId) {
    errors.push({ field: "ownerMembershipId", code: "owner_required", message: "Dono é obrigatório" });
  }

  let normalizedScore: number | null = null;
  if (payload.score !== undefined && payload.score !== null) {
    if (Number.isNaN(payload.score)) {
      errors.push({ field: "score", code: "score_invalid", message: "Score inválido" });
    } else {
      const safeScore = Math.max(0, Math.min(100, Math.round(payload.score)));
      normalizedScore = safeScore;
    }
  }

  if (errors.length > 0) {
    return { errors };
  }

  const normalizedTags = Array.from(new Set((payload.tags ?? []).map((tag) => tag.trim()).filter(Boolean)));
  const normalizedSource = payload.source ? payload.source.trim() : null;

  return {
    value: {
      ...payload,
      name: trimmedName!,
      email: payload.email ? payload.email.trim().toLowerCase() : null,
      tags: normalizedTags,
      whatsapp: normalizedPhone,
      normalizedPhone,
      score: normalizedScore ?? payload.score ?? null,
      nextActionNote: payload.nextActionNote?.trim() ?? null,
      nextActionAt: payload.nextActionAt ?? null,
      referredByContactId: payload.referredByContactId ?? null,
      source: normalizedSource,
    },
  };
}
