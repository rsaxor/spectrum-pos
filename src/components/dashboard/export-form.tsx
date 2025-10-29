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

// --- Constants ---
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const CSV_DATE_FORMAT = "yyyy-MM-dd HH:mm:ss";

// --- Helpers ---
const parseClientMsDateString = (msDateString: string | undefined | null): Date | null => {
  if (!msDateString) return null;
  const match = msDateString.match(/\/Date\((\d+)(?:[+-]\d+)?\)\//);
  if (match && match[1]) {
    const ms = parseInt(match[1], 10);
    if (!isNaN(ms)) return new Date(ms);
  }
  return null;
};

const sanitizeFilename = (name: string): string =>
  name.replace(/[^a-z0-9]/gi, "_").toLowerCase();

type RetailerInfo = { key: string; name: string };

export default function ExportForm() {
  const [loadingRetailers, setLoadingRetailers] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [retailers, setRetailers] = useState<RetailerInfo[]>([]);
  const [selectedRetailerKey, setSelectedRetailerKey] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchedDataCache, setFetchedDataCache] = useState<ReceiptClientData[]>([]);
  const [showOverlay, setShowOverlay] = useState(false);

  // --- Memoized available years ---
  const availableYears = useMemo(() => {
    if (!selectedRetailerKey || fetchedDataCache.length === 0) return [];
    const years = new Set<number>();
    fetchedDataCache.forEach(row => {
      const date = parseClientMsDateString(row.receiptDate);
      if (date) years.add(date.getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [selectedRetailerKey, fetchedDataCache]);

  // --- Fetch retailers ---
  useEffect(() => {
    let isMounted = true;
    const fetchRetailers = async () => {
      setLoadingRetailers(true);
      setFetchError(null);
      try {
        const response = await fetch("/api/retailers");
        if (!isMounted) return;
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Failed fetchRetailers response" }));
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        const retailerData: RetailerInfo[] = await response.json();
        if (isMounted) {
          setRetailers(retailerData);
          if (retailerData.length === 0) toast.info("No retailers configured.");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (isMounted) {
          toast.error("Could not load retailer list.", { description: message });
          setFetchError(message || "Failed to load retailer list.");
          setRetailers([]);
        }
      } finally {
        if (isMounted) setLoadingRetailers(false);
      }
    };
    fetchRetailers();
    return () => { isMounted = false; };
  }, []);

  // --- Fetch data for selected retailer ---
  useEffect(() => {
    let isMounted = true;
    if (!selectedRetailerKey) {
      setFetchedDataCache([]);
      setSelectedMonth("");
      setSelectedYear("");
      return;
    }
    const fetchData = async () => {
      setLoadingData(true);
      setFetchError(null);
      setFetchedDataCache([]);
      setSelectedMonth("");
      setSelectedYear("");
      try {
        const response = await fetch(`/api/get-receipts?retailerKey=${selectedRetailerKey}`);
        if (!isMounted) return;
        if (!response.ok) {
          let errorMsg = `HTTP error! status: ${response.status}`;
          try {
            const d = await response.json();
            errorMsg = d.error || errorMsg;
          } catch {
            errorMsg = await response.text();
          }
          throw new Error(errorMsg);
        }
        const data: ReceiptClientData[] = await response.json();
        if (isMounted) {
          setFetchedDataCache(data);
          setFetchError(null);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (isMounted) {
          toast.error("Failed to fetch data for year/export.", { description: message });
          setFetchError(message || "Failed to load data.");
          setFetchedDataCache([]);
        }
      } finally {
        if (isMounted) setLoadingData(false);
      }
    };
    fetchData();
    return () => { isMounted = false; };
  }, [selectedRetailerKey]);

  // --- CSV Export Helper ---
  const exportToCSV = (csvData: object[], filename: string) => {
    const csvString = Papa.unparse(csvData, { header: true });
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${csvData.length} records to ${filename}`);
    } else {
      toast.error("CSV export is not supported in your browser.");
    }
  };

  // --- Export Function ---
  const handleExport = (exportFiltered: boolean) => {
    setShowOverlay(true); // Show spinner overlay
    const currentRetailerName = retailers.find(r => r.key === selectedRetailerKey)?.name || selectedRetailerKey || "UnknownRetailer";
    if (loadingData) { toast.warning("Data is still loading for the selected retailer, please wait."); setShowOverlay(false); return; }
    if (loadingRetailers) { toast.warning("Retailer list is still loading."); setShowOverlay(false); return; }
    if (fetchedDataCache.length === 0 && selectedRetailerKey) { toast.error(`No data found for ${currentRetailerName} to export.`); setShowOverlay(false); return; }
    if (!selectedRetailerKey) { toast.error("Please select a retailer before exporting."); setShowOverlay(false); return; }

    let dataToExport: ReceiptClientData[] = fetchedDataCache;
    const filterMonth = selectedMonth !== "" ? parseInt(selectedMonth, 10) : null;
    const filterYear = selectedYear !== "" ? parseInt(selectedYear, 10) : null;

    if (exportFiltered && (filterMonth !== null || filterYear !== null)) {
      dataToExport = fetchedDataCache.filter(row => {
        const date = parseClientMsDateString(row.receiptDate);
        if (!date) return false;
        const rowMonth = date.getMonth();
        const rowYear = date.getFullYear();
        return (filterMonth === null || rowMonth === filterMonth) &&
               (filterYear === null || rowYear === filterYear);
      });
      if (dataToExport.length === 0) {
        toast.info("No data matches the selected month/year filter.");
        setShowOverlay(false);
        return;
      }
    } else if (exportFiltered) {
      toast.info("No month or year selected for filtering. Exporting all data for the selected retailer.");
      exportFiltered = false;
    }

    const csvData = dataToExport.map((originalData) => {
      const receiptDate = parseClientMsDateString(originalData.receiptDate);
      const shiftDate = parseClientMsDateString(originalData.shiftDay);
      const createdAtDate = originalData.createdAt ? new Date(originalData.createdAt) : null;
      return {
        "Receipt No": originalData.receiptNo,
        "Receipt Date": receiptDate ? formatDate(receiptDate, CSV_DATE_FORMAT) : "Invalid Date String",
        "Shift Day": shiftDate ? formatDate(shiftDate, CSV_DATE_FORMAT) : "Invalid Date String",
        "Type": originalData.type === 1 ? "Return" : "Sale",
        "Total (Net)": originalData.total.toFixed(2),
        "Tax (VAT)": originalData.tax.toFixed(2),
        "Gross Total": originalData.gross !== null ? originalData.gross.toFixed(2) : "",
        "Submitted At": createdAtDate && !isNaN(createdAtDate.getTime()) ? formatDate(createdAtDate, CSV_DATE_FORMAT) : "Invalid Date",
        "Internal ID": originalData.receiptId,
      };
    });

    const monthStr = filterMonth !== null ? MONTHS[filterMonth]?.substring(0, 3) : "All";
    const yearStr = filterYear !== null ? String(filterYear) : "AllYears";
    const safeRetailerName = sanitizeFilename(currentRetailerName);
    const filename = `receipts_${safeRetailerName}_${exportFiltered ? `${yearStr}-${monthStr}` : "All"}.csv`;

    exportToCSV(csvData, filename);
    setShowOverlay(false);
  };

  // --- Render ---
  return (
    <Card>
      {/* Overlay spinner for large exports */}
      {showOverlay && (
        <div
          style={{
            position: "absolute",
            top: 0, left: 0, width: "100%", height: "100%",
            background: "rgba(255,255,255,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 10
          }}
          aria-label="Exporting data, please wait"
        >
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      )}
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
            onValueChange={(value) => setSelectedRetailerKey(value === "none" ? "" : value)}
            disabled={loadingRetailers || retailers.length === 0}
            aria-label="Select retailer"
          >
            <SelectTrigger id="retailer-select-export">
              <SelectValue placeholder={loadingRetailers ? "Loading retailers..." : "Select a retailer"} />
            </SelectTrigger>
            <SelectContent>
              {!loadingRetailers && retailers.length > 0 ? (
                retailers.map((r) => (
                  <SelectItem key={r.key} value={r.key}>
                    {r.name}
                  </SelectItem>
                ))
              ) : loadingRetailers ? (
                <SelectItem value="loading" disabled>
                  Loading...
                </SelectItem>
              ) : (
                <SelectItem value="none" disabled>
                  No retailers configured.
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          {!loadingRetailers && fetchError && (
            <p className="text-sm text-destructive mt-1">{fetchError}</p>
          )}
        </div>

        {/* Date Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Month Dropdown */}
          <div className="space-y-2">
            <Label htmlFor="month-select-export">Filter by Month (Optional)</Label>
            <Select
              value={selectedMonth || "all"}
              onValueChange={(value) => setSelectedMonth(value === "all" ? "" : value)}
              disabled={!selectedRetailerKey || loadingData || loadingRetailers || !!fetchError}
              aria-label="Filter by month"
            >
              <SelectTrigger id="month-select-export">
                <SelectValue placeholder="All Months" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {MONTHS.map((month, index) => (
                  <SelectItem key={month} value={String(index)}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Year Dropdown */}
          <div className="space-y-2">
            <Label htmlFor="year-select-export">Filter by Year (Optional)</Label>
            <Select
              value={selectedYear || "all"}
              onValueChange={(value) => setSelectedYear(value === "all" ? "" : value)}
              disabled={!selectedRetailerKey || loadingData || loadingRetailers || !!fetchError || availableYears.length === 0}
              aria-label="Filter by year"
            >
              <SelectTrigger id="year-select-export">
                <SelectValue
                  placeholder={
                    loadingData
                      ? "Loading years..."
                      : availableYears.length === 0 && selectedRetailerKey
                      ? "No Data"
                      : "All Years"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
                {loadingData && (
                  <SelectItem value="loading-years" disabled>
                    Loading...
                  </SelectItem>
                )}
                {!loadingData && availableYears.length === 0 && selectedRetailerKey && (
                  <SelectItem value="no-data-years" disabled>
                    No data found
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        {/* Clear Date Filters Button */}
        {(selectedMonth !== "" || selectedYear !== "") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedMonth("");
              setSelectedYear("");
            }}
            disabled={loadingData || loadingRetailers}
            aria-label="Clear date filters"
          >
            Clear Date Filters <XIcon className="ml-2 h-4 w-4" />
          </Button>
        )}

        {/* Export Buttons */}
        <div className="flex flex-wrap justify-end gap-4 pt-4 border-t">
          <Button
            variant="secondary"
            onClick={() => handleExport(false)}
            disabled={
              loadingData ||
              loadingRetailers ||
              !selectedRetailerKey ||
              fetchedDataCache.length === 0
            }
            aria-label="Export all data"
          >
            {loadingData ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-4 w-4" />
            )}
            Export All ({fetchedDataCache.length}) for {retailers.find(r => r.key === selectedRetailerKey)?.name || "..."}
          </Button>
          <Button
            onClick={() => handleExport(true)}
            disabled={
              loadingData ||
              loadingRetailers ||
              !selectedRetailerKey ||
              fetchedDataCache.length === 0 ||
              (selectedMonth === "" && selectedYear === "")
            }
            aria-label="Export filtered data"
          >
            {loadingData ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-4 w-4" />
            )}
            Export Filtered
          </Button>
        </div>
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