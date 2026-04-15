export type LLMProvider = "anthropic" | "nvidia" | "openrouter" | "kimi" | "opencode";

function kimiApiKey(): string | undefined {
  return process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY || undefined;
}

function openCodeApiKey(): string | undefined {
  return process.env.OPENCODE_ZEN_API_KEY || process.env.OPENCODE_GO_API_KEY || undefined;
}

function openCodeBaseUrl(): string {
  if (process.env.OPENCODE_ZEN_API_KEY) {
    return "https://api.opencode.ai/v1";
  }
  return "https://api.opencode.ai/v1";
}

function openCodeModel(): string {
  return process.env.OPENCODE_MODEL || "kimi-k2.5";
}

function kimiBaseUrl(): string {
  const raw = (process.env.KIMI_BASE_URL || process.env.MOONSHOT_BASE_URL || "https://api.moonshot.ai/v1").replace(/\/$/, "");
  return raw;
}

function kimiModel(): string {
  return process.env.KIMI_MODEL || process.env.MOONSHOT_MODEL || "moonshot-v1-8k";
}

/**
 * Provider order: OpenRouter → NVIDIA → Anthropic → Kimi → OpenCode.
 * Set OPENROUTER_API_KEY to use OpenRouter for agent-docs, synthesize, etc.
 */
export function detectProvider(): { provider: LLMProvider; model: string } {
  if (process.env.OPENROUTER_API_KEY) {
    return {
      provider: "openrouter",
      model: process.env.OPENROUTER_MODEL || "xiaomi/mimo-v2-pro",
    };
  }
  if (process.env.NVIDIA_API_KEY) {
    return {
      provider: "nvidia",
      model: process.env.NVIDIA_MODEL || "meta/llama-3.3-70b-instruct",
    };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      provider: "anthropic",
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
    };
  }
  if (kimiApiKey()) {
    return { provider: "kimi", model: kimiModel() };
  }
  if (openCodeApiKey()) {
    return { provider: "opencode", model: openCodeModel() };
  }

  throw new Error(
    "No LLM key: set OPENROUTER_API_KEY (recommended), NVIDIA_API_KEY, ANTHROPIC_API_KEY, KIMI_API_KEY, or OPENCODE_ZEN/GO_API_KEY."
  );
}

/**
 * Detect provider specifically for Omega classification (uses cheaper/faster model).
 * Priority: OpenRouter (free model) → OpenCode → main provider
 */
export function detectOmegaProvider(): { provider: LLMProvider; model: string } {
  // Use OpenRouter free tier for Omega if available
  if (process.env.OPENROUTER_API_KEY) {
    return {
      provider: "openrouter",
      model: process.env.OMEGA_MODEL || "google/gemma-4-26b-a4b-it:free",
    };
  }
  // Fall back to OpenCode (cheaper option)
  if (openCodeApiKey()) {
    return { provider: "opencode", model: openCodeModel() };
  }
  // Otherwise use main provider
  return detectProvider();
}

/**
 * Call an LLM provider via OpenAI-compatible chat completions API.
 * Works for NVIDIA, OpenRouter, and Kimi (all use the same format).
 */
