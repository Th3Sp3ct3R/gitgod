import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { scrapeTrendshiftTopic } from "./trendshift-topic.js";

describe("scrapeTrendshiftTopic", () => {
  it("fails fast when scraping succeeds but no repos are extracted", async () => {
    const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "gitgod-trendshift-"));

    try {
      await expect(
        scrapeTrendshiftTopic("https://trendshift.io/topics/ai-agent", {
          outputDir: tmpRoot,
          scrapeMarkdown: () => "# AI agent\n\nNo repository cards here.",
        })
      ).rejects.toThrow("No repositories extracted");

      const rawMarkdown = readFileSync(path.join(tmpRoot, "topic.md"), "utf-8");
      expect(rawMarkdown).toContain("No repository cards here.");
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
