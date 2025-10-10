export type SequenceStatus = "draft" | "active" | "paused" | "archived";
export type SequenceTargetType = "contact" | "member";

export type SequenceManagerCreatorRow = {
  membership_id: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type SequenceManagerRow = {
  sequence_id: string;
  org_id: string;
  name: string;
  status: SequenceStatus;
  is_active: boolean;
  default_target_type: SequenceTargetType;
  active_version_number: number | null;
  steps_total: number | null;
  active_enrollments: number | null;
  completion_rate: string | number | null;
  total_enrollments?: number | null;
  open_rate?: string | number | null;
  reply_rate?: string | number | null;
  click_rate?: string | number | null;
  estimated_days?: number | null;
  created_by?: SequenceManagerCreatorRow | null;
  board_name?: string | null;
  last_activation_at: string | null;
  updated_at: string;
  created_at: string;
};

export type SequenceManagerCreator = {
  membershipId: string | null;
  name: string;
  avatarUrl: string | null;
};

export type SequenceManagerItem = {
  id: string;
  orgId: string;
  name: string;
  status: SequenceStatus;
  isActive: boolean;
  targetType: SequenceTargetType;
  activeVersionNumber: number;
  stepsTotal: number;
  activeEnrollments: number;
  totalEnrollments?: number | null;
  durationDays?: number | null;
  openRate?: number | null;
  replyRate?: number | null;
  clickRate?: number | null;
  createdBy?: {
    id?: string;
    name: string;
    avatarUrl?: string | null;
  } | null;
  completionRate: number;
  totalEnrollments: number;
  openRate: number | null;
  replyRate: number | null;
  clickRate: number | null;
  estimatedDays: number | null;
  creator: SequenceManagerCreator | null;
  boardName: string | null;
  lastActivationAt: string | null;
  updatedAt: string;
  createdAt: string;
};

export type SequenceManagerFilters = {
  search: string;
  status: SequenceStatus | "todos";
  targetType: SequenceTargetType | "todos";
};
