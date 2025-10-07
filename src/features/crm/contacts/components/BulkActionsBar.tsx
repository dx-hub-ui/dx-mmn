"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@vibe/core";
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
}: BulkActionsBarProps) {
  const [panel, setPanel] = useState<PanelState>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedContacts = useMemo(() => contacts.filter((contact) => selectedIds.includes(contact.id)), [
    contacts,
    selectedIds,
  ]);
  const accessibleContacts = useMemo(
    () => filterContactsByOwnership(selectedContacts, currentMembership, memberships),
    [selectedContacts, currentMembership, memberships]
  );

  const [stageValue, setStageValue] = useState<string>("qualificado");
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

  const allowedOwnerIds = useMemo(() => new Set(getTeamMembershipIds(currentMembership, memberships)), [
    currentMembership,
    memberships,
  ]);

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

  async function runAction(action: BulkActionPayload) {
    setLoading(true);
    setFeedback(null);
    setError(null);
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
        setFeedback(`${selectedIds.length} contato(s) atualizados.`);
      }

      trackEvent("crm/bulk_action_execute", { action: action.type, count: selectedIds.length });
      closePanel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao executar ação");
    } finally {
      setLoading(false);
    }
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
    runAction(payload);
  }

  function handleNextStepSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: BulkActionPayload = {
      type: "next_step",
      note: nextStepNote.trim() || null,
      date: nextStepDate ? new Date(nextStepDate).toISOString() : null,
      applyIfEmpty,
    };
    runAction(payload);
  }

  function handleReferralSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = referralId.trim();
    const payload: BulkActionPayload = {
      type: "referral",
      referredByContactId: value || null,
    };
    runAction(payload);
  }

  function handleTagsSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const tags = normalizeTagsInput(tagsInput.split(","));
    if (tags.length === 0) {
      setError("Informe pelo menos uma tag");
      return;
    }
    runAction({ type: "tags", mode: tagsMode, tags });
  }

  function handleOwnerSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!allowedOwnerIds.has(ownerId)) {
      setError("Selecione um dono válido");
      return;
    }
    runAction({ type: "owner", ownerMembershipId: ownerId });
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
    runAction({ type: "merge", primaryContactId: mergePrimaryId });
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

  return (
    <>
      <div
        className={styles.bulkBar}
        role="region"
        aria-label={`Barra de ações — ${selectedIds.length} contato(s) selecionado(s)`}
      >
        <div className={styles.summaryRow}>
          <strong>{selectedIds.length} contato(s) selecionado(s)</strong>
          <Button kind={Button.kinds.TERTIARY} type="button" onClick={onClear}>
            Fechar
          </Button>
        </div>
        <div className={styles.actionsRow}>
          <Button kind={Button.kinds.SECONDARY} type="button" disabled={disableStage} onClick={() => setPanel({ type: "stage" })}>
            Mover estágio
          </Button>
          <Button kind={Button.kinds.SECONDARY} type="button" disabled={disableOwner} onClick={() => setPanel({ type: "owner" })}>
            Atribuir dono
          </Button>
          <Button
            kind={Button.kinds.SECONDARY}
            type="button"
            disabled={disableNextStep}
            onClick={() => setPanel({ type: "next_step" })}
          >
            Definir próximo passo
          </Button>
          <Button
            kind={Button.kinds.SECONDARY}
            type="button"
            disabled={disableReferral}
            onClick={() => setPanel({ type: "referral" })}
          >
            Definir “Indicado por”
          </Button>
          <Button kind={Button.kinds.SECONDARY} type="button" disabled={disableTags} onClick={() => setPanel({ type: "tags" })}>
            Tags
          </Button>
          <Button
            kind={Button.kinds.SECONDARY}
            type="button"
            disabled={disableMarkCadastrado}
            onClick={() => runAction({ type: "mark_cadastrado" })}
          >
            Cadastrado
          </Button>
          <Button
            kind={Button.kinds.SECONDARY}
            type="button"
            disabled={disableMarkPerdido}
            onClick={() => setPanel({ type: "stage", locked: true, presetStage: "perdido" })}
          >
            Perdido
          </Button>
          <Button
            kind={Button.kinds.SECONDARY}
            type="button"
            disabled={disableMerge}
            onClick={() => setPanel({ type: "merge" })}
          >
            Mesclar duplicados
          </Button>
          <Button
            kind={Button.kinds.SECONDARY}
            type="button"
            disabled={disableArchive}
            onClick={() =>
              setPanel({
                type: "confirm",
                action: "archive",
                title: "Arquivar contatos",
                message: "Os contatos serão movidos para o arquivo e poderão ser reativados depois.",
              })
            }
          >
            Arquivar
          </Button>
          <Button
            kind={Button.kinds.SECONDARY}
            type="button"
            disabled={disableUnarchive}
            onClick={() =>
              setPanel({
                type: "confirm",
                action: "unarchive",
                title: "Reativar contatos",
                message: "Os contatos voltarão para o funil ativo.",
              })
            }
          >
            Reativar
          </Button>
          <Button
            kind={Button.kinds.SECONDARY}
            type="button"
            disabled={disableDelete}
            onClick={() =>
              setPanel({
                type: "confirm",
                action: "delete",
                title: "Excluir contatos",
                message: "Esta ação é permanente. Confirme para excluir os contatos selecionados.",
              })
            }
          >
            Excluir
          </Button>
          <Button
            kind={Button.kinds.SECONDARY}
            type="button"
            onClick={() => exportContactsCsv(selectedContacts)}
          >
            Exportar (CSV)
          </Button>
          <Button
            kind={Button.kinds.SECONDARY}
            type="button"
            onClick={() =>
              setPanel({
                type: "info",
                title: "Mais ações",
                message: "Nenhuma ação adicional configurada para este conjunto.",
              })
            }
          >
            Mais…
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
