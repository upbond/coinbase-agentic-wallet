import { test, expect } from "@playwright/test";
import { mockApiRoutes, mockLogin3Session } from "../fixtures/api-mocks";
import { mockChatRoute } from "../fixtures/chat-mock";

test.describe("Section 6-7: Chat Transfer", () => {
  test.beforeEach(async ({ page }) => {
    await mockLogin3Session(page);
    await mockApiRoutes(page);
  });

  test("6-1/6-2: send ETH via chat", async ({ page }) => {
    await mockChatRoute(page, "send-eth");
    await page.goto("/");

    // Send ETH (wallet auto-created, no need to create wallets)
    await page.getByTestId("chat-input").fill("Send 0.00001 ETH to 0xabcdefabcdefabcdefabcdefabcdefabcdefabcd");
    await page.getByTestId("chat-submit").click();

    await expect(page.getByTestId("tool-indicator-send_payment")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("tool-checkmark")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("0.00001 ETH", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "View on BaseScan" })).toBeVisible();
  });

  test("7-1/7-2: send USDC via chat", async ({ page }) => {
    await mockChatRoute(page, "send-usdc");
    await page.goto("/");

    // Send USDC
    await page.getByTestId("chat-input").fill("Send 1 USDC to 0xabcdefabcdefabcdefabcdefabcdefabcdefabcd");
    await page.getByTestId("chat-submit").click();

    await expect(page.getByTestId("tool-indicator-send_payment")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("tool-checkmark")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("1 USDC", { exact: true })).toBeVisible();
  });
});
