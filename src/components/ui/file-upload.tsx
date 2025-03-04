"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, Upload, X } from "lucide-react";
import { useState } from "react";

interface FileUploadProps {
  onFileUpload: (file: File) => Promise<void>;
  accept?: string;
  maxSize?: number; // in MB
  className?: string;
}

export function FileUpload({
  onFileUpload,
  accept = ".csv,.xlsx,.xls",
  maxSize = 10, // Default 10MB
  className,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setError(null);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await processFile(files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = e.target.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  };

  const processFile = async (file: File) => {
    // Check file type
    const fileType = file.name.split(".").pop()?.toLowerCase() || "";
    const acceptedTypes = accept
      .split(",")
      .map((type) => (type.startsWith(".") ? type.substring(1) : type));

    if (!acceptedTypes.includes(fileType)) {
      setError(`Invalid file type. Accepted types: ${accept}`);
      return;
    }

    // Check file size
    if (file.size > maxSize * 1024 * 1024) {
      setError(`File size exceeds the maximum limit of ${maxSize}MB`);
      return;
    }

    try {
      setIsUploading(true);
      await onFileUpload(file);
    } catch (err) {
      setError("Failed to upload file. Please try again.");
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-md border border-dashed p-6",
        isDragging ? "border-primary bg-primary/5" : "border-border",
        className,
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center gap-2">
        {isUploading ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Uploading file...</p>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Drag & drop or click to upload
            </p>
            <input
              type="file"
              className="hidden"
              id="file-upload-input"
              accept={accept}
              onChange={handleFileChange}
            />
            <label htmlFor="file-upload-input">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
              >
                Select File
              </Button>
            </label>
            <p className="mt-1 text-xs text-muted-foreground">
              Max file size: {maxSize}MB
            </p>
          </>
        )}

        {error && (
          <div className="mt-2 flex items-center gap-1 text-sm text-destructive">
            <X className="h-4 w-4" />
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
