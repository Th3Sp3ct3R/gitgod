/**
 * Trendshift Daily Explore Pipeline
 *
 * Uses `firecrawl scrape` on https://trendshift.io/ with --wait-for 5000
 * to let the JS render repo cards, then extracts GitHub links via regex.
 *
 * firecrawl map only returns trendshift.io internal links because GitHub
 * links are rendered client-side, so we scrape the full page instead.
 *
 * Data layout:
 *   data/trendshift/explore/<YYYY-MM-DD>/explore.md        — raw scraped markdown
 *   data/trendshift/explore/<YYYY-MM-DD>/repos.json        — extracted GitHub repos for that day
 *   data/trendshift/explore/<YYYY-MM-DD>/SUMMARY.md        — human-readable summary
 *   data/trendshift/explore/processed-repos.json            — dedup registry across all runs
 *
 * Config: config/firecrawl-trendshift.yaml
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { TrendshiftExploreRepo } from "../parsers/trendshift-explore.js";
import { ingestSingleRepo } from "./ingest-single.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProcessedRepoEntry {
  firstSeen: string;
  lastSeen: string;
  status: "ingested" | "skipped" | "failed";
  knowledgeGraphPath?: string;
  error?: string;
}

export interface ProcessedReposRegistry {
  repos: Record<string, ProcessedRepoEntry>;
}

export interface TrendshiftExploreScrapeOptions {
  outputDir?: string;
  waitForMs?: number;
  date?: string;
  /** Injection point for testing — override the Firecrawl scrape call. */
  scrapeMarkdown?: (url: string, waitForMs: number) => string;
}

export interface TrendshiftExploreScrapeResult {
  date: string;
  markdownPath: string;
  reposJsonPath: string;
  summaryPath: string;
  repos: TrendshiftExploreRepo[];
}

export interface TrendshiftExplorePipelineOptions {
  dataDir?: string;
  exploreDir?: string;
  waitForMs?: number;
  date?: string;
  /** Override firecrawl scrape for testing. */
  scrapeMarkdown?: (url: string, waitForMs: number) => string;
  /** Override ingest for testing. */
  ingestRepo?: (url: string, dataDir: string) => Promise<string>;
}

export interface TrendshiftExplorePipelineResult {
  date: string;
  total: number;
  new: number;
  skipped: number;
  ingested: number;
  failed: number;
  repos: TrendshiftExploreRepo[];
}

