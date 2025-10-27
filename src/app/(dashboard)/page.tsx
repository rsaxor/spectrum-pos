"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
// Import FileDown icon
import { UploadCloud, Keyboard, Database, FileDown, Loader2 } from "lucide-react";
import { useAuth } from "@/context/auth-provider";

export default function DashboardHomePage() {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className=" font-bold tracking-tight text-md md:text-3xl">
          Welcome, {user.email}
        </h1>
        <p className="text-muted-foreground text-sm md:text-lg">
          Select a feature below to get started.
        </p>
      </div>

      {/* Feature Shortcut Buttons */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/csv-upload">
          <Card className="h-full transform transition-all hover:-translate-y-1 hover:border-primary hover:bg-accent">
            <CardContent className="flex flex-col items-center justify-center p-6 text-center">
              <UploadCloud className="mb-4 h-12 w-12 text-primary" />
              <h2 className="text-lg font-semibold">CSV Upload</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Process a batch of sales transactions by uploading a CSV file.
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/manual-input">
          <Card className="h-full transform transition-all hover:-translate-y-1 hover:border-primary hover:bg-accent">
            <CardContent className="flex flex-col items-center justify-center p-6 text-center">
              <Keyboard className="mb-4 h-12 w-12 text-primary" />
              <h2 className="text-lg font-semibold">Manual POS Input</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter a single sales receipt or return using a simple form.
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/view-data">
          <Card className="h-full transform transition-all hover:-translate-y-1 hover:border-primary hover:bg-accent">
            <CardContent className="flex flex-col items-center justify-center p-6 text-center">
              <Database className="mb-4 h-12 w-12 text-primary" />
              <h2 className="text-lg font-semibold">View Collection</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Search, sort, and view all the sales data stored in the database.
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/export-data">
          <Card className="h-full transform transition-all hover:-translate-y-1 hover:border-primary hover:bg-accent">
            <CardContent className="flex flex-col items-center justify-center p-6 text-center">
              <FileDown className="mb-4 h-12 w-12 text-primary" />
              <h2 className="text-lg font-semibold">Export Data</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Download submitted receipt data as a CSV file, with optional date filtering.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}