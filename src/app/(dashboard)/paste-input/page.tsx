// src/app/(dashboard)/paste-input/page.tsx

import { SpreadsheetForm } from "@/components/dashboard/spreadsheet-form";

export default function PasteInputPage() {
  return (
    <div className="container mx-auto py-10">
       <h1 className="text-3xl font-bold tracking-tight mb-4">
        Spreadsheet Paste / Manual Entry
      </h1>
      <p className="text-muted-foreground mb-6">
        Select a retailer, then either add rows manually (use &quot;Add Row&ldquo;) or paste a block of data (up to 50 rows) from Excel/Sheets directly onto the form.
      </p>
      <SpreadsheetForm />
    </div>
  );
}