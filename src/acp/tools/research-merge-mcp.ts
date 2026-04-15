import {
  runResearchMerge,
  type ResearchCategory,
  type ResearchMergeResult,
} from "../../lib/research-merge.js";

export interface ResearchMergeMcpParams {
  query: string;
  firecrawl_limit?: number;
  gh_limit?: number;
  skip_firecrawl?: boolean;
  skip_gh?: boolean;
  /** Optional bias: `github`, `research`, and/or `pdf` (Firecrawl search categories). */
  fc_categories?: string[];
}

function normalizeCategories(raw: string[] | undefined): ResearchCategory[] | undefined {
  if (!raw?.length) return undefined;
  const allowed = new Set<ResearchCategory>(["github", "research", "pdf"]);
  const out = raw.map((s) => String(s).trim().toLowerCase()).filter((s): s is ResearchCategory =>
    allowed.has(s as ResearchCategory)
  );
  return out.length ? out : undefined;
}

/**
 * MCP tool handler: Firecrawl web search + `gh search repos` → markdown + structured hits.
 */
export async function researchMergeTool(params: ResearchMergeMcpParams): Promise<ResearchMergeResult> {
  const q = typeof params.query === "string" ? params.query.trim() : "";
  if (!q) throw new Error("query is required");

  return runResearchMerge({
    query: q,
    firecrawlLimit: params.firecrawl_limit,
    ghLimit: params.gh_limit,
    skipFirecrawl: Boolean(params.skip_firecrawl),
    skipGh: Boolean(params.skip_gh),
    firecrawlCategories: normalizeCategories(params.fc_categories),
  });
}
