import ManualForm from "@/components/dashboard/manual-form";

export default function ManualInputPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight mb-4">
        Manual POS Input
      </h1>
      <p className="text-muted-foreground mb-6">
        Enter the details for a single sales transaction below. This will be sent
        to the same processing service as the CSV upload.
      </p>
      <ManualForm />
    </div>
  );
}