export interface TrendshiftExploreStatusResult {
  totalTracked: number;
  ingested: number;
  skipped: number;
  failed: number;
  runDates: string[];
  recentRuns: Array<{ date: string; repoCount: number }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXPLORE_URL = "https://trendshift.io/";
const DEFAULT_EXPLORE_DIR = path.join("data", "trendshift", "explore");
const DEFAULT_DATA_DIR = path.join("data");
const REGISTRY_FILENAME = "processed-repos.json";

// ---------------------------------------------------------------------------
// Map + Extract GitHub Links
// ---------------------------------------------------------------------------

/**
 * Scrape the Trendshift explore page with firecrawl and extract GitHub links.
 *
 * Uses `firecrawl scrape` with --wait-for to let JS render the repo cards,
 * then extracts [GitHub](https://github.com/owner/repo) links via regex.
 *
 * This is a single-request approach — one scrape gets all repos.
 */
export async function scrapeTrendshiftExplore(
  options: TrendshiftExploreScrapeOptions = {}
): Promise<TrendshiftExploreScrapeResult> {
  const date = options.date ?? todayISO();
  const waitForMs = options.waitForMs ?? 5000;
  const exploreDir = path.resolve(options.outputDir ?? DEFAULT_EXPLORE_DIR);
  const dayDir = path.join(exploreDir, date);
  mkdirSync(dayDir, { recursive: true });

  // Step 1: Scrape the explore page (wait for JS to render repo cards)
  console.log(`[explore] Scraping ${EXPLORE_URL} (wait: ${waitForMs}ms)`);
  const markdown = (options.scrapeMarkdown ?? runFirecrawlScrape)(EXPLORE_URL, waitForMs);

  const markdownPath = path.join(dayDir, "explore.md");
  writeFileSync(markdownPath, markdown, "utf-8");
  console.log(`[explore] Saved raw markdown to ${markdownPath} (${markdown.length} chars)`);

  // Step 2: Extract GitHub repo URLs from markdown
  // Pattern: [GitHub](https://github.com/owner/repo)
  const repos = extractGitHubReposFromMarkdown(markdown);
  console.log(`[explore] Extracted ${repos.length} unique GitHub repos`);

  if (repos.length === 0) {
    console.warn(`[explore] WARNING: No GitHub repos found. Raw markdown saved at ${markdownPath}`);
  }

  // Step 3: Save repos JSON
  const parsed = { date, sourceUrl: EXPLORE_URL, repos };
  const reposJsonPath = path.join(dayDir, "repos.json");
  writeFileSync(reposJsonPath, JSON.stringify(parsed, null, 2), "utf-8");
  console.log(`[explore] Saved ${repos.length} repos to ${reposJsonPath}`);

  // Step 4: Summary
  const summaryPath = path.join(dayDir, "SUMMARY.md");
  writeFileSync(summaryPath, buildExploreSummary(parsed), "utf-8");
  console.log(`[explore] Summary written to ${summaryPath}`);

  return {
    date,
    markdownPath,
    reposJsonPath,
    summaryPath,
    repos,
  };
}

// ---------------------------------------------------------------------------
// Dedup
// ---------------------------------------------------------------------------

/**
 * Load the processed-repos registry (creates an empty one if missing).
 */
export function loadRegistry(exploreDir: string): ProcessedReposRegistry {
  const registryPath = path.join(exploreDir, REGISTRY_FILENAME);
  if (existsSync(registryPath)) {
    return JSON.parse(readFileSync(registryPath, "utf-8")) as ProcessedReposRegistry;
  }
  return { repos: {} };
}

/**
 * Persist the processed-repos registry to disk.
 */
export function saveRegistry(exploreDir: string, registry: ProcessedReposRegistry): void {
  const registryPath = path.join(exploreDir, REGISTRY_FILENAME);
  mkdirSync(exploreDir, { recursive: true });
  writeFileSync(registryPath, JSON.stringify(registry, null, 2), "utf-8");
}

/**
 * Build a set of all repo slugs (owner-repo, lowercased) that already have
 * a knowledge-graph.json in the data directory.
 */
export function scanExistingRepoSlugs(dataDir: string): Set<string> {
  const slugs = new Set<string>();
  const resolved = path.resolve(dataDir);
  if (!existsSync(resolved)) return slugs;

  for (const entry of readdirSync(resolved)) {
    const kgPath = path.join(resolved, entry, "knowledge-graph.json");
    if (existsSync(kgPath)) {
      slugs.add(entry.toLowerCase());
    }
  }
  return slugs;
}

/**
 * Convert a GitHub URL to a slug matching the data directory convention.
 * e.g., "https://github.com/Owner/Repo" -> "owner-repo"
 */
export function slugFromGitHubUrl(url: string): string {
  const parsed = new URL(url);
  const parts = parsed.pathname
    .replace(/\.git$/, "")
    .split("/")
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length !== 2) return "";
  return `${parts[0]}-${parts[1]}`.toLowerCase();
}

/**
 * Canonical owner/repo key from a GitHub URL (lowercase).
 * e.g., "https://github.com/Owner/Repo" -> "owner/repo"
 */
function ownerRepoFromGitHubUrl(url: string): string {
  const parsed = new URL(url);
  const parts = parsed.pathname
    .replace(/\.git$/, "")
    .split("/")
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length !== 2) return "";
  return `${parts[0].toLowerCase()}/${parts[1].toLowerCase()}`;
}

/**
 * Determine which repos from the parsed explore result are new (not yet processed).
 *
 * Checks against:
 * 1. The processed-repos registry
 * 2. Existing knowledge-graph.json files in the data directory
 */
export function dedup(
  repos: TrendshiftExploreRepo[],
  registry: ProcessedReposRegistry,
  existingSlugs: Set<string>
): { newRepos: TrendshiftExploreRepo[]; skippedRepos: TrendshiftExploreRepo[] } {
  const newRepos: TrendshiftExploreRepo[] = [];
  const skippedRepos: TrendshiftExploreRepo[] = [];

  for (const repo of repos) {
    if (!repo.githubUrl) {
      skippedRepos.push(repo);
      continue;
    }

    const key = ownerRepoFromGitHubUrl(repo.githubUrl);
    const slug = slugFromGitHubUrl(repo.githubUrl);

    // Skip if already in registry as ingested
    if (registry.repos[key]?.status === "ingested") {
      skippedRepos.push(repo);
      continue;
    }

    // Skip if already has knowledge-graph.json in data/
    if (existingSlugs.has(slug)) {
      skippedRepos.push(repo);
      continue;
    }

    newRepos.push(repo);
  }

  return { newRepos, skippedRepos };
}

