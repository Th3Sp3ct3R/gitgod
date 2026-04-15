import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { DecomposeResult, HarnessConfig, HarnessResult, WorkflowChain } from "../types.js";
import {
  CliAnythingGenerationError,
  MissingHarnessArtifactsError,
  runCliAnything,
} from "../lib/cli-anything.js";
import { parseHarnessToGraph } from "../parsers/harness-parser.js";
import { mergeHarnessIntoGraph } from "./ingest-single.js";

function repoSlug(repoPath: string): string {
  return path.basename(repoPath).toLowerCase();
}

function readTextOrEmpty(filePath: string): string {
  if (!existsSync(filePath)) return "";
  return readFileSync(filePath, "utf-8");
}

function upsertMarkdownSection(filePath: string, key: string, section: string): void {
  const begin = `<!-- BEGIN:${key} -->`;
  const end = `<!-- END:${key} -->`;
  const current = readTextOrEmpty(filePath);
  const wrapped = `${begin}\n${section.trim()}\n${end}`;
  const pattern = new RegExp(`${begin}[\\s\\S]*?${end}`, "m");

  const next = pattern.test(current)
    ? current.replace(pattern, wrapped)
    : `${current.trim()}\n\n${wrapped}\n`.trimStart();

  writeFileSync(filePath, `${next}\n`);
}

function classifyOperations(decomposition: DecomposeResult): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const op of decomposition.operations) {
    counts[op.kind] = (counts[op.kind] ?? 0) + 1;
  }
  return counts;
}

function buildManifestSection(slug: string, decomposition: DecomposeResult): string {
  const counts = classifyOperations(decomposition);
  const lines: string[] = [];
  lines.push(`## ${slug}`);
  lines.push("");
  lines.push(`Source repo: \`${decomposition.repo}\``);
  lines.push("");
  lines.push("### Operation Inventory");
  lines.push("");
  lines.push("| Kind | Count |");
  lines.push("| --- | ---: |");
  for (const [kind, count] of Object.entries(counts)) {
    lines.push(`| \`${kind}\` | ${count} |`);
  }
  lines.push("");
  lines.push("### Seed Operations");
  lines.push("");
  lines.push("| ID | Title | Category | Kind |");
  lines.push("| --- | --- | --- | --- |");
  for (const op of decomposition.operations.slice(0, 100)) {
    lines.push(`| \`${op.id}\` | ${op.title} | ${op.category} | \`${op.kind}\` |`);
  }
  if (decomposition.operations.length > 100) {
    lines.push(`| ... | ... | ... | ... (${decomposition.operations.length - 100} more) |`);
  }
  return lines.join("\n");
}

