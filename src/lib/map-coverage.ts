/**
 * Compare Firecrawl map output against an authoritative URL list (llms.txt index,
 * sitemap, or explicit file) to confirm coverage or list gaps.
 */

import { parseLlmsIndex } from "./content-classifier.js";

/** Stable comparison key: no hash, trimmed path, lowercase host. */
export function normalizeCanonicalUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    u.hostname = u.hostname.toLowerCase();
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.href;
  } catch {
    return raw.trim();
  }
}

/**
 * Mintlify / many doc indexes use `page.md` in llms.txt while maps return the
 * same page without `.md`. Compare using this stem so coverage matches reality.
 */
export function normalizeDocStem(raw: string): string {
  const n = normalizeCanonicalUrl(raw);
  try {
    const u = new URL(n);
    if (u.pathname.endsWith(".md")) {
      u.pathname = u.pathname.slice(0, -3);
    }
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.href;
  } catch {
    return n;
  }
}

/** Extract <loc> URLs from sitemap XML. */
export function extractLocFromSitemap(xml: string): string[] {
  const matches = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)];
  return matches.map((m) => m[1]);
}

/** Pull http(s) links from markdown-ish text (fallback for llms-full.txt). */
export function extractMarkdownLinks(text: string): string[] {
  const matches = [...text.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)];
  return matches.map((m) => m[1]);
}

export interface CoverageDiff {
  referenceLabel: string;
  referenceCount: number;
  mapCount: number;
  mapLimit?: number;
  mapPossiblyTruncated: boolean;
  inBoth: string[];
  onlyInReference: string[];
  onlyInMap: string[];
  /** Share of reference URLs that appear in map (0–1). */
  coverageOfReference: number;
  /** True when every reference URL appears in the map set. */
  referenceFullyMapped: boolean;
  notes: string[];
}

function filterByPathPrefix(urls: string[], prefix: string | undefined): string[] {
  if (!prefix) return urls;
  const p = prefix.startsWith("/") ? prefix : `/${prefix}`;
  return urls.filter((u) => {
    try {
      return new URL(u).pathname.startsWith(p);
    } catch {
      return false;
    }
  });
}

export function compareMapToReference(
  mapUrls: string[],
  referenceUrls: string[],
  options?: {
    pathPrefix?: string;
    referenceLabel?: string;
    /** Match `docs/foo.md` (index) to mapped `docs/foo` (default true). */
    docStem?: boolean;
  }
): CoverageDiff {
  const label = options?.referenceLabel ?? "reference";
  const useStem = options?.docStem !== false;
  const norm = useStem ? normalizeDocStem : normalizeCanonicalUrl;

  let ref = referenceUrls.map(norm);
  let map = mapUrls.map(norm);

  if (options?.pathPrefix) {
    ref = filterByPathPrefix(ref, options.pathPrefix).map(norm);
    map = filterByPathPrefix(map, options.pathPrefix).map(norm);
  }

  const refSet = new Set(ref);
  const mapSet = new Set(map);

  const inBoth: string[] = [];
  const onlyInReference: string[] = [];
  const onlyInMap: string[] = [];

  for (const u of refSet) {
    if (mapSet.has(u)) inBoth.push(u);
    else onlyInReference.push(u);
  }
  for (const u of mapSet) {
    if (!refSet.has(u)) onlyInMap.push(u);
  }

  inBoth.sort();
  onlyInReference.sort();
  onlyInMap.sort();

  const denom = refSet.size;
  const coverageOfReference = denom === 0 ? 1 : inBoth.length / denom;

  const notes: string[] = [];
  if (denom === 0) {
    notes.push("Reference set is empty after filters — nothing to verify.");
  }

  return {
    referenceLabel: label,
    referenceCount: refSet.size,
    mapCount: mapSet.size,
    mapPossiblyTruncated: false,
    inBoth,
    onlyInReference,
    onlyInMap,
    coverageOfReference,
    referenceFullyMapped: onlyInReference.length === 0 && denom > 0,
    notes,
  };
}

/** Attach truncation warning when map size hits API limit. */
export function markMapTruncation(diff: CoverageDiff, mapLimit: number, rawMapLinkCount: number): CoverageDiff {
  const truncated = rawMapLinkCount >= mapLimit;
  return {
    ...diff,
    mapLimit,
    mapPossiblyTruncated: truncated,
    notes: truncated
      ? [
          ...diff.notes,
          `Firecrawl map returned ${rawMapLinkCount} URLs (limit ${mapLimit}). Increase --limit if you expect more.`,
        ]
      : diff.notes,
  };
}

export interface ReferenceFetchResult {
  label: string;
  urls: string[];
}

/**
 * Try to load an authoritative URL list: explicit --llms URL, then well-known
 * llms paths (Mintlify `/docs/llms.txt` before thin root sitemaps), then probeLlmsTxt.
 * When multiple sources exist, we pick the one with the **most URLs** (full index).
 */
export async function fetchReferenceUrlList(
  origin: string,
  options?: {
    llmsUrl?: string;
  }
): Promise<ReferenceFetchResult | null> {
  const base = origin.replace(/\/+$/, "");

  if (options?.llmsUrl) {
    const text = await fetchText(options.llmsUrl);
    if (!text) return null;
    const urls = urlsFromLlmsContent(text);
    return { label: options.llmsUrl, urls };
  }

  const candidates: ReferenceFetchResult[] = [];

  for (const path of ["/docs/llms.txt", "/llms.txt", "/documentation/llms.txt"]) {
    const url = `${base}${path}`;
    const text = await fetchText(url);
    if (text && text.length > 80) {
      const urls = urlsFromLlmsContent(text);
      if (urls.length > 0) candidates.push({ label: url, urls });
    }
  }

  const { probeLlmsTxt } = await import("./content-classifier.js");
  const probe = await probeLlmsTxt(base);

  if (probe.found && probe.content) {
    if (probe.type === "llms-full.txt") {
      const urls = extractMarkdownLinks(probe.content);
      if (urls.length > 0) candidates.push({ label: probe.url ?? `${base}/llms-full.txt`, urls });
    } else if (probe.type === "llms.txt") {
      const parsed = parseLlmsIndex(probe.content);
      const urls = parsed.map((e) => e.url);
      if (urls.length > 0) candidates.push({ label: probe.url ?? `${base}/llms.txt`, urls });
    } else if (probe.type === "sitemap") {
      const urls = extractLocFromSitemap(probe.content);
      if (urls.length > 0) candidates.push({ label: probe.url ?? `${base}/sitemap.xml`, urls });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.urls.length - a.urls.length);
  return candidates[0];
}

function urlsFromLlmsContent(text: string): string[] {
  const fromIndex = parseLlmsIndex(text);
  if (fromIndex.length > 0) return fromIndex.map((e) => e.url);
  return extractMarkdownLinks(text);
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, {
      headers: { "User-Agent": "gitgod-map-verify/1.0" },
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}
