import { NextResponse } from "next/server";
import { getBalances } from "@/lib/balance";
import { authenticateRequest } from "@/lib/auth";

export const maxDuration = 30;

// GET /api/wallet — return the user's auto-created agent wallet with balances
export async function GET(request: Request) {
  const user = await authenticateRequest(request.headers.get("authorization"));
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const balances = await getBalances(user.agentWalletAddress as `0x${string}`);

    return NextResponse.json({
      success: true,
      data: {
        name: user.agentWalletName,
        address: user.agentWalletAddress,
        ethBalance: balances.eth,
        usdcBalance: balances.usdc,
      },
    });
  } catch (error) {
    console.error("Wallet fetch error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch wallet",
      },
      { status: 500 }
    );
  }
}
