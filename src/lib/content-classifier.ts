/**
 * Content Format Classifier for gitgod pipeline
 * Decides whether scraped content should be markdown, json, or hybrid.
 *
 * Categories include SDK detection — install instructions, quickstarts,
 * method signatures, and import patterns are identified separately from
 * generic documentation or API references.
 */

export type OutputFormat = "markdown" | "json" | "json_with_md";

export type ContentCategory =
  | "documentation"
  | "api_reference"
  | "readme"
  | "config"
  | "changelog"
  | "tabular"
  | "code_heavy"
  | "mixed"
  | "sdk"
  | "unknown";

export type DownstreamTarget = "llm_context" | "vector_db" | "knowledge_graph" | "raw_archive";

export interface ClassifierInput {
  source: string;
  html?: string;
  text?: string;
  fileExtension?: string;
  downstream: DownstreamTarget;
  forceFormat?: OutputFormat;
  /** Optional hint from agent manifest (P3n3mu3 tags this when queuing) */
  contentHint?: ContentCategory;
}

export interface ClassifierOutput {
  format: OutputFormat;
  category: ContentCategory;
  confidence: number;
  reasoning: string;
  signals: Signal[];
}

export interface Signal {
  name: string;
  value: number;
  direction: "markdown" | "json" | "neutral";
  detail: string;
}

// ─── Signal Extractors ───────────────────────────────────────────────────────

function measureProseDensity(html: string): Signal {
  const proseCount = (html.match(/<(p|blockquote|article|section)[^>]*>/gi) || []).length;
  const structCount = (html.match(/<(table|dl|ul|ol|form|select|input)[^>]*>/gi) || []).length;
  const codeCount = (html.match(/<(pre|code)[^>]*>/gi) || []).length;
  const total = proseCount + structCount + codeCount || 1;
  const ratio = proseCount / total;
  return {
    name: "prose_density",
    value: ratio,
    direction: ratio > 0.5 ? "markdown" : ratio < 0.3 ? "json" : "neutral",
    detail: `prose=${proseCount} struct=${structCount} code=${codeCount}`,
  };
}

function measureHeadingStructure(html: string): Signal {
  const headings = html.match(/<h[1-6][^>]*>/gi) || [];
  const h1 = headings.filter((h) => /h1/i.test(h)).length;
  const h2 = headings.filter((h) => /h2/i.test(h)).length;
  const h3plus = headings.filter((h) => /h[3-6]/i.test(h)).length;
  const hasHierarchy = h1 >= 1 && h2 >= 1;
  const score = hasHierarchy ? (h3plus > 3 ? 0.9 : 0.7) : headings.length > 0 ? 0.4 : 0.1;
  return {
    name: "heading_hierarchy",
    value: score,
    direction: score > 0.5 ? "markdown" : "neutral",
    detail: `h1=${h1} h2=${h2} h3+=${h3plus}`,
  };
}

function measureTableDensity(html: string): Signal {
  const tables = (html.match(/<table[^>]*>/gi) || []).length;
  const rows = (html.match(/<tr[^>]*>/gi) || []).length;
  const cells = (html.match(/<t[dh][^>]*>/gi) || []).length;
  const score = tables > 0 ? Math.min(1, tables * 0.3 + rows * 0.02 + cells * 0.005) : 0;
  return {
    name: "table_density",
    value: score,
    direction: score > 0.4 ? "json" : "neutral",
    detail: `tables=${tables} rows=${rows} cells=${cells}`,
  };
}

function measureCodeRatio(html: string): Signal {
  const codeBlocks = html.match(/<pre[^>]*>[\s\S]*?<\/pre>/gi) || [];
  const totalLen = html.replace(/<[^>]+>/g, "").length || 1;
  const codeLen = codeBlocks.map((b) => b.replace(/<[^>]+>/g, "").length).reduce((a, b) => a + b, 0);
  const ratio = codeLen / totalLen;
  return {
    name: "code_ratio",
    value: ratio,
    direction: ratio > 0.6 ? "markdown" : "neutral",
    detail: `code=${codeLen} total=${totalLen}`,
  };
}

