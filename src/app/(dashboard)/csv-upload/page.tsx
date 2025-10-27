"use client";

import CsvUploader from "@/components/dashboard/csv-uploader";

export default function CsvUploadPage() {
  return (
    <div>
        <h1 className="text-3xl font-bold tracking-tight mb-4">Upload Daily Sales</h1>
        <p className="text-muted-foreground mb-6">
            Upload a CSV file containing the daily sales receipts. Please ensure the format matches the provided template.
        </p>
        <CsvUploader />
    </div>
  );
}