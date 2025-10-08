export type SequenceStatus = "draft" | "active" | "paused" | "archived";
export type SequenceTargetType = "contact" | "member";

export type SequenceManagerRow = {
  sequence_id: string;
  org_id: string;
  name: string;
  status: SequenceStatus;
  default_target_type: SequenceTargetType;
  active_version_number: number | null;
  steps_total: number | null;
  active_enrollments: number | null;
  completion_rate: string | number | null;
  last_activation_at: string | null;
  updated_at: string;
  created_at: string;
};

export type SequenceManagerItem = {
  id: string;
  orgId: string;
  name: string;
  status: SequenceStatus;
  targetType: SequenceTargetType;
  activeVersionNumber: number;
  stepsTotal: number;
  activeEnrollments: number;
  completionRate: number;
  lastActivationAt: string | null;
  updatedAt: string;
  createdAt: string;
};

export type SequenceManagerFilters = {
  search: string;
  status: SequenceStatus | "todos";
  targetType: SequenceTargetType | "todos";
};
