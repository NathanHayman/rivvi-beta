import { env } from "@/env";
import { createAnthropic } from "@ai-sdk/anthropic";

if (!env.ANTHROPIC_API_KEY) {
  throw new Error("ANTHROPIC_API_KEY is not set");
}

const anthropic = createAnthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

export default anthropic;
