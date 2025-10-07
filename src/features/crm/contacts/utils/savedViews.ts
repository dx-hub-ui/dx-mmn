import { ContactRecord, MembershipSummary, SavedViewDefinition, SavedViewId } from "../types";

export const SAVED_VIEWS: SavedViewDefinition[] = [
  { id: "meus", label: "Meus", description: "Contatos que estão sob minha responsabilidade" },
  { id: "time", label: "Time", description: "Contatos do meu time direto" },
  { id: "hoje", label: "Hoje", description: "Próximos passos com data para hoje" },
  { id: "sem-toque-7d", label: "Sem toque 7d", description: "Sem registro de toque há 7 dias" },
  { id: "novos-semana", label: "Novos da semana", description: "Contatos criados nos últimos 7 dias" },
  { id: "indicados-por-mim", label: "Indicados por mim", description: "Contatos indicados por mim ou por contatos meus" },
];

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function collectTeamMembershipIds(memberships: MembershipSummary[], leaderId: string): Set<string> {
  const team = new Set<string>();
  const pending = [leaderId];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || team.has(current)) continue;
    team.add(current);
    const children = memberships.filter((member) => member.parentLeaderId === current);
    for (const child of children) {
      pending.push(child.id);
    }
  }
  return team;
}

function isSameDay(dateA: Date, dateB: Date): boolean {
  return (
    dateA.getUTCFullYear() === dateB.getUTCFullYear() &&
    dateA.getUTCMonth() === dateB.getUTCMonth() &&
    dateA.getUTCDate() === dateB.getUTCDate()
  );
}

export function applySavedView(
  viewId: SavedViewId,
  contacts: ContactRecord[],
  currentMembership: MembershipSummary,
  visibleMemberships: MembershipSummary[],
  now: Date = new Date()
): ContactRecord[] {
  switch (viewId) {
    case "meus":
      return contacts.filter((contact) => contact.ownerMembershipId === currentMembership.id);
    case "time": {
      if (currentMembership.role === "rep") {
        return contacts.filter((contact) => contact.ownerMembershipId === currentMembership.id);
      }
      const ids = collectTeamMembershipIds(visibleMemberships, currentMembership.id);
      return contacts.filter((contact) => ids.has(contact.ownerMembershipId));
    }
    case "hoje": {
      return contacts.filter((contact) => {
        if (!contact.nextActionAt) return false;
        const due = new Date(contact.nextActionAt);
        return isSameDay(due, now);
      });
    }
    case "sem-toque-7d": {
      const threshold = now.getTime() - 7 * ONE_DAY_MS;
      return contacts.filter((contact) => {
        if (!contact.lastTouchAt) return true;
        const lastTouch = new Date(contact.lastTouchAt).getTime();
        return lastTouch <= threshold;
      });
    }
    case "novos-semana": {
      const threshold = now.getTime() - 7 * ONE_DAY_MS;
      return contacts.filter((contact) => new Date(contact.createdAt).getTime() >= threshold);
    }
    case "indicados-por-mim": {
      const ownedIds = new Set(
        contacts.filter((contact) => contact.ownerMembershipId === currentMembership.id).map((contact) => contact.id)
      );
      return contacts.filter((contact) => {
        if (!contact.referredByContactId) return false;
        if (ownedIds.has(contact.referredByContactId)) return true;
        const referredBy = contacts.find((c) => c.id === contact.referredByContactId);
        return referredBy?.ownerMembershipId === currentMembership.id;
      });
    }
    default:
      return contacts;
  }
}
