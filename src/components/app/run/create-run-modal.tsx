// // src/components/app/run/create-run-modal.tsx - Improved Version
// "use client";

// import type React from "react";

// import {
//   AlertCircle,
//   Calendar,
//   Check,
//   Info,
//   Loader2,
//   Upload,
//   X,
// } from "lucide-react";
// import { useRouter } from "next/navigation";
// import { useCallback, useReducer } from "react";
// import { toast } from "sonner";

// import { Badge } from "@/components/ui/badge";
// import { Button } from "@/components/ui/button";
// import { DialogClose } from "@/components/ui/dialog";
// import { Input } from "@/components/ui/input";
// import {
//   Modal,
//   ModalBody,
//   ModalFooter,
//   ModalHeader,
//   ModalTitle,
// } from "@/components/ui/modal";
// import { Switch } from "@/components/ui/switch";
// import { Textarea } from "@/components/ui/textarea";
// import { addDays, format } from "date-fns";

// // Define state shape and action types for reducer
// type RunCreationState = {
//   activeStep: "details" | "review" | "customize";
//   runName: string;
//   file: File | null;
//   customPrompt: string;
//   scheduleForLater: boolean;
//   scheduledDate: Date | null;
//   scheduledTime: string;
//   isProcessing: boolean;
//   processedData: any;
//   showCalendar: boolean;
//   errors: Record<string, string>;
//   validationComplete: boolean;
// };

// type RunCreationAction =
//   | { type: "SET_STEP"; payload: "details" | "review" | "customize" }
//   | { type: "SET_RUN_NAME"; payload: string }
//   | { type: "SET_FILE"; payload: File | null }
//   | { type: "SET_CUSTOM_PROMPT"; payload: string }
//   | { type: "TOGGLE_SCHEDULE"; payload: boolean }
//   | { type: "SET_DATE"; payload: Date | null }
//   | { type: "SET_TIME"; payload: string }
//   | { type: "SET_PROCESSING"; payload: boolean }
//   | { type: "SET_PROCESSED_DATA"; payload: any }
//   | { type: "TOGGLE_CALENDAR"; payload: boolean }
//   | { type: "SET_ERROR"; payload: { field: string; message: string } }
//   | { type: "CLEAR_ERROR"; payload: string }
//   | { type: "RESET_FORM" }
//   | { type: "SET_VALIDATION_COMPLETE"; payload: boolean };

// // Initial state
// const initialState: RunCreationState = {
//   activeStep: "details",
//   runName: "",
//   file: null,
//   customPrompt: "",
//   scheduleForLater: false,
//   scheduledDate: null,
//   scheduledTime: "",
//   isProcessing: false,
//   processedData: null,
//   showCalendar: false,
//   errors: {},
//   validationComplete: false,
// };

// // Reducer function
// function runCreationReducer(
//   state: RunCreationState,
//   action: RunCreationAction,
// ): RunCreationState {
//   switch (action.type) {
//     case "SET_STEP":
//       return { ...state, activeStep: action.payload };
//     case "SET_RUN_NAME":
//       return { ...state, runName: action.payload };
//     case "SET_FILE":
//       // Clear processed data when file changes
//       return {
//         ...state,
//         file: action.payload,
//         processedData: null,
//         validationComplete: false,
//       };
//     case "SET_CUSTOM_PROMPT":
//       return { ...state, customPrompt: action.payload };
//     case "TOGGLE_SCHEDULE":
//       return { ...state, scheduleForLater: action.payload };
//     case "SET_DATE":
//       return { ...state, scheduledDate: action.payload };
//     case "SET_TIME":
//       return { ...state, scheduledTime: action.payload };
//     case "SET_PROCESSING":
//       return { ...state, isProcessing: action.payload };
//     case "SET_PROCESSED_DATA":
//       return {
//         ...state,
//         processedData: action.payload,
//         validationComplete: true,
//       };
//     case "TOGGLE_CALENDAR":
//       return { ...state, showCalendar: action.payload };
//     case "SET_ERROR":
//       return {
//         ...state,
//         errors: {
//           ...state.errors,
//           [action.payload.field]: action.payload.message,
//         },
//       };
//     case "CLEAR_ERROR":
//       const newErrors = { ...state.errors };
//       delete newErrors[action.payload];
//       return { ...state, errors: newErrors };
//     case "SET_VALIDATION_COMPLETE":
//       return { ...state, validationComplete: action.payload };
//     case "RESET_FORM":
//       return initialState;
//     default:
//       return state;
//   }
// }

