import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { cloneAndParse } from "./clone-parse.js";
import { enrich } from "./enrich.js";
import { synthesize } from "./synthesize.js";
import type { Category, Skeleton } from "../types.js";
import type { HarnessParserResult } from "../parsers/harness-parser.js";

function slugFromUrl(url: string): string {
  const match = url.match(/github\.com\/([^/]+\/[^/]+)/);
  if (!match) throw new Error(`Invalid GitHub URL: ${url}`);
  return match[1].replace(/\.git$/, "").replace("/", "-");
}

function mergeCategories(existing: Category[], incoming: Category[]): Category[] {
  const byName = new Map<string, Category>();
  for (const cat of existing) byName.set(cat.category, cat);
  for (const cat of incoming) byName.set(cat.category, cat);
  return [...byName.values()];
}

export function mergeHarnessIntoGraph(
  dataDir: string,
  slug: string,
  parsed: HarnessParserResult
): string {
  const repoDir = path.join(dataDir, slug);
  mkdirSync(repoDir, { recursive: true });
  const kgPath = path.join(repoDir, "knowledge-graph.json");

  let graph: Skeleton;
  if (existsSync(kgPath)) {
    graph = JSON.parse(readFileSync(kgPath, "utf-8")) as Skeleton;
  } else {
    graph = {
      repo: slug,
      url: "",
      scraped_at: new Date().toISOString(),
      stats: { categories: 0, links: 0 },
      taxonomy: [],
    };
  }

  graph.taxonomy = mergeCategories(graph.taxonomy, parsed.categories);
  graph.stats = {
    categories: graph.taxonomy.length,
    links: graph.taxonomy.reduce((acc, cat) => acc + cat.tools.length, 0),
  };
  writeFileSync(kgPath, JSON.stringify(graph, null, 2));
  return kgPath;
}

export async function ingestSingleRepo(url: string, dataDir: string): Promise<string> {
  const slug = slugFromUrl(url);
  const targetDataDir = path.resolve(dataDir);
  mkdirSync(targetDataDir, { recursive: true });

  // cloneAndParse always writes under cwd ./data/<slug>/ — run enrich/synthesize there
  // so paths never drift from a mismatched targetSkeletonPath.
  const skeletonPath = await cloneAndParse(url);
  const workDir = path.dirname(skeletonPath);
  const enrichedPath = await enrich(skeletonPath, 1);
  await synthesize(enrichedPath);

  const targetRepoDir = path.join(targetDataDir, slug);
  if (path.resolve(workDir) !== path.resolve(targetRepoDir)) {
    rmSync(targetRepoDir, { recursive: true, force: true });
    cpSync(workDir, targetRepoDir, { recursive: true });
  }

  return path.join(targetRepoDir, "knowledge-graph.json");
}
