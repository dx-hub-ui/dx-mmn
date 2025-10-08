import { serve } from "std/http/server";
import { createClient } from "@supabase/supabase-js";
import { addDays, addHours, getDay, isAfter, isBefore, set as setTime } from "date-fns";
import { utcToZonedTime, zonedTimeToUtc, format as formatInTimeZone } from "date-fns-tz";

type EnrollmentRow = {
  id: string;
  org_id: string;
  sequence_id: string;
  sequence_version_id: string;
  status: "active" | "paused" | "completed" | "terminated";
  enrolled_at: string;
  resumed_at: string | null;
  created_by_membership_id: string | null;
};

type VersionRow = {
  id: string;
  org_id: string;
  work_time_zone: string;
  work_days: number[] | null;
  work_start_time: string;
  work_end_time: string;
  window_clamp_enabled: boolean;
};

type StepRow = {
  id: string;
  sequence_version_id: string;
  step_order: number;
  is_active: boolean;
  dependencies: string[] | null;
  pause_until_done: boolean;
  due_offset_days: number;
  due_offset_hours: number;
  assignee_mode: "owner" | "org" | "custom";
  assignee_membership_id: string | null;
};

type AssignmentRow = {
  id: string;
  sequence_step_id: string;
  sequence_enrollment_id: string;
  assignee_membership_id: string | null;
  status: "open" | "snoozed" | "done" | "blocked";
  due_at: string | null;
  snoozed_until: string | null;
  done_at: string | null;
  overdue_at: string | null;
  blocked_reason: string | null;
};

type EngineInput = {
  orgId?: string;
  enrollmentIds?: string[];
  limit?: number;
};

