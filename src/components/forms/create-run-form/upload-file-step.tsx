import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUpIcon, Check, Loader2, X } from "lucide-react";

interface ProcessedFileData {
  totalRows?: number;
  parsedData?: {
    rows?: any[];
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

// Add a component for data preview with scrollable overflow
const DataPreview = ({ data }: { data: ProcessedFileData }) => {
  if (
    !data ||
    !data.parsedData ||
    !data.parsedData.rows ||
    data.parsedData.rows.length === 0
  ) {
    return null;
  }

  // Get column headers from first row
  const firstRow = data.parsedData.rows[0];
  const headers = Object.keys(firstRow);

  // Limit to 5 rows for preview
  const previewRows = data.parsedData.rows.slice(0, 5);

  return (
    <div className="mt-4">
      <h3 className="mb-2 text-sm font-medium">Data Preview</h3>
      <div className="overflow-hidden rounded-md border">
        <div className="max-h-[250px] overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/50">
              <tr>
                {headers.map((header) => (
                  <th
                    key={header}
                    className="px-3 py-2 text-left font-medium text-muted-foreground"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className={rowIndex % 2 === 0 ? "bg-white" : "bg-muted/20"}
                >
                  {headers.map((header) => (
                    <td
                      key={`${rowIndex}-${header}`}
                      className="border-t px-3 py-2"
                    >
                      {typeof row[header] === "object"
                        ? JSON.stringify(row[header])
                        : row[header]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.parsedData.rows.length > 5 && (
          <div className="border-t bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Showing 5 of {data.parsedData.rows.length} rows
          </div>
        )}
      </div>
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
    <>
      <>
        <div className="space-y-6">
          <div>
            <h3 className="mb-2 text-base font-medium">Data File</h3>
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
                  className="border-gray-300 hover:bg-gray-50 flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-3 py-2 text-sm"
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
                          {processedFile.totalRows ||
                            processedFile.parsedData?.rows?.length}{" "}
                          rows found.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Add the data preview component */}
                {processedFile && processedFile.parsedData && (
                  <DataPreview data={processedFile} />
                )}
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Upload an Excel or CSV file with your patient appointment data
            </p>
          </div>
        </div>
      </>
    </>
  );
};

export default UploadFileStep;
