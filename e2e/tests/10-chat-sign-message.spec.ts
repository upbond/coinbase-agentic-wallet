import { test, expect } from "@playwright/test";
import { mockApiRoutes, mockLogin3Session } from "../fixtures/api-mocks";
import { mockChatRoute } from "../fixtures/chat-mock";

test.describe("Section 10: Chat Sign Message", () => {
  test.beforeEach(async ({ page }) => {
    await mockLogin3Session(page);
    await mockApiRoutes(page);
  });

  test("10-1: sign a message via chat", async ({ page }) => {
    await mockChatRoute(page, "sign-message");
    await page.goto("/");

    // Ask to sign a message
    await page.getByTestId("chat-input").fill("Sign the message: Hello CDP!");
    await page.getByTestId("chat-submit").click();

    // Tool indicator for sign_message
    await expect(page.getByTestId("tool-indicator-sign_message")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("tool-checkmark")).toBeVisible({ timeout: 10000 });

    // Response should contain the signature and the message
    await expect(page.getByText(/Signature:/).first()).toBeVisible();
    await expect(page.getByText("0xabcdef12...7890ab1c")).toBeVisible();
  });
});