function buildWorkflowCandidates(decomposition: DecomposeResult): WorkflowChain[] {
  const grouped = new Map<string, string[]>();
  for (const op of decomposition.operations) {
    const key = op.category;
    const list = grouped.get(key) ?? [];
    list.push(op.id);
    grouped.set(key, list);
  }

  const workflows: WorkflowChain[] = [];
  let idx = 0;
  for (const [category, opIds] of grouped.entries()) {
    if (opIds.length < 2) continue;
    const steps = opIds.slice(0, 3).map((commandId, i) => ({
      commandId,
      inputFromStep: i === 0 ? undefined : i - 1,
      note: i === 0 ? "seed command" : "consumes previous JSON output",
    }));
    workflows.push({
      id: `workflow-${idx++}-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      title: `${category} pipeline`,
      description: `Composable workflow generated from decomposition category ${category}.`,
      steps,
    });
  }
  return workflows;
}

function buildWorkflowMapSection(slug: string, workflows: WorkflowChain[]): string {
  const lines: string[] = [];
  lines.push(`## ${slug}`);
  lines.push("");
  if (workflows.length === 0) {
    lines.push("No composable workflows inferred.");
    return lines.join("\n");
  }

  for (const workflow of workflows) {
    lines.push(`### ${workflow.title} (\`${workflow.id}\`)`);
    lines.push(workflow.description);
    lines.push("");
    for (const [i, step] of workflow.steps.entries()) {
      const dep = step.inputFromStep === undefined ? "none" : `step ${step.inputFromStep + 1}`;
      lines.push(`${i + 1}. \`${step.commandId}\` (input: ${dep})`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function writeWorkflowArtifact(artifactDir: string, workflows: WorkflowChain[]): string {
  const workflowPath = path.join(artifactDir, "workflows.json");
  writeFileSync(workflowPath, JSON.stringify(workflows, null, 2));
  return workflowPath;
}

function writeHarnessCache(cachePath: string, payload: Record<string, unknown>): string {
  writeFileSync(cachePath, JSON.stringify(payload, null, 2));
  return cachePath;
}

function buildFallbackSummary(config: HarnessConfig, slug: string, workflows: WorkflowChain[], reason: string): string {
  const lines: string[] = [];
  lines.push(`# ${slug} fallback harness`);
  lines.push("");
  lines.push("status: `decomposed_no_harness`");
  lines.push("");
  lines.push(`reason: ${reason}`);
  lines.push("");
  lines.push(`repo: \`${config.decomposition.repo}\``);
  lines.push(`checkout path: \`${config.repoPath}\``);
  if (config.decompositionPath) {
    lines.push(`decomposition path: \`${config.decompositionPath}\``);
  }
  lines.push("");
  lines.push(`inferred workflows: ${workflows.length}`);
  if (workflows.length > 0) {
    lines.push("");
    lines.push("## Workflow IDs");
    lines.push("");
    for (const workflow of workflows) {
      lines.push(`- \`${workflow.id}\` — ${workflow.title}`);
    }
  }
  return lines.join("\n");
}

function buildFallbackResult(
  config: HarnessConfig,
  slug: string,
  artifactDir: string,
  cachePath: string,
  workflows: WorkflowChain[],
  reason: string
): HarnessResult {
  const fallbackDocPath = path.join(artifactDir, "FALLBACK.md");
  writeFileSync(fallbackDocPath, `${buildFallbackSummary(config, slug, workflows, reason)}\n`);
  const workflowPath = writeWorkflowArtifact(artifactDir, workflows);

  writeHarnessCache(cachePath, {
    status: "decomposed_no_harness",
    cliName: `fallback-${slug}`,
    repoPath: config.repoPath,
    decompositionPath: config.decompositionPath,
    skillMdPath: fallbackDocPath,
    workflowPath,
    workflows,
    commands: [],
    testResults: { passed: 0, failed: 0 },
    fallbackReason: reason,
  });

  return {
    status: "decomposed_no_harness",
    cliName: `fallback-${slug}`,
    commands: [],
    skillMdPath: fallbackDocPath,
    testResults: { passed: 0, failed: 0 },
    workflows,
    cachePath,
    workflowPath,
    fallbackReason: reason,
  };
}

function shouldFallbackFromHarnessError(error: unknown): boolean {
  return error instanceof MissingHarnessArtifactsError || error instanceof CliAnythingGenerationError;
}

export async function harness(config: HarnessConfig): Promise<HarnessResult> {
  const slug = config.slug ?? repoSlug(config.repoPath);
  const rootDir = process.cwd();
  const dataDir = path.resolve(rootDir, config.dataDir ?? "data");
  const outputDir = path.resolve(rootDir, config.outputDir ?? path.join(dataDir, "harnesses"));
  mkdirSync(outputDir, { recursive: true });
  const workflows = buildWorkflowCandidates(config.decomposition);
  const artifactDir = path.join(outputDir, slug);
  const cachePath = path.join(outputDir, `${slug}.json`);
  mkdirSync(artifactDir, { recursive: true });

  let result: HarnessResult;
  try {
    const artifacts = await runCliAnything({
      repoPath: config.repoPath,
      refineFocus: config.refineFocus,
      autoGenerate: true,
    });
    const localSkillMdPath = path.join(artifactDir, "SKILL.md");
    copyFileSync(artifacts.skillMdPath, localSkillMdPath);
    const localTestMdPath = artifacts.testMdPath ? path.join(artifactDir, "TEST.md") : undefined;
    if (artifacts.testMdPath && localTestMdPath) {
      copyFileSync(artifacts.testMdPath, localTestMdPath);
    }

    const parserResult = parseHarnessToGraph(
      artifacts.cliName,
      artifacts.commands,
      workflows,
      localSkillMdPath
    );

    const mergedGraphPath = mergeHarnessIntoGraph(dataDir, slug, parserResult);
    const workflowPath = writeWorkflowArtifact(artifactDir, workflows);

    const testRaw = localTestMdPath ? readTextOrEmpty(localTestMdPath) : "";
    const passed = (testRaw.match(/\bpass(?:ed)?\b/gi) ?? []).length;
    const failed = (testRaw.match(/\bfail(?:ed)?\b/gi) ?? []).length;

    result = {
      status: "harnessed",
      cliName: artifacts.cliName,
      commands: artifacts.commands,
      skillMdPath: localSkillMdPath,
      testResults: { passed, failed },
      workflows,
      cachePath,
      workflowPath,
    };

    writeHarnessCache(cachePath, {
      ...result,
      repoPath: config.repoPath,
      decompositionPath: config.decompositionPath,
      harnessDir: artifacts.harnessDir,
      graphPath: mergedGraphPath,
      testMdPath: localTestMdPath,
      mode: artifacts.mode,
    });
  } catch (error) {
    if (config.allowFallback === false || !shouldFallbackFromHarnessError(error)) {
      throw error;
    }
    const reason = error instanceof Error ? error.message : String(error);
    result = buildFallbackResult(config, slug, artifactDir, cachePath, workflows, reason);
  }

  const manifestPath =
    config.discoveryManifestPath === false
      ? false
      : path.resolve(rootDir, config.discoveryManifestPath ?? "CLI_DISCOVERY_MANIFEST.md");
  const workflowMapPath =
    config.workflowMapPath === false
      ? false
      : path.resolve(rootDir, config.workflowMapPath ?? "WORKFLOW_MAP.md");
  const manifestSection = buildManifestSection(slug, config.decomposition);
  const workflowSection = buildWorkflowMapSection(slug, workflows);
  if (manifestPath) {
    upsertMarkdownSection(manifestPath, slug, manifestSection);
  }
  if (workflowMapPath) {
    upsertMarkdownSection(workflowMapPath, slug, workflowSection);
  }

  return result;
}
