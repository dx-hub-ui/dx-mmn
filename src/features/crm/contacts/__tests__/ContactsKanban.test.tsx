import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ContactsKanban from "@/features/crm/contacts/components/ContactsKanban";
import { ContactRecord } from "@/features/crm/contacts/types";

const contacts: ContactRecord[] = [
  {
    id: "1",
    organizationId: "org-1",
    ownerMembershipId: "member-1",
    name: "Maria Teste",
    email: "maria@test.com",
    whatsapp: "+5511988887777",
    stage: "novo",
    source: "manual",
    tags: ["vip"],
    score: 70,
    lastTouchAt: null,
    nextActionAt: null,
    nextActionNote: null,
    referredByContactId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    owner: null,
    referredBy: null,
  },
];

const stageChange = vi.fn();
const openContact = vi.fn();

describe("ContactsKanban", () => {
  it("renderiza colunas e permite abrir contato", () => {
    render(<ContactsKanban contacts={contacts} onStageChange={stageChange} onOpenContact={openContact} />);
    expect(screen.getByText(/Novo/)).toBeInTheDocument();
    const nameButton = screen.getByText(/Maria Teste/).closest("button");
    expect(nameButton).toBeTruthy();
    fireEvent.click(nameButton!);
    expect(openContact).toHaveBeenCalledWith("1");
  });
});
