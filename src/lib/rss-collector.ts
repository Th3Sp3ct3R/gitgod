// src/lib/rss-collector.ts
// RSS feed discovery and parsing for the stream ingestion lane.
//
// No external dependencies — uses native fetch + manual XML parsing
// to handle RSS 2.0, Atom, and most real-world feeds.
//
// Architecture: RSS gives you the same thing llms.txt gives you, but for
// NEW content over time instead of a static snapshot. llms.txt is the map
// of what currently exists. RSS is the stream of what's being added.

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RssFeedEntry {
  /** Entry title. */
  title: string;
  /** Entry URL / link. */
  url: string;
  /** Short description or summary. */
  description: string;
  /** Full content (HTML or text) if available via content:encoded or atom:content. */
  content: string | null;
  /** Author name. */
  author: string | null;
  /** Publication date as ISO string. */
  publishedAt: string | null;
  /** Unique identifier (guid in RSS, id in Atom). */
  guid: string;
}

export interface RssFeed {
  /** Feed title. */
  title: string;
  /** Feed URL that was fetched. */
  feedUrl: string;
  /** Site URL (link element). */
  siteUrl: string | null;
  /** Feed description. */
  description: string | null;
  /** Parsed entries. */
  entries: RssFeedEntry[];
}

export interface RssDiscoveryResult {
  /** Whether any feed was found. */
  found: boolean;
  /** The feed that was discovered and parsed, if any. */
  feed: RssFeed | null;
  /** All feed URLs that were probed. */
  probed: string[];
  /** The URL that succeeded, if any. */
  successUrl: string | null;
}

// ─── Feed path probing ──────────────────────────────────────────────────────

/** Common RSS/Atom feed paths, probed in priority order. */
const FEED_PATHS = [
  "/feed",
  "/rss",
  "/rss.xml",
  "/atom.xml",
  "/feed.xml",
  "/blog/feed",
  "/blog/rss",
  "/changelog/feed",
  "/changelog.xml",
  "/news/feed",
  "/.well-known/feed",
  "/feed/atom",
  "/index.xml",
] as const;

/**
 * Discover and parse an RSS/Atom feed for a domain.
 * Probes common feed paths in order, returns the first valid one.
 */
