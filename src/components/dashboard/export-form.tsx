"use client";

import { useEffect, useState, useMemo } from "react";
import Papa from "papaparse";
import { format as formatDate } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, FileDown, AlertCircle, X as XIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Receipt as ReceiptClientData } from "@/components/dashboard/data-table-columns"; 

// Type for retailer info fetched from /api/retailers
type RetailerInfo = { key: string; name: string };

// Month names array for dropdown options
const MONTHS = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];

// Client-side date parser (copied from data-table)
const parseClientMsDateString = (msDateString: string | undefined | null): Date | null => {
    if (!msDateString) return null;
    const match = msDateString.match(/\/Date\((\d+)(?:[+-]\d+)?\)\//);
    if (match && match[1]) { const ms = parseInt(match[1], 10); if (!isNaN(ms)) return new Date(ms); }
    return null;
};


export default function ExportForm() {
  const [loadingRetailers, setLoadingRetailers] = useState(true);
  const [loadingData, setLoadingData] = useState(false); // For export process
  const [retailers, setRetailers] = useState<RetailerInfo[]>([]);
  const [selectedRetailerKey, setSelectedRetailerKey] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>(""); // Month index as string or ""
  const [selectedYear, setSelectedYear] = useState<string>(""); // Year as string or ""
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Memoized list of available years based on fetched data (initially empty)
  const [fetchedDataCache, setFetchedDataCache] = useState<ReceiptClientData[]>([]); // Cache fetched data
  const availableYears = useMemo(() => {
    if (!selectedRetailerKey || fetchedDataCache.length === 0) return []; // Only calculate if retailer selected and data fetched
    const years = new Set<number>();
    fetchedDataCache.forEach((row) => {
      const date = parseClientMsDateString(row.receiptDate);
      if (date) years.add(date.getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [selectedRetailerKey, fetchedDataCache]); // Recalculate if retailer or cache changes


  // Effect 1: Fetch Retailer List
  useEffect(() => {
    let isMounted = true;
    const fetchRetailers = async () => {
      console.log("ExportForm: Fetching retailers...");
      setLoadingRetailers(true); setFetchError(null);
      try {
        const response = await fetch("/api/retailers");
        if (!isMounted) return; // Prevent state update if unmounted
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: "Failed fetchRetailers response" }));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        const retailerData: RetailerInfo[] = await response.json();
        console.log("ExportForm: Retailers fetched successfully:", retailerData);
        if (isMounted) {
            setRetailers(retailerData);
            if (retailerData.length === 0) { console.log("ExportForm: No retailers found."); toast.info("No retailers configured."); }
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("ExportForm: Error fetching retailers:", error);
        if (isMounted) {
            toast.error("Could not load retailer list.", { description: message });
            setFetchError(message || "Failed to load retailer list.");
            setRetailers([]); // Ensure empty on error
        }
      } finally {
           if (isMounted) {
               console.log("ExportForm: Finished fetching retailers.");
               setLoadingRetailers(false); // Mark retailer loading as complete
           }
      }
    };
    fetchRetailers();
    // Cleanup function for Effect 1
    return () => {
        console.log("ExportForm: Cleaning up retailer fetch effect.");
        isMounted = false;
     };
  }, []); // Empty dependency array ensures it runs only once

   // Effect 2: Fetch data whenever retailer changes to populate year dropdown
   useEffect(() => {
       let isMounted = true; // Flag for async cleanup
       // Clear everything and exit if no retailer is selected
       if (!selectedRetailerKey) {
           setFetchedDataCache([]);
           setSelectedMonth("");
           setSelectedYear("");
           return; // Stop the effect here
       }

       // Function to fetch data for the selected retailer
       const fetchData = async () => {
           console.log(`ExportForm: Fetching data for ${selectedRetailerKey} to populate years...`);
           setLoadingData(true); // Indicate data loading start
           setFetchError(null); // Reset errors
           setFetchedDataCache([]); // Clear old cache before fetching new data
           setSelectedMonth("");   // Reset month filter when retailer changes
           setSelectedYear("");    // Reset year filter when retailer changes
           try {
               // Call the backend API to get receipts
               const response = await fetch(`/api/get-receipts?retailerKey=${selectedRetailerKey}`);
               if (!isMounted) return; // Check if still mounted after await

               if (!response.ok) {
                    let errorMsg = `HTTP error! status: ${response.status}`;
                    // Try to parse error details from backend
                    try{ const d = await response.json(); errorMsg = d.error || errorMsg;} catch(e){
                         const textError = await response.text(); errorMsg = textError || errorMsg; // Fallback to text
                    }
                    throw new Error(errorMsg); // Throw error to be caught below
               }
               // Parse successful response
               const data: ReceiptClientData[] = await response.json();
               console.log(`ExportForm: Fetched ${data.length} records for year calculation.`);
               if (isMounted) {
                   setFetchedDataCache(data); // Store fetched data in cache
                   setFetchError(null); // Clear errors on success
               }
           } catch (error) {
               const message = error instanceof Error ? error.message : String(error);
               console.error(`ExportForm: Error fetching data for ${selectedRetailerKey}:`, error);
               if (isMounted) {
                   toast.error("Failed to fetch data for year/export.", { description: message });
                   setFetchError(message || "Failed to load data.");
                   setFetchedDataCache([]); // Clear cache on error
               }
           } finally {
               // This runs regardless of success or error
               if (isMounted) {
                   console.log(`ExportForm: Finished fetching data attempt for ${selectedRetailerKey}.`);
                   setLoadingData(false); // Stop data loading indicator
               }
           }
       };

       fetchData(); // Trigger the fetch

       // Cleanup function for this effect
       return () => {
            console.log(`ExportForm: Cleaning up data fetch effect for ${selectedRetailerKey}.`);
            isMounted = false;
        };
   }, [selectedRetailerKey]); // Re-run this effect ONLY when retailer selection changes


  // --- Export Function ---
  const handleExport = (exportFiltered: boolean) => {
    console.log(`Export triggered. Filtered: ${exportFiltered}`);
    // Find the name of the currently selected retailer for the filename
    const currentRetailerName = retailers.find(r => r.key === selectedRetailerKey)?.name || selectedRetailerKey || "UnknownRetailer";

    // --- Pre-export Checks ---
    if (loadingData) { toast.warning("Data is still loading for the selected retailer, please wait."); return; }
    if (loadingRetailers) { toast.warning("Retailer list is still loading."); return; }
    if (fetchedDataCache.length === 0 && selectedRetailerKey) { toast.error(`No data found for ${currentRetailerName} to export.`); return; }
    if (!selectedRetailerKey) { toast.error("Please select a retailer before exporting."); return;}


    let dataToExport: ReceiptClientData[] = fetchedDataCache; // Start with all cached data for the selected retailer

    // --- Apply Client-Side Filtering if requested ---
    const filterMonth = selectedMonth !== "" ? parseInt(selectedMonth, 10) : null; // null if "All Months"
    const filterYear = selectedYear !== "" ? parseInt(selectedYear, 10) : null; // null if "All Years"

    // Only filter if the 'Export Filtered' button was clicked AND at least one filter is set
    if (exportFiltered && (filterMonth !== null || filterYear !== null)) {
        console.log(`Applying filters - Month Index: ${filterMonth}, Year: ${filterYear}`);
        dataToExport = fetchedDataCache.filter(row => {
            const date = parseClientMsDateString(row.receiptDate); // Filter based on Receipt Date
            if (!date) return false; // Exclude rows with unparsable dates
            const rowMonth = date.getMonth(); // 0-11
            const rowYear = date.getFullYear();
            // Check if month matches (or if month filter is not set)
            const monthMatch = filterMonth === null || rowMonth === filterMonth;
            // Check if year matches (or if year filter is not set)
            const yearMatch = filterYear === null || rowYear === filterYear;
            // Include row only if both applicable filters match
            return monthMatch && yearMatch;
        });
        console.log(`Filtered data count for export: ${dataToExport.length}`);
        // If filtering results in no data, inform user and stop
        if (dataToExport.length === 0) {
            toast.info("No data matches the selected month/year filter.");
            return; // Stop export process
        }
    } else if (exportFiltered) {
        // If "Export Filtered" clicked but no filters set, inform and proceed to export all
         toast.info("No month or year selected for filtering. Exporting all data for the selected retailer.");
         exportFiltered = false; // Set flag to false for filename logic
    } else {
         // Exporting all data
         console.log(`Exporting all ${dataToExport.length} available records for ${currentRetailerName}.`);
    }


    // --- Format Data for CSV ---
    // Map the data (either all or filtered) to the desired CSV structure
    const csvData = dataToExport.map((originalData) => {
        // Parse dates again for consistent formatting in CSV
        const receiptDate = parseClientMsDateString(originalData.receiptDate);
        const shiftDate = parseClientMsDateString(originalData.shiftDay);
        // createdAt is already ISO string from API, convert to Date object for formatting
        const createdAtDate = originalData.createdAt ? new Date(originalData.createdAt) : null;

        // Return an object where keys are CSV headers and values are formatted data
        return {
            "Receipt No": originalData.receiptNo,
            "Receipt Date": receiptDate ? formatDate(receiptDate, "yyyy-MM-dd HH:mm:ss") : "Invalid Date String",
            "Shift Day": shiftDate ? formatDate(shiftDate, "yyyy-MM-dd HH:mm:ss") : "Invalid Date String",
            "Type": originalData.type === 1 ? "Return" : "Sale", // Map 0/1 to Sale/Return
            // Format numbers to 2 decimal places
            "Total (Net)": originalData.total.toFixed(2),
            "Tax (VAT)": originalData.tax.toFixed(2),
            "Gross Total": originalData.gross !== null ? originalData.gross.toFixed(2) : "", // Handle null gross
            // Format createdAt timestamp
            "Submitted At": createdAtDate && !isNaN(createdAtDate.getTime()) ? formatDate(createdAtDate, "yyyy-MM-dd HH:mm:ss") : "Invalid Date",
            "Internal ID": originalData.receiptId, // Include the unique ID generated by our backend
        };
    });

    // --- Generate CSV String using Papaparse ---
    const csvString = Papa.unparse(csvData, {
        header: true, // Include headers based on the object keys from csvData
    });

    // --- Trigger Browser Download ---
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' }); // Create blob
    const link = document.createElement("a"); // Create temporary link element
    // Check if browser supports the download attribute
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob); // Create a URL for the blob data
        // Construct filename dynamically based on retailer and filters
        const monthStr = filterMonth !== null ? MONTHS[filterMonth]?.substring(0, 3) : "All";
        const yearStr = filterYear !== null ? String(filterYear) : "AllYears";
        // Sanitize retailer name for filename
        const safeRetailerName = currentRetailerName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const filename = `receipts_${safeRetailerName}_${exportFiltered ? `${yearStr}-${monthStr}` : 'All'}.csv`;

        // Set link attributes
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden'; // Make link invisible
        document.body.appendChild(link); // Add link to page
        link.click(); // Simulate click to trigger download
        document.body.removeChild(link); // Remove link from page
        URL.revokeObjectURL(url); // Release the blob URL resource
        console.log(`CSV Export download triggered: ${filename}`);
        toast.success(`Exported ${dataToExport.length} records to ${filename}`);
    } else {
        // Fallback for older browsers that don't support download attribute
        toast.error("CSV export is not supported in your browser.");
        console.error("Browser does not support the download attribute.");
    }
  }; // --- End handleExport ---

  // --- Render Logic ---
  return (
    <Card>
      <CardHeader>
        <CardTitle>Export Options</CardTitle>
        <CardDescription>
          Select a retailer, then choose to export all their data or filter by month and year based on the Receipt Date. The export will include data currently stored.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Retailer Selection */}
        <div className="space-y-2">
          <Label htmlFor="retailer-select-export">Retailer</Label>
          <Select
              value={selectedRetailerKey}
              onValueChange={(value) => setSelectedRetailerKey(value === 'none' ? '' : value)}
              // Disable while loading retailers or if none were found
              disabled={loadingRetailers || retailers.length === 0}
          >
              <SelectTrigger id="retailer-select-export">
                  {/* Show appropriate placeholder based on loading state */}
                  <SelectValue placeholder={loadingRetailers ? "Loading retailers..." : "Select a retailer"} />
              </SelectTrigger>
              <SelectContent>
                  {/* Populate dropdown based on fetched retailers */}
                  {!loadingRetailers && retailers.length > 0 ? (
                      retailers.map((r) => (<SelectItem key={r.key} value={r.key}>{r.name}</SelectItem>))
                   )
                   // Loading state item
                   : loadingRetailers ? (<SelectItem value="loading" disabled>Loading...</SelectItem>)
                   // No retailers found state item
                   : (<SelectItem value="none" disabled> No retailers configured. </SelectItem>)}
              </SelectContent>
          </Select>
           {/* Display error if retailer fetch failed */}
           {!loadingRetailers && fetchError && (<p className="text-sm text-destructive mt-1">{fetchError}</p>)}
        </div>

        {/* Date Filters (Enabled only after retailer selected and initial data loaded) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Month Dropdown */}
            <div className="space-y-2">
                <Label htmlFor="month-select-export">Filter by Month (Optional)</Label>
                <Select
                    value={selectedMonth || "all"} // Use "all" as value for placeholder state
                    onValueChange={(value) => setSelectedMonth(value === "all" ? "" : value)} // Set state to "" if "all" selected
                    // Disable if no retailer selected, data is loading, or retailers failed to load
                    disabled={!selectedRetailerKey || loadingData || loadingRetailers || !!fetchError}
                >
                    <SelectTrigger id="month-select-export">
                        <SelectValue placeholder="All Months" />
                    </SelectTrigger>
                    <SelectContent>
                         {/* Use value="all" */}
                        <SelectItem value="all">All Months</SelectItem>
                        {MONTHS.map((month, index) => ( <SelectItem key={month} value={String(index)}> {month} </SelectItem> ))}
                    </SelectContent>
                </Select>
            </div>
             {/* Year Dropdown */}
             <div className="space-y-2">
                <Label htmlFor="year-select-export">Filter by Year (Optional)</Label>
                 <Select
                    value={selectedYear || "all"} // Use "all" as value for placeholder state
                    onValueChange={(value) => setSelectedYear(value === "all" ? "" : value)} // Set state to "" if "all" selected
                    // Disable if no retailer, loading, error, or no years available
                    disabled={!selectedRetailerKey || loadingData || loadingRetailers || !!fetchError || availableYears.length === 0}
                 >
                    <SelectTrigger id="year-select-export">
                        {/* Show placeholder based on state */}
                        <SelectValue placeholder={loadingData ? "Loading years..." : (availableYears.length === 0 && selectedRetailerKey ? "No Data" : "All Years")} />
                    </SelectTrigger>
                    <SelectContent>
                         {/* Use value="all" */}
                        <SelectItem value="all">All Years</SelectItem>
                        {/* Populate with years derived from fetched data */}
                        {availableYears.map((year) => ( <SelectItem key={year} value={String(year)}> {year} </SelectItem> ))}
                         {/* Show messages based on loading/data state */}
                         {/* Use non-empty values for disabled items */}
                         {loadingData && <SelectItem value="loading-years" disabled>Loading...</SelectItem>}
                         {!loadingData && availableYears.length === 0 && selectedRetailerKey && <SelectItem value="no-data-years" disabled>No data found</SelectItem>}
                    </SelectContent>
                </Select>
            </div>
        </div>
         {/* Clear Date Filters Button */}
         {(selectedMonth !== "" || selectedYear !== "") && (
             <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSelectedMonth(""); setSelectedYear(""); }} // Reset state
                // Disable while data or retailers are loading
                disabled={loadingData || loadingRetailers}
             >
                Clear Date Filters <XIcon className="ml-2 h-4 w-4" />
             </Button>
         )}

        {/* Export Buttons */}
        <div className="flex flex-wrap justify-end gap-4 pt-4 border-t">
             {/* Export All Button */}
             <Button
                variant="secondary"
                onClick={() => handleExport(false)} // Call handler with exportFiltered=false
                // Disable if loading, no retailer selected, or no cached data available
                disabled={loadingData || loadingRetailers || !selectedRetailerKey || fetchedDataCache.length === 0}
            >
                {/* Show loader if data is loading */}
                {loadingData ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileDown className="mr-2 h-4 w-4"/>}
                {/* Dynamically update button text */}
                Export All ({fetchedDataCache.length}) for {retailers.find(r=>r.key === selectedRetailerKey)?.name || '...'}
            </Button>
             {/* Export Filtered Button */}
             <Button
                onClick={() => handleExport(true)} // Call handler with exportFiltered=true
                // Disable if loading, no retailer selected, no data, OR no filters applied
                disabled={loadingData || loadingRetailers || !selectedRetailerKey || fetchedDataCache.length === 0 || (selectedMonth === "" && selectedYear === "")}
            >
                 {/* Show loader if data is loading */}
                 {loadingData ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileDown className="mr-2 h-4 w-4"/>}
                Export Filtered
            </Button>
        </div>
        {/* Display data fetch error if it occurs after selecting a retailer */}
        {fetchError && selectedRetailerKey && !loadingData && (
             <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error Loading Data for Export</AlertTitle>
                <AlertDescription>{fetchError}</AlertDescription>
            </Alert>
        )}

      </CardContent>
    </Card>
  );
}