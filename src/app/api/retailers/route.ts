import { NextResponse } from 'next/server';

type RetailerConfig = { key: string; name: string; mall: string; brand: string; unit: string; envUserVar: string; envPassVar: string };
type PublicRetailerInfo = { key: string; name: string };

const getRetailerConfigs = (): RetailerConfig[] => {
    console.log("[API /retailers] Attempting to read RETAILERS_CONFIG env var...");
    const configJson = process.env.RETAILERS_CONFIG;
    if (!configJson) {
        console.error("[API /retailers] RETAILERS_CONFIG is missing or empty.");
        throw new Error("Server Configuration Error: RETAILERS_CONFIG environment variable is missing or empty.");
    }
    try {
        console.log("[API /retailers] Parsing RETAILERS_CONFIG JSON...");
        const configs = JSON.parse(configJson) as RetailerConfig[];
        console.log(`[API /retailers] Successfully parsed ${configs.length} configs.`);
        // Add validation here if needed
        if (!Array.isArray(configs)) throw new Error("Parsed config is not an array.");
        return configs;
    } catch (e) { // Catch as unknown
        const message = e instanceof Error ? e.message : String(e); // Safely get message
        console.error("[API /retailers] Failed to parse RETAILERS_CONFIG JSON:", e);
        // Use the safe message
        throw new Error(`Server Configuration Error: Failed to parse RETAILERS_CONFIG JSON. ${message}`);
    }
};

export async function GET() {
  console.log("[API /retailers] GET request received.");
  try {
    const retailerConfigs = getRetailerConfigs();

    const publicRetailerInfo: PublicRetailerInfo[] = retailerConfigs.map(config => ({
        key: config.key,
        name: config.name,
    }));
    console.log("[API /retailers] Sending public retailer info:", publicRetailerInfo);

    return NextResponse.json(publicRetailerInfo);

  } catch (error) { // Catch as unknown
    console.error("[API /retailers] Error processing GET request:", error);
    // Determine message safely
    const message = error instanceof Error ? error.message : String(error);
    // Use the safe message in the check and response
    const errorMessage = message.includes("Server Configuration Error")
      ? "Internal server configuration issue."
      : message || "Failed to load retailer list.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}