// interface CreateRunModalProps {
//   campaignId: string;
//   open: boolean;
//   onOpenChange: (open: boolean) => void;
// }

// export function CreateRunModal({
//   campaignId,
//   open,
//   onOpenChange,
// }: CreateRunModalProps) {
//   const router = useRouter();
//   const [state, dispatch] = useReducer(runCreationReducer, initialState);

//   // TODO: Use the new implementation (tRPC is removed)
//   // // tRPC mutations with improved error handling
//   // const createRunMutation = api.runs.create.useMutation({
//   //   onSuccess: (data) => {
//   //     router.push(`/campaigns/${campaignId}/runs/${data?.id}`);
//   //     onOpenChange(false);
//   //     toast.success("Run created successfully");
//   //     dispatch({ type: "RESET_FORM" });
//   //   },
//   //   onError: (error) => {
//   //     toast.error(`Error creating run: ${error.message}`);
//   //     // Set specific error based on the error message
//   //     if (error.message.includes("name")) {
//   //       dispatch({
//   //         type: "SET_ERROR",
//   //         payload: { field: "runName", message: "Invalid run name" },
//   //       });
//   //     }
//   //   },
//   // });
//   // TODO: Use the new implementation (tRPC is removed)
//   // const uploadFileMutation = api.runs.uploadFile.useMutation({
//   //   onSuccess: (data) => {
//   //     toast.success(
//   //       `File processed successfully: ${data.rowsAdded} rows added`,
//   //     );
//   //     if (data.invalidRows > 0) {
//   //       toast.warning(`${data.invalidRows} rows had validation issues`);
//   //     }
//   //   },
//   //   onError: (error) => {
//   //     toast.error(`Error processing file: ${error.message}`);
//   //     dispatch({
//   //       type: "SET_ERROR",
//   //       payload: { field: "file", message: "File processing failed" },
//   //     });
//   //   },
//   // });
//   // TODO: Use the new implementation (tRPC is removed)
//   // const validateDataMutation = api.runs.validateData.useMutation({
//   //   onSuccess: (data) => {
//   //     dispatch({ type: "SET_PROCESSED_DATA", payload: data });
//   //     dispatch({ type: "SET_PROCESSING", payload: false });
//   //     dispatch({ type: "SET_STEP", payload: "review" });
//   //   },
//   //   onError: (error) => {
//   //     dispatch({ type: "SET_PROCESSING", payload: false });
//   //     toast.error(`Error validating data: ${error.message}`);
//   //     dispatch({
//   //       type: "SET_ERROR",
//   //       payload: { field: "file", message: error.message },
//   //     });
//   //   },
//   // });

//   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     if (e.target.files && e.target.files[0]) {
//       const selectedFile = e.target.files[0];

//       // Validate file size (max 10MB)
//       if (selectedFile.size > 10 * 1024 * 1024) {
//         toast.error("File size exceeds the 10MB limit");
//         dispatch({
//           type: "SET_ERROR",
//           payload: { field: "file", message: "File size exceeds 10MB" },
//         });
//         return;
//       }

//       // Validate file type
//       const fileType = selectedFile.name.toLowerCase().split(".").pop();
//       if (!["csv", "xlsx", "xls"].includes(fileType || "")) {
//         toast.error("Please select a CSV or Excel file");
//         dispatch({
//           type: "SET_ERROR",
//           payload: { field: "file", message: "Invalid file type" },
//         });
//         return;
//       }

//       // Clear any existing file errors
//       dispatch({ type: "CLEAR_ERROR", payload: "file" });
//       dispatch({ type: "SET_FILE", payload: selectedFile });
//     }
//   };

//   const handleFileRemove = () => {
//     dispatch({ type: "SET_FILE", payload: null });
//     dispatch({ type: "CLEAR_ERROR", payload: "file" });
//   };

