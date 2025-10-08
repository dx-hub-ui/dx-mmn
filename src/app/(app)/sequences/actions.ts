"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { trackServerEvent } from "@/lib/telemetry.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SequenceAssigneeMode, SequenceStepType, SequenceTargetType } from "@/features/sequences/editor/types";

export type SequenceAuthContext = {
  supabase: ReturnType<typeof createSupabaseServerClient>;
  membership: {
    id: string;
    organization_id: string;
    role: "org" | "leader" | "rep";
  };
  userId: string;
};

async function requireAuthContext(): Promise<SequenceAuthContext> {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    redirect("/sign-in");
  }

  const { data: membershipRow, error: membershipError } = await supabase
    .from("memberships")
    .select("id, organization_id, role, status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }

  if (!membershipRow) {
    throw new Error("Membro ativo não encontrado");
  }

  return {
    supabase,
    membership: membershipRow as { id: string; organization_id: string; role: "org" | "leader" | "rep" },
    userId: user.id,
  };
}

export async function createSequenceDraftAction() {
  const { supabase, membership, userId } = await requireAuthContext();

  const defaultName = "Nova sequência";

  const { data: sequence, error: sequenceError } = await supabase
    .from("sequences")
    .insert({
      org_id: membership.organization_id,
      name: defaultName,
      description: "",
      created_by_membership_id: membership.id,
      updated_by_membership_id: membership.id,
    })
    .select("id, org_id")
    .single();

  if (sequenceError) {
    throw sequenceError;
  }

  const { data: version, error: versionError } = await supabase
    .from("sequence_versions")
    .insert({
      sequence_id: sequence.id,
      org_id: membership.organization_id,
      version_number: 1,
      status: "draft",
      created_by_membership_id: membership.id,
      on_publish: "terminate",
    })
    .select("id")
    .single();

  if (versionError) {
    throw versionError;
  }

  await trackServerEvent(
    "sequence_created",
    { sequenceId: sequence.id, versionId: version.id },
    { groups: { orgId: membership.organization_id, sequenceId: sequence.id }, distinctId: userId }
  );

  revalidatePath("/sequences");

  return { sequenceId: sequence.id, versionId: version.id };
}

export type UpsertStepInput = {
  sequenceId: string;
  versionId: string;
  stepId?: string;
  title: string;
  shortDescription?: string;
  type: SequenceStepType;
  assigneeMode: SequenceAssigneeMode;
  assigneeMembershipId?: string | null;
  dueOffsetDays: number;
  dueOffsetHours: number;
  priority?: string | null;
  tags?: string[];
  channelHint?: string | null;
  pauseUntilDone: boolean;
  isActive: boolean;
};

export async function upsertSequenceStepAction(input: UpsertStepInput) {
  const { supabase, membership } = await requireAuthContext();

  if (!input.stepId) {
    const { data: lastStep, error: lastError } = await supabase
      .from("sequence_steps")
      .select("step_order")
      .eq("sequence_version_id", input.versionId)
      .order("step_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastError) {
      throw lastError;
    }

    const nextOrder = lastStep ? (lastStep.step_order as number) + 1 : 1;

    const { error: insertError } = await supabase.from("sequence_steps").insert({
      sequence_version_id: input.versionId,
      org_id: membership.organization_id,
      step_order: nextOrder,
      title: input.title,
      short_description: input.shortDescription ?? null,
      body: null,
      step_type: input.type,
      assignee_mode: input.assigneeMode,
      assignee_membership_id: input.assigneeMembershipId ?? null,
      due_offset_days: input.dueOffsetDays,
      due_offset_hours: input.dueOffsetHours,
      priority: input.priority ?? null,
      tags: input.tags ?? [],
      checklist: null,
      dependencies: [],
      channel_hint: input.channelHint ?? null,
      is_active: input.isActive,
      pause_until_done: input.pauseUntilDone,
    });

    if (insertError) {
      throw insertError;
    }
  } else {
    const { error: updateError } = await supabase
      .from("sequence_steps")
      .update({
        title: input.title,
        short_description: input.shortDescription ?? null,
        step_type: input.type,
        assignee_mode: input.assigneeMode,
        assignee_membership_id: input.assigneeMembershipId ?? null,
        due_offset_days: input.dueOffsetDays,
        due_offset_hours: input.dueOffsetHours,
        priority: input.priority ?? null,
        tags: input.tags ?? [],
        channel_hint: input.channelHint ?? null,
        is_active: input.isActive,
        pause_until_done: input.pauseUntilDone,
      })
      .eq("id", input.stepId)
      .eq("sequence_version_id", input.versionId);

    if (updateError) {
      throw updateError;
    }
  }

  revalidatePath(`/sequences/${input.sequenceId}`);
}

