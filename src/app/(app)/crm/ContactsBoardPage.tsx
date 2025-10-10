"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type HTMLAttributes,
} from "react";
import {
  Button,
  Checkbox,
  Dialog,
  type DialogProps,
  type DialogType,
  DialogContentContainer,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  TabsContext,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Table,
  TableHeader,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  TextField,
  Skeleton,
} from "@vibe/core";
import type { TableColumn, TableRowProps } from "@vibe/core";
import {
  ContactRecord,
  ContactStageId,
  CONTACT_STAGES,
  MembershipSummary,
  SavedViewId,
  ContactFilters,
  ContactDetail,
} from "@/features/crm/contacts/types";
import { SAVED_VIEWS, applySavedView } from "@/features/crm/contacts/utils/savedViews";
import { trackEvent } from "@/lib/telemetry";
import styles from "@/features/crm/contacts/components/contacts-board.module.css";
import {
  contactToEditable,
  emptyEditableForm,
  parseEditableContactForm,
  EditableContactForm,
} from "@/features/crm/contacts/utils/forms";
import ContactModal, { ContactModalTab } from "@/features/crm/contacts/components/ContactModal";
import ContactsKanban from "@/features/crm/contacts/components/ContactsKanban";
import BulkActionsBar from "@/features/crm/contacts/components/BulkActionsBar";
import ImportContactsModal from "@/features/crm/contacts/components/ImportContactsModal";
import ReportsDialog from "@/features/crm/contacts/components/ReportsDialog";
import { Add, Chart, CloseSmall, Filter, MoreActions, Retry, Upload } from "@vibe/icons";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

const DEFAULT_VIEW: SavedViewId = "meus";

const STAGE_TONES: Record<string, string> = {
  blue: styles.stagePillBlue,
  green: styles.stagePillGreen,
  orange: styles.stagePillOrange,
  purple: styles.stagePillPurple,
  gray: styles.stagePillGray,
  red: styles.stagePillRed,
};

const STAGE_ORDER = new Map(CONTACT_STAGES.map((stage, index) => [stage.id, index] as const));

const Tabs = TabsContext;
const PopoverDialog = Dialog as unknown as ComponentType<DialogProps & { type?: DialogType }>;

type TableLoadingStateType = NonNullable<TableColumn["loadingStateType"]>;

const SKELETON_WIDTH_BY_TYPE: Partial<Record<TableLoadingStateType, number>> = {
  circle: 28,
  rectangle: 48,
  "medium-text": 140,
};

const SKELETON_HEIGHT_BY_TYPE: Partial<Record<TableLoadingStateType, number>> = {
  circle: 28,
  rectangle: 16,
};

type InteractiveRowProps = TableRowProps & HTMLAttributes<HTMLDivElement>;
const InteractiveTableRow = TableRow as unknown as (props: InteractiveRowProps) => JSX.Element;

type OrganizationInfo = {
  id: string;
  name: string;
  slug: string;
};

type FeedbackState = { type: "success" | "error" | "warning"; message: string } | null;

type SortColumn =
  | "name"
  | "owner"
  | "stage"
  | "lastTouch"
  | "nextAction"
  | "referredBy"
  | "whatsapp"
  | "tags"
  | "score";

type ContactsBoardPageProps = {
  organization: OrganizationInfo;
  currentMembership: MembershipSummary;
  memberships: MembershipSummary[];
  initialContacts: ContactRecord[];
};

type ContactUpdateSource = "board" | "modal" | "kanban" | "bulk";
type ContactUpdateResult = { success: true; contact: ContactRecord } | { success: false; error: string };

