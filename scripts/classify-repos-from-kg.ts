/**
 * Classify repos using only ingested knowledge-graph.json (README → taxonomy + tools).
 * Raw README text is not stored under data/ by default; classification uses that structural signal.
 *
 * Multi-label & mega-repos:
 * - `labels`: every kind that matched (not winner-take-all).
 * - `turns`: one entry per README top-level section (root taxonomy node) with its own labels + indicators.
 *   Use this when one repo "contains" several kinds (monolith README, awesome list + guide, etc.).
 * - `structure`: heterogeneity + when to split work by turn vs treat as one surface.
 * True package-level splits (pnpm workspaces) need decomposition or package manifests — not in KG alone.
 *
 * Usage (from repo root):
 *   npx tsx scripts/classify-repos-from-kg.ts --limit 20
 *   npx tsx scripts/classify-repos-from-kg.ts --all --json > data/repo-classifications.jsonl
 */
import { loadGraphs } from "../src/acp/loader.js";
import type { Category } from "../src/types.js";

export type RepoKind =
  | "curated-list"
  | "crm-or-sales-app"
  | "agent-orchestration"
  | "llm-ml-infra"
  | "devtools-cli"
  | "sdk-library"
  | "web-app-product"
  | "docs-or-marketing-site"
  | "unknown";

export interface LabelHit {
  kind: RepoKind;
  score: number;
  evidence: string;
}

interface KindRule {
  kind: RepoKind;
  weight: number;
  test: (ctx: ClassifyContext) => { hit: boolean; evidence: string };
}

interface ClassifyContext {
  slug: string;
  repo: string;
  blob: string;
  categoryNames: string[];
  toolNames: string[];
  stats: { categories: number; links: number; total_tools: number };
}

function extractIndicators(text: string): string[] {
  const indicators: string[] = [];
  const checks: [RegExp, string][] = [
    [/\b(api|sdk|client)\b/i, "api/sdk"],
    [/\b(cli|command\s*line|terminal)\b/i, "cli"],
    [/\b(docker|kubernetes|deploy)\b/i, "deploy"],
    [/\b(test|ci|github\s*actions)\b/i, "test/ci"],
    [/\b(docs?|documentation|getting\s*started)\b/i, "docs"],
    [/\b(security|auth|oauth)\b/i, "security"],
    [/\b(agent|llm|model|inference)\b/i, "ai"],
    [/\b(monorepo|workspace|packages)\b/i, "monorepo"],
  ];
  const lower = text.toLowerCase();
  for (const [re, label] of checks) {
    if (re.test(lower)) indicators.push(label);
  }
  return [...new Set(indicators)];
}

function countSubtree(c: Category): { cats: number; tools: number } {
  let cats = 1;
  let tools = c.tools.length;
  for (const sub of c.subcategories) {
    const t = countSubtree(sub);
    cats += t.cats;
    tools += t.tools;
  }
  return { cats, tools };
}

function walkTaxonomy(cats: Category[]): { categoryNames: string[]; toolNames: string[] } {
  const categoryNames: string[] = [];
  const toolNames: string[] = [];

  function walk(nodes: Category[]) {
    for (const n of nodes) {
      categoryNames.push(n.category);
      for (const t of n.tools) toolNames.push(t.name);
      walk(n.subcategories);
    }
  }
  walk(cats);
  return { categoryNames, toolNames };
}

function buildContext(
  slug: string,
  repo: string,
  taxonomy: Category[],
  stats: { categories: number; links: number; total_tools: number }
): ClassifyContext {
  const { categoryNames, toolNames } = walkTaxonomy(taxonomy);
  const blob = [slug, repo, ...categoryNames, ...toolNames].join(" \n ").toLowerCase();
  return { slug, repo, blob, categoryNames, toolNames, stats };
}

