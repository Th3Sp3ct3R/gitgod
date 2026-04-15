/**
 * Merge Firecrawl map() with same-origin links from header / nav / footer (and ARIA landmarks).
 * Ensures top-nav and footer routes are included even when the crawl map under-lists them.
 */

import { parse } from "node-html-parser";

export function resolveSameOriginHref(href: string | undefined, base: URL): string | null {
  if (!href) return null;
  const t = href.trim();
  if (!t || t.startsWith("#") || t.startsWith("javascript:") || t.startsWith("mailto:") || t.startsWith("tel:"))
    return null;
  try {
    const u = new URL(t, base);
    if (u.origin !== base.origin) return null;
    u.hash = "";
    return u.href;
  } catch {
    return null;
  }
}

/** Links grouped by layout region (deduped within each bucket). */
export interface LayoutLinkSets {
  header: string[];
  nav: string[];
  footer: string[];
}

const REGION_SELECTORS: Array<{ selector: string; bucket: keyof LayoutLinkSets }> = [
  { selector: "header", bucket: "header" },
  { selector: '[role="banner"]', bucket: "header" },
  { selector: "nav", bucket: "nav" },
  { selector: '[role="navigation"]', bucket: "nav" },
  { selector: "footer", bucket: "footer" },
  { selector: '[role="contentinfo"]', bucket: "footer" },
];

export function extractLayoutLinkSets(html: string, pageUrl: string): LayoutLinkSets {
  const base = new URL(pageUrl);
  const root = parse(html);

  const sets: Record<keyof LayoutLinkSets, Set<string>> = {
    header: new Set(),
    nav: new Set(),
    footer: new Set(),
  };

  for (const { selector, bucket } of REGION_SELECTORS) {
    for (const el of root.querySelectorAll(selector)) {
      for (const a of el.querySelectorAll("a[href]")) {
        const r = resolveSameOriginHref(a.getAttribute("href") ?? undefined, base);
        if (r) sets[bucket].add(r);
      }
    }
  }

  return {
    header: [...sets.header],
    nav: [...sets.nav],
    footer: [...sets.footer],
  };
}

export type MapUrlRow = { url: string; title?: string; description?: string };

/**
 * Union Firecrawl map URLs with layout-only URLs. Existing rows keep map metadata;
 * layout hits append `layout:<section>` to description. URLs only in header/nav/footer
 * are added so top-nav and footer routes are never dropped when map misses them.
 */
export function mergeMapWithLayoutLinks(mapUrls: MapUrlRow[], layout: LayoutLinkSets): MapUrlRow[] {
  const byUrl = new Map<string, MapUrlRow>();
  for (const u of mapUrls) byUrl.set(u.url, { ...u });

  const tag = (url: string, section: keyof LayoutLinkSets) => {
    const label = `layout:${section}`;
    const cur = byUrl.get(url);
    if (!cur) {
      byUrl.set(url, { url, description: label });
      return;
    }
    const desc = cur.description ?? "";
    if (desc.includes(label)) return;
    byUrl.set(url, { ...cur, description: desc ? `${desc}; ${label}` : label });
  };

  for (const u of layout.header) tag(u, "header");
  for (const u of layout.nav) tag(u, "nav");
  for (const u of layout.footer) tag(u, "footer");

  return [...byUrl.values()];
}

export function countLayoutOnlyUrls(mapUrls: MapUrlRow[], merged: MapUrlRow[]): number {
  const mapSet = new Set(mapUrls.map((u) => u.url));
  return merged.filter((u) => !mapSet.has(u.url)).length;
}
