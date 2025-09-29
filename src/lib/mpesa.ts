// @/lib/mpesa.ts
export async function sendStk(amount: number, phone: string, publicId: string) {
  // 1. Get access token
  const consumerKey = process.env.MPESA_CONSUMER_KEY!;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET!;
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString(
    "base64"
  );

  const tokenRes = await fetch(
    "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    {
      method: "GET",
      headers: { Authorization: `Basic ${auth}` },
    }
  );

  if (!tokenRes.ok) {
    throw new Error("Failed to get access token from Safaricom");
  }

  const { access_token } = await tokenRes.json();

  // 2. Generate password
  const shortCode = process.env.MPESA_SHORTCODE!;
  const passkey = process.env.MPESA_PASSKEY!;
  const timestamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 14);

  const password = Buffer.from(shortCode + passkey + timestamp).toString(
    "base64"
  );

  // 3. Build STK push payload
  const stkPayload = {
    BusinessShortCode: shortCode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: amount || 1,
    PartyA: phone,
    PartyB: shortCode,
    PhoneNumber: phone,
    CallBackURL: `${process.env.MPESA_CALLBACK_URL}?public_id=${publicId}`, // keep in .env
    AccountReference: "Li's Chinese Restaurant",
    TransactionDesc: "Payment test",
  };

  // 4. Send STK push request
  const stkRes = await fetch(
    "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(stkPayload),
    }
  );

  const stkData = await stkRes.json();

  return stkData;
}
