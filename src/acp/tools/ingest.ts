import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { CLICommand, WorkflowChain } from "../../types.js";
import { parseHarnessToGraph } from "../../parsers/harness-parser.js";
import { mergeHarnessIntoGraph } from "../../stages/ingest-single.js";

export interface IngestParams {
  slug: string;
  harness_json_path?: string;
}

export interface IngestResult {
  ok: boolean;
  slug: string;
  graphPath: string;
  commands: number;
}

interface HarnessCacheRecord {
  cliName: string;
  commands: CLICommand[];
  workflows?: WorkflowChain[];
  skillMdPath: string;
}

const SLUG_RE = /^[a-z0-9-]+$/;

function assertPathWithin(baseDir: string, candidatePath: string): string {
  const base = path.resolve(baseDir);
  const resolved = path.resolve(candidatePath);
  const rel = path.relative(base, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Path escapes allowed root: ${candidatePath}`);
  }
  return resolved;
}

export function ingestHarness(dataDir: string, params: IngestParams): IngestResult {
  if (!SLUG_RE.test(params.slug)) {
    throw new Error("Invalid slug. Allowed pattern: /^[a-z0-9-]+$/");
  }
  const harnessRoot = path.join(dataDir, "harnesses");
  const cachePath = params.harness_json_path
    ? assertPathWithin(harnessRoot, params.harness_json_path)
    : assertPathWithin(harnessRoot, path.join(harnessRoot, `${params.slug}.json`));

  if (!existsSync(cachePath)) {
    throw new Error(`Harness cache path not found: ${cachePath}`);
  }

  const cache = JSON.parse(readFileSync(cachePath, "utf-8")) as HarnessCacheRecord;
  const safeSkillPath = assertPathWithin(path.resolve(dataDir), cache.skillMdPath);
  const parsed = parseHarnessToGraph(
    cache.cliName,
    cache.commands ?? [],
    cache.workflows ?? [],
    safeSkillPath
  );
  const graphPath = mergeHarnessIntoGraph(dataDir, params.slug, parsed);

  return {
    ok: true,
    slug: params.slug,
    graphPath,
    commands: cache.commands?.length ?? 0,
  };
}
