import { NextResponse } from "next/server";
import { isHex } from "viem";
import {
  PAYMENT_REQUIREMENTS,
  MERCHANT_ADDRESS,
  verifyPayment,
  buildProduct,
} from "@/lib/shop";

export const maxDuration = 30;

// GET /api/shop — x402-style merchant endpoint
//   No X-Payment-Tx header → 402 + payment requirements
//   With X-Payment-Tx header → verify payment → 200 + product data
export async function GET(request: Request) {
  const paymentTx = request.headers.get("x-payment-tx");

  // No payment: return 402 with requirements
  if (!paymentTx) {
    return NextResponse.json(
      {
        status: 402,
        message: "Payment Required",
        requirements: PAYMENT_REQUIREMENTS,
      },
      {
        status: 402,
        headers: {
          "X-Payment-Recipient": MERCHANT_ADDRESS,
          "X-Payment-Amount-Wei": PAYMENT_REQUIREMENTS.price_wei,
          "X-Payment-Chain-Id": "84532",
        },
      }
    );
  }

  // Validate tx hash format
  if (!isHex(paymentTx) || paymentTx.length !== 66) {
    return NextResponse.json(
      {
        status: 402,
        message: "Payment Required",
        error: "Invalid transaction hash format",
        requirements: PAYMENT_REQUIREMENTS,
      },
      { status: 402 }
    );
  }

  // Verify payment on-chain
  const result = await verifyPayment(paymentTx as `0x${string}`);
  if (!result.valid) {
    return NextResponse.json(
      {
        status: 402,
        message: "Payment Required",
        error: result.reason,
        requirements: PAYMENT_REQUIREMENTS,
      },
      { status: 402 }
    );
  }

  // Payment verified — return product
  const product = buildProduct(paymentTx, result.value);
  return NextResponse.json({
    success: true,
    data: product,
  });
}
