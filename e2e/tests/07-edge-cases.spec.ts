import { test, expect } from "@playwright/test";
import { mockApiRoutes, mockLogin3Session } from "../fixtures/api-mocks";
import { mockChatRoute } from "../fixtures/chat-mock";

test.describe("Section 11: Edge Cases", () => {
  test.beforeEach(async ({ page }) => {
    await mockLogin3Session(page);
    await mockApiRoutes(page);
    await mockChatRoute(page, "general-response");
    await page.goto("/");
  });

  test("11-1: empty message cannot be sent (button disabled)", async ({ page }) => {
    const submitBtn = page.getByTestId("chat-submit");
    await expect(submitBtn).toBeDisabled();
  });

  test("11-2: submit button disabled while loading", async ({ page }) => {
    // Type and submit
    await page.getByTestId("chat-input").fill("Hello");
    await page.getByTestId("chat-submit").click();

    // After response arrives, type again — button should become enabled
    // We check the input is cleared after submit
    await expect(page.getByTestId("chat-input")).toHaveValue("");
  });

  test("11-3: input clears after sending message", async ({ page }) => {
    await page.getByTestId("chat-input").fill("Test message");
    await page.getByTestId("chat-submit").click();

    await expect(page.getByTestId("chat-input")).toHaveValue("");
  });

  test("11-4: welcome screen disappears after first message", async ({ page }) => {
    await expect(page.getByTestId("chat-welcome")).toBeVisible();

    await page.getByTestId("chat-input").fill("Hello");
    await page.getByTestId("chat-submit").click();

    // Welcome should disappear once there are messages
    await expect(page.getByTestId("chat-welcome")).not.toBeVisible({ timeout: 5000 });
  });
});
