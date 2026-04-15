import { describe, expect, it } from "vitest";
import { extractLayoutLinkSets, mergeMapWithLayoutLinks, resolveSameOriginHref } from "./site-layout-map.js";

describe("resolveSameOriginHref", () => {
  it("resolves relative and strips hash", () => {
    const base = new URL("https://example.com/docs/page");
    expect(resolveSameOriginHref("/foo", base)).toBe("https://example.com/foo");
    expect(resolveSameOriginHref("#x", base)).toBeNull();
    expect(resolveSameOriginHref("https://other.com/", base)).toBeNull();
  });
});

describe("extractLayoutLinkSets", () => {
  it("collects header, nav, footer same-origin links", () => {
    const html = `
      <html><body>
        <header><a href="/pricing">Pricing</a><a href="https://evil.com/x">ext</a></header>
        <nav><a href="/docs">Docs</a></nav>
        <footer><a href="/legal">Legal</a></footer>
      </body></html>`;
    const r = extractLayoutLinkSets(html, "https://example.com/");
    expect(r.header).toContain("https://example.com/pricing");
    expect(r.nav).toContain("https://example.com/docs");
    expect(r.footer).toContain("https://example.com/legal");
    expect(r.header.some((u) => u.includes("evil.com"))).toBe(false);
  });
});

describe("mergeMapWithLayoutLinks", () => {
  it("adds layout-only URLs and tags overlaps", () => {
    const map = [{ url: "https://example.com/docs", title: "Docs" }];
    const layout = {
      header: [],
      nav: ["https://example.com/docs"],
      footer: ["https://example.com/footer-only"],
    };
    const m = mergeMapWithLayoutLinks(map, layout);
    expect(m.find((x) => x.url === "https://example.com/docs")?.description).toContain("layout:nav");
    expect(m.find((x) => x.url === "https://example.com/footer-only")?.description).toBe("layout:footer");
  });
});
