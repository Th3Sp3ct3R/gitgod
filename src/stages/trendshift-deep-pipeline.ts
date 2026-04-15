import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { decompose } from "./decompose.js";
import { harness } from "./harness.js";
import { ingestSingleRepo } from "./ingest-single.js";
import type { HarnessResult } from "../types.js";

export interface TrendshiftCanonicalRepo {
  repoName: string;
  canonicalGitHubUrl: string;
  repoSlug: string;
  trendshiftRepoUrls: string[];
  sourceTags: string[];
  description?: string;
  language?: string;
  metrics?: number[];
}

export interface TrendshiftTopicPipelineState {
  state: "discovered" | "ingested" | "decomposed" | "decomposed_no_harness" | "harnessed" | "failed";
  knowledgeGraphPath?: string;
  decompositionPath?: string;
  checkoutPath?: string;
  harnessSkillMdPath?: string;
  harnessCachePath?: string;
  workflowPath?: string;
  error?: string;
  updatedAt?: string;
}

export interface TrendshiftTopicManifestEntry extends TrendshiftCanonicalRepo {
  pipeline: TrendshiftTopicPipelineState;
}

export interface TrendshiftTopicManifest {
  topicName: string;
  topicUrl: string;
  generatedAt: string;
  repos: TrendshiftTopicManifestEntry[];
}

interface TrendshiftReposFile {
  topicName: string;
  topicUrl: string;
  repos: Array<{
    repoName: string;
    trendshiftRepoUrl: string;
    githubUrl?: string;
    tags?: string[];
    metrics?: number[];
    description?: string;
    language?: string;
  }>;
}

export interface BuildTrendshiftTopicCanonicalManifestOptions {
  outputDir?: string;
}

export interface BuildTrendshiftTopicCanonicalManifestResult {
  canonicalRepos: TrendshiftCanonicalRepo[];
  canonicalReposPath: string;
  manifestPath: string;
}

export interface RunTrendshiftTopicDeepPipelineOptions {
  pipelineDataDir?: string;
  checkoutRootDir?: string;
  cloneRepository?: (url: string, slug: string, checkoutRootDir: string) => Promise<string>;
  ingestRepository?: (url: string, dataDir: string) => Promise<string>;
  decomposeKnowledgeGraph?: (knowledgeGraphPath: string) => Promise<string>;
  harnessRepository?: (args: {
    slug: string;
    repoPath: string;
    decompositionPath: string;
    pipelineDataDir: string;
  }) => Promise<HarnessResult>;
}

export async function buildTrendshiftTopicCanonicalManifest(
  reposJsonPath: string,
  options: BuildTrendshiftTopicCanonicalManifestOptions = {}
): Promise<BuildTrendshiftTopicCanonicalManifestResult> {
  const input = JSON.parse(readFileSync(reposJsonPath, "utf-8")) as TrendshiftReposFile;
  const outputDir = path.resolve(options.outputDir ?? path.dirname(reposJsonPath));
  mkdirSync(outputDir, { recursive: true });

  const byCanonicalUrl = new Map<string, TrendshiftCanonicalRepo>();

  for (const repo of input.repos) {
    if (!repo.githubUrl) continue;
    const canonicalGitHubUrl = canonicalizeGitHubUrl(repo.githubUrl);
    const repoSlug = slugFromGitHubUrl(canonicalGitHubUrl);
    const existing = byCanonicalUrl.get(canonicalGitHubUrl);

    if (!existing) {
      byCanonicalUrl.set(canonicalGitHubUrl, {
        repoName: repo.repoName,
        canonicalGitHubUrl,
        repoSlug,
        trendshiftRepoUrls: [repo.trendshiftRepoUrl],
        sourceTags: [...new Set(repo.tags ?? [])].sort(),
        description: repo.description,
        language: repo.language,
        metrics: repo.metrics,
      });
      continue;
    }

    existing.trendshiftRepoUrls = [...new Set([...existing.trendshiftRepoUrls, repo.trendshiftRepoUrl])].sort();
    existing.sourceTags = [...new Set([...existing.sourceTags, ...(repo.tags ?? [])])].sort();
    if (!existing.description && repo.description) existing.description = repo.description;
    if (!existing.language && repo.language) existing.language = repo.language;
    if ((!existing.metrics || existing.metrics.length === 0) && repo.metrics) existing.metrics = repo.metrics;
  }

  const canonicalRepos = [...byCanonicalUrl.values()].sort((a, b) =>
    a.canonicalGitHubUrl.localeCompare(b.canonicalGitHubUrl)
  );

  const manifest: TrendshiftTopicManifest = {
    topicName: input.topicName,
    topicUrl: input.topicUrl,
    generatedAt: new Date().toISOString(),
    repos: canonicalRepos.map((repo) => ({
      ...repo,
      pipeline: {
        state: "discovered",
        updatedAt: new Date().toISOString(),
      },
    })),
  };

  const canonicalReposPath = path.join(outputDir, "canonical-repos.json");
  const manifestPath = path.join(outputDir, "manifest.json");
  writeFileSync(canonicalReposPath, JSON.stringify(canonicalRepos, null, 2), "utf-8");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

  return {
    canonicalRepos,
    canonicalReposPath,
    manifestPath,
  };
}

