import { describe, it, expect } from "vitest";
import {
  checkTransferPolicy,
  TRANSFER_LIMITS,
} from "@/lib/policy";

describe("TRANSFER_LIMITS", () => {
  it("has ETH limit of 0.001", () => {
    expect(TRANSFER_LIMITS.eth.max_per_tx).toBe(0.001);
    expect(TRANSFER_LIMITS.eth.label).toBe("0.001 ETH");
  });

  it("has USDC limit of 5", () => {
    expect(TRANSFER_LIMITS.usdc.max_per_tx).toBe(5);
    expect(TRANSFER_LIMITS.usdc.label).toBe("5 USDC");
  });
});

describe("checkTransferPolicy", () => {
  // ETH tests
  it("allows ETH transfer within limit", () => {
    const result = checkTransferPolicy("0.0005", "eth");
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("allows ETH transfer at exact limit", () => {
    const result = checkTransferPolicy("0.001", "eth");
    expect(result.allowed).toBe(true);
  });

  it("rejects ETH transfer above limit", () => {
    const result = checkTransferPolicy("0.002", "eth");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("exceeds the per-transaction limit");
    expect(result.reason).toContain("0.001 ETH");
  });

  it("rejects ETH transfer way above limit", () => {
    const result = checkTransferPolicy("1.0", "eth");
    expect(result.allowed).toBe(false);
  });

  // USDC tests
  it("allows USDC transfer within limit", () => {
    const result = checkTransferPolicy("3.5", "usdc");
    expect(result.allowed).toBe(true);
  });

  it("allows USDC transfer at exact limit", () => {
    const result = checkTransferPolicy("5", "usdc");
    expect(result.allowed).toBe(true);
  });

  it("rejects USDC transfer above limit", () => {
    const result = checkTransferPolicy("10", "usdc");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("5 USDC");
  });

  // Invalid amounts
  it("rejects zero amount", () => {
    const result = checkTransferPolicy("0", "eth");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Invalid amount");
  });

  it("rejects negative amount", () => {
    const result = checkTransferPolicy("-1", "eth");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Invalid amount");
  });

  it("rejects non-numeric amount", () => {
    const result = checkTransferPolicy("abc", "eth");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Invalid amount");
  });

  it("rejects empty string", () => {
    const result = checkTransferPolicy("", "eth");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Invalid amount");
  });
});
