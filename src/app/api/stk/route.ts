// @/app/stk/route.ts

import { NextResponse } from "next/server";
import { sendStk } from "@/lib/mpesa";
import { supabase } from "@/lib/supabase/server";
import { randomUUID } from "crypto";

export async function POST(req: Request) {
  try {
    const { amount, phone } = await req.json();

    if (!phone || !amount) {
      return NextResponse.json(
        { error: "Missing phone or amount" },
        { status: 400 }
      );
    }
    // Generate the unique public Id
    const publicId = randomUUID();

    //Sending the stk push
    const stkData = await sendStk(amount, phone, publicId);
    // Assuming stkData is an object that might contain CheckoutRequestID
    const checkoutRequestId = stkData.CheckoutRequestID;

    // check if the checkout requestId was sent
    if (!checkoutRequestId) {
      // Safaricom often returns specific error messages in the body when CheckoutRequestID is missing
      const errorMsg =
        stkData.errorMessage || "Safaricom did not return CheckoutRequestID";
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    // Save payment in DB
    const { error } = await supabase.from("payments").insert([
      {
        checkout_request_id: checkoutRequestId,
        phone,
        amount,
        status: "pending",
        public_id: publicId,
      },
    ]);

    // Checking supabase if any problems existed
    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json({ error: "DB insert failed" }, { status: 500 });
    }

    // Return only publicId to client
    return NextResponse.json({ public_id: publicId }, { status: 200 });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : "An unexpected error occurred during STK push initiation.";
    console.error("STK Error:", err);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