export async function runTrendshiftTopicDeepPipeline(
  manifestPath: string,
  options: RunTrendshiftTopicDeepPipelineOptions = {}
): Promise<{ completed: number; fallback: number; failed: number; skipped: number }> {
  const resolvedManifestPath = path.resolve(manifestPath);
  const manifest = JSON.parse(readFileSync(resolvedManifestPath, "utf-8")) as TrendshiftTopicManifest;
  const pipelineDataDir = path.resolve(options.pipelineDataDir ?? path.join("data", "trendshift", "pipeline"));
  const checkoutRootDir = path.resolve(options.checkoutRootDir ?? path.join("data", "trendshift", "checkouts"));
  mkdirSync(pipelineDataDir, { recursive: true });
  mkdirSync(checkoutRootDir, { recursive: true });

  const cloneRepository = options.cloneRepository ?? defaultCloneRepository;
  const ingestRepository = options.ingestRepository ?? ingestSingleRepo;
  const decomposeKnowledgeGraph = options.decomposeKnowledgeGraph ?? decompose;
  const harnessRepository =
    options.harnessRepository ??
    (async ({ slug, repoPath, decompositionPath, pipelineDataDir }) => {
      const decomposition = JSON.parse(readFileSync(decompositionPath, "utf-8"));
      return harness({
        slug,
        repoPath,
        decomposition,
        decompositionPath,
        dataDir: pipelineDataDir,
        outputDir: path.join(pipelineDataDir, "harnesses"),
        discoveryManifestPath: path.join(pipelineDataDir, "CLI_DISCOVERY_MANIFEST.md"),
        workflowMapPath: path.join(pipelineDataDir, "WORKFLOW_MAP.md"),
      });
    });

  let completed = 0;
  let fallback = 0;
  let failed = 0;
  let skipped = 0;

  for (const repo of manifest.repos) {
    if (repo.pipeline.state === "harnessed") {
      skipped += 1;
      continue;
    }

    try {
      const knowledgeGraphPath =
        repo.pipeline.knowledgeGraphPath && existsSync(repo.pipeline.knowledgeGraphPath)
          ? repo.pipeline.knowledgeGraphPath
          : await ingestRepository(repo.canonicalGitHubUrl, pipelineDataDir);
      repo.pipeline.knowledgeGraphPath = knowledgeGraphPath;
      repo.pipeline.state = "ingested";
      repo.pipeline.updatedAt = new Date().toISOString();
      repo.pipeline.error = undefined;
      writeManifest(resolvedManifestPath, manifest);

      const decompositionPath =
        repo.pipeline.decompositionPath && existsSync(repo.pipeline.decompositionPath)
          ? repo.pipeline.decompositionPath
          : await decomposeKnowledgeGraph(knowledgeGraphPath);
      repo.pipeline.decompositionPath = decompositionPath;
      repo.pipeline.state = "decomposed";
      repo.pipeline.updatedAt = new Date().toISOString();
      writeManifest(resolvedManifestPath, manifest);

      const checkoutPath =
        repo.pipeline.checkoutPath && existsSync(repo.pipeline.checkoutPath)
          ? repo.pipeline.checkoutPath
          : await cloneRepository(repo.canonicalGitHubUrl, repo.repoSlug, checkoutRootDir);
      repo.pipeline.checkoutPath = checkoutPath;
      repo.pipeline.updatedAt = new Date().toISOString();
      writeManifest(resolvedManifestPath, manifest);

      const harnessResult = await harnessRepository({
        slug: repo.repoSlug,
        repoPath: checkoutPath,
        decompositionPath,
        pipelineDataDir,
      });
      repo.pipeline.harnessSkillMdPath = harnessResult.skillMdPath;
      repo.pipeline.harnessCachePath = harnessResult.cachePath;
      repo.pipeline.workflowPath = harnessResult.workflowPath;
      repo.pipeline.state = harnessResult.status;
      repo.pipeline.error = harnessResult.fallbackReason;
      repo.pipeline.updatedAt = new Date().toISOString();
      writeManifest(resolvedManifestPath, manifest);
      if (harnessResult.status === "harnessed") {
        completed += 1;
      } else {
        fallback += 1;
      }
    } catch (error) {
      repo.pipeline.state = "failed";
      repo.pipeline.updatedAt = new Date().toISOString();
      repo.pipeline.error = error instanceof Error ? error.message : String(error);
      writeManifest(resolvedManifestPath, manifest);
      failed += 1;
    }
  }

  return { completed, fallback, failed, skipped };
}

function writeManifest(manifestPath: string, manifest: TrendshiftTopicManifest): void {
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
}

async function defaultCloneRepository(url: string, slug: string, checkoutRootDir: string): Promise<string> {
  const checkoutPath = path.join(checkoutRootDir, slug);
  mkdirSync(checkoutRootDir, { recursive: true });
  if (existsSync(checkoutPath)) {
    return checkoutPath;
  }
  execFileSync("git", ["clone", "--depth", "1", url, checkoutPath], { stdio: "pipe" });
  return checkoutPath;
}

function canonicalizeGitHubUrl(url: string): string {
  const parsed = new URL(url);
  if (parsed.hostname !== "github.com") {
    throw new Error(`Expected GitHub URL, got ${url}`);
  }
  const parts = parsed.pathname
    .replace(/\.git$/, "")
    .split("/")
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length !== 2) {
    throw new Error(`Expected owner/repo GitHub URL, got ${url}`);
  }
  return `https://github.com/${parts[0].toLowerCase()}/${parts[1].toLowerCase()}`;
}

function slugFromGitHubUrl(url: string): string {
  const parsed = new URL(url);
  const parts = parsed.pathname.split("/").filter(Boolean).slice(0, 2);
  return `${parts[0]}-${parts[1]}`.toLowerCase();
}
