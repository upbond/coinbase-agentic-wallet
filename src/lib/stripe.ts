import Stripe from "stripe";

function getStripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Missing STRIPE_SECRET_KEY environment variable");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

/** Lazy Stripe client — only created when first accessed */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const client = getStripeClient();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});

// ──────────────────────────────────────────────
// Product catalog
// ──────────────────────────────────────────────

export const STRIPE_PRODUCT = {
  name: "Premium AI Market Report",
  description: "AI-generated market analysis with real-time insights",
  price_cents: 100, // $1.00 USD
  currency: "usd",
};

// ──────────────────────────────────────────────
// Customer & payment method helpers
// ──────────────────────────────────────────────

export async function findOrCreateCustomer(userId: string): Promise<string> {
  const existing = await stripe.customers.search({
    query: `metadata["app_user_id"]:"${userId}"`,
    limit: 1,
  });

  if (existing.data.length > 0) {
    return existing.data[0].id;
  }

  const customer = await stripe.customers.create({
    metadata: { app_user_id: userId },
  });
  return customer.id;
}

export async function getDefaultPaymentMethod(
  customerId: string
): Promise<{
  valid: boolean;
  payment_method_id?: string;
  card?: Stripe.PaymentMethod.Card;
  reason?: string;
}> {
  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type: "card",
  });

  if (paymentMethods.data.length === 0) {
    return {
      valid: false,
      reason:
        "No payment method on file. Please click the '+ Add Card' button to set up your card.",
    };
  }

  const pm = paymentMethods.data[0];
  return { valid: true, payment_method_id: pm.id, card: pm.card ?? undefined };
}

// ──────────────────────────────────────────────
// Setup session (one-time card registration)
// ──────────────────────────────────────────────

export async function createSetupSession(
  userId: string,
  returnUrl: string
): Promise<string> {
  const customerId = await findOrCreateCustomer(userId);

  const session = await stripe.checkout.sessions.create({
    mode: "setup",
    customer: customerId,
    payment_method_types: ["card"],
    success_url: `${returnUrl}?stripe_setup=success&customer_id=${customerId}`,
    cancel_url: `${returnUrl}?stripe_setup=cancelled`,
  });

  return session.url!;
}

// ──────────────────────────────────────────────
// Off-session charge (autonomous payment)
// ──────────────────────────────────────────────

export type ChargeResult =
  | { success: true; payment_intent_id: string }
  | {
      success: false;
      requires_3ds: true;
      payment_intent_id: string;
      client_secret: string;
      reason: string;
    }
  | { success: false; requires_3ds?: false; reason: string };

export async function chargeCustomer(
  customerId: string,
  amountCents: number,
  description: string
): Promise<ChargeResult> {
  const {
    valid,
    payment_method_id,
    reason: pmReason,
  } = await getDefaultPaymentMethod(customerId);
  if (!valid || !payment_method_id) {
    return { success: false, reason: pmReason! };
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: STRIPE_PRODUCT.currency,
      customer: customerId,
      payment_method: payment_method_id,
      description,
      confirm: true,
      off_session: true,
    });

    if (paymentIntent.status === "succeeded") {
      return { success: true, payment_intent_id: paymentIntent.id };
    }

    if (
      paymentIntent.status === "requires_action" &&
      paymentIntent.client_secret
    ) {
      return {
        success: false,
        requires_3ds: true,
        payment_intent_id: paymentIntent.id,
        client_secret: paymentIntent.client_secret,
        reason:
          "This card requires 3D Secure authentication. A popup will appear for you to complete.",
      };
    }

    return {
      success: false,
      reason: `Payment ended with status: ${paymentIntent.status}`,
    };
  } catch (err) {
    if (err instanceof Stripe.errors.StripeCardError) {
      if (
        err.code === "authentication_required" &&
        err.payment_intent?.client_secret
      ) {
        return {
          success: false,
          requires_3ds: true,
          payment_intent_id: err.payment_intent.id,
          client_secret: err.payment_intent.client_secret,
          reason:
            "This card requires 3D Secure authentication. A popup will appear for you to complete.",
        };
      }
      return { success: false, reason: err.message };
    }
    const message =
      err instanceof Error ? err.message : "Unknown payment error";
    return { success: false, reason: message };
  }
}

// ──────────────────────────────────────────────
// Verify payment after 3DS popup
// ──────────────────────────────────────────────

export async function verifyPaymentIntent(
  paymentIntentId: string
): Promise<{ success: boolean; reason?: string }> {
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (pi.status === "succeeded") return { success: true };

  return {
    success: false,
    reason: `Payment status is "${pi.status}". Authentication may not be complete yet.`,
  };
}

// ──────────────────────────────────────────────
// Product builder
// ──────────────────────────────────────────────

export function buildStripeProduct(
  paymentIntentId: string,
  amountCents: number
) {
  return {
    product: STRIPE_PRODUCT.name,
    data: {
      report_id: `RPT-${paymentIntentId.slice(-8).toUpperCase()}`,
      title: "AI Market Analysis Report",
      executive_summary:
        "Strong bullish momentum detected across tech and DeFi sectors.",
      key_findings: [
        "AI infrastructure spending up 42% YoY",
        "Base ecosystem TVL growing at record pace",
        "Consumer sentiment index at 6-month high",
        "Stablecoin transfer volumes exceeded $1T this quarter",
      ],
      generated_at: new Date().toISOString(),
      payment_intent_id: paymentIntentId,
      amount_charged: `$${(amountCents / 100).toFixed(2)} USD`,
    },
  };
}
