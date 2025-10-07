import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ContactFilters, ContactInput } from "@/features/crm/contacts/types";
import { listContacts } from "@/features/crm/contacts/server/listContacts";
import { createContact } from "@/features/crm/contacts/server/upsertContact";

function parseFilters(searchParams: URLSearchParams): ContactFilters {
  const filters: ContactFilters = {};

  const stages = searchParams.get("stages");
  if (stages) {
    filters.stages = stages.split(",").filter(Boolean) as ContactFilters["stages"];
  }

  const ownerIds = searchParams.get("ownerIds");
  if (ownerIds) {
    filters.ownerIds = ownerIds.split(",").filter(Boolean);
  }

  const referredBy = searchParams.get("referredBy");
  if (referredBy) {
    filters.referredByContactIds = referredBy.split(",").filter(Boolean);
  }

  const tags = searchParams.get("tags");
  if (tags) {
    filters.tags = tags.split(",").filter(Boolean);
  }

  const nextActionStart = searchParams.get("nextActionStart");
  const nextActionEnd = searchParams.get("nextActionEnd");
  if (nextActionStart || nextActionEnd) {
    filters.nextActionBetween = {
      start: nextActionStart,
      end: nextActionEnd,
    };
  }

  const search = searchParams.get("search");
  if (search) {
    filters.search = search;
  }

  return filters;
}

export async function GET(req: NextRequest) {
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

  const { searchParams } = new URL(req.url);
  const organizationId = searchParams.get("organizationId");

  if (!organizationId) {
    return NextResponse.json({ error: "organizationId é obrigatório" }, { status: 400 });
  }

  const filters = parseFilters(searchParams);

  try {
    const contacts = await listContacts(supabase, organizationId, filters);
    return NextResponse.json({ contacts });
  } catch (error) {
    console.error("Failed to list contacts", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao listar contatos" },
      { status: 500 }
    );
  }
}

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

  const body = (await req.json()) as Partial<ContactInput> & { organizationId?: string };
  const organizationId = body.organizationId;

  if (!organizationId) {
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
    const result = await createContact(supabase, organizationId, payload);

    if (!result.success) {
      return NextResponse.json({ errors: result.errors }, { status: 400 });
    }

    return NextResponse.json({ contact: result.contact }, { status: 201 });
  } catch (error) {
    console.error("Failed to create contact", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao criar contato" },
      { status: 500 }
    );
  }
}
