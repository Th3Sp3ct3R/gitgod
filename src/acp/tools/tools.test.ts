import { describe, it } from "node:test";
import assert from "node:assert";
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
  it("returns all graphs with stats", () => {
    setup();
    try {
      const index = loadGraphs(TEST_DATA_DIR);
      const result = listGraphs(index);
      assert.equal(result.total_graphs, 2);
      assert.equal(result.graphs.length, 2);
      assert.ok(result.graphs[0].slug);
      assert.ok(result.graphs[0].stats.total_tools > 0);
    } finally {
      cleanup();
    }
  });
});

describe("getStats", () => {
  it("returns aggregate stats across all graphs", () => {
    setup();
    try {
      const index = loadGraphs(TEST_DATA_DIR);
      const result = getStats(index, {});
      assert.equal(result.total_graphs, 2);
      assert.ok(result.total_tools > 0);
      assert.ok(result.total_alive > 0);
      assert.ok(result.tag_distribution["tag-a"] > 0);
      assert.ok(result.score_distribution);
      assert.ok(result.top_tools.length > 0);
    } finally {
      cleanup();
    }
  });

  it("returns stats for a single graph when filtered", () => {
    setup();
    try {
      const index = loadGraphs(TEST_DATA_DIR);
      const result = getStats(index, { graph: "repo-a" });
      assert.equal(result.total_graphs, 1);
    } finally {
      cleanup();
    }
  });
});

describe("ask", () => {
  it("returns tools matching a natural language question", () => {
    setup();
    try {
      const index = loadGraphs(TEST_DATA_DIR);
      const result = ask(index, { question: "tools with tag-a" });
      assert.ok(result.results.length > 0);
      assert.ok(result.question);
      assert.ok(result.total_searched > 0);
    } finally {
      cleanup();
    }
  });
});

describe("find", () => {
  it("filters tools by tags", () => {
    setup();
    try {
      const index = loadGraphs(TEST_DATA_DIR);
      const result = find(index, { tags: ["tag-b"] });
      assert.ok(result.results.length > 0);
      assert.ok(result.results.every((r) => r.tags.includes("tag-b")));
    } finally {
      cleanup();
    }
  });

  it("supports pagination", () => {
    setup();
    try {
      const index = loadGraphs(TEST_DATA_DIR);
      const page1 = find(index, { limit: 2, offset: 0 });
      const page2 = find(index, { limit: 2, offset: 2 });
      assert.equal(page1.results.length, 2);
      assert.ok(page1.total > 2);
    } finally {
      cleanup();
    }
  });
});

describe("compare", () => {
  it("compares two tools side by side", () => {
    setup();
    try {
      const index = loadGraphs(TEST_DATA_DIR);
      const result = compare(index, { tools: ["Tool0", "Tool1"] });
      assert.equal(result.comparison.length, 2);
      assert.ok(Array.isArray(result.shared_tags));
      assert.ok(result.unique_tags);
    } finally {
      cleanup();
    }
  });

  it("reports not_found for unknown tools", () => {
    setup();
    try {
      const index = loadGraphs(TEST_DATA_DIR);
      const result = compare(index, { tools: ["Tool0", "NonExistent"] });
      assert.equal(result.comparison.length, 1);
      assert.deepStrictEqual(result.not_found, ["NonExistent"]);
    } finally {
      cleanup();
    }
  });
});

describe("recommend", () => {
  it("recommends tools for a use case", () => {
    setup();
    try {
      const index = loadGraphs(TEST_DATA_DIR);
      const result = recommend(index, { use_case: "things with tag-a" });
      assert.ok(result.recommendations.length > 0);
      assert.ok(result.recommendations[0].match_score >= 0);
      assert.ok(result.recommendations[0].match_score <= 1);
    } finally {
      cleanup();
    }
  });

  it("excludes specified tools", () => {
    setup();
    try {
      const index = loadGraphs(TEST_DATA_DIR);
      const result = recommend(index, { use_case: "things", exclude: ["Tool0"] });
      assert.ok(result.recommendations.every((r) => r.name !== "Tool0"));
    } finally {
      cleanup();
    }
  });
});
