import { test, expect } from "@playwright/test";
import { mockApiRoutes, mockLogin3Session } from "../fixtures/api-mocks";

test.describe("Section 9: Login Screen", () => {
  test("shows login screen when unauthenticated", async ({ page }) => {
    // Do NOT seed login session — user is unauthenticated
    await mockApiRoutes(page);
    await page.goto("/");

    await expect(page.getByTestId("login-screen")).toBeVisible();
    await expect(page.getByTestId("login-button")).toBeVisible();
    await expect(page.getByText("PayAgent")).toBeVisible();
  });

  test("login button triggers redirect", async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto("/");

    await expect(page.getByTestId("login-button")).toBeVisible();

    // Intercept navigation to verify redirect URL
    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes("/authorize")),
      page.getByTestId("login-button").click(),
    ]);

    expect(request.url()).toContain("response_type=code");
    expect(request.url()).toContain("code_challenge_method=S256");
  });

  test("authenticated user sees main app", async ({ page }) => {
    await mockLogin3Session(page);
    await mockApiRoutes(page);
    await page.goto("/");

    await expect(page.getByTestId("app-header")).toBeVisible();
    await expect(page.getByTestId("login-screen")).not.toBeVisible();
  });

  test("sign out returns to login screen", async ({ page }) => {
    await mockLogin3Session(page);
    await mockApiRoutes(page);
    await page.goto("/");

    await expect(page.getByTestId("app-header")).toBeVisible();

    await page.getByTestId("sign-out-button").click();

    await expect(page.getByTestId("login-screen")).toBeVisible();
  });
});
