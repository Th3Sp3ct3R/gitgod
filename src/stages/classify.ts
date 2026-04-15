// src/stages/classify.ts
// GitGod Classification Stage — rules-based first pass + Obsidian writer
// Classifies each tool/repo as: agent | skill | plugin | reference | skip
// Then writes a structured note to VANTA-Brain/08-gitgod/repos/

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Tool, Skeleton } from "../types.js";

export type Classification = "agent" | "skill" | "plugin" | "reference" | "skip";

export interface ClassifyResult {
  name: string;
  source_url: string;
  classification: Classification;
  artifact_type: "SKILL.md" | "agent-config" | "plugin" | "none";
  confidence: "high" | "medium" | "low";
  rationale: string;
  score: number;
  tags: string[];
  stars?: number;
  topic?: string;
}

const OBSIDIAN_VAULT = process.env.OBSIDIAN_VAULT ?? `${process.env.HOME}/Documents/VANTA-Brain`;
const GITGOD_DIR = path.join(OBSIDIAN_VAULT, "08-gitgod");
const OPENCLAW_SKILLS_DIR = `${process.env.HOME}/.openclaw/skills`;
const CLAUDE_SKILLS_DIR = `${process.env.HOME}/.claude/skills`;

// ─── Rules Engine ────────────────────────────────────────────────────────────

const AGENT_SIGNALS = [
  "autonomous", "orchestrat", "multi-step", "workflow", "pipeline",
  "agent", "planner", "coordinator", "task execution", "memory", "long-running",
  "mcp server", "json-rpc", "tool call", "function call"
];

const SKILL_SIGNALS = [
  "cli", "command-line", "single-purpose", "utility", "tool",
  "script", "helper", "wrapper", "client", "sdk",
  "search", "scrape", "fetch", "convert", "parse", "format"
];

const PLUGIN_SIGNALS = [
  "plugin", "extension", "mcp", "model context protocol",
  "integration", "connector", "bridge", "adapter", "middleware"
];

const SKIP_SIGNALS = [
  "unmaintained", "archived", "deprecated", "dead", "discontinued",
  "tutorial", "course", "book", "awesome-list", "collection"
];

function scoreSignals(haystack: string, signals: string[]): number {
  return signals.filter(s => haystack.includes(s)).length;
}

export function classifyTool(tool: Tool, topic?: string): ClassifyResult {
  const name = tool.name;
  const url = tool.url;
  const stars = tool.scraped?.github_meta?.stars;
  const tags = tool.synthesis?.tags ?? [];
  const score = tool.synthesis?.relevance_score ?? 0;

  const haystack = [
    name,
    tool.description,
    tool.synthesis?.summary ?? "",
    tags.join(" "),
    url,
  ].join(" ").toLowerCase();

  // Dead repos → skip
  if (tool.status === "dead" || tool.status === "error") {
    return {
      name, source_url: url,
      classification: "skip",
      artifact_type: "none",
      confidence: "high",
      rationale: `Repo is ${tool.status} — skipping.`,
      score, tags, stars, topic,
    };
  }

  // Score each bucket
  const skipScore = scoreSignals(haystack, SKIP_SIGNALS);
  const agentScore = scoreSignals(haystack, AGENT_SIGNALS);
  const pluginScore = scoreSignals(haystack, PLUGIN_SIGNALS);
  const skillScore = scoreSignals(haystack, SKILL_SIGNALS);

  // Low relevance or skip signals → reference/skip
  if (skipScore >= 2 || score < 2) {
    return {
      name, source_url: url,
      classification: score < 1 ? "skip" : "reference",
      artifact_type: "none",
      confidence: "high",
      rationale: skipScore >= 2
        ? `Skip signals detected (${SKIP_SIGNALS.filter(s => haystack.includes(s)).join(", ")}).`
        : `Low relevance score (${score}/5) — treating as reference only.`,
      score, tags, stars, topic,
    };
  }

  // Plugin: explicit MCP/integration signals
  if (pluginScore >= 2 || haystack.includes("model context protocol") || haystack.includes("mcp server")) {
    return {
      name, source_url: url,
      classification: "plugin",
      artifact_type: "plugin",
      confidence: pluginScore >= 3 ? "high" : "medium",
      rationale: `Strong plugin/MCP signals: ${PLUGIN_SIGNALS.filter(s => haystack.includes(s)).slice(0, 3).join(", ")}.`,
      score, tags, stars, topic,
    };
  }

  // Agent: orchestration/autonomous signals outweigh skill signals
  if (agentScore >= 3 || (agentScore >= 2 && agentScore > skillScore)) {
    return {
      name, source_url: url,
      classification: "agent",
      artifact_type: "agent-config",
      confidence: agentScore >= 4 ? "high" : "medium",
      rationale: `Agent signals detected: ${AGENT_SIGNALS.filter(s => haystack.includes(s)).slice(0, 4).join(", ")}.`,
      score, tags, stars, topic,
    };
  }

  // Skill: CLI/utility signals
  if (skillScore >= 2) {
    return {
      name, source_url: url,
      classification: "skill",
      artifact_type: "SKILL.md",
      confidence: skillScore >= 4 ? "high" : "medium",
      rationale: `Skill signals detected: ${SKILL_SIGNALS.filter(s => haystack.includes(s)).slice(0, 4).join(", ")}.`,
      score, tags, stars, topic,
    };
  }

  // Default: reference
  return {
    name, source_url: url,
    classification: "reference",
    artifact_type: "none",
    confidence: "low",
    rationale: `No strong classification signals. Storing as reference for manual review.`,
    score, tags, stars, topic,
  };
}

