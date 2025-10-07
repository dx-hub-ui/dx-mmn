"use client";

import { useCallback, useEffect, useMemo, useRef, useState, FormEvent } from "react";
import { Button } from "@vibe/core";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ContactInput,
  ContactRecord,
  ContactStageId,
  CONTACT_STAGES,
  MembershipSummary,
  SavedViewId,
  ContactFilters,
} from "@/features/crm/contacts/types";
import { SAVED_VIEWS, applySavedView } from "@/features/crm/contacts/utils/savedViews";
import { trackEvent } from "@/lib/telemetry";
import styles from "@/features/crm/contacts/components/contacts-board.module.css";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

const DEFAULT_VIEW: SavedViewId = "meus";

const GROUPING_OPTIONS = [
  { id: "none", label: "Sem agrupamento" },
  { id: "stage", label: "Agrupar por estágio" },
  { id: "owner", label: "Agrupar por dono" },
] as const;

const STAGE_TONES: Record<string, string> = {
  blue: styles.stagePillBlue,
  green: styles.stagePillGreen,
  orange: styles.stagePillOrange,
  purple: styles.stagePillPurple,
  gray: styles.stagePillGray,
  red: styles.stagePillRed,
};

type GroupingId = (typeof GROUPING_OPTIONS)[number]["id"];

type OrganizationInfo = {
  id: string;
  name: string;
  slug: string;
};

type EditableContactForm = {
  name: string;
  email: string;
  whatsapp: string;
  stage: ContactStageId;
  ownerMembershipId: string;
  tags: string;
  score: string;
  nextActionAt: string;
  nextActionNote: string;
  referredByContactId: string;
};

type FeedbackState = { type: "success" | "error"; message: string } | null;

type ContactsBoardPageProps = {
  organization: OrganizationInfo;
  currentMembership: MembershipSummary;
  memberships: MembershipSummary[];
  initialContacts: ContactRecord[];
};

type VirtualRow =
  | { type: "group"; id: string; label: string; count: number }
  | { type: "contact"; contact: ContactRecord };

function contactToEditable(contact: ContactRecord): EditableContactForm {
  return {
    name: contact.name,
    email: contact.email ?? "",
    whatsapp: contact.whatsapp ?? "",
    stage: contact.stage,
    ownerMembershipId: contact.ownerMembershipId,
    tags: contact.tags.join(", "),
    score: contact.score != null ? String(contact.score) : "",
    nextActionAt: contact.nextActionAt ? contact.nextActionAt.substring(0, 10) : "",
    nextActionNote: contact.nextActionNote ?? "",
    referredByContactId: contact.referredByContactId ?? "",
  };
}

function emptyForm(currentMembershipId: string): EditableContactForm {
  return {
    name: "",
    email: "",
    whatsapp: "",
    stage: "novo",
    ownerMembershipId: currentMembershipId,
    tags: "",
    score: "",
    nextActionAt: "",
    nextActionNote: "",
    referredByContactId: "",
  };
}

function parseEditable(form: EditableContactForm): ContactInput {
  const tags = form.tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  return {
    name: form.name,
    email: form.email || null,
    whatsapp: form.whatsapp || null,
    stage: form.stage,
    ownerMembershipId: form.ownerMembershipId,
    tags,
    score: form.score ? Number(form.score) : null,
    nextActionAt: form.nextActionAt ? new Date(form.nextActionAt).toISOString() : null,
    nextActionNote: form.nextActionNote || null,
    referredByContactId: form.referredByContactId || null,
  };
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return dateFormatter.format(new Date(value));
  } catch {
    return "—";
  }
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  try {
    return dateTimeFormatter.format(new Date(value));
  } catch {
    return "—";
  }
}

