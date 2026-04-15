import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CLICommand } from "../types.js";

export interface CliAnythingRunConfig {
  repoPath: string;
  refineFocus?: string;
  cliAnythingRoot?: string;
  autoGenerate?: boolean;
}

export interface CliAnythingArtifacts {
  cliName: string;
  commands: CLICommand[];
  skillMdPath: string;
  testMdPath?: string;
  harnessDir: string;
  rawPaths: string[];
  mode: "consume" | "subprocess";
}

export class MissingHarnessArtifactsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingHarnessArtifactsError";
  }
}

export class CliAnythingGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliAnythingGenerationError";
  }
}

function walkFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const entry of readdirSync(current)) {
      const full = path.join(current, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        stack.push(full);
      } else {
        out.push(full);
      }
    }
  }
  return out;
}

function resolveCliAnythingRoot(root?: string): string {
  if (root) return root;
  return path.resolve(process.cwd(), "agent-frameworks", "CLI-Anything");
}

function pickPythonBinary(): string {
  const candidates = ["python3", "python"];
  for (const candidate of candidates) {
    const check = spawnSync(candidate, ["--version"], { stdio: "pipe", encoding: "utf-8" });
    if (check.status === 0) return candidate;
  }
  throw new Error("Could not find python3/python in PATH for CLI help extraction.");
}

function parseClickCommands(helpText: string): Array<{ name: string; description?: string }> {
  const lines = helpText.split("\n");
  const commands: Array<{ name: string; description?: string }> = [];
  let inCommandsSection = false;
  for (const line of lines) {
    if (/^\s*Commands:\s*$/i.test(line)) {
      inCommandsSection = true;
      continue;
    }
    if (!inCommandsSection) continue;
    if (!line.trim()) continue;
    if (!/^\s{2,}/.test(line)) break;
    const m = line.match(/^\s{2,}([a-zA-Z0-9_-]+)\s{2,}(.*)$/);
    if (!m) continue;
    commands.push({ name: m[1], description: m[2]?.trim() || undefined });
  }
  return commands;
}

function uniqueCommands(commands: CLICommand[]): CLICommand[] {
  const seen = new Set<string>();
  const out: CLICommand[] = [];
  for (const cmd of commands) {
    if (seen.has(cmd.id)) continue;
    seen.add(cmd.id);
    out.push(cmd);
  }
  return out;
}

function extractCommandsFromCliScripts(cliScripts: string[]): CLICommand[] {
  if (cliScripts.length === 0) return [];
  const pythonBin = pickPythonBinary();
  const commands: CLICommand[] = [];

  for (const scriptPath of cliScripts) {
    const groupName = path.basename(scriptPath).replace(/_cli\.py$/, "");
    const help = spawnSync(pythonBin, [scriptPath, "--help"], {
      stdio: "pipe",
      encoding: "utf-8",
    });

    if (help.status !== 0) {
      commands.push({
        id: `${groupName}.root`,
        name: groupName,
        group: groupName,
        description: "Generated command group (help invocation failed; discovered from script file).",
        args: ["--json"],
        supportsJson: true,
      });
      continue;
    }

    const rootStdout = help.stdout ?? "";
    const parsed = parseClickCommands(rootStdout);
    if (parsed.length === 0) {
      commands.push({
        id: `${groupName}.root`,
        name: groupName,
        group: groupName,
        description: "Generated command group.",
        args: ["--json"],
        supportsJson: true,
      });
      continue;
    }

    for (const entry of parsed) {
      commands.push({
        id: `${groupName}.${entry.name}`,
        name: entry.name,
        group: groupName,
        description: entry.description,
        args: ["--json"],
        supportsJson: true,
      });
    }
  }

  return uniqueCommands(commands);
}

function substituteTemplate(template: string, config: CliAnythingRunConfig): string {
  return template
    .replaceAll("{repoPath}", config.repoPath)
    .replaceAll("{refineFocus}", config.refineFocus ?? "");
}

