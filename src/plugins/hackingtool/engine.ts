import path from "node:path";
import { loadGraphs, type IndexedTool, type GraphIndex } from "../../acp/loader.js";
import { searchTools, filterTools, type SearchOptions, type FilterOptions } from "../../acp/search.js";

const GRAPH_SLUG = "z4nzu-hackingtool";

export interface HackingtoolEngine {
  tools: IndexedTool[];
  graphIndex: GraphIndex;
  search(query: string, maxResults?: number): IndexedTool[];
  filter(options: Omit<FilterOptions, "graph">): IndexedTool[];
  browse(category?: string): BrowseResult;
  recommend(useCase: string, options?: RecommendOptions): RecommendResult;
  compare(toolNames: string[]): CompareResult;
  stats(): StatsResult;
  categories(): CategoryEntry[];
}

export interface BrowseResult {
  categories: Array<{
    name: string;
    toolCount: number;
    tools: Array<{ name: string; summary: string; relevance_score: number; tags: string[] }>;
  }>;
  total: number;
}

export interface RecommendOptions {
  max?: number;
  exclude?: string[];
  preferTags?: string[];
}

export interface RecommendResult {
  useCase: string;
  recommendations: Array<{
    name: string;
    url: string;
    summary: string;
    relevance_score: number;
    matchScore: number;
    tags: string[];
    category: string;
    rationale: string;
  }>;
}

export interface CompareResult {
  comparison: Array<{
    name: string;
    url: string;
    summary: string;
    tags: string[];
    relevance_score: number;
    category: string;
    github_stars?: number;
    language?: string;
    last_commit?: string;
  }>;
  sharedTags: string[];
  uniqueTags: Record<string, string[]>;
  notFound: string[];
}

export interface StatsResult {
  totalTools: number;
  totalCategories: number;
  tagDistribution: Record<string, number>;
  categoryBreakdown: Array<{ category: string; toolCount: number; avgScore: number }>;
  scoreDistribution: Record<number, number>;
  topTools: Array<{ name: string; relevance_score: number; github_stars?: number }>;
  languages: Record<string, number>;
}

export interface CategoryEntry {
  name: string;
  toolCount: number;
  topTools: string[];
  avgScore: number;
}

