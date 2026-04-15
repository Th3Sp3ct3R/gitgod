/**
 * Exa API helpers: semantic web search, URL contents, and answer-with-citations.
 * https://api.exa.ai — requires EXA_API_KEY (x-api-key header).
 */

const EXA_API_BASE = "https://api.exa.ai";

export type ExaFreshness = "day" | "week" | "month" | "year";

export interface ExaSearchArgs {
  query: string;
  numResults?: number;
  /** Bias toward recently published pages (maps to startPublishedDate). */
  freshness?: ExaFreshness;
  /** Exa search type: auto, neural, fast, deep, instant, etc. */
  type?: string;
  category?: string;
  /** Include highlight snippets in results (default true). Set false to omit contents sub-request. */
  includeHighlights?: boolean;
  highlightsMaxCharacters?: number;
}

export interface ExaContentsArgs {
  urls: string[];
  maxCharacters?: number;
}

export interface ExaAnswerArgs {
  query: string;
  /** Include full text on citation objects when available (default true). */
  text?: boolean;
}

function requireApiKey(): string | null {
  const k = process.env.EXA_API_KEY?.trim();
  return k || null;
}

/** Map UI "freshness" to Exa's startPublishedDate (ISO 8601). */
export function freshnessToStartPublishedDate(freshness: ExaFreshness | undefined): string | undefined {
  if (!freshness) return undefined;
  const now = Date.now();
  const ms: Record<ExaFreshness, number> = {
    day: 86400_000,
    week: 7 * 86400_000,
    month: 30 * 86400_000,
    year: 365 * 86400_000,
  };
  const delta = ms[freshness];
  if (delta == null) return undefined;
  return new Date(now - delta).toISOString();
}

async function exaJson(
  path: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const key = requireApiKey();
  if (!key) {
    return { ok: false, status: 0, data: { error: "Missing EXA_API_KEY" } };
  }
  const res = await fetch(`${EXA_API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-api-key": key,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as unknown;
  return { ok: res.ok, status: res.status, data };
}

/**
 * POST /search — web (and vertical) search; optional date filter via freshness.
 */
export async function exaSearchTool(args: ExaSearchArgs): Promise<Record<string, unknown>> {
  const query = typeof args.query === "string" ? args.query.trim() : "";
  if (!query) {
    return { success: false, error: "query is required" };
  }
  if (!requireApiKey()) {
    return { success: false, error: "Missing EXA_API_KEY" };
  }

  const numResults = Math.min(
    100,
    Math.max(1, typeof args.numResults === "number" && Number.isFinite(args.numResults) ? Math.floor(args.numResults) : 10)
  );

  const payload: Record<string, unknown> = {
    query,
    numResults,
  };

  if (typeof args.type === "string" && args.type.trim()) {
    payload.type = args.type.trim();
  }
  if (typeof args.category === "string" && args.category.trim()) {
    payload.category = args.category.trim();
  }

  const start = freshnessToStartPublishedDate(args.freshness);
  if (start) {
    payload.startPublishedDate = start;
  }

  const includeHl = args.includeHighlights !== false;
  if (includeHl) {
    const maxHl =
      typeof args.highlightsMaxCharacters === "number" && args.highlightsMaxCharacters > 0
        ? Math.min(args.highlightsMaxCharacters, 100_000)
        : 2000;
    payload.contents = {
      highlights: { maxCharacters: maxHl },
    };
  }

  const { ok, status, data } = await exaJson("/search", payload);
  if (!ok) {
    const errObj = data as { message?: string; error?: string };
    const msg = errObj?.message ?? errObj?.error ?? `HTTP ${status}`;
    return { success: false, error: msg, status };
  }
  return { success: true, ...(typeof data === "object" && data !== null ? (data as object) : { result: data }) };
}

/**
 * POST /contents — fetch clean text for URLs (crawl/cache).
 */
export async function exaContentsTool(args: ExaContentsArgs): Promise<Record<string, unknown>> {
  if (!requireApiKey()) {
    return { success: false, error: "Missing EXA_API_KEY" };
  }

  const urls = Array.isArray(args.urls)
    ? args.urls
        .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
        .map((u) => u.trim())
    : [];
  if (urls.length === 0) {
    return { success: false, error: "urls must be a non-empty array of strings" };
  }

  const maxCharacters =
    typeof args.maxCharacters === "number" && args.maxCharacters > 0
      ? Math.min(Math.floor(args.maxCharacters), 500_000)
      : 10_000;

  const payload: Record<string, unknown> = {
    urls,
    text: { maxCharacters },
  };

  const { ok, status, data } = await exaJson("/contents", payload);
  if (!ok) {
    const errObj = data as { message?: string; error?: string };
    const msg = errObj?.message ?? errObj?.error ?? `HTTP ${status}`;
    return { success: false, error: msg, status };
  }
  return { success: true, ...(typeof data === "object" && data !== null ? (data as object) : { result: data }) };
}

/**
 * POST /answer — LLM answer with citations from Exa search.
 */
export async function exaAnswerTool(args: ExaAnswerArgs): Promise<Record<string, unknown>> {
  const query = typeof args.query === "string" ? args.query.trim() : "";
  if (!query) {
    return { success: false, error: "query is required" };
  }
  if (!requireApiKey()) {
    return { success: false, error: "Missing EXA_API_KEY" };
  }

  const payload: Record<string, unknown> = {
    query,
    text: args.text !== false,
  };

  const { ok, status, data } = await exaJson("/answer", payload);
  if (!ok) {
    const errObj = data as { message?: string; error?: string };
    const msg = errObj?.message ?? errObj?.error ?? `HTTP ${status}`;
    return { success: false, error: msg, status };
  }
  return { success: true, ...(typeof data === "object" && data !== null ? (data as object) : { result: data }) };
}
