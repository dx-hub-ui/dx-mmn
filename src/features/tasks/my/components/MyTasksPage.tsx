"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import clsx from "clsx";
import { Button } from "@vibe/core";
import { useRouter } from "next/navigation";
import { completeAssignmentAction, snoozeAssignmentAction } from "@/app/(app)/tasks/actions";
import { trackEvent } from "@/lib/telemetry";
import { useSentrySequenceScope } from "@/lib/observability/sentryClient";
import { filterTasks, statusLabel } from "../normalize";
import type { AssignmentStatus, MyTaskItem, MyTasksFilter } from "../types";
import styles from "./my-tasks.module.css";
import TaskDetailsDialog from "./TaskDetailsDialog";

const FILTERS: { id: MyTasksFilter; label: string }[] = [
  { id: "todos", label: "Todas" },
  { id: "abertas", label: "Em aberto" },
  { id: "atrasadas", label: "Em atraso" },
  { id: "bloqueadas", label: "Bloqueadas" },
  { id: "adiadas", label: "Adiados" },
];

type MyTasksPageProps = {
  orgId: string;
  membershipId: string;
  tasks: MyTaskItem[];
};

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

function statusClass(status: AssignmentStatus) {
  switch (status) {
    case "open":
      return styles.statusOpen;
    case "done":
      return styles.statusDone;
    case "snoozed":
      return styles.statusSnoozed;
    case "blocked":
      return styles.statusBlocked;
    default:
      return styles.statusOpen;
  }
}

