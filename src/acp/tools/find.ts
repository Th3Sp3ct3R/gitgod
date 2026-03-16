import type { GraphIndex } from "../loader.js";
import { filterTools } from "../search.js";

export interface FindParams {
  tags?: string[];
  tags_all?: string[];
  category?: string;
  min_score?: number;
  max_score?: number;
  status?: string;
  link_type?: string;
  name?: string;
  graph?: string;
  limit?: number;
  offset?: number;
}

export interface FindResult {
  results: Array<{
    name: string;
    url: string;
    summary: string;
    tags: string[];
    relevance_score: number;
    category: string;
    status: string;
    graph: string;
  }>;
  total: number;
  limit: number;
  offset: number;
}

export function find(index: GraphIndex, params: FindParams): FindResult {
  const limit = params.limit || 20;
  const offset = params.offset || 0;

  // Get total without pagination to report count
  const allFiltered = filterTools(index.allTools, { ...params, limit: undefined, offset: undefined });
  const paginated = filterTools(index.allTools, params);

  return {
    results: paginated.map((t) => ({
      name: t.name,
      url: t.url,
      summary: t.summary,
      tags: t.tags,
      relevance_score: t.relevance_score,
      category: t.categoryPath,
      status: t.status,
      graph: t.graphSlug,
    })),
    total: allFiltered.length,
    limit,
    offset,
  };
}
