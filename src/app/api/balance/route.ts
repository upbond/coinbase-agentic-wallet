import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { getBalances } from "@/lib/balance";
import { authenticateRequest } from "@/lib/auth";

export const maxDuration = 30;

// GET /api/balance?address=0x...
export async function GET(request: Request) {
  const user = await authenticateRequest(request.headers.get("authorization"));
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!address || !isAddress(address, { strict: false })) {
      return NextResponse.json(
        { success: false, error: "Valid address is required" },
        { status: 400 }
      );
    }

    const balances = await getBalances(address as `0x${string}`);

    return NextResponse.json({
      success: true,
      data: balances,
    });
  } catch (error) {
    console.error("Balance check error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to check balance",
      },
      { status: 500 }
    );
  }
}
