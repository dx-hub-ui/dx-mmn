import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ContactFilters, ContactRecord, MembershipSummary } from "../types";

const DEFAULT_LIMIT = 1500;

type SupabaseServerClient = ReturnType<typeof createSupabaseServerClient>;

type ContactReferrerRow = {
  id: string;
  name: string;
};

export type ContactRow = {
  id: string;
  organization_id: string;
  owner_membership_id: string;
  name: string;
  email: string | null;
  whatsapp: string | null;
  status: string;
  source: string | null;
  tags: string[] | null;
  score: number | null;
  last_touch_at: string | null;
  next_action_at: string | null;
  next_action_note: string | null;
  referred_by_contact_id: string | null;
  lost_reason: string | null;
  lost_review_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  owner: {
    id: string;
    organization_id: string;
    role: "org" | "leader" | "rep";
    user_id: string;
    parent_leader_id: string | null;
    profile: {
      id: string;
      email: string | null;
      raw_user_meta_data: Record<string, unknown> | null;
    } | null;
  } | null;
  referred_by?: ContactReferrerRow | ContactReferrerRow[] | null;
};

export const CONTACTS_SELECT_CORE = `id, organization_id, owner_membership_id, name, email, whatsapp, status, source, tags, score, last_touch_at, next_action_at, next_action_note, referred_by_contact_id, created_at, updated_at,
       lost_reason, lost_review_at, archived_at,
       owner:memberships!contacts_owner_membership_id_fkey (id, organization_id, role, user_id, parent_leader_id, profile:profiles (id, email, raw_user_meta_data))`;

export const CONTACTS_SELECT_WITH_REFERRER = `${CONTACTS_SELECT_CORE},
       referred_by:contacts!contacts_referred_by_contact_id_fkey (id, name)`;

export type ContactQueryBuilder = PostgrestFilterBuilder<
  any,
  any,
  any,
  any,
  any,
  any,
  any
>;

function applyContactFilters<T extends ContactQueryBuilder>(
  query: T,
  filters: ContactFilters
): T {
  let scopedQuery = query;

  if (filters.stages && filters.stages.length > 0) {
    scopedQuery = scopedQuery.in(
      "status",
      filters.stages.map((stage) => (stage === "cadastrado" ? "ganho" : stage))
    ) as T;
  }

  if (filters.ownerIds && filters.ownerIds.length > 0) {
    scopedQuery = scopedQuery.in("owner_membership_id", filters.ownerIds) as T;
  }

  if (filters.referredByContactIds && filters.referredByContactIds.length > 0) {
    scopedQuery = scopedQuery.in("referred_by_contact_id", filters.referredByContactIds) as T;
  }

  if (filters.tags && filters.tags.length > 0) {
    scopedQuery = scopedQuery.contains("tags", filters.tags) as T;
  }

  if (filters.nextActionBetween) {
    const { start, end } = filters.nextActionBetween;
    if (start) {
      scopedQuery = scopedQuery.gte("next_action_at", start) as T;
    }
    if (end) {
      scopedQuery = scopedQuery.lte("next_action_at", end) as T;
    }
  }

  if (filters.search) {
    const search = filters.search.trim();
    if (search) {
      const normalized = search.replace(/%/g, "\\%").replace(/_/g, "\\_");
      scopedQuery = scopedQuery.or(
        `name.ilike.%${normalized}%,email.ilike.%${normalized}%,whatsapp.ilike.%${normalized}%`
      ) as T;
    }
  }

  return scopedQuery;
}

type MembershipRow = {
  id: string;
  organization_id: string;
  role: "org" | "leader" | "rep";
  user_id: string;
  parent_leader_id: string | null;
  profile: {
    id: string;
    email: string | null;
    raw_user_meta_data: Record<string, unknown> | null;
  } | null;
};

function normalizeReferredBy(
  value: ContactRow["referred_by"]
): ContactReferrerRow | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

