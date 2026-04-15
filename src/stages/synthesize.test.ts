import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { synthesize } from "./synthesize.js";

describe("synthesize", () => {
  test("writes knowledge graph output even when no alive tools need synthesis", async () => {
    const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "gitgod-synthesize-"));

    try {
      const enrichedPath = path.join(tmpRoot, "enriched.json");
      const skeleton = {
        repo: "owner/repo",
        url: "https://github.com/owner/repo",
        scraped_at: new Date().toISOString(),
        stats: { categories: 0, links: 0 },
        taxonomy: [],
      };
      writeFileSync(enrichedPath, JSON.stringify(skeleton, null, 2), "utf-8");

      const outputPath = await synthesize(enrichedPath);

      expect(outputPath).toBe(path.join(tmpRoot, "knowledge-graph.json"));
      expect(existsSync(outputPath)).toBe(true);
      expect(JSON.parse(readFileSync(outputPath, "utf-8"))).toEqual(skeleton);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  test("does not resume stale output when repo identity differs", async () => {
    const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "gitgod-synthesize-"));

    try {
      const enrichedPath = path.join(tmpRoot, "enriched.json");
      const outputPath = path.join(tmpRoot, "knowledge-graph.json");
      const previous = {
        repo: "owner-a/repo-a",
        url: "https://github.com/owner-a/repo-a",
        scraped_at: new Date().toISOString(),
        stats: { categories: 0, links: 0 },
        taxonomy: [],
      };
      const enriched = {
        repo: "owner-b/repo-b",
        url: "https://github.com/owner-b/repo-b",
        scraped_at: new Date().toISOString(),
        stats: { categories: 0, links: 0 },
        taxonomy: [],
      };
      writeFileSync(outputPath, JSON.stringify(previous, null, 2), "utf-8");
      writeFileSync(enrichedPath, JSON.stringify(enriched, null, 2), "utf-8");

      await synthesize(enrichedPath);

      expect(JSON.parse(readFileSync(outputPath, "utf-8"))).toEqual(enriched);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  test("does not resume stale output when tool identities differ", async () => {
    const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "gitgod-synthesize-"));

    try {
      const enrichedPath = path.join(tmpRoot, "enriched.json");
      const outputPath = path.join(tmpRoot, "knowledge-graph.json");
      const previous = {
        repo: "owner/repo",
        url: "https://github.com/owner/repo",
        scraped_at: new Date().toISOString(),
        stats: { categories: 1, links: 1 },
        taxonomy: [
          {
            category: "Cat",
            depth: 1,
            tools: [
              {
                name: "Old Tool",
                url: "https://example.com/old",
                description: "",
                link_type: "website",
                status: "dead",
              },
            ],
            subcategories: [],
          },
        ],
      };
      const enriched = {
        repo: "owner/repo",
        url: "https://github.com/owner/repo",
        scraped_at: new Date().toISOString(),
        stats: { categories: 1, links: 1 },
        taxonomy: [
          {
            category: "Cat",
            depth: 1,
            tools: [
              {
                name: "New Tool",
                url: "https://example.com/new",
                description: "",
                link_type: "website",
                status: "dead",
              },
            ],
            subcategories: [],
          },
        ],
      };
      writeFileSync(outputPath, JSON.stringify(previous, null, 2), "utf-8");
      writeFileSync(enrichedPath, JSON.stringify(enriched, null, 2), "utf-8");

      await synthesize(enrichedPath);

      expect(JSON.parse(readFileSync(outputPath, "utf-8"))).toEqual(enriched);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
