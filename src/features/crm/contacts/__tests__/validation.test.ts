import { describe, expect, it } from "vitest";
import { validateContactInput } from "@/features/crm/contacts/validation/contact";

describe("validateContactInput", () => {
  it("exige motivo quando estágio é perdido", () => {
    const result = validateContactInput({
      name: "Teste",
      stage: "perdido",
      ownerMembershipId: "member-1",
    });
    expect(result.errors).toBeDefined();
    expect(result.errors?.[0].message).toMatch(/motivo da perda/);
  });

  it("aceita estágio perdido com motivo e data", () => {
    const result = validateContactInput({
      name: "Teste",
      stage: "perdido",
      ownerMembershipId: "member-1",
      lostReason: "Sem interesse",
      lostReviewAt: new Date().toISOString(),
    });
    expect(result.errors).toBeUndefined();
    expect(result.value?.lostReason).toBe("Sem interesse");
  });
});
