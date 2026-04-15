import { describe, expect, it } from "vitest";
import {
  extractJsonObject,
  loadClassifierOmegaSystemPrompt,
  normalizeOmegaClassification,
} from "./llm-classifier.js";

describe("loadClassifierOmegaSystemPrompt", () => {
  it("strips markdown before first horizontal rule block", () => {
    const prompt = loadClassifierOmegaSystemPrompt();
    expect(prompt).not.toMatch(/^#\s+Classifier-Ω/);
    expect(prompt).toContain("Classifier-Ω");
    expect(prompt).toContain("confidence");
  });
});

describe("extractJsonObject", () => {
  it("parses raw JSON", () => {
    const out = extractJsonObject(`{"a":1}`);
    expect(out).toBe(`{"a":1}`);
  });

  it("unwraps fenced json", () => {
    const out = extractJsonObject("```json\n{\"x\": true}\n```");
    expect(out).toBe(`{"x": true}`);
  });

  it("extracts first object from surrounding text", () => {
    const out = extractJsonObject('prefix {"k":"v"} suffix');
    expect(out).toBe(`{"k":"v"}`);
  });
});

describe("normalizeOmegaClassification", () => {
  it("fills confidence and ethics_notes", () => {
    const n = normalizeOmegaClassification({
      website_type: "blog_post",
      is_competitor: false,
      competitor_reason: null,
      is_another_agent: false,
      agent_type: null,
      agent_capabilities: [],
      threat_level: "LOW",
      threat_justification: "",
      key_technologies: [],
      target_audience: "devs",
      red_flags: [],
      summary: "x",
      action_recommendation: "IGNORE",
      confidence: 87.4,
      ethics_notes: null,
    });
    expect(n.confidence).toBe(87);
    expect(n.ethics_notes).toBeNull();
  });

  it("clamps confidence", () => {
    const n = normalizeOmegaClassification({ confidence: 150 } as Record<string, unknown>);
    expect(n.confidence).toBe(100);
    const n2 = normalizeOmegaClassification({ confidence: -5 } as Record<string, unknown>);
    expect(n2.confidence).toBe(0);
  });
});
