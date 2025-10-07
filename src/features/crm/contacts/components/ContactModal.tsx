'use client';

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
} from "react";
import { Button } from "@vibe/core";
import {
  ContactDetail,
  ContactStageId,
  CONTACT_STAGES,
  ContactTimelineEvent,
  MembershipSummary,
} from "../types";
import { EditableContactForm } from "../utils/forms";
import styles from "./contact-modal.module.css";

type TimelineFilterId = "all" | "status" | "next" | "interactions";

export type ContactModalTab = "activities" | "data" | "tasks" | "referrals";

const timelineFilters: { id: TimelineFilterId; label: string }[] = [
  { id: "all", label: "Tudo" },
  { id: "status", label: "Status" },
  { id: "next", label: "Próximo passo" },
  { id: "interactions", label: "Interações" },
];

type ContactModalProps = {
  open: boolean;
  detail: ContactDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRefresh: () => void;
  onSubmit: () => Promise<void>;
  onStageChange: (stage: ContactStageId) => Promise<void>;
  onNavigate: (direction: "prev" | "next") => void;
  canNavigatePrev: boolean;
  canNavigateNext: boolean;
  positionLabel: string;
  memberships: MembershipSummary[];
  form: EditableContactForm | null;
  onFormChange: (form: EditableContactForm) => void;
  onTabChange: (tab: ContactModalTab) => void;
  activeTab: ContactModalTab;
  onOpenContact: (contactId: string) => void;
  saving: boolean;
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

const dateOnlyFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
});

function formatTimelineLabel(event: ContactTimelineEvent): string {
  switch (event.type) {
    case "created":
      return "Contato criado";
    case "stage_changed":
      return `Estágio alterado para ${(event.payload?.to as string) ?? "novo"}`;
    case "owner_changed":
      return "Dono atualizado";
    case "next_step_set":
      return "Próximo passo atualizado";
    case "interaction_call":
      return "Ligação registrada";
    case "interaction_email":
      return "E-mail enviado";
    case "interaction_whatsapp":
      return "WhatsApp registrado";
    case "note":
      return "Nota adicionada";
    default:
      return event.type;
  }
}

function filterTimeline(events: ContactTimelineEvent[], filter: TimelineFilterId) {
  if (filter === "all") {
    return events;
  }

  return events.filter((event) => {
    if (filter === "status") {
      return event.type === "created" || event.type === "stage_changed" || event.type === "owner_changed";
    }
    if (filter === "next") {
      return event.type === "next_step_set";
    }
    return event.type.startsWith("interaction") || event.type === "note";
  });
}