function measureRepetitiveStructure(html: string): Signal {
  const maxRepeats = Math.max(
    (html.match(/<dt[^>]*>/gi) || []).length,
    (html.match(/<li[^>]*>/gi) || []).length,
    (html.match(/<div[^>]*class="[^"]*card[^"]*"/gi) || []).length,
    (html.match(/<tr[^>]*>/gi) || []).length
  );
  const score = maxRepeats > 20 ? 0.9 : maxRepeats > 10 ? 0.6 : maxRepeats > 5 ? 0.3 : 0.1;
  return {
    name: "repetitive_structure",
    value: score,
    direction: score > 0.5 ? "json" : "neutral",
    detail: `max_repeats=${maxRepeats}`,
  };
}

function detectExistingStructuredData(html: string): Signal {
  const jsonLd = (html.match(/<script[^>]*type="application\/ld\+json"[^>]*>/gi) || []).length;
  const openApi = /swagger|openapi/i.test(html) ? 1 : 0;
  const score = Math.min(1, jsonLd * 0.4 + openApi * 0.5);
  return {
    name: "existing_structured_data",
    value: score,
    direction: score > 0.3 ? "json" : "neutral",
    detail: `json_ld=${jsonLd} openapi=${openApi}`,
  };
}

/**
 * SDK-specific signal extractor.
 * Detects install commands, import statements, quickstart patterns,
 * and method signatures that distinguish SDK docs from generic documentation.
 */
