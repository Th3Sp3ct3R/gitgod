import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

interface EnrichProgress {
  total: number;
  completed: number;
  failed: number;
  dead: number;
  skipped: number;
  last_index: number;
}

export interface PipelineStatus {
  slug: string;
  has_skeleton: boolean;
  has_enriched: boolean;
  has_knowledge_graph: boolean;
  stage: "not_started" | "parsed" | "enriching" | "enriched" | "synthesized";
  queue?: {
    total: number;
    completed: number;
    dead: number;
    failed: number;
    progress_pct: number;
    status: "not_started" | "in_progress" | "complete";
  };
}

export interface StarredAuditResult {
  source: "github_api" | "file";
  generated_at: string;
  data_dir: string;
  starred_total: number;
  ingested_total: number;
  overlap_total: number;
  missing_in_ingested: string[];
  ingested_not_starred: string[];
  pipeline: PipelineStatus[];
}

export interface StarredAuditOptions {
  dataDir: string;
  starredFilePath?: string;
  outputPath?: string;
}

export interface StarredAuditRunResult {
  result: StarredAuditResult;
  outputPath?: string;
}

export function normalizeRepoIdentifier(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  let candidate = value;
  if (candidate.includes("github.com/")) {
    const match = candidate.match(/github\.com\/([^/\s#?]+\/[^/\s#?]+)/i);
    if (!match) return null;
    candidate = match[1];
  }

  candidate = candidate.replace(/\.git$/i, "").replace(/\/+$/, "");
  const parts = candidate.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  return `${parts[0].toLowerCase()}/${parts[1].toLowerCase()}`;
}

function readRepoListFromFile(filePath: string): Set<string> {
  const content = readFileSync(filePath, "utf-8");
  const repos = new Set<string>();
  for (const line of content.split(/\r?\n/)) {
    const normalized = normalizeRepoIdentifier(line);
    if (normalized) repos.add(normalized);
  }
  return repos;
}

function readStarredReposFromGitHubCli(): Set<string> {
  try {
    const stdout = execFileSync(
      "gh",
      ["api", "user/starred", "--paginate", "--jq", ".[].full_name"],
      { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }
    );
    const repos = new Set<string>();
    for (const line of stdout.split(/\r?\n/)) {
      const normalized = normalizeRepoIdentifier(line);
      if (normalized) repos.add(normalized);
    }
    return repos;
  } catch (error: any) {
    const stderr = error?.stderr?.toString?.() ?? "";
    const msg = stderr || error?.message || String(error);
    throw new Error(
      `Failed to read GitHub starred repos via gh CLI. ${msg.trim()}`
    );
  }
}

function addIfRepoLike(repos: Set<string>, raw: unknown): void {
  if (typeof raw !== "string") return;
  const normalized = normalizeRepoIdentifier(raw);
  if (normalized) repos.add(normalized);
}

function collectIngestedRepos(dataDir: string): Set<string> {
  const ingested = new Set<string>();
  if (!existsSync(dataDir)) return ingested;

  const slugs = readdirSync(dataDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("."))
    .map((d) => d.name);

  for (const slug of slugs) {
    const graphPath = path.join(dataDir, slug, "knowledge-graph.json");
    if (!existsSync(graphPath)) continue;

    try {
      const raw = JSON.parse(readFileSync(graphPath, "utf-8")) as any;
      addIfRepoLike(ingested, raw.repo);
      addIfRepoLike(ingested, raw.url);
      if (Array.isArray(raw.entries)) {
        for (const entry of raw.entries) {
          addIfRepoLike(ingested, entry?.url);
          if (typeof entry?.owner === "string" && typeof entry?.repo === "string") {
            addIfRepoLike(ingested, `${entry.owner}/${entry.repo}`);
          }
        }
      }
    } catch {
      // Ignore malformed graph files during audit.
    }
  }

  return ingested;
}

function getPipelineStage(
  hasSkeleton: boolean,
  hasEnriched: boolean,
  hasKnowledgeGraph: boolean,
  hasProgress: boolean
): PipelineStatus["stage"] {
  if (hasKnowledgeGraph) return "synthesized";
  if (hasEnriched) return hasProgress ? "enriching" : "enriched";
  if (hasSkeleton || hasProgress) return hasProgress ? "enriching" : "parsed";
  return "not_started";
}

function collectPipelineStatus(dataDir: string): PipelineStatus[] {
  if (!existsSync(dataDir)) return [];

  const slugs = readdirSync(dataDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("."))
    .map((d) => d.name)
    .sort();

  const statuses: PipelineStatus[] = [];
  for (const slug of slugs) {
    const repoDir = path.join(dataDir, slug);
    const skeletonPath = path.join(repoDir, "skeleton.json");
    const enrichedPath = path.join(repoDir, "enriched.json");
    const graphPath = path.join(repoDir, "knowledge-graph.json");
    const progressPath = path.join(repoDir, ".enrich-progress.json");

    const hasSkeleton = existsSync(skeletonPath);
    const hasEnriched = existsSync(enrichedPath);
    const hasKnowledgeGraph = existsSync(graphPath);
    const hasProgress = existsSync(progressPath);

    const status: PipelineStatus = {
      slug,
      has_skeleton: hasSkeleton,
      has_enriched: hasEnriched,
      has_knowledge_graph: hasKnowledgeGraph,
      stage: getPipelineStage(hasSkeleton, hasEnriched, hasKnowledgeGraph, hasProgress),
    };

    if (hasProgress) {
      try {
        const progress = JSON.parse(readFileSync(progressPath, "utf-8")) as EnrichProgress;
        const processed = progress.completed + progress.dead + progress.failed;
        const total = Math.max(0, progress.total || 0);
        const pct = total > 0 ? Math.round((processed / total) * 10000) / 100 : 0;
        status.queue = {
          total,
          completed: progress.completed || 0,
          dead: progress.dead || 0,
          failed: progress.failed || 0,
          progress_pct: pct,
          status: total > 0 && processed >= total ? "complete" : processed > 0 ? "in_progress" : "not_started",
        };
      } catch {
        // Ignore malformed progress files during audit.
      }
    }

    statuses.push(status);
  }

  return statuses;
}

function sortedSetDifference(source: Set<string>, against: Set<string>): string[] {
  const output: string[] = [];
  for (const value of source) {
    if (!against.has(value)) output.push(value);
  }
  return output.sort();
}

function buildMarkdownReport(result: StarredAuditResult): string {
  const lines: string[] = [];
  lines.push("# GitGod Starred vs Ingested Audit");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Source: ${result.source}`);
  lines.push(`Data dir: \`${result.data_dir}\``);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Starred repos: **${result.starred_total}**`);
  lines.push(`- Ingested repos: **${result.ingested_total}**`);
  lines.push(`- Overlap: **${result.overlap_total}**`);
  lines.push(`- Missing in GitGod: **${result.missing_in_ingested.length}**`);
  lines.push(`- Ingested but not starred: **${result.ingested_not_starred.length}**`);
  lines.push("");
  lines.push("## Pipeline Queue");
  lines.push("");
  lines.push("| Slug | Stage | Skeleton | Enriched | KG | Progress |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const p of result.pipeline) {
    const progress = p.queue
      ? `${p.queue.progress_pct}% (${p.queue.completed}/${p.queue.total}, dead:${p.queue.dead}, failed:${p.queue.failed})`
      : "n/a";
    lines.push(
      `| ${p.slug} | ${p.stage} | ${p.has_skeleton ? "✓" : ""} | ${p.has_enriched ? "✓" : ""} | ${
        p.has_knowledge_graph ? "✓" : ""
      } | ${progress} |`
    );
  }
  lines.push("");
  lines.push("## Missing Ingestions (starred but not in GitGod)");
  lines.push("");
  if (result.missing_in_ingested.length === 0) {
    lines.push("- None");
  } else {
    for (const repo of result.missing_in_ingested) {
      lines.push(`- ${repo}`);
    }
  }
  lines.push("");
  lines.push("## Ingested But Not Starred");
  lines.push("");
  if (result.ingested_not_starred.length === 0) {
    lines.push("- None");
  } else {
    for (const repo of result.ingested_not_starred) {
      lines.push(`- ${repo}`);
    }
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

export function auditStarred(options: StarredAuditOptions): StarredAuditRunResult {
  const dataDir = path.resolve(options.dataDir);
  const source = options.starredFilePath ? "file" : "github_api";
  const starred = options.starredFilePath
    ? readRepoListFromFile(path.resolve(options.starredFilePath))
    : readStarredReposFromGitHubCli();
  const ingested = collectIngestedRepos(dataDir);
  const pipeline = collectPipelineStatus(dataDir);

  const overlap = [...starred].filter((repo) => ingested.has(repo)).length;
  const result: StarredAuditResult = {
    source,
    generated_at: new Date().toISOString(),
    data_dir: dataDir,
    starred_total: starred.size,
    ingested_total: ingested.size,
    overlap_total: overlap,
    missing_in_ingested: sortedSetDifference(starred, ingested),
    ingested_not_starred: sortedSetDifference(ingested, starred),
    pipeline,
  };

  if (!options.outputPath) {
    return { result };
  }

  const outputPath = path.resolve(options.outputPath);
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, buildMarkdownReport(result), "utf-8");
  return { result, outputPath };
}
