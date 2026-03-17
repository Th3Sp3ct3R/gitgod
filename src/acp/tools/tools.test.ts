import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { loadGraphs } from "../loader.js";
import { listGraphs } from "./list-graphs.js";
import { getStats } from "./stats.js";
import { ask } from "./ask.js";
import { find } from "./find.js";
import { compare } from "./compare.js";
import { recommend } from "./recommend.js";

const TEST_DATA_DIR = path.join(import.meta.dirname, "../../../.test-data-tools");

function makeGraph(slug: string, toolCount: number) {
  mkdirSync(path.join(TEST_DATA_DIR, slug), { recursive: true });
  const tools = Array.from({ length: toolCount }, (_, i) => ({
    name: `Tool${i}`,
    url: `https://tool${i}.com`,
    description: `Tool ${i}`,
    link_type: "website",
    status: i < toolCount - 1 ? "alive" : "dead",
    synthesis: i < toolCount - 1 ? {
      summary: `Tool ${i} does things`,
      tags: ["tag-a", i % 2 === 0 ? "tag-b" : "tag-c"],
      relevance_score: (i % 5) + 1,
      cross_categories: [],
      duplicates: [],
    } : undefined,
  }));

  const graph = {
    repo: `user/${slug}`,
    url: `https://github.com/user/${slug}`,
    scraped_at: "2026-03-15T00:00:00Z",
    stats: { categories: 1, links: toolCount },
    taxonomy: [{ category: "Main", depth: 1, tools, subcategories: [] }],
  };
  writeFileSync(path.join(TEST_DATA_DIR, slug, "knowledge-graph.json"), JSON.stringify(graph));
}

function setup() {
  rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  makeGraph("repo-a", 5);
  makeGraph("repo-b", 3);
}

function cleanup() {
  rmSync(TEST_DATA_DIR, { recursive: true, force: true });
}

describe("listGraphs", () => {
  beforeEach(() => setup());
  afterEach(() => cleanup());

  it("returns all graphs with stats", () => {
    const index = loadGraphs(TEST_DATA_DIR);
    const result = listGraphs(index);
    expect(result.total_graphs).toBe(2);
    expect(result.graphs.length).toBe(2);
    expect(result.graphs[0].slug).toBeDefined();
    expect(result.graphs[0].stats.total_tools).toBeGreaterThan(0);
  });
});

describe("getStats", () => {
  beforeEach(() => setup());
  afterEach(() => cleanup());

  it("returns aggregate stats across all graphs", () => {
    const index = loadGraphs(TEST_DATA_DIR);
    const result = getStats(index, {});
    expect(result.total_graphs).toBe(2);
    expect(result.total_tools).toBeGreaterThan(0);
    expect(result.total_alive).toBeGreaterThan(0);
    expect(result.tag_distribution["tag-a"]).toBeGreaterThan(0);
    expect(result.score_distribution).toBeDefined();
    expect(result.top_tools.length).toBeGreaterThan(0);
  });

  it("returns stats for a single graph when filtered", () => {
    const index = loadGraphs(TEST_DATA_DIR);
    const result = getStats(index, { graph: "repo-a" });
    expect(result.total_graphs).toBe(1);
  });
});

describe("ask", () => {
  beforeEach(() => setup());
  afterEach(() => cleanup());

  it("returns tools matching a natural language question", () => {
    const index = loadGraphs(TEST_DATA_DIR);
    const result = ask(index, { question: "tools with tag-a" });
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.question).toBeDefined();
    expect(result.total_searched).toBeGreaterThan(0);
  });
});

describe("find", () => {
  beforeEach(() => setup());
  afterEach(() => cleanup());

  it("filters tools by tags", () => {
    const index = loadGraphs(TEST_DATA_DIR);
    const result = find(index, { tags: ["tag-b"] });
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results.every((r) => r.tags.includes("tag-b"))).toBe(true);
  });

  it("supports pagination", () => {
    const index = loadGraphs(TEST_DATA_DIR);
    const page1 = find(index, { limit: 2, offset: 0 });
    expect(page1.results.length).toBe(2);
    expect(page1.total).toBeGreaterThan(2);
  });
});

describe("compare", () => {
  beforeEach(() => setup());
  afterEach(() => cleanup());

  it("compares two tools side by side", () => {
    const index = loadGraphs(TEST_DATA_DIR);
    const result = compare(index, { tools: ["Tool0", "Tool1"] });
    expect(result.comparison.length).toBe(2);
    expect(Array.isArray(result.shared_tags)).toBe(true);
    expect(result.unique_tags).toBeDefined();
  });

  it("reports not_found for unknown tools", () => {
    const index = loadGraphs(TEST_DATA_DIR);
    const result = compare(index, { tools: ["Tool0", "NonExistent"] });
    expect(result.comparison.length).toBe(1);
    expect(result.not_found).toEqual(["NonExistent"]);
  });
});

describe("recommend", () => {
  beforeEach(() => setup());
  afterEach(() => cleanup());

  it("recommends tools for a use case", () => {
    const index = loadGraphs(TEST_DATA_DIR);
    const result = recommend(index, { use_case: "things with tag-a" });
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations[0].match_score).toBeGreaterThanOrEqual(0);
    expect(result.recommendations[0].match_score).toBeLessThanOrEqual(1);
  });

  it("excludes specified tools", () => {
    const index = loadGraphs(TEST_DATA_DIR);
    const result = recommend(index, { use_case: "things", exclude: ["Tool0"] });
    expect(result.recommendations.every((r) => r.name !== "Tool0")).toBe(true);
  });
});
