// src/stages/decompose.ts
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { DecomposeOperation, DecomposeOperationKind, DecomposeResult, Skeleton, Category, Tool } from "../types.js";

function findGitHubRepos(categories: Category[]): Tool[] {
  const repos: Tool[] = [];
  function walk(cats: Category[]) {
    for (const cat of cats) {
      for (const tool of cat.tools) {
        if (tool.link_type === "github" && tool.status === "alive") {
          repos.push(tool);
        }
      }
      walk(cat.subcategories);
    }
  }
  walk(categories);
  return repos;
}

function inferOperationKind(tool: Tool): DecomposeOperationKind {
  const haystack = `${tool.name} ${tool.description} ${tool.url} ${tool.synthesis?.tags.join(" ") ?? ""}`.toLowerCase();
  if (haystack.includes("/api") || haystack.includes("api") || haystack.includes("sdk")) return "api_endpoint";
  if (haystack.includes("script") || haystack.includes("automation")) return "script";
  if (haystack.includes("build") || haystack.includes("compile") || haystack.includes("ci")) return "build";
  if (haystack.includes("database") || haystack.includes("data") || haystack.includes("etl")) return "data";
  if (haystack.includes("config") || haystack.includes("settings")) return "config";
  return "business_logic";
}

function buildOperationId(tool: Tool, category: string): string {
  const base = `${category}-${tool.name}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `op-${base}`;
}

function buildDecomposeResult(skeleton: Skeleton): DecomposeResult {
  const operations: DecomposeOperation[] = [];
  const categories = new Set<string>();

  function walk(cats: Category[], prefix: string): void {
    for (const cat of cats) {
      const catPath = prefix ? `${prefix} > ${cat.category}` : cat.category;
      categories.add(catPath);

      for (const tool of cat.tools) {
        const evidence = [tool.url];
        if (tool.synthesis?.summary) evidence.push(tool.synthesis.summary);
        if (tool.description) evidence.push(tool.description);
        operations.push({
          id: buildOperationId(tool, catPath),
          title: tool.name,
          category: catPath,
          kind: inferOperationKind(tool),
          source_tool_name: tool.name,
          source_url: tool.url,
          evidence,
          tags: tool.synthesis?.tags ?? [],
        });
      }
      walk(cat.subcategories, catPath);
    }
  }

  walk(skeleton.taxonomy, "");

  return {
    repo: skeleton.repo,
    url: skeleton.url,
    generated_at: new Date().toISOString(),
    categories: [...categories],
    operations,
    stats: {
      operations: operations.length,
      categories: categories.size,
    },
  };
}

export async function decompose(knowledgeGraphPath: string): Promise<string> {
  const skeleton: Skeleton = JSON.parse(readFileSync(knowledgeGraphPath, "utf-8"));
  const dataDir = path.dirname(knowledgeGraphPath);
  const deepGraphPath = path.join(dataDir, "deep-graph.json");
  const decompositionPath = path.join(dataDir, "decomposition.json");

  const repos = findGitHubRepos(skeleton.taxonomy);
  console.log(`[Stage 4] Found ${repos.length} GitHub repos to decompose`);
  console.log(`  (Level 4 decomposition — run after Level 3 completes)`);

  for (const repo of repos) {
    console.log(`  - ${repo.name}: ${repo.url}`);
  }

  const decomposition = buildDecomposeResult(skeleton);
  console.log(`\n  Built decomposition seed from existing taxonomy:`);
  console.log(`  - operations: ${decomposition.stats.operations}`);
  console.log(`  - categories: ${decomposition.stats.categories}`);

  // Keep deep-graph for backward compatibility with existing workflows.
  writeFileSync(deepGraphPath, JSON.stringify(skeleton, null, 2));
  writeFileSync(decompositionPath, JSON.stringify(decomposition, null, 2));
  console.log(`  -> ${deepGraphPath}`);
  console.log(`  -> ${decompositionPath}`);

  return decompositionPath;
}
