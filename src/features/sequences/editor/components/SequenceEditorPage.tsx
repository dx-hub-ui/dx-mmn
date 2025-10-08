"use client";

import { type FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Button } from "@vibe/core";
import { trackEvent } from "@/lib/telemetry";
import { useSentrySequenceScope } from "@/lib/observability/sentryClient";
import { calculateDueDate } from "../dates";
import type {
  SequenceEditorData,
  SequenceStepRecord,
  SequenceTargetType,
} from "../types";
import {
  deleteSequenceStepAction,
  duplicateSequenceStepAction,
  enrollTargetsAction,
  pauseEnrollmentAction,
  publishSequenceVersionAction,
  removeEnrollmentAction,
  reorderSequenceStepsAction,
  resumeEnrollmentAction,
  toggleSequenceStepAction,
  updateSequenceVersionRulesAction,
  upsertSequenceStepAction,
} from "@/app/(app)/sequences/actions";
import styles from "./sequence-editor.module.css";

type SequenceEditorPageProps = {
  orgId: string;
  membershipId: string;
  membershipRole: "org" | "leader" | "rep";
  data: SequenceEditorData;
};

type TabKey = "passos" | "regras" | "inscricoes";

type StepModalState = {
  mode: "create" | "edit";
  step?: SequenceStepRecord;
};

type SortableStepProps = {
  step: SequenceStepRecord;
  onEdit: (step: SequenceStepRecord) => void;
  onDuplicate: (step: SequenceStepRecord) => void;
  onDelete: (step: SequenceStepRecord) => void;
  onToggle: (step: SequenceStepRecord, isActive: boolean) => void;
};

function SortableStep({ step, onEdit, onDuplicate, onDelete, onToggle }: SortableStepProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: step.id });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
  };

  const typeLabel: Record<SequenceStepRecord["type"], string> = {
    general_task: "Tarefa geral",
    call_task: "Tarefa de ligação",
  };

  return (
    <article ref={setNodeRef} style={style} className={styles.stepCard} data-inactive={step.isActive ? undefined : "true"}>
      <header className={styles.stepHeader}>
        <div>
          <h3>{step.title}</h3>
          <span>{typeLabel[step.type]}</span>
        </div>
        <button type="button" className={styles.dragHandle} aria-label="Reordenar passo" {...attributes} {...listeners}>
          ☰
        </button>
      </header>

      <div className={styles.stepMeta}>
        <span>
          Vencimento em {step.dueOffsetDays} dia(s) e {step.dueOffsetHours} hora(s)
        </span>
        <span>Responsável: {step.assigneeMode === "owner" ? "Dono do contato" : step.assigneeMode === "org" ? "Organização" : "Personalizado"}</span>
        {step.channelHint ? <span>Canal sugerido: {step.channelHint}</span> : null}
        {step.pauseUntilDone ? <span>Bloqueia sequência até concluir</span> : null}
      </div>

      <div className={styles.stepActions}>
        <Button onClick={() => onEdit(step)}>Editar</Button>
        <Button kind={Button.kinds.SECONDARY} onClick={() => onDuplicate(step)}>
          Duplicar
        </Button>
        <Button
          kind={Button.kinds.SECONDARY}
          onClick={() => onToggle(step, !step.isActive)}
        >
          {step.isActive ? "Desativar" : "Ativar"}
        </Button>
        <Button kind={Button.kinds.TERTIARY} onClick={() => onDelete(step)}>
          Remover
        </Button>
      </div>
    </article>
  );
}

type StepModalProps = {
  open: boolean;
  state: StepModalState | null;
  onClose: () => void;
  onSubmit: (values: {
    id?: string;
    title: string;
    shortDescription: string;
    type: SequenceStepRecord["type"];
    assigneeMode: SequenceStepRecord["assigneeMode"];
    dueOffsetDays: number;
    dueOffsetHours: number;
    priority: string;
    channelHint: string;
    pauseUntilDone: boolean;
    isActive: boolean;
  }) => Promise<void>;
  pending: boolean;
};

