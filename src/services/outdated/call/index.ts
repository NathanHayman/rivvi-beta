// src/services/call/index.ts
// Update this file to export all the functions we need

// Re-export both webhook handlers
export { handleInboundWebhook, handlePostCallWebhook } from "./webhook";

// Re-export the call processor
export { CallProcessor } from "./processor";

// Re-export utility functions
export { extractCallInsights } from "./webhook";

// Re-export the CallAnalytics class
export { CallAnalytics } from "./analytics";
