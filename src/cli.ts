// src/cli.ts
import { Command } from "commander";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { startServer } from "./acp/server.js";

const program = new Command();

function parsePositiveIntOption(
  raw: string,
  label: string,
  maxValue: number
): number | undefined {
  if (raw === "0") return undefined;
  if (!/^\d+$/.test(raw)) {
    throw new Error(`Invalid ${label}: ${raw}`);
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label}: ${raw}`);
  }
  if (parsed > maxValue) {
    throw new Error(`${label} too high (${parsed}); max allowed is ${maxValue}`);
  }
  return parsed;
}

function parseNonNegativeIntOption(raw: string, label: string, maxValue: number): number {
  if (!/^\d+$/.test(raw)) {
    throw new Error(`Invalid ${label}: ${raw}`);
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid ${label}: ${raw}`);
  }
  if (parsed > maxValue) {
    throw new Error(`${label} too high (${parsed}); max allowed is ${maxValue}`);
  }
  return parsed;
}

program
  .name("gitgod")
  .description("Deep repo scraper — turns repos into knowledge graphs")
  .version("0.1.0");

program
  .command("parse <url>")
  .description("Stage 1: Clone repo and parse README into skeleton.json")
  .action(async (url: string) => {
    const { cloneAndParse } = await import("./stages/clone-parse.js");
    await cloneAndParse(url);
  });

program
  .command("enrich <skeleton>")
  .description("Stage 2: Enrich skeleton with Firecrawl scrapes")
  .option("-c, --concurrency <n>", "concurrent scrapes (1-5)", "1")
  .action(async (skeleton: string, opts: { concurrency: string }) => {
    const { enrich } = await import("./stages/enrich.js");
    const concurrency = parseInt(opts.concurrency, 10);
    if (isNaN(concurrency)) throw new Error(`Invalid concurrency value: ${opts.concurrency}`);
    await enrich(skeleton, concurrency);
  });

program
  .command("synthesize <enriched>")
  .description("Stage 3: LLM synthesis of enriched data")
  .action(async (enriched: string) => {
    const { synthesize } = await import("./stages/synthesize.js");
    await synthesize(enriched);
  });

program
  .command("decompose <knowledgeGraph>")
  .description("Stage 4: Decompose linked GitHub repos (Level 4)")
  .action(async (kg: string) => {
    const { decompose } = await import("./stages/decompose.js");
    await decompose(kg);
  });

program
  .command("harness [repoPath]")
  .description("Stage 6: Build/consume CLI-Anything harness and ingest CLI metadata")
  .option("--focus <text>", "Optional refine focus area")
  .option("--all", "Run Stage 6 for all repos listed in data/harness-targets.json")
  .option("-d, --data-dir <path>", "Data directory (default: ./data)", "./data")
  .option(
    "--decomposition <path>",
    "Explicit decomposition json path (default: data/<repoSlug>/decomposition.json)"
  )
  .action(
    async (
      repoPath: string | undefined,
      opts: { focus?: string; all?: boolean; dataDir: string; decomposition?: string }
    ) => {
      const { harness } = await import("./stages/harness.js");
      const dataDir = path.resolve(process.cwd(), opts.dataDir);

      if (opts.all) {
        const targetsPath = path.join(dataDir, "harness-targets.json");
        if (!existsSync(targetsPath)) {
          throw new Error(`Missing ${targetsPath}. Add an array of { slug, repoPath } objects.`);
        }
        const targets = JSON.parse(readFileSync(targetsPath, "utf-8")) as Array<{
          slug: string;
          repoPath: string;
        }>;
        for (const target of targets) {
          const decompositionPath = path.join(dataDir, target.slug, "decomposition.json");
          if (!existsSync(decompositionPath)) {
            console.log(`[harness] skipping ${target.slug}: no decomposition at ${decompositionPath}`);
            continue;
          }
          const decomposition = JSON.parse(readFileSync(decompositionPath, "utf-8"));
          await harness({
            slug: target.slug,
            repoPath: path.resolve(target.repoPath),
            decomposition,
            dataDir,
            refineFocus: opts.focus,
            outputDir: path.join(dataDir, "harnesses"),
          });
        }
        return;
      }

      if (!repoPath) {
        throw new Error("repoPath is required unless --all is set.");
      }
      const resolvedRepoPath = path.resolve(repoPath);
      const slug = path.basename(resolvedRepoPath).toLowerCase();
      const decompositionPath = opts.decomposition
        ? path.resolve(opts.decomposition)
        : path.join(dataDir, slug, "decomposition.json");
      if (!existsSync(decompositionPath)) {
        const known = existsSync(dataDir)
          ? readdirSync(dataDir).filter((entry) => existsSync(path.join(dataDir, entry, "decomposition.json")))
          : [];
        throw new Error(
          `Missing decomposition file at ${decompositionPath}. Run decompose first. Known slugs with decomposition: ${known.join(", ")}`
        );
      }
      const decomposition = JSON.parse(readFileSync(decompositionPath, "utf-8"));
      await harness({
        slug,
        repoPath: resolvedRepoPath,
        decomposition,
        dataDir,
        refineFocus: opts.focus,
        outputDir: path.join(dataDir, "harnesses"),
      });
    }
  );

