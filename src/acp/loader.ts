import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { Tool, Category, Skeleton } from "../types.js";

export interface IndexedTool {
  name: string;
  url: string;
  description: string;
  link_type: string;
  status: string;
  summary: string;
  tags: string[];
  relevance_score: number;
  cross_categories: string[];
  duplicates: string[];
  categoryPath: string;
  graphSlug: string;
  github_stars?: number;
  github_language?: string;
  last_commit?: string;
}

export interface LoadedGraph {
  slug: string;
  repo: string;
  url: string;
  scraped_at: string;
  skeleton: Skeleton;
  stats: {
    total_tools: number;
    alive: number;
    dead: number;
    synthesized: number;
    categories: number;
    top_tags: string[];
  };
}

export interface GraphIndex {
  graphs: LoadedGraph[];
  allTools: IndexedTool[];
}

function flattenTools(
  categories: Category[],
  graphSlug: string
): { indexed: IndexedTool[]; totalTools: number; alive: number; dead: number; synthesized: number; allTags: Map<string, number> } {
  let totalTools = 0;
  let alive = 0;
  let dead = 0;
  let synthesized = 0;
  const indexed: IndexedTool[] = [];
  const allTags = new Map<string, number>();

  function walk(cats: Category[], pathPrefix: string) {
    for (const cat of cats) {
      const catPath = pathPrefix ? `${pathPrefix} > ${cat.category}` : cat.category;
      for (const tool of cat.tools) {
        totalTools++;
        if (tool.status === "alive") alive++;
        if (tool.status === "dead") dead++;
        if (tool.synthesis) synthesized++;

        if (tool.status === "alive" && tool.synthesis) {
          for (const tag of tool.synthesis.tags) {
            allTags.set(tag, (allTags.get(tag) || 0) + 1);
          }
          indexed.push({
            name: tool.name,
            url: tool.url,
            description: tool.description,
            link_type: tool.link_type,
            status: tool.status,
            summary: tool.synthesis.summary,
            tags: tool.synthesis.tags,
            relevance_score: tool.synthesis.relevance_score,
            cross_categories: tool.synthesis.cross_categories,
            duplicates: tool.synthesis.duplicates,
            categoryPath: catPath,
            graphSlug,
            github_stars: tool.scraped?.github_meta?.stars,
            github_language: tool.scraped?.github_meta?.language,
            last_commit: tool.scraped?.github_meta?.last_commit,
          });
        }
      }
      walk(cat.subcategories, catPath);
    }
  }

  walk(categories, "");
  return { indexed, totalTools, alive, dead, synthesized, allTags };
}

function countCategories(categories: Category[]): number {
  let count = 0;
  function walk(cats: Category[]) {
    for (const cat of cats) {
      count++;
      walk(cat.subcategories);
    }
  }
  walk(categories);
  return count;
}

export function loadGraphs(dataDir: string): GraphIndex {
  if (!existsSync(dataDir)) {
    return { graphs: [], allTools: [] };
  }

  const graphs: LoadedGraph[] = [];
  const allTools: IndexedTool[] = [];

  let entries: string[];
  try {
    entries = readdirSync(dataDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .map((d) => d.name);
  } catch {
    return { graphs: [], allTools: [] };
  }

  for (const slug of entries) {
    const kgPath = path.join(dataDir, slug, "knowledge-graph.json");
    if (!existsSync(kgPath)) continue;

    try {
      const skeleton: Skeleton = JSON.parse(readFileSync(kgPath, "utf-8"));
      const { indexed, totalTools, alive, dead, synthesized, allTags } = flattenTools(
        skeleton.taxonomy,
        slug
      );

      const topTags = [...allTags.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag]) => tag);

      graphs.push({
        slug,
        repo: skeleton.repo,
        url: skeleton.url,
        scraped_at: skeleton.scraped_at,
        skeleton,
        stats: {
          total_tools: totalTools,
          alive,
          dead,
          synthesized,
          categories: countCategories(skeleton.taxonomy),
          top_tags: topTags,
        },
      });

      allTools.push(...indexed);
    } catch {
      // Skip malformed files
    }
  }

  return { graphs, allTools };
}
