import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { loadGraphs, type LoadedGraph, type GraphIndex } from "./loader.js";

const TEST_DATA_DIR = path.join(import.meta.dirname, "../../.test-data");

function setupTestData() {
  rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  mkdirSync(path.join(TEST_DATA_DIR, "test-repo"), { recursive: true });

  const graph = {
    repo: "test/repo",
    url: "https://github.com/test/repo",
    scraped_at: "2026-03-15T00:00:00Z",
    stats: { categories: 2, links: 3 },
    taxonomy: [
      {
        category: "Search",
        depth: 1,
        tools: [
          {
            name: "ToolA",
            url: "https://toola.com",
            description: "A search tool",
            link_type: "website",
            status: "alive",
            synthesis: {
              summary: "ToolA searches the web for people",
              tags: ["search", "people", "free"],
              relevance_score: 4,
              cross_categories: ["People"],
              duplicates: [],
            },
          },
          {
            name: "DeadTool",
            url: "https://dead.com",
            description: "No longer exists",
            link_type: "website",
            status: "dead",
          },
        ],
        subcategories: [
          {
            category: "People",
            depth: 2,
            tools: [
              {
                name: "ToolB",
                url: "https://github.com/test/toolb",
                description: "GitHub people finder",
                link_type: "github",
                status: "alive",
                scraped: {
                  title: "ToolB",
                  description: "Finds people on GitHub",
                  content_preview: "A tool for finding people",
                  github_meta: { stars: 1200, language: "Python", last_commit: "2026-01-01", topics: ["osint"] },
                  scraped_at: "2026-03-15T00:00:00Z",
                },
                synthesis: {
                  summary: "ToolB finds people using GitHub data",
                  tags: ["people", "github", "api-available"],
                  relevance_score: 5,
                  cross_categories: [],
                  duplicates: [],
                },
              },
            ],
            subcategories: [],
          },
        ],
      },
    ],
  };

  writeFileSync(
    path.join(TEST_DATA_DIR, "test-repo", "knowledge-graph.json"),
    JSON.stringify(graph, null, 2)
  );
}

function cleanupTestData() {
  rmSync(TEST_DATA_DIR, { recursive: true, force: true });
}

describe("loadGraphs", () => {
  it("loads all knowledge graph files from data directory", () => {
    setupTestData();
    try {
      const index = loadGraphs(TEST_DATA_DIR);
      assert.equal(index.graphs.length, 1);
      assert.equal(index.graphs[0].slug, "test-repo");
      assert.equal(index.graphs[0].repo, "test/repo");
      assert.equal(index.allTools.length, 2); // only alive tools
      assert.equal(index.allTools[0].name, "ToolA");
      assert.equal(index.allTools[1].name, "ToolB");
    } finally {
      cleanupTestData();
    }
  });

  it("flattens tools with graph slug and category path", () => {
    setupTestData();
    try {
      const index = loadGraphs(TEST_DATA_DIR);
      const toolA = index.allTools.find((t) => t.name === "ToolA");
      assert.ok(toolA);
      assert.equal(toolA.graphSlug, "test-repo");
      assert.equal(toolA.categoryPath, "Search");

      const toolB = index.allTools.find((t) => t.name === "ToolB");
      assert.ok(toolB);
      assert.equal(toolB.categoryPath, "Search > People");
    } finally {
      cleanupTestData();
    }
  });

  it("computes per-graph stats", () => {
    setupTestData();
    try {
      const index = loadGraphs(TEST_DATA_DIR);
      const graph = index.graphs[0];
      assert.equal(graph.stats.total_tools, 3); // alive + dead
      assert.equal(graph.stats.alive, 2);
      assert.equal(graph.stats.dead, 1);
      assert.equal(graph.stats.synthesized, 2);
    } finally {
      cleanupTestData();
    }
  });

  it("returns empty index when no data directory exists", () => {
    const index = loadGraphs("/nonexistent/path");
    assert.equal(index.graphs.length, 0);
    assert.equal(index.allTools.length, 0);
  });
});
