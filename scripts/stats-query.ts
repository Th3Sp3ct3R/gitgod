import { loadGraphs } from "./src/acp/loader.js";
import { getStats } from "./src/acp/tools/stats.js";
import { recommend } from "./src/acp/tools/recommend.js";

const index = await loadGraphs("./data");
const stats = getStats(index, {});

console.log("=== GLOBAL KNOWLEDGE GRAPH STATS ===");
console.log("Total graphs (repos):", stats.total_graphs);
console.log("Total tools/links:", stats.total_tools);
console.log("Alive:", stats.total_alive);
console.log("Dead:", stats.total_dead);
console.log("Synthesized:", stats.total_synthesized);
console.log("Categories:", stats.total_categories);
console.log();

console.log("=== TOP 10 TOOLS (by relevance + stars) ===");
for (const t of stats.top_tools) {
  console.log(`  ${t.name} | score: ${t.relevance_score} | stars: ${(t.github_stars || 0).toLocaleString()}`);
}
console.log();

console.log("=== SCORE DISTRIBUTION ===");
for (const [score, count] of Object.entries(stats.score_distribution)) {
  console.log(`  Score ${score}: ${count} tools`);
}
console.log();

console.log("=== TOP 20 TAGS ===");
const sortedTags = Object.entries(stats.tag_distribution).sort((a: any, b: any) => b[1] - a[1]).slice(0, 20);
for (const [tag, count] of sortedTags) {
  console.log(`  ${tag}: ${count}`);
}
console.log();

// Per-graph summary
console.log("=== PER-REPO SUMMARY ===");
for (const g of index.graphs.sort((a: any, b: any) => b.stats.total_tools - a.stats.total_tools)) {
  const s = getStats(index, { graph: g.slug });
  console.log(`  ${g.slug} | tools: ${s.total_tools} | alive: ${s.total_alive} | synth: ${s.total_synthesized} | cats: ${s.total_categories}`);
}
