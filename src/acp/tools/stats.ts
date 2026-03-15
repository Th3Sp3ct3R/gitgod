import type { GraphIndex } from "../loader.js";

export interface StatsParams {
  graph?: string;
}

export interface StatsResult {
  total_tools: number;
  total_alive: number;
  total_dead: number;
  total_synthesized: number;
  total_categories: number;
  total_graphs: number;
  tag_distribution: Record<string, number>;
  category_breakdown: Array<{ category: string; tool_count: number; avg_score: number }>;
  score_distribution: Record<number, number>;
  link_type_breakdown: Record<string, number>;
  top_tools: Array<{ name: string; relevance_score: number; github_stars?: number }>;
}

export function getStats(index: GraphIndex, params: StatsParams): StatsResult {
  let graphs = index.graphs;
  let tools = index.allTools;

  if (params.graph) {
    graphs = graphs.filter((g) => g.slug === params.graph);
    tools = tools.filter((t) => t.graphSlug === params.graph);
  }

  const tagDist: Record<string, number> = {};
  const scoreDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const linkTypeDist: Record<string, number> = {};
  const categoryMap = new Map<string, { count: number; totalScore: number }>();

  for (const tool of tools) {
    for (const tag of tool.tags) {
      tagDist[tag] = (tagDist[tag] || 0) + 1;
    }
    const score = Math.min(5, Math.max(1, Math.round(tool.relevance_score)));
    scoreDist[score] = (scoreDist[score] || 0) + 1;
    linkTypeDist[tool.link_type] = (linkTypeDist[tool.link_type] || 0) + 1;

    const topCat = tool.categoryPath.split(" > ")[0];
    const existing = categoryMap.get(topCat) || { count: 0, totalScore: 0 };
    existing.count++;
    existing.totalScore += tool.relevance_score;
    categoryMap.set(topCat, existing);
  }

  const categoryBreakdown = [...categoryMap.entries()].map(([category, data]) => ({
    category,
    tool_count: data.count,
    avg_score: Math.round((data.totalScore / data.count) * 10) / 10,
  }));

  const topTools = [...tools]
    .sort((a, b) => b.relevance_score - a.relevance_score || (b.github_stars || 0) - (a.github_stars || 0))
    .slice(0, 10)
    .map((t) => ({
      name: t.name,
      relevance_score: t.relevance_score,
      github_stars: t.github_stars,
    }));

  return {
    total_tools: graphs.reduce((sum, g) => sum + g.stats.total_tools, 0),
    total_alive: graphs.reduce((sum, g) => sum + g.stats.alive, 0),
    total_dead: graphs.reduce((sum, g) => sum + g.stats.dead, 0),
    total_synthesized: graphs.reduce((sum, g) => sum + g.stats.synthesized, 0),
    total_categories: graphs.reduce((sum, g) => sum + g.stats.categories, 0),
    total_graphs: graphs.length,
    tag_distribution: tagDist,
    category_breakdown: categoryBreakdown,
    score_distribution: scoreDist,
    link_type_breakdown: linkTypeDist,
    top_tools: topTools,
  };
}
