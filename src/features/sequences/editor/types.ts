export type SequenceTargetType = "contact" | "member";
export type SequenceStatus = "draft" | "active" | "paused" | "archived";
export type SequenceVersionStatus = "draft" | "published" | "archived";
export type SequencePublishStrategy = "terminate" | "migrate";
export type SequenceStepType = "general_task" | "call_task";
export type SequenceEnrollmentStatus = "active" | "paused" | "completed" | "terminated";
export type SequenceAssignmentStatus = "open" | "snoozed" | "done" | "blocked";
export type SequenceAssigneeMode = "owner" | "org" | "custom";

export type SequenceRow = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  status: SequenceStatus;
  is_active: boolean;
  default_target_type: SequenceTargetType;
  active_version_id: string | null;
  created_at: string;
  updated_at: string;
};

export type SequenceVersionRow = {
  id: string;
  sequence_id: string;
  org_id: string;
  version_number: number;
  status: SequenceVersionStatus;
  on_publish: SequencePublishStrategy;
  work_time_zone: string;
  work_days: number[];
  work_start_time: string;
  work_end_time: string;
  cooldown_days: number;
  cooldown_hours: number;
  window_clamp_enabled: boolean;
  notes: string | null;
  created_at: string;
  published_at: string | null;
};

export type SequenceStepRow = {
  id: string;
  sequence_version_id: string;
  org_id: string;
  step_order: number;
  title: string;
  short_description: string | null;
  body: unknown;
  step_type: SequenceStepType;
  assignee_mode: SequenceAssigneeMode;
  assignee_membership_id: string | null;
  due_offset_days: number;
  due_offset_hours: number;
  priority: string | null;
  tags: string[] | null;
  checklist: unknown;
  dependencies: string[] | null;
  channel_hint: string | null;
  is_active: boolean;
  pause_until_done: boolean;
  created_at: string;
};

export type SequenceEnrollmentRow = {
  id: string;
  org_id: string;
  sequence_id: string;
  sequence_version_id: string;
  target_type: SequenceTargetType;
  target_id: string;
  status: SequenceEnrollmentStatus;
  enrolled_at: string;
  paused_at: string | null;
  resumed_at: string | null;
  completed_at: string | null;
  terminated_at: string | null;
  cooldown_until: string | null;
  dedupe_key: string;
};

export type SequenceRecord = {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  status: SequenceStatus;
  isActive: boolean;
  defaultTargetType: SequenceTargetType;
  activeVersionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SequenceVersionRecord = {
  id: string;
  sequenceId: string;
  orgId: string;
  versionNumber: number;
  status: SequenceVersionStatus;
  onPublish: SequencePublishStrategy;
  workTimeZone: string;
  workDays: number[];
  workStartTime: string;
  workEndTime: string;
  cooldownDays: number;
  cooldownHours: number;
  windowClampEnabled: boolean;
  notes: string | null;
  createdAt: string;
  publishedAt: string | null;
};

export type SequenceStepRecord = {
  id: string;
  versionId: string;
  orgId: string;
  order: number;
  title: string;
  shortDescription: string | null;
  body: unknown;
  type: SequenceStepType;
  assigneeMode: SequenceAssigneeMode;
  assigneeMembershipId: string | null;
  dueOffsetDays: number;
  dueOffsetHours: number;
  priority: string | null;
  tags: string[];
  checklist: unknown;
  dependencies: string[];
  channelHint: string | null;
  isActive: boolean;
  pauseUntilDone: boolean;
  createdAt: string;
};

export type SequenceEnrollmentRecord = {
  id: string;
  orgId: string;
  sequenceId: string;
  versionId: string;
  targetType: SequenceTargetType;
  targetId: string;
  status: SequenceEnrollmentStatus;
  enrolledAt: string;
  pausedAt: string | null;
  resumedAt: string | null;
  completedAt: string | null;
  terminatedAt: string | null;
  cooldownUntil: string | null;
};

export type SequenceEditorData = {
  sequence: SequenceRecord;
  versions: SequenceVersionRecord[];
  currentVersion: SequenceVersionRecord | null;
  steps: SequenceStepRecord[];
  enrollments: SequenceEnrollmentRecord[];
};

export type StepFormInput = {
  id?: string;
  title: string;
  shortDescription: string;
  type: SequenceStepType;
  assigneeMode: SequenceAssigneeMode;
  assigneeMembershipId?: string | null;
  dueOffsetDays: number;
  dueOffsetHours: number;
  priority: string;
  tags: string[];
  channelHint: string;
  pauseUntilDone: boolean;
  isActive: boolean;
};

export type EnrollmentActionResult = {
  enrollmentId: string;
  status: SequenceEnrollmentStatus;
};