//   // Validate form data before proceeding
//   const validateForm = (): boolean => {
//     let isValid = true;

//     // Validate run name
//     if (!state.runName.trim()) {
//       dispatch({
//         type: "SET_ERROR",
//         payload: { field: "runName", message: "Run name is required" },
//       });
//       isValid = false;
//     } else {
//       dispatch({ type: "CLEAR_ERROR", payload: "runName" });
//     }

//     // Validate file selection
//     if (!state.file) {
//       dispatch({
//         type: "SET_ERROR",
//         payload: { field: "file", message: "Please select a file" },
//       });
//       isValid = false;
//     } else {
//       dispatch({ type: "CLEAR_ERROR", payload: "file" });
//     }

//     // Validate schedule if enabled
//     if (state.scheduleForLater) {
//       if (!state.scheduledDate) {
//         dispatch({
//           type: "SET_ERROR",
//           payload: { field: "scheduledDate", message: "Please select a date" },
//         });
//         isValid = false;
//       } else {
//         dispatch({ type: "CLEAR_ERROR", payload: "scheduledDate" });
//       }

//       if (!state.scheduledTime) {
//         dispatch({
//           type: "SET_ERROR",
//           payload: { field: "scheduledTime", message: "Please select a time" },
//         });
//         isValid = false;
//       } else {
//         dispatch({ type: "CLEAR_ERROR", payload: "scheduledTime" });
//       }
//     }

//     return isValid;
//   };
//   // TODO: Use the new implementation (tRPC is removed)
//   const processFile = useCallback(async () => {
//     // Validate form first
//     if (!validateForm()) {
//       return;
//     }

//     try {
//       dispatch({ type: "SET_PROCESSING", payload: true });

//       const reader = new FileReader();
//       reader.onload = async (e) => {
//         try {
//           const content = e.target?.result as string;
//           await validateDataMutation.mutateAsync({
//             campaignId,
//             fileContent: content,
//             fileName: state.file?.name || "",
//           });
//         } catch (error) {
//           console.error("Error in validate data mutation:", error);
//           dispatch({ type: "SET_PROCESSING", payload: false });
//           toast.error("Failed to process file data");
//         }
//       };

//       reader.onerror = () => {
//         dispatch({ type: "SET_PROCESSING", payload: false });
//         toast.error("Failed to read file");
//         dispatch({
//           type: "SET_ERROR",
//           payload: { field: "file", message: "Failed to read file" },
//         });
//       };

//       if (state.file) {
//         reader.readAsDataURL(state.file);
//       }
//     } catch (error) {
//       dispatch({ type: "SET_PROCESSING", payload: false });
//       console.error("Error processing file:", error);
//       toast.error("Failed to process file");
//     }
//   }, [state.file, state.runName, campaignId, validateDataMutation]);

//   // TODO: Use the new implementation (tRPC is removed)
//   const handleCreateRun = async () => {
//     try {
//       // Final validation check
//       if (!validateForm()) {
//         return;
//       }

//       dispatch({ type: "SET_PROCESSING", payload: true });

//       // Prepare schedule data if needed
//       let scheduledAt = null;
//       if (
//         state.scheduleForLater &&
//         state.scheduledDate &&
//         state.scheduledTime
//       ) {
//         const [hours, minutes] = state.scheduledTime.split(":").map(Number);
//         const date = new Date(state.scheduledDate);
//         date.setHours(hours || 0, minutes || 0, 0, 0);
//         scheduledAt = date.toISOString();
//       }

//       // Create the run first
//       const runData = {
//         campaignId,
//         name: state.runName,
//         customPrompt: state.customPrompt,
//         ...(scheduledAt ? { scheduledAt } : {}),
//       };

//       const run = await createRunMutation.mutateAsync(runData);

