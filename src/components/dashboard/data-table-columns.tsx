"use client"

import { ColumnDef, SortingFn, Row, Table } from "@tanstack/react-table";
import { ArrowUpDown, Copy, Trash2, Loader2 } from "lucide-react"; // 1. Import Copy icon
import { Button } from "@/components/ui/button";
import { format as formatDate } from "date-fns"; // 2. Import date-fns format
import { toast } from "sonner"; // 3. Import toast
import * as React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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

export type Receipt = {
  id: string; // Firestore document ID
  receiptId: string;
  receiptNo: string;
  receiptDate: string; // MS Date String
  shiftDay: string;    // MS Date String
  total: number;
  tax: number;
  gross: number | null;
  type: number; // 0 or 1
  createdAt: string; // ISO String from API
};

interface ReceiptTableMeta {
  refreshData: () => void; // Function to refetch data
  selectedRetailerKey: string;
}

// --- NEW: DataTableRowActions Component ---
function DataTableRowActions({ row, table }: { row: Row<Receipt>; table: Table<Receipt> }) {
  const receipt = row.original;
  // Get the refreshData function from the table's meta prop
  const meta = table.options.meta as ReceiptTableMeta; 
  // State for tracking delete operation
  const [isDeleting, setIsDeleting] = React.useState(false);

  // --- Copy for Paste Area ---
  const handleCopy = async () => {
    const receiptDate = parseMsDateString(receipt.receiptDate);
    const shiftDay = parseMsDateString(receipt.shiftDay);
    const USER_FRIENDLY_DATE_FORMAT = "dd MMM yyyy h:mm a";
    const receiptDateStr = receiptDate ? formatDate(receiptDate, USER_FRIENDLY_DATE_FORMAT) : "";
    const shiftDayStr = shiftDay ? formatDate(shiftDay, USER_FRIENDLY_DATE_FORMAT) : "";
    
    // [ReceiptDate, ReceiptNo, ShiftDay, Tax, Total, Type, Gross, SaleChannel]
    const rowData = [
      receiptDateStr,
      receipt.receiptNo,
      shiftDayStr,
      String(receipt.tax),
      String(receipt.total),
      String(receipt.type),
      String(receipt.gross ?? ""),
      "Store-sales"
    ];
    const tsvString = rowData.join("\t");
    try {
      await navigator.clipboard.writeText(tsvString);
      toast.success("Row copied to clipboard!", { description: "You can now paste this into the 'Paste from Excel' box."});
    } catch (err) { toast.error("Failed to copy data."); }
  };

  const queryParams = new URLSearchParams();

  // --- Delete Function ---
  const handleDelete = async () => {
    const retailerKey = meta.selectedRetailerKey;
    setIsDeleting(true);
    try {
      const response = await fetch("/api/delete-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          retailerKey: retailerKey,
          docId: receipt.id, // 'id' is the Firestore document ID
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to delete from server.");
      }
      
      toast.success(`Receipt ${receipt.receiptNo} deleted successfully.`);
      // Call the refreshData function passed down from the page
      if (meta.refreshData) {
        meta.refreshData(); 
      } else {
        console.warn("meta.refreshData() is not defined. Table will not auto-refresh.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred.";
      console.error("Delete failed:", error);
      toast.error("Delete failed", { description: message });
    } finally {
      setIsDeleting(false);
      // Dialog will close itself on action
    }
  };

  // --- Render the buttons ---
  return (
    <AlertDialog>
      <div className="flex gap-0">
          {/* Copy Button */}
          <Button variant="ghost" size="icon" title="Copy for Pasting" onClick={handleCopy} disabled={isDeleting}>
            <Copy className="h-4 w-4" />
            <span className="sr-only">Copy Row</span>
          </Button>
          {/* Delete Button (Triggers Dialog) */}
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" title="Delete Receipt" className="text-destructive hover:text-destructive" disabled={isDeleting}>
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Delete</span>
            </Button>
          </AlertDialogTrigger>
      </div>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the receipt
            <b className="mx-1">({receipt.receiptNo})</b>
            from the database.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
// --- END NEW COMPONENT ---

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
  // Tax (VAT)
  {
    accessorKey: "tax",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="text-center w-full justify-end" >
        Tax (VAT) <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => ( <div className="text-center">{formatCurrency(row.getValue("tax"))}</div> ),
  },
  // Total (Net)
  {
    accessorKey: "total",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="text-center w-full justify-end" >
        Total (Net) <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => ( <div className="text-center">{formatCurrency(row.getValue("total"))}</div> ),
  },
  // Transaction Type
  {
    accessorKey: "type",
    header: ({ column }) => (
      <Button variant="ghost" className="text-center" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Type <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <div className="text-center">{row.getValue("type") === 1 ? "Return" : "Sale"}</div>,
  },
  // Gross Total
  {
    accessorKey: "gross",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="text-center w-full justify-end" >
        Gross Total <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => ( <div className="text-center">{formatCurrency(row.getValue("gross"))}</div> ),
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
    cell: ({ row, table }) => (
      <DataTableRowActions row={row} table={table} />
    ),
    enableSorting: false,
    enableHiding: false,
  },
];