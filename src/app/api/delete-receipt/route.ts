import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/firebase-admin";

// Declare __app_id globally for TypeScript
declare global {
  var __app_id: string | undefined;
}

const db = admin.firestore();
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

export const runtime = "nodejs"; // Run in Node.js environment

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { retailerKey, docId } = body;

    if (!retailerKey || !docId) {
      console.warn("API Error: Missing retailerKey or docId.");
      return NextResponse.json({ error: "Missing retailerKey or docId." }, { status: 400 });
    }

    // Construct the simple, top-level collection path
    const collectionName = `receipts${retailerKey}`;
    const docPath = `${collectionName}/${docId}`;

    console.log(`[API /delete-receipt] Attempting to delete doc: ${docPath}`);

    // Get a reference to the document and delete it
    await db.collection(collectionName).doc(docId).delete();

    console.log(`[API /delete-receipt] Successfully deleted doc: ${docId}`);
    return NextResponse.json({ success: true, docId: docId });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[API /delete-receipt] Error processing POST request:", error);
    return NextResponse.json({ error: "Failed to delete receipt.", details: message }, { status: 500 });
  }
}