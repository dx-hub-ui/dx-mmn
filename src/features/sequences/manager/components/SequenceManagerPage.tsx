"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, type ComponentType } from "react";
import clsx from "clsx";
import {
  Button,
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
  TextField,
} from "@vibe/core";
import { Open } from "@vibe/icons";
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
          <div className={styles.titleRow}>
            <h1 id="sequence-manager-title">Sequências</h1>
            <Label kind={Label.kinds.FILL} color={Label.colors.PRIMARY} className={styles.betaLabel} text="Beta" />
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
                            {option === "todos" ? "Todos" : statusLabel[option as SequenceStatus]}
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
              placeholder="Buscar por sequência, status ou tipo"
              onChange={(value) => setFilters((prev) => ({ ...prev, search: value }))}
              className={styles.search}
            />
          </div>
        </div>

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
            <table
              className={clsx(styles.table, styles["table_d1c05c112f"])}
              role="grid"
              aria-labelledby="sequence-manager-title"
            >
              <thead>
                <tr>
                  <th scope="col">Sequência</th>
                  <th scope="col">Status</th>
                  <th scope="col">Alvo padrão</th>
                  <th scope="col">Passos</th>
                  <th scope="col">Inscrições ativas</th>
                  <th scope="col">Conclusão</th>
                  <th scope="col">Última ativação</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  return (
                    <tr key={item.id}>
                      <th scope="row" className={styles.nameCell}>
                        <button
                          type="button"
                          className={styles.sequenceButton}
                          onClick={() => router.push(`/sequences/${item.id}`)}
                          aria-label={`Abrir sequência ${item.name}`}
                        >
                          <span className={styles.sequenceName}>{item.name}</span>
                          <Open size={16} className={styles.openIcon} aria-hidden />
                        </button>
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