export default function MyTasksPage({ orgId, membershipId, tasks }: MyTasksPageProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<MyTasksFilter>("todos");
  const [items, setItems] = useState<MyTaskItem[]>(tasks);
  const [selectedTask, setSelectedTask] = useState<MyTaskItem | null>(null);
  const [pendingAction, setPendingAction] = useState<"complete" | "snooze" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setItems(tasks);
  }, [tasks]);

  useEffect(() => {
    trackEvent(
      "my_tasks_viewed",
      { total: items.length, membershipId },
      { groups: { orgId } }
    );
  }, [items.length, membershipId, orgId]);

  useSentrySequenceScope(
    { orgId },
    {
      message: "my_tasks_viewed",
      data: { total: items.length },
    }
  );

  const filteredTasks = useMemo(() => filterTasks(items, filter), [items, filter]);

  const closeDialog = () => {
    setSelectedTask(null);
    setActionError(null);
  };

  const handleComplete = (task: MyTaskItem) => {
    setPageError(null);
    setActionError(null);
    setPendingAction("complete");

    startTransition(async () => {
      try {
        await completeAssignmentAction({ assignmentId: task.id });
        const nowIso = new Date().toISOString();
        setItems((current) =>
          current.map((item) =>
            item.id === task.id
              ? {
                  ...item,
                  status: "done",
                  doneAt: nowIso,
                  snoozedUntil: null,
                  overdueAt: null,
                  isOverdue: false,
                  isSnoozed: false,
                  isBlocked: false,
                  blockedReason: null,
                }
              : item
          )
        );
        router.refresh();
        if (selectedTask?.id === task.id) {
          closeDialog();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Não foi possível concluir a tarefa.";
        if (selectedTask?.id === task.id) {
          setActionError(message);
        } else {
          setPageError(message);
        }
      } finally {
        setPendingAction(null);
      }
    });
  };

  const handleSnooze = (task: MyTaskItem, rawValue: string) => {
    if (!rawValue) {
      setActionError("Informe uma data válida para adiar.");
      return;
    }

    const parsed = new Date(rawValue);
    if (Number.isNaN(parsed.getTime())) {
      setActionError("Informe uma data válida para adiar.");
      return;
    }

    setActionError(null);
    setPageError(null);
    setPendingAction("snooze");

    const isoValue = parsed.toISOString();

    startTransition(async () => {
      try {
        await snoozeAssignmentAction({ assignmentId: task.id, snoozeUntil: rawValue });
        setItems((current) =>
          current.map((item) =>
            item.id === task.id
              ? {
                  ...item,
                  status: "snoozed",
                  snoozedUntil: isoValue,
                  overdueAt: null,
                  isOverdue: false,
                  isSnoozed: true,
                  isBlocked: false,
                }
              : item
          )
        );
        router.refresh();
        closeDialog();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Não foi possível adiar a tarefa.";
        setActionError(message);
      } finally {
        setPendingAction(null);
      }
    });
  };

  const isBusy = pendingAction !== null || isPending;

  return (
    <section className={styles.page} aria-labelledby="my-tasks-title">
      <header className={styles.pageHeader}>
        <h1 id="my-tasks-title" className={styles.pageTitle}>
          Minhas tarefas
        </h1>
        <p className={styles.helperText}>
          Visualize todas as ações geradas pelas sequências da organização e acompanhe o que precisa ser feito.
        </p>
      </header>

      <div className={styles.pageBody}>
        <div className={styles.tabList} role="tablist" aria-label="Filtros de tarefas">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              className={styles.tabButton}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {pageError ? (
          <div role="alert" className={styles.errorBanner}>
            {pageError}
          </div>
        ) : null}

        <div className={styles.tableWrapper} role="region" aria-live="polite">
          {filteredTasks.length === 0 ? (
            <div className={styles.emptyState}>
              <h2>Nenhuma tarefa para esse filtro</h2>
              <p className={styles.helperText}>
                Assim que novas tarefas forem geradas pelas sequências, elas aparecerão aqui para você priorizar.
              </p>
              <Button kind={Button.kinds.PRIMARY} disabled>
                Abrir sequência
              </Button>
            </div>
          ) : (
            <table className={styles.table} role="grid" aria-labelledby="my-tasks-title">
              <thead>
                <tr>
                  <th scope="col">Tarefa</th>
                  <th scope="col">Sequência › Step</th>
                  <th scope="col">Vencimento</th>
                  <th scope="col">Status</th>
                  <th scope="col">Sinais</th>
                  <th scope="col">Ações rápidas</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => (
                  <tr key={task.id}>
                    <th scope="row">{task.stepTitle}</th>
                    <td>
                      <div>
                        <strong>{task.sequenceName}</strong>
                      </div>
                      <div className={styles.helperText}>{task.targetType === "contact" ? "Contato" : "Membro"}</div>
                    </td>
                    <td>{formatDate(task.dueAt)}</td>
                    <td>
                      <span className={clsx(styles.statusPill, statusClass(task.status))}>{statusLabel(task.status)}</span>
                    </td>
                    <td>
                      <div className={styles.flags}>
                        {task.isOverdue ? <span className={styles.flag}>Em atraso</span> : null}
                        {task.isSnoozed ? <span className={styles.flag}>Adiado</span> : null}
                        {task.isBlocked ? <span className={styles.flag}>Bloqueado</span> : null}
                      </div>
                    </td>
                  <td>
                    <div className={styles.actions}>
                        <Button
                          kind={Button.kinds.SECONDARY}
                          size={Button.sizes.SMALL}
                          onClick={() => handleComplete(task)}
                          disabled={isBusy}
                        >
                          Concluir
                        </Button>
                        <Button
                          kind={Button.kinds.TERTIARY}
                          size={Button.sizes.SMALL}
                          onClick={() => {
                            setSelectedTask(task);
                            setActionError(null);
                          }}
                          disabled={isBusy}
                        >
                          Adiar
                        </Button>
                        <Button
                          kind={Button.kinds.TERTIARY}
                          size={Button.sizes.SMALL}
                          onClick={() => {
                            setSelectedTask(task);
                            setActionError(null);
                          }}
                          disabled={isBusy}
                        >
                          Ver detalhes
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <TaskDetailsDialog
        task={selectedTask}
        open={Boolean(selectedTask)}
        pendingAction={pendingAction}
        errorMessage={actionError}
        onClose={closeDialog}
        onComplete={() => {
          if (selectedTask) {
            handleComplete(selectedTask);
          }
        }}
        onSnooze={(value) => {
          if (selectedTask) {
            handleSnooze(selectedTask, value);
          }
        }}
      />
    </section>
  );
}
