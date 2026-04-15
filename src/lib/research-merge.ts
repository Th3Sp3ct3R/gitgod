/**
 * Merge Firecrawl web search + `gh search repos` into one markdown report.
 * Env: FIRECRAWL_API_KEY for Firecrawl (optional if gh-only).
 */

import { spawnSync } from "node:child_process";
import Firecrawl from "firecrawl";

export interface FirecrawlHit {
  url: string;
  title?: string;
  description?: string;
}

export interface GhRepoHit {
  fullName: string;
  description: string | null;
  stargazersCount: number;
  url: string;
}

export interface ResearchMergeResult {
  query: string;
  firecrawl: FirecrawlHit[];
  firecrawlSkipped?: string;
  firecrawlError?: string;
  gh: GhRepoHit[];
  ghSkipped?: string;
  ghError?: string;
  markdown: string;
}

export type ResearchCategory = "github" | "research" | "pdf";

export interface RunResearchMergeOptions {
  query: string;
  /** Max Firecrawl web results (default 10). */
  firecrawlLimit?: number;
  /** Max `gh search repos` results (default 15). */
  ghLimit?: number;
  /** When true, skip Firecrawl even if key is set. */
  skipFirecrawl?: boolean;
  /** When true, skip GitHub CLI search. */
  skipGh?: boolean;
  /** Firecrawl search categories (e.g. github for repo-biased index). */
  firecrawlCategories?: ResearchCategory[];
}

function isFirecrawlHit(x: unknown): x is FirecrawlHit {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.url === "string";
}

function normalizeFirecrawlSearchData(data: { web?: unknown[] } | undefined): FirecrawlHit[] {
  if (!data?.web?.length) return [];
  const out: FirecrawlHit[] = [];
  for (const item of data.web) {
    if (!isFirecrawlHit(item)) continue;
    out.push({
      url: item.url,
      title: item.title,
      description: item.description,
    });
  }
  return out;
}

export async function runFirecrawlSearch(
  query: string,
  limit: number,
  categories?: ResearchCategory[]
): Promise<{ hits: FirecrawlHit[]; error?: string }> {
  const key = process.env.FIRECRAWL_API_KEY?.trim();
  if (!key) {
    return { hits: [], error: "FIRECRAWL_API_KEY not set" };
  }
  try {
    const client = new Firecrawl({ apiKey: key });
    const req: Parameters<InstanceType<typeof Firecrawl>["search"]>[1] = {
      limit,
      sources: ["web"],
    };
    if (categories?.length) {
      req.categories = categories;
    }
    const data = await client.search(query, req);
    return { hits: normalizeFirecrawlSearchData(data) };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { hits: [], error: msg };
  }
}

export function runGhRepoSearch(query: string, limit: number): { hits: GhRepoHit[]; error?: string } {
  const gh = spawnSync(
    "gh",
    ["search", "repos", query, "--sort", "stars", "-L", String(limit), "--json", "fullName,description,stargazersCount,url"],
    { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
  );
  if (gh.error) {
    return { hits: [], error: gh.error.message };
  }
  if (gh.status !== 0) {
    const err = (gh.stderr || gh.stdout || "").trim() || `exit ${gh.status}`;
    return { hits: [], error: err };
  }
  try {
    const parsed = JSON.parse(gh.stdout || "[]") as Array<{
      fullName: string;
      description: string | null;
      stargazersCount: number;
      url: string;
    }>;
    return {
      hits: parsed.map((r) => ({
        fullName: r.fullName,
        description: r.description ?? null,
        stargazersCount: r.stargazersCount ?? 0,
        url: r.url,
      })),
    };
  } catch (e: unknown) {
    return { hits: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export function formatResearchMarkdown(
  query: string,
  firecrawl: FirecrawlHit[],
  gh: GhRepoHit[],
  notes: { firecrawlSkipped?: string; firecrawlError?: string; ghSkipped?: string; ghError?: string }
): string {
  const lines: string[] = [];
  lines.push(`# Research: ${JSON.stringify(query)}`);
  lines.push("");

  lines.push("## Firecrawl (web search)");
  if (notes.firecrawlSkipped) {
    lines.push(`_${notes.firecrawlSkipped}_`);
  } else if (notes.firecrawlError) {
    lines.push(`_Error: ${notes.firecrawlError}_`);
  } else if (firecrawl.length === 0) {
    lines.push("_No web results._");
  } else {
    let i = 1;
    for (const h of firecrawl) {
      const title = h.title?.trim() || h.url;
      const desc = h.description?.trim();
      lines.push(`${i}. [${title}](${h.url})${desc ? ` — ${desc}` : ""}`);
      i++;
    }
  }
  lines.push("");

  lines.push("## GitHub (`gh search repos`)");
  if (notes.ghSkipped) {
    lines.push(`_${notes.ghSkipped}_`);
  } else if (notes.ghError) {
    lines.push(`_Error: ${notes.ghError}_`);
  } else if (gh.length === 0) {
    lines.push("_No repositories matched._");
  } else {
    let i = 1;
    for (const r of gh) {
      const desc = r.description?.trim() || "";
      lines.push(
        `${i}. **${r.fullName}** (${r.stargazersCount}★)${desc ? ` — ${desc}` : ""}`
      );
      lines.push(`   - ${r.url}`);
      i++;
    }
  }

  lines.push("");
  lines.push("## Notes");
  lines.push("- Firecrawl needs `FIRECRAWL_API_KEY`; GitHub needs `gh` CLI authenticated (`gh auth login`).");
  lines.push("- Narrow `gh` queries sometimes return empty arrays — try shorter keywords.");

  return lines.join("\n");
}

export async function runResearchMerge(options: RunResearchMergeOptions): Promise<ResearchMergeResult> {
  const q = options.query.trim();
  if (!q) throw new Error("Query cannot be empty");

  const fcLimit = Math.min(options.firecrawlLimit ?? 10, 50);
  const ghLimit = Math.min(options.ghLimit ?? 15, 100);

  let firecrawl: FirecrawlHit[] = [];
  let firecrawlSkipped: string | undefined;
  let firecrawlError: string | undefined;

  if (options.skipFirecrawl) {
    firecrawlSkipped = "Skipped (--no-firecrawl).";
  } else {
    const fc = await runFirecrawlSearch(q, fcLimit, options.firecrawlCategories);
    firecrawl = fc.hits;
    if (fc.error && fc.error.includes("not set")) {
      firecrawlSkipped = fc.error;
    } else if (fc.error) {
      firecrawlError = fc.error;
    }
  }

  let gh: GhRepoHit[] = [];
  let ghSkipped: string | undefined;
  let ghError: string | undefined;

  if (options.skipGh) {
    ghSkipped = "Skipped (--no-gh).";
  } else {
    const g = runGhRepoSearch(q, ghLimit);
    gh = g.hits;
    if (g.error?.includes("ENOENT") || g.error?.toLowerCase().includes("spawn")) {
      ghSkipped = "GitHub CLI (`gh`) not found on PATH.";
    } else if (g.error) {
      ghError = g.error;
    }
  }

  const markdown = formatResearchMarkdown(q, firecrawl, gh, {
    firecrawlSkipped,
    firecrawlError,
    ghSkipped,
    ghError,
  });

  return {
    query: q,
    firecrawl,
    firecrawlSkipped,
    firecrawlError,
    gh,
    ghSkipped,
    ghError,
    markdown,
  };
}
