// src/cli.ts
import { Command } from "commander";

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
    await enrich(skeleton, parseInt(opts.concurrency));
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
  .command("scrape <url>")
  .description("Full pipeline: parse → enrich → synthesize")
  .option("-c, --concurrency <n>", "concurrent scrapes (1-5)", "1")
  .action(async (url: string, opts: { concurrency: string }) => {
    const { cloneAndParse } = await import("./stages/clone-parse.js");
    const { enrich } = await import("./stages/enrich.js");
    const { synthesize } = await import("./stages/synthesize.js");

    const skeletonPath = await cloneAndParse(url);
    const enrichedPath = await enrich(skeletonPath, parseInt(opts.concurrency));
    await synthesize(enrichedPath);
  });

program.parse();
