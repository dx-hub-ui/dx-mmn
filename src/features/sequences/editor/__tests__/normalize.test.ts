import { describe, expect, it } from "vitest";
import {
  composeSequenceEditorData,
  normalizeSequenceEnrollmentRow,
  normalizeSequenceRow,
  normalizeSequenceStepRow,
  normalizeSequenceVersionRow,
} from "../normalize";
import type {
  SequenceEnrollmentRow,
  SequenceRow,
  SequenceStepRow,
  SequenceVersionRow,
} from "../types";

describe("normalizeSequenceRow", () => {
  it("normaliza campos de sequência básica", () => {
    const row: SequenceRow = {
      id: "seq-1",
      org_id: "org-1",
      name: "Onboarding",
      description: "Fluxo inicial",
      status: "draft",
      is_active: false,
      default_target_type: "contact",
      active_version_id: "ver-1",
      created_at: "2024-05-10T12:00:00.000Z",
      updated_at: "2024-05-11T12:00:00.000Z",
    };

    expect(normalizeSequenceRow(row)).toEqual({
      id: "seq-1",
      orgId: "org-1",
      name: "Onboarding",
      description: "Fluxo inicial",
      status: "draft",
      isActive: false,
      defaultTargetType: "contact",
      activeVersionId: "ver-1",
      createdAt: "2024-05-10T12:00:00.000Z",
      updatedAt: "2024-05-11T12:00:00.000Z",
    });
  });
});

describe("normalizeSequenceVersionRow", () => {
  it("mantém informações principais", () => {
    const row: SequenceVersionRow = {
      id: "ver-1",
      sequence_id: "seq-1",
      org_id: "org-1",
      version_number: 2,
      status: "draft",
      on_publish: "terminate",
      work_time_zone: "America/Sao_Paulo",
      work_days: [1, 2, 3, 4, 5],
      work_start_time: "09:00:00",
      work_end_time: "18:00:00",
      cooldown_days: 1,
      cooldown_hours: 4,
      window_clamp_enabled: true,
      notes: "Apenas testar",
      created_at: "2024-05-10T12:00:00.000Z",
      published_at: null,
    };

    expect(normalizeSequenceVersionRow(row)).toEqual({
      id: "ver-1",
      sequenceId: "seq-1",
      orgId: "org-1",
      versionNumber: 2,
      status: "draft",
      onPublish: "terminate",
      workTimeZone: "America/Sao_Paulo",
      workDays: [1, 2, 3, 4, 5],
      workStartTime: "09:00:00",
      workEndTime: "18:00:00",
      cooldownDays: 1,
      cooldownHours: 4,
      windowClampEnabled: true,
      notes: "Apenas testar",
      createdAt: "2024-05-10T12:00:00.000Z",
      publishedAt: null,
    });
  });
});

describe("normalizeSequenceStepRow", () => {
  it("converte campos opcionais com valores padrão", () => {
    const row: SequenceStepRow = {
      id: "step-1",
      sequence_version_id: "ver-1",
      org_id: "org-1",
      step_order: 1,
      title: "Enviar boas-vindas",
      short_description: null,
      body: null,
      step_type: "general_task",
      assignee_mode: "owner",
      assignee_membership_id: null,
      due_offset_days: 1,
      due_offset_hours: 2,
      priority: null,
      tags: null,
      checklist: null,
      dependencies: null,
      channel_hint: null,
      is_active: true,
      pause_until_done: false,
      created_at: "2024-05-10T12:00:00.000Z",
    };

    expect(normalizeSequenceStepRow(row)).toEqual({
      id: "step-1",
      versionId: "ver-1",
      orgId: "org-1",
      order: 1,
      title: "Enviar boas-vindas",
      shortDescription: null,
      body: null,
      type: "general_task",
      assigneeMode: "owner",
      assigneeMembershipId: null,
      dueOffsetDays: 1,
      dueOffsetHours: 2,
      priority: null,
      tags: [],
      checklist: null,
      dependencies: [],
      channelHint: null,
      isActive: true,
      pauseUntilDone: false,
      createdAt: "2024-05-10T12:00:00.000Z",
    });
  });
});

describe("normalizeSequenceEnrollmentRow", () => {
  it("mapeia campos de inscrição", () => {
    const row: SequenceEnrollmentRow = {
      id: "enr-1",
      org_id: "org-1",
      sequence_id: "seq-1",
      sequence_version_id: "ver-1",
      target_type: "contact",
      target_id: "cont-1",
      status: "active",
      enrolled_at: "2024-05-10T12:00:00.000Z",
      paused_at: null,
      resumed_at: null,
      completed_at: null,
      terminated_at: null,
      cooldown_until: null,
      dedupe_key: "seq-1|contact|cont-1",
    };

    expect(normalizeSequenceEnrollmentRow(row)).toEqual({
      id: "enr-1",
      orgId: "org-1",
      sequenceId: "seq-1",
      versionId: "ver-1",
      targetType: "contact",
      targetId: "cont-1",
      status: "active",
      enrolledAt: "2024-05-10T12:00:00.000Z",
      pausedAt: null,
      resumedAt: null,
      completedAt: null,
      terminatedAt: null,
      cooldownUntil: null,
    });
  });
});

