import { useState } from "react";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ContactModal, { ContactModalTab } from "@/features/crm/contacts/components/ContactModal";
import { contactToEditable } from "@/features/crm/contacts/utils/forms";
import { ContactDetail, MembershipSummary } from "@/features/crm/contacts/types";

document.body.innerHTML = '<div id="root"></div>';

const memberships: MembershipSummary[] = [
  {
    id: "member-1",
    organizationId: "org-1",
    role: "org",
    userId: "user-1",
    parentLeaderId: null,
    displayName: "Org Owner",
    email: "owner@example.com",
    avatarUrl: null,
  },
];

const detail: ContactDetail = {
  contact: {
    id: "contact-1",
    organizationId: "org-1",
    ownerMembershipId: "member-1",
    name: "Maria Lima",
    email: "maria@example.com",
    whatsapp: "+5511999999999",
    stage: "novo",
    source: "webinar",
    tags: ["vip"],
    score: 80,
    lastTouchAt: new Date().toISOString(),
    nextActionAt: new Date().toISOString(),
    nextActionNote: "Enviar proposta",
    referredByContactId: null,
    lostReason: null,
    lostReviewAt: null,
    archivedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    owner: memberships[0],
    referredBy: null,
  },
  referrals: [],
  timeline: [
    {
      id: "event-1",
      contactId: "contact-1",
      organizationId: "org-1",
      occurredAt: new Date().toISOString(),
      type: "created",
      payload: {},
      actorMembershipId: "member-1",
      actor: memberships[0],
    },
  ],
};

vi.spyOn(window, "open").mockImplementation(() => null);

function ModalHarness({ initialTab = "activities" as ContactModalTab }) {
  const [tab, setTab] = useState<ContactModalTab>(initialTab);
  const [form, setForm] = useState(contactToEditable(detail.contact));
  const handleTabChange = (next: ContactModalTab) => {
    setTab(next);
    tabChange(next);
  };

  return (
    <ContactModal
      open
      detail={detail}
      loading={false}
      error={null}
      onClose={() => {}}
      onRefresh={refresh}
      onSubmit={submit}
      onStageChange={stageChange}
      onNavigate={() => {}}
      canNavigatePrev={false}
      canNavigateNext={false}
      positionLabel="1 de 1"
      memberships={memberships}
      form={form}
      onFormChange={setForm}
      onTabChange={handleTabChange}
      activeTab={tab}
      onOpenContact={() => {}}
      saving={false}
    />
  );
}

const submit = vi.fn(async () => {});
const stageChange = vi.fn(async () => {});
const refresh = vi.fn();
const tabChange = vi.fn();

afterEach(() => {
  submit.mockClear();
  stageChange.mockClear();
  refresh.mockClear();
  tabChange.mockClear();
});

describe("ContactModal", () => {
  it("exibe dados do contato e permite alterar estágio", async () => {
    render(<ModalHarness />);
    const heading = await screen.findByRole("heading", { name: /Maria Lima/i });
    expect(heading).toBeInTheDocument();

    const stageSelect = screen.getByLabelText(/Alterar estágio/i);
    fireEvent.change(stageSelect, { target: { value: "qualificado" } });
    await waitFor(() => expect(stageChange).toHaveBeenCalledWith("qualificado"));
  });

  it("salva alterações na aba dados", async () => {
    render(<ModalHarness initialTab="data" />);
    const nameInput = screen.getByLabelText(/Nome/i);
    fireEvent.change(nameInput, { target: { value: "Maria Atualizada" } });
    const saveButton = screen.getByRole("button", { name: /Salvar$/i });
    fireEvent.click(saveButton);
    await waitFor(() => expect(submit).toHaveBeenCalled());
  });

  it("troca de abas emite evento", async () => {
    render(<ModalHarness />);
    const dataTab = screen.getByRole("tab", { name: /Dados/i });
    fireEvent.click(dataTab);
    await waitFor(() => expect(tabChange).toHaveBeenCalledWith("data"));
  });
});