function detectSdkPattern(html: string): Signal {
  const installSignals = (
    html.match(
      /npm install|pip install|go get|cargo add|gem install|brew install|apt install|yarn add|pnpm add|composer require|dotnet add|maven|gradle/gi
    ) || []
  ).length;
  const importSignals = (html.match(/import .+ from|require\(|from .+ import|using .+;|#include|use .+::/gi) || [])
    .length;
  const quickstartSignals = (html.match(/quickstart|getting.started|installation|setup guide|quick start/gi) || [])
    .length;
  const methodSigSignals = (html.match(/\.(connect|init|create|configure|setup|authenticate|initialize)\s*\(/gi) || [])
    .length;
  const sdkKeywords = (html.match(/\bSDK\b|client library|API client|wrapper|bindings/gi) || []).length;

  const score = Math.min(
    1,
    installSignals * 0.2 +
      importSignals * 0.15 +
      quickstartSignals * 0.25 +
      methodSigSignals * 0.15 +
      sdkKeywords * 0.25
  );

  return {
    name: "sdk_pattern",
    value: score,
    direction: score > 0.4 ? "json" : "neutral",
    detail: `install=${installSignals} import=${importSignals} quickstart=${quickstartSignals} methods=${methodSigSignals} keywords=${sdkKeywords}`,
  };
}

// ─── Pre-Scrape Repo Detection (URL-level, no credits) ──────────────────────

/**
 * Detect from URL pattern alone whether this is likely an SDK repo.
 * Runs BEFORE any scraping — zero cost.
 * Used as a prior to boost post-scrape SDK signal.
 */
export function detectSdkRepo(url: string): boolean {
  try {
    const u = new URL(url);

    if (u.hostname === "github.com") {
      const repoPath = u.pathname.toLowerCase();
      if (
        /-sdk|-client|-lib|-api|-driver|-wrapper|\.js$|\.py$|-node|-python|-go|-rust|-java|-swift|-csharp|-dotnet/.test(
          repoPath
        )
      )
        return true;
    }

    if (
      /npmjs\.com\/package|pypi\.org\/project|crates\.io\/crates|pkg\.go\.dev|rubygems\.org\/gems|nuget\.org\/packages|pub\.dev\/packages/.test(
        url
      )
    )
      return true;

    if (/^sdk\./.test(u.hostname)) return true;

    if (/docs\.rs\/|javadoc\.io|typedoc\.org/.test(url)) return true;

    return false;
  } catch {
    return false;
  }
}

// ─── Extension Map ───────────────────────────────────────────────────────────

const EXTENSION_MAP: Record<string, { format: OutputFormat; category: ContentCategory }> = {
  ".md": { format: "markdown", category: "documentation" },
  ".mdx": { format: "markdown", category: "documentation" },
  ".rst": { format: "markdown", category: "documentation" },
  ".txt": { format: "markdown", category: "documentation" },
  ".json": { format: "json", category: "config" },
  ".yaml": { format: "json", category: "config" },
  ".yml": { format: "json", category: "config" },
  ".toml": { format: "json", category: "config" },
  ".csv": { format: "json", category: "tabular" },
  ".tsv": { format: "json", category: "tabular" },
  ".ts": { format: "markdown", category: "code_heavy" },
  ".js": { format: "markdown", category: "code_heavy" },
  ".py": { format: "markdown", category: "code_heavy" },
  ".go": { format: "markdown", category: "code_heavy" },
  ".rs": { format: "markdown", category: "code_heavy" },
  ".swift": { format: "markdown", category: "code_heavy" },
  ".html": { format: "json_with_md", category: "mixed" },
  ".htm": { format: "json_with_md", category: "mixed" },
};

// ─── Downstream Bias ─────────────────────────────────────────────────────────

function getDownstreamBias(d: DownstreamTarget): { formatBias: OutputFormat; weight: number } {
  switch (d) {
    case "llm_context":
      return { formatBias: "markdown", weight: 0.4 };
    case "vector_db":
      return { formatBias: "json_with_md", weight: 0.3 };
    case "knowledge_graph":
      return { formatBias: "json", weight: 0.35 };
    case "raw_archive":
      return { formatBias: "json_with_md", weight: 0.1 };
  }
}

// ─── Category Detection ──────────────────────────────────────────────────────

function detectCategory(signals: Signal[], html: string, contentHint?: ContentCategory): ContentCategory {
  const get = (name: string) => signals.find((s) => s.name === name)?.value || 0;

  const sdkScore = get("sdk_pattern");
  const sdkHintBoost = contentHint === "sdk" ? 0.3 : 0;
  if (sdkScore + sdkHintBoost > 0.5) return "sdk";

  if (get("repetitive_structure") > 0.5 && /param|endpoint|method|request|response|status.code/i.test(html))
    return "api_reference";

  if (get("table_density") > 0.5) return "tabular";

  if (get("code_ratio") > 0.6) return "code_heavy";

  if (/!\[.*badge/i.test(html) || /npm install|pip install|cargo add/i.test(html)) {
    return "readme";
  }

  // Changelog detection: require either explicit changelog keywords OR multiple version headings
  const hasChangelogKeyword = /changelog|release\.?notes|release\.?history|what's new/i.test(html);
  const versionHeadings = (html.match(/##\s+\[?\d+\.\d+[\]\s)]/gi) || []).length;
  if (hasChangelogKeyword || versionHeadings >= 2) return "changelog";

  if (get("existing_structured_data") > 0.3) return "config";

  if (get("prose_density") > 0.4 && get("heading_hierarchy") > 0.5) return "documentation";

  if (get("prose_density") > 0.2 && (get("table_density") > 0.2 || get("code_ratio") > 0.2)) return "mixed";

  // Trust non-sdk hints when nothing else matched; "sdk" must pass the score gate above — never label sdk on hint alone
  if (contentHint && contentHint !== "unknown" && contentHint !== "sdk") return contentHint;

  return "unknown";
}

// ─── Main Classifier ─────────────────────────────────────────────────────────

export function classifyContent(input: ClassifierInput): ClassifierOutput {
  if (input.forceFormat) {
    return {
      format: input.forceFormat,
      category: "unknown",
      confidence: 1.0,
      reasoning: `Forced to ${input.forceFormat}`,
      signals: [],
    };
  }

  if (input.fileExtension && EXTENSION_MAP[input.fileExtension]) {
    const mapped = EXTENSION_MAP[input.fileExtension];
    const ds = getDownstreamBias(input.downstream);
    return {
      format: ds.weight > 0.35 ? ds.formatBias : mapped.format,
      category: mapped.category,
      confidence: 0.85,
      reasoning: `ext=${input.fileExtension} downstream=${input.downstream}`,
      signals: [
        {
          name: "file_extension",
          value: 0.85,
          direction: mapped.format === "json" ? "json" : "markdown",
          detail: `ext=${input.fileExtension}`,
        },
      ],
    };
  }

  const html = input.html || input.text || "";
  if (!html && !input.text) {
    return { format: "markdown", category: "unknown", confidence: 0.3, reasoning: "No content", signals: [] };
  }

  const signals: Signal[] = [
    measureProseDensity(html),
    measureHeadingStructure(html),
    measureTableDensity(html),
    measureCodeRatio(html),
    measureRepetitiveStructure(html),
    detectExistingStructuredData(html),
    detectSdkPattern(html),
  ];

  const isSdkRepo = detectSdkRepo(input.source);
  if (isSdkRepo) {
    signals.push({
      name: "url_sdk_pattern",
      value: 0.4,
      direction: "json",
      detail: `URL matches SDK repo pattern: ${input.source}`,
    });
  }

  const mdScore = signals.filter((s) => s.direction === "markdown").reduce((sum, s) => sum + s.value, 0);
  const jsonScore = signals.filter((s) => s.direction === "json").reduce((sum, s) => sum + s.value, 0);

  const ds = getDownstreamBias(input.downstream);
  const biasedMd = mdScore + (ds.formatBias === "markdown" ? ds.weight : 0);
  const biasedJson = jsonScore + (ds.formatBias === "json" ? ds.weight : 0);
  const biasedHybrid =
    (ds.formatBias === "json_with_md" ? ds.weight : 0) + (Math.abs(biasedMd - biasedJson) < 0.3 ? 0.3 : 0);

  const category = detectCategory(signals, html, input.contentHint);

  let format: OutputFormat;
  let confidence: number;

  if (category === "sdk") {
    format = "json_with_md";
    const sdkSignal = signals.find((s) => s.name === "sdk_pattern")?.value ?? 0;
    const hintBoost = input.contentHint === "sdk" ? 0.15 : 0;
    confidence = Math.min(0.95, 0.6 + sdkSignal * 0.3 + hintBoost);
  } else {
    const maxScore = Math.max(biasedMd, biasedJson, biasedHybrid);
    const total = biasedMd + biasedJson + biasedHybrid + 0.01;

    if (biasedMd === maxScore) {
      format = "markdown";
      confidence = Math.min(0.95, biasedMd / total);
    } else if (biasedJson === maxScore) {
      format = "json";
      confidence = Math.min(0.95, biasedJson / total);
    } else {
      format = "json_with_md";
      confidence = Math.min(0.95, biasedHybrid / total);
    }
  }

  return {
    format,
    category,
    confidence,
    reasoning: `md=${biasedMd.toFixed(2)} json=${biasedJson.toFixed(2)} hybrid=${biasedHybrid.toFixed(2)} | cat=${category} | downstream=${input.downstream}${input.contentHint ? ` | hint=${input.contentHint}` : ""}${isSdkRepo ? " | url_sdk=true" : ""}`,
    signals,
  };
}

// ─── llms.txt Probe ──────────────────────────────────────────────────────────

export interface LlmsProbeResult {
  found: boolean;
  type: "llms-full.txt" | "llms.txt" | "sitemap" | "none";
  content?: string;
  url?: string;
  recommendation: "use_as_is" | "use_as_index" | "scrape_html" | "scrape_with_sitemap";
  suggestedFormat: OutputFormat;
}

export async function probeLlmsTxt(baseUrl: string): Promise<LlmsProbeResult> {
  const base = baseUrl.replace(/\/+$/, "");
  for (const probe of [
    { path: "/llms-full.txt", type: "llms-full.txt" as const },
    { path: "/llms.txt", type: "llms.txt" as const },
    { path: "/sitemap.xml", type: "sitemap" as const },
  ]) {
    try {
      const url = `${base}${probe.path}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(url, {
        method: "GET",
        headers: { "User-Agent": "gitgod-classifier/1.0" },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!response.ok) continue;
      const contentType = response.headers.get("content-type") || "";
      const content = await response.text();
      if (content.length < 50) continue;
      if (contentType.includes("text/html") && probe.type !== "sitemap") continue;
      if (probe.type === "llms-full.txt")
        return {
          found: true,
          type: "llms-full.txt",
          content,
          url,
          recommendation: "use_as_is",
          suggestedFormat: "markdown",
        };
      if (probe.type === "llms.txt")
        return {
          found: true,
          type: "llms.txt",
          content,
          url,
          recommendation: "use_as_index",
          suggestedFormat: "json_with_md",
        };
      if (probe.type === "sitemap" && (content.includes("<urlset") || content.includes("<sitemapindex")))
        return {
          found: true,
          type: "sitemap",
          content,
          url,
          recommendation: "scrape_with_sitemap",
          suggestedFormat: "json_with_md",
        };
    } catch {
      continue;
    }
  }
  return { found: false, type: "none", recommendation: "scrape_html", suggestedFormat: "markdown" };
}

export function parseLlmsIndex(content: string): Array<{ title: string; url: string; description: string }> {
  const entries: Array<{ title: string; url: string; description: string }> = [];
  for (const line of content.split("\n")) {
    const match = line.match(/^[-*]\s+\[([^\]]+)\]\(([^)]+)\)(?::\s*(.+))?/);
    if (match)
      entries.push({
        title: match[1].trim(),
        url: match[2].trim(),
        description: (match[3] || "").trim(),
      });
  }
  return entries;
}
