export type AssignmentStatus = "open" | "snoozed" | "done" | "blocked";
export type MyTasksFilter = "todos" | "abertas" | "atrasadas" | "bloqueadas" | "adiadas";

export type MyTaskRow = {
  assignment_id: string;
  org_id: string;
  sequence_id: string;
  sequence_version_id: string;
  sequence_step_id: string;
  sequence_enrollment_id: string;
  assignee_membership_id: string | null;
  status: AssignmentStatus;
  due_at: string | null;
  snoozed_until: string | null;
  done_at: string | null;
  overdue_at: string | null;
  blocked_reason: string | null;
  is_overdue: boolean;
  is_snoozed: boolean;
  is_blocked: boolean;
  sequence_name: string;
  step_title: string;
  target_type: "contact" | "member";
  target_id: string;
  enrollment_status: string;
};

export type MyTaskItem = {
  id: string;
  orgId: string;
  sequenceId: string;
  sequenceName: string;
  stepTitle: string;
  status: AssignmentStatus;
  dueAt: string | null;
  snoozedUntil: string | null;
  doneAt: string | null;
  overdueAt: string | null;
  blockedReason: string | null;
  isOverdue: boolean;
  isSnoozed: boolean;
  isBlocked: boolean;
  targetType: "contact" | "member";
  targetId: string;
  enrollmentStatus: string;
};
