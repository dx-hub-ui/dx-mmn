import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { performBulkAction } from "@/features/crm/contacts/server/bulkActions";
import { BulkActionPayload } from "@/features/crm/contacts/types";
import { fetchVisibleMemberships } from "@/features/crm/contacts/server/listContacts";

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

  const body = (await req.json()) as {
    organizationId?: string;
    contactIds?: string[];
    actorMembershipId?: string;
    action?: BulkActionPayload;
  };

  if (!body.organizationId) {
    return NextResponse.json({ error: "organizationId é obrigatório" }, { status: 400 });
  }

  if (!body.actorMembershipId) {
    return NextResponse.json({ error: "actorMembershipId é obrigatório" }, { status: 400 });
  }

  if (!Array.isArray(body.contactIds) || body.contactIds.length === 0) {
    return NextResponse.json({ error: "contactIds deve conter pelo menos um id" }, { status: 400 });
  }

  if (!body.action) {
    return NextResponse.json({ error: "Ação é obrigatória" }, { status: 400 });
  }

  const { data: membershipRow, error: membershipError } = await supabase
    .from("memberships")
    .select("id, organization_id, role, user_id, parent_leader_id")
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

  const memberships = await fetchVisibleMemberships(supabase, body.organizationId);
  const actor = memberships.find((member) => member.id === membershipRow.id);

  if (!actor) {
    return NextResponse.json({ error: "Membro não possui permissão" }, { status: 403 });
  }

  try {
    const result = await performBulkAction({
      supabase,
      organizationId: body.organizationId,
      actor,
      contactIds: body.contactIds,
      action: body.action,
      memberships,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Bulk action failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao executar ação em lote" },
      { status: 500 }
    );
  }
}
