import type {
  SequenceManagerFilters,
  SequenceManagerItem,
  SequenceManagerRow,
  SequenceStatus,
  SequenceTargetType,
} from "./types";

function parseNumber(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return 0;
}

export function normalizeSequenceManagerRow(row: SequenceManagerRow): SequenceManagerItem {
  return {
    id: row.sequence_id,
    orgId: row.org_id,
    name: row.name,
    status: row.status,
    targetType: row.default_target_type,
    activeVersionNumber: row.active_version_number ?? 0,
    stepsTotal: row.steps_total ?? 0,
    activeEnrollments: row.active_enrollments ?? 0,
    completionRate: parseNumber(row.completion_rate),
    lastActivationAt: row.last_activation_at,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

function matchesSearch(item: SequenceManagerItem, term: string) {
  if (!term) {
    return true;
  }

  const normalizedTerm = term.trim().toLowerCase();
  if (!normalizedTerm) {
    return true;
  }

  return (
    item.name.toLowerCase().includes(normalizedTerm) ||
    item.status.toLowerCase().includes(normalizedTerm) ||
    item.targetType.toLowerCase().includes(normalizedTerm)
  );
}

function matchesStatus(item: SequenceManagerItem, status: SequenceStatus | "todos") {
  if (status === "todos") {
    return true;
  }

  return item.status === status;
}

function matchesTarget(item: SequenceManagerItem, target: SequenceTargetType | "todos") {
  if (target === "todos") {
    return true;
  }

  return item.targetType === target;
}

export function filterSequences(items: SequenceManagerItem[], filters: SequenceManagerFilters) {
  return items
    .filter((item) => matchesSearch(item, filters.search))
    .filter((item) => matchesStatus(item, filters.status))
    .filter((item) => matchesTarget(item, filters.targetType));
}
