import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { harness } from "./harness.js";
import type { DecomposeResult } from "../types.js";

function makeDecomposition(): DecomposeResult {
  return {
    repo: "owner/repo",
    url: "https://github.com/owner/repo",
    generated_at: new Date().toISOString(),
    categories: ["Automation", "Automation > Export"],
    operations: [
      {
        id: "op-automation-import",
        title: "Import",
        category: "Automation",
        kind: "script",
        source_tool_name: "Import",
        source_url: "https://example.com/import",
        evidence: ["https://example.com/import"],
        tags: ["import"],
      },
      {
        id: "op-automation-export",
        title: "Export",
        category: "Automation",
        kind: "script",
        source_tool_name: "Export",
        source_url: "https://example.com/export",
        evidence: ["https://example.com/export"],
        tags: ["export"],
      },
    ],
    stats: {
      operations: 2,
      categories: 2,
    },
  };
}

describe("harness", () => {
  test("falls back when agent-harness is missing", async () => {
    const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "gitgod-harness-"));
    const repoPath = path.join(tmpRoot, "repo");
    const dataDir = path.join(tmpRoot, "data");
    const outputDir = path.join(tmpRoot, "harnesses");

    try {
      const result = await harness({
        slug: "repo",
        repoPath,
        decomposition: makeDecomposition(),
        dataDir,
        outputDir,
        discoveryManifestPath: false,
        workflowMapPath: false,
      });

      expect(result.status).toBe("decomposed_no_harness");
      expect(result.fallbackReason).toContain("No agent-harness directory found");
      expect(result.workflows.length).toBeGreaterThan(0);
      expect(result.skillMdPath).toContain("FALLBACK.md");
      expect(result.cachePath).toContain(path.join("harnesses", "repo.json"));
      expect(result.workflowPath).toContain(path.join("harnesses", "repo", "workflows.json"));
      expect(result.skillMdPath).toBeDefined();
      expect(result.workflowPath).toBeDefined();
      expect(existsSync(result.skillMdPath!)).toBe(true);
      expect(existsSync(result.workflowPath!)).toBe(true);

      const fallbackDoc = readFileSync(result.skillMdPath!, "utf-8");
      expect(fallbackDoc).toContain("decomposed_no_harness");
      expect(fallbackDoc).toContain("checkout path");
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
