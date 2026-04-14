import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { auditStarred, normalizeRepoIdentifier } from "./audit-starred.js";

describe("normalizeRepoIdentifier", () => {
  it("normalizes full names and GitHub URLs", () => {
    expect(normalizeRepoIdentifier("0xNyk/langchain")).toBe("0xnyk/langchain");
    expect(normalizeRepoIdentifier("https://github.com/0xNyk/Flowise")).toBe("0xnyk/flowise");
    expect(normalizeRepoIdentifier("https://github.com/0xNyk/Flowise.git")).toBe("0xnyk/flowise");
  });

  it("returns null for invalid identifiers", () => {
    expect(normalizeRepoIdentifier("")).toBeNull();
    expect(normalizeRepoIdentifier("not-a-repo")).toBeNull();
  });
});

describe("auditStarred", () => {
  it("audits starred vs ingested repos and writes report", () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "gitgod-audit-"));
    try {
      const dataDir = path.join(tempRoot, "data");
      const slugA = "0xnyk-langchain";
      const slugB = "0xnyk-repomix";
      mkdirSync(path.join(dataDir, slugA), { recursive: true });
      mkdirSync(path.join(dataDir, slugB), { recursive: true });

      writeFileSync(
        path.join(dataDir, slugA, "knowledge-graph.json"),
        JSON.stringify({
          repo: "0xNyk/langchain",
          url: "https://github.com/0xNyk/langchain",
          scraped_at: new Date().toISOString(),
          stats: { categories: 1, links: 1 },
          taxonomy: [],
        })
      );
      writeFileSync(
        path.join(dataDir, slugA, ".enrich-progress.json"),
        JSON.stringify({
          total: 10,
          completed: 10,
          failed: 0,
          dead: 0,
          skipped: 0,
          last_index: 9,
        })
      );
      writeFileSync(
        path.join(dataDir, slugB, "skeleton.json"),
        JSON.stringify({
          repo: "0xNyk/repomix",
          url: "https://github.com/0xNyk/repomix",
          scraped_at: new Date().toISOString(),
          stats: { categories: 1, links: 1 },
          taxonomy: [],
        })
      );

      const starredFile = path.join(tempRoot, "starred.txt");
      writeFileSync(
        starredFile,
        [
          "https://github.com/0xNyk/langchain",
          "0xNyk/Flowise",
        ].join("\n")
      );

      const reportPath = path.join(tempRoot, "audit.md");
      const { result, outputPath } = auditStarred({
        dataDir,
        starredFilePath: starredFile,
        outputPath: reportPath,
      });

      expect(result.source).toBe("file");
      expect(result.starred_total).toBe(2);
      expect(result.ingested_total).toBe(1);
      expect(result.overlap_total).toBe(1);
      expect(result.missing_in_ingested).toEqual(["0xnyk/flowise"]);
      expect(result.ingested_not_starred).toEqual([]);
      expect(result.pipeline.length).toBe(2);
      expect(result.pipeline.find((p) => p.slug === slugA)?.stage).toBe("synthesized");
      expect(result.pipeline.find((p) => p.slug === slugB)?.stage).toBe("parsed");
      expect(result.pipeline.find((p) => p.slug === slugA)?.queue?.status).toBe("complete");

      expect(outputPath).toBe(reportPath);
      expect(existsSync(reportPath)).toBe(true);
      const report = readFileSync(reportPath, "utf-8");
      expect(report).toContain("GitGod Starred vs Ingested Audit");
      expect(report).toContain("0xnyk/flowise");
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
