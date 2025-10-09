"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import clsx from "clsx";
import {
  BreadcrumbItem,
  BreadcrumbsBar,
  Button,
  Label,
  Modal,
  ModalContent,
  ModalFooter,
  ModalHeader,
  RadioButton,
  Search,
  TextField,
} from "@vibe/core";
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

type SequenceManagerPageProps = {
  sequences: SequenceManagerItem[];
  orgId: string;
  organizationName: string;
  membershipRole: "org" | "leader" | "rep";
  autoOpenNewModal?: boolean;
};

type SelectionState = Set<string>;

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
      <form
        className={styles.modalForm}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <ModalHeader title="Nova sequência" />
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
          <Button
            kind={Button.kinds.TERTIARY}
            type={Button.types.BUTTON}
            onClick={onClose}
            disabled={pending}
          >
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

export default function SequenceManagerPage({
  sequences,
  orgId,
  organizationName,
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

  const [selection, setSelection] = useState<SelectionState>(() => new Set());

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

  useEffect(() => {
    setSelection(new Set());
  }, [filters.status, filters.targetType, filters.search]);

  const filtered = useMemo(() => filterSequences(sequences, filters), [sequences, filters]);

  const statusTotals = useMemo(
    () =>
      sequences.reduce<Record<SequenceStatus | "total", number>>(
        (acc, item) => {
          acc.total += 1;
          acc[item.status] += 1;
          return acc;
        },
        { total: 0, active: 0, paused: 0, draft: 0, archived: 0 }
      ),
    [sequences]
  );

  const allSelected = filtered.length > 0 && filtered.every((item) => selection.has(item.id));
  const selectionCount = selection.size;

  function toggleSelection(sequenceId: string) {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(sequenceId)) {
        next.delete(sequenceId);
      } else {
        next.add(sequenceId);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    setSelection((prev) => {
      if (filtered.length === 0) {
        return new Set();
      }

      const allSelectedNow = filtered.every((item) => prev.has(item.id));
      if (allSelectedNow) {
        return new Set();
      }

      return new Set(filtered.map((item) => item.id));
    });
  }

  const statusLabel: Record<SequenceStatus, string> = {
    active: "Ativa",
    paused: "Pausada",
    draft: "Rascunho",
    archived: "Arquivada",
  };

  const targetLabel: Record<SequenceTargetType, string> = {
    contact: "Contato",
    member: "Membro",
  };

  const badgeClass: Record<SequenceStatus, string> = {
    active: styles.badgeActive,
    paused: styles.badgePaused,
    draft: styles.badgeDraft,
    archived: styles.badgeArchived,
  };

  return (
    <>
      <section className={styles.page} aria-labelledby="sequence-manager-title">
      <header className={styles.pageHeader}>
        <BreadcrumbsBar type={BreadcrumbsBar.types.NAVIGATION} className={styles.breadcrumbs}>
          <BreadcrumbItem text="Workspaces" />
          <BreadcrumbItem text={organizationName} />
          <BreadcrumbItem text="Sequências" isCurrent />
        </BreadcrumbsBar>

        <div className={styles.headerContent}>
          <div className={styles.headerText}>
            <div className={styles.titleRow}>
              <h1 id="sequence-manager-title">Sequências</h1>
              <Label
                kind={Label.kinds.FILL}
                color={Label.colors.PRIMARY}
                className={styles.betaLabel}
                text="Beta"
              />
            </div>
            <p>
              Crie cadências multicanal e acompanhe o progresso das automações da organização {organizationName}.
            </p>
          </div>

          <dl className={styles.metrics} aria-label="Resumo das sequências">
            <div>
              <dt>Total</dt>
              <dd>{statusTotals.total}</dd>
            </div>
            <div>
              <dt>Ativas</dt>
              <dd>{statusTotals.active}</dd>
            </div>
            <div>
              <dt>Pausadas</dt>
              <dd>{statusTotals.paused}</dd>
            </div>
            <div>
              <dt>Rascunhos</dt>
              <dd>{statusTotals.draft}</dd>
            </div>
            <div>
              <dt>Arquivadas</dt>
              <dd>{statusTotals.archived}</dd>
            </div>
          </dl>
        </div>
      </header>

      <div className={styles.pageBody}>
        <div className={styles.toolbar} role="toolbar" aria-label="Controles de sequências">
          <div className={styles.toolbarPrimary}>
            <Button
              kind={Button.kinds.PRIMARY}
              leftIcon="Add"
              onClick={handleOpenModal}
              disabled={isCreating}
            >
              Nova sequência
            </Button>
            <Button kind={Button.kinds.SECONDARY} leftIcon="Filter" disabled>
              Filtrar
            </Button>
          </div>

          <div className={styles.toolbarFilters}>
            <label className={styles.filterLabel} htmlFor="sequence-status-filter">
              Status
            </label>
            <select
              id="sequence-status-filter"
              className={styles.select}
              value={filters.status}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, status: event.target.value as SequenceStatus | "todos" }))
              }
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === "todos"
                    ? "Todos"
                    : statusLabel[option as SequenceStatus]}
                </option>
              ))}
            </select>

            <label className={styles.filterLabel} htmlFor="sequence-target-filter">
              Alvo
            </label>
            <select
              id="sequence-target-filter"
              className={styles.select}
              value={filters.targetType}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, targetType: event.target.value as SequenceTargetType | "todos" }))
              }
            >
              {TARGET_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === "todos" ? "Todos" : targetLabel[option as SequenceTargetType]}
                </option>
              ))}
            </select>

            <Search
              value={filters.search}
              placeholder="Buscar por sequência, status ou tipo"
              onChange={(value) => setFilters((prev) => ({ ...prev, search: value }))}
              className={styles.search}
            />
          </div>
        </div>

        {selectionCount > 0 ? (
          <div className={styles.selectionBanner} role="status" aria-live="polite">
            <div className={styles.selectionInfo}>
              <span>{selectionCount} sequência(s) selecionada(s)</span>
            </div>
            <div className={styles.selectionActions}>
              <Button kind={Button.kinds.PRIMARY} disabled>
                Ativar
              </Button>
              <Button kind={Button.kinds.SECONDARY} disabled>
                Pausar
              </Button>
              <Button kind={Button.kinds.SECONDARY} disabled>
                Desativar
              </Button>
              <Button kind={Button.kinds.TERTIARY} disabled>
                Arquivar
              </Button>
            </div>
          </div>
        ) : null}

        <div className={styles.tableCard} role="region" aria-live="polite">
          {filtered.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyTitle}>Nenhuma sequência encontrada</span>
              <p>Revise os filtros ou crie uma nova sequência para começar.</p>
              <Button kind={Button.kinds.PRIMARY} onClick={handleOpenModal} disabled={isCreating}>
                Nova sequência
              </Button>
            </div>
          ) : (
            <table className={styles.table} role="grid" aria-labelledby="sequence-manager-title">
              <thead>
                <tr>
                  <th className={styles.checkboxCell} scope="col">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todas as sequências filtradas"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th scope="col">Sequência</th>
                  <th scope="col">Status</th>
                  <th scope="col">Alvo padrão</th>
                  <th scope="col">Passos</th>
                  <th scope="col">Inscrições ativas</th>
                  <th scope="col">Conclusão</th>
                  <th scope="col">Última ativação</th>
                  <th scope="col" className={styles.actionsHeader}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const disabledHintId = item.isActive
                    ? `sequence-${item.id}-edit-hint`
                    : undefined;

                  return (
                    <tr key={item.id}>
                      <td className={styles.checkboxCell}>
                        <input
                          type="checkbox"
                          aria-label={`Selecionar sequência ${item.name}`}
                          checked={selection.has(item.id)}
                          onChange={() => toggleSelection(item.id)}
                        />
                      </td>
                      <th scope="row" className={styles.nameCell}>
                        <span className={styles.sequenceName}>{item.name}</span>
                        <span className={styles.sequenceMeta}>Versão #{item.activeVersionNumber || 1}</span>
                      </th>
                      <td>
                        <span className={clsx(styles.badge, badgeClass[item.status])}>{statusLabel[item.status]}</span>
                      </td>
                      <td className={styles.metaCell}>
                        <span>{targetLabel[item.targetType]}</span>
                      </td>
                      <td>{item.stepsTotal}</td>
                      <td>{item.activeEnrollments}</td>
                      <td>{item.completionRate.toFixed(1)}%</td>
                      <td>{formatDate(item.lastActivationAt)}</td>
                      <td className={styles.actionsCell}>
                        <Button
                          kind={Button.kinds.SECONDARY}
                          size={Button.sizes.SMALL}
                          onClick={() => router.push(`/sequences/${item.id}`)}
                          disabled={item.isActive}
                          aria-label={
                            item.isActive
                              ? `Desative ${item.name} para editar`
                              : `Editar sequência ${item.name}`
                          }
                          aria-describedby={disabledHintId}
                        >
                          Editar
                        </Button>
                        {item.isActive ? (
                          <span
                            id={disabledHintId}
                            className={styles.actionsHint}
                          >
                            Desative para editar
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
