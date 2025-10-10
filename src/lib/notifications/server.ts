import { captureException } from "@sentry/nextjs";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { applyOrgContext } from "@/lib/supabase/org";

export class HttpError extends Error {
  public readonly status: number;

  constructor(status: number, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    if (options?.cause) {
      try {
        // retain original stack when available
        (this as Error).cause = options.cause;
      } catch {
        // ignore if cause property unsupported
      }
    }
  }
}

export type OrgContextResult = {
  user: User;
  membershipId: string;
};

export async function ensureOrgMembership(
  supabase: SupabaseClient,
  orgId: string | null | undefined
): Promise<OrgContextResult> {
  if (!orgId) {
    throw new HttpError(400, "orgId é obrigatório");
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    captureException(authError, { tags: { module: "notifications", stage: "auth" } });
    throw new HttpError(500, "Falha ao obter usuário autenticado", { cause: authError });
  }

  if (!user) {
    throw new HttpError(401, "Não autenticado");
  }

  try {
    await applyOrgContext(supabase, orgId);
  } catch (error) {
    captureException(error, { tags: { module: "notifications", stage: "apply_org" } });
    throw new HttpError(500, "Não foi possível aplicar o contexto da organização", { cause: error });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("id")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError) {
    captureException(membershipError, { tags: { module: "notifications", stage: "membership" } });
    throw new HttpError(500, "Não foi possível validar o vínculo com a organização", {
      cause: membershipError,
    });
  }

  if (!membership) {
    throw new HttpError(403, "Acesso negado");
  }

  return { user, membershipId: membership.id };
}
