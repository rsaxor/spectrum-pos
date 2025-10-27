import ExportForm from "@/components/dashboard/export-form";

export default function ExportDataPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight mb-4">
        Export Receipt Data
      </h1>
      <p className="text-muted-foreground mb-6">
        Select a retailer and optionally filter by month and year to download
        submitted transaction data as a CSV file.
      </p>
      <ExportForm />
    </div>
  );
}