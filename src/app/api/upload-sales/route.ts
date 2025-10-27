import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { admin } from "@/lib/firebase-admin";
import { FieldValue, DocumentReference } from "firebase-admin/firestore";
// Declare __app_id globally for TypeScript
declare global {
  var __app_id: string | undefined;
}

// Initialize Firestore
const db = admin.firestore();
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; // Keep for logging context
console.log(`App ID context (not used in path): ${appId}`);

// --- Type Definitions ---
type RetailerConfig = { key: string; name: string; mall: string; brand: string; unit: string; envUserVar: string; envPassVar: string };
type ReceiptPayloadForApi = { Id: string; ReceiptDate: string; ReceiptNo: string; Tax: number; Total: number; Type: number; Gross: number | null; SaleChannel: string };
type ShiftPayloadForApi = { Mall: string; Retailer: string; Brand: string; Unit: string; ShiftDay: string; PushReceipts: ReceiptPayloadForApi[] };
type ExternalApiResponse = { PushShiftReturnResult: { Asset: string; Brand: string; ErrorDetails: string | null; ErrorMessage: string; Retailer: string; ReturnCode: string; ShiftDay: string; Unit: string }[]; ResultCode: string; ReturnError: string | null; ReturnMessage: string };

type ReceiptFirestoreData = {
    receiptId: string;   // Unique ID generated for the transaction
    receiptNo: string;   // User-provided receipt/invoice number
    receiptDate: string; // Store as MS Date String '/Date(...)/'
    shiftDay: string;    // Store as MS Date String '/Date(...)/'
    total: number;       // Net amount
    tax: number;         // Tax/VAT amount
    gross: number | null;// Grand Total (Total + Tax)
    type: number;        // 0 for Sale, 1 for Return
    createdAt: FieldValue; // Firestore server timestamp for record creation
};

type ClientReceiptInput = {
    ShiftDay: string;      // MS Date String
    ReceiptDate: string;   // MS Date String
    ReceiptNo: string;
    Tax?: string | number; // Might be string or number from client/parse
    Total: string | number;
    Type: string | number; // Likely string '0' or '1'
    Gross?: string | number;
    SaleChannel?: string;
    // Add any other fields potentially present in the raw input
};