describe("composeSequenceEditorData", () => {
  it("ordena versões, passos e inscrições e prioriza rascunho", () => {
    const sequence: SequenceRow = {
      id: "seq-1",
      org_id: "org-1",
      name: "Onboarding",
      description: null,
      status: "draft",
      is_active: false,
      default_target_type: "contact",
      active_version_id: null,
      created_at: "2024-05-10T12:00:00.000Z",
      updated_at: "2024-05-10T12:00:00.000Z",
    };

    const versions: SequenceVersionRow[] = [
      {
        id: "ver-1",
        sequence_id: "seq-1",
        org_id: "org-1",
        version_number: 1,
        status: "published",
        on_publish: "terminate",
        work_time_zone: "America/Sao_Paulo",
        work_days: [1, 2, 3, 4, 5],
        work_start_time: "09:00:00",
        work_end_time: "18:00:00",
        cooldown_days: 0,
        cooldown_hours: 0,
        window_clamp_enabled: true,
        notes: null,
        created_at: "2024-05-10T12:00:00.000Z",
        published_at: "2024-05-10T13:00:00.000Z",
      },
      {
        id: "ver-2",
        sequence_id: "seq-1",
        org_id: "org-1",
        version_number: 2,
        status: "draft",
        on_publish: "terminate",
        work_time_zone: "America/Sao_Paulo",
        work_days: [1, 2, 3, 4, 5],
        work_start_time: "09:00:00",
        work_end_time: "18:00:00",
        cooldown_days: 0,
        cooldown_hours: 0,
        window_clamp_enabled: true,
        notes: null,
        created_at: "2024-05-11T12:00:00.000Z",
        published_at: null,
      },
    ];

    const steps: SequenceStepRow[] = [
      {
        id: "step-2",
        sequence_version_id: "ver-2",
        org_id: "org-1",
        step_order: 2,
        title: "Ligar para cliente",
        short_description: null,
        body: null,
        step_type: "call_task",
        assignee_mode: "owner",
        assignee_membership_id: null,
        due_offset_days: 2,
        due_offset_hours: 0,
        priority: "Alta",
        tags: ["ligações"],
        checklist: null,
        dependencies: ["step-1"],
        channel_hint: "telefone",
        is_active: true,
        pause_until_done: true,
        created_at: "2024-05-11T12:00:00.000Z",
      },
      {
        id: "step-1",
        sequence_version_id: "ver-2",
        org_id: "org-1",
        step_order: 1,
        title: "Enviar e-mail",
        short_description: null,
        body: null,
        step_type: "general_task",
        assignee_mode: "owner",
        assignee_membership_id: null,
        due_offset_days: 0,
        due_offset_hours: 6,
        priority: "Normal",
        tags: [],
        checklist: null,
        dependencies: [],
        channel_hint: "email",
        is_active: true,
        pause_until_done: false,
        created_at: "2024-05-11T12:00:00.000Z",
      },
    ];

    const enrollments: SequenceEnrollmentRow[] = [
      {
        id: "enr-1",
        org_id: "org-1",
        sequence_id: "seq-1",
        sequence_version_id: "ver-2",
        target_type: "contact",
        target_id: "cont-1",
        status: "active",
        enrolled_at: "2024-05-12T10:00:00.000Z",
        paused_at: null,
        resumed_at: null,
        completed_at: null,
        terminated_at: null,
        cooldown_until: null,
        dedupe_key: "seq-1|contact|cont-1",
      },
      {
        id: "enr-2",
        org_id: "org-1",
        sequence_id: "seq-1",
        sequence_version_id: "ver-2",
        target_type: "member",
        target_id: "mem-1",
        status: "paused",
        enrolled_at: "2024-05-13T10:00:00.000Z",
        paused_at: "2024-05-14T10:00:00.000Z",
        resumed_at: null,
        completed_at: null,
        terminated_at: null,
        cooldown_until: null,
        dedupe_key: "seq-1|member|mem-1",
      },
    ];

    const data = composeSequenceEditorData({ sequence, versions, steps, enrollments });

    expect(data.currentVersion?.id).toBe("ver-2");
    expect(data.versions.map((version) => version.versionNumber)).toEqual([2, 1]);
    expect(data.steps.map((step) => step.id)).toEqual(["step-1", "step-2"]);
    expect(data.enrollments.map((enrollment) => enrollment.id)).toEqual(["enr-2", "enr-1"]);
  });
});