function matchesFilters(contact: ContactRecord, filters: ContactFilters): boolean {
  if (filters.stages && filters.stages.length > 0) {
    if (!filters.stages.includes(contact.stage)) {
      return false;
    }
  }

  if (filters.ownerIds && filters.ownerIds.length > 0) {
    if (!filters.ownerIds.includes(contact.ownerMembershipId)) {
      return false;
    }
  }

  if (filters.referredByContactIds && filters.referredByContactIds.length > 0) {
    if (!contact.referredByContactId || !filters.referredByContactIds.includes(contact.referredByContactId)) {
      return false;
    }
  }

  if (filters.tags && filters.tags.length > 0) {
    if (!contact.tags.some((tag) => filters.tags?.includes(tag))) {
      return false;
    }
  }

  if (filters.nextActionBetween) {
    const { start, end } = filters.nextActionBetween;
    if (start && (!contact.nextActionAt || contact.nextActionAt < start)) {
      return false;
    }
    if (end && (!contact.nextActionAt || contact.nextActionAt > end)) {
      return false;
    }
  }

  if (filters.search) {
    const normalized = filters.search.toLowerCase();
    const haystack = [
      contact.name,
      contact.email ?? "",
      contact.whatsapp ?? "",
      contact.owner?.displayName ?? "",
      contact.tags.join(" "),
      contact.referredBy?.name ?? "",
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(normalized)) {
      return false;
    }
  }

  return true;
}