function nextStepSignature(contact: ContactRecord | undefined) {
  if (!contact) {
    return "|";
  }
  return `${contact.nextActionAt ?? ""}|${contact.nextActionNote ?? ""}`;
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

function TableLoadingSkeletonCell({ type = "long-text" }: { type?: TableLoadingStateType }) {
  const skeletonType =
    type === "circle"
      ? Skeleton.types.CIRCLE
      : type === "rectangle"
      ? Skeleton.types.RECTANGLE
      : Skeleton.types.TEXT;

  const width = SKELETON_WIDTH_BY_TYPE[type];
  const height = SKELETON_HEIGHT_BY_TYPE[type];

  const wrapperClassName = [
    styles.tableSkeletonWrapper,
    type === "medium-text" ? styles.tableSkeletonWrapperMedium : "",
    type === "circle" ? styles.tableSkeletonWrapperCircle : "",
    type === "rectangle" ? styles.tableSkeletonWrapperRectangle : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <TableCell>
      <Skeleton
        type={skeletonType}
        width={width}
        height={height}
        fullWidth={type === "long-text"}
        wrapperClassName={wrapperClassName}
        className={styles.tableSkeleton}
      />
    </TableCell>
  );
}

function compareStrings(a: string | null | undefined, b: string | null | undefined): number {
  return (a ?? "").localeCompare(b ?? "", "pt-BR", { sensitivity: "base" });
}

function compareNumbers(a: number | null | undefined, b: number | null | undefined): number {
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

function compareDateStrings(a: string | null, b: string | null): number {
  const aTime = a ? new Date(a).getTime() : null;
  const bTime = b ? new Date(b).getTime() : null;
  return compareNumbers(aTime, bTime);
}

function compareContactByColumn(a: ContactRecord, b: ContactRecord, column: SortColumn): number {
  switch (column) {
    case "name":
      return compareStrings(a.name, b.name);
    case "owner":
      return compareStrings(a.owner?.displayName, b.owner?.displayName);
    case "stage":
      return compareNumbers(STAGE_ORDER.get(a.stage) ?? Number.MAX_SAFE_INTEGER, STAGE_ORDER.get(b.stage) ?? Number.MAX_SAFE_INTEGER);
    case "lastTouch":
      return compareDateStrings(a.lastTouchAt, b.lastTouchAt);
    case "nextAction":
      return compareDateStrings(a.nextActionAt, b.nextActionAt);
    case "referredBy":
      return compareStrings(a.referredBy?.name ?? null, b.referredBy?.name ?? null);
    case "whatsapp":
      return compareStrings(a.whatsapp ?? null, b.whatsapp ?? null);
    case "tags":
      return compareStrings(a.tags.join(", "), b.tags.join(", "));
    case "score":
      return compareNumbers(a.score, b.score);
    default:
      return 0;
  }
}

function sortContacts(
  contacts: ContactRecord[],
  sorting: { column: SortColumn; direction: "asc" | "desc" }
): ContactRecord[] {
  const multiplier = sorting.direction === "asc" ? 1 : -1;
  return [...contacts].sort((a, b) => multiplier * compareContactByColumn(a, b, sorting.column));
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
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);
  const [sorting, setSorting] = useState<{ column: SortColumn; direction: "asc" | "desc" } | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<EditableContactForm | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState<EditableContactForm>(() =>
    emptyEditableForm(currentMembership.id)
  );
  const [importOpen, setImportOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [kanbanCreatingStage, setKanbanCreatingStage] = useState<ContactStageId | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [formErrors, setFormErrors] = useState<string | null>(null);
  const [modalState, setModalState] = useState<{ contactId: string; index: number } | null>(null);
  const [modalDetail, setModalDetail] = useState<ContactDetail | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalTab, setModalTab] = useState<ContactModalTab>("activities");
  const [modalForm, setModalForm] = useState<EditableContactForm | null>(null);
  const [modalSaving, setModalSaving] = useState(false);

  const emitContactTelemetry = useCallback(
    (previous: ContactRecord | undefined, updated: ContactRecord, source: ContactUpdateSource) => {
      if (!previous) {
        return;
      }

      if (previous.stage !== updated.stage) {
        trackEvent("crm/contact_stage_changed", {
          contactId: updated.id,
          from: previous.stage,
          to: updated.stage,
          source,
        });
      }

      if (previous.ownerMembershipId !== updated.ownerMembershipId) {
        trackEvent("crm/owner_changed", {
          contactId: updated.id,
          from: previous.ownerMembershipId,
          to: updated.ownerMembershipId,
          source,
        });
      }

      if (nextStepSignature(previous) !== nextStepSignature(updated)) {
        trackEvent("crm/next_step_set", {
          contactId: updated.id,
          source,
          hasNote: Boolean(updated.nextActionNote),
          hasDate: Boolean(updated.nextActionAt),
          cleared: !updated.nextActionAt && !updated.nextActionNote,
        });
      }

      const previousReferral = previous.referredByContactId ?? null;
      const updatedReferral = updated.referredByContactId ?? null;
      if (previousReferral !== updatedReferral) {
        trackEvent("crm/referral_linked", {
          contactId: updated.id,
          source,
          from: previousReferral,
          to: updatedReferral,
        });
      }
    },
    []
  );

  const selectedIdsArray = useMemo(() => Array.from(selection), [selection]);

  const handleBulkUpdate = useCallback(
    (updatedContacts: ContactRecord[], removedIds: string[]) => {
      if (updatedContacts.length === 0 && removedIds.length === 0) {
        return;
      }
      setContacts((current) => {
        const map = new Map(current.map((contact) => [contact.id, contact] as const));
        updatedContacts.forEach((contact) => {
          const previous = map.get(contact.id);
          emitContactTelemetry(previous, contact, "bulk");
          map.set(contact.id, contact);
        });
        removedIds.forEach((id) => {
          map.delete(id);
        });
        return Array.from(map.values());
      });
      if (removedIds.length > 0) {
        setSelection((current) => {
          const next = new Set(current);
          removedIds.forEach((id) => next.delete(id));
          return next;
        });
      }
    },
    [emitContactTelemetry, setContacts, setSelection]
  );

  const handleImportedContacts = useCallback(
    (newContacts: ContactRecord[]) => {
      if (newContacts.length === 0) {
        return;
      }
      handleBulkUpdate(newContacts, []);
      setFeedback({ type: "success", message: `${newContacts.length} contato(s) importado(s)` });
    },
    [handleBulkUpdate]
  );

  const createContactRequest = useCallback(
    async (form: EditableContactForm): Promise<ContactUpdateResult> => {
      try {
        const payload = parseEditableContactForm(form);
        const response = await fetch("/api/crm/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            organizationId: organization.id,
            actorMembershipId: currentMembership.id,
          }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          const firstError: string = body?.errors?.[0]?.message ?? body?.error ?? "Erro ao criar contato";
          return { success: false, error: firstError };
        }
        const newContact: ContactRecord = body.contact;
        return { success: true, contact: newContact };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Erro ao criar contato",
        };
      }
    },
    [organization.id, currentMembership.id]
  );

  const handleCreateContactForStage = useCallback(
    async (stageId: ContactStageId) => {
      if (kanbanCreatingStage) {
        setFeedback({ type: "warning", message: "Aguarde a criação em andamento" });
        return;
      }
      setKanbanCreatingStage(stageId);
      try {
        const base = emptyEditableForm(currentMembership.id);
        const existingInStage = contacts.filter((contact) => contact.stage === stageId);
        const defaultName = existingInStage.length > 0 ? `Novo contato ${existingInStage.length + 1}` : "Novo contato";
        const form: EditableContactForm = { ...base, stage: stageId, name: defaultName };
        const result = await createContactRequest(form);
        if (!result.success) {
          setFeedback({ type: "error", message: result.error });
          return;
        }
        setContacts((current) => [result.contact, ...current.filter((contact) => contact.id !== result.contact.id)]);
        setFeedback({ type: "success", message: "Contato criado no Kanban" });
      } finally {
        setKanbanCreatingStage(null);
      }
    },
    [kanbanCreatingStage, currentMembership.id, contacts, createContactRequest]
  );

  useEffect(() => {
    trackEvent("crm/board_view_loaded", { organizationId: organization.id, total: contacts.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!feedback) {
      return;
    }
    const timeout = window.setTimeout(() => setFeedback(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  const visibleContacts = useMemo(() => {
    const base = savedView
      ? applySavedView(savedView, contacts, currentMembership, memberships)
      : contacts;

    const enrichedFilters = { ...filters };
    if (filters.search == null && savedView === "hoje") {
      // keep search empty; filter handled by saved view
    }

    const filtered = base.filter((contact) => matchesFilters(contact, enrichedFilters));
    if (!sorting) {
      return filtered;
    }

    return sortContacts(filtered, sorting);
  }, [savedView, contacts, currentMembership, memberships, filters, sorting]);

  const loadModalDetail = useCallback(
    async (contactId: string) => {
      setModalLoading(true);
      setModalError(null);
      try {
        const url = new URL(`/api/crm/contacts/${contactId}`, window.location.origin);
        url.searchParams.set("organizationId", organization.id);
        const response = await fetch(url.toString(), { cache: "no-store" });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(body?.error ?? "Erro ao carregar contato");
        }
        const detail = body.detail as ContactDetail;
        setModalDetail(detail);
        setModalForm(contactToEditable(detail.contact));
      } catch (error) {
        setModalDetail(null);
        setModalError(error instanceof Error ? error.message : "Erro ao carregar contato");
      } finally {
        setModalLoading(false);
      }
    },
    [organization.id]
  );

  useEffect(() => {
    if (!modalState) {
      return;
    }
    loadModalDetail(modalState.contactId);
  }, [modalState, loadModalDetail]);

  useEffect(() => {
    if (!modalState) {
      return;
    }
    const newIndex = visibleContacts.findIndex((contact) => contact.id === modalState.contactId);
    if (newIndex >= 0 && newIndex !== modalState.index) {
      setModalState((current) => (current ? { ...current, index: newIndex } : current));
    }
  }, [visibleContacts, modalState]);

  const submitContactForm = useCallback(
    async (contactId: string, form: EditableContactForm): Promise<ContactUpdateResult> => {
      try {
        const payload = parseEditableContactForm(form);
        const response = await fetch(`/api/crm/contacts/${contactId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            organizationId: organization.id,
            actorMembershipId: currentMembership.id,
          }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          const firstError = body?.errors?.[0]?.message ?? body?.error ?? "Erro ao atualizar contato";
          return { success: false, error: firstError };
        }
        const updatedContact: ContactRecord = body.contact;
        setContacts((current) => current.map((item) => (item.id === updatedContact.id ? updatedContact : item)));
        if (modalState?.contactId === updatedContact.id) {
          setModalForm(contactToEditable(updatedContact));
          setModalDetail((currentDetail) =>
            currentDetail ? { ...currentDetail, contact: updatedContact } : currentDetail
          );
        }
        return { success: true, contact: updatedContact };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Erro ao atualizar contato",
        };
      }
    },
    [organization.id, currentMembership.id, modalState]
  );

  const applyContactUpdate = useCallback(
    async (
      contactId: string,
      updates: Partial<EditableContactForm>,
      source: "modal" | "kanban" | "board"
    ): Promise<ContactUpdateResult> => {
      const existing = contacts.find((item) => item.id === contactId);
      if (!existing) {
        return { success: false, error: "Contato não encontrado" };
      }
      const nextForm = { ...contactToEditable(existing), ...updates };
      const result = await submitContactForm(contactId, nextForm);
      if (!result.success) {
        setFeedback({ type: "error", message: result.error });
        return result;
      }
      const updated = result.contact;
      emitContactTelemetry(existing, updated, source);
      if (existing.stage !== updated.stage) {
        setFeedback({ type: "success", message: "Estágio atualizado" });
      } else if (nextStepSignature(existing) !== nextStepSignature(updated)) {
        setFeedback({ type: "success", message: "Próximo passo atualizado" });
      }
      const shouldRefreshTimeline =
        existing.stage !== updated.stage ||
        existing.nextActionAt !== updated.nextActionAt ||
        existing.nextActionNote !== updated.nextActionNote;
      if (shouldRefreshTimeline && modalState?.contactId === contactId) {
        await loadModalDetail(contactId);
      }
      return { success: true, contact: updated };
    },
    [contacts, emitContactTelemetry, submitContactForm, loadModalDetail, modalState]
  );

  const handleModalRefresh = useCallback(() => {
    if (modalState) {
      loadModalDetail(modalState.contactId);
    }
  }, [modalState, loadModalDetail]);

  const handleModalSubmit = useCallback(async () => {
    if (!modalState || !modalForm) {
      throw new Error("Contato não encontrado");
    }
    setModalSaving(true);
    try {
      const result = await submitContactForm(modalState.contactId, modalForm);
      if (!result.success) {
        throw new Error(result.error);
      }
      setFeedback({ type: "success", message: "Contato atualizado" });
      trackEvent("crm/contact_modal_save", { contactId: modalState.contactId });
      await loadModalDetail(modalState.contactId);
    } finally {
      setModalSaving(false);
    }
  }, [modalState, modalForm, submitContactForm, loadModalDetail]);

  const handleModalStageChange = useCallback(
    async (stage: ContactStageId) => {
      if (!modalState) {
        return;
      }
      await applyContactUpdate(modalState.contactId, { stage }, "modal");
    },
    [modalState, applyContactUpdate]
  );

  const handleModalTabChange = useCallback(
    (tab: ContactModalTab) => {
      setModalTab(tab);
      if (modalState) {
        trackEvent("crm/contact_modal_tab_change", { contactId: modalState.contactId, tab });
      }
    },
    [modalState]
  );

  const handleOpenContact = useCallback(
    (contactId: string) => {
      const index = visibleContacts.findIndex((contact) => contact.id === contactId);
      if (index === -1) {
        return;
      }
      setModalState({ contactId, index });
      setModalDetail(null);
      setModalForm(null);
      setModalError(null);
      setModalSaving(false);
      setModalTab("activities");
      trackEvent("crm/contact_modal_open", {
        contactId,
        index,
        total: visibleContacts.length,
      });
    },
    [visibleContacts]
  );

  const handleModalNavigate = useCallback(
    (direction: "prev" | "next") => {
      if (!modalState) {
        return;
      }
      const newIndex =
        direction === "prev"
          ? Math.max(0, modalState.index - 1)
          : Math.min(visibleContacts.length - 1, modalState.index + 1);
      const target = visibleContacts[newIndex];
      if (!target || target.id === modalState.contactId) {
        return;
      }
      setModalState({ contactId: target.id, index: newIndex });
      setModalDetail(null);
      setModalForm(null);
      setModalError(null);
      setModalSaving(false);
      setModalTab("activities");
      trackEvent("crm/contact_modal_open", {
        contactId: target.id,
        index: newIndex,
        total: visibleContacts.length,
      });
    },
    [modalState, visibleContacts]
  );

  const closeModal = useCallback(() => {
    setModalState(null);
    setModalDetail(null);
    setModalForm(null);
    setModalError(null);
    setModalSaving(false);
    setModalTab("activities");
  }, []);

  const handleKanbanStageChange = useCallback(
    async (contactId: string, stage: ContactStageId) => {
      const existing = contacts.find((item) => item.id === contactId);
      if (!existing) {
        setFeedback({ type: "error", message: "Contato não encontrado" });
        return;
      }
      if (existing.stage === stage) {
        setFeedback({ type: "warning", message: "Contato já está neste estágio" });
        return;
      }
      await applyContactUpdate(contactId, { stage }, "kanban");
    },
    [contacts, applyContactUpdate]
  );

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
      const result = await createContactRequest(createForm);
      if (!result.success) {
        setFormErrors(result.error);
        setFeedback({ type: "error", message: result.error });
        return;
      }
      setContacts((current) => [result.contact, ...current.filter((contact) => contact.id !== result.contact.id)]);
      setFeedback({ type: "success", message: "Contato criado com sucesso" });
      setCreateForm(emptyEditableForm(currentMembership.id));
      setIsCreating(false);
    } finally {
      setIsLoading(false);
    }
  }, [createContactRequest, createForm, currentMembership.id]);

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
    const previous = contacts.find((contact) => contact.id === editingContactId);
    setIsLoading(true);
    setFormErrors(null);
    try {
      const result = await submitContactForm(editingContactId, editingForm);
      if (!result.success) {
        setFormErrors(result.error);
        setFeedback({ type: "error", message: result.error });
        return;
      }
      emitContactTelemetry(previous, result.contact, "board");
      setFeedback({ type: "success", message: "Contato atualizado" });
      cancelEdit();
    } finally {
      setIsLoading(false);
    }
  }, [contacts, editingContactId, editingForm, emitContactTelemetry, submitContactForm, cancelEdit]);


  const isRowEditing = (contactId: string) => editingContactId === contactId;

  const tableColumns = useMemo<TableColumn[]>(
    () => [
      { id: "select", title: "", width: 48, loadingStateType: "circle" },
      { id: "name", title: "Contato", width: "2fr", loadingStateType: "long-text" },
      { id: "owner", title: "Dono", width: "1fr", loadingStateType: "medium-text" },
      { id: "stage", title: "Estágio", width: "1fr", loadingStateType: "medium-text" },
      { id: "lastTouch", title: "Último toque", width: "1fr", loadingStateType: "medium-text" },
      { id: "nextAction", title: "Próximo passo", width: "1.4fr", loadingStateType: "long-text" },
      { id: "referredBy", title: "Indicado por", width: "1fr", loadingStateType: "medium-text" },
      { id: "whatsapp", title: "WhatsApp", width: "1fr", loadingStateType: "medium-text" },
      { id: "tags", title: "Tags", width: "1.4fr", loadingStateType: "long-text" },
      { id: "score", title: "Score", width: 96, loadingStateType: "circle" },
      { id: "actions", title: "Ações", width: 140, loadingStateType: "medium-text" },
    ],
    []
  );
  const skeletonRows = useMemo(() => Array.from({ length: 5 }, (_, index) => index), []);
  const headerCheckboxRef = useRef<HTMLInputElement | null>(null);
  const isSelectAllChecked =
    visibleContacts.length > 0 && visibleContacts.every((contact) => selection.has(contact.id));
  const hasSelection = selection.size > 0;
  const showSkeleton = (isRefreshing || isLoading) && visibleContacts.length === 0;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate =
        selection.size > 0 && selection.size < visibleContacts.length;
    }
  }, [selection, visibleContacts.length]);

  const sortStateFor = useCallback(
    (column: SortColumn): "asc" | "desc" | "none" =>
      sorting?.column === column ? sorting.direction : "none",
    [sorting]
  );

  const handleSortColumn = useCallback(
    (column: SortColumn, direction: "asc" | "desc" | "none") => {
      setSorting(direction === "none" ? null : { column, direction });
    },
    [setSorting]
  );

  return (
    <section className={styles.page} aria-labelledby="crm-board-heading">
      <header className={styles.header}>
        <h1 id="crm-board-heading" className={styles.headerTitle}>
          Meus Contatos
        </h1>
        <MenuButton
          ariaLabel="Abrir ações adicionais"
          dialogPosition={MenuButton.dialogPositions.BOTTOM_END}
          tooltipContent="Mais ações"
          closeMenuOnItemClick
          component={() => (
            <IconButton
              icon={MoreActions}
              ariaLabel="Mais ações"
              kind={IconButton.kinds.SECONDARY}
              size={IconButton.sizes.SMALL}
              className={styles.headerMenuButton}
            />
          )}
        >
          <Menu>
            <MenuItem icon={Chart} title="Relatórios" onClick={() => setReportsOpen(true)} />
            <MenuItem icon={Upload} title="Importar contatos" onClick={() => setImportOpen(true)} />
          </Menu>
        </MenuButton>
      </header>

      <div className={styles.content}>
        <Tabs activeTabId={activeTab}>
          <TabList>
            <Tab value={0} active={activeTab === 0} onClick={() => setActiveTab(0)}>
              Tabela
            </Tab>
            <Tab value={1} active={activeTab === 1} onClick={() => setActiveTab(1)}>
              Kanban
            </Tab>
          </TabList>
          <TabPanels activeTabId={activeTab}>
            <TabPanel index={0}>
              <div className={styles.tablePanel}>
                <div
                  className={styles.tableToolbar}
                  role="toolbar"
                  aria-label="Ações da tabela de contatos"
                >
                  <div className={styles.toolbarPrimary}>
                    <Button
                      kind={Button.kinds.PRIMARY}
                      leftIcon={Add}
                      onClick={() => {
                        setActiveTab(0);
                        setIsCreating(true);
                        setCreateForm(() => emptyEditableForm(currentMembership.id));
                        setFormErrors(null);
                      }}
                      disabled={isCreating || isLoading}
                    >
                      Criar contato
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
                          <div className={styles.filtersHeader}>
                            <span className={styles.filtersTitle}>Filtros</span>
                            <button
                              type="button"
                              className={styles.clearFilters}
                              onClick={() => {
                                setFilters({});
                                setFiltersDialogOpen(false);
                              }}
                            >
                              Limpar tudo
                            </button>
                          </div>
                          <div className={styles.filterGroup}>
                            <span className={styles.filterLabel}>Estágios</span>
                            <div className={styles.filterList}>
                              {CONTACT_STAGES.map((stage) => {
                                const checked = filters.stages?.includes(stage.id) ?? false;
                                return (
                                  <Checkbox
                                    key={stage.id}
                                    label={stage.label}
                                    checked={checked}
                                    onChange={(event) => {
                                      const { checked } = event.target;
                                      setFilters((current) => {
                                        const next = new Set(current.stages ?? []);
                                        if (checked) {
                                          next.add(stage.id);
                                        } else {
                                          next.delete(stage.id);
                                        }
                                        return {
                                          ...current,
                                          stages: next.size > 0 ? Array.from(next) : undefined,
                                        };
                                      });
                                    }}
                                  />
                                );
                              })}
                            </div>
                          </div>
                          <div className={styles.filterGroup}>
                            <span className={styles.filterLabel}>Donos</span>
                            <div className={styles.filterList}>
                              {memberships.map((member) => {
                                const checked = filters.ownerIds?.includes(member.id) ?? false;
                                return (
                                  <Checkbox
                                    key={member.id}
                                    label={member.displayName}
                                    checked={checked}
                                    onChange={(event) => {
                                      const { checked } = event.target;
                                      setFilters((current) => {
                                        const next = new Set(current.ownerIds ?? []);
                                        if (checked) {
                                          next.add(member.id);
                                        } else {
                                          next.delete(member.id);
                                        }
                                        return {
                                          ...current,
                                          ownerIds: next.size > 0 ? Array.from(next) : undefined,
                                        };
                                      });
                                    }}
                                  />
                                );
                              })}
                            </div>
                          </div>
                          <div className={styles.filterGroup}>
                            <TextField
                              title="Tags"
                              placeholder="marketing, vip"
                              value={filters.tags?.join(", ") ?? ""}
                              onChange={(value) =>
                                setFilters((current) => {
                                  const normalized = value
                                    .split(",")
                                    .map((tag) => tag.trim())
                                    .filter(Boolean);
                                  return { ...current, tags: normalized.length > 0 ? normalized : undefined };
                                })
                              }
                            />
                          </div>
                          <div className={styles.filterGroup}>
                            <span className={styles.filterLabel}>Próximo passo</span>
                            <div className={styles.filterDates}>
                              <TextField
                                type="date"
                                title="De"
                                value={
                                  filters.nextActionBetween?.start
                                    ? filters.nextActionBetween.start.substring(0, 10)
                                    : ""
                                }
                                onChange={(value) =>
                                  setFilters((current) => {
                                    const isoValue = value
                                      ? new Date(`${value}T00:00:00Z`).toISOString()
                                      : null;
                                    const next = { ...(current.nextActionBetween ?? { start: null, end: null }) };
                                    next.start = isoValue;
                                    if (!next.start && !next.end) {
                                      return { ...current, nextActionBetween: undefined };
                                    }
                                    return { ...current, nextActionBetween: next };
                                  })
                                }
                              />
                              <TextField
                                type="date"
                                title="Até"
                                value={
                                  filters.nextActionBetween?.end
                                    ? filters.nextActionBetween.end.substring(0, 10)
                                    : ""
                                }
                                onChange={(value) =>
                                  setFilters((current) => {
                                    const isoValue = value
                                      ? new Date(`${value}T23:59:59Z`).toISOString()
                                      : null;
                                    const next = { ...(current.nextActionBetween ?? { start: null, end: null }) };
                                    next.end = isoValue;
                                    if (!next.start && !next.end) {
                                      return { ...current, nextActionBetween: undefined };
                                    }
                                    return { ...current, nextActionBetween: next };
                                  })
                                }
                              />
                            </div>
                          </div>
                        </DialogContentContainer>
                      }
                    >
                      <Button
                        kind={Button.kinds.SECONDARY}
                        leftIcon={Filter}
                        onClick={() => setFiltersDialogOpen((open) => !open)}
                        aria-haspopup="dialog"
                        aria-expanded={filtersDialogOpen}
                      >
                        Filtros
                      </Button>
                    </PopoverDialog>
                    <Button
                      kind={Button.kinds.SECONDARY}
                      leftIcon={Retry}
                      onClick={handleRefresh}
                      loading={isRefreshing}
                    >
                      Atualizar
                    </Button>
                  </div>
                </div>
                <div className={styles.tableControls}>
                  <div className={styles.savedViews}>
                    {SAVED_VIEWS.map((view) => (
                      <Button
                        key={view.id}
                        kind={savedView === view.id ? Button.kinds.PRIMARY : Button.kinds.TERTIARY}
                        className={`${styles.savedViewButton} ${
                          savedView === view.id ? styles.savedViewButtonActive : ""
                        }`}
                        onClick={() => setSavedView((current) => (current === view.id ? null : view.id))}
                      >
                        {view.label}
                      </Button>
                    ))}
                  </div>
                  <div className={styles.searchRow}>
                    <label htmlFor="crm-search" className={styles.srOnly}>
                      Buscar contatos
                    </label>
                    <input
                      id="crm-search"
                      type="search"
                      className={styles.searchInput}
                      placeholder="Buscar por nome, e-mail, telefone ou tags"
                      value={filters.search ?? ""}
                      onChange={(event) =>
                        setFilters((current) => ({ ...current, search: event.target.value }))
                      }
                    />
                  </div>
                </div>

                <Table
                  columns={tableColumns}
                  dataState={{ isLoading: showSkeleton }}
                  emptyState={<div className={styles.emptyState}>Nenhum contato encontrado.</div>}
                  errorState={
                    <div className={styles.errorState}>Não foi possível carregar os contatos.</div>
                  }
                >
                  <TableHeader>
                    <TableHeaderCell
                      title={
                        <input
                          ref={headerCheckboxRef}
                          type="checkbox"
                          aria-label="Selecionar todos os contatos"
                          checked={isSelectAllChecked}
                          onChange={toggleSelectAll}
                        />
                      }
                      sticky
                    />
                    <TableHeaderCell
                      title="Contato"
                      sortState={sortStateFor("name")}
                      onSortClicked={(direction) => handleSortColumn("name", direction)}
                      sortButtonAriaLabel="Ordenar por contato"
                      sticky
                    />
                    <TableHeaderCell
                      title="Dono"
                      sortState={sortStateFor("owner")}
                      onSortClicked={(direction) => handleSortColumn("owner", direction)}
                      sortButtonAriaLabel="Ordenar por dono"
                    />
                    <TableHeaderCell
                      title="Estágio"
                      sortState={sortStateFor("stage")}
                      onSortClicked={(direction) => handleSortColumn("stage", direction)}
                      sortButtonAriaLabel="Ordenar por estágio"
                    />
                    <TableHeaderCell
                      title="Último toque"
                      sortState={sortStateFor("lastTouch")}
                      onSortClicked={(direction) => handleSortColumn("lastTouch", direction)}
                      sortButtonAriaLabel="Ordenar por último toque"
                    />
                    <TableHeaderCell
                      title="Próximo passo"
                      sortState={sortStateFor("nextAction")}
                      onSortClicked={(direction) => handleSortColumn("nextAction", direction)}
                      sortButtonAriaLabel="Ordenar por próximo passo"
                    />
                    <TableHeaderCell
                      title="Indicado por"
                      sortState={sortStateFor("referredBy")}
                      onSortClicked={(direction) => handleSortColumn("referredBy", direction)}
                      sortButtonAriaLabel="Ordenar por indicado por"
                    />
                    <TableHeaderCell
                      title="WhatsApp"
                      sortState={sortStateFor("whatsapp")}
                      onSortClicked={(direction) => handleSortColumn("whatsapp", direction)}
                      sortButtonAriaLabel="Ordenar por WhatsApp"
                    />
                    <TableHeaderCell
                      title="Tags"
                      sortState={sortStateFor("tags")}
                      onSortClicked={(direction) => handleSortColumn("tags", direction)}
                      sortButtonAriaLabel="Ordenar por tags"
                    />
                    <TableHeaderCell
                      title="Score"
                      sortState={sortStateFor("score")}
                      onSortClicked={(direction) => handleSortColumn("score", direction)}
                      sortButtonAriaLabel="Ordenar por score"
                    />
                    <TableHeaderCell title="Ações" />
                  </TableHeader>

                  <TableBody>
                    {[
                      ...(isCreating
                        ? [
                          <TableRow className={styles.tableRow} key="create-row">
                        <TableCell>
                          <Button kind={Button.kinds.TERTIARY} onClick={() => setIsCreating(false)}>
                            Cancelar
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className={styles.nameCell}>
                            <input
                              className={styles.inlineInput}
                              placeholder="Nome"
                              value={createForm.name}
                              onChange={(event) =>
                                setCreateForm((current) => ({ ...current, name: event.target.value }))
                              }
                              required
                            />
                            <input
                              className={styles.inlineInput}
                              placeholder="E-mail"
                              value={createForm.email}
                              onChange={(event) =>
                                setCreateForm((current) => ({ ...current, email: event.target.value }))
                              }
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <select
                            className={styles.inlineSelect}
                            value={createForm.ownerMembershipId}
                            onChange={(event) =>
                              setCreateForm((current) => ({ ...current, ownerMembershipId: event.target.value }))
                            }
                          >
                            {memberships.map((member) => (
                              <option key={member.id} value={member.id}>
                                {member.displayName}
                              </option>
                            ))}
                          </select>
                        </TableCell>
                        <TableCell>
                          <select
                            className={styles.inlineSelect}
                            value={createForm.stage}
                            onChange={(event) =>
                              setCreateForm((current) => ({ ...current, stage: event.target.value as ContactStageId }))
                            }
                          >
                            {CONTACT_STAGES.map((stage) => (
                              <option key={stage.id} value={stage.id}>
                                {stage.label}
                              </option>
                            ))}
                          </select>
                        </TableCell>
                        <TableCell>
                          <span>{formatDateTime(new Date().toISOString())}</span>
                        </TableCell>
                        <TableCell>
                          <div className={styles.nameCell}>
                            <input
                              className={styles.inlineInput}
                              type="date"
                              value={createForm.nextActionAt}
                              onChange={(event) =>
                                setCreateForm((current) => ({ ...current, nextActionAt: event.target.value }))
                              }
                            />
                            <textarea
                              className={styles.inlineTextarea}
                              placeholder="Próximo passo"
                              value={createForm.nextActionNote}
                              onChange={(event) =>
                                setCreateForm((current) => ({ ...current, nextActionNote: event.target.value }))
                              }
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <select
                            className={styles.inlineSelect}
                            value={createForm.referredByContactId}
                            onChange={(event) =>
                              setCreateForm((current) => ({ ...current, referredByContactId: event.target.value }))
                            }
                          >
                            <option value="">Indicado por</option>
                            {contacts.map((contactOption) => (
                              <option key={contactOption.id} value={contactOption.id}>
                                {contactOption.name}
                              </option>
                            ))}
                          </select>
                        </TableCell>
                        <TableCell>
                          <input
                            className={styles.inlineInput}
                            placeholder="Telefone/WhatsApp"
                            value={createForm.whatsapp}
                            onChange={(event) =>
                              setCreateForm((current) => ({ ...current, whatsapp: event.target.value }))
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <input
                            className={styles.inlineInput}
                            placeholder="Tags (separadas por vírgula)"
                            value={createForm.tags}
                            onChange={(event) =>
                              setCreateForm((current) => ({ ...current, tags: event.target.value }))
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <input
                            className={styles.inlineInput}
                            placeholder="Score"
                            type="number"
                            min={0}
                            max={100}
                            value={createForm.score}
                            onChange={(event) =>
                              setCreateForm((current) => ({ ...current, score: event.target.value }))
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <div className={styles.rowActions}>
                            <Button kind={Button.kinds.PRIMARY} onClick={handleCreate} loading={isLoading}>
                              Salvar
                            </Button>
                          </div>
                          {formErrors && <div className={styles.formError}>{formErrors}</div>}
                        </TableCell>
                          </TableRow>,
                          ]
                        : []),
                      ...(showSkeleton
                        ? skeletonRows.map((rowIndex) => (
                          <TableRow key={`skeleton-${rowIndex}`} className={styles.tableRow}>
                            {tableColumns.map((column) => (
                              <TableLoadingSkeletonCell
                                key={column.id}
                                type={column.loadingStateType}
                              />
                            ))}
                          </TableRow>
                        ))
                        : visibleContacts.map((contact) => {
                          const stageDefinition = CONTACT_STAGES.find(
                            (stage) => stage.id === contact.stage
                          );
                          const pillClass =
                            stageDefinition ? STAGE_TONES[stageDefinition.tone] : styles.stagePillGray;
                          const isSelected = selection.has(contact.id);

                          if (isRowEditing(contact.id) && editingForm) {
                            return (
                              <TableRow key={contact.id} className={styles.tableRow}>
                                <TableCell>
                                  <Button kind={Button.kinds.TERTIARY} onClick={cancelEdit}>
                                    Cancelar
                                  </Button>
                                </TableCell>
                                <TableCell>
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
                                </TableCell>
                                <TableCell>
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
                                </TableCell>
                                <TableCell>
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
                                </TableCell>
                                <TableCell>{formatDateTime(contact.lastTouchAt)}</TableCell>
                                <TableCell>
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
                                </TableCell>
                                <TableCell>
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
                                  {editingForm.stage === "perdido" && (
                                    <div className={styles.nameCell}>
                                      <textarea
                                        className={styles.inlineTextarea}
                                        placeholder="Motivo da perda"
                                        value={editingForm.lostReason}
                                        onChange={(event) =>
                                          setEditingForm((current) =>
                                            current ? { ...current, lostReason: event.target.value } : current
                                          )
                                        }
                                      />
                                      <input
                                        className={styles.inlineInput}
                                        type="date"
                                        value={editingForm.lostReviewAt}
                                        onChange={(event) =>
                                          setEditingForm((current) =>
                                            current ? { ...current, lostReviewAt: event.target.value } : current
                                          )
                                        }
                                      />
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <input
                                    className={styles.inlineInput}
                                    value={editingForm.whatsapp}
                                    onChange={(event) =>
                                      setEditingForm((current) =>
                                        current ? { ...current, whatsapp: event.target.value } : current
                                      )
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <input
                                    className={styles.inlineInput}
                                    value={editingForm.tags}
                                    onChange={(event) =>
                                      setEditingForm((current) =>
                                        current ? { ...current, tags: event.target.value } : current
                                      )
                                    }
                                  />
                                </TableCell>
                                <TableCell>
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
                                </TableCell>
                                <TableCell>
                                  <div className={styles.rowActions}>
                                    <Button kind={Button.kinds.SECONDARY} onClick={cancelEdit}>
                                      Descartar
                                    </Button>
                                    <Button kind={Button.kinds.PRIMARY} onClick={handleUpdate} loading={isLoading}>
                                      Salvar
                                    </Button>
                                  </div>
                                  {formErrors && <div className={styles.formError}>{formErrors}</div>}
                                </TableCell>
                              </TableRow>
                            );
                          }

                          return (
                            <InteractiveTableRow
                              key={contact.id}
                              className={styles.tableRow}
                              data-selected={isSelected}
                              onDoubleClick={() => handleOpenContact(contact.id)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  handleOpenContact(contact.id);
                                }
                                if (event.key.toLowerCase() === "o") {
                                  event.preventDefault();
                                  handleOpenContact(contact.id);
                                }
                              }}
                              tabIndex={0}
                            >
                              <TableCell>
                                <input
                                  type="checkbox"
                                  aria-label={`Selecionar ${contact.name}`}
                                  checked={isSelected}
                                  onChange={() => toggleSelection(contact.id)}
                                />
                              </TableCell>
                              <TableCell>
                                <button
                                  type="button"
                                  className={styles.nameLink}
                                  onClick={() => handleOpenContact(contact.id)}
                                >
                                  {contact.name}
                                </button>
                                <span className={styles.metaLine}>{contact.email ?? "—"}</span>
                              </TableCell>
                              <TableCell>{contact.owner?.displayName ?? "—"}</TableCell>
                              <TableCell>
                                <span className={`${styles.stagePill} ${pillClass}`}>
                                  {stageDefinition?.label ?? contact.stage}
                                </span>
                              </TableCell>
                              <TableCell>{formatDateTime(contact.lastTouchAt)}</TableCell>
                              <TableCell>
                                <div className={styles.nameCell}>
                                  <span>{formatDate(contact.nextActionAt)}</span>
                                  <span className={styles.metaLine}>{contact.nextActionNote ?? "—"}</span>
                                </div>
                              </TableCell>
                              <TableCell>{contact.referredBy?.name ?? "—"}</TableCell>
                              <TableCell>{contact.whatsapp ?? "—"}</TableCell>
                              <TableCell>
                                <div className={styles.tagsCell}>
                                  {contact.tags.length === 0
                                    ? "—"
                                    : contact.tags.map((tag) => (
                                        <span key={tag} className={styles.tagPill}>
                                          {tag}
                                        </span>
                                      ))}
                                </div>
                              </TableCell>
                              <TableCell>{contact.score ?? "—"}</TableCell>
                              <TableCell>
                                <Button kind={Button.kinds.TERTIARY} onClick={() => beginEdit(contact)}>
                                  Editar
                                </Button>
                              </TableCell>
                            </InteractiveTableRow>
                          );
                        })
                      ),
                    ]}
                  </TableBody>
                </Table>
              </div>
            </TabPanel>
            <TabPanel index={1}>
              <div className={styles.kanbanPanel}>
                <ContactsKanban
                  contacts={visibleContacts}
                  onStageChange={handleKanbanStageChange}
                  onOpenContact={handleOpenContact}
                  onAddContact={handleCreateContactForStage}
                  creatingStageId={kanbanCreatingStage}
                />
              </div>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>

      <ContactModal
        open={modalState != null}
        detail={modalDetail}
        loading={modalLoading}
        error={modalError}
        onClose={closeModal}
        onRefresh={handleModalRefresh}
        onSubmit={handleModalSubmit}
        onStageChange={handleModalStageChange}
        onNavigate={handleModalNavigate}
        canNavigatePrev={modalState ? modalState.index > 0 : false}
        canNavigateNext={modalState ? modalState.index < visibleContacts.length - 1 : false}
        positionLabel={modalState ? `${modalState.index + 1} de ${visibleContacts.length}` : ""}
        memberships={memberships}
        form={modalForm}
        onFormChange={(form) => setModalForm(form)}
        onTabChange={handleModalTabChange}
        activeTab={modalTab}
        onOpenContact={handleOpenContact}
        saving={modalSaving}
      />
      {activeTab === 0 && hasSelection ? (
        <BulkActionsBar
          organizationId={organization.id}
          actorMembershipId={currentMembership.id}
          selectedIds={selectedIdsArray}
          contacts={contacts}
          currentMembership={currentMembership}
          memberships={memberships}
          onClear={() => setSelection(new Set())}
          onUpdate={handleBulkUpdate}
        />
      ) : null}
      <ImportContactsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        organizationId={organization.id}
        actorMembershipId={currentMembership.id}
        memberships={memberships}
        onImported={handleImportedContacts}
      />
      <ReportsDialog open={reportsOpen} onClose={() => setReportsOpen(false)} contacts={contacts} />
      {feedback ? (
        <div className={styles.toastStack} role="presentation">
          <div
            className={`${styles.toast} ${
              feedback.type === "success"
                ? styles.toastSuccess
                : feedback.type === "error"
                ? styles.toastError
                : styles.toastWarning
            }`}
            role={feedback.type === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            <span>{feedback.message}</span>
            <button
              type="button"
              className={styles.toastDismiss}
              onClick={() => setFeedback(null)}
              aria-label="Fechar notificação"
            >
              <CloseSmall aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
