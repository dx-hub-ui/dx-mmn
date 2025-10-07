export type ContactStageId =
  | "novo"
  | "contatado"
  | "followup"
  | "qualificado"
  | "cadastrado"
  | "perdido";

export type ContactStageDefinition = {
  id: ContactStageId;
  label: string;
  description: string;
  order: number;
  tone: "blue" | "green" | "orange" | "purple" | "gray" | "red";
};

export const CONTACT_STAGES: ContactStageDefinition[] = [
  {
    id: "novo",
    label: "Novo",
    description: "Contato recém-adicionado ao funil",
    order: 1,
    tone: "blue",
  },
  {
    id: "contatado",
    label: "Contato feito",
    description: "Primeiro contato estabelecido",
    order: 2,
    tone: "purple",
  },
  {
    id: "qualificado",
    label: "Qualificado",
    description: "Contato engajado e pronto para avançar",
    order: 3,
    tone: "green",
  },
  {
    id: "followup",
    label: "Follow-up",
    description: "Aguardando retorno ou ação",
    order: 4,
    tone: "orange",
  },
  {
    id: "cadastrado",
    label: "Cadastrado",
    description: "Convertido no cadastro da rede",
    order: 5,
    tone: "gray",
  },
  {
    id: "perdido",
    label: "Perdido",
    description: "Oportunidade perdida",
    order: 6,
    tone: "red",
  },
];

export type MembershipRole = "org" | "leader" | "rep";

export type MembershipSummary = {
  id: string;
  organizationId: string;
  role: MembershipRole;
  userId: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  parentLeaderId: string | null;
};

export type ContactBase = {
  id: string;
  organizationId: string;
  ownerMembershipId: string;
  name: string;
  email: string | null;
  whatsapp: string | null;
  stage: ContactStageId;
  source: string | null;
  tags: string[];
  score: number | null;
  lastTouchAt: string | null;
  nextActionAt: string | null;
  nextActionNote: string | null;
  referredByContactId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContactRecord = ContactBase & {
  owner: MembershipSummary | null;
  referredBy: Pick<ContactBase, "id" | "name"> | null;
};

export type ContactInput = {
  name: string;
  email?: string | null;
  whatsapp?: string | null;
  stage: ContactStageId;
  ownerMembershipId: string;
  source?: string | null;
  tags?: string[];
  score?: number | null;
  nextActionAt?: string | null;
  nextActionNote?: string | null;
  referredByContactId?: string | null;
};

export type ContactTimelineEventType =
  | "created"
  | "note"
  | "interaction_whatsapp"
  | "interaction_call"
  | "interaction_email"
  | "stage_changed"
  | "owner_changed"
  | "next_step_set";

export type ContactTimelineEvent = {
  id: string;
  contactId: string;
  organizationId: string;
  occurredAt: string;
  type: ContactTimelineEventType;
  payload: Record<string, unknown>;
  actorMembershipId: string | null;
  actor: MembershipSummary | null;
};

export type ContactReferralSummary = {
  id: string;
  name: string;
  stage: ContactStageId;
};

export type ContactDetail = {
  contact: ContactRecord;
  referrals: ContactReferralSummary[];
  timeline: ContactTimelineEvent[];
};

export type ContactFilters = {
  stages?: ContactStageId[];
  ownerIds?: string[];
  referredByContactIds?: string[];
  tags?: string[];
  nextActionBetween?: { start: string | null; end: string | null };
  search?: string;
};

export type SavedViewId =
  | "meus"
  | "time"
  | "hoje"
  | "sem-toque-7d"
  | "novos-semana"
  | "indicados-por-mim";

export type SavedViewDefinition = {
  id: SavedViewId;
  label: string;
  description: string;
};

export type ContactsBoardTelemetryEvent =
  | { type: "crm/board_view_loaded"; payload: { organizationId: string; total: number } }
  | { type: "crm/selection_changed"; payload: { count: number } }
  | { type: "crm/filters_changed"; payload: { filters: ContactFilters; view: SavedViewId | null } };