export default function ContactsBoardPage({
  organization,
  currentMembership,
  memberships,
  initialContacts,
}: ContactsBoardPageProps) {
  const [contacts, setContacts] = useState<ContactRecord[]>(initialContacts);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [savedView, setSavedView] = useState<SavedViewId | null>(DEFAULT_VIEW);
  const [filters, setFilters] = useState<ContactFilters>({});
  const [grouping, setGrouping] = useState<GroupingId>("none");
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<EditableContactForm | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState<EditableContactForm>(() => emptyForm(currentMembership.id));
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [formErrors, setFormErrors] = useState<string | null>(null);
  const scrollParentRef = useRef<HTMLDivElement | null>(null);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    for (const contact of contacts) {
      for (const tag of contact.tags) {
        tags.add(tag);
      }
    }
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [contacts]);

  useEffect(() => {
    trackEvent("crm/board_view_loaded", { organizationId: organization.id, total: contacts.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleContacts = useMemo(() => {
    const base = savedView
      ? applySavedView(savedView, contacts, currentMembership, memberships)
      : contacts;

    const enrichedFilters = { ...filters };
    if (filters.search == null && savedView === "hoje") {
      // keep search empty; filter handled by saved view
    }

    return base.filter((contact) => matchesFilters(contact, enrichedFilters));
  }, [savedView, contacts, currentMembership, memberships, filters]);

  const rows: VirtualRow[] = useMemo(() => {
    if (grouping === "stage") {
      const grouped = CONTACT_STAGES.map((stage) => {
        const groupedContacts = visibleContacts.filter((contact) => contact.stage === stage.id);
        return groupedContacts.length > 0
          ? [
              { type: "group" as const, id: `stage-${stage.id}`, label: `${stage.label} (${groupedContacts.length})`, count: groupedContacts.length },
              ...groupedContacts.map((contact) => ({ type: "contact" as const, contact })),
            ]
          : [];
      });
      return grouped.flat();
    }

    if (grouping === "owner") {
      const ownersMap = new Map<string, ContactRecord[]>();
      for (const contact of visibleContacts) {
        const key = contact.owner?.displayName ?? "Sem dono";
        if (!ownersMap.has(key)) {
          ownersMap.set(key, []);
        }
        ownersMap.get(key)!.push(contact);
      }
      const sortedOwners = Array.from(ownersMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      const groupedRows: VirtualRow[] = [];
      for (const [label, ownerContacts] of sortedOwners) {
        groupedRows.push({ type: "group", id: `owner-${label}`, label: `${label} (${ownerContacts.length})`, count: ownerContacts.length });
        groupedRows.push(
          ...ownerContacts.map((contact) => ({ type: "contact" as const, contact }))
        );
      }
      return groupedRows;
    }

    return visibleContacts.map((contact) => ({ type: "contact", contact }));
  }, [grouping, visibleContacts]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: (index) => (rows[index]?.type === "group" ? 44 : 72),
    overscan: 12,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalHeight = virtualizer.getTotalSize();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom = virtualItems.length > 0 ? totalHeight - virtualItems[virtualItems.length - 1].end : 0;

  const toggleSelection = useCallback(
    (contactId: string) => {
      setSelection((current) => {
        const next = new Set(current);
        if (next.has(contactId)) {
          next.delete(contactId);
        } else {
          next.add(contactId);
        }
        trackEvent("crm/selection_changed", { count: next.size });
        return next;
      });
    },
    []
  );

  const toggleSelectAll = useCallback(() => {
    setSelection((current) => {
      const next = new Set(current);
      const contactIds = visibleContacts.map((contact) => contact.id);
      const allSelected = contactIds.every((id) => next.has(id));
      if (allSelected) {
        for (const id of contactIds) {
          next.delete(id);
        }
      } else {
        for (const id of contactIds) {
          next.add(id);
        }
      }
      trackEvent("crm/selection_changed", { count: next.size });
      return next;
    });
  }, [visibleContacts]);

  useEffect(() => {
    trackEvent("crm/filters_changed", { filters, view: savedView });
  }, [filters, savedView]);

  const resetFeedback = useCallback(() => setFeedback(null), []);

  const handleRefresh = useCallback(async () => {
    resetFeedback();
    setIsRefreshing(true);
    try {
      const url = new URL("/api/crm/contacts", window.location.origin);
      url.searchParams.set("organizationId", organization.id);
      const response = await fetch(url.toString(), { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Não foi possível atualizar a lista de contatos");
      }
      const body = await response.json();
      setContacts(body.contacts ?? []);
      setFeedback({ type: "success", message: "Lista atualizada" });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Erro ao atualizar contatos",
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [organization.id, resetFeedback]);

  const handleCreate = useCallback(async () => {
    setIsLoading(true);
    setFormErrors(null);
    try {
      const payload = parseEditable(createForm);
      const response = await fetch("/api/crm/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, organizationId: organization.id }),
      });

      if (!response.ok) {
        const body = await response.json();
        const firstError: string = body?.errors?.[0]?.message ?? "Erro ao criar contato";
        setFormErrors(firstError);
        setFeedback({ type: "error", message: firstError });
        return;
      }

      const body = await response.json();
      const newContact: ContactRecord = body.contact;
      setContacts((current) => [newContact, ...current.filter((contact) => contact.id !== newContact.id)]);
      setFeedback({ type: "success", message: "Contato criado com sucesso" });
      setCreateForm(emptyForm(currentMembership.id));
      setIsCreating(false);
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Erro ao criar contato",
      });
    } finally {
      setIsLoading(false);
    }
  }, [createForm, currentMembership.id, organization.id]);

  const beginEdit = useCallback((contact: ContactRecord) => {
    setEditingContactId(contact.id);
    setEditingForm(contactToEditable(contact));
    setFormErrors(null);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingContactId(null);
    setEditingForm(null);
    setFormErrors(null);
  }, []);

  const handleUpdate = useCallback(async () => {
    if (!editingContactId || !editingForm) {
      return;
    }
    setIsLoading(true);
    setFormErrors(null);
    try {
      const payload = parseEditable(editingForm);
      const response = await fetch(`/api/crm/contacts/${editingContactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, organizationId: organization.id }),
      });

      if (!response.ok) {
        const body = await response.json();
        const firstError: string = body?.errors?.[0]?.message ?? "Erro ao atualizar contato";
        setFormErrors(firstError);
        setFeedback({ type: "error", message: firstError });
        return;
      }

      const body = await response.json();
      const updatedContact: ContactRecord = body.contact;
      setContacts((current) => {
        const next = current.map((contact) => (contact.id === updatedContact.id ? updatedContact : contact));
        return next;
      });
      setFeedback({ type: "success", message: "Contato atualizado" });
      cancelEdit();
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Erro ao atualizar contato",
      });
    } finally {
      setIsLoading(false);
    }
  }, [editingContactId, editingForm, organization.id, cancelEdit]);

  const onSubmitCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleCreate();
  };

  const onSubmitEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleUpdate();
  };

  const isRowEditing = (contactId: string) => editingContactId === contactId;

  return (
    <section className={styles.page} aria-labelledby="crm-board-heading">
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <div className={styles.titleBlock}>
            <h1 id="crm-board-heading">Contatos — {organization.name}</h1>
            <span className={styles.subtitle}>
              Pipeline operacional para equipe multinível. {visibleContacts.length} de {contacts.length} contato(s) visível(is).
            </span>
          </div>
          <div className={styles.actionsRow}>
            <Button kind={Button.kinds.PRIMARY} onClick={() => setIsCreating(true)}>
              Novo contato
            </Button>
            <Button kind={Button.kinds.SECONDARY} loading={isRefreshing} onClick={handleRefresh}>
              Atualizar
            </Button>
          </div>
        </div>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.searchGroup}>
          <label htmlFor="crm-search" className={styles.srOnly}>
            Buscar contatos
          </label>
          <input
            id="crm-search"
            type="search"
            className={styles.searchInput}
            placeholder="Buscar por nome, e-mail, telefone ou tags"
            value={filters.search ?? ""}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
          />
          <select
            className={styles.selectControl}
            value={grouping}
            aria-label="Agrupamento"
            onChange={(event) => setGrouping(event.target.value as GroupingId)}
          >
            {GROUPING_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.filtersRow}>
          <select
            multiple
            className={styles.selectControl}
            value={filters.stages ?? []}
            aria-label="Filtrar por estágio"
            onChange={(event) => {
              const selected = Array.from(event.target.selectedOptions).map((option) => option.value as ContactStageId);
              setFilters((current) => ({ ...current, stages: selected.length > 0 ? selected : undefined }));
            }}
          >
            {CONTACT_STAGES.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.label}
              </option>
            ))}
          </select>
          <select
            multiple
            className={styles.selectControl}
            value={filters.ownerIds ?? []}
            aria-label="Filtrar por dono"
            onChange={(event) => {
              const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
              setFilters((current) => ({ ...current, ownerIds: selected.length > 0 ? selected : undefined }));
            }}
          >
            {memberships.map((member) => (
              <option key={member.id} value={member.id}>
                {member.displayName}
              </option>
            ))}
          </select>
          <select
            multiple
            className={styles.selectControl}
            value={filters.referredByContactIds ?? []}
            aria-label="Filtrar por indicado por"
            onChange={(event) => {
              const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
              setFilters((current) => ({
                ...current,
                referredByContactIds: selected.length > 0 ? selected : undefined,
              }));
            }}
          >
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name}
              </option>
            ))}
          </select>
          <select
            multiple
            className={styles.selectControl}
            value={filters.tags ?? []}
            aria-label="Filtrar por tags"
            onChange={(event) => {
              const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
              setFilters((current) => ({ ...current, tags: selected.length > 0 ? selected : undefined }));
            }}
          >
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
          <input
            type="date"
            className={styles.selectControl}
            aria-label="Próximo passo - início"
            value={filters.nextActionBetween?.start ?? ""}
            onChange={(event) => {
              const start = event.target.value || null;
              setFilters((current) => ({
                ...current,
                nextActionBetween:
                  start || current.nextActionBetween?.end
                    ? { start, end: current.nextActionBetween?.end ?? null }
                    : undefined,
              }));
            }}
          />
          <input
            type="date"
            className={styles.selectControl}
            aria-label="Próximo passo - fim"
            value={filters.nextActionBetween?.end ?? ""}
            onChange={(event) => {
              const end = event.target.value || null;
              setFilters((current) => ({
                ...current,
                nextActionBetween:
                  end || current.nextActionBetween?.start
                    ? { start: current.nextActionBetween?.start ?? null, end }
                    : undefined,
              }));
            }}
          />
        </div>
      </div>

      <div className={styles.boardShell}>
        {selection.size > 0 && (
          <div className={styles.selectionSummary} role="status">
            <span>{selection.size} contato(s) selecionado(s)</span>
            <Button kind={Button.kinds.TERTIARY} onClick={() => setSelection(new Set())}>
              Limpar seleção
            </Button>
          </div>
        )}
        <nav className={styles.viewsNav} aria-label="Views salvas">
          {SAVED_VIEWS.map((view) => (
            <button
              key={view.id}
              type="button"
              className={styles.viewButton}
              aria-pressed={savedView === view.id}
              onClick={() => setSavedView((current) => (current === view.id ? null : view.id))}
            >
              {view.label}
            </button>
          ))}
        </nav>

        {feedback && (
          <div className={feedback.type === "success" ? styles.loadingState : styles.errorState} role="status">
            {feedback.message}
          </div>
        )}

        {isCreating && (
          <form className={styles.rowItem} onSubmit={onSubmitCreate} aria-label="Criar contato">
            <div className={styles.checkboxCell}>
              <Button kind={Button.kinds.TERTIARY} onClick={() => setIsCreating(false)} type="button">
                Cancelar
              </Button>
            </div>
            <div className={styles.nameCell}>
              <input
                className={styles.inlineInput}
                placeholder="Nome"
                value={createForm.name}
                onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
              <input
                className={styles.inlineInput}
                placeholder="E-mail"
                value={createForm.email}
                onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
              />
            </div>
            <select
              className={styles.inlineSelect}
              value={createForm.ownerMembershipId}
              onChange={(event) => setCreateForm((current) => ({ ...current, ownerMembershipId: event.target.value }))}
            >
              {memberships.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </select>
            <select
              className={styles.inlineSelect}
              value={createForm.stage}
              onChange={(event) => setCreateForm((current) => ({ ...current, stage: event.target.value as ContactStageId }))}
            >
              {CONTACT_STAGES.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.label}
                </option>
              ))}
            </select>
            <input
              className={styles.inlineInput}
              placeholder="Último toque"
              value={formatDateTime(new Date().toISOString())}
              readOnly
            />
            <div className={styles.nameCell}>
              <input
                className={styles.inlineInput}
                type="date"
                value={createForm.nextActionAt}
                onChange={(event) => setCreateForm((current) => ({ ...current, nextActionAt: event.target.value }))}
              />
              <textarea
                className={styles.inlineTextarea}
                placeholder="Próximo passo"
                value={createForm.nextActionNote}
                onChange={(event) => setCreateForm((current) => ({ ...current, nextActionNote: event.target.value }))}
              />
            </div>
            <select
              className={styles.inlineSelect}
              value={createForm.referredByContactId}
              onChange={(event) => setCreateForm((current) => ({ ...current, referredByContactId: event.target.value }))}
            >
              <option value="">Indicado por</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name}
                </option>
              ))}
            </select>
            <div className={styles.nameCell}>
              <input
                className={styles.inlineInput}
                placeholder="Telefone/WhatsApp"
                value={createForm.whatsapp}
                onChange={(event) => setCreateForm((current) => ({ ...current, whatsapp: event.target.value }))}
              />
              <input
                className={styles.inlineInput}
                placeholder="Tags (separadas por vírgula)"
                value={createForm.tags}
                onChange={(event) => setCreateForm((current) => ({ ...current, tags: event.target.value }))}
              />
            </div>
            <input
              className={styles.inlineInput}
              placeholder="Score"
              type="number"
              min={0}
              max={100}
              value={createForm.score}
              onChange={(event) => setCreateForm((current) => ({ ...current, score: event.target.value }))}
            />
            <div className={styles.rowActions}>
              <Button kind={Button.kinds.PRIMARY} type="submit" loading={isLoading}>
                Salvar
              </Button>
            </div>
            {formErrors && <div className={styles.metaLine}>{formErrors}</div>}
          </form>
        )}

        <div className={styles.tableHead} role="row">
          <div className={styles.checkboxCell}>
            <input
              type="checkbox"
              aria-label="Selecionar todos"
              checked={visibleContacts.length > 0 && visibleContacts.every((contact) => selection.has(contact.id))}
              onChange={toggleSelectAll}
            />
          </div>
          <span>Nome</span>
          <span>Dono</span>
          <span>Estágio</span>
          <span>Último toque</span>
          <span>Próximo passo</span>
          <span>Indicado por</span>
          <span>Telefone</span>
          <span>Tags</span>
          <span>Score</span>
          <span>Ações</span>
        </div>
        <div ref={scrollParentRef} className={styles.tableScrollArea} role="grid">
          <div className={styles.tableBody}>
            <div className={styles.virtualSpacer} style={{ height: totalHeight }}>
              <div style={{ transform: `translateY(${paddingTop}px)`, paddingBottom: `${paddingBottom}px` }}>
                {virtualItems.map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  if (!row) return null;

                  if (row.type === "group") {
                    return (
                      <div
                        key={row.id}
                        className={styles.groupHeader}
                        style={{
                          transform: `translateY(${virtualRow.start - paddingTop}px)`,
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                        }}
                      >
                        {row.label}
                      </div>
                    );
                  }

                  const contact = row.contact;
                  const stageDefinition = CONTACT_STAGES.find((stage) => stage.id === contact.stage);
                  const pillClass = stageDefinition ? STAGE_TONES[stageDefinition.tone] : styles.stagePillGray;
                  const isSelected = selection.has(contact.id);
                  const isEditingRow = isRowEditing(contact.id);

                  return isEditingRow && editingForm ? (
                    <form
                      key={contact.id}
                      className={styles.rowItem}
                      onSubmit={onSubmitEdit}
                      style={{
                        transform: `translateY(${virtualRow.start - paddingTop}px)`,
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                      }}
                      aria-label={`Editar ${contact.name}`}
                    >
                      <div className={styles.checkboxCell}>
                        <Button kind={Button.kinds.TERTIARY} onClick={cancelEdit} type="button">
                          Cancelar
                        </Button>
                      </div>
                      <div className={styles.nameCell}>
                        <input
                          className={styles.inlineInput}
                          value={editingForm.name}
                          onChange={(event) =>
                            setEditingForm((current) =>
                              current ? { ...current, name: event.target.value } : current
                            )
                          }
                        />
                        <input
                          className={styles.inlineInput}
                          value={editingForm.email}
                          onChange={(event) =>
                            setEditingForm((current) =>
                              current ? { ...current, email: event.target.value } : current
                            )
                          }
                        />
                      </div>
                      <select
                        className={styles.inlineSelect}
                        value={editingForm.ownerMembershipId}
                        onChange={(event) =>
                          setEditingForm((current) =>
                            current ? { ...current, ownerMembershipId: event.target.value } : current
                          )
                        }
                      >
                        {memberships.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.displayName}
                          </option>
                        ))}
                      </select>
                      <select
                        className={styles.inlineSelect}
                        value={editingForm.stage}
                        onChange={(event) =>
                          setEditingForm((current) =>
                            current ? { ...current, stage: event.target.value as ContactStageId } : current
                          )
                        }
                      >
                        {CONTACT_STAGES.map((stage) => (
                          <option key={stage.id} value={stage.id}>
                            {stage.label}
                          </option>
                        ))}
                      </select>
                      <span>{formatDateTime(contact.lastTouchAt)}</span>
                      <div className={styles.nameCell}>
                        <input
                          className={styles.inlineInput}
                          type="date"
                          value={editingForm.nextActionAt}
                          onChange={(event) =>
                            setEditingForm((current) =>
                              current ? { ...current, nextActionAt: event.target.value } : current
                            )
                          }
                        />
                        <textarea
                          className={styles.inlineTextarea}
                          value={editingForm.nextActionNote}
                          onChange={(event) =>
                            setEditingForm((current) =>
                              current ? { ...current, nextActionNote: event.target.value } : current
                            )
                          }
                        />
                      </div>
                      <select
                        className={styles.inlineSelect}
                        value={editingForm.referredByContactId}
                        onChange={(event) =>
                          setEditingForm((current) =>
                            current ? { ...current, referredByContactId: event.target.value } : current
                          )
                        }
                      >
                        <option value="">—</option>
                        {contacts
                          .filter((candidate) => candidate.id !== contact.id)
                          .map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {candidate.name}
                            </option>
                          ))}
                      </select>
                      <div className={styles.nameCell}>
                        <input
                          className={styles.inlineInput}
                          value={editingForm.whatsapp}
                          onChange={(event) =>
                            setEditingForm((current) =>
                              current ? { ...current, whatsapp: event.target.value } : current
                            )
                          }
                        />
                        <input
                          className={styles.inlineInput}
                          value={editingForm.tags}
                          onChange={(event) =>
                            setEditingForm((current) =>
                              current ? { ...current, tags: event.target.value } : current
                            )
                          }
                        />
                      </div>
                      <input
                        className={styles.inlineInput}
                        type="number"
                        min={0}
                        max={100}
                        value={editingForm.score}
                        onChange={(event) =>
                          setEditingForm((current) =>
                            current ? { ...current, score: event.target.value } : current
                          )
                        }
                      />
                      <div className={styles.rowActions}>
                        <Button kind={Button.kinds.PRIMARY} type="submit" loading={isLoading}>
                          Salvar
                        </Button>
                      </div>
                      {formErrors && <div className={styles.metaLine}>{formErrors}</div>}
                    </form>
                  ) : (
                    <div
                      key={contact.id}
                      className={styles.rowItem}
                      data-selected={isSelected}
                      style={{
                        transform: `translateY(${virtualRow.start - paddingTop}px)`,
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                      }}
                      role="row"
                    >
                      <div className={styles.checkboxCell}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          aria-label={`Selecionar ${contact.name}`}
                          onChange={() => toggleSelection(contact.id)}
                        />
                      </div>
                      <div className={styles.nameCell}>
                        <a className={styles.nameLink} href="#" onClick={(event) => event.preventDefault()}>
                          {contact.name}
                        </a>
                        <span className={styles.metaLine}>{contact.email ?? "—"}</span>
                      </div>
                      <span>{contact.owner?.displayName ?? "—"}</span>
                      <span className={`${styles.stagePill} ${pillClass}`}>{stageDefinition?.label ?? contact.stage}</span>
                      <span>{formatDateTime(contact.lastTouchAt)}</span>
                      <div className={styles.nameCell}>
                        <span>{formatDate(contact.nextActionAt)}</span>
                        <span className={styles.metaLine}>{contact.nextActionNote ?? "—"}</span>
                      </div>
                      <span>{contact.referredBy?.name ?? "—"}</span>
                      <span>{contact.whatsapp ?? "—"}</span>
                      <div className={styles.tagsCell}>
                        {contact.tags.length === 0 ? "—" : contact.tags.map((tag) => <span key={tag} className={styles.tagPill}>{tag}</span>)}
                      </div>
                      <span>{contact.score ?? "—"}</span>
                      <div className={styles.rowActions}>
                        <Button kind={Button.kinds.TERTIARY} onClick={() => beginEdit(contact)}>
                          Editar
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {rows.length === 0 && !isCreating && (
                  <div className={styles.emptyState}>Nenhum contato para os filtros selecionados.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