//       // If run created successfully and we have data to upload
//       if (run && state.processedData && state.file) {
//         const reader = new FileReader();
//         reader.onload = async (e) => {
//           const content = e.target?.result as string;
//           try {
//             await uploadFileMutation.mutateAsync({
//               runId: run.id,
//               fileContent: content,
//               fileName: state.file!.name,
//               processedData: state.processedData.allRows,
//             });
//           } catch (uploadError) {
//             console.error("Error uploading file:", uploadError);
//             // Even if upload fails, run was created
//             toast.error(
//               "Run created but file upload failed. You may need to re-upload the file.",
//             );
//           }
//         };
//         reader.onerror = () => {
//           toast.error("Failed to read file for upload");
//         };
//         reader.readAsDataURL(state.file);
//       }
//     } catch (error) {
//       console.error("Error in create run flow:", error);
//       toast.error("Failed to create run");
//       dispatch({ type: "SET_PROCESSING", payload: false });
//     }
//   };

//   const handleNext = () => {
//     if (state.activeStep === "details") {
//       processFile();
//     } else if (state.activeStep === "review") {
//       dispatch({ type: "SET_STEP", payload: "customize" });
//     } else {
//       handleCreateRun();
//     }
//   };

//   const handleBack = () => {
//     if (state.activeStep === "review") {
//       dispatch({ type: "SET_STEP", payload: "details" });
//     } else if (state.activeStep === "customize") {
//       dispatch({ type: "SET_STEP", payload: "review" });
//     }
//   };

//   const isLoading =
//     createRunMutation.isPending ||
//     uploadFileMutation.isPending ||
//     state.isProcessing;

//   const renderStepIndicator = () => {
//     return (
//       <div className="mb-6 grid grid-cols-3 gap-2">
//         <div
//           className={`rounded-md border p-2 text-center text-sm ${
//             state.activeStep === "details"
//               ? "border-primary bg-primary/10 font-medium"
//               : "border-gray-200"
//           }`}
//         >
//           Details & Data
//         </div>
//         <div
//           className={`rounded-md border p-2 text-center text-sm ${
//             state.activeStep === "review"
//               ? "border-primary bg-primary/10 font-medium"
//               : "border-gray-200"
//           } ${!state.validationComplete ? "opacity-50" : ""}`}
//         >
//           Review Data
//         </div>
//         <div
//           className={`rounded-md border p-2 text-center text-sm ${
//             state.activeStep === "customize"
//               ? "border-primary bg-primary/10 font-medium"
//               : "border-gray-200"
//           } ${!state.validationComplete ? "opacity-50" : ""}`}
//         >
//           Customize & Schedule
//         </div>
//       </div>
//     );
//   };

//   const renderDetailsStep = () => {
//     return (
//       <div className="space-y-4">
//         <div className="space-y-2">
//           <label htmlFor="run-name" className="text-sm font-medium">
//             Run Name
//           </label>
//           <Input
//             id="run-name"
//             value={state.runName}
//             onChange={(e) => {
//               dispatch({ type: "SET_RUN_NAME", payload: e.target.value });
//               // Clear error if input is valid
//               if (e.target.value.trim()) {
//                 dispatch({ type: "CLEAR_ERROR", payload: "runName" });
//               }
//             }}
//             placeholder="Weekly Appointment Confirmations"
//             className={state.errors.runName ? "border-red-500" : ""}
//           />
//           {state.errors.runName ? (
//             <p className="text-xs text-red-500">{state.errors.runName}</p>
//           ) : (
//             <p className="text-xs text-muted-foreground">
//               Give your run a descriptive name
//             </p>
//           )}
//         </div>

