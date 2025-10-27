import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

// Declare __app_id globally for TypeScript
declare global {
  var __app_id: string | undefined;
}

const db = admin.firestore();

// Type for Firestore document data (matching what we save)
type ReceiptFirestoreData = {
    receiptId: string; receiptNo: string; receiptDate: string; shiftDay: string;
    total: number; tax: number; gross: number | null; type: number; saleChannel: string;
    retailerKey: string; retailerName: string; mall: string; brand: string; unit: string;
    createdAt: Timestamp; // Expect Timestamp from Admin SDK reads
};

// Type for data sent back to client (converting Timestamp)
type ReceiptClientData = Omit<ReceiptFirestoreData, 'createdAt'> & {
    id: string; // Include document ID
    createdAt: string; // Convert Timestamp to ISO string
};

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  console.log("[API /get-receipts] GET request received.");
  try {
    const { searchParams } = new URL(request.url);
    const retailerKey = searchParams.get("retailerKey");

    if (!retailerKey) {
      console.warn("[API /get-receipts] Missing retailerKey query parameter.");
      return NextResponse.json({ error: "Missing retailerKey query parameter." }, { status: 400 });
    }

    // --- ** Use Simple Collection Name ** ---
    const collectionName = `receipts${retailerKey}`;
    const collectionPath = collectionName; // Top-level collection
    // --- ** End Simple Collection Name ** ---

    console.log(`[API /get-receipts] Attempting to read collection: ${collectionPath}`);

    const receiptsCollection = db.collection(collectionPath);
    // Fetch documents, order by creation date descending
    const snapshot = await receiptsCollection.orderBy("createdAt", "desc").get();

    console.log(`[API /get-receipts] Fetched ${snapshot.size} documents from ${collectionPath}.`);

    if (snapshot.empty) {
      return NextResponse.json([], { status: 200 }); // Return empty array if no docs found
    }

    // Map Firestore data to client-friendly format
    const receipts: ReceiptClientData[] = snapshot.docs.map(doc => {
        const data = doc.data() as ReceiptFirestoreData;
        return {
            ...data,
            id: doc.id, // Add the Firestore document ID
            // Convert Firestore Timestamp to ISO string for client
            createdAt: data.createdAt.toDate().toISOString(),
            // Ensure numbers are numbers (they should be, but good practice)
            total: Number(data.total) || 0,
            tax: Number(data.tax) || 0,
            gross: data.gross !== null ? Number(data.gross) : null,
            type: Number(data.type) || 0,
        };
    });

    console.log(`[API /get-receipts] Returning ${receipts.length} formatted documents.`);
    return NextResponse.json(receipts, { status: 200 });

  } catch (error) { // Catch as unknown
    console.error("[API /get-receipts] Error processing GET request:", error);
    // Determine the message safely
    // const message = error instanceof Error ? error.message : String(error);
    // Log the underlying error for debugging on the server
    // Return a generic error to the client
    return NextResponse.json({ error: "Failed to fetch receipts data." }, { status: 500 });
  }
}