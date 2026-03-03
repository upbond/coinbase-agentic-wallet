import { test, expect } from "@playwright/test";
import { mockApiRoutes, mockLogin3Session, WALLETS } from "../fixtures/api-mocks";

test.describe("Section 9: Wallet Tab Operations", () => {
  test.beforeEach(async ({ page }) => {
    await mockLogin3Session(page);
    await mockApiRoutes(page);
    await page.goto("/");
  });

  test("9-1: wallet tab shows balance and auto-created wallet", async ({ page }) => {
    await page.getByTestId("tab-wallet").click();
    await expect(page.getByTestId("wallet-view")).toBeVisible();
    await expect(page.getByTestId("total-balances")).toBeVisible();
    await expect(page.getByTestId("wallet-count")).toContainText("1 wallet");
    // Wallet card should already be visible (auto-created)
    await expect(
      page.getByTestId(`wallet-card-${WALLETS.myAgent.address}`)
    ).toBeVisible();
  });

  test("9-2: click wallet card to expand and show faucet", async ({ page }) => {
    await page.getByTestId("tab-wallet").click();

    // Wallet card is already visible
    await expect(
      page.getByTestId(`wallet-card-${WALLETS.myAgent.address}`)
    ).toBeVisible();

    // Click to expand
    await page.getByTestId(`wallet-card-${WALLETS.myAgent.address}`).click();
    await expect(
      page.getByTestId(`faucet-section-${WALLETS.myAgent.address}`)
    ).toBeVisible();
  });

  test("9-3: request ETH via wallet tab faucet button", async ({ page }) => {
    await page.getByTestId("tab-wallet").click();

    // Expand wallet card
    await page.getByTestId(`wallet-card-${WALLETS.myAgent.address}`).click();

    // Click Get ETH
    await page.getByTestId(`faucet-eth-${WALLETS.myAgent.address}`).click();

    // Wait for result
    await expect(
      page.getByTestId(`faucet-result-${WALLETS.myAgent.address}`)
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByTestId(`faucet-result-${WALLETS.myAgent.address}`)
    ).toContainText("ETH received");
  });

  test("9-4: request USDC via wallet tab faucet button", async ({ page }) => {
    await page.getByTestId("tab-wallet").click();

    // Expand wallet card
    await page.getByTestId(`wallet-card-${WALLETS.myAgent.address}`).click();

    // Click Get USDC
    await page.getByTestId(`faucet-usdc-${WALLETS.myAgent.address}`).click();

    await expect(
      page.getByTestId(`faucet-result-${WALLETS.myAgent.address}`)
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByTestId(`faucet-result-${WALLETS.myAgent.address}`)
    ).toContainText("USDC received");
  });
});
