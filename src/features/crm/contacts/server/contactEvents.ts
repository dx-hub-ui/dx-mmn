import { captureException } from "@sentry/nextjs";
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

export type MentionTarget = {
  userId: string;
  link?: string | null;
  snippet?: string | null;
  title?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
};

export type ContactEventInsert = {
  contactId: string;
  organizationId: string;
  type: ContactTimelineEventType;
  payload?: Record<string, unknown>;
  actorMembershipId?: string | null;
  occurredAt?: string;
  mentions?: MentionTarget[];
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

  const membershipIds = Array.from(
    new Set(
      events
        .map((event) => event.actorMembershipId)
        .filter((id): id is string => Boolean(id))
    )
  );

  const membershipMap = new Map<string, string>();

  if (membershipIds.length > 0) {
    const { data: membershipRows, error: membershipError } = await supabase
      .from("memberships")
      .select("id, user_id")
      .in("id", membershipIds);

    if (membershipError) {
      throw membershipError;
    }

    (membershipRows ?? []).forEach((row) => {
      membershipMap.set(row.id, row.user_id);
    });
  }

  const notificationTasks: Promise<unknown>[] = [];

  for (const event of events) {
    const { mentions, ...rest } = event;
    const { data: inserted, error } = await supabase
      .from("contact_events")
      .insert({
        contact_id: rest.contactId,
        organization_id: rest.organizationId,
        event_type: rest.type,
        payload: rest.payload ?? {},
        actor_membership_id: rest.actorMembershipId ?? null,
        occurred_at: rest.occurredAt ?? new Date().toISOString(),
      })
      .select("id, organization_id, event_type, actor_membership_id")
      .single();

    if (error) {
      throw error;
    }

    if (!mentions?.length) {
      continue;
    }

    const actorUserId = rest.actorMembershipId ? membershipMap.get(rest.actorMembershipId) ?? null : null;

    mentions.forEach((mention) => {
      if (!mention.userId || mention.userId === actorUserId) {
        return;
      }
      const sourceType = mention.sourceType ?? rest.type;
      const sourceId = mention.sourceId ?? inserted.id;
      notificationTasks.push(
        (async () => {
          const { error: rpcError } = await supabase.rpc("queue_notification", {
            p_org_id: rest.organizationId,
            p_user_id: mention.userId,
            p_type: "mention",
            p_source_type: sourceType,
            p_source_id: sourceId,
            p_actor_id: actorUserId,
            p_title:
              mention.title ??
              (typeof rest.payload?.title === "string"
                ? (rest.payload.title as string)
                : `Você foi mencionado em ${sourceType}`),
            p_snippet:
              mention.snippet ??
              (typeof rest.payload?.note === "string"
                ? (rest.payload.note as string)
                : (rest.payload?.message as string | null) ?? null),
            p_link: mention.link ?? null,
          });
          if (rpcError) {
            throw rpcError;
          }
        })()
      );
    });
  }

  if (notificationTasks.length > 0) {
    const results = await Promise.allSettled(notificationTasks);
    results.forEach((result) => {
      if (result.status === "rejected") {
        captureException(result.reason, { tags: { module: "notifications", action: "queue_mention" } });
      }
    });
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
