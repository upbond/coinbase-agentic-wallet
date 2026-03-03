import { describe, it, expect } from "vitest";
import {
  MERCHANT_ADDRESS,
  PAYMENT_REQUIREMENTS,
  buildProduct,
} from "@/lib/shop";

describe("MERCHANT_ADDRESS", () => {
  it("is a valid Ethereum address", () => {
    expect(MERCHANT_ADDRESS).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });
});

describe("PAYMENT_REQUIREMENTS", () => {
  it("has x402-simplified protocol", () => {
    expect(PAYMENT_REQUIREMENTS.protocol).toBe("x402-simplified");
  });

  it("has consistent price fields", () => {
    expect(PAYMENT_REQUIREMENTS.price_eth).toBe("0.00001");
    expect(PAYMENT_REQUIREMENTS.price_wei).toBe("10000000000000");
    // Verify price_wei matches price_eth (0.00001 * 1e18 = 1e13)
    expect(BigInt(PAYMENT_REQUIREMENTS.price_wei)).toBe(10_000_000_000_000n);
  });

  it("has correct recipient", () => {
    expect(PAYMENT_REQUIREMENTS.recipient).toBe(MERCHANT_ADDRESS);
  });

  it("specifies Base Sepolia chain", () => {
    expect(PAYMENT_REQUIREMENTS.chain).toContain("84532");
  });

  it("has instructions", () => {
    expect(PAYMENT_REQUIREMENTS.instructions).toBeTruthy();
    expect(PAYMENT_REQUIREMENTS.instructions).toContain("0.00001 ETH");
  });
});

describe("buildProduct", () => {
  const txHash = "0xabc123";

  it("returns premium weather data structure", () => {
    const product = buildProduct(txHash);
    expect(product.product).toBe("Premium Weather Data");
    expect(product.data).toHaveProperty("location");
    expect(product.data).toHaveProperty("temperature");
    expect(product.data).toHaveProperty("condition");
    expect(product.data).toHaveProperty("humidity");
    expect(product.data).toHaveProperty("wind");
    expect(product.data).toHaveProperty("forecast");
  });

  it("includes payment details with tx hash", () => {
    const product = buildProduct(txHash);
    expect(product.payment.tx_hash).toBe(txHash);
    expect(product.payment.explorer).toContain(txHash);
    expect(product.payment.explorer).toContain("sepolia.basescan.org");
  });

  it("uses provided value for paid_wei", () => {
    const product = buildProduct(txHash, 20_000_000_000_000n);
    expect(product.payment.paid_wei).toBe("20000000000000");
  });

  it("uses default price when value is undefined", () => {
    const product = buildProduct(txHash);
    expect(product.payment.paid_wei).toBe("10000000000000");
  });
});
