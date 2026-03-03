import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { executeTransfer } from "@/lib/transfer";
import { authenticateRequest } from "@/lib/auth";
import { checkTransferPolicy } from "@/lib/policy";

export const maxDuration = 60;

// POST /api/transfer - Send a payment from the user's agent wallet
export async function POST(request: Request) {
  const user = await authenticateRequest(request.headers.get("authorization"));
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { to, amount, token = "eth" } = await request.json();

    if (
      typeof to !== "string" ||
      !to ||
      typeof amount !== "string" ||
      !amount
    ) {
      return NextResponse.json(
        { success: false, error: "to and amount are required (both strings)" },
        { status: 400 }
      );
    }

    if (!/^\d+(\.\d+)?$/.test(amount)) {
      return NextResponse.json(
        { success: false, error: "amount must be a positive decimal number" },
        { status: 400 }
      );
    }

    if (!isAddress(to, { strict: false })) {
      return NextResponse.json(
        { success: false, error: "Invalid recipient address" },
        { status: 400 }
      );
    }

    if (token !== "eth" && token !== "usdc") {
      return NextResponse.json(
        { success: false, error: `Unsupported token: ${token}` },
        { status: 400 }
      );
    }

    const policyCheck = checkTransferPolicy(amount, token);
    if (!policyCheck.allowed) {
      return NextResponse.json(
        { success: false, error: policyCheck.reason },
        { status: 403 }
      );
    }

    const result = await executeTransfer({
      fromWalletName: user.agentWalletName,
      toAddress: to as `0x${string}`,
      amount,
      token,
    });

    return NextResponse.json({
      success: true,
      data: {
        transactionHash: result.transactionHash,
        from: result.from,
        to: result.to,
        amount: result.amount,
        token: result.token,
        status: result.success ? "confirmed" : "failed",
        explorerUrl: result.explorerUrl,
      },
    });
  } catch (error) {
    console.error("Transfer error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to send transfer",
      },
      { status: 500 }
    );
  }
}
