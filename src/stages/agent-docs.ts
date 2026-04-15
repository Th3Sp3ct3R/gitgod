/**
 * Build RAG context from a local repo and draft SKILL.md + AGENT.md for AI agents.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildCodeIndex, buildRagContext } from "../lib/code-index.js";
import { callLLM } from "../lib/llm.js";

export interface AgentDocsOptions {
  repoPath: string;
  dataDir: string;
  /** Folder name under dataDir (default: basename of repoPath) */
  slug?: string;
  /** Inject for tests */
  llm?: (prompt: string) => Promise<string>;
  /** Only write index + RAG sample; no LLM */
  dryRun?: boolean;
}

export interface AgentDocsResult {
  outDir: string;
  skillPath: string;
  agentPath: string;
  metaPath: string;
}

function readTextIfExists(filePath: string, maxBytes: number): string {
  if (!existsSync(filePath)) return "";
  try {
    const st = statSync(filePath);
    if (!st.isFile() || st.size > maxBytes) return "";
    return readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

const RAG_QUERIES = [
  "cli command entry point main",
  "package scripts dependencies exports",
  "architecture how it works",
  "test build configuration",
];

export function parseAgentDocsOutput(raw: string): { skill: string; agent: string } {
  const skillMatch = raw.match(/<<<<<<< SKILL\.md\r?\n([\s\S]*?)\r?\n>>>>>>> SKILL\.md/);
  const agentMatch = raw.match(/<<<<<<< AGENT\.md\r?\n([\s\S]*?)\r?\n>>>>>>> AGENT\.md/);
  if (skillMatch && agentMatch) {
    return { skill: skillMatch[1].trim(), agent: agentMatch[1].trim() };
  }
  const legacy = raw.split(/\n---AGENT---\n/);
  if (legacy.length === 2) {
    return {
      skill: legacy[0].replace(/^---SKILL---\n?/, "").trim(),
      agent: legacy[1].trim(),
    };
  }
  throw new Error(
    "Could not parse LLM output: expected blocks <<<<<<< SKILL.md ... >>>>>>> SKILL.md and <<<<<<< AGENT.md ... >>>>>>> AGENT.md"
  );
}

function buildPrompt(repoPath: string, slug: string, readme: string, rag: string): string {
  return `You are drafting agent-facing documentation for a software repository.

Repository path: ${repoPath}
Slug: ${slug}

## README (excerpt)
${readme.slice(0, 8000)}

## Retrieved code / docs (RAG — prioritize facts from here)
${rag.slice(0, 28000)}

---

Produce two files for Claude Code / Cursor style workflows:

1) **SKILL.md** — YAML frontmatter with name, description (when to use), and body with: overview, key commands or APIs, constraints, and pointers to important paths.
2) **AGENT.md** — concise agent instructions: role, triggers, tools/files to read first, workflow steps, and safety notes.

Output EXACTLY in this format (markers required):

<<<<<<< SKILL.md
(full file content including --- YAML frontmatter ---)
>>>>>>> SKILL.md
<<<<<<< AGENT.md
(full file content)
>>>>>>> AGENT.md

Do not wrap in markdown code fences. Be specific to this repository; avoid generic filler.`;
}

export async function runAgentDocs(opts: AgentDocsOptions): Promise<AgentDocsResult> {
  const repoPath = path.resolve(opts.repoPath);
  if (!existsSync(repoPath)) {
    throw new Error(`Repository path does not exist: ${repoPath}`);
  }

  const fromBasename = path
    .basename(repoPath)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-|-$/g, "");
  const slug = opts.slug ?? (fromBasename || "repo");

  const dataDir = path.resolve(opts.dataDir);
  const outDir = path.join(dataDir, slug, "agent-docs");
  mkdirSync(outDir, { recursive: true });

  const chunks = buildCodeIndex(repoPath);
  const readme = readTextIfExists(path.join(repoPath, "README.md"), 120_000);
  const pkgJson = readTextIfExists(path.join(repoPath, "package.json"), 200_000);
  const rag = buildRagContext(RAG_QUERIES, chunks, 5);
  const ragExtra = pkgJson ? `\n### package.json\n\`\`\`json\n${pkgJson.slice(0, 8000)}\n\`\`\`\n` : "";
  const fullRag = rag + ragExtra;

  const metaPath = path.join(outDir, "code-index-meta.json");
  const meta = {
    repoPath,
    slug,
    chunkCount: chunks.length,
    queries: RAG_QUERIES,
    generatedAt: new Date().toISOString(),
    sampleChunkPaths: [...new Set(chunks.slice(0, 40).map((c) => c.path))],
  };
  writeFileSync(metaPath, JSON.stringify(meta, null, 2));

  const skillPath = path.join(outDir, "SKILL.md");
  const agentPath = path.join(outDir, "AGENT.md");

  if (opts.dryRun) {
    writeFileSync(
      path.join(outDir, "rag-context-sample.md"),
      `# RAG context sample (dry run)\n\n${fullRag.slice(0, 100_000)}`
    );
    writeFileSync(
      skillPath,
      `---\nname: ${slug}\ndescription: "Dry run — run without --dry-run and a configured LLM to generate full SKILL.md."\n---\n\n# ${slug}\n\n(Index built: ${chunks.length} chunks.)\n`
    );
    writeFileSync(
      agentPath,
      `# Agent instructions (dry run)\n\nRun \`gitgod agent-docs <repo>\` without \`--dry-run\` to generate AGENT.md from the code index + LLM.\n`
    );
    return { outDir, skillPath, agentPath, metaPath };
  }

  const llm = opts.llm ?? callLLM;
  const prompt = buildPrompt(repoPath, slug, readme, fullRag);
  const raw = await llm(prompt);
  const { skill, agent } = parseAgentDocsOutput(raw);
  writeFileSync(skillPath, skill + (skill.endsWith("\n") ? "" : "\n"));
  writeFileSync(agentPath, agent + (agent.endsWith("\n") ? "" : "\n"));
  return { outDir, skillPath, agentPath, metaPath };
}
