import type { GraphIndex } from "../loader.js";
import { searchTools } from "../search.js";

export interface AskParams {
  question: string;
  max_results?: number;
  graph?: string;
}

export interface AskResult {
  question: string;
  results: Array<{
    name: string;
    url: string;
    summary: string;
    relevance_score: number;
    match_reason: string;
    tags: string[];
    category: string;
    graph: string;
    github_stars?: number;
  }>;
  total_searched: number;
  graphs_searched: string[];
}

export function ask(index: GraphIndex, params: AskParams): AskResult {
  const tools = params.graph
    ? index.allTools.filter((t) => t.graphSlug === params.graph)
    : index.allTools;

  const matched = searchTools(index.allTools, {
    query: params.question,
    max_results: params.max_results || 5,
    graph: params.graph,
  });

  const graphsSearched = [...new Set(tools.map((t) => t.graphSlug))];

  return {
    question: params.question,
    results: matched.map((t) => ({
      name: t.name,
      url: t.url,
      summary: t.summary,
      relevance_score: t.relevance_score,
      match_reason: `Matched on: ${t.tags.slice(0, 3).join(", ")}`,
      tags: t.tags,
      category: t.categoryPath,
      graph: t.graphSlug,
      github_stars: t.github_stars,
    })),
    total_searched: tools.length,
    graphs_searched: graphsSearched,
  };
}
