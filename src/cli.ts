// src/cli.ts
import "dotenv/config";
import { Command } from "commander";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { startServer } from "./acp/server.js";
import type { ResearchCategory } from "./lib/research-merge.js";
import { registerHackingtoolCommands } from "./plugins/hackingtool/cli.js";

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
  .option(
    "--dry-run",
    "Plan only — show methods and credit estimates (still calls Firecrawl map per domain)"
  )
  .option(
    "--omega-classifier-dry-run",
    "With GITGOD_CLASSIFIER_OMEGA: run Classifier-Ω and log JSON only (no omega_classification written)"
  )
  .option(
    "--log-classifier-omega",
    "With GITGOD_CLASSIFIER_OMEGA: print each Ω result to stdout (still written unless --omega-classifier-dry-run)"
  )
  .action(
    async (
      skeleton: string,
      opts: {
        concurrency: string;
        dryRun?: boolean;
        omegaClassifierDryRun?: boolean;
        logClassifierOmega?: boolean;
      }
    ) => {
      const { enrich } = await import("./stages/enrich.js");
      const concurrency = parseInt(opts.concurrency, 10);
      if (isNaN(concurrency)) throw new Error(`Invalid concurrency value: ${opts.concurrency}`);
      await enrich(skeleton, concurrency, {
        dryRun: Boolean(opts.dryRun),
        omegaClassifierDryRun: Boolean(opts.omegaClassifierDryRun),
        logClassifierOmega: Boolean(opts.logClassifierOmega),
      });
    }
  );

program
  .command("vault-sync")
  .description(
    "Sync all pipeline outputs (markdown, agent-docs, architecture) into Obsidian vault"
  )
  .option("--arch-only", "Only sync architecture docs (legacy behavior)")
  .action(async (opts: { archOnly?: boolean }) => {
    const { getObsidianVaultRoot, syncArchitectureDocsToVault, syncAllToVault } = await import(
      "./lib/obsidian-vault-hook.js"
    );
    const root = getObsidianVaultRoot();
    if (!root) {
      console.error("Set GITGOD_OBSIDIAN_VAULT or OBSIDIAN_VAULT_PATH (e.g. ~/Documents/VANTA-Brain)");
      process.exitCode = 1;
      return;
    }
    if (opts.archOnly) {
      const r = syncArchitectureDocsToVault(root);
      if (!r.ok) {
        console.error(r.reason);
        process.exitCode = 1;
        return;
      }
      console.log(`Copied:\n  ${r.copied.join("\n  ")}`);
      return;
    }
    const r = syncAllToVault(root);
    if (!r.ok) {
      console.error(r.reason);
      process.exitCode = 1;
      return;
    }
    console.log(`Synced ${r.copied.length} files to ${root}/08-gitgod/`);
    if (r.skipped.length > 0) {
      console.log(`Skipped ${r.skipped.length} files (errors)`);
    }
  });