// --- Helper Functions ---
const getEnvVar = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Server Configuration Error: Missing required environment variable: ${name}`);
  return value;
};
const getRetailerConfigs = (): RetailerConfig[] => {
    const configJson = process.env.RETAILERS_CONFIG;
    if (!configJson) throw new Error("Server Configuration Error: RETAILERS_CONFIG environment variable is missing or empty.");
    try {
        const configs = JSON.parse(configJson);
        if (!Array.isArray(configs)) throw new Error("RETAILERS_CONFIG is not a valid JSON array.");
        configs.forEach((cfg, index) => { if (!cfg.key || !cfg.name || !cfg.envUserVar || !cfg.envPassVar || !cfg.mall || !cfg.brand || !cfg.unit) throw new Error(`Invalid config structure at index ${index}.`); });
        return configs as RetailerConfig[];
    } catch (e) { // Catch as unknown
        const message = e instanceof Error ? e.message : String(e); // Safely get message
        throw new Error(`Server Configuration Error: Failed to parse RETAILERS_CONFIG JSON. ${message}`)
    }
};

// --- API Route Handler ---
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const apiUrl = getEnvVar("EXTERNAL_API_URL");
    const body = await request.json();
    const clientReceipts = body.receipts;
    const retailerKey: string | undefined = body.retailerKey;

    if (!clientReceipts || clientReceipts.length === 0) return NextResponse.json({ error: "No receipt data provided." }, { status: 400 });
    if (!retailerKey) return NextResponse.json({ error: "No retailer selected." }, { status: 400 });

    const retailerConfigs = getRetailerConfigs();
    const selectedConfig = retailerConfigs.find(r => r.key === retailerKey);
    if (!selectedConfig) return NextResponse.json({ error: `Invalid retailer key: ${retailerKey}` }, { status: 400 });

    const username = getEnvVar(selectedConfig.envUserVar);
    const password = getEnvVar(selectedConfig.envPassVar);
    const { mall, name: retailerName, brand, unit } = selectedConfig;

    // --- Prepare API data and group by ShiftDay string ---
    const apiDataByShiftDayString: Record<string, ReceiptPayloadForApi[]> = {};

    (clientReceipts as ClientReceiptInput[]).forEach((receipt: ClientReceiptInput, index) => { // Add Type Assertion and Parameter Type
        const { ShiftDay: clientShiftDayString, ...restOfReceipt } = receipt;
        // Basic validation of date strings format (optional but good)
        if (!clientShiftDayString?.startsWith('/Date(') || !restOfReceipt.ReceiptDate?.startsWith('/Date(')) {
            console.warn(`Skipping receipt ${restOfReceipt.ReceiptNo || `at index ${index}`} due to unexpected date string format.`);
            return; // Skip this receipt
        }
        const generatedId = randomUUID();
        // Now Typescript knows the types inside restOfReceipt based on ClientReceiptInput
        const receiptForApi: ReceiptPayloadForApi = {
            Id: generatedId,
            ReceiptDate: restOfReceipt.ReceiptDate, // Known to be string
            ReceiptNo: restOfReceipt.ReceiptNo,     // Known to be string
            // Safely convert potential string/number to number
            Tax: restOfReceipt.Tax ? parseFloat(String(restOfReceipt.Tax)) : 0,
            Total: parseFloat(String(restOfReceipt.Total)), // Ensure it's parsed from string/number
            Type: parseInt(String(restOfReceipt.Type), 10), // Ensure it's parsed from string/number
            Gross: restOfReceipt.Gross ? parseFloat(String(restOfReceipt.Gross)) : null,
            SaleChannel: "Store-sales",
        };
        if (!apiDataByShiftDayString[clientShiftDayString]) apiDataByShiftDayString[clientShiftDayString] = [];
        apiDataByShiftDayString[clientShiftDayString].push(receiptForApi);
    });

    const pushReceiptShiftsForApi: ShiftPayloadForApi[] = Object.entries(apiDataByShiftDayString).map(([shiftDayString, pushReceipts]) => ({
        Mall: mall, Retailer: retailerName, Brand: brand, Unit: unit, ShiftDay: shiftDayString, PushReceipts: pushReceipts,
    }));

    if (pushReceiptShiftsForApi.length === 0) {
        console.warn("No valid receipts found after basic date format validation.");
        return NextResponse.json({ error: "No valid receipts found after processing dates. Please check formats." }, { status: 400 });
    }

    const finalApiPayload = { PushReceiptShifts: pushReceiptShiftsForApi };
    const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

    // --- Call External API ---
    console.log(`Calling external API for retailer: ${retailerKey} with ${pushReceiptShiftsForApi.length} shifts.`);
    const apiResponse = await fetch(apiUrl, { method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader }, body: JSON.stringify(finalApiPayload), });
    console.log(`External API response status for ${retailerKey}: ${apiResponse.status}`);

    // --- Process Response & Save to Firestore ---
    const contentType = apiResponse.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        const result: ExternalApiResponse = await apiResponse.json();
        console.log("External API Response Received (JSON):", JSON.stringify(result, null, 2));

        if (apiResponse.ok || result.ResultCode === "500") {
            console.log("Attempting to save successful receipts to Firestore (simplified fields)...");
            try {
                const savePromises: Promise<DocumentReference>[] = [];
                let savedCount = 0;

                result.PushShiftReturnResult.forEach((shiftResult, index) => {
                    console.log(`Processing Shift Result at index ${index}: ReturnCode='${shiftResult.ReturnCode}'`);
                    if (index < pushReceiptShiftsForApi.length) {
                         const originalSentShift = pushReceiptShiftsForApi[index];
                         if (shiftResult.ReturnCode === "200") {
                            console.log(`Shift at index ${index} succeeded. Preparing ${originalSentShift.PushReceipts.length} receipts for save.`);
                            const collectionName = `receipts${selectedConfig.key}`;
                            console.log(`Target Firestore collection name: ${collectionName}`);
                            const receiptsCollection = db.collection(collectionName);

                            originalSentShift.PushReceipts.forEach(receiptApiData => {
                                const receiptForFirestore: ReceiptFirestoreData = {
                                    receiptId: receiptApiData.Id,
                                    receiptNo: receiptApiData.ReceiptNo,
                                    receiptDate: receiptApiData.ReceiptDate, // Save MS Date String
                                    shiftDay: originalSentShift.ShiftDay,   // Save original MS Date String we sent
                                    total: receiptApiData.Total,
                                    tax: receiptApiData.Tax,
                                    gross: receiptApiData.Gross,
                                    type: receiptApiData.Type,
                                    createdAt: FieldValue.serverTimestamp(),
                                };

                                console.log("Adding save promise for receipt (simplified fields):", JSON.stringify(receiptForFirestore.receiptNo));
                                savePromises.push(receiptsCollection.add(receiptForFirestore));
                                savedCount++;
                            });
                        } else { console.log(`Shift at index ${index} did not succeed (Code ${shiftResult.ReturnCode}). Skipping save.`); }
                    } else { console.warn(`API returned result at index ${index}, but only ${pushReceiptShiftsForApi.length} shifts sent.`); }
                });

                if (savePromises.length > 0) {
                     console.log(`Attempting to execute ${savePromises.length} Firestore save promises...`);
                     await Promise.all(savePromises)
                        .then(() => { console.log(`Firestore save completed successfully for ${savedCount} receipts.`); })
                        .catch(batchError => { // Catch as unknown
                            const message = batchError instanceof Error ? batchError.message : String(batchError);
                            console.error(`Firestore Batch Save Error for retailer ${retailerKey}:`, message, batchError); // Log the safe message and original error
                        });
                } else { console.log("No successful shifts found in the API response to save to Firestore."); }

            } catch (firestoreError) { // Catch as unknown
                // const message = firestoreError instanceof Error ? firestoreError.message : String(firestoreError);
                console.error(`Firestore Processing Error for retailer ${retailerKey}:`, firestoreError);
                // Error is logged but response continues
            }
            return NextResponse.json(result, { status: 200 });

        } else {
            console.error(`External API Error for ${retailerKey}. ResultCode: ${result.ResultCode}, Message: ${result.ReturnMessage}`);
            return NextResponse.json({ error: result.ReturnMessage || `API returned status ${apiResponse.status} and ResultCode ${result.ResultCode}` }, { status: apiResponse.status });
        }
    } else {
        const errorText = await apiResponse.text();
        console.error(`External API Non-JSON Error for ${retailerKey}: Status ${apiResponse.status}, Body: ${errorText.substring(0, 500)}...`);
        throw new Error(`External API for ${retailerKey} returned a non-JSON error. Status: ${apiResponse.status}.`);
    }

  } catch (error) { // Catch as unknown
    console.error("API Route Error:", error);
    const message = error instanceof Error ? error.message : String(error); // Safely get message
    const errorMessage = message.includes("Server Configuration Error")
      ? "Internal server configuration issue."
      : message; // Use safe message
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}