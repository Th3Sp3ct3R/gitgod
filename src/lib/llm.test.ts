import { afterEach, describe, expect, it } from "vitest";
import { detectProvider } from "./llm.js";

const originalEnv = { ...process.env };

function resetProviderEnv() {
  delete process.env.LLM_PROVIDER;
  delete process.env.KIMICODE_API_KEY;
  delete process.env.KIMI_API_KEY;
  delete process.env.MOONSHOT_API_KEY;
  delete process.env.KIMICODE_MODEL;
  delete process.env.KIMI_MODEL;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_MODEL;
  delete process.env.ANTHROPIC_MODEL;
}

describe("detectProvider", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    resetProviderEnv();
  });

  it("prefers kimicode when kimicode key is set", () => {
    process.env.KIMICODE_API_KEY = "test-kimi-key";
    const result = detectProvider();
    expect(result.provider).toBe("kimicode");
    expect(result.model).toBe("kimi-k2.5");
  });

  it("supports forced provider override", () => {
    process.env.LLM_PROVIDER = "openrouter";
    process.env.OPENROUTER_MODEL = "openrouter/custom";
    const result = detectProvider();
    expect(result.provider).toBe("openrouter");
    expect(result.model).toBe("openrouter/custom");
  });

  it("uses openrouter when OPENROUTER_API_KEY is set", () => {
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
    const result = detectProvider();
    expect(result.provider).toBe("openrouter");
  });

  it("respects OPENROUTER_MODEL override", () => {
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
    process.env.OPENROUTER_MODEL = "custom/model";
    const result = detectProvider();
    expect(result.model).toBe("custom/model");
  });

  it("falls back to anthropic by default", () => {
    const result = detectProvider();
    expect(result.provider).toBe("anthropic");
    expect(result.model).toBe("claude-sonnet-4-20250514");
  });
});
