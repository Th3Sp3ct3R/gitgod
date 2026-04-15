/**
 * Build a corpus from a local checkout and run the Repository Analyzer (LLM).
 * See templates/repo-analyzer/README.md for corpus rules.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { callLLMWithSystem, detectProvider } from "./llm.js";

const execFileAsync = promisify(execFile);

const README_MAX_LINES = 400;
const MANIFEST_MAX_CHARS = 12_000;

export function githubSlugFromUrl(url: string): string {
  const match = url.match(/github\.com\/([^/]+\/[^/]+)/);
  if (!match) throw new Error(`Invalid GitHub URL: ${url}`);
  return match[1].replace(/\.git$/, "").replace("/", "-");
}

function hasLlmKey(): boolean {
  try {
    detectProvider();
    return true;
  } catch {
    return false;
  }
}

function readHeadLines(filePath: string, maxLines: number): string | null {
  if (!existsSync(filePath)) return null;
  const raw = readFileSync(filePath, "utf-8");
  const lines = raw.split(/\r?\n/);
  const slice = lines.slice(0, maxLines).join("\n");
  return slice;
}

function readIfExists(relPath: string, root: string, label: string): string {
  const p = path.join(root, relPath);
  if (!existsSync(p)) return "";
  let body = readFileSync(p, "utf-8");
  if (body.length > MANIFEST_MAX_CHARS) {
    body = body.slice(0, MANIFEST_MAX_CHARS) + "\n\n[truncated]";
  }
  return `### ${label}\n\nPath: \`${relPath}\`\n\n\`\`\`\n${body}\n\`\`\`\n\n`;
}

/**
 * Assemble corpus text from a repo root directory (already cloned).
 */
export function buildCorpusFromCheckout(repoRoot: string): string {
  const parts: string[] = [];

  const readme =
    readHeadLines(path.join(repoRoot, "README.md"), README_MAX_LINES) ??
    readHeadLines(path.join(repoRoot, "readme.md"), README_MAX_LINES) ??
    readHeadLines(path.join(repoRoot, "README-EN.md"), README_MAX_LINES);
  if (readme) {
    parts.push(`### README (primary)\n\n\`\`\`markdown\n${readme}\n\`\`\`\n\n`);
  }

  parts.push(readIfExists("package.json", repoRoot, "package.json (root)"));
  parts.push(readIfExists("pyproject.toml", repoRoot, "pyproject.toml (root)"));
  parts.push(readIfExists("Cargo.toml", repoRoot, "Cargo.toml (root)"));
  parts.push(readIfExists("frontend/package.json", repoRoot, "frontend/package.json"));
  parts.push(readIfExists("backend/pyproject.toml", repoRoot, "backend/pyproject.toml"));

  if (parts.every((p) => !p.trim())) {
    return "(no README or manifest files found in checkout)\n";
  }
  return parts.join("\n");
}

const USER_INSTRUCTION = `Follow the "Required output" section in your system instructions exactly.

Produce:
1) Human-readable briefing (markdown) with the listed subsections.
2) A single JSON object \`repo_brief\` matching the documented shape (raw JSON, no markdown fence).
3) A single fenced code block labeled \`system_prompt_fragment\` containing the specialist fragment.

Use clear markdown headings for part (1).`;

/**
 * Clone repo shallow, build corpus, fill SYSTEM_PROMPT_TEMPLATE, call LLM, write \`repo-analyzer.md\` under dataDir/slug/.
 */
export async function runRepoAnalyzer(
  githubUrl: string,
  dataDir: string,
  options?: { skipIfNoLlm?: boolean }
): Promise<{ slug: string; outputPath: string; skipped: boolean; reason?: string }> {
  const skipIfNoLlm = options?.skipIfNoLlm ?? true;

  if (!hasLlmKey()) {
    if (skipIfNoLlm) {
      return {
        slug: githubSlugFromUrl(githubUrl),
        outputPath: "",
        skipped: true,
        reason: "No LLM API key (set OPENROUTER_API_KEY, ANTHROPIC_API_KEY, NVIDIA_API_KEY, or KIMI_API_KEY)",
      };
    }
    throw new Error("No LLM API key configured.");
  }

  const slug = githubSlugFromUrl(githubUrl);
  const outDir = path.resolve(dataDir, slug);
  mkdirSync(outDir, { recursive: true });

  const tmpDir = path.resolve(".tmp", `analyzer-${slug}-${Date.now()}`);
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  mkdirSync(path.dirname(tmpDir), { recursive: true });

  try {
    await execFileAsync("git", ["clone", "--depth", "1", githubUrl, tmpDir], {
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`git clone failed for ${githubUrl}: ${msg}`);
  }

  let corpus: string;
  try {
    corpus = buildCorpusFromCheckout(tmpDir);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }

  const templatePath = path.join(process.cwd(), "templates", "repo-analyzer", "SYSTEM_PROMPT_TEMPLATE.md");
  if (!existsSync(templatePath)) {
    throw new Error(`Missing template: ${templatePath}`);
  }
  let systemPrompt = readFileSync(templatePath, "utf-8");
  if (!systemPrompt.includes("{{CORPUS}}")) {
    throw new Error("SYSTEM_PROMPT_TEMPLATE.md must contain {{CORPUS}} placeholder");
  }
  systemPrompt = systemPrompt.replace("{{CORPUS}}", corpus);

  const text = await callLLMWithSystem(systemPrompt, USER_INSTRUCTION);

  const outputPath = path.join(outDir, "repo-analyzer.md");
  const header = `<!-- generated by gitgod analyze-repo / ingest --analyze | ${new Date().toISOString()} | ${githubUrl} -->\n\n`;
  writeFileSync(outputPath, header + text, "utf-8");

  return { slug, outputPath, skipped: false };
}
