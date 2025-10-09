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
import {
  Avatar,
  BreadcrumbItem,
  BreadcrumbsBar,
  Button,
  EmptyState,
  Label,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  TextArea,
  Toggle,
} from "@vibe/core";
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
  removeEnrollmentAction,
  reorderSequenceStepsAction,
  resumeEnrollmentAction,
  toggleSequenceStepAction,
  updateSequenceActivationAction,
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

type TabKey = "etapas" | "regras" | "inscricoes";

type StepModalState = {
  mode: "create" | "edit";
  step?: SequenceStepRecord;
  presetType?: SequenceStepRecord["type"];
  anchorStepId?: string;
  position?: "before" | "after";
};

type SortableStepProps = {
  step: SequenceStepRecord;
  index: number;
  isSelected: boolean;
  disableReorder: boolean;
  disableActions: boolean;
  onSelect: (step: SequenceStepRecord) => void;
  onToggle: (step: SequenceStepRecord, isActive: boolean) => void;
  onDuplicate: (step: SequenceStepRecord) => void;
  onDelete: (step: SequenceStepRecord) => void;
  onAddBefore: (step: SequenceStepRecord) => void;
  onAddAfter: (step: SequenceStepRecord) => void;
  onAddWait: (step: SequenceStepRecord) => void;
  onMoveUp: (step: SequenceStepRecord) => void;
  onMoveDown: (step: SequenceStepRecord) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

const STEP_TYPE_LABEL: Record<SequenceStepRecord["type"], string> = {
  general_task: "Tarefa geral",
  call_task: "Tarefa de ligação",
};

function SortableStep({
  step,
  index,
  isSelected,
  disableReorder,
  disableActions,
  onSelect,
  onToggle,
  onDuplicate,
  onDelete,
  onAddBefore,
  onAddAfter,
  onAddWait,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: SortableStepProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: step.id, disabled: disableReorder });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={styles.stepCard}
      data-inactive={step.isActive ? undefined : "true"}
      data-selected={isSelected ? "true" : undefined}
      data-locked={disableActions ? "true" : undefined}
      onClick={() => onSelect(step)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && !disableActions) {
          event.preventDefault();
          onSelect(step);
        }
      }}
    >
      <div className={styles.stepCardInner}>
        <button
          type="button"
          className={styles.dragHandle}
          aria-label="Reordenar etapa"
          {...attributes}
          {...(disableReorder ? {} : listeners)}
          disabled={disableReorder}
        >
          ⋮⋮
        </button>
        <div className={styles.stepCardContent}>
          <div className={styles.stepTitleRow}>
            <span className={styles.stepOrder}>{`${index + 1}.`}</span>
            <div className={styles.stepTextGroup}>
              <h3>{step.title.trim() || STEP_TYPE_LABEL[step.type]}</h3>
              <p>{step.shortDescription?.trim() || "Sem descrição"}</p>
            </div>
          </div>
          <span className={styles.stepType}>{STEP_TYPE_LABEL[step.type]}</span>
        </div>
        <MenuButton
          className={styles.stepMenuButton}
          ariaLabel={`Ações para ${step.title}`}
          disabled={disableActions}
          closeMenuOnItemClick
          component={({ onClick }) => (
            <button
              type="button"
              className={styles.stepMenuTrigger}
              onClick={(event) => {
                event.stopPropagation();
                onClick(event);
              }}
              aria-label={`Abrir menu de ações da etapa ${index + 1}`}
            >
              ⋯
            </button>
          )}
        >
          <Menu>
            <MenuItem
              title="Adicionar tempo de espera"
              disabled={disableActions}
              onClick={() => onAddWait(step)}
            />
            <MenuItem
              title={step.isActive ? "Desativar etapa" : "Ativar etapa"}
              disabled={disableActions}
              onClick={() => onToggle(step, !step.isActive)}
            />
            <MenuDivider />
            <MenuItem
              title="Adicionar etapa antes"
              disabled={disableActions}
              onClick={() => onAddBefore(step)}
            />
            <MenuItem
              title="Adicionar etapa depois"
              disabled={disableActions}
              onClick={() => onAddAfter(step)}
            />
            <MenuDivider />
            <MenuItem
              title="Mover etapa para cima"
              disabled={disableActions || !canMoveUp}
              onClick={() => onMoveUp(step)}
            />
            <MenuItem
              title="Mover etapa para baixo"
              disabled={disableActions || !canMoveDown}
              onClick={() => onMoveDown(step)}
            />
            <MenuDivider />
            <MenuItem
              title="Duplicar etapa"
              disabled={disableActions}
              onClick={() => onDuplicate(step)}
            />
            <MenuItem
              title="Excluir etapa"
              disabled={disableActions}
              onClick={() => onDelete(step)}
            />
          </Menu>
        </MenuButton>
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
    anchorStepId?: string;
    position?: "before" | "after";
  }) => Promise<void>;
  pending: boolean;
  disabled: boolean;
};

