#!/usr/bin/env npx tsx
/**
 * pipeline-trendshift-topics.ts
 * 
 * Full pipeline for remaining 20 Trendshift topics:
 * 1. Scrape trendshift.io topic page → repos.json
 * 2. Write VANTA-Brain topic note (08-gitgod/topics/<slug>.md)
 * 3. Write VANTA-Brain repo notes (08-gitgod/repos/<slug>.md)
 * 4. Install skill artifacts to ~/.openclaw/skills/ AND ~/.claude/skills/
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const HOME = process.env.HOME!;
const GITGOD_DIR = "/Users/growthgod/gitgod";
const OBSIDIAN_VAULT = process.env.OBSIDIAN_VAULT ?? `${HOME}/Documents/VANTA-Brain`;
const VANTA_GITGOD = path.join(OBSIDIAN_VAULT, "08-gitgod");
const OPENCLAW_SKILLS = path.join(HOME, ".openclaw/skills");
const CLAUDE_SKILLS = path.join(HOME, ".claude/skills");

// Topics to process in order (remaining after first batch)
const TOPICS = [
  "design-system",
  "curated-list",
  "data-visualization",
  "static-analysis",
  "synthetic-data",
  "ui-components",
  "webassembly",
  "robotics",
  "iot",
  "home-automation",
  "game-development",
  "3d-generation",
];

interface TrendshiftRepo {
  repoName: string;
  trendshiftRepoUrl: string;
  metrics?: number[];
  tags?: string[];
  language?: string;
  githubUrl?: string;
  description?: string;
}

interface TrendshiftReposJson {
  topicName: string;
  topicUrl: string;
  repos: TrendshiftRepo[];
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function getTopLanguages(repos: TrendshiftRepo[]): [string, number][] {
  const counts: Record<string, number> = {};
  for (const r of repos) {
    if (r.language && r.language !== "n/a") {
      counts[r.language] = (counts[r.language] || 0) + 1;
    }
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
}

function getTopTags(repos: TrendshiftRepo[]): [string, number][] {
  const counts: Record<string, number> = {};
  for (const r of repos) {
    for (const tag of r.tags ?? []) {
      counts[tag] = (counts[tag] || 0) + 1;
    }
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
}

function getStars(repo: TrendshiftRepo): number {
  return (repo.metrics?.[0] ?? 0);
}

function writeVantaTopicNote(topicSlug: string, data: TrendshiftReposJson): void {
  const topicsDir = path.join(VANTA_GITGOD, "topics");
  mkdirSync(topicsDir, { recursive: true });

  const topLanguages = getTopLanguages(data.repos);
  const topTags = getTopTags(data.repos);
  const today = new Date().toISOString().split("T")[0];
  
  const topicTitle = data.topicName;
  const fileName = path.join(topicsDir, `${topicSlug}.md`);

  const langStr = topLanguages.map(([l]) => `"${l}"`).join(", ");
  const tagStr = topTags.map(([t]) => `"${t}"`).join(", ");

  const langLines = topLanguages.map(([lang, count]) => `- ${lang}: ${count}`).join("\n");
  const tagLines = topTags.map(([tag, count]) => `- \`${tag}\` (${count})`).join("\n");

  const repoLines = data.repos.map(r => {
    const stars = getStars(r);
    const tags = r.tags?.join(", ") ?? "";
    const starsStr = stars > 0 ? ` ⭐${stars}` : "";
    const descStr = r.description ? ` — ${r.description}` : "";
    const ghUrl = r.githubUrl ?? r.trendshiftRepoUrl;
    return `- [${r.repoName}](${ghUrl})${descStr}${starsStr}`;
  }).join("\n");

  const content = `---
topic: "${topicTitle}"
source_url: "${data.topicUrl}"
repo_count: ${data.repos.length}
scraped_at: "${today}"
top_languages: [${langStr}]
top_tags: [${tagStr}]
---

# ${topicTitle} — Trendshift Topic

**Source:** ${data.topicUrl}
**Repos:** ${data.repos.length}
**Scraped:** ${today}

## Top Languages

${langLines}

## Top Tags

${tagLines}

## Repositories

${repoLines}
`;

  writeFileSync(fileName, content, "utf-8");
  console.log(`  ✅ VANTA-Brain topic note: ${fileName}`);
}

function writeVantaRepoNote(repo: TrendshiftRepo, topic: string): string | null {
  if (!repo.githubUrl && !repo.trendshiftRepoUrl) return null;
  
  const reposDir = path.join(VANTA_GITGOD, "repos");
  mkdirSync(reposDir, { recursive: true });

  const slug = slugify(repo.repoName.split("/").pop() ?? repo.repoName);
  const filePath = path.join(reposDir, `${slug}.md`);
  
  if (existsSync(filePath)) return null; // Skip existing
  
  const today = new Date().toISOString().split("T")[0];
  const stars = getStars(repo);
  const tags = repo.tags ?? [];
  const url = repo.githubUrl ?? repo.trendshiftRepoUrl;
  
  // Simple classification based on tags and name
  const haystackLower = [repo.repoName, repo.description ?? "", tags.join(" ")].join(" ").toLowerCase();
  
  let classification = "reference";
  let score = 2;
  
  const skillSignals = ["cli", "command", "utility", "tool", "script", "wrapper", "client", "sdk", "helper", "parser"];
  const agentSignals = ["agent", "autonomous", "workflow", "pipeline", "orchestrat", "multi-step"];
  const pluginSignals = ["mcp", "plugin", "extension", "integration", "connector", "bridge"];
  
  const skillScore = skillSignals.filter(s => haystackLower.includes(s)).length;
  const agentScore = agentSignals.filter(s => haystackLower.includes(s)).length;
  const pluginScore = pluginSignals.filter(s => haystackLower.includes(s)).length;
  
  if (pluginScore >= 2 || haystackLower.includes("mcp server")) {
    classification = "plugin";
    score = 3;
  } else if (agentScore >= 2) {
    classification = "agent";
    score = 3;
  } else if (skillScore >= 1 || tags.length > 0) {
    classification = "skill";
    score = 3;
  }
  
  if (stars > 1000) score = Math.min(score + 1, 5);
  if (stars > 5000) score = 5;

  const tagQuoted = tags.map(t => `"${t}"`).join(", ");
  const starsStr = stars > 0 ? `\n**Stars:** ${stars.toLocaleString()}` : "";
  const descStr = repo.description ? `\n\n${repo.description}` : "";

  const content = `---
name: "${repo.repoName}"
source_url: "${url}"
stars: ${stars}
topic: ${topic}
classification: ${classification}
score: ${score}
tags: [${tagQuoted}]
ingested_at: ${today}
---

# ${repo.repoName.split("/").pop() ?? repo.repoName}

**Classification:** \`${classification}\`
**Source:** ${url}${starsStr}
**Topic:** ${topic}${descStr}

## Tags

${tags.map(t => `\`${t}\``).join(" ")}

---
*Generated by GitGod on ${today}*
`;

  writeFileSync(filePath, content, "utf-8");
  return filePath;
}

function installSkill(repo: TrendshiftRepo, topic: string): { openclaw: boolean; claude: boolean } {
  const stars = getStars(repo);
  const tags = repo.tags ?? [];
  const url = repo.githubUrl ?? repo.trendshiftRepoUrl;
  
  // Only install if it looks like a skill with some traction
  const haystackLower = [repo.repoName, repo.description ?? "", tags.join(" ")].join(" ").toLowerCase();
  const isSkillWorthy = stars > 50 || tags.length > 0;
  
  if (!isSkillWorthy) return { openclaw: false, claude: false };

  const slug = slugify(repo.repoName.split("/").pop() ?? repo.repoName).slice(0, 40);
  const today = new Date().toISOString().split("T")[0];
  const tagsSlice = tags.slice(0, 5);
  const tagsStr = tagsSlice.join(", ");
  
  const description = (repo.description ?? `${repo.repoName} — ${topic} tool`).slice(0, 200).replace(/"/g, "'");
  const starsStr = stars > 0 ? `**Stars:** ${stars.toLocaleString()}\n` : "";

  const openclawContent = `# ${repo.repoName.split("/").pop() ?? repo.repoName}

**Source:** ${url}
${starsStr}**Tags:** ${tagsStr}
**Topic:** ${topic}

## Description

${repo.description ?? `A ${topic} tool from Trendshift.`}

## When to Use

Use when working with ${tagsSlice.slice(0, 3).join(", ")} functionality.

## Setup

1. Install from: ${url}
2. Follow README instructions

## Notes

Classified by GitGod on ${today}
`;

  const firstLine = (repo.description ?? `${topic} tool`).split(".")[0].trim().slice(0, 200).replace(/"/g, "'");
  const tagNote = tagsSlice.length ? " Tags: " + tagsSlice.slice(0, 4).join(", ") + "." : "";
  const claudeDesc = (firstLine + tagNote).slice(0, 250).replace(/"/g, "'");

  const claudeContent = `---
name: ${slug}
description: "${claudeDesc}"
source: gitgod
date_added: "${today}"
tags: [${tagsSlice.map(t => `"${t}"`).join(", ")}]
---

# ${repo.repoName.split("/").pop() ?? repo.repoName}

**Source:** ${url}
${starsStr}
${repo.description ?? `A ${topic} tool from Trendshift.`}

## When to Use

Use when working with ${tagsSlice.slice(0, 3).join(", ")} functionality.

## Setup

1. Install from: ${url}
2. Follow README instructions
`;

  let openclawInstalled = false;
  let claudeInstalled = false;

  const openclawDir = path.join(OPENCLAW_SKILLS, slug);
  const openclawPath = path.join(openclawDir, "SKILL.md");
  if (!existsSync(openclawPath)) {
    mkdirSync(openclawDir, { recursive: true });
    writeFileSync(openclawPath, openclawContent, "utf-8");
    openclawInstalled = true;
  }

  const claudeDir = path.join(CLAUDE_SKILLS, `gitgod-${slug}`);
  const claudePath = path.join(claudeDir, "SKILL.md");
  if (!existsSync(claudePath)) {
    mkdirSync(claudeDir, { recursive: true });
    writeFileSync(claudePath, claudeContent, "utf-8");
    claudeInstalled = true;
  }

  return { openclaw: openclawInstalled, claude: claudeInstalled };
}

async function processOneTopic(topicSlug: string): Promise<{
  topic: string;
  repos: number;
  notes: number;
  openclawNew: number;
  claudeNew: number;
  error?: string;
}> {
  const topicUrl = `https://trendshift.io/topics/${topicSlug}`;
  const dataDir = path.join(GITGOD_DIR, "data/trendshift", topicSlug);
  const reposJsonPath = path.join(dataDir, "repos.json");

  console.log(`\n${"=".repeat(60)}`);
  console.log(`🔍 Processing topic: ${topicSlug}`);
  console.log(`   URL: ${topicUrl}`);

  // Step 1: Scrape if not already scraped
  if (!existsSync(reposJsonPath)) {
    console.log(`  📡 Scraping trendshift.io...`);
    try {
      execSync(
        `cd ${GITGOD_DIR} && npx tsx src/cli.ts trendshift-topic "${topicUrl}"`,
        { stdio: "pipe", timeout: 60000 }
      );
    } catch (err: any) {
      const msg = `Scrape failed: ${err.message ?? err}`;
      console.error(`  ❌ ${msg}`);
      return { topic: topicSlug, repos: 0, notes: 0, openclawNew: 0, claudeNew: 0, error: msg };
    }
  } else {
    console.log(`  ⚡ Already scraped, using cached repos.json`);
  }

  // Step 2: Read repos.json
  if (!existsSync(reposJsonPath)) {
    const msg = "repos.json not found after scrape";
    console.error(`  ❌ ${msg}`);
    return { topic: topicSlug, repos: 0, notes: 0, openclawNew: 0, claudeNew: 0, error: msg };
  }

  let data: TrendshiftReposJson;
  try {
    data = JSON.parse(readFileSync(reposJsonPath, "utf-8"));
  } catch (err: any) {
    const msg = `Failed to parse repos.json: ${err.message}`;
    console.error(`  ❌ ${msg}`);
    return { topic: topicSlug, repos: 0, notes: 0, openclawNew: 0, claudeNew: 0, error: msg };
  }

  if (!data.repos || data.repos.length === 0) {
    const msg = "No repos found in repos.json";
    console.warn(`  ⚠️  ${msg}`);
    return { topic: topicSlug, repos: 0, notes: 0, openclawNew: 0, claudeNew: 0, error: msg };
  }

  console.log(`  📦 Found ${data.repos.length} repos for "${data.topicName}"`);

  // Step 3: Write VANTA-Brain topic note
  writeVantaTopicNote(topicSlug, data);

  // Step 4: Write per-repo notes + install skills
  let notes = 0;
  let openclawNew = 0;
  let claudeNew = 0;

  for (const repo of data.repos) {
    // Write VANTA note
    const notePath = writeVantaRepoNote(repo, topicSlug);
    if (notePath) notes++;

    // Install skills
    const installed = installSkill(repo, topicSlug);
    if (installed.openclaw) openclawNew++;
    if (installed.claude) claudeNew++;
  }

  console.log(`  📝 New repo notes: ${notes}/${data.repos.length}`);
  console.log(`  🔧 OpenClaw skills installed: ${openclawNew}`);
  console.log(`  🤖 Claude skills installed: ${claudeNew}`);

  return {
    topic: topicSlug,
    repos: data.repos.length,
    notes,
    openclawNew,
    claudeNew,
  };
}

async function main() {
  console.log("🚀 GitGod Trendshift Pipeline — Remaining 20 Topics");
  console.log(`📚 VANTA-Brain: ${VANTA_GITGOD}`);
  console.log(`🔧 OpenClaw skills: ${OPENCLAW_SKILLS}`);
  console.log(`🤖 Claude skills: ${CLAUDE_SKILLS}`);

  const results: Array<ReturnType<typeof processOneTopic> extends Promise<infer T> ? T : never> = [];

  for (const topic of TOPICS) {
    const result = await processOneTopic(topic);
    results.push(result);
    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Summary
  console.log(`\n${"=".repeat(60)}`);
  console.log("📊 PIPELINE SUMMARY");
  console.log(`${"=".repeat(60)}`);

  let totalRepos = 0;
  let totalNotes = 0;
  let totalOpenclaw = 0;
  let totalClaude = 0;

  for (const r of results) {
    const status = r.error ? "❌" : "✅";
    console.log(`${status} ${r.topic.padEnd(20)} — repos: ${r.repos}, notes: ${r.notes}, openclaw: ${r.openclawNew}, claude: ${r.claudeNew}${r.error ? ` [${r.error}]` : ""}`);
    totalRepos += r.repos;
    totalNotes += r.notes;
    totalOpenclaw += r.openclawNew;
    totalClaude += r.claudeNew;
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`Total repos processed:      ${totalRepos}`);
  console.log(`New VANTA-Brain repo notes: ${totalNotes}`);
  console.log(`New OpenClaw skills:        ${totalOpenclaw}`);
  console.log(`New Claude skills:          ${totalClaude}`);
  
  // Final counts
  try {
    const openclawTotal = execSync(`ls ${OPENCLAW_SKILLS} | wc -l`, { encoding: "utf-8" }).trim();
    const claudeTotal = execSync(`ls ${CLAUDE_SKILLS} | wc -l`, { encoding: "utf-8" }).trim();
    const repoNotesTotal = execSync(`ls ${VANTA_GITGOD}/repos/ | wc -l`, { encoding: "utf-8" }).trim();
    
    console.log(`\n📈 Final Totals:`);
    console.log(`   ~/.openclaw/skills/: ${openclawTotal}`);
    console.log(`   ~/.claude/skills/:   ${claudeTotal}`);
    console.log(`   VANTA-Brain repos:   ${repoNotesTotal}`);
  } catch (e) {
    // ignore
  }
}

main().catch(console.error);