export function mapContactRow(row: ContactRow): ContactRecord {
  const ownerProfile = row.owner?.profile?.raw_user_meta_data as { name?: string; full_name?: string } | null;
  const ownerDisplayName =
    ownerProfile?.name ?? ownerProfile?.full_name ?? row.owner?.profile?.email ?? "Sem nome";

  const referredBy = normalizeReferredBy(row.referred_by);

  return {
    id: row.id,
    organizationId: row.organization_id,
    ownerMembershipId: row.owner_membership_id,
    name: row.name,
    email: row.email,
    whatsapp: row.whatsapp,
    source: row.source,
    stage:
      ((row.status === "ganho"
        ? "cadastrado"
        : row.status === "qualificado"
        ? "followup"
        : (row.status as ContactRecord["stage"])) ?? "novo") as ContactRecord["stage"],
    tags: row.tags ?? [],
    score: row.score,
    lastTouchAt: row.last_touch_at,
    nextActionAt: row.next_action_at,
    nextActionNote: row.next_action_note,
    referredByContactId: row.referred_by_contact_id,
    lostReason: row.lost_reason,
    lostReviewAt: row.lost_review_at,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    owner:
      row.owner
        ? {
            id: row.owner.id,
            organizationId: row.owner.organization_id,
            role: row.owner.role,
            userId: row.owner.user_id,
            parentLeaderId: row.owner.parent_leader_id,
            displayName: ownerDisplayName,
            email: row.owner.profile?.email ?? null,
            avatarUrl: null,
          }
        : null,
    referredBy: referredBy ? { id: referredBy.id, name: referredBy.name } : null,
  };
}

export async function listContacts(
  supabase: SupabaseServerClient,
  organizationId: string,
  filters: ContactFilters = {},
  limit = DEFAULT_LIMIT
): Promise<ContactRecord[]> {
  const buildQuery = (select: string) =>
    applyContactFilters(
      supabase
        .from("contacts")
        .select(select)
        .eq("organization_id", organizationId)
        .limit(limit)
        .order("updated_at", { ascending: false }) as ContactQueryBuilder,
      filters
    );

  const primaryResult = await buildQuery(CONTACTS_SELECT_WITH_REFERRER);

  if (primaryResult.error && primaryResult.error.code === "PGRST200") {
    const fallbackResult = await buildQuery(CONTACTS_SELECT_CORE);

    if (fallbackResult.error) {
      throw fallbackResult.error;
    }

    const rows = (fallbackResult.data ?? []) as unknown as ContactRow[];
    return rows.map((row) => mapContactRow(row));
  }

  if (primaryResult.error) {
    throw primaryResult.error;
  }

  const rows = (primaryResult.data ?? []) as unknown as ContactRow[];

  return rows.map((row) => mapContactRow(row));
}

export async function fetchVisibleMemberships(
  supabase: SupabaseServerClient,
  organizationId: string
): Promise<MembershipSummary[]> {
  const { data: visibleIdsData, error: visibleIdsError } = await supabase.rpc(
    "visible_membership_ids",
    { org_id: organizationId }
  );

  if (visibleIdsError) {
    throw visibleIdsError;
  }

  const membershipIds = (visibleIdsData ?? []).map((item: { membership_id: string }) => item.membership_id);

  if (membershipIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("memberships")
    .select(
      `id, organization_id, role, user_id, parent_leader_id, profile:profiles (id, email, raw_user_meta_data)`
    )
    .in("id", membershipIds);

  if (error) {
    throw error;
  }

  const membershipRows = (data ?? []) as unknown as MembershipRow[];

  return membershipRows.map((item) => {
    const rawMeta = item.profile?.raw_user_meta_data as { name?: string; full_name?: string } | null;
    const displayName = rawMeta?.name ?? rawMeta?.full_name ?? item.profile?.email ?? "Sem nome";
    return {
      id: item.id,
      organizationId: item.organization_id,
      role: item.role,
      userId: item.user_id,
      parentLeaderId: item.parent_leader_id,
      displayName,
      email: item.profile?.email ?? null,
      avatarUrl: null,
    } as MembershipSummary;
  });
}
