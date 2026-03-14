// src/stages/enrich.ts
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { Skeleton, Category, Tool, ScrapedData, EnrichProgress } from "../types.js";

async function scrapeSingle(url: string): Promise<ScrapedData | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "GitGod/0.1 (knowledge-graph-builder)" },
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);

    // For GitHub repos, extract metadata
    let github_meta: ScrapedData["github_meta"] | undefined;
    if (url.includes("github.com")) {
      const starsMatch = html.match(/(\d[\d,]*)\s*stars?/i);
      const langMatch = html.match(/itemprop="programmingLanguage">([^<]+)/);
      if (starsMatch || langMatch) {
        github_meta = {
          stars: starsMatch ? parseInt(starsMatch[1].replace(/,/g, "")) : 0,
          language: langMatch ? langMatch[1].trim() : "unknown",
          last_commit: "",
          topics: [],
        };
      }
    }

    // Content preview: strip HTML tags, take first 2000 chars
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2000);

    return {
      title: titleMatch?.[1]?.trim() || "",
      description: descMatch?.[1]?.trim() || "",
      content_preview: textContent,
      github_meta,
      scraped_at: new Date().toISOString(),
    };
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.log(`    ⏱ Timeout: ${url}`);
    }
    return null;
  }
}

function flattenTools(categories: Category[]): { tool: Tool; path: string }[] {
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function enrich(skeletonPath: string, concurrency: number = 1): Promise<string> {
  const clampedConcurrency = Math.min(Math.max(concurrency, 1), 5);
  const skeleton: Skeleton = JSON.parse(readFileSync(skeletonPath, "utf-8"));
  const dataDir = path.dirname(skeletonPath);
  const outputPath = path.join(dataDir, "enriched.json");
  const progressPath = path.join(dataDir, ".enrich-progress.json");

  // Load existing progress if resuming
  let startIndex = 0;
  if (existsSync(outputPath) && existsSync(progressPath)) {
    const progress: EnrichProgress = JSON.parse(readFileSync(progressPath, "utf-8"));
    startIndex = progress.last_index + 1;
    console.log(`[Stage 2] Resuming from link ${startIndex}/${progress.total}`);
  } else {
    console.log(`[Stage 2] Enriching ${skeleton.stats.links} links (concurrency: ${clampedConcurrency})...`);
  }

  const allTools = flattenTools(skeleton.taxonomy);
  const progress: EnrichProgress = {
    total: allTools.length,
    completed: startIndex,
    failed: 0,
    dead: 0,
    skipped: startIndex,
    last_index: startIndex - 1,
  };

  for (let i = startIndex; i < allTools.length; i++) {
    const { tool, path: catPath } = allTools[i];
    const pct = ((i / allTools.length) * 100).toFixed(1);
    process.stdout.write(`  [${pct}%] ${i + 1}/${allTools.length} ${tool.name}... `);

    const scraped = await scrapeSingle(tool.url);

    if (scraped) {
      tool.scraped = scraped;
      tool.status = "alive";
      progress.completed++;
      console.log("✓");
    } else {
      tool.status = "dead";
      progress.dead++;
      console.log("✗ dead");
    }

    progress.last_index = i;

    // Save progress after every link
    writeFileSync(outputPath, JSON.stringify(skeleton, null, 2));
    writeFileSync(progressPath, JSON.stringify(progress, null, 2));

    // Rate limiting: small delay between requests
    if (i < allTools.length - 1) await sleep(500);
  }

  console.log(`\n  ✓ Done: ${progress.completed} alive, ${progress.dead} dead, ${progress.failed} failed`);
  console.log(`  → ${outputPath}`);

  return outputPath;
}
