import { test, expect } from "@playwright/test";
import { mockApiRoutes, mockLogin3Session, WALLETS } from "../fixtures/api-mocks";
import { mockChatRoute } from "../fixtures/chat-mock";

test.describe("Section 2: Chat Wallet Creation", () => {
  test.beforeEach(async ({ page }) => {
    await mockLogin3Session(page);
    await mockApiRoutes(page);
  });

  test("2-1/2-2: create wallet via suggestion button", async ({ page }) => {
    await mockChatRoute(page, "create-wallet");
    await page.goto("/");

    // Click first suggestion "Create a wallet called MyAgent"
    await page.getByTestId("suggestion-0").click();

    // Wait for tool indicator
    await expect(page.getByTestId("tool-indicator-create_wallet")).toBeVisible();

    // Wait for checkmark (tool completed)
    await expect(page.getByTestId("tool-checkmark")).toBeVisible({ timeout: 10000 });

    // AI response should contain the wallet address (abbreviated)
    const abbrev = `${WALLETS.myAgent.address.slice(0, 6)}...${WALLETS.myAgent.address.slice(-4)}`;
    await expect(page.getByTestId("messages-container").getByText(abbrev)).toBeVisible();
  });

  test("2-5: create a second wallet", async ({ page }) => {
    await mockChatRoute(page, ["create-wallet", "create-wallet-bob"]);
    await page.goto("/");

    // First wallet
    await page.getByTestId("suggestion-0").click();
    await expect(page.getByTestId("tool-checkmark")).toBeVisible({ timeout: 10000 });

    // Second wallet via typed message
    await page.getByTestId("chat-input").fill("Create another wallet called Bob");
    await page.getByTestId("chat-submit").click();

    // Wait for second tool checkmark
    await expect(page.getByTestId("tool-checkmark").nth(1)).toBeVisible({ timeout: 10000 });

    // Verify Bob's address appears
    const abbrev = `${WALLETS.bob.address.slice(0, 6)}...${WALLETS.bob.address.slice(-4)}`;
    await expect(page.getByTestId("messages-container").getByText(abbrev)).toBeVisible();
  });
});
