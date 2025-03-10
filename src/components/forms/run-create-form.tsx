"use client";

import type React from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { ArrowUpIcon, Check, ChevronRight, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useUploadFile } from "@/hooks/runs/use-files";
import { useCreateRun } from "@/hooks/runs/use-runs";
import { cn } from "@/lib/utils";
import { validateData } from "@/server/actions/runs";
import { format } from "date-fns";

// Define the form schema for creating a run
const runFormSchema = z.object({
  name: z.string().min(1, "Run name is required"),
  file: z.instanceof(File).optional(),
  variationNotes: z.string().optional(),
  promptVersion: z.number().optional(),
  customPrompt: z.string().optional(),
  customVoicemailMessage: z.string().optional(),
  naturalLanguageInput: z.string().optional(),
  scheduleForLater: z.boolean().default(false),
  scheduledDate: z.date().optional().nullable(),
  scheduledTime: z.string().optional(),
  aiGenerated: z.boolean().default(false),
});

// Define types for the streamed data
type StreamedMetadata = {
  suggestedRunName?: string;
  summary?: string;
  metadata?: {
    categories?: string[];
    tags?: string[];
    keyChanges?: string[];
    toneShift?: string;
    focusArea?: string;
    promptLength?: {
      before: number;
      after: number;
      difference: number;
    };
  };
};

// Define a proper interface for the processed file data
interface ProcessedFileData {
  totalRows?: number;
  parsedData?: {
    rows?: any[];
  };
  invalidRows?: number;
}

export type RunFormValues = z.infer<typeof runFormSchema>;

export interface RunCreateFormProps {
  campaignId: string;
  onSuccess?: (runId?: string) => void;
  onCancel?: () => void;
  defaultValues?: Partial<RunFormValues>;
  campaignBasePrompt?: string;
  campaignVoicemailMessage?: string;
  campaignName?: string;
  campaignDescription?: string;
  onFormSuccess?: () => void;
}

// Add typing cursor animation for streaming text effect
const TypingAnimation = () => (
  <span className="ml-1 inline-block h-4 w-1.5 animate-pulse bg-blue-600"></span>
);