program
  .command("ingest <url>")
  .description("Ingest a single repo (not an awesome-list) into the knowledge graph")
  .option("-d, --data-dir <path>", "Data directory (default: ./data)", "./data")
  .action(async (url: string, opts: { dataDir: string }) => {
    const { ingestSingleRepo } = await import("./stages/ingest-single.js");
    const dataDir = path.resolve(process.cwd(), opts.dataDir);
    await ingestSingleRepo(url, dataDir);
  });

program
  .command("ingest-skills <index>")
  .description("Bulk ingest skills from antigravity-awesome-skills")
  .option("-r, --root <path>", "Root directory containing skills folder", ".")
  .option("-d, --data-dir <path>", "Data directory (default: ./data)", "./data")
  .option("-l, --limit <n>", "Limit number of skills to import", "0")
  .action(async (index: string, opts: { root: string; dataDir: string; limit: string }) => {
    const { ingestSkills } = await import("./stages/ingest-skills.js");
    const dataDir = path.resolve(process.cwd(), opts.dataDir);
    const rootDir = path.resolve(process.cwd(), opts.root);
    const limit = parseInt(opts.limit, 10);
    await ingestSkills(index, rootDir, dataDir, { limit: limit > 0 ? limit : undefined });
  });

program
  .command("list")
  .description("List all entries in the knowledge graph")
  .option("-d, --data-dir <path>", "Data directory (default: ./data)", "./data")
  .action((opts: { dataDir: string }) => {
    const dataDir = path.resolve(process.cwd(), opts.dataDir);
    const graphPath = path.join(dataDir, "browser-ingested", "knowledge-graph.json");
    if (!existsSync(graphPath)) {
      console.log("No knowledge graph found. Run 'gitgod ingest <url>' first.");
      return;
    }
    const graph = JSON.parse(readFileSync(graphPath, "utf-8"));
    console.log(`\n📚 Knowledge Graph: ${graph.entries.length} entries\n`);
    graph.entries.forEach((e: any, i: number) => {
      const stars = e.scraped?.github_meta?.stars || 0;
      const tags = e.synthesis?.tags?.slice(0, 5).join(", ") || "none";
      console.log(`${i + 1}. ${e.repo}`);
      console.log(`   ${e.scraped?.description?.slice(0, 60) || ""}`);
      console.log(`   ⭐ ${stars.toLocaleString()} | 🏷️ ${tags}`);
      console.log();
    });
  });

program
  .command("scrape <url>")
  .description("Full pipeline: parse → enrich → synthesize")
  .option("-c, --concurrency <n>", "concurrent scrapes (1-5)", "1")
  .action(async (url: string, opts: { concurrency: string }) => {
    const { cloneAndParse } = await import("./stages/clone-parse.js");
    const { enrich } = await import("./stages/enrich.js");
    const { synthesize } = await import("./stages/synthesize.js");

    const skeletonPath = await cloneAndParse(url);
    const c = parseInt(opts.concurrency, 10);
    if (isNaN(c)) throw new Error(`Invalid concurrency value: ${opts.concurrency}`);
    const enrichedPath = await enrich(skeletonPath, c);
    await synthesize(enrichedPath);
  });

program
  .command("map-markdown <enriched>")
  .description("Map subrepo links and scrape them into markdown artifacts")
  .option("--limit-subrepos <n>", "Optional limit for number of subrepos", "0")
  .option("--limit-links <n>", "Optional limit for links scraped per subrepo", "0")
  .option("--link-concurrency <n>", "Concurrent link scraping per subrepo", "8")
  .option("--repo-concurrency <n>", "Concurrent subrepo crawls", "3")
  .action(
    async (
      enriched: string,
      opts: {
        limitSubrepos: string;
        limitLinks: string;
        linkConcurrency: string;
        repoConcurrency: string;
      }
    ) => {
    const { mapAndScrapeMarkdown } = await import("./stages/map-scrape-markdown.js");
    const limitSubrepos = parsePositiveIntOption(opts.limitSubrepos, "limit-subrepos", 10000);
    const limitLinksPerRepo = parsePositiveIntOption(opts.limitLinks, "limit-links", 2000);
    const linkConcurrency = parsePositiveIntOption(opts.linkConcurrency, "link-concurrency", 20);
    const repoConcurrency = parsePositiveIntOption(opts.repoConcurrency, "repo-concurrency", 10);
    await mapAndScrapeMarkdown(path.resolve(enriched), {
      limitSubrepos,
      limitLinksPerRepo,
      linkConcurrency,
      repoConcurrency,
    });
    }
  );

