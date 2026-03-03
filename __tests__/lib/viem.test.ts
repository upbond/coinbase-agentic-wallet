import { describe, it, expect } from "vitest";
import { parseUsdcUnits, formatUsdcUnits, USDC_ADDRESS } from "@/lib/viem";

describe("USDC_ADDRESS", () => {
  it("is a valid Base Sepolia USDC address", () => {
    expect(USDC_ADDRESS).toBe("0x036CbD53842c5426634e7929541eC2318f3dCF7e");
    expect(USDC_ADDRESS).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });
});

describe("parseUsdcUnits", () => {
  it("parses whole number amounts", () => {
    expect(parseUsdcUnits("1")).toBe(1_000_000n);
    expect(parseUsdcUnits("10")).toBe(10_000_000n);
    expect(parseUsdcUnits("100")).toBe(100_000_000n);
  });

  it("parses decimal amounts", () => {
    expect(parseUsdcUnits("1.5")).toBe(1_500_000n);
    expect(parseUsdcUnits("0.5")).toBe(500_000n);
    expect(parseUsdcUnits("0.000001")).toBe(1n);
  });

  it("handles full 6-decimal precision", () => {
    expect(parseUsdcUnits("1.123456")).toBe(1_123_456n);
  });

  it("truncates beyond 6 decimals", () => {
    expect(parseUsdcUnits("1.1234567")).toBe(1_123_456n);
  });

  it("handles zero", () => {
    expect(parseUsdcUnits("0")).toBe(0n);
    expect(parseUsdcUnits("0.0")).toBe(0n);
  });

  it("pads short decimal fractions", () => {
    expect(parseUsdcUnits("1.1")).toBe(1_100_000n);
    expect(parseUsdcUnits("1.12")).toBe(1_120_000n);
  });
});

describe("formatUsdcUnits", () => {
  it("formats whole number amounts", () => {
    expect(formatUsdcUnits(1_000_000n)).toBe("1.000000");
    expect(formatUsdcUnits(10_000_000n)).toBe("10.000000");
  });

  it("formats fractional amounts", () => {
    expect(formatUsdcUnits(1_500_000n)).toBe("1.500000");
    expect(formatUsdcUnits(500_000n)).toBe("0.500000");
  });

  it("formats very small amounts", () => {
    expect(formatUsdcUnits(1n)).toBe("0.000001");
  });

  it("formats zero", () => {
    expect(formatUsdcUnits(0n)).toBe("0.000000");
  });

  it("round-trips with parseUsdcUnits", () => {
    const original = "42.123456";
    const parsed = parseUsdcUnits(original);
    const formatted = formatUsdcUnits(parsed);
    expect(formatted).toBe(original);
  });
});
