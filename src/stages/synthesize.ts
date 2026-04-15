// src/stages/synthesize.ts
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Skeleton, Category, Tool, SynthesisData } from "../types.js";
import { detectProvider, callLLM } from "../lib/llm.js";

const BATCH_SIZE = 20;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;
const MAX_CONSECUTIVE_FAILURES = 5;
const BATCH_DELAY_MS = 500;

function flattenToolsWithRefs(
  categories: Category[]
): { tool: Tool; categoryPath: string }[] {
  const result: { tool: Tool; categoryPath: string }[] = [];
  function walk(cats: Category[], prefix: string) {
    for (const cat of cats) {
      const p = prefix ? `${prefix} > ${cat.category}` : cat.category;
      for (const tool of cat.tools) {
        result.push({ tool, categoryPath: p });
      }
      walk(cat.subcategories, p);
    }
  }
  walk(categories, "");
  return result;
}

function buildToolIdentitySignature(tools: { tool: Tool; categoryPath: string }[]): string {
  return tools
    .map(({ tool, categoryPath }) => `${categoryPath}::${tool.name}::${tool.url}`)
    .sort()
    .join("\n");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callLLMWithRetry(prompt: string): Promise<string> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callLLM(prompt);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Don't retry on auth/billing errors
      if (msg.includes("402") || msg.includes("401") || msg.includes("Insufficient credits")) {
        throw err;
      }
      if (attempt === MAX_RETRIES) throw err;
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(`    Retry ${attempt}/${MAX_RETRIES} after ${delay}ms (${msg.slice(0, 80)})`);
      await sleep(delay);
    }
  }
  throw new Error("unreachable");
}

async function synthesizeBatch(
  tools: { tool: Tool; categoryPath: string }[]
): Promise<Map<string, SynthesisData>> {
  const toolSummaries = tools.map(({ tool, categoryPath }) => ({
    name: tool.name,
    url: tool.url,
    category: categoryPath,
    description: tool.description,
    scraped_title: tool.scraped?.title || "",
    scraped_description: tool.scraped?.description || "",
    content_preview: tool.scraped?.content_preview?.slice(0, 500) || "",
    github_stars: tool.scraped?.github_meta?.stars || null,
    github_language: tool.scraped?.github_meta?.language || null,
  }));

  const prompt = `You are analyzing tools for a knowledge graph. For each tool below, produce:
1. "summary": A concise 1-2 sentence description of what the tool does and who it's for.
2. "tags": Array of 3-7 capability tags (e.g., "search", "people", "free", "api-available", "social-media", "geolocation").
3. "relevance_score": 1-5 score for how useful/unique this tool is within its category (5 = essential, 1 = obsolete/redundant).
4. "cross_categories": Array of other category names this tool could also belong to (empty if none).
5. "duplicates": Array of other tool names in this batch that do the same thing (empty if none).

Tools to analyze:
${JSON.stringify(toolSummaries, null, 2)}

Respond with a JSON array of objects, one per tool, in the same order. Each object must have keys: name, summary, tags, relevance_score, cross_categories, duplicates. Nothing else.`;

  const text = await callLLMWithRetry(prompt);

  // Extract JSON from response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("Could not parse JSON from LLM response");
  }

  const results: Array<{
    name: string;
    summary?: string;
    tags?: string[];
    relevance_score?: number;
    cross_categories?: string[];
    duplicates?: string[];
  }> = JSON.parse(jsonMatch[0]);
  const map = new Map<string, SynthesisData>();

  for (const r of results) {
    map.set(r.name, {
      summary: r.summary || "",
      tags: r.tags || [],
      relevance_score: r.relevance_score || 3,
      cross_categories: r.cross_categories || [],
      duplicates: r.duplicates || [],
    });
  }

  return map;
}