type EngineStats = {
  processedEnrollments: number;
  assignmentsCreated: number;
  assignmentsUpdated: number;
  notificationsCreated: number;
  enrollmentsCompleted: number;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

function parseTimeParts(value: string): { hours: number; minutes: number; seconds: number } {
  const [hours, minutes = "0", seconds = "0"] = value.split(":");
  return {
    hours: Number.parseInt(hours ?? "0", 10),
    minutes: Number.parseInt(minutes, 10),
    seconds: Number.parseInt(seconds, 10),
  };
}

function isoWeekday(date: Date) {
  const day = getDay(date); // 0 (domingo) - 6 (sábado)
  return day === 0 ? 7 : day;
}

function clampToWindow(date: Date, version: VersionRow): Date {
  if (!version.window_clamp_enabled) {
    return date;
  }

  const timeZone = version.work_time_zone || "UTC";
  const allowedDays = new Set((version.work_days ?? [1, 2, 3, 4, 5]).map((day) => Number(day)));
  const startParts = parseTimeParts(version.work_start_time ?? "09:00:00");
  const endParts = parseTimeParts(version.work_end_time ?? "18:00:00");

  let zoned = utcToZonedTime(date, timeZone);

  while (true) {
    const currentDay = isoWeekday(zoned);

    if (!allowedDays.has(currentDay)) {
      const nextDay = addDays(setTime(zoned, { hours: startParts.hours, minutes: startParts.minutes, seconds: startParts.seconds, milliseconds: 0 }), 1);
      zoned = nextDay;
      continue;
    }

    const windowStart = setTime(zoned, {
      hours: startParts.hours,
      minutes: startParts.minutes,
      seconds: startParts.seconds,
      milliseconds: 0,
    });
    const windowEnd = setTime(zoned, {
      hours: endParts.hours,
      minutes: endParts.minutes,
      seconds: endParts.seconds,
      milliseconds: 0,
    });

    if (isBefore(zoned, windowStart)) {
      zoned = windowStart;
      break;
    }

    if (isAfter(zoned, windowEnd)) {
      zoned = addDays(windowStart, 1);
      continue;
    }

    break;
  }

  return zonedTimeToUtc(zoned, timeZone);
}

function computeDueDate(enrollment: EnrollmentRow, step: StepRow, version: VersionRow): string | null {
  const base = enrollment.resumed_at ? new Date(enrollment.resumed_at) : new Date(enrollment.enrolled_at);
  if (Number.isNaN(base.getTime())) {
    return null;
  }

  const withDays = addDays(base, step.due_offset_days ?? 0);
  const withHours = addHours(withDays, step.due_offset_hours ?? 0);
  const clamped = clampToWindow(withHours, version);
  return clamped.toISOString();
}

async function createNotification(params: {
  orgId: string;
  sequenceId: string;
  enrollmentId: string;
  assignmentId?: string | null;
  memberId: string;
  eventType: string;
  payload?: Record<string, unknown>;
  dedupeKey?: string;
}): Promise<boolean> {
  const { orgId, sequenceId, enrollmentId, memberId, assignmentId, eventType, payload, dedupeKey } = params;

  if (!memberId) {
    return false;
  }

  if (dedupeKey) {
    const { data: existing, error: existingError } = await supabase
      .from("sequence_notifications")
      .select("id")
      .eq("sequence_enrollment_id", enrollmentId)
      .eq("event_type", eventType)
      .eq("member_id", memberId)
      .eq("sequence_assignment_id", assignmentId ?? null)
      .filter("payload->>dedupe_key", "eq", dedupeKey)
      .maybeSingle();

    if (existingError) {
      console.error("[engine] failed to verify notification dedupe", existingError);
    }

    if (existing) {
      return false;
    }
  }

  const { error } = await supabase.from("sequence_notifications").insert({
    org_id: orgId,
    sequence_id: sequenceId,
    sequence_enrollment_id: enrollmentId,
    sequence_assignment_id: assignmentId ?? null,
    member_id: memberId,
    event_type: eventType,
    payload: payload ? { ...payload, dedupe_key: dedupeKey } : dedupeKey ? { dedupe_key: dedupeKey } : null,
  });

  if (error) {
    console.error("[engine] failed to create notification", error);
    return false;
  }

  return true;
}

function resolveAssignee(step: StepRow, enrollment: EnrollmentRow): string | null {
  if (step.assignee_mode === "custom") {
    return step.assignee_membership_id ?? enrollment.created_by_membership_id ?? null;
  }

  return enrollment.created_by_membership_id ?? step.assignee_membership_id ?? null;
}

async function processEnrollment(
  enrollment: EnrollmentRow,
  context: {
    versions: Map<string, VersionRow>;
    stepsByVersion: Map<string, StepRow[]>;
    assignmentsByEnrollment: Map<string, AssignmentRow[]>;
    stats: EngineStats;
    now: Date;
  }
) {
  const version = context.versions.get(enrollment.sequence_version_id);
  if (!version) {
    return;
  }

  const steps = context.stepsByVersion.get(version.id) ?? [];
  const assignments = context.assignmentsByEnrollment.get(enrollment.id) ?? [];
  const assignmentsByStep = new Map<string, AssignmentRow>();
  assignments.forEach((assignment) => {
    assignmentsByStep.set(assignment.sequence_step_id, assignment);
  });

  let pauseGateActive = false;

  for (const step of steps) {
    if (!step.is_active) {
      continue;
    }

    const existing = assignmentsByStep.get(step.id) ?? null;
    const dependencies = step.dependencies ?? [];
    const dependenciesDone = dependencies.every((depId) => {
      const depAssignment = assignmentsByStep.get(depId);
      return depAssignment ? depAssignment.status === "done" : false;
    });

    const assigneeId = resolveAssignee(step, enrollment);

    if (!dependenciesDone) {
      const reason = "Aguardando conclusão das dependências";
      if (existing) {
        if (existing.status !== "blocked" || existing.blocked_reason !== reason) {
          const { error } = await supabase
            .from("sequence_assignments")
            .update({ status: "blocked", blocked_reason: reason })
            .eq("id", existing.id);
          if (error) {
            console.error("[engine] failed to block assignment", error);
          } else {
            context.stats.assignmentsUpdated += 1;
          }
        }
      } else {
        const { data, error } = await supabase
          .from("sequence_assignments")
          .insert({
            org_id: enrollment.org_id,
            sequence_id: enrollment.sequence_id,
            sequence_version_id: enrollment.sequence_version_id,
            sequence_step_id: step.id,
            sequence_enrollment_id: enrollment.id,
            assignee_membership_id: assigneeId,
            status: "blocked",
            blocked_reason: reason,
          })
          .select("id, status, due_at, snoozed_until, done_at, overdue_at, blocked_reason")
          .single();

        if (error) {
          console.error("[engine] failed to create blocked assignment", error);
        } else if (data) {
          assignmentsByStep.set(step.id, {
            id: data.id,
            sequence_step_id: step.id,
            sequence_enrollment_id: enrollment.id,
            assignee_membership_id: assigneeId,
            status: "blocked",
            due_at: data.due_at,
            snoozed_until: data.snoozed_until,
            done_at: data.done_at,
            overdue_at: data.overdue_at,
            blocked_reason: data.blocked_reason,
          });
          context.stats.assignmentsCreated += 1;
        }
      }
      continue;
    }

    if (pauseGateActive) {
      const reason = "Aguardando etapa bloqueante";
      if (existing) {
        if (existing.status !== "blocked" || existing.blocked_reason !== reason) {
          const { error } = await supabase
            .from("sequence_assignments")
            .update({ status: "blocked", blocked_reason: reason })
            .eq("id", existing.id);
          if (error) {
            console.error("[engine] failed to block assignment por pausa", error);
          } else {
            context.stats.assignmentsUpdated += 1;
          }
        }
      } else {
        const { data, error } = await supabase
          .from("sequence_assignments")
          .insert({
            org_id: enrollment.org_id,
            sequence_id: enrollment.sequence_id,
            sequence_version_id: enrollment.sequence_version_id,
            sequence_step_id: step.id,
            sequence_enrollment_id: enrollment.id,
            assignee_membership_id: assigneeId,
            status: "blocked",
            blocked_reason: reason,
          })
          .select("id, status, due_at, snoozed_until, done_at, overdue_at, blocked_reason")
          .single();

        if (error) {
          console.error("[engine] failed to create pause blocked assignment", error);
        } else if (data) {
          assignmentsByStep.set(step.id, {
            id: data.id,
            sequence_step_id: step.id,
            sequence_enrollment_id: enrollment.id,
            assignee_membership_id: assigneeId,
            status: "blocked",
            due_at: data.due_at,
            snoozed_until: data.snoozed_until,
            done_at: data.done_at,
            overdue_at: data.overdue_at,
            blocked_reason: data.blocked_reason,
          });
          context.stats.assignmentsCreated += 1;
        }
      }
      continue;
    }

    const dueAt = computeDueDate(enrollment, step, version);

    if (!existing) {
      const { data, error } = await supabase
        .from("sequence_assignments")
        .insert({
          org_id: enrollment.org_id,
          sequence_id: enrollment.sequence_id,
          sequence_version_id: enrollment.sequence_version_id,
          sequence_step_id: step.id,
          sequence_enrollment_id: enrollment.id,
          assignee_membership_id: assigneeId,
          status: "open",
          due_at: dueAt,
        })
        .select("id, status, due_at, snoozed_until, done_at, overdue_at, blocked_reason")
        .single();

      if (error) {
        console.error("[engine] failed to create assignment", error);
      } else if (data) {
        assignmentsByStep.set(step.id, {
          id: data.id,
          sequence_step_id: step.id,
          sequence_enrollment_id: enrollment.id,
          assignee_membership_id: assigneeId,
          status: data.status,
          due_at: data.due_at ?? dueAt ?? null,
          snoozed_until: data.snoozed_until,
          done_at: data.done_at,
          overdue_at: data.overdue_at,
          blocked_reason: data.blocked_reason,
        });
        context.stats.assignmentsCreated += 1;
        if (assigneeId) {
          const inserted = await createNotification({
            orgId: enrollment.org_id,
            sequenceId: enrollment.sequence_id,
            enrollmentId: enrollment.id,
            assignmentId: data.id,
            memberId: assigneeId,
            eventType: "assignment_created",
            payload: { stepId: step.id, dueAt },
          });
          if (inserted) {
            context.stats.notificationsCreated += 1;
          }
        }
      }
    } else {
      const updates: Partial<AssignmentRow> & { status?: AssignmentRow["status"]; due_at?: string | null; blocked_reason?: string | null; snoozed_until?: string | null; overdue_at?: string | null; assignee_membership_id?: string | null } = {};
      let shouldUpdate = false;

      if (existing.status === "blocked") {
        updates.status = "open";
        updates.blocked_reason = null;
        shouldUpdate = true;
      }

      if (existing.due_at !== dueAt) {
        updates.due_at = dueAt ?? null;
        shouldUpdate = true;
      }

      if (existing.assignee_membership_id !== assigneeId) {
        updates.assignee_membership_id = assigneeId ?? null;
        shouldUpdate = true;
      }

      if (existing.status === "snoozed" && existing.snoozed_until) {
        const snoozedUntil = new Date(existing.snoozed_until);
        if (!Number.isNaN(snoozedUntil.getTime()) && snoozedUntil <= context.now) {
          updates.status = "open";
          updates.snoozed_until = null;
          shouldUpdate = true;
        }
      }

      if (existing.overdue_at) {
        const dueDate = existing.due_at ? new Date(existing.due_at) : null;
        if (dueDate && dueDate > context.now && existing.status !== "done") {
          updates.overdue_at = null;
          shouldUpdate = true;
        }
      }

      if (shouldUpdate) {
        const { error } = await supabase.from("sequence_assignments").update(updates).eq("id", existing.id);
        if (error) {
          console.error("[engine] failed to update assignment", error);
        } else {
          context.stats.assignmentsUpdated += 1;
          assignmentsByStep.set(step.id, {
            ...existing,
            ...updates,
          });
        }
      }
    }

    const refreshed = assignmentsByStep.get(step.id);
    if (refreshed && refreshed.status !== "done") {
      const dueDate = refreshed.due_at ? new Date(refreshed.due_at) : null;
      if (dueDate && dueDate <= context.now && refreshed.status !== "done") {
        if (!refreshed.overdue_at) {
          const newOverdueAt = context.now.toISOString();
          const { error } = await supabase
            .from("sequence_assignments")
            .update({ overdue_at: newOverdueAt })
            .eq("id", refreshed.id);
          if (error) {
            console.error("[engine] failed to mark overdue", error);
          } else {
            context.stats.assignmentsUpdated += 1;
            assignmentsByStep.set(step.id, {
              ...refreshed,
              overdue_at: newOverdueAt,
            });
            if (assigneeId) {
              const inserted = await createNotification({
                orgId: enrollment.org_id,
                sequenceId: enrollment.sequence_id,
                enrollmentId: enrollment.id,
                assignmentId: refreshed.id,
                memberId: assigneeId,
                eventType: "overdue",
              });
              if (inserted) {
                context.stats.notificationsCreated += 1;
              }
            }
          }
        }
      } else if (dueDate) {
        const dueDayKey = formatInTimeZone(dueDate, version.work_time_zone ?? "UTC", "yyyy-MM-dd");
        const todayKey = formatInTimeZone(context.now, version.work_time_zone ?? "UTC", "yyyy-MM-dd");
        if (dueDayKey === todayKey && assigneeId) {
          const inserted = await createNotification({
            orgId: enrollment.org_id,
            sequenceId: enrollment.sequence_id,
            enrollmentId: enrollment.id,
            assignmentId: refreshed.id,
            memberId: assigneeId,
            eventType: "due_today",
            payload: { dueAt: refreshed.due_at },
            dedupeKey: dueDayKey,
          });
          if (inserted) {
            context.stats.notificationsCreated += 1;
          }
        }
      }
    }

    const currentAssignment = assignmentsByStep.get(step.id);
    if (currentAssignment && currentAssignment.status !== "done") {
      if (step.pause_until_done) {
        pauseGateActive = true;
      }
    } else if (step.pause_until_done) {
      pauseGateActive = false;
    }
  }

  const relevantSteps = steps.filter((step) => step.is_active);
  if (relevantSteps.length > 0) {
    const allDone = relevantSteps.every((step) => {
      const assignment = assignmentsByStep.get(step.id);
      return assignment && assignment.status === "done";
    });

    if (allDone && enrollment.status !== "completed") {
      const { error } = await supabase
        .from("sequence_enrollments")
        .update({ status: "completed", completed_at: context.now.toISOString() })
        .eq("id", enrollment.id);

      if (error) {
        console.error("[engine] failed to complete enrollment", error);
      } else {
        context.stats.assignmentsUpdated += 1;
        context.stats.enrollmentsCompleted += 1;
      }
    }
  }
}

async function runEngine(input: EngineInput): Promise<EngineStats> {
  const stats: EngineStats = {
    processedEnrollments: 0,
    assignmentsCreated: 0,
    assignmentsUpdated: 0,
    notificationsCreated: 0,
    enrollmentsCompleted: 0,
  };

  const enrollmentQuery = supabase
    .from("sequence_enrollments")
    .select("id, org_id, sequence_id, sequence_version_id, status, enrolled_at, resumed_at, created_by_membership_id")
    .eq("status", "active");

  if (input.orgId) {
    enrollmentQuery.eq("org_id", input.orgId);
  }

  if (input.enrollmentIds && input.enrollmentIds.length > 0) {
    enrollmentQuery.in("id", input.enrollmentIds);
  }

  if (input.limit && input.limit > 0) {
    enrollmentQuery.limit(input.limit);
  }

  const { data: enrollments, error: enrollmentsError } = await enrollmentQuery;

  if (enrollmentsError) {
    console.error("[engine] failed to load enrollments", enrollmentsError);
    throw enrollmentsError;
  }

  if (!enrollments || enrollments.length === 0) {
    return stats;
  }

  const versionIds = Array.from(new Set(enrollments.map((row) => row.sequence_version_id)));
  const enrollmentIds = enrollments.map((row) => row.id);

  const { data: versions, error: versionsError } = await supabase
    .from("sequence_versions")
    .select("id, org_id, work_time_zone, work_days, work_start_time, work_end_time, window_clamp_enabled")
    .in("id", versionIds);

  if (versionsError) {
    console.error("[engine] failed to load versions", versionsError);
    throw versionsError;
  }

  const { data: steps, error: stepsError } = await supabase
    .from("sequence_steps")
    .select("id, sequence_version_id, step_order, is_active, dependencies, pause_until_done, due_offset_days, due_offset_hours, assignee_mode, assignee_membership_id")
    .in("sequence_version_id", versionIds)
    .order("step_order", { ascending: true });

  if (stepsError) {
    console.error("[engine] failed to load steps", stepsError);
    throw stepsError;
  }

  const { data: assignments, error: assignmentsError } = await supabase
    .from("sequence_assignments")
    .select("id, sequence_step_id, sequence_enrollment_id, assignee_membership_id, status, due_at, snoozed_until, done_at, overdue_at, blocked_reason")
    .in("sequence_enrollment_id", enrollmentIds);

  if (assignmentsError) {
    console.error("[engine] failed to load assignments", assignmentsError);
    throw assignmentsError;
  }

  const versionsMap = new Map<string, VersionRow>();
  (versions ?? []).forEach((version) => {
    versionsMap.set(version.id, version as VersionRow);
  });

  const stepsByVersion = new Map<string, StepRow[]>();
  (steps ?? []).forEach((step) => {
    const list = stepsByVersion.get(step.sequence_version_id) ?? [];
    list.push(step as StepRow);
    stepsByVersion.set(step.sequence_version_id, list);
  });

  const assignmentsByEnrollment = new Map<string, AssignmentRow[]>();
  (assignments ?? []).forEach((assignment) => {
    const list = assignmentsByEnrollment.get(assignment.sequence_enrollment_id) ?? [];
    list.push(assignment as AssignmentRow);
    assignmentsByEnrollment.set(assignment.sequence_enrollment_id, list);
  });

  const now = new Date();

  for (const enrollment of enrollments as EnrollmentRow[]) {
    stats.processedEnrollments += 1;
    await processEnrollment(enrollment, {
      versions: versionsMap,
      stepsByVersion,
      assignmentsByEnrollment,
      stats,
      now,
    });
  }

  return stats;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: EngineInput = {};
  try {
    const raw = await req.json();
    if (raw && typeof raw === "object") {
      body = raw as EngineInput;
    }
  } catch {
    body = {};
  }

  try {
    const stats = await runEngine(body);
    return new Response(JSON.stringify({ ok: true, stats }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[engine] execution failed", error);
    return new Response(JSON.stringify({ error: "Failed to run engine" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
