import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { trackServerEvent } from "@/lib/telemetry.server";

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    organizationId?: string;
    actorMembershipId?: string;
    contactIds?: string[];
    sequenceId?: string;
  };

  if (!body.organizationId) {
    return NextResponse.json({ error: "organizationId é obrigatório" }, { status: 400 });
  }

  if (!body.actorMembershipId) {
    return NextResponse.json({ error: "actorMembershipId é obrigatório" }, { status: 400 });
  }

  if (!Array.isArray(body.contactIds) || body.contactIds.length === 0) {
    return NextResponse.json({ error: "Informe pelo menos um contato" }, { status: 400 });
  }

  if (!body.sequenceId) {
    return NextResponse.json({ error: "sequenceId é obrigatório" }, { status: 400 });
  }

  const { data: membershipRow, error: membershipError } = await supabase
    .from("memberships")
    .select("id, organization_id, user_id")
    .eq("id", body.actorMembershipId)
    .maybeSingle();

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 500 });
  }

  if (!membershipRow) {
    return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 });
  }

  if (membershipRow.user_id !== user.id) {
    return NextResponse.json({ error: "Membro não pertence ao usuário autenticado" }, { status: 403 });
  }

  if (membershipRow.organization_id !== body.organizationId) {
    return NextResponse.json({ error: "Organização inválida" }, { status: 400 });
  }

  const { data: sequenceRow, error: sequenceError } = await supabase
    .from("sequences")
    .select("id, org_id, status, is_active, default_target_type, active_version_id")
    .eq("id", body.sequenceId)
    .maybeSingle();

  if (sequenceError) {
    return NextResponse.json({ error: sequenceError.message }, { status: 500 });
  }

  if (!sequenceRow) {
    return NextResponse.json({ error: "Sequência não encontrada" }, { status: 404 });
  }

  if (sequenceRow.org_id !== body.organizationId) {
    return NextResponse.json({ error: "Sequência não pertence à organização" }, { status: 403 });
  }

  if (sequenceRow.default_target_type !== "contact") {
    return NextResponse.json({ error: "Sequência não aceita contatos" }, { status: 400 });
  }

  if (sequenceRow.status !== "active" || sequenceRow.is_active !== true) {
    return NextResponse.json({ error: "Sequência inativa" }, { status: 400 });
  }

  if (!sequenceRow.active_version_id) {
    return NextResponse.json({ error: "Sequência sem versão ativa" }, { status: 400 });
  }

  const now = new Date().toISOString();
  let enrolled = 0;
  let skipped = 0;

  for (const contactId of body.contactIds) {
    try {
      const { error } = await supabase.from("sequence_enrollments").insert({
        org_id: body.organizationId,
        sequence_id: sequenceRow.id,
        sequence_version_id: sequenceRow.active_version_id,
        target_type: "contact",
        target_id: contactId,
        status: "active",
        enrolled_at: now,
        dedupe_key: `${sequenceRow.active_version_id}|contact|${contactId}`,
        created_by_membership_id: membershipRow.id,
      });

      if (error) {
        if (error.code === "23505") {
          skipped += 1;
          continue;
        }
        throw error;
      }
      enrolled += 1;
    } catch (error) {
      console.error("Failed to enroll contact into sequence", error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Erro ao adicionar contatos à sequência" },
        { status: 500 }
      );
    }
  }

  if (enrolled > 0) {
    await trackServerEvent(
      "sequence_enrolled",
      { sequenceId: body.sequenceId, versionId: sequenceRow.active_version_id, total: enrolled, skipped },
      { groups: { orgId: body.organizationId, sequenceId: body.sequenceId }, distinctId: user.id }
    );
  }

  return NextResponse.json({ enrolled, skipped }, { status: 200 });
}