function StepModal({ open, state, onClose, onSubmit, pending, disabled }: StepModalProps) {
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
      setType(state?.presetType ?? "general_task");
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

  const formDisabled = pending || disabled;

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
            if (formDisabled) {
              return;
            }
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
              anchorStepId: state?.anchorStepId,
              position: state?.position,
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
                disabled={formDisabled}
              />
            </div>
            <div className={styles.formField}>
              <label htmlFor="step-type">Tipo</label>
              <select
                id="step-type"
                value={type}
                onChange={(event) => setType(event.target.value as SequenceStepRecord["type"])}
                disabled={formDisabled}
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
                disabled={formDisabled}
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
                disabled={formDisabled}
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
              disabled={formDisabled}
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
                disabled={formDisabled}
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
                disabled={formDisabled}
              />
            </div>
            <div className={styles.formField}>
              <label htmlFor="step-channel">Canal sugerido</label>
              <input
                id="step-channel"
                value={channelHint}
                onChange={(event) => setChannelHint(event.target.value)}
                disabled={formDisabled}
              />
            </div>
          </div>

          <label>
            <input
              type="checkbox"
              checked={pauseUntilDone}
              onChange={(event) => setPauseUntilDone(event.target.checked)}
              disabled={formDisabled}
            />
            Pausar sequência até concluir este passo
          </label>

          <label>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              disabled={formDisabled}
            />
            Passo ativo
          </label>

          <div className={styles.headerActions}>
            <Button type="submit" disabled={formDisabled}>
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
  etapas: "Etapas",
  regras: "Regras & notificações",
  inscricoes: "Inscrições",
};

const STEP_TEMPLATES: { id: SequenceStepRecord["type"]; title: string; description: string }[] = [
  {
    id: "general_task",
    title: "Tarefa geral",
    description: "Crie uma tarefa manual e notifique o responsável automaticamente.",
  },
  {
    id: "call_task",
    title: "Tarefa de ligação",
    description: "Agende uma ligação e acompanhe o retorno diretamente pela sequência.",
  },
];

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

const ENROLLMENT_COLUMNS = [
  { id: "targetId", title: "ID" },
  { id: "targetType", title: "Tipo" },
  { id: "status", title: "Status" },
  { id: "enrolledAt", title: "Inscrito em" },
  { id: "actions", title: "Ações" },
];

