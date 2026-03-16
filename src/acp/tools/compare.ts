import type { GraphIndex } from "../loader.js";

export interface CompareParams {
  tools: string[];
}

export interface CompareResult {
  comparison: Array<{
    name: string;
    url: string;
    summary: string;
    tags: string[];
    relevance_score: number;
    categories: string[];
    github_stars?: number;
    language?: string;
    last_commit?: string;
    status: string;
    duplicates: string[];
    cross_categories: string[];
  }>;
  shared_tags: string[];
  unique_tags: Record<string, string[]>;
  not_found: string[];
}

export function compare(index: GraphIndex, params: CompareParams): CompareResult {
  const found: CompareResult["comparison"] = [];
  const notFound: string[] = [];

  for (const toolName of params.tools) {
    const nameLower = toolName.toLowerCase();
    const matches = index.allTools.filter((t) => t.name.toLowerCase() === nameLower);
    if (matches.length === 0) {
      notFound.push(toolName);
      continue;
    }
    const categories = [...new Set(matches.map((m) => m.categoryPath))];
    const first = matches[0];
    found.push({
      name: first.name,
      url: first.url,
      summary: first.summary,
      tags: first.tags,
      relevance_score: first.relevance_score,
      categories,
      github_stars: first.github_stars,
      language: first.github_language,
      last_commit: first.last_commit,
      status: first.status,
      duplicates: first.duplicates,
      cross_categories: first.cross_categories,
    });
  }

  const allTagSets = found.map((f) => new Set(f.tags));
  const sharedTags =
    allTagSets.length >= 2
      ? [...allTagSets[0]].filter((tag) => allTagSets.every((s) => s.has(tag)))
      : [];

  const uniqueTags: Record<string, string[]> = {};
  for (const f of found) {
    uniqueTags[f.name] = f.tags.filter(
      (tag) => !found.every((other) => other.tags.includes(tag))
    );
  }

  return { comparison: found, shared_tags: sharedTags, unique_tags: uniqueTags, not_found: notFound };
}