const RULES: KindRule[] = [
  {
    kind: "curated-list",
    weight: 1.0,
    test: (c) => {
      if (/awesome|curated|resources?\s+for|list\s+of/i.test(c.repo) || /awesome/.test(c.slug)) {
        return { hit: true, evidence: "repo/slug looks like awesome/curated list" };
      }
      if (c.stats.total_tools >= 40 && c.stats.categories >= 8) {
        return { hit: true, evidence: `high tool count (${c.stats.total_tools}) + many categories` };
      }
      return { hit: false, evidence: "" };
    },
  },
  {
    kind: "crm-or-sales-app",
    weight: 0.95,
    test: (c) => {
      const t = /crm|sales\s*pipeline|open[- ]source\s*crm|customer\s*relationship/i;
      if (t.test(c.blob)) return { hit: true, evidence: "CRM/sales keywords in headings or tools" };
      return { hit: false, evidence: "" };
    },
  },
  {
    kind: "agent-orchestration",
    weight: 0.9,
    test: (c) => {
      if (
        /(multi[- ]?agent|agent\s+framework|orchestrat|langgraph|crewai|autonomous\s+agent)/i.test(c.blob)
      ) {
        return { hit: true, evidence: "agent/orchestration terms" };
      }
      return { hit: false, evidence: "" };
    },
  },
  {
    kind: "llm-ml-infra",
    weight: 0.85,
    test: (c) => {
      if (/(llm|inference|gpu|transformer|vllm|ollama|model\s+server|embedding)/i.test(c.blob)) {
        return { hit: true, evidence: "LLM/ML infra keywords" };
      }
      return { hit: false, evidence: "" };
    },
  },
  {
    kind: "devtools-cli",
    weight: 0.85,
    test: (c) => {
      if (/(command[\s-]line|cli tool|\bcli\b|terminal|dev\s*tool)/i.test(c.blob)) {
        return { hit: true, evidence: "CLI/devtools keywords" };
      }
      return { hit: false, evidence: "" };
    },
  },
  {
    kind: "sdk-library",
    weight: 0.8,
    test: (c) => {
      if (/\bsdk\b|api\s*client|npm\s+package|library for/i.test(c.blob)) {
        return { hit: true, evidence: "SDK/library wording" };
      }
      return { hit: false, evidence: "" };
    },
  },
  {
    kind: "docs-or-marketing-site",
    weight: 0.75,
    test: (c) => {
      if (
        c.stats.total_tools <= 3 &&
        /documentation|getting\s+started|privacy|data\s+collection/i.test(c.blob)
      ) {
        return { hit: true, evidence: "sparse tools + docs/legal-style headings" };
      }
      return { hit: false, evidence: "" };
    },
  },
  {
    kind: "web-app-product",
    weight: 0.5,
    test: (c) => {
      if (/(dashboard|saas|deploy|self[- ]hosted|sign\s*up|pricing)/i.test(c.blob)) {
        return { hit: true, evidence: "product/SaaS signals" };
      }
      return { hit: false, evidence: "" };
    },
  },
];

function collectLabels(ctx: ClassifyContext): LabelHit[] {
  const hits: LabelHit[] = [];
  for (const rule of RULES) {
    const { hit, evidence } = rule.test(ctx);
    if (hit && evidence) {
      hits.push({ kind: rule.kind, score: rule.weight, evidence });
    }
  }
  hits.sort((a, b) => b.score - a.score);
  return hits;
}

function classify(ctx: ClassifyContext): {
  primary_kind: RepoKind;
  confidence: number;
  labels: LabelHit[];
  multi_label: boolean;
  evidence: string[];
  alternatives: { kind: RepoKind; weight: number; evidence: string }[];
} {
  const labels = collectLabels(ctx);
  const alternatives = labels.map((h) => ({ kind: h.kind, weight: h.score, evidence: h.evidence }));

  if (labels.length === 0) {
    return {
      primary_kind: "unknown",
      confidence: 0.2,
      labels: [{ kind: "unknown", score: 0.2, evidence: "no strong keyword match on README-derived taxonomy" }],
      multi_label: false,
      evidence: ["no strong keyword match on README-derived taxonomy"],
      alternatives: [],
    };
  }

  const top = labels[0]!;
  const nonUnknown = labels.filter((l) => l.kind !== "unknown");
  const multi_label = new Set(nonUnknown.map((l) => l.kind)).size >= 2;

  return {
    primary_kind: top.kind,
    confidence: Math.min(0.99, top.score * (labels.length > 1 ? 0.92 : 1)),
    labels,
    multi_label,
    evidence: [top.evidence],
    alternatives: alternatives.slice(1, 4),
  };
}

