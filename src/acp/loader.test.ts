import { describe, it, expect, beforeEach, afterEach } from "vitest";
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
  beforeEach(() => setupTestData());
  afterEach(() => cleanupTestData());

  it("loads all knowledge graph files from data directory", () => {
    const index = loadGraphs(TEST_DATA_DIR);
    expect(index.graphs.length).toBe(1);
    expect(index.graphs[0].slug).toBe("test-repo");
    expect(index.graphs[0].repo).toBe("test/repo");
    expect(index.allTools.length).toBe(2);
    expect(index.allTools[0].name).toBe("ToolA");
    expect(index.allTools[1].name).toBe("ToolB");
  });

  it("flattens tools with graph slug and category path", () => {
    const index = loadGraphs(TEST_DATA_DIR);
    const toolA = index.allTools.find((t) => t.name === "ToolA");
    expect(toolA).toBeDefined();
    expect(toolA!.graphSlug).toBe("test-repo");
    expect(toolA!.categoryPath).toBe("Search");

    const toolB = index.allTools.find((t) => t.name === "ToolB");
    expect(toolB).toBeDefined();
    expect(toolB!.categoryPath).toBe("Search > People");
  });

  it("computes per-graph stats", () => {
    const index = loadGraphs(TEST_DATA_DIR);
    const graph = index.graphs[0];
    expect(graph.stats.total_tools).toBe(3);
    expect(graph.stats.alive).toBe(2);
    expect(graph.stats.dead).toBe(1);
    expect(graph.stats.synthesized).toBe(2);
  });

  it("returns empty index when no data directory exists", () => {
    const index = loadGraphs("/nonexistent/path");
    expect(index.graphs.length).toBe(0);
    expect(index.allTools.length).toBe(0);
  });
});
