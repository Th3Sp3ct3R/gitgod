/**
 * Backend-only MCP helpers: Firecrawl scrape/crawl and GitHub star poller status/run.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  executeCrawl,
  executeScrape,
  type ScrapeResult,
} from "../../lib/firecrawl-router.js";

const DEFAULT_MAX_MARKDOWN = 80_000;
const ABS_MAX_MARKDOWN = 200_000;

export interface ScrapeWebArgs {
  url: string;
  mode?: "scrape" | "crawl";
  crawl_limit?: number;
  max_markdown_chars?: number;
}

function truncate(s: string | undefined, n: number): string | undefined {
  if (s == null || s === "") return undefined;
  if (s.length <= n) return s;
  return `${s.slice(0, n)}\n\n… [truncated]`;
}

function formatSinglePage(r: ScrapeResult, maxChars: number): Record<string, unknown> {
  return {
    success: r.success,
    url: r.url,
    method: r.method,
    error: r.error,
    markdown: truncate(r.markdown, maxChars),
    credits_used: r.creditsUsed,
    metadata: r.metadata,
  };
}

/**
 * Scrape one URL (default) or shallow crawl from a seed URL. Requires FIRECRAWL_API_KEY.
 */
export async function scrapeWebTool(args: ScrapeWebArgs): Promise<Record<string, unknown>> {
  const url = typeof args.url === "string" ? args.url.trim() : "";
  if (!url) {
    return { success: false, error: "url is required" };
  }
  if (!process.env.FIRECRAWL_API_KEY?.trim()) {
    return { success: false, error: "Missing FIRECRAWL_API_KEY" };
  }

  const mode = args.mode === "crawl" ? "crawl" : "scrape";
  let maxChars =
    typeof args.max_markdown_chars === "number" && args.max_markdown_chars > 0
      ? Math.min(args.max_markdown_chars, ABS_MAX_MARKDOWN)
      : DEFAULT_MAX_MARKDOWN;

  if (mode === "scrape") {
    const r = await executeScrape(url);
    return formatSinglePage(r, maxChars);
  }

  const limit =
    typeof args.crawl_limit === "number" && args.crawl_limit > 0
      ? Math.min(Math.floor(args.crawl_limit), 500)
      : 50;

  const pages = await executeCrawl(url, { limit });
  const n = pages.length || 1;
  const perPage = Math.max(1000, Math.floor(maxChars / n));

  return {
    success: pages.length > 0 && pages.every((p) => p.success),
    mode: "crawl",
    crawl_limit: limit,
    page_count: pages.length,
    pages: pages.map((p) => formatSinglePage(p, perPage)),
  };
}

interface StateFileShape {
  repos?: unknown;
  lists?: Record<string, unknown>;
}

/**
 * Read poller state (repo list + optional star lists). Uses STARRED_STATE_FILE or `<dataDir>/github-starred-state.json`.
 */
export function starPollStatus(dataDir: string): Record<string, unknown> {
  const statePath =
    process.env.STARRED_STATE_FILE?.trim() || path.join(dataDir, "github-starred-state.json");

  if (!existsSync(statePath)) {
    return { state_path: statePath, exists: false };
  }

  try {
    const raw = JSON.parse(readFileSync(statePath, "utf-8")) as StateFileShape;
    const repos = raw.repos;
    const repoCount = Array.isArray(repos) ? repos.length : 0;

    let listsSummary: Record<string, number> | undefined;
    if (raw.lists && typeof raw.lists === "object") {
      listsSummary = {};
      for (const [k, v] of Object.entries(raw.lists)) {
        listsSummary[k] = Array.isArray(v) ? v.length : 0;
      }
    }

    return {
      state_path: statePath,
      exists: true,
      repo_count: repoCount,
      list_slugs: raw.lists && typeof raw.lists === "object" ? Object.keys(raw.lists) : [],
      lists_repo_counts: listsSummary,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { state_path: statePath, exists: true, error: message };
  }
}

export interface StarPollRunArgs {
  dry_run?: boolean;
  init?: boolean;
  verbose?: boolean;
}

/**
 * Run `npx tsx scripts/poll-github-starred.ts` from process.cwd(). Requires GITHUB_TOKEN for real runs.
 */
export function starPollRunTool(args: StarPollRunArgs): Record<string, unknown> {
  const projectRoot = process.cwd();
  const scriptPath = path.join(projectRoot, "scripts", "poll-github-starred.ts");

  if (!existsSync(scriptPath)) {
    return {
      success: false,
      error: `poll script not found: ${scriptPath}`,
      hint: "Start gitgod serve from the gitgod repository root",
    };
  }

  const argv: string[] = ["tsx", scriptPath];
  if (args.dry_run) argv.push("--dry-run");
  if (args.init) argv.push("--init");
  if (args.verbose) argv.push("--verbose");

  const r = spawnSync("npx", argv, {
    cwd: projectRoot,
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
    timeout: 300_000,
    env: process.env,
  });

  return {
    success: r.status === 0,
    exit_code: r.status ?? -1,
    stdout: (r.stdout ?? "").slice(0, 120_000),
    stderr: (r.stderr ?? "").slice(0, 60_000),
    spawn_error: r.error?.message,
  };
}
