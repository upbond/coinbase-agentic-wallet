import { test, expect } from "@playwright/test";
import { mockApiRoutes, mockLogin3Session } from "../fixtures/api-mocks";
import { mockChatRoute } from "../fixtures/chat-mock";

test.describe("Section 11: Chat Buy Product", () => {
  test.beforeEach(async ({ page }) => {
    await mockLogin3Session(page);
    await mockApiRoutes(page);
  });

  test("11-1: purchase premium weather data via chat", async ({ page }) => {
    await mockChatRoute(page, "buy-product");
    await page.goto("/");

    // Ask to buy the product
    await page.getByTestId("chat-input").fill("Buy the premium weather data");
    await page.getByTestId("chat-submit").click();

    // Tool indicator for buy_product
    await expect(page.getByTestId("tool-indicator-buy_product")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("tool-checkmark")).toBeVisible({ timeout: 10000 });

    // Response should contain weather data and transaction link
    await expect(page.getByText("Premium Weather Data").first()).toBeVisible();
    await expect(page.getByText("23°C")).toBeVisible();
    await expect(page.getByText(/View transaction/)).toBeVisible();
  });
});
