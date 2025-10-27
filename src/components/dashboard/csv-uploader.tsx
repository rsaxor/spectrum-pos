"use client";

import { useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import Papa from "papaparse";
import { toast } from "sonner";
import { parse as dateParse } from "date-fns";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UploadCloud, File, X, Loader2, CheckCircle, AlertCircle } from "lucide-react";

type CsvRecord = { [key: string]: string };
type ApiResponse = {
    ResultCode: string;
    ReturnMessage: string | null;
    PushShiftReturnResult: ShiftResultDetail[] | null; // Use specific type instead of any[]
};
type RetailerInfo = { key: string; name: string };

type ShiftResultDetail = {
    Asset: string;
    Brand: string;
    ErrorDetails: string | null;
    ErrorMessage: string;
    Retailer: string;
    ReturnCode: string; // "200", "702", etc.
    ShiftDay: string; // MS Date string
    Unit: string;
};

export default function CsvUploader() {
  const [files, setFiles] = useState<File[]>([]);
  const [parsedData, setParsedData] = useState<CsvRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [retailers, setRetailers] = useState<RetailerInfo[]>([]);
  const [selectedRetailerKey, setSelectedRetailerKey] = useState<string>("");
  const [isFetchingRetailers, setIsFetchingRetailers] = useState(true);

  useEffect(() => {
    const fetchRetailers = async () => {
      setIsFetchingRetailers(true);
      try {
        const response = await fetch("/api/retailers");
        if (!response.ok) throw new Error("Failed to fetch retailers");
        const data: RetailerInfo[] = await response.json();
        setRetailers(data);
      } catch (error) {
        console.error("Error fetching retailers:", error);
        toast.error("Could not load retailer list.");
        setRetailers([]);
      } finally {
        setIsFetchingRetailers(false);
      }
    };
    fetchRetailers();
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => handleFileUpload(acceptedFiles),
    accept: { "text/csv": [".csv"] },
    maxFiles: 1,
    disabled: !selectedRetailerKey || isFetchingRetailers,
  });

  const handleFileUpload = (acceptedFiles: File[]) => {
     if (!selectedRetailerKey) {
        toast.error("Please select a retailer before uploading a file.");
        return;
    }
    setFiles(acceptedFiles);
    setParsedData([]);
    setApiResponse(null);
    setApiError(null);
    const file = acceptedFiles[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const parsedItems = results.data as unknown[]; // Start with unknown[]
          try {
            const validatedData: CsvRecord[] = parsedItems.map((item, index) => {
             // Check if the item is a valid object
                if (typeof item !== 'object' || item === null) {
                    throw new Error(`Invalid data structure found at row ${index + 2}. Expected an object.`);
                }
                // Check if essential keys exist (optional but recommended)
                // Add checks for keys you absolutely need, e.g., ReceiptNo, ReceiptDate
                if (!('ReceiptNo' in item) || !('ReceiptDate' in item) || !('ShiftDay' in item) || !('Total' in item) || !('Tax' in item) || !('Type' in item)) {
                     console.warn("Row missing required fields:", item); // Log the problematic row
                     throw new Error(`Row ${index + 2} is missing required fields (e.g., ReceiptNo, ReceiptDate, ShiftDay, Total, Tax, Type).`);
                }

                // If checks pass, assume it fits CsvRecord (all values are strings initially)
                return item as CsvRecord;
            });

            // --- Date Conversion Logic (uses validatedData) ---
            const transformedData = validatedData.map((row, index) => {
              const receiptDateStr = row.ReceiptDate;
              const shiftDayStr = row.ShiftDay;
              const expectedDateFormat = "dd MMM yyyy h:mm a";
              const parsedReceiptDate = dateParse(receiptDateStr, expectedDateFormat, new Date());
              const parsedShiftDay = dateParse(shiftDayStr, expectedDateFormat, new Date());

              if (isNaN(parsedReceiptDate.getTime()) || isNaN(parsedShiftDay.getTime())) {
                throw new Error(`Invalid date on row ${index + 2}. Found "${receiptDateStr}" or "${shiftDayStr}". Format: "${expectedDateFormat}".`);
              }

              return {
                ...row, // Spread the validated row
                ReceiptDate: `/Date(${parsedReceiptDate.getTime()})/`,
                ShiftDay: `/Date(${parsedShiftDay.getTime()})/`,
              };
            });

            setParsedData(transformedData);
            toast.success(`${transformedData.length} records parsed successfully.`);
          } catch (error) { // Catch as unknown
              // Safely get the error message
              const message = error instanceof Error ? error.message : String(error);
              setApiError(message); // Set the error state for UI display
              toast.error("Upload failed", { description: message }); // Show toast notification
              // Keep retailer selection and file data on error
          } finally {
            setIsLoading(false);
          }
        },
        error: (error) => toast.error("Failed to parse CSV file:", { description: error.message }),
      });
    }
  };

  const handleUpload = async () => {
    if (parsedData.length === 0 || !selectedRetailerKey) {
      toast.error("Please select a retailer and upload/parse a CSV file.");
      return;
    }
    setIsLoading(true);
    // Reset previous responses *before* making the call
    setApiResponse(null);
    setApiError(null);
    try {
      const response = await fetch("/api/upload-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receipts: parsedData, retailerKey: selectedRetailerKey }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "An unknown server error occurred.");

      setApiResponse(result); // Show the response first

      // Check if the API call was fully successful (ResultCode is "200")
      if (result.ResultCode === "200") {
        toast.success("Data uploaded successfully!");
        // Clear file and parsed data only on full success
        setFiles([]);
        setParsedData([]);
      } else {
         // Handle partial failures or other non-200 success codes if needed
         toast.warning("Data processed, but with issues reported by the API.", { description: result.ReturnMessage || "" });
         // DO NOT clear files or parsedData here, let user see the error and data
      }

    } catch (error) { // Catch as unknown
        // Safely get the error message
        const message = error instanceof Error ? error.message : String(error);
        setApiError(message); // Set the error state for UI display
        toast.error("Upload failed", { description: message }); // Show toast notification
        // DO NOT clear files or parsedData on error
    } finally {
      setIsLoading(false);
      // Removed cleanup from here to handle it conditionally above
    }
  };

  // Keep this function as is, it's for the 'X' button
  const removeFile = () => {
    setFiles([]);
    setParsedData([]);
    setApiResponse(null);
    setApiError(null);
  };

  const isSuccess = apiResponse ? parseInt(apiResponse.ResultCode, 10) === 200 : false;
  const isUploadDisabled = isLoading || parsedData.length === 0 || !selectedRetailerKey;

  return (
    <div className="space-y-6">
      <Card>
          <CardHeader>
              <CardTitle>Select Retailer</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="grid gap-2">
                 <Label htmlFor="retailer-select">Retailer</Label>
                 <Select
                    value={selectedRetailerKey}
                    onValueChange={(value) => {
                        // When retailer changes, clear any existing file/data
                        setSelectedRetailerKey(value);
                        removeFile();
                    }}
                    disabled={isFetchingRetailers || isLoading}
                 >
                    <SelectTrigger id="retailer-select">
                        <SelectValue placeholder={isFetchingRetailers ? "Loading retailers..." : "Select a retailer"} />
                    </SelectTrigger>
                    <SelectContent>
                        {retailers.length > 0 ? (
                             retailers.map((retailer) => (
                                <SelectItem key={retailer.key} value={retailer.key}>
                                    {retailer.name}
                                </SelectItem>
                            ))
                        ) : (
                            <SelectItem value="none" disabled>
                                No retailers found or failed to load.
                            </SelectItem>
                        )}
                    </SelectContent>
                 </Select>
             </div>
          </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload Sales CSV</CardTitle>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <div
              {...getRootProps()}
              className={`flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                isDragActive ? "border-primary bg-primary/10" : "border-muted hover:border-primary/50"
              } ${(!selectedRetailerKey || isFetchingRetailers) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input {...getInputProps()} />
              <UploadCloud className="w-12 h-12 text-muted-foreground" />
              <p className="mt-4 text-center text-muted-foreground">
                {isFetchingRetailers ? "Loading retailers..." :
                 !selectedRetailerKey ? "Please select a retailer above first." :
                 isDragActive ? "Drop the CSV file here ..." :
                 "Drag & drop a CSV file here, or click to select"}
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <File className="w-8 h-8 text-primary" />
                <span className="font-medium">{files[0].name}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={removeFile} disabled={isLoading}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          )}
           <div className="mt-4 text-center">
                <a href="/sales-template.csv" download className="text-sm font-medium text-primary hover:underline">
                    Download CSV Template
                </a>
            </div>
        </CardContent>
      </Card>
      
      {parsedData.length > 0 && (
        <Card>
            <CardHeader>
                <CardTitle>Parsed Data Preview (First 5 Rows)</CardTitle>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader><TableRow>{Object.keys(parsedData[0]).map((key) => <TableHead key={key}>{key}</TableHead>)}</TableRow></TableHeader>
                    <TableBody>{parsedData.slice(0, 5).map((row, index) => (<TableRow key={index}>{Object.values(row).map((value, i) => <TableCell key={i}>{value}</TableCell>)}</TableRow>))}</TableBody>
                 </Table>
                <div className="flex justify-end mt-6">
                    <Button onClick={handleUpload} disabled={isUploadDisabled}>
                        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Process & Upload {parsedData.length} Records
                    </Button>
                </div>
            </CardContent>
        </Card>
      )}

       {apiResponse && (
        <Alert variant={isSuccess ? "success" : "destructive"}>
            {isSuccess ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <AlertTitle>
                {isSuccess ? "Upload Successful" : "Upload Partially Failed or Failed"} (Result Code: {apiResponse.ResultCode})
            </AlertTitle>
          <AlertDescription>
            <pre className="mt-2 w-full overflow-x-auto rounded-md bg-slate-950 p-4">
              <code className="text-white">{JSON.stringify(apiResponse, null, 2)}</code>
            </pre>
          </AlertDescription>
        </Alert>
      )}
      {apiError && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertTitle>Upload Failed</AlertTitle>
          <AlertDescription>{apiError}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}