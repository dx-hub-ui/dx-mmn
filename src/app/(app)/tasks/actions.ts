"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { trackServerEvent } from "@/lib/telemetry.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { captureSequenceServerBreadcrumb } from "@/lib/observability/sentryServer";
import { normalizeSnoozeInput } from "@/features/tasks/my/validation";

export type TasksAuthContext = {
  supabase: ReturnType<typeof createSupabaseServerClient>;
  membership: {
    id: string;
    organization_id: string;
    role: "org" | "leader" | "rep";
  };
  userId: string;
};

async function requireTasksContext(): Promise<TasksAuthContext> {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    redirect(`/sign-in?redirectTo=${encodeURIComponent("/tasks/my")}`);
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

type AssignmentRow = {
  id: string;
  org_id: string;
  sequence_id: string;
  sequence_version_id: string;
  sequence_step_id: string;
  sequence_enrollment_id: string;
  assignee_membership_id: string | null;
  status: "open" | "snoozed" | "done" | "blocked";
  due_at: string | null;
  snoozed_until: string | null;
};

async function getAssignmentForMember(supabase: ReturnType<typeof createSupabaseServerClient>, assignmentId: string) {
  const { data, error } = await supabase
    .from("sequence_assignments")
    .select(
      "id, org_id, sequence_id, sequence_version_id, sequence_step_id, sequence_enrollment_id, assignee_membership_id, status, due_at, snoozed_until"
    )
    .eq("id", assignmentId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Tarefa não encontrada");
  }

  return data as AssignmentRow;
}

type CompleteAssignmentInput = {
  assignmentId: string;
};

type SnoozeAssignmentInput = {
  assignmentId: string;
  snoozeUntil: string;
};

export async function completeAssignmentAction({ assignmentId }: CompleteAssignmentInput) {
  const { supabase, membership, userId } = await requireTasksContext();
  const assignment = await getAssignmentForMember(supabase, assignmentId);

  if (assignment.org_id !== membership.organization_id) {
    throw new Error("Acesso negado para a tarefa");
  }

  if (assignment.assignee_membership_id && assignment.assignee_membership_id !== membership.id) {
    throw new Error("Você não é responsável por esta tarefa");
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("sequence_assignments")
    .update({
      status: "done",
      done_at: nowIso,
      snoozed_until: null,
      overdue_at: null,
      blocked_reason: null,
    })
    .eq("id", assignmentId)
    .eq("org_id", membership.organization_id);

  if (error) {
    throw error;
  }

  captureSequenceServerBreadcrumb(
    {
      orgId: assignment.org_id,
      sequenceId: assignment.sequence_id,
      versionId: assignment.sequence_version_id,
      enrollmentId: assignment.sequence_enrollment_id,
      targetType: "assignment",
      assignmentId: assignment.id,
    },
    { message: "sequence_step_completed", data: { assignmentId } }
  );

  await trackServerEvent(
    "sequence_step_completed",
    { assignmentId, sequenceId: assignment.sequence_id, stepId: assignment.sequence_step_id },
    {
      groups: { orgId: assignment.org_id, sequenceId: assignment.sequence_id },
      distinctId: userId,
    }
  );

  revalidatePath("/tasks/my");

  return { success: true };
}

export async function snoozeAssignmentAction({ assignmentId, snoozeUntil }: SnoozeAssignmentInput) {
  const { supabase, membership, userId } = await requireTasksContext();
  const assignment = await getAssignmentForMember(supabase, assignmentId);

  if (assignment.org_id !== membership.organization_id) {
    throw new Error("Acesso negado para a tarefa");
  }

  if (assignment.assignee_membership_id && assignment.assignee_membership_id !== membership.id) {
    throw new Error("Você não é responsável por esta tarefa");
  }

  const normalizedSnooze = normalizeSnoozeInput(snoozeUntil);

  const { error } = await supabase
    .from("sequence_assignments")
    .update({
      status: "snoozed",
      snoozed_until: normalizedSnooze,
      overdue_at: null,
    })
    .eq("id", assignmentId)
    .eq("org_id", membership.organization_id);

  if (error) {
    throw error;
  }

  if (assignment.assignee_membership_id) {
    const { error: notificationError } = await supabase.from("sequence_notifications").insert({
      org_id: assignment.org_id,
      sequence_id: assignment.sequence_id,
      sequence_enrollment_id: assignment.sequence_enrollment_id,
      sequence_assignment_id: assignment.id,
      member_id: assignment.assignee_membership_id,
      event_type: "assignment_snoozed",
      payload: { snoozed_until: normalizedSnooze },
    });

    if (notificationError) {
      console.error("[tasks] falha ao registrar notificação de adiamento", notificationError);
    }
  }

  captureSequenceServerBreadcrumb(
    {
      orgId: assignment.org_id,
      sequenceId: assignment.sequence_id,
      versionId: assignment.sequence_version_id,
      enrollmentId: assignment.sequence_enrollment_id,
      targetType: "assignment",
      assignmentId: assignment.id,
    },
    { message: "assignment_snoozed", data: { assignmentId, snoozedUntil: normalizedSnooze } }
  );

  await trackServerEvent(
    "assignment_snoozed",
    { assignmentId, sequenceId: assignment.sequence_id, snoozedUntil: normalizedSnooze },
    {
      groups: { orgId: assignment.org_id, sequenceId: assignment.sequence_id },
      distinctId: userId,
    }
  );

  revalidatePath("/tasks/my");

  return { success: true };
}