// ─── Obsidian Writer ──────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function writeRepoNote(result: ClassifyResult): void {
  const reposDir = path.join(GITGOD_DIR, "repos");
  mkdirSync(reposDir, { recursive: true });

  const slug = slugify(result.name);
  const filePath = path.join(reposDir, `${slug}.md`);
  const now = new Date().toISOString().split("T")[0];

  const content = `---
name: "${result.name}"
source_url: "${result.source_url}"
stars: ${result.stars ?? "unknown"}
topic: ${result.topic ?? "unknown"}
classification: ${result.classification}
artifact_type: ${result.artifact_type}
installed: false
score: ${result.score}
confidence: ${result.confidence}
tags: [${result.tags.map(t => `"${t}"`).join(", ")}]
ingested_at: ${now}
---

# ${result.name}

**Classification:** \`${result.classification}\` (${result.confidence} confidence)
**Artifact:** \`${result.artifact_type}\`
**Source:** ${result.source_url}
${result.stars ? `**Stars:** ${result.stars.toLocaleString()}` : ""}
${result.topic ? `**Topic:** ${result.topic}` : ""}

## Decision Rationale

${result.rationale}

## Tags

${result.tags.map(t => `\`${t}\``).join(" ")}

---
*Generated by GitGod on ${now}*
`;

  writeFileSync(filePath, content, "utf-8");
}

export function writeTopicSummary(topic: string, results: ClassifyResult[]): void {
  const topicsDir = path.join(GITGOD_DIR, "topics");
  mkdirSync(topicsDir, { recursive: true });

  const slug = slugify(topic);
  const filePath = path.join(topicsDir, `${slug}.md`);
  const now = new Date().toISOString().split("T")[0];

  const counts = {
    agent: results.filter(r => r.classification === "agent").length,
    skill: results.filter(r => r.classification === "skill").length,
    plugin: results.filter(r => r.classification === "plugin").length,
    reference: results.filter(r => r.classification === "reference").length,
    skip: results.filter(r => r.classification === "skip").length,
  };

  const topByScore = [...results]
    .filter(r => r.classification !== "skip")
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  const content = `---
topic: "${topic}"
scraped_at: ${now}
total_repos: ${results.length}
agents: ${counts.agent}
skills: ${counts.skill}
plugins: ${counts.plugin}
reference: ${counts.reference}
skipped: ${counts.skip}
---

# ${topic} — GitGod Topic Summary

Scraped: ${now} | Total: ${results.length} repos

## Classification Breakdown