export default function SequenceEditorPage({ orgId, membershipId, membershipRole, data }: SequenceEditorPageProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("etapas");
  const [stepModal, setStepModal] = useState<StepModalState | null>(null);
  const [localSteps, setLocalSteps] = useState<SequenceStepRecord[]>(data.steps);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(data.steps[0]?.id ?? null);
  const [enrollmentTargetType, setEnrollmentTargetType] = useState<SequenceTargetType>("contact");
  const [enrollmentTargets, setEnrollmentTargets] = useState("");
  const [rulesNotes, setRulesNotes] = useState(data.currentVersion?.notes ?? "");
  const [noteDraft, setNoteDraft] = useState("");
  const [pauseDraft, setPauseDraft] = useState(false);
  const [enrollmentBusy, setEnrollmentBusy] = useState(false);
  const [enrollmentSort, setEnrollmentSort] = useState<{ column: string; direction: "asc" | "desc" } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [sequenceActive, setSequenceActive] = useState(data.sequence.isActive);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [activationPending, startActivationTransition] = useTransition();
  const [stepError, setStepError] = useState<string | null>(null);

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
    if (data.steps.length === 0) {
      setSelectedStepId(null);
    } else if (!data.steps.some((step) => step.id === selectedStepId)) {
      setSelectedStepId(data.steps[0].id);
    }
  }, [data.steps, selectedStepId]);

  useEffect(() => {
    setSequenceActive(data.sequence.isActive);
    setActivationError(null);
  }, [data.sequence.isActive]);

  useEffect(() => {
    if (sequenceActive) {
      setStepModal(null);
    }
  }, [sequenceActive]);

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

  const sequenceTitle = data.sequence.name?.trim() || "Nova Sequência";

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
    anchorStepId?: string;
    position?: "before" | "after";
  }) => {
    if (!currentVersion) {
      return;
    }

    if (sequenceActive) {
      setStepModal(null);
      return;
    }

    const anchorIndex = values.anchorStepId
      ? localSteps.findIndex((step) => step.id === values.anchorStepId)
      : -1;
    const insertAtIndex =
      !values.id && values.position && anchorIndex >= 0
        ? values.position === "before"
          ? anchorIndex
          : anchorIndex + 1
        : null;

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
        insertAtIndex: insertAtIndex ?? undefined,
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

    if (sequenceActive) {
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

  const moveStep = (step: SequenceStepRecord, direction: "up" | "down") => {
    const currentIndex = localSteps.findIndex((item) => item.id === step.id);
    if (currentIndex === -1) {
      return;
    }

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= localSteps.length) {
      return;
    }

    const reordered = arrayMove(localSteps, currentIndex, targetIndex).map((item, index) => ({
      ...item,
      order: index + 1,
    }));

    setLocalSteps(reordered);

    if (!currentVersion || sequenceActive) {
      return;
    }

    startTransition(async () => {
      await reorderSequenceStepsAction(
        data.sequence.id,
        currentVersion.id,
        reordered.map((item) => item.id)
      );
      router.refresh();
    });
  };

  const handleMoveStepUp = (step: SequenceStepRecord) => moveStep(step, "up");
  const handleMoveStepDown = (step: SequenceStepRecord) => moveStep(step, "down");

  const openStepModal = (state: StepModalState) => {
    if (disableStepActions) {
      return;
    }
    setStepModal(state);
  };

  const handleDuplicate = (step: SequenceStepRecord) => {
    if (disableStepActions) {
      return;
    }
    startTransition(async () => {
      await duplicateSequenceStepAction(data.sequence.id, step.id);
      router.refresh();
    });
  };

  const handleAddStepRelative = (step: SequenceStepRecord, position: "before" | "after") => {
    openStepModal({ mode: "create", presetType: step.type, anchorStepId: step.id, position });
  };

  const handleAddWaitAfter = (step: SequenceStepRecord) => {
    openStepModal({
      mode: "create",
      presetType: step.type,
      anchorStepId: step.id,
      position: "after",
    });
  };

  const handleDelete = (step: SequenceStepRecord) => {
    if (!confirm(`Remover o passo "${step.title}"?`)) {
      return;
    }
    if (disableStepActions) {
      return;
    }
    startTransition(async () => {
      await deleteSequenceStepAction(data.sequence.id, step.id);
      router.refresh();
    });
  };

  const handleToggle = (step: SequenceStepRecord, isActive: boolean) => {
    if (disableStepActions) {
      return;
    }
    startTransition(async () => {
      await toggleSequenceStepAction(data.sequence.id, step.id, isActive);
      router.refresh();
    });
  };

  const handleActivationToggle = (nextActive: boolean) => {
    if (!currentVersion) {
      return;
    }

    setActivationError(null);
    setSequenceActive(nextActive);

    startActivationTransition(async () => {
      try {
        await updateSequenceActivationAction({
          sequenceId: data.sequence.id,
          versionId: currentVersion.id,
          isActive: nextActive,
          strategy: currentVersion.onPublish,
        });
        router.refresh();
      } catch (error) {
        console.error("[sequences] falha ao alternar ativação da sequência", error);
        setSequenceActive((prev) => (prev === nextActive ? !nextActive : prev));
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Não foi possível atualizar o status de ativação.";
        setActivationError(message);
      }
    });
  };

  const handleRulesSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!currentVersion) {
      return;
    }

    if (sequenceActive) {
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

    if (sequenceActive) {
      return;
    }

    const targets = enrollmentTargets
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    setEnrollmentBusy(true);
    startTransition(async () => {
      try {
        await enrollTargetsAction(data.sequence.id, currentVersion.id, enrollmentTargetType, targets);
        setEnrollmentTargets("");
        router.refresh();
      } finally {
        setEnrollmentBusy(false);
      }
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

  const selectedStep = useMemo(
    () => localSteps.find((step) => step.id === selectedStepId) ?? null,
    [localSteps, selectedStepId]
  );

  const sortedEnrollments = useMemo(() => {
    const items = [...data.enrollments];
    if (!enrollmentSort) {
      return items;
    }

    const direction = enrollmentSort.direction === "asc" ? 1 : -1;

    return items.sort((a, b) => {
      switch (enrollmentSort.column) {
        case "targetId":
          return direction * a.targetId.localeCompare(b.targetId, "pt-BR", { numeric: true });
        case "targetType": {
          const labelA = a.targetType === "contact" ? "Contato" : "Membro";
          const labelB = b.targetType === "contact" ? "Contato" : "Membro";
          return direction * labelA.localeCompare(labelB, "pt-BR");
        }
        case "status": {
          const labelA = ENROLLMENT_STATUS[a.status] ?? a.status;
          const labelB = ENROLLMENT_STATUS[b.status] ?? b.status;
          return direction * labelA.localeCompare(labelB, "pt-BR");
        }
        case "enrolledAt":
          return (
            direction *
            (new Date(a.enrolledAt).getTime() - new Date(b.enrolledAt).getTime())
          );
        default:
          return 0;
      }
    });
  }, [data.enrollments, enrollmentSort]);

  useEffect(() => {
    if (!selectedStep) {
      setNoteDraft("");
      setPauseDraft(false);
      setStepError(null);
      return;
    }
    setNoteDraft(selectedStep.shortDescription ?? "");
    setPauseDraft(selectedStep.pauseUntilDone);
    setStepError(null);
  }, [selectedStep]);

  const disableStepActions = sequenceActive || isPending || activationPending;
  const disableRulesForm = sequenceActive || activationPending;
  const disableEnrollmentForm = sequenceActive || activationPending;
  const hasStepDraftChanges =
    Boolean(selectedStep) &&
    (noteDraft !== (selectedStep?.shortDescription ?? "") || pauseDraft !== (selectedStep?.pauseUntilDone ?? false));

  const handleSaveSelectedStep = () => {
    if (!selectedStep || !currentVersion) {
      return;
    }

    if (sequenceActive) {
      return;
    }

    setStepError(null);

    startTransition(async () => {
      try {
        await upsertSequenceStepAction({
          sequenceId: data.sequence.id,
          versionId: currentVersion.id,
          stepId: selectedStep.id,
          title: selectedStep.title,
          shortDescription: noteDraft,
          type: selectedStep.type,
          assigneeMode: selectedStep.assigneeMode,
          dueOffsetDays: selectedStep.dueOffsetDays,
          dueOffsetHours: selectedStep.dueOffsetHours,
          priority: selectedStep.priority ?? undefined,
          channelHint: selectedStep.channelHint ?? undefined,
          pauseUntilDone: pauseDraft,
          isActive: selectedStep.isActive,
        });
        router.refresh();
      } catch (error) {
        console.error("[sequences] falha ao salvar etapa", error);
        setStepError(
          error instanceof Error && error.message
            ? error.message
            : "Não foi possível salvar as alterações da etapa."
        );
      }
    });
  };

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
      <header className={styles.pageHeader}>
        <BreadcrumbsBar type={BreadcrumbsBar.types.NAVIGATION} className={styles.breadcrumbs}>
          <BreadcrumbItem
            text="← Todas as sequências"
            isClickable
            onClick={() => router.push("/sequences")}
          />
        </BreadcrumbsBar>

        <div className={styles.headerContent}>
          <div className={styles.headerIdentity}>
            <Avatar
              type={Avatar.types.TEXT}
              size={Avatar.sizes.LARGE}
              text={sequenceTitle.slice(0, 1).toUpperCase()}
            />
            <div className={styles.headerText}>
              <div className={styles.headerTitleRow}>
                <h1 id="sequence-editor-title">{sequenceTitle}</h1>
                <Label
                  kind={Label.kinds.FILL}
                  color={Label.colors.PRIMARY}
                  className={styles.statusBadge}
                  text={sequenceStatusLabel[data.sequence.status]}
                />
              </div>
              <div className={styles.headerMeta}>
                <span>Versão atual #{currentVersion.versionNumber}</span>
                <span>
                  Alvo padrão: {data.sequence.defaultTargetType === "contact" ? "Contatos" : "Membros"}
                </span>
                {duePreview ? (
                  <span>Próxima due estimada: {new Date(duePreview).toLocaleString("pt-BR")}</span>
                ) : null}
                <span>Seu perfil: {roleLabel[membershipRole]}</span>
              </div>
              <Text type={Text.types.TEXT2} className={styles.headerDescription}>
                {data.sequence.description?.trim() ||
                  "Organize a cadência de tarefas, defina regras de disparo e acompanhe inscrições em tempo real."}
              </Text>
            </div>
          </div>

          <div className={styles.headerActions}>
            <div className={styles.activationGroup}>
              <div className={styles.activationToggle}>
                <span className={styles.activationSideLabel}>Inativa</span>
                <Toggle
                  isSelected={sequenceActive}
                  onChange={(value) => handleActivationToggle(value)}
                  disabled={activationPending || isPending}
                  ariaLabel="Alternar ativação da sequência"
                />
                <span className={styles.activationSideLabel}>Ativa</span>
              </div>
              <p className={styles.activationHint}>
                {sequenceActive
                  ? "Edições bloqueadas enquanto a sequência estiver ativa."
                  : "Revise etapas e regras antes de ativar novamente."}
              </p>
              {activationError ? <p className={styles.activationError}>{activationError}</p> : null}
            </div>
            <Button
              kind={Button.kinds.PRIMARY}
              onClick={handleSaveSelectedStep}
              disabled={disableStepActions || !hasStepDraftChanges}
            >
              Salvar sequência
            </Button>
          </div>
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
        {activeTab === "etapas" ? (
          <div className={styles.stepsLayout}>
            <div className={styles.stepsColumn}>
              <div className={styles.stepsHeader}>
                <div>
                  <p className={styles.stepsTitle}>Etapas ({localSteps.length})</p>
                  <span className={styles.stepsSubtitle}>
                    Arraste para reordenar ou clique para visualizar detalhes.
                  </span>
                </div>
                <Button
                  kind={Button.kinds.SECONDARY}
                  onClick={() => openStepModal({ mode: "create", presetType: "general_task" })}
                  disabled={disableStepActions}
                >
                  Adicionar etapa
                </Button>
              </div>

              {localSteps.length === 0 ? (
                <div className={styles.stepsEmpty}>
                  <h3>Adicione a primeira etapa</h3>
                  <p>Escolha um template e personalize a cadência conforme a sua operação.</p>
                  <div className={styles.stepTemplates}>
                    {STEP_TEMPLATES.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        className={styles.stepTemplateCard}
                        onClick={() => openStepModal({ mode: "create", presetType: template.id })}
                        disabled={disableStepActions}
                      >
                        <strong>{template.title}</strong>
                        <span>{template.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleReorder}>
                  <SortableContext items={localSteps.map((step) => step.id)} strategy={verticalListSortingStrategy}>
                    <div className={styles.stepsList}>
                      {localSteps.map((step, index) => (
                        <SortableStep
                          key={step.id}
                          step={step}
                          index={index}
                          isSelected={selectedStepId === step.id}
                          disableReorder={disableStepActions}
                          disableActions={disableStepActions}
                          onSelect={(selected) => setSelectedStepId(selected.id)}
                          onToggle={handleToggle}
                          onDuplicate={handleDuplicate}
                          onDelete={handleDelete}
                          onAddBefore={(selected) => handleAddStepRelative(selected, "before")}
                          onAddAfter={(selected) => handleAddStepRelative(selected, "after")}
                          onAddWait={handleAddWaitAfter}
                          onMoveUp={handleMoveStepUp}
                          onMoveDown={handleMoveStepDown}
                          canMoveUp={index > 0}
                          canMoveDown={index < localSteps.length - 1}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
              <button
                type="button"
                className={styles.addStepLink}
                onClick={() => openStepModal({ mode: "create", presetType: "general_task" })}
                disabled={disableStepActions}
              >
                + Adicionar
              </button>
            </div>

            <aside className={styles.detailsColumn} aria-live="polite">
              {selectedStep ? (
                <div className={styles.detailCard}>
                  <header className={styles.detailHeader}>
                    <div className={styles.detailHeaderText}>
                      <h2>{selectedStep.title}</h2>
                      <span className={styles.detailSubtitle}>{STEP_TYPE_LABEL[selectedStep.type]}</span>
                    </div>
                    <Label
                      kind={Label.kinds.FILL}
                      color={selectedStep.isActive ? Label.colors.POSITIVE : Label.colors.AMERICAN_GRAY}
                      text={selectedStep.isActive ? "Ativa" : "Inativa"}
                    />
                  </header>

                  {stepError ? (
                    <div className={styles.detailError} role="alert">
                      {stepError}
                    </div>
                  ) : null}

                  <div className={styles.noteSection}>
                    <TextArea
                      value={noteDraft}
                      onChange={(event) => setNoteDraft(event.target.value)}
                      disabled={disableStepActions}
                      placeholder="Adicione a nota que aparecerá no lembrete desta tarefa."
                      className={styles.detailTextarea}
                      aria-label="Nota da etapa selecionada"
                    />
                    <div className={styles.noteToolbar} role="toolbar" aria-label="Ferramentas de formatação">
                      <button type="button" className={styles.noteToolbarButton} disabled>
                        +
                      </button>
                      <button type="button" className={styles.noteToolbarButton} disabled>
                        Aa
                      </button>
                      <button type="button" className={styles.noteToolbarButton} disabled>
                        {}
                      </button>
                    </div>
                  </div>

                  <div className={styles.detailFooter}>
                    <div className={styles.pauseRow}>
                      <span>Pausar sequência até que a etapa seja marcada como concluída</span>
                      <Toggle
                        isSelected={pauseDraft}
                        onChange={(value) => setPauseDraft(value)}
                        disabled={disableStepActions}
                        ariaLabel="Pausar sequência até concluir esta etapa"
                      />
                    </div>

                    <div className={styles.detailActions}>
                      <Button
                        onClick={handleSaveSelectedStep}
                        disabled={disableStepActions || !hasStepDraftChanges}
                      >
                        Salvar etapa
                      </Button>
                      <Button
                        kind={Button.kinds.SECONDARY}
                        onClick={() => openStepModal({ mode: "edit", step: selectedStep })}
                        disabled={disableStepActions}
                      >
                        Editar etapa
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.detailPlaceholder}>Selecione uma etapa para visualizar detalhes.</div>
              )}
            </aside>
          </div>
        ) : null}

        {activeTab === "regras" ? (
          <div className={styles.rulesLayout}>
            <form className={styles.rulesForm} onSubmit={handleRulesSubmit}>
              <fieldset
                className={styles.rulesFieldset}
                disabled={disableRulesForm}
                aria-disabled={disableRulesForm}
              >
                <div className={styles.rulesGrid}>
                <div className={styles.formField}>
                  <label htmlFor="time-zone">Fuso horário</label>
                  <input id="time-zone" name="time-zone" defaultValue={currentVersion.workTimeZone} />
                </div>
                <div className={styles.formField}>
                  <label>Dias úteis</label>
                  <div className={styles.checkboxGroup}>
                    {WORK_DAYS.map((day) => (
                      <label key={day.value} className={styles.checkboxItem}>
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
                <div className={styles.formFieldInline}>
                  <label className={styles.checkboxItem}>
                    <input type="checkbox" name="clamp" defaultChecked={currentVersion.windowClampEnabled} /> Ajustar due-date à janela
                  </label>
                </div>
                <div className={styles.formField}>
                  <label htmlFor="on-publish">Estratégia ao publicar</label>
                  <select id="on-publish" name="on-publish" defaultValue={currentVersion.onPublish}>
                    <option value="terminate">Encerrar inscrições antigas</option>
                    <option value="migrate">Migrar inscrições para a nova versão</option>
                  </select>
                </div>
                <div className={styles.formFieldFull}>
                  <label htmlFor="version-notes">Notas internas</label>
                  <textarea
                    id="version-notes"
                    value={rulesNotes}
                    rows={3}
                    onChange={(event) => setRulesNotes(event.target.value)}
                  />
                </div>
              </div>

              <div className={styles.rulesFooter}>
                <Button type="submit" disabled={disableRulesForm || isPending}>
                  Salvar regras
                </Button>
              </div>
              </fieldset>
            </form>
          </div>
        ) : null}

        {activeTab === "inscricoes" ? (
          <div className={styles.enrollmentsLayout}>
            <form className={styles.inlineForm} onSubmit={handleEnroll}>
              <fieldset
                className={styles.inlineFieldset}
                disabled={disableEnrollmentForm || enrollmentBusy}
                aria-disabled={disableEnrollmentForm || enrollmentBusy}
              >
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
                <Button type="submit" disabled={disableEnrollmentForm || enrollmentBusy}>
                  Inscrever
                </Button>
              </fieldset>
            </form>

            <TableContainer className={styles.enrollmentsTableShell}>
              <Table
                columns={ENROLLMENT_COLUMNS}
                dataState={{ isLoading: enrollmentBusy }}
                emptyState={
                  <EmptyState
                    title="Adicione pessoas a esta sequência"
                    description="Selecione contatos manualmente ou deixe as automações trazerem novas inscrições."
                  />
                }
                errorState={
                  <EmptyState
                    title="Não foi possível carregar as inscrições"
                    description="Atualize a página e tente novamente."
                  />
                }
                withoutBorder
              >
                <TableHeader>
                  <TableRow>
                    {ENROLLMENT_COLUMNS.map((column) => (
                      <TableHeaderCell
                        key={column.id}
                        title={column.title}
                        sortState={
                          column.id !== "actions"
                            ? enrollmentSort?.column === column.id
                              ? enrollmentSort.direction
                              : "none"
                            : undefined
                        }
                        onSortClicked={
                          column.id !== "actions"
                            ? (direction) =>
                                setEnrollmentSort(
                                  direction === "none"
                                    ? null
                                    : { column: column.id, direction }
                                )
                            : undefined
                        }
                      />
                    ))}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {sortedEnrollments.map((enrollment) => (
                    <TableRow key={enrollment.id}>
                      <TableCell>{enrollment.targetId}</TableCell>
                      <TableCell>{enrollment.targetType === "contact" ? "Contato" : "Membro"}</TableCell>
                      <TableCell>{ENROLLMENT_STATUS[enrollment.status]}</TableCell>
                      <TableCell>{new Date(enrollment.enrolledAt).toLocaleString("pt-BR")}</TableCell>
                      <TableCell>
                        <div className={styles.enrollmentActions}>
                          {enrollment.status !== "paused" ? (
                            <Button
                              kind={Button.kinds.TERTIARY}
                              onClick={() => {
                                setEnrollmentBusy(true);
                                startTransition(async () => {
                                  try {
                                    await pauseEnrollmentAction(data.sequence.id, enrollment.id);
                                    router.refresh();
                                  } finally {
                                    setEnrollmentBusy(false);
                                  }
                                });
                              }}
                              disabled={disableEnrollmentForm || enrollmentBusy}
                            >
                              Pausar
                            </Button>
                          ) : null}
                          {enrollment.status === "paused" ? (
                            <Button
                              kind={Button.kinds.TERTIARY}
                              onClick={() => {
                                setEnrollmentBusy(true);
                                startTransition(async () => {
                                  try {
                                    await resumeEnrollmentAction(data.sequence.id, enrollment.id);
                                    router.refresh();
                                  } finally {
                                    setEnrollmentBusy(false);
                                  }
                                });
                              }}
                              disabled={disableEnrollmentForm || enrollmentBusy}
                            >
                              Retomar
                            </Button>
                          ) : null}
                          <Button
                            kind={Button.kinds.TERTIARY}
                            onClick={() => {
                              setEnrollmentBusy(true);
                              startTransition(async () => {
                                try {
                                  await removeEnrollmentAction(data.sequence.id, enrollment.id);
                                  router.refresh();
                                } finally {
                                  setEnrollmentBusy(false);
                                }
                              });
                            }}
                            disabled={disableEnrollmentForm || enrollmentBusy}
                          >
                            Encerrar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </div>
        ) : null}
      </div>

      <StepModal
        open={Boolean(stepModal)}
        state={stepModal}
        onClose={() => setStepModal(null)}
        onSubmit={handleStepSubmit}
        pending={isPending}
        disabled={sequenceActive || activationPending}
      />
    </section>
  );
}
