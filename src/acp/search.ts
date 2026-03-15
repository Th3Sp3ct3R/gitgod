import type { IndexedTool } from "./loader.js";

export interface SearchOptions {
  query: string;
  max_results?: number;
  graph?: string;
}

export interface FilterOptions {
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

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\-_]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function scoreMatch(tool: IndexedTool, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 0;

  const nameTokens = tokenize(tool.name);
  const summaryTokens = tokenize(tool.summary);
  const descTokens = tokenize(tool.description);
  const tagSet = new Set(tool.tags.map((t) => t.toLowerCase()));

  let score = 0;
  let matchedTokens = 0;

  for (const qt of queryTokens) {
    let tokenMatched = false;

    // Name match (highest weight)
    if (nameTokens.some((nt) => nt.includes(qt) || qt.includes(nt))) {
      score += 3;
      tokenMatched = true;
    }

    // Tag exact match (high weight)
    if (tagSet.has(qt)) {
      score += 2.5;
      tokenMatched = true;
    }

    // Summary match
    if (summaryTokens.some((st) => st.includes(qt) || qt.includes(st))) {
      score += 1.5;
      tokenMatched = true;
    }

    // Description match
    if (descTokens.some((dt) => dt.includes(qt) || qt.includes(dt))) {
      score += 1;
      tokenMatched = true;
    }

    if (tokenMatched) matchedTokens++;
  }

  // Require at least one token to match
  if (matchedTokens === 0) return 0;

  // Coverage bonus: what fraction of query tokens matched
  const coverage = matchedTokens / queryTokens.length;
  score *= coverage;

  // Boost by relevance score
  score *= tool.relevance_score / 5;

  return score;
}

export function searchTools(
  tools: IndexedTool[],
  options: SearchOptions
): IndexedTool[] {
  const queryTokens = tokenize(options.query);
  const maxResults = options.max_results || 5;

  let candidates = tools;
  if (options.graph) {
    candidates = candidates.filter((t) => t.graphSlug === options.graph);
  }

  const scored = candidates
    .map((tool) => ({ tool, score: scoreMatch(tool, queryTokens) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  return scored.map((s) => s.tool);
}

export function filterTools(
  tools: IndexedTool[],
  options: FilterOptions
): IndexedTool[] {
  let result = tools;

  if (options.graph) {
    result = result.filter((t) => t.graphSlug === options.graph);
  }

  if (options.tags && options.tags.length > 0) {
    const tagsLower = options.tags.map((t) => t.toLowerCase());
    result = result.filter((t) =>
      t.tags.some((tag) => tagsLower.includes(tag.toLowerCase()))
    );
  }

  if (options.tags_all && options.tags_all.length > 0) {
    const tagsLower = options.tags_all.map((t) => t.toLowerCase());
    result = result.filter((t) => {
      const toolTagsLower = t.tags.map((tag) => tag.toLowerCase());
      return tagsLower.every((tag) => toolTagsLower.includes(tag));
    });
  }

  if (options.category) {
    const catLower = options.category.toLowerCase();
    result = result.filter((t) => t.categoryPath.toLowerCase().includes(catLower));
  }

  if (options.min_score !== undefined) {
    result = result.filter((t) => t.relevance_score >= options.min_score!);
  }

  if (options.max_score !== undefined) {
    result = result.filter((t) => t.relevance_score <= options.max_score!);
  }

  if (options.link_type) {
    result = result.filter((t) => t.link_type === options.link_type);
  }

  if (options.name) {
    const nameLower = options.name.toLowerCase();
    result = result.filter((t) => t.name.toLowerCase().includes(nameLower));
  }

  // Sort by relevance score desc
  result = result.sort((a, b) => b.relevance_score - a.relevance_score);

  // Pagination
  const offset = options.offset || 0;
  const limit = options.limit || 20;
  result = result.slice(offset, offset + limit);

  return result;
}
