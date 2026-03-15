import type { GraphIndex } from "../loader.js";

export interface ListGraphsResult {
  graphs: Array<{
    slug: string;
    repo: string;
    url: string;
    scraped_at: string;
    stats: {
      total_tools: number;
      alive: number;
      dead: number;
      synthesized: number;
      categories: number;
      top_tags: string[];
    };
  }>;
  total_graphs: number;
}

export function listGraphs(index: GraphIndex): ListGraphsResult {
  return {
    graphs: index.graphs.map((g) => ({
      slug: g.slug,
      repo: g.repo,
      url: g.url,
      scraped_at: g.scraped_at,
      stats: g.stats,
    })),
    total_graphs: index.graphs.length,
  };
}
