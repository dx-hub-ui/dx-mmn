"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, type ComponentType } from "react";
import clsx from "clsx";
import {
  Avatar,
  Button,
  Chips,
  Dialog,
  type DialogProps,
  type DialogType,
  DialogContentContainer,
  IconButton,
  Label,
  Modal,
  ModalContent,
  ModalFooter,
  ModalHeader,
  RadioButton,
  Search,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  TextField,
  Tooltip,
} from "@vibe/core";
import { Feedback, LearnMore, Team } from "@vibe/icons";
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

const STATUS_LABEL: Record<SequenceStatus, string> = {
  active: "Ativa",
  paused: "Pausada",
  draft: "Rascunho",
  archived: "Desativada",
};

const STATUS_ORDER: Record<SequenceStatus, number> = {
  active: 0,
  paused: 1,
  draft: 2,
  archived: 3,
};

type SortColumn =
  | "name"
  | "status"
  | "creator"
  | "steps"
  | "days"
  | "activeEnrollments"
  | "totalEnrollments"
  | "openRate"
  | "replyRate"
  | "clickRate"
  | "modified";

type SortState = {
  column: SortColumn;
  direction: "asc" | "desc";
};

const DEFAULT_SORT: SortState = { column: "modified", direction: "desc" };

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

function StatusChip({ status }: { status: SequenceStatus }) {
  const label = STATUS_LABEL[status];
  const color =
    status === "active"
      ? "positive"
      : status === "paused"
        ? "warning"
        : undefined;
  const disabled = status === "archived";

  return (
    <Chips
      id={`status-${status}`}
      ariaLabel={`Status: ${label}`}
      label={label}
      color={color}
      readOnly
      disabled={disabled}
    />
  );
}

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
            <legend>Tipo de público</legend>
            <p className={styles.modalHint}>Escolha o público padrão que será inscrito nesta sequência.</p>
            <div className={styles.modalRadioGroup} role="radiogroup" aria-label="Tipo de público">
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

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }

  return `${value.toFixed(1)}%`;
}

