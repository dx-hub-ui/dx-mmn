import { describe, expect, it } from "vitest";
import { filterTasks, normalizeMyTaskRow, statusLabel } from "../normalize";
import type { MyTaskRow } from "../types";

const BASE_ROW: MyTaskRow = {
  assignment_id: "assign-1",
  org_id: "org-1",
  sequence_id: "seq-1",
  sequence_version_id: "ver-1",
  sequence_step_id: "step-1",
  sequence_enrollment_id: "enroll-1",
  assignee_membership_id: "member-1",
  status: "open",
  due_at: "2024-05-11T10:00:00.000Z",
  snoozed_until: null,
  done_at: null,
  overdue_at: null,
  blocked_reason: null,
  is_overdue: false,
  is_snoozed: false,
  is_blocked: false,
  sequence_name: "Boas-vindas",
  step_title: "Ligar para o contato",
  step_short_description: "Conecte-se com o lead em até 24h",
  step_priority: "alta",
  step_tags: ["prioritário"],
  target_type: "contact",
  target_id: "contact-1",
  enrollment_status: "active",
};

describe("normalizeMyTaskRow", () => {
  it("normaliza a linha do Supabase", () => {
    const task = normalizeMyTaskRow(BASE_ROW);
    expect(task).toMatchObject({
      id: "assign-1",
      sequenceName: "Boas-vindas",
      stepTitle: "Ligar para o contato",
      stepDescription: "Conecte-se com o lead em até 24h",
      priority: "alta",
      tags: ["prioritário"],
      status: "open",
      isOverdue: false,
      isSnoozed: false,
    });
  });
});

describe("filterTasks", () => {
  const tasks = [
    normalizeMyTaskRow(BASE_ROW),
    normalizeMyTaskRow({
      ...BASE_ROW,
      assignment_id: "assign-2",
      status: "blocked",
      is_blocked: true,
    }),
    normalizeMyTaskRow({
      ...BASE_ROW,
      assignment_id: "assign-3",
      status: "snoozed",
      is_snoozed: true,
    }),
    normalizeMyTaskRow({
      ...BASE_ROW,
      assignment_id: "assign-4",
      is_overdue: true,
    }),
  ];

  it("retorna apenas abertos", () => {
    const result = filterTasks(tasks, "abertas");
    expect(result).toHaveLength(2);
    expect(result.map((task) => task.id)).toEqual(["assign-1", "assign-4"]);
  });

  it("retorna atrasados", () => {
    const result = filterTasks(tasks, "atrasadas");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("assign-4");
  });

  it("retorna bloqueados", () => {
    const result = filterTasks(tasks, "bloqueadas");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("assign-2");
  });

  it("retorna adiados", () => {
    const result = filterTasks(tasks, "adiadas");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("assign-3");
  });
});

describe("statusLabel", () => {
  it("mapa nomes em português", () => {
    expect(statusLabel("open")).toBe("Em aberto");
    expect(statusLabel("snoozed")).toBe("Adiado");
    expect(statusLabel("done")).toBe("Concluído");
    expect(statusLabel("blocked")).toBe("Bloqueado");
  });
});
