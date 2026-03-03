import { test, expect } from "@playwright/test";
import { mockApiRoutes, mockLogin3Session, WALLETS } from "../fixtures/api-mocks";

test.describe("Section 9: Wallet Tab Operations", () => {
  test.beforeEach(async ({ page }) => {
    await mockLogin3Session(page);
    await mockApiRoutes(page);
    await page.goto("/");
  });

  test("9-1: wallet tab shows total balance and empty state", async ({ page }) => {
    await page.getByTestId("tab-wallet").click();
    await expect(page.getByTestId("wallet-view")).toBeVisible();
    // Total balances now shows ETH and USDC separately (no USD estimate for testnet)
    await expect(page.getByTestId("total-balances")).toBeVisible();
    await expect(page.getByTestId("wallet-count")).toContainText("0 wallets");
    await expect(page.getByTestId("wallets-empty")).toBeVisible();
  });

  test("9-6: create wallet from Wallet tab form", async ({ page }) => {
    await page.getByTestId("tab-wallet").click();

    await page.getByTestId("wallet-name-input").fill("TestWallet");
    await page.getByTestId("wallet-create-btn").click();

    // Wallet card appears
    await expect(
      page.getByTestId(`wallet-card-${WALLETS.myAgent.address}`)
    ).toBeVisible();
    await expect(page.getByTestId("wallets-empty")).not.toBeVisible();
  });

  test("9-2: click wallet card to expand and show faucet", async ({ page }) => {
    await page.getByTestId("tab-wallet").click();

    // Create a wallet first
    await page.getByTestId("wallet-name-input").fill("TestWallet");
    await page.getByTestId("wallet-create-btn").click();
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

    // Create and expand wallet
    await page.getByTestId("wallet-name-input").fill("TestWallet");
    await page.getByTestId("wallet-create-btn").click();
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

    // Create and expand wallet
    await page.getByTestId("wallet-name-input").fill("TestWallet");
    await page.getByTestId("wallet-create-btn").click();
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
