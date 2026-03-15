import { describe, it } from "node:test";
import assert from "node:assert";
import { searchTools, filterTools, type SearchOptions, type FilterOptions } from "./search.js";
import type { IndexedTool } from "./loader.js";

const MOCK_TOOLS: IndexedTool[] = [
  {
    name: "Maltego",
    url: "https://maltego.com",
    description: "Network analysis tool",
    link_type: "website",
    status: "alive",
    summary: "Maltego performs social network analysis and data mining for investigations",
    tags: ["social-media", "network-analysis", "investigation", "commercial"],
    relevance_score: 5,
    cross_categories: ["Network Analysis"],
    duplicates: [],
    categoryPath: "OSINT > People Search",
    graphSlug: "awesome-osint",
    github_stars: undefined,
  },
  {
    name: "SpiderFoot",
    url: "https://github.com/smicallef/spiderfoot",
    description: "Automated OSINT collector",
    link_type: "github",
    status: "alive",
    summary: "SpiderFoot automates OSINT collection from 200+ data sources",
    tags: ["automation", "osint", "free", "api-available"],
    relevance_score: 5,
    cross_categories: [],
    duplicates: [],
    categoryPath: "OSINT > Automation",
    graphSlug: "awesome-osint",
    github_stars: 12000,
    github_language: "Python",
  },
  {
    name: "GeoIP",
    url: "https://geoip.com",
    description: "IP geolocation service",
    link_type: "website",
    status: "alive",
    summary: "GeoIP provides IP address geolocation lookups",
    tags: ["geolocation", "ip-address", "api-available"],
    relevance_score: 3,
    cross_categories: [],
    duplicates: [],
    categoryPath: "OSINT > Geolocation",
    graphSlug: "awesome-osint",
  },
];

describe("searchTools", () => {
  it("matches keywords in name and summary", () => {
    const results = searchTools(MOCK_TOOLS, { query: "social network analysis" });
    assert.ok(results.length > 0);
    assert.equal(results[0].name, "Maltego");
  });

  it("matches tags", () => {
    const results = searchTools(MOCK_TOOLS, { query: "geolocation" });
    assert.ok(results.length > 0);
    assert.equal(results[0].name, "GeoIP");
  });

  it("respects max_results", () => {
    const results = searchTools(MOCK_TOOLS, { query: "osint", max_results: 1 });
    assert.equal(results.length, 1);
  });

  it("filters by graph slug", () => {
    const results = searchTools(MOCK_TOOLS, { query: "osint", graph: "nonexistent" });
    assert.equal(results.length, 0);
  });

  it("returns empty for no matches", () => {
    const results = searchTools(MOCK_TOOLS, { query: "blockchain cryptocurrency" });
    assert.equal(results.length, 0);
  });
});

describe("filterTools", () => {
  it("filters by tags (any match)", () => {
    const results = filterTools(MOCK_TOOLS, { tags: ["free"] });
    assert.equal(results.length, 1);
    assert.equal(results[0].name, "SpiderFoot");
  });

  it("filters by tags_all (all must match)", () => {
    const results = filterTools(MOCK_TOOLS, { tags_all: ["api-available", "geolocation"] });
    assert.equal(results.length, 1);
    assert.equal(results[0].name, "GeoIP");
  });

  it("filters by min_score", () => {
    const results = filterTools(MOCK_TOOLS, { min_score: 5 });
    assert.equal(results.length, 2);
  });

  it("filters by category substring", () => {
    const results = filterTools(MOCK_TOOLS, { category: "People" });
    assert.equal(results.length, 1);
    assert.equal(results[0].name, "Maltego");
  });

  it("filters by link_type", () => {
    const results = filterTools(MOCK_TOOLS, { link_type: "github" });
    assert.equal(results.length, 1);
    assert.equal(results[0].name, "SpiderFoot");
  });

  it("filters by name substring", () => {
    const results = filterTools(MOCK_TOOLS, { name: "spider" });
    assert.equal(results.length, 1);
  });

  it("supports pagination with limit and offset", () => {
    const page1 = filterTools(MOCK_TOOLS, { limit: 1, offset: 0 });
    const page2 = filterTools(MOCK_TOOLS, { limit: 1, offset: 1 });
    assert.equal(page1.length, 1);
    assert.equal(page2.length, 1);
    assert.notEqual(page1[0].name, page2[0].name);
  });
});
