import anthropic from "@/lib/anthropic";
import { generateText } from "ai";

const { text } = await generateText({
  model: anthropic("claude-3-haiku-20240307"),
  prompt: "Say this is a test!",
});

console.log(text);

/**
 * @title Generate Text
 * @description
 * You can use Anthropic language models to generate text with the generateText function.
 * Anthropic language models can also be used in the streamText, generateObject, and streamObject functions (see AI SDK Core and AI SDK RSC).
 * The Anthropic API returns streaming tool calls all at once after a delay. This causes the streamObject function to generate the object fully after a delay instead of streaming it incrementally.
 * The following optional settings are available for Anthropic models:
 * - sendReasoning boolean
 *   - Optional. Include reasoning content in requests sent to the model. Defaults to true.
 *   - If you are experiencing issues with the model handling requests involving reasoning content, you can set this to false to omit them from the request.
 * @example
If you are experiencing issues with the model handling requests involving reasoning content, you can set this to false to omit them from the request.
 * @example
 * ```ts
 * const { text } = await generateText({
 *   model: anthropic("claude-3-haiku-20240307"),
 *   prompt: "Say this is a test!",
 * });
 * ```
 */

/**
 * @title Reasoning
 * @description
 * Anthropic has reasoning support for the claude-3-7-sonnet-20250219 model.
 * You can enable it using the thinking provider option and specifying a thinking budget in tokens.
 * @example
 * ```ts
 * const { text, reasoning, reasoningDetails } = await generateText({
 *   model: anthropic("claude-3-7-sonnet-20250219"),
 *   prompt: "How many people will live in the world in 2040?",
 *   providerOptions: {
 *     anthropic: {
 *       thinking: { type: 'enabled', budgetTokens: 12000 },
 *     },
 *   },
 * });
 *
 * console.log(reasoning); // reasoning text
 * console.log(reasoningDetails); // reasoning details including redacted reasoning
 * console.log(text); // text response
 * ```
 */

/**
 * @title Cache Control
 * @description
 * Anthropic cache control was originally a beta feature and required passing an opt-in cacheControl setting when creating the model instance. It is now Generally Available and enabled by default. The cacheControl setting is no longer needed and will be removed in a future release.
 * @example
 * In the messages and message parts, you can use the providerOptions property to set cache control breakpoints. You need to set the anthropic property in the providerOptions object to { cacheControl: { type: 'ephemeral' } } to set a cache control breakpoint.
 * The cache creation input tokens are then returned in the providerMetadata object for generateText and generateObject, again under the anthropic property. When you use streamText or streamObject, the response contains a promise that resolves to the metadata. Alternatively you can receive it in the onFinish callback.
 * ```ts
 * import { anthropic } from '@ai-sdk/anthropic';
 * import { generateText } from 'ai';

 * const errorMessage = '... long error message ...';

 *  const result = await generateText({
 *   model: anthropic('claude-3-5-sonnet-20240620'),
 *   messages: [
 *     {
 *       role: 'user',
 *       content: [
 *         { type: 'text', text: 'You are a JavaScript expert.' },
 *         {
 *           type: 'text',
 *           text: `Error message: ${errorMessage}`,
 *           providerOptions: {
 *             anthropic: { cacheControl: { type: 'ephemeral' } },
 *           },
 *         },
 *         { type: 'text', text: 'Explain the error message.' },
 *       ],
 *     },
 *   ],
 * });

 * console.log(result.text);
 * console.log(result.providerMetadata?.anthropic);
 * e.g. { cacheCreationInputTokens: 2118, cacheReadInputTokens: 0 }
 * You can also use cache control on system messages by providing multiple system messages at the head of your messages array:
 * @example
 * ```ts
 * const result = await generateText({
 *   model: anthropic('claude-3-5-sonnet-20240620'),
 *   messages: [
 *     {
 *       role: 'system',
 *       content: 'Cached system message part',
 *       providerOptions: {
 *         anthropic: { cacheControl: { type: 'ephemeral' } },
 *       },
 *     },
 *     {
 *       role: 'system',
 *       content: 'Uncached system message part',
 *     },
 *     {
 *       role: 'user',
 *       content: 'User prompt',
 *     },
 *   ],
 * });
 * For more on prompt caching with Anthropic, see Anthropic's Cache Control documentation.
 * ```
 */
