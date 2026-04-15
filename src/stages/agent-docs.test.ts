import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseAgentDocsOutput, runAgentDocs } from "./agent-docs.js";

describe("parseAgentDocsOutput", () => {
  it("parses git-style marker blocks", () => {
    const raw = `<<<<<<< SKILL.md
---
name: test-skill
description: "When testing"
---
# Skill
>>>>>>> SKILL.md
<<<<<<< AGENT.md
You are the test agent.
>>>>>>> AGENT.md`;
    const { skill, agent } = parseAgentDocsOutput(raw);
    expect(skill).toContain("name: test-skill");
    expect(agent.trim()).toBe("You are the test agent.");
  });

  it("parses legacy ---AGENT--- split", () => {
    const raw = `---SKILL---
skill body
---AGENT---
agent body`;
    const { skill, agent } = parseAgentDocsOutput(raw);
    expect(skill).toContain("skill body");
    expect(agent).toBe("agent body");
  });
});

describe("runAgentDocs dry-run", () => {
  it("writes meta and stub files without LLM", async () => {
    const repo = mkdtempSync(path.join(tmpdir(), "gitgod-agent-docs-"));
    writeFileSync(path.join(repo, "README.md"), "# Tiny\n\nCLI tool.\n");
    writeFileSync(path.join(repo, "package.json"), '{"name":"tiny"}');

    const dataDir = mkdtempSync(path.join(tmpdir(), "gitgod-data-"));
    const result = await runAgentDocs({
      repoPath: repo,
      dataDir,
      slug: "tiny-fixture",
      dryRun: true,
    });

    expect(result.metaPath).toContain("code-index-meta.json");
    expect(result.skillPath).toContain("SKILL.md");
    const fs = await import("node:fs");
    expect(fs.existsSync(result.metaPath)).toBe(true);
    expect(fs.readFileSync(result.skillPath, "utf-8")).toContain("tiny-fixture");
  });
});
