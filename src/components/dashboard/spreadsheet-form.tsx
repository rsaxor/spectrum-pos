"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
// Import toZonedTime
import { format as dateFormat, parse as dateParse } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import Papa from "papaparse";

import { cn } from "@/lib/utils"; // Import cn utility
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea"; // Import Textarea
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
// Import all needed icons
import { Loader2, AlertCircle, X as XIcon, Plus, ClipboardPaste, Copy, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";

// --- Types ---
type ProcessedApiRow = {
    ReceiptNo: string;
    Tax: string;
    Total: string;
    Type: string;
    Gross?: string | undefined;
    SaleChannel: string;
    ReceiptDate: string; // This will be the MS Date String
    ShiftDay: string; // This will be the MS Date String
};

type ApiResponse = {
    ResultCode: string;
    ReturnMessage: string | null;
    // Define the shape of the API result objects
    PushShiftReturnResult: {
        Asset: string;
        Brand: string;
        ErrorDetails: string | null;
        ErrorMessage: string;
        Retailer: string;
        ReturnCode: string;
        ShiftDay: string;
        Unit: string;
    }[] | null;
};
type RetailerInfo = { key: string; name: string };
const MAX_ROWS = 50; // Max row limit
const GST_TIMEZONE = 'Asia/Dubai';

// Column keys in the exact order they will be pasted from Excel
// 'as const' makes it a readonly tuple for precise typing
const COLUMN_KEYS = [
  "ReceiptDate", "ReceiptNo", "ShiftDay", "Tax", "Total", "Type", "Gross", "SaleChannel"
] as const;

// Validation for a single row
const rowSchema = z.object({
    ReceiptDate: z.string().min(1, "Required"),
    ReceiptNo: z.string().min(1, "Required"),
    ShiftDay: z.string().min(1, "Required"),
    Tax: z.string().min(1, "Required").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, "Must be a non-negative number"),
    Total: z.string().min(1, "Required").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, "Must be a positive number"),
    Type: z.string().min(1, "Required").refine(v => v === "0" || v === "1", "Must be 0 or 1"),
    // Allow empty string or valid non-negative number
    Gross: z.string().optional().refine(v => v === "" || !v || (v && !isNaN(parseFloat(v)) && parseFloat(v) >= 0), "Must be a non-negative number"),
    SaleChannel: z.string().optional(),
});

// Validation for the whole form
const formSchema = z.object({
  retailerKey: z.string().min(1, "You must select a retailer."),
  pasteData: z.string().optional(), // This field is for the textarea
  rows: z.array(rowSchema)
           .min(1, "You must add at least one row.")
           .max(MAX_ROWS, `You cannot submit more than ${MAX_ROWS} rows at once.`),
});

// Infer types from schemas
type FormValues = z.infer<typeof formSchema>;
type RowData = z.infer<typeof rowSchema>;

// Helper for a new, empty row
const createEmptyRow = (): RowData => ({
    ReceiptDate: "",
    ReceiptNo: "",
    ShiftDay: "",
    Tax: "",
    Total: "",
    Type: "0", // Default to "Sale"
    Gross: "",
    SaleChannel: "Store-sales" // Default value
});

// Define the user-friendly date format
const USER_FRIENDLY_DATE_FORMAT = "dd MMM yyyy h:mm a";

