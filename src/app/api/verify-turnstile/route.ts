import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { token } = await request.json();

  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    console.error("TURNSTILE_SECRET_KEY is not set.");
    return NextResponse.json(
      { success: false, error: "Server configuration error." },
      { status: 500 }
    );
  }

  // Verify the token with Cloudflare
  const url = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
  
  const formData = new FormData();
  formData.append("secret", secret);
  formData.append("response", token);
  
  try {
    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (data.success) {
      return NextResponse.json({ success: true });
    } else {
      console.warn("Turnstile verification failed:", data["error-codes"]);
      return NextResponse.json(
        { success: false, error: "Invalid CAPTCHA. Please try again." },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Turnstile verification error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}