"use client";

import { Button } from "@/components/ui/button";
import { runSqlMigration } from "@/server/actions/db/migrate";
import { useState } from "react";

export default function MigratePage() {
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleRunMigration = async () => {
    setIsLoading(true);
    try {
      const migrationResult = await runSqlMigration(
        "add_metadata_to_agent_variation.sql",
      );
      setResult(migrationResult);
    } catch (error) {
      setResult({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-10">
      <h1 className="mb-6 text-2xl font-bold">Database Migration</h1>

      <div className="space-y-6">
        <div className="rounded-md border p-4">
          <h2 className="mb-2 text-lg font-medium">
            Add Metadata to Agent Variation
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            This migration adds a JSONB metadata column to the
            rivvi_agent_variation table to store structured information about
            prompt variations.
          </p>

          <Button onClick={handleRunMigration} disabled={isLoading}>
            {isLoading ? "Running Migration..." : "Run Migration"}
          </Button>
        </div>

        {result && (
          <div
            className={`rounded-md border p-4 ${result.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}
          >
            <h3
              className={`font-medium ${result.success ? "text-green-700" : "text-red-700"}`}
            >
              {result.success ? "Success" : "Error"}
            </h3>
            <p className="mt-1 text-sm">{result.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
