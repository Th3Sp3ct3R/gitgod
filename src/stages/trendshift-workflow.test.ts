import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  extractTrendshiftRepos,
  mapTrendshiftTopics,
  scrapeTrendshiftTopicMarkdown,
} from "./trendshift-workflow.js";

describe("trendshift workflow", () => {
  it("maps topic urls from the Trendshift topics index", async () => {
    const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "gitgod-trendshift-map-"));

    try {
      const result = await mapTrendshiftTopics("https://trendshift.io/topics", {
        outputDir: tmpRoot,
        mapUrls: () => [
          "https://trendshift.io/topics",
          "https://trendshift.io/topics/ai-agent",
          "https://trendshift.io/topics/ai-agent/",
          "https://trendshift.io/topics/mcp",
          "https://trendshift.io/repositories/123",
          "https://trendshift.io/topics/ai-agent",
        ],
      });

      expect(result.topics).toEqual([
        "https://trendshift.io/topics/ai-agent",
        "https://trendshift.io/topics/mcp",
      ]);
      expect(readFileSync(result.outputPath, "utf-8")).toContain("ai-agent");
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("maps topic urls from Firecrawl-style link objects", async () => {
    const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "gitgod-trendshift-map-"));

    try {
      const result = await mapTrendshiftTopics("https://trendshift.io/topics", {
        outputDir: tmpRoot,
        mapUrls: () => [
          { url: "https://trendshift.io/topics/ai-agent", title: "AI agent" } as unknown as string,
          { url: "https://trendshift.io/topics/mcp", title: "MCP" } as unknown as string,
          { url: "https://trendshift.io/topics", title: "Topics" } as unknown as string,
        ],
      });

      expect(result.topics).toEqual([
        "https://trendshift.io/topics/ai-agent",
        "https://trendshift.io/topics/mcp",
      ]);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("scrapes topic markdown to disk without parsing it yet", async () => {
    const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "gitgod-trendshift-scrape-"));

    try {
      const result = await scrapeTrendshiftTopicMarkdown("https://trendshift.io/topics/ai-agent", {
        outputDir: tmpRoot,
        scrapeMarkdown: () => "# AI agent\n\n[foo/bar](https://trendshift.io/repositories/1)",
      });

      expect(result.markdownPath).toBe(path.join(tmpRoot, "topic.md"));
      expect(readFileSync(result.markdownPath, "utf-8")).toContain("# AI agent");
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("extracts repos from a scraped topic markdown file", async () => {
    const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "gitgod-trendshift-extract-"));

    try {
      const markdownPath = path.join(tmpRoot, "topic.md");
      writeFileSync(
        markdownPath,
        `# AI agent

[foo/bar](https://trendshift.io/repositories/1)

TypeScript

123

4

[GitHub](https://github.com/foo/bar)

[#AI agent](https://trendshift.io/topics/ai-agent)

Example repo`,
        "utf-8"
      );

      const result = await extractTrendshiftRepos(markdownPath, "https://trendshift.io/topics/ai-agent", {
        outputDir: tmpRoot,
      });

      expect(result.repos).toHaveLength(1);
      expect(result.repos[0]).toMatchObject({
        repoName: "foo/bar",
        githubUrl: "https://github.com/foo/bar",
        language: "TypeScript",
        metrics: [123, 4],
      });
      expect(readFileSync(result.outputPath, "utf-8")).toContain("\"foo/bar\"");
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
