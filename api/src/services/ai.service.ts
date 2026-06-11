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

const DEFAULT_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";

/**
 * Sends a single prompt and returns the assistant's reply.
 * Never throws — returns an empty string on failure.
 */
export async function generateChatCompletion(prompt: string): Promise<string> {
  const { url, apiKey } = getChatEndpoint();

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_CHAT_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
        max_tokens: 512,
      }),
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