//         <div className="space-y-2">
//           <label className="text-sm font-medium">Data File</label>
//           {!state.file ? (
//             <div className="relative">
//               <Input
//                 type="file"
//                 accept=".xlsx,.xls,.csv"
//                 onChange={handleFileChange}
//                 className="hidden"
//                 id="file-upload"
//               />
//               <label
//                 htmlFor="file-upload"
//                 className={`border-gray-300 hover:bg-gray-50 flex h-10 w-full cursor-pointer items-center justify-center rounded-md border ${
//                   state.errors.file
//                     ? "border-dashed border-red-500"
//                     : "border-dashed"
//                 } px-3 py-2 text-sm`}
//               >
//                 <Upload className="mr-2 h-4 w-4" />
//                 Upload Excel or CSV file
//               </label>
//               {state.errors.file && (
//                 <p className="mt-1 text-xs text-red-500">{state.errors.file}</p>
//               )}
//             </div>
//           ) : (
//             <div
//               className={`bg-gray-50 flex items-center justify-between rounded-md border ${
//                 state.errors.file ? "border-red-500" : ""
//               } p-2`}
//             >
//               <div className="flex items-center">
//                 <div className="ml-2">
//                   <p className="text-sm font-medium">{state.file.name}</p>
//                   <p className="text-xs text-muted-foreground">
//                     {(state.file.size / 1024).toFixed(2)} KB
//                   </p>
//                 </div>
//               </div>
//               <Button
//                 variant="ghost"
//                 size="sm"
//                 onClick={handleFileRemove}
//                 className="h-8 w-8 p-0"
//               >
//                 <X className="h-4 w-4" />
//               </Button>
//             </div>
//           )}
//           <p className="text-xs text-muted-foreground">
//             Upload an Excel or CSV file with your patient appointment data
//           </p>
//         </div>
//       </div>
//     );
//   };

//   const renderReviewStep = () => {
//     if (!state.processedData) return null;

//     return (
//       <div className="space-y-6">
//         <div className="grid grid-cols-2 gap-4">
//           <div className="rounded-md border p-4">
//             <h3 className="mb-2 text-sm font-medium">Data Summary</h3>
//             <div className="space-y-2 text-sm">
//               <div className="flex justify-between">
//                 <span className="text-muted-foreground">Total Rows:</span>
//                 <span>{state.processedData.totalRows}</span>
//               </div>
//               <div className="flex justify-between">
//                 <span className="text-muted-foreground">Valid Rows:</span>
//                 <span className="text-green-600">
//                   {state.processedData.validRows}
//                 </span>
//               </div>
//               <div className="flex justify-between">
//                 <span className="text-muted-foreground">Invalid Rows:</span>
//                 <span className="text-red-600">
//                   {state.processedData.invalidRows}
//                 </span>
//               </div>
//               <div className="bg-gray-100 my-1 h-px"></div>
//               <div className="flex justify-between">
//                 <span className="text-muted-foreground">New Patients:</span>
//                 <span>{state.processedData.newPatients}</span>
//               </div>
//               <div className="flex justify-between">
//                 <span className="text-muted-foreground">
//                   Existing Patients:
//                 </span>
//                 <span>{state.processedData.existingPatients}</span>
//               </div>
//             </div>
//           </div>

//           <div className="rounded-md border p-4">
//             <h3 className="mb-2 text-sm font-medium">Validation Status</h3>
//             <div className="mb-2">
//               <div className="mb-1 flex items-center justify-between">
//                 <span className="text-sm text-muted-foreground">
//                   Data Quality
//                 </span>
//                 <span className="text-sm font-medium">
//                   {Math.round(
//                     (state.processedData.validRows /
//                       Math.max(state.processedData.totalRows, 1)) *
//                       100,
//                   )}
//                   %
//                 </span>
//               </div>
//               <div className="bg-gray-100 h-2 w-full overflow-hidden rounded-full">
//                 <div
//                   className="h-full bg-green-500"
//                   style={{
//                     width: `${(state.processedData.validRows / Math.max(state.processedData.totalRows, 1)) * 100}%`,
//                   }}
//                 ></div>
//               </div>
//             </div>

//             {state.processedData.invalidRows > 0 ? (
//               <div className="mt-4 rounded-md bg-amber-50 p-3 text-amber-800">
//                 <div className="flex">
//                   <AlertCircle className="h-5 w-5 text-amber-500" />
//                   <div className="ml-3">
//                     <p className="text-sm font-medium">
//                       Validation Issues Found
//                     </p>
//                     <p className="mt-1 text-xs">
//                       {state.processedData.invalidRows} rows have validation
//                       issues that need to be addressed.
//                     </p>
//                   </div>
//                 </div>
//               </div>
//             ) : (
//               <div className="mt-4 rounded-md bg-green-50 p-3 text-green-800">
//                 <div className="flex">
//                   <Check className="h-5 w-5 text-green-500" />
//                   <div className="ml-3">
//                     <p className="text-sm font-medium">All Data Valid</p>
//                     <p className="mt-1 text-xs">
//                       All rows passed validation and are ready for processing.
//                     </p>
//                   </div>
//                 </div>
//               </div>
//             )}
//           </div>
//         </div>

