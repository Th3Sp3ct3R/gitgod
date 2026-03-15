// src/stages/synthesize.ts
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { Skeleton, Category, Tool, SynthesisData } from "../types.js";

const BATCH_SIZE = 20;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;
const MAX_CONSECUTIVE_FAILURES = 5;
const BATCH_DELAY_MS = 500;

type LLMProvider = "anthropic" | "openrouter";

function detectProvider(): { provider: LLMProvider; model: string } {
  if (process.env.OPENROUTER_API_KEY) {
    return {
      provider: "openrouter",
      model: process.env.OPENROUTER_MODEL || "arcee-ai/trinity-large-preview:free",
    };
  }
  return {
    provider: "anthropic",
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
  };
}

async function callLLM(prompt: string): Promise<string> {
  const { provider, model } = detectProvider();

  if (provider === "openrouter") {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/gitgod",
        "X-Title": "GitGod",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 4096,
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter error: ${res.status} ${await res.text()}`);
    const data = await res.json() as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error(`OpenRouter returned empty response: ${JSON.stringify(data).slice(0, 200)}`);
    return content;
  }

  // Anthropic (default) — supports custom base URL via ANTHROPIC_BASE_URL
  const client = new Anthropic({
    baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
  });
  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });
  return response.content[0].type === "text" ? response.content[0].text : "";
}

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

  // Resume from knowledge-graph.json if it exists, otherwise start from enriched
  let skeleton: Skeleton;
  try {
    skeleton = JSON.parse(readFileSync(outputPath, "utf-8"));
    console.log(`[Stage 3] Resuming from ${outputPath}`);
  } catch {
    skeleton = JSON.parse(readFileSync(enrichedPath, "utf-8"));
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
