import { test, expect } from "@playwright/test";
import { mockApiRoutes, mockLogin3Session } from "../fixtures/api-mocks";
import { mockChatRoute } from "../fixtures/chat-mock";

test.describe("Section 12: Chat Buy with Stripe", () => {
  test.beforeEach(async ({ page }) => {
    await mockLogin3Session(page);
    await mockApiRoutes(page);
  });

  test("12-1: shows card info when stripe customer ID is saved", async ({ page }) => {
    // Pre-seed stripe customer ID in localStorage
    await page.addInitScript(() => {
      localStorage.setItem("stripe_customer_id", "cus_mock123");
    });
    await mockChatRoute(page, "general-response");
    await page.goto("/");

    // Card info should be visible on welcome screen
    await expect(page.getByTestId("card-info")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("visa ****4242")).toBeVisible();
  });

  test("12-2: shows add card button when no stripe customer", async ({ page }) => {
    await mockChatRoute(page, "general-response");
    await page.goto("/");

    // Add card button should be visible
    await expect(page.getByTestId("add-card-button")).toBeVisible({ timeout: 10000 });
  });

  test("12-3: purchase AI market report with Stripe via chat", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("stripe_customer_id", "cus_mock123");
    });
    await mockChatRoute(page, "buy-with-stripe");
    await page.goto("/");

    // Ask to buy with Stripe
    await page.getByTestId("chat-input").fill("Buy the AI market report with my card");
    await page.getByTestId("chat-submit").click();

    // Tool indicator for buy_with_stripe
    await expect(page.getByTestId("tool-indicator-buy_with_stripe")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("tool-checkmark")).toBeVisible({ timeout: 10000 });

    // Response should contain report data
    await expect(page.getByText("Premium AI Market Report").first()).toBeVisible();
    await expect(page.getByText("$1.00")).toBeVisible();
  });
});