export function createEngine(dataDir?: string): HackingtoolEngine {
  const resolvedDataDir = dataDir || path.join(process.cwd(), "data");
  const graphIndex = loadGraphs(resolvedDataDir);
  const tools = graphIndex.allTools.filter((t) => t.graphSlug === GRAPH_SLUG);

  return {
    tools,
    graphIndex,

    search(query: string, maxResults = 10): IndexedTool[] {
      return searchTools(tools, { query, max_results: maxResults });
    },

    filter(options: Omit<FilterOptions, "graph">): IndexedTool[] {
      return filterTools(tools, { ...options });
    },

    browse(category?: string): BrowseResult {
      const catMap = new Map<string, IndexedTool[]>();
      for (const tool of tools) {
        const topCat = tool.categoryPath.split(" > ")[0];
        if (category && !topCat.toLowerCase().includes(category.toLowerCase())) continue;
        const list = catMap.get(topCat) || [];
        list.push(tool);
        catMap.set(topCat, list);
      }

      const categories = [...catMap.entries()]
        .map(([name, catTools]) => ({
          name,
          toolCount: catTools.length,
          tools: catTools
            .sort((a, b) => b.relevance_score - a.relevance_score)
            .map((t) => ({
              name: t.name,
              summary: t.summary,
              relevance_score: t.relevance_score,
              tags: t.tags,
            })),
        }))
        .sort((a, b) => b.toolCount - a.toolCount);

      return {
        categories,
        total: categories.reduce((sum, c) => sum + c.toolCount, 0),
      };
    },

    recommend(useCase: string, options?: RecommendOptions): RecommendResult {
      const maxResults = options?.max || 5;
      const excludeSet = new Set((options?.exclude || []).map((n) => n.toLowerCase()));
      const candidates = tools.filter((t) => !excludeSet.has(t.name.toLowerCase()));

      const matched = searchTools(candidates, {
        query: useCase,
        max_results: maxResults * 2,
      });

      const preferSet = new Set((options?.preferTags || []).map((t) => t.toLowerCase()));

      const scored = matched.map((tool) => {
        let matchScore = tool.relevance_score / 5;
        if (preferSet.size > 0) {
          const tagOverlap = tool.tags.filter((t) => preferSet.has(t.toLowerCase())).length;
          matchScore = matchScore * 0.7 + (tagOverlap / preferSet.size) * 0.3;
        }
        matchScore = Math.round(matchScore * 100) / 100;

        const matchedTags = tool.tags.filter((t) =>
          useCase.toLowerCase().includes(t.toLowerCase())
        );
        const rationale = matchedTags.length > 0
          ? `Matches via tags: ${matchedTags.join(", ")}`
          : `Relevant: ${tool.categoryPath}`;

        return { tool, matchScore, rationale };
      });

      scored.sort((a, b) => b.matchScore - a.matchScore);

      return {
        useCase,
        recommendations: scored.slice(0, maxResults).map((s) => ({
          name: s.tool.name,
          url: s.tool.url,
          summary: s.tool.summary,
          relevance_score: s.tool.relevance_score,
          matchScore: s.matchScore,
          tags: s.tool.tags,
          category: s.tool.categoryPath,
          rationale: s.rationale,
        })),
      };
    },

    compare(toolNames: string[]): CompareResult {
      const found: CompareResult["comparison"] = [];
      const notFound: string[] = [];

      for (const name of toolNames) {
        const nameLower = name.toLowerCase();
        // Exact match first, then substring fallback
        const match = tools.find((t) => t.name.toLowerCase() === nameLower)
          || tools.find((t) => t.name.toLowerCase().includes(nameLower));
        if (!match) {
          notFound.push(name);
          continue;
        }
        found.push({
          name: match.name,
          url: match.url,
          summary: match.summary,
          tags: match.tags,
          relevance_score: match.relevance_score,
          category: match.categoryPath,
          github_stars: match.github_stars,
          language: match.github_language,
          last_commit: match.last_commit,
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

      return { comparison: found, sharedTags, uniqueTags, notFound };
    },

    stats(): StatsResult {
      const tagDist: Record<string, number> = {};
      const scoreDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      const langDist: Record<string, number> = {};
      const categoryMap = new Map<string, { count: number; totalScore: number }>();

      for (const tool of tools) {
        for (const tag of tool.tags) {
          tagDist[tag] = (tagDist[tag] || 0) + 1;
        }
        const score = Math.min(5, Math.max(1, Math.round(tool.relevance_score)));
        scoreDist[score] = (scoreDist[score] || 0) + 1;

        if (tool.github_language) {
          langDist[tool.github_language] = (langDist[tool.github_language] || 0) + 1;
        }

        const topCat = tool.categoryPath.split(" > ")[0];
        const existing = categoryMap.get(topCat) || { count: 0, totalScore: 0 };
        existing.count++;
        existing.totalScore += tool.relevance_score;
        categoryMap.set(topCat, existing);
      }

      const categoryBreakdown = [...categoryMap.entries()]
        .map(([category, data]) => ({
          category,
          toolCount: data.count,
          avgScore: Math.round((data.totalScore / data.count) * 10) / 10,
        }))
        .sort((a, b) => b.toolCount - a.toolCount);

      const topTools = [...tools]
        .sort((a, b) => b.relevance_score - a.relevance_score || (b.github_stars || 0) - (a.github_stars || 0))
        .slice(0, 10)
        .map((t) => ({
          name: t.name,
          relevance_score: t.relevance_score,
          github_stars: t.github_stars,
        }));

      return {
        totalTools: tools.length,
        totalCategories: categoryMap.size,
        tagDistribution: tagDist,
        categoryBreakdown,
        scoreDistribution: scoreDist,
        topTools,
        languages: langDist,
      };
    },

    categories(): CategoryEntry[] {
      const catMap = new Map<string, IndexedTool[]>();
      for (const tool of tools) {
        const topCat = tool.categoryPath.split(" > ")[0];
        const list = catMap.get(topCat) || [];
        list.push(tool);
        catMap.set(topCat, list);
      }

      return [...catMap.entries()]
        .map(([name, catTools]) => {
          const sorted = catTools.sort((a, b) => b.relevance_score - a.relevance_score);
          const avgScore = Math.round(
            (catTools.reduce((sum, t) => sum + t.relevance_score, 0) / catTools.length) * 10
          ) / 10;
          return {
            name,
            toolCount: catTools.length,
            topTools: sorted.slice(0, 3).map((t) => t.name),
            avgScore,
          };
        })
        .sort((a, b) => b.toolCount - a.toolCount);
    },
  };
}
