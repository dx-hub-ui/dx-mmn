import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ContactDetail,
  ContactReferralSummary,
  ContactTimelineEvent,
  ContactTimelineEventType,
  ContactStageId,
  MembershipSummary,
} from "../types";
import { fetchContactById } from "./queries";

type SupabaseServerClient = ReturnType<typeof createSupabaseServerClient>;

type ContactEventRow = {
  id: string;
  organization_id: string;
  contact_id: string;
  event_type: ContactTimelineEventType;
  payload: Record<string, unknown> | null;
  occurred_at: string;
  actor_membership_id: string | null;
  actor: {
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
};

type ReferralRow = {
  id: string;
  name: string;
  status: string;
};

export type ContactEventInsert = {
  contactId: string;
  organizationId: string;
  type: ContactTimelineEventType;
  payload?: Record<string, unknown>;
  actorMembershipId?: string | null;
  occurredAt?: string;
};

function mapActor(row: ContactEventRow["actor"]): MembershipSummary | null {
  if (!row) {
    return null;
  }

  const rawMeta = row.profile?.raw_user_meta_data as { name?: string; full_name?: string } | null;
  const displayName = rawMeta?.name ?? rawMeta?.full_name ?? row.profile?.email ?? "Sem nome";

  return {
    id: row.id,
    organizationId: row.organization_id,
    role: row.role,
    userId: row.user_id,
    parentLeaderId: row.parent_leader_id,
    displayName,
    email: row.profile?.email ?? null,
    avatarUrl: null,
  };
}

function mapEventRow(row: ContactEventRow): ContactTimelineEvent {
  return {
    id: row.id,
    contactId: row.contact_id,
    organizationId: row.organization_id,
    occurredAt: row.occurred_at,
    type: row.event_type,
    payload: row.payload ?? {},
    actorMembershipId: row.actor_membership_id,
    actor: mapActor(row.actor),
  };
}

function normalizeStage(status: string): ContactStageId {
  if (status === "ganho") {
    return "cadastrado";
  }
  if (status === "lost" || status === "perdido") {
    return "perdido";
  }
  return (status as ContactStageId) ?? "novo";
}

function mapReferral(row: ReferralRow): ContactReferralSummary {
  return {
    id: row.id,
    name: row.name,
    stage: normalizeStage(row.status),
  };
}

export async function logContactEvents(
  supabase: SupabaseServerClient,
  events: ContactEventInsert[]
): Promise<void> {
  if (events.length === 0) {
    return;
  }

  const payload = events.map((event) => ({
    contact_id: event.contactId,
    organization_id: event.organizationId,
    event_type: event.type,
    payload: event.payload ?? {},
    actor_membership_id: event.actorMembershipId ?? null,
    occurred_at: event.occurredAt ?? new Date().toISOString(),
  }));

  const { error } = await supabase.from("contact_events").insert(payload);

  if (error) {
    throw error;
  }
}

export async function fetchContactDetail(
  supabase: SupabaseServerClient,
  organizationId: string,
  contactId: string
): Promise<ContactDetail | null> {
  const contact = await fetchContactById(supabase, contactId);

  if (!contact || contact.organizationId !== organizationId) {
    return null;
  }

  const [{ data: eventsData, error: eventsError }, { data: referralsData, error: referralsError }] = await Promise.all([
    supabase
      .from("contact_events")
      .select(
        `id, organization_id, contact_id, event_type, payload, occurred_at, actor_membership_id,
         actor:memberships (id, organization_id, role, user_id, parent_leader_id, profile:profiles (id, email, raw_user_meta_data))`
      )
      .eq("contact_id", contactId)
      .order("occurred_at", { ascending: false }),
    supabase
      .from("contacts")
      .select("id, name, status")
      .eq("referred_by_contact_id", contactId),
  ]);

  if (eventsError) {
    throw eventsError;
  }

  if (referralsError) {
    throw referralsError;
  }

  const timeline = (eventsData ?? []).map((row) => mapEventRow(row as unknown as ContactEventRow));
  const referrals = (referralsData ?? []).map((row) => mapReferral(row as unknown as ReferralRow));

  return { contact, timeline, referrals };
}