//         <div className="rounded-md border p-4">
//           <div className="mb-2 flex items-center justify-between">
//             <h3 className="text-sm font-medium">Column Mapping</h3>
//             {state.processedData.unmatchedColumns?.length > 0 && (
//               <Badge
//                 variant="outline"
//                 className="border-amber-200 bg-amber-50 text-amber-500"
//               >
//                 {state.processedData.unmatchedColumns.length} Unmapped Columns
//               </Badge>
//             )}
//           </div>
//           <p className="mb-4 text-xs text-muted-foreground">
//             The following columns were identified in your file
//           </p>

//           <div className="grid grid-cols-2 gap-4">
//             <div>
//               <h4 className="mb-2 text-xs font-medium">Mapped Columns</h4>
//               <div className="space-y-1">
//                 {state.processedData.matchedColumns?.map((column: string) => (
//                   <div key={column} className="flex items-center">
//                     <Check className="mr-2 h-3 w-3 text-green-500" />
//                     <span className="text-sm">{column}</span>
//                   </div>
//                 ))}
//               </div>
//             </div>

//             {state.processedData.unmatchedColumns?.length > 0 && (
//               <div>
//                 <h4 className="mb-2 text-xs font-medium">Unmapped Columns</h4>
//                 <div className="space-y-1">
//                   {state.processedData.unmatchedColumns.map(
//                     (column: string) => (
//                       <div key={column} className="flex items-center">
//                         <Info className="mr-2 h-3 w-3 text-amber-500" />
//                         <span className="text-sm">{column}</span>
//                       </div>
//                     ),
//                   )}
//                 </div>
//               </div>
//             )}
//           </div>
//         </div>

//         <div className="rounded-md border p-4">
//           <h3 className="mb-2 text-sm font-medium">Sample Data Preview</h3>
//           <p className="mb-4 text-xs text-muted-foreground">
//             Showing {Math.min(5, state.processedData.sampleRows?.length || 0)}{" "}
//             of {state.processedData.totalRows} rows
//           </p>

//           <div className="overflow-x-auto">
//             <table className="w-full border-collapse">
//               <thead>
//                 <tr className="border-b">
//                   <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
//                     Status
//                   </th>
//                   <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
//                     Patient
//                   </th>
//                   <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
//                     Phone
//                   </th>
//                   <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
//                     Data Fields
//                   </th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {state.processedData.sampleRows?.slice(0, 5).map((row: any) => (
//                   <tr key={row.id} className="border-b">
//                     <td className="px-2 py-2">
//                       {row.isValid ? (
//                         <Badge
//                           variant="outline"
//                           className="border-green-200 bg-green-50 text-green-700"
//                         >
//                           Valid
//                         </Badge>
//                       ) : (
//                         <Badge
//                           variant="outline"
//                           className="border-red-200 bg-red-50 text-red-700"
//                         >
//                           Invalid
//                         </Badge>
//                       )}
//                     </td>
//                     <td className="px-2 py-2 text-sm">
//                       {row.patientData.firstName} {row.patientData.lastName}
//                     </td>
//                     <td className="px-2 py-2 text-sm">
//                       {row.patientData.phoneNumber ||
//                         row.patientData.primaryPhone ||
//                         row.patientData.phone}
//                     </td>
//                     <td className="px-2 py-2">
//                       <div className="flex flex-wrap gap-1">
//                         {Object.entries(row.campaignData || {})
//                           .slice(0, 3)
//                           .map(([key, value]) => (
//                             <Badge
//                               key={key}
//                               variant="secondary"
//                               className="text-xs"
//                             >
//                               {key}: {String(value).substring(0, 15)}
//                               {String(value).length > 15 ? "..." : ""}
//                             </Badge>
//                           ))}
//                         {Object.keys(row.campaignData || {}).length > 3 && (
//                           <Badge variant="secondary" className="text-xs">
//                             +{Object.keys(row.campaignData).length - 3} more
//                           </Badge>
//                         )}
//                       </div>
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         </div>

