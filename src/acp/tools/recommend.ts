import type { GraphIndex } from "../loader.js";
import { searchTools } from "../search.js";

export interface RecommendParams {
  use_case: string;
  max?: number;
  exclude?: string[];
  prefer_tags?: string[];
  graph?: string;
}

export interface RecommendResult {
  use_case: string;
  recommendations: Array<{
    name: string;
    url: string;
    summary: string;
    relevance_score: number;
    match_score: number;
    tags: string[];
    category: string;
    graph: string;
    rationale: string;
  }>;
}

export function recommend(index: GraphIndex, params: RecommendParams): RecommendResult {
  const maxResults = params.max || 5;
  const excludeSet = new Set((params.exclude || []).map((n) => n.toLowerCase()));

  let candidates = index.allTools.filter(
    (t) => !excludeSet.has(t.name.toLowerCase())
  );

  if (params.graph) {
    candidates = candidates.filter((t) => t.graphSlug === params.graph);
  }

  const matched = searchTools(candidates, {
    query: params.use_case,
    max_results: maxResults * 2,
  });

  const preferSet = new Set((params.prefer_tags || []).map((t) => t.toLowerCase()));

  const scored = matched.map((tool) => {
    let matchScore = tool.relevance_score / 5;

    if (preferSet.size > 0) {
      const tagOverlap = tool.tags.filter((t) => preferSet.has(t.toLowerCase())).length;
      matchScore = matchScore * 0.7 + (tagOverlap / preferSet.size) * 0.3;
    }

    matchScore = Math.round(matchScore * 100) / 100;

    const matchedTags = tool.tags.filter((t) =>
      params.use_case.toLowerCase().includes(t.toLowerCase())
    );
    const rationale = matchedTags.length > 0
      ? `Matches use case via tags: ${matchedTags.join(", ")}`
      : `Relevant based on summary and category: ${tool.categoryPath}`;

    return { tool, matchScore, rationale };
  });

  scored.sort((a, b) => b.matchScore - a.matchScore);

  return {
    use_case: params.use_case,
    recommendations: scored.slice(0, maxResults).map((s) => ({
      name: s.tool.name,
      url: s.tool.url,
      summary: s.tool.summary,
      relevance_score: s.tool.relevance_score,
      match_score: s.matchScore,
      tags: s.tool.tags,
      category: s.tool.categoryPath,
      graph: s.tool.graphSlug,
      rationale: s.rationale,
    })),
  };
}