function StepModal({ open, state, onClose, onSubmit, pending }: StepModalProps) {
  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [type, setType] = useState<SequenceStepRecord["type"]>("general_task");
  const [assigneeMode, setAssigneeMode] = useState<SequenceStepRecord["assigneeMode"]>("owner");
  const [dueDays, setDueDays] = useState(0);
  const [dueHours, setDueHours] = useState(0);
  const [priority, setPriority] = useState("Normal");
  const [channelHint, setChannelHint] = useState("");
  const [pauseUntilDone, setPauseUntilDone] = useState(false);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (state?.step) {
      const step = state.step;
      setTitle(step.title);
      setShortDescription(step.shortDescription ?? "");
      setType(step.type);
      setAssigneeMode(step.assigneeMode);
      setDueDays(step.dueOffsetDays);
      setDueHours(step.dueOffsetHours);
      setPriority(step.priority ?? "Normal");
      setChannelHint(step.channelHint ?? "");
      setPauseUntilDone(step.pauseUntilDone);
      setIsActive(step.isActive);
    } else {
      setTitle("");
      setShortDescription("");
      setType("general_task");
      setAssigneeMode("owner");
      setDueDays(0);
      setDueHours(0);
      setPriority("Normal");
      setChannelHint("");
      setPauseUntilDone(false);
      setIsActive(true);
    }
  }, [open, state]);

  if (!open || !state) {
    return null;
  }

  return (
    <div className={styles.modalOverlay} role="presentation" onMouseDown={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="step-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h2 id="step-dialog-title">
            {state.mode === "create" ? "Novo passo" : "Editar passo"}
          </h2>
          <Button kind={Button.kinds.TERTIARY} onClick={onClose}>
            Fechar
          </Button>
        </div>

        <form
          className={styles.formGrid}
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmit({
              id: state.step?.id,
              title,
              shortDescription,
              type,
              assigneeMode,
              dueOffsetDays: Number.isFinite(dueDays) ? dueDays : 0,
              dueOffsetHours: Number.isFinite(dueHours) ? dueHours : 0,
              priority,
              channelHint,
              pauseUntilDone,
              isActive,
            });
          }}
        >
          <div className={styles.formGridTwoColumns}>
            <div className={styles.formField}>
              <label htmlFor="step-title">Título</label>
              <input
                id="step-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            </div>
            <div className={styles.formField}>
              <label htmlFor="step-type">Tipo</label>
              <select
                id="step-type"
                value={type}
                onChange={(event) => setType(event.target.value as SequenceStepRecord["type"])}
              >
                <option value="general_task">Tarefa geral</option>
                <option value="call_task">Tarefa de ligação</option>
              </select>
            </div>
            <div className={styles.formField}>
              <label htmlFor="step-assignee">Responsável</label>
              <select
                id="step-assignee"
                value={assigneeMode}
                onChange={(event) => setAssigneeMode(event.target.value as SequenceStepRecord["assigneeMode"])}
              >
                <option value="owner">Dono do contato</option>
                <option value="org">Organização</option>
                <option value="custom">Personalizado</option>
              </select>
            </div>
            <div className={styles.formField}>
              <label htmlFor="step-priority">Prioridade</label>
              <input
                id="step-priority"
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
              />
            </div>
          </div>

          <div className={styles.formField}>
            <label htmlFor="step-description">Descrição curta</label>
            <textarea
              id="step-description"
              value={shortDescription}
              rows={3}
              onChange={(event) => setShortDescription(event.target.value)}
            />
          </div>

          <div className={styles.formGridTwoColumns}>
            <div className={styles.formField}>
              <label htmlFor="step-due-days">Dias para vencimento</label>
              <input
                id="step-due-days"
                type="number"
                min={0}
                value={dueDays}
                onChange={(event) => setDueDays(Number.parseInt(event.target.value, 10) || 0)}
              />
            </div>
            <div className={styles.formField}>
              <label htmlFor="step-due-hours">Horas para vencimento</label>
              <input
                id="step-due-hours"
                type="number"
                min={0}
                value={dueHours}
                onChange={(event) => setDueHours(Number.parseInt(event.target.value, 10) || 0)}
              />
            </div>
            <div className={styles.formField}>
              <label htmlFor="step-channel">Canal sugerido</label>
              <input
                id="step-channel"
                value={channelHint}
                onChange={(event) => setChannelHint(event.target.value)}
              />
            </div>
          </div>

          <label>
            <input
              type="checkbox"
              checked={pauseUntilDone}
              onChange={(event) => setPauseUntilDone(event.target.checked)}
            />
            Pausar sequência até concluir este passo
          </label>

          <label>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            Passo ativo
          </label>

          <div className={styles.headerActions}>
            <Button type="submit" disabled={pending}>
              Salvar passo
            </Button>
            <Button kind={Button.kinds.TERTIARY} onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

