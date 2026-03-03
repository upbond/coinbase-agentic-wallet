import { describe, it, expect } from "vitest";
import { STRIPE_PRODUCT, buildStripeProduct } from "@/lib/stripe";

describe("STRIPE_PRODUCT", () => {
  it("has correct name", () => {
    expect(STRIPE_PRODUCT.name).toBe("Premium AI Market Report");
  });

  it("costs $1.00 USD", () => {
    expect(STRIPE_PRODUCT.price_cents).toBe(100);
    expect(STRIPE_PRODUCT.currency).toBe("usd");
  });

  it("has a description", () => {
    expect(STRIPE_PRODUCT.description).toBeTruthy();
  });
});

describe("buildStripeProduct", () => {
  const paymentIntentId = "pi_abc12345678";

  it("returns correct product name", () => {
    const product = buildStripeProduct(paymentIntentId, 100);
    expect(product.product).toBe("Premium AI Market Report");
  });

  it("generates a report ID from payment intent", () => {
    const product = buildStripeProduct(paymentIntentId, 100);
    expect(product.data.report_id).toMatch(/^RPT-/);
    expect(product.data.report_id).toBe("RPT-12345678");
  });

  it("includes correct amount charged", () => {
    const product = buildStripeProduct(paymentIntentId, 100);
    expect(product.data.amount_charged).toBe("$1.00 USD");
  });

  it("formats higher amounts correctly", () => {
    const product = buildStripeProduct(paymentIntentId, 2550);
    expect(product.data.amount_charged).toBe("$25.50 USD");
  });

  it("includes payment intent ID", () => {
    const product = buildStripeProduct(paymentIntentId, 100);
    expect(product.data.payment_intent_id).toBe(paymentIntentId);
  });

  it("includes key findings array", () => {
    const product = buildStripeProduct(paymentIntentId, 100);
    expect(Array.isArray(product.data.key_findings)).toBe(true);
    expect(product.data.key_findings.length).toBeGreaterThan(0);
  });

  it("includes generated_at timestamp", () => {
    const product = buildStripeProduct(paymentIntentId, 100);
    expect(product.data.generated_at).toBeTruthy();
    // Should be a valid ISO date string
    expect(new Date(product.data.generated_at).toISOString()).toBe(
      product.data.generated_at
    );
  });

  it("has executive summary", () => {
    const product = buildStripeProduct(paymentIntentId, 100);
    expect(product.data.executive_summary).toBeTruthy();
  });
});
