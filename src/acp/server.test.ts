import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { handleRequest, type JsonRpcRequest } from "./server.js";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { loadGraphs } from "./loader.js";

const TEST_DATA_DIR = path.join(import.meta.dirname, "../../.test-data-server");

function setup() {
  rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  mkdirSync(path.join(TEST_DATA_DIR, "test-repo"), { recursive: true });
  const graph = {
    repo: "test/repo",
    url: "https://github.com/test/repo",
    scraped_at: "2026-03-15T00:00:00Z",
    stats: { categories: 1, links: 1 },
    taxonomy: [{
      category: "Tools",
      depth: 1,
      tools: [{
        name: "TestTool",
        url: "https://test.com",
        description: "A test tool",
        link_type: "website",
        status: "alive",
        synthesis: {
          summary: "TestTool does testing things",
          tags: ["testing", "automation"],
          relevance_score: 4,
          cross_categories: [],
          duplicates: [],
        },
      }],
      subcategories: [],
    }],
  };
  writeFileSync(path.join(TEST_DATA_DIR, "test-repo", "knowledge-graph.json"), JSON.stringify(graph));
}

function cleanup() {
  rmSync(TEST_DATA_DIR, { recursive: true, force: true });
}

describe("handleRequest", () => {
  beforeEach(() => setup());
  afterEach(() => cleanup());

  it("responds to tools/list with all tool definitions", async () => {
    const index = loadGraphs(TEST_DATA_DIR);
    const req: JsonRpcRequest = { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} };
    const res = await handleRequest(req, index, TEST_DATA_DIR);
    expect(res.jsonrpc).toBe("2.0");
    expect(res.id).toBe(1);
    const listResult = res.result as { tools: unknown[] };
    expect(Array.isArray(listResult.tools)).toBe(true);
    expect(listResult.tools.length).toBe(15);
  });

  it("dispatches tools/call for list_graphs", async () => {
    const index = loadGraphs(TEST_DATA_DIR);
    const req: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "list_graphs", arguments: {} },
    };
    const res = await handleRequest(req, index, TEST_DATA_DIR);
    expect(res.id).toBe(2);
    const callResult = res.result as { content: Array<{ text: string }> };
    const content = JSON.parse(callResult.content[0].text);
    expect(content.total_graphs).toBe(1);
  });

  it("dispatches tools/call for research_merge (both sources skipped)", async () => {
    const index = loadGraphs(TEST_DATA_DIR);
    const req: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 10,
      method: "tools/call",
      params: {
        name: "research_merge",
        arguments: {
          query: "vitest",
          skip_firecrawl: true,
          skip_gh: true,
        },
      },
    };
    const res = await handleRequest(req, index, TEST_DATA_DIR);
    expect(res.id).toBe(10);
    const callResult = res.result as { content: Array<{ text: string }> };
    const content = JSON.parse(callResult.content[0].text) as { markdown: string; query: string };
    expect(content.query).toBe("vitest");
    expect(content.markdown).toContain("vitest");
  });

  it("dispatches tools/call for ask", async () => {
    const index = loadGraphs(TEST_DATA_DIR);
    const req: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "ask", arguments: { question: "testing tools" } },
    };
    const res = await handleRequest(req, index, TEST_DATA_DIR);
    const callResult = res.result as { content: Array<{ text: string }> };
    const content = JSON.parse(callResult.content[0].text);
    expect(content.results.length).toBeGreaterThan(0);
  });

  it("returns error for unknown tool", async () => {
    const index = loadGraphs(TEST_DATA_DIR);
    const req: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "nonexistent", arguments: {} },
    };
    const res = await handleRequest(req, index, TEST_DATA_DIR);
    expect(res.error).toBeDefined();
    expect(res.error!.code).toBe(-32601);
  });

  it("exa_search returns error without EXA_API_KEY", async () => {
    const prev = process.env.EXA_API_KEY;
    delete process.env.EXA_API_KEY;
    try {
      const index = loadGraphs(TEST_DATA_DIR);
      const req: JsonRpcRequest = {
        jsonrpc: "2.0",
        id: 22,
        method: "tools/call",
        params: { name: "exa_search", arguments: { query: "hello", numResults: 3, freshness: "month" } },
      };
      const res = await handleRequest(req, index, TEST_DATA_DIR);
      const callResult = res.result as { content: Array<{ text: string }> };
      const content = JSON.parse(callResult.content[0].text) as { success: boolean; error?: string };
      expect(content.success).toBe(false);
      expect(content.error).toMatch(/EXA_API_KEY/);
    } finally {
      if (prev !== undefined) process.env.EXA_API_KEY = prev;
    }
  });

  it("scrape_web returns error without FIRECRAWL_API_KEY", async () => {
    const prev = process.env.FIRECRAWL_API_KEY;
    delete process.env.FIRECRAWL_API_KEY;
    try {
      const index = loadGraphs(TEST_DATA_DIR);
      const req: JsonRpcRequest = {
        jsonrpc: "2.0",
        id: 20,
        method: "tools/call",
        params: { name: "scrape_web", arguments: { url: "https://example.com" } },
      };
      const res = await handleRequest(req, index, TEST_DATA_DIR);
      const callResult = res.result as { content: Array<{ text: string }> };
      const content = JSON.parse(callResult.content[0].text) as { success: boolean; error?: string };
      expect(content.success).toBe(false);
      expect(content.error).toMatch(/FIRECRAWL/);
    } finally {
      if (prev !== undefined) process.env.FIRECRAWL_API_KEY = prev;
    }
  });

  it("star_poll_status when state file is missing", async () => {
    const index = loadGraphs(TEST_DATA_DIR);
    const req: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 21,
      method: "tools/call",
      params: { name: "star_poll_status", arguments: {} },
    };
    const res = await handleRequest(req, index, TEST_DATA_DIR);
    const callResult = res.result as { content: Array<{ text: string }> };
    const content = JSON.parse(callResult.content[0].text) as { exists: boolean };
    expect(content.exists).toBe(false);
  });

  it("returns error for unknown method", async () => {
    const index = loadGraphs(TEST_DATA_DIR);
    const req: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 5,
      method: "unknown/method",
      params: {},
    };
    const res = await handleRequest(req, index, TEST_DATA_DIR);
    expect(res.error).toBeDefined();
  });
});