export async function reorderSequenceStepsAction(
  sequenceId: string,
  versionId: string,
  orderedStepIds: string[]
) {
  const { supabase } = await requireAuthContext();

  await Promise.all(
    orderedStepIds.map((stepId, index) =>
      supabase
        .from("sequence_steps")
        .update({ step_order: index + 1 })
        .eq("id", stepId)
        .eq("sequence_version_id", versionId)
    )
  );

  revalidatePath(`/sequences/${sequenceId}`);
}

export async function duplicateSequenceStepAction(sequenceId: string, stepId: string) {
  const { supabase, membership } = await requireAuthContext();

  const { data: step, error: stepError } = await supabase
    .from("sequence_steps")
    .select(
      "sequence_version_id, org_id, step_order, title, short_description, body, step_type, assignee_mode, assignee_membership_id, due_offset_days, due_offset_hours, priority, tags, checklist, dependencies, channel_hint, is_active, pause_until_done"
    )
    .eq("id", stepId)
    .maybeSingle();

  if (stepError) {
    throw stepError;
  }

  if (!step) {
    throw new Error("Passo não encontrado");
  }

  const { data: lastStep, error: lastError } = await supabase
    .from("sequence_steps")
    .select("step_order")
    .eq("sequence_version_id", step.sequence_version_id)
    .order("step_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastError) {
    throw lastError;
  }

  const nextOrder = lastStep ? (lastStep.step_order as number) + 1 : 1;

  const { error: insertError } = await supabase.from("sequence_steps").insert({
    sequence_version_id: step.sequence_version_id,
    org_id: membership.organization_id,
    step_order: nextOrder,
    title: `${step.title} (cópia)`,
    short_description: step.short_description,
    body: step.body,
    step_type: step.step_type,
    assignee_mode: step.assignee_mode,
    assignee_membership_id: step.assignee_membership_id,
    due_offset_days: step.due_offset_days,
    due_offset_hours: step.due_offset_hours,
    priority: step.priority,
    tags: step.tags,
    checklist: step.checklist,
    dependencies: [],
    channel_hint: step.channel_hint,
    is_active: step.is_active,
    pause_until_done: step.pause_until_done,
  });

  if (insertError) {
    throw insertError;
  }

  revalidatePath(`/sequences/${sequenceId}`);
}

export async function deleteSequenceStepAction(sequenceId: string, stepId: string) {
  const { supabase } = await requireAuthContext();
  const { error } = await supabase.from("sequence_steps").delete().eq("id", stepId);

  if (error) {
    throw error;
  }

  revalidatePath(`/sequences/${sequenceId}`);
}

export async function toggleSequenceStepAction(sequenceId: string, stepId: string, isActive: boolean) {
  const { supabase } = await requireAuthContext();

  const { error } = await supabase
    .from("sequence_steps")
    .update({ is_active: isActive })
    .eq("id", stepId);

  if (error) {
    throw error;
  }

  revalidatePath(`/sequences/${sequenceId}`);
}

export type UpdateVersionRulesInput = {
  sequenceId: string;
  versionId: string;
  workTimeZone: string;
  workDays: number[];
  workStartTime: string;
  workEndTime: string;
  cooldownDays: number;
  cooldownHours: number;
  windowClampEnabled: boolean;
  onPublish: "terminate" | "migrate";
  notes?: string | null;
};

