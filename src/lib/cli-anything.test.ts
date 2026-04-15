import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { CliAnythingGenerationError, runCliAnything } from "./cli-anything.js";

const originalCommand = process.env.CLI_ANYTHING_COMMAND;
const originalArgs = process.env.CLI_ANYTHING_ARGS;

afterEach(() => {
  if (originalCommand === undefined) {
    delete process.env.CLI_ANYTHING_COMMAND;
  } else {
    process.env.CLI_ANYTHING_COMMAND = originalCommand;
  }
  if (originalArgs === undefined) {
    delete process.env.CLI_ANYTHING_ARGS;
  } else {
    process.env.CLI_ANYTHING_ARGS = originalArgs;
  }
});

describe("runCliAnything", () => {
  test("auto-generates harness artifacts through configured subprocess", async () => {
    const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "gitgod-cli-anything-"));
    const repoPath = path.join(tmpRoot, "repo");
    const generatorPath = path.join(tmpRoot, "generate-harness.js");

    mkdirSync(repoPath, { recursive: true });
    writeFileSync(
      generatorPath,
      `
const fs = require("node:fs");
const path = require("node:path");
const repoPath = process.argv[2];
const harnessDir = path.join(repoPath, "agent-harness", "cli_anything", "demo");
const skillsDir = path.join(harnessDir, "skills");
const testsDir = path.join(harnessDir, "tests");
fs.mkdirSync(skillsDir, { recursive: true });
fs.mkdirSync(testsDir, { recursive: true });
fs.writeFileSync(path.join(skillsDir, "SKILL.md"), "# Demo Skill\\n");
fs.writeFileSync(path.join(testsDir, "TEST.md"), "passed\\n");
fs.writeFileSync(path.join(harnessDir, "demo_cli.py"), "import click\\n@click.group()\\ndef cli():\\n    pass\\n\\n@cli.command()\\ndef hello():\\n    print('hi')\\n\\nif __name__ == '__main__':\\n    cli()\\n");
      `,
      "utf-8"
    );

    process.env.CLI_ANYTHING_COMMAND = JSON.stringify(["node", generatorPath, "{repoPath}"]);
    delete process.env.CLI_ANYTHING_ARGS;

    try {
      const result = await runCliAnything({ repoPath, cliAnythingRoot: tmpRoot });
      expect(result.mode).toBe("subprocess");
      expect(result.skillMdPath).toContain(path.join("skills", "SKILL.md"));
      expect(result.commands.length).toBeGreaterThan(0);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  test("does not silently reuse stale artifacts after generation failure", async () => {
    const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "gitgod-cli-anything-"));
    const repoPath = path.join(tmpRoot, "repo");

    mkdirSync(path.join(repoPath, "agent-harness", "cli_anything", "demo", "skills"), { recursive: true });
    writeFileSync(
      path.join(repoPath, "agent-harness", "cli_anything", "demo", "skills", "SKILL.md"),
      "# stale\n",
      "utf-8"
    );

    process.env.CLI_ANYTHING_COMMAND = JSON.stringify(["node", "-e", "process.exit(7)"]);
    delete process.env.CLI_ANYTHING_ARGS;

    try {
      await expect(runCliAnything({ repoPath, cliAnythingRoot: tmpRoot })).rejects.toBeInstanceOf(
        CliAnythingGenerationError
      );
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
