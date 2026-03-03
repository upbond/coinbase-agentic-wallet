import { NextResponse } from "next/server";
import { getCdpClient } from "@/lib/cdp";
import { publicClient } from "@/lib/viem";
import { authenticateRequest } from "@/lib/auth";

export const maxDuration = 60;

// POST /api/faucet - Request testnet funds for the user's agent wallet
export async function POST(request: Request) {
  const user = await authenticateRequest(request.headers.get("authorization"));
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { token = "eth" } = await request.json();

    if (token !== "eth" && token !== "usdc") {
      return NextResponse.json(
        { success: false, error: "Token must be 'eth' or 'usdc'" },
        { status: 400 }
      );
    }

    const cdp = getCdpClient();
    const { transactionHash } = await cdp.evm.requestFaucet({
      address: user.agentWalletAddress,
      network: "base-sepolia",
      token,
    });

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: transactionHash,
    });

    return NextResponse.json({
      success: true,
      data: {
        transactionHash,
        status: receipt.status === "success" ? "confirmed" : "failed",
        explorerUrl: `https://sepolia.basescan.org/tx/${transactionHash}`,
      },
    });
  } catch (error) {
    console.error("Faucet error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to request faucet",
      },
      { status: 500 }
    );
  }
}