//         {state.processedData.invalidRows > 0 && (
//           <div className="rounded-md border border-red-200 bg-red-50 p-4">
//             <h3 className="mb-2 text-sm font-medium text-red-700">
//               Validation Errors
//             </h3>
//             <p className="mb-4 text-xs text-red-600">
//               The following issues were found in your data
//             </p>

//             <div className="space-y-3">
//               {state.processedData.sampleRows
//                 ?.filter((row: any) => !row.isValid)
//                 .slice(0, 3)
//                 .map((row: any, idx: number) => (
//                   <div
//                     key={idx}
//                     className="rounded-md border border-red-200 bg-white p-3"
//                   >
//                     <div className="font-medium text-red-800">
//                       Row for {row.patientData.firstName || "Unknown"}{" "}
//                       {row.patientData.lastName || "Patient"}
//                     </div>
//                     <ul className="mt-1 list-disc pl-5 text-sm text-red-700">
//                       {row.validationErrors?.map((error: string, i: number) => (
//                         <li key={i}>{error}</li>
//                       ))}
//                     </ul>
//                   </div>
//                 ))}

//               {state.processedData.invalidRows > 3 && (
//                 <div className="text-center text-sm text-muted-foreground">
//                   And {state.processedData.invalidRows - 3} more rows with
//                   errors
//                 </div>
//               )}
//             </div>
//           </div>
//         )}
//       </div>
//     );
//   };

//   const renderCustomizeStep = () => {
//     return (
//       <div className="space-y-6">
//         <div className="space-y-2">
//           <label htmlFor="custom-prompt" className="text-sm font-medium">
//             Campaign Intent (Optional)
//           </label>
//           <Textarea
//             id="custom-prompt"
//             value={state.customPrompt}
//             onChange={(e) =>
//               dispatch({ type: "SET_CUSTOM_PROMPT", payload: e.target.value })
//             }
//             placeholder="Describe the intent of this campaign in natural language (e.g., 'This is an urgent notice about upcoming appointments that need confirmation')"
//             className="min-h-[120px] resize-none"
//           />
//           <p className="text-xs text-muted-foreground">
//             Your natural language input will be combined with the base prompt to
//             tailor the messaging for this run
//           </p>
//         </div>

//         <div className="rounded-md border p-4">
//           <div className="flex items-center justify-between">
//             <div>
//               <h3 className="text-sm font-medium">Schedule for Later</h3>
//               <p className="text-xs text-muted-foreground">
//                 Run will start at the scheduled time
//               </p>
//             </div>
//             <Switch
//               checked={state.scheduleForLater}
//               onCheckedChange={(checked) =>
//                 dispatch({ type: "TOGGLE_SCHEDULE", payload: checked })
//               }
//             />
//           </div>

//           {state.scheduleForLater && (
//             <div className="mt-4 grid grid-cols-2 gap-4">
//               <div className="space-y-2">
//                 <label className="text-sm font-medium">Date</label>
//                 <div className="relative">
//                   <Input
//                     type="text"
//                     readOnly
//                     value={
//                       state.scheduledDate
//                         ? format(state.scheduledDate, "PPP")
//                         : ""
//                     }
//                     placeholder="Pick a date"
//                     className={`cursor-pointer ${state.errors.scheduledDate ? "border-red-500" : ""}`}
//                     onClick={() =>
//                       dispatch({
//                         type: "TOGGLE_CALENDAR",
//                         payload: !state.showCalendar,
//                       })
//                     }
//                   />
//                   <Calendar className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />

//                   {state.errors.scheduledDate && (
//                     <p className="mt-1 text-xs text-red-500">
//                       {state.errors.scheduledDate}
//                     </p>
//                   )}

//                   {state.showCalendar && (
//                     <div className="absolute left-0 top-full z-10 mt-1 rounded-md border bg-white p-3 shadow-md">
//                       <div className="mb-2 flex items-center justify-between">
//                         <h4 className="text-sm font-medium">
//                           {state.scheduledDate
//                             ? format(state.scheduledDate, "MMMM yyyy")
//                             : format(new Date(), "MMMM yyyy")}
//                         </h4>
//                         <div className="flex space-x-1">
//                           <Button
//                             variant="ghost"
//                             size="sm"
//                             className="h-7 w-7 p-0"
//                             onClick={() =>
//                               dispatch({
//                                 type: "TOGGLE_CALENDAR",
//                                 payload: false,
//                               })
//                             }
//                           >
//                             <X className="h-4 w-4" />
//                           </Button>
//                         </div>
//                       </div>