export async function updateSequenceVersionRulesAction(input: UpdateVersionRulesInput) {
  const { supabase } = await requireAuthContext();

  const { error } = await supabase
    .from("sequence_versions")
    .update({
      work_time_zone: input.workTimeZone,
      work_days: input.workDays,
      work_start_time: input.workStartTime,
      work_end_time: input.workEndTime,
      cooldown_days: input.cooldownDays,
      cooldown_hours: input.cooldownHours,
      window_clamp_enabled: input.windowClampEnabled,
      on_publish: input.onPublish,
      notes: input.notes ?? null,
    })
    .eq("id", input.versionId)
    .eq("sequence_id", input.sequenceId);

  if (error) {
    throw error;
  }

  revalidatePath(`/sequences/${input.sequenceId}`);
}

export async function publishSequenceVersionAction(sequenceId: string, versionId: string, strategy: "terminate" | "migrate") {
  const { supabase, membership, userId } = await requireAuthContext();

  const now = new Date().toISOString();

  const { error: versionError } = await supabase
    .from("sequence_versions")
    .update({
      status: "published",
      on_publish: strategy,
      published_at: now,
      published_by_membership_id: membership.id,
    })
    .eq("id", versionId)
    .eq("sequence_id", sequenceId);

  if (versionError) {
    throw versionError;
  }

  const { error: sequenceError } = await supabase
    .from("sequences")
    .update({ status: "active", active_version_id: versionId, updated_by_membership_id: membership.id })
    .eq("id", sequenceId);

  if (sequenceError) {
    throw sequenceError;
  }

  await trackServerEvent(
    "sequence_version_published",
    { sequenceId, versionId, strategy },
    { groups: { orgId: membership.organization_id, sequenceId }, distinctId: userId }
  );

  revalidatePath("/sequences");
  revalidatePath(`/sequences/${sequenceId}`);
}

export async function enrollTargetsAction(
  sequenceId: string,
  versionId: string,
  targetType: SequenceTargetType,
  targetIds: string[]
) {
  const { supabase, membership, userId } = await requireAuthContext();

  const now = new Date().toISOString();

  const rows = targetIds.map((targetId) => ({
    org_id: membership.organization_id,
    sequence_id: sequenceId,
    sequence_version_id: versionId,
    target_type: targetType,
    target_id: targetId,
    status: "active",
    enrolled_at: now,
    dedupe_key: `${versionId}|${targetType}|${targetId}`,
    created_by_membership_id: membership.id,
  }));

  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase.from("sequence_enrollments").insert(rows);

  if (error) {
    throw error;
  }

  await trackServerEvent(
    "sequence_enrolled",
    { sequenceId, versionId, targetType, total: rows.length },
    { groups: { orgId: membership.organization_id, sequenceId }, distinctId: userId }
  );

  revalidatePath(`/sequences/${sequenceId}`);
}

export async function pauseEnrollmentAction(sequenceId: string, enrollmentId: string) {
  const { supabase, membership, userId } = await requireAuthContext();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("sequence_enrollments")
    .update({ status: "paused", paused_at: now })
    .eq("id", enrollmentId);

  if (error) {
    throw error;
  }

  await trackServerEvent(
    "sequence_paused",
    { sequenceId, enrollmentId },
    { groups: { orgId: membership.organization_id, sequenceId }, distinctId: userId }
  );

  revalidatePath(`/sequences/${sequenceId}`);
}

export async function resumeEnrollmentAction(sequenceId: string, enrollmentId: string) {
  const { supabase, membership, userId } = await requireAuthContext();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("sequence_enrollments")
    .update({ status: "active", resumed_at: now, paused_at: null })
    .eq("id", enrollmentId);

  if (error) {
    throw error;
  }

  await trackServerEvent(
    "sequence_resumed",
    { sequenceId, enrollmentId },
    { groups: { orgId: membership.organization_id, sequenceId }, distinctId: userId }
  );

  revalidatePath(`/sequences/${sequenceId}`);
}

export async function removeEnrollmentAction(sequenceId: string, enrollmentId: string) {
  const { supabase, membership, userId } = await requireAuthContext();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("sequence_enrollments")
    .update({ status: "terminated", terminated_at: now, removed_by_membership_id: membership.id })
    .eq("id", enrollmentId);

  if (error) {
    throw error;
  }

  await trackServerEvent(
    "sequence_removed",
    { sequenceId, enrollmentId },
    { groups: { orgId: membership.organization_id, sequenceId }, distinctId: userId }
  );

  revalidatePath(`/sequences/${sequenceId}`);
}