program
  .command("trendshift-map-topics [url]")
  .description("Map Trendshift topic pages from the topics index")
  .option("-o, --output-dir <path>", "Output directory (default: ./data/trendshift/topics-index)")
  .option("--limit <n>", "Maximum URLs to request from Firecrawl map", "1000")
  .action(async (url = "https://trendshift.io/topics", opts: { outputDir?: string; limit: string }) => {
    const { mapTrendshiftTopics } = await import("./stages/trendshift-workflow.js");
    const limit = parsePositiveIntOption(opts.limit, "limit", 10000) ?? 1000;
    const result = await mapTrendshiftTopics(url, {
      outputDir: opts.outputDir ? path.resolve(opts.outputDir) : undefined,
      limit,
    });
    console.log(`\n🗺️  Trendshift topics mapped from: ${result.sourceUrl}`);
    console.log(`📚 Topics found: ${result.topics.length}`);
    console.log(`💾 JSON output: ${result.outputPath}\n`);
    for (const topic of result.topics.slice(0, 20)) {
      console.log(`- ${topic}`);
    }
    if (result.topics.length > 20) {
      console.log(`...and ${result.topics.length - 20} more`);
    }
  });

program
  .command("trendshift-scrape-topic <url>")
  .description("Scrape a Trendshift topic page to raw markdown")
  .option("-o, --output-dir <path>", "Output directory (default: ./data/trendshift/<topic-slug>)")
  .option("--wait-for <ms>", "Milliseconds to wait for page rendering", "3000")
  .action(async (url: string, opts: { outputDir?: string; waitFor: string }) => {
    const { scrapeTrendshiftTopicMarkdown } = await import("./stages/trendshift-workflow.js");
    const waitFor = parseNonNegativeIntOption(opts.waitFor, "wait-for", 30000);
    const result = await scrapeTrendshiftTopicMarkdown(url, {
      outputDir: opts.outputDir ? path.resolve(opts.outputDir) : undefined,
      waitForMs: waitFor,
    });
    console.log(`\n📝 Trendshift topic scraped: ${result.topicUrl}`);
    console.log(`💾 Markdown output: ${result.markdownPath}\n`);
  });

program
  .command("trendshift-extract-repos <markdownPath>")
  .description("Extract GitHub repos from a scraped Trendshift topic markdown file")
  .requiredOption("--topic-url <url>", "Trendshift topic page URL")
  .option("-o, --output-dir <path>", "Output directory (default: same folder as markdown)")
  .action(async (markdownPath: string, opts: { topicUrl: string; outputDir?: string }) => {
    const { extractTrendshiftRepos } = await import("./stages/trendshift-workflow.js");
    const result = await extractTrendshiftRepos(path.resolve(markdownPath), opts.topicUrl, {
      outputDir: opts.outputDir ? path.resolve(opts.outputDir) : undefined,
    });
    console.log(`\n📦 Trendshift topic: ${result.topicName}`);
    console.log(`🔗 Source: ${result.topicUrl}`);
    console.log(`📦 Extracted repos: ${result.repos.length}`);
    console.log(`💾 JSON output: ${result.outputPath}\n`);
    for (const repo of result.repos.slice(0, 10)) {
      console.log(`- ${repo.repoName} → ${repo.githubUrl ?? "n/a"}`);
    }
    if (result.repos.length > 10) {
      console.log(`...and ${result.repos.length - 10} more`);
    }
  });

program
  .command("trendshift-topic <url>")
  .description("Convenience wrapper: scrape a Trendshift topic page and extract GitHub repos")
  .option("-o, --output-dir <path>", "Output directory (default: ./data/trendshift/<topic-slug>)")
  .option("--wait-for <ms>", "Milliseconds to wait for page rendering", "3000")
  .action(async (url: string, opts: { outputDir?: string; waitFor: string }) => {
    const { scrapeTrendshiftTopic } = await import("./stages/trendshift-topic.js");
    const waitFor = parseNonNegativeIntOption(opts.waitFor, "wait-for", 30000);
    const result = await scrapeTrendshiftTopic(url, {
      outputDir: opts.outputDir ? path.resolve(opts.outputDir) : undefined,
      waitForMs: waitFor,
    });
    console.log(`\n📈 Trendshift topic: ${result.topicName}`);
    console.log(`🔗 Source: ${result.topicUrl}`);
    console.log(`📦 Extracted repos: ${result.repos.length}`);
    console.log(`📝 Raw markdown: ${result.markdownPath}`);
    console.log(`💾 JSON output: ${result.outputPath}\n`);
    for (const repo of result.repos.slice(0, 10)) {
      console.log(`- ${repo.repoName} → ${repo.githubUrl ?? "n/a"}`);
    }
    if (result.repos.length > 10) {
      console.log(`...and ${result.repos.length - 10} more`);
    }
  });

program
  .command("serve")
  .description("Start MCP server (stdio). Used by Cursor/Claude Code to expose ask, find, compare, recommend tools.")
  .option("-d, --data-dir <path>", "Directory containing knowledge graphs (default: ./data)", "./data")
  .action((opts: { dataDir: string }) => {
    const dataDir = path.resolve(process.cwd(), process.env.GITGOD_DATA_DIR ?? opts.dataDir);
    startServer(dataDir);
  });

program.parse();
