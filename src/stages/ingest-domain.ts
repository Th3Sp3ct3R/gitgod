// src/stages/ingest-domain.ts
// Domain-first ingestion: input a bare domain, discover all pages,
// scrape with cost hierarchy, classify, output structured .md to Obsidian vault.
//
// MapFirstDocIngestPipeline (export at bottom): map-first docs + API, then reserve slots for
// blog/changelog-style URLs when present. Same-origin only (includeGitHubDiscovery: false).
// GitHub links from llms.txt are excluded from discovery by default; use includeGitHubDiscovery
// to restore legacy behavior.

import { existsSync, mkdirSync, writeFileSync, readdirSync, copyFileSync } from "node:fs";
import path from "node:path";
import { probeLlmsTxt, classifyContent } from "../lib/content-classifier.js";
import { fetchAndConvert, isMarkItDownAvailable } from "../lib/markitdown.js";
import { getObsidianVaultRoot } from "../lib/obsidian-vault-hook.js";
import { mapDomainWithLayout, executeScrape } from "../lib/firecrawl-router.js";
import { exaContentsTool } from "../acp/tools/exa-mcp.js";
import { parseLlmsTxt, findEntryByUrl, extractAllUrls } from "../lib/llms-txt-parser.js";
import { discoverRssFeed, type RssFeed, type RssFeedEntry } from "../lib/rss-collector.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DomainManifestEntry {
  url: string;
  url_type: "doc" | "api_ref" | "blog" | "github" | "llms_txt" | "other";
  scrape_method: "llms_txt" | "markitdown" | "exa" | "firecrawl" | "skipped";
  content_category?: string;
  content_format?: string;
  classifier_confidence?: number;
  md_path?: string;
  hash?: string;
  scraped_at: string;
  error?: string;
  credits_used: number;
}

export interface DomainManifest {
  domain: string;
  discovered_at: string;
  last_updated: string;
  stats: {
    total_urls: number;
    scraped: number;
    failed: number;
    skipped: number;
    total_credits: number;
  };
  entries: DomainManifestEntry[];
}

interface IngestDomainOptions {
  dataDir: string;
  maxPages?: number;
  dryRun?: boolean;
  verbose?: boolean;
  includePatterns?: string[];
  excludePatterns?: string[];
  /**
   * When true, keep `https://github.com/...` URLs discovered via llms.txt in the URL list.
   * They are still skipped at scrape time (use repo ingest for GitHub). Default false so
   * caps apply only to same-origin doc pages.
   */
  includeGitHubDiscovery?: boolean;
  /**
   * When true: after filters, cap order is docs + API references first, then up to ~15% of
   * maxPages (min 5) for blog-style paths, then remaining slots for other same-origin pages.
   * Set automatically by {@link MapFirstDocIngestPipeline.run}.
   */
  mapFirstDocPipeline?: boolean;
  /**
   * Lane A: llms.txt-only mode. Short-circuits the pipeline:
   *   1. Probe llms.txt / llms-full.txt
   *   2. Parse structured entries (title + description + URL)
   *   3. Fetch each linked URL via plain HTTP + MarkItDown (zero credits)
   *   4. Write to vault with title/description preserved in frontmatter
   *   5. STOP. No Firecrawl map, no Exa, no SPA detection.
   * Falls through to normal pipeline if no llms.txt found.
   */
  llmsOnly?: boolean;
  /**
   * Lane B: discover and ingest RSS/Atom feeds alongside docs.
   * Probes common feed paths, parses entries, writes each as a
   * feed_entry markdown file in a _feed/ subdirectory.
   */
  rss?: boolean;
}

// ─── URL Discovery ──────────────────────────────────────────────────────────

/** Path hints for blog / product news (indexing-friendly). Checked before generic /docs. */
const BLOG_PATH_HINTS = [
  "/blog",
  "/changelog",
  "/news",
  "/articles",
  "/posts/",
  "/post/",
  "/writing",
  "/insights",
  "/journal",
  "/stories",
  "/updates",
  "/announcements",
  "/press",
  "/media/",
] as const;