function parseCommandSpec(spec: string): string[] {
  const trimmed = spec.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed) || !parsed.every((v) => typeof v === "string")) {
      throw new Error("CLI_ANYTHING_COMMAND JSON form must be an array of strings.");
    }
    return parsed;
  }
  return trimmed.split(/\s+/).filter(Boolean);
}

function runCliAnythingSubprocess(config: CliAnythingRunConfig): boolean {
  const commandSpec = process.env.CLI_ANYTHING_COMMAND;
  if (!commandSpec) return false;

  const tokens = parseCommandSpec(commandSpec).map((token) => substituteTemplate(token, config));
  const extraArgsSpec = process.env.CLI_ANYTHING_ARGS;
  const extraArgs = extraArgsSpec
    ? parseCommandSpec(extraArgsSpec).map((token) => substituteTemplate(token, config))
    : [];

  const [bin, ...baseArgs] = tokens;
  if (!bin) {
    throw new Error("CLI_ANYTHING_COMMAND is empty after parsing.");
  }

  const run = spawnSync(bin, [...baseArgs, ...extraArgs], {
    cwd: resolveCliAnythingRoot(config.cliAnythingRoot),
    stdio: "pipe",
    encoding: "utf-8",
    env: process.env,
  });
  if (run.status !== 0) {
    throw new Error(
      `CLI_ANYTHING_COMMAND failed (${run.status}). stderr: ${(run.stderr ?? "").trim()}`
    );
  }
  return true;
}

function hasConfiguredCliAnythingCommand(): boolean {
  return Boolean(process.env.CLI_ANYTHING_COMMAND?.trim());
}

function inferCliName(repoPath: string): string {
  return `cli-anything-${path.basename(repoPath)}`;
}

export async function parseCliAnythingArtifacts(repoPath: string): Promise<CliAnythingArtifacts> {
  const harnessDir = path.join(repoPath, "agent-harness");
  if (!existsSync(harnessDir)) {
    throw new MissingHarnessArtifactsError(`No agent-harness directory found at ${harnessDir}.`);
  }

  const files = walkFiles(harnessDir);
  const skillCandidates = files.filter((f) => /(?:^|\/)SKILL\.md$/i.test(f));
  const skillMdPath =
    skillCandidates.find((f) => /\/skills\/SKILL\.md$/i.test(f)) ?? skillCandidates[0];
  if (!skillMdPath) {
    throw new MissingHarnessArtifactsError(`No SKILL.md found under ${harnessDir}.`);
  }

  const testMdPath = files.find((f) => /(?:^|\/)TEST\.md$/i.test(f));
  const cliScripts = files.filter((f) => /_cli\.py$/i.test(f));
  const commands = extractCommandsFromCliScripts(cliScripts);

  return {
    cliName: inferCliName(repoPath),
    commands,
    skillMdPath,
    testMdPath,
    harnessDir,
    rawPaths: files,
    mode: "consume",
  };
}

export async function runCliAnything(config: CliAnythingRunConfig): Promise<CliAnythingArtifacts> {
  const autoGenerate = config.autoGenerate ?? true;

  if (autoGenerate && hasConfiguredCliAnythingCommand()) {
    try {
      runCliAnythingSubprocess(config);
    } catch (generationError) {
      const message = generationError instanceof Error ? generationError.message : String(generationError);
      throw new CliAnythingGenerationError(`CLI-Anything generation failed: ${message}`);
    }
    const generatedArtifacts = await parseCliAnythingArtifacts(config.repoPath);
    await readFile(generatedArtifacts.skillMdPath, "utf-8");
    return { ...generatedArtifacts, mode: "subprocess" };
  }

  const artifacts = await parseCliAnythingArtifacts(config.repoPath);
  await readFile(artifacts.skillMdPath, "utf-8");
  return artifacts;
}
