// src/stages/decompose.ts
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Skeleton, Category, Tool } from "../types.js";

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

export async function decompose(knowledgeGraphPath: string): Promise<string> {
  const skeleton: Skeleton = JSON.parse(readFileSync(knowledgeGraphPath, "utf-8"));
  const dataDir = path.dirname(knowledgeGraphPath);
  const outputPath = path.join(dataDir, "deep-graph.json");

  const repos = findGitHubRepos(skeleton.taxonomy);
  console.log(`[Stage 4] Found ${repos.length} GitHub repos to decompose`);
  console.log(`  (Level 4 decomposition — run after Level 3 completes)`);

  for (const repo of repos) {
    console.log(`  - ${repo.name}: ${repo.url}`);
  }

  // TODO: Implement full decomposition
  // For each repo: clone, map file structure, extract package.json/requirements.txt,
  // identify tech stack, API endpoints, CLI commands
  console.log(`\n  Warning: Level 4 decomposition not yet implemented. ${repos.length} repos identified.`);

  writeFileSync(outputPath, JSON.stringify(skeleton, null, 2));
  console.log(`  -> ${outputPath}`);

  return outputPath;
}
