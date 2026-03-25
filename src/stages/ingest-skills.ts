// src/stages/ingest-skills.ts — bulk ingest skills from antigravity-awesome-skills
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { callLLM } from "../lib/llm.js";
import type { SingleRepoEntry, BrowserIngestedGraph, ScrapedData, SynthesisData } from "../types.js";

const GRAPH_DIR = "browser-ingested";
const GRAPH_FILE = "knowledge-graph.json";

interface SkillEntry {
  id: string;
  path: string;
  category: string;
  name: string;
  description: string;
  risk: string;
  source: string;
  date_added: string;
}

interface SkillsIndex {
  [key: string]: SkillEntry;
}

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

async function synthesizeSkill(skill: SkillEntry, readmeContent: string): Promise<SynthesisData> {
  const frontmatter = extractFrontmatter(readmeContent);
  
  const tags = [
    skill.category,
    "skill",
    ...(frontmatter.tags || []),
  ].filter((v, i, a) => a.indexOf(v) === i);

  return {
    summary: frontmatter.description || skill.description,
    tags: tags.slice(0, 7),
    relevance_score: 3,
    cross_categories: [skill.category],
    duplicates: [],
  };
}

function extractFrontmatter(content: string): { name: string; description: string; tags?: string[] } {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    return { name: "", description: "" };
  }

  const frontmatter = match[1];
  const nameMatch = frontmatter.match(/name:\s*(.+)/);
  const descMatch = frontmatter.match(/description:\s*["']?(.+?)["']?\s*$/m);
  const tagsMatch = frontmatter.match(/tags:\s*\[([^\]]+)\]/);

  return {
    name: nameMatch?.[1]?.trim() || "",
    description: descMatch?.[1]?.trim() || "",
    tags: tagsMatch?.[1]?.split(",").map((t: string) => t.trim().replace(/["']/g, "")),
  };
}

export async function ingestSkills(
  skillsIndexPath: string,
  skillsRootDir: string,
  dataDir: string,
  options: { limit?: number; skipExisting?: boolean } = {}
): Promise<{ imported: number; skipped: number; failed: number }> {
  const { limit, skipExisting = true } = options;

  console.log(`[Ingest Skills] Loading index from ${skillsIndexPath}`);
  const skillsIndex = JSON.parse(readFileSync(skillsIndexPath, "utf-8")) as SkillsIndex;
  const skills = Object.values(skillsIndex);

  if (limit) {
    skills.splice(limit);
  }

  console.log(`[Ingest Skills] Found ${skills.length} skills`);

  const graph = loadGraph(dataDir);
  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < skills.length; i++) {
    const skill = skills[i];
    const skillId = `antigravity-${skill.id}`;
    const url = `https://github.com/sickn33/antigravity-awesome-skills/tree/main/${skill.path}`;

    if (skipExisting) {
      const exists = graph.entries.some((e) => e.repo === skillId);
      if (exists) {
        skipped++;
        continue;
      }
    }

    const skillPath = path.join(skillsRootDir, skill.path);
    const skillMdPath = path.join(skillPath, "SKILL.md");

    if (!existsSync(skillMdPath)) {
      console.log(`  [${i + 1}/${skills.length}] ⚠ SKILL.md not found: ${skill.path}`);
      failed++;
      continue;
    }

    const content = readFileSync(skillMdPath, "utf-8");
    const frontmatter = extractFrontmatter(content);

    console.log(`  [${i + 1}/${skills.length}] Processing: ${skill.name}`);

    const scraped: ScrapedData = {
      title: skill.name,
      description: skill.description,
      content_preview: content.slice(0, 2000),
      github_meta: {
        stars: 0,
        language: "markdown",
        last_commit: skill.date_added,
        topics: frontmatter.tags || [],
      },
      scraped_at: new Date().toISOString(),
    };

    const synthesis = await synthesizeSkill(skill, content);

    const entry: SingleRepoEntry = {
      url,
      owner: "sickn33",
      repo: skillId,
      scraped,
      synthesis,
      ingested_at: new Date().toISOString(),
    };

    graph.entries.push(entry);
    imported++;

    if (imported % 10 === 0) {
      saveGraph(dataDir, graph);
      console.log(`  💾 Checkpoint saved (${imported} imported)`);
    }
  }

  saveGraph(dataDir, graph);
  console.log(`\n✅ Done! Imported: ${imported}, Skipped: ${skipped}, Failed: ${failed}`);
  console.log(`  → ${path.join(dataDir, GRAPH_DIR, GRAPH_FILE)}`);

  return { imported, skipped, failed };
}
