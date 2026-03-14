// src/stages/synthesize.ts
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { Skeleton, Category, Tool, SynthesisData } from "../types.js";

const BATCH_SIZE = 20;

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

async function synthesizeBatch(
  client: Anthropic,
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

  const prompt = `You are analyzing OSINT tools for a knowledge graph. For each tool below, produce:
1. "summary": A concise 1-2 sentence description of what the tool does and who it's for.
2. "tags": Array of 3-7 capability tags (e.g., "search", "people", "free", "api-available", "social-media", "geolocation").
3. "relevance_score": 1-5 score for how useful/unique this tool is within its category (5 = essential, 1 = obsolete/redundant).
4. "cross_categories": Array of other category names this tool could also belong to (empty if none).
5. "duplicates": Array of other tool names in this batch that do the same thing (empty if none).

Tools to analyze:
${JSON.stringify(toolSummaries, null, 2)}

Respond with a JSON array of objects, one per tool, in the same order. Each object must have keys: name, summary, tags, relevance_score, cross_categories, duplicates. Nothing else.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Extract JSON from response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.log("    Warning: Could not parse LLM response, skipping batch");
    return new Map();
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
  const skeleton: Skeleton = JSON.parse(readFileSync(enrichedPath, "utf-8"));
  const dataDir = path.dirname(enrichedPath);
  const outputPath = path.join(dataDir, "knowledge-graph.json");

  const client = new Anthropic();

  const allTools = flattenToolsWithRefs(skeleton.taxonomy);
  const aliveTools = allTools.filter((t) => t.tool.status === "alive");

  console.log(
    `[Stage 3] Synthesizing ${aliveTools.length} alive tools in batches of ${BATCH_SIZE}...`
  );

  for (let i = 0; i < aliveTools.length; i += BATCH_SIZE) {
    const batch = aliveTools.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(aliveTools.length / BATCH_SIZE);
    console.log(`  Batch ${batchNum}/${totalBatches} (${batch.length} tools)...`);

    const results = await synthesizeBatch(client, batch);

    for (const { tool } of batch) {
      const synthesis = results.get(tool.name);
      if (synthesis) {
        tool.synthesis = synthesis;
      }
    }

    // Save progress after each batch
    writeFileSync(outputPath, JSON.stringify(skeleton, null, 2));
  }

  console.log(`  Synthesis complete`);
  console.log(`  -> ${outputPath}`);

  return outputPath;
}
