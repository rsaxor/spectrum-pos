"use client"

import { useEffect, useState, useCallback } from 'react'; // Added useRef, useCallback
import { DataTable } from '@/components/dashboard/data-table';
import { columns } from '@/components/dashboard/data-table-columns';
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from 'sonner';
import { useAuth } from '@/context/auth-provider';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';


// Type for retailer info fetched from /api/retailers
type RetailerInfo = { key: string; name: string };

export type ReceiptClientData = {
    id: string;
    receiptId: string;
    receiptNo: string;
    receiptDate: string; // MS Date String
    shiftDay: string;    // MS Date String
    total: number;
    tax: number;
    gross: number | null;
    type: number;
    createdAt: string; // ISO String from API
    retailerKey: string;
    saleChannel: string;
};

export default function ViewDataPage() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<ReceiptClientData[]>([]);
  const [loadingData, setLoadingData] = useState(false); // Specific state for data loading
  const [loadingRetailers, setLoadingRetailers] = useState(true); // Specific state for retailer loading
  const [retailers, setRetailers] = useState<RetailerInfo[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedRetailerKey, setSelectedRetailerKey] = useState<string>("");

  // Effect 1: Fetch Retailer List (runs once)
  useEffect(() => {
    let isMounted = true; // Prevent state updates on unmounted component
    const fetchRetailers = async () => {
      console.log("Effect 1: Fetching retailers...");
      setLoadingRetailers(true); // Indicate retailer loading specifically
      setFetchError(null);
      try {
        const response = await fetch("/api/retailers");
        console.log(`Effect 1: /api/retailers response status: ${response.status}`);

        if (!response.ok) {
            let errorMsg = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                console.error("Effect 1: Received error JSON from /api/retailers:", errorData);
                errorMsg = errorData.error || errorMsg;
            } catch (parseError) {
                const errorText = await response.text();
                console.error("Effect 1: Received non-JSON error response from /api/retailers:", errorText);
                errorMsg = `Failed to load retailers (${response.status})`; // More generic message
            }
            // Throw error to be caught below
            throw new Error(errorMsg);
        }

        const retailerData: RetailerInfo[] = await response.json();
        console.log("Effect 1: Retailers fetched successfully:", retailerData);
        if (isMounted) {
            setRetailers(retailerData); // Update state
            if (retailerData.length === 0) {
                 console.log("Effect 1: No retailers found.");
                 toast.info("No retailers configured.");
            }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Effect 1: Error fetching retailers:", error);
        if (isMounted) {
            toast.error("Could not load retailer list.", { description: message });
            setFetchError(message || "Failed to load retailer list.");
        }
      } finally {
           // This will run regardless of success or error
           if (isMounted) {
               console.log("Effect 1: Finished fetching retailers. Setting loadingRetailers to false.");
               setLoadingRetailers(false); // Mark retailer loading as complete
           }
      }
    };
    fetchRetailers();

    // Cleanup for Effect 1
    return () => {
        console.log("Effect 1: Cleaning up retailer fetch effect.");
        isMounted = false;
    };
  }, []); // Empty dependency array ensures it runs only once

  // --- Effect 2: Fetch data via API when selection changes ---
  // Use useCallback to memoize the fetch function
  const fetchDataForRetailer = useCallback(async (retailerKey: string) => {
    // Guard: Don't fetch if no key or user isn't loaded/exists
    if (!retailerKey || authLoading || !user) {
        console.log(`fetchDataForRetailer: Skipping fetch - Key: ${retailerKey}, AuthLoading: ${authLoading}, User: ${!!user}`);
        setData([]); // Clear data if no selection or user
        setLoadingData(false); // Ensure loading stops
        return;
    }

    console.log(`Fetching data for selected retailer: ${retailerKey}`);
    setLoadingData(true); // Indicate data loading specifically
    setFetchError(null);
    setData([]); // Clear previous data

    try {
        const response = await fetch(`/api/get-receipts?retailerKey=${retailerKey}`);
        console.log(`/api/get-receipts response status: ${response.status}`);

        if (!response.ok) {
            let errorMsg = `HTTP error! status: ${response.status}`;
            try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; }
            catch (e) { const textError = await response.text(); errorMsg = textError || errorMsg; }
            throw new Error(errorMsg);
        }

        const fetchedData: ReceiptClientData[] = await response.json();
        console.log(`Successfully fetched ${fetchedData.length} receipts for ${retailerKey}`);
        // Sort data immediately after fetching
        fetchedData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setData(fetchedData);
        setFetchError(null);

    } catch (error) { // Catch as unknown
        console.error(`Error fetching data for ${retailerKey}:`, error);
        // Check if it's an Error object to get message, otherwise convert to string
        const message = error instanceof Error ? error.message : String(error);
        toast.error("Failed to load data.", { description: message });
        setFetchError(message || "Failed to load data.");
        setData([]);
    } finally {
        console.log(`Finished fetching data for ${retailerKey}. Setting loadingData to false.`);
        setLoadingData(false); // Stop data loading indicator
    }
  }, [user, authLoading]); // Depend on user and authLoading

  // Trigger fetch when selectedRetailerKey changes
  useEffect(() => {
      console.log(`Effect 3: Selected retailer changed to: ${selectedRetailerKey}. Calling fetchDataForRetailer.`);
      fetchDataForRetailer(selectedRetailerKey);
  }, [selectedRetailerKey, fetchDataForRetailer]); // Run when selection changes


  // --- Render Logic ---
  // Determine overall loading state
  const isOverallLoading = loadingRetailers || loadingData || authLoading;

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold tracking-tight mb-4">View Submitted Receipts</h1>
      <p className="text-muted-foreground mb-6"> Select a retailer to view, search, and sort their submitted transactions. </p>

      {/* Retailer Selection Dropdown & Refresh Button */}
      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div className="flex-grow max-w-sm">
          <Label htmlFor="retailer-select-view" className="mb-3">Select Retailer</Label>
          <Select
              value={selectedRetailerKey}
              onValueChange={(value) => setSelectedRetailerKey(value === 'none' ? '' : value)}
              // Disable while initial retailers are loading
              disabled={loadingRetailers || retailers.length === 0}
          >
              <SelectTrigger id="retailer-select-view">
                  <SelectValue placeholder={loadingRetailers ? "Loading retailers..." : "Select a retailer"} />
              </SelectTrigger>
              <SelectContent>
                  {!loadingRetailers && retailers.length > 0 ? ( retailers.map((r) => (<SelectItem key={r.key} value={r.key}>{r.name}</SelectItem>)) )
                   : loadingRetailers ? (<SelectItem value="loading" disabled>Loading...</SelectItem>)
                   : (<SelectItem value="none" disabled> No retailers configured. </SelectItem>)}
              </SelectContent>
          </Select>
          {/* Show error only if retailer fetch failed */}
          {fetchError && !loadingData && !selectedRetailerKey && (
             <p className="text-sm text-destructive mt-2">{fetchError}</p>
         )}
        </div>
        {/* Refresh Button */}
        <Button
            variant="outline"
            size="icon"
            onClick={() => fetchDataForRetailer(selectedRetailerKey)} // Re-fetch for selected
            disabled={loadingData || !selectedRetailerKey || !user || loadingRetailers} // More precise disable logic
            title="Refresh Data"
        >
            <RefreshCw className={`h-4 w-4 ${loadingData ? 'animate-spin' : ''}`} />
        </Button>
      </div>


      {/* Conditional Rendering */}
      {/* Show Skeleton if retailers are loading OR auth is loading OR data is loading */}
      {isOverallLoading ? (
          <div className="space-y-4"> <Skeleton className="h-10 w-1/3" /> <Skeleton className="h-96 w-full" /> </div>
      ) : fetchError ? ( // Show error if listener failed OR initial retailer fetch failed
        <Alert variant="destructive"> <AlertCircle className="h-4 w-4" /> <AlertTitle>Error Loading Data</AlertTitle> <AlertDescription>{fetchError}</AlertDescription> </Alert>
      ) : !selectedRetailerKey ? ( // Show message if no retailer selected (after initial load)
         <Alert> <AlertTitle>Select a Retailer</AlertTitle> <AlertDescription>Please select a retailer from the dropdown above to view their data.</AlertDescription> </Alert>
      ) : ( // Show data table
        <DataTable columns={columns} data={data} />
      )}
    </div>
  )
}