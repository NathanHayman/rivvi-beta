import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUpIcon, Check, Loader2, X } from "lucide-react";

interface ProcessedFileData {
  totalRows?: number;
  parsedData?: {
    rows?: any[];
  };
  stats?: {
    totalRows?: number;
    invalidRows?: number;
  };
  invalidRows?: number;
}

interface UploadFileStepProps {
  file: File | null;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleFileRemove: () => void;
  isValidating: boolean;
  processedFile: ProcessedFileData | null;
}

// Improved data preview component with better variable display
const DataPreview = ({ data }: { data: ProcessedFileData }) => {
  if (!data?.parsedData?.rows?.length) return null;

  const rows = data.parsedData.rows;

  // Function to render cell value properly
  const renderCellValue = (value: any): string => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch {
        return Object.keys(value)
          .map((k) => `${k}: ${value[k]}`)
          .join(", ");
      }
    }
    return String(value);
  };

  // Function to format variable object for display
  const formatVariables = (variables: any): React.ReactNode => {
    if (!variables || typeof variables !== "object") return "—";

    return (
      <div className="flex flex-col gap-1">
        {Object.entries(variables).map(([key, value]) => (
          <div key={key} className="flex items-start gap-1">
            <span className="min-w-[80px] truncate text-xs font-medium">
              {key}:
            </span>
            <span className="break-words text-xs">
              {renderCellValue(value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="mt-4">
      <h4 className="mb-2 text-sm font-medium">Data Sample</h4>
      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/50">
            <tr>
              <th className="w-[100px] px-2 py-1.5 text-left font-medium text-muted-foreground">
                Patient ID
              </th>
              <th className="w-[140px] max-w-[140px] px-2 py-1.5 text-left font-medium text-muted-foreground">
                Patient Hash
              </th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                Variables
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 1).map((row, i) => (
              <tr key={i} className="bg-white">
                <td className="border-t px-2 py-1.5 align-top">
                  {renderCellValue(row.patientId)}
                </td>
                <td
                  className="max-w-[140px] truncate border-t px-2 py-1.5 align-top"
                  title={row.patientHash}
                >
                  {renderCellValue(row.patientHash)}
                </td>
                <td className="border-t px-2 py-1.5 align-top">
                  {formatVariables(row.variables)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 1 && (
        <div className="mt-1 text-right text-xs text-muted-foreground">
          Showing 1 of {rows.length} records
        </div>
      )}
    </div>
  );
};

const UploadFileStep = ({
  file,
  handleFileChange,
  handleFileRemove,
  isValidating,
  processedFile,
}: UploadFileStepProps) => {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-3 text-base font-medium">Upload Data File</h3>
        <p className="text-sm text-muted-foreground">
          Upload an Excel or CSV file with your patient appointment data
        </p>
      </div>

      {!file ? (
        <div className="relative">
          <Input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="border-gray-300 hover:bg-gray-50 flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-3 py-2 text-sm transition-colors"
          >
            <ArrowUpIcon className="text-gray-400 mb-2 h-8 w-8" />
            <p className="font-medium">Upload Excel or CSV file</p>
            <p className="text-xs text-muted-foreground">
              Drag and drop or click to select
            </p>
          </label>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-md border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(2)} KB
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleFileRemove}
            >
              <X className="mr-1 h-4 w-4" /> Remove
            </Button>
          </div>

          {isValidating && (
            <div className="mt-4 flex items-center space-x-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Validating file...</span>
            </div>
          )}

          {processedFile && (
            <div className="mt-4 rounded-md bg-green-50 p-3 text-green-800">
              <div className="flex">
                <Check className="h-5 w-5 text-green-500" />
                <div className="ml-3">
                  <p className="text-sm font-medium">File Validated</p>
                  <p className="mt-1 text-xs">
                    The file has been validated and is ready for upload.{" "}
                    {processedFile.stats?.totalRows ||
                      processedFile.totalRows ||
                      processedFile.parsedData?.rows?.length}{" "}
                    rows found.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Data preview component */}
          {processedFile && processedFile.parsedData && (
            <DataPreview data={processedFile} />
          )}
        </div>
      )}
    </div>
  );
};

export default UploadFileStep;
