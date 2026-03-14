// src/stages/clone-parse.ts
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { parseReadme } from "../parsers/markdown-ast.js";

export async function cloneAndParse(url: string): Promise<string> {
  // Extract repo name from URL
  const match = url.match(/github\.com\/([^/]+\/[^/]+)/);
  if (!match) throw new Error(`Invalid GitHub URL: ${url}`);
  const repoName = match[1].replace(/\.git$/, "");
  const repoSlug = repoName.replace("/", "-");

  console.log(`[Stage 1] Parsing ${repoName}...`);

  // Create data directory
  const dataDir = path.resolve("data", repoSlug);
  mkdirSync(dataDir, { recursive: true });

  // Clone to temp directory
  const tmpDir = path.resolve(".tmp", repoSlug);
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  mkdirSync(path.dirname(tmpDir), { recursive: true });

  console.log(`  Cloning ${url}...`);
  execSync(`git clone --depth 1 ${url} ${tmpDir}`, { stdio: "pipe" });

  // Find README
  const readmePath = path.join(tmpDir, "README.md");
  if (!existsSync(readmePath)) {
    throw new Error(`No README.md found in ${url}`);
  }

  const markdown = readFileSync(readmePath, "utf-8");
  console.log(`  Parsing README.md (${markdown.length} chars)...`);

  // Parse
  const skeleton = parseReadme(markdown, repoName);

  // Write output
  const outputPath = path.join(dataDir, "skeleton.json");
  writeFileSync(outputPath, JSON.stringify(skeleton, null, 2));

  console.log(`  ${skeleton.stats.categories} categories, ${skeleton.stats.links} links`);
  console.log(`  -> ${outputPath}`);

  // Cleanup temp
  rmSync(tmpDir, { recursive: true });

  return outputPath;
}
