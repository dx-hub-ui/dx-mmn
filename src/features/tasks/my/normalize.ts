import type { AssignmentStatus, MyTaskItem, MyTaskRow, MyTasksFilter } from "./types";

export function normalizeMyTaskRow(row: MyTaskRow): MyTaskItem {
  return {
    id: row.assignment_id,
    orgId: row.org_id,
    sequenceId: row.sequence_id,
    sequenceVersionId: row.sequence_version_id,
    stepId: row.sequence_step_id,
    enrollmentId: row.sequence_enrollment_id,
    sequenceName: row.sequence_name,
    stepTitle: row.step_title,
    stepDescription: row.step_short_description,
    priority: row.step_priority,
    tags: row.step_tags ?? [],
    status: row.status,
    dueAt: row.due_at,
    snoozedUntil: row.snoozed_until,
    doneAt: row.done_at,
    overdueAt: row.overdue_at,
    blockedReason: row.blocked_reason,
    isOverdue: row.is_overdue,
    isSnoozed: row.is_snoozed,
    isBlocked: row.is_blocked,
    targetType: row.target_type,
    targetId: row.target_id,
    enrollmentStatus: row.enrollment_status,
  };
}

export function filterTasks(tasks: MyTaskItem[], filter: MyTasksFilter) {
  switch (filter) {
    case "abertas":
      return tasks.filter((task) => task.status === "open");
    case "atrasadas":
      return tasks.filter((task) => task.isOverdue && task.status !== "done");
    case "bloqueadas":
      return tasks.filter((task) => task.isBlocked);
    case "adiadas":
      return tasks.filter((task) => task.isSnoozed);
    default:
      return tasks;
  }
}

export function statusLabel(status: AssignmentStatus) {
  switch (status) {
    case "open":
      return "Em aberto";
    case "snoozed":
      return "Adiado";
    case "done":
      return "Concluído";
    case "blocked":
      return "Bloqueado";
    default:
      return status;
  }
}