// ---------------------------------------------------------------------------
// Full Pipeline
// ---------------------------------------------------------------------------

/**
 * End-to-end explore pipeline:
 * 1. Scrape the explore page
 * 2. Parse and extract repos
 * 3. Dedup against existing data
 * 4. Ingest new repos via ingestSingleRepo
 * 5. Update the processed-repos registry
 * 6. Return stats
 */
export async function runTrendshiftExplorePipeline(
  options: TrendshiftExplorePipelineOptions = {}
): Promise<TrendshiftExplorePipelineResult> {
  const dataDir = path.resolve(options.dataDir ?? DEFAULT_DATA_DIR);
  const exploreDir = path.resolve(options.exploreDir ?? DEFAULT_EXPLORE_DIR);
  const date = options.date ?? todayISO();

  console.log(`\n[explore-pipeline] Starting for date: ${date}`);
  console.log(`[explore-pipeline] Data dir: ${dataDir}`);
  console.log(`[explore-pipeline] Explore dir: ${exploreDir}`);

  // Step 1+2: Scrape explore page and extract GitHub repos
  const scrapeResult = await scrapeTrendshiftExplore({
    outputDir: exploreDir,
    waitForMs: options.waitForMs,
    date,
    scrapeMarkdown: options.scrapeMarkdown,
  });

  const allRepos = scrapeResult.repos;
  const total = allRepos.length;
  console.log(`[explore-pipeline] Total repos found: ${total}`);

  // Step 3: Dedup
  const registry = loadRegistry(exploreDir);
  const existingSlugs = scanExistingRepoSlugs(dataDir);
  const { newRepos, skippedRepos } = dedup(allRepos, registry, existingSlugs);
  console.log(`[explore-pipeline] New repos: ${newRepos.length}, Skipped: ${skippedRepos.length}`);

  // Update lastSeen for skipped repos
  for (const repo of skippedRepos) {
    if (!repo.githubUrl) continue;
    const key = ownerRepoFromGitHubUrl(repo.githubUrl);
    if (registry.repos[key]) {
      registry.repos[key].lastSeen = date;
    }
  }

  // Step 4: Ingest new repos
  const ingestFn = options.ingestRepo ?? ingestSingleRepo;
  let ingested = 0;
  let failed = 0;

  for (const repo of newRepos) {
    if (!repo.githubUrl) {
      failed += 1;
      continue;
    }

    const key = ownerRepoFromGitHubUrl(repo.githubUrl);
    console.log(`[explore-pipeline] Ingesting: ${key} (${repo.githubUrl})`);

    try {
      const kgPath = await ingestFn(repo.githubUrl, dataDir);
      registry.repos[key] = {
        firstSeen: registry.repos[key]?.firstSeen ?? date,
        lastSeen: date,
        status: "ingested",
        knowledgeGraphPath: kgPath,
      };
      ingested += 1;
      console.log(`[explore-pipeline] SUCCESS: ${key}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      registry.repos[key] = {
        firstSeen: registry.repos[key]?.firstSeen ?? date,
        lastSeen: date,
        status: "failed",
        error: errorMsg,
      };
      failed += 1;
      console.error(`[explore-pipeline] FAILED: ${key} — ${errorMsg}`);
    }

    // Step 5: Save registry after each repo (crash-safe)
    saveRegistry(exploreDir, registry);
  }

  // Final registry save
  saveRegistry(exploreDir, registry);

  const stats: TrendshiftExplorePipelineResult = {
    date,
    total,
    new: newRepos.length,
    skipped: skippedRepos.length,
    ingested,
    failed,
    repos: allRepos,
  };

  console.log(`\n[explore-pipeline] DONE`);
  console.log(`  Total:    ${stats.total}`);
  console.log(`  New:      ${stats.new}`);
  console.log(`  Skipped:  ${stats.skipped}`);
  console.log(`  Ingested: ${stats.ingested}`);
  console.log(`  Failed:   ${stats.failed}`);

  return stats;
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/**
 * Return stats about the explore pipeline: registry counts, run history, etc.
 */
export function getTrendshiftExploreStatus(
  exploreDir?: string
): TrendshiftExploreStatusResult {
  const resolved = path.resolve(exploreDir ?? DEFAULT_EXPLORE_DIR);
  const registry = loadRegistry(resolved);

  let ingested = 0;
  let skipped = 0;
  let failed = 0;
  for (const entry of Object.values(registry.repos)) {
    if (entry.status === "ingested") ingested += 1;
    else if (entry.status === "skipped") skipped += 1;
    else if (entry.status === "failed") failed += 1;
  }

  // Scan date directories
  const runDates: string[] = [];
  const recentRuns: Array<{ date: string; repoCount: number }> = [];

  if (existsSync(resolved)) {
    for (const entry of readdirSync(resolved).sort()) {
      // Date directories match YYYY-MM-DD
      if (!/^\d{4}-\d{2}-\d{2}$/.test(entry)) continue;
      const reposPath = path.join(resolved, entry, "repos.json");
      if (!existsSync(reposPath)) continue;
      runDates.push(entry);
      try {
        const data = JSON.parse(readFileSync(reposPath, "utf-8")) as { repos: unknown[] };
        recentRuns.push({ date: entry, repoCount: data.repos.length });
      } catch {
        recentRuns.push({ date: entry, repoCount: 0 });
      }
    }
  }

  return {
    totalTracked: Object.keys(registry.repos).length,
    ingested,
    skipped,
    failed,
    runDates,
    recentRuns: recentRuns.slice(-10),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Regex to match [GitHub](https://github.com/owner/repo) links in markdown */
const GITHUB_MARKDOWN_LINK_RE = /\[GitHub\]\((https:\/\/github\.com\/([^/\s)]+)\/([^/\s)]+))\)/g;

/**
 * Run `firecrawl scrape` on a URL with wait-for and return raw markdown.
 */
function runFirecrawlScrape(url: string, waitForMs: number): string {
  const result = spawnSync(
    "firecrawl",
    ["scrape", url, "--format", "markdown", "--wait-for", String(waitForMs)],
    {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    }
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `Firecrawl scrape failed (${result.status}): ${result.stderr || result.stdout || "unknown error"}`
    );
  }

  return result.stdout.trim();
}

/**
 * Extract unique GitHub repo entries from scraped markdown.
 * Matches [GitHub](https://github.com/owner/repo) patterns found on
 * trendshift.io explore page repo cards.
 */
function extractGitHubReposFromMarkdown(markdown: string): TrendshiftExploreRepo[] {
  const repos: TrendshiftExploreRepo[] = [];
  const seen = new Set<string>();
  let rank = 0;

  for (const match of markdown.matchAll(GITHUB_MARKDOWN_LINK_RE)) {
    const githubUrl = match[1];
    const owner = match[2].toLowerCase();
    const repo = match[3].toLowerCase();

    // Skip GitHub profile pages (no repo), meta pages, etc.
    if (!repo) continue;
    if (["settings", "pulls", "issues", "actions", "wiki", "discussions"].includes(repo)) continue;

    const key = `${owner}/${repo}`;
    if (seen.has(key)) continue;
    seen.add(key);

    rank += 1;
    repos.push({
      rank,
      repoName: key,
      trendshiftRepoUrl: "",
      githubUrl: `https://github.com/${owner}/${repo}`,
      language: undefined,
      metrics: [],
      tags: [],
      description: undefined,
    });
  }

  return repos;
}

function buildExploreSummary(result: { date: string; sourceUrl: string; repos: TrendshiftExploreRepo[] }): string {
  const lines = [
    `# Trendshift Daily Explore: ${result.date}`,
    "",
    `- Source: \`${result.sourceUrl}\``,
    `- Date: ${result.date}`,
    `- Repositories found: ${result.repos.length}`,
    "",
    "## Repositories",
    "",
  ];

  for (const repo of result.repos) {
    const rank = repo.rank ? `#${repo.rank}` : "-";
    const metrics = repo.metrics.length > 0 ? repo.metrics.join(" / ") : "n/a";
    const tags = repo.tags.length > 0 ? repo.tags.join(", ") : "none";
    lines.push(`- ${rank} \`${repo.repoName}\``);
    lines.push(`  GitHub: ${repo.githubUrl ?? "n/a"}`);
    lines.push(`  Language: ${repo.language ?? "n/a"}`);
    lines.push(`  Metrics: ${metrics}`);
    lines.push(`  Tags: ${tags}`);
    if (repo.description) {
      lines.push(`  ${repo.description}`);
    }
  }

  return lines.join("\n");
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
