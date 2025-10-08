import { test } from "@playwright/test";

test.describe.skip("Editor de sequências", () => {
  test("exibe abas principais", async ({ page }) => {
    await page.goto("/sequences/seq-1");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
  });
});