async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  extraHeaders?: Record<string, string>,
  providerLabel?: string,
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4096,
    }),
  });
  if (!res.ok) throw new Error(`${providerLabel ?? "LLM"} error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

export async function callLLM(prompt: string): Promise<string> {
  const { provider, model } = detectProvider();

  if (provider === "nvidia") {
    return callOpenAICompatible(
      "https://integrate.api.nvidia.com/v1",
      process.env.NVIDIA_API_KEY!,
      model,
      prompt,
      undefined,
      "NVIDIA",
    );
  }

  if (provider === "kimi") {
    return callOpenAICompatible(
      kimiBaseUrl(),
      kimiApiKey()!,
      model,
      prompt,
      undefined,
      "Kimi",
    );
  }

  if (provider === "openrouter") {
    return callOpenAICompatible(
      "https://openrouter.ai/api/v1",
      process.env.OPENROUTER_API_KEY!,
      model,
      prompt,
      { "HTTP-Referer": "https://github.com/gitgod", "X-Title": "GitGod" },
      "OpenRouter",
    );
  }

  // Anthropic (native API — different format)
  const anthropicKey = process.env.ANTHROPIC_API_KEY!;
  const isOAuth = anthropicKey.startsWith("sk-ant-oat");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      ...(isOAuth
        ? { Authorization: `Bearer ${anthropicKey}` }
        : { "x-api-key": anthropicKey }),
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

const ANALYZER_MAX_TOKENS = 8192;

export interface CallLLMWithSystemOptions {
  /** Max completion tokens (default {@link ANALYZER_MAX_TOKENS}). */
  maxTokens?: number;
  /** Sampling temperature; use 0 for deterministic JSON tasks. */
  temperature?: number;
  /** Request JSON object output (OpenAI-compatible APIs only; Anthropic uses prompt discipline). */
  jsonMode?: boolean;
}

/**
 * Chat with an explicit system prompt (for repo analyzer, agents, Classifier-Ω, etc.).
 * Same provider order as {@link callLLM}.
 */
export async function callLLMWithSystem(
  systemPrompt: string,
  userMessage: string,
  options?: CallLLMWithSystemOptions,
): Promise<string> {
  const maxTokens = options?.maxTokens ?? ANALYZER_MAX_TOKENS;
  const temperature = options?.temperature;
  const jsonMode = options?.jsonMode ?? false;

  const openAiCompatibleExtras = (): Record<string, unknown> => {
    const x: Record<string, unknown> = {};
    if (jsonMode) x.response_format = { type: "json_object" };
    if (temperature !== undefined) x.temperature = temperature;
    return x;
  };

  const { provider, model } = detectProvider();

  if (provider === "nvidia") {
    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NVIDIA_API_KEY!}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: maxTokens,
        ...openAiCompatibleExtras(),
      }),
    });
    if (!res.ok) throw new Error(`NVIDIA error: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? "";
  }

  if (provider === "kimi") {
    const res = await fetch(`${kimiBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${kimiApiKey()!}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: maxTokens,
        ...openAiCompatibleExtras(),
      }),
    });
    if (!res.ok) throw new Error(`Kimi error: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? "";
  }

  if (provider === "openrouter") {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY!}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/gitgod",
        "X-Title": "GitGod",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: maxTokens,
        ...openAiCompatibleExtras(),
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter error: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? "";
  }

  if (provider === "opencode") {
    const res = await fetch(`${openCodeBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openCodeApiKey()!}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: maxTokens,
        ...openAiCompatibleExtras(),
      }),
    });
    if (!res.ok) throw new Error(`OpenCode error: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? "";
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY!;
  const isOAuth = anthropicKey.startsWith("sk-ant-oat");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      ...(isOAuth ? { Authorization: `Bearer ${anthropicKey}` } : { "x-api-key": anthropicKey }),
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      ...(temperature !== undefined ? { temperature } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Anthropic error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  return data.content?.find((c) => c.type === "text")?.text ?? "";
}

/**
 * Call LLM specifically for Omega classification.
 * Uses cheaper/faster models via detectOmegaProvider().
 */
export async function callOmegaLLM(
  systemPrompt: string,
  userMessage: string,
  options?: CallLLMWithSystemOptions,
): Promise<string> {
  const maxTokens = options?.maxTokens ?? 4096;
  const temperature = options?.temperature ?? 0;
  const jsonMode = options?.jsonMode ?? true;

  const { provider, model } = detectOmegaProvider();

  // Omega always uses JSON mode for structured classification
  const openAiCompatibleExtras = (): Record<string, unknown> => {
    const x: Record<string, unknown> = {};
    if (jsonMode) x.response_format = { type: "json_object" };
    if (temperature !== undefined) x.temperature = temperature;
    return x;
  };

  if (provider === "openrouter") {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY!}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/gitgod",
        "X-Title": "GitGod",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: maxTokens,
        ...openAiCompatibleExtras(),
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter (Omega) error: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? "";
  }

  if (provider === "opencode") {
    const res = await fetch(`${openCodeBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openCodeApiKey()!}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: maxTokens,
        ...openAiCompatibleExtras(),
      }),
    });
    if (!res.ok) throw new Error(`OpenCode (Omega) error: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? "";
  }

  // Fallback to regular callLLMWithSystem for other providers
  return callLLMWithSystem(systemPrompt, userMessage, { maxTokens, temperature, jsonMode });
}
