import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { dryRunImport, applyImport, ImportRow } from "@/features/crm/contacts/server/importContacts";
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
    actorMembershipId?: string;
    mode?: "dry-run" | "apply";
    rows?: ImportRow[];
  };

  if (!body.organizationId) {
    return NextResponse.json({ error: "organizationId é obrigatório" }, { status: 400 });
  }

  if (!body.actorMembershipId) {
    return NextResponse.json({ error: "actorMembershipId é obrigatório" }, { status: 400 });
  }

  if (!body.mode) {
    return NextResponse.json({ error: "mode é obrigatório" }, { status: 400 });
  }

  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json({ error: "rows deve conter pelo menos um registro" }, { status: 400 });
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

  try {
    if (body.mode === "dry-run") {
      const result = await dryRunImport(supabase, body.organizationId, body.rows);
      return NextResponse.json(result, { status: 200 });
    }

    const memberships = await fetchVisibleMemberships(supabase, body.organizationId);
    const actor = memberships.find((member) => member.id === body.actorMembershipId);

    if (!actor) {
      return NextResponse.json({ error: "Membro não possui permissão" }, { status: 403 });
    }

    const result = await applyImport(
      supabase,
      body.organizationId,
      body.rows,
      body.actorMembershipId
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Import failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao importar contatos" },
      { status: 500 }
    );
  }
}
