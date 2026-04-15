// One-off: ingest all repos from GitHub search (topic + language).
import { existsSync } from "node:fs";
import path from "node:path";
import { ingestSingleRepo } from "../src/stages/ingest-single.js";

function slugFromFullName(full: string): string {
  return full.replace("/", "-");
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

async function fetchTopicRepos(topic: string, language: string): Promise<string[]> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "GitGod-batch-ingest",
  };
  if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;

  const q = encodeURIComponent(`topic:${topic} language:${language}`);
  let page = 1;
  const all: string[] = [];
  while (page <= 10) {
    const url = `https://api.github.com/search/repositories?q=${q}&sort=updated&order=desc&per_page=100&page=${page}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`GitHub search ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { items: { full_name: string }[]; total_count: number };
    if (!data.items?.length) break;
    all.push(...data.items.map((i) => i.full_name));
    if (data.items.length < 100 || all.length >= data.total_count) break;
    page++;
  }
  return all;
}

async function main() {
  const topic = process.argv[2] || "instagram-api";
  const language = process.argv[3] || "TypeScript";
  const dataDir = path.resolve(process.cwd(), "data");

  console.log(`Fetching repos: topic=${topic} language=${language}`);
  const repos = await fetchTopicRepos(topic, language);
  console.log(`Found ${repos.length} repos\n`);

  const skipExisting = !process.argv.includes("--no-skip");
  let ok = 0;
  let fail = 0;
  let skipped = 0;
  for (let i = 0; i < repos.length; i++) {
    const full = repos[i];
    console.log(`\n=== [${i + 1}/${repos.length}] ${full} ===`);
    const slug = slugFromFullName(full);
    const kgPath = path.join(dataDir, slug, "knowledge-graph.json");
    if (skipExisting && existsSync(kgPath)) {
      console.log(`  ⏭ skip (knowledge-graph.json exists)`);
      skipped++;
      continue;
    }
    try {
      await ingestSingleRepo(`https://github.com/${full}`, dataDir);
      ok++;
    } catch (e: unknown) {
      fail++;
      console.error("  FAILED:", e instanceof Error ? e.message : e);
    }
  }
  console.log(`\nDone. OK: ${ok}  Skipped: ${skipped}  Failed: ${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
