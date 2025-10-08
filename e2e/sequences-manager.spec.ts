import { test, expect } from "@playwright/test";

const shouldSkip = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

test.describe("Sequences Manager", () => {
  test.skip(shouldSkip, "Supabase environment não configurado para e2e");

  test("renderiza filtros principais e tabela", async ({ page }) => {
    await page.goto("/sequences");
    await expect(page.getByRole("heading", { name: /Sequências de Tarefas/ })).toBeVisible();
    await expect(page.getByPlaceholder("Buscar por nome, status ou tipo de alvo")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Nome" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Conclusão %" })).toBeVisible();
  });
});
