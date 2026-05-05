// src/lib/llms-txt-parser.ts
// Structured parser for the llms.txt specification.
//
// llms.txt entries look like:
//   - [Quickstart](https://docs.example.com/quickstart): Get started in 5 minutes
//   - [API Reference](https://docs.example.com/api): Complete API docs
//
// This parser extracts the title, URL, and description from each entry,
// preserving the site owner's own taxonomy as structured metadata.

export interface LlmsTxtEntry {
  /** Display title from the markdown link text. */
  title: string;
  /** The URL from the markdown link. */
  url: string;
  /** Description text after the colon, if present. */
  description: string;
  /** Raw line from the llms.txt file. */
  raw: string;
}

export interface LlmsTxtParseResult {
  /** Header/title of the llms.txt file (first H1 or first non-empty line). */
  header: string | null;
  /** Preamble text before the first link entry. */
  preamble: string | null;
  /** Parsed link entries with title + description preserved. */
  entries: LlmsTxtEntry[];
  /** URLs that were found via plain URL regex but not in markdown link syntax. */
  bareUrls: string[];
}

/**
 * Parse a llms.txt file into structured entries.
 *
 * Handles both formats:
 *   1. Markdown link syntax: `- [Title](url): Description`
 *   2. Bare URLs: `https://example.com/page`
 *
 * Title and description are preserved for downstream frontmatter injection.
 */
export function parseLlmsTxt(content: string): LlmsTxtParseResult {
  const lines = content.split("\n");
  const entries: LlmsTxtEntry[] = [];
  const bareUrls: string[] = [];
  let header: string | null = null;
  const preambleLines: string[] = [];
  let foundFirstEntry = false;

  // Markdown link with optional description:
  //   - [Title](https://example.com/path): Description text
  //   [Title](https://example.com/path): Description text
  //   * [Title](https://example.com/path) - Description text
  const mdLinkRegex =
    /^[\s\-\*]*\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)[\s:–—\-]*(.*)$/;

  // Bare URL on its own line
  const bareUrlRegex = /^\s*(https?:\/\/[^\s\)>\]"']+)\s*$/;

  // H1 header
  const h1Regex = /^#\s+(.+)$/;

  for (const line of lines) {
    const trimmed = line.trim();

    // Extract H1 header (first one wins)
    if (!header) {
      const h1Match = h1Regex.exec(trimmed);
      if (h1Match) {
        header = h1Match[1].trim();
        continue;
      }
    }

    // Try markdown link syntax first
    const mdMatch = mdLinkRegex.exec(trimmed);
    if (mdMatch) {
      foundFirstEntry = true;
      entries.push({
        title: mdMatch[1].trim(),
        url: mdMatch[2].trim(),
        description: mdMatch[3]?.trim() ?? "",
        raw: trimmed,
      });
      continue;
    }

    // Try bare URL
    const bareMatch = bareUrlRegex.exec(trimmed);
    if (bareMatch) {
      foundFirstEntry = true;
      bareUrls.push(bareMatch[1].trim());
      continue;
    }

    // Collect preamble lines (before first entry)
    if (!foundFirstEntry && trimmed.length > 0) {
      // Skip the header line itself
      if (trimmed !== header) {
        preambleLines.push(trimmed);
      }
    }
  }

  return {
    header,
    preamble: preambleLines.length > 0 ? preambleLines.join("\n") : null,
    entries,
    bareUrls,
  };
}

/**
 * Extract all URLs from a llms.txt file — both from markdown links
 * and bare URLs. Returns deduplicated list.
 */
export function extractAllUrls(parsed: LlmsTxtParseResult): string[] {
  const urls = [
    ...parsed.entries.map((e) => e.url),
    ...parsed.bareUrls,
  ];
  return [...new Set(urls)];
}

/**
 * Look up a URL in the parsed entries to get its title and description.
 * Returns null if the URL was a bare URL without metadata.
 */
export function findEntryByUrl(
  parsed: LlmsTxtParseResult,
  url: string,
): LlmsTxtEntry | null {
  // Normalize trailing slashes for comparison
  const normalize = (u: string) => u.replace(/\/+$/, "").toLowerCase();
  const needle = normalize(url);
  return parsed.entries.find((e) => normalize(e.url) === needle) ?? null;
}
