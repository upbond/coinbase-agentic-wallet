import { test, expect } from "@playwright/test";
import { mockApiRoutes, mockLogin3Session, WALLETS } from "../fixtures/api-mocks";
import { mockChatRoute } from "../fixtures/chat-mock";

test.describe("Cross-tab Sync", () => {
  test("wallet created in chat appears in Wallet tab", async ({ page }) => {
    await mockLogin3Session(page);
    await mockApiRoutes(page);
    await mockChatRoute(page, "create-wallet");
    await page.goto("/");

    // Create wallet via chat
    await page.getByTestId("suggestion-0").click();
    await expect(page.getByTestId("tool-checkmark")).toBeVisible({ timeout: 10000 });

    // Switch to Wallet tab
    await page.getByTestId("tab-wallet").click();

    // Wallet should be in the list
    await expect(
      page.getByTestId(`wallet-card-${WALLETS.myAgent.address}`)
    ).toBeVisible();

    // Empty state should be gone
    await expect(page.getByTestId("wallets-empty")).not.toBeVisible();

    // Wallet count should update
    await expect(page.getByTestId("wallet-count")).toContainText("1 wallet");
  });
});