| Type | Count |
|------|-------|
| 🤖 Agents | ${counts.agent} |
| 🔧 Skills | ${counts.skill} |
| 🔌 Plugins | ${counts.plugin} |
| 📚 Reference | ${counts.reference} |
| ⏭ Skipped | ${counts.skip} |

## Top Repos (by relevance score)

${topByScore.map(r => `- **[[repos/${slugify(r.name)}|${r.name}]]** — \`${r.classification}\` | Score: ${r.score}/5${r.stars ? ` | ⭐ ${r.stars.toLocaleString()}` : ""}`).join("\n")}

---
*Generated by GitGod on ${now}*
`;

  writeFileSync(filePath, content, "utf-8");
}

export function updateIndex(allResults: ClassifyResult[]): void {
  const indexPath = path.join(GITGOD_DIR, "_index.md");
  const now = new Date().toISOString().split("T")[0];

  const byTopic = new Map<string, ClassifyResult[]>();
  for (const r of allResults) {
    const t = r.topic ?? "unknown";
    if (!byTopic.has(t)) byTopic.set(t, []);
    byTopic.get(t)!.push(r);
  }

  const counts = {
    total: allResults.length,
    agent: allResults.filter(r => r.classification === "agent").length,
    skill: allResults.filter(r => r.classification === "skill").length,
    plugin: allResults.filter(r => r.classification === "plugin").length,
    reference: allResults.filter(r => r.classification === "reference").length,
  };

  const content = `# GitGod Master Index

> Auto-updated by GitGod on every pipeline run. Last updated: ${now}

## Pipeline Stats

| Metric | Count |
|--------|-------|
| Total repos classified | ${counts.total} |
| 🤖 Agents | ${counts.agent} |
| 🔧 Skills | ${counts.skill} |
| 🔌 Plugins | ${counts.plugin} |
| 📚 Reference | ${counts.reference} |

## Topics

| Topic | Repos | Agents | Skills | Plugins |
|-------|-------|--------|--------|---------|
${Array.from(byTopic.entries()).map(([topic, results]) => {
  const a = results.filter(r => r.classification === "agent").length;
  const s = results.filter(r => r.classification === "skill").length;
  const p = results.filter(r => r.classification === "plugin").length;
  return `| [[topics/${slugify(topic)}\\|${topic}]] | ${results.length} | ${a} | ${s} | ${p} |`;
}).join("\n")}

## Browse by Type

- **Agents** — repos to build into autonomous agents
- **Skills** — repos to build into Claude/OpenClaw skills  
- **Plugins** — repos to wire as MCP plugins

---
*Generated by GitGod on ${now}*
`;

  writeFileSync(indexPath, content, "utf-8");
}

// ─── Skill Installer ─────────────────────────────────────────────────────────

export function installSkillArtifact(result: ClassifyResult): { openclaw: boolean; claude: boolean } {
  if (result.classification !== "skill" || result.score < 3) {
    return { openclaw: false, claude: false };
  }

  const slug = slugify(result.name).slice(0, 40);
  const now = new Date().toISOString().split("T")[0];
  const tags = result.tags.slice(0, 5);

  // Build OpenClaw SKILL.md
  const openclawSkill = `# ${result.name}

**Source:** ${result.source_url}
**Score:** ${result.score}/5
**Tags:** ${tags.join(", ")}

## Description

${result.rationale}

## When to Use

Use when working with ${tags.slice(0, 3).join(", ")} functionality.

## Setup

1. Install from: ${result.source_url}
2. Follow README instructions

## Notes

Classified by GitGod on ${now}
`;

  // Build Claude Code SKILL.md (different frontmatter format)
  const firstLine = result.rationale.split(".")[0].trim().slice(0, 200);
  const tagStr = tags.length ? " Tags: " + tags.slice(0, 4).join(", ") + "." : "";
  const description = (firstLine + tagStr).replace(/"/g, "'");

  const claudeSkill = `---
name: ${slug}
description: "${description}"
source: gitgod
date_added: "${now}"
tags: [${tags.map(t => `"${t}"`).join(", ")}]
---

# ${result.name}

**Source:** ${result.source_url}
**Score:** ${result.score}/5

${result.rationale}

## When to Use

Use when working with ${tags.slice(0, 3).join(", ")} functionality.

## Setup

