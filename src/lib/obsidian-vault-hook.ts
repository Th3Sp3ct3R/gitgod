// Sync gitgod pipeline outputs into an Obsidian vault.
// Vault path resolved from GITGOD_OBSIDIAN_VAULT or OBSIDIAN_VAULT_PATH.
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

function expandUserPath(p: string): string {
  if (p.startsWith("~/")) return path.join(homedir(), p.slice(2));
  return p;
}

/** Resolved from GITGOD_OBSIDIAN_VAULT or OBSIDIAN_VAULT_PATH. */
export function getObsidianVaultRoot(): string | undefined {
  const raw = process.env.GITGOD_OBSIDIAN_VAULT || process.env.OBSIDIAN_VAULT_PATH;
  if (!raw?.trim()) return undefined;
  return path.resolve(expandUserPath(raw.trim()));
}

/** Path to packaged `docs/architecture` inside this repo (next to src/). */
export function getArchitectureDocsDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, "..", "..", "docs", "architecture");
}

/** Path to `data/` inside this repo. */
export function getDataDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, "..", "..", "data");
}

export type SyncResult =
  | { ok: true; copied: string[]; skipped: string[] }
  | { ok: false; reason: string };

// ─── Architecture docs (original minimal sync) ─────────────────────────────

const ARCH_FILES = ["README.md", "DATA-FLOW-ARC.md"] as const;

export type SyncArchitectureResult =
  | { ok: true; vaultArchitectureDir: string; copied: string[] }
  | { ok: false; reason: string };

/**
 * Copies `README.md` and `DATA-FLOW-ARC.md` into `<vault>/Architecture/`.
 * Repo remains canonical; vault gets a **copy** for Obsidian to open.
 */
export function syncArchitectureDocsToVault(vaultRoot: string): SyncArchitectureResult {
  const srcDir = getArchitectureDocsDir();
  if (!existsSync(srcDir)) {
    return { ok: false, reason: `missing docs dir: ${srcDir}` };
  }

  const destDir = path.join(vaultRoot, "Architecture");
  mkdirSync(destDir, { recursive: true });

  const copied: string[] = [];
  for (const name of ARCH_FILES) {
    const from = path.join(srcDir, name);
    if (!existsSync(from)) {
      return { ok: false, reason: `missing source file: ${from}` };
    }
    const to = path.join(destDir, name);
    copyFileSync(from, to);
    copied.push(to);
  }

  return { ok: true, vaultArchitectureDir: destDir, copied };
}

// ─── Full data sync ─────────────────────────────────────────────────────────

/**
 * Recursively copy all .md files from srcDir into destDir, preserving relative structure.
 */
function copyMdFiles(srcDir: string, destDir: string, copied: string[], skipped: string[]): void {
  if (!existsSync(srcDir)) return;
  const entries = readdirSync(srcDir);
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry);
    const st = statSync(srcPath);
    if (st.isDirectory()) {
      copyMdFiles(srcPath, path.join(destDir, entry), copied, skipped);
    } else if (entry.endsWith(".md") && st.isFile()) {
      mkdirSync(destDir, { recursive: true });
      const destPath = path.join(destDir, entry);
      try {
        copyFileSync(srcPath, destPath);
        copied.push(destPath);
      } catch {
        skipped.push(srcPath);
      }
    }
  }
}

/**
 * Sync all pipeline outputs into `<vault>/08-gitgod/`:
 *
 * - `08-gitgod/repos/<slug>/markdown/`  — map-scrape-markdown .md files
 * - `08-gitgod/repos/<slug>/agent-docs/` — SKILL.md + AGENT.md
 * - `08-gitgod/repos/<slug>/repo-analyzer.md` — standalone repo analysis
 * - `08-gitgod/architecture/`            — architecture docs (README + DATA-FLOW-ARC)
 *
 * Skips `checkouts/`, `node_modules/`, `.git/`, and non-.md files.
 */
export function syncAllToVault(vaultRoot: string): SyncResult {
  const dataDir = getDataDir();
  if (!existsSync(dataDir)) {
    return { ok: false, reason: `data dir not found: ${dataDir}` };
  }

  const vaultGitgod = path.join(vaultRoot, "08-gitgod", "repos");
  const copied: string[] = [];
  const skipped: string[] = [];

  // Skip directories that aren't pipeline output
  const SKIP_DIRS = new Set(["checkouts", "node_modules", ".git", "external", "harnesses"]);

  const slugs = readdirSync(dataDir).filter((entry) => {
    if (SKIP_DIRS.has(entry)) return false;
    const full = path.join(dataDir, entry);
    return statSync(full).isDirectory();
  });

  for (const slug of slugs) {
    const slugDir = path.join(dataDir, slug);

    // markdown/ subfolder (map-scrape-markdown output)
    const mdDir = path.join(slugDir, "markdown");
    if (existsSync(mdDir)) {
      copyMdFiles(mdDir, path.join(vaultGitgod, slug, "markdown"), copied, skipped);
    }

    // agent-docs/ subfolder (SKILL.md + AGENT.md)
    const agentDir = path.join(slugDir, "agent-docs");
    if (existsSync(agentDir)) {
      copyMdFiles(agentDir, path.join(vaultGitgod, slug, "agent-docs"), copied, skipped);
    }

    // Top-level .md files in the slug dir (e.g. repo-analyzer.md)
    const topFiles = readdirSync(slugDir).filter((f) => {
      const fp = path.join(slugDir, f);
      return f.endsWith(".md") && statSync(fp).isFile();
    });
    for (const f of topFiles) {
      mkdirSync(path.join(vaultGitgod, slug), { recursive: true });
      const dest = path.join(vaultGitgod, slug, f);
      try {
        copyFileSync(path.join(slugDir, f), dest);
        copied.push(dest);
      } catch {
        skipped.push(path.join(slugDir, f));
      }
    }
  }

  // Architecture docs
  const archResult = syncArchitectureDocsToVault(vaultRoot);
  if (archResult.ok) {
    copied.push(...archResult.copied);
  }

  return { ok: true, copied, skipped };
}
