export type LLMProvider = "anthropic" | "openrouter";

export function detectProvider(): { provider: LLMProvider; model: string } {
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