const TAB_LABELS: Record<TabKey, string> = {
  passos: "Passos",
  regras: "Regras & janela",
  inscricoes: "Inscrições",
};

const WORK_DAYS: { value: number; label: string }[] = [
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
  { value: 7, label: "Domingo" },
];

const ENROLLMENT_STATUS: Record<string, string> = {
  active: "Em progresso",
  paused: "Pausada",
  completed: "Concluída",
  terminated: "Encerrada",
};

export default function SequenceEditorPage({ orgId, membershipId, membershipRole, data }: SequenceEditorPageProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("passos");
  const [stepModal, setStepModal] = useState<StepModalState | null>(null);
  const [localSteps, setLocalSteps] = useState<SequenceStepRecord[]>(data.steps);
  const [enrollmentTargetType, setEnrollmentTargetType] = useState<SequenceTargetType>("contact");
  const [enrollmentTargets, setEnrollmentTargets] = useState("");
  const [rulesNotes, setRulesNotes] = useState(data.currentVersion?.notes ?? "");
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    trackEvent(
      "sequence_editor_loaded",
      { versionId: data.currentVersion?.id ?? null, steps: data.steps.length },
      { groups: { orgId, sequenceId: data.sequence.id } }
    );
  }, [data.currentVersion?.id, data.sequence.id, data.steps.length, orgId]);

  useSentrySequenceScope(
    { orgId, sequenceId: data.sequence.id, versionId: data.currentVersion?.id ?? undefined },
    { message: "sequence_editor_loaded", data: { steps: data.steps.length, membershipId } }
  );

  useEffect(() => {
    setLocalSteps(data.steps);
  }, [data.steps]);

  const currentVersion = data.currentVersion;
  const sequenceStatusLabel: Record<string, string> = {
    draft: "Rascunho",
    active: "Ativa",
    paused: "Pausada",
    archived: "Arquivada",
  };

  const roleLabel: Record<"org" | "leader" | "rep", string> = {
    org: "Administrador da organização",
    leader: "Líder",
    rep: "Representante",
  };

  const handleStepSubmit = async (values: {
    id?: string;
    title: string;
    shortDescription: string;
    type: SequenceStepRecord["type"];
    assigneeMode: SequenceStepRecord["assigneeMode"];
    dueOffsetDays: number;
    dueOffsetHours: number;
    priority: string;
    channelHint: string;
    pauseUntilDone: boolean;
    isActive: boolean;
  }) => {
    if (!currentVersion) {
      return;
    }

    startTransition(async () => {
      await upsertSequenceStepAction({
        sequenceId: data.sequence.id,
        versionId: currentVersion.id,
        stepId: values.id,
        title: values.title,
        shortDescription: values.shortDescription,
        type: values.type,
        assigneeMode: values.assigneeMode,
        dueOffsetDays: values.dueOffsetDays,
        dueOffsetHours: values.dueOffsetHours,
        priority: values.priority,
        channelHint: values.channelHint,
        pauseUntilDone: values.pauseUntilDone,
        isActive: values.isActive,
      });
      router.refresh();
      setStepModal(null);
    });
  };

  const handleReorder = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = localSteps.findIndex((step) => step.id === active.id);
    const newIndex = localSteps.findIndex((step) => step.id === over.id);

    const reordered = arrayMove(localSteps, oldIndex, newIndex).map((step, index) => ({
      ...step,
      order: index + 1,
    }));

    setLocalSteps(reordered);

    if (!currentVersion) {
      return;
    }

    startTransition(async () => {
      await reorderSequenceStepsAction(
        data.sequence.id,
        currentVersion.id,
        reordered.map((step) => step.id)
      );
      router.refresh();
    });
  };

  const handleDuplicate = (step: SequenceStepRecord) => {
    startTransition(async () => {
      await duplicateSequenceStepAction(data.sequence.id, step.id);
      router.refresh();
    });
  };

  const handleDelete = (step: SequenceStepRecord) => {
    if (!confirm(`Remover o passo "${step.title}"?`)) {
      return;
    }
    startTransition(async () => {
      await deleteSequenceStepAction(data.sequence.id, step.id);
      router.refresh();
    });
  };

  const handleToggle = (step: SequenceStepRecord, isActive: boolean) => {
    startTransition(async () => {
      await toggleSequenceStepAction(data.sequence.id, step.id, isActive);
      router.refresh();
    });
  };

  const handlePublish = (strategy: "terminate" | "migrate") => {
    if (!currentVersion) {
      return;
    }
    startTransition(async () => {
      await publishSequenceVersionAction(data.sequence.id, currentVersion.id, strategy);
      router.refresh();
    });
  };

  const handleRulesSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!currentVersion) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const selected = formData.getAll("work-days").map((value) => value.toString());
    const workDays = WORK_DAYS.filter((day) => selected.includes(String(day.value))).map((day) => day.value);

    const cooldownDaysValue = formData.get("cooldown-days");
    const cooldownHoursValue = formData.get("cooldown-hours");

    startTransition(async () => {
      await updateSequenceVersionRulesAction({
        sequenceId: data.sequence.id,
        versionId: currentVersion.id,
        workTimeZone: (formData.get("time-zone") as string) || "America/Sao_Paulo",
        workDays,
        workStartTime: (formData.get("start-time") as string) || "09:00",
        workEndTime: (formData.get("end-time") as string) || "18:00",
        cooldownDays:
          typeof cooldownDaysValue === "string" ? Number.parseInt(cooldownDaysValue || "0", 10) : currentVersion.cooldownDays,
        cooldownHours:
          typeof cooldownHoursValue === "string" ? Number.parseInt(cooldownHoursValue || "0", 10) : currentVersion.cooldownHours,
        windowClampEnabled: formData.get("clamp") === "on",
        onPublish: (formData.get("on-publish") as "terminate" | "migrate") ?? "terminate",
        notes: rulesNotes,
      });
      router.refresh();
    });
  };

  const handleEnroll = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentVersion) {
      return;
    }

    const targets = enrollmentTargets
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    startTransition(async () => {
      await enrollTargetsAction(data.sequence.id, currentVersion.id, enrollmentTargetType, targets);
      setEnrollmentTargets("");
      router.refresh();
    });
  };

  const duePreview = useMemo(() => {
    if (!currentVersion || localSteps.length === 0) {
      return null;
    }
    const first = localSteps[0];
    try {
      return calculateDueDate(
        new Date().toISOString(),
        first.dueOffsetDays,
        first.dueOffsetHours,
        {
          timeZone: currentVersion.workTimeZone,
          workDays: currentVersion.workDays,
          workStartTime: currentVersion.workStartTime,
          workEndTime: currentVersion.workEndTime,
          clampEnabled: currentVersion.windowClampEnabled,
        }
      );
    } catch {
      return null;
    }
  }, [currentVersion, localSteps]);

  if (!currentVersion) {
    return (
      <section className={styles.page} aria-labelledby="sequence-editor-empty">
        <header className={styles.header}>
          <h1 id="sequence-editor-empty">Editor de sequência</h1>
          <p>Não encontramos uma versão ativa para esta sequência.</p>
        </header>
      </section>
    );
  }

  return (
    <section className={styles.page} aria-labelledby="sequence-editor-title">
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h1 id="sequence-editor-title">{data.sequence.name}</h1>
          <span className={styles.statusBadge}>{sequenceStatusLabel[data.sequence.status]}</span>
        </div>
        <div className={styles.versionBadges}>
          <span>Versão atual: {currentVersion.versionNumber}</span>
          <span>Alvo padrão: {data.sequence.defaultTargetType === "contact" ? "Contatos" : "Membros"}</span>
          {duePreview ? <span>Próxima due estimada: {new Date(duePreview).toLocaleString("pt-BR")}</span> : null}
          <span>Seu perfil: {roleLabel[membershipRole]}</span>
        </div>
        <div className={styles.headerActions}>
          <Button onClick={() => handlePublish("terminate")} disabled={isPending}>
            Publicar versão (terminar inscrições)
          </Button>
          <Button kind={Button.kinds.SECONDARY} onClick={() => handlePublish("migrate")} disabled={isPending}>
            Publicar versão (migrar inscrições)
          </Button>
          <Button kind={Button.kinds.SECONDARY} onClick={() => setStepModal({ mode: "create" })}>
            Novo passo
          </Button>
        </div>
      </header>

      <nav className={styles.tabList} role="tablist" aria-label="Editor de sequência">
        {(Object.keys(TAB_LABELS) as TabKey[]).map((tab) => (
          <button
            key={tab}
            role="tab"
            type="button"
            className={styles.tabButton}
            data-active={activeTab === tab ? "true" : undefined}
            aria-selected={activeTab === tab}
            aria-controls={`${tab}-panel`}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </nav>

      <div role="tabpanel" id={`${activeTab}-panel`} className={styles.tabPanel}>
        {activeTab === "passos" ? (
          <>
            <div className={styles.stepsHeader}>
              <p>{localSteps.length} passo(s) configurado(s)</p>
              <Button kind={Button.kinds.SECONDARY} onClick={() => setStepModal({ mode: "create" })}>
                Adicionar passo
              </Button>
            </div>
            {localSteps.length === 0 ? (
              <div className={styles.emptyState}>
                <p>Comece adicionando um passo para construir esta sequência.</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleReorder}>
                <SortableContext items={localSteps.map((step) => step.id)} strategy={verticalListSortingStrategy}>
                  <div className={styles.stepsList}>
                    {localSteps.map((step) => (
                      <SortableStep
                        key={step.id}
                        step={step}
                        onEdit={(selected) => setStepModal({ mode: "edit", step: selected })}
                        onDuplicate={handleDuplicate}
                        onDelete={handleDelete}
                        onToggle={handleToggle}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </>
        ) : null}

        {activeTab === "regras" ? (
          <form className={styles.formGrid} onSubmit={handleRulesSubmit}>
            <div className={styles.formGridTwoColumns}>
              <div className={styles.formField}>
                <label htmlFor="time-zone">Fuso horário</label>
                <input id="time-zone" name="time-zone" defaultValue={currentVersion.workTimeZone} />
              </div>
              <div className={styles.formField}>
                <label>Dias úteis</label>
                <div className={styles.checkboxGroup}>
                  {WORK_DAYS.map((day) => (
                    <label key={day.value}>
                      <input
                        type="checkbox"
                        name="work-days"
                        value={day.value}
                        defaultChecked={currentVersion.workDays.includes(day.value)}
                      />
                      {day.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.formGridTwoColumns}>
              <div className={styles.formField}>
                <label htmlFor="start-time">Início da janela</label>
                <input id="start-time" name="start-time" type="time" defaultValue={currentVersion.workStartTime} />
              </div>
              <div className={styles.formField}>
                <label htmlFor="end-time">Fim da janela</label>
                <input id="end-time" name="end-time" type="time" defaultValue={currentVersion.workEndTime} />
              </div>
              <div className={styles.formField}>
                <label htmlFor="cooldown-days">Cooldown (dias)</label>
                <input
                  id="cooldown-days"
                  name="cooldown-days"
                  type="number"
                  min={0}
                  defaultValue={currentVersion.cooldownDays}
                />
              </div>
              <div className={styles.formField}>
                <label htmlFor="cooldown-hours">Cooldown (horas)</label>
                <input
                  id="cooldown-hours"
                  name="cooldown-hours"
                  type="number"
                  min={0}
                  defaultValue={currentVersion.cooldownHours}
                />
              </div>
            </div>

            <label>
              <input type="checkbox" name="clamp" defaultChecked={currentVersion.windowClampEnabled} /> Ajustar due-date à janela
            </label>

            <div className={styles.formField}>
              <label htmlFor="on-publish">Estratégia ao publicar</label>
              <select id="on-publish" name="on-publish" defaultValue={currentVersion.onPublish}>
                <option value="terminate">Encerrar inscrições antigas</option>
                <option value="migrate">Migrar inscrições para a nova versão</option>
              </select>
            </div>

            <div className={styles.formField}>
              <label htmlFor="version-notes">Notas internas</label>
              <textarea
                id="version-notes"
                value={rulesNotes}
                rows={3}
                onChange={(event) => setRulesNotes(event.target.value)}
              />
            </div>

            <Button type="submit" disabled={isPending}>
              Salvar regras
            </Button>
          </form>
        ) : null}

        {activeTab === "inscricoes" ? (
          <>
            <form className={styles.inlineForm} onSubmit={handleEnroll}>
              <div className={styles.formField}>
                <label htmlFor="enrollment-type">Tipo de alvo</label>
                <select
                  id="enrollment-type"
                  value={enrollmentTargetType}
                  onChange={(event) => setEnrollmentTargetType(event.target.value as SequenceTargetType)}
                >
                  <option value="contact">Contato</option>
                  <option value="member">Membro</option>
                </select>
              </div>
              <div className={styles.formField}>
                <label htmlFor="enrollment-targets">IDs (separados por vírgula)</label>
                <input
                  id="enrollment-targets"
                  value={enrollmentTargets}
                  onChange={(event) => setEnrollmentTargets(event.target.value)}
                  placeholder="ex: cont-1, cont-2"
                />
              </div>
              <Button type="submit" disabled={isPending}>
                Inscrever
              </Button>
            </form>

            <table className={styles.enrollmentsTable} aria-label="Inscrições ativas">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Inscrito em</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.enrollments.length === 0 ? (
                  <tr>
                    <td colSpan={5}>Nenhuma inscrição encontrada.</td>
                  </tr>
                ) : (
                  data.enrollments.map((enrollment) => (
                    <tr key={enrollment.id}>
                      <td>{enrollment.targetId}</td>
                      <td>{enrollment.targetType === "contact" ? "Contato" : "Membro"}</td>
                      <td>{ENROLLMENT_STATUS[enrollment.status]}</td>
                      <td>{new Date(enrollment.enrolledAt).toLocaleString("pt-BR")}</td>
                      <td>
                        <div className={styles.enrollmentActions}>
                          {enrollment.status !== "paused" ? (
                            <Button
                              kind={Button.kinds.TERTIARY}
                              onClick={() =>
                                startTransition(async () => {
                                  await pauseEnrollmentAction(data.sequence.id, enrollment.id);
                                  router.refresh();
                                })
                              }
                            >
                              Pausar
                            </Button>
                          ) : null}
                          {enrollment.status === "paused" ? (
                            <Button
                              kind={Button.kinds.TERTIARY}
                              onClick={() =>
                                startTransition(async () => {
                                  await resumeEnrollmentAction(data.sequence.id, enrollment.id);
                                  router.refresh();
                                })
                              }
                            >
                              Retomar
                            </Button>
                          ) : null}
                          <Button
                            kind={Button.kinds.TERTIARY}
                            onClick={() =>
                              startTransition(async () => {
                                await removeEnrollmentAction(data.sequence.id, enrollment.id);
                                router.refresh();
                              })
                            }
                          >
                            Encerrar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </>
        ) : null}
      </div>

      <StepModal open={Boolean(stepModal)} state={stepModal} onClose={() => setStepModal(null)} onSubmit={handleStepSubmit} pending={isPending} />
    </section>
  );
}
