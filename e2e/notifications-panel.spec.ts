import { test, expect } from "@playwright/test";

const shouldSkip = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

test.describe("Painel de notificações", () => {
  test.skip(shouldSkip, "Supabase environment não configurado para e2e");

  test("abre painel, marca como lida e silencia", async ({ page }) => {
    await page.route("**/api/notifications/count**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ unreadCount: 2 }) });
    });

    const itemsPayload = {
      items: [
        {
          id: "notif-1",
          orgId: "org",
          userId: "user",
          type: "mention",
          sourceType: "comment",
          sourceId: "c1",
          actor: { id: "actor", displayName: "Ana", email: "ana@example.com", avatarUrl: null },
          title: "Ana comentou",
          snippet: "@você pode revisar o documento?",
          link: "https://app.local/items/1",
          status: "unread",
          createdAt: new Date().toISOString(),
          readAt: null,
        },
      ],
      nextCursor: null,
      unreadCount: 2,
    };

    await page.route("**/api/notifications?**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(itemsPayload) });
    });

    await page.route("**/api/notifications/read", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ updated: 1 }) });
    });

    await page.route("**/api/notifications/mark-all-read", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
    });

    await page.route("**/api/notifications/mute", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, id: "mute" }) });
    });

    await page.route("**/api/user/preferences?**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ email_on_mention_weekly: true, timezone: "UTC" }) });
    });

    await page.route("**/api/user/preferences", async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ email_on_mention_weekly: false, timezone: "UTC" }) });
        return;
      }
      await route.continue();
    });

    await page.goto("/dashboard");

    await page.getByRole("button", { name: "Notificações" }).click();
    const panel = page.getByRole("dialog", { name: /Notificações/ });
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Ana comentou")).toBeVisible();

    await panel.getByRole("button", { name: "Marcar tudo como lido" }).click();
    await panel.getByRole("button", { name: "Preferências" }).click();
    const modal = page.getByRole("dialog", { name: "Preferências de notificações" });
    await expect(modal).toBeVisible();
    await modal.getByRole("button", { name: "Salvar preferências" }).click();

    await panel.getByRole("button", { name: "Ações da notificação" }).click();
    await panel.getByRole("menuitem", { name: "Silenciar este tipo" }).click();
  });
});
