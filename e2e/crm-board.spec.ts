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

  test("abre modal de contato e alterna para kanban", async ({ page }) => {
    await page.goto("/crm");
    await page.getByRole("button", { name: "Kanban" }).click();
    await expect(page.getByText(/Arraste contatos/)).toBeVisible();
    await page.getByRole("button", { name: "Tabela" }).click();
    await expect(page.getByText("Nome")).toBeVisible();
    const contactButton = page.getByRole("button", { name: /Maria/ }).first();
    await contactButton.click();
    await expect(page.getByRole("heading", { name: /Maria/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: /Contatos/ })).toBeVisible();
  });

  test("seleciona contatos e abre modais auxiliares", async ({ page }) => {
    await page.goto("/crm");
    const firstCheckbox = page.getByRole("checkbox", { name: /Selecionar/ }).first();
    await firstCheckbox.check();
    await expect(page.getByRole("button", { name: "Mover estágio" })).toBeVisible();
    await page.getByRole("button", { name: "Importar CSV" }).click();
    await expect(page.getByRole("dialog", { name: /Importar contatos via CSV/ })).toBeVisible();
    await page.getByRole("button", { name: "Fechar" }).click();
    await page.getByRole("button", { name: "Relatórios" }).click();
    await expect(page.getByRole("dialog", { name: /Relatórios de contatos/ })).toBeVisible();
    await page.getByRole("button", { name: "Fechar" }).click();
  });
});
