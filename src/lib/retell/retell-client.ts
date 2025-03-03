"server-only";

// src/lib/retell-client.ts
import { env } from "@/env";
import { Retell } from "retell-sdk";

// Ensure API key is set in environment
if (!env.RETELL_API_KEY) {
  throw new Error("RETELL_API_KEY is not set in environment variables");
}

// Create the Retell API client
export const retell = new Retell({
  apiKey: env.RETELL_API_KEY,
});
