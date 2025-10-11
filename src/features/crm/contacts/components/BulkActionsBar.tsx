"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { Button, Dialog, type DialogProps, type DialogType, DialogContentContainer, IconButton, TextField } from "@vibe/core";
import {
  BulkActionPayload,
  BulkActionResult,
  BulkActionType,
  ContactRecord,
  CONTACT_STAGES,
  ContactStageId,
  MembershipSummary,
} from "../types";
import styles from "./bulk-actions-bar.module.css";
import { trackEvent } from "@/lib/telemetry";
import {
  canExecuteBulkAction,
  filterContactsByOwnership,
  getTeamMembershipIds,
  normalizeTagsInput,
} from "../utils/permissions";
import {
  MoreActions,
  Duplicate,
  Download,
  Archive,
  Delete as DeleteIcon,
  ConvertToItem,
  DropdownChevronLeft,
  CloseSmall,
  Apps,
  Group,
  DueDate,
  Connect,
  Tags,
  Completed,
  Downgrade,
} from "@vibe/icons";
import type { ActiveSequenceSummary } from "@/features/crm/contacts/server/listActiveSequences";

const PopoverDialog = Dialog as unknown as ComponentType<DialogProps & { type?: DialogType }>;

type NotificationPayload = { type: "success" | "error" | "warning"; message: string };