program
  .command("ingest-domain <domain>")
  .description("Ingest a bare domain: discover pages, scrape (markitdown-first), classify, output .md to vault")
  .option("-d, --data-dir <path>", "Data directory (default: ./data)", "./data")
  .option("-n, --max-pages <n>", "Max pages to scrape (default: 200)", "200")
  .option("--include <patterns>", "Comma-separated path substrings to include (e.g. /docs,/api)")
  .option("--exclude <patterns>", "Comma-separated path substrings to exclude (e.g. /blog,/news)")
  .option("--dry-run", "Discover URLs without scraping", false)
  .option("-v, --verbose", "Verbose output", false)
  .action(async (domain: string, opts: { dataDir: string; maxPages: string; include?: string; exclude?: string; dryRun: boolean; verbose: boolean }) => {
    const { ingestDomain } = await import("./stages/ingest-domain.js");
    const dataDir = path.resolve(process.cwd(), opts.dataDir);
    await ingestDomain(domain, {
      dataDir,
      maxPages: parseInt(opts.maxPages, 10),
      dryRun: opts.dryRun,
      verbose: opts.verbose,
      includePatterns: opts.include?.split(",").map((s) => s.trim()).filter(Boolean),
      excludePatterns: opts.exclude?.split(",").map((s) => s.trim()).filter(Boolean),
    });
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
            decompositionPath,
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
        decompositionPath,
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
  .option(
    "--analyze",
    "After ingest, run LLM repo analyzer (writes data/<slug>/repo-analyzer.md; needs OPENROUTER_API_KEY or ANTHROPIC_API_KEY, etc.)",
    false
  )
  .action(async (url: string, opts: { dataDir: string; analyze: boolean }) => {
    const { ingestSingleRepo } = await import("./stages/ingest-single.js");
    const dataDir = path.resolve(process.cwd(), opts.dataDir);
    await ingestSingleRepo(url, dataDir);
    if (opts.analyze) {
      const { runRepoAnalyzer } = await import("./lib/repo-analyzer.js");
      const result = await runRepoAnalyzer(url, dataDir, { skipIfNoLlm: true });
      if (result.skipped) {
        console.warn(`[analyze] skipped: ${result.reason ?? "unknown"}`);
      } else {
        console.log(`[analyze] wrote ${result.outputPath}`);
      }
    }
  });

program
  .command("analyze-repo <url>")
  .description("Clone shallow, build corpus, run Repository Analyzer LLM → data/<slug>/repo-analyzer.md")
  .option("-d, --data-dir <path>", "Data directory (default: ./data)", "./data")
  .action(async (url: string, opts: { dataDir: string }) => {
    const { runRepoAnalyzer } = await import("./lib/repo-analyzer.js");
    const dataDir = path.resolve(process.cwd(), opts.dataDir);
    const result = await runRepoAnalyzer(url, dataDir, { skipIfNoLlm: false });
    if (result.skipped) {
      console.error(result.reason ?? "skipped");
      process.exit(1);
    }
    console.log(result.outputPath);
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
  .command("trendshift-canonicalize <reposJsonPath>")
  .description("Canonicalize extracted Trendshift repos into a deduped topic manifest")
  .option("-o, --output-dir <path>", "Output directory (default: same folder as repos json)")
  .action(async (reposJsonPath: string, opts: { outputDir?: string }) => {
    const { buildTrendshiftTopicCanonicalManifest } = await import("./stages/trendshift-deep-pipeline.js");
    const result = await buildTrendshiftTopicCanonicalManifest(path.resolve(reposJsonPath), {
      outputDir: opts.outputDir ? path.resolve(opts.outputDir) : undefined,
    });
    console.log(`\n🧭 Canonical repos: ${result.canonicalRepos.length}`);
    console.log(`💾 Canonical list: ${result.canonicalReposPath}`);
    console.log(`🗂️  Manifest: ${result.manifestPath}\n`);
  });

program
  .command("trendshift-deep-pipeline <manifestPath>")
  .description("Run ingest -> decompose -> harness for all repos in a Trendshift topic manifest")
  .option(
    "-d, --pipeline-data-dir <path>",
    "Pipeline output directory (default: ./data/trendshift/pipeline)"
  )
  .option(
    "-c, --checkout-root-dir <path>",
    "Checkout directory for local repo clones (default: ./data/trendshift/checkouts)"
  )
  .action(
    async (
      manifestPath: string,
      opts: {
        pipelineDataDir?: string;
        checkoutRootDir?: string;
      }
    ) => {
      const { runTrendshiftTopicDeepPipeline } = await import("./stages/trendshift-deep-pipeline.js");
      const result = await runTrendshiftTopicDeepPipeline(path.resolve(manifestPath), {
        pipelineDataDir: opts.pipelineDataDir ? path.resolve(opts.pipelineDataDir) : undefined,
        checkoutRootDir: opts.checkoutRootDir ? path.resolve(opts.checkoutRootDir) : undefined,
      });
      console.log(`\n🚀 Deep pipeline complete`);
      console.log(`✅ Completed: ${result.completed}`);
      console.log(`🪂 Fallback: ${result.fallback}`);
      console.log(`⏭️  Skipped: ${result.skipped}`);
      console.log(`❌ Failed: ${result.failed}\n`);
    }
  );

program
  .command("trendshift-explore")
  .description("Scrape the Trendshift daily explore page and extract GitHub repo links")
  .option("-o, --output-dir <path>", "Output directory (default: ./data/trendshift/explore)")
  .option("--wait-for <ms>", "Milliseconds to wait for JS rendering", "5000")
  .option("--date <date>", "Override date (YYYY-MM-DD) for the snapshot")
  .action(async (opts: { outputDir?: string; waitFor: string; date?: string }) => {
    const { scrapeTrendshiftExplore } = await import("./stages/trendshift-explore.js");
    const waitFor = parseNonNegativeIntOption(opts.waitFor, "wait-for", 30000);
    const result = await scrapeTrendshiftExplore({
      outputDir: opts.outputDir ? path.resolve(opts.outputDir) : undefined,
      waitForMs: waitFor,
      date: opts.date,
    });
    console.log(`\n[explore] Trendshift Daily Explore: ${result.date}`);
    console.log(`[explore] GitHub repos found: ${result.repos.length}`);
    console.log(`[explore] Markdown: ${result.markdownPath}`);
    console.log(`[explore] Repos JSON: ${result.reposJsonPath}`);
    console.log(`[explore] Summary: ${result.summaryPath}\n`);
    for (const repo of result.repos.slice(0, 15)) {
      console.log(`  ${repo.rank}. ${repo.repoName} -> ${repo.githubUrl}`);
    }
    if (result.repos.length > 15) {
      console.log(`  ...and ${result.repos.length - 15} more`);
    }
  });

program
  .command("trendshift-explore-pipeline")
  .description("Full explore pipeline: scrape, dedup, ingest new repos from daily explore page")
  .option("-d, --data-dir <path>", "Data directory (default: ./data)", "./data")
  .option("-e, --explore-dir <path>", "Explore output directory (default: ./data/trendshift/explore)")
  .option("--wait-for <ms>", "Milliseconds to wait for JS rendering", "5000")
  .option("--date <date>", "Override date (YYYY-MM-DD) for the snapshot")
  .action(
    async (opts: { dataDir: string; exploreDir?: string; waitFor: string; date?: string }) => {
      const { runTrendshiftExplorePipeline } = await import("./stages/trendshift-explore.js");
      const waitFor = parseNonNegativeIntOption(opts.waitFor, "wait-for", 30000);
      const result = await runTrendshiftExplorePipeline({
        dataDir: path.resolve(process.cwd(), opts.dataDir),
        exploreDir: opts.exploreDir ? path.resolve(opts.exploreDir) : undefined,
        waitForMs: waitFor,
        date: opts.date,
      });
      console.log(`\n[explore-pipeline] Complete: ${result.date}`);
      console.log(`  Total:    ${result.total}`);
      console.log(`  New:      ${result.new}`);
      console.log(`  Skipped:  ${result.skipped}`);
      console.log(`  Ingested: ${result.ingested}`);
      console.log(`  Failed:   ${result.failed}\n`);
    }
  );

program
  .command("trendshift-explore-status")
  .description("Show status of the Trendshift explore pipeline: processed repos, run history")
  .option("-e, --explore-dir <path>", "Explore directory (default: ./data/trendshift/explore)")
  .action((opts: { exploreDir?: string }) => {
    // Dynamic import not needed — getTrendshiftExploreStatus is sync, but we
    // use top-level await pattern for consistency with the rest of the CLI.
    import("./stages/trendshift-explore.js").then(({ getTrendshiftExploreStatus }) => {
      const status = getTrendshiftExploreStatus(
        opts.exploreDir ? path.resolve(opts.exploreDir) : undefined
      );
      console.log(`\n📊 Trendshift Explore Status`);
      console.log(`  Total tracked repos: ${status.totalTracked}`);
      console.log(`  Ingested:  ${status.ingested}`);
      console.log(`  Skipped:   ${status.skipped}`);
      console.log(`  Failed:    ${status.failed}`);
      console.log(`  Total runs: ${status.runDates.length}`);
      if (status.recentRuns.length > 0) {
        console.log(`\n  Recent runs:`);
        for (const run of status.recentRuns) {
          console.log(`    ${run.date}: ${run.repoCount} repos`);
        }
      }
      console.log();
    });
  });

program
  .command("agent-docs <repoPath>")
  .description(
    "Build a lexical code index (RAG), then draft SKILL.md + AGENT.md via LLM — output under data/<slug>/agent-docs/"
  )
  .option("-d, --data-dir <path>", "Data directory (default: ./data)", "./data")
  .option("-s, --slug <name>", "Override folder name under data-dir (default: repo basename)")
  .option("--dry-run", "Index + metadata only; skip LLM (writes stub SKILL/AGENT + rag-context-sample.md)")
  .action(
    async (repoPath: string, opts: { dataDir: string; slug?: string; dryRun?: boolean }) => {
      const { runAgentDocs } = await import("./stages/agent-docs.js");
      const dataDir = path.resolve(process.cwd(), opts.dataDir);
      const resolved = path.resolve(repoPath);
      const result = await runAgentDocs({
        repoPath: resolved,
        dataDir,
        slug: opts.slug,
        dryRun: Boolean(opts.dryRun),
      });
      console.log(`\n[agent-docs] Output directory: ${result.outDir}`);
      console.log(`  SKILL.md:  ${result.skillPath}`);
      console.log(`  AGENT.md:  ${result.agentPath}`);
      console.log(`  Meta:      ${result.metaPath}\n`);
    }
  );

program
  .command("serve")
  .description("Start MCP server (stdio). Used by Cursor/Claude Code to expose ask, find, compare, recommend tools.")
  .option("-d, --data-dir <path>", "Directory containing knowledge graphs (default: ./data)", "./data")
  .action((opts: { dataDir: string }) => {
    const dataDir = path.resolve(process.cwd(), process.env.GITGOD_DATA_DIR ?? opts.dataDir);
    startServer(dataDir);
  });

program
  .command("classify <url>")
  .description("Classify a URL's content format (manual testing; production uses enrich)")
  .option("-d, --downstream <target>", "Target: llm_context|vector_db|knowledge_graph|raw_archive", "knowledge_graph")
  .option("--hint <category>", "Agent content hint (sdk, documentation, api_reference, etc.)")
  .action(
    async (url: string, opts: { downstream: string; hint?: string }) => {
      const { classifyContent, probeLlmsTxt, detectSdkRepo } = await import("./lib/content-classifier.js");

      const isSdkRepo = detectSdkRepo(url);
      if (isSdkRepo) console.log(`🔧 URL matches SDK repo pattern`);

      const domain = new URL(url).origin;
      console.log(`Probing ${domain} for llms.txt...`);
      const probe = await probeLlmsTxt(domain);
      if (probe.found) {
        console.log(`✓ Found ${probe.type} → ${probe.recommendation} (${probe.suggestedFormat})`);
        if (probe.type === "llms-full.txt") {
          console.log(`  Skip scraping, use llms-full.txt directly`);
          return;
        }
      } else {
        console.log(`✗ No llms.txt, classifying HTML`);
      }

      const res = await fetch(url, { headers: { "User-Agent": "gitgod/1.0" } });
      const html = await res.text();
      const result = classifyContent({
        source: url,
        html,
        downstream: opts.downstream as "llm_context" | "vector_db" | "knowledge_graph" | "raw_archive",
        contentHint: opts.hint as any,
      });
      console.log(`\nFormat:     ${result.format}`);
      console.log(`Category:   ${result.category}`);
      console.log(`Confidence: ${(result.confidence * 100).toFixed(0)}%`);
      console.log(`Reasoning:  ${result.reasoning}`);
      console.log(`\nSignals:`);
      for (const s of result.signals) {
        console.log(`  ${s.name}: ${s.value.toFixed(2)} (${s.direction}) — ${s.detail}`);
      }
    }
  );

program
  .command("map-verify <url>")
  .description(
    "Compare Firecrawl map(domain) to an authoritative list (llms.txt, /docs/llms.txt, or sitemap) to confirm coverage"
  )
  .option("--limit <n>", "Firecrawl map URL limit (raise if map hits this cap)", "5000")
  .option("--search <q>", "Optional Firecrawl map search query (narrows crawl; may hide URLs)")
  .option("--llms <url>", "Explicit llms.txt or index URL (skips auto-discovery)")
  .option("--prefix <path>", "Only compare URLs under this path (e.g. /docs)")
  .option(
    "--strict-urls",
    "Compare URLs literally (do not strip .md from llms index paths; Mintlify indexes often use .md)"
  )
  .option("--json", "Print JSON report only")
  .option("-o, --output <path>", "Write full JSON report to file")
  .option(
    "--skip-layout",
    "Skip header/nav/footer HTML scrape (Firecrawl map only; saves 1 scrape credit per domain)"
  )
  .action(
    async (
      urlArg: string,
      opts: {
        limit: string;
        search?: string;
        llms?: string;
        prefix?: string;
        strictUrls?: boolean;
        json?: boolean;
        output?: string;
        skipLayout?: boolean;
      }
    ) => {
      const { writeFileSync } = await import("node:fs");
      const { mapDomainWithLayout } = await import("./lib/firecrawl-router.js");
      const {
        compareMapToReference,
        fetchReferenceUrlList,
        markMapTruncation,
      } = await import("./lib/map-coverage.js");

      let origin: string;
      let layoutSeedUrl: string;
      try {
        const u = new URL(urlArg.includes("://") ? urlArg : `https://${urlArg}`);
        origin = u.origin;
        layoutSeedUrl = u.href;
      } catch {
        throw new Error(`Invalid URL: ${urlArg}`);
      }

      const mapLimit = parsePositiveIntOption(opts.limit, "limit", 100_000) ?? 5000;
      const mapResult = await mapDomainWithLayout(origin, {
        limit: mapLimit,
        layoutSeedUrl,
        skipLayout: Boolean(opts.skipLayout),
        ...(opts.search?.trim() ? { search: opts.search.trim() } : {}),
      });
      const mapUrls = mapResult.urls.map((x) => x.url);

      const ref = await fetchReferenceUrlList(origin, {
        llmsUrl: opts.llms?.trim() || undefined,
      });

      const prefix = opts.prefix?.trim() || undefined;

      if (!ref || ref.urls.length === 0) {
        const payload = {
          origin,
          mapTotal: mapResult.totalFound,
          mapLimit,
          reference: null,
          message:
            "No llms.txt /docs/llms.txt or sitemap found — cannot prove completeness. Compare map output to a manual list or pass --llms <url>.",
          mapSample: mapUrls.slice(0, 30),
        };
        const text = opts.json
          ? JSON.stringify(payload, null, 2)
          : `${payload.message}\n\nFirecrawl map: ${mapResult.totalFound} URLs (limit ${mapLimit}).\nFirst URLs:\n${mapUrls
            .slice(0, 15)
            .map((u) => `  - ${u}`)
            .join("\n")}`;
        if (opts.output) writeFileSync(path.resolve(opts.output), opts.json ? text : JSON.stringify(payload, null, 2));
        console.log(text);
        process.exit(2);
      }

      let diff = compareMapToReference(mapUrls, ref.urls, {
        pathPrefix: prefix,
        referenceLabel: ref.label,
        docStem: !opts.strictUrls,
      });
      diff = markMapTruncation(diff, mapLimit, mapResult.totalFound);

      const report = {
        origin,
        referenceSource: ref.label,
        referenceUrlCount: ref.urls.length,
        firecrawlMapUrlCount: mapResult.totalFound,
        layoutSummary: mapResult.layout ?? null,
        mapLimit,
        pathPrefix: prefix ?? null,
        coverageOfReference: diff.coverageOfReference,
        referenceFullyMapped: diff.referenceFullyMapped,
        mapPossiblyTruncated: diff.mapPossiblyTruncated,
        onlyInReferenceCount: diff.onlyInReference.length,
        onlyInMapCount: diff.onlyInMap.length,
        onlyInReference: diff.onlyInReference.slice(0, 200),
        onlyInMap: diff.onlyInMap.slice(0, 200),
        notes: diff.notes,
      };

      if (opts.json) {
        const out = JSON.stringify(report, null, 2);
        if (opts.output) writeFileSync(path.resolve(opts.output), out);
        console.log(out);
        process.exit(diff.referenceFullyMapped && !diff.mapPossiblyTruncated ? 0 : 1);
      }

      const pct = (report.coverageOfReference * 100).toFixed(1);
      console.log(`\n📍 Origin: ${origin}`);
      console.log(`📚 Reference: ${report.referenceSource} (${report.referenceUrlCount} URLs)`);
      console.log(
        `🗺️  Map (+ header/nav/footer): ${report.firecrawlMapUrlCount} URLs (limit ${mapLimit})` +
          (mapResult.layout ? ` — +${mapResult.layout.urlsAddedFromLayout} from layout` : "")
      );
      if (prefix) console.log(`🔎 Path filter: ${prefix}`);
      if (!opts.strictUrls) {
        console.log(`🔗 URL match: llms paths ending in .md are compared to map URLs without .md (pass --strict-urls to disable).`);
      }
      console.log(`\n✅ Coverage of reference: ${pct}% (${report.referenceUrlCount - report.onlyInReferenceCount}/${report.referenceUrlCount} matched)`);
      console.log(
        diff.referenceFullyMapped && !diff.mapPossiblyTruncated
          ? "\n🟢 Reference URLs are fully represented in the map (for this prefix/limit)."
          : "\n🟡 Incomplete or uncertain — see gaps or truncation note below."
      );
      if (diff.mapPossiblyTruncated) {
        console.log("\n⚠️  Map may be truncated at --limit; raise --limit and re-run.");
      }
      if (diff.onlyInReference.length > 0) {
        console.log(`\n❌ In reference but NOT in map (${diff.onlyInReference.length}):`);
        for (const u of diff.onlyInReference.slice(0, 25)) {
          console.log(`   - ${u}`);
        }
        if (diff.onlyInReference.length > 25) {
          console.log(`   ... and ${diff.onlyInReference.length - 25} more`);
        }
      }
      if (diff.onlyInMap.length > 0) {
        console.log(`\n➕ In map but NOT in reference (${diff.onlyInMap.length} — often OK):`);
        for (const u of diff.onlyInMap.slice(0, 15)) {
          console.log(`   - ${u}`);
        }
        if (diff.onlyInMap.length > 15) {
          console.log(`   ... and ${diff.onlyInMap.length - 15} more`);
        }
      }
      for (const n of diff.notes) {
        console.log(`\nℹ️  ${n}`);
      }
      console.log("");

      if (opts.output) {
        writeFileSync(path.resolve(opts.output), JSON.stringify(report, null, 2));
        console.log(`Wrote JSON → ${path.resolve(opts.output)}\n`);
      }

      process.exit(diff.referenceFullyMapped && !diff.mapPossiblyTruncated ? 0 : 1);
    }
  );

program
  .command("map-site <url>")
  .description(
    "First-pass discovery: Firecrawl map(origin) + same-origin links from header, nav, and footer on the seed page"
  )
  .option("--limit <n>", "Firecrawl map URL limit", "5000")
  .option("--search <q>", "Optional Firecrawl map search query (narrows map)")
  .option("--skip-layout", "Map only (no header/nav/footer scrape)")
  .option("--json", "Print JSON only")
  .option("-o, --output <path>", "Write JSON to file")
  .action(
    async (
      urlArg: string,
      opts: { limit: string; search?: string; skipLayout?: boolean; json?: boolean; output?: string }
    ) => {
      const { writeFileSync } = await import("node:fs");
      const { mapDomainWithLayout } = await import("./lib/firecrawl-router.js");
      const u = new URL(urlArg.includes("://") ? urlArg : `https://${urlArg}`);
      const mapLimit = parsePositiveIntOption(opts.limit, "limit", 100_000) ?? 5000;
      const r = await mapDomainWithLayout(u.origin, {
        limit: mapLimit,
        layoutSeedUrl: u.href,
        skipLayout: Boolean(opts.skipLayout),
        ...(opts.search?.trim() ? { search: opts.search.trim() } : {}),
      });
      const payload = {
        domain: r.domain,
        totalFound: r.totalFound,
        mappedAt: r.mappedAt,
        layout: r.layout ?? null,
        urls: r.urls,
      };
      const out = JSON.stringify(payload, null, 2);
      if (opts.output) writeFileSync(path.resolve(opts.output), out);
      if (opts.json) {
        console.log(out);
        return;
      }
      console.log(`\n🗺️  ${r.domain} — ${r.totalFound} URLs (Firecrawl map + header/nav/footer)`);
      if (r.layout) {
        console.log(`   Layout seed: ${r.layout.seedUrl}`);
        console.log(
          `   Links in header / nav / footer: ${r.layout.headerLinkCount} / ${r.layout.navLinkCount} / ${r.layout.footerLinkCount}`
        );
        console.log(`   URLs not in map alone (added from layout): ${r.layout.urlsAddedFromLayout}`);
      }
      console.log(`\nFirst 25 URLs:\n${r.urls.slice(0, 25).map((x) => `  - ${x.url}`).join("\n")}\n`);
      if (opts.output) console.log(`Wrote JSON → ${path.resolve(opts.output)}\n`);
    }
  );

program
  .command("research-merge <query>")
  .description("Merge Firecrawl web search + `gh search repos` into markdown (stdout or --output)")
  .option("--firecrawl-limit <n>", "Max Firecrawl web results (1-50)", "10")
  .option("--gh-limit <n>", "Max GitHub repos from gh (1-100)", "15")
  .option("--no-firecrawl", "Skip Firecrawl (GitHub only)")
  .option("--no-gh", "Skip gh (Firecrawl only)")
  .option(
    "--fc-categories <list>",
    "Firecrawl categories: comma-separated github, research, pdf (optional bias)"
  )
  .option("-o, --output <path>", "Write markdown to this file instead of stdout")
  .action(
    async (
      query: string,
      opts: {
        firecrawlLimit: string;
        ghLimit: string;
        firecrawl?: boolean;
        gh?: boolean;
        fcCategories?: string;
        output?: string;
      }
    ) => {
      const { writeFileSync } = await import("node:fs");
      const { runResearchMerge } = await import("./lib/research-merge.js");

      const firecrawlLimit = parsePositiveIntOption(opts.firecrawlLimit, "firecrawl-limit", 50) ?? 10;
      const ghLimit = parsePositiveIntOption(opts.ghLimit, "gh-limit", 100) ?? 15;

      let firecrawlCategories: ResearchCategory[] | undefined;
      if (opts.fcCategories?.trim()) {
        const allowed = new Set<ResearchCategory>(["github", "research", "pdf"]);
        firecrawlCategories = opts.fcCategories
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter((s): s is ResearchCategory => allowed.has(s as ResearchCategory));
        if (firecrawlCategories.length === 0) firecrawlCategories = undefined;
      }

      const result = await runResearchMerge({
        query,
        firecrawlLimit,
        ghLimit,
        skipFirecrawl: opts.firecrawl === false,
        skipGh: opts.gh === false,
        firecrawlCategories,
      });

      if (opts.output) {
        writeFileSync(path.resolve(opts.output), result.markdown, "utf-8");
        console.error(`Wrote ${path.resolve(opts.output)}`);
      } else {
        console.log(result.markdown);
      }
    }
  );

// Hackingtool security toolkit plugin
registerHackingtoolCommands(program);

program
  .command("hackingtool-serve")
  .description("Start hackingtool MCP server (stdio). Exposes 6 security_ tools.")
  .option("-d, --data-dir <path>", "Data directory (default: ./data)", "./data")
  .action(async (opts: { dataDir: string }) => {
    const { startHackingtoolServer } = await import("./plugins/hackingtool/server.js");
    const dataDir = path.resolve(process.cwd(), process.env.GITGOD_DATA_DIR ?? opts.dataDir);
    startHackingtoolServer(dataDir);
  });

program.parse();