function buildTurns(
  slug: string,
  repo: string,
  rootTaxonomy: Category[],
  repoStats: { categories: number; links: number; total_tools: number }
): {
  turns: {
    index: number;
    heading: string;
    depth: number;
    indicators: string[];
    labels: LabelHit[];
    stats: { subtree_categories: number; subtree_tools: number };
  }[];
  structure: {
    root_sections: number;
    heterogeneity: "low" | "medium" | "high";
    distinct_kinds_in_turns: RepoKind[];
    mega_repo: boolean;
    split_strategy: "single_surface" | "prefer_by_turn" | "needs_deeper_signals";
  };
} {
  const turns: {
    index: number;
    heading: string;
    depth: number;
    indicators: string[];
    labels: LabelHit[];
    stats: { subtree_categories: number; subtree_tools: number };
  }[] = [];

  let idx = 0;
  for (const node of rootTaxonomy) {
    const { cats, tools } = countSubtree(node);
    const { categoryNames, toolNames } = walkTaxonomy([node]);
    const blob = [slug, repo, ...categoryNames, ...toolNames].join(" \n ").toLowerCase();
    const subCtx: ClassifyContext = {
      slug,
      repo,
      blob,
      categoryNames,
      toolNames,
      stats: {
        categories: cats,
        links: repoStats.links,
        total_tools: tools,
      },
    };
    const labels = collectLabels(subCtx);
    const indicators = extractIndicators([node.category, ...categoryNames.slice(0, 6)].join(" "));
    turns.push({
      index: idx++,
      heading: node.category,
      depth: node.depth,
      indicators,
      labels: labels.length ? labels : [{ kind: "unknown", score: 0.15, evidence: "no rule match in section subtree" }],
      stats: { subtree_categories: cats, subtree_tools: tools },
    });
  }

  const primaryKinds = new Set<RepoKind>();
  for (const t of turns) {
    const best = t.labels[0];
    if (best) primaryKinds.add(best.kind);
  }
  const distinct = [...primaryKinds].filter((k) => k !== "unknown");
  let heterogeneity: "low" | "medium" | "high" = "low";
  if (distinct.length >= 3) heterogeneity = "high";
  else if (distinct.length === 2) heterogeneity = "medium";

  const mega_repo =
    repoStats.total_tools >= 80 ||
    repoStats.categories >= 25 ||
    rootTaxonomy.length >= 10;

  let split_strategy: "single_surface" | "prefer_by_turn" | "needs_deeper_signals" = "single_surface";
  if (mega_repo && heterogeneity !== "low") split_strategy = "prefer_by_turn";
  else if (mega_repo && heterogeneity === "low") split_strategy = "needs_deeper_signals";

  return {
    turns,
    structure: {
      root_sections: rootTaxonomy.length,
      heterogeneity,
      distinct_kinds_in_turns: distinct,
      mega_repo,
      split_strategy,
    },
  };
}

const args = process.argv.slice(2);
let limit = 20;
let asJsonl = false;
let all = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--limit" && args[i + 1]) {
    limit = parseInt(args[i + 1]!, 10);
    i++;
  } else if (args[i] === "--json") asJsonl = true;
  else if (args[i] === "--all") all = true;
}

const index = loadGraphs("./data");
const rows = index.graphs
  .filter((g) => g.skeleton.taxonomy?.length)
  .map((g) => {
    const { categoryNames, toolNames } = walkTaxonomy(g.skeleton.taxonomy);
    const repoStats = {
      categories: g.stats.categories,
      links: g.skeleton.stats.links,
      total_tools: g.stats.total_tools,
    };
    const ctx = buildContext(g.slug, g.skeleton.repo, g.skeleton.taxonomy, repoStats);
    const out = classify(ctx);
    const { turns, structure } = buildTurns(g.slug, g.skeleton.repo, g.skeleton.taxonomy, repoStats);
    return {
      slug: g.slug,
      repo: g.skeleton.repo,
      url: g.skeleton.url,
      scraped_at: g.skeleton.scraped_at,
      stats: repoStats,
      signals: {
        category_headings_sample: categoryNames.slice(0, 12),
        tool_names_sample: toolNames.slice(0, 8),
      },
      classification: out,
      turns,
      structure,
    };
  });

const picked = all ? rows : rows.slice(0, Math.min(limit, rows.length));

if (asJsonl) {
  for (const r of picked) console.log(JSON.stringify(r));
} else {
  console.log(
    `# Repo kind (multi-label + per-section turns). Showing ${picked.length} of ${rows.length} classified.\n`
  );
  for (const r of picked) {
    console.log(`## ${r.repo}`);
    console.log(`  slug: ${r.slug}`);
    console.log(
      `  primary: ${r.classification.primary_kind} (~${r.classification.confidence.toFixed(2)}) | multi-label: ${r.classification.multi_label}`
    );
    console.log(
      `  labels: ${r.classification.labels.map((l) => `${l.kind}:${l.score.toFixed(2)}`).join(", ")}`
    );
    console.log(`  why: ${r.classification.evidence.join("; ")}`);
    if (r.classification.alternatives.length) {
      console.log(
        `  alt: ${r.classification.alternatives.map((a) => `${a.kind}(${a.evidence})`).join(" | ")}`
      );
    }
    console.log(
      `  structure: sections=${r.structure.root_sections} heterogeneity=${r.structure.heterogeneity} mega=${r.structure.mega_repo} split=${r.structure.split_strategy} distinct_kinds=[${r.structure.distinct_kinds_in_turns.join(", ")}]`
    );
    const showTurns = r.turns.slice(0, 6);
    for (const t of showTurns) {
      const top = t.labels[0];
      const lbl = top ? `${top.kind}(${top.score.toFixed(2)})` : "?";
      const ind = t.indicators.length ? ` indicators=[${t.indicators.join(", ")}]` : "";
      console.log(
        `    turn[${t.index}] "${t.heading.slice(0, 56)}${t.heading.length > 56 ? "…" : ""}" -> ${lbl}${ind} tools=${t.stats.subtree_tools}`
      );
    }
    if (r.turns.length > showTurns.length) {
      console.log(`    … ${r.turns.length - showTurns.length} more turns`);
    }
    console.log("");
  }
}
