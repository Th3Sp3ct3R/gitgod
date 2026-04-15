/**
 * Parser for the Trendshift daily explore page (https://trendshift.io/).
 *
 * The explore page shows daily trending repositories in a card list.
 * Each card follows roughly the same markdown structure as topic pages:
 *
 *   [owner/repo](https://trendshift.io/repositories/<id>)
 *   <language>
 *   <metric1>
 *   <metric2>
 *   [GitHub](https://github.com/owner/repo)
 *   [#tag1](...) [#tag2](...)
 *   <description text>
 *
 * But the explore page may also include:
 * - Numbered rank prefixes (e.g., "1", "2", ...)
 * - Section headers like "Today's trending repositories"
 * - Date context in headers or surrounding text
 */

export interface TrendshiftExploreRepo {
  rank?: number;
  repoName: string;
  trendshiftRepoUrl: string;
  githubUrl?: string;
  language?: string;
  metrics: number[];
  tags: string[];
  description?: string;
}

export interface TrendshiftExploreParseResult {
  date: string;
  sourceUrl: string;
  repos: TrendshiftExploreRepo[];
}

/** Matches repo card links: [owner/repo](https://trendshift.io/repositories/12345) */
const REPO_LINE_RE =
  /^\[([^[\]]+\/[^[\]]+)\]\((https:\/\/trendshift\.io\/repositories\/\d+)\)$/;

/** Matches GitHub links: [GitHub](https://github.com/owner/repo) */
const GITHUB_LINE_RE = /^\[GitHub\]\((https:\/\/github\.com\/[^)]+)\)$/;

/** Matches topic tag links: [#tag](https://trendshift.io/topics/...) */
const TAG_RE = /\[#([^[\]]+)\]\(https:\/\/trendshift\.io\/topics\/[^)]+\)/g;

/** Matches numeric metrics like 542, 3.3k, 1.2k */
const METRIC_RE = /^\d+(?:\.\d+)?k?$/i;

/** Matches a bare rank number that precedes a repo card (e.g., "1", "23") */
const RANK_RE = /^(\d{1,3})$/;

/**
 * Parse the daily explore page markdown into structured repo data.
 *
 * @param markdown - Raw markdown from Firecrawl scrape of https://trendshift.io/
 * @param date - ISO date string (YYYY-MM-DD) for this explore snapshot
 * @param sourceUrl - The URL that was scraped (defaults to https://trendshift.io/)
 */
export function parseTrendshiftExploreMarkdown(
  markdown: string,
  date: string,
  sourceUrl = "https://trendshift.io/"
): TrendshiftExploreParseResult {
  const lines = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const repos: TrendshiftExploreRepo[] = [];
  let current: TrendshiftExploreRepo | undefined;
  let seenGithubOrTags = false;
  let pendingRank: number | undefined;

  const flushCurrent = () => {
    if (!current) return;
    repos.push(current);
    current = undefined;
    seenGithubOrTags = false;
  };

  for (const line of lines) {
    // Stop at common page-footer markers
    if (
      line.startsWith("Load more repositories") ||
      line.startsWith("Load more") ||
      line === "Show more"
    ) {
      flushCurrent();
      break;
    }

    // Detect a bare rank number (comes before the repo link line on explore pages)
    const rankMatch = line.match(RANK_RE);
    if (rankMatch && !current) {
      pendingRank = parseInt(rankMatch[1], 10);
      continue;
    }

    // Detect a repo card link
    const repoMatch = line.match(REPO_LINE_RE);
    if (repoMatch) {
      flushCurrent();
      current = {
        repoName: repoMatch[1],
        trendshiftRepoUrl: repoMatch[2],
        metrics: [],
        tags: [],
      };
      if (pendingRank !== undefined) {
        current.rank = pendingRank;
        pendingRank = undefined;
      } else {
        // Auto-assign rank based on position
        current.rank = repos.length + 1;
      }
      continue;
    }

    // If no current card being built, skip remaining matchers
    if (!current) {
      pendingRank = undefined;
      continue;
    }

    // GitHub URL line
    const githubMatch = line.match(GITHUB_LINE_RE);
    if (githubMatch) {
      current.githubUrl = githubMatch[1];
      seenGithubOrTags = true;
      continue;
    }

    // Tags line (may contain multiple tags)
    const tags = [...line.matchAll(TAG_RE)].map((m) => m[1]);
    if (tags.length > 0) {
      current.tags.push(...tags);
      seenGithubOrTags = true;
      continue;
    }

    // Metric line (e.g., "542", "3.3k")
    if (METRIC_RE.test(line)) {
      const parsed = parseMetric(line);
      if (parsed !== undefined) {
        current.metrics.push(parsed);
      }
      continue;
    }

    // Language line (short, no links, appears before GitHub/tags)
    if (!seenGithubOrTags && !current.language && isProbableLanguage(line)) {
      current.language = line;
      continue;
    }

    // Everything else is description text
    if (!current.description) {
      current.description = line;
    } else {
      current.description += ` ${line}`;
    }
  }

  flushCurrent();

  return {
    date,
    sourceUrl,
    repos,
  };
}

function parseMetric(raw: string): number | undefined {
  const lower = raw.toLowerCase();
  if (lower.endsWith("k")) {
    const value = Number.parseFloat(lower.slice(0, -1));
    if (!Number.isFinite(value)) return undefined;
    return Math.round(value * 1000);
  }
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : undefined;
}

function isProbableLanguage(line: string): boolean {
  if (line.startsWith("[") || line.includes("https://")) return false;
  if (line.length > 40) return false;
  return /^[A-Za-z0-9#+._ -]+$/.test(line);
}
