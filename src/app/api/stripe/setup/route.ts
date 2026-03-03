import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createSetupSession } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const user = await authenticateRequest(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const origin = req.headers.get("origin") ?? "http://localhost:3000";
    const checkoutUrl = await createSetupSession(user.sub, `${origin}/`);

    return NextResponse.json({ success: true, url: checkoutUrl });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create setup session";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
