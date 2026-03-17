// src/cli.ts
import { Command } from "commander";
import path from "node:path";
import { startServer } from "./acp/server.js";

const program = new Command();

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
  .command("ingest <url>")
  .description("Ingest a single repo (not an awesome-list) into the knowledge graph")
  .option("-d, --data-dir <path>", "Data directory (default: ./data)", "./data")
  .action(async (url: string, opts: { dataDir: string }) => {
    const { ingestSingleRepo } = await import("./stages/ingest-single.js");
    const dataDir = path.resolve(process.cwd(), opts.dataDir);
    await ingestSingleRepo(url, dataDir);
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
  .command("serve")
  .description("Start MCP server (stdio). Used by Cursor/Claude Code to expose ask, find, compare, recommend tools.")
  .option("-d, --data-dir <path>", "Directory containing knowledge graphs (default: ./data)", "./data")
  .action((opts: { dataDir: string }) => {
    const dataDir = path.resolve(process.cwd(), process.env.GITGOD_DATA_DIR ?? opts.dataDir);
    startServer(dataDir);
  });

program.parse();
