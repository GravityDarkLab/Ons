import { env } from "../config/env.js";

function getChatEndpoint(): { url: string; apiKey: string } {
  if (env.embeddingProvider === "openai") {
    return {
      url:    "https://api.openai.com/v1/chat/completions",
      apiKey: env.openaiApiKey,
    };
  }
  // local: same base URL as embeddings, appended with /chat/completions
  const base = env.embeddingBaseUrl.replace(/\/$/, "");
  return { url: `${base}/chat/completions`, apiKey: "local-key" };
}

const DEFAULT_CHAT_MODEL = env.openaiChatModel;

/**
 * Truncates free-text answer fields before they go into a prompt, so a
 * verbose applicant (deal_breakers/dream_first_date can run to 1-2k chars)
 * doesn't blow up input tokens on every match. Cuts on a word boundary.
 */
export function truncateForPrompt(text: string, maxChars = 220): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxChars)}…`;
}

export interface JsonSchemaResponseFormat {
  name: string;
  schema: Record<string, unknown>;
}

export interface ChatCompletionOptions {
  /** Default 0.8 (creative). Pass lower (e.g. 0.4) for factual/grounded tasks. */
  temperature?: number;
  /**
   * OpenAI-style Structured Outputs (response_format: json_schema) —
   * https://developers.openai.com/api/docs/guides/structured-outputs.
   * Sent regardless of provider: OpenAI and LM Studio both honor this exact
   * shape (LM Studio: https://lmstudio.ai/docs/developer/openai-compat/structured-output).
   * Ollama currently ignores the nested json_schema field and expects its own
   * `format` param instead (https://github.com/ollama/ollama/issues/10001) —
   * harmless no-op there, falls back to the free-text-JSON path below.
   */
  responseSchema?: JsonSchemaResponseFormat;
}

// Output length is steered through the prompt itself (ask for short, capped
// sentences), not by truncating tokens mid-generation — a hard max_tokens cap
// can cut a response off mid-JSON and produce something unparseable. This is
// just a generous safety ceiling against a runaway response.
const OUTPUT_SAFETY_CEILING = 800;

/**
 * Sends a single prompt and returns the assistant's reply.
 * Never throws — returns an empty string on failure.
 */
export async function generateChatCompletion(
  prompt: string,
  options: ChatCompletionOptions = {}
): Promise<string> {
  const { url, apiKey } = getChatEndpoint();

  const body: Record<string, unknown> = {
    model: DEFAULT_CHAT_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: options.temperature ?? 0.8,
    max_tokens: OUTPUT_SAFETY_CEILING,
  };

  if (options.responseSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: options.responseSchema.name,
        strict: true,
        schema: options.responseSchema.schema,
      },
    };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${apiKey}`,
      },
      body:   JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return "";

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return json.choices?.[0]?.message?.content?.trim() ?? "";
  } catch {
    return "";
  }
}