// --- Component ---
export function SpreadsheetForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [retailers, setRetailers] = useState<RetailerInfo[]>([]);
  const [isFetchingRetailers, setIsFetchingRetailers] = useState(true);
  
  // Initialize react-hook-form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      retailerKey: "",
      pasteData: "", // Start with empty string for hydration safety
      rows: [createEmptyRow()], // Start with one empty row
    },
    mode: "onSubmit", // Validate on submit
  });

  // Get field array methods from hook
  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "rows"
  });

  // Get setValue from form
  const { setValue, watch } = form; // Get watch as well

  // Effect to fetch retailers (Full logic included)
  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates if component unmounts
    const fetchRetailers = async () => {
        setIsFetchingRetailers(true);
        try {
            const response = await fetch("/api/retailers");
            if (!isMounted) return; // Don't update state if unmounted
            if (!response.ok) throw new Error("Failed to fetch retailers");
            const data: RetailerInfo[] = await response.json();
            if (isMounted) setRetailers(data);
        } catch (error) {
            console.error("Error fetching retailers:", error);
            const message = error instanceof Error ? error.message : "Could not load retailer list.";
            toast.error("Error fetching retailers", { description: message });
            if (isMounted) setRetailers([]);
        } finally {
            if (isMounted) setIsFetchingRetailers(false);
        }
    };
    fetchRetailers();
    // Cleanup function
    return () => { isMounted = false; };
  }, []); // Empty array, runs once on mount

  // --- Set default paste text on client mount ---
  useEffect(() => {
    // This runs only on the client, avoiding hydration mismatch
    try {
        const nowInGst = toZonedTime(new Date(), GST_TIMEZONE);
        const shiftTimeGst = new Date(nowInGst);
        shiftTimeGst.setHours(9, 0, 0, 0); // Set to 9:00 AM
        
        const receiptDateStr = dateFormat(nowInGst, USER_FRIENDLY_DATE_FORMAT);
        const shiftDayStr = dateFormat(shiftTimeGst, USER_FRIENDLY_DATE_FORMAT);

        // Create the tab-separated string based on COLUMN_KEYS order
        const defaultRowString = [
            receiptDateStr, // Col 1: Current time
            "",             // Col 2: Blank (ReceiptNo)
            shiftDayStr,    // Col 3: 9:00 AM
            "",             // Col 4: Blank (Tax)
            "",             // Col 5: Blank (Total)
            "0",            // Col 6: 0 (Type)
            "",             // Col 7: Blank (Gross)
            "Store-sales"   // Col 8: Store-sales
        ].join("\t"); // Use \t (tab)

        setValue("pasteData", defaultRowString);
    } catch (e) {
        console.error("Error setting default paste text:", e);
        setValue("pasteData", "Error generating date. Please paste manually.");
    }
  }, [setValue]); // Run once when setValue is available

  // --- Paste Parsing Logic ---
  const handleParsePaste = () => {
    const pasteText = form.getValues("pasteData"); // Get text from textarea
    if (!pasteText) {
        toast.info("Paste box is empty. Nothing to parse.");
        return;
    }
    // Check for retailer selection
    if (!form.getValues("retailerKey")) {
        toast.error("Please select a retailer before parsing.");
        return;
    }

    // Parse the text (Tab-Separated Values)
    const { data, errors } = Papa.parse<string[]>(pasteText, {
        delimiter: "\t", // This is the key for Excel/Sheets
        header: false, // Assume no headers are copied
        skipEmptyLines: true,
    });

    if (errors.length > 0) {
        console.error("PapaParse errors:", errors);
        toast.error("Failed to parse pasted data.", { description: errors[0].message });
        return;
    }
    if (data.length === 0) { toast.info("No data found in paste."); return; }
    
    const isOverLimit = data.length > MAX_ROWS;
    if (isOverLimit) {
        toast.warning(`Too many rows (${data.length}). Parsing the first ${MAX_ROWS} rows only.`);
    }

    // Map the 2D string array to an array of RowData objects
    const newRows: RowData[] = data
        .slice(0, MAX_ROWS) // Enforce row limit
        .map((rowArray): RowData => {
            const rowObject: Partial<RowData> = {};
            // Assign cell data to object keys based on predefined column order
            COLUMN_KEYS.forEach((key, index) => {
                rowObject[key] = rowArray[index] || ""; // Default to empty string if cell is missing
            });
            
            // Set defaults for Type and SaleChannel if they are blank after paste
            if (!rowObject.Type) rowObject.Type = "0";
            if (!rowObject.SaleChannel) rowObject.SaleChannel = "Store-sales";
            
            return rowObject as RowData; // Assume it matches the structure
        });
        
    if (newRows.length > 0) {
        replace(newRows); // Replace the entire form array with the new data
        form.setValue("pasteData", ""); // Clear the textarea
        toast.success(`Pasted and parsed ${newRows.length} rows successfully.`);
    } else {
        toast.error("Could not create any valid rows from the pasted data.");
    }
  }; // --- End handleParsePaste ---

  // --- Submit Logic (Full logic included) ---
  async function onSubmit(values: FormValues) {
    setIsLoading(true);
    setApiResponse(null);
    setApiError(null);
    
    let processedRows: ProcessedApiRow[] = [];
    try {
        // 1. Convert dates and prepare data
        processedRows = values.rows.map((row, index) => {
            let parsedReceiptDate: Date;
            let parsedShiftDay: Date;

            // Check if it's already in MS Date format (e.g., from a re-paste)
            const receiptMatch = String(row.ReceiptDate).match(/\/Date\((\d+).*\)\//);
            const shiftMatch = String(row.ShiftDay).match(/\/Date\((\d+).*\)\//);

            // Parse date string or use existing MS date value
            if(receiptMatch && receiptMatch[1]) parsedReceiptDate = new Date(parseInt(receiptMatch[1]));
            else parsedReceiptDate = dateParse(row.ReceiptDate, USER_FRIENDLY_DATE_FORMAT, new Date());
            
            if(shiftMatch && shiftMatch[1]) parsedShiftDay = new Date(parseInt(shiftMatch[1]));
            else parsedShiftDay = dateParse(row.ShiftDay, USER_FRIENDLY_DATE_FORMAT, new Date());

            // Validate parsed dates
            if (isNaN(parsedReceiptDate.getTime()) || isNaN(parsedShiftDay.getTime())) {
                throw new Error(`Invalid date on row ${index + 1}. Found "${row.ReceiptDate}" or "${row.ShiftDay}". Please use format like "20 Oct 2025 02:30 PM".`);
            }
            
            // Return the object formatted for the API
            return {
                ReceiptNo: row.ReceiptNo,
                Tax: row.Tax,
                Total: row.Total,
                Type: row.Type,
                Gross: row.Gross, // Pass string | undefined
                SaleChannel: row.SaleChannel || "Store-sales", // Default if empty
                // Convert dates to required MS format
                ReceiptDate: `/Date(${parsedReceiptDate.getTime()})/`,
                ShiftDay: `/Date(${parsedShiftDay.getTime()})/`,
            };
        });
    } catch (error) { // Catch date parsing errors
        const message = error instanceof Error ? error.message : "Error parsing dates.";
        console.error("Date parsing error:", message);
        toast.error("Date Error", { description: message });
        setIsLoading(false);
        return; // Stop submission
    }
    
    console.log(`Submitting ${processedRows.length} processed rows for retailer ${values.retailerKey}`);

    // 2. Call the existing backend API
    try {
      const response = await fetch("/api/upload-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            receipts: processedRows, // Send the processed data
            retailerKey: values.retailerKey // Send the selected retailer
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "An unknown server error occurred.");

      setApiResponse(result);
      toast.success("Data submitted successfully!");
      // Reset form to a single empty row on success
      replace([createEmptyRow()]); 
      // Keep the retailer selected by resetting just that field to its current value
      form.resetField("retailerKey", { defaultValue: values.retailerKey });
    } catch (error) { // Catch errors from the fetch/API
      const message = error instanceof Error ? error.message : String(error);
      setApiError(message);
      toast.error("Submission failed", { description: message });
    } finally {
      setIsLoading(false); // Stop loading indicator
    }
  } // --- End onSubmit ---

  // --- Copy to Clipboard Function ---
  const handleCopyGrid = async () => {
    console.log("Copying grid data to clipboard...");
    try {
      // Get the current data directly from the form state
      const rows = form.getValues("rows");
      if (!rows || rows.length === 0) {
        toast.info("Grid is empty, nothing to copy.");
        return;
      }
      
      // Map the array of objects into a 2D array of strings
      // in the exact column order specified by COLUMN_KEYS
      const dataArray: string[][] = rows.map(row => 
        COLUMN_KEYS.map(key => row[key] ?? "") // Use ?? "" for safety if a key is missing
      );
      
      // Convert the 2D array into a single TSV (Tab-Separated Values) string
      const tsvString = dataArray.map(row => row.join("\t")).join("\n");
      
      // Use the modern asynchronous Clipboard API
      await navigator.clipboard.writeText(tsvString);
      
      toast.success(`Copied ${rows.length} rows to clipboard!`);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      toast.error("Failed to copy data.", { description: "Your browser might not support this feature." });
    }
  }; // --- End handleCopyGrid ---

  // --- Clear Grid Function ---
  const handleClearGrid = () => {
      replace([createEmptyRow()]); // Reset the grid to one empty row
      toast.info("Grid cleared.");
  };
  // --- End Clear Grid Function ---

  const isSuccess = apiResponse ? parseInt(apiResponse.ResultCode, 10) === 200 : false;
  const totalRows = fields.length; // Get current row count

  // --- Render Logic ---
  return (
    <Card>
      <CardHeader>
        <CardTitle>Spreadsheet Input</CardTitle>
        <CardDescription>
            Select a retailer, then either paste data from Excel/Sheets into the text box and click &quot;Parse&ldquo;, or add rows manually to the grid.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Retailer Selection */}
            <FormField
              control={form.control}
              name="retailerKey"
              render={({ field }) => (
                <FormItem className="max-w-sm">
                  <FormLabel>Retailer</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isFetchingRetailers || isLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={isFetchingRetailers ? "Loading retailers..." : "Select a retailer"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {isFetchingRetailers ? (
                            <SelectItem value="loading" disabled>Loading...</SelectItem>
                        ) : retailers.length > 0 ? (
                            retailers.map((retailer) => (
                                <SelectItem key={retailer.key} value={retailer.key}>
                                    {retailer.name}
                                </SelectItem>
                            ))
                        ) : (
                            <SelectItem value="none" disabled>No retailers found.</SelectItem>
                        )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Paste from Excel Box */}
             <FormField
                control={form.control}
                name="pasteData"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Paste from Excel/Sheets</FormLabel>
                    <FormControl>
                        <Textarea
                            {...field}
                            placeholder="Copy up to 50 rows from your spreadsheet (no headers) and paste them here..."
                            className="min-h-[120px] font-mono" // Use monospaced font
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
            <Button
                type="button"
                variant="secondary"
                onClick={handleParsePaste}
                // Disable if loading or no retailer is selected
                disabled={isLoading || isFetchingRetailers || !watch("retailerKey")}
            >
                <ClipboardPaste className="mr-2 h-4 w-4" />
                Parse Pasted Data and Populate Grid
            </Button>
            
            {/* Spreadsheet Area */}
            <div className="space-y-2">
                <Label>Manual Entry Grid (Max {MAX_ROWS} rows)</Label>
                 {/* This div NO LONGER has the onPaste handler */}
                <div className="overflow-x-auto rounded-md border">
                    <div className="p-2 min-w-[1200px]"> {/* Force horizontal scroll */}
                        {/* Header Row */}
                        <div className="flex gap-2 p-2 border-b">
                            <div className="w-10 flex-shrink-0" aria-hidden="true"></div> {/* Spacer for Remove button */}
                            {COLUMN_KEYS.map(key => (
                                // Use .replace to format name like "Receipt Date"
                                <Label key={key} className="flex-1 min-w-[150px] text-xs font-semibold">{key.replace(/([A-Z])/g, ' $1')}</Label>
                            ))}
                        </div>
                        
                        {/* Data Rows (Dynamic) */}
                        {fields.map((field, index) => (
                            <div key={field.id} className="flex items-start gap-2 py-2 border-b last:border-b-0">
                                {/* Remove Row Button */}
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="mt-2 w-10 flex-shrink-0"
                                    onClick={() => remove(index)}
                                    // Disable if loading or if it's the last row
                                    disabled={isLoading || fields.length <= 1}
                                    title={`Remove row ${index + 1}`}
                                >
                                    <XIcon className="h-4 w-4" />
                                    <span className="sr-only">Remove row {index + 1}</span>
                                </Button>
                                
                                {/* Map through the 8 input fields for this row */}
                                {COLUMN_KEYS.map(colKey => (
                                    <FormField
                                        key={field.id + colKey} // Unique key for each field
                                        control={form.control}
                                        name={`rows.${index}.${colKey}`}
                                        render={({ field: inputField, fieldState }) => (
                                            <FormItem className="flex-1 min-w-[150px]">
                                                <FormControl>
                                                    {/* Individual inputs can be typed in or pasted into */}
                                                    <Input
                                                        {...inputField}
                                                        placeholder={colKey === 'Type' ? '0 or 1' : (colKey === 'SaleChannel' ? 'Store-sales' : '...')}
                                                        // Apply red border if field has error
                                                        className={cn(fieldState.error && "border-destructive")}
                                                    />
                                                </FormControl>
                                                {/* FormMessage hidden here to save space */}
                                            </FormItem>
                                        )}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
                {/* Display errors for the 'rows' array (e.g., "min 1 row") */}
                {form.formState.errors.rows?.message && (
                    <p className="text-sm font-medium text-destructive">{form.formState.errors.rows.message}</p>
                )}
                 {form.formState.errors.rows?.root?.message && (
                    <p className="text-sm font-medium text-destructive">{form.formState.errors.rows.root.message}</p>
                 )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between items-center">
                <div className="flex gap-2"> {/* Wrapper for left-side buttons */}
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => append(createEmptyRow())} // Add a new empty row
                        disabled={isLoading || totalRows >= MAX_ROWS}
                        title={`Add row (${totalRows}/${MAX_ROWS})`}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Row
                    </Button>
                    
                    {/* Copy Button */}
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleCopyGrid} // Call the copy function
                        disabled={isLoading || totalRows === 0}
                        title="Copy grid data to clipboard"
                    >
                        <Copy className="h-4 w-4" />
                        <span className="sr-only">Copy grid data</span>
                    </Button>

                    {/* Clear Rows Button */}
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleClearGrid} // Call the new clear function
                        disabled={isLoading || totalRows <= 1} // Disable if 1 row or loading
                        title="Clear all rows"
                    >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Clear all rows</span>
                    </Button>
                </div>
                
                {/* Submit Button */}
                <Button type="submit" disabled={isLoading || !form.formState.isValid}>
                    {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Submit {totalRows} {totalRows === 1 ? "Row" : "Rows"}
                </Button>
            </div>
          </form>
        </Form>

        {/* API Response Area */}
        {apiResponse && (
            <div className="mt-8">
                <Alert variant={isSuccess ? "success" : "destructive"}>
                    {/* Use AlertCircle for both, variant handles color */}
                    <AlertCircle className="h-4 w-4" /> 
                    <AlertTitle>
                        {isSuccess ? "Submission Successful" : "Submission Failed"} (Result Code: {apiResponse.ResultCode})
                    </AlertTitle>
                    <AlertDescription className="mt-2">
                        <pre className="w-full overflow-x-auto rounded-md bg-slate-950 p-4">
                            <code className="text-white">{JSON.stringify(apiResponse, null, 2)}</code>
                        </pre>
                    </AlertDescription>
                </Alert>
            </div>
        )}
        {apiError && (
            <div className="mt-8">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Submission Failed</AlertTitle>
                    <AlertDescription>{apiError}</AlertDescription>
                </Alert>
            </div>
        )}
      </CardContent>
    </Card>
  );
}