// src/stages/enrich.ts
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { Skeleton, Category, Tool, ScrapedData, EnrichProgress } from "../types.js";
import { parseGitHubUrl, scrapeGitHub } from "../lib/github.js";
import {
  classifyContent,
  probeLlmsTxt,
  type LlmsProbeResult,
  type ContentCategory,
} from "../lib/content-classifier.js";
import {
  buildDomainPlans,
  executePlans,
  type LlmsTxtCacheEntry,
  type ScrapeResult,
} from "../lib/firecrawl-router.js";
import { getObsidianVaultRoot, syncAllToVault } from "../lib/obsidian-vault-hook.js";
import {
  classifyWithOmega,
  CLASSIFIER_OMEGA_MAX_INPUT_CHARS,
} from "../lib/llm-classifier.js";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

/** Domain-level llms.txt probe cache (same process, avoids duplicate fetches). */
const llmsProbeCache = new Map<string, LlmsProbeResult>();

export function flattenTools(categories: Category[]): { tool: Tool; path: string }[] {
  const result: { tool: Tool; path: string }[] = [];

  function walk(cats: Category[], prefix: string) {
    for (const cat of cats) {
      const catPath = prefix ? `${prefix} > ${cat.category}` : cat.category;
      for (const tool of cat.tools) {
        result.push({ tool, path: catPath });
      }
      walk(cat.subcategories, catPath);
    }
  }

  walk(categories, "");
  return result;
}

/** Website URLs from the skeleton (excludes GitHub — those use the GitHub API). */
export function collectWebsiteUrlsFromSkeleton(skeleton: Skeleton): string[] {
  const urls: string[] = [];
  for (const { tool } of flattenTools(skeleton.taxonomy)) {
    if (!parseGitHubUrl(tool.url)) urls.push(tool.url);
  }
  return urls;
}

async function buildLlmsProbeCache(origins: string[]): Promise<Map<string, LlmsTxtCacheEntry>> {
  const m = new Map<string, LlmsTxtCacheEntry>();
  for (const origin of origins) {
    let r = llmsProbeCache.get(origin);
    if (!r) {
      r = await probeLlmsTxt(origin);
      llmsProbeCache.set(origin, r);
    }
    m.set(origin, { found: r.found, url: r.url });
  }
  return m;
}

function readManifestContentHint(url: string): ContentCategory | undefined {
  try {
    const manifestPath = path.resolve(process.cwd(), "openclaw-workspace/memory/ENRICHMENT_MANIFEST.json");
    if (!existsSync(manifestPath)) return undefined;
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
      entries?: Record<string, { content_hint?: string }>;
    };
    const raw = manifest.entries?.[url]?.content_hint;
    if (!raw || typeof raw !== "string") return undefined;
    return raw as ContentCategory;
  } catch {
    return undefined;
  }
}