// Component to display structured metadata with streaming effect
function VariationMetadata({
  metadata,
}: {
  metadata: StreamedMetadata["metadata"];
}) {
  if (!metadata) return null;

  // Track whether this is the first render to add entrance animations
  const [hasRendered, setHasRendered] = useState(false);
  useEffect(() => {
    if (!hasRendered) {
      setHasRendered(true);
    }
  }, [hasRendered]);

  return (
    <div className="space-y-4 duration-300 animate-in fade-in-50">
      {/* Categories */}
      {metadata.categories && metadata.categories.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Categories
          </p>
          <div className="flex flex-wrap gap-1">
            {metadata.categories.map((category, idx) => (
              <Badge
                key={category}
                variant="outline"
                className="transition-all animate-in fade-in-50 zoom-in-95"
                style={{
                  animationDelay: `${idx * 150}ms`,
                  animationDuration: "0.5s",
                }}
              >
                {category}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {metadata.tags && metadata.tags.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Tags</p>
          <div className="flex flex-wrap gap-1">
            {metadata.tags.map((tag, idx) => (
              <Badge
                key={tag}
                variant="secondary"
                className="bg-blue-50 text-blue-600 transition-all animate-in fade-in-50 zoom-in-95 hover:bg-blue-100"
                style={{
                  animationDelay: `${idx * 120}ms`,
                  animationDuration: "0.5s",
                }}
              >
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Key Changes */}
      {metadata.keyChanges && metadata.keyChanges.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Key Changes
          </p>
          <ul className="space-y-1 text-sm">
            {metadata.keyChanges.map((change, idx) => (
              <li
                key={idx}
                className="animate-in slide-in-from-left-5"
                style={{
                  animationDelay: `${idx * 180}ms`,
                  animationDuration: "0.6s",
                }}
              >
                • {change}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Other metadata fields */}
      {metadata.toneShift && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Tone Shift
          </p>
          <p className="text-sm animate-in fade-in-50">
            {metadata.toneShift}
            {!hasRendered && <TypingAnimation />}
          </p>
        </div>
      )}

      {metadata.focusArea && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Focus Area
          </p>
          <p className="text-sm animate-in fade-in-50">
            {metadata.focusArea}
            {!hasRendered && <TypingAnimation />}
          </p>
        </div>
      )}

      {/* Prompt length changes */}
      {metadata.promptLength && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Prompt Length
          </p>
          <div className="flex items-center space-x-2">
            <p className="text-sm">
              {metadata.promptLength.before} → {metadata.promptLength.after}{" "}
              chars
            </p>
            <span
              className={`text-xs ${metadata.promptLength.difference > 0 ? "text-green-500" : "text-amber-500"} animate-in fade-in-50`}
            >
              ({metadata.promptLength.difference > 0 ? "+" : ""}
              {metadata.promptLength.difference})
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryDisplay({ summary }: { summary?: string }) {
  if (!summary) return null;

  // Split summary by newlines or bullet points to create a list
  const summaryLines = summary
    .split(/\n|•/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // If summary doesn't have natural breaks, just show as a paragraph
  if (summaryLines.length <= 1) {
    return (
      <div className="rounded-lg border bg-blue-50/80 p-4 duration-300 animate-in fade-in-50">
        <p className="mb-2 text-sm font-medium text-blue-900">
          Summary of Changes
        </p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-blue-800">
          {summary}
        </p>
      </div>
    );
  }

  // Otherwise, format as a list for better readability
  return (
    <div className="rounded-lg border bg-blue-50/80 p-4 duration-300 animate-in fade-in-50">
      <p className="mb-2 text-sm font-medium text-blue-900">
        Summary of Changes
      </p>
      <ul className="space-y-1 text-sm text-blue-800">
        {summaryLines.map((line, idx) => (
          <li
            key={idx}
            className="duration-300 animate-in slide-in-from-left-5"
            style={{
              animationDelay: `${idx * 120}ms`,
              opacity: 1, // Full opacity for completed lines
            }}
          >
            • {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Add a component for displaying the streaming generation UI
function StreamingGenerationUI({
  isGenerating,
  isComplete,
  currentTask,
  metadata,
  summary,
}: {
  isGenerating: boolean;
  isComplete: boolean;
  currentTask: string;
  metadata?: StreamedMetadata["metadata"];
  summary?: string;
}) {
  const [displayedTask, setDisplayedTask] = useState(currentTask);
  const [fadingIn, setFadingIn] = useState(false);

  // Update the displayed task with a smooth transition
  useEffect(() => {
    if (currentTask && currentTask !== displayedTask) {
      setFadingIn(true);
      const timer = setTimeout(() => {
        setDisplayedTask(currentTask);
        setFadingIn(false);
      }, 150); // Short delay for transition effect
      return () => clearTimeout(timer);
    }
  }, [currentTask, displayedTask]);

  if (!isGenerating && !isComplete) {
    return null;
  }

  // Generate skeleton UI for streaming data
  const renderSkeleton = () => {
    return (
      <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg border bg-muted/30 p-4 duration-300 animate-in fade-in-50 md:grid-cols-2">
        {/* Categories skeleton */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Categories
          </p>
          <div className="flex flex-wrap gap-1">
            {[1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="h-6 w-16 animate-pulse rounded-full bg-muted"
              />
            ))}
          </div>
        </div>

        {/* Tags skeleton */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Tags</p>
          <div className="flex flex-wrap gap-1">
            {[1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className="h-6 w-14 animate-pulse rounded-full bg-muted"
              />
            ))}
          </div>
        </div>

        {/* Key Changes skeleton */}
        <div className="col-span-1 space-y-1 md:col-span-2">
          <p className="text-xs font-medium text-muted-foreground">
            Key Changes
          </p>
          <ul className="space-y-2 text-sm">
            {[1, 2, 3].map((idx) => (
              <li key={idx} className="flex items-center space-x-2">
                <span>•</span>
                <div className="h-4 w-full animate-pulse rounded bg-muted" />
              </li>
            ))}
          </ul>
        </div>

        {/* Tone Shift skeleton */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Tone Shift
          </p>
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
        </div>

        {/* Focus Area skeleton */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Focus Area
          </p>
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
        </div>

        {/* Prompt Length skeleton */}
        <div className="col-span-1 space-y-1 md:col-span-2">
          <p className="text-xs font-medium text-muted-foreground">
            Prompt Length
          </p>
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  };

  // Summary skeleton
  const renderSummarySkeleton = () => {
    return (
      <div className="rounded-lg border bg-blue-50/80 p-4 duration-300 animate-in fade-in-50">
        <p className="mb-2 text-sm font-medium text-blue-900">
          Summary of Changes
        </p>
        <div className="space-y-2">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="h-4 w-full animate-pulse rounded bg-blue-200"
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="mt-4 space-y-4 duration-300 animate-in fade-in-50">
      {/* Status indicator */}
      <div className="flex items-center space-x-2">
        {isGenerating && (
          <div className="flex items-center space-x-2">
            <div
              className={`${fadingIn ? "opacity-50" : "opacity-100"} transition-opacity duration-150`}
            >
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            </div>
            <p
              className={`text-sm font-medium text-muted-foreground ${fadingIn ? "opacity-50" : "opacity-100"} transition-opacity duration-150`}
            >
              {displayedTask || "Generating..."}
            </p>
          </div>
        )}
        {isComplete && (
          <div className="flex items-center space-x-2 animate-in slide-in-from-left-2">
            <Check className="h-4 w-4 text-green-500" />
            <p className="text-sm font-medium text-muted-foreground">
              Generation complete
            </p>
          </div>
        )}
      </div>

      {/* Summary - either the actual summary or a skeleton */}
      {isGenerating && !summary
        ? renderSummarySkeleton()
        : summary && <SummaryDisplay summary={summary} />}

      {/* Metadata displays - either the actual metadata or a skeleton */}
      {isGenerating && !metadata
        ? renderSkeleton()
        : metadata && (
            <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg border bg-muted/30 p-4 duration-300 animate-in fade-in-50 md:grid-cols-2">
              {/* Categories */}
              {metadata.categories && metadata.categories.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Categories
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {metadata.categories.map((category, idx) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="duration-300 animate-in fade-in-50"
                        style={{ animationDelay: `${idx * 100}ms` }}
                      >
                        {category}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {metadata.tags && metadata.tags.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Tags
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {metadata.tags.map((tag, idx) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className="duration-300 animate-in fade-in-50"
                        style={{ animationDelay: `${idx * 100}ms` }}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Key Changes */}
              {metadata.keyChanges && metadata.keyChanges.length > 0 && (
                <div className="col-span-1 space-y-1 md:col-span-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Key Changes
                  </p>
                  <ul className="space-y-1 text-sm">
                    {metadata.keyChanges.map((change, idx) => (
                      <li
                        key={idx}
                        className="duration-300 animate-in slide-in-from-left-5"
                        style={{ animationDelay: `${idx * 150}ms` }}
                      >
                        • {change}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Tone Shift */}
              {metadata.toneShift && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Tone Shift
                  </p>
                  <p className="text-sm duration-300 animate-in fade-in-50">
                    {metadata.toneShift}
                  </p>
                </div>
              )}

              {/* Focus Area */}
              {metadata.focusArea && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Focus Area
                  </p>
                  <p className="text-sm duration-300 animate-in fade-in-50">
                    {metadata.focusArea}
                  </p>
                </div>
              )}

              {/* Prompt Length */}
              {metadata.promptLength && (
                <div className="col-span-1 space-y-1 md:col-span-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Prompt Length
                  </p>
                  <div className="flex items-center space-x-2 text-sm">
                    <span>{metadata.promptLength.before || 0} chars</span>
                    <ArrowUpIcon className="h-3 w-3 rotate-90" />
                    <span>{metadata.promptLength.after || 0} chars</span>
                    <span
                      className={cn(
                        "text-xs",
                        metadata.promptLength.difference > 0
                          ? "text-green-500"
                          : "text-red-500",
                      )}
                    >
                      ({metadata.promptLength.difference > 0 ? "+" : ""}
                      {metadata.promptLength.difference || 0} chars)
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
    </div>
  );
}

// Add a component for data preview with scrollable overflow
function DataPreview({ data }: { data: ProcessedFileData }) {
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
}

export function RunCreateForm({
  campaignId,
  onSuccess,
  onCancel,
  defaultValues,
  campaignBasePrompt = "",
  campaignVoicemailMessage = "",
  campaignName = "",
  campaignDescription = "",
  onFormSuccess,
}: RunCreateFormProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [processedFile, setProcessedFile] = useState<ProcessedFileData>({});
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmissionComplete, setIsSubmissionComplete] = useState(false);
  const [aiGeneratedPrompt, setAiGeneratedPrompt] = useState<string>("");
  const [aiGeneratedVoicemail, setAiGeneratedVoicemail] = useState<string>("");
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [streamedMetadata, setStreamedMetadata] = useState<StreamedMetadata>(
    {},
  );
  const [isStreamingComplete, setIsStreamingComplete] =
    useState<boolean>(false);
  const [currentTask, setCurrentTask] = useState<string>("");
  const [uploadedFileName, setUploadedFileName] = useState<string>("");

  const steps = ["Upload & Validate", "Configure Prompt", "Schedule & Name"];

  const form = useForm<RunFormValues>({
    resolver: zodResolver(runFormSchema),
    mode: "onChange",
    defaultValues: {
      ...defaultValues,
      customPrompt: campaignBasePrompt,
      customVoicemailMessage: campaignVoicemailMessage,
      name: "",
      scheduleForLater: false,
      scheduledDate: null,
      scheduledTime: "",
      aiGenerated: false,
    },
  });

  const generateNaturalLanguage = async () => {
    const input = form.getValues("naturalLanguageInput");

    if (!input || input.length < 5) {
      toast.error(
        "Please enter at least 5 characters to describe your desired changes.",
      );
      return;
    }

    // Clear previous streaming metadata and show skeletons immediately
    setStreamedMetadata({
      metadata: {}, // Initialize with empty object to trigger skeleton UI
      summary: "", // Empty string to trigger summary skeleton
    });
    setCurrentTask("Initializing generation...");

    // Set initial loading state
    setIsGeneratingPrompt(true);
    setIsStreamingComplete(false);

    // Track streaming state
    let isFirstChunk = true;
    let currentSummary = "";
    let currentCategories: string[] = [];
    let currentTags: string[] = [];
    let currentKeyChanges: string[] = [];
    let currentToneShift = "";
    let currentFocusArea = "";
    let currentPromptLength: StreamedMetadata["metadata"]["promptLength"] = {
      before: 0,
      after: 0,
      difference: 0,
    };

    // Retry mechanism variables
    let retryCount = 0;
    const MAX_RETRIES = 3;
    let eventSource: EventSource | null = null;
    let connectionTimeoutId: NodeJS.Timeout | null = null;

    // Function to create and setup the EventSource
    const setupEventSource = () => {
      try {
        // Create request payload
        const payload = {
          basePrompt: campaignBasePrompt,
          baseVoicemailMessage: campaignVoicemailMessage,
          naturalLanguageInput: input,
          campaignContext: {
            name: campaignName,
            description: campaignDescription,
          },
        };

        // Close any existing connection
        if (eventSource) {
          eventSource.close();
        }

        // Set a connection timeout (15 seconds)
        if (connectionTimeoutId) {
          clearTimeout(connectionTimeoutId);
        }
        connectionTimeoutId = setTimeout(() => {
          if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
            console.warn(
              "Connection timeout - no data received after 15 seconds",
            );
            eventSource.close();
            setIsGeneratingPrompt(false);
            toast.error(
              "Connection timeout. No response received from the server.",
            );
          }
        }, 15000);

        // First, create a session ID for this streaming connection
        // This avoids large payloads in URL parameters
        console.log("Creating session with payload:", JSON.stringify(payload));
        fetch("/api/ai/stream/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })
          .then((response) => {
            console.log("Session creation response status:", response.status);
            if (!response.ok) {
              throw new Error(
                `Failed to create session: ${response.status} ${response.statusText}`,
              );
            }
            return response.json();
          })
          .then((data) => {
            console.log("Session created with ID:", data.sessionId);
            if (!data.sessionId) {
              throw new Error("No session ID returned from server");
            }

            // Now create the EventSource with just the session ID
            const sessionUrl = `/api/ai/stream/connect?sessionId=${data.sessionId}`;
            console.log("Creating EventSource with URL:", sessionUrl);
            eventSource = new EventSource(sessionUrl);

            // Handle connection open
            eventSource.onopen = () => {
              console.log("SSE connection opened successfully");
              // Show immediate feedback for streaming start
              setCurrentTask(
                "Connection established, awaiting first response...",
              );

              // Clear connection timeout on successful open
              if (connectionTimeoutId) {
                clearTimeout(connectionTimeoutId);
                connectionTimeoutId = null;
              }
            };

            // Handle incoming messages
            eventSource.onmessage = (event) => {
              // Clear connection timeout on first message
              if (connectionTimeoutId) {
                clearTimeout(connectionTimeoutId);
                connectionTimeoutId = null;
              }

              console.log("SSE message received:", event.data);

              try {
                const data = JSON.parse(event.data);
                console.log("SSE message parsed data type:", data.type);

                // Handle different event types
                if (data.type === "status") {
                  console.log("SSE status update:", data.data);
                  // Update status
                  if (data.data.currentTask) {
                    setCurrentTask(data.data.currentTask);
                  }

                  // Check for completion or error
                  if (data.data.status === "completed") {
                    console.log("SSE stream completed");
                    setIsStreamingComplete(true);
                    setIsGeneratingPrompt(false);
                    form.setValue("aiGenerated", true);
                    toast.success("AI generation completed successfully!");
                    if (eventSource) {
                      eventSource.close();
                    }
                  } else if (data.data.status === "error") {
                    console.error("SSE stream error:", data.data.error);
                    setIsGeneratingPrompt(false);
                    toast.error(
                      data.data.error ||
                        "An error occurred during AI generation",
                    );
                    if (eventSource) {
                      eventSource.close();
                    }
                  }
                } else if (data.type === "chunk") {
                  // If it's the first chunk, show immediate feedback
                  if (isFirstChunk) {
                    console.log("SSE first chunk received");
                    setCurrentTask("Processing response...");
                    isFirstChunk = false;
                  }
                } else if (data.type === "update") {
                  console.log("SSE update received:", Object.keys(data.data));
                  // Process update data in a streaming manner
                  const updatedData = data.data;

                  // Update metadata in a streaming fashion
                  if (updatedData) {
                    const updatedMetadata: StreamedMetadata = { metadata: {} };
                    let hasUpdates = false;

                    // Update run name if present
                    if (updatedData.suggestedRunName) {
                      updatedMetadata.suggestedRunName =
                        updatedData.suggestedRunName;
                      form.setValue("name", updatedData.suggestedRunName, {
                        shouldDirty: true,
                        shouldTouch: true,
                      });
                      hasUpdates = true;
                    }

                    // Update summary if present, handling it in an incremental way
                    if (
                      updatedData.summary &&
                      updatedData.summary !== currentSummary
                    ) {
                      currentSummary = updatedData.summary;
                      updatedMetadata.summary = currentSummary;
                      hasUpdates = true;
                    }

                    // Handle streaming metadata updates
                    if (updatedData.metadata) {
                      // Categories - show each one as it appears
                      if (updatedData.metadata.categories) {
                        // Find new categories not in the current set
                        const newCategories =
                          updatedData.metadata.categories.filter(
                            (c) => !currentCategories.includes(c),
                          );

                        if (newCategories.length > 0) {
                          currentCategories = [
                            ...currentCategories,
                            ...newCategories,
                          ];
                          updatedMetadata.metadata.categories =
                            currentCategories;
                          hasUpdates = true;
                        }
                      }

                      // Tags - show each one as it appears
                      if (updatedData.metadata.tags) {
                        const newTags = updatedData.metadata.tags.filter(
                          (t) => !currentTags.includes(t),
                        );

                        if (newTags.length > 0) {
                          currentTags = [...currentTags, ...newTags];
                          updatedMetadata.metadata.tags = currentTags;
                          hasUpdates = true;
                        }
                      }

                      // Key changes - show each one as it appears
                      if (updatedData.metadata.keyChanges) {
                        const newKeyChanges =
                          updatedData.metadata.keyChanges.filter(
                            (k) => !currentKeyChanges.includes(k),
                          );

                        if (newKeyChanges.length > 0) {
                          currentKeyChanges = [
                            ...currentKeyChanges,
                            ...newKeyChanges,
                          ];
                          updatedMetadata.metadata.keyChanges =
                            currentKeyChanges;
                          hasUpdates = true;
                        }
                      }

                      // Tone shift update
                      if (
                        updatedData.metadata.toneShift &&
                        updatedData.metadata.toneShift !== currentToneShift
                      ) {
                        currentToneShift = updatedData.metadata.toneShift;
                        updatedMetadata.metadata.toneShift = currentToneShift;
                        hasUpdates = true;
                      }

                      // Focus area update
                      if (
                        updatedData.metadata.focusArea &&
                        updatedData.metadata.focusArea !== currentFocusArea
                      ) {
                        currentFocusArea = updatedData.metadata.focusArea;
                        updatedMetadata.metadata.focusArea = currentFocusArea;
                        hasUpdates = true;
                      }

                      // Prompt length update
                      if (updatedData.metadata.promptLength) {
                        currentPromptLength = updatedData.metadata.promptLength;
                        updatedMetadata.metadata.promptLength =
                          currentPromptLength;
                        hasUpdates = true;
                      }
                    }

                    // Update form values if prompt or voicemail message present
                    if (updatedData.newPrompt) {
                      form.setValue("customPrompt", updatedData.newPrompt, {
                        shouldDirty: true,
                        shouldTouch: true,
                      });
                      hasUpdates = true;
                    }

                    if (updatedData.newVoicemailMessage) {
                      form.setValue(
                        "customVoicemailMessage",
                        updatedData.newVoicemailMessage,
                        {
                          shouldDirty: true,
                          shouldTouch: true,
                        },
                      );
                      hasUpdates = true;
                    }

                    // Only update state if there were actual changes
                    if (hasUpdates) {
                      setStreamedMetadata((prev) => ({
                        ...prev,
                        ...(updatedMetadata.suggestedRunName && {
                          suggestedRunName: updatedMetadata.suggestedRunName,
                        }),
                        ...(updatedMetadata.summary && {
                          summary: updatedMetadata.summary,
                        }),
                        metadata: {
                          ...prev.metadata,
                          ...(updatedMetadata.metadata || {}),
                        },
                      }));
                    }
                  }
                }
              } catch (error) {
                console.error("Error parsing SSE data:", error);
              }
            };

            // Handle errors
            eventSource.onerror = (error) => {
              // The error object from EventSource often doesn't contain useful information
              // so we'll log a more generic message with the readyState
              console.error(
                "EventSource error occurred with readyState:",
                eventSource?.readyState,
                "Error details:",
                error,
              );

              // Check if we got a 404 or other issue
              if (eventSource?.readyState === EventSource.CLOSED) {
                console.log("Connection closed. Attempting to debug...");

                // Make a debug call to check sessions
                fetch(`/api/ai/stream/debug`)
                  .then((resp) => resp.json())
                  .then((data) => {
                    console.log("Session debug data:", data);

                    // Log the sessions for debugging
                    console.log("Available sessions:", data.sessions);

                    // Retry with backoff
                    if (retryCount < MAX_RETRIES) {
                      retryCount++;
                      const backoffTime = retryCount * 1000; // 1s, 2s, 3s
                      console.log(
                        `Retrying connection (${retryCount}/${MAX_RETRIES}) in ${backoffTime}ms...`,
                      );
                      setTimeout(() => {
                        setupEventSource();
                      }, backoffTime);
                    } else {
                      console.error("Maximum retry attempts reached");
                      setIsGeneratingPrompt(false);
                      toast.error(
                        "Failed to establish a stable connection to the server after multiple attempts.",
                      );
                    }
                  })
                  .catch((err) => {
                    console.error("Error fetching debug info:", err);
                    setIsGeneratingPrompt(false);
                    toast.error("Error during generation. Please try again.");
                  });
              }

              // Clear connection timeout if it exists
              if (connectionTimeoutId) {
                clearTimeout(connectionTimeoutId);
                connectionTimeoutId = null;
              }
            };
          })
          .catch((error) => {
            console.error("Failed to initialize streaming session:", error);
            setIsGeneratingPrompt(false);
            toast.error("Failed to initialize generation. Please try again.");
            if (connectionTimeoutId) {
              clearTimeout(connectionTimeoutId);
              connectionTimeoutId = null;
            }
          });

        // Clean up function to close the connection if component unmounts
        return () => {
          if (connectionTimeoutId) {
            clearTimeout(connectionTimeoutId);
          }
          if (eventSource) {
            eventSource.close();
          }
        };
      } catch (error) {
        console.error("Error starting AI generation:", error);
        setIsGeneratingPrompt(false);
        toast.error("Failed to start generation. Please try again.");
        return () => {};
      }
    };

    return setupEventSource();
  };

  const createRunMutation = useCreateRun(campaignId);
  const uploadFileMutation = useUploadFile();

  const validateDataMutation = useMutation({
    mutationFn: async (data: { fileContent: string; fileName: string }) => {
      return validateData(data);
    },
    onSuccess: (data: any) => {
      setProcessedFile(data);
      setIsValidating(false);

      if (data && (data.totalRows > 0 || data.parsedData?.rows?.length > 0)) {
        nextStep();
      }
    },
    onError: (error) => {
      toast.error(
        `Error validating file: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      setIsValidating(false);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);

      processSelectedFile(selectedFile);
    }
  };

  const processSelectedFile = useCallback(
    async (selectedFile: File) => {
      try {
        setIsValidating(true);

        const reader = new FileReader();
        reader.onload = async (e) => {
          const content = e.target?.result as string;
          await validateDataMutation.mutateAsync({
            fileContent: content,
            fileName: selectedFile.name,
          });
        };

        reader.onerror = () => {
          setIsValidating(false);
          toast.error("Failed to read file");
        };

        reader.readAsDataURL(selectedFile);
      } catch (error) {
        setIsValidating(false);
        console.error("Error processing file:", error);
        toast.error("Failed to process file");
      }
    },
    [validateDataMutation],
  );

  const handleFileRemove = () => {
    setFile(null);
    setProcessedFile({});
  };

  const onSubmit = async (values: RunFormValues) => {
    console.log("Form submission triggered, current step:", currentStep);
    console.log("Form values:", values);

    if (currentStep !== 2) {
      nextStep();
      return;
    }

    try {
      console.log("Final step submission - creating run");
      setIsSubmitting(true);

      // Process scheduling
      let scheduledAt = null;
      if (
        values.scheduleForLater &&
        values.scheduledDate &&
        values.scheduledTime
      ) {
        const [hours, minutes] = values.scheduledTime.split(":").map(Number);
        const date = new Date(values.scheduledDate);
        date.setHours(hours || 0, minutes || 0, 0, 0);
        scheduledAt = date.toISOString();
        console.log("Scheduled for:", scheduledAt);
      }

      console.log("Creating run with payload:", {
        campaignId,
        name: values.name,
        customPrompt: values.customPrompt || campaignBasePrompt,
        customVoicemailMessage:
          values.customVoicemailMessage || campaignVoicemailMessage,
        aiGenerated: values.aiGenerated,
        variationNotes: values.variationNotes,
        scheduledAt,
        naturalLanguageInput: values.naturalLanguageInput,
      });

      // Create the run
      const createRunResult = await createRunMutation.mutateAsync({
        campaignId,
        name: values.name,
        customPrompt: values.customPrompt || campaignBasePrompt,
        customVoicemailMessage:
          values.customVoicemailMessage || campaignVoicemailMessage,
        aiGenerated: values.aiGenerated,
        variationNotes: values.variationNotes,
        scheduledAt,
        metadata: streamedMetadata.metadata,
        naturalLanguageInput: values.naturalLanguageInput,
      });

      console.log("Run created successfully:", createRunResult);

      // If we have a file, upload it for the run
      if (createRunResult?.id && file) {
        console.log("Uploading file for run:", createRunResult.id);
        try {
          const response = await fetch(
            `/api/runs/${createRunResult.id}/upload`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                fileContent: file,
                fileName: file.name,
              }),
            },
          );

          if (!response.ok) {
            throw new Error("File upload failed");
          }
          console.log("File uploaded successfully");
        } catch (error) {
          console.error("Error uploading file:", error);
          toast.error("File upload failed, but run was created successfully");
        }
      }

      if (onFormSuccess) {
        console.log("Calling onFormSuccess callback");
        onFormSuccess();
      }

      console.log("Calling handleSuccess with runId:", createRunResult?.id);
      handleSuccess(createRunResult?.id);
    } catch (error) {
      console.error("Error creating run:", error);
      toast.error("Failed to create run");
      setIsSubmitting(false);
    }
  };

  const handleSuccess = (runId?: string) => {
    setIsValidating(false);
    setIsSubmitting(false);
    if (onSuccess) {
      onSuccess(runId);
    } else if (runId) {
      router.push(`/campaigns/${campaignId}/runs/${runId}`);
    } else {
      router.push(`/campaigns/${campaignId}`);
    }
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceedFromCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return (
          !!processedFile &&
          (processedFile.totalRows > 0 ||
            processedFile.parsedData?.rows?.length > 0)
        );

      case 1:
        if (aiGeneratedPrompt) {
          const naturalLanguageInput = form.getValues("naturalLanguageInput");
          const customPrompt = form.getValues("customPrompt");
          const customVoicemailMessage = form.getValues(
            "customVoicemailMessage",
          );
          const promptVersion = form.getValues("promptVersion");
          const aiGenerated = form.getValues("aiGenerated");
          const variationNotes = form.getValues("variationNotes");
          return (
            !!naturalLanguageInput ||
            !!customPrompt ||
            !!customVoicemailMessage ||
            !!promptVersion ||
            !!aiGenerated ||
            !!variationNotes
          );
        }
        return true;

      case 2:
        const hasName = !!form.getValues("name");
        const isScheduled = form.getValues("scheduleForLater");

        if (isScheduled) {
          const hasDate = !!form.getValues("scheduledDate");
          const hasTime = !!form.getValues("scheduledTime");
          return hasName && hasDate && hasTime;
        }

        return hasName;

      default:
        return false;
    }
  };

  // Render the content for the current step
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
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
                            <p className="text-sm font-medium">
                              File Validated
                            </p>
                            <p className="mt-1 text-xs">
                              The file has been validated and is ready for
                              upload.{" "}
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
        );

      case 1:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="mb-1 text-lg font-semibold">
                Customize Your Message
              </h2>
              <p className="text-sm text-muted-foreground">
                Describe the changes you'd like to make to the campaign's
                messaging.
              </p>
            </div>

            <FormField
              control={form.control}
              name="naturalLanguageInput"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Natural Language Input</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <Textarea
                        {...field}
                        placeholder="E.g., Make it more empathetic and focus on the importance of follow-up visits."
                        className="h-24"
                        disabled={isGeneratingPrompt}
                      />
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          onClick={generateNaturalLanguage}
                          disabled={
                            isGeneratingPrompt ||
                            !field.value ||
                            field.value.length < 5
                          }
                          className="ml-auto"
                        >
                          {isGeneratingPrompt ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>Generate</>
                          )}
                        </Button>
                      </div>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Describe how you want to modify the prompt in plain English.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Add the streaming UI component */}
            <StreamingGenerationUI
              isGenerating={isGeneratingPrompt}
              isComplete={isStreamingComplete}
              currentTask={currentTask}
              metadata={streamedMetadata.metadata}
              summary={streamedMetadata.summary}
            />

            <div className="hidden border-t pt-4">
              <FormField
                control={form.control}
                name="customPrompt"
                render={({ field }) => (
                  <FormItem className="hidden">
                    <FormLabel>Custom Prompt</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        disabled={isGeneratingPrompt}
                        placeholder="The AI-generated custom prompt will appear here after generation."
                        className="h-32 font-mono text-sm"
                      />
                    </FormControl>
                    <FormDescription>
                      This is the prompt that will be used for the conversation.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="hidden">
              <FormField
                control={form.control}
                name="customVoicemailMessage"
                render={({ field }) => (
                  <FormItem className="hidden">
                    <FormLabel>Custom Voicemail Message</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        disabled={isGeneratingPrompt}
                        placeholder="The AI-generated voicemail message will appear here after generation."
                        className="h-24 font-mono text-sm"
                      />
                    </FormControl>
                    <FormDescription>
                      This message will be used if the call goes to voicemail.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={prevStep}>
                Back
              </Button>
              <Button
                type="button"
                onClick={nextStep}
                disabled={!canProceedFromCurrentStep()}
              >
                Continue
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Run Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Weekly Appointment Confirmations"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Give your run a descriptive name
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="scheduleForLater"
              render={({ field }) => (
                <FormItem className="rounded-md border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <FormLabel className="text-base">
                        Schedule for Later
                      </FormLabel>
                      <FormDescription>
                        Run will start at the scheduled time
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </div>

                  {field.value && (
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="scheduledDate"
                        render={({ field }) => {
                          console.log("Date field value:", field.value);
                          return (
                            <FormItem>
                              <FormLabel>Date</FormLabel>
                              <FormControl>
                                <Input
                                  type="date"
                                  min={format(new Date(), "yyyy-MM-dd")}
                                  {...field}
                                  value={
                                    field.value
                                      ? format(field.value, "yyyy-MM-dd")
                                      : ""
                                  }
                                  onChange={(e) => {
                                    const date = e.target.value
                                      ? new Date(e.target.value)
                                      : null;
                                    console.log(
                                      "Date onChange:",
                                      e.target.value,
                                      date,
                                    );
                                    field.onChange(date);
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />

                      <FormField
                        control={form.control}
                        name="scheduledTime"
                        render={({ field }) => {
                          console.log("Time field value:", field.value);
                          return (
                            <FormItem>
                              <FormLabel>Time</FormLabel>
                              <FormControl>
                                <Input
                                  type="time"
                                  {...field}
                                  value={
                                    field.value === null ? "" : field.value
                                  }
                                  disabled={!form.getValues("scheduledDate")}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />
                    </div>
                  )}
                </FormItem>
              )}
            />

            {processedFile && (
              <div className="bg-gray-50 rounded-md p-4">
                <h3 className="mb-2 font-medium">Run Summary</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Rows:</span>
                    <span className="font-medium">
                      {processedFile.totalRows || 0}
                    </span>
                  </div>
                  {processedFile.invalidRows > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Invalid Rows:
                      </span>
                      <span className="font-medium text-amber-600">
                        {processedFile.invalidRows}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valid Calls:</span>
                    <span className="font-medium text-green-600">
                      {(processedFile.totalRows || 0) -
                        (processedFile.invalidRows || 0)}
                    </span>
                  </div>
                </div>

                {/* Add data preview in the final step too */}
                {processedFile.parsedData &&
                  processedFile.parsedData.rows &&
                  processedFile.parsedData.rows.length > 0 && (
                    <div className="mt-4">
                      <h4 className="mb-2 text-sm font-medium">Data Sample</h4>
                      <div className="overflow-hidden rounded-md border">
                        <div className="max-h-[200px] overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-muted/50">
                              <tr>
                                {Object.keys(processedFile.parsedData.rows[0])
                                  .slice(0, 5)
                                  .map((header) => (
                                    <th
                                      key={header}
                                      className="px-2 py-1.5 text-left font-medium text-muted-foreground"
                                    >
                                      {header}
                                    </th>
                                  ))}
                                {Object.keys(processedFile.parsedData.rows[0])
                                  .length > 5 && (
                                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                                    ...
                                  </th>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {processedFile.parsedData.rows
                                .slice(0, 3)
                                .map((row, rowIndex) => (
                                  <tr
                                    key={rowIndex}
                                    className={
                                      rowIndex % 2 === 0
                                        ? "bg-white"
                                        : "bg-muted/20"
                                    }
                                  >
                                    {Object.keys(row)
                                      .slice(0, 5)
                                      .map((header) => (
                                        <td
                                          key={`${rowIndex}-${header}`}
                                          className="max-w-[150px] truncate border-t px-2 py-1.5"
                                        >
                                          {typeof row[header] === "object"
                                            ? JSON.stringify(row[header])
                                            : row[header]}
                                        </td>
                                      ))}
                                    {Object.keys(row).length > 5 && (
                                      <td className="border-t px-2 py-1.5 text-muted-foreground">
                                        ...
                                      </td>
                                    )}
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                        {processedFile.parsedData.rows.length > 3 && (
                          <div className="border-t bg-muted/20 px-2 py-1.5 text-xs text-muted-foreground">
                            Showing 3 of {processedFile.parsedData.rows.length}{" "}
                            rows
                          </div>
                        )}
                      </div>
                    </div>
                  )}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="mx-auto max-w-[600px] p-4">
      <div className="mb-6">
        <div className="mt-4">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={index} className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full border text-xs font-medium",
                    {
                      "border-primary bg-primary text-primary-foreground":
                        currentStep === index,
                      "border-green-500 bg-green-500 text-white":
                        currentStep > index,
                      "border-gray-200 bg-gray-50 text-gray-500":
                        currentStep < index,
                    },
                  )}
                >
                  {currentStep > index ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                <span className="text-gray-500 mt-1 text-xs font-medium">
                  {step}
                </span>
              </div>
            ))}
          </div>
          <div className="relative mt-2">
            <div className="bg-gray-200 absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2"></div>
            <div
              className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2 bg-primary transition-all duration-300"
              style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form
          onSubmit={(e) => {
            console.log("Form submit event triggered");
            form.handleSubmit(onSubmit)(e);
          }}
          className="space-y-6"
        >
          {renderStepContent()}

          <div className="flex justify-between pt-4">
            {currentStep === 0 ? (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={isGeneratingPrompt}
              >
                Back
              </Button>
            )}

            {currentStep < steps.length - 1 ? (
              <Button
                type="button"
                onClick={nextStep}
                disabled={!canProceedFromCurrentStep() || isGeneratingPrompt}
              >
                {isGeneratingPrompt ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Next <ChevronRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  !canProceedFromCurrentStep() ||
                  isGeneratingPrompt
                }
                onClick={() => {
                  console.log("Submit button clicked");
                  console.log("Form state:", form.getValues());
                  console.log("Form validation state:", form.formState);
                  console.log("Can proceed:", canProceedFromCurrentStep());

                  // Get validation state for last step
                  const hasName = !!form.getValues("name");
                  const isScheduled = form.getValues("scheduleForLater");
                  const hasDate = !!form.getValues("scheduledDate");
                  const hasTime = !!form.getValues("scheduledTime");

                  console.log("Validation details:", {
                    hasName,
                    isScheduled,
                    hasDate,
                    hasTime,
                    isSubmitting,
                    isGeneratingPrompt,
                  });

                  // If the form can't proceed, focus the first invalid field
                  if (!canProceedFromCurrentStep()) {
                    if (!hasName) {
                      form.setFocus("name");
                    } else if (isScheduled && !hasDate) {
                      form.setFocus("scheduledDate");
                    } else if (isScheduled && !hasTime) {
                      form.setFocus("scheduledTime");
                    }
                  }
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Create Run <ChevronRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