//                       <div className="grid grid-cols-7 gap-1 text-center">
//                         {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(
//                           (day) => (
//                             <div key={day} className="text-xs font-medium">
//                               {day}
//                             </div>
//                           ),
//                         )}

//                         {Array.from({ length: 31 }, (_, i) => {
//                           const date = addDays(new Date(), i);
//                           return (
//                             <Button
//                               key={i}
//                               variant="ghost"
//                               size="sm"
//                               className={`h-7 w-7 p-0 ${
//                                 state.scheduledDate &&
//                                 date.getDate() ===
//                                   state.scheduledDate.getDate() &&
//                                 date.getMonth() ===
//                                   state.scheduledDate.getMonth() &&
//                                 date.getFullYear() ===
//                                   state.scheduledDate.getFullYear()
//                                   ? "bg-primary text-primary-foreground"
//                                   : ""
//                               }`}
//                               onClick={() => {
//                                 dispatch({ type: "SET_DATE", payload: date });
//                                 dispatch({
//                                   type: "TOGGLE_CALENDAR",
//                                   payload: false,
//                                 });
//                                 dispatch({
//                                   type: "CLEAR_ERROR",
//                                   payload: "scheduledDate",
//                                 });
//                               }}
//                             >
//                               {date.getDate()}
//                             </Button>
//                           );
//                         })}
//                       </div>
//                     </div>
//                   )}
//                 </div>
//               </div>

//               <div className="space-y-2">
//                 <label className="text-sm font-medium">Time</label>
//                 <Input
//                   type="time"
//                   value={state.scheduledTime}
//                   onChange={(e) => {
//                     dispatch({ type: "SET_TIME", payload: e.target.value });
//                     dispatch({ type: "CLEAR_ERROR", payload: "scheduledTime" });
//                   }}
//                   disabled={!state.scheduledDate}
//                   className={state.errors.scheduledTime ? "border-red-500" : ""}
//                 />
//                 {state.errors.scheduledTime && (
//                   <p className="mt-1 text-xs text-red-500">
//                     {state.errors.scheduledTime}
//                   </p>
//                 )}
//               </div>
//             </div>
//           )}
//         </div>
//       </div>
//     );
//   };

//   const renderActiveStep = () => {
//     switch (state.activeStep) {
//       case "details":
//         return renderDetailsStep();
//       case "review":
//         return renderReviewStep();
//       case "customize":
//         return renderCustomizeStep();
//       default:
//         return null;
//     }
//   };

//   return (
//     <Modal
//       showModal={open}
//       setShowModal={onOpenChange}
//       className="h-fit max-h-[90vh] max-w-3xl overflow-y-auto"
//     >
//       <ModalHeader>
//         <ModalTitle>Create New Run</ModalTitle>
//         <p className="text-sm text-muted-foreground">
//           Configure a new run for this campaign. You'll need to provide a name
//           and upload a data file.
//         </p>
//       </ModalHeader>

//       <ModalBody>
//         {renderStepIndicator()}
//         {renderActiveStep()}
//       </ModalBody>

//       <ModalFooter className="flex justify-between">
//         {state.activeStep !== "details" ? (
//           <Button variant="outline" onClick={handleBack} disabled={isLoading}>
//             Back
//           </Button>
//         ) : (
//           <DialogClose asChild>
//             <Button variant="outline">Cancel</Button>
//           </DialogClose>
//         )}

//         <Button onClick={handleNext} disabled={isLoading}>
//           {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
//           {state.activeStep === "details" &&
//             (isLoading ? "Processing..." : "Process Data")}
//           {state.activeStep === "review" && "Next"}
//           {state.activeStep === "customize" &&
//             (isLoading ? "Creating..." : "Create Run")}
//         </Button>
//       </ModalFooter>
//     </Modal>
//   );
// }
