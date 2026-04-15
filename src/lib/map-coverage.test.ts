import { describe, expect, it } from "vitest";
import {
  compareMapToReference,
  extractLocFromSitemap,
  extractMarkdownLinks,
  normalizeCanonicalUrl,
  normalizeDocStem,
} from "./map-coverage.js";

describe("normalizeCanonicalUrl", () => {
  it("drops hash and normalizes host", () => {
    expect(normalizeCanonicalUrl("HTTPS://ExAmPlE.com/a/b/#x")).toBe("https://example.com/a/b");
  });
});

describe("normalizeDocStem", () => {
  it("strips .md from doc paths for comparison", () => {
    expect(normalizeDocStem("https://ex.com/docs/page.md")).toBe("https://ex.com/docs/page");
  });
});

describe("extractLocFromSitemap", () => {
  it("parses loc tags", () => {
    const xml = `<?xml version="1.0"?><urlset><url><loc>https://a.com/one</loc></url><url><loc>https://a.com/two</loc></url></urlset>`;
    expect(extractLocFromSitemap(xml)).toEqual(["https://a.com/one", "https://a.com/two"]);
  });
});

describe("extractMarkdownLinks", () => {
  it("finds markdown links", () => {
    const md = "- [T](https://x.com/y): desc";
    expect(extractMarkdownLinks(md)).toContain("https://x.com/y");
  });
});

describe("compareMapToReference", () => {
  it("reports gaps and coverage", () => {
    const diff = compareMapToReference(
      ["https://ex.com/docs/a", "https://ex.com/extra"],
      ["https://ex.com/docs/a", "https://ex.com/docs/b"],
      { pathPrefix: "/docs" }
    );
    expect(diff.referenceCount).toBe(2);
    expect(diff.onlyInReference).toEqual(["https://ex.com/docs/b"]);
    expect(diff.onlyInMap).toEqual([]);
    expect(diff.coverageOfReference).toBe(0.5);
    expect(diff.referenceFullyMapped).toBe(false);
  });

  it("matches llms .md entries to mapped pages without .md", () => {
    const diff = compareMapToReference(
      ["https://ex.com/docs/api/foo"],
      ["https://ex.com/docs/api/foo.md"],
      { pathPrefix: "/docs" }
    );
    expect(diff.referenceFullyMapped).toBe(true);
    expect(diff.coverageOfReference).toBe(1);
    expect(diff.onlyInReference).toEqual([]);
  });
});
