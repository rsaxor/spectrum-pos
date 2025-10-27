"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"

export type Receipt = {
  id: string; // Firestore document ID
  receiptId: string;
  receiptNo: string;
  receiptDate: string; // Stored as MS Date string
  shiftDay: string;    // Stored as MS Date string
  total: number;
  tax: number;
  gross: number | null;
  type: number; // 0 or 1
  createdAt: string; // Expect ISO string from API
}

export const columns: ColumnDef<Receipt>[] = [
   {
    accessorKey: "createdAt",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Submitted At
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
        const isoString = row.getValue("createdAt") as string | undefined;
        if (!isoString) return "N/A";
         try {
             const date = new Date(isoString); // Parse ISO string
             // Check if date is valid after parsing
             if (isNaN(date.getTime())) return "Invalid Date";
             return <div>{new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dubai' }).format(date)}</div>;
         } catch(e) {
             console.error("Error formatting createdAt ISO string:", e);
             return "Invalid Date";
         }
    },
    enableSorting: true,
  },
]

// const formatMsDateString = (msDateString: string | undefined | null): string => { ... };