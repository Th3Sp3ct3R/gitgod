export interface TrendshiftTopicRepo {
  repoName: string;
  trendshiftRepoUrl: string;
  githubUrl?: string;
  language?: string;
  metrics: number[];
  tags: string[];
  description?: string;
}

export interface TrendshiftTopicParseResult {
  topicName: string;
  topicUrl: string;
  repos: TrendshiftTopicRepo[];
}

const TREND_REPO_LINE_RE = /^\[([^[\]]+\/[^[\]]+)\]\((https:\/\/trendshift\.io\/repositories\/\d+)\)/;
const GITHUB_LINE_RE = /^\[GitHub\]\((https:\/\/github\.com\/[^)]+)\)$/;
const TAG_RE = /\[#([^[\]]+)\]\(https:\/\/trendshift\.io\/topics\/[^)]+\)/g;
const METRIC_RE = /^\d+(?:\.\d+)?k?$/i;

export function parseTrendshiftTopicMarkdown(
  markdown: string,
  topicUrl: string
): TrendshiftTopicParseResult {
  const lines = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const topicName = extractTopicName(lines, topicUrl);
  const repos: TrendshiftTopicRepo[] = [];
  let current: TrendshiftTopicRepo | undefined;
  let seenGithubOrTags = false;

  const flushCurrent = () => {
    if (!current) return;
    repos.push(current);
    current = undefined;
    seenGithubOrTags = false;
  };

  for (const line of lines) {
    if (line.startsWith("Load more repositories")) {
      flushCurrent();
      break;
    }

    const repoMatch = line.match(TREND_REPO_LINE_RE);
    if (repoMatch) {
      flushCurrent();
      current = {
        repoName: repoMatch[1],
        trendshiftRepoUrl: repoMatch[2],
        metrics: [],
        tags: [],
      };
      continue;
    }

    if (!current) {
      continue;
    }

    const githubMatch = line.match(GITHUB_LINE_RE);
    if (githubMatch) {
      current.githubUrl = githubMatch[1];
      seenGithubOrTags = true;
      continue;
    }

    const tags = [...line.matchAll(TAG_RE)].map((match) => match[1]);
    if (tags.length > 0) {
      current.tags.push(...tags);
      seenGithubOrTags = true;
      continue;
    }

    if (METRIC_RE.test(line)) {
      const parsedMetric = parseMetric(line);
      if (parsedMetric !== undefined) {
        current.metrics.push(parsedMetric);
      }
      continue;
    }

    if (!seenGithubOrTags && !current.language && isProbableLanguage(line)) {
      current.language = line;
      continue;
    }

    if (!current.description) {
      current.description = line;
    } else {
      current.description += ` ${line}`;
    }
  }

  flushCurrent();

  return {
    topicName,
    topicUrl,
    repos,
  };
}

function extractTopicName(lines: string[], topicUrl: string): string {
  const heading = lines.find((line) => line.startsWith("# "));
  if (heading) {
    return heading.replace(/^#\s+/, "");
  }

  const fallback = topicUrl.split("/").filter(Boolean).at(-1) ?? "unknown";
  return fallback.replace(/-/g, " ");
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
