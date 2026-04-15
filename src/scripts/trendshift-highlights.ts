import { loadGraphs } from "../acp/loader.js";
import { getStats } from "../acp/tools/stats.js";
import { find } from "../acp/tools/find.js";

const index = await loadGraphs("./data");

// The trendshift batch repos (from the last ingest run)
const trendshiftRepos = [
  "hacksider-deep-live-cam",
  "microsoft-vibevoice",
  "jcodesmore-ai-website-cloner-template",
  "panniantong-agent-reach",
  "luongnv89-claude-howto",
  "shanraisshan-claude-code-best-practice",
  "z4nzu-hackingtool",
  "generalaction-emdash",
  "onyx-dot-app-onyx",
  "sakanaai-ai-scientist-v2",
  "paperclipai-paperclip",
  "mvanhorn-last30days-skill",
  "yeachan-heo-oh-my-claudecode",
  "apache-superset",
  "datalab-to-chandra",
  "twentyhq-twenty",
  "nidhinjs-prompt-master",
  "magnum6actual-flipoff",
  "rkiding-awesome-finance-skills",
  "virattt-dexter",
  "ronitsingh10-finetune",
  "slavingia-skills",
];

console.log("=== TRENDSHIFT BATCH: REPO SIGNIFICANCE REPORT ===\n");

// Per-repo stats sorted by tool count
const repoStats: Array<{ slug: string; tools: number; alive: number; synth: number; cats: number; topScore: number }> = [];

for (const slug of trendshiftRepos) {
  const graph = index.graphs.find((g: any) => g.slug === slug);
  if (!graph) continue;
  const s = getStats(index, { graph: slug });

  // Get the highest-scored tool in this repo
  const repoTools = index.allTools.filter((t: any) => t.graphSlug === slug);
  const topScore = repoTools.length > 0
    ? Math.max(...repoTools.map((t: any) => t.relevance_score || 0))
    : 0;

  repoStats.push({ slug, tools: s.total_tools, alive: s.total_alive, synth: s.total_synthesized, cats: s.total_categories, topScore });
}

repoStats.sort((a, b) => b.tools - a.tools);

console.log("--- REPOS BY SIZE ---");
for (const r of repoStats) {
  console.log(`  ${r.slug.padEnd(45)} | tools: ${String(r.tools).padStart(4)} | alive: ${String(r.alive).padStart(4)} | synth: ${String(r.synth).padStart(4)} | top_score: ${r.topScore}`);
}
console.log();

// Now get all high-scored tools (score >= 4) across trendshift repos
console.log("--- HIGH-VALUE TOOLS (score >= 4) ---");
const highValueTools: Array<{ name: string; graph: string; score: number; summary: string; tags: string[]; stars: number }> = [];

for (const slug of trendshiftRepos) {
  const repoTools = index.allTools.filter((t: any) => t.graphSlug === slug && (t.relevance_score || 0) >= 4);
  for (const t of repoTools) {
    highValueTools.push({
      name: t.name,
      graph: slug,
      score: t.relevance_score,
      summary: t.summary || "",
      tags: t.tags || [],
      stars: t.github_stars || 0,
    });
  }
}

highValueTools.sort((a, b) => b.score - a.score || b.stars - a.stars);

for (const t of highValueTools.slice(0, 30)) {
  console.log(`  [${t.score}/5] ${t.name}`);
  console.log(`         repo: ${t.graph} | stars: ${t.stars.toLocaleString()} | tags: ${t.tags.slice(0, 5).join(", ")}`);
  if (t.summary) console.log(`         ${t.summary.slice(0, 120)}`);
  console.log();
}

console.log(`Total high-value tools (score >= 4): ${highValueTools.length}`);
console.log();

// Category breakdown across trendshift repos
console.log("--- CATEGORY BREAKDOWN (trendshift batch) ---");
const catCounts: Record<string, number> = {};
for (const slug of trendshiftRepos) {
  const repoTools = index.allTools.filter((t: any) => t.graphSlug === slug);
  for (const t of repoTools) {
    const cat = t.categoryPath || "uncategorized";
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  }
}
const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);
for (const [cat, count] of sortedCats) {
  console.log(`  ${cat}: ${count}`);
}
