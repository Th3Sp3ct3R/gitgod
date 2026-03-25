// src/stages/ingest-raw.ts — ingest any URL without GitHub API
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { SingleRepoEntry, BrowserIngestedGraph, ScrapedData, SynthesisData } from "../types.js";

const GRAPH_DIR = "browser-ingested";
const GRAPH_FILE = "knowledge-graph.json";

function loadGraph(dataDir: string): BrowserIngestedGraph {
  const graphPath = path.join(dataDir, GRAPH_DIR, GRAPH_FILE);
  if (existsSync(graphPath)) {
    return JSON.parse(readFileSync(graphPath, "utf-8"));
  }
  return { version: 1, entries: [], updated_at: new Date().toISOString() };
}

function saveGraph(dataDir: string, graph: BrowserIngestedGraph): string {
  const dir = path.join(dataDir, GRAPH_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const graphPath = path.join(dir, GRAPH_FILE);
  graph.updated_at = new Date().toISOString();
  writeFileSync(graphPath, JSON.stringify(graph, null, 2));
  return graphPath;
}

function extractFrontmatter(content: string): { name: string; description: string; tags?: string[] } {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { name: "", description: "" };
  const fm = match[1];
  return {
    name: fm.match(/name:\s*(.+)/)?.[1]?.trim() || "",
    description: fm.match(/description:\s*["']?(.+?)["']?\s*$/m)?.[1]?.trim() || "",
  };
}

function extractTitle(content: string): string {
  const h1 = content.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  const title = content.match(/<title>([^<]+)<\/title>/i);
  return title?.[1] || "Unknown";
}

function extractDescription(content: string): string {
  const desc = content.match(/^[^#]\s*(.+)$/m);
  if (desc) return desc[1].slice(0, 200).trim();
  return "";
}

export async function ingestRaw(
  url: string,
  content: string,
  dataDir: string,
  options: { stars?: number; language?: string; topics?: string[] } = {}
): Promise<{ entry: SingleRepoEntry; graphPath: string }> {
  const title = extractTitle(content);
  const description = extractDescription(content);
  const topics = options.topics || [];
  const tags = options.language ? [options.language.toLowerCase(), "tool", ...topics.slice(0, 5)] : ["tool", ...topics.slice(0, 6)];

  const owner = url.match(/github\.com\/([^\/]+)\/([^\/]+)/)?.[1] || "unknown";
  const repo = url.match(/github\.com\/([^\/]+)\/([^\/]+)/)?.[2]?.replace(/\.git$/, "") || "unknown";

  const scraped: ScrapedData = {
    title,
    description,
    content_preview: content.slice(0, 3000),
    github_meta: {
      stars: options.stars || 0,
      language: options.language || "unknown",
      last_commit: new Date().toISOString(),
      topics,
    },
    scraped_at: new Date().toISOString(),
  };

  const synthesis: SynthesisData = {
    summary: description || `${title} - a developer tool`,
    tags,
    relevance_score: (options.stars || 0) > 1000 ? 5 : (options.stars || 0) > 100 ? 4 : 3,
    cross_categories: ["Developer Tools"],
    duplicates: [],
  };

  const entry: SingleRepoEntry = {
    url,
    owner,
    repo,
    scraped,
    synthesis,
    ingested_at: new Date().toISOString(),
  };

  const graph = loadGraph(dataDir);
  const existingIdx = graph.entries.findIndex((e) => e.url === entry.url);
  if (existingIdx >= 0) {
    graph.entries[existingIdx] = entry;
    console.log(`  ↻ Updated existing entry`);
  } else {
    graph.entries.push(entry);
    console.log(`  + Added new entry (${graph.entries.length} total)`);
  }

  const graphPath = saveGraph(dataDir, graph);
  console.log(`  → ${graphPath}`);
  return { entry, graphPath };
}