export default function ContactModal({
  open,
  detail,
  loading,
  error,
  onClose,
  onRefresh,
  onSubmit,
  onStageChange,
  onNavigate,
  canNavigatePrev,
  canNavigateNext,
  positionLabel,
  memberships,
  form,
  onFormChange,
  onTabChange,
  activeTab,
  onOpenContact,
  saving,
}: ContactModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilterId>("all");
  const [localError, setLocalError] = useState<string | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
      requestAnimationFrame(() => {
        modalRef.current?.focus();
      });
      setTimelineFilter("all");
      setLocalError(null);
    } else if (previouslyFocusedRef.current) {
      previouslyFocusedRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (error) {
      setLocalError(error);
    }
  }, [error]);

  const timeline = useMemo(() => {
    if (!detail) {
      return [];
    }
    return filterTimeline(detail.timeline, timelineFilter);
  }, [detail, timelineFilter]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "ArrowLeft" && canNavigatePrev) {
        event.preventDefault();
        onNavigate("prev");
        return;
      }

      if (event.key === "ArrowRight" && canNavigateNext) {
        event.preventDefault();
        onNavigate("next");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, onNavigate, canNavigatePrev, canNavigateNext]);

  if (!open) {
    return null;
  }

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const handleStageChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as ContactStageId;
    await onStageChange(value);
  };

  const handleInputChange = <K extends keyof EditableContactForm>(field: K, value: EditableContactForm[K]) => {
    if (!form) {
      return;
    }
    onFormChange({ ...form, [field]: value });
    setLocalError(null);
  };

  const focusTrap = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") {
      return;
    }
    const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable || focusable.length === 0) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    }
  };

  const contact = detail?.contact ?? null;

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={handleOverlayClick}>
      <div
        ref={modalRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-modal-title"
        tabIndex={-1}
        onKeyDown={focusTrap}
      >
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Fechar">
          Fechar
        </button>
        <div className={styles.navigationBar} aria-live="polite">
          <span className={styles.countLabel}>{positionLabel}</span>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => onNavigate("prev")}
            disabled={!canNavigatePrev}
            aria-label="Contato anterior"
          >
            ←
          </button>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => onNavigate("next")}
            disabled={!canNavigateNext}
            aria-label="Próximo contato"
          >
            →
          </button>
        </div>

        <header className={styles.header}>
          <div className={styles.headerTop}>
            <div className={styles.titleGroup}>
              <h2 id="contact-modal-title" className={styles.contactName}>
                {contact?.name ?? "Contato"}
              </h2>
              <div className={styles.stageOwnerRow}>
                <select
                  className={styles.stageSelect}
                  value={contact?.stage ?? "novo"}
                  onChange={handleStageChange}
                  aria-label="Alterar estágio"
                >
                  {CONTACT_STAGES.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.label}
                    </option>
                  ))}
                </select>
                {contact?.owner ? (
                  <span className={styles.ownerBadge} aria-label="Dono do contato">
                    🧑 {contact.owner.displayName}
                  </span>
                ) : (
                  <span className={styles.ownerBadge}>Sem dono</span>
                )}
              </div>
            </div>
            <div className={styles.actionButtons} aria-label="Ações rápidas">
              <Button
                kind={Button.kinds.SECONDARY}
                disabled={!contact?.whatsapp}
                onClick={() =>
                  contact?.whatsapp && window.open(`https://wa.me/${contact.whatsapp.replace(/\D/g, "")}`)
                }
              >
                WhatsApp
              </Button>
              <Button
                kind={Button.kinds.SECONDARY}
                disabled={!contact?.whatsapp}
                onClick={() => contact?.whatsapp && window.open(`tel:${contact.whatsapp}`)}
              >
                Ligar
              </Button>
              <Button
                kind={Button.kinds.SECONDARY}
                disabled={!contact?.email}
                onClick={() => contact?.email && window.open(`mailto:${contact.email}`)}
              >
                E-mail
              </Button>
              <Button kind={Button.kinds.SECONDARY} onClick={onRefresh} loading={loading}>
                Atualizar
              </Button>
            </div>
          </div>
        </header>

        <div className={styles.subHeader} role="presentation">
          <div className={styles.subItem}>
            <strong>Tags:</strong>
            <span className={styles.tagsList}>
              {contact?.tags.length ? contact.tags.map((tag) => (
                <span key={tag} className={styles.tag}>
                  {tag}
                </span>
              )) : (
                <span>Sem tags</span>
              )}
            </span>
          </div>
          <div className={styles.subItem}>
            <strong>Origem:</strong> {contact?.source ?? "Não informado"}
          </div>
          <div className={styles.subItem}>
            <strong>Último toque:</strong>
            {contact?.lastTouchAt ? dateFormatter.format(new Date(contact.lastTouchAt)) : "Sem registro"}
          </div>
          <div className={styles.subItem}>
            <strong>Próximo passo:</strong>
            {contact?.nextActionNote ? `${contact.nextActionNote}${contact.nextActionAt ? ` — ${dateOnlyFormatter.format(new Date(contact.nextActionAt))}` : ""}` : "Não definido"}
          </div>
        </div>

        <nav className={styles.tabs} aria-label="Seções do contato" role="tablist">
          <button
            type="button"
            className={styles.tabButton}
            role="tab"
            aria-selected={activeTab === "activities"}
            tabIndex={activeTab === "activities" ? 0 : -1}
            onClick={() => onTabChange("activities")}
          >
            Atividades
          </button>
          <button
            type="button"
            className={styles.tabButton}
            role="tab"
            aria-selected={activeTab === "data"}
            tabIndex={activeTab === "data" ? 0 : -1}
            onClick={() => onTabChange("data")}
          >
            Dados
          </button>
          <button
            type="button"
            className={styles.tabButton}
            role="tab"
            aria-selected={activeTab === "tasks"}
            tabIndex={activeTab === "tasks" ? 0 : -1}
            onClick={() => onTabChange("tasks")}
          >
            Próximo passo
          </button>
          <button
            type="button"
            className={styles.tabButton}
            role="tab"
            aria-selected={activeTab === "referrals"}
            tabIndex={activeTab === "referrals" ? 0 : -1}
            onClick={() => onTabChange("referrals")}
          >
            Indicações
          </button>
        </nav>

        <section className={styles.content} aria-live="polite">
          {activeTab === "activities" && (
            <div>
              <div className={styles.timelineFilters} role="group" aria-label="Filtro da timeline">
                {timelineFilters.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    className={styles.timelineButton}
                    data-active={timelineFilter === filter.id}
                    onClick={() => setTimelineFilter(filter.id)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              {timeline.length === 0 ? (
                <div className={styles.emptyState}>Nenhum evento encontrado para o filtro selecionado.</div>
              ) : (
                <ol className={styles.timelineList}>
                  {timeline.map((event) => (
                    <li key={event.id} className={styles.timelineItem}>
                      <strong>{formatTimelineLabel(event)}</strong>
                      <div className={styles.timelineMeta}>
                        <span>{dateFormatter.format(new Date(event.occurredAt))}</span>
                        {event.actor ? <span>por {event.actor.displayName}</span> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {activeTab === "data" && form && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setLocalError(null);
                onSubmit().catch((submitError) => {
                  setLocalError(submitError instanceof Error ? submitError.message : "Erro ao salvar");
                });
              }}
            >
              <div className={styles.formGrid}>
                <div className={styles.formControl}>
                  <label htmlFor="modal-name">Nome</label>
                  <input
                    id="modal-name"
                    required
                    value={form.name}
                    onChange={(event) => handleInputChange("name", event.target.value)}
                  />
                </div>
                <div className={styles.formControl}>
                  <label htmlFor="modal-email">E-mail</label>
                  <input
                    id="modal-email"
                    type="email"
                    value={form.email}
                    onChange={(event) => handleInputChange("email", event.target.value)}
                  />
                </div>
                <div className={styles.formControl}>
                  <label htmlFor="modal-phone">Telefone/WhatsApp</label>
                  <input
                    id="modal-phone"
                    value={form.whatsapp}
                    onChange={(event) => handleInputChange("whatsapp", event.target.value)}
                  />
                </div>
                <div className={styles.formControl}>
                  <label htmlFor="modal-owner">Dono</label>
                  <select
                    id="modal-owner"
                    value={form.ownerMembershipId}
                    onChange={(event) => handleInputChange("ownerMembershipId", event.target.value)}
                  >
                    {memberships.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.displayName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formControl}>
                  <label htmlFor="modal-tags">Tags</label>
                  <input
                    id="modal-tags"
                    value={form.tags}
                    onChange={(event) => handleInputChange("tags", event.target.value)}
                    placeholder="Separar por vírgula"
                  />
                </div>
                <div className={styles.formControl}>
                  <label htmlFor="modal-score">Score</label>
                  <input
                    id="modal-score"
                    type="number"
                    min={0}
                    max={100}
                    value={form.score}
                    onChange={(event) => handleInputChange("score", event.target.value)}
                  />
                </div>
                <div className={styles.formControl}>
                  <label htmlFor="modal-referral">Indicado por</label>
                  <input
                    id="modal-referral"
                    value={form.referredByContactId}
                    onChange={(event) => handleInputChange("referredByContactId", event.target.value)}
                    placeholder="ID do contato"
                  />
                </div>
                {form.stage === "perdido" ? (
                  <>
                    <div className={styles.formControl}>
                      <label htmlFor="modal-lost-reason">Motivo da perda</label>
                      <textarea
                        id="modal-lost-reason"
                        value={form.lostReason}
                        onChange={(event) => handleInputChange("lostReason", event.target.value)}
                        rows={3}
                      />
                    </div>
                    <div className={styles.formControl}>
                      <label htmlFor="modal-lost-review">Revisar em</label>
                      <input
                        id="modal-lost-review"
                        type="date"
                        value={form.lostReviewAt}
                        onChange={(event) => handleInputChange("lostReviewAt", event.target.value)}
                      />
                    </div>
                  </>
                ) : null}
              </div>
              <div className={styles.footerActions}>
                <Button kind={Button.kinds.SECONDARY} type="button" onClick={onClose}>
                  Cancelar
                </Button>
                <Button kind={Button.kinds.PRIMARY} type="submit" loading={saving}>
                  Salvar
                </Button>
              </div>
              {localError ? <div className={styles.errorMessage}>{localError}</div> : null}
            </form>
          )}

          {activeTab === "tasks" && form && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setLocalError(null);
                onSubmit().catch((submitError) => {
                  setLocalError(submitError instanceof Error ? submitError.message : "Erro ao salvar");
                });
              }}
            >
              <div className={styles.formGrid}>
                <div className={styles.formControl}>
                  <label htmlFor="modal-next-note">Próximo passo</label>
                  <textarea
                    id="modal-next-note"
                    value={form.nextActionNote}
                    onChange={(event) => handleInputChange("nextActionNote", event.target.value)}
                  />
                </div>
                <div className={styles.formControl}>
                  <label htmlFor="modal-next-date">Data</label>
                  <input
                    id="modal-next-date"
                    type="date"
                    value={form.nextActionAt}
                    onChange={(event) => handleInputChange("nextActionAt", event.target.value)}
                  />
                </div>
              </div>
              <div className={styles.footerActions}>
                <Button kind={Button.kinds.PRIMARY} type="submit" loading={saving}>
                  Salvar próximo passo
                </Button>
              </div>
              {localError ? <div className={styles.errorMessage}>{localError}</div> : null}

              <div aria-label="Histórico de próximos passos" className={styles.timelineList} style={{ marginTop: 24 }}>
                {detail && detail.timeline.filter((event) => event.type === "next_step_set").length === 0 ? (
                  <div className={styles.emptyState}>Nenhum histórico de próximos passos até o momento.</div>
                ) : (
                  detail?.timeline
                    .filter((event) => event.type === "next_step_set")
                    .map((event) => (
                      <div key={event.id} className={styles.timelineItem}>
                        <strong>Próximo passo atualizado</strong>
                        <div className={styles.timelineMeta}>
                          <span>{dateFormatter.format(new Date(event.occurredAt))}</span>
                          {event.payload?.note ? <span>{event.payload.note as string}</span> : null}
                        </div>
                      </div>
                    ))
                )}
              </div>
            </form>
          )}

          {activeTab === "referrals" && (
            <div className={styles.referralsList}>
              <div className={styles.formControl}>
                <label>Indicado por</label>
                <span>{contact?.referredBy?.name ?? "Sem indicação"}</span>
              </div>
              <div className={styles.formControl}>
                <label>Indicados</label>
                {detail && detail.referrals.length > 0 ? (
                  <div className={styles.referralsList}>
                    {detail.referrals.map((referral) => (
                      <div key={referral.id} className={styles.referralCard}>
                        <div>
                          <strong>{referral.name}</strong>
                          <div>Estágio: {CONTACT_STAGES.find((stage) => stage.id === referral.stage)?.label ?? referral.stage}</div>
                        </div>
                        <Button kind={Button.kinds.SECONDARY} onClick={() => onOpenContact(referral.id)}>
                          Abrir
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptyState}>Sem indicações registradas.</div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
