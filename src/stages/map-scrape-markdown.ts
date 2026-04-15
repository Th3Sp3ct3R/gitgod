import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { extractHttpLinksFromMarkdown } from "../parsers/markdown-ast.js";
import type { Category, ScrapedData, Skeleton, Tool } from "../types.js";
import { githubApiFetch, parseGitHubUrl, scrapeGitHub } from "../lib/github.js";

interface CrawlResult {
  repoName: string;
  repoUrl: string;
  outputPath: string;
  discoveredLinks: number;
  scrapedLinks: number;
}

interface LinkMarkdownData {
  url: string;
  title: string;
  description: string;
  snippet: string;
  sourceType: "github" | "website";
}

export interface MapMarkdownOptions {
  limitSubrepos?: number;
  limitLinksPerRepo?: number;
  linkConcurrency?: number;
  repoConcurrency?: number;
}

interface MapMarkdownDeps {
  fetchRepoReadme: (owner: string, repo: string) => Promise<string | null>;
  scrapeLink: (url: string) => Promise<LinkMarkdownData | null>;
}

function flattenTools(categories: Category[]): Tool[] {
  const tools: Tool[] = [];
  const walk = (cats: Category[]) => {
    for (const category of cats) {
      tools.push(...category.tools);
      walk(category.subcategories);
    }
  };
  walk(categories);
  return tools;
}

function fileNameForRepo(owner: string, repo: string): string {
  const raw = `${owner}__${repo}`.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${raw}.md`;
}

async function fetchRepoReadmeMarkdown(owner: string, repo: string): Promise<string | null> {
  try {
    const readmeData = await githubApiFetch(`repos/${owner}/${repo}/readme`);
    if (readmeData?.content) {
      return Buffer.from(readmeData.content, "base64").toString("utf-8");
    }
  } catch {
    // Fall back to raw file fetch below.
  }

  // Fallback when API is rate-limited or unavailable.
  const branches = ["HEAD", "main", "master"];
  const names = ["README.md", "readme.md", "README.MD", "Readme.md"];
  for (const branch of branches) {
    for (const name of names) {
      let timeout: NodeJS.Timeout | undefined;
      try {
        const controller = new AbortController();
        timeout = setTimeout(() => controller.abort(), 12000);
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${name}`;
        const response = await fetch(rawUrl, {
          signal: controller.signal,
          headers: { "User-Agent": "GitGod/0.1 (markdown-crawler)" },
        });
        if (!response.ok) continue;
        return await response.text();
      } catch {
        // Keep trying alternative paths.
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    }
  }
  return null;
}

function isPrivateIpAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const parts = ip.split(".").map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return true;
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    return false;
  }
  if (version === 6) {
    const normalized = ip.toLowerCase();
    if (normalized === "::1") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    if (normalized.startsWith("fe80")) return true;
    return false;
  }
  return true;
}

async function isSafePublicUrl(rawUrl: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    hostname === "metadata.google.internal" ||
    hostname === "169.254.169.254"
  ) {
    return false;
  }

  if (isIP(hostname) && isPrivateIpAddress(hostname)) return false;

  try {
    const resolved = await lookup(hostname, { all: true });
    if (resolved.some((entry) => isPrivateIpAddress(entry.address))) {
      return false;
    }
  } catch {
    // If DNS fails, rely on fetch failure rather than preemptively blocking.
  }

  return true;
}

async function scrapeUrlForMarkdown(url: string): Promise<LinkMarkdownData | null> {
  const gh = parseGitHubUrl(url);
  if (gh) {
    const scraped = await scrapeGitHub(gh.owner, gh.repo);
    if (!scraped) {
      return {
        url,
        title: `${gh.owner}/${gh.repo}`,
        description: "",
        snippet: "",
        sourceType: "github",
      };
    }
    return {
      url,
      title: scraped.title || `${gh.owner}/${gh.repo}`,
      description: scraped.description || "",
      snippet: (scraped.content_preview || "").slice(0, 600),
      sourceType: "github",
    };
  }

  if (!(await isSafePublicUrl(url))) return null;

  let timeout: NodeJS.Timeout | undefined;
  try {
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "GitGod/0.1 (markdown-crawler)" },
      redirect: "error",
    });
    if (!response.ok) return null;
    const html = await response.text();
    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || url;
    const description =
      html
        .match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1]
        ?.trim() || "";
    const snippet = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 600);
    return { url, title, description, snippet, sourceType: "website" };
  } catch {
    return null;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function renderSubrepoMarkdown(
  parentRepo: string,
  repoName: string,
  repoUrl: string,
  links: LinkMarkdownData[]
): string {
  const lines: string[] = [];
  lines.push(`# ${repoName} — Link Crawl`);
  lines.push("");
  lines.push(`- Parent graph: \`${parentRepo}\``);
  lines.push(`- Subrepo: [${repoName}](${repoUrl})`);
  lines.push(`- Scraped links: ${links.length}`);
  lines.push(`- Generated at: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Scraped Links");
  lines.push("");

  for (const link of links) {
    lines.push(`### [${link.title || link.url}](${link.url})`);
    lines.push("");
    lines.push(`- Source type: ${link.sourceType}`);
    if (link.description) lines.push(`- Description: ${link.description}`);
    lines.push("");
    if (link.snippet) {
      lines.push("```text");
      lines.push(link.snippet);
      lines.push("```");
      lines.push("");
    }
  }

  return `${lines.join("\n").trim()}\n`;
}

function defaultDeps(): MapMarkdownDeps {
  return {
    fetchRepoReadme: fetchRepoReadmeMarkdown,
    scrapeLink: scrapeUrlForMarkdown,
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const size = Math.max(1, concurrency);
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= items.length) return;
      results[current] = await mapper(items[current], current);
    }
  }

  await Promise.all(Array.from({ length: Math.min(size, items.length) }, () => worker()));
  return results;
}

