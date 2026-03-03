import { test, expect } from "@playwright/test";
import { mockApiRoutes, mockLogin3Session } from "../fixtures/api-mocks";

test.describe("Tab Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await mockLogin3Session(page);
    await mockApiRoutes(page);
    await page.goto("/");
  });

  test("switch to Wallet tab", async ({ page }) => {
    await page.getByTestId("tab-wallet").click();
    await expect(page.getByTestId("wallet-view")).toBeVisible();
    await expect(page.getByTestId("wallets-empty")).toBeVisible();
  });

  test("switch back to Chat tab", async ({ page }) => {
    await page.getByTestId("tab-wallet").click();
    await expect(page.getByTestId("wallet-view")).toBeVisible();

    await page.getByTestId("tab-chat").click();
    await expect(page.getByTestId("chat-view")).toBeVisible();
    await expect(page.getByTestId("chat-welcome")).toBeVisible();
  });
});
