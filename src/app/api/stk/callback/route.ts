// @/api/stk/callback/route.ts

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    // 1. Get the public_id from the query parameters of the incoming URL
    const requestUrl = new URL(req.url);
    const publicId = requestUrl.searchParams.get("public_id");

    if (!publicId) {
      // Log the missing public_id for debugging
      console.error("Callback URL missing public_id query parameter.");
      // We must return a response to M-Pesa, even on error
      return NextResponse.json(
        { ResultCode: 1, ResultDesc: "Missing public_id in Callback URL" },
        { status: 400 }
      );
    }

    const body = await req.json();

    const callback = body?.Body?.stkCallback;
    const checkoutRequestId = callback?.CheckoutRequestID;
    const resultCode = callback?.ResultCode;

    if (!checkoutRequestId) {
      console.error("M-Pesa callback missing CheckoutRequestID.");
      return NextResponse.json(
        { error: "Missing CheckoutRequestID" },
        { status: 400 }
      );
    }

    const newStatus = resultCode === 0 ? "success" : "failed";

    // 2. Update the row using the public_id extracted from the URL
    // This allows the Supabase Realtime subscription (filtered by public_id) to fire.
    // NOTE: This server-side update is expected to succeed because the
    // supabase instance in "@/lib/supabase/server" should be using the Service Role Key,
    // which bypasses Row Level Security (RLS).
    const { error } = await supabase
      .from("payments")
      .update({ status: newStatus })
      .eq("public_id", publicId);

    if (error) {
      console.error("DB update error:", error);
      return NextResponse.json(
        { error: "Failed to update payment" },
        { status: 500 }
      );
    }

    // Safaricom requires a specific successful response structure
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accept" });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : "An unexpected error occurred during callback processing.";
    console.error("Callback error:", err);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
