import { BulkActionPayload, BulkActionType, ContactRecord, MembershipSummary } from "../types";

export function getTeamMembershipIds(
  current: MembershipSummary,
  memberships: MembershipSummary[]
): string[] {
  if (current.role === "org") {
    return memberships.map((member) => member.id);
  }

  if (current.role === "leader") {
    return memberships
      .filter((member) => member.id === current.id || member.parentLeaderId === current.id)
      .map((member) => member.id);
  }

  return [current.id];
}

export function canAssignOwner(current: MembershipSummary, targetOwnerId: string, memberships: MembershipSummary[]): boolean {
  const allowedIds = getTeamMembershipIds(current, memberships);
  return allowedIds.includes(targetOwnerId);
}

export function canExecuteBulkAction(role: MembershipSummary["role"], action: BulkActionType): boolean {
  if (role === "org") {
    return true;
  }

  if (role === "leader") {
    if (action === "delete") {
      return true;
    }
    return true;
  }

  // reps
  switch (action) {
    case "stage":
    case "next_step":
    case "mark_cadastrado":
    case "mark_perdido":
    case "tags":
    case "referral":
      return true;
    default:
      return false;
  }
}

export function filterContactsByOwnership(
  contacts: ContactRecord[],
  current: MembershipSummary,
  memberships: MembershipSummary[]
): ContactRecord[] {
  if (current.role === "org") {
    return contacts;
  }

  if (current.role === "leader") {
    const allowed = new Set(getTeamMembershipIds(current, memberships));
    return contacts.filter((contact) => allowed.has(contact.ownerMembershipId));
  }

  return contacts.filter((contact) => contact.ownerMembershipId === current.id);
}

export function normalizeTagsInput(tags: string[]): string[] {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
}

export function requiresLostMetadata(action: BulkActionPayload): action is Extract<BulkActionPayload, { type: "mark_perdido" }> {
  return action.type === "mark_perdido";
}
