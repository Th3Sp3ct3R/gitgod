/**
 * Lightweight code index for RAG-style retrieval without embeddings:
 * chunk source files, then rank chunks by token overlap with the query.
 */
import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const DEFAULT_IGNORE_DIRS = new Set([
  ".git",
  ".claude",
  ".cursor",
  "data",
  "node_modules",
  "dist",
  "build",
  ".next",
  "coverage",
  "target",
  "__pycache__",
  ".venv",
  "venv",
  "vendor",
  ".turbo",
  ".cache",
]);

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".md",
  ".mdx",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".py",
  ".go",
  ".rs",
  ".rb",
  ".java",
  ".kt",
  ".swift",
  ".vue",
  ".svelte",
  ".css",
  ".html",
  ".sh",
]);

export interface CodeChunk {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  text: string;
}

export interface BuildCodeIndexOptions {
  maxFileBytes?: number;
  /** Stop after this many indexed text files (safety cap for huge trees). */
  maxFiles?: number;
  linesPerChunk?: number;
  lineOverlap?: number;
  ignoreDirs?: Set<string>;
}

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "from",
  "are",
  "was",
  "has",
  "have",
  "not",
  "but",
  "can",
  "all",
  "any",
  "use",
  "get",
  "set",
]);

function shouldIgnoreDir(name: string, ignoreDirs: Set<string>): boolean {
  return ignoreDirs.has(name);
}

function walkFiles(root: string, ignoreDirs: Set<string>, out: string[], maxFiles: number): void {
  if (out.length >= maxFiles) return;
  if (!existsSync(root)) return;
  let st;
  try {
    st = lstatSync(root);
  } catch {
    return;
  }
  if (st.isSymbolicLink()) return;
  if (!st.isDirectory()) {
    if (st.isFile()) out.push(root);
    return;
  }
  for (const ent of readdirSync(root, { withFileTypes: true })) {
    if (ent.isSymbolicLink()) continue;
    const full = path.join(root, ent.name);
    if (ent.isDirectory()) {
      if (shouldIgnoreDir(ent.name, ignoreDirs)) continue;
      walkFiles(full, ignoreDirs, out, maxFiles);
      if (out.length >= maxFiles) return;
    } else if (ent.isFile()) {
      out.push(full);
      if (out.length >= maxFiles) return;
    }
  }
}

function extensionOf(filePath: string): string {
  const base = path.basename(filePath);
  const i = base.lastIndexOf(".");
  return i >= 0 ? base.slice(i).toLowerCase() : "";
}

export function buildCodeIndex(repoRoot: string, options: BuildCodeIndexOptions = {}): CodeChunk[] {
  const maxFileBytes = options.maxFileBytes ?? 200_000;
  const maxFiles = options.maxFiles ?? 4_000;
  const linesPerChunk = options.linesPerChunk ?? 55;
  const lineOverlap = options.lineOverlap ?? 8;
  const ignoreDirs = options.ignoreDirs ?? DEFAULT_IGNORE_DIRS;

  const absRoot = path.resolve(repoRoot);
  const files: string[] = [];
  walkFiles(absRoot, ignoreDirs, files, maxFiles);

  const chunks: CodeChunk[] = [];
  for (const file of files) {
    const ext = extensionOf(file);
    if (!TEXT_EXTENSIONS.has(ext)) continue;
    let raw: string;
    try {
      const st = statSync(file);
      if (!st.isFile() || st.size > maxFileBytes) continue;
      raw = readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    if (raw.includes("\u0000")) continue;

    const rel = path.relative(absRoot, file) || path.basename(file);
    const lines = raw.split(/\r?\n/);
    let start = 0;
    while (start < lines.length) {
      const end = Math.min(start + linesPerChunk, lines.length);
      const slice = lines.slice(start, end).join("\n");
      if (slice.trim().length > 0) {
        chunks.push({
          id: `${rel}#L${start + 1}-L${end}`,
          path: rel,
          startLine: start + 1,
          endLine: end,
          text: slice,
        });
      }
      if (end >= lines.length) break;
      start = Math.max(0, end - lineOverlap);
    }
  }
  return chunks;
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9_./-]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/**
 * Rank chunks by overlap between query tokens and chunk text (cheap "RAG").
 */
export function retrieveChunks(query: string, chunks: CodeChunk[], topK: number): CodeChunk[] {
  const qTokens = new Set(tokenize(query));
  if (qTokens.size === 0) return chunks.slice(0, topK);

  const scored = chunks.map((c) => {
    const cTokens = tokenize(c.text);
    let score = 0;
    const seen = new Set<string>();
    for (const t of cTokens) {
      if (qTokens.has(t) && !seen.has(t)) {
        seen.add(t);
        score += 1;
      }
    }
    // Boost README / package / agent-ish paths
    const p = c.path.toLowerCase();
    if (p.includes("readme")) score += 2;
    if (p.endsWith("package.json")) score += 2;
    if (p.includes("agent") || p.includes("skill")) score += 1;
    return { c, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.filter((x) => x.score > 0).slice(0, topK).map((x) => x.c);
}

export function buildRagContext(queries: string[], chunks: CodeChunk[], perQueryTop: number): string {
  const seen = new Set<string>();
  const picked: CodeChunk[] = [];
  for (const q of queries) {
    for (const ch of retrieveChunks(q, chunks, perQueryTop)) {
      if (seen.has(ch.id)) continue;
      seen.add(ch.id);
      picked.push(ch);
    }
  }
  const parts: string[] = [];
  for (const ch of picked) {
    parts.push(`### ${ch.id}\n\`\`\`\n${ch.text.slice(0, 6000)}\n\`\`\`\n`);
  }
  return parts.join("\n");
}
