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
    lostReason: null,
    lostReviewAt: null,
    archivedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    owner: null,
    referredBy: null,
  },
];

const stageChange = vi.fn();
const openContact = vi.fn();
const addContact = vi.fn();

describe("ContactsKanban", () => {
  it("renderiza colunas e permite abrir contato", () => {
    render(
      <ContactsKanban
        contacts={contacts}
        onStageChange={stageChange}
        onOpenContact={openContact}
        onAddContact={addContact}
      />
    );
    expect(screen.getByText(/Novo/)).toBeInTheDocument();
    const nameButton = screen.getByText(/Maria Teste/).closest("button");
    expect(nameButton).toBeTruthy();
    fireEvent.click(nameButton!);
    expect(openContact).toHaveBeenCalledWith("1");
  });

  it("permite adicionar contato pela coluna", async () => {
    render(
      <ContactsKanban
        contacts={contacts}
        onStageChange={stageChange}
        onOpenContact={openContact}
        onAddContact={addContact}
      />
    );

    const addButton = screen.getByRole("button", { name: /Adicionar contato em Novo/i });
    fireEvent.click(addButton);
    expect(addContact).toHaveBeenCalledWith("novo");

    const menuButton = screen.getByRole("button", { name: /Abrir opções da coluna Novo/i });
    fireEvent.click(menuButton);

    const menuItem = await screen.findByRole("menuitem", { name: /Adicionar novo contato/i });
    fireEvent.click(menuItem);
    expect(addContact).toHaveBeenCalledWith("novo");
  });
});
