import { NextResponse } from "next/server";
import { admin } from "@/lib/firebase-admin";

export const runtime = "nodejs"; // runs in Node, not Edge

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.split("Bearer ")[1];
  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return NextResponse.json(decoded);
  } catch (error) {
    console.error("Invalid token:", error);
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }
}
