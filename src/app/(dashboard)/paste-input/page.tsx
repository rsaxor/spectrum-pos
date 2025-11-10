"use client";

import { Suspense } from "react";
import { SpreadsheetForm } from "@/components/dashboard/spreadsheet-form";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

function SpreadsheetLoadingFallback() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Spreadsheet Input</CardTitle>
        <CardDescription>
          Loading form...
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-center p-12">
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  )
}

export default function PasteInputPage() {
  return (
    <div className="container mx-auto py-10">
       <h1 className="text-3xl font-bold tracking-tight mb-4">
        Spreadsheet Paste / Manual Entry
      </h1>
      <p className="text-muted-foreground mb-2">
        {/* Use &quot; for quotes to fix ESLint error */}
        Select a retailer, then either add rows manually (use &quot;Add Row&quot;) or paste a block of data (up to 50 rows) from Excel/Sheets directly onto the form.
      </p>
      <div className="mb-5">
        <p className="m-0 text-muted-foreground text-sm font-medium ">
          Download the <a href="/pos-sales-template.xlsx" download className="text-primary hover:underline uppercase"><b>pos-sales-template.xlsx</b></a> template file.
        </p>
      </div>

      {/* 5. Wrap the form in the Suspense boundary with the fallback */}
      <Suspense fallback={<SpreadsheetLoadingFallback />}>
        <SpreadsheetForm />
      </Suspense>
    </div>
  );
}