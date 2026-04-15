// src/stages/ingest-domain.ts
// Domain-first ingestion: input a bare domain, discover all pages,
// scrape with cost hierarchy, classify, output structured .md to Obsidian vault.

import { existsSync, mkdirSync, writeFileSync, readdirSync, copyFileSync } from "node:fs";
import path from "node:path";
import { probeLlmsTxt, classifyContent } from "../lib/content-classifier.js";
import { fetchAndConvert, isMarkItDownAvailable } from "../lib/markitdown.js";
import { getObsidianVaultRoot } from "../lib/obsidian-vault-hook.js";
import { mapDomainWithLayout, executeScrape } from "../lib/firecrawl-router.js";
import { exaContentsTool } from "../acp/tools/exa-mcp.js";

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
}

// ─── URL Discovery ──────────────────────────────────────────────────────────

function classifyUrlType(url: string): DomainManifestEntry["url_type"] {
  const u = url.toLowerCase();
  if (u.includes("github.com/")) return "github";
  if (u.includes("/api") || u.includes("/reference") || u.includes("/endpoints")) return "api_ref";
  if (u.includes("/blog") || u.includes("/changelog") || u.includes("/news")) return "blog";
  if (u.includes("/docs") || u.includes("/guide") || u.includes("/tutorial") || u.includes("/learn"))
    return "doc";
  return "other";
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
  verbose: boolean
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

  // Deduplicate and filter to same origin
  let unique = [...new Set(urls)].filter((u) => {
    try {
      return new URL(u).origin === origin || u.includes("github.com");
    } catch {
      return false;
    }
  });

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

function injectFrontmatter(
  markdown: string,
  meta: {
    source: string;
    domain: string;
    category?: string;
    format?: string;
    confidence?: number;
    scraped_at: string;
    method: string;
  }
): string {
  const fm = [
    "---",
    `source: ${meta.source}`,
    `domain: ${meta.domain}`,
    `category: ${meta.category ?? "unknown"}`,
    `format: ${meta.format ?? "markdown"}`,
    `confidence: ${meta.confidence ?? 0}`,
    `scraped_at: ${meta.scraped_at}`,
    `method: ${meta.method}`,
    "---",
    "",
  ].join("\n");
  return fm + markdown;
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
  console.log(`  output: ${outDir}`);
  console.log(`  markitdown: ${midAvailable ? "available" : "not found"}`);

  // ── DISCOVER ──
  console.log(`\n  -- DISCOVER --`);
  const { urls, llmsContent, llmsUrl, creditsUsed: discoveryCredits } = await discoverUrls(origin, verbose);
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

  // Prioritize docs and API refs before capping
  const typePriority: Record<DomainManifestEntry["url_type"], number> = {
    doc: 0,
    api_ref: 1,
    blog: 2,
    github: 3,
    llms_txt: 4,
    other: 5,
  };
  const prioritized = filtered.sort((a, b) => typePriority[classifyUrlType(a)] - typePriority[classifyUrlType(b)]);

  const capped = prioritized.slice(0, maxPages);
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

  // ── SUMMARY ──
  console.log(`\n  -- DONE --`);
  console.log(`  scraped: ${manifest.stats.scraped}`);
  console.log(`  failed:  ${manifest.stats.failed}`);
  console.log(`  skipped: ${manifest.stats.skipped}`);
  console.log(`  credits: ${manifest.stats.total_credits}`);
  console.log(`  → ${outDir}/`);
  console.log(`  → ${manifestPath}`);

  // Vault sync if configured
  const vaultRoot = getObsidianVaultRoot();
  if (vaultRoot) {
    const domainsVault = path.join(vaultRoot, "08-gitgod", "domains", domainSlug);
    mkdirSync(domainsVault, { recursive: true });

    const mdFiles = readdirSync(outDir).filter((f) => f.endsWith(".md"));
    for (const f of mdFiles) {
      copyFileSync(path.join(outDir, f), path.join(domainsVault, f));
    }
    console.log(`  → Obsidian: ${mdFiles.length} files → ${domainsVault}/`);
  }

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return manifest;
}
