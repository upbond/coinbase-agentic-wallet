import { test, expect } from "@playwright/test";
import { mockApiRoutes, mockLogin3Session } from "../fixtures/api-mocks";
import { mockChatRoute } from "../fixtures/chat-mock";

test.describe("Section 3: Chat Balance Check", () => {
  test("3-1/3-2: check balance shows ETH and USDC", async ({ page }) => {
    await mockLogin3Session(page);
    await mockApiRoutes(page);
    await mockChatRoute(page, "check-balance");
    await page.goto("/");

    // Check balance (wallet is auto-created, no need to create first)
    await page.getByTestId("suggestion-1").click();

    // Wait for check_balance tool to complete
    await expect(page.getByTestId("tool-indicator-check_balance")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("tool-checkmark")).toBeVisible({ timeout: 10000 });

    // Response should contain balance info
    await expect(page.getByText("0.0001 ETH")).toBeVisible();
    await expect(page.getByText("10.0 USDC")).toBeVisible();
  });
});
