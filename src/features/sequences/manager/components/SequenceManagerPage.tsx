"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ComponentType,
  type KeyboardEvent,
} from "react";
import clsx from "clsx";
import {
  Avatar,
  Button,
  Chips,
  Dialog,
  type DialogProps,
  type DialogType,
  DialogContentContainer,
  Label,
  Modal,
  ModalContent,
  ModalFooter,
  ModalHeader,
  RadioButton,
  Search,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  TextField,
  Tooltip,
} from "@vibe/core";
import type { TableColumn } from "@vibe/core";
import { Open, Team } from "@vibe/icons";
import { createSequenceDraftAction } from "@/app/(app)/sequences/actions";
import { trackEvent } from "@/lib/telemetry";
import { useSentrySequenceScope } from "@/lib/observability/sentryClient";
import { filterSequences } from "../normalize";
import type {
  SequenceManagerFilters,
  SequenceManagerItem,
  SequenceStatus,
  SequenceTargetType,
} from "../types";
import styles from "./sequence-manager.module.css";

const STATUS_OPTIONS: (SequenceStatus | "todos")[] = ["todos", "active", "paused", "draft", "archived"];
const TARGET_OPTIONS: (SequenceTargetType | "todos")[] = ["todos", "contact", "member"];

type SortColumn =
  | "name"
  | "status"
  | "createdBy"
  | "board"
  | "steps"
  | "days"
  | "activeEnrollments"
  | "totalEnrollments"
  | "openRate"
  | "replyRate"
  | "clickRate"
  | "updatedAt";

type SortDirection = "asc" | "desc";

type SortState = {
  column: SortColumn;
  direction: SortDirection;
};

const DEFAULT_SORT: SortState = { column: "updatedAt", direction: "desc" };

type TableLoadingStateType = NonNullable<TableColumn["loadingStateType"]>;

const SKELETON_WIDTH_BY_TYPE: Partial<Record<TableLoadingStateType, number | string>> = {
  circle: 32,
  "short-text": "30%",
  "medium-text": "55%",
  "long-text": "80%",
  number: 48,
};

const SKELETON_HEIGHT_BY_TYPE: Partial<Record<TableLoadingStateType, number>> = {
  circle: 32,
  number: 16,
};

const numberFormatter = new Intl.NumberFormat("pt-BR");
const percentFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

type SequenceManagerPageProps = {
  sequences: SequenceManagerItem[];
  orgId: string;
  membershipRole: "org" | "leader" | "rep";
  autoOpenNewModal?: boolean;
};

type NewSequenceModalProps = {
  open: boolean;
  name: string;
  targetType: SequenceTargetType;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onNameChange: (value: string) => void;
  onTargetChange: (value: SequenceTargetType) => void;
  onSubmit: () => void;
};