export async function synthesize(enrichedPath: string): Promise<string> {
  const dataDir = path.dirname(enrichedPath);
  const outputPath = path.join(dataDir, "knowledge-graph.json");

  // Always load enriched as source-of-truth; optionally resume synthesis progress from output.
  const enrichedSkeleton: Skeleton = JSON.parse(readFileSync(enrichedPath, "utf-8"));
  let skeleton: Skeleton = enrichedSkeleton;

  try {
    const previous: Skeleton = JSON.parse(readFileSync(outputPath, "utf-8"));
    const prevTools = flattenToolsWithRefs(previous.taxonomy);
    const freshTools = flattenToolsWithRefs(enrichedSkeleton.taxonomy);
    const sameRepo = previous.repo === enrichedSkeleton.repo;
    const sameToolIdentity =
      buildToolIdentitySignature(prevTools) === buildToolIdentitySignature(freshTools);

    if (sameRepo && sameToolIdentity) {
      skeleton = previous;
      console.log(`[Stage 3] Resuming from ${outputPath}`);
    } else {
      // Recover any prior synthesis by URL/name while keeping fresh enrich output.
      const prevByUrl = new Map(
        prevTools
          .filter(({ tool }) => Boolean(tool.synthesis))
          .map(({ tool }) => [tool.url, tool.synthesis] as const)
      );
      const prevByName = new Map(
        prevTools
          .filter(({ tool }) => Boolean(tool.synthesis))
          .map(({ tool }) => [tool.name, tool.synthesis] as const)
      );
      for (const { tool } of freshTools) {
        tool.synthesis = prevByUrl.get(tool.url) ?? prevByName.get(tool.name) ?? tool.synthesis;
      }
      skeleton = enrichedSkeleton;
      console.log(
        `[Stage 3] Detected stale output (${prevTools.length} vs ${freshTools.length} tools), rebuilding from enriched`
      );
    }
  } catch {
    skeleton = enrichedSkeleton;
  }

  const { provider, model } = detectProvider();

  const allTools = flattenToolsWithRefs(skeleton.taxonomy);
  const aliveTools = allTools.filter((t) => t.tool.status === "alive");
  const needsSynthesis = aliveTools.filter((t) => !t.tool.synthesis);

  console.log(
    `[Stage 3] ${needsSynthesis.length}/${aliveTools.length} alive tools need synthesis (batches of ${BATCH_SIZE})`
  );
  console.log(`  Provider: ${provider} | Model: ${model}`);

  if (needsSynthesis.length === 0) {
    writeFileSync(outputPath, JSON.stringify(skeleton, null, 2));
    console.log(`  Nothing to do — all tools already synthesized`);
    return outputPath;
  }

  let consecutiveFailures = 0;
  let synthesized = 0;

  for (let i = 0; i < needsSynthesis.length; i += BATCH_SIZE) {
    const batch = needsSynthesis.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(needsSynthesis.length / BATCH_SIZE);
    console.log(`  Batch ${batchNum}/${totalBatches} (${batch.length} tools)...`);

    let results: Map<string, SynthesisData>;
    try {
      results = await synthesizeBatch(batch);
      consecutiveFailures = 0;
    } catch (err) {
      consecutiveFailures++;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`    Failed: ${msg.slice(0, 120)}`);
      writeFileSync(outputPath, JSON.stringify(skeleton, null, 2));

      if (msg.includes("402") || msg.includes("401") || msg.includes("Insufficient credits")) {
        console.log(`  Stopping: API auth/billing error — fix credentials and re-run to resume`);
        break;
      }
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.log(`  Stopping: ${MAX_CONSECUTIVE_FAILURES} consecutive failures — re-run to resume`);
        break;
      }
      continue;
    }

    for (const { tool } of batch) {
      const synthesis = results.get(tool.name);
      if (synthesis) {
        tool.synthesis = synthesis;
        synthesized++;
      }
    }

    // Save progress after each batch
    writeFileSync(outputPath, JSON.stringify(skeleton, null, 2));

    // Rate limit between batches
    if (i + BATCH_SIZE < needsSynthesis.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log(`  Done: ${synthesized} tools synthesized this run`);
  const remaining = needsSynthesis.length - synthesized;
  if (remaining > 0) {
    console.log(`  ${remaining} tools still need synthesis — re-run to continue`);
  }
  console.log(`  -> ${outputPath}`);

  return outputPath;
}
