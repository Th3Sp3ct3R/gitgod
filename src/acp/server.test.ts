import { describe, it } from "node:test";
import assert from "node:assert";
import { handleRequest, type JsonRpcRequest, type JsonRpcResponse } from "./server.js";
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
  it("responds to tools/list with all tool definitions", () => {
    setup();
    try {
      const index = loadGraphs(TEST_DATA_DIR);
      const req: JsonRpcRequest = { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} };
      const res = handleRequest(req, index);
      assert.equal(res.jsonrpc, "2.0");
      assert.equal(res.id, 1);
      assert.ok(Array.isArray(res.result.tools));
      assert.equal(res.result.tools.length, 6); // ask, find, compare, recommend, list_graphs, stats
    } finally {
      cleanup();
    }
  });

  it("dispatches tools/call for list_graphs", () => {
    setup();
    try {
      const index = loadGraphs(TEST_DATA_DIR);
      const req: JsonRpcRequest = {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "list_graphs", arguments: {} },
      };
      const res = handleRequest(req, index);
      assert.equal(res.id, 2);
      const content = JSON.parse(res.result.content[0].text);
      assert.equal(content.total_graphs, 1);
    } finally {
      cleanup();
    }
  });

  it("dispatches tools/call for ask", () => {
    setup();
    try {
      const index = loadGraphs(TEST_DATA_DIR);
      const req: JsonRpcRequest = {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "ask", arguments: { question: "testing tools" } },
      };
      const res = handleRequest(req, index);
      const content = JSON.parse(res.result.content[0].text);
      assert.ok(content.results.length > 0);
    } finally {
      cleanup();
    }
  });

  it("returns error for unknown tool", () => {
    setup();
    try {
      const index = loadGraphs(TEST_DATA_DIR);
      const req: JsonRpcRequest = {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "nonexistent", arguments: {} },
      };
      const res = handleRequest(req, index);
      assert.ok(res.error);
      assert.equal(res.error.code, -32601);
    } finally {
      cleanup();
    }
  });

  it("returns error for unknown method", () => {
    setup();
    try {
      const index = loadGraphs(TEST_DATA_DIR);
      const req: JsonRpcRequest = {
        jsonrpc: "2.0",
        id: 5,
        method: "unknown/method",
        params: {},
      };
      const res = handleRequest(req, index);
      assert.ok(res.error);
    } finally {
      cleanup();
    }
  });
});
