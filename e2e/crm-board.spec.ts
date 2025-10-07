import { test, expect } from "@playwright/test";

const shouldSkip = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

test.describe("CRM Board", () => {
  test.skip(shouldSkip, "Supabase environment não configurado para e2e");

  test("exibe tabela com colunas principais", async ({ page }) => {
    await page.goto("/crm");
    await expect(page.getByRole("heading", { name: /Contatos/ })).toBeVisible();
    await expect(page.getByText("Nome")).toBeVisible();
    await expect(page.getByText("Estágio")).toBeVisible();
    await expect(page.getByRole("button", { name: "Novo contato" })).toBeVisible();
  });
});
