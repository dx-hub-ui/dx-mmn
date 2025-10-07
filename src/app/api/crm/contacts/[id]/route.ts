import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ContactInput } from "@/features/crm/contacts/types";
import { updateContact } from "@/features/crm/contacts/server/upsertContact";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

  const contactId = params.id;
  const body = (await req.json()) as Partial<ContactInput> & { organizationId?: string };

  if (!body.organizationId) {
    return NextResponse.json({ error: "organizationId é obrigatório" }, { status: 400 });
  }

  if (!body.ownerMembershipId) {
    return NextResponse.json({ error: "ownerMembershipId é obrigatório" }, { status: 400 });
  }

  const payload: ContactInput = {
    name: body.name ?? "",
    email: body.email ?? null,
    whatsapp: body.whatsapp ?? null,
    stage: body.stage ?? "novo",
    ownerMembershipId: body.ownerMembershipId,
    tags: body.tags ?? [],
    score: body.score ?? null,
    nextActionAt: body.nextActionAt ?? null,
    nextActionNote: body.nextActionNote ?? null,
    referredByContactId: body.referredByContactId ?? null,
  };

  try {
    const result = await updateContact(supabase, body.organizationId, contactId, payload);
    if (!result.success) {
      return NextResponse.json({ errors: result.errors }, { status: 400 });
    }
    return NextResponse.json({ contact: result.contact });
  } catch (error) {
    console.error("Failed to update contact", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao atualizar contato" },
      { status: 500 }
    );
  }
}
