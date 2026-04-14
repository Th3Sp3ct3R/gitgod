export type LLMProvider = "anthropic" | "openrouter" | "kimicode";

function detectKimiKey(): string | undefined {
  return (
    process.env.KIMICODE_API_KEY ||
    process.env.KIMI_API_KEY ||
    process.env.MOONSHOT_API_KEY
  );
}

export function detectProvider(): { provider: LLMProvider; model: string } {
  const forced = process.env.LLM_PROVIDER?.toLowerCase();
  if (forced === "kimicode" || forced === "kimi") {
    return {
      provider: "kimicode",
      model: process.env.KIMICODE_MODEL || process.env.KIMI_MODEL || "kimi-k2.5",
    };
  }
  if (forced === "openrouter") {
    return {
      provider: "openrouter",
      model: process.env.OPENROUTER_MODEL || "arcee-ai/trinity-large-preview:free",
    };
  }
  if (forced === "anthropic") {
    return {
      provider: "anthropic",
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
    };
  }

  if (detectKimiKey()) {
    return {
      provider: "kimicode",
      model: process.env.KIMICODE_MODEL || process.env.KIMI_MODEL || "kimi-k2.5",
    };
  }

  if (process.env.OPENROUTER_API_KEY) {
    return {
      provider: "openrouter",
      model: process.env.OPENROUTER_MODEL || "arcee-ai/trinity-large-preview:free",
    };
  }

  return {
    provider: "anthropic",
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
  };
}

export async function callLLM(prompt: string): Promise<string> {
  const { provider, model } = detectProvider();

  if (provider === "kimicode") {
    const kimiKey = detectKimiKey();
    if (!kimiKey) {
      throw new Error(
        "KIMICODE_API_KEY (or KIMI_API_KEY / MOONSHOT_API_KEY) is required when provider is kimicode."
      );
    }

    const baseUrl = (process.env.KIMICODE_BASE_URL || "https://api.moonshot.ai/v1").replace(
      /\/+$/,
      ""
    );
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${kimiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 4096,
      }),
    });
    if (!res.ok) throw new Error(`KimiCode error: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .map((part) => (typeof part?.text === "string" ? part.text : ""))
        .join("")
        .trim();
    }
    return "";
  }

  if (provider === "openrouter") {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/gitgod",
        "X-Title": "GitGod",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 4096,
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter error: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? "";
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    throw new Error("ANTHROPIC_API_KEY is required when OPENROUTER_API_KEY is not set.");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  return data.content?.find((c) => c.type === "text")?.text ?? "";
}
