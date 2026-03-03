import { test, expect } from "@playwright/test";
import { mockApiRoutes, mockLogin3Session } from "../fixtures/api-mocks";
import { mockChatRoute } from "../fixtures/chat-mock";

test.describe("Section 4-5: Chat Faucet", () => {
  test.beforeEach(async ({ page }) => {
    await mockLogin3Session(page);
    await mockApiRoutes(page);
  });

  test("4-1/4-2: request ETH from faucet via chat", async ({ page }) => {
    await mockChatRoute(page, "faucet-eth");
    await page.goto("/");

    // Request faucet (wallet auto-created)
    await page.getByTestId("suggestion-2").click();

    // Tool indicator
    await expect(page.getByTestId("tool-indicator-request_faucet")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("tool-checkmark")).toBeVisible({ timeout: 10000 });

    // Response contains BaseScan link
    await expect(page.getByRole("link", { name: "View on BaseScan" })).toBeVisible();
  });

  test("5-1/5-2: request USDC from faucet via chat", async ({ page }) => {
    await mockChatRoute(page, "faucet-usdc");
    await page.goto("/");

    // Request USDC faucet
    await page.getByTestId("chat-input").fill("Get USDC from faucet");
    await page.getByTestId("chat-submit").click();

    await expect(page.getByTestId("tool-indicator-request_faucet")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("tool-checkmark")).toBeVisible({ timeout: 10000 });

    await expect(page.getByRole("link", { name: "View on BaseScan" })).toBeVisible();
  });
});