function classifyUrlType(url: string): DomainManifestEntry["url_type"] {
  const u = url.toLowerCase();
  if (u.includes("github.com/")) return "github";
  // Prefer doc when path is under documentation trees (e.g. /docs/changelog)
  if (u.includes("/docs") || u.includes("/guide") || u.includes("/tutorial") || u.includes("/learn"))
    return "doc";
  if (u.includes("/api") || u.includes("/reference") || u.includes("/endpoints")) return "api_ref";
  if (BLOG_PATH_HINTS.some((h) => u.includes(h))) return "blog";
  return "other";
}

/**
 * Map-first cap: fill with /docs + /api first, reserve a slice for blog-style URLs, then other.
 */
function applyMapFirstDocCapSort(urls: string[], maxPages: number, verbose: boolean): string[] {
  const docApi: string[] = [];
  const blog: string[] = [];
  const other: string[] = [];
  for (const url of urls) {
    const t = classifyUrlType(url);
    if (t === "doc" || t === "api_ref") docApi.push(url);
    else if (t === "blog") blog.push(url);
    else other.push(url);
  }
  docApi.sort((a, b) => {
    const da = classifyUrlType(a) === "doc" ? 0 : 1;
    const db = classifyUrlType(b) === "doc" ? 0 : 1;
    return da - db || a.localeCompare(b);
  });
  blog.sort((a, b) => a.localeCompare(b));
  other.sort((a, b) => a.localeCompare(b));

  const desiredBlogSlots = Math.min(blog.length, Math.max(5, Math.round(maxPages * 0.15)));
  const docApiSlots = Math.max(0, maxPages - desiredBlogSlots);
  const docApiTaken = docApi.slice(0, docApiSlots);
  let used = docApiTaken.length;
  const blogTaken = blog.slice(0, Math.min(desiredBlogSlots, maxPages - used));
  used += blogTaken.length;
  const otherTaken = other.slice(0, maxPages - used);

  if (verbose) {
    console.log(
      `  [map-first] docs+api: ${docApiTaken.length}, blog: ${blogTaken.length}, other: ${otherTaken.length} (cap ${maxPages})`
    );
  }
  return [...docApiTaken, ...blogTaken, ...otherTaken];
}

/** Extract URLs from llms.txt content. */
function extractLinksFromLlmsTxt(content: string): string[] {
  const urls: string[] = [];
  const linkRegex = /https?:\/\/[^\s\)>\]"']+/g;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(content)) !== null) {
    urls.push(match[0]);
  }
  return [...new Set(urls)];
}

