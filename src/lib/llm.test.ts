import { describe, it, expect } from "vitest";
import { detectProvider } from "./llm.js";

describe("detectProvider", () => {
  it("defaults to anthropic when no OPENROUTER_API_KEY is set", () => {
    delete process.env.OPENROUTER_API_KEY;
    const { provider, model } = detectProvider();
    expect(provider).toBe("anthropic");
    expect(model).toContain("claude");
  });

  it("uses openrouter when OPENROUTER_API_KEY is set", () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    try {
      const { provider } = detectProvider();
      expect(provider).toBe("openrouter");
    } finally {
      delete process.env.OPENROUTER_API_KEY;
    }
  });

  it("respects OPENROUTER_MODEL override", () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    process.env.OPENROUTER_MODEL = "custom/model";
    try {
      const { model } = detectProvider();
      expect(model).toBe("custom/model");
    } finally {
      delete process.env.OPENROUTER_API_KEY;
      delete process.env.OPENROUTER_MODEL;
    }
  });
});
