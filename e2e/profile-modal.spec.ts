import { test, expect } from "@playwright/test";
import { Buffer } from "node:buffer";

const shouldSkip = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

test.describe("Modal Minha conta", () => {
  test.skip(shouldSkip, "Supabase environment não configurado para e2e");

  const ensureAuthenticated = async (page: import("@playwright/test").Page) => {
    await page.goto("/dashboard");
    const heading = page.getByRole("heading", { name: /Entrar na plataforma/i });
    if (await heading.isVisible().catch(() => false)) {
      test.skip(true, "Requer sessão autenticada para executar o teste");
    }
  };

  test("edita campos e envia avatar", async ({ page }) => {
    await ensureAuthenticated(page);

    await page.getByRole("button", { name: "Abrir menu do usuário" }).click();
    await page.getByRole("menuitem", { name: "Minha conta" }).click();

    const dialog = page.getByRole("dialog", { name: "Minha conta" });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Nome exibido").fill("Usuária QA");
    await dialog.getByLabel("Nome").fill("Usuária");
    await dialog.getByLabel("Sobrenome").fill("Quality");

    const avatarInput = dialog.locator('input[type="file"]');
    const avatarBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==",
      "base64"
    );
    await avatarInput.setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: avatarBuffer });

    await dialog.getByRole("button", { name: "Salvar" }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: "Abrir menu do usuário" }).click();
    await expect(page.getByText("Usuária QA")).toBeVisible();
  });
});