async function discoverUrls(
  origin: string,
  verbose: boolean,
  discoveryOpts?: { includeGitHubDiscovery?: boolean }
): Promise<{ urls: string[]; llmsContent?: string; llmsUrl?: string; creditsUsed: number }> {
  const urls: string[] = [];
  let llmsContent: string | undefined;
  let llmsUrl: string | undefined;
  let creditsUsed = 0;

  // 1. Probe llms.txt / llms-full.txt (free content + URLs)
  if (verbose) console.log(`  [discover] probing ${origin} for llms.txt...`);
  const probe = await probeLlmsTxt(origin);

  if (probe.found && probe.content) {
    if (probe.type === "llms-full.txt" || probe.type === "llms.txt") {
      llmsContent = probe.content;
      llmsUrl = probe.url;
      const linked = extractLinksFromLlmsTxt(probe.content);
      urls.push(...linked);
      if (verbose) console.log(`  [discover] ${probe.type} found → ${linked.length} linked URLs`);
    }
  }

  // 2. Firecrawl map for comprehensive discovery (merges with llms.txt URLs)
  try {
    if (verbose) console.log(`  [discover] running Firecrawl map for ${origin}...`);
    const mapResult = await mapDomainWithLayout(origin, { skipLayout: false });
    const mapUrls = mapResult.urls.map((u) => u.url);
    urls.push(...mapUrls);
    creditsUsed += 1 + (mapResult.layout?.layoutScrapeCredits ?? 0);
    if (verbose) {
      console.log(`  [discover] Firecrawl map → ${mapUrls.length} URLs (${mapResult.totalFound} total with layout)`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  [discover] Firecrawl map failed: ${msg} — using llms.txt fallback`);
  }

  // Deduplicate; same-origin only unless includeGitHubDiscovery (legacy llms.txt links)
  const allowGitHub = discoveryOpts?.includeGitHubDiscovery === true;
  let unique = [...new Set(urls)].filter((u) => {
    try {
      const ou = new URL(u);
      if (ou.hostname === "github.com" || ou.hostname.endsWith(".github.com")) {
        return allowGitHub;
      }
      return ou.origin === origin;
    } catch {
      return false;
    }
  });
  if (verbose && !allowGitHub) {
    const deduped = [...new Set(urls)];
    const dropped = deduped.length - unique.length;
    if (dropped > 0) {
      console.log(
        `  [discover] dropped ${dropped} non-origin URL(s) (e.g. GitHub); pass includeGitHubDiscovery to keep them in the list`
      );
    }
  }

  return { urls: unique, llmsContent, llmsUrl, creditsUsed };
}

async function scrapeWithExa(url: string): Promise<
  { ok: true; markdown: string; credits: number } | { ok: false; error: string }
> {
  const result = await exaContentsTool({ urls: [url], maxCharacters: 50_000 });
  if (!result.success) {
    return { ok: false, error: String(result.error ?? "Exa contents failed") };
  }
  const data = result as Record<string, unknown>;
  const results = (data.results ?? []) as Array<Record<string, unknown>>;
  if (results.length === 0) {
    return { ok: false, error: "Exa returned no results" };
  }
  const text = String(results[0]?.text ?? "").trim();
  if (!text) {
    return { ok: false, error: "Exa returned empty text" };
  }
  return { ok: true, markdown: text, credits: 1 };
}

// ─── Frontmatter Injection ──────────────────────────────────────────────────

/** Frontmatter type taxonomy — the discriminator field for downstream queries. */
export type FrontmatterType = "source_doc" | "feed_entry";

interface FrontmatterMeta {
  source: string;
  domain: string;
  /** Discriminator: source_doc (static lane) | feed_entry (RSS lane). */
  type?: FrontmatterType;
  /** Human-curated title from llms.txt or RSS. */
  title?: string;
  /** Human-curated description from llms.txt or RSS. */
  description?: string;
  category?: string;
  format?: string;
  confidence?: number;
  scraped_at: string;
  method: string;
  /** RSS-specific fields. */
  feed_url?: string;
  author?: string;
  published_at?: string;
  guid?: string;
  content_hash?: string;
}

function injectFrontmatter(markdown: string, meta: FrontmatterMeta): string {
  const lines: string[] = ["---"];
  lines.push(`type: ${meta.type ?? "source_doc"}`);
  lines.push(`source: ${meta.source}`);
  lines.push(`domain: ${meta.domain}`);
  if (meta.title) lines.push(`title: ${yamlEscape(meta.title)}`);
  if (meta.description) lines.push(`description: ${yamlEscape(meta.description)}`);
  lines.push(`category: ${meta.category ?? "unknown"}`);
  lines.push(`format: ${meta.format ?? "markdown"}`);
  if (meta.confidence !== undefined) lines.push(`confidence: ${meta.confidence}`);
  lines.push(`scraped_at: ${meta.scraped_at}`);
  lines.push(`method: ${meta.method}`);
  if (meta.feed_url) lines.push(`feed_url: ${meta.feed_url}`);
  if (meta.author) lines.push(`author: ${yamlEscape(meta.author)}`);
  if (meta.published_at) lines.push(`published_at: ${meta.published_at}`);
  if (meta.guid) lines.push(`guid: ${meta.guid}`);
  if (meta.content_hash) lines.push(`content_hash: ${meta.content_hash}`);
  lines.push("---", "");
  return lines.join("\n") + markdown;
}

/** Escape strings for safe YAML scalar values. */
function yamlEscape(s: string): string {
  // Wrap in quotes if it contains colons, quotes, or special YAML chars
  if (/[:\#\[\]\{\}\,\&\*\?\|\-\<\>\=\!\%\@\`]/.test(s) || s.startsWith("'") || s.startsWith('"')) {
    return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return s;
}

// ─── Hash for change detection ──────────────────────────────────────────────

function simpleHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const chr = content.charCodeAt(i);
    hash = ((hash << 5) - hash + chr) | 0;
  }
  return Math.abs(hash).toString(36);
}

// ─── URL to filename ────────────────────────────────────────────────────────

function urlToFilename(url: string): string {
  try {
    const u = new URL(url);
    let slug = u.pathname
      .replace(/^\//, "")
      .replace(/\/$/, "")
      .replace(/[\/\\]/g, "_")
      .replace(/[^a-zA-Z0-9_\-\.]/g, "_");
    if (!slug || slug === "_") slug = "index";
    return `${slug}.md`;
  } catch {
    return "page.md";
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

export async function ingestDomain(
  rawDomain: string,
  options: IngestDomainOptions
): Promise<DomainManifest> {
  // Normalize domain to origin
  let origin: string;
  try {
    const u = rawDomain.startsWith("http") ? rawDomain : `https://${rawDomain}`;
    origin = new URL(u).origin;
  } catch {
    throw new Error(`Invalid domain: ${rawDomain}`);
  }

  const domainSlug = new URL(origin).hostname.replace(/\./g, "-");
  const outDir = path.join(options.dataDir, "domains", domainSlug);
  mkdirSync(outDir, { recursive: true });

  const manifestPath = path.join(outDir, "manifest.json");
  const maxPages = options.maxPages ?? 200;
  const verbose = options.verbose ?? false;
  const dryRun = options.dryRun ?? false;

  const midAvailable = isMarkItDownAvailable();
  if (!midAvailable) {
    console.warn("  markitdown not found — falling back to raw HTML. Install: pip install markitdown[all]");
  }

  console.log(`\n[ingest-domain] ${origin}`);
  if (options.llmsOnly) {
    console.log(`  mode: llms-only (zero-credit lane — llms.txt index → fetch + markitdown)`);
  } else if (options.mapFirstDocPipeline) {
    console.log(`  mode: map-first doc ingest (docs + API first, blog slice reserved when present)`);
  }
  if (options.rss) {
    console.log(`  rss: enabled (will probe for RSS/Atom feeds)`);
  }
  console.log(`  output: ${outDir}`);
  console.log(`  markitdown: ${midAvailable ? "available" : "not found"}`);

  // ── LANE A: llms-only short-circuit ──────────────────────────────────────
  if (options.llmsOnly) {
    const llmsResult = await runLlmsOnlyLane(origin, outDir, manifestPath, verbose, dryRun);
    // After llms-only lane, optionally run RSS lane
    if (options.rss && !dryRun) {
      await runRssLane(origin, outDir, llmsResult, verbose);
      writeFileSync(manifestPath, JSON.stringify(llmsResult, null, 2));
    }
    // Vault sync
    syncToVault(outDir, new URL(origin).hostname.replace(/\./g, "-"));
    return llmsResult;
  }

  // ── DISCOVER ──
  console.log(`\n  -- DISCOVER --`);
  const includeGh = options.includeGitHubDiscovery === true;
  const { urls, llmsContent, llmsUrl, creditsUsed: discoveryCredits } = await discoverUrls(origin, verbose, {
    includeGitHubDiscovery: includeGh,
  });
  // Apply include/exclude filters
  let filtered = urls;
  if (options.includePatterns && options.includePatterns.length > 0) {
    filtered = filtered.filter((u) => options.includePatterns!.some((p) => u.includes(p)));
    if (verbose) console.log(`  [discover] include filter → ${filtered.length} URLs`);
  }
  if (options.excludePatterns && options.excludePatterns.length > 0) {
    filtered = filtered.filter((u) => !options.excludePatterns!.some((p) => u.includes(p)));
    if (verbose) console.log(`  [discover] exclude filter → ${filtered.length} URLs`);
  }

  let capped: string[];
  if (options.mapFirstDocPipeline) {
    capped = applyMapFirstDocCapSort(filtered, maxPages, verbose);
  } else {
    const typePriority: Record<DomainManifestEntry["url_type"], number> = {
      doc: 0,
      api_ref: 1,
      blog: 2,
      github: 3,
      llms_txt: 4,
      other: 5,
    };
    const prioritized = filtered.sort(
      (a, b) => typePriority[classifyUrlType(a)] - typePriority[classifyUrlType(b)]
    );
    capped = prioritized.slice(0, maxPages);
  }
  console.log(`  found ${urls.length} URLs${filtered.length !== urls.length ? ` (filtered to ${filtered.length})` : ""}${filtered.length > maxPages ? ` (capped to ${maxPages})` : ""}`);

  const manifest: DomainManifest = {
    domain: origin,
    discovered_at: new Date().toISOString(),
    last_updated: new Date().toISOString(),
    stats: { total_urls: capped.length, scraped: 0, failed: 0, skipped: 0, total_credits: discoveryCredits },
    entries: [],
  };

  if (dryRun) {
    console.log(`\n  -- DRY RUN --`);
    for (const url of capped) {
      const urlType = classifyUrlType(url);
      console.log(`  [${urlType}] ${url}`);
    }
    console.log(`\n  ${capped.length} URLs would be scraped`);
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    return manifest;
  }

  // ── SCRAPE with cost hierarchy ──
  console.log(`\n  -- SCRAPE --`);

  // Step 1: If llms-full.txt exists, save it directly (FREE)
  if (llmsContent && llmsUrl) {
    const filename = "llms-full.md";
    const mdPath = path.join(outDir, filename);
    const classified = classifyContent({
      source: llmsUrl,
      text: llmsContent,
      downstream: "knowledge_graph",
    });

    const withFm = injectFrontmatter(llmsContent, {
      source: llmsUrl,
      domain: origin,
      category: classified.category,
      format: classified.format,
      confidence: classified.confidence,
      scraped_at: new Date().toISOString(),
      method: "llms_txt",
    });

    writeFileSync(mdPath, withFm);
    manifest.entries.push({
      url: llmsUrl,
      url_type: "llms_txt",
      scrape_method: "llms_txt",
      content_category: classified.category,
      content_format: classified.format,
      classifier_confidence: classified.confidence,
      md_path: filename,
      hash: simpleHash(llmsContent),
      scraped_at: new Date().toISOString(),
      credits_used: 0,
    });
    manifest.stats.scraped++;
    console.log(`  [FREE] llms-full.txt → ${filename}`);
  }

  // Step 2-4: Process each URL through cost hierarchy
  for (let i = 0; i < capped.length; i++) {
    const url = capped[i];
    const urlType = classifyUrlType(url);
    const pct = (((i + 1) / capped.length) * 100).toFixed(0);
    process.stdout.write(`  [${pct}%] ${i + 1}/${capped.length} [${urlType}] `);

    // Skip GitHub URLs (they use GitHub API in a separate flow)
    if (urlType === "github") {
      console.log(`${url} → skipped (github)`);
      manifest.entries.push({
        url,
        url_type: "github",
        scrape_method: "skipped",
        scraped_at: new Date().toISOString(),
        credits_used: 0,
      });
      manifest.stats.skipped++;
      continue;
    }

    let markdown: string | undefined;
    let scrapeMethod: DomainManifestEntry["scrape_method"] = "skipped";
    let error: string | undefined;
    let credits = 0;

    // Cost hierarchy: exa (PAID) → fetch + markitdown (FREE) → firecrawl (PAID) for SPAs
    const exaResult = await scrapeWithExa(url);
    if (exaResult.ok) {
      markdown = exaResult.markdown;
      scrapeMethod = "exa";
      credits = exaResult.credits;
    } else {
      const fetchResult = await fetchAndConvert(url);
      if (fetchResult.ok) {
        markdown = fetchResult.markdown;
        scrapeMethod = "markitdown";
        credits = 0;
      } else if ((fetchResult as { error?: string }).error?.startsWith("SPA_DETECTED")) {
        const fcResult = await executeScrape(url);
        if (fcResult.success && fcResult.markdown) {
          markdown = fcResult.markdown;
          scrapeMethod = "firecrawl";
          credits = fcResult.creditsUsed;
        } else {
          error = fcResult.error ?? "Firecrawl failed";
          scrapeMethod = "skipped";
        }
      } else {
        error = (fetchResult as { error?: string }).error ?? "fetch failed";
        scrapeMethod = "skipped";
      }
    }

    if (markdown) {
      const classified = classifyContent({
        source: url,
        text: markdown.slice(0, 2000),
        downstream: "knowledge_graph",
      });

      const filename = urlToFilename(url);
      const mdPath = path.join(outDir, filename);
      const withFm = injectFrontmatter(markdown, {
        source: url,
        domain: origin,
        category: classified.category,
        format: classified.format,
        confidence: classified.confidence,
        scraped_at: new Date().toISOString(),
        method: scrapeMethod,
      });

      writeFileSync(mdPath, withFm);
      manifest.entries.push({
        url,
        url_type: urlType,
        scrape_method: scrapeMethod,
        content_category: classified.category,
        content_format: classified.format,
        classifier_confidence: classified.confidence,
        md_path: filename,
        hash: simpleHash(markdown),
        scraped_at: new Date().toISOString(),
        credits_used: credits,
      });
      manifest.stats.scraped++;
      manifest.stats.total_credits += credits;
      console.log(`${filename} [${classified.category}] (${scrapeMethod}${credits ? ` +${credits}c` : ""})`);
    } else {
      manifest.entries.push({
        url,
        url_type: urlType,
        scrape_method: scrapeMethod,
        error: error ?? "unknown error",
        scraped_at: new Date().toISOString(),
        credits_used: 0,
      });
      manifest.stats.failed++;
      manifest.stats.total_credits += credits;
      console.log(`FAIL ${(error ?? "unknown").slice(0, 60)}`);
    }

    // Save manifest after each URL for resume support
    manifest.last_updated = new Date().toISOString();
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }

  // ── RSS LANE (optional) ──
  if (options.rss && !dryRun) {
    await runRssLane(origin, outDir, manifest, verbose);
  }

  // ── SUMMARY ──
  console.log(`\n  -- DONE --`);
  console.log(`  scraped: ${manifest.stats.scraped}`);
  console.log(`  failed:  ${manifest.stats.failed}`);
  console.log(`  skipped: ${manifest.stats.skipped}`);
  console.log(`  credits: ${manifest.stats.total_credits}`);
  console.log(`  → ${outDir}/`);
  console.log(`  → ${manifestPath}`);

  syncToVault(outDir, domainSlug);

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return manifest;
}

// ─── Lane A: llms-only pipeline ─────────────────────────────────────────────

async function runLlmsOnlyLane(
  origin: string,
  outDir: string,
  manifestPath: string,
  verbose: boolean,
  dryRun: boolean,
): Promise<DomainManifest> {
  console.log(`\n  -- LANE A: llms-only --`);

  const probe = await probeLlmsTxt(origin);
  if (!probe.found || !probe.content || !probe.url) {
    console.log(`  no llms.txt or llms-full.txt found at ${origin}`);
    console.log(`  falling through to normal pipeline would happen here (but --llms-only stops)`);
    const manifest: DomainManifest = {
      domain: origin,
      discovered_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      stats: { total_urls: 0, scraped: 0, failed: 0, skipped: 0, total_credits: 0 },
      entries: [],
    };
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    return manifest;
  }

  // Parse the structured index
  const parsed = parseLlmsTxt(probe.content);
  const allUrls = extractAllUrls(parsed);
  console.log(`  ${probe.type} found at ${probe.url}`);
  console.log(`  header: ${parsed.header ?? "(none)"}`);
  console.log(`  structured entries: ${parsed.entries.length}`);
  console.log(`  bare URLs: ${parsed.bareUrls.length}`);
  console.log(`  total unique URLs: ${allUrls.length}`);

  const manifest: DomainManifest = {
    domain: origin,
    discovered_at: new Date().toISOString(),
    last_updated: new Date().toISOString(),
    stats: { total_urls: allUrls.length, scraped: 0, failed: 0, skipped: 0, total_credits: 0 },
    entries: [],
  };

  // Save the raw llms.txt / llms-full.txt as _meta.md
  const metaFilename = "_meta.md";
  const metaFm = injectFrontmatter(probe.content, {
    source: probe.url,
    domain: origin,
    type: "source_doc",
    title: parsed.header ?? `${new URL(origin).hostname} — llms.txt`,
    description: parsed.preamble?.slice(0, 200) ?? undefined,
    category: "llms_txt_index",
    format: "markdown",
    scraped_at: new Date().toISOString(),
    method: "llms_txt",
  });
  writeFileSync(path.join(outDir, metaFilename), metaFm);
  manifest.entries.push({
    url: probe.url,
    url_type: "llms_txt",
    scrape_method: "llms_txt",
    content_category: "llms_txt_index",
    md_path: metaFilename,
    hash: simpleHash(probe.content),
    scraped_at: new Date().toISOString(),
    credits_used: 0,
  });
  manifest.stats.scraped++;
  console.log(`  [FREE] ${probe.type} → ${metaFilename}`);

  if (dryRun) {
    console.log(`\n  -- DRY RUN --`);
    for (const entry of parsed.entries) {
      console.log(`  [${entry.title}] ${entry.url}`);
      if (entry.description) console.log(`    → ${entry.description}`);
    }
    for (const url of parsed.bareUrls) {
      console.log(`  [bare] ${url}`);
    }
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    return manifest;
  }

  // Fetch each URL via plain HTTP + MarkItDown (zero credits)
  console.log(`\n  -- SCRAPE (llms-only: fetch + markitdown, zero credits) --`);
  for (let i = 0; i < allUrls.length; i++) {
    const url = allUrls[i];
    const entry = findEntryByUrl(parsed, url);
    const pct = (((i + 1) / allUrls.length) * 100).toFixed(0);
    process.stdout.write(`  [${pct}%] ${i + 1}/${allUrls.length} `);

    // Skip GitHub URLs
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname === "github.com" || urlObj.hostname.endsWith(".github.com")) {
        console.log(`${url} → skipped (github)`);
        manifest.entries.push({
          url,
          url_type: "github",
          scrape_method: "skipped",
          scraped_at: new Date().toISOString(),
          credits_used: 0,
        });
        manifest.stats.skipped++;
        continue;
      }
    } catch { /* invalid URL, try anyway */ }

    const fetchResult = await fetchAndConvert(url);
    if (fetchResult.ok) {
      const filename = urlToFilename(url);
      const classified = classifyContent({
        source: url,
        text: fetchResult.markdown.slice(0, 2000),
        downstream: "knowledge_graph",
      });

      const withFm = injectFrontmatter(fetchResult.markdown, {
        source: url,
        domain: origin,
        type: "source_doc",
        title: entry?.title ?? undefined,
        description: entry?.description ?? undefined,
        category: classified.category,
        format: classified.format,
        confidence: classified.confidence,
        scraped_at: new Date().toISOString(),
        method: "llms_txt",
      });

      writeFileSync(path.join(outDir, filename), withFm);
      manifest.entries.push({
        url,
        url_type: classifyUrlType(url),
        scrape_method: "markitdown",
        content_category: classified.category,
        content_format: classified.format,
        classifier_confidence: classified.confidence,
        md_path: filename,
        hash: simpleHash(fetchResult.markdown),
        scraped_at: new Date().toISOString(),
        credits_used: 0,
      });
      manifest.stats.scraped++;
      const titleSuffix = entry?.title ? ` [${entry.title}]` : "";
      console.log(`${filename}${titleSuffix} (markitdown, FREE)`);
    } else {
      const error = (fetchResult as { error?: string }).error ?? "fetch failed";
      manifest.entries.push({
        url,
        url_type: classifyUrlType(url),
        scrape_method: "skipped",
        error,
        scraped_at: new Date().toISOString(),
        credits_used: 0,
      });
      manifest.stats.failed++;
      console.log(`FAIL ${error.slice(0, 60)}`);
    }

    // Save manifest incrementally
    manifest.last_updated = new Date().toISOString();
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }

  // Summary
  console.log(`\n  -- LANE A DONE --`);
  console.log(`  scraped: ${manifest.stats.scraped}`);
  console.log(`  failed:  ${manifest.stats.failed}`);
  console.log(`  credits: 0 (all free via llms.txt + markitdown)`);
  console.log(`  → ${outDir}/`);

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return manifest;
}

