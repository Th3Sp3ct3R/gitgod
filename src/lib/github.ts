export interface GitHubRepoRef {
  owner: string;
  repo: string;
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

export function parseGitHubUrl(url: string): GitHubRepoRef | null {
  const match = url.match(/github\.com\/([^\/\s#?]+)\/([^\/\s#?]+)/);
  if (!match) return null;
  const repo = match[2].replace(/\.git$/, "");
  return { owner: match[1], repo };
}

export async function githubApiFetch(endpoint: string): Promise<any> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "GitGod/0.1",
  };
  if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const res = await fetch(`https://api.github.com/${endpoint}`, {
    signal: controller.signal,
    headers,
  });
  clearTimeout(timeout);

  if (!res.ok) return null;
  return res.json();
}

export async function scrapeGitHub(owner: string, repo: string): Promise<any | null> {
  try {
    const meta = await githubApiFetch(`repos/${owner}/${repo}`);
    if (!meta) return null;

    let readme = "";
    try {
      const readmeData = await githubApiFetch(`repos/${owner}/${repo}/readme`);
      if (readmeData?.content) {
        readme = Buffer.from(readmeData.content, "base64").toString("utf-8");
      }
    } catch {
      // no readme
    }

    return {
      title: meta.full_name || `${owner}/${repo}`,
      description: meta.description || "",
      content_preview: readme.slice(0, 2000),
      github_meta: {
        stars: meta.stargazers_count || 0,
        language: meta.language || "unknown",
        last_commit: meta.pushed_at || "",
        topics: meta.topics || [],
      },
      scraped_at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