function getCreatorInitials(name: string) {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
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
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [isSkeletonVisible, setSkeletonVisible] = useState(true);

  useEffect(() => {
    const timeout = window.setTimeout(() => setSkeletonVisible(false), 280);
    return () => window.clearTimeout(timeout);
  }, []);

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

  const sorted = useMemo(() => {
    const sortedItems = [...filtered];

    const directionFactor = sort.direction === "asc" ? 1 : -1;

    sortedItems.sort((a, b) => {
      const compare = (valueA: number | string | null, valueB: number | string | null) => {
        if (valueA === valueB) {
          return 0;
        }

        if (valueA === null || valueA === undefined) {
          return -1 * directionFactor;
        }

        if (valueB === null || valueB === undefined) {
          return 1 * directionFactor;
        }

        if (typeof valueA === "number" && typeof valueB === "number") {
          return valueA > valueB ? directionFactor : -directionFactor;
        }

        return String(valueA).localeCompare(String(valueB), "pt-BR", { sensitivity: "base" }) * directionFactor;
      };

      switch (sort.column) {
        case "name":
          return compare(a.name, b.name);
        case "status":
          return compare(STATUS_ORDER[a.status], STATUS_ORDER[b.status]);
        case "creator":
          return compare(a.creator?.name ?? null, b.creator?.name ?? null);
        case "steps":
          return compare(a.stepsTotal, b.stepsTotal);
        case "days":
          return compare(a.estimatedDays ?? a.stepsTotal, b.estimatedDays ?? b.stepsTotal);
        case "activeEnrollments":
          return compare(a.activeEnrollments, b.activeEnrollments);
        case "totalEnrollments":
          return compare(a.totalEnrollments, b.totalEnrollments);
        case "openRate":
          return compare(a.openRate ?? null, b.openRate ?? null);
        case "replyRate":
          return compare(a.replyRate ?? null, b.replyRate ?? null);
        case "clickRate":
          return compare(a.clickRate ?? null, b.clickRate ?? null);
        case "modified":
        default:
          return compare(Date.parse(a.updatedAt), Date.parse(b.updatedAt));
      }
    });

    return sortedItems;
  }, [filtered, sort]);

  const handleSortChange = (column: SortColumn) => {
    setSort((prev) => {
      if (prev.column === column) {
        const nextDirection = prev.direction === "asc" ? "desc" : "asc";
        return { column, direction: nextDirection };
      }
      return { column, direction: "desc" };
    });
  };

  const renderEmptyState = (
    <div className={styles.emptyState} role="status">
      <strong>Nenhuma sequência encontrada</strong>
      <span>Refine os filtros, tente outra busca ou crie uma nova sequência.</span>
      <Button kind={Button.kinds.PRIMARY} onClick={handleOpenModal} disabled={isCreating}>
        Nova sequência
      </Button>
    </div>
  );

  return (
    <section className={styles.page} aria-labelledby="sequence-manager-title">
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <h1 id="sequence-manager-title" className={styles.headerTitle}>
            Sequências
          </h1>
          <Label
            kind={Label.kinds.FILL}
            color={Label.colors.PRIMARY}
            text="Beta"
            className={styles.betaChip}
          />
          <div className={styles.headerActions}>
            <Tooltip content="Aprender mais">
              <IconButton
                size={IconButton.sizes.SMALL}
                ariaLabel="Abrir documentação"
                kind={IconButton.kinds.SECONDARY}
                onClick={() => window.open("https://vibe.monday.com/?path=/docs/components-table--docs", "_blank")}
              >
                <LearnMore />
              </IconButton>
            </Tooltip>
            <Tooltip content="Enviar feedback">
              <IconButton
                size={IconButton.sizes.SMALL}
                ariaLabel="Enviar feedback"
                kind={IconButton.kinds.SECONDARY}
                onClick={() => router.push("/support/feedback?from=sequences")}
              >
                <Feedback />
              </IconButton>
            </Tooltip>
          </div>
        </div>
      </header>

      <div className={styles.toolbarWrapper}>
        <div className={clsx(styles.sequence-manager_toolbar)} role="toolbar" aria-label="Controles de sequências">
          <div className={styles.toolbarLeft}>
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
                <DialogContentContainer className={styles.filtersDialog}>
                  <button
                    type="button"
                    className={styles.resetFilters}
                    onClick={() => {
                      setFilters({ search: "", status: "todos", targetType: "todos" });
                      setFiltersDialogOpen(false);
                    }}
                  >
                    Limpar filtros
                  </button>

                  <div className={styles.filterGroup}>
                    <span className={styles.filterLabel}>Status</span>
                    <div className={styles.filterOptions}>
                      {STATUS_OPTIONS.map((option) => {
                        const selected = filters.status === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            className={styles.filterChip}
                            data-selected={selected ? "true" : undefined}
                            onClick={() => setFilters((prev) => ({ ...prev, status: option }))}
                          >
                            {option === "todos" ? "Todos" : STATUS_LABEL[option as SequenceStatus]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className={styles.filterGroup}>
                    <span className={styles.filterLabel}>Criada para</span>
                    <div className={styles.filterOptions}>
                      {TARGET_OPTIONS.map((option) => {
                        const selected = filters.targetType === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            className={styles.filterChip}
                            data-selected={selected ? "true" : undefined}
                            onClick={() => setFilters((prev) => ({ ...prev, targetType: option }))}
                          >
                            {option === "todos" ? "Todos" : option === "contact" ? "Contatos" : "Membros"}
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

          <div className={styles.toolbarRight}>
            <Search
              value={filters.search}
              placeholder="Buscar por nome ou status"
              onChange={(value) => setFilters((prev) => ({ ...prev, search: value }))}
              className={styles.searchField}
              ariaLabel="Buscar sequência"
            />
          </div>
        </div>
      </div>

      <div className={styles.tableSection}>
        <div className={clsx(styles.sequence-table-card)}>
          <div className={styles.tableScroll}>
            <Table
              columns={[
                { id: "name", title: "Nome da sequência", width: { min: "240px", max: "320px" } },
                { id: "status", title: "Status", width: "140px" },
                { id: "creator", title: "Criada por", width: { min: "180px", max: "220px" } },
                { id: "board", title: "Quadro" },
                { id: "steps", title: "Etapas", width: "90px" },
                { id: "days", title: "Dias", width: "90px" },
                {
                  id: "activeEnrollments",
                  title: "Inscrições ativas",
                  width: "140px",
                  infoContent: "Número de inscrições atualmente em andamento.",
                },
                {
                  id: "totalEnrollments",
                  title: "Inscrições totais",
                  width: "140px",
                  infoContent: "Inscrições acumuladas desde a criação da sequência.",
                },
                {
                  id: "openRate",
                  title: "Taxa de abertura",
                  width: "150px",
                  infoContent: "Percentual de contatos que abriram os envios desta sequência.",
                },
                {
                  id: "replyRate",
                  title: "Taxa de resposta",
                  width: "150px",
                  infoContent: "Percentual de respostas geradas pelas interações da sequência.",
                },
                {
                  id: "clickRate",
                  title: "Taxa de cliques",
                  width: "150px",
                  infoContent: "Percentual de cliques em links enviados pela sequência.",
                },
                { id: "modified", title: "Última modificação", width: { min: "160px", max: "200px" } },
              ]}
              dataState={{ isLoading: isSkeletonVisible }}
              errorState={
                <div className={styles.errorState} role="alert">
                  <strong>Erro ao carregar</strong>
                  <span>Tente atualizar a página para tentar novamente.</span>
                </div>
              }
              emptyState={renderEmptyState}
              className={clsx(styles.sequenceTable, "sequence-table")}
              size={Table.sizes.MEDIUM}
              withoutBorder
            >
              <TableHeader>
                <TableHeaderCell
                  className={styles.tableHeaderCell}
                  title="Nome da sequência"
                  sortState={sort.column === "name" ? sort.direction : "none"}
                  onSortClicked={() => handleSortChange("name")}
                  sortButtonAriaLabel="Ordenar por nome"
                  sticky
                />
                <TableHeaderCell
                  className={styles.tableHeaderCell}
                  title="Status"
                  sortState={sort.column === "status" ? sort.direction : "none"}
                  onSortClicked={() => handleSortChange("status")}
                  sortButtonAriaLabel="Ordenar por status"
                />
                <TableHeaderCell
                  className={styles.tableHeaderCell}
                  title="Criada por"
                  sortState={sort.column === "creator" ? sort.direction : "none"}
                  onSortClicked={() => handleSortChange("creator")}
                  sortButtonAriaLabel="Ordenar por criador"
                />
                <TableHeaderCell className={styles.tableHeaderCell} title="Quadro" />
                <TableHeaderCell
                  className={styles.tableHeaderCell}
                  title="Etapas"
                  sortState={sort.column === "steps" ? sort.direction : "none"}
                  onSortClicked={() => handleSortChange("steps")}
                  sortButtonAriaLabel="Ordenar por quantidade de etapas"
                />
                <TableHeaderCell
                  className={styles.tableHeaderCell}
                  title="Dias"
                  sortState={sort.column === "days" ? sort.direction : "none"}
                  onSortClicked={() => handleSortChange("days")}
                  sortButtonAriaLabel="Ordenar por duração"
                />
                <TableHeaderCell
                  className={styles.tableHeaderCell}
                  title="Inscrições ativas"
                  infoContent="Número de inscrições atualmente em andamento."
                  sortState={sort.column === "activeEnrollments" ? sort.direction : "none"}
                  onSortClicked={() => handleSortChange("activeEnrollments")}
                  sortButtonAriaLabel="Ordenar por inscrições ativas"
                />
                <TableHeaderCell
                  className={styles.tableHeaderCell}
                  title="Inscrições totais"
                  infoContent="Inscrições acumuladas desde a criação da sequência."
                  sortState={sort.column === "totalEnrollments" ? sort.direction : "none"}
                  onSortClicked={() => handleSortChange("totalEnrollments")}
                  sortButtonAriaLabel="Ordenar por inscrições totais"
                />
                <TableHeaderCell
                  className={styles.tableHeaderCell}
                  title="Taxa de abertura"
                  infoContent="Percentual de contatos que abriram os envios desta sequência."
                  sortState={sort.column === "openRate" ? sort.direction : "none"}
                  onSortClicked={() => handleSortChange("openRate")}
                  sortButtonAriaLabel="Ordenar por taxa de abertura"
                />
                <TableHeaderCell
                  className={styles.tableHeaderCell}
                  title="Taxa de resposta"
                  infoContent="Percentual de respostas geradas pelas interações da sequência."
                  sortState={sort.column === "replyRate" ? sort.direction : "none"}
                  onSortClicked={() => handleSortChange("replyRate")}
                  sortButtonAriaLabel="Ordenar por taxa de resposta"
                />
                <TableHeaderCell
                  className={styles.tableHeaderCell}
                  title="Taxa de cliques"
                  infoContent="Percentual de cliques em links enviados pela sequência."
                  sortState={sort.column === "clickRate" ? sort.direction : "none"}
                  onSortClicked={() => handleSortChange("clickRate")}
                  sortButtonAriaLabel="Ordenar por taxa de cliques"
                />
                <TableHeaderCell
                  className={styles.tableHeaderCell}
                  title="Última modificação"
                  sortState={sort.column === "modified" ? sort.direction : "none"}
                  onSortClicked={() => handleSortChange("modified")}
                  sortButtonAriaLabel="Ordenar por data de modificação"
                />
              </TableHeader>

              <TableBody>
                {sorted.map((item) => {
                  const creatorName = item.creator?.name ?? "Equipe";
                  const initials = getCreatorInitials(creatorName);
                  const estimatedDays = item.estimatedDays ?? item.stepsTotal;
                  const boardLabel = item.boardName ?? "Contatos";

                  return (
                    <TableRow
                      key={item.id}
                      className={styles.tableRow}
                      role="button"
                      tabIndex={0}
                      aria-label={`Abrir sequência ${item.name}`}
                      onClick={() => router.push(`/sequences/${item.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          router.push(`/sequences/${item.id}`);
                        }
                      }}
                    >
                      <TableCell sticky>
                        <div className={styles.nameCellContent}>
                          <button
                            type="button"
                            className={styles.sequenceNameButton}
                            onClick={(event) => {
                              event.stopPropagation();
                              router.push(`/sequences/${item.id}`);
                            }}
                            aria-label={`Editar ${item.name}`}
                          >
                            <span>{item.name}</span>
                            <small>{item.targetType === "contact" ? "Público: Contatos" : "Público: Membros"}</small>
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className={styles.statusCell}>
                        <StatusChip status={item.status} />
                      </TableCell>
                      <TableCell>
                        <div className={styles.creatorCell}>
                          <Avatar
                            type={Avatar.types.TEXT}
                            size={Avatar.sizes.SMALL}
                            ariaLabel={`Criado por ${creatorName}`}
                            text={initials}
                            src={item.creator?.avatarUrl ?? undefined}
                          />
                          <div className={styles.creatorName}>
                            <span className={styles.creatorLabel}>{creatorName}</span>
                            <span className={styles.creatorHint}>Responsável</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={styles.boardTag}>
                          <Team aria-hidden />
                          {boardLabel}
                        </span>
                      </TableCell>
                      <TableCell className={styles.metricCell}>{formatNumber(item.stepsTotal)}</TableCell>
                      <TableCell className={styles.metricCell}>{formatNumber(estimatedDays)}</TableCell>
                      <TableCell className={styles.metricCell}>{formatNumber(item.activeEnrollments)}</TableCell>
                      <TableCell className={styles.metricCell}>{formatNumber(item.totalEnrollments)}</TableCell>
                      <TableCell className={clsx(styles.metricCell, item.openRate === null && styles.metricMuted)}>
                        {formatPercent(item.openRate)}
                      </TableCell>
                      <TableCell className={clsx(styles.metricCell, item.replyRate === null && styles.metricMuted)}>
                        {formatPercent(item.replyRate)}
                      </TableCell>
                      <TableCell className={clsx(styles.metricCell, item.clickRate === null && styles.metricMuted)}>
                        {formatPercent(item.clickRate)}
                      </TableCell>
                      <TableCell className={styles.metricCell}>{formatDate(item.updatedAt)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

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
    </section>
  );
}
