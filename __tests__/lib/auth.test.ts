import { describe, it, expect, vi } from "vitest";
import { authenticateRequest, walletNameForUser } from "@/lib/auth";

vi.mock("@/lib/cdp", () => ({
  getCdpClient: vi.fn(() => ({
    evm: {
      getOrCreateAccount: vi.fn(async ({ name }: { name: string }) => ({
        address: `0xmock_${name}`,
      })),
    },
  })),
}));

// Helper to create a fake JWT with given payload
function fakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${header}.${body}.fake-signature`;
}

describe("walletNameForUser", () => {
  it("generates deterministic wallet name from sub", () => {
    expect(walletNameForUser("user-123")).toBe("user_user-123_wallet");
    expect(walletNameForUser("abc")).toBe("user_abc_wallet");
  });
});

describe("authenticateRequest", () => {
  it("returns null for null header", async () => {
    expect(await authenticateRequest(null)).toBeNull();
  });

  it("returns null for empty string header", async () => {
    expect(await authenticateRequest("")).toBeNull();
  });

  it("returns null for 'Bearer' with no token", async () => {
    expect(await authenticateRequest("Bearer ")).toBeNull();
  });

  it("returns null for non-Bearer scheme", async () => {
    expect(await authenticateRequest("Basic dXNlcjpwYXNz")).toBeNull();
  });

  it("returns null for malformed JWT", async () => {
    expect(await authenticateRequest("Bearer not-a-jwt")).toBeNull();
  });

  it("returns null for expired token", async () => {
    const token = fakeJwt({
      sub: "user-1",
      exp: Math.floor(Date.now() / 1000) - 3600,
    });
    expect(await authenticateRequest(`Bearer ${token}`)).toBeNull();
  });

  it("returns AuthenticatedUser with agent wallet for valid token", async () => {
    const token = fakeJwt({
      sub: "user-123",
      wallet_address: "0xabc",
      email: "test@example.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const result = await authenticateRequest(`Bearer ${token}`);
    expect(result).toEqual({
      sub: "user-123",
      walletAddress: "0xabc",
      email: "test@example.com",
      agentWalletAddress: "0xmock_user_user-123_wallet",
      agentWalletName: "user_user-123_wallet",
    });
  });

  it("returns walletAddress: null when wallet_address is missing", async () => {
    const token = fakeJwt({
      sub: "user-456",
      email: "a@b.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const result = await authenticateRequest(`Bearer ${token}`);
    expect(result).not.toBeNull();
    expect(result!.walletAddress).toBeNull();
    expect(result!.agentWalletAddress).toBe("0xmock_user_user-456_wallet");
    expect(result!.agentWalletName).toBe("user_user-456_wallet");
  });

  it("returns email: null when email is missing", async () => {
    const token = fakeJwt({
      sub: "user-789",
      wallet_address: "0xdef",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const result = await authenticateRequest(`Bearer ${token}`);
    expect(result).not.toBeNull();
    expect(result!.email).toBeNull();
  });

  it("returns null for 'Bearer ' followed by only spaces", async () => {
    expect(await authenticateRequest("Bearer    ")).toBeNull();
  });
});
