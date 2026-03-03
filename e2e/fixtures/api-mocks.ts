import type { Page } from "@playwright/test";

/**
 * Build a mock JWT (header.payload.signature) with given claims.
 */
function buildMockJwt(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    .toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims))
    .toString("base64url");
  return `${header}.${payload}.mock-signature`;
}

/**
 * Pre-seed sessionStorage with a mock Login 3.0 ID token.
 * Must be called BEFORE page.goto() via page.addInitScript().
 */
export async function mockLogin3Session(page: Page) {
  const claims = {
    sub: "login3-user-123",
    wallet_address: "0x1234567890abcdef1234567890abcdef12345678",
    email: "test@example.com",
    iss: "https://login3.test.example.com",
    iat: Math.floor(Date.now() / 1000) - 60,
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
  };

  const jwt = buildMockJwt(claims);

  await page.addInitScript((token: string) => {
    sessionStorage.setItem("login3_id_token", token);
  }, jwt);
}

const MOCK_ADDRESS_1 = "0x1234567890abcdef1234567890abcdef12345678";
const MOCK_ADDRESS_2 = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
const MOCK_TX_HASH =
  "0xabc123def456789012345678901234567890123456789012345678901234abcd";

export interface MockWallet {
  name: string;
  address: string;
}

export const WALLETS = {
  myAgent: { name: "MyAgent", address: MOCK_ADDRESS_1 } as MockWallet,
  bob: { name: "Bob", address: MOCK_ADDRESS_2 } as MockWallet,
};

/**
 * Mock all REST API routes (wallet, balance, faucet, transfer).
 * Call this in beforeEach so every test starts with deterministic API responses.
 */
export async function mockApiRoutes(
  page: Page,
  opts?: {
    balances?: Record<string, { eth: string; usdc: string }>;
    walletCounter?: { count: number };
  }
) {
  const balances = opts?.balances ?? {};
  const walletCounter = opts?.walletCounter ?? { count: 0 };

  // POST /api/wallet
  await page.route("**/api/wallet", async (route, request) => {
    if (request.method() !== "POST") {
      await route.fallback();
      return;
    }
    const body = await request.postDataJSON();
    const name = body.name?.trim() || "Wallet";
    const address =
      walletCounter.count === 0 ? MOCK_ADDRESS_1 : MOCK_ADDRESS_2;
    walletCounter.count++;

    // Set initial balance for this wallet
    if (!balances[address]) {
      balances[address] = { eth: "0", usdc: "0" };
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { name, address },
      }),
    });
  });

  // GET /api/balance
  await page.route("**/api/balance*", async (route, request) => {
    if (request.method() !== "GET") {
      await route.fallback();
      return;
    }
    const url = new URL(request.url());
    const address = url.searchParams.get("address") || "";
    const bal = balances[address] ?? { eth: "0", usdc: "0" };

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { eth: bal.eth, usdc: bal.usdc },
      }),
    });
  });

  // POST /api/faucet
  await page.route("**/api/faucet", async (route, request) => {
    if (request.method() !== "POST") {
      await route.fallback();
      return;
    }
    const body = await request.postDataJSON();
    const address = body.address || "";
    const token = body.token || "eth";

    // Update mock balance
    if (!balances[address]) {
      balances[address] = { eth: "0", usdc: "0" };
    }
    if (token === "eth") {
      balances[address].eth = (
        parseFloat(balances[address].eth) + 0.0001
      ).toString();
    } else {
      balances[address].usdc = (
        parseFloat(balances[address].usdc) + 10
      ).toString();
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          transactionHash: MOCK_TX_HASH,
          status: "confirmed",
          explorerUrl: `https://sepolia.basescan.org/tx/${MOCK_TX_HASH}`,
        },
      }),
    });
  });

  // POST /api/transfer
  await page.route("**/api/transfer", async (route, request) => {
    if (request.method() !== "POST") {
      await route.fallback();
      return;
    }
    const body = await request.postDataJSON();

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          transactionHash: MOCK_TX_HASH,
          from: body.fromName || "unknown",
          to: body.to || "unknown",
          amount: body.amount || "0",
          token: body.token || "eth",
          status: "confirmed",
          explorerUrl: `https://sepolia.basescan.org/tx/${MOCK_TX_HASH}`,
        },
      }),
    });
  });

  return { balances, walletCounter };
}
