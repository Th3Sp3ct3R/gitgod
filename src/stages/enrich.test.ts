import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { enrich } from "./enrich.js";

describe("enrich", () => {
  test("writes enriched output even when skeleton has zero links", async () => {
    const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "gitgod-enrich-"));

    try {
      const skeletonPath = path.join(tmpRoot, "skeleton.json");
      writeFileSync(
        skeletonPath,
        JSON.stringify(
          {
            repo: "owner/repo",
            url: "https://github.com/owner/repo",
            scraped_at: new Date().toISOString(),
            stats: { categories: 0, links: 0 },
            taxonomy: [],
          },
          null,
          2
        ),
        "utf-8"
      );

      const outputPath = await enrich(skeletonPath, 1);

      expect(outputPath).toBe(path.join(tmpRoot, "enriched.json"));
      expect(existsSync(outputPath)).toBe(true);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
