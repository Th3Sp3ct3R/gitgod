import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  parseTrendshiftTopicMarkdown,
  type TrendshiftTopicParseResult,
} from "../parsers/trendshift-topic.js";

export interface TrendshiftMapTopicsOptions {
  outputDir?: string;
  limit?: number;
  mapUrls?: (url: string, limit: number) => unknown[];
}

export interface TrendshiftMapTopicsResult {
  sourceUrl: string;
  topics: string[];
  outputPath: string;
}

export interface TrendshiftScrapeTopicOptions {
  outputDir?: string;
  waitForMs?: number;
  scrapeMarkdown?: (url: string, waitForMs: number) => string;
}

export interface TrendshiftScrapeTopicResult {
  topicUrl: string;
  markdownPath: string;
}

export interface TrendshiftExtractReposOptions {
  outputDir?: string;
}

export async function mapTrendshiftTopics(
  url: string,
  options: TrendshiftMapTopicsOptions = {}
): Promise<TrendshiftMapTopicsResult> {
  assertTrendshiftTopicsIndexUrl(url);
  const limit = options.limit ?? 1000;
  const outputDir = path.resolve(options.outputDir ?? path.join("data", "trendshift", "topics-index"));
  mkdirSync(outputDir, { recursive: true });

  const urls = (options.mapUrls ?? runFirecrawlMap)(url, limit);
  const topics = [
    ...new Set(
      urls
        .map(extractUrl)
        .filter(isTrendshiftTopicPageUrl)
        .map(canonicalizeTrendshiftTopicUrl)
    ),
  ].sort();
  const outputPath = path.join(outputDir, "topics.json");
  writeFileSync(
    outputPath,
    JSON.stringify(
      {
        sourceUrl: url,
        topics,
      },
      null,
      2
    ),
    "utf-8"
  );

  return {
    sourceUrl: url,
    topics,
    outputPath,
  };
}

export async function scrapeTrendshiftTopicMarkdown(
  url: string,
  options: TrendshiftScrapeTopicOptions = {}
): Promise<TrendshiftScrapeTopicResult> {
  assertTrendshiftTopicUrl(url);
  const waitForMs = options.waitForMs ?? 3000;
  const slug = slugFromTopicUrl(url);
  const outputDir = path.resolve(options.outputDir ?? path.join("data", "trendshift", slug));
  mkdirSync(outputDir, { recursive: true });

  const scrapedMarkdown = (options.scrapeMarkdown ?? runFirecrawlScrape)(url, waitForMs);
  const markdownPath = path.join(outputDir, "topic.md");
  writeFileSync(markdownPath, scrapedMarkdown, "utf-8");

  return {
    topicUrl: url,
    markdownPath,
  };
}

export async function extractTrendshiftRepos(
  markdownPath: string,
  topicUrl: string,
  options: TrendshiftExtractReposOptions = {}
): Promise<TrendshiftTopicParseResult & { outputPath: string; summaryPath: string }> {
  assertTrendshiftTopicUrl(topicUrl);
  const resolvedMarkdownPath = path.resolve(markdownPath);
  const slug = slugFromTopicUrl(topicUrl);
  const outputDir = path.resolve(options.outputDir ?? path.dirname(resolvedMarkdownPath) ?? path.join("data", "trendshift", slug));
  mkdirSync(outputDir, { recursive: true });

  const markdown = readFileSync(resolvedMarkdownPath, "utf-8");
  const parsed = parseTrendshiftTopicMarkdown(markdown, topicUrl);
  if (parsed.repos.length === 0) {
    throw new Error(
      `No repositories extracted from ${topicUrl}. Raw markdown saved at ${resolvedMarkdownPath}.`
    );
  }

  const outputPath = path.join(outputDir, "repos.json");
  const summaryPath = path.join(outputDir, "SUMMARY.md");
  writeFileSync(outputPath, JSON.stringify(parsed, null, 2), "utf-8");
  writeFileSync(summaryPath, buildSummary(parsed), "utf-8");

  return {
    ...parsed,
    outputPath,
    summaryPath,
  };
}

function runFirecrawlMap(url: string, limit: number): unknown[] {
  const result = spawnSync("firecrawl", ["map", url, "--limit", String(limit), "--json"], {
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `Firecrawl map failed (${result.status}): ${result.stderr || result.stdout || "unknown error"}`
    );
  }

  const parsed = JSON.parse(result.stdout) as {
    links?: unknown[];
    urls?: unknown[];
    data?: unknown[] | { links?: unknown[] };
  };

  if (Array.isArray(parsed.links)) return parsed.links;
  if (Array.isArray(parsed.urls)) return parsed.urls;
  if (Array.isArray(parsed.data)) return parsed.data;
  if (parsed.data && typeof parsed.data === "object" && Array.isArray(parsed.data.links)) {
    return parsed.data.links;
  }
  return [];
}

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

function buildSummary(result: TrendshiftTopicParseResult): string {
  const lines = [
    `# Trendshift Topic: ${result.topicName}`,
    "",
    `- Topic URL: \`${result.topicUrl}\``,
    `- Repositories extracted: ${result.repos.length}`,
    "",
    "## Repositories",
    "",
  ];

  for (const repo of result.repos) {
    const metrics = repo.metrics.length > 0 ? repo.metrics.join(" / ") : "n/a";
    const tags = repo.tags.length > 0 ? repo.tags.join(", ") : "none";
    lines.push(`- \`${repo.repoName}\``);
    lines.push(`  GitHub: ${repo.githubUrl ?? "n/a"}`);
    lines.push(`  Language: ${repo.language ?? "n/a"}`);
    lines.push(`  Metrics: ${metrics}`);
    lines.push(`  Tags: ${tags}`);
  }

  return lines.join("\n");
}

function assertTrendshiftTopicsIndexUrl(rawUrl: string): void {
  const parsed = new URL(rawUrl);
  if (parsed.hostname !== "trendshift.io" || parsed.pathname !== "/topics") {
    throw new Error(`Expected Trendshift topics index URL, got ${rawUrl}`);
  }
}

function assertTrendshiftTopicUrl(rawUrl: string): void {
  const parsed = new URL(rawUrl);
  if (parsed.hostname !== "trendshift.io") {
    throw new Error(`Expected trendshift.io host, got ${parsed.hostname}`);
  }
  if (!/^\/topics\/[^/]+\/?$/.test(parsed.pathname)) {
    throw new Error(`Expected /topics/<slug> URL, got ${parsed.pathname}`);
  }
}

function isTrendshiftTopicPageUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname === "trendshift.io" && /^\/topics\/[^/]+\/?$/.test(parsed.pathname);
  } catch {
    return false;
  }
}

function extractUrl(entry: unknown): string {
  if (typeof entry === "string") {
    return entry;
  }
  if (entry && typeof entry === "object" && "url" in entry) {
    const value = (entry as { url?: unknown }).url;
    return typeof value === "string" ? value : "";
  }
  return "";
}

function canonicalizeTrendshiftTopicUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  return parsed.toString();
}

function slugFromTopicUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  return parsed.pathname.split("/").filter(Boolean).at(-1) ?? "unknown-topic";
}
