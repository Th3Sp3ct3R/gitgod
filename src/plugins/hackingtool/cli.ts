import type { Command } from "commander";
import path from "node:path";
import { createEngine } from "./engine.js";
import { DISCLAIMER_SHORT } from "./disclaimer.js";

function resolveDataDir(opts: { dataDir: string }): string {
  return path.resolve(process.cwd(), process.env.GITGOD_DATA_DIR ?? opts.dataDir);
}

export function registerHackingtoolCommands(parent: Command): void {
  const ht = parent
    .command("hackingtool")
    .description(`Security toolkit — 158 tools from z4nzu/hackingtool. ${DISCLAIMER_SHORT}`);

  ht.command("search <query>")
    .description("NLP search across security tools")
    .option("-n, --max <n>", "Max results", "10")
    .option("-d, --data-dir <path>", "Data directory", "./data")
    .action((query: string, opts: { max: string; dataDir: string }) => {
      const engine = createEngine(resolveDataDir(opts));
      const max = parseInt(opts.max, 10) || 10;
      const results = engine.search(query, max);

      if (results.length === 0) {
        console.log(`No tools found for "${query}"`);
        return;
      }

      console.log(`\nSearch: "${query}" (${results.length} results)\n`);
      for (const t of results) {
        const stars = t.github_stars ? ` | ${t.github_stars.toLocaleString()} stars` : "";
        console.log(`  ${t.name}`);
        console.log(`    ${t.summary}`);
        console.log(`    Tags: ${t.tags.slice(0, 5).join(", ")}${stars}`);
        console.log(`    Score: ${t.relevance_score}/5 | ${t.categoryPath}`);
        console.log();
      }
    });

  ht.command("browse [category]")
    .description("Browse tools by category")
    .option("-d, --data-dir <path>", "Data directory", "./data")
    .action((category: string | undefined, opts: { dataDir: string }) => {
      const engine = createEngine(resolveDataDir(opts));
      const result = engine.browse(category);

      if (result.categories.length === 0) {
        console.log(category ? `No category matching "${category}"` : "No categories found");
        return;
      }

      console.log(`\nSecurity Tools${category ? ` — ${category}` : ""} (${result.total} tools)\n`);
      for (const cat of result.categories) {
        console.log(`  [${cat.name}] (${cat.toolCount} tools)`);
        for (const tool of cat.tools.slice(0, 5)) {
          console.log(`    - ${tool.name}: ${tool.summary.slice(0, 80)}`);
        }
        if (cat.tools.length > 5) {
          console.log(`    ...and ${cat.tools.length - 5} more`);
        }
        console.log();
      }
    });

  ht.command("recommend <useCase>")
    .description("Use-case based tool recommendations")
    .option("-n, --max <n>", "Max recommendations", "5")
    .option("-t, --tags <tags>", "Preferred tags (comma-separated)")
    .option("-d, --data-dir <path>", "Data directory", "./data")
    .action((useCase: string, opts: { max: string; tags?: string; dataDir: string }) => {
      const engine = createEngine(resolveDataDir(opts));
      const max = parseInt(opts.max, 10) || 5;
      const preferTags = opts.tags ? opts.tags.split(",").map((t) => t.trim()) : undefined;
      const result = engine.recommend(useCase, { max, preferTags });

      if (result.recommendations.length === 0) {
        console.log(`No recommendations for "${useCase}"`);
        return;
      }

      console.log(`\nRecommendations for: "${useCase}"\n`);
      for (const [i, r] of result.recommendations.entries()) {
        console.log(`  ${i + 1}. ${r.name} (score: ${r.relevance_score}/5, match: ${r.matchScore})`);
        console.log(`     ${r.summary}`);
        console.log(`     Tags: ${r.tags.slice(0, 5).join(", ")}`);
        console.log(`     ${r.rationale}`);
        console.log();
      }
    });

  ht.command("compare <tools...>")
    .description("Side-by-side tool comparison")
    .option("-d, --data-dir <path>", "Data directory", "./data")
    .action((toolNames: string[], opts: { dataDir: string }) => {
      if (toolNames.length < 2) {
        console.error("Compare requires at least 2 tool names");
        process.exit(1);
      }

      const engine = createEngine(resolveDataDir(opts));
      const result = engine.compare(toolNames);

      if (result.notFound.length > 0) {
        console.log(`\nNot found: ${result.notFound.join(", ")}`);
      }

      if (result.comparison.length === 0) {
        console.log("No tools found to compare");
        return;
      }

      console.log(`\nComparison: ${result.comparison.map((c) => c.name).join(" vs ")}\n`);

      // Table header
      const cols = result.comparison;
      const maxNameLen = Math.max(...cols.map((c) => c.name.length), 8);
      console.log(`  ${"Field".padEnd(16)} ${cols.map((c) => c.name.padEnd(maxNameLen + 2)).join("")}`);
      console.log(`  ${"─".repeat(16)} ${cols.map(() => "─".repeat(maxNameLen + 2)).join("")}`);
      console.log(`  ${"Score".padEnd(16)} ${cols.map((c) => String(c.relevance_score).padEnd(maxNameLen + 2)).join("")}`);
      console.log(`  ${"Stars".padEnd(16)} ${cols.map((c) => (c.github_stars?.toLocaleString() || "n/a").padEnd(maxNameLen + 2)).join("")}`);
      console.log(`  ${"Language".padEnd(16)} ${cols.map((c) => (c.language || "n/a").padEnd(maxNameLen + 2)).join("")}`);
      console.log(`  ${"Category".padEnd(16)} ${cols.map((c) => c.category.slice(0, maxNameLen + 1).padEnd(maxNameLen + 2)).join("")}`);

      if (result.sharedTags.length > 0) {
        console.log(`\n  Shared tags: ${result.sharedTags.join(", ")}`);
      }

      for (const [name, tags] of Object.entries(result.uniqueTags)) {
        if (tags.length > 0) {
          console.log(`  Unique to ${name}: ${tags.join(", ")}`);
        }
      }
      console.log();
    });

  ht.command("stats")
    .description("Dashboard: scores, languages, top tools")
    .option("-d, --data-dir <path>", "Data directory", "./data")
    .action((opts: { dataDir: string }) => {
      const engine = createEngine(resolveDataDir(opts));
      const s = engine.stats();

      console.log(`\nSecurity Toolkit Dashboard`);
      console.log(`${"─".repeat(40)}`);
      console.log(`  Tools:      ${s.totalTools}`);
      console.log(`  Categories: ${s.totalCategories}`);
      console.log();

      console.log(`  Score Distribution:`);
      for (const [score, count] of Object.entries(s.scoreDistribution)) {
        const bar = "#".repeat(Math.min(count, 40));
        console.log(`    ${score}/5: ${bar} (${count})`);
      }
      console.log();

      if (Object.keys(s.languages).length > 0) {
        console.log(`  Languages:`);
        const sorted = Object.entries(s.languages).sort((a, b) => b[1] - a[1]);
        for (const [lang, count] of sorted.slice(0, 10)) {
          console.log(`    ${lang}: ${count}`);
        }
        console.log();
      }

      console.log(`  Top 10 Tools:`);
      for (const [i, t] of s.topTools.entries()) {
        const stars = t.github_stars ? ` (${t.github_stars.toLocaleString()} stars)` : "";
        console.log(`    ${i + 1}. ${t.name} — ${t.relevance_score}/5${stars}`);
      }

      console.log();
      console.log(`  Category Breakdown:`);
      for (const c of s.categoryBreakdown) {
        console.log(`    ${c.category}: ${c.toolCount} tools (avg ${c.avgScore}/5)`);
      }
      console.log();
    });

  ht.command("categories")
    .description("List all categories with counts and top tools")
    .option("-d, --data-dir <path>", "Data directory", "./data")
    .action((opts: { dataDir: string }) => {
      const engine = createEngine(resolveDataDir(opts));
      const cats = engine.categories();

      if (cats.length === 0) {
        console.log("No categories found");
        return;
      }

      console.log(`\nSecurity Tool Categories (${cats.length})\n`);
      for (const [i, c] of cats.entries()) {
        console.log(`  ${i + 1}. ${c.name} (${c.toolCount} tools, avg ${c.avgScore}/5)`);
        console.log(`     Top: ${c.topTools.join(", ")}`);
      }
      console.log();
    });
}