1. Install from: ${result.source_url}
2. Follow README instructions
`;

  let openclawInstalled = false;
  let claudeInstalled = false;

  // Install to OpenClaw
  const openclawDir = path.join(OPENCLAW_SKILLS_DIR, slug);
  const openclawPath = path.join(openclawDir, "SKILL.md");
  if (!existsSync(openclawPath)) {
    mkdirSync(openclawDir, { recursive: true });
    writeFileSync(openclawPath, openclawSkill, "utf-8");
    openclawInstalled = true;
  }

  // Install to Claude Code
  const claudeDir = path.join(CLAUDE_SKILLS_DIR, `gitgod-${slug}`);
  const claudePath = path.join(claudeDir, "SKILL.md");
  if (!existsSync(claudePath)) {
    mkdirSync(claudeDir, { recursive: true });
    writeFileSync(claudePath, claudeSkill, "utf-8");
    claudeInstalled = true;
  }

  // Also write to VANTA-Brain artifacts
  const artifactsDir = path.join(GITGOD_DIR, "artifacts", "skills");
  mkdirSync(artifactsDir, { recursive: true });
  writeFileSync(path.join(artifactsDir, `${slug}.md`), openclawSkill, "utf-8");

  return { openclaw: openclawInstalled, claude: claudeInstalled };
}

// ─── Classify from Skeleton ───────────────────────────────────────────────────

export function classifyFromSkeleton(skeletonPath: string, topic?: string): ClassifyResult[] {
  const skeleton: Skeleton = JSON.parse(readFileSync(skeletonPath, "utf-8"));
  const results: ClassifyResult[] = [];

  function walk(categories: any[]): void {
    for (const cat of categories) {
      for (const tool of cat.tools ?? []) {
        results.push(classifyTool(tool, topic));
      }
      walk(cat.subcategories ?? []);
    }
  }

  walk(skeleton.taxonomy ?? []);
  return results;
}

// ─── CLI Entry ────────────────────────────────────────────────────────────────

if (process.argv[1]?.endsWith("classify.ts") || process.argv[1]?.endsWith("classify.js")) {
  const args = process.argv.slice(2);
  const skeletonPath = args[0];
  const topic = args[1];

  if (!skeletonPath) {
    console.error("Usage: classify <skeleton.json> [topic]");
    process.exit(1);
  }

  console.log(`\nClassifying repos from: ${skeletonPath}`);
  if (topic) console.log(`Topic: ${topic}`);

  const results = classifyFromSkeleton(skeletonPath, topic);

  const counts = {
    agent: results.filter(r => r.classification === "agent").length,
    skill: results.filter(r => r.classification === "skill").length,
    plugin: results.filter(r => r.classification === "plugin").length,
    reference: results.filter(r => r.classification === "reference").length,
    skip: results.filter(r => r.classification === "skip").length,
  };

  console.log(`\nResults: ${results.length} repos classified`);
  console.log(`  🤖 Agent:     ${counts.agent}`);
  console.log(`  🔧 Skill:     ${counts.skill}`);
  console.log(`  🔌 Plugin:    ${counts.plugin}`);
  console.log(`  📚 Reference: ${counts.reference}`);
  console.log(`  ⏭  Skip:      ${counts.skip}`);

  // Write Obsidian notes + install skill artifacts to both OpenClaw and Claude Code
  console.log(`\nWriting to VANTA-Brain + installing skills...`);
  let openclawNew = 0, claudeNew = 0;
  for (const result of results) {
    writeRepoNote(result);
    const installed = installSkillArtifact(result);
    if (installed.openclaw) openclawNew++;
    if (installed.claude) claudeNew++;
  }

  if (topic) {
    writeTopicSummary(topic, results);
  }

  updateIndex(results);

  console.log(`\n✅ Done — notes written to ${GITGOD_DIR}`);
  console.log(`   ${results.filter(r => r.classification !== "skip").length} notes created in 08-gitgod/repos/`);
  console.log(`   ${openclawNew} new skills installed → ~/.openclaw/skills/`);
  console.log(`   ${claudeNew} new skills installed → ~/.claude/skills/gitgod-*`);
}
