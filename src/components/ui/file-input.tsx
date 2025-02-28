"use client";

// src/components/ui/file-input.tsx
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { forwardRef, ReactNode, useRef, useState } from "react";

interface FileInputProps {
  accept?: string;
  placeholder?: string;
  value?: File | null;
  icon?: ReactNode;
  disabled?: boolean;
  onChange: (file: File | null) => void;
  className?: string;
}

export const FileInput = forwardRef<HTMLInputElement, FileInputProps>(
  (
    {
      accept,
      placeholder = "Choose a file",
      value,
      icon,
      disabled = false,
      onChange,
      className,
      ...props
    },
    ref,
  ) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleClick = () => {
      if (!disabled) {
        inputRef.current?.click();
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onChange(files[0] || null);
      }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (!disabled) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = () => {
      setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        // Check if the file matches the accepted types
        if (accept) {
          const fileExtension = files[0]?.name.split(".").pop()?.toLowerCase();
          const acceptedTypes = accept
            .split(",")
            .map((type) => type.trim().toLowerCase().replace("*", ""));

          const isAccepted = acceptedTypes.some((type) => {
            if (type.startsWith(".")) {
              return `.${fileExtension}` === type;
            } else {
              return files[0]?.type.includes(type);
            }
          });

          if (!isAccepted) {
            // TODO: Consider adding an error message here
            return;
          }
        }

        onChange(files[0] || null);
      }
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(null);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    };

    return (
      <div
        className={cn(
          "relative flex flex-col items-center justify-center",
          className,
        )}
      >
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-700/30 flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors",
            isDragging &&
              "border-primary bg-primary/5 dark:border-primary/70 dark:bg-primary/10",
            value &&
              "border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20",
            disabled && "cursor-not-allowed opacity-60",
            "relative",
          )}
        >
          {value ? (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center justify-center rounded-full bg-green-100 p-2 text-green-500 dark:bg-green-900/30 dark:text-green-400">
                {icon || (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <div className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium">
                {value.name}
              </div>
              <div className="text-gray-500 dark:text-gray-400 text-xs">
                {(value.size / 1024 / 1024).toFixed(2)} MB
              </div>
              {!disabled && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-500 dark:bg-gray-800 dark:text-gray-400 absolute right-2 top-2 h-6 w-6 rounded-full bg-white p-1 shadow-sm hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                  onClick={handleClear}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Clear</span>
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center gap-2">
                <div className="bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 rounded-full p-2">
                  {icon || (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <div className="text-sm font-medium">{placeholder}</div>
                <div className="text-gray-500 dark:text-gray-400 text-xs">
                  {isDragging ? "Drop to upload" : "Click or drag and drop"}
                </div>
              </div>
            </>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          disabled={disabled}
          onChange={handleChange}
          {...props}
        />
      </div>
    );
  },
);

FileInput.displayName = "FileInput";