// ─── Lane B: RSS stream ingestion ───────────────────────────────────────────

async function runRssLane(
  origin: string,
  outDir: string,
  manifest: DomainManifest,
  verbose: boolean,
): Promise<void> {
  console.log(`\n  -- LANE B: RSS --`);

  const result = await discoverRssFeed(origin, { verbose });
  if (!result.found || !result.feed) {
    console.log(`  no RSS/Atom feed found (probed ${result.probed.length} paths)`);
    return;
  }

  const feed = result.feed;
  console.log(`  feed: ${feed.title} (${feed.feedUrl})`);
  console.log(`  entries: ${feed.entries.length}`);

  // Create _feed/ subdirectory
  const feedDir = path.join(outDir, "_feed");
  mkdirSync(feedDir, { recursive: true });

  let written = 0;
  for (const entry of feed.entries) {
    // Build filename from date + title slug
    const datePrefix = entry.publishedAt
      ? entry.publishedAt.slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const titleSlug = entry.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);
    const filename = `${datePrefix}-${titleSlug || "entry"}.md`;

    // Build content: prefer content:encoded, fall back to description
    let body = entry.content ?? entry.description ?? "";
    // Strip HTML from content for clean markdown
    body = body
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!body) body = entry.description || "(no content)";

    const withFm = injectFrontmatter(body, {
      source: entry.url,
      domain: origin,
      type: "feed_entry",
      title: entry.title,
      description: entry.description?.slice(0, 300) ?? undefined,
      category: "feed_entry",
      format: "markdown",
      scraped_at: new Date().toISOString(),
      method: "rss",
      feed_url: feed.feedUrl,
      author: entry.author ?? undefined,
      published_at: entry.publishedAt ?? undefined,
      guid: entry.guid,
      content_hash: simpleHash(body),
    });

    writeFileSync(path.join(feedDir, filename), withFm);
    manifest.entries.push({
      url: entry.url,
      url_type: "blog",
      scrape_method: "llms_txt", // reusing closest match — no RSS type in manifest enum
      content_category: "feed_entry",
      md_path: `_feed/${filename}`,
      hash: simpleHash(body),
      scraped_at: new Date().toISOString(),
      credits_used: 0,
    });
    written++;
  }

  manifest.stats.scraped += written;
  console.log(`  wrote ${written} feed entries to ${feedDir}/`);
}

