import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

export async function GET(req: NextRequest) {
  const user = await authenticateRequest(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const customerId = req.nextUrl.searchParams.get("customer_id");
  if (!customerId) {
    return NextResponse.json(
      { success: false, error: "customer_id is required" },
      { status: 400 }
    );
  }

  try {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
    });

    const hasCard = paymentMethods.data.length > 0;
    const card = hasCard ? paymentMethods.data[0].card : null;

    return NextResponse.json({
      success: true,
      has_payment_method: hasCard,
      card_summary: card
        ? {
            brand: card.brand,
            last4: card.last4,
            exp_month: card.exp_month,
            exp_year: card.exp_year,
          }
        : null,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to check payment status";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