function buildCsvRow(values: string[]): string {
  return values
    .map((value) => {
      if (value == null) {
        return "";
      }
      const needsQuotes = value.includes(",") || value.includes("\n") || value.includes(";");
      const escaped = value.replace(/"/g, '""');
      return needsQuotes ? `"${escaped}"` : escaped;
    })
    .join(";");
}

function exportContactsCsv(contacts: ContactRecord[]) {
  const header = [
    "Nome",
    "Dono",
    "Estágio",
    "Telefone",
    "E-mail",
    "Último toque",
    "Próximo passo",
    "Próximo passo em",
    "Indicado por",
    "Tags",
    "Score",
    "Origem",
  ];

  const rows = contacts.map((contact) =>
    buildCsvRow([
      contact.name,
      contact.owner?.displayName ?? "",
      CONTACT_STAGES.find((stage) => stage.id === contact.stage)?.label ?? contact.stage,
      contact.whatsapp ?? "",
      contact.email ?? "",
      contact.lastTouchAt ?? "",
      contact.nextActionNote ?? "",
      contact.nextActionAt ?? "",
      contact.referredBy?.name ?? "",
      contact.tags.join(", "),
      contact.score != null ? String(contact.score) : "",
      contact.source ?? "",
    ])
  );

  const content = [buildCsvRow(header), ...rows].join("\n");
  const blob = new Blob(["\ufeff", content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `contatos-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

type PanelState =
  | { type: "stage"; locked?: boolean; presetStage?: string }
  | { type: "owner" }
  | { type: "next_step" }
  | { type: "referral" }
  | { type: "tags" }
  | { type: "confirm"; action: BulkActionType; title: string; message: string }
  | { type: "merge" }
  | { type: "info"; title: string; message: string }
  | null;

type BulkActionsBarProps = {
  organizationId: string;
  actorMembershipId: string;
  selectedIds: string[];
  contacts: ContactRecord[];
  currentMembership: MembershipSummary;
  memberships: MembershipSummary[];
  onClear: () => void;
  onUpdate: (updated: ContactRecord[], removedIds: string[]) => void;
  sequences: ActiveSequenceSummary[];
  onNotify: (feedback: NotificationPayload) => void;
};

export default function BulkActionsBar({
  organizationId,
  actorMembershipId,
  selectedIds,
  contacts,
  currentMembership,
  memberships,
  onClear,
  onUpdate,
  sequences,
  onNotify,
}: BulkActionsBarProps) {
  const [panel, setPanel] = useState<PanelState>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [menuView, setMenuView] = useState<"actions" | "sequences" | "convert" | "advanced">("actions");
  const [menuSearch, setMenuSearch] = useState("");
  const [menuActionLoading, setMenuActionLoading] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");

  const selectedContacts = useMemo(() => contacts.filter((contact) => selectedIds.includes(contact.id)), [
    contacts,
    selectedIds,
  ]);
  const accessibleContacts = useMemo(
    () => filterContactsByOwnership(selectedContacts, currentMembership, memberships),
    [selectedContacts, currentMembership, memberships]
  );

  const [stageValue, setStageValue] = useState<string>("followup");
  const [lostReason, setLostReason] = useState("");
  const [lostReviewAt, setLostReviewAt] = useState("");
  const [ownerId, setOwnerId] = useState<string>(currentMembership.id);
  const [nextStepNote, setNextStepNote] = useState("");
  const [nextStepDate, setNextStepDate] = useState("");
  const [applyIfEmpty, setApplyIfEmpty] = useState(false);
  const [referralId, setReferralId] = useState("");
  const [tagsMode, setTagsMode] = useState<"add" | "remove">("add");
  const [tagsInput, setTagsInput] = useState("");
  const [mergePrimaryId, setMergePrimaryId] = useState<string>("");

  const previousCount = useRef(0);
  useEffect(() => {
    if (selectedIds.length > 0 && previousCount.current === 0) {
      trackEvent("crm/bulkbar_open", { count: selectedIds.length });
    }
    previousCount.current = selectedIds.length;
  }, [selectedIds.length]);

  useEffect(() => {
    setOwnerId(currentMembership.id);
  }, [currentMembership.id]);

  useEffect(() => {
    if (panel?.type === "merge" && mergePrimaryId === "") {
      setMergePrimaryId(selectedContacts[0]?.id ?? "");
    }
  }, [panel, selectedContacts, mergePrimaryId]);

  useEffect(() => {
    if (panel?.type === "stage" && panel.presetStage) {
      setStageValue(panel.presetStage);
    }
  }, [panel]);

  useEffect(() => {
    if (!actionsOpen) {
      setMenuView("actions");
      setMenuSearch("");
      setMenuActionLoading(null);
    }
  }, [actionsOpen]);

  useEffect(() => {
    if (selectedIds.length === 0) {
      closeActionsMenu();
      closeDeleteModal();
    }
  }, [selectedIds.length]);

  useEffect(() => {
    setMenuSearch("");
  }, [menuView]);

  const allowedOwnerIds = useMemo(() => new Set(getTeamMembershipIds(currentMembership, memberships)), [
    currentMembership,
    memberships,
  ]);

  const filteredSequences = useMemo(() => {
    if (sequences.length === 0) {
      return [] as ActiveSequenceSummary[];
    }
    const term = menuSearch.trim().toLowerCase();
    const base = term
      ? sequences.filter((sequence) => sequence.name.toLowerCase().includes(term))
      : sequences;
    return [...base].sort((a, b) => {
      if (a.updatedAt && b.updatedAt) {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      if (a.updatedAt) {
        return -1;
      }
      if (b.updatedAt) {
        return 1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [sequences, menuSearch]);

  const availableParentContacts = useMemo(() => {
    const candidates = contacts.filter((contact) => !selectedIds.includes(contact.id));
    const term = menuSearch.trim().toLowerCase();
    const sorted = [...candidates].sort((a, b) => a.name.localeCompare(b.name));
    if (!term) {
      return sorted;
    }
    return sorted.filter((contact) => {
      const haystack = `${contact.name} ${contact.email ?? ""}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [contacts, selectedIds, menuSearch]);

  const canExecute = (action: BulkActionType) => canExecuteBulkAction(currentMembership.role, action);

  function closePanel() {
    setPanel(null);
    setLostReason("");
    setLostReviewAt("");
    setNextStepNote("");
    setNextStepDate("");
    setApplyIfEmpty(false);
    setReferralId("");
    setTagsInput("");
    setTagsMode("add");
    setError(null);
  }

  async function runAction(
    action: BulkActionPayload,
    options?: { successMessage?: string; notifyMessage?: string }
  ): Promise<boolean> {
    setLoading(true);
    setFeedback(null);
    setError(null);
    let success = false;
    try {
      const response = await fetch("/api/crm/contacts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          contactIds: selectedIds,
          actorMembershipId,
          action,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(payload.error ?? "Erro ao executar ação");
      }

      const result = (await response.json()) as BulkActionResult;
      if (result.updated.length > 0 || result.removedIds.length > 0) {
        onUpdate(result.updated, result.removedIds);
      }

      if (result.errors.length > 0) {
        setError(result.errors.map((item) => item.message).join("; "));
      } else {
        const message = options?.successMessage ?? `${selectedIds.length} contato(s) atualizados.`;
        setFeedback(message);
        if (options?.notifyMessage) {
          onNotify({ type: "success", message: options.notifyMessage });
        }
        success = true;
      }

      trackEvent("crm/bulk_action_execute", { action: action.type, count: selectedIds.length });
      closePanel();
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao executar ação");
      return false;
    } finally {
      setLoading(false);
    }
  }

  function closeActionsMenu() {
    setActionsOpen(false);
    setMenuView("actions");
    setMenuSearch("");
    setMenuActionLoading(null);
  }

  function openPanelState(state: PanelState) {
    closeActionsMenu();
    setPanel(state);
  }

  function openDeleteModal() {
    closeActionsMenu();
    setDeleteStep(1);
    setDeleteConfirmInput("");
    setDeleteModalOpen(true);
    setError(null);
  }

  function closeDeleteModal() {
    setDeleteModalOpen(false);
    setDeleteStep(1);
    setDeleteConfirmInput("");
  }

  async function handleAddContactsToSequence(sequence: ActiveSequenceSummary) {
    setMenuActionLoading(`sequence:${sequence.id}`);
    setError(null);
    try {
      const response = await fetch("/api/crm/contacts/add-to-sequence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          actorMembershipId,
          sequenceId: sequence.id,
          contactIds: selectedIds,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Erro ao adicionar à sequência");
      }

      const enrolled = typeof payload.enrolled === "number" ? payload.enrolled : selectedIds.length;
      const skipped = typeof payload.skipped === "number" ? payload.skipped : 0;
      const message = skipped > 0
        ? `${enrolled} contato(s) adicionados e ${skipped} ignorados em ${sequence.name}.`
        : `${enrolled} contato(s) adicionados à sequência ${sequence.name}.`;
      setFeedback(message);
      onNotify({ type: "success", message });
      trackEvent("crm/bulk_add_to_sequence", { sequenceId: sequence.id, count: enrolled, skipped });
      closeActionsMenu();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar à sequência");
    } finally {
      setMenuActionLoading(null);
      setMenuView("actions");
    }
  }

  async function handleDuplicateSelected() {
    if (selectedContacts.length === 0) {
      return;
    }
    setMenuActionLoading("duplicate");
    setError(null);
    try {
      const created: ContactRecord[] = [];
      for (const contact of selectedContacts) {
        const response = await fetch("/api/crm/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId,
            actorMembershipId,
            ownerMembershipId: contact.ownerMembershipId ?? currentMembership.id,
            name: `${contact.name} (cópia)`,
            email: contact.email,
            whatsapp: contact.whatsapp,
            stage: contact.stage,
            tags: contact.tags,
            score: contact.score,
            nextActionAt: contact.nextActionAt,
            nextActionNote: contact.nextActionNote,
            referredByContactId: contact.referredByContactId ?? null,
            source: contact.source ?? null,
          }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error ?? "Erro ao duplicar contatos");
        }
        created.push(payload.contact as ContactRecord);
      }

      if (created.length > 0) {
        onUpdate(created, []);
        const message = `${created.length} contato(s) duplicado(s).`;
        setFeedback(message);
        onNotify({ type: "success", message });
        trackEvent("crm/bulk_duplicate_contacts", { count: created.length });
      }
      closeActionsMenu();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao duplicar contatos");
    } finally {
      setMenuActionLoading(null);
    }
  }

  async function handleConvertSelection(parent: ContactRecord | null) {
    setMenuActionLoading(`convert:${parent ? parent.id : "none"}`);
    const success = await runAction(
      { type: "referral", referredByContactId: parent ? parent.id : null },
      {
        successMessage: parent
          ? `${selectedIds.length} contato(s) vinculados a ${parent.name}.`
          : `${selectedIds.length} contato(s) atualizados sem contato pai.`,
        notifyMessage: parent ? `Contato pai definido como ${parent.name}.` : "Contato pai removido.",
      }
    );
    setMenuActionLoading(null);
    if (success) {
      closeActionsMenu();
      setMenuView("actions");
    }
  }

  async function handleArchive() {
    setMenuActionLoading("archive");
    const success = await runAction(
      { type: "archive" },
      {
        successMessage: `${selectedIds.length} contato(s) arquivados.`,
        notifyMessage: `${selectedIds.length} contato(s) arquivados.`,
      }
    );
    setMenuActionLoading(null);
    if (success) {
      closeActionsMenu();
    }
  }

  async function handleMarkCadastrado() {
    setMenuActionLoading("mark_cadastrado");
    const success = await runAction(
      { type: "mark_cadastrado" },
      {
        successMessage: `${selectedIds.length} contato(s) marcados como cadastrados.`,
        notifyMessage: `${selectedIds.length} contato(s) marcados como cadastrados.`,
      }
    );
    setMenuActionLoading(null);
    if (success) {
      closeActionsMenu();
    }
  }

  async function handleUnarchive() {
    setMenuActionLoading("unarchive");
    const success = await runAction(
      { type: "unarchive" },
      {
        successMessage: `${selectedIds.length} contato(s) reativados.`,
        notifyMessage: `${selectedIds.length} contato(s) reativados.`,
      }
    );
    setMenuActionLoading(null);
    if (success) {
      closeActionsMenu();
    }
  }

  async function handleDeleteConfirm() {
    const success = await runAction(
      { type: "delete" },
      {
        successMessage: `${selectedIds.length} contato(s) apagados.`,
        notifyMessage: `${selectedIds.length} contato(s) apagados.`,
      }
    );
    if (success) {
      closeDeleteModal();
      closeActionsMenu();
    }
  }

  function handleExportCsv() {
    exportContactsCsv(selectedContacts);
    const message = `${selectedContacts.length} contato(s) exportados para CSV.`;
    setFeedback(message);
    onNotify({ type: "success", message });
    closeActionsMenu();
  }

  function handleStageSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stageValue === "perdido" && !lostReason.trim()) {
      setError("Informe o motivo da perda");
      return;
    }
    const stageId = stageValue as ContactStageId;
    const payload: BulkActionPayload =
      stageId === "perdido"
        ? {
            type: "stage",
            stage: stageId,
            lostReason: lostReason.trim(),
            lostReviewAt: lostReviewAt ? new Date(lostReviewAt).toISOString() : null,
          }
        : {
            type: "stage",
            stage: stageId,
          };
    void runAction(payload);
  }

  function handleNextStepSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: BulkActionPayload = {
      type: "next_step",
      note: nextStepNote.trim() || null,
      date: nextStepDate ? new Date(nextStepDate).toISOString() : null,
      applyIfEmpty,
    };
    void runAction(payload);
  }

  function handleReferralSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = referralId.trim();
    const payload: BulkActionPayload = {
      type: "referral",
      referredByContactId: value || null,
    };
    void runAction(payload);
  }

  function handleTagsSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const tags = normalizeTagsInput(tagsInput.split(","));
    if (tags.length === 0) {
      setError("Informe pelo menos uma tag");
      return;
    }
    void runAction({ type: "tags", mode: tagsMode, tags });
  }

  function handleOwnerSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!allowedOwnerIds.has(ownerId)) {
      setError("Selecione um dono válido");
      return;
    }
    void runAction({ type: "owner", ownerMembershipId: ownerId });
  }

  function handleMergeSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedIds.length !== 2) {
      setError("Selecione exatamente dois contatos");
      return;
    }
    if (!mergePrimaryId) {
      setError("Selecione o contato principal");
      return;
    }
    void runAction({ type: "merge", primaryContactId: mergePrimaryId });
  }

  const disableStage = !canExecute("stage");
  const disableOwner = !canExecute("owner");
  const disableNextStep = !canExecute("next_step");
  const disableReferral = !canExecute("referral");
  const disableTags = !canExecute("tags");
  const disableMarkCadastrado = !canExecute("mark_cadastrado");
  const disableMarkPerdido = !canExecute("mark_perdido");
  const disableArchive = !canExecute("archive");
  const disableUnarchive = !canExecute("unarchive");
  const disableDelete = !canExecute("delete");
  const disableMerge = !canExecute("merge") || selectedIds.length !== 2;
  const hasAdvancedActions = !(
    disableStage &&
    disableOwner &&
    disableNextStep &&
    disableReferral &&
    disableTags &&
    disableMarkCadastrado &&
    disableMarkPerdido &&
    disableMerge &&
    disableUnarchive
  );
  const isBusy = loading || menuActionLoading !== null;

  return (
    <>
      <div
        className={styles.bulkBar}
        role="region"
        aria-label={`Barra de ações — ${selectedIds.length} contato(s) selecionado(s)`}
      >
        <div className={styles.barHeader}>
          <div className={styles.selectionBadge} aria-live="polite">
            <span className={styles.selectionCount}>{selectedIds.length}</span>
            <span>contato(s) selecionado(s)</span>
          </div>
          <div className={styles.barActions}>
            <PopoverDialog
              open={actionsOpen}
              type="popover"
              position="bottom-end"
              moveBy={{ main: 4, secondary: 0 }}
              showTrigger={[]}
              hideTrigger={[]}
              onClickOutside={closeActionsMenu}
              onDialogDidHide={() => setActionsOpen(false)}
              content={
                <DialogContentContainer className={styles.actionsMenu} role="menu">
                  {menuView === "actions" ? (
                    <div className={styles.menuSection}>
                      <button
                        type="button"
                        className={styles.menuItem}
                        onClick={() => setMenuView("sequences")}
                        disabled={sequences.length === 0}
                        aria-disabled={sequences.length === 0}
                      >
                        <Apps className={styles.menuIcon} aria-hidden="true" />
                        <span className={styles.menuText}>
                          <span className={styles.menuTitle}>Adicionar à sequência</span>
                          <span className={styles.menuSubtitle}>
                            {sequences.length === 0
                              ? "Nenhuma sequência ativa disponível"
                              : "Inscreva os contatos em uma sequência ativa"}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className={styles.menuItem}
                        onClick={handleDuplicateSelected}
                        disabled={isBusy}
                      >
                        <Duplicate className={styles.menuIcon} aria-hidden="true" />
                        <span className={styles.menuText}>
                          <span className={styles.menuTitle}>Duplicar</span>
                          <span className={styles.menuSubtitle}>Cria cópias mantendo dono e status atuais</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className={styles.menuItem}
                        onClick={handleExportCsv}
                        disabled={isBusy}
                      >
                        <Download className={styles.menuIcon} aria-hidden="true" />
                        <span className={styles.menuText}>
                          <span className={styles.menuTitle}>Exportar</span>
                          <span className={styles.menuSubtitle}>Gera um CSV com os contatos selecionados</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className={styles.menuItem}
                        onClick={handleArchive}
                        disabled={disableArchive || isBusy}
                        aria-disabled={disableArchive || isBusy}
                      >
                        <Archive className={styles.menuIcon} aria-hidden="true" />
                        <span className={styles.menuText}>
                          <span className={styles.menuTitle}>Arquivar</span>
                          <span className={styles.menuSubtitle}>Move os contatos para o arquivo</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className={styles.menuItem}
                        onClick={() => {
                          setMenuView("convert");
                        }}
                        disabled={disableReferral}
                        aria-disabled={disableReferral}
                      >
                        <ConvertToItem className={styles.menuIcon} aria-hidden="true" />
                        <span className={styles.menuText}>
                          <span className={styles.menuTitle}>Converter</span>
                          <span className={styles.menuSubtitle}>Atribui um contato pai para os selecionados</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className={styles.menuItemDanger}
                        onClick={openDeleteModal}
                        disabled={disableDelete}
                        aria-disabled={disableDelete}
                      >
                        <DeleteIcon className={styles.menuIcon} aria-hidden="true" />
                        <span className={styles.menuText}>
                          <span className={styles.menuTitle}>Apagar</span>
                          <span className={styles.menuSubtitle}>Remove definitivamente os contatos selecionados</span>
                        </span>
                      </button>
                    </div>
                  ) : menuView === "sequences" ? (
                    <div className={styles.menuSection}>
                      <div className={styles.menuHeader}>
                        <IconButton
                          icon={DropdownChevronLeft}
                          ariaLabel="Voltar"
                          kind={IconButton.kinds.TERTIARY}
                          size={IconButton.sizes.SMALL}
                          onClick={() => setMenuView("actions")}
                        />
                        <span className={styles.menuTitle}>Escolher sequência</span>
                      </div>
                      <TextField
                        title="Buscar sequência"
                        placeholder="Buscar por nome"
                        value={menuSearch}
                        onChange={(value) => setMenuSearch(value)}
                        autoFocus
                      />
                      <div className={styles.menuList}>
                        {filteredSequences.length === 0 ? (
                          <p className={styles.emptyMessage}>Nenhuma sequência encontrada.</p>
                        ) : (
                          filteredSequences.map((sequence) => (
                            <button
                              type="button"
                              key={sequence.id}
                              className={styles.menuItem}
                              onClick={() => handleAddContactsToSequence(sequence)}
                              disabled={menuActionLoading !== null && menuActionLoading !== `sequence:${sequence.id}`}
                            >
                              <Apps className={styles.menuIcon} aria-hidden="true" />
                              <span className={styles.menuText}>
                                <span className={styles.menuTitle}>{sequence.name}</span>
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  ) : menuView === "advanced" ? (
                    <div className={styles.menuSection}>
                      <div className={styles.menuHeader}>
                        <IconButton
                          icon={DropdownChevronLeft}
                          ariaLabel="Voltar"
                          kind={IconButton.kinds.TERTIARY}
                          size={IconButton.sizes.SMALL}
                          onClick={() => setMenuView("actions")}
                        />
                        <span className={styles.menuTitle}>Ações avançadas</span>
                      </div>
                      <div className={styles.menuList}>
                        <button
                          type="button"
                          className={styles.menuItem}
                          onClick={() => openPanelState({ type: "stage" })}
                          disabled={disableStage}
                          aria-disabled={disableStage}
                        >
                          <Apps className={styles.menuIcon} aria-hidden="true" />
                          <span className={styles.menuText}>
                            <span className={styles.menuTitle}>Mover estágio</span>
                            <span className={styles.menuSubtitle}>Atualiza o status dos contatos selecionados</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          className={styles.menuItem}
                          onClick={() => openPanelState({ type: "owner" })}
                          disabled={disableOwner}
                          aria-disabled={disableOwner}
                        >
                          <Group className={styles.menuIcon} aria-hidden="true" />
                          <span className={styles.menuText}>
                            <span className={styles.menuTitle}>Atribuir dono</span>
                            <span className={styles.menuSubtitle}>Redefine o responsável pelos contatos</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          className={styles.menuItem}
                          onClick={() => openPanelState({ type: "next_step" })}
                          disabled={disableNextStep}
                          aria-disabled={disableNextStep}
                        >
                          <DueDate className={styles.menuIcon} aria-hidden="true" />
                          <span className={styles.menuText}>
                            <span className={styles.menuTitle}>Definir próximo passo</span>
                            <span className={styles.menuSubtitle}>Agenda nota e data para acompanhamento</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          className={styles.menuItem}
                          onClick={() => openPanelState({ type: "referral" })}
                          disabled={disableReferral}
                          aria-disabled={disableReferral}
                        >
                          <Connect className={styles.menuIcon} aria-hidden="true" />
                          <span className={styles.menuText}>
                            <span className={styles.menuTitle}>Definir contato pai</span>
                            <span className={styles.menuSubtitle}>
                              Atualiza o campo &quot;Indicado por&quot;
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          className={styles.menuItem}
                          onClick={() => openPanelState({ type: "tags" })}
                          disabled={disableTags}
                          aria-disabled={disableTags}
                        >
                          <Tags className={styles.menuIcon} aria-hidden="true" />
                          <span className={styles.menuText}>
                            <span className={styles.menuTitle}>Atualizar tags</span>
                            <span className={styles.menuSubtitle}>Adiciona ou remove etiquetas em massa</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          className={styles.menuItem}
                          onClick={handleMarkCadastrado}
                          disabled={disableMarkCadastrado || isBusy}
                          aria-disabled={disableMarkCadastrado || isBusy}
                        >
                          <Completed className={styles.menuIcon} aria-hidden="true" />
                          <span className={styles.menuText}>
                            <span className={styles.menuTitle}>Marcar como cadastrado</span>
                            <span className={styles.menuSubtitle}>Conclui os contatos no funil</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          className={styles.menuItem}
                          onClick={() => openPanelState({ type: "stage", locked: true, presetStage: "perdido" })}
                          disabled={disableMarkPerdido}
                          aria-disabled={disableMarkPerdido}
                        >
                          <Downgrade className={styles.menuIcon} aria-hidden="true" />
                          <span className={styles.menuText}>
                            <span className={styles.menuTitle}>Marcar como perdido</span>
                            <span className={styles.menuSubtitle}>Solicita motivo e data de revisão</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          className={styles.menuItem}
                          onClick={() => openPanelState({ type: "merge" })}
                          disabled={disableMerge}
                          aria-disabled={disableMerge}
                        >
                          <Duplicate className={styles.menuIcon} aria-hidden="true" />
                          <span className={styles.menuText}>
                            <span className={styles.menuTitle}>Mesclar duplicados</span>
                            <span className={styles.menuSubtitle}>Une dois contatos em um só registro</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          className={styles.menuItem}
                          onClick={handleUnarchive}
                          disabled={disableUnarchive || isBusy}
                          aria-disabled={disableUnarchive || isBusy}
                        >
                          <Archive className={styles.menuIcon} aria-hidden="true" />
                          <span className={styles.menuText}>
                            <span className={styles.menuTitle}>Reativar contatos</span>
                            <span className={styles.menuSubtitle}>Retorna contatos arquivados ao funil</span>
                          </span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.menuSection}>
                      <div className={styles.menuHeader}>
                        <IconButton
                          icon={DropdownChevronLeft}
                          ariaLabel="Voltar"
                          kind={IconButton.kinds.TERTIARY}
                          size={IconButton.sizes.SMALL}
                          onClick={() => setMenuView("actions")}
                        />
                        <span className={styles.menuTitle}>Selecionar contato pai</span>
                      </div>
                      <TextField
                        title="Buscar contato"
                        placeholder="Buscar por nome ou e-mail"
                        value={menuSearch}
                        onChange={(value) => setMenuSearch(value)}
                        autoFocus
                      />
                      <div className={styles.menuList}>
                        <button
                          type="button"
                          className={styles.menuItem}
                          onClick={() => handleConvertSelection(null)}
                          disabled={isBusy}
                        >
                          <span className={styles.menuText}>
                            <span className={styles.menuTitle}>Remover contato pai</span>
                            <span className={styles.menuSubtitle}>Limpa o relacionamento atual</span>
                          </span>
                        </button>
                        {availableParentContacts.length === 0 ? (
                          <p className={styles.emptyMessage}>Nenhum contato disponível para atribuir.</p>
                        ) : (
                          availableParentContacts.map((contact) => (
                            <button
                              type="button"
                              key={contact.id}
                              className={styles.menuItem}
                              onClick={() => handleConvertSelection(contact)}
                              disabled={menuActionLoading !== null && menuActionLoading !== `convert:${contact.id}`}
                            >
                              <span className={styles.menuText}>
                                <span className={styles.menuTitle}>{contact.name}</span>
                                {contact.email ? (
                                  <span className={styles.menuSubtitle}>{contact.email}</span>
                                ) : null}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </DialogContentContainer>
              }
            >
              <IconButton
                icon={MoreActions}
                ariaLabel="Abrir menu de ações em lote"
                kind={IconButton.kinds.SECONDARY}
                size={IconButton.sizes.SMALL}
                className={styles.actionsTrigger}
                onClick={() => setActionsOpen((open) => !open)}
              />
            </PopoverDialog>
            <Button kind={Button.kinds.TERTIARY} type="button" onClick={onClear}>
              Fechar
            </Button>
          </div>
        </div>
        <div className={styles.barSecondary}>
          <span className={styles.barHint}>Ações aplicam mudanças em todos os contatos selecionados.</span>
          <Button
            kind={Button.kinds.TERTIARY}
            type="button"
            className={styles.advancedTrigger}
            disabled={!hasAdvancedActions}
            aria-disabled={!hasAdvancedActions}
            onClick={() => {
              if (!hasAdvancedActions) {
                return;
              }
              setMenuView("advanced");
              setActionsOpen(true);
            }}
          >
            Ações avançadas
          </Button>
        </div>
        {feedback ? <div className={styles.feedback}>{feedback}</div> : null}
        {error ? <div className={styles.errorMessage}>{error}</div> : null}
        {selectedContacts.length !== accessibleContacts.length ? (
          <div className={styles.errorMessage}>
            Alguns contatos selecionados não podem ser atualizados com seu papel atual.
          </div>
        ) : null}
      </div>

      {deleteModalOpen ? (
        <div className={styles.deleteOverlay} role="presentation" onMouseDown={closeDeleteModal}>
          <div
            className={styles.deleteModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-delete-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.deleteHeader}>
              <h2 id="bulk-delete-title">Confirmar exclusão</h2>
              <IconButton
                icon={CloseSmall}
                ariaLabel="Fechar modal de exclusão"
                kind={IconButton.kinds.TERTIARY}
                size={IconButton.sizes.SMALL}
                onClick={closeDeleteModal}
              />
            </div>
            <div className={styles.deleteBody}>
              {deleteStep === 1 ? (
                <p className={styles.deleteDescription}>
                  Você está prestes a apagar <strong>{selectedIds.length}</strong> contato(s). Essa ação não pode ser desfeita.
                </p>
              ) : (
                <>
                  <p className={styles.deleteDescription}>
                    Digite <strong>APAGAR</strong> para confirmar a exclusão definitiva.
                  </p>
                  <TextField
                    title="Confirme digitando APAGAR"
                    placeholder="APAGAR"
                    value={deleteConfirmInput}
                    onChange={(value) => setDeleteConfirmInput(value)}
                    autoFocus
                  />
                </>
              )}
            </div>
            <div className={styles.deleteFooter}>
              <Button kind={Button.kinds.TERTIARY} type="button" onClick={closeDeleteModal}>
                Cancelar
              </Button>
              {deleteStep === 1 ? (
                <Button kind={Button.kinds.SECONDARY} type="button" onClick={() => setDeleteStep(2)}>
                  Continuar
                </Button>
              ) : (
                <Button
                  kind={Button.kinds.PRIMARY}
                  type="button"
                  onClick={handleDeleteConfirm}
                  loading={loading}
                  disabled={deleteConfirmInput.trim().toUpperCase() !== "APAGAR" || loading}
                >
                  Apagar definitivamente
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {panel ? (
        <div className={styles.panelOverlay} role="presentation" onClick={closePanel}>
          <div
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-panel-title"
            onClick={(event) => event.stopPropagation()}
          >
            {panel.type === "stage" && (
              <form onSubmit={handleStageSubmit}>
                <h2 id="bulk-panel-title">Mover estágio</h2>
                {!panel.locked ? (
                  <div className={styles.field}>
                    <label htmlFor="bulk-stage">Estágio</label>
                    <select
                      id="bulk-stage"
                      value={stageValue}
                      onChange={(event) => setStageValue(event.target.value)}
                    >
                      {CONTACT_STAGES.map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {stageValue === "perdido" && (
                  <>
                    <div className={styles.field}>
                      <label htmlFor="bulk-lost-reason">Motivo da perda</label>
                      <textarea
                        id="bulk-lost-reason"
                        value={lostReason}
                        onChange={(event) => setLostReason(event.target.value)}
                        required
                      />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="bulk-lost-review">Revisar em</label>
                      <input
                        id="bulk-lost-review"
                        type="date"
                        value={lostReviewAt}
                        onChange={(event) => setLostReviewAt(event.target.value)}
                      />
                    </div>
                  </>
                )}
                <div className={styles.footer}>
                  <Button kind={Button.kinds.TERTIARY} type="button" onClick={closePanel}>
                    Cancelar
                  </Button>
                  <Button kind={Button.kinds.PRIMARY} type="submit" loading={loading}>
                    Aplicar
                  </Button>
                </div>
              </form>
            )}

            {panel.type === "owner" && (
              <form onSubmit={handleOwnerSubmit}>
                <h2 id="bulk-panel-title">Atribuir dono</h2>
                <div className={styles.field}>
                  <label htmlFor="bulk-owner">Selecionar dono</label>
                  <select
                    id="bulk-owner"
                    value={ownerId}
                    onChange={(event) => setOwnerId(event.target.value)}
                  >
                    {memberships
                      .filter((member) => allowedOwnerIds.has(member.id))
                      .map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.displayName}
                        </option>
                      ))}
                  </select>
                </div>
                <div className={styles.footer}>
                  <Button kind={Button.kinds.TERTIARY} type="button" onClick={closePanel}>
                    Cancelar
                  </Button>
                  <Button kind={Button.kinds.PRIMARY} type="submit" loading={loading}>
                    Aplicar
                  </Button>
                </div>
              </form>
            )}

            {panel.type === "next_step" && (
              <form onSubmit={handleNextStepSubmit}>
                <h2 id="bulk-panel-title">Definir próximo passo</h2>
                <div className={styles.field}>
                  <label htmlFor="bulk-next-note">Descrição</label>
                  <textarea
                    id="bulk-next-note"
                    value={nextStepNote}
                    onChange={(event) => setNextStepNote(event.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="bulk-next-date">Data</label>
                  <input
                    id="bulk-next-date"
                    type="date"
                    value={nextStepDate}
                    onChange={(event) => setNextStepDate(event.target.value)}
                  />
                </div>
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={applyIfEmpty}
                    onChange={(event) => setApplyIfEmpty(event.target.checked)}
                  />
                  Aplicar somente para quem não tem próximo passo
                </label>
                <div className={styles.footer}>
                  <Button kind={Button.kinds.TERTIARY} type="button" onClick={closePanel}>
                    Cancelar
                  </Button>
                  <Button kind={Button.kinds.PRIMARY} type="submit" loading={loading}>
                    Aplicar
                  </Button>
                </div>
              </form>
            )}

            {panel.type === "referral" && (
              <form onSubmit={handleReferralSubmit}>
                <h2 id="bulk-panel-title">Definir “Indicado por”</h2>
                <div className={styles.field}>
                  <label htmlFor="bulk-referral">ID do contato indicante</label>
                  <input
                    id="bulk-referral"
                    value={referralId}
                    onChange={(event) => setReferralId(event.target.value)}
                    placeholder="Opcional"
                  />
                </div>
                <div className={styles.footer}>
                  <Button kind={Button.kinds.TERTIARY} type="button" onClick={closePanel}>
                    Cancelar
                  </Button>
                  <Button kind={Button.kinds.PRIMARY} type="submit" loading={loading}>
                    Aplicar
                  </Button>
                </div>
              </form>
            )}

            {panel.type === "tags" && (
              <form onSubmit={handleTagsSubmit}>
                <h2 id="bulk-panel-title">Atualizar tags</h2>
                <div className={styles.field}>
                  <label htmlFor="bulk-tags-mode">Modo</label>
                  <select
                    id="bulk-tags-mode"
                    value={tagsMode}
                    onChange={(event) => setTagsMode(event.target.value as "add" | "remove")}
                  >
                    <option value="add">Adicionar</option>
                    <option value="remove">Remover</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label htmlFor="bulk-tags-input">Tags (separadas por vírgula)</label>
                  <input
                    id="bulk-tags-input"
                    value={tagsInput}
                    onChange={(event) => setTagsInput(event.target.value)}
                  />
                </div>
                <div className={styles.footer}>
                  <Button kind={Button.kinds.TERTIARY} type="button" onClick={closePanel}>
                    Cancelar
                  </Button>
                  <Button kind={Button.kinds.PRIMARY} type="submit" loading={loading}>
                    Aplicar
                  </Button>
                </div>
              </form>
            )}

            {panel.type === "confirm" && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  runAction({ type: panel.action } as BulkActionPayload);
                }}
              >
                <h2 id="bulk-panel-title">{panel.title}</h2>
                <p>{panel.message}</p>
                <div className={styles.footer}>
                  <Button kind={Button.kinds.TERTIARY} type="button" onClick={closePanel}>
                    Cancelar
                  </Button>
                  <Button kind={Button.kinds.PRIMARY} type="submit" loading={loading}>
                    Confirmar
                  </Button>
                </div>
              </form>
            )}

            {panel.type === "merge" && (
              <form onSubmit={handleMergeSubmit}>
                <h2 id="bulk-panel-title">Mesclar duplicados</h2>
                <div className={styles.field}>
                  <label htmlFor="bulk-merge-primary">Contato principal</label>
                  <select
                    id="bulk-merge-primary"
                    value={mergePrimaryId}
                    onChange={(event) => setMergePrimaryId(event.target.value)}
                  >
                    {selectedContacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name}
                      </option>
                    ))}
                  </select>
                </div>
                <p>O contato secundário será removido e os dados relevantes serão mantidos no principal.</p>
                <div className={styles.footer}>
                  <Button kind={Button.kinds.TERTIARY} type="button" onClick={closePanel}>
                    Cancelar
                  </Button>
                  <Button kind={Button.kinds.PRIMARY} type="submit" loading={loading}>
                    Mesclar
                  </Button>
                </div>
              </form>
            )}

            {panel.type === "info" && (
              <div>
                <h2 id="bulk-panel-title">{panel.title}</h2>
                <p>{panel.message}</p>
                <div className={styles.footer}>
                  <Button kind={Button.kinds.PRIMARY} type="button" onClick={closePanel}>
                    Entendi
                  </Button>
                </div>
              </div>
            )}

            {error ? <div className={styles.errorMessage}>{error}</div> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