// ─── Vault sync ─────────────────────────────────────────────────────────────

function syncToVault(outDir: string, domainSlug: string): void {
  const vaultRoot = getObsidianVaultRoot();
  if (!vaultRoot) return;

  const domainsVault = path.join(vaultRoot, "08-gitgod", "domains", domainSlug);
  mkdirSync(domainsVault, { recursive: true });

  // Sync top-level .md files
  const mdFiles = readdirSync(outDir).filter((f) => f.endsWith(".md"));
  for (const f of mdFiles) {
    copyFileSync(path.join(outDir, f), path.join(domainsVault, f));
  }

  // Sync _feed/ subdirectory if it exists
  const feedDir = path.join(outDir, "_feed");
  if (existsSync(feedDir)) {
    const feedVault = path.join(domainsVault, "_feed");
    mkdirSync(feedVault, { recursive: true });
    const feedFiles = readdirSync(feedDir).filter((f) => f.endsWith(".md"));
    for (const f of feedFiles) {
      copyFileSync(path.join(feedDir, f), path.join(feedVault, f));
    }
    console.log(`  → Obsidian: ${mdFiles.length} docs + ${feedFiles.length} feed entries → ${domainsVault}/`);
  } else {
    console.log(`  → Obsidian: ${mdFiles.length} files → ${domainsVault}/`);
  }
}

/**
 * Map-first documentation ingest: Firecrawl map (+ layout) discovers URLs; scrape order
 * prioritizes `/docs`-style and `/api`-style pages, reserves ~15% of `maxPages` (minimum 5)
 * for blog/changelog/product-news paths when present, then fills remaining slots with other
 * same-origin pages. Calls {@link ingestDomain} with `includeGitHubDiscovery: false` and
 * `mapFirstDocPipeline: true`. Use `ingest-single` / repo flows for GitHub.
 */
export async function mapFirstDocIngestPipeline(
  rawDomain: string,
  options: IngestDomainOptions
): Promise<DomainManifest> {
  return ingestDomain(rawDomain, {
    ...options,
    includeGitHubDiscovery: false,
    mapFirstDocPipeline: true,
  });
}

export const MapFirstDocIngestPipeline = {
  name: "map-first-doc-ingest",
  run: mapFirstDocIngestPipeline,
};
