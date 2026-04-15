import { describe, it, expect } from "vitest";
import { detectProvider } from "./llm.js";

describe("detectProvider", () => {
  function clearLlmEnv() {
    delete process.env.KIMI_API_KEY;
    delete process.env.MOONSHOT_API_KEY;
    delete process.env.KIMI_MODEL;
    delete process.env.MOONSHOT_MODEL;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_MODEL;
    delete process.env.NVIDIA_API_KEY;
    delete process.env.NVIDIA_MODEL;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_MODEL;
  }

  it("throws when no LLM keys are set", () => {
    clearLlmEnv();
    expect(() => detectProvider()).toThrow(/No LLM key/);
  });

  it("uses anthropic when only ANTHROPIC_API_KEY is set", () => {
    clearLlmEnv();
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    try {
      const { provider, model } = detectProvider();
      expect(provider).toBe("anthropic");
      expect(model).toContain("claude");
    } finally {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it("uses kimi when KIMI_API_KEY is set", () => {
    clearLlmEnv();
    process.env.KIMI_API_KEY = "sk-kimi-test";
    try {
      const { provider, model } = detectProvider();
      expect(provider).toBe("kimi");
      expect(model).toBe("moonshot-v1-8k");
    } finally {
      delete process.env.KIMI_API_KEY;
    }
  });

  it("uses kimi when MOONSHOT_API_KEY is set", () => {
    clearLlmEnv();
    process.env.MOONSHOT_API_KEY = "sk-ms-test";
    try {
      const { provider } = detectProvider();
      expect(provider).toBe("kimi");
    } finally {
      delete process.env.MOONSHOT_API_KEY;
    }
  });

  it("prefers openrouter over kimi when both keys are set", () => {
    clearLlmEnv();
    process.env.KIMI_API_KEY = "sk-kimi";
    process.env.OPENROUTER_API_KEY = "sk-or";
    try {
      expect(detectProvider().provider).toBe("openrouter");
    } finally {
      clearLlmEnv();
    }
  });

  it("uses openrouter when OPENROUTER_API_KEY is set and no higher-priority path", () => {
    clearLlmEnv();
    process.env.OPENROUTER_API_KEY = "test-key";
    try {
      const { provider, model } = detectProvider();
      expect(provider).toBe("openrouter");
      expect(model).toBe("xiaomi/mimo-v2-pro");
    } finally {
      delete process.env.OPENROUTER_API_KEY;
    }
  });

  it("respects OPENROUTER_MODEL override", () => {
    clearLlmEnv();
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

  it("respects KIMI_MODEL override", () => {
    clearLlmEnv();
    process.env.KIMI_API_KEY = "k";
    process.env.KIMI_MODEL = "kimi-k2-turbo-preview";
    try {
      expect(detectProvider().model).toBe("kimi-k2-turbo-preview");
    } finally {
      clearLlmEnv();
    }
  });

  it("prefers openrouter over nvidia when both keys are set", () => {
    clearLlmEnv();
    process.env.NVIDIA_API_KEY = "nv";
    process.env.OPENROUTER_API_KEY = "or";
    try {
      expect(detectProvider().provider).toBe("openrouter");
    } finally {
      clearLlmEnv();
    }
  });
});
