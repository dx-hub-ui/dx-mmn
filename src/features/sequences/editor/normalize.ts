import type {
  SequenceEditorData,
  SequenceEnrollmentRecord,
  SequenceEnrollmentRow,
  SequenceRecord,
  SequenceRow,
  SequenceStepRecord,
  SequenceStepRow,
  SequenceVersionRecord,
  SequenceVersionRow,
} from "./types";

export function normalizeSequenceRow(row: SequenceRow): SequenceRecord {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    description: row.description,
    status: row.status,
    isActive: row.is_active,
    defaultTargetType: row.default_target_type,
    activeVersionId: row.active_version_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normalizeSequenceVersionRow(row: SequenceVersionRow): SequenceVersionRecord {
  return {
    id: row.id,
    sequenceId: row.sequence_id,
    orgId: row.org_id,
    versionNumber: row.version_number,
    status: row.status,
    onPublish: row.on_publish,
    workTimeZone: row.work_time_zone,
    workDays: row.work_days ?? [],
    workStartTime: row.work_start_time,
    workEndTime: row.work_end_time,
    cooldownDays: row.cooldown_days,
    cooldownHours: row.cooldown_hours,
    windowClampEnabled: row.window_clamp_enabled,
    notes: row.notes,
    createdAt: row.created_at,
    publishedAt: row.published_at,
  };
}

export function normalizeSequenceStepRow(row: SequenceStepRow): SequenceStepRecord {
  return {
    id: row.id,
    versionId: row.sequence_version_id,
    orgId: row.org_id,
    order: row.step_order,
    title: row.title,
    shortDescription: row.short_description,
    body: row.body,
    type: row.step_type,
    assigneeMode: row.assignee_mode,
    assigneeMembershipId: row.assignee_membership_id,
    dueOffsetDays: row.due_offset_days,
    dueOffsetHours: row.due_offset_hours,
    priority: row.priority,
    tags: row.tags ?? [],
    checklist: row.checklist,
    dependencies: row.dependencies ?? [],
    channelHint: row.channel_hint,
    isActive: row.is_active,
    pauseUntilDone: row.pause_until_done,
    createdAt: row.created_at,
  };
}

export function normalizeSequenceEnrollmentRow(row: SequenceEnrollmentRow): SequenceEnrollmentRecord {
  return {
    id: row.id,
    orgId: row.org_id,
    sequenceId: row.sequence_id,
    versionId: row.sequence_version_id,
    targetType: row.target_type,
    targetId: row.target_id,
    status: row.status,
    enrolledAt: row.enrolled_at,
    pausedAt: row.paused_at,
    resumedAt: row.resumed_at,
    completedAt: row.completed_at,
    terminatedAt: row.terminated_at,
    cooldownUntil: row.cooldown_until,
  };
}

export function composeSequenceEditorData({
  sequence,
  versions,
  steps,
  enrollments,
}: {
  sequence: SequenceRow;
  versions: SequenceVersionRow[];
  steps: SequenceStepRow[];
  enrollments: SequenceEnrollmentRow[];
}): SequenceEditorData {
  const normalizedVersions = versions
    .map(normalizeSequenceVersionRow)
    .sort((a, b) => b.versionNumber - a.versionNumber);

  const currentVersion =
    normalizedVersions.find((version) => version.status === "draft") ?? normalizedVersions.at(0) ?? null;

  return {
    sequence: normalizeSequenceRow(sequence),
    versions: normalizedVersions,
    currentVersion,
    steps: steps.map(normalizeSequenceStepRow).sort((a, b) => a.order - b.order),
    enrollments: enrollments
      .map(normalizeSequenceEnrollmentRow)
      .sort((a, b) => new Date(b.enrolledAt).getTime() - new Date(a.enrolledAt).getTime()),
  };
}
