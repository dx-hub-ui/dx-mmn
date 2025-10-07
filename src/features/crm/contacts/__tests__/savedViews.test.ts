import { describe, expect, it } from "vitest";
import { applySavedView } from "@/features/crm/contacts/utils/savedViews";
import { ContactRecord, MembershipSummary } from "@/features/crm/contacts/types";

const baseMembership: MembershipSummary = {
  id: "member-1",
  organizationId: "org",
  role: "leader",
  userId: "user-1",
  displayName: "Líder",
  email: "lider@example.com",
  avatarUrl: null,
  parentLeaderId: null,
};

const contacts: ContactRecord[] = [
  {
    id: "contact-1",
    organizationId: "org",
    ownerMembershipId: "member-1",
    name: "Primeiro",
    email: "primeiro@example.com",
    whatsapp: "+5511999999999",
    stage: "novo",
    source: "manual",
    tags: ["vip"],
    score: 80,
    lastTouchAt: new Date().toISOString(),
    nextActionAt: new Date().toISOString(),
    nextActionNote: "Ligar",
    referredByContactId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    owner: baseMembership,
    referredBy: null,
  },
  {
    id: "contact-2",
    organizationId: "org",
    ownerMembershipId: "member-2",
    name: "Segundo",
    email: "segundo@example.com",
    whatsapp: "+5511888888888",
    stage: "followup",
    source: "indicacao",
    tags: ["time"],
    score: 40,
    lastTouchAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
    nextActionAt: new Date().toISOString(),
    nextActionNote: null,
    referredByContactId: "contact-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    owner: {
      ...baseMembership,
      id: "member-2",
      displayName: "Representante",
      role: "rep",
      parentLeaderId: "member-1",
    },
    referredBy: { id: "contact-1", name: "Primeiro" },
  },
];

const memberships: MembershipSummary[] = [
  baseMembership,
  {
    ...baseMembership,
    id: "member-2",
    role: "rep",
    displayName: "Representante",
    parentLeaderId: "member-1",
    userId: "user-2",
  },
];

describe("applySavedView", () => {
  it("filtra contatos do membro atual em 'Meus'", () => {
    const result = applySavedView("meus", contacts, baseMembership, memberships);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("contact-1");
  });

  it("inclui subordinados no modo 'Time'", () => {
    const result = applySavedView("time", contacts, baseMembership, memberships);
    expect(result.map((contact) => contact.id)).toEqual(["contact-1", "contact-2"]);
  });

  it("filtra por indicações", () => {
    const result = applySavedView("indicados-por-mim", contacts, baseMembership, memberships);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("contact-2");
  });
});
