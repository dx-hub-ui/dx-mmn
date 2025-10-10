import { describe, expect, it } from "vitest";
import { filterSequences, normalizeSequenceManagerRow } from "../normalize";
import type { SequenceManagerFilters, SequenceManagerRow } from "../types";

const BASE_ROW: SequenceManagerRow = {
  sequence_id: "seq-1",
  org_id: "org-1",
  name: "Boas-vindas",
  status: "active",
  is_active: true,
  default_target_type: "contact",
  active_version_number: 2,
  steps_total: 4,
  active_enrollments: 3,
  completion_rate: "87.50",
  last_activation_at: "2024-05-10T12:00:00.000Z",
  updated_at: "2024-05-10T12:00:00.000Z",
  created_at: "2024-05-01T12:00:00.000Z",
};

describe("normalizeSequenceManagerRow", () => {
  it("converte valores do Supabase para o formato interno", () => {
    const item = normalizeSequenceManagerRow(BASE_ROW);

    expect(item).toEqual({
      id: "seq-1",
      orgId: "org-1",
      name: "Boas-vindas",
      status: "active",
      isActive: true,
      targetType: "contact",
      activeVersionNumber: 2,
      stepsTotal: 4,
      activeEnrollments: 3,
      totalEnrollments: 3,
      durationDays: null,
      openRate: null,
      replyRate: null,
      clickRate: null,
      createdBy: null,
      completionRate: 87.5,
      lastActivationAt: "2024-05-10T12:00:00.000Z",
      updatedAt: "2024-05-10T12:00:00.000Z",
      createdAt: "2024-05-01T12:00:00.000Z",
    });
  });

  it("retorna zero para números inválidos", () => {
    const item = normalizeSequenceManagerRow({ ...BASE_ROW, completion_rate: null });
    expect(item.completionRate).toBe(0);
  });
});

describe("filterSequences", () => {
  const items = [
    normalizeSequenceManagerRow(BASE_ROW),
    normalizeSequenceManagerRow({
      ...BASE_ROW,
      sequence_id: "seq-2",
      name: "Reativação",
      status: "paused",
      is_active: false,
      default_target_type: "member",
    }),
  ];

  it("filtra por busca, status e alvo", () => {
    const filters: SequenceManagerFilters = {
      search: "reat",
      status: "paused",
      targetType: "member",
    };

    const result = filterSequences(items, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("seq-2");
  });

  it("retorna todos quando filtros genéricos são usados", () => {
    const filters: SequenceManagerFilters = {
      search: "",
      status: "todos",
      targetType: "todos",
    };

    const result = filterSequences(items, filters);
    expect(result).toHaveLength(2);
  });

  it("ignora status e alvo na busca textual", () => {
    const filters: SequenceManagerFilters = {
      search: "paused",
      status: "todos",
      targetType: "todos",
    };

    const result = filterSequences(items, filters);
    expect(result).toHaveLength(0);
  });
});
