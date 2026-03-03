import { test, expect } from "@playwright/test";
import { mockApiRoutes, mockLogin3Session } from "../fixtures/api-mocks";

test.describe("Section 0: Initial Load", () => {
  test.beforeEach(async ({ page }) => {
    await mockLogin3Session(page);
    await mockApiRoutes(page);
    await page.goto("/");
  });

  test("0-1: page renders with dark theme", async ({ page }) => {
    await expect(page.getByTestId("app-header")).toBeVisible();
    await expect(page.getByTestId("main-content")).toBeVisible();
  });

  test("0-2: header shows PayAgent logo and title", async ({ page }) => {
    await expect(page.getByTestId("header-title")).toHaveText("PayAgent");
  });

  test("0-3: header shows Connect Wallet button", async ({ page }) => {
    // RainbowKit renders a button with "Connect Wallet" text
    await expect(page.getByRole("button", { name: /connect wallet/i })).toBeVisible();
  });

  test("0-4: default tab is Chat with suggestions", async ({ page }) => {
    await expect(page.getByTestId("chat-welcome")).toBeVisible();
    await expect(page.getByTestId("suggestion-0")).toContainText("What is my wallet address?");
    await expect(page.getByTestId("suggestion-1")).toContainText("Check my balance");
    await expect(page.getByTestId("suggestion-2")).toContainText("Get testnet ETH from faucet");
  });

  test("0-5: bottom navigation shows 2 tabs with Chat active", async ({ page }) => {
    const nav = page.getByTestId("bottom-nav");
    await expect(nav).toBeVisible();
    await expect(page.getByTestId("tab-wallet")).toBeVisible();
    await expect(page.getByTestId("tab-chat")).toBeVisible();
  });
});
