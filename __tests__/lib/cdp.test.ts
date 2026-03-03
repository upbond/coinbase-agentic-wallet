import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock CdpClient before importing getCdpClient
vi.mock("@coinbase/cdp-sdk", () => {
  return {
    CdpClient: class MockCdpClient {
      config: Record<string, string>;
      evm = { getOrCreateAccount: vi.fn() };
      constructor(config: Record<string, string>) {
        this.config = config;
      }
    },
  };
});

describe("getCdpClient", () => {
  beforeEach(() => {
    vi.resetModules();
    // Reset env vars
    delete process.env.CDP_API_KEY_ID;
    delete process.env.CDP_API_KEY_SECRET;
    delete process.env.CDP_WALLET_SECRET;
  });

  it("throws if CDP_API_KEY_ID is missing", async () => {
    process.env.CDP_API_KEY_SECRET = "secret";
    process.env.CDP_WALLET_SECRET = "wallet";

    const { getCdpClient } = await import("@/lib/cdp");
    expect(() => getCdpClient()).toThrow("Missing CDP credentials");
  });

  it("throws if CDP_API_KEY_SECRET is missing", async () => {
    process.env.CDP_API_KEY_ID = "key-id";
    process.env.CDP_WALLET_SECRET = "wallet";

    const { getCdpClient } = await import("@/lib/cdp");
    expect(() => getCdpClient()).toThrow("Missing CDP credentials");
  });

  it("throws if CDP_WALLET_SECRET is missing", async () => {
    process.env.CDP_API_KEY_ID = "key-id";
    process.env.CDP_API_KEY_SECRET = "secret";

    const { getCdpClient } = await import("@/lib/cdp");
    expect(() => getCdpClient()).toThrow("Missing CDP credentials");
  });

  it("creates client with correct credentials", async () => {
    process.env.CDP_API_KEY_ID = "test-key-id";
    process.env.CDP_API_KEY_SECRET = "test-secret";
    process.env.CDP_WALLET_SECRET = "test-wallet";

    const { getCdpClient } = await import("@/lib/cdp");
    const client = getCdpClient();
    expect(client).toBeTruthy();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((client as any).config).toEqual({
      apiKeyId: "test-key-id",
      apiKeySecret: "test-secret",
      walletSecret: "test-wallet",
    });
  });

  it("returns same instance on subsequent calls (singleton)", async () => {
    process.env.CDP_API_KEY_ID = "test-key-id";
    process.env.CDP_API_KEY_SECRET = "test-secret";
    process.env.CDP_WALLET_SECRET = "test-wallet";

    const { getCdpClient } = await import("@/lib/cdp");
    const client1 = getCdpClient();
    const client2 = getCdpClient();
    expect(client1).toBe(client2);
  });
});
