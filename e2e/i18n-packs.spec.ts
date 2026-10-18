import { expect, test } from "@playwright/test";

test.describe("English UI", () => {
  test.use({ locale: "en-US" });

  test("detects the browser language and can switch to French", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    await page.goto("/settings");
    await page.getByRole("combobox", { name: "Language" }).selectOption("fr");
    await expect(page.getByRole("heading", { name: "Réglages" })).toBeVisible();

    // persisted across reloads
    await page.reload();
    await expect(page.getByRole("heading", { name: "Réglages" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  });

  test("installs the English starter pack from the home page", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/");
    const pack = page.locator(".card", { hasText: "for English speakers" }).last();
    await expect(pack.getByText("Recommended")).toBeVisible();
    await pack.getByRole("button", { name: "Install" }).click();
    await expect(page.getByText(/Pack installed/)).toBeVisible({ timeout: 30_000 });

    // home now lists decks and the daily review has new cards
    await expect(page.getByRole("link", { name: /Today.s review/ })).toContainText("new");
    await page.goto("/vocab");
    await expect(page.getByText("Numbers", { exact: false }).first()).toBeVisible();
  });
});
