import { describe, it, expect } from "vitest";
import { freshnessToStartPublishedDate, exaSearchTool, exaContentsTool, exaAnswerTool } from "./exa-mcp.js";

describe("freshnessToStartPublishedDate", () => {
  it("returns ISO date in the past for each preset", () => {
    const y = freshnessToStartPublishedDate("year");
    expect(y).toBeDefined();
    const t = Date.parse(y!);
    expect(Number.isFinite(t)).toBe(true);
    expect(t).toBeLessThan(Date.now());
  });
});

describe("exa tools without EXA_API_KEY", () => {
  it("exa_search returns missing key", async () => {
    const prev = process.env.EXA_API_KEY;
    delete process.env.EXA_API_KEY;
    const r = await exaSearchTool({ query: "test" });
    expect(r.success).toBe(false);
    expect(String((r as { error?: string }).error)).toMatch(/EXA_API_KEY/);
    if (prev !== undefined) process.env.EXA_API_KEY = prev;
  });

  it("exa_contents returns missing key", async () => {
    const prev = process.env.EXA_API_KEY;
    delete process.env.EXA_API_KEY;
    const r = await exaContentsTool({ urls: ["https://example.com"] });
    expect(r.success).toBe(false);
    expect(String((r as { error?: string }).error)).toMatch(/EXA_API_KEY/);
    if (prev !== undefined) process.env.EXA_API_KEY = prev;
  });

  it("exa_answer returns missing key", async () => {
    const prev = process.env.EXA_API_KEY;
    delete process.env.EXA_API_KEY;
    const r = await exaAnswerTool({ query: "test" });
    expect(r.success).toBe(false);
    expect(String((r as { error?: string }).error)).toMatch(/EXA_API_KEY/);
    if (prev !== undefined) process.env.EXA_API_KEY = prev;
  });
});