function scrapedDataFromFirecrawlResult(result: ScrapeResult): ScrapedData | null {
  if (!result.success) return null;
  const html = result.html ?? result.rawContent ?? "";
  const md = result.markdown ?? html;
  const base: ScrapedData = {
    title: (result.metadata?.title as string) ?? "",
    description: (result.metadata?.description as string) ?? "",
    content_preview: md.slice(0, 500),
    content_text: md.slice(0, CLASSIFIER_OMEGA_MAX_INPUT_CHARS),
    scraped_at: new Date().toISOString(),
    llms_txt_source: result.method === "LLMS_TXT_BYPASS" ? result.url : undefined,
    firecrawl_method: result.method,
    firecrawl_credits: result.creditsUsed,
    interact_output: result.interactOutput,
  };
  return base;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Print Firecrawl plan (domains, methods, URLs, credit estimate) without scraping.
 */
export async function runEnrichDryRun(skeletonPath: string): Promise<void> {
  const skeleton: Skeleton = JSON.parse(readFileSync(skeletonPath, "utf-8"));
  const allUrls = collectWebsiteUrlsFromSkeleton(skeleton);
  if (allUrls.length === 0) {
    console.log("Dry run: no non-GitHub URLs in skeleton.");
    return;
  }
  const origins = [
    ...new Set(
      allUrls
        .map((u) => {
          try {
            return new URL(u).origin;
          } catch {
            return null;
          }
        })
        .filter((o): o is string => o !== null),
    ),
  ];
  const llmsProbeCache = await buildLlmsProbeCache(origins);
  const plans = await buildDomainPlans(allUrls, llmsProbeCache);
  const total = plans.reduce((s, p) => s + p.estimatedCredits, 0);
  console.log(`\nDry run: ${plans.length} domains, ~${total} credits`);
  for (const plan of plans) {
    console.log(`\n${plan.domain}:`);
    for (const [method, urls] of plan.groups) {
      console.log(`  ${method}: ${urls.length} URLs`);
      urls.forEach((u) => console.log(`    ${u}`));
    }
  }
}

export async function enrich(
  skeletonPath: string,
  concurrency: number = 1,
  options?: {
    dryRun?: boolean;
    /** With GITGOD_CLASSIFIER_OMEGA: run Ω, print JSON, do not write omega_classification */
    omegaClassifierDryRun?: boolean;
    /** With GITGOD_CLASSIFIER_OMEGA: print each Ω result (in addition to writing unless dry-run) */
    logClassifierOmega?: boolean;
  },
): Promise<string> {
  if (options?.dryRun) {
    await runEnrichDryRun(skeletonPath);
    return path.join(path.dirname(skeletonPath), "enriched.json");
  }

  const clampedConcurrency = Math.min(Math.max(concurrency, 1), 5);
  const skeleton: Skeleton = JSON.parse(readFileSync(skeletonPath, "utf-8"));
  const dataDir = path.dirname(skeletonPath);
  const outputPath = path.join(dataDir, "enriched.json");
  const progressPath = path.join(dataDir, ".enrich-progress.json");

  let startIndex = 0;
  if (existsSync(outputPath) && existsSync(progressPath)) {
    const progress: EnrichProgress = JSON.parse(readFileSync(progressPath, "utf-8"));
    startIndex = progress.last_index + 1;
    console.log(`[Stage 2] Resuming from link ${startIndex}/${progress.total}`);
  } else {
    console.log(`[Stage 2] Enriching ${skeleton.stats.links} links (concurrency: ${clampedConcurrency})...`);
  }
  console.log(`  GitHub API: ${GITHUB_TOKEN ? "authenticated (5k req/hr)" : "unauthenticated (60 req/hr) — set GITHUB_TOKEN for more"}`);

  const allTools = flattenTools(skeleton.taxonomy);
  const progress: EnrichProgress = {
    total: allTools.length,
    completed: startIndex,
    failed: 0,
    dead: 0,
    skipped: startIndex,
    last_index: startIndex - 1,
  };

  writeFileSync(outputPath, JSON.stringify(skeleton, null, 2));
  writeFileSync(progressPath, JSON.stringify(progress, null, 2));

  const websiteUrlsInRange: string[] = [];
  for (let i = startIndex; i < allTools.length; i++) {
    const u = allTools[i].tool.url;
    if (!parseGitHubUrl(u)) websiteUrlsInRange.push(u);
  }

  const webResultsMap = new Map<string, ScrapedData>();

  if (websiteUrlsInRange.length > 0) {
    if (!process.env.FIRECRAWL_API_KEY) {
      throw new Error(
        "FIRECRAWL_API_KEY is required to enrich non-GitHub URLs. Add it to .env (see .env.example).",
      );
    }
    const origins = [
      ...new Set(
        websiteUrlsInRange
          .map((u) => {
            try {
              return new URL(u).origin;
            } catch {
              return null;
            }
          })
          .filter((o): o is string => o !== null),
      ),
    ];
    const llmsProbeCache = await buildLlmsProbeCache(origins);

    console.log(`\n  🔥 Firecrawl: ${websiteUrlsInRange.length} website URL(s) in this run...`);
    const plans = await buildDomainPlans(websiteUrlsInRange, llmsProbeCache);
    const totalEstimated = plans.reduce((sum, p) => sum + p.estimatedCredits, 0);
    console.log(`\n📊 Plan: ${plans.length} domains, ~${totalEstimated} credits`);

    const scrapeResults = await executePlans(plans, async (domain) => {
      const probe = llmsProbeCache.get(domain);
      if (probe?.found && probe.url) {
        const resp = await fetch(probe.url);
        return resp.ok ? resp.text() : null;
      }
      return null;
    });

    for (const result of scrapeResults) {
      if (!result.success) {
        console.warn(`  ❌ Failed: ${result.url} — ${result.error}`);
        continue;
      }
      const data = scrapedDataFromFirecrawlResult(result);
      if (data) webResultsMap.set(result.url, data);
    }
  }

  for (let i = startIndex; i < allTools.length; i++) {
    const { tool } = allTools[i];
    const pct = ((i / allTools.length) * 100).toFixed(1);
    const gh = parseGitHubUrl(tool.url);
    const tag = gh ? "api" : "firecrawl";
    process.stdout.write(`  [${pct}%] ${i + 1}/${allTools.length} [${tag}] ${tool.name}... `);

    let scraped: ScrapedData | null = null;

    if (gh) {
      scraped = await scrapeGitHub(gh.owner, gh.repo);
    } else {
      scraped = webResultsMap.get(tool.url) ?? null;
    }

    if (scraped) {
      tool.scraped = scraped;
      tool.status = "alive";

      const contentHint = readManifestContentHint(tool.url);
      const classification = classifyContent({
        source: tool.url,
        html: tool.scraped.content_preview,
        downstream: "knowledge_graph",
        contentHint,
      });
      tool.scraped.content_format = classification.format;
      tool.scraped.content_category = classification.category;
      tool.scraped.classifier_confidence = classification.confidence;

      const textForOmega =
        tool.scraped.content_text?.trim() ||
        `${tool.scraped.description}\n\n${tool.scraped.content_preview}`.trim();
      if (textForOmega.length > 0) {
        const omega = await classifyWithOmega(textForOmega, tool.url);
        if (omega) {
          if (options?.logClassifierOmega || options?.omegaClassifierDryRun) {
            console.log(`[Classifier-Ω] ${tool.url}\n${JSON.stringify(omega, null, 2)}`);
          }
          if (!options?.omegaClassifierDryRun) {
            tool.scraped.omega_classification = omega;
          }
        }
      }

      progress.completed++;
      const stars = scraped.github_meta?.stars;
      console.log(stars ? `✓ ★${stars.toLocaleString()}` : "✓");
    } else {
      tool.status = "dead";
      progress.dead++;
      console.log("✗ dead");
    }

    progress.last_index = i;
    writeFileSync(outputPath, JSON.stringify(skeleton, null, 2));
    writeFileSync(progressPath, JSON.stringify(progress, null, 2));

    if (i < allTools.length - 1) await sleep(gh ? 100 : 0);
  }

  console.log(`\n  ✓ Done: ${progress.completed} alive, ${progress.dead} dead, ${progress.failed} failed`);
  console.log(`  → ${outputPath}`);

  const vaultRoot = getObsidianVaultRoot();
  if (vaultRoot) {
    const sync = syncAllToVault(vaultRoot);
    if (sync.ok) {
      console.log(`  → Obsidian: synced ${sync.copied.length} files to ${vaultRoot}/08-gitgod/`);
    } else {
      console.warn(`  ⚠ Obsidian vault sync skipped: ${sync.reason}`);
    }
  }

  return outputPath;
}