export async function discoverRssFeed(
  origin: string,
  options?: { verbose?: boolean; timeout?: number },
): Promise<RssDiscoveryResult> {
  const base = origin.replace(/\/+$/, "");
  const verbose = options?.verbose ?? false;
  const timeout = options?.timeout ?? 8000;
  const probed: string[] = [];

  for (const feedPath of FEED_PATHS) {
    const feedUrl = `${base}${feedPath}`;
    probed.push(feedUrl);

    try {
      if (verbose) console.log(`  [rss] probing ${feedUrl}...`);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const response = await fetch(feedUrl, {
        method: "GET",
        headers: { "User-Agent": "gitgod-rss/1.0", Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" },
        signal: controller.signal,
        redirect: "follow",
      });
      clearTimeout(timer);

      if (!response.ok) continue;

      const contentType = response.headers.get("content-type") ?? "";
      const text = await response.text();

      // Must look like XML with RSS or Atom markers
      if (!looksLikeFeed(text, contentType)) continue;

      const feed = parseFeed(text, feedUrl);
      if (feed && feed.entries.length > 0) {
        if (verbose) {
          console.log(`  [rss] found feed at ${feedUrl} → ${feed.entries.length} entries`);
        }
        return { found: true, feed, probed, successUrl: feedUrl };
      }
    } catch {
      // Timeout, network error, etc — try next path
      continue;
    }
  }

  if (verbose) console.log(`  [rss] no feed found after probing ${probed.length} paths`);
  return { found: false, feed: null, probed, successUrl: null };
}

// ─── Feed detection ─────────────────────────────────────────────────────────

function looksLikeFeed(text: string, contentType: string): boolean {
  // Content-type check
  if (
    contentType.includes("xml") ||
    contentType.includes("rss") ||
    contentType.includes("atom")
  ) {
    return true;
  }
  // Content sniffing — look for RSS or Atom markers in first 500 chars
  const head = text.slice(0, 500);
  return (
    head.includes("<rss") ||
    head.includes("<feed") ||
    head.includes("<channel>") ||
    head.includes("xmlns:atom")
  );
}

// ─── XML parsing (no dependencies) ──────────────────────────────────────────

/**
 * Parse an RSS 2.0 or Atom feed from raw XML text.
 * Uses regex-based extraction — handles real-world feeds without a full XML parser.
 */
export function parseFeed(xml: string, feedUrl: string): RssFeed | null {
  // Detect feed type
  if (xml.includes("<feed") && xml.includes("xmlns=\"http://www.w3.org/2005/Atom\"")) {
    return parseAtom(xml, feedUrl);
  }
  if (xml.includes("<rss") || xml.includes("<channel>")) {
    return parseRss2(xml, feedUrl);
  }
  // Try RSS as fallback
  if (xml.includes("<item>") || xml.includes("<item ")) {
    return parseRss2(xml, feedUrl);
  }
  return null;
}

function parseRss2(xml: string, feedUrl: string): RssFeed {
  const title = extractTag(xml, "title", true) ?? "Untitled Feed";
  const siteUrl = extractTag(xml, "link", true);
  const description = extractTag(xml, "description", true);

  // Extract items — split on <item> boundaries
  const items = extractRepeating(xml, "item");
  const entries: RssFeedEntry[] = items.map((itemXml) => {
    const itemTitle = extractTag(itemXml, "title") ?? "Untitled";
    const itemLink = extractTag(itemXml, "link") ?? "";
    const itemDesc = extractTag(itemXml, "description") ?? "";
    const itemContent =
      extractCdata(itemXml, "content:encoded") ??
      extractCdata(itemXml, "content") ??
      null;
    const itemAuthor =
      extractTag(itemXml, "author") ??
      extractTag(itemXml, "dc:creator") ??
      null;
    const itemPubDate = extractTag(itemXml, "pubDate") ?? null;
    const itemGuid =
      extractTag(itemXml, "guid") ?? (itemLink || `${feedUrl}#${simpleHash(itemTitle)}`);

    return {
      title: decodeEntities(itemTitle),
      url: itemLink.trim(),
      description: decodeEntities(stripHtml(itemDesc)).slice(0, 500),
      content: itemContent ? decodeEntities(itemContent) : null,
      author: itemAuthor ? decodeEntities(itemAuthor) : null,
      publishedAt: itemPubDate ? normalizeDate(itemPubDate) : null,
      guid: itemGuid,
    };
  });

  return { title: decodeEntities(title), feedUrl, siteUrl, description: description ? decodeEntities(description) : null, entries };
}

function parseAtom(xml: string, feedUrl: string): RssFeed {
  const title = extractTag(xml, "title", true) ?? "Untitled Feed";

  // Atom <link> is self-closing with href attr
  const siteLinkMatch = xml.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/);
  const siteUrl = siteLinkMatch?.[1] ?? null;

  const subtitle = extractTag(xml, "subtitle", true);

  const items = extractRepeating(xml, "entry");
  const entries: RssFeedEntry[] = items.map((entryXml) => {
    const entryTitle = extractTag(entryXml, "title") ?? "Untitled";
    // Atom links use href attribute
    const linkMatch = entryXml.match(/<link[^>]*href=["']([^"']+)["']/);
    const entryLink = linkMatch?.[1] ?? "";
    const entrySummary = extractTag(entryXml, "summary") ?? "";
    const entryContent = extractTag(entryXml, "content") ?? null;
    const entryAuthor = extractTag(entryXml, "name") ?? null; // <author><name>...</name></author>
    const entryPublished =
      extractTag(entryXml, "published") ??
      extractTag(entryXml, "updated") ??
      null;
    const entryId =
      extractTag(entryXml, "id") ?? (entryLink || `${feedUrl}#${simpleHash(entryTitle)}`);

    return {
      title: decodeEntities(entryTitle),
      url: entryLink.trim(),
      description: decodeEntities(stripHtml(entrySummary)).slice(0, 500),
      content: entryContent ? decodeEntities(entryContent) : null,
      author: entryAuthor ? decodeEntities(entryAuthor) : null,
      publishedAt: entryPublished ? normalizeDate(entryPublished) : null,
      guid: entryId,
    };
  });

  return { title: decodeEntities(title), feedUrl, siteUrl, description: subtitle ? decodeEntities(subtitle) : null, entries };
}

// ─── XML helpers ────────────────────────────────────────────────────────────

/** Extract first occurrence of a tag's text content. channelOnly = stop at first <item>/<entry>. */
function extractTag(xml: string, tag: string, channelOnly?: boolean): string | null {
  const scope = channelOnly
    ? xml.slice(0, Math.max(xml.indexOf("<item"), xml.indexOf("<entry"), xml.length))
    : xml;
  // Handle both <tag>content</tag> and <tag><![CDATA[content]]></tag>
  const cdataMatch = scope.match(
    new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, "i"),
  );
  if (cdataMatch) return cdataMatch[1].trim();

  const match = scope.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? match[1].trim() : null;
}

/** Extract CDATA content from a namespaced tag like content:encoded. */
function extractCdata(xml: string, tag: string): string | null {
  const cdataMatch = xml.match(
    new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, "i"),
  );
  if (cdataMatch) return cdataMatch[1].trim();
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? match[1].trim() : null;
}

/** Extract all instances of a repeating element. */
function extractRepeating(xml: string, tag: string): string[] {
  const results: string[] = [];
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[0]);
  }
  return results;
}

/** Strip HTML tags for plain text description. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Decode common XML/HTML entities. */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

/** Normalize date strings to ISO 8601. */
function normalizeDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toISOString();
  } catch {
    return dateStr;
  }
}

function simpleHash(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}
