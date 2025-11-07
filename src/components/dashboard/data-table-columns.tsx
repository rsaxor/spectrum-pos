"use client"

import { ColumnDef, SortingFn } from "@tanstack/react-table";
import { ArrowUpDown, Copy } from "lucide-react"; // 1. Import Copy icon
import { Button } from "@/components/ui/button";
import { format as formatDate } from "date-fns"; // 2. Import date-fns format
import { toast } from "sonner"; // 3. Import toast

// --- Helpers ---

// Parse MS Date string (e.g. '/Date(123...)/') to JS Date object or null
const parseMsDateString = (msDateString?: string | null): Date | null => {
  if (!msDateString) return null;
  const match = msDateString.match(/\/Date\((-?\d+)(?:[+-]\d+)?\)\//);
  if (match?.[1]) {
    const ms = Number(match[1]);
    if (!isNaN(ms)) return new Date(ms);
  }
  console.warn(`Could not parse MS Date string: ${msDateString}`);
  return null;
};

// Format MS Date string for display in UI (GST timezone, en-US)
const formatMsDateString = (msDateString?: string | null): string => {
  const date = parseMsDateString(msDateString);
  if (date) {
    try {
      return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Dubai",
      }).format(date);
    } catch (e) {
      console.error("Error formatting date:", e);
      return "Invalid Date";
    }
  }
  return msDateString ? "Invalid Format" : "N/A";
};

// Format ISO date string
const formatIsoDateString = (isoString?: string): string => {
  if (!isoString) return "N/A";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "Invalid Date";
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Dubai",
    }).format(date);
  } catch (e) {
    console.error("Error formatting ISO date string:", e);
    return "Invalid Date";
  }
};

// Format currency
const formatCurrency = (amount: number | string | null | undefined): string => {
  const num = typeof amount === "number" ? amount : Number(amount ?? 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "AED" }).format(num);
};

// --- Custom Sorting for MS Date Strings ---
const msDateSortingFn: SortingFn<Receipt> = (rowA, rowB, columnId) => {
  const dateA = parseMsDateString(rowA.getValue(columnId));
  const dateB = parseMsDateString(rowB.getValue(columnId));
  if (dateA === null && dateB === null) return 0;
  if (dateA === null) return 1;
  if (dateB === null) return -1;
  return dateA.getTime() - dateB.getTime();
};

// --- Types ---
export type Receipt = {
  id: string;
  receiptId: string;
  receiptNo: string;
  receiptDate: string;
  shiftDay: string;
  total: number;
  tax: number;
  gross: number | null;
  type: number;
  createdAt: string;
  retailerKey: string;
  saleChannel: string;
};

// --- Columns ---
export const columns: ColumnDef<Receipt>[] = [
  // Receipt / Invoice No.
  {
    accessorKey: "receiptNo",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Receipt / Invoice No. <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <div>{row.getValue("receiptNo")}</div>,
  },
  // Receipt Date
  {
    accessorKey: "receiptDate",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Receipt Date (GST) <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <div>{formatMsDateString(row.getValue("receiptDate") as string)}</div>,
    enableSorting: true,
    sortingFn: msDateSortingFn,
    filterFn: (row, columnId, filterValue) => {
      const dateString = row.getValue(columnId) as string;
      const date = parseMsDateString(dateString);
      if (!date) return false;
      const [filterMonth, filterYear] = filterValue as [number | null, number | null];
      const rowMonth = date.getMonth();
      const rowYear = date.getFullYear();
      const monthMatch = filterMonth === null || rowMonth === filterMonth;
      const yearMatch = filterYear === null || rowYear === filterYear;
      return monthMatch && yearMatch;
    },
  },
  // Shift Day
  {
    accessorKey: "shiftDay",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Shift Day (GST) <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <div>{formatMsDateString(row.getValue("shiftDay") as string)}</div>,
    enableSorting: true,
    sortingFn: msDateSortingFn,
  },
  // Transaction Type
  {
    accessorKey: "type",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Type <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <div>{row.getValue("type") === 1 ? "Return" : "Sale"}</div>,
  },
  // Total (Net)
  {
    accessorKey: "total",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="text-right w-full justify-end" >
        Total (Net) <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => ( <div className="text-right">{formatCurrency(row.getValue("total"))}</div> ),
  },
  // Tax (VAT)
  {
    accessorKey: "tax",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="text-right w-full justify-end" >
        Tax (VAT) <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => ( <div className="text-right">{formatCurrency(row.getValue("tax"))}</div> ),
  },
  // Gross Total
  {
    accessorKey: "gross",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="text-right w-full justify-end" >
        Gross Total <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => ( <div className="text-right">{formatCurrency(row.getValue("gross"))}</div> ),
  },
  // Submission Timestamp
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Submitted At <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => ( <div>{formatIsoDateString(row.getValue("createdAt") as string)}</div> ),
    enableSorting: true,
  },

  // ACTION COLUMN
  {
    id: "actions",
    header: "Action",
    cell: ({ row }) => {
      const receipt = row.original; // This is the full Receipt object

      // This is the user-friendly format the spreadsheet form's parser expects
      const USER_FRIENDLY_DATE_FORMAT = "dd MMM yyyy h:mm a";

      const handleCopy = async () => {
        // 1. Format dates back to the user-friendly string format
        const receiptDate = parseMsDateString(receipt.receiptDate);
        const shiftDay = parseMsDateString(receipt.shiftDay);
        
        const receiptDateStr = receiptDate ? formatDate(receiptDate, USER_FRIENDLY_DATE_FORMAT) : "";
        const shiftDayStr = shiftDay ? formatDate(shiftDay, USER_FRIENDLY_DATE_FORMAT) : "";

        // 2. Define the 8 columns IN THE CORRECT ORDER for the spreadsheet form
        // [ReceiptDate, ReceiptNo, ShiftDay, Tax, Total, Type, Gross, SaleChannel]
        const rowData = [
          receiptDateStr,                   // ReceiptDate
          receipt.receiptNo,                // ReceiptNo
          shiftDayStr,                      // ShiftDay
          String(receipt.tax),              // Tax
          String(receipt.total),            // Total
          String(receipt.type),             // Type
          String(receipt.gross ?? ""),      // Gross (send empty string for null)
          receipt.saleChannel ?? "Store-sales" // SaleChannel
        ];

        // 3. Create Tab-Separated (TSV) string
        const tsvString = rowData.join("\t");

        // 4. Copy to clipboard
        try {
          await navigator.clipboard.writeText(tsvString);
          toast.success("Row copied to clipboard!", { description: "You can now paste this into the 'Paste from Excel' box."});
        } catch (err) {
          console.error("Copy failed:", err);
          toast.error("Failed to copy data.");
        }
      };

      return (
        <Button variant="ghost" size="icon" title="Copy for Pasting" onClick={handleCopy}>
          <Copy className="h-4 w-4" />
          <span className="sr-only">Copy Row</span>
        </Button>
      );
    },
    enableSorting: false,
    enableHiding: false,
  },
];