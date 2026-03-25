import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { DecomposeResult, HarnessConfig, HarnessResult, WorkflowChain } from "../types.js";
import { runCliAnything } from "../lib/cli-anything.js";
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

export async function harness(config: HarnessConfig): Promise<HarnessResult> {
  const slug = config.slug ?? repoSlug(config.repoPath);
  const rootDir = process.cwd();
  const dataDir = path.resolve(rootDir, config.dataDir ?? "data");
  const outputDir = path.resolve(rootDir, config.outputDir ?? path.join(dataDir, "harnesses"));
  mkdirSync(outputDir, { recursive: true });

  const artifacts = await runCliAnything({
    repoPath: config.repoPath,
    refineFocus: config.refineFocus,
  });
  const workflows = buildWorkflowCandidates(config.decomposition);
  const artifactDir = path.join(outputDir, slug);
  mkdirSync(artifactDir, { recursive: true });
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

  const testRaw = localTestMdPath ? readTextOrEmpty(localTestMdPath) : "";
  const passed = (testRaw.match(/\bpass(?:ed)?\b/gi) ?? []).length;
  const failed = (testRaw.match(/\bfail(?:ed)?\b/gi) ?? []).length;

  const result: HarnessResult = {
    cliName: artifacts.cliName,
    commands: artifacts.commands,
    skillMdPath: localSkillMdPath,
    testResults: { passed, failed },
    workflows,
  };

  const cachePath = path.join(outputDir, `${slug}.json`);
  writeFileSync(
    cachePath,
    JSON.stringify(
      {
        ...result,
        repoPath: config.repoPath,
        harnessDir: artifacts.harnessDir,
        graphPath: mergedGraphPath,
        testMdPath: localTestMdPath,
        mode: artifacts.mode,
      },
      null,
      2
    )
  );

  const manifestPath = path.resolve(rootDir, "CLI_DISCOVERY_MANIFEST.md");
  const workflowMapPath = path.resolve(rootDir, "WORKFLOW_MAP.md");
  const manifestSection = buildManifestSection(slug, config.decomposition);
  const workflowSection = buildWorkflowMapSection(slug, workflows);
  upsertMarkdownSection(manifestPath, slug, manifestSection);
  upsertMarkdownSection(workflowMapPath, slug, workflowSection);

  return result;
}
