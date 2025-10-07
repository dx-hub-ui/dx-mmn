import { ContactInput, ContactRecord } from "../types";
import { validateContactInput } from "../validation/contact";
import { checkDuplicate, ensureReferral, SupabaseServerClient } from "./rules";
import { createContact } from "./upsertContact";

export type ImportRow = {
  name: string;
  email?: string | null;
  whatsapp?: string | null;
  ownerMembershipId: string;
  stage: ContactInput["stage"];
  source?: string | null;
  tags?: string[];
  score?: number | null;
  nextActionAt?: string | null;
  nextActionNote?: string | null;
  referredByContactId?: string | null;
  lostReason?: string | null;
  lostReviewAt?: string | null;
};

export type ImportRowResult = {
  index: number;
  errors: string[];
  payload?: ContactInput;
};

export type ImportDryRunResult = {
  rows: ImportRowResult[];
  validCount: number;
  invalidCount: number;
};

export async function dryRunImport(
  supabase: SupabaseServerClient,
  organizationId: string,
  rows: ImportRow[]
): Promise<ImportDryRunResult> {
  const results: ImportRowResult[] = [];
  let validCount = 0;

  for (const [index, row] of rows.entries()) {
    const contactInput: ContactInput = {
      name: row.name,
      email: row.email ?? null,
      whatsapp: row.whatsapp ?? null,
      stage: row.stage,
      ownerMembershipId: row.ownerMembershipId,
      source: row.source ?? null,
      tags: row.tags ?? [],
      score: row.score ?? null,
      nextActionAt: row.nextActionAt ?? null,
      nextActionNote: row.nextActionNote ?? null,
      referredByContactId: row.referredByContactId ?? null,
      lostReason: row.lostReason ?? null,
      lostReviewAt: row.lostReviewAt ?? null,
    };

    const validation = validateContactInput(contactInput);
    if (validation.errors) {
      results.push({ index, errors: validation.errors.map((error) => error.message) });
      continue;
    }

    const normalized = validation.value!;

    try {
      if (normalized.referredByContactId) {
        await ensureReferral(supabase, organizationId, normalized.referredByContactId);
      }
    } catch (error) {
      results.push({
        index,
        errors: [error instanceof Error ? error.message : "Indicação inválida"],
      });
      continue;
    }

    const duplicate = await checkDuplicate(supabase, organizationId, {
      whatsapp: normalized.whatsapp,
      email: normalized.email ?? null,
    });

    if (duplicate) {
      results.push({
        index,
        errors: [
          duplicate.field === "whatsapp"
            ? "Telefone já existe na organização"
            : "E-mail já existe na organização",
        ],
      });
      continue;
    }

    validCount += 1;
    results.push({ index, errors: [], payload: contactInput });
  }

  return { rows: results, validCount, invalidCount: rows.length - validCount };
}

export type ImportApplyResult = {
  created: ContactRecord[];
  errors: { index: number; message: string }[];
};

export async function applyImport(
  supabase: SupabaseServerClient,
  organizationId: string,
  rows: ImportRow[],
  actorMembershipId: string
): Promise<ImportApplyResult> {
  const dryRun = await dryRunImport(supabase, organizationId, rows);
  const created: ContactRecord[] = [];
  const errors: { index: number; message: string }[] = [];

  for (const result of dryRun.rows) {
    if (result.errors.length > 0 || !result.payload) {
      result.errors.forEach((message) => errors.push({ index: result.index, message }));
      continue;
    }

    const response = await createContact(
      supabase,
      organizationId,
      {
        ...result.payload,
      },
      actorMembershipId
    );

    if (!response.success) {
      response.errors.forEach((error) => errors.push({ index: result.index, message: error.message }));
    } else {
      created.push(response.contact);
    }
  }

  return { created, errors };
}
