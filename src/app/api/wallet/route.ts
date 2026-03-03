import { NextResponse } from "next/server";
import { getCdpClient } from "@/lib/cdp";
import { authenticateRequest } from "@/lib/auth";

export const maxDuration = 30;

// POST /api/wallet - Create a new wallet (account)
export async function POST(request: Request) {
  const user = authenticateRequest(request.headers.get("authorization"));
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { name } = await request.json();

    if (typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Wallet name is required" },
        { status: 400 }
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        { success: false, error: "Wallet name must be 100 characters or less" },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    const cdp = getCdpClient();
    const account = await cdp.evm.getOrCreateAccount({ name: trimmedName });

    return NextResponse.json({
      success: true,
      data: {
        name: trimmedName,
        address: account.address,
      },
    });
  } catch (error) {
    console.error("Wallet creation error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create wallet",
      },
      { status: 500 }
    );
  }
}
