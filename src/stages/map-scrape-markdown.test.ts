import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { mapAndScrapeMarkdown } from "./map-scrape-markdown.js";

describe("mapAndScrapeMarkdown", () => {
  it("creates per-subrepo markdown and an index", async () => {
    const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "gitgod-markdown-"));
    try {
      const dataDir = path.join(tmpRoot, "data", "sample");
      mkdirSync(dataDir, { recursive: true });

      const enrichedPath = path.join(dataDir, "enriched.json");
      writeFileSync(
        enrichedPath,
        JSON.stringify(
          {
            repo: "owner/main",
            url: "https://github.com/owner/main",
            scraped_at: new Date().toISOString(),
            stats: { categories: 1, links: 1 },
            taxonomy: [
              {
                category: "Main",
                depth: 2,
                tools: [
                  {
                    name: "SubRepo",
                    url: "https://github.com/acme/subrepo",
                    description: "sub repo",
                    link_type: "github",
                    status: "alive",
                  },
                ],
                subcategories: [],
              },
            ],
          },
          null,
          2
        )
      );

      const indexPath = await mapAndScrapeMarkdown(enrichedPath, undefined, {
        fetchRepoReadme: async () =>
          "# Subrepo\n\n- [Docs](https://docs.example.com)\n- [API](https://api.example.com/reference)\n",
        scrapeLink: async (url: string) => ({
          url,
          title: `Title for ${url}`,
          description: `Description for ${url}`,
          snippet: `Snippet for ${url}`,
          sourceType: "website",
        }),
      });

      const indexMd = readFileSync(indexPath, "utf-8");
      expect(indexMd).toContain("Subrepo Markdown Crawl");
      expect(indexMd).toContain("acme/subrepo");

      const subrepoMdPath = path.join(path.dirname(indexPath), "acme__subrepo.md");
      const subrepoMd = readFileSync(subrepoMdPath, "utf-8");
      expect(subrepoMd).toContain("https://docs.example.com");
      expect(subrepoMd).toContain("https://api.example.com/reference");
      expect(subrepoMd).toContain("Title for https://docs.example.com");
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("continues crawling when one subrepo fails", async () => {
    const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "gitgod-markdown-"));
    try {
      const dataDir = path.join(tmpRoot, "data", "sample");
      mkdirSync(dataDir, { recursive: true });
      const enrichedPath = path.join(dataDir, "enriched.json");
      writeFileSync(
        enrichedPath,
        JSON.stringify(
          {
            repo: "owner/main",
            url: "https://github.com/owner/main",
            scraped_at: new Date().toISOString(),
            stats: { categories: 1, links: 2 },
            taxonomy: [
              {
                category: "Main",
                depth: 2,
                tools: [
                  {
                    name: "BrokenRepo",
                    url: "https://github.com/acme/broken",
                    description: "broken",
                    link_type: "github",
                    status: "alive",
                  },
                  {
                    name: "GoodRepo",
                    url: "https://github.com/acme/good",
                    description: "good",
                    link_type: "github",
                    status: "alive",
                  },
                ],
                subcategories: [],
              },
            ],
          },
          null,
          2
        )
      );

      const indexPath = await mapAndScrapeMarkdown(enrichedPath, undefined, {
        fetchRepoReadme: async (owner: string, repo: string) => {
          if (repo === "broken") throw new Error("simulated failure");
          return `# ${owner}/${repo}\n\n- [A](https://a.example.com)\n`;
        },
        scrapeLink: async (url: string) => ({
          url,
          title: "ok",
          description: "",
          snippet: "",
          sourceType: "website",
        }),
      });

      const index = readFileSync(indexPath, "utf-8");
      expect(index).toContain("acme/good");
      expect(index).not.toContain("acme/broken");
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
