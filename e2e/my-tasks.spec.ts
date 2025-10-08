import { test, expect } from "@playwright/test";

const shouldSkip = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

test.describe("My Tasks", () => {
  test.skip(shouldSkip, "Supabase environment não configurado para e2e");

  test("exibe abas de filtro e tabela", async ({ page }) => {
    await page.goto("/tasks/my");
    await expect(page.getByRole("heading", { name: /Minhas tarefas/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Todas" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Tarefa" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Ações rápidas" })).toBeVisible();
  });
});
