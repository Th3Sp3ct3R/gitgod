import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ingestHarness } from "./ingest.js";
import { invokeHarnessCommand } from "./invoke.js";

const TEST_ROOT = path.join(import.meta.dirname, "../../../.test-harness-tools");

function setup() {
  rmSync(TEST_ROOT, { recursive: true, force: true });
  mkdirSync(TEST_ROOT, { recursive: true });
  mkdirSync(path.join(TEST_ROOT, "harnesses"), { recursive: true });
}

function cleanup() {
  rmSync(TEST_ROOT, { recursive: true, force: true });
}

describe("harness ACP tools", () => {
  beforeEach(() => setup());
  afterEach(() => cleanup());

  it("ingest merges harness commands into knowledge graph", () => {
    const slug = "instagrowth-saas";
    const repoDir = path.join(TEST_ROOT, slug);
    mkdirSync(repoDir, { recursive: true });
    writeFileSync(
      path.join(repoDir, "knowledge-graph.json"),
      JSON.stringify({
        repo: "instagrowth-saas",
        url: "https://example.com/instagrowth-saas",
        scraped_at: "2026-01-01T00:00:00Z",
        stats: { categories: 0, links: 0 },
        taxonomy: [],
      })
    );

    const skillPath = path.join(TEST_ROOT, "SKILL.md");
    writeFileSync(skillPath, "---\ndescription: Sample harness skill\n---\n");

    writeFileSync(
      path.join(TEST_ROOT, "harnesses", `${slug}.json`),
      JSON.stringify({
        cliName: "cli-anything-instagrowth-saas",
        skillMdPath: skillPath,
        commands: [
          {
            id: "project.deploy",
            name: "deploy",
            group: "project",
            supportsJson: true,
          },
        ],
        workflows: [],
      })
    );

    const result = ingestHarness(TEST_ROOT, { slug });
    expect(result.ok).toBe(true);

    const graph = JSON.parse(
      readFileSync(path.join(repoDir, "knowledge-graph.json"), "utf-8")
    ) as {
      taxonomy: Array<{ category: string; tools: Array<{ name: string }> }>;
    };
    expect(graph.taxonomy.some((c) => c.category === "Harness / CLI")).toBe(true);
    expect(graph.taxonomy.flatMap((c) => c.tools).some((t) => t.name.includes("deploy"))).toBe(true);
  });

  it("invoke executes allowlisted command from harness cache", () => {
    const slug = "instagrowth-saas";
    const fakeBinDir = path.join(TEST_ROOT, "bin");
    mkdirSync(fakeBinDir, { recursive: true });
    const fakeCli = path.join(fakeBinDir, "cli-anything-instagrowth-saas");
    writeFileSync(
      fakeCli,
      "#!/usr/bin/env bash\nprintf '{\"ok\":true,\"cmd\":\"%s\"}' \"$1\"\n"
    );
    chmodSync(fakeCli, 0o755);
    const oldPath = process.env.PATH || "";
    process.env.PATH = `${fakeBinDir}:${oldPath}`;

    try {
      writeFileSync(
        path.join(TEST_ROOT, "harnesses", `${slug}.json`),
        JSON.stringify({
          cliName: "cli-anything-instagrowth-saas",
          repoPath: TEST_ROOT,
          commands: [
            {
              id: "project.deploy",
              name: "deploy",
              group: "project",
              supportsJson: true,
            },
          ],
        })
      );

      const result = invokeHarnessCommand(TEST_ROOT, {
        tool: slug,
        command: "project.deploy",
      });

      expect(result.exitCode).toBe(0);
      expect(result.json).toEqual({ ok: true, cmd: "project" });
    } finally {
      process.env.PATH = oldPath;
    }
  });
});