function NewSequenceModal({
  open,
  name,
  targetType,
  pending,
  error,
  onClose,
  onNameChange,
  onTargetChange,
  onSubmit,
}: NewSequenceModalProps) {
  return (
    <Modal id="new-sequence-modal" show={open} onClose={onClose} width="480px" contentSpacing>
      <ModalHeader title="Nova sequência" />
      <form
        className={styles.modalForm}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <ModalContent className={styles.modalBody}>
          <TextField
            title="Nome da sequência"
            value={name}
            onChange={(value) => onNameChange(value)}
            placeholder="Ex.: Onboarding SDR"
            autoFocus
            required
            maxLength={120}
            disabled={pending}
            validation={error ? { status: "error", text: error } : undefined}
          />

          <fieldset className={styles.modalFieldset} disabled={pending}>
            <legend>Alvo padrão</legend>
            <p className={styles.modalHint}>Escolha quem poderá ser inscrito automaticamente.</p>
            <div className={styles.modalRadioGroup} role="radiogroup" aria-label="Tipo de alvo da sequência">
              <RadioButton
                name="sequence-target"
                value="contact"
                text="Contatos"
                checked={targetType === "contact"}
                onSelect={() => onTargetChange("contact")}
              />
              <RadioButton
                name="sequence-target"
                value="member"
                text="Membros"
                checked={targetType === "member"}
                onSelect={() => onTargetChange("member")}
              />
            </div>
          </fieldset>
        </ModalContent>
        <ModalFooter>
          <Button kind={Button.kinds.TERTIARY} type={Button.types.BUTTON} onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button kind={Button.kinds.PRIMARY} type={Button.types.SUBMIT} loading={pending} disabled={pending}>
            Criar sequência
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

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

function compareStrings(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? "").localeCompare(b ?? "", "pt-BR", { sensitivity: "base" });
}

function compareNumbers(a: number | null | undefined, b: number | null | undefined) {
  if (a == null && b == null) {
    return 0;
  }
  if (a == null) {
    return 1;
  }
  if (b == null) {
    return -1;
  }
  return a - b;
}

function compareDates(a: string | null | undefined, b: string | null | undefined) {
  const aTime = a ? new Date(a).getTime() : null;
  const bTime = b ? new Date(b).getTime() : null;

  if (aTime == null && bTime == null) {
    return 0;
  }
  if (aTime == null) {
    return 1;
  }
  if (bTime == null) {
    return -1;
  }

  return aTime - bTime;
}

function formatPercent(value: number | null | undefined) {
  if (value == null) {
    return "—";
  }

  return `${percentFormatter.format(value)}%`;
}

function formatNumber(value: number | null | undefined) {
  if (value == null) {
    return "—";
  }

  return numberFormatter.format(value);
}

function StatusChip({ status, isActive }: { status: SequenceStatus; isActive: boolean }) {
  const config = {
    active: isActive
      ? { color: "positive" as const, label: "Ativa", disabled: false }
      : { color: "negative" as const, label: "Inativa", disabled: false },
    paused: { color: "warning" as const, label: "Pausada", disabled: false },
    draft: { color: undefined, label: "Rascunho", disabled: false },
    archived: { color: undefined, label: "Desativada", disabled: true },
  } satisfies Record<SequenceStatus, { color: string | undefined; label: string; disabled: boolean }>;

  const { color, label, disabled } = config[status];

  return (
    <Chips
      id={`status-${status}`}
      ariaLabel={label}
      label={label}
      color={color}
      readOnly
      disabled={disabled}
    />
  );
}

function getStatusWeight(item: SequenceManagerItem) {
  if (item.status === "active") {
    return item.isActive ? 0 : 1;
  }

  if (item.status === "paused") {
    return 2;
  }

  if (item.status === "draft") {
    return 3;
  }

  return 4;
}

function SequenceTableSkeletonRow({ columns }: { columns: TableColumn[] }) {
  return (
    <TableRow>
      {columns.map((column) => {
        const type = column.loadingStateType ?? "long-text";
        const skeletonType =
          type === "circle"
            ? Skeleton.types.CIRCLE
            : type === "number"
            ? Skeleton.types.RECTANGLE
            : Skeleton.types.TEXT;

        const width = SKELETON_WIDTH_BY_TYPE[type] ?? "70%";
        const height = SKELETON_HEIGHT_BY_TYPE[type] ?? 12;

        return (
          <TableCell key={`skeleton-${column.id}`}>
            <Skeleton
              type={skeletonType}
              width={width}
              height={height}
              fullWidth={type === "long-text"}
              className={styles.skeleton}
            />
          </TableCell>
        );
      })}
    </TableRow>
  );
}

export default function SequenceManagerPage({
  sequences,
  orgId,
  membershipRole,
  autoOpenNewModal = false,
}: SequenceManagerPageProps) {
  const router = useRouter();
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newSequenceName, setNewSequenceName] = useState("");
  const [newSequenceTarget, setNewSequenceTarget] = useState<SequenceTargetType>("contact");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, startCreating] = useTransition();
  const [filters, setFilters] = useState<SequenceManagerFilters>({
    search: "",
    status: "todos",
    targetType: "todos",
  });
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);
  const [sorting, setSorting] = useState<SortState>(DEFAULT_SORT);
  const [isHydrated, setIsHydrated] = useState(false);

  const PopoverDialog = Dialog as unknown as ComponentType<DialogProps & { type?: DialogType }>;

  useEffect(() => {
    if (!autoOpenNewModal) {
      return;
    }

    setCreateError(null);
    setNewSequenceName("");
    setNewSequenceTarget("contact");
    setNewModalOpen(true);
    router.replace("/sequences", { scroll: false });
  }, [autoOpenNewModal, router]);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const handleOpenModal = () => {
    setCreateError(null);
    setNewSequenceName("");
    setNewSequenceTarget("contact");
    setNewModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isCreating) {
      return;
    }
    setNewModalOpen(false);
    setCreateError(null);
  };

  const handleSubmitNewSequence = () => {
    if (isCreating) {
      return;
    }

    const trimmedName = newSequenceName.trim();

    if (!trimmedName) {
      setCreateError("Informe um nome para a sequência.");
      return;
    }

    if (trimmedName.length < 3) {
      setCreateError("O nome deve ter pelo menos 3 caracteres.");
      return;
    }

    setCreateError(null);
    startCreating(async () => {
      try {
        const result = await createSequenceDraftAction({
          name: trimmedName,
          targetType: newSequenceTarget,
        });

        trackEvent(
          "sequences/new_created_modal",
          { targetType: newSequenceTarget },
          { groups: { orgId } }
        );

        setNewModalOpen(false);
        setNewSequenceName("");
        router.push(`/sequences/${result.sequenceId}`);
      } catch (error) {
        console.error("[sequences] falha ao criar sequência", error);
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Não foi possível criar a sequência. Tente novamente.";
        setCreateError(message);
      }
    });
  };

  useEffect(() => {
    trackEvent(
      "sequence_manager_viewed",
      { total: sequences.length, role: membershipRole },
      { groups: { orgId } }
    );
  }, [membershipRole, orgId, sequences.length]);

  useSentrySequenceScope(
    { orgId },
    {
      message: "sequence_manager_viewed",
      data: { total: sequences.length },
    }
  );

  const filtered = useMemo(() => filterSequences(sequences, filters), [sequences, filters]);

  const statusFilterLabel: Record<SequenceStatus, string> = {
    active: "Ativa",
    paused: "Pausada",
    draft: "Rascunho",
    archived: "Desativada",
  };

  const targetLabel: Record<SequenceTargetType, string> = {
    contact: "Contatos",
    member: "Membros",
  };

  const tableColumns = useMemo<TableColumn[]>(
    () => [
      { id: "name", title: "Nome da sequência", width: "2.4fr", loadingStateType: "long-text" },
      { id: "status", title: "Status", width: "1fr", loadingStateType: "short-text" },
      { id: "createdBy", title: "Criada por", width: 180, loadingStateType: "circle" },
      { id: "board", title: "Quadro", width: 160, loadingStateType: "medium-text" },
      { id: "steps", title: "Etapas", width: 96, loadingStateType: "number" },
      { id: "days", title: "Dias", width: 96, loadingStateType: "number" },
      { id: "activeEnrollments", title: "Inscrições ativas", width: 160, loadingStateType: "number" },
      { id: "totalEnrollments", title: "Inscrições totais", width: 160, loadingStateType: "number" },
      { id: "openRate", title: "Taxa de abertura", width: 160, loadingStateType: "medium-text" },
      { id: "replyRate", title: "Taxa de resposta", width: 160, loadingStateType: "medium-text" },
      { id: "clickRate", title: "Taxa de cliques", width: 160, loadingStateType: "medium-text" },
      { id: "updatedAt", title: "Última modificação", width: 200, loadingStateType: "medium-text" },
    ],
    []
  );

  const skeletonRows = useMemo(() => Array.from({ length: 6 }, (_, index) => index), []);

  const sorted = useMemo(() => {
    const items = [...filtered];
    const { column, direction } = sorting;
    const multiplier = direction === "asc" ? 1 : -1;

    items.sort((a, b) => {
      let result: number;
      switch (column) {
        case "name":
          result = compareStrings(a.name, b.name);
          break;
        case "status":
          result = getStatusWeight(a) - getStatusWeight(b);
          break;
        case "createdBy":
          result = compareStrings(a.createdBy?.name, b.createdBy?.name);
          break;
        case "board":
          result = 0;
          break;
        case "steps":
          result = compareNumbers(a.stepsTotal, b.stepsTotal);
          break;
        case "days":
          result = compareNumbers(a.durationDays ?? null, b.durationDays ?? null);
          break;
        case "activeEnrollments":
          result = compareNumbers(a.activeEnrollments, b.activeEnrollments);
          break;
        case "totalEnrollments":
          result = compareNumbers(
            a.totalEnrollments ?? a.activeEnrollments,
            b.totalEnrollments ?? b.activeEnrollments
          );
          break;
        case "openRate":
          result = compareNumbers(
            a.openRate ?? a.completionRate ?? null,
            b.openRate ?? b.completionRate ?? null
          );
          break;
        case "replyRate":
          result = compareNumbers(a.replyRate ?? null, b.replyRate ?? null);
          break;
        case "clickRate":
          result = compareNumbers(a.clickRate ?? null, b.clickRate ?? null);
          break;
        case "updatedAt":
        default:
          result = compareDates(a.updatedAt, b.updatedAt);
          break;
      }

      if (result === 0) {
        result = compareStrings(a.name, b.name);
      }

      return result * multiplier;
    });

    return items;
  }, [filtered, sorting]);

  const showSkeleton = !isHydrated;
  const dataState = { isLoading: showSkeleton, isEmpty: !showSkeleton && sorted.length === 0 };

  const sortStateFor = (column: SortColumn): SortDirection | "none" =>
    sorting.column === column ? sorting.direction : "none";

  const handleSortColumn = (column: SortColumn, direction: SortDirection | "none") => {
    if (direction === "none") {
      setSorting(DEFAULT_SORT);
      return;
    }

    setSorting({ column, direction });
  };

  const handleRowClick = (sequenceId: string) => {
    router.push(`/sequences/${sequenceId}`);
  };

  const handleRowKeyDown = (event: KeyboardEvent<HTMLDivElement>, sequenceId: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleRowClick(sequenceId);
    }
  };

  const renderMetricHeader = (title: string, tooltip: string) => (
    <span className={styles.metricHeader}>
      <span>{title}</span>
      <Tooltip content={tooltip}>
        <button
          type="button"
          className={styles.metricInfo}
          aria-label={tooltip}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          ?
        </button>
      </Tooltip>
    </span>
  );

  return (
    <>
      <section className={styles.page} aria-labelledby="sequence-manager-title">
        <header className={styles.pageHeader}>
          <div className={styles.headerRow}>
            <div className={styles.titleRow}>
              <h1 id="sequence-manager-title">Sequências</h1>
              <Label
                kind={Label.kinds.FILL}
                color={Label.colors.PRIMARY}
                className={styles.betaLabel}
                text="Beta"
              />
            </div>
            <div className={styles.headerActions}>
              <Button
                kind={Button.kinds.SECONDARY}
                leftIcon="Help"
                className={styles.utilityButton}
                aria-label="Aprender mais sobre sequências"
              >
                Aprender mais
              </Button>
              <Button
                kind={Button.kinds.TERTIARY}
                leftIcon="Feedback"
                className={styles.utilityButton}
                aria-label="Enviar feedback das sequências"
              >
                Feedback
              </Button>
            </div>
          </div>

          <div
            className={clsx(styles.toolbar, "sequence-manager_toolbar")}
            role="toolbar"
            aria-label="Controles de sequências"
          >
            <div className={styles.toolbarPrimary}>
              <Button
                kind={Button.kinds.PRIMARY}
                leftIcon="Add"
                onClick={handleOpenModal}
                disabled={isCreating}
              >
                Nova sequência
              </Button>

              <PopoverDialog
                open={filtersDialogOpen}
                useDerivedStateFromProps
                type="popover"
                position="bottom-start"
                moveBy={{ main: 0, secondary: 8 }}
                showTrigger={[]}
                hideTrigger={[]}
                onClickOutside={() => setFiltersDialogOpen(false)}
                onDialogDidHide={() => setFiltersDialogOpen(false)}
                content={
                  <DialogContentContainer className={styles.filterDialog}>
                    <div className={styles.filterHeader}>
                      <span className={styles.filterTitle}>Filtros</span>
                      <button
                        type="button"
                        className={styles.clearFilters}
                        onClick={() => {
                          setFilters((prev) => ({
                            ...prev,
                            status: "todos",
                            targetType: "todos",
                          }));
                          setFiltersDialogOpen(false);
                        }}
                      >
                        Limpar tudo
                      </button>
                    </div>

                    <div className={styles.filterGroup}>
                      <span className={styles.filterLabel}>Status</span>
                      <div className={styles.filterOptions}>
                        {STATUS_OPTIONS.map((option) => {
                          const isSelected = filters.status === option;
                          return (
                            <button
                              key={option}
                              type="button"
                              className={clsx(styles.filterOption, {
                                [styles.filterOptionSelected]: isSelected,
                              })}
                              onClick={() => setFilters((prev) => ({ ...prev, status: option }))}
                            >
                              {option === "todos" ? "Todos" : statusFilterLabel[option as SequenceStatus]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className={styles.filterGroup}>
                      <span className={styles.filterLabel}>Alvo</span>
                      <div className={styles.filterOptions}>
                        {TARGET_OPTIONS.map((option) => {
                          const isSelected = filters.targetType === option;
                          return (
                            <button
                              key={option}
                              type="button"
                              className={clsx(styles.filterOption, {
                                [styles.filterOptionSelected]: isSelected,
                              })}
                              onClick={() => setFilters((prev) => ({ ...prev, targetType: option }))}
                            >
                              {option === "todos" ? "Todos" : targetLabel[option as SequenceTargetType]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </DialogContentContainer>
                }
              >
                <Button
                  kind={filtersDialogOpen ? Button.kinds.PRIMARY : Button.kinds.SECONDARY}
                  leftIcon="Filter"
                  onClick={() => setFiltersDialogOpen((prev) => !prev)}
                  aria-haspopup="dialog"
                  aria-expanded={filtersDialogOpen}
                >
                  Filtrar
                </Button>
              </PopoverDialog>
            </div>

            <div className={styles.toolbarFilters}>
              <Search
                value={filters.search}
                placeholder="Buscar sequência"
                onChange={(value) => setFilters((prev) => ({ ...prev, search: value }))}
                className={styles.search}
                ariaLabel="Buscar sequência pelo nome"
              />
            </div>
          </div>
        </header>

        <div className={styles.pageBody}>
          <div className={clsx(styles.tableCard, "sequence-table-card")} role="region" aria-live="polite">
            {dataState.isEmpty ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyTitle}>Nenhuma sequência encontrada</span>
                <p>Revise os filtros ou crie uma nova sequência para começar.</p>
                <Button kind={Button.kinds.PRIMARY} onClick={handleOpenModal} disabled={isCreating}>
                  Nova sequência
                </Button>
              </div>
            ) : (
              <div className={styles.tableScroll}>
                <Table
                  columns={tableColumns}
                  dataState={dataState}
                  className={clsx(styles.table, "sequence-table")}
                  emptyState={
                    <div className={styles.emptyState}>
                      <span className={styles.emptyTitle}>Nenhuma sequência encontrada</span>
                      <p>Revise os filtros ou crie uma nova sequência para começar.</p>
                      <Button kind={Button.kinds.PRIMARY} onClick={handleOpenModal} disabled={isCreating}>
                        Nova sequência
                      </Button>
                    </div>
                  }
                >
                  <TableHeader>
                    <TableHeaderCell
                      title="Nome da sequência"
                      sortState={sortStateFor("name")}
                      onSortClicked={(direction) => handleSortColumn("name", direction)}
                      sortButtonAriaLabel="Ordenar por nome da sequência"
                      sticky
                    />
                    <TableHeaderCell
                      title="Status"
                      sortState={sortStateFor("status")}
                      onSortClicked={(direction) => handleSortColumn("status", direction)}
                      sortButtonAriaLabel="Ordenar por status"
                    />
                    <TableHeaderCell
                      title="Criada por"
                      sortState={sortStateFor("createdBy")}
                      onSortClicked={(direction) => handleSortColumn("createdBy", direction)}
                      sortButtonAriaLabel="Ordenar por criador"
                    />
                    <TableHeaderCell
                      title="Quadro"
                      sortState={sortStateFor("board")}
                      onSortClicked={(direction) => handleSortColumn("board", direction)}
                      sortButtonAriaLabel="Ordenar por quadro"
                    />
                    <TableHeaderCell
                      title="Etapas"
                      sortState={sortStateFor("steps")}
                      onSortClicked={(direction) => handleSortColumn("steps", direction)}
                      sortButtonAriaLabel="Ordenar por total de etapas"
                    />
                    <TableHeaderCell
                      title="Dias"
                      sortState={sortStateFor("days")}
                      onSortClicked={(direction) => handleSortColumn("days", direction)}
                      sortButtonAriaLabel="Ordenar por duração"
                    />
                    <TableHeaderCell
                      title={renderMetricHeader(
                        "Inscrições ativas",
                        "Total de pessoas atualmente executando esta sequência."
                      )}
                      sortState={sortStateFor("activeEnrollments")}
                      onSortClicked={(direction) => handleSortColumn("activeEnrollments", direction)}
                      sortButtonAriaLabel="Ordenar por inscrições ativas"
                    />
                    <TableHeaderCell
                      title={renderMetricHeader(
                        "Inscrições totais",
                        "Soma acumulada de inscrições realizadas nesta sequência."
                      )}
                      sortState={sortStateFor("totalEnrollments")}
                      onSortClicked={(direction) => handleSortColumn("totalEnrollments", direction)}
                      sortButtonAriaLabel="Ordenar por inscrições totais"
                    />
                    <TableHeaderCell
                      title={renderMetricHeader(
                        "Taxa de abertura",
                        "Percentual de e-mails abertos pelos inscritos."
                      )}
                      sortState={sortStateFor("openRate")}
                      onSortClicked={(direction) => handleSortColumn("openRate", direction)}
                      sortButtonAriaLabel="Ordenar por taxa de abertura"
                    />
                    <TableHeaderCell
                      title={renderMetricHeader(
                        "Taxa de resposta",
                        "Percentual de respostas recebidas nesta sequência."
                      )}
                      sortState={sortStateFor("replyRate")}
                      onSortClicked={(direction) => handleSortColumn("replyRate", direction)}
                      sortButtonAriaLabel="Ordenar por taxa de resposta"
                    />
                    <TableHeaderCell
                      title={renderMetricHeader(
                        "Taxa de cliques",
                        "Percentual de cliques em links enviados pela sequência."
                      )}
                      sortState={sortStateFor("clickRate")}
                      onSortClicked={(direction) => handleSortColumn("clickRate", direction)}
                      sortButtonAriaLabel="Ordenar por taxa de cliques"
                    />
                    <TableHeaderCell
                      title="Última modificação"
                      sortState={sortStateFor("updatedAt")}
                      onSortClicked={(direction) => handleSortColumn("updatedAt", direction)}
                      sortButtonAriaLabel="Ordenar por última modificação"
                    />
                  </TableHeader>

                  <TableBody>
                    {showSkeleton
                      ? skeletonRows.map((index) => (
                          <SequenceTableSkeletonRow key={`skeleton-${index}`} columns={tableColumns} />
                        ))
                      : sorted.map((item) => {
                          const creatorName = item.createdBy?.name ?? null;
                          const creatorAvatar = item.createdBy?.avatarUrl ?? null;
                          const creatorInitials = creatorName
                            ? creatorName
                                .split(" ")
                                .map((part) => part[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()
                            : undefined;
                          const totalEnrollments = item.totalEnrollments ?? item.activeEnrollments;
                          const durationDays = item.durationDays ?? null;
                          const openRate = item.openRate ?? item.completionRate ?? null;
                          const replyRate = item.replyRate ?? null;
                          const clickRate = item.clickRate ?? null;

                          return (
                            <TableRow
                              key={item.id}
                              className={styles.tableRow}
                              tabIndex={0}
                              onClick={() => handleRowClick(item.id)}
                              onKeyDown={(event) => handleRowKeyDown(event, item.id)}
                              aria-label={`Abrir sequência ${item.name}`}
                            >
                              <TableCell className={styles.nameCell}>
                                <span className={styles.sequenceName}>{item.name}</span>
                                <Open size={16} className={styles.openIcon} aria-hidden />
                              </TableCell>
                              <TableCell>
                                <StatusChip status={item.status} isActive={item.isActive} />
                              </TableCell>
                              <TableCell>
                                {creatorName ? (
                                  <span className={styles.creatorCell}>
                                    <Avatar
                                      size={Avatar.sizes.SMALL}
                                      type={creatorAvatar ? Avatar.types.IMG : Avatar.types.TEXT}
                                      src={creatorAvatar ?? undefined}
                                      text={creatorAvatar ? undefined : creatorInitials}
                                      ariaLabel={`Criada por ${creatorName}`}
                                    />
                                    <span className={styles.creatorName}>{creatorName}</span>
                                  </span>
                                ) : (
                                  <span className={styles.creatorPlaceholder}>—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <span className={styles.boardTag}>
                                  <Team size={16} aria-hidden />
                                  <span>Contatos</span>
                                </span>
                              </TableCell>
                              <TableCell className={styles.metricCell}>{formatNumber(item.stepsTotal)}</TableCell>
                              <TableCell className={styles.metricCell}>{formatNumber(durationDays)}</TableCell>
                              <TableCell className={styles.metricCell}>{formatNumber(item.activeEnrollments)}</TableCell>
                              <TableCell className={styles.metricCell}>{formatNumber(totalEnrollments)}</TableCell>
                              <TableCell className={styles.metricCell}>{formatPercent(openRate)}</TableCell>
                              <TableCell className={styles.metricCell}>{formatPercent(replyRate)}</TableCell>
                              <TableCell className={styles.metricCell}>{formatPercent(clickRate)}</TableCell>
                              <TableCell className={styles.metricCell}>{formatDate(item.updatedAt)}</TableCell>
                            </TableRow>
                          );
                        })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </section>
      <NewSequenceModal
        open={newModalOpen}
        name={newSequenceName}
        targetType={newSequenceTarget}
        pending={isCreating}
        error={createError}
        onClose={handleCloseModal}
        onNameChange={setNewSequenceName}
        onTargetChange={setNewSequenceTarget}
        onSubmit={handleSubmitNewSequence}
      />
    </>
  );
}
