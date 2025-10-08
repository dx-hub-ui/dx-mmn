import { test, expect } from "@playwright/test";

const shouldSkip = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

test.describe("Menu do usuário", () => {
  test.skip(shouldSkip, "Supabase environment não configurado para e2e");

  const ensureAuthenticated = async (page: import("@playwright/test").Page) => {
    await page.goto("/dashboard");
    const heading = page.getByRole("heading", { name: /Entrar na plataforma/i });
    if (await heading.isVisible().catch(() => false)) {
      test.skip(true, "Requer sessão autenticada para executar o teste");
    }
  };

  test("abre submenu de tema e aplica Noite", async ({ page }) => {
    await ensureAuthenticated(page);

    await page.getByRole("button", { name: "Abrir menu do usuário" }).click();
    await page.getByRole("menuitem", { name: "Mudar tema" }).hover();
    await page.getByRole("menuitem", { name: "Noite" }).click();
    await expect(page.locator("html")).toHaveAttribute("class", /theme-night/);
  });

  test("realiza logout e redireciona para a tela de login", async ({ page }) => {
    await ensureAuthenticated(page);

    await page.getByRole("button", { name: "Abrir menu do usuário" }).click();
    await page.getByRole("menuitem", { name: "Logout" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
  });
});
