import { describe, it, expect } from "vitest";
import { authenticateRequest } from "@/lib/auth";

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

describe("authenticateRequest", () => {
  it("returns null for null header", () => {
    expect(authenticateRequest(null)).toBeNull();
  });

  it("returns null for empty string header", () => {
    expect(authenticateRequest("")).toBeNull();
  });

  it("returns null for 'Bearer' with no token", () => {
    expect(authenticateRequest("Bearer ")).toBeNull();
  });

  it("returns null for non-Bearer scheme", () => {
    expect(authenticateRequest("Basic dXNlcjpwYXNz")).toBeNull();
  });

  it("returns null for malformed JWT", () => {
    expect(authenticateRequest("Bearer not-a-jwt")).toBeNull();
  });

  it("returns null for expired token", () => {
    const token = fakeJwt({
      sub: "user-1",
      exp: Math.floor(Date.now() / 1000) - 3600,
    });
    expect(authenticateRequest(`Bearer ${token}`)).toBeNull();
  });

  it("returns AuthenticatedUser for valid token", () => {
    const token = fakeJwt({
      sub: "user-123",
      wallet_address: "0xabc",
      email: "test@example.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const result = authenticateRequest(`Bearer ${token}`);
    expect(result).toEqual({
      sub: "user-123",
      walletAddress: "0xabc",
      email: "test@example.com",
    });
  });

  it("returns walletAddress: null when wallet_address is missing", () => {
    const token = fakeJwt({
      sub: "user-456",
      email: "a@b.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const result = authenticateRequest(`Bearer ${token}`);
    expect(result).not.toBeNull();
    expect(result!.walletAddress).toBeNull();
  });

  it("returns email: null when email is missing", () => {
    const token = fakeJwt({
      sub: "user-789",
      wallet_address: "0xdef",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const result = authenticateRequest(`Bearer ${token}`);
    expect(result).not.toBeNull();
    expect(result!.email).toBeNull();
  });

  it("returns null for 'Bearer ' followed by only spaces", () => {
    expect(authenticateRequest("Bearer    ")).toBeNull();
  });
});
