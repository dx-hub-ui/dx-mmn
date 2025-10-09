"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import clsx from "clsx";
import { Button, EmptyState, Flex, Text } from "@vibe/core";
import { useRouter } from "next/navigation";
import { completeAssignmentAction, snoozeAssignmentAction } from "@/app/(app)/tasks/actions";
import { trackEvent } from "@/lib/telemetry";
import { useSentrySequenceScope } from "@/lib/observability/sentryClient";
import { filterTasks, statusLabel } from "../normalize";
import type { AssignmentStatus, MyTaskItem, MyTasksFilter } from "../types";
import styles from "./my-tasks.module.css";
import TaskDetailsDialog from "./TaskDetailsDialog";
import type { TableColumn } from "@vibe/core";
import { Table, TableBody, TableCell, TableContainer, TableHeader, TableHeaderCell, TableRow } from "@vibe/core";

const FILTERS: { id: MyTasksFilter; label: string }[] = [
  { id: "todos", label: "Todas" },
  { id: "abertas", label: "Em aberto" },
  { id: "atrasadas", label: "Em atraso" },
  { id: "bloqueadas", label: "Bloqueadas" },
  { id: "adiadas", label: "Adiados" },
];

type ColumnConfig = TableColumn & {
  sticky?: boolean;
  headerClassName?: string;
};

const COLUMN_CONFIGS: ColumnConfig[] = [
  {
    id: "task",
    title: "Tarefa",
    width: "2fr",
    sticky: true,
    headerClassName: styles.headerCellPrimary,
  },
  {
    id: "sequence",
    title: "Sequência › Step",
    width: "1.6fr",
  },
  {
    id: "due",
    title: "Vencimento",
    width: "1fr",
  },
  {
    id: "status",
    title: "Status",
    width: "1fr",
  },
  {
    id: "signals",
    title: "Sinais",
    width: "1.2fr",
  },
  {
    id: "actions",
    title: "Ações rápidas",
    width: "1.4fr",
    headerClassName: styles.headerCellEnd,
  },
];

type MyTasksPageProps = {
  orgId: string;
  membershipId: string;
  tasks: MyTaskItem[];
};

const STATUS_CLASS_MAP: Record<AssignmentStatus, string> = {
  open: styles.statusOpen,
  done: styles.statusDone,
  snoozed: styles.statusSnoozed,
  blocked: styles.statusBlocked,
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
  const tableColumns = useMemo<TableColumn[]>(
    () => COLUMN_CONFIGS.map(({ headerClassName: _header, sticky: _sticky, ...column }) => column),
    []
  );

  const emptyState = (
    <EmptyState
      title="Nenhuma tarefa para esse filtro"
      description="Assim que novas tarefas forem geradas pelas sequências, elas aparecerão aqui para você priorizar."
      mainAction={<Button kind={Button.kinds.PRIMARY} disabled>Abrir sequência</Button>}
    />
  );

  const tableErrorState = (
    <div className={styles.tableErrorState} role="alert">
      Não foi possível carregar as tarefas.
    </div>
  );

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
        <div className={styles.pageHeaderContent}>
          <Text element="h1" id="my-tasks-title" type={Text.types.TEXT1} weight={Text.weights.BOLD} className={styles.pageTitle}>
            Minhas tarefas
          </Text>
          <Text type={Text.types.TEXT2} color={Text.colors.SECONDARY} className={styles.helperText}>
            Visualize todas as ações geradas pelas sequências da organização e acompanhe o que precisa ser feito.
          </Text>
        </div>
      </header>

      <div className={styles.pageBody}>
        <Flex
          direction={Flex.directions.ROW}
          wrap
          gap={Flex.gaps.SMALL}
          className={styles.toolbar}
          role="toolbar"
          aria-label="Filtros de tarefas"
        >
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
        </Flex>

        {pageError ? (
          <div role="alert" className={styles.errorBanner}>
            {pageError}
          </div>
        ) : null}

        <TableContainer className={styles.tableShell} role="region" aria-live="polite">
          <Table
            aria-labelledby="my-tasks-title"
            columns={tableColumns}
            emptyState={emptyState}
            errorState={tableErrorState}
            withoutBorder
          >
            <TableHeader>
              <TableRow>
                {COLUMN_CONFIGS.map((column) => (
                  <TableHeaderCell
                    key={column.id}
                    title={column.title}
                    sticky={column.sticky}
                    className={column.headerClassName}
                  />
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredTasks.map((task) => (
                <TableRow
                  key={task.id}
                  highlighted={selectedTask?.id === task.id}
                  className={styles.tableRow}
                >
                  <TableCell sticky className={styles.primaryCell}>
                    <div className={styles.primaryTitle}>{task.stepTitle}</div>
                  </TableCell>
                  <TableCell className={styles.sequenceCell}>
                    <div className={styles.sequenceName}>{task.sequenceName}</div>
                    <div className={styles.metaCaption}>{task.targetType === "contact" ? "Contato" : "Membro"}</div>
                  </TableCell>
                  <TableCell className={styles.metaCell}>{formatDate(task.dueAt)}</TableCell>
                  <TableCell className={styles.statusCell}>
                    <span className={clsx(styles.statusBadge, STATUS_CLASS_MAP[task.status] ?? styles.statusOpen)}>
                      {statusLabel(task.status)}
                    </span>
                  </TableCell>
                  <TableCell className={styles.signalsCell}>
                    <div className={styles.flags}>
                      {task.isOverdue ? <span className={styles.flag}>Em atraso</span> : null}
                      {task.isSnoozed ? <span className={styles.flag}>Adiado</span> : null}
                      {task.isBlocked ? <span className={styles.flag}>Bloqueado</span> : null}
                    </div>
                  </TableCell>
                  <TableCell className={styles.actionsCell}>
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
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