export async function mapAndScrapeMarkdown(
  enrichedPath: string,
  options: MapMarkdownOptions = {},
  deps: MapMarkdownDeps = defaultDeps()
): Promise<string> {
  const skeleton = JSON.parse(readFileSync(enrichedPath, "utf-8")) as Skeleton;
  const allTools = flattenTools(skeleton.taxonomy);
  const githubTools = allTools.filter(
    (tool) => tool.link_type === "github" && tool.status === "alive" && parseGitHubUrl(tool.url)
  );
  const selectedTools =
    options.limitSubrepos && options.limitSubrepos > 0
      ? githubTools.slice(0, options.limitSubrepos)
      : githubTools;

  const outputDir = path.join(path.dirname(enrichedPath), "markdown");
  mkdirSync(outputDir, { recursive: true });

  const repoConcurrency = options.repoConcurrency && options.repoConcurrency > 0 ? options.repoConcurrency : 3;
  const crawledResults = await mapWithConcurrency(selectedTools, repoConcurrency, async (tool) => {
    try {
      const gh = parseGitHubUrl(tool.url);
      if (!gh) return null;
      const repoName = `${gh.owner}/${gh.repo}`;
      console.log(`  [markdown] mapping ${repoName}...`);

      const readme = await deps.fetchRepoReadme(gh.owner, gh.repo);
      if (!readme) {
        console.log(`    skip: no README`);
        return null;
      }

      const discovered = extractHttpLinksFromMarkdown(readme);
      const linksToScrape =
        options.limitLinksPerRepo && options.limitLinksPerRepo > 0
          ? discovered.slice(0, options.limitLinksPerRepo)
          : discovered;

      const concurrency = options.linkConcurrency && options.linkConcurrency > 0 ? options.linkConcurrency : 8;
      const scraped = await mapWithConcurrency(linksToScrape, concurrency, (link) => deps.scrapeLink(link));
      const scrapedLinks = scraped.filter((value): value is LinkMarkdownData => Boolean(value));

      const filePath = path.join(outputDir, fileNameForRepo(gh.owner, gh.repo));
      writeFileSync(
        filePath,
        renderSubrepoMarkdown(skeleton.repo, repoName, tool.url, scrapedLinks),
        "utf-8"
      );
      console.log(`    wrote ${path.basename(filePath)} (${scrapedLinks.length}/${discovered.length})`);
      return {
        repoName,
        repoUrl: tool.url,
        outputPath: filePath,
        discoveredLinks: discovered.length,
        scrapedLinks: scrapedLinks.length,
      } satisfies CrawlResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`    skip: crawl error (${message.slice(0, 120)})`);
      return null;
    }
  });
  const results = crawledResults.filter((value): value is CrawlResult => Boolean(value));

  const indexLines: string[] = [];
  indexLines.push("# Subrepo Markdown Crawl");
  indexLines.push("");
  indexLines.push(`- Root repo: \`${skeleton.repo}\``);
  indexLines.push(`- Subrepos processed: ${results.length}`);
  indexLines.push(`- Generated at: ${new Date().toISOString()}`);
  indexLines.push("");
  indexLines.push("## Artifacts");
  indexLines.push("");
  for (const result of results) {
    indexLines.push(
      `- [${result.repoName}](${path.basename(result.outputPath)}) — scraped ${result.scrapedLinks}/${result.discoveredLinks} links`
    );
  }
  indexLines.push("");

  const indexPath = path.join(outputDir, "INDEX.md");
  writeFileSync(indexPath, `${indexLines.join("\n").trim()}\n`, "utf-8");
  console.log(`  [markdown] index -> ${indexPath}`);
  return indexPath;
}
