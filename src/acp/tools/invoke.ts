import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { CLICommand, InvokeToolInput, InvokeToolOutput } from "../../types.js";

interface HarnessCacheRecord {
  cliName: string;
  commands: CLICommand[];
  repoPath?: string;
  executable?: string;
}

const SLUG_RE = /^[a-z0-9-]+$/;
const TOKEN_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

function assertPathWithin(baseDir: string, candidatePath: string): string {
  const base = path.resolve(baseDir);
  const resolved = path.resolve(candidatePath);
  const rel = path.relative(base, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Path escapes allowed root: ${candidatePath}`);
  }
  return resolved;
}

function argsObjectToArgv(args: Record<string, string> | undefined): string[] {
  if (!args) return [];
  const out: string[] = [];
  for (const [key, value] of Object.entries(args)) {
    const normalizedKey = key.startsWith("-") ? key : `--${key}`;
    if (value === "true") {
      out.push(normalizedKey);
      continue;
    }
    out.push(normalizedKey, value);
  }
  return out;
}

function findCommand(commands: CLICommand[], requested: string): CLICommand {
  const lowered = requested.toLowerCase();
  const found =
    commands.find((c) => c.id.toLowerCase() === lowered) ??
    commands.find((c) => c.name.toLowerCase() === lowered) ??
    commands.find((c) => `${c.group ?? ""}.${c.name}`.toLowerCase() === lowered);
  if (!found) {
    throw new Error(`Unknown command '${requested}' for this tool.`);
  }
  return found;
}

function assertSafeToken(label: string, value: string): void {
  if (!TOKEN_RE.test(value)) {
    throw new Error(`Unsafe ${label} token '${value}'.`);
  }
}

export function invokeHarnessCommand(
  dataDir: string,
  input: InvokeToolInput
): InvokeToolOutput {
  if (!SLUG_RE.test(input.tool)) {
    throw new Error("Invalid tool slug. Allowed pattern: /^[a-z0-9-]+$/");
  }
  const cachePath = assertPathWithin(
    path.join(dataDir, "harnesses"),
    path.join(dataDir, "harnesses", `${input.tool}.json`)
  );
  if (!existsSync(cachePath)) {
    throw new Error(`Harness cache not found: ${cachePath}`);
  }

  const cache = JSON.parse(readFileSync(cachePath, "utf-8")) as HarnessCacheRecord;
  const command = findCommand(cache.commands, input.command);
  const executable = cache.cliName;
  assertSafeToken("executable", executable);
  if (cache.executable && cache.executable !== cache.cliName) {
    throw new Error("Cache executable override is not allowed.");
  }
  const resolvedCwd = process.cwd();

  const argv: string[] = [];
  if (command.group) {
    assertSafeToken("group", command.group);
    argv.push(command.group);
  }
  assertSafeToken("command", command.name);
  argv.push(command.name);
  argv.push(...argsObjectToArgv(input.args));
  if (!argv.includes("--json")) argv.push("--json");

  const run = spawnSync(executable, argv, {
    cwd: resolvedCwd,
    stdio: "pipe",
    encoding: "utf-8",
    timeout: 30_000,
    maxBuffer: 4 * 1024 * 1024,
  });

  const output: InvokeToolOutput = {
    exitCode: run.status ?? 1,
    stdout: run.stdout ?? "",
    stderr: run.stderr || undefined,
  };

  if ((run.status ?? 1) === 0) {
    const trimmed = (run.stdout ?? "").trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        output.json = JSON.parse(trimmed);
      } catch {
        // keep plain stdout when output is not valid JSON
      }
    }
  }

  return output;
}
