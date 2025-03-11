import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUpIcon, CheckCircle, Loader2, X } from "lucide-react";

interface ProcessedFileData {
  totalRows?: number;
  parsedData?: {
    rows?: any[];
    headers?: string[];
  };
  stats?: {
    totalRows?: number;
    validRows?: number;
    invalidRows?: number;
  };
}

interface UploadFileStepProps {
  file: File | null;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleFileRemove: () => void;
  isValidating: boolean;
  processedFile: ProcessedFileData | null;
}

const UploadFileStep = ({
  file,
  handleFileChange,
  handleFileRemove,
  isValidating,
  processedFile,
}: UploadFileStepProps) => {
  // Function to render a data preview row
  const renderDataRow = (row: any) => {
    if (!row) return null;

    // Extract key information for display
    const patientId = row.patientId || "—";
    const patientHash = row.patientHash || "—";

    // Handle variables display
    let variables: React.ReactNode = "—";
    if (row.variables && typeof row.variables === "object") {
      const variableEntries = Object.entries(row.variables);
      if (variableEntries.length > 0) {
        variables = (
          <div className="space-y-1">
            {variableEntries.slice(0, 3).map(([key, value]) => (
              <div key={key} className="flex gap-2">
                <span className="min-w-[80px] truncate text-xs font-medium text-muted-foreground">
                  {key}:
                </span>
                <span className="truncate text-xs">{String(value)}</span>
              </div>
            ))}
            {variableEntries.length > 3 && (
              <div className="text-xs text-muted-foreground">
                +{variableEntries.length - 3} more fields
              </div>
            )}
          </div>
        );
      }
    }

    return (
      <div className="rounded-md border bg-background p-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <div className="mb-1 text-xs text-muted-foreground">Patient ID</div>
            <div className="truncate text-sm font-medium">{patientId}</div>
          </div>
          <div>
            <div className="mb-1 text-xs text-muted-foreground">
              Patient Hash
            </div>
            <div className="truncate font-mono text-xs">{patientHash}</div>
          </div>
          <div>
            <div className="mb-1 text-xs text-muted-foreground">Variables</div>
            {variables}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-lg font-medium">Upload Data File</h3>
        <p className="text-sm text-muted-foreground">
          Upload an Excel or CSV file with your patient appointment data
        </p>
      </div>

      {!file ? (
        <div className="transition-all duration-300">
          <Input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="flex h-40 w-full cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed transition-all duration-200 hover:border-primary/30 hover:bg-primary/5"
          >
            <div className="flex flex-col items-center justify-center gap-2 text-center">
              <ArrowUpIcon className="h-10 w-10 text-muted-foreground/50" />
              <div>
                <p className="font-medium text-muted-foreground">
                  Upload Excel or CSV file
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Drag and drop or click to select
                </p>
              </div>
            </div>
          </label>
        </div>
      ) : (
        <div className="space-y-4 transition-all duration-300 animate-in fade-in-50 slide-in-from-bottom-5">
          <div className="flex items-center justify-between rounded-md border bg-background p-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-primary/10 p-2">
                  <svg
                    className="h-6 w-6 text-primary"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleFileRemove}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="mr-1 h-4 w-4" />
              Remove
            </Button>
          </div>

          {isValidating && (
            <div className="flex items-center gap-2 rounded-md border bg-amber-50 p-4 dark:bg-amber-950/20">
              <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
              <span className="text-sm text-amber-700 dark:text-amber-400">
                Validating file...
              </span>
            </div>
          )}

          {processedFile &&
            processedFile.stats &&
            processedFile.stats.totalRows && (
              <div className="rounded-md border bg-green-50 p-4 duration-300 animate-in fade-in-50 dark:bg-green-950/20">
                <div className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-5 w-5 text-green-500" />
                  <div className="space-y-2">
                    <div>
                      <h4 className="font-medium text-green-700 dark:text-green-400">
                        File Validated
                      </h4>
                      <p className="text-sm text-green-600 dark:text-green-500">
                        Found{" "}
                        {processedFile.stats.totalRows ||
                          processedFile.parsedData?.rows?.length}{" "}
                        records ready for processing.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 pt-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Total rows:
                        </span>
                        <span className="font-medium">
                          {processedFile.stats.totalRows}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Valid rows:
                        </span>
                        <span className="font-medium text-green-600">
                          {processedFile.stats.validRows}
                        </span>
                      </div>
                      {processedFile.stats.invalidRows &&
                        processedFile.stats.invalidRows > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Invalid rows:
                            </span>
                            <span className="font-medium text-amber-600">
                              {processedFile.stats.invalidRows}
                            </span>
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              </div>
            )}

          {/* Data preview for first row */}
          {processedFile &&
            processedFile.parsedData &&
            processedFile.parsedData.rows &&
            processedFile.parsedData.rows.length > 0 && (
              <div className="delay-200 duration-300 animate-in fade-in-50 slide-in-from-bottom-5">
                <h4 className="mb-2 text-sm font-medium">Data Preview</h4>
                {renderDataRow(processedFile.parsedData.rows[0])}

                {processedFile.parsedData.rows.length > 1 && (
                  <div className="mt-2 flex justify-end">
                    <span className="text-xs text-muted-foreground">
                      Showing 1 of {processedFile.parsedData.rows.length}{" "}
                      records
                    </span>
                  </div>
                )}
              </div>
            )}
        </div>
      )}
    </div>
  );
};

export default UploadFileStep;
